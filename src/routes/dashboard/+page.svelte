<script lang="ts">
  import { workspaceState, type Page } from "$lib/stores/workspace";
  import { goto } from "$app/navigation";

  let searchQuery = "";
  let showNewPageDialog = false;
  let newPageTitle = "";
  let newPageType: "file" | "folder" = "file";
  let newPageIcon = "📄";

  $: allPages = getAllPages($workspaceState.workspace.pages);
  $: filteredPages = searchQuery
    ? allPages.filter((page) =>
        page.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allPages;

  $: recentPages = allPages
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6);

  function getAllPages(pages: Page[]): Page[] {
    return pages.reduce((acc, page) => {
      return [...acc, page, ...getAllPages(page.children)];
    }, [] as Page[]);
  }

  function openPage(pageId: string) {
    workspaceState.selectPage(pageId);
    goto(`/page/${pageId}`);
  }

  function createNewPage() {
    if (newPageTitle.trim()) {
      const created = workspaceState.createPage(newPageTitle.trim(), newPageIcon, newPageType);
      newPageTitle = "";
      newPageIcon = "📄";
      newPageType = "file";
      showNewPageDialog = false;

      if (created) {
        openPage(created.id);
      }
    }
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const iconOptions = [
    "📄",
    "📁",
    "📚",
    "📝",
    "💡",
    "🎨",
    "📱",
    "🏠",
    "⚡",
    "🚀",
    "💼",
    "📊",
  ];
</script>

<div class="dashboard">
  <!-- Header -->
  <header class="dashboard-header">
    <div class="header-content">
      <div class="header-title">
        <h1>Dashboard</h1>
        <p>Welcome back! Here's what you've been working on.</p>
      </div>
      <button class="create-btn" on:click={() => (showNewPageDialog = true)}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 3v10M3 8h10"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        New Page
      </button>
    </div>

    <!-- Search Bar -->
    <div class="search-container">
      <svg
        class="search-icon"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
      >
        <circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.5" />
        <path
          d="M12 12l4 4"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
      <input
        type="text"
        placeholder="Search pages..."
        bind:value={searchQuery}
        class="search-input"
      />
      {#if searchQuery}
        <button
          class="clear-search"
          on:click={() => (searchQuery = "")}
          aria-label="Clear search"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
      {/if}
    </div>
  </header>

  <!-- Main Content -->
  <main class="dashboard-main">
    {#if searchQuery}
      <!-- Search Results -->
      <section class="section">
        <h2 class="section-title">Search Results ({filteredPages.length})</h2>
        <div class="cards-grid">
          {#each filteredPages as page (page.id)}
            <button class="page-card" on:click={() => openPage(page.id)}>
              <div class="card-icon">{page.icon}</div>
              <div class="card-content">
                <h3 class="card-title">{page.title}</h3>
                <p class="card-meta">
                  {page.type === "folder" ? "📁 Folder" : "📄 Page"} · Updated {formatDate(
                    page.updatedAt
                  )}
                </p>
              </div>
            </button>
          {/each}
        </div>
      </section>
    {:else}
      <!-- Recent Pages -->
      <section class="section">
        <h2 class="section-title">Recent</h2>
        <div class="cards-grid">
          {#each recentPages as page (page.id)}
            <button class="page-card" on:click={() => openPage(page.id)}>
              <div class="card-icon">{page.icon}</div>
              <div class="card-content">
                <h3 class="card-title">{page.title}</h3>
                <p class="card-meta">
                  {page.type === "folder" ? "📁 Folder" : "📄 Page"} · {formatDate(
                    page.updatedAt
                  )}
                </p>
              </div>
              <div class="card-arrow">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 4l4 4-4 4"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </button>
          {/each}
        </div>
      </section>

      <!-- All Pages -->
      <section class="section">
        <h2 class="section-title">All Pages ({allPages.length})</h2>
        <div class="pages-list">
          {#each $workspaceState.workspace.pages as page (page.id)}
            <div class="folder-section">
              <button class="folder-header" on:click={() => openPage(page.id)}>
                <span class="folder-icon">{page.icon}</span>
                <span class="folder-title">{page.title}</span>
                <span class="folder-count">
                  {page.children.length}
                  {page.children.length === 1 ? "item" : "items"}
                </span>
              </button>
              {#if page.children.length > 0}
                <div class="folder-children">
                  {#each page.children as child (child.id)}
                    <button
                      class="child-item"
                      on:click={() => openPage(child.id)}
                    >
                      <span class="child-icon">{child.icon}</span>
                      <span class="child-title">{child.title}</span>
                      <span class="child-meta"
                        >{formatDate(child.updatedAt)}</span
                      >
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {/if}
  </main>
</div>

<!-- New Page Dialog -->
{#if showNewPageDialog}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="dialog-overlay" on:click={() => (showNewPageDialog = false)}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div
      class="dialog"
      on:click|stopPropagation
      role="dialog"
      aria-labelledby="dialog-title"
    >
      <div class="dialog-header">
        <h2 id="dialog-title">Create New Page</h2>
        <button
          class="dialog-close"
          on:click={() => (showNewPageDialog = false)}
          aria-label="Close dialog"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M5 5l10 10M15 5l-10 10"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>

      <div class="dialog-body">
        <!-- Type Selection -->
        <div class="form-group">
          <div class="type-selector" role="group" aria-label="Page type">
            <button
              class="type-option"
              class:active={newPageType === "file"}
              on:click={() => {
                newPageType = "file";
                newPageIcon = "📄";
              }}
            >
              <span class="type-icon">📄</span>
              <span>Page</span>
            </button>
            <button
              class="type-option"
              class:active={newPageType === "folder"}
              on:click={() => {
                newPageType = "folder";
                newPageIcon = "📁";
              }}
            >
              <span class="type-icon">📁</span>
              <span>Folder</span>
            </button>
          </div>
        </div>

        <!-- Icon Selection -->
        <div class="form-group">
          <label for="icon-selector">Icon</label>
          <div
            class="icon-selector"
            id="icon-selector"
            role="group"
            aria-label="Choose icon"
          >
            {#each iconOptions as icon}
              <button
                class="icon-option"
                class:active={newPageIcon === icon}
                on:click={() => (newPageIcon = icon)}
                aria-label={`Select ${icon} icon`}
              >
                {icon}
              </button>
            {/each}
          </div>
        </div>

        <!-- Title Input -->
        <div class="form-group">
          <label for="page-title">Title</label>
          <input
            id="page-title"
            type="text"
            bind:value={newPageTitle}
            placeholder="Enter page title..."
            class="title-input"
            on:keydown={(e) => e.key === "Enter" && createNewPage()}
          />
        </div>
      </div>

      <div class="dialog-footer">
        <button
          class="btn btn-secondary"
          on:click={() => (showNewPageDialog = false)}
        >
          Cancel
        </button>
        <button
          class="btn btn-primary"
          on:click={createNewPage}
          disabled={!newPageTitle.trim()}
        >
          Create
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dashboard {
    min-height: 100vh;
    background: var(--bg-tertiary);
    padding: 2rem;
  }

  /* Header */
  .dashboard-header {
    max-width: 1200px;
    margin: 0 auto 2rem;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }

  .header-title h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 0.5rem;
    background: linear-gradient(
      135deg,
      var(--text-primary) 0%,
      var(--accent-color) 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .header-title p {
    font-size: 1.125rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .create-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--accent-color);
    color: #000;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 0 20px var(--accent-glow);
  }

  .create-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px var(--accent-glow);
  }

  .create-btn:active {
    transform: translateY(0);
  }

  /* Search */
  .search-container {
    position: relative;
    max-width: 600px;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-tertiary);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.875rem 1rem 0.875rem 3rem;
    background: var(--bg-input);
    border: 2px solid var(--border-input);
    border-radius: 0.75rem;
    font-size: 1rem;
    color: var(--text-primary);
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--border-input-focus);
    box-shadow: 0 0 0 4px var(--accent-glow);
  }

  .search-input::placeholder {
    color: var(--text-tertiary);
  }

  .clear-search {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-hover);
    border: none;
    border-radius: 0.375rem;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .clear-search:hover {
    background: var(--bg-active);
    color: var(--text-primary);
  }

  /* Main Content */
  .dashboard-main {
    max-width: 1200px;
    margin: 0 auto;
  }

  .section {
    margin-bottom: 3rem;
  }

  .section-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 1.5rem;
  }

  /* Cards Grid */
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .page-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    position: relative;
    overflow: hidden;
  }

  .page-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--accent-color);
    transform: scaleX(0);
    transition: transform 0.2s;
  }

  .page-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
    border-color: var(--accent-color);
  }

  .page-card:hover::before {
    transform: scaleX(1);
  }

  .card-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .card-content {
    flex: 1;
    min-width: 0;
  }

  .card-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-meta {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .card-arrow {
    color: var(--text-tertiary);
    transition: all 0.2s;
  }

  .page-card:hover .card-arrow {
    color: var(--accent-color);
    transform: translateX(4px);
  }

  /* Pages List */
  .pages-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .folder-section {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    overflow: hidden;
    transition: all 0.2s;
  }

  .folder-section:hover {
    box-shadow: var(--shadow-md);
  }

  .folder-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 1.25rem 1.5rem;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .folder-header:hover {
    background: var(--bg-hover);
  }

  .folder-icon {
    font-size: 1.5rem;
  }

  .folder-title {
    flex: 1;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .folder-count {
    font-size: 0.875rem;
    color: var(--text-secondary);
    padding: 0.25rem 0.75rem;
    background: var(--bg-tertiary);
    border-radius: 1rem;
  }

  .folder-children {
    border-top: 1px solid var(--border-color);
  }

  .child-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.875rem 1.5rem;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }

  .child-item:last-child {
    border-bottom: none;
  }

  .child-item:hover {
    background: var(--bg-hover);
    padding-left: 2rem;
  }

  .child-icon {
    font-size: 1.125rem;
  }

  .child-title {
    flex: 1;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .child-meta {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  /* Dialog */
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
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

  .dialog {
    background: var(--bg-card);
    border-radius: 1rem;
    box-shadow: var(--shadow-lg);
    width: 90%;
    max-width: 500px;
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .dialog-header h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  .dialog-close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .dialog-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .dialog-body {
    padding: 1.5rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .type-selector {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .type-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border: 2px solid var(--border-input);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .type-option:hover {
    border-color: var(--accent-color);
  }

  .type-option.active {
    background: var(--bg-active);
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .type-icon {
    font-size: 1.5rem;
  }

  .icon-selector {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.5rem;
  }

  .icon-option {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    background: var(--bg-secondary);
    border: 2px solid var(--border-input);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .icon-option:hover {
    transform: scale(1.1);
    border-color: var(--accent-color);
  }

  .icon-option.active {
    background: var(--bg-active);
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .title-input {
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--bg-input);
    border: 2px solid var(--border-input);
    border-radius: 0.5rem;
    font-size: 1rem;
    color: var(--text-primary);
    transition: all 0.2s;
  }

  .title-input:focus {
    outline: none;
    border-color: var(--border-input-focus);
    box-shadow: 0 0 0 4px var(--accent-glow);
  }

  .title-input::placeholder {
    color: var(--text-tertiary);
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid var(--border-color);
  }

  .btn {
    padding: 0.625rem 1.25rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .btn-secondary:hover {
    background: var(--bg-hover);
  }

  .btn-primary {
    background: var(--accent-color);
    color: #000;
    box-shadow: 0 0 15px var(--accent-glow);
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px var(--accent-glow);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .dashboard {
      padding: 1rem;
    }

    .header-content {
      flex-direction: column;
      gap: 1rem;
    }

    .create-btn {
      width: 100%;
      justify-content: center;
    }

    .cards-grid {
      grid-template-columns: 1fr;
    }

    .header-title h1 {
      font-size: 2rem;
    }
  }
</style>
