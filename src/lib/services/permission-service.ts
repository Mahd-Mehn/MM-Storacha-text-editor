import type { Capability, Permission, ResourceType, Role } from '$lib/types/permissions';
import { roleToCapabilities } from '$lib/types/permissions';

type StoredConstraints = {
  expiry?: string;
  maxUses?: number;
};

type StoredPermission = Omit<Permission, 'constraints'> & {
  id: string;
  createdAt: string;
  isActive: boolean;
  constraints?: StoredConstraints;
};

const PERMISSIONS_KEY = 'storacha_permissions_v1';
const PERMISSION_USES_PREFIX = 'storacha_permission_uses_';

const generateId = (): string => {
  try {
    const randomUUID = globalThis.crypto?.randomUUID;
    if (typeof randomUUID === 'function') return `perm_${randomUUID()}`;
  } catch {
    // ignore
  }
  return `perm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export class PermissionService {
  private permissions: Map<string, StoredPermission> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const raw = localStorage.getItem(PERMISSIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredPermission[];
        for (const p of parsed) this.permissions.set(p.id, p);
      }
    } catch (error) {
      console.error('Failed to initialize PermissionService:', error);
    } finally {
      this.initialized = true;
    }
  }

  private save(): void {
    const all = Array.from(this.permissions.values());
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(all));
  }

  grant(permission: Permission): string {
    const id = generateId();
    const stored: StoredPermission = {
      ...permission,
      id,
      createdAt: new Date().toISOString(),
      isActive: true,
      constraints: {
        expiry: permission.constraints?.expiry?.toISOString(),
        maxUses: permission.constraints?.maxUses
      }
    };

    this.permissions.set(id, stored);
    this.save();
    return id;
  }

  grantRole(params: {
    resource: { type: ResourceType; id: string };
    principal: string;
    role: Role;
    delegation: string;
    constraints?: Permission['constraints'];
  }): string {
    return this.grant({
      resource: params.resource,
      principal: params.principal,
      capabilities: roleToCapabilities(params.role),
      constraints: params.constraints,
      delegation: params.delegation
    });
  }

  revoke(permissionId: string): boolean {
    const p = this.permissions.get(permissionId);
    if (!p) return false;
    p.isActive = false;
    this.permissions.set(permissionId, p);
    this.save();
    return true;
  }

  listForResource(resource: { type: ResourceType; id: string }): StoredPermission[] {
    return Array.from(this.permissions.values()).filter(
      (p) => p.isActive && p.resource.type === resource.type && p.resource.id === resource.id
    );
  }

  can(params: {
    principal: string;
    resource: { type: ResourceType; id: string };
    capability: Capability;
    consumeUse?: boolean;
  }): { allowed: boolean; reason?: string } {
    const now = Date.now();

    const matches = Array.from(this.permissions.values()).filter(
      (p) => p.isActive && p.principal === params.principal && p.resource.type === params.resource.type && p.resource.id === params.resource.id
    );

    for (const p of matches) {
      if (!p.capabilities.includes(params.capability)) continue;

      if (p.constraints?.expiry) {
        const expiry = new Date(p.constraints.expiry).getTime();
        if (Number.isFinite(expiry) && expiry < now) {
          continue;
        }
      }

      if (typeof p.constraints?.maxUses === 'number') {
        const usesKey = `${PERMISSION_USES_PREFIX}${p.id}`;
        const current = Number(localStorage.getItem(usesKey) || '0');
        if (current >= p.constraints.maxUses) {
          return { allowed: false, reason: 'usage-limit' };
        }
        if (params.consumeUse) {
          localStorage.setItem(usesKey, String(current + 1));
        }
      }

      return { allowed: true };
    }

    return { allowed: false, reason: 'no-permission' };
  }
}

export const permissionService = new PermissionService();
