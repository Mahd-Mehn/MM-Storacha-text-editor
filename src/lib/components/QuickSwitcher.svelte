<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { workspaceStore } from "$lib/stores/workspace";

  export let onClose: () => void;

  let searchQuery = "";
  let selectedIndex = 0;
  let results: any[] = [];
  let inputElement: HTMLInputElement;

  // Get all pages from workspace
  $: allPages = flattenPages($workspaceStore.pages);

  // Filter results based on search query
  $: results = searchQuery
    ? allPages.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allPages.slice(0, 10); // Show recent pages

  // Reset selected index when results change
  $: if (results) {
    selectedIndex = Math.min(selectedIndex, Math.max(0, results.length - 1));
  }

  function flattenPages(pages: any[]): any[] {
    const flat: any[] = [];
    function traverse(pages: any[]) {
      for (const page of pages) {
        flat.push(page);
        if (page.children && page.children.length > 0) {
          traverse(page.children);
        }
      }
    }
    traverse(pages);
    return flat;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (e.key === "Enter" && results[selectedIndex]) {
      navigateToPage(results[selectedIndex]);
    }
  }

  function navigateToPage(page: any) {
    goto(`/page/${page.id}`);
    onClose();
  }

  onMount(() => {
    inputElement?.focus();
    document.addEventListener("keydown", handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener("keydown", handleKeydown);
  });
</script>

<div
  class="modal-overlay"
  on:click={onClose}
  on:keydown={(e) => e.key === "Escape" && onClose()}
  role="button"
  tabindex="0"
  aria-label="Close quick switcher"
>
  <div
    class="quick-switcher"
    on:click|stopPropagation
    on:keydown|stopPropagation
    role="dialog"
    aria-modal="true"
    aria-labelledby="quick-switcher-title"
  >
    <div class="search-header">
      <svg
        class="search-icon"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
      >
        <circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.5" />
        <path
          d="M14 14l4 4"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
      <input
        bind:this={inputElement}
        type="text"
        class="search-input"
        placeholder="Search pages..."
        bind:value={searchQuery}
      />
      <kbd class="shortcut">ESC</kbd>
    </div>

    <div class="results">
      {#if results.length > 0}
        {#each results as result, i}
          <button
            class="result-item"
            class:selected={i === selectedIndex}
            on:click={() => navigateToPage(result)}
          >
            <span class="result-icon">{result.icon}</span>
            <div class="result-content">
              <span class="result-title">{result.title}</span>
              {#if result.parentId}
                <span class="result-path">in Workspace</span>
              {/if}
            </div>
          </button>
        {/each}
      {:else}
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle
              cx="24"
              cy="24"
              r="20"
              stroke="currentColor"
              stroke-width="2"
              opacity="0.2"
            />
            <path
              d="M24 16v16M16 24h16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              opacity="0.2"
            />
          </svg>
          <p>No pages found</p>
        </div>
      {/if}
    </div>

    <div class="footer">
      <div class="hint">
        <kbd>↑</kbd><kbd>↓</kbd> Navigate
      </div>
      <div class="hint">
        <kbd>↵</kbd> Open
      </div>
      <div class="hint">
        <kbd>ESC</kbd> Close
      </div>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
    z-index: 1000;
    animation: fadeIn 0.2s;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .quick-switcher {
    width: 100%;
    max-width: 600px;
    background: var(--bg-primary);
    border-radius: 0.75rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    animation: slideDown 0.2s;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .search-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .search-icon {
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 1rem;
    color: var(--text-primary);
    outline: none;
  }

  .search-input::placeholder {
    color: var(--text-tertiary);
  }

  .shortcut {
    padding: 0.25rem 0.5rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-family: monospace;
  }

  .results {
    max-height: 400px;
    overflow-y: auto;
  }

  .result-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.5rem;
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s;
  }

  .result-item:hover,
  .result-item.selected {
    background: var(--bg-hover);
  }

  .result-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .result-content {
    flex: 1;
    min-width: 0;
  }

  .result-title {
    display: block;
    font-size: 0.875rem;
    color: var(--text-primary);
    font-weight: 500;
  }

  .result-path {
    display: block;
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: 0.125rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.5rem;
    color: var(--text-tertiary);
  }

  .empty-state svg {
    margin-bottom: 1rem;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
  }

  .footer {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 0.75rem 1.5rem;
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .hint {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .hint kbd {
    padding: 0.125rem 0.375rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    font-family: monospace;
    font-size: 0.6875rem;
  }
</style>
