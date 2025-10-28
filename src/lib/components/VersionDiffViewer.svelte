<script lang="ts">
  import { onMount } from 'svelte';
  import { versionHistoryService } from '../services/version-history.js';
  
  // Props
  export let noteId: string;
  export let fromVersion: number;
  export let toVersion: number;
  export let viewMode: 'side-by-side' | 'inline' | 'unified' = 'side-by-side';
  
  // State
  let loading = true;
  let error: string | null = null;
  let fromText = '';
  let toText = '';
  let diffParts: Array<{ value: string; added?: boolean; removed?: boolean }> = [];
  let changeSummary: {
    linesAdded: number;
    linesRemoved: number;
    linesModified: number;
    charactersAdded: number;
    charactersRemoved: number;
  } | null = null;
  
  // Load version data and generate diff
  async function loadDiff() {
    loading = true;
    error = null;
    
    try {
      // Get both versions
      const [fromData, toData, summary] = await Promise.all([
        versionHistoryService.getVersion(noteId, fromVersion),
        versionHistoryService.getVersion(noteId, toVersion),
        versionHistoryService.getChangeSummary(noteId, fromVersion, toVersion)
      ]);
      
      if (!fromData || !toData) {
        error = 'Failed to load version data';
        return;
      }
      
      // Extract text from Yjs documents
      const Y = await import('yjs');
      const fromDoc = new Y.Doc();
      const toDoc = new Y.Doc();
      
      Y.applyUpdate(fromDoc, fromData.yjsUpdate);
      Y.applyUpdate(toDoc, toData.yjsUpdate);
      
      fromText = fromDoc.getText('content').toString();
      toText = toDoc.getText('content').toString();
      
      // Generate diff based on view mode
      if (viewMode === 'inline' || viewMode === 'unified') {
        diffParts = versionHistoryService.generateWordDiff(fromText, toText);
      }
      
      changeSummary = summary;
    } catch (err) {
      console.error('Failed to load diff:', err);
      error = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      loading = false;
    }
  }
  
  // Reload diff when props change
  $: if (noteId && fromVersion && toVersion) {
    loadDiff();
  }
  
  // Split text into lines for side-by-side view
  function getLines(text: string): string[] {
    return text.split('\n');
  }
  
  // Get line-by-line diff for side-by-side view
  async function getLineDiff(): Promise<Array<{
    fromLine: string | null;
    toLine: string | null;
    type: 'added' | 'removed' | 'modified' | 'unchanged';
  }>> {
    const Diff = await import('diff');
    const changes = Diff.diffLines(fromText, toText);
    const result: Array<{
      fromLine: string | null;
      toLine: string | null;
      type: 'added' | 'removed' | 'modified' | 'unchanged';
    }> = [];
    
    changes.forEach((part) => {
      const lines = part.value.split('\n').filter((line, idx, arr) => {
        // Keep empty lines except the last one if it's empty
        return idx < arr.length - 1 || line.trim() !== '';
      });
      
      if (part.added) {
        lines.forEach(line => {
          result.push({ fromLine: null, toLine: line, type: 'added' });
        });
      } else if (part.removed) {
        lines.forEach(line => {
          result.push({ fromLine: line, toLine: null, type: 'removed' });
        });
      } else {
        lines.forEach(line => {
          result.push({ fromLine: line, toLine: line, type: 'unchanged' });
        });
      }
    });
    
    return result;
  }
  
  let lineDiff: Array<{
    fromLine: string | null;
    toLine: string | null;
    type: 'added' | 'removed' | 'modified' | 'unchanged';
  }> = [];
  
  $: if (fromText && toText && viewMode === 'side-by-side') {
    getLineDiff().then(diff => lineDiff = diff);
  }
</script>

<div class="version-diff-viewer">
  <!-- Header with summary -->
  <div class="diff-header">
    <div class="version-info">
      <span class="version-badge from">Version {fromVersion}</span>
      <span class="arrow">→</span>
      <span class="version-badge to">Version {toVersion}</span>
    </div>
    
    {#if changeSummary}
      <div class="change-summary">
        <span class="stat added">+{changeSummary.linesAdded} lines</span>
        <span class="stat removed">-{changeSummary.linesRemoved} lines</span>
        <span class="stat chars">
          {changeSummary.charactersAdded > 0 ? `+${changeSummary.charactersAdded}` : `-${changeSummary.charactersRemoved}`} chars
        </span>
      </div>
    {/if}
    
    <!-- View mode selector -->
    <div class="view-mode-selector">
      <button 
        class:active={viewMode === 'side-by-side'}
        on:click={() => viewMode = 'side-by-side'}
      >
        Side by Side
      </button>
      <button 
        class:active={viewMode === 'inline'}
        on:click={() => viewMode = 'inline'}
      >
        Inline
      </button>
      <button 
        class:active={viewMode === 'unified'}
        on:click={() => viewMode = 'unified'}
      >
        Unified
      </button>
    </div>
  </div>
  
  <!-- Loading state -->
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading diff...</p>
    </div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
    </div>
  {:else}
    <!-- Diff content -->
    <div class="diff-content">
      {#if viewMode === 'side-by-side'}
        <div class="side-by-side">
          <div class="side from-side">
            <div class="side-header">Version {fromVersion}</div>
            <div class="side-content">
              {#each lineDiff as line, idx}
                <div class="line" class:removed={line.type === 'removed'} class:unchanged={line.type === 'unchanged'}>
                  <span class="line-number">{line.fromLine !== null ? idx + 1 : ''}</span>
                  <span class="line-content">{line.fromLine || ''}</span>
                </div>
              {/each}
            </div>
          </div>
          
          <div class="side to-side">
            <div class="side-header">Version {toVersion}</div>
            <div class="side-content">
              {#each lineDiff as line, idx}
                <div class="line" class:added={line.type === 'added'} class:unchanged={line.type === 'unchanged'}>
                  <span class="line-number">{line.toLine !== null ? idx + 1 : ''}</span>
                  <span class="line-content">{line.toLine || ''}</span>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {:else if viewMode === 'inline'}
        <div class="inline-diff">
          {#each diffParts as part}
            <span 
              class="diff-part"
              class:added={part.added}
              class:removed={part.removed}
            >
              {part.value}
            </span>
          {/each}
        </div>
      {:else if viewMode === 'unified'}
        <div class="unified-diff">
          <pre>{versionHistoryService.generateUnifiedDiff(fromText, toText, fromVersion, toVersion)}</pre>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .version-diff-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  .diff-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    flex-wrap: wrap;
    gap: 1rem;
  }
  
  .version-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .version-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    font-weight: 600;
  }
  
  .version-badge.from {
    background: #fee2e2;
    color: #991b1b;
  }
  
  .version-badge.to {
    background: #dcfce7;
    color: #166534;
  }
  
  .arrow {
    color: #6b7280;
    font-size: 1.25rem;
  }
  
  .change-summary {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
  }
  
  .stat {
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-weight: 500;
  }
  
  .stat.added {
    background: #dcfce7;
    color: #166534;
  }
  
  .stat.removed {
    background: #fee2e2;
    color: #991b1b;
  }
  
  .stat.chars {
    background: #e0e7ff;
    color: #3730a3;
  }
  
  .view-mode-selector {
    display: flex;
    gap: 0.5rem;
  }
  
  .view-mode-selector button {
    padding: 0.5rem 1rem;
    border: 1px solid #d1d5db;
    background: white;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .view-mode-selector button:hover {
    background: #f3f4f6;
  }
  
  .view-mode-selector button.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }
  
  .loading, .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: #6b7280;
  }
  
  .spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .error {
    color: #dc2626;
  }
  
  .diff-content {
    flex: 1;
    overflow: auto;
  }
  
  /* Side by side view */
  .side-by-side {
    display: grid;
    grid-template-columns: 1fr 1fr;
    height: 100%;
  }
  
  .side {
    display: flex;
    flex-direction: column;
    border-right: 1px solid #e5e7eb;
  }
  
  .side:last-child {
    border-right: none;
  }
  
  .side-header {
    padding: 0.75rem 1rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    font-weight: 600;
    font-size: 0.875rem;
    color: #374151;
  }
  
  .side-content {
    flex: 1;
    overflow: auto;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
  }
  
  .line {
    display: flex;
    min-height: 1.5rem;
    padding: 0 0.5rem;
  }
  
  .line.added {
    background: #dcfce7;
  }
  
  .line.removed {
    background: #fee2e2;
  }
  
  .line.unchanged {
    background: transparent;
  }
  
  .line-number {
    display: inline-block;
    width: 3rem;
    text-align: right;
    padding-right: 1rem;
    color: #9ca3af;
    user-select: none;
    flex-shrink: 0;
  }
  
  .line-content {
    flex: 1;
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  /* Inline view */
  .inline-diff {
    padding: 1rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  .diff-part {
    display: inline;
  }
  
  .diff-part.added {
    background: #dcfce7;
    color: #166534;
  }
  
  .diff-part.removed {
    background: #fee2e2;
    color: #991b1b;
    text-decoration: line-through;
  }
  
  /* Unified view */
  .unified-diff {
    padding: 1rem;
    background: #1f2937;
    color: #f9fafb;
    overflow: auto;
  }
  
  .unified-diff pre {
    margin: 0;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
    white-space: pre;
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .side-by-side {
      grid-template-columns: 1fr;
    }
    
    .side {
      border-right: none;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .side:last-child {
      border-bottom: none;
    }
    
    .diff-header {
      flex-direction: column;
      align-items: flex-start;
    }
    
    .view-mode-selector {
      width: 100%;
    }
    
    .view-mode-selector button {
      flex: 1;
    }
  }
</style>
