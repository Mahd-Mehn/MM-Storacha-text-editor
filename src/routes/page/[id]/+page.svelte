<script lang="ts">
  import { page } from "$app/stores";
  import { workspaceState } from "$lib/stores/workspace";
  import SimpleEditor from "$lib/components/SimpleEditor.svelte";
  import { browser } from "$app/environment";

  $: pageId = $page.params.id || "";
  $: currentPage = findPage($workspaceState.workspace.pages, pageId);
  $: pageContent = browser
    ? localStorage.getItem(`page-content-${pageId}`) || ""
    : "";

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

  function handleContentUpdate(content: string) {
    if (browser) {
      localStorage.setItem(`page-content-${pageId}`, content);
    }
  }

  function handleTitleUpdate(e: Event) {
    const target = e.target as HTMLElement;
    const newTitle = target.textContent?.trim() || "Untitled";
    if (newTitle !== currentPage?.title) {
      workspaceState.renamePage(pageId, newTitle);
    }
  }
</script>

<div class="page-container">
  {#if currentPage}
    <div class="page-header">
      <div class="page-icon-large">{currentPage.icon}</div>
      <h1
        class="page-title-edit"
        contenteditable="true"
        on:blur={handleTitleUpdate}
        on:keydown={(e) => e.key === "Enter" && e.preventDefault()}
      >
        {currentPage.title}
      </h1>
    </div>

    <div class="page-content">
      <SimpleEditor
        content={pageContent}
        placeholder="Start writing..."
        onUpdate={handleContentUpdate}
      />
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
  }

  .page-header {
    max-width: 750px;
    margin: 0 auto;
    padding: 3rem 2rem 1rem;
  }

  .page-icon-large {
    font-size: 4rem;
    margin-bottom: 1rem;
    animation: fadeIn 0.3s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
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
    cursor: text;
    display: inline-block;
    min-width: 200px;
  }

  .page-title-edit:hover {
    background: var(--bg-hover);
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }

  .page-title-edit:focus {
    background: var(--bg-hover);
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }

  .page-content {
    animation: fadeIn 0.4s ease-out 0.1s both;
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
    .page-header {
      padding: 2rem 1.5rem 1rem;
    }

    .page-title-edit {
      font-size: 2rem;
    }

    .page-icon-large {
      font-size: 3rem;
    }
  }
</style>
