<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { noteManager } from '$lib/services';
  import { notificationService } from '$lib/services/notification';
  import { errorHandler } from '$lib/services/error-handler';
  import ShareNoteDialog from '$lib/components/ShareNoteDialog.svelte';
  import type { Note } from '$lib/types';

  let notes = $state<Note[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let filteredNotes = $state<Note[]>([]);
  let selectedNoteId = $state<string | null>(null);
  let shareDialogNote = $state<Note | null>(null);

  // Lazy loading state
  let displayedNotesCount = $state(10);
  let isLoadingMore = $state(false);
  const NOTES_PER_PAGE = 10;

  onMount(async () => {
    await loadNotes();
  });

  async function loadNotes() {
    try {
      loading = true;
      await noteManager.initialize();
      notes = await noteManager.listNotes();
      filteredNotes = notes;
    } catch (error) {
      await errorHandler.handleError(
        error instanceof Error ? error : new Error('Failed to load notes'),
        { operation: 'load_notes' }
      );
      notificationService.error('Failed to load notes', 'Please try refreshing the page');
    } finally {
      loading = false;
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      filteredNotes = notes;
      return;
    }

    try {
      filteredNotes = await noteManager.searchNotes(searchQuery);
    } catch (error) {
      await errorHandler.handleError(
        error instanceof Error ? error : new Error('Search failed'),
        { operation: 'search_notes', query: searchQuery }
      );
    }
  }

  async function createNewNote() {
    try {
      const note = await noteManager.createNote('Untitled Note');
      notes = [note, ...notes];
      filteredNotes = [note, ...filteredNotes];
      notificationService.success('Note created', 'Your new note is ready');
      
      // Navigate to editor (would use SvelteKit navigation in full implementation)
      selectedNoteId = note.id;
    } catch (error) {
      await errorHandler.handleError(
        error instanceof Error ? error : new Error('Failed to create note'),
        { operation: 'create_note' }
      );
      notificationService.error('Failed to create note', 'Please try again');
    }
  }

  function openNote(noteId: string) {
    // Navigate to the main editor page with the noteId as a query parameter
    goto(`/?noteId=${noteId}`);
  }

  async function deleteNote(noteId: string) {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      await noteManager.deleteNote(noteId);
      notes = notes.filter(n => n.id !== noteId);
      filteredNotes = filteredNotes.filter(n => n.id !== noteId);
      notificationService.success('Note deleted', 'The note has been removed');
    } catch (error) {
      await errorHandler.handleError(
        error instanceof Error ? error : new Error('Failed to delete note'),
        { operation: 'delete_note', noteId }
      );
      notificationService.error('Failed to delete note', 'Please try again');
    }
  }

  function loadMoreNotes() {
    if (isLoadingMore || displayedNotesCount >= filteredNotes.length) {
      return;
    }

    isLoadingMore = true;
    
    // Simulate async loading with slight delay for smooth UX
    setTimeout(() => {
      displayedNotesCount += NOTES_PER_PAGE;
      isLoadingMore = false;
    }, 100);
  }

  function formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return date.toLocaleDateString();
    } else if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }

  // Reactive search
  $effect(() => {
    if (searchQuery !== undefined) {
      const debounceTimer = setTimeout(() => {
        handleSearch();
      }, 300);

      return () => clearTimeout(debounceTimer);
    }
  });

  // Get displayed notes with lazy loading
  $effect(() => {
    displayedNotes = filteredNotes.slice(0, displayedNotesCount);
  });

  let displayedNotes = $derived(filteredNotes.slice(0, displayedNotesCount));
</script>

<div class="notes-page">
  <div class="page-header">
    <div class="header-content">
      <h1>My Notes</h1>
      <p>{notes.length} {notes.length === 1 ? 'note' : 'notes'}</p>
    </div>
    <button class="create-button" onclick={createNewNote}>
      <span class="button-icon">+</span>
      New Note
    </button>
  </div>

  <div class="search-bar">
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="Search notes..."
      class="search-input"
    />
    <span class="search-icon">🔍</span>
  </div>

  {#if loading}
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Loading your notes...</p>
    </div>
  {:else if filteredNotes.length === 0}
    <div class="empty-state">
      {#if searchQuery}
        <div class="empty-icon">🔍</div>
        <h2>No notes found</h2>
        <p>Try a different search term</p>
      {:else}
        <div class="empty-icon">📝</div>
        <h2>No notes yet</h2>
        <p>Create your first note to get started</p>
        <button class="create-button-large" onclick={createNewNote}>
          Create Your First Note
        </button>
      {/if}
    </div>
  {:else}
    <div class="notes-grid">
      {#each displayedNotes as note (note.id)}
        <div 
          class="note-card" 
          class:selected={note.id === selectedNoteId}
          onclick={() => openNote(note.id)}
        >
          <div class="note-header">
            <h3 class="note-title">{note.title}</h3>
            <div class="note-actions">
              <button
                class="action-button share-button"
                onclick={(e) => {
                  e.stopPropagation();
                  shareDialogNote = note;
                }}
                title="Share note"
              >
                🔗
              </button>
              <button
                class="action-button delete-button"
                onclick={(e) => {
                  e.stopPropagation();
                  deleteNote(note.id);
                }}
                title="Delete note"
              >
                🗑
              </button>
            </div>
          </div>
          
          <div class="note-meta">
            <span class="note-date">
              Modified {formatDate(note.metadata.modified)}
            </span>
            {#if note.metadata.version > 1}
              <span class="note-version">
                v{note.metadata.version}
              </span>
            {/if}
          </div>

          {#if note.metadata.storachaCID}
            <div class="note-status">
              <span class="status-badge synced">
                ✓ Synced to IPFS
              </span>
              <a 
                href="https://storacha.link/ipfs/{note.metadata.storachaCID}"
                target="_blank"
                class="ipfs-link"
                onclick={(e) => e.stopPropagation()}
                title="View on IPFS"
              >
                🌐 View
              </a>
            </div>
          {:else}
            <div class="note-status">
              <span class="status-badge local">
                📱 Local only
              </span>
              <button
                class="upload-hint"
                onclick={(e) => {
                  e.stopPropagation();
                  shareDialogNote = note;
                }}
              >
                Upload to share
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    {#if displayedNotesCount < filteredNotes.length}
      <div class="load-more-container">
        <button
          class="load-more-button"
          onclick={loadMoreNotes}
          disabled={isLoadingMore}
        >
          {#if isLoadingMore}
            <span class="button-spinner"></span>
            Loading...
          {:else}
            Load More ({filteredNotes.length - displayedNotesCount} remaining)
          {/if}
        </button>
      </div>
    {/if}
  {/if}
</div>

{#if shareDialogNote}
  <ShareNoteDialog 
    note={shareDialogNote} 
    onClose={() => shareDialogNote = null}
  />
{/if}

<style>
  .notes-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .header-content h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 0.25rem 0;
  }

  .header-content p {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .create-button,
  .create-button-large {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .create-button:hover,
  .create-button-large:hover {
    background: #2563eb;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
  }

  .button-icon {
    font-size: 1.5rem;
    line-height: 1;
  }

  .search-bar {
    position: relative;
    margin-bottom: 2rem;
  }

  .search-input {
    width: 100%;
    padding: 0.875rem 1rem 0.875rem 3rem;
    font-size: 1rem;
    border: 2px solid #e5e7eb;
    border-radius: 0.5rem;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 1.25rem;
    opacity: 0.5;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
  }

  .spinner {
    width: 3rem;
    height: 3rem;
    border: 3px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-state h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 0.5rem 0;
  }

  .empty-state p {
    font-size: 1rem;
    color: #6b7280;
    margin: 0 0 2rem 0;
  }

  .notes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .note-card {
    padding: 1.5rem;
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .note-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    transform: translateY(-2px);
  }

  .note-card.selected {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  .note-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
  }

  .note-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .note-actions {
    display: flex;
    gap: 0.25rem;
  }

  .action-button {
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    opacity: 0.5;
    transition: all 0.2s;
    border-radius: 0.25rem;
  }

  .action-button:hover {
    opacity: 1;
    transform: scale(1.1);
  }

  .share-button:hover {
    background: #eff6ff;
  }

  .delete-button:hover {
    background: #fee2e2;
  }

  .note-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .note-version {
    padding: 0.125rem 0.5rem;
    background: #f3f4f6;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .note-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 0.375rem;
  }

  .status-badge.synced {
    background: #dcfce7;
    color: #166534;
  }

  .status-badge.local {
    background: #fef3c7;
    color: #92400e;
  }

  .ipfs-link {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #3b82f6;
    text-decoration: none;
    border: 1px solid #bfdbfe;
    border-radius: 0.375rem;
    transition: all 0.2s;
  }

  .ipfs-link:hover {
    background: #eff6ff;
    border-color: #3b82f6;
  }

  .upload-hint {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    background: transparent;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .upload-hint:hover {
    background: #f3f4f6;
    color: #3b82f6;
    border-color: #3b82f6;
  }

  .load-more-container {
    display: flex;
    justify-content: center;
    padding: 2rem 0;
  }

  .load-more-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 2rem;
    background: white;
    color: #3b82f6;
    border: 2px solid #3b82f6;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .load-more-button:hover:not(:disabled) {
    background: #3b82f6;
    color: white;
  }

  .load-more-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .button-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @media (max-width: 768px) {
    .notes-page {
      padding: 1rem;
    }

    .page-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .notes-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
