<script lang="ts">
  import { goto } from "$app/navigation";
  import { workspaceState, type Page } from "$lib/stores/workspace";
  import { onMount } from "svelte";
  import { clickOutside } from "$lib/utils/click-outside";

  export let page: Page;
  export let level = 0;

  let isHovered = false;
  let showContextMenu = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let isRenaming = false;
  let renameValue = page.title;
  let renameInput: HTMLInputElement;

  $: expanded = $workspaceState.expandedIds.has(page.id);
  $: isSelected = $workspaceState.selectedPageId === page.id;

  function toggleExpanded(e: Event) {
    e.stopPropagation();
    if (page.type === "folder") {
      workspaceState.toggleExpanded(page.id);
    }
  }

  function handleClick() {
    workspaceState.selectPage(page.id);
    goto(`/page/${page.id}`);
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    contextMenuX = e.clientX;
    contextMenuY = e.clientY;
    showContextMenu = true;
  }

  function closeContextMenu() {
    showContextMenu = false;
  }

  function startRename() {
    isRenaming = true;
    renameValue = page.title;
    showContextMenu = false;
    setTimeout(() => {
      renameInput?.focus();
      renameInput?.select();
    }, 10);
  }

  function finishRename() {
    if (renameValue.trim() && renameValue !== page.title) {
      workspaceState.renamePage(page.id, renameValue.trim());
    }
    isRenaming = false;
  }

  function cancelRename() {
    renameValue = page.title;
    isRenaming = false;
  }

  function handleRenameKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      finishRename();
    } else if (e.key === "Escape") {
      cancelRename();
    }
  }

  function handleAddSubpage() {
    workspaceState.createPage("Untitled", "📄", "file", page.id);
    showContextMenu = false;
  }

  function handleAddFolder() {
    workspaceState.createPage("New Folder", "📁", "folder", page.id);
    showContextMenu = false;
  }

  function handleDelete() {
    if (confirm(`Delete "${page.title}"?`)) {
      workspaceState.deletePage(page.id);
    }
    showContextMenu = false;
  }

  function handleDuplicate() {
    workspaceState.createPage(
      `${page.title} (Copy)`,
      page.icon,
      page.type,
      page.parentId
    );
    showContextMenu = false;
  }
</script>

<div class="page-item-container">
  <div
    class="page-item"
    class:has-children={page.children.length > 0}
    class:selected={isSelected}
    style="padding-left: {level * 1.25 + 0.5}rem"
    onclick={handleClick}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick()}
    oncontextmenu={handleContextMenu}
    onmouseenter={() => (isHovered = true)}
    onmouseleave={() => (isHovered = false)}
    role="button"
    tabindex="0"
    aria-label={`${page.title || 'Untitled'} ${page.type}`}
  >
    <!-- Expand/Collapse Button -->
    {#if page.type === "folder"}
      <button
        class="expand-btn"
        class:expanded
        onclick={toggleExpanded}
        aria-label={expanded ? "Collapse" : "Expand"}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M5 4l3 3-3 3"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    {:else}
      <div class="expand-spacer"></div>
    {/if}

    <!-- Page Icon -->
    <div class="page-icon">
      {page.icon}
    </div>

    <!-- Page Title (editable) -->
    {#if isRenaming}
      <input
        bind:this={renameInput}
        bind:value={renameValue}
        onblur={finishRename}
        onkeydown={handleRenameKeydown}
        class="rename-input"
        type="text"
      />
    {:else}
      <div class="page-title">
        {page.title}
      </div>
    {/if}

    <!-- Actions (shown on hover) -->
    {#if isHovered && !isRenaming}
      <div class="page-actions">
        {#if page.type === "folder"}
          <button
            class="action-btn"
            onclick={(e) => {
              e.stopPropagation();
              handleAddSubpage();
            }}
            title="Add page"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 3v8M3 7h8"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </button>
        {/if}
        <button
          class="action-btn"
          onclick={(e) => {
            e.stopPropagation();
            handleContextMenu(e);
          }}
          title="More options"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="3" r="1" fill="currentColor" />
            <circle cx="7" cy="7" r="1" fill="currentColor" />
            <circle cx="7" cy="11" r="1" fill="currentColor" />
          </svg>
        </button>
      </div>
    {/if}
  </div>

  <!-- Children (if expanded) -->
  {#if expanded && page.children.length > 0}
    <div class="children">
      {#each page.children as child (child.id)}
        <svelte:self page={child} level={level + 1} />
      {/each}
    </div>
  {/if}
</div>

<!-- Context Menu -->
{#if showContextMenu}
  <div
    class="context-menu"
    style="left: {contextMenuX}px; top: {contextMenuY}px"
    use:clickOutside={closeContextMenu}
  >
    <button class="context-menu-item" onclick={startRename}>
      <span class="context-icon">✏️</span>
      Rename
    </button>
    {#if page.type === "folder"}
      <button class="context-menu-item" onclick={handleAddSubpage}>
        <span class="context-icon">📄</span>
        New Page
      </button>
      <button class="context-menu-item" onclick={handleAddFolder}>
        <span class="context-icon">📁</span>
        New Folder
      </button>
      <div class="context-divider"></div>
    {/if}
    <button class="context-menu-item" onclick={handleDuplicate}>
      <span class="context-icon">📋</span>
      Duplicate
    </button>
    <div class="context-divider"></div>
    <button class="context-menu-item danger" onclick={handleDelete}>
      <span class="context-icon">🗑️</span>
      Delete
    </button>
  </div>
{/if}

<style>
  .page-item-container {
    display: flex;
    flex-direction: column;
  }

  .page-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    padding-right: 0.25rem;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    user-select: none;
  }

  .page-item:hover {
    background: var(--bg-hover);
  }

  .page-item.selected {
    background: var(--bg-active);
  }

  .page-item:active {
    transform: scale(0.98);
  }

  .expand-btn {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 0.25rem;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
    padding: 0;
  }

  .expand-btn:hover {
    background: var(--bg-hover);
  }

  .expand-btn svg {
    transition: transform 0.2s;
  }

  .expand-btn.expanded svg {
    transform: rotate(90deg);
  }

  .expand-spacer {
    width: 18px;
    flex-shrink: 0;
  }

  .page-icon {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .page-title {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .rename-input {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
    background: var(--bg-input);
    border: 2px solid var(--border-input-focus);
    border-radius: 0.25rem;
    padding: 0.125rem 0.375rem;
    outline: none;
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .page-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-left: auto;
    flex-shrink: 0;
  }

  .action-btn {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 0.25rem;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    padding: 0;
  }

  .action-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .children {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  /* Context Menu */
  .context-menu {
    position: fixed;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    box-shadow: var(--shadow-lg);
    padding: 0.375rem;
    min-width: 180px;
    z-index: 1000;
    animation: contextMenuAppear 0.15s ease-out;
  }

  @keyframes contextMenuAppear {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    color: var(--text-primary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
  }

  .context-menu-item:hover {
    background: var(--bg-hover);
  }

  .context-menu-item.danger {
    color: #ef4444;
  }

  .context-menu-item.danger:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .context-icon {
    font-size: 1rem;
    width: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .context-divider {
    height: 1px;
    background: var(--border-color);
    margin: 0.25rem 0;
  }
</style>
