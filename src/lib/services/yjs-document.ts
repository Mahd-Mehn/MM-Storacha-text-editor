// Yjs document integration for note content
// Provides wrapper for rich text content with serialization/deserialization
// Requirements: 3.1 - Offline editing, 3.3 - Conflict resolution, 6.4 - Version history

import { Doc as YDoc, Text as YText, applyUpdate, encodeStateAsUpdate, encodeStateVector } from 'yjs';
import type { Note, StoredNoteData } from '../types';

/**
 * Yjs document wrapper for rich text content management
 * Handles document creation, serialization, and state management
 */
export class YjsDocumentManager {
  private documents: Map<string, YDoc> = new Map();

  /**
   * Create or retrieve a Yjs document for a note
   * @param noteId - Unique identifier for the note
   * @returns Yjs document instance
   */
  createDocument(noteId: string): YDoc {
    if (this.documents.has(noteId)) {
      return this.documents.get(noteId)!;
    }

    const doc = new YDoc();
    
    // Initialize the document with a 'content' text type for rich text editing
    const text = doc.getText('content');
    
    // Set up document metadata
    doc.clientID = this.generateClientId();
    
    // Store the document reference
    this.documents.set(noteId, doc);
    
    return doc;
  }

  /**
   * Get an existing document by note ID
   * @param noteId - Unique identifier for the note
   * @returns Yjs document instance or undefined if not found
   */
  getDocument(noteId: string): YDoc | undefined {
    return this.documents.get(noteId);
  }

  /**
   * Serialize a Yjs document to binary format for storage
   * @param doc - Yjs document to serialize
   * @returns Serialized document as Uint8Array
   */
  serializeDocument(doc: YDoc): Uint8Array {
    return encodeStateAsUpdate(doc);
  }

  /**
   * Deserialize binary data to create/update a Yjs document
   * @param noteId - Unique identifier for the note
   * @param serializedData - Binary data from storage
   * @returns Updated Yjs document
   */
  deserializeDocument(noteId: string, serializedData: Uint8Array): YDoc {
    let doc = this.documents.get(noteId);
    
    if (!doc) {
      doc = this.createDocument(noteId);
    }
    
    // Apply the serialized state to the document
    applyUpdate(doc, serializedData);
    
    return doc;
  }

  /**
   * Create a StoredNoteData object from a Note for Storacha storage
   * @param note - Note object to convert
   * @returns StoredNoteData ready for storage
   */
  createStoredNoteData(note: Note): StoredNoteData {
    const yjsUpdate = this.serializeDocument(note.content);
    
    return {
      noteId: note.id,
      yjsUpdate,
      metadata: note.metadata,
      versionHistory: [] // Will be populated by version manager
    };
  }

  /**
   * Restore a Note object from StoredNoteData
   * @param storedData - Data retrieved from storage
   * @returns Reconstructed Note object
   */
  restoreNoteFromStoredData(storedData: StoredNoteData): Note {
    const content = this.deserializeDocument(storedData.noteId, storedData.yjsUpdate);
    
    return {
      id: storedData.noteId,
      title: this.extractTitleFromContent(content),
      content,
      metadata: storedData.metadata
    };
  }

  /**
   * Get the text content from a Yjs document
   * @param doc - Yjs document
   * @returns Plain text content
   */
  getTextContent(doc: YDoc): string {
    const text = doc.getText('content');
    return text.toString();
  }

  /**
   * Set text content in a Yjs document
   * @param doc - Yjs document
   * @param content - Text content to set
   */
  setTextContent(doc: YDoc, content: string): void {
    const text = doc.getText('content');
    
    // Clear existing content and insert new content
    text.delete(0, text.length);
    text.insert(0, content);
  }

  /**
   * Get document state vector for synchronization
   * @param doc - Yjs document
   * @returns State vector as Uint8Array
   */
  getStateVector(doc: YDoc): Uint8Array {
    return encodeStateVector(doc);
  }

  /**
   * Apply updates to a document (for synchronization)
   * @param noteId - Note identifier
   * @param updates - Array of updates to apply
   */
  applyUpdates(noteId: string, updates: Uint8Array[]): void {
    const doc = this.getDocument(noteId);
    if (!doc) {
      throw new Error(`Document not found for note: ${noteId}`);
    }

    updates.forEach(update => {
      applyUpdate(doc, update);
    });
  }

  /**
   * Clean up document resources
   * @param noteId - Note identifier
   */
  destroyDocument(noteId: string): void {
    const doc = this.documents.get(noteId);
    if (doc) {
      doc.destroy();
      this.documents.delete(noteId);
    }
  }

  /**
   * Extract title from document content (first line or first few words)
   * @param doc - Yjs document
   * @returns Extracted title
   */
  private extractTitleFromContent(doc: YDoc): string {
    const text = this.getTextContent(doc);
    
    if (!text.trim()) {
      return 'Untitled Note';
    }
    
    // Get first line or first 50 characters as title
    const firstLine = text.split('\n')[0];
    return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
  }

  /**
   * Generate a unique client ID for the Yjs document
   * @returns Unique client ID
   */
  private generateClientId(): number {
    return Math.floor(Math.random() * 2147483647);
  }

  /**
   * Set up document change listeners for auto-save functionality
   * @param doc - Yjs document
   * @param onUpdate - Callback function for document updates
   */
  setupUpdateListener(doc: YDoc, onUpdate: (update: Uint8Array) => void): void {
    doc.on('update', onUpdate);
  }

  /**
   * Remove update listeners from a document
   * @param doc - Yjs document
   * @param onUpdate - Callback function to remove
   */
  removeUpdateListener(doc: YDoc, onUpdate: (update: Uint8Array) => void): void {
    doc.off('update', onUpdate);
  }
}

// Export singleton instance
export const yjsDocumentManager = new YjsDocumentManager();