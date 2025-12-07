<script lang="ts">
  import { onMount } from 'svelte';
  import type { VersionEntry } from '$lib/types';
  import { versionHistoryService } from '$lib/services';

  interface Props {
    noteId: string;
    currentVersion?: number;
    onVersionSelect?: (version: number) => void;
    onVersionRestore?: (version: number) => void;
    onCompareVersions?: (fromVersion: number, toVersion: number) => void;
  }

  let { 
    noteId, 
    currentVersion = 1,
    onVersionSelect,
    onVersionRestore,
    onCompareVersions
  }: Props = $props();

  let versions: VersionEntry[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let selectedVersion = $state<number | null>(null);
  let compareMode = $state(false);
  let compareFromVersion = $state<number | null>(null);
  let compareToVersion = $state<number | null>(null);

  onMount(async () => {
    await loadVersionHistory();
  });

  async function loadVersionHistory() {
    try {
      loading = true;
      error = null;
      versions = await versionHistoryService.getVersionHistory(noteId);
      versions.sort((a, b) => b.version - a.version); // Most recent first
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load version history';
      console.error('Failed to load version history:', err);
    } finally {
      loading = false;
    }
  }

  function handleVersionClick(version: number) {
    if (compareMode) {
      if (compareFromVersion === null) {
        compareFromVersion = version;
      } else if (compareToVersion === null && version !== compareFromVersion) {
        compareToVersion = version;
        // Trigger comparison
        if (onCompareVersions) {
          const [from, to] = [compareFromVersion, version].sort((a, b) => a - b);
          onCompareVersions(from, to);
        }
      } else {
        // Reset selection
        compareFromVersion = version;
        compareToVersion = null;
      }
    } else {
      selectedVersion = version;
      if (onVersionSelect) {
        onVersionSelect(version);
      }
    }
  }

  function handleRestoreVersion(version: number) {
    if (confirm(`Are you sure you want to restore version ${version}? This will create a new version with the restored content.`)) {
      if (onVersionRestore) {
        onVersionRestore(version);
      }
    }
  }

  function toggleCompareMode() {
    compareMode = !compareMode;
    compareFromVersion = null;
    compareToVersion = null;
    selectedVersion = null;
  }

  function formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return date.toLocaleDateString();
    } else if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }

  function isVersionSelected(version: number): boolean {
    if (compareMode) {
      return version === compareFromVersion || version === compareToVersion;
    }
    return version === selectedVersion;
  }

  function getVersionLabel(version: number): string {
    if (version === currentVersion) {
      return 'Current';
    }
    return '';
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  }
</script>

<div class="version-history-sidebar">
  <div class="sidebar-header">
    <h3>Version History</h3>
    <button 
      class="compare-toggle"
      class:active={compareMode}
      onclick={toggleCompareMode}
      title={compareMode ? 'Exit compare mode' : 'Compare versions'}
    >
      {compareMode ? '✕ Exit Compare' : '⚖ Compare'}
    </button>
  </div>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading version history...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p class="error-message">{error}</p>
      <button onclick={loadVersionHistory} class="retry-button">
        Retry
      </button>
    </div>
  {:else if versions.length === 0}
    <div class="empty-state">
      <p>No version history available</p>
      <small>Versions will appear here as you save changes</small>
    </div>
  {:else}
    <div class="version-list">
      {#if compareMode}
        <div class="compare-instructions">
          <p>
            {#if compareFromVersion === null}
              Select first version to compare
            {:else if compareToVersion === null}
              Select second version to compare
            {:else}
              Comparing versions {compareFromVersion} and {compareToVersion}
            {/if}
          </p>
        </div>
      {/if}

      {#each versions as version (version.version)}
        <div 
          class="version-item"
          class:selected={isVersionSelected(version.version)}
          class:current={version.version === currentVersion}
          onclick={() => handleVersionClick(version.version)}
          onkeydown={(e) => e.key === 'Enter' && handleVersionClick(version.version)}
          role="button"
          tabindex="0"
        >
          <div class="version-header">
            <div class="version-number">
              <strong>Version {version.version}</strong>
              {#if getVersionLabel(version.version)}
                <span class="version-label">{getVersionLabel(version.version)}</span>
              {/if}
            </div>
            {#if !compareMode && version.version !== currentVersion}
              <button
                class="restore-button"
                onclick={(e) => {
                  e.stopPropagation();
                  handleRestoreVersion(version.version);
                }}
                title="Restore this version"
              >
                ↺
              </button>
            {/if}
          </div>
          
          <div class="version-meta">
            <time datetime={version.timestamp.toISOString()}>
              {formatDate(version.timestamp)}
            </time>
          </div>

          {#if version.changeDescription}
            <div class="version-description">
              {version.changeDescription}
            </div>
          {/if}

          <div class="version-stats">
            {#if version.changeType}
              <span class="stat-badge change-type" class:create={version.changeType === 'create'} 
                    class:major={version.changeType === 'major-edit'} 
                    class:minor={version.changeType === 'minor-edit'}>
                {version.changeType === 'create' ? '✨ Created' : 
                 version.changeType === 'major-edit' ? '🔥 Major Edit' :
                 version.changeType === 'minor-edit' ? '✏️ Minor Edit' :
                 version.changeType === 'restore' ? '↺ Restored' : '📝 Edit'}
              </span>
            {/if}
            
            {#if version.linesAdded !== undefined || version.linesRemoved !== undefined}
              <span class="stat-badge changes">
                {#if version.linesAdded && version.linesAdded > 0}
                  <span class="added">+{version.linesAdded}</span>
                {/if}
                {#if version.linesRemoved && version.linesRemoved > 0}
                  <span class="removed">-{version.linesRemoved}</span>
                {/if}
              </span>
            {/if}
            
            {#if version.contentSize}
              <span class="stat-badge size">
                {formatSize(version.contentSize)}
              </span>
            {/if}
          </div>

          {#if version.tags && version.tags.length > 0}
            <div class="version-tags">
              {#each version.tags as tag}
                <span class="tag">{tag}</span>
              {/each}
            </div>
          {/if}

          {#if version.storachaCID}
            <div class="version-cid">
              <small title={version.storachaCID}>
                CID: {version.storachaCID.substring(0, 12)}...
              </small>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .version-history-sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #ffffff;
    border-left: 1px solid #e5e7eb;
    overflow: hidden;
  }

  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .sidebar-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
  }

  .compare-toggle {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .compare-toggle:hover {
    background: #f3f4f6;
    border-color: #9ca3af;
  }

  .compare-toggle.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    text-align: center;
    color: #6b7280;
  }

  .spinner {
    width: 2rem;
    height: 2rem;
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
    font-size: 0.875rem;
  }

  .retry-button:hover {
    background: #2563eb;
  }

  .empty-state small {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.75rem;
  }

  .version-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .compare-instructions {
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: #1e40af;
  }

  .compare-instructions p {
    margin: 0;
  }

  .version-item {
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .version-item:hover {
    border-color: #3b82f6;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .version-item.selected {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  .version-item.current {
    border-color: #10b981;
    background: #f0fdf4;
  }

  .version-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .version-number {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .version-label {
    padding: 0.125rem 0.5rem;
    background: #10b981;
    color: white;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 0.25rem;
  }

  .restore-button {
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: 1px solid #d1d5db;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .restore-button:hover {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  .version-meta {
    font-size: 0.75rem;
    color: #6b7280;
    margin-bottom: 0.25rem;
  }

  .version-description {
    font-size: 0.875rem;
    color: #374151;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #f3f4f6;
  }

  .version-cid {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: #9ca3af;
    font-family: monospace;
  }

  .version-cid small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .version-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .stat-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    border-radius: 0.25rem;
    font-weight: 500;
  }

  .stat-badge.change-type {
    background: #e0e7ff;
    color: #3730a3;
  }

  .stat-badge.change-type.create {
    background: #dcfce7;
    color: #166534;
  }

  .stat-badge.change-type.major {
    background: #fee2e2;
    color: #991b1b;
  }

  .stat-badge.change-type.minor {
    background: #fef3c7;
    color: #92400e;
  }

  .stat-badge.changes {
    background: #f3f4f6;
    color: #374151;
  }

  .stat-badge.changes .added {
    color: #166534;
    font-weight: 600;
  }

  .stat-badge.changes .removed {
    color: #991b1b;
    font-weight: 600;
  }

  .stat-badge.size {
    background: #f3f4f6;
    color: #6b7280;
  }

  .version-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.5rem;
  }

  .tag {
    padding: 0.125rem 0.5rem;
    background: #e0e7ff;
    color: #3730a3;
    font-size: 0.75rem;
    border-radius: 0.25rem;
  }
</style>
