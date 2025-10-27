<script lang="ts">
  import { onMount } from 'svelte';
  import { versionHistoryService } from '$lib/services';
  import * as Y from 'yjs';

  interface Props {
    noteId: string;
    fromVersion: number;
    toVersion: number;
    onClose?: () => void;
  }

  let { noteId, fromVersion, toVersion, onClose }: Props = $props();

  let loading = $state(true);
  let error = $state<string | null>(null);
  let fromText = $state('');
  let toText = $state('');
  let unifiedDiff = $state('');
  let changeSummary = $state<{
    linesAdded: number;
    linesRemoved: number;
    linesModified: number;
    charactersAdded: number;
    charactersRemoved: number;
  } | null>(null);
  let viewMode = $state<'side-by-side' | 'unified'>('side-by-side');

  onMount(async () => {
    await loadComparison();
  });

  async function loadComparison() {
    try {
      loading = true;
      error = null;

      // Load both versions
      const [fromData, toData, summary] = await Promise.all([
        versionHistoryService.getVersion(noteId, fromVersion),
        versionHistoryService.getVersion(noteId, toVersion),
        versionHistoryService.getChangeSummary(noteId, fromVersion, toVersion)
      ]);

      if (!fromData || !toData) {
        throw new Error('Failed to load version data');
      }

      // Extract text content from Yjs documents
      const fromDoc = new Y.Doc();
      const toDoc = new Y.Doc();
      
      Y.applyUpdate(fromDoc, fromData.yjsUpdate);
      Y.applyUpdate(toDoc, toData.yjsUpdate);

      fromText = fromDoc.getText('content').toString();
      toText = toDoc.getText('content').toString();

      // Generate unified diff
      unifiedDiff = versionHistoryService.generateUnifiedDiff(
        fromText,
        toText,
        fromVersion,
        toVersion
      );

      changeSummary = summary;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load comparison';
      console.error('Failed to load version comparison:', err);
    } finally {
      loading = false;
    }
  }

  function getDiffLines(): Array<{ type: 'added' | 'removed' | 'unchanged'; content: string }> {
    const lines = unifiedDiff.split('\n').slice(3); // Skip header lines
    return lines.map(line => {
      if (line.startsWith('+')) {
        return { type: 'added', content: line.substring(1) };
      } else if (line.startsWith('-')) {
        return { type: 'removed', content: line.substring(1) };
      } else {
        return { type: 'unchanged', content: line.substring(1) };
      }
    });
  }
</script>

<div class="version-comparison-view">
  <div class="comparison-header">
    <div class="header-content">
      <h2>Version Comparison</h2>
      <div class="version-info">
        <span class="version-badge from">Version {fromVersion}</span>
        <span class="arrow">→</span>
        <span class="version-badge to">Version {toVersion}</span>
      </div>
    </div>
    
    <div class="header-actions">
      <div class="view-mode-toggle">
        <button
          class:active={viewMode === 'side-by-side'}
          onclick={() => viewMode = 'side-by-side'}
        >
          Side by Side
        </button>
        <button
          class:active={viewMode === 'unified'}
          onclick={() => viewMode = 'unified'}
        >
          Unified
        </button>
      </div>
      
      {#if onClose}
        <button class="close-button" onclick={onClose}>
          ✕
        </button>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading comparison...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p class="error-message">{error}</p>
      <button onclick={loadComparison} class="retry-button">
        Retry
      </button>
    </div>
  {:else}
    {#if changeSummary}
      <div class="change-summary">
        <div class="summary-item added">
          <span class="summary-label">Added:</span>
          <span class="summary-value">
            {changeSummary.linesAdded} lines ({changeSummary.charactersAdded} chars)
          </span>
        </div>
        <div class="summary-item removed">
          <span class="summary-label">Removed:</span>
          <span class="summary-value">
            {changeSummary.linesRemoved} lines ({changeSummary.charactersRemoved} chars)
          </span>
        </div>
        {#if changeSummary.linesModified > 0}
          <div class="summary-item modified">
            <span class="summary-label">Modified:</span>
            <span class="summary-value">{changeSummary.linesModified} lines</span>
          </div>
        {/if}
      </div>
    {/if}

    <div class="comparison-content">
      {#if viewMode === 'side-by-side'}
        <div class="side-by-side-view">
          <div class="version-panel from">
            <div class="panel-header">Version {fromVersion}</div>
            <pre class="code-content">{fromText}</pre>
          </div>
          <div class="version-panel to">
            <div class="panel-header">Version {toVersion}</div>
            <pre class="code-content">{toText}</pre>
          </div>
        </div>
      {:else}
        <div class="unified-view">
          <div class="diff-content">
            {#each getDiffLines() as line}
              <div class="diff-line {line.type}">
                <span class="line-marker">
                  {#if line.type === 'added'}+{:else if line.type === 'removed'}-{:else}&nbsp;{/if}
                </span>
                <span class="line-content">{line.content}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .version-comparison-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #ffffff;
  }

  .comparison-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 2px solid #e5e7eb;
    background: #f9fafb;
  }

  .header-content h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
  }

  .version-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .version-badge {
    padding: 0.25rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 0.375rem;
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
    font-weight: bold;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .view-mode-toggle {
    display: flex;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    overflow: hidden;
  }

  .view-mode-toggle button {
    padding: 0.5rem 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .view-mode-toggle button:not(:last-child) {
    border-right: 1px solid #d1d5db;
  }

  .view-mode-toggle button:hover {
    background: #f3f4f6;
  }

  .view-mode-toggle button.active {
    background: #3b82f6;
    color: white;
  }

  .close-button {
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 1.25rem;
    line-height: 1;
    transition: all 0.2s;
  }

  .close-button:hover {
    background: #fee2e2;
    border-color: #dc2626;
    color: #dc2626;
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    text-align: center;
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

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-message {
    color: #dc2626;
    margin-bottom: 1rem;
  }

  .retry-button {
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
  }

  .retry-button:hover {
    background: #2563eb;
  }

  .change-summary {
    display: flex;
    gap: 1.5rem;
    padding: 1rem 1.5rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  .summary-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .summary-label {
    font-weight: 600;
  }

  .summary-item.added {
    color: #166534;
  }

  .summary-item.removed {
    color: #991b1b;
  }

  .summary-item.modified {
    color: #1e40af;
  }

  .comparison-content {
    flex: 1;
    overflow: hidden;
  }

  .side-by-side-view {
    display: grid;
    grid-template-columns: 1fr 1fr;
    height: 100%;
    gap: 1px;
    background: #e5e7eb;
  }

  .version-panel {
    display: flex;
    flex-direction: column;
    background: #ffffff;
    overflow: hidden;
  }

  .panel-header {
    padding: 0.75rem 1rem;
    background: #f3f4f6;
    border-bottom: 1px solid #e5e7eb;
    font-weight: 600;
    font-size: 0.875rem;
    color: #374151;
  }

  .version-panel.from .panel-header {
    background: #fef2f2;
    color: #991b1b;
  }

  .version-panel.to .panel-header {
    background: #f0fdf4;
    color: #166534;
  }

  .code-content {
    flex: 1;
    margin: 0;
    padding: 1rem;
    overflow: auto;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .unified-view {
    height: 100%;
    overflow: auto;
  }

  .diff-content {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
    line-height: 1.6;
  }

  .diff-line {
    display: flex;
    padding: 0.25rem 0;
  }

  .diff-line.added {
    background: #dcfce7;
  }

  .diff-line.removed {
    background: #fee2e2;
  }

  .line-marker {
    display: inline-block;
    width: 2rem;
    padding: 0 0.5rem;
    text-align: center;
    flex-shrink: 0;
    font-weight: bold;
  }

  .diff-line.added .line-marker {
    color: #166534;
  }

  .diff-line.removed .line-marker {
    color: #991b1b;
  }

  .line-content {
    flex: 1;
    padding: 0 1rem;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>
