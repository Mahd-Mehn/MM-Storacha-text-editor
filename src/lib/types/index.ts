// Type definitions and interfaces for Storacha Notes
// This file will export all TypeScript types and interfaces

import type { Doc as YDoc } from 'yjs';

/**
 * Permission levels for sharing functionality
 */
export type SharePermission = 'read' | 'write';

/**
 * ShareLink interface for note sharing with permissions and expiration handling
 * Requirements: 4.1 - Generate unique shareable links
 */
export interface ShareLink {
  /** Unique identifier for the share link */
  id: string;
  /** The shareable URL */
  url: string;
  /** Permission level for the shared access */
  permissions: SharePermission;
  /** Timestamp when the share link was created */
  created: Date;
  /** Optional expiration date for the share link */
  expiresAt?: Date;
}

/**
 * Note metadata containing creation info, version tracking, and sharing data
 */
export interface NoteMetadata {
  /** Timestamp when the note was created */
  created: Date;
  /** Timestamp when the note was last modified */
  modified: Date;
  /** Current version number of the note */
  version: number;
  /** Content Identifier (CID) for Storacha storage */
  storachaCID: string;
  /** Array of active share links for this note */
  shareLinks: ShareLink[];
}

/**
 * Core Note interface with id, title, content, and metadata properties
 * Requirements: 2.2 - Auto-save functionality, 6.1 - Version history
 */
export interface Note {
  /** Unique identifier for the note */
  id: string;
  /** Human-readable title of the note */
  title: string;
  /** Rich text content stored as Yjs document for collaborative editing */
  content: YDoc;
  /** Metadata containing timestamps, version info, and sharing data */
  metadata: NoteMetadata;
}

/**
 * Version entry for tracking note history
 * Requirements: 6.1 - Maintain version history with timestamps
 */
export interface VersionEntry {
  /** Version number */
  version: number;
  /** Timestamp when this version was created */
  timestamp: Date;
  /** Storacha CID for this version's content */
  storachaCID: string;
  /** Human-readable description of changes in this version */
  changeDescription: string;
}

/**
 * StoredNoteData interface for Storacha storage format
 * This represents how note data is serialized and stored in the decentralized storage
 * Requirements: 2.2 - Auto-save to decentralized storage, 6.1 - Version history storage
 */
export interface StoredNoteData {
  /** Unique identifier for the note */
  noteId: string;
  /** Serialized Yjs document state as binary data */
  yjsUpdate: Uint8Array;
  /** Note metadata including timestamps and sharing info */
  metadata: NoteMetadata;
  /** Complete version history for the note */
  versionHistory: VersionEntry[];
}

/**
 * Storacha Client Service Interface
 * Defines the contract for Storacha network operations
 * Requirements: 2.1, 2.4 - Content upload/retrieval and space management
 */
export interface StorachaClientInterface {
  initialize(): Promise<void>
  uploadContent(content: Uint8Array): Promise<string>
  retrieveContent(cid: string): Promise<Uint8Array>
  uploadNoteData(noteData: StoredNoteData): Promise<string>
  retrieveNoteData(cid: string): Promise<StoredNoteData>
  createSpace(name?: string): Promise<string>
  shareSpace(spaceId: string, permissions: string[]): Promise<string>
  getCurrentSpaceDID(): string | null
  isReady(): boolean
}

/**
 * Auto-save Service Interface
 * Defines the contract for automatic note saving functionality
 * Requirements: 2.1, 2.2 - Auto-save with debouncing and retry logic
 */
export interface AutoSaveServiceInterface {
  initialize(): Promise<void>
  scheduleAutoSave(note: Note, priority?: 'normal' | 'high'): void
  forceSave(note: Note): Promise<void>
  hasPendingSave(noteId: string): boolean
  clearSaveQueue(): void
}

/**
 * Version History Service Interface
 * Defines the contract for version tracking and retrieval functionality
 * Requirements: 6.1, 6.4 - Version history with timestamps and retrieval
 */
export interface VersionHistoryServiceInterface {
  initialize(): Promise<void>
  createVersion(noteId: string, yjsUpdate: Uint8Array, changeDescription?: string): Promise<VersionEntry>
  getVersionHistory(noteId: string): Promise<VersionEntry[]>
  getVersion(noteId: string, versionNumber: number): Promise<StoredNoteData | null>
  getLatestVersion(noteId: string): Promise<StoredNoteData | null>
  restoreVersion(noteId: string, versionNumber: number): Promise<Note | null>
  deleteVersionHistory(noteId: string): Promise<void>
}

/**
 * Connection status for offline/online detection
 * Requirements: 3.4, 3.5 - Connection status and offline handling
 */
export type ConnectionStatus = 'online' | 'offline' | 'connecting' | 'unknown';

/**
 * Network connectivity event data
 */
export interface ConnectivityEvent {
  /** Current connection status */
  status: ConnectionStatus;
  /** Timestamp when the status changed */
  timestamp: Date;
  /** Optional additional context about the connectivity change */
  context?: string;
}

/**
 * Offline Detection Service Interface
 * Defines the contract for network connectivity monitoring
 * Requirements: 3.4, 3.5 - Connection monitoring and status management
 */
export interface OfflineDetectionServiceInterface {
  initialize(): void
  getConnectionStatus(): ConnectionStatus
  isOnline(): boolean
  isOffline(): boolean
  onStatusChange(callback: (event: ConnectivityEvent) => void): () => void
  destroy(): void
}

/**
 * Queued operation types for offline synchronization
 */
export type QueuedOperationType = 'save' | 'delete' | 'share' | 'version';

/**
 * Priority levels for queued operations
 */
export type QueuePriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Queued operation for offline synchronization
 * Requirements: 3.1, 3.2, 3.3, 3.5 - Offline editing and sync
 */
export interface QueuedOperation {
  /** Unique identifier for the operation */
  id: string;
  /** Type of operation to perform */
  type: QueuedOperationType;
  /** Priority level for processing order */
  priority: QueuePriority;
  /** Note ID this operation relates to */
  noteId: string;
  /** Operation payload data */
  payload: any;
  /** Timestamp when operation was queued */
  timestamp: Date;
  /** Number of retry attempts */
  retryCount: number;
  /** Maximum number of retries allowed */
  maxRetries: number;
  /** Next retry timestamp (for exponential backoff) */
  nextRetry?: Date;
}

/**
 * Sync operation result
 */
export interface SyncResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Operation that was processed */
  operation: QueuedOperation;
  /** Error message if operation failed */
  error?: string;
  /** Result data if operation succeeded */
  result?: any;
}

/**
 * Offline Sync Manager Interface
 * Defines the contract for offline queue and synchronization management
 * Requirements: 3.1, 3.2, 3.3, 3.5 - Offline editing, sync, and conflict resolution
 */
export interface OfflineSyncManagerInterface {
  initialize(): Promise<void>
  queueOperation(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount'>): void
  processQueue(): Promise<SyncResult[]>
  getQueuedOperations(): QueuedOperation[]
  getQueueSize(): number
  clearQueue(): void
  isProcessing(): boolean
  onSyncComplete(callback: (results: SyncResult[]) => void): () => void
  destroy(): void
}

/**
 * Local storage entry for note data
 * Requirements: 3.1, 3.5 - Local storage fallback
 */
export interface LocalStorageEntry {
  /** Note ID */
  noteId: string;
  /** Stored note data */
  data: StoredNoteData;
  /** Timestamp when stored locally */
  storedAt: Date;
  /** Whether this entry has been synced to remote storage */
  synced: boolean;
  /** Last sync attempt timestamp */
  lastSyncAttempt?: Date;
  /** Number of sync attempts */
  syncAttempts: number;
}

/**
 * Local Storage Manager Interface
 * Defines the contract for IndexedDB-based local storage fallback
 * Requirements: 3.1, 3.5 - Local storage fallback and sync mechanism
 */
export interface LocalStorageManagerInterface {
  initialize(): Promise<void>
  storeNote(noteData: StoredNoteData): Promise<void>
  retrieveNote(noteId: string): Promise<StoredNoteData | null>
  listNotes(): Promise<LocalStorageEntry[]>
  deleteNote(noteId: string): Promise<void>
  markAsSynced(noteId: string): Promise<void>
  getUnsyncedNotes(): Promise<LocalStorageEntry[]>
  clearStorage(): Promise<void>
  getStorageSize(): Promise<number>
  destroy(): void
}

/**
 * Hybrid Storage Service Interface
 * Defines the contract for hybrid storage operations combining remote and local storage
 * Requirements: 3.1, 3.5 - Local storage fallback and sync mechanism
 */
export interface HybridStorageServiceInterface {
  initialize(): Promise<void>
  storeNote(noteData: StoredNoteData): Promise<{ cid?: string; local: boolean }>
  retrieveNote(noteId: string, cid?: string): Promise<StoredNoteData | null>
  listNotes(): Promise<{ noteId: string; synced: boolean; storedAt: Date }[]>
  deleteNote(noteId: string): Promise<void>
  syncUnsyncedNotes(): Promise<{ synced: number; failed: number }>
  getStorageStats(): Promise<{ localSize: number; totalNotes: number; syncedNotes: number; unsyncedNotes: number }>
  clearAllStorage(): Promise<void>
}

/**
 * NoteManager Service Interface
 * Defines the contract for note management operations
 * Requirements: 5.3, 5.5 - Note creation, listing, and search capabilities
 */
export interface NoteManagerInterface {
  initialize(): Promise<void>
  createNote(title?: string): Promise<Note>
  loadNote(id: string): Promise<Note | null>
  saveNote(note: Note): Promise<void>
  deleteNote(id: string): Promise<void>
  listNotes(): Promise<Note[]>
  searchNotes(query: string): Promise<Note[]>
  getNoteMetadata(id: string): Promise<NoteMetadata | null>
  updateNoteTitle(id: string, title: string): Promise<void>
  duplicateNote(id: string, newTitle?: string): Promise<Note>
  getRecentNotes(limit?: number): Promise<Note[]>
  isNoteExists(id: string): Promise<boolean>
}

// Export auth types
export * from './auth.js'