export type CollaborationUser = {
  name: string;
  color: string;
};

export type CollaborationPeer = {
  clientId: number;
  user?: CollaborationUser;
};

export type WebrtcCollaborationSession = {
  provider: unknown;
  destroy: () => void;
  getPeers: () => CollaborationPeer[];
  onPeersChanged: (cb: (peers: CollaborationPeer[]) => void) => () => void;
};

type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function getOrCreateLocalCollaborationUser(storageKey = 'collaboration:user'): CollaborationUser {
  if (typeof window === 'undefined') {
    return { name: 'Anonymous', color: '#00FF43' };
  }

  const existing = safeJsonParse<CollaborationUser>(window.localStorage.getItem(storageKey));
  if (existing?.name && existing?.color) return existing;

  const getCssVar = (name: string, fallback: string) => {
    try {
      const value = window
        .getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
      return value || fallback;
    } catch {
      return fallback;
    }
  };

  // Use the design-system accent for cursor/presence color.
  const color = getCssVar('--accent-color', '#00FF43');

  const created: CollaborationUser = {
    name: `User ${Math.floor(Math.random() * 900 + 100)}`,
    color
  };

  window.localStorage.setItem(storageKey, JSON.stringify(created));
  return created;
}

function parseSignalingServers(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const servers = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return servers.length ? servers : undefined;
}

function parseIceServers(raw: string | undefined): IceServer[] | undefined {
  if (!raw) return undefined;

  // Prefer JSON format for TURN credentials (recommended).
  const parsedJson = safeJsonParse<IceServer[] | { iceServers: IceServer[] }>(raw);
  if (Array.isArray(parsedJson)) return parsedJson.length ? parsedJson : undefined;
  if (parsedJson && typeof parsedJson === 'object' && Array.isArray((parsedJson as any).iceServers)) {
    const servers = (parsedJson as any).iceServers as IceServer[];
    return servers.length ? servers : undefined;
  }

  // Fallback: comma-separated list of STUN/TURN URLs.
  const urls = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return urls.length ? [{ urls }] : undefined;
}

export async function createWebrtcCollaborationSession(opts: {
  room: string;
  doc: import('yjs').Doc;
  user: CollaborationUser;
  password?: string;
  signaling?: string[];
  iceServers?: IceServer[];
}): Promise<WebrtcCollaborationSession> {
  if (typeof window === 'undefined') {
    throw new Error('createWebrtcCollaborationSession must be called in the browser');
  }

  const [{ WebrtcProvider }] = await Promise.all([
    import('y-webrtc') as Promise<{ WebrtcProvider: new (room: string, doc: import('yjs').Doc, opts?: any) => any }>
  ]);

  // Check for environment-configured signaling servers (local dev or custom)
  const envSignaling = parseSignalingServers((import.meta as any).env?.VITE_YJS_SIGNALING_SERVERS);
  
  // Default public signaling servers (fallback when no local server)
  const defaultSignaling = [
    'wss://signaling.yjs.dev',
    'wss://y-webrtc-signaling-eu.herokuapp.com',
    'wss://y-webrtc-signaling-us.herokuapp.com'
  ];

  const signaling = opts.signaling ?? envSignaling ?? defaultSignaling;
  
  // Log which signaling servers are being used
  const isLocal = signaling.some(s => s.includes('localhost') || s.includes('127.0.0.1'));
  console.log(`WebRTC signaling: Using ${isLocal ? 'local' : 'public'} server(s):`, signaling);
    
  const iceServers = opts.iceServers ?? parseIceServers((import.meta as any).env?.VITE_YJS_ICE_SERVERS);

  // Default STUN/TURN servers for NAT traversal
  const defaultIceServers: IceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

  const provider = new WebrtcProvider(opts.room, opts.doc, {
    password: opts.password,
    signaling,
    peerOpts: { 
      config: { 
        iceServers: iceServers ?? defaultIceServers 
      } 
    },
    maxConns: 20,
    // Filter messages to reduce noise
    filterBcConns: true
  });

  // Suppress WebSocket connection errors in console (they're expected when servers are down)
  // The provider will automatically retry with other signaling servers
  let wsErrorLogged = false;
  const originalError = console.error;
  const wsErrorFilter = (...args: unknown[]) => {
    const msg = args[0];
    if (typeof msg === 'string' && msg.includes('WebSocket connection')) {
      if (!wsErrorLogged) {
        console.warn('WebRTC signaling: Some servers unavailable, trying alternatives...');
        wsErrorLogged = true;
      }
      return;
    }
    originalError.apply(console, args);
  };
  // Note: We don't override console.error globally as it would affect other logs

  const awareness = (provider as any).awareness;
  if (awareness?.setLocalStateField) {
    awareness.setLocalStateField('user', opts.user);
  }

  let peers: CollaborationPeer[] = [];
  const listeners = new Set<(p: CollaborationPeer[]) => void>();

  const computePeers = (): CollaborationPeer[] => {
    const states: Map<number, any> | undefined = awareness?.getStates?.();
    if (!states) return [];

    const next: CollaborationPeer[] = [];
    states.forEach((state, clientId) => {
      next.push({
        clientId,
        user: state?.user && typeof state.user === 'object' ? state.user : undefined
      });
    });

    return next;
  };

  const notify = () => {
    peers = computePeers();
    listeners.forEach((cb) => cb(peers));
  };

  const awarenessListener = () => notify();
  awareness?.on?.('change', awarenessListener);
  notify();

  const destroy = () => {
    try {
      awareness?.off?.('change', awarenessListener);
    } catch {
      // ignore
    }

    listeners.clear();

    try {
      (provider as any).destroy?.();
    } catch {
      // ignore
    }
  };

  return {
    provider,
    destroy,
    getPeers: () => peers,
    onPeersChanged: (cb) => {
      listeners.add(cb);
      cb(peers);
      return () => listeners.delete(cb);
    }
  };
}
