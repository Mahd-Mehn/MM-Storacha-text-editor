<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import PageEditor from '$lib/components/PageEditor.svelte';
  
  let pageId = $state<string>('');
  
  onMount(async () => {
    // Check URL for pageId
    const id = $page.url.searchParams.get('pageId');
    if (id) {
      pageId = id;
    }
  });

  // Reactive effect to update pageId when URL changes
  $effect(() => {
    const id = $page.url.searchParams.get('pageId');
    if (id && id !== pageId) {
      pageId = id;
    }
  });
</script>

<svelte:head>
  <title>Storacha Notes</title>
  <meta name="description" content="Decentralized note-taking app" />
</svelte:head>

{#if pageId}
  {#key pageId}
    <PageEditor {pageId} />
  {/key}
{:else}
  <div class="empty-state">
    <div class="empty-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14,2 14,8 20,8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10,9 9,9 8,9"></polyline>
      </svg>
    </div>
    <h2 class="empty-title">Welcome to Storacha Notes</h2>
    <p class="empty-text">Select a page from the sidebar or create a new one to get started</p>
  </div>
{/if}

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 400px;
    text-align: center;
    padding: 2rem;
    background: white;
  }

  .empty-icon {
    width: 5rem;
    height: 5rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
    border-radius: 1.25rem;
    color: #667eea;
  }

  .empty-icon svg {
    width: 2.5rem;
    height: 2.5rem;
  }

  .empty-title {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
  }

  .empty-text {
    margin: 0;
    color: #6b7280;
    font-size: 1rem;
    max-width: 300px;
  }
</style>
