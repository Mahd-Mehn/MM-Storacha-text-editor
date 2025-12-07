<script lang="ts">
  import { onMount } from 'svelte';
  import type { Page, Workspace } from '$lib/types/pages';
  import { pageManager } from '$lib/services';
  import PageTreeItem from './PageTreeItem.svelte';

  let { 
    pages = [],
    selectedPageId = null,
    onpageselect,
    oncreatepage
  }: {
    pages?: Page[];
    selectedPageId?: string | null;
    onpageselect?: (event: CustomEvent<{ pageId: string }>) => void;
    oncreatepage?: (event: CustomEvent<{ parentId?: string }>) => void;
  } = $props();
  
  let rootPages = $state<Page[]>([]);
  let expandedPages = $state<Set<string>>(new Set());
  const WORKSPACE_ID = 'default-workspace';

  onMount(async () => {
    await pageManager.initialize();
    loadPages();
  });

  // Sync with external pages prop
  $effect(() => {
    if (pages && pages.length > 0) {
      rootPages = pages.filter(p => !p.parentId);
    } else {
      loadPages();
    }
  });

  function loadPages() {
    rootPages = pageManager.getRootPages(WORKSPACE_ID);
  }

  function handleToggle(event: CustomEvent<{ pageId: string }>) {
    const { pageId } = event.detail;
    const newSet = new Set(expandedPages);
    if (newSet.has(pageId)) {
      newSet.delete(pageId);
    } else {
      newSet.add(pageId);
    }
    expandedPages = newSet;
  }

  function handleSelect(event: CustomEvent<{ pageId: string }>) {
    onpageselect?.(event);
  }

  function handleCreate(event: CustomEvent<{ parentId: string | null }>) {
    const parentId = event.detail?.parentId || undefined;
    oncreatepage?.(new CustomEvent('createpage', { detail: { parentId } }));
    
    if (parentId) {
      const newSet = new Set(expandedPages);
      newSet.add(parentId);
      expandedPages = newSet;
    }
    
    loadPages();
  }

  function createRootPage() {
    oncreatepage?.(new CustomEvent('createpage', { detail: {} }));
    loadPages();
  }
</script>

<aside class="sidebar">
  <!-- User/Workspace Switcher -->
  <div class="workspace-switcher">
    <div class="workspace-info">
      <div class="workspace-avatar">M</div>
      <span class="workspace-name">My Workspace</span>
      <span class="workspace-dropdown">▼</span>
    </div>
  </div>

  <!-- Navigation Tree -->
  <div class="nav-tree">
    <!-- Favorites Section -->
    <div class="nav-section">
      <div class="section-header">Favorites</div>
      <div class="section-empty">No favorites yet</div>
    </div>

    <!-- Pages Section -->
    <div class="nav-section">
      <div class="section-header with-action">
        <span>Private</span>
        <button 
          class="add-page-btn"
          onclick={createRootPage}
          title="Add a page"
          aria-label="Add a page"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
      </div>
      
      <div class="page-tree" role="tree">
        {#each rootPages as page (page.id)}
          <PageTreeItem 
            {page}
            activePageId={selectedPageId}
            {expandedPages}
            depth={0}
            on:toggle={handleToggle}
            on:select={handleSelect}
            on:create={handleCreate}
          />
        {/each}
        
        {#if rootPages.length === 0}
          <div class="section-empty">
            No pages yet. Click + to create one.
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Bottom Actions -->
  <div class="bottom-actions">
    <button class="action-btn" onclick={createRootPage}>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      New Page
    </button>
    <button class="action-btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      Search
    </button>
    <button class="action-btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
      Settings
    </button>
  </div>
</aside>

<style>
  .sidebar {
    width: 260px;
    height: 100%;
    background: #f9fafb;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .workspace-switcher {
    padding: 0.75rem;
    border-bottom: 1px solid #f3f4f6;
    cursor: pointer;
    transition: background 0.2s;
  }

  .workspace-switcher:hover {
    background: #f3f4f6;
  }

  .workspace-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .workspace-avatar {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.25rem;
    background: #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .workspace-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .workspace-dropdown {
    color: #9ca3af;
    font-size: 0.75rem;
  }

  .nav-tree {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 0;
  }

  .nav-section {
    margin-bottom: 1rem;
  }

  .section-header {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-header.with-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .add-page-btn {
    opacity: 0;
    background: transparent;
    border: none;
    padding: 0.125rem;
    border-radius: 0.25rem;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.2s;
  }

  .section-header.with-action:hover .add-page-btn {
    opacity: 1;
  }

  .add-page-btn:hover {
    background: #e5e7eb;
  }

  .section-empty {
    padding: 0.25rem 0.75rem;
    font-size: 0.875rem;
    color: #9ca3af;
    font-style: italic;
  }

  .page-tree {
    margin-top: 0.25rem;
    padding: 0 0.25rem;
  }

  .bottom-actions {
    padding: 0.5rem;
    border-top: 1px solid #e5e7eb;
  }

  .action-btn {
    width: 100%;
    text-align: left;
    padding: 0.375rem 0.5rem;
    font-size: 0.875rem;
    color: #4b5563;
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: background 0.2s;
  }

  .action-btn:hover {
    background: #f3f4f6;
  }
</style>