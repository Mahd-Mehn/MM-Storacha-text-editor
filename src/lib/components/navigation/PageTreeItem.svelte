<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Page } from '$lib/types/pages';
  import { pageManager } from '$lib/services';

  export let page: Page;
  export let activePageId: string | null = null;
  export let expandedPages: Set<string>;
  export let depth: number = 0;

  const dispatch = createEventDispatcher();

  // Get child pages reactively
  $: childPages = pageManager.getChildPages(page.id);
  $: hasChildren = childPages.length > 0;
  $: isExpanded = expandedPages.has(page.id);
  $: isActive = activePageId === page.id;

  function toggleExpand(event: MouseEvent) {
    event.stopPropagation();
    dispatch('toggle', { pageId: page.id });
  }

  function selectPage() {
    dispatch('select', { pageId: page.id });
  }

  function createSubpage(event: MouseEvent) {
    event.stopPropagation();
    dispatch('create', { parentId: page.id });
  }

  // Forward events from child items
  function handleChildToggle(event: CustomEvent) {
    dispatch('toggle', event.detail);
  }

  function handleChildSelect(event: CustomEvent) {
    dispatch('select', event.detail);
  }

  function handleChildCreate(event: CustomEvent) {
    dispatch('create', event.detail);
  }
</script>

<div class="page-tree-item">
  <div 
    class="page-row"
    class:active={isActive}
    style="padding-left: calc(0.5rem + {depth * 16}px)"
    on:click={selectPage}
    role="treeitem"
    aria-expanded={hasChildren ? isExpanded : undefined}
    aria-selected={isActive}
    tabindex="0"
    on:keydown={(e) => e.key === 'Enter' && selectPage()}
  >
    <!-- Expand/collapse toggle -->
    {#if hasChildren}
      <button 
        class="toggle-btn"
        on:click={toggleExpand}
        aria-label={isExpanded ? 'Collapse' : 'Expand'}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2"
          class="chevron"
          class:expanded={isExpanded}
        >
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    {:else}
      <span class="toggle-spacer"></span>
    {/if}
    
    <!-- Page icon -->
    <span class="page-icon">
      {page.icon?.value || '📄'}
    </span>
    
    <!-- Page title -->
    <span class="page-title">
      {page.title || 'Untitled'}
    </span>
    
    <!-- Add subpage button (visible on hover) -->
    <button 
      class="add-btn"
      on:click={createSubpage}
      title="Add subpage"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
  </div>
  
  <!-- Render children recursively when expanded -->
  {#if isExpanded && hasChildren}
    <div class="children" role="group">
      {#each childPages as childPage (childPage.id)}
        <svelte:self 
          page={childPage}
          {activePageId}
          {expandedPages}
          depth={depth + 1}
          on:toggle={handleChildToggle}
          on:select={handleChildSelect}
          on:create={handleChildCreate}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .page-tree-item {
    user-select: none;
  }

  .page-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.5rem;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
    border-radius: 0.375rem;
    margin: 1px 0;
    transition: all 0.15s ease;
  }

  .page-row:hover {
    background: #f3f4f6;
  }

  .page-row.active {
    background: #eff6ff;
    color: #1d4ed8;
  }

  .page-row:focus {
    outline: 2px solid #3b82f6;
    outline-offset: -2px;
  }
  
  .page-row:focus:not(:focus-visible) {
    outline: none;
  }

  .toggle-btn {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
    background: transparent;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .toggle-btn:hover {
    color: #4b5563;
    background: #e5e7eb;
  }

  .toggle-spacer {
    width: 1.25rem;
    flex-shrink: 0;
  }

  .chevron {
    transition: transform 0.15s ease;
  }

  .chevron.expanded {
    transform: rotate(90deg);
  }

  .page-icon {
    flex-shrink: 0;
    font-size: 1rem;
    line-height: 1;
  }

  .page-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 450;
  }

  .add-btn {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
    background: transparent;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    opacity: 0;
    transition: all 0.15s;
  }

  .page-row:hover .add-btn {
    opacity: 1;
  }

  .add-btn:hover {
    color: #4b5563;
    background: #e5e7eb;
  }

  .children {
    /* Children are indented via padding-left on page-row */
  }
</style>
