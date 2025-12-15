<script lang="ts">
  import { onMount } from 'svelte';
  import type { Block } from '$lib/types/blocks';
  import { blockManager } from '$lib/services/block-manager';

  // Accept either blocks directly OR pageId to look them up
  let { blocks: providedBlocks, pageId } = $props<{ 
    blocks?: Block[];
    pageId?: string;
  }>();

  let internalBlocks = $state<Block[]>([]);
  let loading = $state(true);

  // Use provided blocks if available, otherwise look them up
  let displayBlocks = $derived(providedBlocks ?? internalBlocks);

  onMount(async () => {
    if (providedBlocks && providedBlocks.length > 0) {
      // Blocks provided directly, no need to look up
      loading = false;
      return;
    }
    
    if (pageId) {
      await blockManager.initialize();
      internalBlocks = blockManager.getPageBlocks(pageId);
    }
    loading = false;
  });

  $effect(() => {
    if (pageId && !loading && !providedBlocks) {
      internalBlocks = blockManager.getPageBlocks(pageId);
    }
  });

  function getTextContent(block: Block): string {
    return block.properties.textContent?.map((s: any) => s.text).join('') || '';
  }
</script>

<div class="shared-content">
  {#if loading}
    <p class="loading-state">Loading content...</p>
  {:else if displayBlocks.length === 0}
    <p class="empty-state">This page is empty.</p>
  {:else}
    {#each displayBlocks as block (block.id)}
      <div class="block block-{block.type}">
        {#if block.type === 'heading'}
          {#if block.properties.level === 1}
            <h1>{getTextContent(block)}</h1>
          {:else if block.properties.level === 2}
            <h2>{getTextContent(block)}</h2>
          {:else}
            <h3>{getTextContent(block)}</h3>
          {/if}
        {:else if block.type === 'paragraph'}
          <p>{getTextContent(block)}</p>
        {:else if block.type === 'bulletList'}
          <ul><li>{getTextContent(block)}</li></ul>
        {:else if block.type === 'numberedList'}
          <ol><li>{getTextContent(block)}</li></ol>
        {:else if block.type === 'todo'}
          <div class="todo-item">
            <input type="checkbox" checked={block.properties.checked} disabled />
            <span class:completed={block.properties.checked}>{getTextContent(block)}</span>
          </div>
        {:else if block.type === 'quote'}
          <blockquote>{getTextContent(block)}</blockquote>
        {:else if block.type === 'callout'}
          <div class="callout">
            <span class="callout-icon">{block.properties.icon || '💡'}</span>
            <span>{getTextContent(block)}</span>
          </div>
        {:else if block.type === 'code'}
          <pre><code>{getTextContent(block)}</code></pre>
        {:else if block.type === 'divider'}
          <hr />
        {:else if block.type === 'toggle'}
          <details>
            <summary>{getTextContent(block)}</summary>
            <!-- Child blocks would go here -->
          </details>
        {:else}
          <p>{getTextContent(block)}</p>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .shared-content {
    font-size: 1rem;
    line-height: 1.6;
    color: var(--text-primary, #1a1a1a);
  }

  .loading-state {
    color: var(--text-tertiary, #9ca3af);
    font-style: italic;
  }

  .empty-state {
    color: var(--text-tertiary, #9ca3af);
    font-style: italic;
  }

  .block {
    margin-bottom: 0.75rem;
  }

  h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 1.5rem 0 0.75rem;
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 1.25rem 0 0.5rem;
  }

  h3 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 1rem 0 0.5rem;
  }

  p {
    margin: 0;
  }

  ul, ol {
    margin: 0;
    padding-left: 1.5rem;
  }

  li {
    margin-bottom: 0.25rem;
  }

  blockquote {
    margin: 0;
    padding: 0.5rem 1rem;
    border-left: 3px solid var(--accent-color, #3b82f6);
    background: var(--bg-secondary, #f9fafb);
    color: var(--text-secondary, #4b5563);
    font-style: italic;
  }

  .callout {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary, #f9fafb);
    border-radius: 0.5rem;
    border: 1px solid var(--border-color, #e5e7eb);
  }

  .callout-icon {
    font-size: 1.25rem;
  }

  pre {
    margin: 0;
    padding: 1rem;
    background: var(--bg-tertiary, #1f2937);
    color: var(--text-inverse, #f9fafb);
    border-radius: 0.5rem;
    overflow-x: auto;
    font-family: 'Fira Code', 'Monaco', monospace;
    font-size: 0.875rem;
  }

  code {
    font-family: inherit;
  }

  hr {
    border: none;
    border-top: 1px solid var(--border-color, #e5e7eb);
    margin: 1.5rem 0;
  }

  .todo-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .todo-item input {
    width: 1rem;
    height: 1rem;
    cursor: not-allowed;
  }

  .todo-item .completed {
    text-decoration: line-through;
    color: var(--text-tertiary, #9ca3af);
  }

  details {
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
  }

  summary {
    cursor: pointer;
    font-weight: 500;
  }
</style>
