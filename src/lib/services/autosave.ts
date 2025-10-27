import type { Note, StoredNoteData } from '../types/index.js'
import { hybridStorageService } from './hybrid-storage.js'
import * as Y from 'yjs'

/**
 * Save operation metadata for queue management
 */
interface SaveOperation {
  noteId: string
  note: Note
  retryCount: number
  lastAttempt: Date
  priority: 'normal' | 'high'
}

/**
 * Auto-save Service
 * Handles automatic saving of note changes with debouncing and retry logic
 * Requirements: 2.1, 2.2 - Auto-save functionality with version tracking
 */
export class AutoSaveService {
  private saveQueue: Map<string, SaveOperation> = new Map()
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private readonly DEBOUNCE_DELAY = 2000 // 2 seconds as per requirement 2.1
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAY_BASE = 1000 // 1 second base delay



  /**
   * Initialize the auto-save service
   * Ensures hybrid storage is ready for operations
   */
  async initialize(): Promise<void> {
    try {
      await hybridStorageService.initialize()
    } catch (error) {
      console.error('Failed to initialize auto-save service:', error)
      throw new Error('Failed to initialize auto-save service')
    }
  }

  /**
   * Schedule a note for auto-save with debouncing
   * Requirements: 2.1 - Auto-save within 2 seconds of changes
   */
  scheduleAutoSave(note: Note, priority: 'normal' | 'high' = 'normal'): void {
    const noteId = note.id

    // Clear existing debounce timer for this note
    const existingTimer = this.debounceTimers.get(noteId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Update the save operation in queue
    this.saveQueue.set(noteId, {
      noteId,
      note: { ...note }, // Create a copy to avoid reference issues
      retryCount: 0,
      lastAttempt: new Date(),
      priority
    })

    // Set up debounced save
    const delay = priority === 'high' ? 500 : this.DEBOUNCE_DELAY
    const timer = setTimeout(() => {
      this.executeSave(noteId)
      this.debounceTimers.delete(noteId)
    }, delay)

    this.debounceTimers.set(noteId, timer)
  }

  /**
   * Force immediate save of a note (bypasses debouncing)
   * Useful for explicit save actions or critical operations
   */
  async forceSave(note: Note): Promise<void> {
    const noteId = note.id

    // Cancel any pending debounced save
    const existingTimer = this.debounceTimers.get(noteId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      this.debounceTimers.delete(noteId)
    }

    // Remove from queue and execute immediately
    this.saveQueue.delete(noteId)
    
    try {
      await this.performSave(note)
    } catch (error) {
      console.error(`Failed to force save note ${noteId}:`, error)
      // Re-queue with high priority for retry
      this.scheduleAutoSave(note, 'high')
      throw error
    }
  }

  /**
   * Execute save operation for a queued note
   * Handles retry logic and error recovery
   */
  private async executeSave(noteId: string): Promise<void> {
    const operation = this.saveQueue.get(noteId)
    if (!operation) {
      return // Operation was cancelled or already processed
    }

    try {
      await this.performSave(operation.note)
      
      // Success - remove from queue
      this.saveQueue.delete(noteId)
      console.log(`Successfully saved note ${noteId}`)
    } catch (error) {
      console.error(`Failed to save note ${noteId}:`, error)
      
      // Handle retry logic
      operation.retryCount++
      operation.lastAttempt = new Date()

      if (operation.retryCount < this.MAX_RETRIES) {
        // Schedule retry with exponential backoff
        const retryDelay = this.RETRY_DELAY_BASE * Math.pow(2, operation.retryCount - 1)
        
        setTimeout(() => {
          this.executeSave(noteId)
        }, retryDelay)
        
        console.log(`Scheduled retry ${operation.retryCount}/${this.MAX_RETRIES} for note ${noteId} in ${retryDelay}ms`)
      } else {
        // Max retries reached - remove from queue and log error
        this.saveQueue.delete(noteId)
        console.error(`Failed to save note ${noteId} after ${this.MAX_RETRIES} retries. Giving up.`)
        
        // Emit error event for UI feedback
        this.emitSaveError(noteId, error as Error)
      }
    }
  }

  /**
   * Perform the actual save operation using hybrid storage
   * Requirements: 2.2 - Store each save as new version
   */
  private async performSave(note: Note): Promise<void> {
    try {
      // Serialize Yjs document to binary format
      const yjsUpdate = Y.encodeStateAsUpdate(note.content)
      
      // Increment version number
      const newVersion = note.metadata.version + 1
      
      // Update metadata
      const updatedMetadata = {
        ...note.metadata,
        modified: new Date(),
        version: newVersion
      }

      // Create stored note data structure
      const storedNoteData: StoredNoteData = {
        noteId: note.id,
        yjsUpdate,
        metadata: updatedMetadata,
        versionHistory: [{
          version: newVersion,
          timestamp: new Date(),
          storachaCID: '', // Will be filled after upload if successful
          changeDescription: newVersion === 1 ? 'Initial version' : `Auto-save version ${newVersion}`
        }]
      }

      // Use hybrid storage which handles fallback to local storage
      const result = await hybridStorageService.storeNote(storedNoteData)
      
      // Update the CID in metadata if remote upload succeeded
      if (result.cid) {
        updatedMetadata.storachaCID = result.cid
        if (storedNoteData.versionHistory.length > 0) {
          storedNoteData.versionHistory[storedNoteData.versionHistory.length - 1].storachaCID = result.cid
        }
        console.log(`Note ${note.id} saved successfully with CID: ${result.cid}`)
      } else {
        console.log(`Note ${note.id} saved locally (will sync when online)`)
      }

      // Update the note object
      note.metadata = updatedMetadata
    } catch (error) {
      console.error('Failed to perform save operation:', error)
      throw error
    }
  }

  /**
   * Get the current save queue status
   * Useful for debugging and user feedback
   */
  getSaveQueueStatus(): {
    queueSize: number
    pendingNotes: string[]
    failedNotes: { noteId: string; retryCount: number; lastAttempt: Date }[]
  } {
    const pendingNotes: string[] = []
    const failedNotes: { noteId: string; retryCount: number; lastAttempt: Date }[] = []

    for (const [noteId, operation] of this.saveQueue) {
      pendingNotes.push(noteId)
      if (operation.retryCount > 0) {
        failedNotes.push({
          noteId,
          retryCount: operation.retryCount,
          lastAttempt: operation.lastAttempt
        })
      }
    }

    return {
      queueSize: this.saveQueue.size,
      pendingNotes,
      failedNotes
    }
  }

  /**
   * Clear all pending save operations
   * Useful for cleanup or when switching contexts
   */
  clearSaveQueue(): void {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    
    this.debounceTimers.clear()
    this.saveQueue.clear()
    
    console.log('Auto-save queue cleared')
  }

  /**
   * Check if a note has pending save operations
   */
  hasPendingSave(noteId: string): boolean {
    return this.saveQueue.has(noteId) || this.debounceTimers.has(noteId)
  }

  /**
   * Emit save error event for UI feedback
   * In a real implementation, this would integrate with a proper event system
   */
  private emitSaveError(noteId: string, error: Error): void {
    // For now, just log the error
    // In a production app, this would emit events for the UI to handle
    console.error(`Save error for note ${noteId}:`, error.message)
    
    // Could dispatch custom events here for UI components to listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('storacha-notes:save-error', {
        detail: { noteId, error: error.message }
      }))
    }
  }

  /**
   * Emit save success event for UI feedback
   */
  private emitSaveSuccess(noteId: string): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('storacha-notes:save-success', {
        detail: { noteId }
      }))
    }
  }
}

// Export singleton instance
export const autoSaveService = new AutoSaveService()