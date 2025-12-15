<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { shareService, pageManager, decodeShareTokenV2, type ShareTokenV2 } from '$lib/services';
  import SharedPageContent from '$lib/components/SharedPageContent.svelte';
  import type { Page, Block } from '$lib/types';

  let loading = $state(true);
  let error = $state<string | null>(null);
  let pageData = $state<Page | null>(null);
  let blocks = $state<Block[]>([]);
  let tokenData = $state<ShareTokenV2 | null>(null);
  let liveSync = $state(false);

  onMount(async () => {
    const code = $page.params.code;
    
    if (!code) {
      error = 'Invalid share link';
      loading = false;
      return;
    }

    try {
      // Resolve short code to full data
      const shortCodeData = shareService.resolveShortCode(code);
      
      if (!shortCodeData) {
        error = 'Share link not found or has expired';
        loading = false;
        return;
      }

      const { token, pageId, cid, liveSync: enableLiveSync } = shortCodeData;
      liveSync = enableLiveSync;

      // Decode and validate the token
      const decoded = decodeShareTokenV2(token);
      if (!decoded) {
        error = 'Invalid share token';
        loading = false;
        return;
      }

      tokenData = decoded;

      // Check expiration
      if (decoded.expiresAt && new Date(decoded.expiresAt) < new Date()) {
        error = 'This share link has expired';
        loading = false;
        return;
      }

      // Load page content from Storacha using the CID
      console.log(`Loading shared page from CID: ${cid}`);
      
      await pageManager.initialize();
      const result = await pageManager.loadFromStoracha(cid);
      
      if (!result) {
        error = 'Failed to load shared content. The content may no longer be available.';
        loading = false;
        return;
      }

      pageData = result.page;
      blocks = result.blocks;
      loading = false;

    } catch (err) {
      console.error('Failed to load shared page:', err);
      error = err instanceof Error ? err.message : 'Failed to load shared content';
      loading = false;
    }
  });

  async function handleRetry() {
    loading = true;
    error = null;
    
    const code = $page.params.code;
    const shortCodeData = shareService.resolveShortCode(code);
    
    if (!shortCodeData) {
      error = 'Share link not found';
      loading = false;
      return;
    }

    try {
      const result = await pageManager.loadFromStoracha(shortCodeData.cid);
      if (result) {
        pageData = result.page;
        blocks = result.blocks;
      } else {
        error = 'Failed to load content';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load content';
    }
    loading = false;
  }
</script>

<svelte:head>
  <title>{pageData?.title || 'Shared Page'} - Storacha Notes</title>
</svelte:head>

<div class="shared-page-container">
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading shared content...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <h2>Unable to Load</h2>
      <p>{error}</p>
      <button class="retry-button" onclick={handleRetry}>
        Try Again
      </button>
    </div>
  {:else if pageData}
    <div class="shared-content">
      <header class="shared-header">
        <div class="header-info">
          <h1>{pageData.title || 'Untitled'}</h1>
          <div class="meta">
            <span class="badge">
              {tokenData?.permission === 'edit' ? '✏️ Editable' : '👁️ View only'}
            </span>
            {#if liveSync}
              <span class="badge live-badge">
                🔴 Live
              </span>
            {/if}
            <span class="shared-via">Shared via Storacha</span>
          </div>
        </div>
      </header>
      
      <main class="shared-body">
        <SharedPageContent {blocks} />
      </main>
    </div>
  {/if}
</div>

<style>
  .shared-page-container {
    min-height: 100vh;
    background: var(--bg-primary, #ffffff);
    color: var(--text-primary, #1a1a1a);
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    text-align: center;
    padding: 2rem;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid var(--border-color, #e5e7eb);
    border-top-color: var(--accent-color, #3b82f6);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .error-state h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
  }

  .error-state p {
    color: var(--text-secondary, #6b7280);
    margin-bottom: 1.5rem;
  }

  .retry-button {
    padding: 0.75rem 1.5rem;
    background: var(--accent-color, #3b82f6);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .retry-button:hover {
    background: var(--accent-hover, #2563eb);
  }

  .shared-content {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }

  .shared-header {
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .shared-header h1 {
    margin: 0 0 0.75rem 0;
    font-size: 2rem;
    font-weight: 700;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.75rem;
    background: var(--bg-secondary, #f3f4f6);
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .live-badge {
    background: #fef2f2;
    color: #dc2626;
  }

  .shared-via {
    color: var(--text-tertiary, #9ca3af);
    font-size: 0.875rem;
  }

  .shared-body {
    line-height: 1.7;
  }
</style>
