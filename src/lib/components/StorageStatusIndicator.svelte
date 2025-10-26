<!--
  Storage Status Indicator Component
  Displays local and remote storage status with sync information
  Requirements: 3.1, 3.5 - Storage status display and fallback indication
-->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { hybridStorageService } from '../services/hybrid-storage.js';
  import { isOnline, isOffline } from '../stores/connectivity.js';

  // Component props
  export let showDetails = false;
  export let refreshInterval = 10000; // 10 seconds

  // Component state
  let storageStatus: any = null;
  let storageStats: any = null;
  let isLoading = true;
  let error: string | null = null;
  let refreshTimer: number | null = null;

  onMount(async () => {
    await loadStorageInfo();
    
    // Set up periodic refresh
    if (refreshInterval > 0) {
      refreshTimer = window.setInterval(loadStorageInfo, refreshInterval);
    }
  });

  onDestroy(() => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
  });

  async function loadStorageInfo() {
    try {
      isLoading = true;
      error = null;

      const [status, stats] = await Promise.all([
        hybridStorageService.getStorageStatus(),
        hybridStorageService.getStorageStats()
      ]);

      storageStatus = status;
      storageStats = stats;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load storage info';
      console.error('Failed to load storage info:', err);
    } finally {
      isLoading = false;
    }
  }

  async function handleSyncNow() {
    if (!$isOnline || !storageStatus?.remote.available) {
      return;
    }

    try {
      const result = await hybridStorageService.syncUnsyncedNotes();
      await loadStorageInfo(); // Refresh after sync
      
      if (result.synced > 0) {
        console.log(`Successfully synced ${result.synced} notes`);
      }
      if (result.failed > 0) {
        console.warn(`Failed to sync ${result.failed} notes`);
      }
    } catch (err) {
      console.error('Manual sync failed:', err);
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function getStorageStatusClass(): string {
    if (isLoading || error) return 'unknown';
    if (!storageStatus) return 'unknown';
    
    if (storageStatus.remote.available && storageStatus.remote.connected) {
      return storageStatus.sync.failed > 0 ? 'warning' : 'good';
    }
    
    if (storageStatus.local.available) {
      return 'local-only';
    }
    
    return 'error';
  }

  function getStatusMessage(): string {
    if (isLoading) return 'Loading...';
    if (error) return 'Error loading status';
    if (!storageStatus) return 'Unknown';
    
    if (storageStatus.remote.available && storageStatus.remote.connected) {
      if (storageStatus.sync.pending === 0) {
        return 'All data synced';
      }
      return `${storageStatus.sync.pending} pending sync`;
    }
    
    if (storageStatus.local.available) {
      return 'Local storage only';
    }
    
    return 'Storage unavailable';
  }

  $: statusClass = getStorageStatusClass();
  $: statusMessage = getStatusMessage();
</script>

<div class="storage-indicator {statusClass}">
  <div class="storage-status">
    <div class="status-icon" aria-hidden="true">
      {#if isLoading}
        <svg viewBox="0 0 24 24" fill="currentColor" class="spinning">
          <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
        </svg>
      {:else if error}
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
      {:else if statusClass === 'good'}
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
        </svg>
      {:else if statusClass === 'local-only'}
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      {:else if statusClass === 'warning'}
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
      {/if}
    </div>

    <div class="status-text">
      <div class="primary-text">{statusMessage}</div>
      {#if showDetails && storageStats}
        <div class="secondary-text">
          {storageStats.totalNotes} notes • {formatBytes(storageStats.localSize)}
        </div>
      {/if}
    </div>

    {#if storageStatus?.sync.pending > 0}
      <div class="sync-badge" title="{storageStatus.sync.pending} operations pending sync">
        {storageStatus.sync.pending}
      </div>
    {/if}
  </div>

  {#if showDetails && storageStatus}
    <div class="storage-details">
      <div class="storage-section">
        <div class="section-header">Local Storage</div>
        <div class="section-content">
          <div class="storage-item">
            <span class="item-label">Status:</span>
            <span class="item-value" class:available={storageStatus.local.available}>
              {storageStatus.local.available ? 'Available' : 'Unavailable'}
            </span>
          </div>
          <div class="storage-item">
            <span class="item-label">Size:</span>
            <span class="item-value">{formatBytes(storageStatus.local.size)}</span>
          </div>
        </div>
      </div>

      <div class="storage-section">
        <div class="section-header">Remote Storage</div>
        <div class="section-content">
          <div class="storage-item">
            <span class="item-label">Status:</span>
            <span class="item-value" class:available={storageStatus.remote.available}>
              {storageStatus.remote.available ? 'Available' : 'Unavailable'}
            </span>
          </div>
          <div class="storage-item">
            <span class="item-label">Connection:</span>
            <span class="item-value" class:available={storageStatus.remote.connected}>
              {storageStatus.remote.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {#if storageStats}
        <div class="storage-section">
          <div class="section-header">Sync Status</div>
          <div class="section-content">
            <div class="storage-item">
              <span class="item-label">Synced:</span>
              <span class="item-value">{storageStats.syncedNotes} notes</span>
            </div>
            <div class="storage-item">
              <span class="item-label">Pending:</span>
              <span class="item-value">{storageStats.unsyncedNotes} notes</span>
            </div>
            {#if storageStatus.sync.failed > 0}
              <div class="storage-item">
                <span class="item-label">Failed:</span>
                <span class="item-value error">{storageStatus.sync.failed} notes</span>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if $isOnline && storageStatus.remote.available && storageStatus.sync.pending > 0}
        <div class="storage-actions">
          <button class="sync-button" on:click={handleSyncNow}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            Sync Now
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .storage-indicator {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    font-size: 0.875rem;
    transition: all 0.2s ease-in-out;
  }

  .storage-status {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .status-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .status-icon svg {
    width: 1.5rem;
    height: 1.5rem;
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
    font-weight: 600;
    line-height: 1.3;
  }

  .secondary-text {
    font-size: 0.75rem;
    opacity: 0.7;
    line-height: 1.3;
    margin-top: 0.25rem;
  }

  .sync-badge {
    background: #3b82f6;
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 1rem;
    min-width: 1.5rem;
    text-align: center;
    flex-shrink: 0;
  }

  .storage-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #e5e7eb;
  }

  .storage-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-header {
    font-weight: 600;
    font-size: 0.8125rem;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .section-content {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .storage-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8125rem;
  }

  .item-label {
    color: #6b7280;
  }

  .item-value {
    font-weight: 500;
    color: #374151;
  }

  .item-value.available {
    color: #059669;
  }

  .item-value.error {
    color: #dc2626;
  }

  .storage-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: 0.5rem;
  }

  .sync-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease-in-out;
  }

  .sync-button:hover {
    background: #2563eb;
  }

  .sync-button:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }

  .sync-button svg {
    width: 1rem;
    height: 1rem;
  }

  /* Status-specific styles */
  .storage-indicator.good {
    border-color: #bbf7d0;
    background: #f0fdf4;
    color: #166534;
  }

  .storage-indicator.local-only {
    border-color: #fde68a;
    background: #fffbeb;
    color: #92400e;
  }

  .storage-indicator.warning {
    border-color: #fed7aa;
    background: #fff7ed;
    color: #c2410c;
  }

  .storage-indicator.error {
    border-color: #fecaca;
    background: #fef2f2;
    color: #991b1b;
  }

  .storage-indicator.unknown {
    border-color: #d1d5db;
    background: #f9fafb;
    color: #6b7280;
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .storage-indicator {
      background: #1f2937;
      border-color: #374151;
      color: #f3f4f6;
    }

    .storage-indicator.good {
      background: #064e3b;
      border-color: #065f46;
      color: #a7f3d0;
    }

    .storage-indicator.local-only {
      background: #78350f;
      border-color: #92400e;
      color: #fcd34d;
    }

    .storage-indicator.warning {
      background: #9a3412;
      border-color: #c2410c;
      color: #fed7aa;
    }

    .storage-indicator.error {
      background: #7f1d1d;
      border-color: #991b1b;
      color: #fca5a5;
    }

    .storage-indicator.unknown {
      background: #374151;
      border-color: #4b5563;
      color: #9ca3af;
    }

    .section-header {
      color: #d1d5db;
    }

    .item-label {
      color: #9ca3af;
    }

    .item-value {
      color: #f3f4f6;
    }

    .storage-details {
      border-top-color: #374151;
    }
  }
</style>