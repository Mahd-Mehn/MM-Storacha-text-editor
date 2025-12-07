<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import WorkspaceTree from "./WorkspaceTree.svelte";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import { workspaceStore } from "$lib/stores/workspace";
  import { authService, spaceService } from "$lib/services";
  import { notificationService } from "$lib/services/notification";
  import type { SpaceInfo } from "$lib/types/auth";

  let { collapsed = false } = $props<{ collapsed?: boolean }>();

  let searchQuery = $state("");
  let showWorkspaceDropdown = $state(false);
  let showUserMenu = $state(false);
  let workspaces = $state<SpaceInfo[]>([]);
  let currentWorkspace = $state<SpaceInfo | null>(null);
  let userEmail = $state<string | null>(null);
  let isLoggedIn = $state(false);
  let isCreatingWorkspace = $state(false);
  let newWorkspaceName = $state("");
  let isCollapsed = $state(collapsed);

  onMount(async () => {
    await loadUserData();
    await loadWorkspaces();
  });

  async function loadUserData() {
    const status = await authService.checkAccountStatus();
    userEmail = status.email;
    isLoggedIn = status.hasAccount;
  }

  async function loadWorkspaces() {
    try {
      workspaces = await spaceService.getSpaces();
      currentWorkspace = spaceService.getCurrentSpace();
    } catch (error) {
      console.error("Failed to load workspaces:", error);
    }
  }

  function toggleSidebar() {
    isCollapsed = !isCollapsed;
  }

  function toggleWorkspaceDropdown() {
    showWorkspaceDropdown = !showWorkspaceDropdown;
    if (showWorkspaceDropdown) {
      showUserMenu = false;
    }
  }

  function toggleUserMenu() {
    showUserMenu = !showUserMenu;
    if (showUserMenu) {
      showWorkspaceDropdown = false;
    }
  }

  function closeDropdowns() {
    showWorkspaceDropdown = false;
    showUserMenu = false;
    isCreatingWorkspace = false;
    newWorkspaceName = "";
  }

  async function selectWorkspace(workspace: SpaceInfo) {
    try {
      await spaceService.setCurrentSpace(workspace.did);
      currentWorkspace = workspace;
      notificationService.success("Workspace switched", `Now using "${workspace.name}"`);
      closeDropdowns();
    } catch (error) {
      notificationService.error("Failed to switch workspace", error instanceof Error ? error.message : "Unknown error");
    }
  }

  async function createWorkspace() {
    if (!newWorkspaceName.trim()) {
      notificationService.warning("Please enter a workspace name");
      return;
    }

    try {
      const newSpace = await spaceService.createSpace(newWorkspaceName.trim());
      workspaces = [...workspaces, newSpace];
      currentWorkspace = newSpace;
      notificationService.success("Workspace created", `"${newSpace.name}" is ready to use`);
      closeDropdowns();
    } catch (error) {
      notificationService.error("Failed to create workspace", error instanceof Error ? error.message : "Unknown error");
    }
  }

  function handleNewPage() {
    // TODO: Implement new page creation
    console.log("Create new page");
  }

  function handleSearch() {
    // TODO: Implement search
    console.log("Search:", searchQuery);
  }

  function navigateToSettings() {
    closeDropdowns();
    goto("/settings");
  }

  function handleLogout() {
    authService.clearIdentity();
    spaceService.clearCurrentSpace();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('storacha-email-login');
      localStorage.removeItem('storacha-login-timestamp');
    }
    notificationService.info("Logged out", "You have been logged out successfully");
    closeDropdowns();
    window.location.reload();
  }

  // Close dropdowns when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.workspace-dropdown-container') && !target.closest('.user-menu-container')) {
      closeDropdowns();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:window onclick={handleClickOutside} />

<aside class="sidebar" class:collapsed={isCollapsed}>
  <!-- Workspace Header -->
  <div class="workspace-header workspace-dropdown-container">
    <button class="workspace-selector" title="Switch workspace" onclick={(e) => { e.stopPropagation(); toggleWorkspaceDropdown(); }}>
      <div class="workspace-icon">
        <span>📝</span>
      </div>
      <div class="workspace-info">
        <div class="workspace-name">{currentWorkspace?.name || 'My Workspace'}</div>
        <div class="workspace-subtitle">{isLoggedIn ? 'Storacha Space' : 'Personal'}</div>
      </div>
      <svg
        class="chevron"
        class:rotated={showWorkspaceDropdown}
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

    <!-- Workspace Dropdown -->
    {#if showWorkspaceDropdown}
      <div class="dropdown workspace-dropdown">
        <div class="dropdown-header">
          <span>Workspaces</span>
          {#if isLoggedIn}
            <button class="dropdown-action-btn" onclick={() => isCreatingWorkspace = true} title="Create workspace">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          {/if}
        </div>

        {#if isCreatingWorkspace}
          <div class="create-workspace-form">
            <input
              type="text"
              placeholder="Workspace name..."
              bind:value={newWorkspaceName}
              onkeydown={(e) => e.key === 'Enter' && createWorkspace()}
            />
            <div class="form-actions">
              <button class="btn-cancel" onclick={() => { isCreatingWorkspace = false; newWorkspaceName = ''; }}>
                Cancel
              </button>
              <button class="btn-create" onclick={createWorkspace}>
                Create
              </button>
            </div>
          </div>
        {/if}

        <div class="dropdown-items">
          {#if workspaces.length === 0}
            <div class="dropdown-empty">
              {#if isLoggedIn}
                <p>No workspaces yet</p>
                <button class="btn-create-first" onclick={() => isCreatingWorkspace = true}>
                  Create your first workspace
                </button>
              {:else}
                <p>Login with Storacha to create workspaces</p>
              {/if}
            </div>
          {:else}
            {#each workspaces as workspace}
              <button
                class="dropdown-item"
                class:active={currentWorkspace?.did === workspace.did}
                onclick={() => selectWorkspace(workspace)}
              >
                <div class="item-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/>
                  </svg>
                </div>
                <span class="item-name">{workspace.name || 'Unnamed Space'}</span>
                {#if currentWorkspace?.did === workspace.did}
                  <svg class="check-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                {/if}
              </button>
            {/each}
          {/if}
        </div>

        {#if !isLoggedIn}
          <div class="dropdown-footer">
            <p class="login-hint">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5"/>
                <path d="M7 4v3M7 9v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              Login to sync across devices
            </p>
          </div>
        {/if}
      </div>
    {/if}
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
        oninput={handleSearch}
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
      </nav>
    </div>

    <!-- Pages Section -->
    <div class="nav-section">
      <div class="section-header">
        <span>PAGES</span>
        <button class="add-button" onclick={handleNewPage} title="New page">
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
  <div class="user-profile user-menu-container">
    <button class="user-profile-btn" onclick={(e) => { e.stopPropagation(); toggleUserMenu(); }} title="User settings">
      <img
        src="https://api.dicebear.com/7.x/avataaars/svg?seed={userEmail || 'guest'}"
        alt="User"
        class="user-avatar"
      />
      <div class="user-info">
        <div class="user-name">{userEmail ? userEmail.split('@')[0] : 'Guest User'}</div>
        <div class="user-email">{userEmail || 'Not logged in'}</div>
      </div>
    </button>
    <ThemeToggle />
    <button class="user-menu-btn" onclick={(e) => { e.stopPropagation(); toggleUserMenu(); }} title="User menu">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="4" r="1.5" fill="currentColor" />
        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
        <circle cx="8" cy="12" r="1.5" fill="currentColor" />
      </svg>
    </button>

    <!-- User Menu Dropdown -->
    {#if showUserMenu}
      <div class="dropdown user-dropdown">
        <div class="dropdown-user-header">
          <img
            src="https://api.dicebear.com/7.x/avataaars/svg?seed={userEmail || 'guest'}"
            alt="User"
            class="dropdown-avatar"
          />
          <div class="dropdown-user-info">
            <div class="dropdown-user-name">{userEmail ? userEmail.split('@')[0] : 'Guest User'}</div>
            <div class="dropdown-user-email">{userEmail || 'Not logged in'}</div>
          </div>
        </div>

        <div class="dropdown-divider"></div>

        <div class="dropdown-items">
          <button class="dropdown-item" onclick={navigateToSettings}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>Settings</span>
          </button>

          <button class="dropdown-item" onclick={() => goto('/help')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M6 6a2 2 0 114 0c0 1-1.5 1.5-1.5 2.5M8 12v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>Help & Support</span>
          </button>

          {#if isLoggedIn}
            <div class="dropdown-divider"></div>
            
            <button class="dropdown-item" onclick={() => goto('/account')}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.5"/>
                <path d="M2 14c0-2.5 2.5-4 6-4s6 1.5 6 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <span>Account</span>
            </button>

            <button class="dropdown-item danger" onclick={handleLogout}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 2H4a2 2 0 00-2 2v8a2 2 0 002 2h2M11 11l3-3-3-3M6 8h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>Log out</span>
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Toggle Button -->
  <button
    class="sidebar-toggle"
    onclick={toggleSidebar}
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
    transition: transform 0.2s;
  }

  .chevron.rotated {
    transform: rotate(180deg);
  }

  /* Dropdowns */
  .workspace-dropdown-container,
  .user-menu-container {
    position: relative;
  }

  .dropdown {
    position: absolute;
    left: 0.5rem;
    right: 0.5rem;
    background: var(--bg-primary, white);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.75rem;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
    z-index: 200;
    animation: dropdownIn 0.15s ease-out;
    overflow: hidden;
  }

  @keyframes dropdownIn {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .workspace-dropdown {
    top: calc(100% + 0.5rem);
  }

  .user-dropdown {
    bottom: calc(100% + 0.5rem);
  }

  .dropdown-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-tertiary, #9ca3af);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .dropdown-action-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary, #f3f4f6);
    border: none;
    border-radius: 0.375rem;
    color: var(--text-secondary, #6b7280);
    cursor: pointer;
    transition: all 0.2s;
  }

  .dropdown-action-btn:hover {
    background: var(--accent-color, #667eea);
    color: white;
  }

  .dropdown-items {
    padding: 0.5rem;
    max-height: 240px;
    overflow-y: auto;
  }

  .dropdown-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary, #6b7280);
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
  }

  .dropdown-item:hover {
    background: var(--bg-hover, rgba(0, 0, 0, 0.05));
    color: var(--text-primary, #1a1a1a);
  }

  .dropdown-item.active {
    background: var(--bg-active, rgba(102, 126, 234, 0.1));
    color: var(--accent-color, #667eea);
  }

  .dropdown-item.danger:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }

  .item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .item-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .check-icon {
    color: var(--accent-color, #667eea);
    flex-shrink: 0;
  }

  .dropdown-empty {
    padding: 1.5rem 1rem;
    text-align: center;
  }

  .dropdown-empty p {
    margin: 0 0 1rem;
    font-size: 0.875rem;
    color: var(--text-tertiary, #9ca3af);
  }

  .btn-create-first {
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-create-first:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
  }

  .dropdown-footer {
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--border-color, #e5e7eb);
    background: var(--bg-secondary, #f9fafb);
  }

  .login-hint {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-tertiary, #9ca3af);
  }

  .create-workspace-form {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    background: var(--bg-secondary, #f9fafb);
  }

  .create-workspace-form input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background: var(--bg-primary, white);
    color: var(--text-primary, #1a1a1a);
    margin-bottom: 0.5rem;
  }

  .create-workspace-form input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.15);
  }

  .form-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .btn-cancel,
  .btn-create {
    padding: 0.375rem 0.75rem;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-cancel {
    background: transparent;
    color: var(--text-secondary, #6b7280);
  }

  .btn-cancel:hover {
    background: var(--bg-hover, rgba(0, 0, 0, 0.05));
  }

  .btn-create {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .btn-create:hover {
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.35);
  }

  /* User dropdown specific */
  .dropdown-user-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
  }

  .dropdown-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .dropdown-user-info {
    flex: 1;
    min-width: 0;
  }

  .dropdown-user-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #1a1a1a);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dropdown-user-email {
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dropdown-divider {
    height: 1px;
    background: var(--border-color, #e5e7eb);
    margin: 0;
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
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--border-color, #e5e7eb);
  }

  .user-profile-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
    padding: 0.375rem;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background 0.2s;
    text-align: left;
  }

  .user-profile-btn:hover {
    background: var(--bg-hover, rgba(0, 0, 0, 0.05));
  }

  .user-avatar {
    width: 32px;
    height: 32px;
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
