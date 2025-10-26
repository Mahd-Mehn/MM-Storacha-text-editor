import type { 
  Note, 
  NoteMetadata, 
  StoredNoteData,
  VersionEntry,
  StorachaClientInterface,
  AutoSaveServiceInterface,
  VersionHistoryServiceInterface,
  HybridStorageServiceInterface
} from '$lib/types';
import { yjsDocumentManager } from './yjs-document';
import { storachaClient } from './storacha';
import { autoSaveService } from './autosave';
import { versionHistoryService } from './version-history';
import { hybridStorageService } from './hybrid-storage';
import type { Doc as YDoc } from 'yjs';

/**
 * NoteManager Service Interface
 * Defines the contract for note management operations
 * Requirements: 5.3, 5.5 - Note creation, listing, and search capabilities
 */
export interface NoteManagerInterface {
  initialize(): Promise<void>;
  createNote(title?: string): Promise<Note>;
  loadNote(id: string): Promise<Note | null>;
  saveNote(note: Note): Promise<void>;
  deleteNote(id: string): Promise<void>;
  listNotes(): Promise<Note[]>;
  searchNotes(query: string): Promise<Note[]>;
  getNoteMetadata(id: string): Promise<NoteMetadata | null>;
  updateNoteTitle(id: string, title: string): Promise<void>;
  duplicateNote(id: string, newTitle?: string): Promise<Note>;
  getRecentNotes(limit?: number): Promise<Note[]>;
  isNoteExists(id: string): Promise<boolean>;
}

/**
 * NoteManager Service Implementation
 * Orchestrates note creation, editing, deletion, and management operations
 * Requirements: 5.3, 5.5 - Note management with indexing and search
 */
export class NoteManager implements NoteManagerInterface {
  private initialized = false;
  private noteCache = new Map<string, Note>();
  private noteIndex = new Map<string, Set<string>>(); // word -> note IDs for search
  private recentNotes: string[] = []; // ordered list of recently accessed note IDs

  constructor(
    private storachaClient: StorachaClientInterface,
    private autoSaveService: AutoSaveServiceInterface,
    private versionHistoryService: VersionHistoryServiceInterface,
    private hybridStorageService: HybridStorageServiceInterface
  ) {}

  /**
   * Initialize the NoteManager service
   * Requirements: 5.2 - Initialize user identity automatically
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize dependent services
      await this.storachaClient.initialize();
      await this.autoSaveService.initialize();
      await this.versionHistoryService.initialize();
      await this.hybridStorageService.initialize();

      // Load existing notes index
      await this.loadNotesIndex();
      
      this.initialized = true;
      console.log('NoteManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize NoteManager:', error);
      throw new Error(`NoteManager initialization failed: ${error}`);
    }
  }

  /**
   * Create a new note with optional title
   * Requirements: 5.3 - Provide immediate note creation capability
   */
  async createNote(title?: string): Promise<Note> {
    this.ensureInitialized();

    const noteId = this.generateNoteId();
    const now = new Date();
    
    // Create Yjs document for the note content
    const yjsDocument = yjsDocumentManager.createDocument(noteId);
    
    // Set initial content if title is provided
    if (title) {
      yjsDocumentManager.setTextContent(yjsDocument, `# ${title}\n\n`);
    }

    // Create note metadata
    const metadata: NoteMetadata = {
      created: now,
      modified: now,
      version: 1,
      storachaCID: '', // Will be set after first save
      shareLinks: []
    };

    // Create the note object
    const note: Note = {
      id: noteId,
      title: title || 'Untitled Note',
      content: yjsDocument,
      metadata
    };

    // Cache the note
    this.noteCache.set(noteId, note);
    
    // Add to recent notes
    this.addToRecentNotes(noteId);
    
    // Index the note for search
    this.indexNoteForSearch(note);

    // Schedule auto-save for the new note
    this.autoSaveService.scheduleAutoSave(note, 'high');

    console.log(`Created new note: ${noteId} - "${title || 'Untitled Note'}"`);
    return note;
  }

  /**
   * Load a note by ID from storage
   * Requirements: 5.3 - Note loading and metadata management
   */
  async loadNote(id: string): Promise<Note | null> {
    this.ensureInitialized();

    // Check cache first
    if (this.noteCache.has(id)) {
      const note = this.noteCache.get(id)!;
      this.addToRecentNotes(id);
      return note;
    }

    try {
      // Try to load from hybrid storage
      const storedData = await this.hybridStorageService.retrieveNote(id);
      if (!storedData) {
        console.log(`Note not found: ${id}`);
        return null;
      }

      // Reconstruct the note from stored data
      const note = await this.reconstructNoteFromStoredData(storedData);
      
      // Cache the loaded note
      this.noteCache.set(id, note);
      
      // Add to recent notes
      this.addToRecentNotes(id);
      
      // Index for search
      this.indexNoteForSearch(note);

      console.log(`Loaded note: ${id} - "${note.title}"`);
      return note;
    } catch (error) {
      console.error(`Failed to load note ${id}:`, error);
      return null;
    }
  }

  /**
   * Save a note to storage
   * Requirements: 2.1, 2.2 - Auto-save functionality
   */
  async saveNote(note: Note): Promise<void> {
    this.ensureInitialized();

    try {
      // Update metadata
      note.metadata.modified = new Date();
      note.metadata.version += 1;

      // Serialize the Yjs document
      const yjsUpdate = yjsDocumentManager.serializeDocument(note.content);

      // Create stored note data
      const storedData: StoredNoteData = {
        noteId: note.id,
        yjsUpdate,
        metadata: note.metadata,
        versionHistory: await this.versionHistoryService.getVersionHistory(note.id)
      };

      // Save to hybrid storage
      const result = await this.hybridStorageService.storeNote(storedData);
      if (result.cid) {
        note.metadata.storachaCID = result.cid;
      }

      // Update cache
      this.noteCache.set(note.id, note);
      
      // Update search index
      this.indexNoteForSearch(note);

      // Create version entry
      await this.versionHistoryService.createVersion(
        note.id, 
        yjsUpdate, 
        `Auto-save version ${note.metadata.version}`
      );

      console.log(`Saved note: ${note.id} - "${note.title}" (CID: ${result.cid || 'local only'})`);
    } catch (error) {
      console.error(`Failed to save note ${note.id}:`, error);
      throw new Error(`Failed to save note: ${error}`);
    }
  }

  /**
   * Delete a note by ID
   * Requirements: 5.3 - Note deletion methods
   */
  async deleteNote(id: string): Promise<void> {
    this.ensureInitialized();

    try {
      // Remove from hybrid storage
      await this.hybridStorageService.deleteNote(id);
      
      // Remove version history
      await this.versionHistoryService.deleteVersionHistory(id);
      
      // Remove from cache
      this.noteCache.delete(id);
      
      // Remove from recent notes
      this.removeFromRecentNotes(id);
      
      // Remove from search index
      this.removeFromSearchIndex(id);

      console.log(`Deleted note: ${id}`);
    } catch (error) {
      console.error(`Failed to delete note ${id}:`, error);
      throw new Error(`Failed to delete note: ${error}`);
    }
  }

  /**
   * List all available notes
   * Requirements: 5.3 - Note listing and metadata management
   */
  async listNotes(): Promise<Note[]> {
    this.ensureInitialized();

    try {
      const noteEntries = await this.hybridStorageService.listNotes();
      const notes: Note[] = [];

      for (const entry of noteEntries) {
        let note = this.noteCache.get(entry.noteId);
        
        if (!note) {
          // Load note if not in cache
          const storedData = await this.hybridStorageService.retrieveNote(entry.noteId);
          if (storedData) {
            note = await this.reconstructNoteFromStoredData(storedData);
            this.noteCache.set(entry.noteId, note);
            this.indexNoteForSearch(note);
          }
        }
        
        if (note) {
          notes.push(note);
        }
      }

      // Sort by modification date (most recent first)
      notes.sort((a, b) => b.metadata.modified.getTime() - a.metadata.modified.getTime());

      return notes;
    } catch (error) {
      console.error('Failed to list notes:', error);
      return [];
    }
  }

  /**
   * Search notes by query string
   * Requirements: 5.5 - Note indexing and search capabilities
   */
  async searchNotes(query: string): Promise<Note[]> {
    this.ensureInitialized();

    if (!query.trim()) {
      return this.listNotes();
    }

    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    const matchingNoteIds = new Set<string>();

    // Search in indexed words
    for (const term of searchTerms) {
      for (const [word, noteIds] of this.noteIndex.entries()) {
        if (word.includes(term)) {
          noteIds.forEach(id => matchingNoteIds.add(id));
        }
      }
    }

    // Load matching notes
    const matchingNotes: Note[] = [];
    for (const noteId of matchingNoteIds) {
      const note = await this.loadNote(noteId);
      if (note) {
        matchingNotes.push(note);
      }
    }

    // Sort by relevance (title matches first, then by modification date)
    matchingNotes.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const queryLower = query.toLowerCase();

      const aTitleMatch = aTitle.includes(queryLower);
      const bTitleMatch = bTitle.includes(queryLower);

      if (aTitleMatch && !bTitleMatch) return -1;
      if (!aTitleMatch && bTitleMatch) return 1;

      return b.metadata.modified.getTime() - a.metadata.modified.getTime();
    });

    return matchingNotes;
  }

  /**
   * Get note metadata by ID
   * Requirements: 5.3 - Note metadata management
   */
  async getNoteMetadata(id: string): Promise<NoteMetadata | null> {
    this.ensureInitialized();

    const note = await this.loadNote(id);
    return note ? note.metadata : null;
  }

  /**
   * Update note title
   * Requirements: 5.3 - Note metadata management
   */
  async updateNoteTitle(id: string, title: string): Promise<void> {
    this.ensureInitialized();

    const note = await this.loadNote(id);
    if (!note) {
      throw new Error(`Note not found: ${id}`);
    }

    note.title = title;
    note.metadata.modified = new Date();
    
    // Update search index
    this.indexNoteForSearch(note);
    
    // Schedule auto-save
    this.autoSaveService.scheduleAutoSave(note);
  }

  /**
   * Duplicate an existing note
   * Requirements: 5.3 - Note creation methods
   */
  async duplicateNote(id: string, newTitle?: string): Promise<Note> {
    this.ensureInitialized();

    const originalNote = await this.loadNote(id);
    if (!originalNote) {
      throw new Error(`Note not found: ${id}`);
    }

    // Create new note
    const duplicatedNote = await this.createNote(newTitle || `${originalNote.title} (Copy)`);
    
    // Copy content from original note
    const originalContent = yjsDocumentManager.getTextContent(originalNote.content);
    yjsDocumentManager.setTextContent(duplicatedNote.content, originalContent);

    // Schedule auto-save
    this.autoSaveService.scheduleAutoSave(duplicatedNote);

    return duplicatedNote;
  }

  /**
   * Get recently accessed notes
   * Requirements: 5.3 - Note listing with recent access
   */
  async getRecentNotes(limit: number = 10): Promise<Note[]> {
    this.ensureInitialized();

    const recentNotes: Note[] = [];
    const limitedIds = this.recentNotes.slice(0, limit);

    for (const noteId of limitedIds) {
      const note = await this.loadNote(noteId);
      if (note) {
        recentNotes.push(note);
      }
    }

    return recentNotes;
  }

  /**
   * Check if a note exists
   * Requirements: 5.3 - Note existence checking
   */
  async isNoteExists(id: string): Promise<boolean> {
    this.ensureInitialized();

    if (this.noteCache.has(id)) {
      return true;
    }

    try {
      const storedData = await this.hybridStorageService.retrieveNote(id);
      return storedData !== null;
    } catch {
      return false;
    }
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('NoteManager not initialized. Call initialize() first.');
    }
  }

  private generateNoteId(): string {
    return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async reconstructNoteFromStoredData(storedData: StoredNoteData): Promise<Note> {
    // Create Yjs document from stored update
    const yjsDocument = yjsDocumentManager.createDocument(storedData.noteId);
    yjsDocumentManager.applyUpdates(storedData.noteId, [storedData.yjsUpdate]);

    // Extract title from content (first line or use default)
    const content = yjsDocumentManager.getTextContent(yjsDocument);
    const title = this.extractTitleFromContent(content) || 'Untitled Note';

    return {
      id: storedData.noteId,
      title,
      content: yjsDocument,
      metadata: storedData.metadata
    };
  }

  private extractTitleFromContent(content: string): string | null {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        // Remove markdown heading syntax
        return trimmed.replace(/^#+\s*/, '').trim();
      }
    }
    return null;
  }

  private indexNoteForSearch(note: Note): void {
    // Remove existing index entries for this note
    this.removeFromSearchIndex(note.id);

    // Get searchable text (title + content)
    const content = yjsDocumentManager.getTextContent(note.content);
    const searchableText = `${note.title} ${content}`.toLowerCase();

    // Extract words for indexing
    const words = searchableText.match(/\b\w+\b/g) || [];
    
    for (const word of words) {
      if (word.length > 2) { // Only index words longer than 2 characters
        if (!this.noteIndex.has(word)) {
          this.noteIndex.set(word, new Set());
        }
        this.noteIndex.get(word)!.add(note.id);
      }
    }
  }

  private removeFromSearchIndex(noteId: string): void {
    for (const [word, noteIds] of this.noteIndex.entries()) {
      noteIds.delete(noteId);
      if (noteIds.size === 0) {
        this.noteIndex.delete(word);
      }
    }
  }

  private addToRecentNotes(noteId: string): void {
    // Remove if already exists
    this.removeFromRecentNotes(noteId);
    
    // Add to front
    this.recentNotes.unshift(noteId);
    
    // Keep only last 50 recent notes
    if (this.recentNotes.length > 50) {
      this.recentNotes = this.recentNotes.slice(0, 50);
    }
  }

  private removeFromRecentNotes(noteId: string): void {
    this.recentNotes = this.recentNotes.filter(id => id !== noteId);
  }

  private async loadNotesIndex(): Promise<void> {
    try {
      // Load all notes to build search index
      const notes = await this.listNotes();
      for (const note of notes) {
        this.indexNoteForSearch(note);
      }
      console.log(`Loaded search index for ${notes.length} notes`);
    } catch (error) {
      console.error('Failed to load notes index:', error);
    }
  }
}

// Create and export singleton instance
export const noteManager = new NoteManager(
  storachaClient,
  autoSaveService,
  versionHistoryService,
  hybridStorageService
);