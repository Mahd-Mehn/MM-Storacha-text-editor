<script lang="ts">
  import { page } from "$app/stores";
  import { workspaceState } from "$lib/stores/workspace";
  import RichTextEditor from "$lib/components/RichTextEditor.svelte";

  $: pageId = $page.params.id;
  $: currentPage = findPage($workspaceState.workspace.pages, pageId);

  function findPage(pages: any[], id: string): any | null {
    for (const p of pages) {
      if (p.id === id) return p;
      if (p.children.length > 0) {
        const found = findPage(p.children, id);
        if (found) return found;
      }
    }
    return null;
  }
</script>

<div class="page-container">
  {#if currentPage}
    <div class="page-header">
      <div class="page-icon-large">{currentPage.icon}</div>
      <h1 class="page-title-edit" contenteditable="true">
        {currentPage.title}
      </h1>
    </div>

    <div class="page-content">
      <RichTextEditor />
    </div>
  {:else}
    <div class="page-not-found">
      <div class="not-found-icon">📄</div>
      <h2>Page Not Found</h2>
      <p>The page you're looking for doesn't exist.</p>
    </div>
  {/if}
</div>

<style>
  .page-container {
    min-height: 100vh;
    background: var(--bg-primary);
    padding: 3rem 4rem;
    max-width: 900px;
    margin: 0 auto;
  }

  .page-header {
    margin-bottom: 2rem;
  }

  .page-icon-large {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .page-title-edit {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    outline: none;
    border: none;
    padding: 0.5rem 0;
    border-radius: 0.5rem;
    transition: all 0.2s;
  }

  .page-title-edit:hover {
    background: var(--bg-hover);
    padding-left: 0.5rem;
  }

  .page-title-edit:focus {
    background: var(--bg-hover);
    padding-left: 0.5rem;
  }

  .page-content {
    margin-top: 2rem;
  }

  .page-not-found {
    text-align: center;
    padding: 4rem 2rem;
  }

  .not-found-icon {
    font-size: 5rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .page-not-found h2 {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 0.5rem;
  }

  .page-not-found p {
    font-size: 1.125rem;
    color: var(--text-secondary);
    margin: 0;
  }

  @media (max-width: 768px) {
    .page-container {
      padding: 2rem 1.5rem;
    }

    .page-title-edit {
      font-size: 2rem;
    }
  }
</style>
