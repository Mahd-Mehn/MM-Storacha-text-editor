// Yjs document integration for note content
// Provides wrapper for rich text content with serialization/deserialization
// Requirements: 3.1 - Offline editing, 3.3 - Conflict resolution, 6.4 - Version history

import { Doc as YDoc, applyUpdate, encodeStateAsUpdate, encodeStateVector } from 'yjs';
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
   * @param forceNew - If true, destroys existing document and creates a new one
   * @returns Yjs document instance
   */
  createDocument(noteId: string, forceNew: boolean = false): YDoc {
    // Check if document already exists
    const existingDoc = this.documents.get(noteId);
    if (existingDoc && !forceNew) {
      // Return existing document to avoid type conflicts
      return existingDoc;
    }
    
    if (existingDoc && forceNew) {
      // Destroy and recreate if forced
      try {
        existingDoc.destroy();
      } catch (e) {
        console.warn(`Error destroying document ${noteId}:`, e);
      }
      this.documents.delete(noteId);
    }

    const doc = new YDoc();
    
    // Note: We don't initialize any types here - let the Collaboration extension
    // create the XmlFragment it needs. This prevents type conflicts.
    
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
    // Try to get XmlFragment first (used by ProseMirror/Tiptap)
    try {
      const fragment = doc.getXmlFragment('content');
      // Extract text from XML fragment
      return this.extractTextFromXmlFragment(fragment);
    } catch (e) {
      // Fallback to Y.Text if XmlFragment doesn't exist
      try {
        const text = doc.getText('content');
        return text.toString();
      } catch (e2) {
        return '';
      }
    }
  }

  /**
   * Set text content in a Yjs document
   * Note: This should only be used for initial content before the editor is initialized
   * @param doc - Yjs document
   * @param content - Text content to set
   */
  setTextContent(doc: YDoc, content: string): void {
    // For ProseMirror/Tiptap, we should not manually set content
    // The editor will handle this through the Collaboration extension
    // This method is kept for backward compatibility but should be avoided
    console.warn('setTextContent should not be used with ProseMirror. Let the editor handle content initialization.');
  }

  /**
   * Extract plain text from an XmlFragment
   * @param fragment - Yjs XmlFragment
   * @returns Plain text content
   */
  private extractTextFromXmlFragment(fragment: any): string {
    let text = '';
    
    // Recursively extract text from XML nodes
    const extractText = (node: any): void => {
      if (node._first) {
        let item = node._first;
        while (item) {
          if (item.content && item.content.str) {
            text += item.content.str;
          } else if (item.content && item.content.type) {
            extractText(item.content.type);
          }
          item = item.right;
        }
      }
    };
    
    extractText(fragment);
    return text;
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