/**
 * Hybrid Storage Service
 * Combines Storacha remote storage with local IndexedDB fallback
 * Requirements: 3.1, 3.5 - Local storage fallback and sync mechanism
 */

import type { 
  StoredNoteData, 
  LocalStorageEntry,
  Note
} from '../types/index.js';
import { storachaClient } from './storacha.js';
import { LocalStorageManager, localStorageManager } from './local-storage.js';
import { offlineDetectionService } from './offline-detection.js';
import { offlineSyncManager } from './offline-sync.js';

export class HybridStorageService {
  private isInitialized = false;

  /**
   * Initialize the hybrid storage service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Initialize local storage
    await localStorageManager.initialize();

    // Initialize Storacha client if online
    if (offlineDetectionService.isOnline()) {
      try {
        await storachaClient.initialize();
      } catch (error) {
        console.warn('Failed to initialize Storacha client, using local storage only:', error);
      }
    }

    this.isInitialized = true;
  }

  /**
   * Store note data with automatic fallback
   * Tries Storacha first, falls back to local storage if unavailable
   */
  async storeNote(noteData: StoredNoteData): Promise<{ cid?: string; local: boolean }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Always store locally first for immediate availability
    await localStorageManager.storeNote(noteData);

    // Try to store remotely if online and Storacha is available
    if (offlineDetectionService.isOnline() && storachaClient.isReady()) {
      try {
        const cid = await storachaClient.uploadNoteData(noteData);
        
        // Mark as synced in local storage
        await localStorageManager.markAsSynced(noteData.noteId);
        
        return { cid, local: false };
      } catch (error) {
        console.warn('Failed to store note remotely, keeping in local storage:', error);
        
        // Queue for later sync
        offlineSyncManager.queueOperation({
          type: 'save',
          priority: 'normal',
          noteId: noteData.noteId,
          payload: { noteData },
          maxRetries: 3
        });
      }
    } else {
      // Queue for later sync when online
      offlineSyncManager.queueOperation({
        type: 'save',
        priority: 'normal',
        noteId: noteData.noteId,
        payload: { noteData },
        maxRetries: 3
      });
    }

    return { local: true };
  }

  /**
   * Retrieve note data with automatic fallback
   * Tries Storacha first, falls back to local storage
   */
  async retrieveNote(noteId: string, cid?: string): Promise<StoredNoteData | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Try remote storage first if we have a CID and are online
    if (cid && offlineDetectionService.isOnline() && storachaClient.isReady()) {
      try {
        const remoteData = await storachaClient.retrieveNoteData(cid);
        
        // Update local storage with remote data
        await localStorageManager.storeNote(remoteData);
        await localStorageManager.markAsSynced(noteId);
        
        return remoteData;
      } catch (error) {
        console.warn('Failed to retrieve note from remote storage, trying local:', error);
      }
    }

    // Fall back to local storage
    return await localStorageManager.retrieveNote(noteId);
  }

  /**
   * List all available notes from both storages
   */
  async listNotes(): Promise<{ noteId: string; synced: boolean; storedAt: Date }[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const localEntries = await localStorageManager.listNotes();
    
    return localEntries.map(entry => ({
      noteId: entry.noteId,
      synced: entry.synced,
      storedAt: entry.storedAt
    }));
  }

  /**
   * Delete note from both storages
   */
  async deleteNote(noteId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Delete from local storage
    await localStorageManager.deleteNote(noteId);

    // Queue deletion for remote storage
    if (offlineDetectionService.isOnline() && storachaClient.isReady()) {
      // Note: Storacha doesn't support deletion, so we just remove from our tracking
      // The content will remain in the network but won't be accessible through our app
    } else {
      offlineSyncManager.queueOperation({
        type: 'delete',
        priority: 'normal',
        noteId,
        payload: { noteId },
        maxRetries: 3
      });
    }
  }

  /**
   * Sync all unsynced notes to remote storage
   */
  async syncUnsyncedNotes(): Promise<{ synced: number; failed: number }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!offlineDetectionService.isOnline() || !storachaClient.isReady()) {
      return { synced: 0, failed: 0 };
    }

    const unsyncedNotes = await localStorageManager.getUnsyncedNotes();
    let synced = 0;
    let failed = 0;

    for (const entry of unsyncedNotes) {
      try {
        await localStorageManager.updateSyncAttempt(entry.noteId);
        
        const cid = await storachaClient.uploadNoteData(entry.data);
        await localStorageManager.markAsSynced(entry.noteId);
        
        synced++;
      } catch (error) {
        console.error(`Failed to sync note ${entry.noteId}:`, error);
        failed++;
      }
    }

    return { synced, failed };
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    localSize: number;
    totalNotes: number;
    syncedNotes: number;
    unsyncedNotes: number;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const [localSize, entries] = await Promise.all([
      localStorageManager.getStorageSize(),
      localStorageManager.listNotes()
    ]);

    const syncedNotes = entries.filter(entry => entry.synced).length;
    const unsyncedNotes = entries.length - syncedNotes;

    return {
      localSize,
      totalNotes: entries.length,
      syncedNotes,
      unsyncedNotes
    };
  }

  /**
   * Clear all storage data
   */
  async clearAllStorage(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await localStorageManager.clearStorage();
    // Note: Cannot clear remote Storacha storage
  }

  /**
   * Check if local storage is available
   */
  isLocalStorageAvailable(): boolean {
    return LocalStorageManager.isSupported();
  }

  /**
   * Check if remote storage is available
   */
  isRemoteStorageAvailable(): boolean {
    return offlineDetectionService.isOnline() && storachaClient.isReady();
  }

  /**
   * Get detailed storage status
   */
  async getStorageStatus(): Promise<{
    local: { available: boolean; size: number };
    remote: { available: boolean; connected: boolean };
    sync: { pending: number; failed: number };
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const [localSize, unsyncedNotes] = await Promise.all([
      localStorageManager.getStorageSize(),
      localStorageManager.getUnsyncedNotes()
    ]);

    const failedNotes = unsyncedNotes.filter(entry => entry.syncAttempts > 0).length;

    return {
      local: {
        available: this.isLocalStorageAvailable(),
        size: localSize
      },
      remote: {
        available: storachaClient.isReady(),
        connected: offlineDetectionService.isOnline()
      },
      sync: {
        pending: unsyncedNotes.length,
        failed: failedNotes
      }
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    localStorageManager.destroy();
    this.isInitialized = false;
  }
}

// Create and export a singleton instance
export const hybridStorageService = new HybridStorageService();