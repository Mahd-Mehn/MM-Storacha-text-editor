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
import { cryptoUtils, type EncryptedPayload, type WrappedKey } from './crypto-utils';
import * as Delegation from '@storacha/client/delegation';

// Storage keys
const SHARE_CONFIGS_KEY = 'storacha_share_configs';
const SHARE_LINKS_KEY = 'storacha_share_links';
const SHARE_ACCESS_LOG_KEY = 'storacha_share_access_log';
const DELEGATIONS_KEY = 'storacha_delegations';
const INVITATIONS_KEY = 'storacha_invitations';

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
}

// Export singleton instance
export const shareService = new ShareService();
export { ShareService };
