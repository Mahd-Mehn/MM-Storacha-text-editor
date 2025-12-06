<script lang="ts">
  import { workspaceState } from "$lib/stores/workspace";
  import { goto } from "$app/navigation";

  $: allDocuments = getAllDocuments($workspaceState.workspace.pages);

  function getAllDocuments(pages: any[]): any[] {
    return pages.reduce((acc, page) => {
      const docs = page.type === "file" ? [page] : [];
      return [...acc, ...docs, ...getAllDocuments(page.children)];
    }, []);
  }

  function openDocument(id: string) {
    workspaceState.selectPage(id);
    goto(`/page/${id}`);
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
</script>

<div class="documents-page">
  <header class="page-header">
    <h1>Documents</h1>
    <p>All your documents in one place</p>
  </header>

  <div class="documents-grid">
    {#each allDocuments as doc (doc.id)}
      <button class="document-card" on:click={() => openDocument(doc.id)}>
        <div class="doc-icon">{doc.icon}</div>
        <div class="doc-info">
          <h3 class="doc-title">{doc.title}</h3>
          <p class="doc-date">Last edited {formatDate(doc.updatedAt)}</p>
        </div>
      </button>
    {/each}
  </div>
</div>

<style>
  .documents-page {
    min-height: 100vh;
    background: var(--bg-tertiary);
    padding: 3rem 4rem;
  }

  .page-header {
    margin-bottom: 3rem;
  }

  .page-header h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 0.5rem;
  }

  .page-header p {
    font-size: 1.125rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .documents-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1.5rem;
  }

  .document-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .document-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
    border-color: var(--accent-color);
  }

  .doc-icon {
    font-size: 2.5rem;
    flex-shrink: 0;
  }

  .doc-info {
    flex: 1;
    min-width: 0;
  }

  .doc-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .doc-date {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin: 0;
  }

  @media (max-width: 768px) {
    .documents-page {
      padding: 2rem 1.5rem;
    }

    .documents-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
