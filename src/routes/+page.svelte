<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import PageEditor from "$lib/components/PageEditor.svelte";
  import Sidebar from "$lib/components/navigation/Sidebar.svelte";
  import { pageManager } from "$lib/services/page-manager";
  import { blockManager } from "$lib/services/block-manager";
  import { notificationService } from "$lib/services/notification";
  import { errorHandler } from "$lib/services/error-handler";

  // State
  let isLoading = $state(true);
  let showSidebar = $state(true);
  let currentPageId = $state<string | null>(null);
  let pages = $state<any[]>([]);

  onMount(async () => {
    await initializeApp();
  });

  // Watch for pageId changes in URL
  $effect(() => {
    const pageIdParam = $page.url.searchParams.get("pageId");
    if (pageIdParam && pageIdParam !== currentPageId) {
      currentPageId = pageIdParam;
    }
  });

  async function initializeApp() {
    try {
      isLoading = true;
      
      // Initialize services
      await pageManager.initialize();
      await blockManager.initialize();
      
      // Load all pages
      pages = pageManager.getAllPages();
      
      // Check for pageId in URL
      const pageIdParam = $page.url.searchParams.get("pageId");
      
      if (pageIdParam) {
        const existingPage = pageManager.getPage(pageIdParam);
        if (existingPage) {
          currentPageId = pageIdParam;
        } else {
          notificationService.error("Page not found", "The requested page does not exist");
          await createDefaultPage();
        }
      } else if (pages.length > 0) {
        // Load the first page
        currentPageId = pages[0].id;
        goto(`/?pageId=${currentPageId}`, { replaceState: true });
      } else {
        // Create a default page
        await createDefaultPage();
      }
    } catch (error) {
      await errorHandler.handleError(
        error instanceof Error ? error : new Error("Failed to initialize app")
      );
      notificationService.error("Failed to initialize", "Please refresh the page");
    } finally {
      isLoading = false;
    }
  }

  async function createDefaultPage() {
    const newPage = pageManager.createPage({
      title: "Getting Started",
      icon: { type: "emoji", value: "🚀" },
      workspaceId: "default"
    });
    
    // Create a welcome block
    blockManager.createBlock({
      type: "heading1",
      pageId: newPage.id,
      properties: { 
        textContent: [{ text: "Welcome to Storacha Notes" }],
        level: 1
      }
    });
    
    blockManager.createBlock({
      type: "paragraph",
      pageId: newPage.id,
      properties: { 
        textContent: [{ text: "Start typing below. Use / to insert different block types." }]
      }
    });
    
    blockManager.createBlock({
      type: "paragraph",
      pageId: newPage.id,
      properties: { textContent: [] }
    });
    
    pages = pageManager.getAllPages();
    currentPageId = newPage.id;
    goto(`/?pageId=${currentPageId}`, { replaceState: true });
  }

  function handlePageSelect(event: CustomEvent<{ pageId: string }>) {
    currentPageId = event.detail.pageId;
    goto(`/?pageId=${currentPageId}`, { replaceState: true });
  }

  function handleCreatePage(event: CustomEvent<{ parentId?: string }>) {
    const newPage = pageManager.createPage({
      title: "Untitled",
      parentId: event.detail?.parentId || null,
      workspaceId: "default"
    });
    
    // Create initial empty block
    blockManager.createBlock({
      type: "paragraph",
      pageId: newPage.id,
      properties: { textContent: [] }
    });
    
    pages = pageManager.getAllPages();
    currentPageId = newPage.id;
    goto(`/?pageId=${currentPageId}`, { replaceState: true });
  }

  function toggleSidebar() {
    showSidebar = !showSidebar;
  }
</script>

<div class="app-layout">
  <!-- Sidebar -->
  {#if showSidebar}
    <aside class="sidebar">
      <Sidebar 
        {pages}
        selectedPageId={currentPageId}
        onpageselect={handlePageSelect}
        oncreatepage={handleCreatePage}
      />
    </aside>
  {/if}

  <!-- Main Content -->
  <div class="main-content" class:sidebar-collapsed={!showSidebar}>
    <!-- Top Bar -->
    <nav class="top-bar">
      <div class="top-bar-left">
        <button 
          class="icon-btn" 
          onclick={toggleSidebar}
          title={showSidebar ? "Hide sidebar" : "Show sidebar"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12h18M3 6h18M3 18h18"/>
          </svg>
        </button>
      </div>
      
      <div class="top-bar-right">
        <button 
          class="icon-btn" 
          onclick={() => goto("/settings")}
          title="Settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        </button>
      </div>
    </nav>

    <!-- Editor Area -->
    <main class="editor-area">
      {#if isLoading}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading...</p>
        </div>
      {:else if currentPageId}
        {#key currentPageId}
          <PageEditor pageId={currentPageId} />
        {/key}
      {:else}
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <h2>No page selected</h2>
          <p>Select a page from the sidebar or create a new one</p>
          <button class="create-btn" onclick={() => handleCreatePage(new CustomEvent('createpage', { detail: {} }))}>
            Create new page
          </button>
        </div>
      {/if}
    </main>
  </div>
</div>

<style>
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap");

  .app-layout {
    display: flex;
    height: 100vh;
    overflow: hidden;
    background: #ffffff;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  /* Sidebar */
  .sidebar {
    width: 260px;
    min-width: 260px;
    background: #f9fafb;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Main Content */
  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: margin 0.2s;
  }

  .main-content.sidebar-collapsed {
    margin-left: 0;
  }

  /* Top Bar */
  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    background: #ffffff;
    min-height: 48px;
  }

  .top-bar-left,
  .top-bar-right {
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
    color: #6b7280;
    cursor: pointer;
    border-radius: 0.375rem;
    transition: all 0.15s;
  }

  .icon-btn:hover {
    background: #f3f4f6;
    color: #1a1a1a;
  }

  /* Editor Area */
  .editor-area {
    flex: 1;
    overflow-y: auto;
    background: #ffffff;
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #6b7280;
    text-align: center;
    padding: 2rem;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-state h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 0.5rem;
  }

  .empty-state p {
    font-size: 0.875rem;
    color: #9ca3af;
    margin: 0 0 1.5rem;
  }

  .create-btn {
    padding: 0.625rem 1.25rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .create-btn:hover {
    background: #2563eb;
  }

  .spinner {
    width: 2rem;
    height: 2rem;
    border: 2px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      z-index: 50;
      box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
    }

    .main-content {
      margin-left: 0;
    }
  }
</style>
