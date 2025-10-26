/**
 * Sync Store
 * Svelte store for managing offline synchronization state
 * Requirements: 3.1, 3.2, 3.3, 3.5 - Offline sync state management
 */

import { writable, derived, type Readable } from 'svelte/store';
import type { QueuedOperation, SyncResult } from '../types/index.js';
import { offlineSyncManager } from '../services/offline-sync.js';

/**
 * Writable store for queued operations
 */
export const queuedOperations = writable<QueuedOperation[]>([]);

/**
 * Writable store for sync processing status
 */
export const isSyncing = writable<boolean>(false);

/**
 * Writable store for last sync results
 */
export const lastSyncResults = writable<SyncResult[]>([]);

/**
 * Writable store for last sync timestamp
 */
export const lastSyncTime = writable<Date | null>(null);

/**
 * Derived store for queue size
 */
export const queueSize: Readable<number> = derived(
  queuedOperations,
  ($operations) => $operations.length
);

/**
 * Derived store for checking if there are pending operations
 */
export const hasPendingOperations: Readable<boolean> = derived(
  queueSize,
  ($size) => $size > 0
);

/**
 * Derived store for high priority operations count
 */
export const highPriorityOperationsCount: Readable<number> = derived(
  queuedOperations,
  ($operations) => $operations.filter(op => op.priority === 'high' || op.priority === 'critical').length
);

/**
 * Derived store for failed operations count
 */
export const failedOperationsCount: Readable<number> = derived(
  queuedOperations,
  ($operations) => $operations.filter(op => op.retryCount > 0).length
);

/**
 * Derived store for sync status message
 */
export const syncStatusMessage: Readable<string> = derived(
  [isSyncing, queueSize, failedOperationsCount],
  ([$isSyncing, $queueSize, $failedCount]) => {
    if ($isSyncing) {
      return 'Syncing...';
    }
    
    if ($queueSize === 0) {
      return 'All changes synced';
    }
    
    if ($failedCount > 0) {
      return `${$queueSize} pending (${$failedCount} failed)`;
    }
    
    return `${$queueSize} pending`;
  }
);

/**
 * Initialize the sync store
 * Sets up the offline sync manager and connects it to the stores
 */
export async function initializeSyncStore(): Promise<() => void> {
  // Initialize the offline sync manager
  await offlineSyncManager.initialize();

  // Set up periodic updates of queued operations
  const updateQueue = () => {
    queuedOperations.set(offlineSyncManager.getQueuedOperations());
    isSyncing.set(offlineSyncManager.isProcessing());
  };

  // Initial update
  updateQueue();

  // Set up periodic updates
  const updateInterval = setInterval(updateQueue, 1000);

  // Subscribe to sync completion events
  const unsubscribeSync = offlineSyncManager.onSyncComplete((results: SyncResult[]) => {
    lastSyncResults.set(results);
    lastSyncTime.set(new Date());
    updateQueue(); // Update queue after sync
  });

  // Return cleanup function
  return () => {
    clearInterval(updateInterval);
    unsubscribeSync();
    offlineSyncManager.destroy();
  };
}

/**
 * Queue a save operation
 */
export function queueSaveOperation(noteId: string, noteData: any, priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'): void {
  offlineSyncManager.queueOperation({
    type: 'save',
    priority,
    noteId,
    payload: { noteData },
    maxRetries: 3
  });
}

/**
 * Queue a delete operation
 */
export function queueDeleteOperation(noteId: string, priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'): void {
  offlineSyncManager.queueOperation({
    type: 'delete',
    priority,
    noteId,
    payload: { noteId },
    maxRetries: 3
  });
}

/**
 * Queue a share operation
 */
export function queueShareOperation(noteId: string, spaceId: string, permissions: string[], priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'): void {
  offlineSyncManager.queueOperation({
    type: 'share',
    priority,
    noteId,
    payload: { spaceId, permissions },
    maxRetries: 3
  });
}

/**
 * Queue a version operation
 */
export function queueVersionOperation(noteId: string, yjsUpdate: Uint8Array, changeDescription?: string, priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'): void {
  offlineSyncManager.queueOperation({
    type: 'version',
    priority,
    noteId,
    payload: { noteId, yjsUpdate, changeDescription },
    maxRetries: 3
  });
}

/**
 * Manually trigger sync processing
 */
export async function triggerSync(): Promise<SyncResult[]> {
  return await offlineSyncManager.processQueue();
}

/**
 * Clear all queued operations
 */
export function clearSyncQueue(): void {
  offlineSyncManager.clearQueue();
  queuedOperations.set([]);
}