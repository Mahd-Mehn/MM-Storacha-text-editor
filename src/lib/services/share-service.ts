/**
 * Share Service
 * 
 * Manages sharing and permissions for databases and notes.
 * Supports public links, user-specific access, and permission management.
 * 
 * Features:
 * - Generate shareable public links with configurable permissions
 * - Token-based access validation
 * - Permission levels: view, comment, edit, admin
 * - Link expiration and password protection
 * - Access revocation
 */

import type {
  ShareConfig,
  PublicShareLink,
  SharePermission,
  EnhancedShareServiceInterface,
  UCANDelegation,
  ResourceCapability,
  AccessGrantResult,
  ShareInvitation,
  SharedResourceInfo,
  EncryptedContent,
  EncryptedKeyShare,
  EnhancedShareConfig
} from '$lib/types/database';
import { storachaClient } from './storacha';
import { authService } from './auth';
import { spaceService } from './space';
import { databaseService } from './database-service';
import { pageManager } from './page-manager';
import { blockManager } from './block-manager';
import { cryptoUtils, type EncryptedPayload, type WrappedKey } from './crypto-utils';
import { workspaceState, type Page as WorkspacePage } from '$lib/stores/workspace';
import { get } from 'svelte/store';
import * as Delegation from '@storacha/client/delegation';

// Storage keys
const SHARE_CONFIGS_KEY = 'storacha_share_configs';
const SHARE_LINKS_KEY = 'storacha_share_links';
const SHARE_ACCESS_LOG_KEY = 'storacha_share_access_log';
const DELEGATIONS_KEY = 'storacha_delegations';
const INVITATIONS_KEY = 'storacha_invitations';
const SHORT_CODES_KEY = 'storacha_share_short_codes';

// Token v2 (self-contained, cross-device) helpers
const SHARE_TOKEN_USES_PREFIX = 'storacha_share_token_uses_';
const REVOKED_TOKEN_IDS_KEY = 'storacha_share_revoked_token_ids';

export type ShareTokenV2 = {
  v: 2;
  resourceType: 'database' | 'page';
  resourceId: string;
  cid: string;
  permission: SharePermission;
  expiresAt?: string;
  password?: string; // hashed
  maxUses?: number;
  jti: string;
  /** DID of the creator for identity verification */
  issuerDid?: string;
  /** Enable live sync via WebRTC */
  liveSync?: boolean;
};

/** Short code entry for friendly URLs */
export type ShortCodeEntry = {
  code: string;
  token: string;
  pageId: string;
  cid: string;
  createdAt: string;
  liveSync: boolean;
  expiresAt?: string;
};

const base64UrlEncodeBytes = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlDecodeToBytes = (input: string): Uint8Array => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const encodeShareTokenV2 = (payload: ShareTokenV2): string => {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  return base64UrlEncodeBytes(bytes);
};

export const decodeShareTokenV2 = (token: string): ShareTokenV2 | null => {
  try {
    const bytes = base64UrlDecodeToBytes(token);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as ShareTokenV2;
    if (
      parsed &&
      parsed.v === 2 &&
      typeof parsed.resourceId === 'string' &&
      typeof parsed.cid === 'string' &&
      typeof parsed.jti === 'string' &&
      (parsed.resourceType === 'database' || parsed.resourceType === 'page')
    ) {
      return parsed;
    }
    // Legacy fallback: check for old databaseId field
    const legacy = parsed as any;
    if (legacy.v === 2 && typeof legacy.databaseId === 'string' && typeof legacy.cid === 'string') {
      return {
        ...legacy,
        resourceType: 'database',
        resourceId: legacy.databaseId
      };
    }
    return null;
  } catch {
    return null;
  }
};

const getRevokedTokenIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(REVOKED_TOKEN_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
};

const addRevokedTokenId = (jti: string): void => {
  const set = getRevokedTokenIds();
  set.add(jti);
  localStorage.setItem(REVOKED_TOKEN_IDS_KEY, JSON.stringify(Array.from(set)));
};

// Generate secure token
const generateToken = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  // Fallback for older browsers
  return Array.from({ length: 32 }, () => 
    Math.random().toString(36).charAt(2)
  ).join('');
};

// Generate short ID
const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).substring(2, 10);
};

// Hash password using Web Crypto API
const hashPassword = async (password: string): Promise<string> => {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback - simple hash (not secure, but works)
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

// Generate a short, memorable share code (8 characters)
const generateShortCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  const array = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 8; i++) array[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < 8; i++) {
    code += chars[array[i] % chars.length];
  }
  return code;
};

// Short code storage helpers
const getShortCodes = (): Map<string, ShortCodeEntry> => {
  try {
    const raw = localStorage.getItem(SHORT_CODES_KEY);
    if (!raw) return new Map();
    const entries = JSON.parse(raw) as ShortCodeEntry[];
    return new Map(entries.map(e => [e.code, e]));
  } catch {
    return new Map();
  }
};

const saveShortCodes = (codes: Map<string, ShortCodeEntry>): void => {
  try {
    const entries = Array.from(codes.values());
    localStorage.setItem(SHORT_CODES_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Failed to save short codes:', e);
  }
};

/**
 * Share Service - Manages sharing and permissions
 */
class ShareService implements EnhancedShareServiceInterface {
  private shareConfigs: Map<string, EnhancedShareConfig> = new Map();
  private shareLinks: Map<string, PublicShareLink> = new Map();
  private delegations: Map<string, UCANDelegation> = new Map();
  private invitations: Map<string, ShareInvitation> = new Map();
  private initialized = false;

  // ============================================================================
  // Initialization
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load share configs from localStorage
      const configsData = localStorage.getItem(SHARE_CONFIGS_KEY);
      if (configsData) {
        const configs = JSON.parse(configsData) as EnhancedShareConfig[];
        for (const config of configs) {
          this.shareConfigs.set(config.id, config);
        }
      }

      // Load share links from localStorage
      const linksData = localStorage.getItem(SHARE_LINKS_KEY);
      if (linksData) {
        const links = JSON.parse(linksData) as PublicShareLink[];
        for (const link of links) {
          this.shareLinks.set(link.id, link);
        }
      }

      // Load delegations
      const delegationsData = localStorage.getItem(DELEGATIONS_KEY);
      if (delegationsData) {
        const delegations = JSON.parse(delegationsData) as UCANDelegation[];
        for (const delegation of delegations) {
          this.delegations.set(delegation.id, delegation);
        }
      }

      // Load invitations
      const invitationsData = localStorage.getItem(INVITATIONS_KEY);
      if (invitationsData) {
        const invitations = JSON.parse(invitationsData) as ShareInvitation[];
        for (const invitation of invitations) {
          this.invitations.set(invitation.id, invitation);
        }
      }

      this.initialized = true;
      console.log(`ShareService initialized with ${this.shareConfigs.size} configs and ${this.shareLinks.size} links`);
    } catch (error) {
      console.error('Failed to initialize ShareService:', error);
      this.initialized = true;
    }
  }

  // ============================================================================
  // Configuration Access
  // ============================================================================

  async getShareConfig(id: string): Promise<EnhancedShareConfig | null> {
    await this.initialize();
    return this.shareConfigs.get(id) || null;
  }

  async getShareConfigs(resourceId: string): Promise<EnhancedShareConfig[]> {
    await this.initialize();
    return Array.from(this.shareConfigs.values())
      .filter(config => config.databaseId === resourceId && config.isActive);
  }

  // ============================================================================
  // Public Link Management
  // ============================================================================

  /**
   * Create a public shareable link for a database
   */
  async createPublicLink(
    databaseId: string,
    permission: SharePermission,
    options?: {
      expiresAt?: string;
      password?: string;
      allowDuplication?: boolean;
      maxUses?: number;
    }
  ): Promise<PublicShareLink> {
    await this.initialize();

    const now = new Date().toISOString();
    const id = `share_${Date.now()}_${generateId()}`;

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (options?.password) {
      hashedPassword = await hashPassword(options.password);
    }

    // External share links must be loadable without the creator's localStorage.
    // We achieve this by embedding the Storacha manifest CID into the share token.
    let manifestCid: string | null = null;
    try {
      await databaseService.initialize();
      manifestCid = await databaseService.syncToStoracha(databaseId);
    } catch (error) {
      console.error('Failed to sync database for external sharing:', error);
      manifestCid = null;
    }

    if (!manifestCid) {
      throw new Error(
        'Cloud sync is required to create external share links. Login with email and ensure a Storacha space is provisioned.'
      );
    }

    const jti = generateToken();
    const issuerDid = authService.getCurrentDID() || undefined;
    const token = encodeShareTokenV2({
      v: 2,
      resourceType: 'database',
      resourceId: databaseId,
      cid: manifestCid,
      permission,
      expiresAt: options?.expiresAt,
      password: hashedPassword,
      maxUses: options?.maxUses,
      jti,
      issuerDid
    });

    // Create share config
    const config: EnhancedShareConfig = {
      id,
      databaseId,
      type: 'public',
      permission,
      token,
      expiresAt: options?.expiresAt,
      createdAt: now,
      createdBy: 'local', // TODO: Get from auth
      isActive: true,
      allowDuplication: options?.allowDuplication,
      password: hashedPassword,
      requiresAuth: false,
      accessCount: 0
    };

    this.shareConfigs.set(id, config);

    // Generate the shareable URL
    // In production, this would use the actual domain
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : 'https://storacha-notes.app';
    const url = `${baseUrl}/shared/${token}`;

    // Create public share link record
    const shareLink: PublicShareLink = {
      id,
      databaseId,
      token,
      permission,
      url,
      expiresAt: options?.expiresAt,
      password: hashedPassword,
      createdAt: now,
      viewCount: 0
    };

    this.shareLinks.set(id, shareLink);
    await this.saveToStorage();

    return shareLink;
  }

  /**
   * Create a public shareable link for a page (notes/documents).
   * Syncs the page and its blocks to Storacha, then embeds the CID in a self-contained token.
   * 
   * @param pageId - The page ID to share
   * @param permission - The permission level (view, comment, edit)
   * @param options - Additional options:
   *   - expiresAt: Expiration date
   *   - password: Password protection
   *   - maxUses: Maximum number of uses
   *   - liveSync: Enable real-time updates via WebRTC (viewers see edits live)
   */
  async createPageLink(
    pageId: string,
    permission: SharePermission = 'view',
    options?: {
      expiresAt?: string;
      password?: string;
      maxUses?: number;
      liveSync?: boolean;
    }
  ): Promise<PublicShareLink> {
    await this.initialize();
    await pageManager.initialize();
    await blockManager.initialize();

    let page = pageManager.getPage(pageId);
    
    // Fallback to workspaceState for pages created via old system
    if (!page) {
      const state = get(workspaceState);
      const workspacePage = this.findWorkspacePage(state.workspace.pages, pageId);
      
      if (workspacePage) {
        // Migrate the page to pageManager
        page = this.convertAndSaveWorkspacePage(workspacePage);
      }
    }
    
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    const now = new Date().toISOString();
    const id = `share_page_${Date.now()}_${generateId()}`;

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (options?.password) {
      hashedPassword = await hashPassword(options.password);
    }

    // Sync page (with blocks) to Storacha
    let pageCid: string | null = null;
    try {
      pageCid = await pageManager.syncToStoracha(pageId);
    } catch (error) {
      console.error('Failed to sync page for external sharing:', error);
      pageCid = null;
    }

    if (!pageCid) {
      throw new Error(
        'Cloud sync is required to create share links. Login with email and ensure a Storacha space is provisioned.'
      );
    }

    const jti = generateToken();
    const issuerDid = authService.getCurrentDID() || undefined;
    const token = encodeShareTokenV2({
      v: 2,
      resourceType: 'page',
      resourceId: pageId,
      cid: pageCid,
      permission,
      expiresAt: options?.expiresAt,
      password: hashedPassword,
      maxUses: options?.maxUses,
      jti,
      issuerDid
    });

    // Generate the shareable URL using the full token
    // The token is self-contained with the CID, so it works across browsers
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : 'https://storacha-notes.app';
    const url = `${baseUrl}/shared/${token}`;
    
    // Also store short code for local quick access (optional)
    const shortCode = generateShortCode();
    const shortCodes = getShortCodes();
    shortCodes.set(shortCode, {
      code: shortCode,
      token,
      pageId,
      cid: pageCid,
      createdAt: now,
      liveSync: options?.liveSync ?? false
    });
    saveShortCodes(shortCodes);

    // Create public share link record
    const shareLink: PublicShareLink = {
      id,
      databaseId: pageId, // reusing databaseId field for resourceId
      token,
      permission,
      url,
      expiresAt: options?.expiresAt,
      password: hashedPassword,
      createdAt: now,
      viewCount: 0
    };

    this.shareLinks.set(id, shareLink);
    await this.saveToStorage();

    console.log(`Created share link for page ${pageId}: ${url}`);
    return shareLink;
  }

  /**
   * Resolve a short code to its full share data.
   * Returns the token, page ID, CID, and whether live sync is enabled.
   */
  resolveShortCode(shortCode: string): ShortCodeEntry | null {
    const shortCodes = getShortCodes();
    return shortCodes.get(shortCode) || null;
  }

  /**
   * Get all share links for a database
   */
  async getShareLinks(databaseId: string): Promise<PublicShareLink[]> {
    await this.initialize();

    return Array.from(this.shareLinks.values())
      .filter(link => link.databaseId === databaseId);
  }

  /**
   * Get a share link by ID
   */
  async getShareLink(linkId: string): Promise<PublicShareLink | null> {
    await this.initialize();
    return this.shareLinks.get(linkId) || null;
  }

  /**
   * Get a share link by token
   */
  async getShareLinkByToken(token: string): Promise<PublicShareLink | null> {
    await this.initialize();

    for (const link of this.shareLinks.values()) {
      if (link.token === token) {
        return link;
      }
    }
    return null;
  }

  /**
   * Update a share link
   */
  async updateShareLink(
    linkId: string,
    updates: Partial<Pick<PublicShareLink, 'permission' | 'expiresAt' | 'password'>>
  ): Promise<PublicShareLink | null> {
    await this.initialize();

    const link = this.shareLinks.get(linkId);
    if (!link) return null;

    const config = this.shareConfigs.get(linkId);
    if (!config) return null;

    // Update password if provided
    if (updates.password !== undefined) {
      updates.password = updates.password ? await hashPassword(updates.password) : undefined;
    }

    // Update link
    Object.assign(link, updates);
    
    // Update config
    if (updates.permission) config.permission = updates.permission;
    if (updates.expiresAt !== undefined) config.expiresAt = updates.expiresAt;
    if (updates.password !== undefined) config.password = updates.password;

    await this.saveToStorage();
    return link;
  }

  /**
   * Revoke a share link
   */
  async revokeShareLink(linkId: string): Promise<boolean> {
    await this.initialize();

    const config = this.shareConfigs.get(linkId);
    if (config) {
      config.isActive = false;
    }

    const link = this.shareLinks.get(linkId);
    if (link) {
      const v2 = decodeShareTokenV2(link.token);
      if (v2?.jti) {
        addRevokedTokenId(v2.jti);
      }
    }

    this.shareLinks.delete(linkId);
    await this.saveToStorage();

    return true;
  }

  /**
   * Validate a share token
   */
  async validateShareToken(
    token: string,
    password?: string
  ): Promise<{
    valid: boolean;
    databaseId?: string;
    resourceId?: string;
    resourceType?: 'database' | 'page';
    cid?: string;
    permission?: SharePermission;
    issuerDid?: string;
    error?: string;
  }> {
    await this.initialize();

    // v2 tokens are self-contained and work across devices.
    const v2 = decodeShareTokenV2(token);
    if (v2) {
      const revoked = getRevokedTokenIds();
      if (revoked.has(v2.jti)) {
        return { valid: false, error: 'This share link has been revoked' };
      }

      if (v2.expiresAt && new Date(v2.expiresAt) < new Date()) {
        return { valid: false, error: 'This share link has expired' };
      }

      if (v2.password) {
        if (!password) {
          return { valid: false, error: 'Password required' };
        }
        const hashedInput = await hashPassword(password);
        if (hashedInput !== v2.password) {
          return { valid: false, error: 'Incorrect password' };
        }
      }

      if (typeof v2.maxUses === 'number') {
        const key = `${SHARE_TOKEN_USES_PREFIX}${v2.jti}`;
        const current = Number(localStorage.getItem(key) || '0');
        if (current >= v2.maxUses) {
          return { valid: false, error: 'This share link has reached its usage limit' };
        }
        localStorage.setItem(key, String(current + 1));
      }

      return {
        valid: true,
        databaseId: v2.resourceType === 'database' ? v2.resourceId : undefined,
        resourceId: v2.resourceId,
        resourceType: v2.resourceType,
        cid: v2.cid,
        permission: v2.permission,
        issuerDid: v2.issuerDid
      };
    }

    // Find the config by token
    let config: ShareConfig | undefined;
    for (const c of this.shareConfigs.values()) {
      if (c.token === token) {
        config = c;
        break;
      }
    }

    if (!config) {
      return { valid: false, error: 'Invalid share link' };
    }

    // Check if active
    if (!config.isActive) {
      return { valid: false, error: 'This share link has been revoked' };
    }

    // Check expiration
    if (config.expiresAt && new Date(config.expiresAt) < new Date()) {
      return { valid: false, error: 'This share link has expired' };
    }

    // Check password
    if (config.password) {
      if (!password) {
        return { valid: false, error: 'Password required' };
      }
      const hashedInput = await hashPassword(password);
      if (hashedInput !== config.password) {
        return { valid: false, error: 'Incorrect password' };
      }
    }

    // Update access log
    const link = this.shareLinks.get(config.id);
    if (link) {
      link.viewCount++;
      link.lastViewedAt = new Date().toISOString();
      await this.saveToStorage();
    }

    return {
      valid: true,
      databaseId: config.databaseId,
      permission: config.permission
    };
  }

  // ============================================================================
  // User-Specific Access
  // ============================================================================

  /**
   * Grant access to a specific user
   */
  async grantAccess(
    databaseId: string,
    userDID: string,
    permission: SharePermission
  ): Promise<boolean> {
    await this.initialize();

    const now = new Date().toISOString();
    const id = `access_${Date.now()}_${generateId()}`;

    const config: EnhancedShareConfig = {
      id,
      databaseId,
      type: 'user',
      permission,
      targetId: userDID,
      createdAt: now,
      createdBy: 'local',
      isActive: true,
      requiresAuth: true,
      accessCount: 0
    };

    this.shareConfigs.set(id, config);
    await this.saveToStorage();

    return true;
  }

  /**
   * Revoke access for a specific user
   */
  async revokeAccess(databaseId: string, userDID: string): Promise<boolean> {
    await this.initialize();

    for (const [id, config] of this.shareConfigs) {
      if (config.databaseId === databaseId && 
          config.type === 'user' && 
          config.targetId === userDID) {
        config.isActive = false;
      }
    }

    await this.saveToStorage();
    return true;
  }

  /**
   * Check if a user can access a database
   */
  async canAccess(
    databaseId: string,
    userDID?: string
  ): Promise<{ canAccess: boolean; permission: SharePermission | null }> {
    await this.initialize();

    // Check for user-specific access
    if (userDID) {
      for (const config of this.shareConfigs.values()) {
        if (config.databaseId === databaseId &&
            config.type === 'user' &&
            config.targetId === userDID &&
            config.isActive) {
          return { canAccess: true, permission: config.permission };
        }
      }
    }

    // Check for public access
    for (const config of this.shareConfigs.values()) {
      if (config.databaseId === databaseId &&
          config.type === 'public' &&
          config.isActive) {
        // Check expiration
        if (!config.expiresAt || new Date(config.expiresAt) > new Date()) {
          return { canAccess: true, permission: config.permission };
        }
      }
    }

    return { canAccess: false, permission: null };
  }

  /**
   * Get all users with access to a database
   */
  async getAccessList(databaseId: string): Promise<{
    userDID: string;
    permission: SharePermission;
    grantedAt: string;
  }[]> {
    await this.initialize();

    const accessList: {
      userDID: string;
      permission: SharePermission;
      grantedAt: string;
    }[] = [];

    for (const config of this.shareConfigs.values()) {
      if (config.databaseId === databaseId &&
          config.type === 'user' &&
          config.targetId &&
          config.isActive) {
        accessList.push({
          userDID: config.targetId,
          permission: config.permission,
          grantedAt: config.createdAt
        });
      }
    }

    return accessList;
  }

  // ============================================================================
  // UCAN Delegations (Real Implementation using Storacha Client)
  // ============================================================================

  async createDelegation(
    resourceId: string,
    resourceType: 'note' | 'database' | 'page' | 'workspace',
    audienceDID: string,
    capabilities: ResourceCapability[],
    options?: {
      expiresAt?: string;
      proofs?: string[];
    }
  ): Promise<AccessGrantResult> {
    await this.initialize();

    try {
      const client = authService.getClient();
      if (!client) {
        throw new Error('Storacha client not initialized');
      }

      const delegationId = `del_${Date.now()}_${generateId()}`;
      const now = new Date().toISOString();
      const issuerDID = client.agent.did();

      // Map our capabilities to Storacha abilities
      const abilities = this.mapCapabilitiesToStorachaAbilities(capabilities);
      
      // Calculate expiration in seconds from now
      let expiration: number | undefined;
      if (options?.expiresAt) {
        expiration = Math.floor(new Date(options.expiresAt).getTime() / 1000);
      }

      // Create a real UCAN delegation using the Storacha client
      // The audience needs to be a Principal (DID)
      const audiencePrincipal = { did: () => audienceDID as `did:${string}:${string}` };
      
      // Cast abilities to the expected type (Storacha has strict typing)
      type StorachaAbility = Parameters<typeof client.createDelegation>[1][number];
      const typedAbilities = abilities as StorachaAbility[];
      
      const delegation = await client.createDelegation(
        audiencePrincipal,
        typedAbilities,
        { expiration }
      );

      // Serialize the delegation to a transferable format
      const archive = await delegation.archive();
      if (!archive.ok) {
        throw new Error('Failed to archive delegation');
      }

      // Convert to base64 for storage/transfer
      const ucanToken = this.uint8ArrayToBase64(archive.ok);

      const delegationRecord: UCANDelegation = {
        id: delegationId,
        issuer: issuerDID,
        audience: audienceDID,
        resourceId,
        resourceType,
        capabilities,
        expiresAt: options?.expiresAt,
        createdAt: now,
        isActive: true,
        proofs: options?.proofs,
        ucanToken
      };

      this.delegations.set(delegationId, delegationRecord);
      await this.saveDelegations();

      // Also create a share config for this delegation
      const permission = this.mapCapabilitiesToPermission(capabilities);
      await this.grantAccess(resourceId, audienceDID, permission);

      console.log(`Created UCAN delegation ${delegationId} for ${audienceDID}`);

      return {
        success: true,
        delegationId,
        ucanToken
      };
    } catch (error) {
      console.error('Failed to create delegation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Map our capabilities to Storacha abilities
   */
  private mapCapabilitiesToStorachaAbilities(capabilities: ResourceCapability[]): string[] {
    const abilityMap: Record<string, string[]> = {
      'note/read': ['space/blob/list', 'upload/list'],
      'note/write': ['space/blob/add', 'space/index/add', 'upload/add'],
      'note/delete': ['space/blob/remove', 'upload/remove'],
      'note/share': ['space/info'],
      'database/read': ['space/blob/list', 'upload/list'],
      'database/write': ['space/blob/add', 'space/index/add', 'upload/add'],
      'database/delete': ['space/blob/remove', 'upload/remove'],
      'database/share': ['space/info'],
      'page/read': ['space/blob/list', 'upload/list'],
      'page/write': ['space/blob/add', 'space/index/add', 'upload/add'],
      'page/delete': ['space/blob/remove', 'upload/remove'],
      'page/share': ['space/info']
    };

    const abilities = new Set<string>();
    for (const cap of capabilities) {
      const mapped = abilityMap[cap];
      if (mapped) {
        mapped.forEach(a => abilities.add(a));
      }
    }

    return Array.from(abilities);
  }

  /**
   * Helper to convert Uint8Array to base64
   */
  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Helper to convert base64 to Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async revokeDelegation(delegationId: string): Promise<boolean> {
    await this.initialize();
    
    const delegation = this.delegations.get(delegationId);
    if (!delegation) return false;

    delegation.isActive = false;
    await this.saveDelegations();

    // Also revoke the share config
    await this.revokeAccess(delegation.resourceId, delegation.audience);

    return true;
  }

  async getDelegations(resourceId: string): Promise<UCANDelegation[]> {
    await this.initialize();
    return Array.from(this.delegations.values())
      .filter(d => d.resourceId === resourceId && d.isActive);
  }

  async claimDelegation(ucanToken: string): Promise<boolean> {
    await this.initialize();
    
    try {
      const client = authService.getClient();
      if (!client) {
        throw new Error('Storacha client not initialized');
      }

      // Decode the base64 token back to bytes
      const delegationBytes = this.base64ToUint8Array(ucanToken);
      
      // Extract the delegation from the archived format
      const extractResult = await Delegation.extract(delegationBytes);
      if (!extractResult.ok) {
        console.error('Failed to extract delegation:', extractResult.error);
        return false;
      }

      const delegation = extractResult.ok;

      // Add the delegation as a proof to the client
      // This will allow the client to use the delegated capabilities
      const space = await client.addSpace(delegation);
      await client.setCurrentSpace(space.did());

      console.log(`Successfully claimed delegation and added space: ${space.did()}`);

      // Also store locally for our tracking
      const delegationId = `claimed_${Date.now()}_${generateId()}`;
      const now = new Date().toISOString();

      const localRecord: UCANDelegation = {
        id: delegationId,
        issuer: delegation.issuer.did(),
        audience: delegation.audience.did(),
        resourceId: space.did(),
        resourceType: 'workspace',
        capabilities: ['database/read', 'database/write'],
        createdAt: now,
        isActive: true,
        ucanToken
      };

      this.delegations.set(delegationId, localRecord);
      await this.saveDelegations();

      return true;
    } catch (error) {
      console.error('Failed to claim delegation:', error);
      
      // Fallback: Check if we have a matching local delegation
      for (const delegation of this.delegations.values()) {
        if (delegation.ucanToken === ucanToken && delegation.isActive) {
          const permission = this.mapCapabilitiesToPermission(delegation.capabilities);
          await this.grantAccess(delegation.resourceId, delegation.audience, permission);
          return true;
        }
      }
      
      return false;
    }
  }

  // ============================================================================
  // Invitations
  // ============================================================================

  async createInvitation(
    resourceId: string,
    resourceType: 'note' | 'database' | 'page' | 'workspace',
    inviteeEmail: string,
    permission: SharePermission,
    message?: string
  ): Promise<ShareInvitation> {
    await this.initialize();

    const id = `inv_${Date.now()}_${generateId()}`;
    const now = new Date().toISOString();
    const inviterDID = authService.getDID() || 'local';

    const invitation: ShareInvitation = {
      id,
      resourceId,
      resourceType,
      resourceName: 'Shared Resource', // TODO: Fetch actual name
      inviterDID,
      inviteeEmail,
      permission,
      message,
      status: 'pending',
      createdAt: now,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };

    this.invitations.set(id, invitation);
    await this.saveInvitations();

    return invitation;
  }

  async acceptInvitation(invitationId: string): Promise<AccessGrantResult> {
    await this.initialize();

    const invitation = this.invitations.get(invitationId);
    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    if (invitation.status !== 'pending') {
      return { success: false, error: `Invitation is ${invitation.status}` };
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      invitation.status = 'expired';
      await this.saveInvitations();
      return { success: false, error: 'Invitation expired' };
    }

    const userDID = authService.getDID();
    if (!userDID) {
      return { success: false, error: 'Authentication required' };
    }

    // Update invitation
    invitation.status = 'accepted';
    invitation.inviteeDID = userDID;
    invitation.acceptedAt = new Date().toISOString();
    await this.saveInvitations();

    // Create delegation
    const capabilities = this.mapPermissionToCapabilities(invitation.permission, invitation.resourceType);
    return this.createDelegation(
      invitation.resourceId,
      invitation.resourceType,
      userDID,
      capabilities
    );
  }

  async declineInvitation(invitationId: string): Promise<boolean> {
    await this.initialize();

    const invitation = this.invitations.get(invitationId);
    if (!invitation) return false;

    invitation.status = 'declined';
    await this.saveInvitations();
    return true;
  }

  async getInvitations(status?: 'pending' | 'accepted' | 'declined'): Promise<ShareInvitation[]> {
    await this.initialize();
    const all = Array.from(this.invitations.values());
    if (status) {
      return all.filter(i => i.status === status);
    }
    return all;
  }

  // ============================================================================
  // Shared Resources
  // ============================================================================

  async getSharedWithMe(): Promise<SharedResourceInfo[]> {
    await this.initialize();
    const userDID = authService.getDID();
    if (!userDID) return [];

    const shared: SharedResourceInfo[] = [];

    // Find all active delegations where audience is current user
    for (const delegation of this.delegations.values()) {
      if (delegation.audience === userDID && delegation.isActive) {
        // Map 'space' to 'workspace' for type compatibility
        const resourceType = delegation.resourceType === 'space' 
          ? 'workspace' 
          : delegation.resourceType;
        shared.push({
          resourceId: delegation.resourceId,
          resourceType: resourceType as 'note' | 'database' | 'page' | 'workspace',
          name: 'Shared Resource', // TODO: Fetch name
          ownerDID: delegation.issuer,
          permission: this.mapCapabilitiesToPermission(delegation.capabilities),
          sharedAt: delegation.createdAt,
          storachaCID: '' // TODO: Fetch CID
        });
      }
    }

    return shared;
  }

  async getSharedByMe(): Promise<SharedResourceInfo[]> {
    await this.initialize();
    const userDID = authService.getDID();
    if (!userDID) return [];

    const shared: SharedResourceInfo[] = [];

    // Find all active delegations where issuer is current user
    for (const delegation of this.delegations.values()) {
      if (delegation.issuer === userDID && delegation.isActive) {
        // Map 'space' to 'workspace' for type compatibility
        const resourceType = delegation.resourceType === 'space' 
          ? 'workspace' 
          : delegation.resourceType;
        shared.push({
          resourceId: delegation.resourceId,
          resourceType: resourceType as 'note' | 'database' | 'page' | 'workspace',
          name: 'Shared Resource', // TODO: Fetch name
          ownerDID: userDID,
          permission: this.mapCapabilitiesToPermission(delegation.capabilities),
          sharedAt: delegation.createdAt,
          storachaCID: '' // TODO: Fetch CID
        });
      }
    }

    return shared;
  }

  // ============================================================================
  // Encryption (Real Implementation using Web Crypto API)
  // ============================================================================

  /**
   * Encrypt content for sharing with multiple recipients
   * Uses AES-GCM for content encryption and ECDH for key wrapping
   */
  async encryptForSharing(
    content: Uint8Array,
    recipientDIDs: string[]
  ): Promise<{
    encryptedContent: EncryptedContent;
    keyShares: EncryptedKeyShare[];
  }> {
    try {
      // Get public keys for recipients from stored key registry
      const recipientPublicKeys = await this.getRecipientPublicKeys(recipientDIDs);

      if (recipientPublicKeys.size === 0) {
        // If no public keys found, use password-based encryption as fallback
        console.warn('No recipient public keys found, using simple encryption');
        const encrypted = await this.encryptContentSimple(content);
        return {
          encryptedContent: encrypted,
          keyShares: recipientDIDs.map(did => ({
            recipientDID: did,
            encryptedKey: 'symmetric-key-shared', // Key shared out-of-band
            keyEncryptionAlgorithm: 'ECDH-ES+A256KW' as const // Type-compatible fallback
          }))
        };
      }

      // Use the crypto-utils for real encryption
      const { encryptedPayload, wrappedKeys } = await cryptoUtils.encryptForRecipients(
        content,
        recipientPublicKeys
      );

      // Map to our interface types
      return {
        encryptedContent: {
          ciphertext: encryptedPayload.ciphertext,
          iv: encryptedPayload.iv,
          algorithm: encryptedPayload.algorithm,
          version: encryptedPayload.version
        },
        keyShares: wrappedKeys.map(wk => ({
          recipientDID: wk.recipientDID,
          encryptedKey: wk.wrappedKey,
          keyEncryptionAlgorithm: wk.algorithm,
          ephemeralPublicKey: JSON.stringify(wk.ephemeralPublicKey)
        }))
      };
    } catch (error) {
      console.error('Failed to encrypt for sharing:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt shared content using the user's private key
   */
  async decryptSharedContent(
    encryptedContent: EncryptedContent,
    keyShare: EncryptedKeyShare
  ): Promise<Uint8Array> {
    try {
      // Get user's private key
      const privateKeyJwk = await this.getUserPrivateKey();
      if (!privateKeyJwk) {
        throw new Error('User private key not found');
      }

      // Parse ephemeral public key if present
      let ephemeralPublicKey: JsonWebKey | undefined;
      if (keyShare.ephemeralPublicKey) {
        ephemeralPublicKey = JSON.parse(keyShare.ephemeralPublicKey);
      }

      if (!ephemeralPublicKey) {
        // Fallback: simple base64 decode for legacy content
        const binary = atob(encryptedContent.ciphertext);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      }

      // Reconstruct the wrapped key structure
      const wrappedKey: WrappedKey = {
        recipientDID: keyShare.recipientDID,
        wrappedKey: keyShare.encryptedKey,
        ephemeralPublicKey,
        algorithm: 'ECDH-ES+A256KW'
      };

      // Reconstruct the encrypted payload
      const encryptedPayload: EncryptedPayload = {
        ciphertext: encryptedContent.ciphertext,
        iv: encryptedContent.iv,
        algorithm: 'AES-GCM-256',
        version: 1
      };

      // Decrypt using crypto-utils
      return cryptoUtils.decryptWithWrappedKey(
        encryptedPayload,
        wrappedKey,
        privateKeyJwk
      );
    } catch (error) {
      console.error('Failed to decrypt shared content:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Encrypt content with a password (for password-protected share links)
   */
  async encryptWithPassword(
    content: Uint8Array,
    password: string
  ): Promise<EncryptedContent> {
    const { encrypted } = await cryptoUtils.encryptWithPassword(content, password);
    return {
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      algorithm: encrypted.algorithm,
      version: encrypted.version,
      salt: encrypted.salt
    };
  }

  /**
   * Decrypt password-protected content
   */
  async decryptWithPassword(
    encryptedContent: EncryptedContent,
    password: string
  ): Promise<Uint8Array> {
    const payload: EncryptedPayload = {
      ciphertext: encryptedContent.ciphertext,
      iv: encryptedContent.iv,
      algorithm: 'AES-GCM-256',
      version: 1,
      salt: encryptedContent.salt
    };
    return cryptoUtils.decryptWithPassword(payload, password);
  }

  /**
   * Simple encryption fallback when no public keys are available
   */
  private async encryptContentSimple(content: Uint8Array): Promise<EncryptedContent> {
    // Generate a random symmetric key and encrypt
    const key = await cryptoUtils.generateSymmetricKey();
    const iv = cryptoUtils.generateIV();
    const ciphertext = await cryptoUtils.encryptWithSymmetricKey(content, key, iv);

    // Export the key for out-of-band sharing
    const exportedKey = await crypto.subtle.exportKey('raw', key);
    
    // Store the key temporarily (should be shared securely)
    const keyBase64 = cryptoUtils.arrayBufferToBase64(exportedKey);
    sessionStorage.setItem('temp_share_key', keyBase64);

    return {
      ciphertext: cryptoUtils.arrayBufferToBase64(ciphertext),
      iv: cryptoUtils.arrayBufferToBase64(new Uint8Array(iv).buffer as ArrayBuffer),
      algorithm: 'AES-GCM-256',
      version: 1
    };
  }

  /**
   * Get public keys for recipients from key registry
   */
  private async getRecipientPublicKeys(dids: string[]): Promise<Map<string, JsonWebKey>> {
    const keys = new Map<string, JsonWebKey>();
    const keyRegistry = this.loadKeyRegistry();

    for (const did of dids) {
      if (keyRegistry[did]) {
        keys.set(did, keyRegistry[did]);
      }
    }

    return keys;
  }

  /**
   * Get user's private key for decryption
   */
  private async getUserPrivateKey(): Promise<JsonWebKey | null> {
    const stored = localStorage.getItem('storacha_user_encryption_key');
    if (!stored) {
      // Generate and store a new key pair if none exists
      const keyPair = await cryptoUtils.generateECDHKeyPair();
      const exported = await cryptoUtils.exportKeyPair(keyPair);
      localStorage.setItem('storacha_user_encryption_key', JSON.stringify(exported));
      
      // Register the public key
      const userDID = authService.getDID();
      if (userDID) {
        this.registerPublicKey(userDID, exported.publicKey);
      }
      
      return exported.privateKey;
    }
    
    const keyPair = JSON.parse(stored);
    return keyPair.privateKey;
  }

  /**
   * Get user's public key for encryption
   */
  async getUserPublicKey(): Promise<JsonWebKey | null> {
    const stored = localStorage.getItem('storacha_user_encryption_key');
    if (stored) {
      const keyPair = JSON.parse(stored);
      return keyPair.publicKey;
    }
    
    // Generate new key pair
    const keyPair = await cryptoUtils.generateECDHKeyPair();
    const exported = await cryptoUtils.exportKeyPair(keyPair);
    localStorage.setItem('storacha_user_encryption_key', JSON.stringify(exported));
    
    return exported.publicKey;
  }

  /**
   * Register a public key for a DID
   */
  registerPublicKey(did: string, publicKey: JsonWebKey): void {
    const registry = this.loadKeyRegistry();
    registry[did] = publicKey;
    localStorage.setItem('storacha_key_registry', JSON.stringify(registry));
  }

  /**
   * Load the key registry from storage
   */
  private loadKeyRegistry(): Record<string, JsonWebKey> {
    const stored = localStorage.getItem('storacha_key_registry');
    return stored ? JSON.parse(stored) : {};
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private mapCapabilitiesToPermission(capabilities: ResourceCapability[]): SharePermission {
    if (capabilities.some(c => c.includes('delete') || c.includes('share'))) return 'admin';
    if (capabilities.some(c => c.includes('write'))) return 'edit';
    return 'view';
  }

  private mapPermissionToCapabilities(
    permission: SharePermission,
    resourceType: 'note' | 'database' | 'page' | 'workspace'
  ): ResourceCapability[] {
    const caps: ResourceCapability[] = [];
    const type = resourceType === 'workspace' ? 'database' : resourceType; // Simplify mapping

    if (permission === 'view' || permission === 'comment' || permission === 'edit' || permission === 'admin') {
      caps.push(`${type}/read` as ResourceCapability);
    }
    if (permission === 'edit' || permission === 'admin') {
      caps.push(`${type}/write` as ResourceCapability);
    }
    if (permission === 'admin') {
      caps.push(`${type}/delete` as ResourceCapability);
      caps.push(`${type}/share` as ResourceCapability);
    }
    return caps;
  }

  private async saveDelegations(): Promise<void> {
    const delegations = Array.from(this.delegations.values());
    localStorage.setItem(DELEGATIONS_KEY, JSON.stringify(delegations));
  }

  private async saveInvitations(): Promise<void> {
    const invitations = Array.from(this.invitations.values());
    localStorage.setItem(INVITATIONS_KEY, JSON.stringify(invitations));
  }

  // ============================================================================
  // Storacha Integration
  // ============================================================================

  /**
   * Sync share configs to Storacha
   */
  async syncToStoracha(databaseId: string): Promise<string | null> {
    try {
      if (!storachaClient.isReady()) {
        console.warn('Storacha client not ready');
        return null;
      }

      const configs = Array.from(this.shareConfigs.values())
        .filter(c => c.databaseId === databaseId);

      const links = Array.from(this.shareLinks.values())
        .filter(l => l.databaseId === databaseId);

      const shareData = {
        configs,
        links,
        syncedAt: new Date().toISOString()
      };

      const content = new TextEncoder().encode(JSON.stringify(shareData));
      const cid = await storachaClient.uploadContent(
        content,
        `share_config_${databaseId}.json`
      );

      return cid;
    } catch (error) {
      console.error('Failed to sync share configs to Storacha:', error);
      return null;
    }
  }

  /**
   * Load share configs from Storacha
   */
  async loadFromStoracha(cid: string): Promise<boolean> {
    try {
      if (!storachaClient.isReady()) {
        console.warn('Storacha client not ready');
        return false;
      }

      const content = await storachaClient.retrieveContent(cid);
      const shareData = JSON.parse(new TextDecoder().decode(content));

      for (const config of shareData.configs) {
        this.shareConfigs.set(config.id, config);
      }

      for (const link of shareData.links) {
        this.shareLinks.set(link.id, link);
      }

      await this.saveToStorage();
      return true;
    } catch (error) {
      console.error('Failed to load share configs from Storacha:', error);
      return false;
    }
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  private async saveToStorage(): Promise<void> {
    const configs = Array.from(this.shareConfigs.values());
    localStorage.setItem(SHARE_CONFIGS_KEY, JSON.stringify(configs));

    const links = Array.from(this.shareLinks.values());
    localStorage.setItem(SHARE_LINKS_KEY, JSON.stringify(links));
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Generate a short shareable code (for QR codes, etc.)
   */
  generateShortCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Check if a permission level allows a specific action
   */
  canPerformAction(
    permission: SharePermission,
    action: 'view' | 'comment' | 'edit' | 'admin'
  ): boolean {
    const levels: SharePermission[] = ['view', 'comment', 'edit', 'admin'];
    const permissionLevel = levels.indexOf(permission);
    const actionLevel = levels.indexOf(action);
    return permissionLevel >= actionLevel;
  }

  /**
   * Get permission description
   */
  getPermissionDescription(permission: SharePermission): string {
    switch (permission) {
      case 'view':
        return 'Can view content only';
      case 'comment':
        return 'Can view and add comments';
      case 'edit':
        return 'Can view, comment, and edit content';
      case 'admin':
        return 'Full access including sharing and deletion';
      default:
        return 'Unknown permission';
    }
  }

  /**
   * Clear all share data for a database
   */
  async clearDatabaseShares(databaseId: string): Promise<void> {
    await this.initialize();

    for (const [id, config] of this.shareConfigs) {
      if (config.databaseId === databaseId) {
        this.shareConfigs.delete(id);
      }
    }

    for (const [id, link] of this.shareLinks) {
      if (link.databaseId === databaseId) {
        this.shareLinks.delete(id);
      }
    }

    await this.saveToStorage();
  }

  // ============================================================================
  // Helper Methods for WorkspaceState Page Compatibility
  // ============================================================================

  /**
   * Recursively find a page in the workspace page tree
   */
  private findWorkspacePage(pages: WorkspacePage[], id: string): WorkspacePage | null {
    for (const p of pages) {
      if (p.id === id) return p;
      if (p.children && p.children.length > 0) {
        const found = this.findWorkspacePage(p.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Convert a workspace page to the Page type and save to pageManager
   */
  private convertAndSaveWorkspacePage(wp: WorkspacePage): import('$lib/types/pages').Page {
    const page: import('$lib/types/pages').Page = {
      id: wp.id,
      title: wp.title,
      type: 'page',
      icon: wp.icon ? { type: 'emoji', value: wp.icon } : undefined,
      cover: wp.cover ? { type: 'image', value: wp.cover } : undefined,
      parentId: wp.parentId ?? null,
      workspaceId: 'default',
      childPages: wp.children?.map(c => c.id) || [],
      blocks: [],
      metadata: {
        created: new Date(wp.createdAt),
        modified: new Date(wp.updatedAt),
        version: 1,
        storachaCID: '',
        shareLinks: [],
        isDeleted: false,
        isTemplate: false,
        isFavorite: false,
        viewCount: 0
      }
    };

    // Store in pageManager for future use
    (pageManager as any).pages.set(page.id, page);

    return page;
  }
}

// Export singleton instance
export const shareService = new ShareService();
export { ShareService };
