export type ResourceType = 'workspace' | 'page' | 'block';

export type Capability = 'read' | 'write' | 'admin' | 'share';

export type Role = 'Owner' | 'Admin' | 'Editor' | 'Commenter' | 'Viewer';

export interface Permission {
  resource: { type: ResourceType; id: string };
  principal: string; // DID
  capabilities: Capability[];
  constraints?: {
    expiry?: Date;
    maxUses?: number;
  };
  delegation: string; // UCAN proof chain
}

export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  Owner: ['read', 'write', 'admin', 'share'],
  Admin: ['read', 'write', 'admin', 'share'],
  Editor: ['read', 'write'],
  Commenter: ['read'],
  Viewer: ['read']
};

export function roleToCapabilities(role: Role): Capability[] {
  return ROLE_CAPABILITIES[role];
}

export function canCapability(capabilities: Capability[], required: Capability): boolean {
  return capabilities.includes(required);
}

export function resourceMatches(
  granted: { type: ResourceType; id: string },
  requested: { type: ResourceType; id: string }
): boolean {
  if (granted.type === requested.type && granted.id === requested.id) return true;

  // Simple inheritance:
  // workspace -> page -> block
  // This is intentionally conservative: only allow access to descendants
  // when IDs are structured as `${parentId}/${childId}`.
  if (requested.id.startsWith(`${granted.id}/`)) {
    if (granted.type === 'workspace') return true;
    if (granted.type === 'page' && requested.type === 'block') return true;
  }

  return false;
}
