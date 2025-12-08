<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import RichTextEditor from '$lib/components/RichTextEditor.svelte';
  import VersionHistorySidebar from '$lib/components/VersionHistorySidebar.svelte';
  import VersionDiffViewer from '$lib/components/VersionDiffViewer.svelte';
  import * as Y from 'yjs';
  import { versionHistoryService } from '$lib/services/version-history.js';
  
  // Get note ID from route params
  let noteId = $derived($page.params.id);
  
  // State
  let yjsDocument: Y.Doc | null = null;
  let showVersionHistory = $state(true);
  let showDiffViewer = $state(false);
  let compareFromVersion = $state<number | null>(null);
  let compareToVersion = $state<number | null>(null);
  let currentVersion = $state(1);
  
  onMount(() => {
    // Initialize Yjs document
    yjsDocument = new Y.Doc();
    
    // Load note data if it exists
    loadNote();
  });
  
  async function loadNote() {
    try {
      // In a real implementation, you would load the note from storage
      console.log('Loading note:', noteId);
      
      // For now, create a sample note
      if (yjsDocument) {
        const text = yjsDocument.getText('content');
        text.insert(0, 'Welcome to your note!\n\nStart typing to create your first version.');
      }
    } catch (error) {
      console.error('Failed to load note:', error);
    }
  }
  
  function handleVersionSelect(version: number) {
    console.log('Selected version:', version);
    // In a real implementation, you would load and display the selected version
  }
  
  async function handleVersionRestore(version: number) {
    try {
      const restoredNote = await versionHistoryService.restoreVersion(noteId, version);
      if (restoredNote && yjsDocument) {
        // Replace current document with restored version
        yjsDocument = restoredNote.content;
        console.log('Version restored:', version);
      }
    } catch (error) {
      console.error('Failed to restore version:', error);
    }
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
  
  function toggleVersionHistory() {
    showVersionHistory = !showVersionHistory;
  }
</script>

<div class="note-page">
  <!-- Header -->
  <header class="note-header">
    <div class="header-left">
      <a href="/notes" class="back-button">← Back to Notes</a>
      <h1>Note Editor</h1>
    </div>
    <div class="header-right">
      <button 
        class="toggle-history-button"
        onclick={toggleVersionHistory}
        class:active={showVersionHistory}
      >
        {showVersionHistory ? '📋 Hide History' : '📋 Show History'}
      </button>
    </div>
  </header>
  
  <!-- Main content area -->
  <div class="note-content">
    <!-- Editor section -->
    <div class="editor-section" class:full-width={!showVersionHistory}>
      {#if yjsDocument}
        <RichTextEditor 
          yjsDocument={yjsDocument}
          editable={true}
          placeholder="Start writing your note..."
          showToolbar={true}
        />
      {:else}
        <div class="loading">
          <p>Loading editor...</p>
        </div>
      {/if}
    </div>
    
    <!-- Version history sidebar -->
    {#if showVersionHistory}
      <aside class="version-sidebar">
        <VersionHistorySidebar 
          noteId={noteId}
          currentVersion={currentVersion}
          onVersionSelect={handleVersionSelect}
          onVersionRestore={handleVersionRestore}
          onCompareVersions={handleCompareVersions}
        />
      </aside>
    {/if}
  </div>
  
  <!-- Diff viewer modal -->
  {#if showDiffViewer && compareFromVersion !== null && compareToVersion !== null}
    <div class="diff-modal">
      <div class="diff-modal-content">
        <div class="diff-modal-header">
          <h2>Version Comparison</h2>
          <button class="close-button" onclick={closeDiffViewer}>✕</button>
        </div>
        <div class="diff-modal-body">
          <VersionDiffViewer 
            noteId={noteId}
            fromVersion={compareFromVersion}
            toVersion={compareToVersion}
          />
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .note-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #f9fafb;
  }
  
  .note-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    background: white;
    border-bottom: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .back-button {
    padding: 0.5rem 1rem;
    background: #f3f4f6;
    color: #374151;
    text-decoration: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    transition: background 0.2s;
  }
  
  .back-button:hover {
    background: #e5e7eb;
  }
  
  .note-header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
  }
  
  .header-right {
    display: flex;
    gap: 0.5rem;
  }
  
  .toggle-history-button {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }
  
  .toggle-history-button:hover {
    background: #f3f4f6;
    border-color: #9ca3af;
  }
  
  .toggle-history-button.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }
  
  .note-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
  
  .editor-section {
    flex: 1;
    overflow: auto;
    padding: 1.5rem;
    transition: all 0.3s;
  }
  
  .editor-section.full-width {
    max-width: 100%;
  }
  
  .version-sidebar {
    width: 320px;
    flex-shrink: 0;
    background: white;
    border-left: 1px solid #e5e7eb;
    overflow: hidden;
  }
  
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #6b7280;
  }
  
  /* Diff modal */
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
  
  /* Responsive design */
  @media (max-width: 768px) {
    .note-content {
      flex-direction: column;
    }
    
    .version-sidebar {
      width: 100%;
      height: 300px;
      border-left: none;
      border-top: 1px solid #e5e7eb;
    }
    
    .diff-modal {
      padding: 1rem;
    }
    
    .diff-modal-content {
      max-height: 95vh;
    }
  }
</style>
