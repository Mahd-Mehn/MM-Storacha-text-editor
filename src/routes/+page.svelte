<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { RichTextEditor } from '$lib';
  import { noteManager, yjsDocumentManager } from '$lib/services';
  import { notificationService } from '$lib/services/notification';
  import { errorHandler } from '$lib/services/error-handler';
  import { autoMigrate } from '$lib/utils/storage-migration';
  import ShareNoteDialog from '$lib/components/ShareNoteDialog.svelte';
  import VersionHistorySidebar from '$lib/components/VersionHistorySidebar.svelte';
  import VersionDiffViewer from '$lib/components/VersionDiffViewer.svelte';
  import { versionHistoryService } from '$lib/services';
  import type { Note } from '$lib/types';
  import type { Doc as YDoc } from 'yjs';
  
  let currentNote: Note | null = $state(null);
  let yjsDocument: YDoc | null = $state(null);
  let editorContent = $state('');
  let noteTitle = $state('Untitled Note');
  let isSaving = $state(false);
  let showShareDialog = $state(false);
  let showVersionHistory = $state(false);
  let showDiffViewer = $state(false);
  let compareFromVersion = $state<number | null>(null);
  let compareToVersion = $state<number | null>(null);
  let lastSaved = $state<Date | null>(null);
  
  onMount(async () => {
    await initializeEditor();
  });

  // Reactive effect to reload note when URL changes
  $effect(() => {
    const noteId = $page.url.searchParams.get('noteId');
    if (noteId && currentNote && noteId !== currentNote.id) {
      loadNoteById(noteId);
    }
  });

  async function loadNoteById(noteId: string) {
    try {
      const loadedNote = await noteManager.loadNote(noteId);
      if (loadedNote) {
        currentNote = loadedNote;
        yjsDocument = loadedNote.content;
        noteTitle = loadedNote.title;
        editorContent = '';
      } else {
        notificationService.error('Note not found', 'The requested note could not be loaded');
        goto('/notes');
      }
    } catch (error) {
      await errorHandler.handleError(
        error instanceof Error ? error : new Error('Failed to load note'),
        { operation: 'load_note', noteId }
      );
      notificationService.error('Failed to load note', 'Please try again');
    }
  }

  async function initializeEditor() {
    try {
      // Check if storage needs migration (clears old incompatible data)
      const didMigrate = await autoMigrate();
      if (didMigrate) {
        notificationService.info(
          'Storage Updated',
          'Your storage format was updated. Previous notes were cleared due to compatibility changes.',
          5000
        );
      }
      
      // Initialize note manager
      await noteManager.initialize();
      
      // Check if there's a noteId in the URL query parameter
      const noteId = $page.url.searchParams.get('noteId');
      
      if (noteId) {
        // Load existing note
        const loadedNote = await noteManager.loadNote(noteId);
        if (loadedNote) {
          currentNote = loadedNote;
          yjsDocument = loadedNote.content;
          noteTitle = loadedNote.title;
          editorContent = '';
          return;
        } else {
          notificationService.error('Note not found', 'The requested note could not be loaded');
        }
      }
      
      // Create a new note if no noteId or note not found
      currentNote = await noteManager.createNote('Welcome to Storacha Notes');
      yjsDocument = currentNote.content;
      noteTitle = currentNote.title;
      
      // Don't set initial content - let the editor handle it
      // The Collaboration extension will manage the document structure
      editorContent = '';
    } catch (error) {
      await errorHandler.handleError(error instanceof Error ? error : new Error('Failed to initialize editor'));
      notificationService.error('Failed to initialize editor', 'Please refresh the page');
    }
  }
  
  function handleUpdate(content: string) {
    editorContent = content;
    if (currentNote) {
      // Auto-save will be triggered by the service
    }
  }

  async function handleSave() {
    if (!currentNote) return;
    
    isSaving = true;
    try {
      await noteManager.saveNote(currentNote);
      lastSaved = new Date();
      notificationService.success('Note saved', 'Your changes have been saved');
    } catch (error) {
      await errorHandler.handleError(error instanceof Error ? error : new Error('Failed to save note'));
      notificationService.error('Save failed', 'Please try again');
    } finally {
      isSaving = false;
    }
  }

  function handleTitleChange(e: Event) {
    const target = e.target as HTMLInputElement;
    noteTitle = target.value;
    if (currentNote) {
      currentNote.title = noteTitle;
      noteManager.updateNoteTitle(currentNote.id, noteTitle);
    }
  }

  function goToNotesList() {
    goto('/notes');
  }

  function handleCompareVersions(fromVersion: number, toVersion: number) {
    compareFromVersion = fromVersion;
    compareToVersion = toVersion;
    showDiffViewer = true;
  }

  function closeDiffViewer() {
    showDiffViewer = false;
    compareFromVersion = null;
    compareToVersion = null;
  }

  async function handleVersionRestore(version: number) {
    if (!currentNote) return;
    
    try {
      const restoredNote = await versionHistoryService.restoreVersion(currentNote.id, version);
      if (restoredNote) {
        currentNote = restoredNote;
        yjsDocument = restoredNote.content;
        noteTitle = restoredNote.title;
        notificationService.success('Version restored', `Restored to version ${version}`);
      }
    } catch (error) {
      await errorHandler.handleError(
        error instanceof Error ? error : new Error('Failed to restore version'),
        { operation: 'restore_version', noteId: currentNote.id, version }
      );
      notificationService.error('Restore failed', 'Could not restore this version');
    }
  }
</script>

<div class="app-layout">
  <!-- Top Navigation Bar -->
  <nav class="top-nav">
    <div class="nav-left">
      <button class="back-button" onclick={goToNotesList}>
        ← All Notes
      </button>
      <div class="note-title-section">
        <input 
          type="text" 
          class="note-title-input"
          value={noteTitle}
          oninput={handleTitleChange}
          placeholder="Untitled Note"
        />
        {#if lastSaved}
          <span class="save-status">Saved {lastSaved.toLocaleTimeString()}</span>
        {/if}
      </div>
    </div>
    
    <div class="nav-actions">
      {#if currentNote}
        <button 
          class="action-btn version-btn"
          onclick={() => showVersionHistory = !showVersionHistory}
          title="Version History"
        >
          📜 History
        </button>
        <button 
          class="action-btn share-btn"
          onclick={() => showShareDialog = true}
          title="Share Note"
        >
          🔗 Share
        </button>
        <button 
          class="action-btn save-btn"
          onclick={handleSave}
          disabled={isSaving}
          title="Save Note"
        >
          {#if isSaving}
            <span class="spinner-tiny"></span>
          {:else}
            💾
          {/if}
          Save
        </button>
      {/if}
      <button 
        class="action-btn settings-btn"
        onclick={() => goto('/settings')}
        title="Settings"
      >
        ⚙️
      </button>
    </div>
  </nav>

  <!-- Main Content Area -->
  <div class="content-wrapper">
    <!-- Editor -->
    <main class="editor-main">
      {#if yjsDocument && currentNote}
        <div class="editor-container">
          {#key currentNote.id}
            <RichTextEditor 
              {yjsDocument} 
              placeholder="Start writing your note..."
              onUpdate={handleUpdate}
            />
          {/key}
        </div>
      {:else}
        <div class="loading-editor">
          <div class="spinner"></div>
          <p>Loading editor...</p>
        </div>
      {/if}
    </main>

    <!-- Version History Sidebar -->
    {#if showVersionHistory && currentNote}
      <aside class="version-sidebar">
        <VersionHistorySidebar 
          noteId={currentNote.id}
          currentVersion={currentNote.metadata.version}
          onVersionSelect={(version) => console.log('Selected version:', version)}
          onVersionRestore={handleVersionRestore}
          onCompareVersions={handleCompareVersions}
        />
      </aside>
    {/if}
  </div>
</div>

<!-- Share Dialog -->
{#if showShareDialog && currentNote}
  <ShareNoteDialog 
    note={currentNote}
    onClose={() => showShareDialog = false}
  />
{/if}

<!-- Version Diff Viewer Modal -->
{#if showDiffViewer && currentNote && compareFromVersion !== null && compareToVersion !== null}
  <div class="diff-modal" onclick={closeDiffViewer}>
    <div class="diff-modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="diff-modal-header">
        <h2>Version Comparison</h2>
        <button class="close-button" onclick={closeDiffViewer}>✕</button>
      </div>
      <div class="diff-modal-body">
        <VersionDiffViewer 
          noteId={currentNote.id}
          fromVersion={compareFromVersion}
          toVersion={compareToVersion}
        />
      </div>
    </div>
  </div>
{/if}

<style>
  .app-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .top-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1.5rem;
    background: white;
    border-bottom: 1px solid #e5e7eb;
    gap: 1rem;
  }

  .nav-left {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
    min-width: 0;
  }

  .back-button {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    color: #6b7280;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .back-button:hover {
    background: #f3f4f6;
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .note-title-section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
  }

  .note-title-input {
    padding: 0.5rem 0.75rem;
    font-size: 1.125rem;
    font-weight: 600;
    border: 1px solid transparent;
    border-radius: 0.375rem;
    color: #111827;
    background: transparent;
    transition: all 0.2s;
  }

  .note-title-input:hover {
    background: #f9fafb;
    border-color: #e5e7eb;
  }

  .note-title-input:focus {
    outline: none;
    background: white;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .save-status {
    font-size: 0.75rem;
    color: #6b7280;
    padding-left: 0.75rem;
  }

  .nav-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    background: white;
    color: #374151;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .action-btn:hover:not(:disabled) {
    background: #f3f4f6;
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .save-btn {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  .save-btn:hover:not(:disabled) {
    background: #2563eb;
    border-color: #2563eb;
    color: white;
  }

  .content-wrapper {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .editor-main {
    flex: 1;
    overflow-y: auto;
    background: white;
  }

  .editor-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem;
  }

  .loading-editor {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #6b7280;
  }

  .spinner {
    width: 2.5rem;
    height: 2.5rem;
    border: 3px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  .spinner-tiny {
    display: inline-block;
    width: 0.875rem;
    height: 0.875rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .version-sidebar {
    width: 350px;
    border-left: 1px solid #e5e7eb;
    background: #f9fafb;
    overflow-y: auto;
  }

  @media (max-width: 1024px) {
    .version-sidebar {
      position: fixed;
      right: 0;
      top: 0;
      bottom: 0;
      z-index: 50;
      box-shadow: -4px 0 6px rgba(0, 0, 0, 0.1);
    }
  }

  /* Diff Modal */
  .diff-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 2rem;
  }

  .diff-modal-content {
    background: white;
    border-radius: 0.5rem;
    width: 100%;
    max-width: 1200px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  .diff-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .diff-modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
  }

  .close-button {
    padding: 0.5rem;
    background: transparent;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #6b7280;
    transition: color 0.2s;
    line-height: 1;
  }

  .close-button:hover {
    color: #111827;
  }

  .diff-modal-body {
    flex: 1;
    overflow: hidden;
  }

  @media (max-width: 768px) {
    .top-nav {
      flex-wrap: wrap;
      padding: 0.5rem 1rem;
    }

    .nav-left {
      width: 100%;
      margin-bottom: 0.5rem;
    }

    .nav-actions {
      width: 100%;
      justify-content: flex-end;
    }

    .action-btn {
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
    }

    .version-sidebar {
      width: 100%;
    }

    .editor-container {
      padding: 1rem;
    }

    .diff-modal {
      padding: 1rem;
    }

    .diff-modal-content {
      max-height: 95vh;
    }
  }
</style>
