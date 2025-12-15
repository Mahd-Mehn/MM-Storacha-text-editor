/**
 * Database & Properties System Types
 * 
 * Designed for Storacha (IPFS/IPLD) storage without traditional databases.
 * Uses client-side indexing for queries and IPLD DAG for data relationships.
 * 
 * Architecture:
 * - DatabaseManifest (schema + row index) → stored as single document
 * - DatabaseRows → stored individually, referenced by CID in manifest
 * - Client-side index → rebuilt from manifest, cached in IndexedDB
 * 
 * Sharing & Permissions:
 * - UCAN delegations for cryptographic capability-based access
 * - Public share links with configurable permissions
 * - User-specific access grants via DID
 * - Optional end-to-end encryption for sensitive content
 */

// ============================================================================
// Property Definitions (Schema)
// ============================================================================

export type PropertyType = 
  | 'text'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'select'
  | 'multiSelect'
  | 'url'
  | 'email'
  | 'phone'
  | 'relation'
  | 'rollup'
  | 'formula'
  | 'createdTime'
  | 'lastEditedTime'
  | 'createdBy'
  | 'lastEditedBy'
  | 'files'
  | 'person';

export interface SelectOption {
  id: string;
  name: string;
  color: string;
}

export interface PropertyDefinition {
  id: string;
  name: string;
  type: PropertyType;
  options?: SelectOption[]; // For select/multiSelect
  relationConfig?: {
    databaseId: string;
    propertyId?: string; // For two-way relations
  };
  rollupConfig?: {
    relationPropertyId: string;
    targetPropertyId: string;
    function: 'count' | 'sum' | 'average' | 'min' | 'max' | 'showOriginal';
  };
  formulaConfig?: {
    expression: string; // e.g., "prop('Price') * prop('Quantity')"
  };
  numberFormat?: 'number' | 'currency' | 'percent';
  dateFormat?: 'full' | 'short' | 'relative';
  includeTime?: boolean;
  isVisible?: boolean;
  width?: number;
}

// ============================================================================
// Property Values (Data)
// ============================================================================

export type PropertyValue = 
  | TextPropertyValue
  | NumberPropertyValue
  | DatePropertyValue
  | CheckboxPropertyValue
  | SelectPropertyValue
  | MultiSelectPropertyValue
  | UrlPropertyValue
  | RelationPropertyValue
  | RollupPropertyValue
  | FormulaPropertyValue
  | TimestampPropertyValue
  | UserPropertyValue
  | FilesPropertyValue
  | PersonPropertyValue;

export interface TextPropertyValue {
  type: 'text';
  value: string;
}

export interface NumberPropertyValue {
  type: 'number';
  value: number | null;
}

export interface DatePropertyValue {
  type: 'date';
  value: {
    start: string; // ISO date string
    end?: string;  // For date ranges
    includeTime?: boolean;
  } | null;
}

export interface CheckboxPropertyValue {
  type: 'checkbox';
  value: boolean;
}

export interface SelectPropertyValue {
  type: 'select';
  value: string | null; // Option ID
}

export interface MultiSelectPropertyValue {
  type: 'multiSelect';
  value: string[]; // Option IDs
}

export interface UrlPropertyValue {
  type: 'url';
  value: string | null;
}

export interface RelationPropertyValue {
  type: 'relation';
  value: string[]; // Row IDs from related database
}

export interface RollupPropertyValue {
  type: 'rollup';
  value: number | string | string[]; // Computed from relation
}

export interface FormulaPropertyValue {
  type: 'formula';
  value: string | number | boolean; // Computed
}

export interface TimestampPropertyValue {
  type: 'timestamp';
  value: string; // ISO date string
}

export interface UserPropertyValue {
  type: 'user';
  value: string; // User DID
}

export interface FilesPropertyValue {
  type: 'files';
  value: FileAttachment[];
}

export interface FileAttachment {
  id: string;
  name: string;
  url: string;
  cid?: string; // Storacha CID
  size: number;
  mimeType: string;
}

export interface PersonPropertyValue {
  type: 'person';
  value: PersonReference[];
}

export interface PersonReference {
  did: string;
  displayName?: string;
  avatarUrl?: string;
}

// ============================================================================
// Database Row (Entry)
// ============================================================================

export interface DatabaseRow {
  id: string;
  databaseId: string;
  properties: Record<string, PropertyValue>;
  content?: string[]; // Block IDs for page content within the row
  createdAt: string;
  updatedAt: string;
  createdBy: string; // DID
  lastEditedBy: string; // DID
  storachaCID?: string; // CID of this row's data
}

// ============================================================================
// Database Views
// ============================================================================

export type ViewType = 'table' | 'board' | 'calendar' | 'gallery' | 'timeline' | 'list';

export interface FilterCondition {
  id: string;
  propertyId: string;
  operator: FilterOperator;
  value?: string | number | boolean | string[];
}

export type FilterOperator = 
  | 'equals' | 'notEquals'
  | 'contains' | 'notContains'
  | 'startsWith' | 'endsWith'
  | 'isEmpty' | 'isNotEmpty'
  | 'greaterThan' | 'lessThan'
  | 'greaterOrEqual' | 'lessOrEqual'
  | 'before' | 'after' | 'onOrBefore' | 'onOrAfter'
  | 'isChecked' | 'isNotChecked';

export interface FilterGroup {
  operator: 'and' | 'or';
  conditions: (FilterCondition | FilterGroup)[];
}

export interface SortRule {
  id: string;
  propertyId: string;
  direction: 'asc' | 'desc';
}

export interface DatabaseView {
  id: string;
  name: string;
  type: ViewType;
  filters: FilterGroup;
  sorts: SortRule[];
  groupBy?: string; // Property ID for board/timeline grouping
  visibleProperties: string[]; // Property IDs to show
  propertyWidths?: Record<string, number>; // For table view
  calendarProperty?: string; // Property ID for calendar date
  galleryProperty?: string; // Property ID for gallery cover image
  timelineStartProperty?: string;
  timelineEndProperty?: string;
  cardSize?: 'small' | 'medium' | 'large'; // For gallery/board
  showEmptyGroups?: boolean; // For board view
}

// ============================================================================
// Database Schema (Manifest)
// ============================================================================

export interface DatabaseSchema {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  cover?: {
    type: 'color' | 'gradient' | 'image';
    value: string;
  };
  properties: PropertyDefinition[];
  views: DatabaseView[];
  templates?: string[]; // Template row IDs
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  storachaCID?: string; // CID of the schema
}

// ============================================================================
// Database Manifest (Root document stored on Storacha)
// ============================================================================

export interface DatabaseManifest {
  version: number;
  schema: DatabaseSchema;
  rowIndex: DatabaseRowIndex[]; // Lightweight index for all rows
  lastSync: string;
  storachaCID?: string;
}

export interface DatabaseRowIndex {
  id: string;
  cid: string; // Storacha CID of the full row data
  // Denormalized fields for fast filtering without loading full row
  title?: string;
  updatedAt: string;
  // Index key properties for common filters
  indexedProperties: Record<string, string | number | boolean | string[]>;
}

// ============================================================================
// Sharing & Permissions
// ============================================================================

export type SharePermission = 'view' | 'comment' | 'edit' | 'admin';

export interface ShareConfig {
  id: string;
  databaseId: string;
  type: 'public' | 'link' | 'user' | 'workspace';
  permission: SharePermission;
  targetId?: string; // User DID or workspace ID
  token?: string; // For link sharing
  expiresAt?: string;
  createdAt: string;
  createdBy: string;
  isActive: boolean;
  allowDuplication?: boolean;
  password?: string; // Hashed password for protected links
}

export interface PublicShareLink {
  id: string;
  databaseId: string;
  token: string;
  permission: SharePermission;
  url: string;
  expiresAt?: string;
  password?: string;
  createdAt: string;
  viewCount: number;
  lastViewedAt?: string;
}

// ============================================================================
// Serialization Types (for Storacha storage)
// ============================================================================

export interface SerializedDatabase {
  manifest: DatabaseManifest;
  shareConfigs: ShareConfig[];
}

export interface SerializedDatabaseRow {
  row: DatabaseRow;
  blocks?: string[]; // CIDs of content blocks
}

// ============================================================================
// Query Types
// ============================================================================

export interface DatabaseQuery {
  databaseId: string;
  filter?: FilterGroup;
  sorts?: SortRule[];
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
}

export interface DatabaseQueryResult {
  rows: DatabaseRow[];
  total: number;
  hasMore: boolean;
  executionTime?: number;
}

// ============================================================================
// Events & Callbacks
// ============================================================================

export type DatabaseEventType = 
  | 'row:created'
  | 'row:updated'
  | 'row:deleted'
  | 'schema:updated'
  | 'view:created'
  | 'view:updated'
  | 'view:deleted'
  | 'sync:started'
  | 'sync:completed'
  | 'sync:failed';

export interface DatabaseEvent {
  type: DatabaseEventType;
  databaseId: string;
  payload: any;
  timestamp: string;
}

export type DatabaseEventCallback = (event: DatabaseEvent) => void;

// ============================================================================
// Service Interfaces
// ============================================================================

export interface DatabaseServiceInterface {
  // Initialization
  initialize(): Promise<void>;
  
  // Database CRUD
  createDatabase(name: string, properties?: PropertyDefinition[], icon?: string): Promise<DatabaseSchema>;
  getDatabase(id: string): Promise<DatabaseManifest | null>;
  listDatabases(): Promise<DatabaseSchema[]>;
  updateDatabase(id: string, updates: Partial<Pick<DatabaseSchema, 'name' | 'icon' | 'cover' | 'properties' | 'views'>>): Promise<DatabaseSchema | null>;
  deleteDatabase(id: string): Promise<boolean>;
  
  // Row CRUD
  createRow(databaseId: string, properties?: Record<string, PropertyValue>): Promise<DatabaseRow | null>;
  getRow(rowId: string): Promise<DatabaseRow | null>;
  updateRow(rowId: string, propertyUpdates: Record<string, PropertyValue>): Promise<DatabaseRow | null>;
  deleteRow(rowId: string): Promise<boolean>;
  
  // Querying
  queryRows(query: DatabaseQuery): Promise<DatabaseQueryResult>;
  getGroupedRows(databaseId: string, groupByPropertyId: string, filter?: FilterGroup): Promise<Map<string, DatabaseRow[]>>;
  
  // View Management
  addView(databaseId: string, name: string, type: ViewType, config?: Partial<DatabaseView>): Promise<DatabaseView | null>;
  updateView(databaseId: string, viewId: string, updates: Partial<DatabaseView>): Promise<DatabaseView | null>;
  deleteView(databaseId: string, viewId: string): Promise<boolean>;
  
  // Property Management
  addProperty(databaseId: string, property: PropertyDefinition): Promise<PropertyDefinition | null>;
  updateProperty(databaseId: string, propertyId: string, updates: Partial<PropertyDefinition>): Promise<PropertyDefinition | null>;
  deleteProperty(databaseId: string, propertyId: string): Promise<boolean>;
  addSelectOption(databaseId: string, propertyId: string, option: SelectOption): Promise<SelectOption | null>;
  
  // Storacha Integration
  syncToStoracha(databaseId: string): Promise<string | null>;
  loadFromStoracha(cid: string): Promise<DatabaseManifest | null>;
  
  // Events
  on(event: DatabaseEventType, callback: DatabaseEventCallback): () => void;
}

export interface ShareServiceInterface {
  // Share Management
  createPublicLink(databaseId: string, permission: SharePermission, options?: { expiresAt?: string; password?: string }): Promise<PublicShareLink>;
  getShareLinks(databaseId: string): Promise<PublicShareLink[]>;
  revokeShareLink(linkId: string): Promise<boolean>;
  validateShareToken(token: string): Promise<{ valid: boolean; databaseId?: string; permission?: SharePermission }>;
  
  // Access Control
  canAccess(databaseId: string, userDID?: string): Promise<{ canAccess: boolean; permission: SharePermission | null }>;
  grantAccess(databaseId: string, userDID: string, permission: SharePermission): Promise<boolean>;
  revokeAccess(databaseId: string, userDID: string): Promise<boolean>;
}

// ============================================================================
// UCAN Delegation Types
// ============================================================================

/**
 * UCAN capability for resource access
 */
export type UCANCapability = 
  | 'space/blob/add'
  | 'space/blob/list'
  | 'space/blob/remove'
  | 'upload/add'
  | 'upload/list'
  | 'upload/remove'
  | 'store/add'
  | 'store/list'
  | 'store/remove'
  | 'access/delegate'
  | 'access/claim';

/**
 * Resource-specific capabilities for notes/databases
 */
export type ResourceCapability = 
  | 'note/read'
  | 'note/write'
  | 'note/delete'
  | 'note/share'
  | 'database/read'
  | 'database/write'
  | 'database/delete'
  | 'database/share'
  | 'row/read'
  | 'row/write'
  | 'row/delete';

/**
 * UCAN delegation record
 */
export interface UCANDelegation {
  /** Unique identifier for the delegation */
  id: string;
  /** Issuer DID (who grants the capability) */
  issuer: string;
  /** Audience DID (who receives the capability) */
  audience: string;
  /** Resource identifier (note ID, database ID, etc.) */
  resourceId: string;
  /** Resource type */
  resourceType: 'note' | 'database' | 'page' | 'workspace' | 'space';
  /** Granted capabilities */
  capabilities: ResourceCapability[];
  /** Expiration timestamp */
  expiresAt?: string;
  /** Delegation creation timestamp */
  createdAt: string;
  /** Whether delegation is active */
  isActive: boolean;
  /** Serialized UCAN token (for verification) */
  ucanToken?: string;
  /** CID of the delegation stored on Storacha */
  storachaCID?: string;
  /** Parent delegation (for chain of authority) */
  parentDelegationId?: string;
  /** Proof chain CIDs */
  proofs?: string[];
}

/**
 * Delegation request (for claiming access)
 */
export interface DelegationRequest {
  id: string;
  requesterDID: string;
  resourceId: string;
  resourceType: 'note' | 'database' | 'page' | 'workspace';
  requestedCapabilities: ResourceCapability[];
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  expiresAt: string;
  message?: string;
}

/**
 * Access grant result
 */
export interface AccessGrantResult {
  success: boolean;
  delegationId?: string;
  ucanToken?: string;
  shareUrl?: string;
  error?: string;
}

// ============================================================================
// Encryption Types (for E2E encrypted sharing)
// ============================================================================

/**
 * Encryption algorithm options
 */
export type EncryptionAlgorithm = 'AES-GCM-256' | 'ChaCha20-Poly1305';

/**
 * Key derivation function options
 */
export type KeyDerivationFunction = 'PBKDF2' | 'Argon2id' | 'HKDF';

/**
 * Encrypted content wrapper
 */
export interface EncryptedContent {
  /** Encrypted data (base64 encoded) */
  ciphertext: string;
  /** Initialization vector (base64 encoded) */
  iv: string;
  /** Authentication tag (base64 encoded) */
  authTag?: string;
  /** Encryption algorithm used */
  algorithm: EncryptionAlgorithm;
  /** Key derivation function used */
  kdf?: KeyDerivationFunction;
  /** Salt for key derivation (base64 encoded) */
  salt?: string;
  /** Version for future compatibility */
  version: number;
}

/**
 * Encrypted key share (for multi-party access)
 */
export interface EncryptedKeyShare {
  /** Recipient DID */
  recipientDID: string;
  /** Encrypted symmetric key (encrypted with recipient's public key) */
  encryptedKey: string;
  /** Key encryption algorithm */
  keyEncryptionAlgorithm: 'RSA-OAEP' | 'ECDH-ES+A256KW' | 'X25519';
  /** Ephemeral public key (for ECDH) */
  ephemeralPublicKey?: string;
}

/**
 * Encryption metadata for a shared resource
 */
export interface EncryptionMetadata {
  /** Whether content is encrypted */
  isEncrypted: boolean;
  /** Algorithm used for content encryption */
  algorithm?: EncryptionAlgorithm;
  /** Key shares for authorized recipients */
  keyShares: EncryptedKeyShare[];
  /** Owner's encrypted key (for self-recovery) */
  ownerKeyShare?: EncryptedKeyShare;
  /** Content hash (for integrity verification) */
  contentHash?: string;
  /** Hash algorithm */
  hashAlgorithm?: 'SHA-256' | 'SHA-384' | 'SHA-512' | 'BLAKE3';
}

// ============================================================================
// Enhanced Share Types
// ============================================================================

/**
 * Enhanced share configuration with UCAN and encryption support
 */
export interface EnhancedShareConfig extends ShareConfig {
  /** UCAN delegation ID for this share */
  delegationId?: string;
  /** Encryption metadata */
  encryption?: EncryptionMetadata;
  /** Whether share requires authentication */
  requiresAuth: boolean;
  /** Allowed domains for embedding */
  allowedDomains?: string[];
  /** Maximum access count (for limited shares) */
  maxAccessCount?: number;
  /** Current access count */
  accessCount: number;
  /** IP allowlist (for restricted access) */
  ipAllowlist?: string[];
  /** Last accessed timestamp */
  lastAccessedAt?: string;
  /** Access log CID on Storacha */
  accessLogCID?: string;
}

/**
 * Share invitation for user-to-user sharing
 */
export interface ShareInvitation {
  id: string;
  resourceId: string;
  resourceType: 'note' | 'database' | 'page' | 'workspace';
  resourceName: string;
  inviterDID: string;
  inviterName?: string;
  inviteeDID?: string;
  inviteeEmail?: string;
  permission: SharePermission;
  message?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  delegationId?: string;
}

/**
 * Shared resource metadata (for displaying shared items)
 */
export interface SharedResourceInfo {
  resourceId: string;
  resourceType: 'note' | 'database' | 'page' | 'workspace';
  name: string;
  icon?: string;
  ownerDID: string;
  ownerName?: string;
  permission: SharePermission;
  sharedAt: string;
  lastAccessedAt?: string;
  storachaCID: string;
  encryption?: {
    isEncrypted: boolean;
    hasAccess: boolean;
  };
}

// ============================================================================
// Storacha Sync Types
// ============================================================================

/**
 * Sync status for a resource
 */
export type SyncStatus = 
  | 'synced'
  | 'pending'
  | 'syncing'
  | 'conflict'
  | 'error'
  | 'offline';

/**
 * Sync metadata for tracking Storacha synchronization
 */
export interface SyncMetadata {
  /** Current sync status */
  status: SyncStatus;
  /** Last successful sync timestamp */
  lastSyncedAt?: string;
  /** Last sync attempt timestamp */
  lastAttemptAt?: string;
  /** Current CID on Storacha */
  remoteCID?: string;
  /** Local version hash */
  localHash?: string;
  /** Remote version hash */
  remoteHash?: string;
  /** Sync error message */
  error?: string;
  /** Retry count */
  retryCount: number;
  /** Next retry timestamp */
  nextRetryAt?: string;
}

/**
 * Conflict resolution strategy
 */
export type ConflictResolution = 
  | 'local-wins'
  | 'remote-wins'
  | 'merge'
  | 'manual';

/**
 * Sync conflict info
 */
export interface SyncConflict {
  resourceId: string;
  resourceType: 'note' | 'database' | 'row' | 'page';
  localVersion: {
    hash: string;
    modifiedAt: string;
    modifiedBy: string;
  };
  remoteVersion: {
    cid: string;
    modifiedAt: string;
    modifiedBy: string;
  };
  detectedAt: string;
  resolvedAt?: string;
  resolution?: ConflictResolution;
}

// ============================================================================
// Extended Database Types with Sync & Share
// ============================================================================

/**
 * Database with full sync and share metadata
 */
export interface SyncedDatabase extends DatabaseSchema {
  /** Sync metadata */
  sync: SyncMetadata;
  /** Active share configurations */
  shares: EnhancedShareConfig[];
  /** Active delegations */
  delegations: UCANDelegation[];
  /** Pending invitations sent */
  pendingInvitations: ShareInvitation[];
  /** Whether this is a shared database (not owned by current user) */
  isShared: boolean;
  /** Original owner DID (for shared databases) */
  ownerDID?: string;
}

/**
 * Note with sync and share support (extends existing Note type)
 */
export interface SyncedNote {
  id: string;
  title: string;
  /** Storacha CID of the note content */
  contentCID?: string;
  /** Sync metadata */
  sync: SyncMetadata;
  /** Active share configurations */
  shares: EnhancedShareConfig[];
  /** Active delegations */
  delegations: UCANDelegation[];
  /** Whether content is encrypted */
  isEncrypted: boolean;
  /** Encryption metadata */
  encryption?: EncryptionMetadata;
  /** Created timestamp */
  createdAt: string;
  /** Modified timestamp */
  modifiedAt: string;
  /** Creator DID */
  createdBy: string;
  /** Last editor DID */
  lastEditedBy: string;
}

// ============================================================================
// Service Interfaces (Extended)
// ============================================================================

/**
 * Enhanced share service interface with UCAN support
 */
export interface EnhancedShareServiceInterface extends ShareServiceInterface {
  // UCAN Delegations
  createDelegation(
    resourceId: string,
    resourceType: 'note' | 'database' | 'page' | 'workspace',
    audienceDID: string,
    capabilities: ResourceCapability[],
    options?: {
      expiresAt?: string;
      proofs?: string[];
    }
  ): Promise<AccessGrantResult>;
  
  revokeDelegation(delegationId: string): Promise<boolean>;
  
  getDelegations(resourceId: string): Promise<UCANDelegation[]>;
  
  claimDelegation(ucanToken: string): Promise<boolean>;
  
  // Invitations
  createInvitation(
    resourceId: string,
    resourceType: 'note' | 'database' | 'page' | 'workspace',
    inviteeEmail: string,
    permission: SharePermission,
    message?: string
  ): Promise<ShareInvitation>;
  
  acceptInvitation(invitationId: string): Promise<AccessGrantResult>;
  
  declineInvitation(invitationId: string): Promise<boolean>;
  
  getInvitations(status?: 'pending' | 'accepted' | 'declined'): Promise<ShareInvitation[]>;
  
  // Shared Resources
  getSharedWithMe(): Promise<SharedResourceInfo[]>;
  
  getSharedByMe(): Promise<SharedResourceInfo[]>;
  
  // Encryption
  encryptForSharing(
    content: Uint8Array,
    recipientDIDs: string[]
  ): Promise<{
    encryptedContent: EncryptedContent;
    keyShares: EncryptedKeyShare[];
  }>;
  
  decryptSharedContent(
    encryptedContent: EncryptedContent,
    keyShare: EncryptedKeyShare
  ): Promise<Uint8Array>;
}

/**
 * Database service interface with sync support
 */
export interface SyncedDatabaseServiceInterface extends DatabaseServiceInterface {
  // Sync Operations
  syncDatabase(databaseId: string): Promise<SyncMetadata>;
  
  syncRow(rowId: string): Promise<SyncMetadata>;
  
  getSyncStatus(databaseId: string): SyncMetadata;
  
  resolveConflict(
    conflict: SyncConflict,
    resolution: ConflictResolution
  ): Promise<boolean>;
  
  getConflicts(): Promise<SyncConflict[]>;
  
  // Offline Support
  queueForSync(databaseId: string): void;
  
  processOfflineQueue(): Promise<{
    synced: number;
    failed: number;
    pending: number;
  }>;
  
  // Import/Export
  exportDatabase(databaseId: string, format: 'json' | 'csv'): Promise<Blob>;
  
  importDatabase(
    data: Blob,
    format: 'json' | 'csv',
    options?: { merge?: boolean }
  ): Promise<DatabaseSchema>;
}

