<script lang="ts">
  import { goto } from "$app/navigation";
  import type { Note } from "$lib/types";

  interface Props {
    notes: Note[];
    currentNoteId: string | null;
    onCreateNote: () => void;
    onDeleteNote: (noteId: string) => void;
    onNoteSelect: (noteId: string) => void;
  }

  let {
    notes,
    currentNoteId,
    onCreateNote,
    onDeleteNote,
    onNoteSelect,
  }: Props = $props();

  let searchQuery = $state("");
  let expandedFolders = $state(new Set<string>(["root"]));

  const filteredNotes = $derived(
    searchQuery.trim() === ""
      ? notes
      : notes.filter((note) =>
          note.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
  );

  const sortedNotes = $derived(
    [...filteredNotes].sort((a, b) => {
      // Sort by updated date, most recent first
      return new Date(b.updated).getTime() - new Date(a.updated).getTime();
    })
  );

  function toggleFolder(folderId: string) {
    if (expandedFolders.has(folderId)) {
      expandedFolders.delete(folderId);
    } else {
      expandedFolders.add(folderId);
    }
    expandedFolders = new Set(expandedFolders);
  }

  function formatDate(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function getNoteTruncatedContent(note: Note): string {
    // Get first line of content or title
    const content = note.title || "Untitled";
    return content.length > 30 ? content.substring(0, 30) + "..." : content;
  }
</script>

<aside class="workspace-sidebar">
  <div class="sidebar-header">
    <h2>Workspace</h2>
    <button
      class="icon-btn"
      onclick={onCreateNote}
      title="New Page"
      aria-label="Create new page"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M10 5v10M5 10h10" />
      </svg>
    </button>
  </div>

  <div class="sidebar-search">
    <svg
      class="search-icon"
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <circle cx="9" cy="9" r="6" />
      <path d="M14 14l4 4" />
    </svg>
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="Search pages..."
      class="search-input"
    />
    {#if searchQuery}
      <button
        class="clear-search"
        onclick={() => (searchQuery = "")}
        aria-label="Clear search"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M6 6l8 8M14 6l-8 8" />
        </svg>
      </button>
    {/if}
  </div>

  <div class="sidebar-content">
    {#if sortedNotes.length > 0}
      <div class="pages-section">
        <div class="section-header">
          <button
            class="folder-toggle"
            onclick={() => toggleFolder("root")}
            aria-label={expandedFolders.has("root") ? "Collapse" : "Expand"}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="currentColor"
              class="chevron"
              class:expanded={expandedFolders.has("root")}
            >
              <path d="M4 2l4 4-4 4" />
            </svg>
          </button>
          <span class="section-title">Pages</span>
          <span class="section-count">{sortedNotes.length}</span>
        </div>

        {#if expandedFolders.has("root")}
          <div class="pages-list">
            {#each sortedNotes as note (note.id)}
              <button
                class="page-item"
                class:active={currentNoteId === note.id}
                onclick={() => onNoteSelect(note.id)}
                title={note.title || "Untitled"}
              >
                <div class="page-icon">📄</div>
                <div class="page-content">
                  <div class="page-title">{note.title || "Untitled"}</div>
                  <div class="page-meta">{formatDate(note.updated)}</div>
                </div>
                <span
                  class="page-delete"
                  onclick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this page?")) {
                      onDeleteNote(note.id);
                    }
                  }}
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm("Delete this page?")) {
                        onDeleteNote(note.id);
                      }
                    }
                  }}
                  title="Delete page"
                  aria-label="Delete page"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M6 6l8 8M14 6l-8 8" />
                  </svg>
                </span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {:else if searchQuery}
      <div class="empty-state">
        <svg
          width="48"
          height="48"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <circle cx="9" cy="9" r="6" />
          <path d="M14 14l4 4" />
        </svg>
        <p>No pages found</p>
        <span>Try a different search term</span>
      </div>
    {:else}
      <div class="empty-state">
        <svg
          width="48"
          height="48"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            d="M9 12h6M9 8h6M6 16h8a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <p>No pages yet</p>
        <button class="create-first-btn" onclick={onCreateNote}
          >Create your first page</button
        >
      </div>
    {/if}
  </div>
</aside>

<style>
  .workspace-sidebar {
    width: 260px;
    height: 100vh;
    background: #f9fafb;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid #e5e7eb;
  }

  .sidebar-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #111827;
  }

  .icon-btn {
    background: none;
    border: none;
    padding: 6px;
    cursor: pointer;
    color: #6b7280;
    border-radius: 6px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-btn:hover {
    background: #e5e7eb;
    color: #111827;
  }

  .sidebar-search {
    position: relative;
    padding: 12px 16px;
    border-bottom: 1px solid #e5e7eb;
  }

  .search-icon {
    position: absolute;
    left: 28px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 8px 32px 8px 36px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 14px;
    background: white;
    outline: none;
    transition: border-color 0.2s;
  }

  .search-input:focus {
    border-color: #4f46e5;
  }

  .clear-search {
    position: absolute;
    right: 24px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: #9ca3af;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .clear-search:hover {
    background: #f3f4f6;
    color: #111827;
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .pages-section {
    margin-bottom: 16px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    margin-bottom: 4px;
  }

  .folder-toggle {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: #6b7280;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .folder-toggle:hover {
    background: #e5e7eb;
  }

  .chevron {
    transition: transform 0.2s;
  }

  .chevron.expanded {
    transform: rotate(90deg);
  }

  .section-title {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-count {
    font-size: 12px;
    color: #9ca3af;
  }

  .pages-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .page-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
    position: relative;
    width: 100%;
  }

  .page-item:hover {
    background: #e5e7eb;
  }

  .page-item.active {
    background: #e0e7ff;
  }

  .page-item:hover .page-delete {
    opacity: 1;
  }

  .page-icon {
    flex-shrink: 0;
    font-size: 16px;
  }

  .page-content {
    flex: 1;
    min-width: 0;
  }

  .page-title {
    font-size: 14px;
    color: #111827;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .page-meta {
    font-size: 11px;
    color: #9ca3af;
    margin-top: 2px;
  }

  .page-delete {
    opacity: 0;
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: #9ca3af;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .page-delete:hover {
    background: #dc2626;
    color: white;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    color: #9ca3af;
  }

  .empty-state svg {
    margin-bottom: 16px;
  }

  .empty-state p {
    margin: 0 0 4px 0;
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
  }

  .empty-state span {
    font-size: 12px;
    color: #9ca3af;
  }

  .create-first-btn {
    margin-top: 16px;
    padding: 8px 16px;
    background: #4f46e5;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .create-first-btn:hover {
    background: #4338ca;
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .workspace-sidebar {
      background: #111827;
      border-right-color: #374151;
    }

    .sidebar-header {
      border-bottom-color: #374151;
    }

    .sidebar-header h2 {
      color: #f9fafb;
    }

    .icon-btn {
      color: #9ca3af;
    }

    .icon-btn:hover {
      background: #374151;
      color: #f9fafb;
    }

    .sidebar-search {
      border-bottom-color: #374151;
    }

    .search-input {
      background: #1f2937;
      border-color: #374151;
      color: #f9fafb;
    }

    .search-input:focus {
      border-color: #6366f1;
    }

    .folder-toggle:hover {
      background: #374151;
    }

    .section-title {
      color: #9ca3af;
    }

    .section-count {
      color: #6b7280;
    }

    .page-item:hover {
      background: #374151;
    }

    .page-item.active {
      background: #3730a3;
    }

    .page-title {
      color: #f9fafb;
    }

    .page-meta {
      color: #6b7280;
    }

    .page-delete:hover {
      background: #dc2626;
      color: white;
    }

    .empty-state p {
      color: #9ca3af;
    }

    .empty-state span {
      color: #6b7280;
    }

    .create-first-btn {
      background: #6366f1;
    }

    .create-first-btn:hover {
      background: #4f46e5;
    }
  }
</style>
