<!--
  Sync Status Indicator Component
  Displays the current synchronization status and queue information
  Requirements: 3.1, 3.2, 3.3, 3.5 - Sync status display and queue management
-->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    queuedOperations,
    isSyncing,
    queueSize,
    hasPendingOperations,
    highPriorityOperationsCount,
    failedOperationsCount,
    syncStatusMessage,
    lastSyncTime,
    initializeSyncStore,
    triggerSync,
    clearSyncQueue
  } from '../stores/sync.js';
  import { isOnline, isOffline } from '../stores/connectivity.js';

  // Component props
  export let showDetails = false;
  export let showActions = true;
  export let size: 'small' | 'medium' | 'large' = 'medium';

  let cleanupSync: (() => void) | null = null;
  let isManualSyncing = false;

  onMount(async () => {
    // Initialize sync monitoring
    cleanupSync = await initializeSyncStore();
  });

  onDestroy(() => {
    if (cleanupSync) {
      cleanupSync();
    }
  });

  async function handleManualSync() {
    if (!$isOnline || $isSyncing || isManualSyncing) {
      return;
    }

    isManualSyncing = true;
    try {
      await triggerSync();
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      isManualSyncing = false;
    }
  }

  function handleClearQueue() {
    if (confirm('Are you sure you want to clear all pending sync operations? This cannot be undone.')) {
      clearSyncQueue();
    }
  }

  function formatTime(date: Date | null): string {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    return date.toLocaleDateString();
  }

  // Reactive styles based on size
  $: sizeClass = `sync-indicator--${size}`;
  $: statusClass = getSyncStatusClass($isSyncing, $hasPendingOperations, $failedOperationsCount, $isOffline);

  function getSyncStatusClass(syncing: boolean, pending: boolean, failed: number, offline: boolean): string {
    if (offline) return 'offline';
    if (syncing || isManualSyncing) return 'syncing';
    if (failed > 0) return 'error';
    if (pending) return 'pending';
    return 'synced';
  }
</script>

<div class="sync-indicator {sizeClass} {statusClass}">
  <div class="sync-status">
    <div class="status-icon" aria-hidden="true">
      {#if $isOffline}
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.64 7c-.45-.34-4.93-4-11.64-4-1.5 0-2.89.19-4.15.48L18.18 13.8 23.64 7zm-6.6 8.22L3.27 1.44 2 2.72l2.05 2.06C1.91 5.76.59 6.82.36 7l11.63 14.49.01.01.01-.01L16.67 16l1.42 1.42 1.91-1.92z"/>
        </svg>
      {:else if $isSyncing || isManualSyncing}
        <svg viewBox="0 0 24 24" fill="currentColor" class="spinning">
          <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
        </svg>
      {:else if $failedOperationsCount > 0}
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
      {:else if $hasPendingOperations}
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
        </svg>
      {/if}
    </div>

    <div class="status-text">
      <div class="primary-text">{$syncStatusMessage}</div>
      {#if showDetails && $lastSyncTime}
        <div class="secondary-text">Last sync: {formatTime($lastSyncTime)}</div>
      {/if}
    </div>

    {#if $queueSize > 0}
      <div class="queue-badge" title="{$queueSize} operations in queue">
        {$queueSize}
      </div>
    {/if}
  </div>

  {#if showActions && ($hasPendingOperations || $failedOperationsCount > 0)}
    <div class="sync-actions">
      {#if $isOnline && !$isSyncing && !isManualSyncing}
        <button 
          class="action-button sync-button" 
          on:click={handleManualSync}
          title="Sync now"
          aria-label="Manually trigger sync"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
        </button>
      {/if}

      {#if $queueSize > 0}
        <button 
          class="action-button clear-button" 
          on:click={handleClearQueue}
          title="Clear queue"
          aria-label="Clear sync queue"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      {/if}
    </div>
  {/if}

  {#if showDetails && $queuedOperations.length > 0}
    <div class="queue-details">
      <div class="queue-header">Pending Operations</div>
      <div class="queue-list">
        {#each $queuedOperations.slice(0, 5) as operation}
          <div class="queue-item" class:failed={operation.retryCount > 0}>
            <div class="operation-type">{operation.type}</div>
            <div class="operation-note">Note: {operation.noteId.slice(0, 8)}...</div>
            <div class="operation-priority priority-{operation.priority}">{operation.priority}</div>
            {#if operation.retryCount > 0}
              <div class="retry-count">Retry {operation.retryCount}/{operation.maxRetries}</div>
            {/if}
          </div>
        {/each}
        {#if $queuedOperations.length > 5}
          <div class="queue-more">
            +{$queuedOperations.length - 5} more operations
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .sync-indicator {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 0.375rem;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    font-size: 0.875rem;
    transition: all 0.2s ease-in-out;
  }

  .sync-indicator--small {
    font-size: 0.75rem;
    padding: 0.375rem;
    gap: 0.25rem;
  }

  .sync-indicator--medium {
    font-size: 0.875rem;
    padding: 0.5rem;
    gap: 0.5rem;
  }

  .sync-indicator--large {
    font-size: 1rem;
    padding: 0.75rem;
    gap: 0.75rem;
  }

  .sync-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .status-icon svg {
    width: 1.25em;
    height: 1.25em;
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .status-text {
    flex: 1;
    min-width: 0;
  }

  .primary-text {
    font-weight: 500;
    line-height: 1.2;
  }

  .secondary-text {
    font-size: 0.75em;
    opacity: 0.7;
    line-height: 1.2;
    margin-top: 0.125rem;
  }

  .queue-badge {
    background: #3b82f6;
    color: white;
    font-size: 0.75em;
    font-weight: 600;
    padding: 0.125rem 0.375rem;
    border-radius: 0.75rem;
    min-width: 1.5rem;
    text-align: center;
    flex-shrink: 0;
  }

  .sync-actions {
    display: flex;
    gap: 0.25rem;
    justify-content: flex-end;
  }

  .action-button {
    background: none;
    border: 1px solid #d1d5db;
    color: #6b7280;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease-in-out;
  }

  .action-button:hover {
    background: #f3f4f6;
    border-color: #9ca3af;
  }

  .action-button:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }

  .action-button svg {
    width: 1em;
    height: 1em;
  }

  .sync-button:hover {
    color: #3b82f6;
    border-color: #3b82f6;
  }

  .clear-button:hover {
    color: #ef4444;
    border-color: #ef4444;
  }

  .queue-details {
    border-top: 1px solid #e5e7eb;
    padding-top: 0.5rem;
  }

  .queue-header {
    font-weight: 600;
    margin-bottom: 0.5rem;
    font-size: 0.875em;
  }

  .queue-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .queue-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem;
    background: #f9fafb;
    border-radius: 0.25rem;
    font-size: 0.75em;
  }

  .queue-item.failed {
    background: #fef2f2;
    border: 1px solid #fecaca;
  }

  .operation-type {
    font-weight: 500;
    text-transform: capitalize;
  }

  .operation-note {
    flex: 1;
    opacity: 0.7;
    font-family: monospace;
  }

  .operation-priority {
    padding: 0.125rem 0.25rem;
    border-radius: 0.125rem;
    font-size: 0.625em;
    font-weight: 600;
    text-transform: uppercase;
  }

  .priority-low { background: #f3f4f6; color: #6b7280; }
  .priority-normal { background: #dbeafe; color: #1d4ed8; }
  .priority-high { background: #fef3c7; color: #92400e; }
  .priority-critical { background: #fecaca; color: #991b1b; }

  .retry-count {
    font-size: 0.625em;
    color: #ef4444;
    font-weight: 500;
  }

  .queue-more {
    text-align: center;
    opacity: 0.7;
    font-style: italic;
    font-size: 0.75em;
  }

  /* Status-specific styles */
  .sync-indicator.synced {
    border-color: #bbf7d0;
    background: #f0fdf4;
    color: #166534;
  }

  .sync-indicator.pending {
    border-color: #fde68a;
    background: #fffbeb;
    color: #92400e;
  }

  .sync-indicator.syncing {
    border-color: #bfdbfe;
    background: #eff6ff;
    color: #1d4ed8;
  }

  .sync-indicator.error {
    border-color: #fecaca;
    background: #fef2f2;
    color: #991b1b;
  }

  .sync-indicator.offline {
    border-color: #d1d5db;
    background: #f9fafb;
    color: #6b7280;
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .sync-indicator {
      background: #1f2937;
      border-color: #374151;
      color: #f3f4f6;
    }

    .sync-indicator.synced {
      background: #064e3b;
      border-color: #065f46;
      color: #a7f3d0;
    }

    .sync-indicator.pending {
      background: #78350f;
      border-color: #92400e;
      color: #fcd34d;
    }

    .sync-indicator.syncing {
      background: #1e3a8a;
      border-color: #1d4ed8;
      color: #bfdbfe;
    }

    .sync-indicator.error {
      background: #7f1d1d;
      border-color: #991b1b;
      color: #fca5a5;
    }

    .sync-indicator.offline {
      background: #374151;
      border-color: #4b5563;
      color: #9ca3af;
    }

    .queue-item {
      background: #374151;
    }

    .queue-item.failed {
      background: #7f1d1d;
      border-color: #991b1b;
    }

    .action-button {
      border-color: #4b5563;
      color: #9ca3af;
    }

    .action-button:hover {
      background: #374151;
      border-color: #6b7280;
    }
  }
</style>