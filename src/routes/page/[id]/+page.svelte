<script lang="ts">
  import { page } from "$app/stores";
  import PageEditor from "$lib/components/PageEditor.svelte";
  import { notificationService } from "$lib/services/notification";
  import { shareService } from "$lib/services/share-service";

  // Get page ID from route params using Svelte 5 runes
  let pageId = $derived($page.params.id || "");
  let sharing = $state(false);

  async function sharePage() {
    if (!pageId || sharing) return;
    sharing = true;
    
    try {
      await shareService.initialize();
      const shareLink = await shareService.createPageLink(pageId, 'view');
      
      // Try to copy to clipboard with fallback
      try {
        await navigator.clipboard.writeText(shareLink.url);
        notificationService.success(
          'Share link created!',
          'Link copied to clipboard. Anyone with this link can view this page.'
        );
      } catch (clipboardError) {
        // Fallback: show the URL in notification if clipboard fails
        console.warn('Clipboard write failed, showing URL instead:', clipboardError);
        notificationService.success(
          'Share link created!',
          shareLink.url
        );
      }
    } catch (error) {
      console.error('Failed to create share link:', error);
      const msg = error instanceof Error ? error.message : 'Could not create share link';
      notificationService.error('Sharing failed', msg);
    } finally {
      sharing = false;
    }
  }
</script>

<div class="page-container">
  <div class="page-topbar">
    <div class="page-topbar-right">
      <button 
        class="icon-btn" 
        onclick={sharePage} 
        title={sharing ? 'Creating share link...' : 'Share'} 
        disabled={!pageId || sharing}
      >
        {#if sharing}
          <div class="spinner"></div>
        {:else}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
            <path d="M16 6l-4-4-4 4" />
            <path d="M12 2v14" />
          </svg>
        {/if}
      </button>
    </div>
  </div>

  {#key pageId}
    <PageEditor {pageId} />
  {/key}
</div>

<style>
  .page-container {
    min-height: 100vh;
    background: var(--bg-primary, #ffffff);
  }

  .page-topbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    background: var(--bg-primary, #ffffff);
    min-height: 48px;
  }

  .page-topbar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-color, #e5e7eb);
    border-top-color: var(--accent-color, #3b82f6);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  :global(.dark) .page-container {
    background: var(--bg-primary, #1a1a2e);
  }
</style>
