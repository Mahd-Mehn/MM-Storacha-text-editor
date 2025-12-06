<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import RichTextEditor from "$lib/components/RichTextEditor.svelte";
  import VersionHistorySidebar from "$lib/components/VersionHistorySidebar.svelte";
  import VersionDiffViewer from "$lib/components/VersionDiffViewer.svelte";
  import ShareNoteDialog from "$lib/components/ShareNoteDialog.svelte";
  import * as Y from "yjs";
  import { noteManager } from "$lib/services";
  import { versionHistoryService } from "$lib/services/version-history.js";
  import { notificationService } from "$lib/services/notification";
  import { errorHandler } from "$lib/services/error-handler";
  import type { Note } from "$lib/types";

  // State
  let currentNote: Note | null = null;
  let yjsDocument: Y.Doc | null = null;
  let noteTitle = "";
  let editorContent = "";
  let isSaving = false;
  let lastSaved: Date | null = null;
  let showVersionHistory = false;
  let showShareDialog = false;
  let showDiffViewer = false;
  let compareFromVersion: number | null = null;
  let compareToVersion: number | null = null;

  onMount(() => {
    initializeEditor();
  });

  // Watch for noteId changes in URL
  $: {
    const noteId = $page.url.searchParams.get("noteId");
    if (noteId && currentNote && noteId !== currentNote.id) {
      loadNoteById(noteId);
    }
  }

  async function loadNoteById(noteId: string) {
    try {
      const loadedNote = await noteManager.loadNote(noteId);
      if (loadedNote) {
        currentNote = loadedNote;
        yjsDocument = loadedNote.content;
        noteTitle = loadedNote.title;
        editorContent = "";
      } else {
        notificationService.error(
          "Note not found",
          "The requested note could not be loaded"
        );
        goto("/notes");
      }
    } catch (error) {
      await errorHandler.handleError(
        error instanceof Error ? error : new Error("Failed to load note"),
        { operation: "load_note", noteId }
      );
      notificationService.error("Failed to load note", "Please try again");
    }
  }

  async function initializeEditor() {
    try {
      // Initialize note manager
      await noteManager.initialize();

      // Check if there's a noteId in the URL query parameter
      const noteId = $page.url.searchParams.get("noteId");

      if (noteId) {
        // Load existing note
        const loadedNote = await noteManager.loadNote(noteId);
        if (loadedNote) {
          currentNote = loadedNote;
          yjsDocument = loadedNote.content;
          noteTitle = loadedNote.title;
          editorContent = "";
          return;
        } else {
          notificationService.error(
            "Note not found",
            "The requested note could not be loaded"
          );
        }
      }

      // Create a new note if no noteId or note not found
      currentNote = await noteManager.createNote("Welcome to Storacha Notes");
      yjsDocument = currentNote.content;
      noteTitle = currentNote.title;

      // Don't set initial content - let the editor handle it
      // The Collaboration extension will manage the document structure
      editorContent = "";
    } catch (error) {
      await errorHandler.handleError(
        error instanceof Error
          ? error
          : new Error("Failed to initialize editor")
      );
      notificationService.error(
        "Failed to initialize editor",
        "Please refresh the page"
      );
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
      notificationService.success("Note saved", "Your changes have been saved");
    } catch (error) {
      await errorHandler.handleError(
        error instanceof Error ? error : new Error("Failed to save note")
      );
      notificationService.error("Save failed", "Please try again");
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
    goto("/notes");
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
      const restoredNote = await versionHistoryService.restoreVersion(
        currentNote.id,
        version
      );
      if (restoredNote) {
        currentNote = restoredNote;
        yjsDocument = restoredNote.content;
        noteTitle = restoredNote.title;
        notificationService.success(
          "Version restored",
          `Restored to version ${version}`
        );
      }
    } catch (error) {
      await errorHandler.handleError(
        error instanceof Error ? error : new Error("Failed to restore version"),
        { operation: "restore_version", noteId: currentNote.id, version }
      );
      notificationService.error(
        "Restore failed",
        "Could not restore this version"
      );
    }
  }
</script>

<div class="app-layout">
  <!-- Minimal Top Bar -->
  <nav class="top-bar">
    <div class="top-bar-content">
      <button class="icon-btn" onclick={goToNotesList} title="All Notes">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M3 10h14M3 5h14M3 15h14" />
        </svg>
      </button>

      <input
        type="text"
        class="note-title"
        value={noteTitle}
        oninput={handleTitleChange}
        placeholder="Untitled"
      />

      <div class="top-bar-actions">
        {#if currentNote}
          <button
            class="icon-btn"
            onclick={() => (showVersionHistory = !showVersionHistory)}
            title="History"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 4v4l3 3" />
            </svg>
          </button>
          <button
            class="icon-btn"
            onclick={() => (showShareDialog = true)}
            title="Share"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M15 7a3 3 0 100-6 3 3 0 000 6zM5 13a3 3 0 100-6 3 3 0 000 6zM15 19a3 3 0 100-6 3 3 0 000 6zM7 11l6-2M7 11l6 6"
              />
            </svg>
          </button>
          <button
            class="icon-btn"
            onclick={handleSave}
            disabled={isSaving}
            title="Save"
          >
            {#if isSaving}
              <span class="spinner-tiny"></span>
            {:else}
              <svg
                width="18"
                height="18"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M17 10v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7M14 3H6L3 6v4h14V6l-3-3z"
                />
              </svg>
            {/if}
          </button>
        {/if}
        <button
          class="icon-btn"
          onclick={() => goto("/settings")}
          title="Settings"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path d="M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>
    </div>
  </nav>

  <!-- Editor Area -->
  <main class="editor-area">
    {#if yjsDocument && currentNote}
      {#key currentNote.id}
        <RichTextEditor
          {yjsDocument}
          placeholder="Start writing..."
          onUpdate={handleUpdate}
        />
      {/key}
    {:else}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading editor...</p>
      </div>
    {/if}
  </main>

  <!-- Version History Sidebar -->
  {#if showVersionHistory && currentNote}
    <aside class="sidebar">
      <div class="sidebar-header">
        <h3>Version History</h3>
        <button
          class="icon-btn-small"
          onclick={() => (showVersionHistory = false)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M6 6l8 8M14 6l-8 8" />
          </svg>
        </button>
      </div>
      <VersionHistorySidebar
        noteId={currentNote.id}
        currentVersion={currentNote.metadata.version}
        onVersionSelect={(version) => console.log("Selected version:", version)}
        onVersionRestore={handleVersionRestore}
        onCompareVersions={handleCompareVersions}
      />
    </aside>
  {/if}
</div>

<!-- Share Dialog -->
{#if showShareDialog && currentNote}
  <ShareNoteDialog
    note={currentNote}
    onClose={() => (showShareDialog = false)}
  />
{/if}

<!-- Version Diff Viewer Modal -->
{#if showDiffViewer && currentNote && compareFromVersion !== null && compareToVersion !== null}
  <div class="modal-overlay" onclick={closeDiffViewer}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>Version Comparison</h2>
        <button class="icon-btn-small" onclick={closeDiffViewer}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M6 6l8 8M14 6l-8 8" />
          </svg>
        </button>
      </div>
      <div class="modal-body">
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
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap");

  .app-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: #ffffff;
    font-family:
      "Inter",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
  }

  /* Minimal Top Bar */
  .top-bar {
    border-bottom: 1px solid #e5e7eb;
    background: #ffffff;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .top-bar-content {
    max-width: 750px;
    margin: 0 auto;
    padding: 0.75rem 2rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .note-title {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 500;
    color: #1a1a1a;
    border: none;
    outline: none;
    background: transparent;
    padding: 0.5rem 0;
  }

  .note-title::placeholder {
    color: #9ca3af;
  }

  .top-bar-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    background: transparent;
    color: #6b7280;
    cursor: pointer;
    border-radius: 0.375rem;
    transition: all 0.2s;
  }

  .icon-btn:hover:not(:disabled) {
    background: #f3f4f6;
    color: #1a1a1a;
  }

  .icon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .icon-btn-small {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: #6b7280;
    cursor: pointer;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }

  .icon-btn-small:hover {
    background: #f3f4f6;
    color: #1a1a1a;
  }

  /* Editor Area */
  .editor-area {
    flex: 1;
    overflow-y: auto;
    background: #ffffff;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #6b7280;
  }

  .spinner {
    width: 2rem;
    height: 2rem;
    border: 2px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  .spinner-tiny {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid #e5e7eb;
    border-top-color: #6b7280;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Sidebar */
  .sidebar {
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    width: 350px;
    background: #ffffff;
    border-left: 1px solid #e5e7eb;
    overflow-y: auto;
    z-index: 50;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .sidebar-header h3 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
  }

  /* Modal */
  .modal-overlay {
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

  .modal-content {
    background: white;
    border-radius: 0.75rem;
    width: 100%;
    max-width: 1200px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  .modal-body {
    flex: 1;
    overflow: hidden;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .top-bar-content {
      padding: 0.75rem 1rem;
    }

    .sidebar {
      width: 100%;
    }

    .modal-overlay {
      padding: 1rem;
    }

    .modal-content {
      max-height: 95vh;
    }
  }
</style>
