/**
 * Offline Sync Manager Service
 * Implements update queuing during offline periods and sync when online
 * Requirements: 3.1, 3.2, 3.3, 3.5 - Offline editing, sync, and conflict resolution
 */

import type { 
  QueuedOperation, 
  QueuePriority, 
  QueuedOperationType, 
  SyncResult, 
  OfflineSyncManagerInterface,
  Note,
  StoredNoteData
} from '../types/index.js';
import { offlineDetectionService } from './offline-detection.js';
import { storachaClient } from './storacha.js';
import { versionHistoryService } from './version-history.js';
import * as Y from 'yjs';

export class OfflineSyncManager implements OfflineSyncManagerInterface {
  private operationQueue: QueuedOperation[] = [];
  private isProcessingQueue = false;
  private syncCompleteCallbacks: Set<(results: SyncResult[]) => void> = new Set();
  private isInitialized = false;
  private connectivityUnsubscribe: (() => void) | null = null;
  private processingInterval: number | null = null;
  private readonly PROCESSING_INTERVAL = 5000; // 5 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_BASE = 1000; // 1 second base delay

  /**
   * Initialize the offline sync manager
   * Sets up connectivity monitoring and automatic sync processing
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Load any persisted queue from localStorage
    await this.loadQueueFromStorage();

    // Set up connectivity monitoring
    this.connectivityUnsubscribe = offlineDetectionService.onStatusChange((event) => {
      if (event.status === 'online' && this.operationQueue.length > 0) {
        // Automatically process queue when coming back online
        this.processQueue();
      }
    });

    // Set up periodic processing for retry logic
    this.processingInterval = window.setInterval(() => {
      if (offlineDetectionService.isOnline() && this.hasRetryableOperations()) {
        this.processQueue();
      }
    }, this.PROCESSING_INTERVAL);

    this.isInitialized = true;
  }

  /**
   * Queue an operation for later processing
   * Operations are queued when offline or when immediate processing fails
   */
  queueOperation(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount'>): void {
    const queuedOp: QueuedOperation = {
      ...operation,
      id: this.generateOperationId(),
      timestamp: new Date(),
      retryCount: 0
    };

    // Insert operation in priority order
    this.insertOperationByPriority(queuedOp);

    // Persist queue to localStorage
    this.saveQueueToStorage();

    // If online, try to process immediately
    if (offlineDetectionService.isOnline() && !this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * Process all queued operations
   * Returns results for all processed operations
   */
  async processQueue(): Promise<SyncResult[]> {
    if (this.isProcessingQueue || this.operationQueue.length === 0) {
      return [];
    }

    if (!offlineDetectionService.isOnline()) {
      console.log('Cannot process queue while offline');
      return [];
    }

    this.isProcessingQueue = true;
    const results: SyncResult[] = [];

    try {
      // Process operations in priority order
      const operationsToProcess = [...this.operationQueue];
      
      for (const operation of operationsToProcess) {
        // Skip operations that are not ready for retry
        if (operation.nextRetry && operation.nextRetry > new Date()) {
          continue;
        }

        try {
          const result = await this.processOperation(operation);
          results.push(result);

          if (result.success) {
            // Remove successful operation from queue
            this.removeOperationFromQueue(operation.id);
          } else {
            // Handle retry logic for failed operations
            this.handleOperationRetry(operation, result.error);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({
            success: false,
            operation,
            error: errorMessage
          });

          this.handleOperationRetry(operation, errorMessage);
        }
      }

      // Persist updated queue
      this.saveQueueToStorage();

      // Notify listeners
      this.notifySyncComplete(results);

    } finally {
      this.isProcessingQueue = false;
    }

    return results;
  }

  /**
   * Get all queued operations
   */
  getQueuedOperations(): QueuedOperation[] {
    return [...this.operationQueue];
  }

  /**
   * Get the current queue size
   */
  getQueueSize(): number {
    return this.operationQueue.length;
  }

  /**
   * Clear all queued operations
   */
  clearQueue(): void {
    this.operationQueue = [];
    this.saveQueueToStorage();
  }

  /**
   * Check if currently processing the queue
   */
  isProcessing(): boolean {
    return this.isProcessingQueue;
  }

  /**
   * Register a callback for sync completion events
   */
  onSyncComplete(callback: (results: SyncResult[]) => void): () => void {
    this.syncCompleteCallbacks.add(callback);
    
    return () => {
      this.syncCompleteCallbacks.delete(callback);
    };
  }

  /**
   * Clean up resources and event listeners
   */
  destroy(): void {
    if (!this.isInitialized) {
      return;
    }

    if (this.connectivityUnsubscribe) {
      this.connectivityUnsubscribe();
      this.connectivityUnsubscribe = null;
    }

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    this.syncCompleteCallbacks.clear();
    this.isInitialized = false;
  }

  /**
   * Process a single operation
   */
  private async processOperation(operation: QueuedOperation): Promise<SyncResult> {
    try {
      let result: any;

      switch (operation.type) {
        case 'save':
          result = await this.processSaveOperation(operation);
          break;
        case 'delete':
          result = await this.processDeleteOperation(operation);
          break;
        case 'share':
          result = await this.processShareOperation(operation);
          break;
        case 'version':
          result = await this.processVersionOperation(operation);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      return {
        success: true,
        operation,
        result
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        operation,
        error: errorMessage
      };
    }
  }

  /**
   * Process a save operation
   */
  private async processSaveOperation(operation: QueuedOperation): Promise<string> {
    const { noteData } = operation.payload as { noteData: StoredNoteData };
    
    // Upload note data to Storacha
    const cid = await storachaClient.uploadNoteData(noteData);
    
    // Create version entry
    await versionHistoryService.createVersion(
      noteData.noteId,
      noteData.yjsUpdate,
      'Auto-saved from offline queue'
    );

    return cid;
  }

  /**
   * Process a delete operation
   */
  private async processDeleteOperation(operation: QueuedOperation): Promise<void> {
    const { noteId } = operation.payload as { noteId: string };
    
    // Delete version history
    await versionHistoryService.deleteVersionHistory(noteId);
    
    // Note: Storacha doesn't support deletion, so we just remove from version history
    // The content will remain in the network but won't be accessible through our app
  }

  /**
   * Process a share operation
   */
  private async processShareOperation(operation: QueuedOperation): Promise<string> {
    const { spaceId, permissions } = operation.payload as { spaceId: string; permissions: string[] };
    
    // Share space with specified permissions
    const shareUrl = await storachaClient.shareSpace(spaceId, permissions);
    
    return shareUrl;
  }

  /**
   * Process a version operation
   */
  private async processVersionOperation(operation: QueuedOperation): Promise<void> {
    const { noteId, yjsUpdate, changeDescription } = operation.payload as { 
      noteId: string; 
      yjsUpdate: Uint8Array; 
      changeDescription?: string 
    };
    
    // Create version entry
    await versionHistoryService.createVersion(noteId, yjsUpdate, changeDescription);
  }

  /**
   * Handle retry logic for failed operations
   */
  private handleOperationRetry(operation: QueuedOperation, error?: string): void {
    operation.retryCount++;

    if (operation.retryCount >= operation.maxRetries) {
      // Remove operation that has exceeded max retries
      this.removeOperationFromQueue(operation.id);
      console.error(`Operation ${operation.id} failed after ${operation.maxRetries} retries:`, error);
    } else {
      // Schedule retry with exponential backoff
      const delay = this.RETRY_DELAY_BASE * Math.pow(2, operation.retryCount - 1);
      operation.nextRetry = new Date(Date.now() + delay);
    }
  }

  /**
   * Insert operation into queue maintaining priority order
   */
  private insertOperationByPriority(operation: QueuedOperation): void {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const operationPriority = priorityOrder[operation.priority];

    let insertIndex = this.operationQueue.length;
    
    for (let i = 0; i < this.operationQueue.length; i++) {
      const queuedPriority = priorityOrder[this.operationQueue[i].priority];
      if (operationPriority < queuedPriority) {
        insertIndex = i;
        break;
      }
    }

    this.operationQueue.splice(insertIndex, 0, operation);
  }

  /**
   * Remove operation from queue by ID
   */
  private removeOperationFromQueue(operationId: string): void {
    const index = this.operationQueue.findIndex(op => op.id === operationId);
    if (index !== -1) {
      this.operationQueue.splice(index, 1);
    }
  }

  /**
   * Check if there are operations ready for retry
   */
  private hasRetryableOperations(): boolean {
    const now = new Date();
    return this.operationQueue.some(op => 
      op.retryCount > 0 && (!op.nextRetry || op.nextRetry <= now)
    );
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Notify all sync complete callbacks
   */
  private notifySyncComplete(results: SyncResult[]): void {
    this.syncCompleteCallbacks.forEach(callback => {
      try {
        callback(results);
      } catch (error) {
        console.error('Error in sync complete callback:', error);
      }
    });
  }

  /**
   * Save queue to localStorage for persistence
   */
  private saveQueueToStorage(): void {
    try {
      const serializedQueue = JSON.stringify(this.operationQueue, (key, value) => {
        // Handle Date objects and Uint8Array
        if (value instanceof Date) {
          return { __type: 'Date', value: value.toISOString() };
        }
        if (value instanceof Uint8Array) {
          return { __type: 'Uint8Array', value: Array.from(value) };
        }
        return value;
      });
      
      localStorage.setItem('storacha-notes-sync-queue', serializedQueue);
    } catch (error) {
      console.error('Failed to save sync queue to localStorage:', error);
    }
  }

  /**
   * Load queue from localStorage
   */
  private async loadQueueFromStorage(): Promise<void> {
    try {
      const serializedQueue = localStorage.getItem('storacha-notes-sync-queue');
      if (!serializedQueue) {
        return;
      }

      const parsedQueue = JSON.parse(serializedQueue, (key, value) => {
        // Handle Date objects and Uint8Array
        if (value && typeof value === 'object' && value.__type === 'Date') {
          return new Date(value.value);
        }
        if (value && typeof value === 'object' && value.__type === 'Uint8Array') {
          return new Uint8Array(value.value);
        }
        return value;
      });

      this.operationQueue = parsedQueue || [];
    } catch (error) {
      console.error('Failed to load sync queue from localStorage:', error);
      this.operationQueue = [];
    }
  }
}

// Create and export a singleton instance
export const offlineSyncManager = new OfflineSyncManager();