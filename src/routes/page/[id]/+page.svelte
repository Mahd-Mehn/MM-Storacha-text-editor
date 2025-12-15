<script lang="ts">
  import { page } from "$app/stores";
  import PageEditor from "$lib/components/PageEditor.svelte";
  import { notificationService } from "$lib/services/notification";
  import { shareService } from "$lib/services/share-service";
  import { blockManager, pageManager } from "$lib/services";

  // Get page ID from route params using Svelte 5 runes
  let pageId = $derived($page.params.id || "");
  let sharing = $state(false);
  let showShareDialog = $state(false);
  let liveSync = $state(false);
  let generatedUrl = $state<string | null>(null);
  
  // Cloud sync status
  let syncStatus = $state<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  let lastSyncTime = $state<Date | null>(null);

  // Manually trigger sync
  async function triggerCloudSync() {
    if (!pageId || syncStatus === 'syncing') return;
    
    syncStatus = 'syncing';
    try {
      await pageManager.initialize();
      const cid = await pageManager.syncToStoracha(pageId);
      if (cid) {
        syncStatus = 'synced';
        lastSyncTime = new Date();
        notificationService.success('Synced!', 'Page synced to Storacha cloud.');
      } else {
        syncStatus = 'error';
        notificationService.error('Sync failed', 'Could not sync to cloud. Check your connection.');
      }
    } catch (error) {
      syncStatus = 'error';
      console.error('Manual sync failed:', error);
      notificationService.error('Sync failed', 'An error occurred while syncing.');
    }
  }

  function openShareDialog() {
    showShareDialog = true;
    generatedUrl = null;
  }

  function closeShareDialog() {
    showShareDialog = false;
    generatedUrl = null;
    liveSync = false;
  }

  async function createShareLink() {
    if (!pageId || sharing) return;
    sharing = true;
    
    try {
      await shareService.initialize();
      const shareLink = await shareService.createPageLink(pageId, 'view', {
        liveSync
      });
      
      generatedUrl = shareLink.url;
      
      // Try to copy to clipboard
      try {
        await navigator.clipboard.writeText(shareLink.url);
        notificationService.success(
          'Link copied!',
          liveSync 
            ? 'Live sync enabled - viewers will see your changes in real-time.'
            : 'Anyone with this link can view this page.'
        );
      } catch (clipboardError) {
        console.warn('Clipboard write failed:', clipboardError);
        notificationService.info('Link created', 'Click the link to copy it manually.');
      }
    } catch (error) {
      console.error('Failed to create share link:', error);
      const msg = error instanceof Error ? error.message : 'Could not create share link';
      notificationService.error('Sharing failed', msg);
    } finally {
      sharing = false;
    }
  }

  async function copyToClipboard() {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      notificationService.success('Copied!', 'Link copied to clipboard.');
    } catch {
      notificationService.info('Copy manually', generatedUrl);
    }
  }
</script>

<div class="page-container">
  <div class="page-topbar">
    <div class="page-topbar-left">
      <!-- Auto-sync indicator -->
      <div class="sync-indicator" title={syncStatus === 'synced' && lastSyncTime ? `Last synced: ${lastSyncTime.toLocaleTimeString()}` : 'Auto-sync enabled'}>
        {#if syncStatus === 'syncing'}
          <div class="sync-spinner"></div>
          <span class="sync-text">Syncing...</span>
        {:else if syncStatus === 'synced'}
          <svg class="sync-icon synced" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span class="sync-text">Synced</span>
        {:else if syncStatus === 'error'}
          <svg class="sync-icon error" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span class="sync-text">Sync error</span>
        {:else}
          <svg class="sync-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 0 0-9-9M3 12a9 9 0 0 0 9 9" />
            <path d="M21 3v9h-9M3 21v-9h9" />
          </svg>
          <span class="sync-text">Auto-sync</span>
        {/if}
      </div>
    </div>
    <div class="page-topbar-right">
      <!-- Manual sync button -->
      <button 
        class="icon-btn" 
        onclick={triggerCloudSync} 
        title="Sync to cloud now" 
        disabled={!pageId || syncStatus === 'syncing'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={syncStatus === 'syncing' ? 'spin' : ''}>
          <path d="M21 12a9 9 0 0 0-9-9M3 12a9 9 0 0 0 9 9" />
          <path d="M21 3v9h-9M3 21v-9h9" />
        </svg>
      </button>
      <button 
        class="icon-btn" 
        onclick={openShareDialog} 
        title="Share" 
        disabled={!pageId}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
          <path d="M16 6l-4-4-4 4" />
          <path d="M12 2v14" />
        </svg>
      </button>
    </div>
  </div>

  {#key pageId}
    <PageEditor {pageId} />
  {/key}
</div>

<!-- Share Dialog -->
{#if showShareDialog}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dialog-overlay" onclick={closeShareDialog}>
    <div class="dialog" onclick={(e) => e.stopPropagation()}>
      <header class="dialog-header">
        <h2>Share Page</h2>
        <button class="close-btn" onclick={closeShareDialog}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </header>
      
      <div class="dialog-body">
        {#if !generatedUrl}
          <p class="dialog-description">
            Create a shareable link for this page. The content will be synced to Storacha and accessible via IPFS.
          </p>
          
          <label class="toggle-row">
            <span class="toggle-label">
              <strong>Live Sync</strong>
              <small>Viewers see your edits in real-time (requires both parties online)</small>
            </span>
            <input type="checkbox" bind:checked={liveSync} class="toggle-input" />
            <span class="toggle-switch"></span>
          </label>

          <button 
            class="create-link-btn" 
            onclick={createShareLink}
            disabled={sharing}
          >
            {#if sharing}
              <span class="spinner-small"></span>
              Creating link...
            {:else}
              Create Share Link
            {/if}
          </button>
        {:else}
          <p class="dialog-description success">
            ✓ Share link created! {liveSync ? 'Live sync is enabled.' : ''}
          </p>
          
          <div class="url-box">
            <input type="text" readonly value={generatedUrl} class="url-input" />
            <button class="copy-btn" onclick={copyToClipboard}>
              Copy
            </button>
          </div>
          
          <button class="create-another-btn" onclick={() => generatedUrl = null}>
            Create Another Link
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .page-container {
    min-height: 100vh;
    background: var(--bg-primary, #ffffff);
  }

  .page-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    background: var(--bg-primary, #ffffff);
    min-height: 48px;
  }

  .page-topbar-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .page-topbar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* Sync indicator styles */
  .sync-indicator {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    background: var(--bg-secondary, #f3f4f6);
    border-radius: 9999px;
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
  }

  .sync-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--border-color, #e5e7eb);
    border-top-color: var(--accent-color, #3b82f6);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .sync-icon {
    flex-shrink: 0;
  }

  .sync-icon.synced {
    color: var(--success-color, #10b981);
  }

  .sync-icon.error {
    color: var(--error-color, #ef4444);
  }

  .sync-text {
    white-space: nowrap;
  }

  .icon-btn .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: var(--text-tertiary, #6b7280);
    cursor: pointer;
    border-radius: 0.375rem;
    transition: all 0.15s;
  }

  .icon-btn:hover {
    background: var(--bg-secondary, #f3f4f6);
    color: var(--text-primary, #1a1a1a);
  }

  .icon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Dialog styles */
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .dialog {
    background: var(--bg-primary, #ffffff);
    border-radius: 12px;
    width: 100%;
    max-width: 420px;
    margin: 1rem;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    animation: slideUp 0.2s ease-out;
  }

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .dialog-header h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: var(--text-tertiary, #6b7280);
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: var(--bg-secondary, #f3f4f6);
    color: var(--text-primary, #1a1a1a);
  }

  .dialog-body {
    padding: 1.25rem;
  }

  .dialog-description {
    margin: 0 0 1.25rem 0;
    color: var(--text-secondary, #6b7280);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .dialog-description.success {
    color: var(--success-color, #10b981);
    font-weight: 500;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background: var(--bg-secondary, #f9fafb);
    border-radius: 8px;
    margin-bottom: 1.25rem;
    cursor: pointer;
  }

  .toggle-label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .toggle-label small {
    color: var(--text-tertiary, #9ca3af);
    font-size: 0.8rem;
  }

  .toggle-input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .toggle-switch {
    position: relative;
    width: 44px;
    height: 24px;
    background: var(--border-color, #d1d5db);
    border-radius: 12px;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .toggle-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .toggle-input:checked + .toggle-switch {
    background: var(--accent-color, #3b82f6);
  }

  .toggle-input:checked + .toggle-switch::after {
    transform: translateX(20px);
  }

  .create-link-btn {
    width: 100%;
    padding: 0.875rem 1rem;
    background: var(--accent-color, #3b82f6);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: background 0.2s;
  }

  .create-link-btn:hover:not(:disabled) {
    background: var(--accent-hover, #2563eb);
  }

  .create-link-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .url-box {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .url-input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 8px;
    font-family: monospace;
    font-size: 0.85rem;
    background: var(--bg-secondary, #f9fafb);
    color: var(--text-primary, #1a1a1a);
  }

  .copy-btn {
    padding: 0.75rem 1rem;
    background: var(--accent-color, #3b82f6);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .copy-btn:hover {
    background: var(--accent-hover, #2563eb);
  }

  .create-another-btn {
    width: 100%;
    padding: 0.75rem 1rem;
    background: transparent;
    color: var(--text-secondary, #6b7280);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 8px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .create-another-btn:hover {
    background: var(--bg-secondary, #f9fafb);
    border-color: var(--text-tertiary, #9ca3af);
  }

  :global(.dark) .page-container {
    background: var(--bg-primary, #1a1a2e);
  }

  :global(.dark) .dialog {
    background: var(--bg-primary, #1a1a2e);
  }
</style>
