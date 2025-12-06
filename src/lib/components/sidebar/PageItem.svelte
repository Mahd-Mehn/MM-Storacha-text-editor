<script lang="ts">
  import { goto } from "$app/navigation";

  export let page: {
    id: string;
    title: string;
    icon?: string;
    children: any[];
  };
  export let level = 0;

  let expanded = false;
  let isHovered = false;

  function toggleExpanded(e: Event) {
    e.stopPropagation();
    expanded = !expanded;
  }

  function handleClick() {
    goto(`/page/${page.id}`);
  }

  function handleAddSubpage(e: Event) {
    e.stopPropagation();
    console.log("Add subpage to:", page.id);
  }

  function handleMore(e: Event) {
    e.stopPropagation();
    console.log("Show more menu for:", page.id);
  }
</script>

<div class="page-item-container">
  <div
    class="page-item"
    class:has-children={page.children.length > 0}
    style="padding-left: {level * 1.25 + 0.5}rem"
    on:click={handleClick}
    on:mouseenter={() => (isHovered = true)}
    on:mouseleave={() => (isHovered = false)}
    role="button"
    tabindex="0"
  >
    <!-- Expand/Collapse Button -->
    {#if page.children.length > 0}
      <button
        class="expand-btn"
        class:expanded
        on:click={toggleExpanded}
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
      {page.icon || "📄"}
    </div>

    <!-- Page Title -->
    <div class="page-title">
      {page.title}
    </div>

    <!-- Actions (shown on hover) -->
    {#if isHovered}
      <div class="page-actions">
        <button
          class="action-btn"
          on:click={handleAddSubpage}
          title="Add subpage"
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
        <button class="action-btn" on:click={handleMore} title="More options">
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
    transition: background 0.2s;
    position: relative;
    user-select: none;
  }

  .page-item:hover {
    background: var(--bg-hover, rgba(0, 0, 0, 0.05));
  }

  .page-item:active {
    background: var(--bg-active, rgba(0, 0, 0, 0.08));
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
    color: var(--text-secondary, #6b7280);
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
    padding: 0;
  }

  .expand-btn:hover {
    background: var(--bg-hover, rgba(0, 0, 0, 0.1));
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
    color: var(--text-primary, #1a1a1a);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
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
    color: var(--text-secondary, #6b7280);
    cursor: pointer;
    transition: all 0.2s;
    padding: 0;
  }

  .action-btn:hover {
    background: var(--bg-hover, rgba(0, 0, 0, 0.1));
    color: var(--text-primary, #1a1a1a);
  }

  .children {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
</style>
