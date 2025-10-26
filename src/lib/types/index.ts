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

// Export auth types
export * from './auth.js'