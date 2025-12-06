<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import WorkspaceTree from "./WorkspaceTree.svelte";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import { workspaceStore } from "$lib/stores/workspace";
  import { userStore } from "$lib/stores/user";

  export let collapsed = false;

  let searchQuery = "";

  function toggleSidebar() {
    collapsed = !collapsed;
  }

  function handleNewPage() {
    // TODO: Implement new page creation
    console.log("Create new page");
  }

  function handleSearch() {
    // TODO: Implement search
    console.log("Search:", searchQuery);
  }
</script>

<aside class="sidebar" class:collapsed>
  <!-- Workspace Header -->
  <div class="workspace-header">
    <button class="workspace-selector" title="Switch workspace">
      <div class="workspace-icon">
        <span>📝</span>
      </div>
      <div class="workspace-info">
        <div class="workspace-name">My Workspace</div>
        <div class="workspace-subtitle">Personal</div>
      </div>
      <svg
        class="chevron"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
      >
        <path
          d="M4 6l4 4 4-4"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </div>

  <!-- Search -->
  <div class="search-container">
    <div class="search-box">
      <svg
        class="search-icon"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
      >
        <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5" />
        <path
          d="M11 11l3 3"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
      <input
        type="text"
        placeholder="Search..."
        bind:value={searchQuery}
        on:input={handleSearch}
      />
      <kbd class="shortcut">⌘K</kbd>
    </div>
  </div>

  <!-- Navigation Sections -->
  <div class="nav-sections">
    <!-- General Section -->
    <div class="nav-section">
      <div class="section-header">GENERAL</div>
      <nav class="nav-items">
        <a href="/dashboard" class="nav-item">
          <svg
            class="nav-icon"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
          >
            <rect
              x="2"
              y="2"
              width="6"
              height="6"
              rx="1"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <rect
              x="10"
              y="2"
              width="6"
              height="6"
              rx="1"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <rect
              x="2"
              y="10"
              width="6"
              height="6"
              rx="1"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <rect
              x="10"
              y="10"
              width="6"
              height="6"
              rx="1"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
          <span>Dashboard</span>
        </a>

        <a href="/documents" class="nav-item active">
          <svg
            class="nav-icon"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
          >
            <path
              d="M4 2h6l4 4v10a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2z"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path d="M10 2v4h4" stroke="currentColor" stroke-width="1.5" />
          </svg>
          <span>Documents</span>
        </a>

        <a href="/calendar" class="nav-item">
          <svg
            class="nav-icon"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
          >
            <rect
              x="2"
              y="3"
              width="14"
              height="13"
              rx="2"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M2 7h14M6 2v3M12 2v3"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
          <span>Calendar</span>
        </a>

        <a href="/settings" class="nav-item">
          <svg
            class="nav-icon"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
          >
            <circle
              cx="9"
              cy="9"
              r="2"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M9 1v2M9 15v2M17 9h-2M3 9H1M14.5 3.5l-1.4 1.4M4.9 13.1l-1.4 1.4M14.5 14.5l-1.4-1.4M4.9 4.9L3.5 3.5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
          <span>Settings</span>
        </a>
      </nav>
    </div>

    <!-- Pages Section -->
    <div class="nav-section">
      <div class="section-header">
        <span>PAGES</span>
        <button class="add-button" on:click={handleNewPage} title="New page">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M7 2v10M2 7h10"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
      <WorkspaceTree />
    </div>
  </div>

  <!-- User Profile -->
  <div class="user-profile">
    <img
      src={$userStore.avatar ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${$userStore.email}`}
      alt={$userStore.name}
      class="user-avatar"
    />
    <div class="user-info">
      <div class="user-name">{$userStore.name}</div>
      <div class="user-email">{$userStore.email}</div>
    </div>
    <ThemeToggle />
    <button class="user-menu-btn" title="User menu">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="4" r="1.5" fill="currentColor" />
        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
        <circle cx="8" cy="12" r="1.5" fill="currentColor" />
      </svg>
    </button>
  </div>

  <!-- Toggle Button -->
  <button
    class="sidebar-toggle"
    on:click={toggleSidebar}
    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M10 4l-4 4 4 4"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</aside>

<style>
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    width: 260px;
    height: 100vh;
    background: var(--bg-secondary, #f7f7f7);
    border-right: 1px solid var(--border-color, #e5e7eb);
    display: flex;
    flex-direction: column;
    transition: width 0.2s ease;
    z-index: 100;
  }

  .sidebar.collapsed {
    width: 60px;
  }

  .sidebar.collapsed .workspace-info,
  .sidebar.collapsed .workspace-subtitle,
  .sidebar.collapsed .chevron,
  .sidebar.collapsed .search-box input,
  .sidebar.collapsed .shortcut,
  .sidebar.collapsed .section-header,
  .sidebar.collapsed .nav-item span,
  .sidebar.collapsed .user-info {
    display: none;
  }

  /* Workspace Header */
  .workspace-header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .workspace-selector {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .workspace-selector:hover {
    background: var(--bg-hover, rgba(0, 0, 0, 0.05));
  }

  .workspace-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 0.5rem;
    font-size: 1.125rem;
    flex-shrink: 0;
  }

  .workspace-info {
    flex: 1;
    text-align: left;
    min-width: 0;
  }

  .workspace-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #1a1a1a);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .workspace-subtitle {
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
  }

  .chevron {
    color: var(--text-secondary, #6b7280);
    flex-shrink: 0;
  }

  /* Search */
  .search-container {
    padding: 0.75rem 1rem;
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.5rem;
    transition: all 0.2s;
  }

  .search-box:focus-within {
    border-color: var(--accent-color, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .search-icon {
    color: var(--text-secondary, #6b7280);
    flex-shrink: 0;
  }

  .search-box input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 0.875rem;
    color: var(--text-primary, #1a1a1a);
    min-width: 0;
  }

  .search-box input::placeholder {
    color: var(--text-tertiary, #9ca3af);
  }

  .shortcut {
    padding: 0.125rem 0.375rem;
    background: var(--bg-secondary, #f3f4f6);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
    font-family: monospace;
    flex-shrink: 0;
  }

  /* Navigation Sections */
  .nav-sections {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 0;
  }

  .nav-section {
    margin-bottom: 1.5rem;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-tertiary, #9ca3af);
    letter-spacing: 0.05em;
  }

  .add-button {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 0.25rem;
    color: var(--text-secondary, #6b7280);
    cursor: pointer;
    transition: all 0.2s;
    opacity: 0;
  }

  .section-header:hover .add-button {
    opacity: 1;
  }

  .add-button:hover {
    background: var(--bg-hover, rgba(0, 0, 0, 0.05));
    color: var(--text-primary, #1a1a1a);
  }

  .nav-items {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding: 0 0.5rem;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    text-decoration: none;
    color: var(--text-secondary, #6b7280);
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s;
    cursor: pointer;
  }

  .nav-item:hover {
    background: var(--bg-hover, rgba(0, 0, 0, 0.05));
    color: var(--text-primary, #1a1a1a);
  }

  .nav-item.active {
    background: var(--bg-active, rgba(59, 130, 246, 0.1));
    color: var(--accent-color, #3b82f6);
  }

  .nav-icon {
    flex-shrink: 0;
  }

  /* User Profile */
  .user-profile {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    border-top: 1px solid var(--border-color, #e5e7eb);
  }

  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .user-info {
    flex: 1;
    min-width: 0;
  }

  .user-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #1a1a1a);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-email {
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-menu-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    color: var(--text-secondary, #6b7280);
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .user-menu-btn:hover {
    background: var(--bg-hover, rgba(0, 0, 0, 0.05));
    color: var(--text-primary, #1a1a1a);
  }

  /* Sidebar Toggle */
  .sidebar-toggle {
    position: absolute;
    top: 1rem;
    right: -12px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 50%;
    color: var(--text-secondary, #6b7280);
    cursor: pointer;
    transition: all 0.2s;
    z-index: 10;
  }

  .sidebar-toggle:hover {
    background: var(--bg-secondary, #f3f4f6);
    color: var(--text-primary, #1a1a1a);
  }

  .collapsed .sidebar-toggle svg {
    transform: rotate(180deg);
  }

  /* Scrollbar */
  .nav-sections::-webkit-scrollbar {
    width: 6px;
  }

  .nav-sections::-webkit-scrollbar-track {
    background: transparent;
  }

  .nav-sections::-webkit-scrollbar-thumb {
    background: var(--border-color, #e5e7eb);
    border-radius: 3px;
  }

  .nav-sections::-webkit-scrollbar-thumb:hover {
    background: var(--text-tertiary, #9ca3af);
  }
</style>
