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
  SharePermission
} from '$lib/types/database';
import { storachaClient } from './storacha';

// Storage keys
const SHARE_CONFIGS_KEY = 'storacha_share_configs';
const SHARE_LINKS_KEY = 'storacha_share_links';
const SHARE_ACCESS_LOG_KEY = 'storacha_share_access_log';

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

/**
 * Share Service - Manages sharing and permissions
 */
class ShareService {
  private shareConfigs: Map<string, ShareConfig> = new Map();
  private shareLinks: Map<string, PublicShareLink> = new Map();
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
        const configs = JSON.parse(configsData) as ShareConfig[];
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

      this.initialized = true;
      console.log(`ShareService initialized with ${this.shareConfigs.size} configs and ${this.shareLinks.size} links`);
    } catch (error) {
      console.error('Failed to initialize ShareService:', error);
      this.initialized = true;
    }
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
    }
  ): Promise<PublicShareLink> {
    await this.initialize();

    const now = new Date().toISOString();
    const id = `share_${Date.now()}_${generateId()}`;
    const token = generateToken();

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (options?.password) {
      hashedPassword = await hashPassword(options.password);
    }

    // Create share config
    const config: ShareConfig = {
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
      password: hashedPassword
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
    permission?: SharePermission;
    error?: string;
  }> {
    await this.initialize();

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

    const config: ShareConfig = {
      id,
      databaseId,
      type: 'user',
      permission,
      targetId: userDID,
      createdAt: now,
      createdBy: 'local',
      isActive: true
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
}

// Export singleton instance
export const shareService = new ShareService();
export { ShareService };
