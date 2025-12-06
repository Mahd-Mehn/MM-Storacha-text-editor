<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";

  export let currentPage: {
    id: string;
    title: string;
    parentId?: string;
  } | null = null;

  let breadcrumbs: Array<{ id: string; title: string }> = [];

  // Build breadcrumb trail from current page
  $: if (currentPage) {
    breadcrumbs = buildBreadcrumbs(currentPage);
  }

  function buildBreadcrumbs(page: any): any[] {
    // TODO: Implement full breadcrumb building logic with parent traversal
    return [
      { id: "workspace", title: "Workspace" },
      { id: page.id, title: page.title },
    ];
  }

  function navigate(id: string) {
    if (id === "workspace") {
      goto("/");
    } else {
      goto(`/page/${id}`);
    }
  }
</script>

<nav class="breadcrumbs">
  {#each breadcrumbs as crumb, i}
    {#if i > 0}
      <svg class="separator" width="16" height="16" viewBox="0 0 16 16">
        <path
          d="M6 4l4 4-4 4"
          stroke="currentColor"
          stroke-width="1.5"
          fill="none"
        />
      </svg>
    {/if}
    <button
      class="crumb"
      class:active={i === breadcrumbs.length - 1}
      on:click={() => navigate(crumb.id)}
    >
      {crumb.title}
    </button>
  {/each}
</nav>

<style>
  .breadcrumbs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-primary);
  }

  .crumb {
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: none;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .crumb:hover:not(.active) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .crumb.active {
    color: var(--text-primary);
    font-weight: 500;
    cursor: default;
  }

  .separator {
    color: var(--text-tertiary);
    flex-shrink: 0;
  }
</style>
