<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { 
    DatabaseSchema, 
    DatabaseManifest,
    DatabaseRow, 
    DatabaseView,
    PropertyDefinition,
    PropertyValue,
    SortRule,
    FilterGroup,
    ViewType
  } from '$lib/types/database';
  import { databaseService } from '$lib/services/database-service';
  import TableView from './TableView.svelte';
  import BoardView from './BoardView.svelte';
  import CalendarView from './CalendarView.svelte';
  import GalleryView from './GalleryView.svelte';
  import AddPropertyModal from './AddPropertyModal.svelte';
  import ShareModal from './ShareModal.svelte';

  // Props
  export let databaseId: string;
  export let readonly: boolean = false;
  export let onRowOpen: ((row: DatabaseRow) => void) | undefined = undefined;

  // State
  let manifest = $state<DatabaseManifest | null>(null);
  let rows = $state<DatabaseRow[]>([]);
  let groupedRows = $state<Map<string, DatabaseRow[]>>(new Map());
  let currentViewId = $state<string | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let syncing = $state(false);
  let showAddPropertyModal = $state(false);
  let showShareModal = $state(false);
  let showViewMenu = $state(false);

  // Computed
  function getCurrentView(): DatabaseView | null {
    if (!manifest) return null;
    if (currentViewId) {
      return manifest.schema.views.find(v => v.id === currentViewId) || manifest.schema.views[0];
    }
    return manifest.schema.views[0];
  }

  // Load database
  async function loadDatabase() {
    loading = true;
    error = null;

    try {
      await databaseService.initialize();
      manifest = await databaseService.getDatabase(databaseId);
      
      if (!manifest) {
        error = 'Database not found';
        return;
      }

      currentViewId = manifest.schema.views[0]?.id || null;
      await loadRows();
    } catch (err) {
      console.error('Failed to load database:', err);
      error = 'Failed to load database';
    } finally {
      loading = false;
    }
  }

  // Load rows based on current view
  async function loadRows() {
    if (!manifest) return;

    const view = getCurrentView();
    if (!view) return;

    const result = await databaseService.queryRows({
      databaseId,
      filter: view.filters,
      sorts: view.sorts
    });

    rows = result.rows;

    // Load grouped rows for board view
    if (view.type === 'board' && view.groupBy) {
      groupedRows = await databaseService.getGroupedRows(databaseId, view.groupBy, view.filters);
    }
  }

  // Row operations
  async function handleAddRow(groupId?: string) {
    if (!manifest || readonly) return;

    const view = getCurrentView();
    const properties: Record<string, PropertyValue> = {};

    // If adding to a specific group (board view), set the groupBy property
    if (groupId && groupId !== '_none' && view?.groupBy) {
      properties[view.groupBy] = { type: 'select', value: groupId };
    }

    const row = await databaseService.createRow(databaseId, properties);
    if (row) {
      await loadRows();
      onRowOpen?.(row);
    }
  }

  async function handleRowUpdate(rowId: string, propertyId: string, value: PropertyValue) {
    if (readonly) return;

    await databaseService.updateRow(rowId, { [propertyId]: value });
    await loadRows();
  }

  async function handleDeleteRow(rowId: string) {
    if (readonly) return;

    await databaseService.deleteRow(rowId);
    await loadRows();
  }

  // View operations
  async function handleViewChange(viewId: string) {
    currentViewId = viewId;
    await loadRows();
    showViewMenu = false;
  }

  async function handleAddView(type: ViewType) {
    if (!manifest || readonly) return;

    const viewNames: Record<ViewType, string> = {
      table: 'Table',
      board: 'Board',
      calendar: 'Calendar',
      gallery: 'Gallery',
      timeline: 'Timeline',
      list: 'List'
    };

    const view = await databaseService.addView(databaseId, viewNames[type], type);
    if (view) {
      manifest = await databaseService.getDatabase(databaseId);
      currentViewId = view.id;
      await loadRows();
    }
    showViewMenu = false;
  }

  async function handleSortChange(sorts: SortRule[]) {
    if (!manifest || readonly) return;

    const view = getCurrentView();
    if (!view) return;

    await databaseService.updateView(databaseId, view.id, { sorts });
    manifest = await databaseService.getDatabase(databaseId);
    await loadRows();
  }

  // Property operations
  async function handleAddProperty(property: PropertyDefinition) {
    if (!manifest || readonly) return;

    await databaseService.addProperty(databaseId, property);
    manifest = await databaseService.getDatabase(databaseId);
    await loadRows();
    showAddPropertyModal = false;
  }

  // Sync to Storacha
  async function handleSync() {
    if (!manifest || syncing) return;

    syncing = true;
    try {
      const cid = await databaseService.syncToStoracha(databaseId);
      if (cid) {
        console.log('Database synced with CID:', cid);
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      syncing = false;
    }
  }

  // Lifecycle
  onMount(() => {
    loadDatabase();
  });

  // View type icons
  function getViewIcon(type: ViewType): string {
    switch (type) {
      case 'table': return '☰';
      case 'board': return '▦';
      case 'calendar': return '📅';
      case 'gallery': return '▤';
      case 'timeline': return '━';
      case 'list': return '☷';
      default: return '•';
    }
  }
</script>

<div class="database-container">
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading database...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p>{error}</p>
      <button onclick={loadDatabase}>Retry</button>
    </div>
  {:else if manifest}
    <!-- Header -->
    <div class="database-header">
      <div class="header-left">
        {#if manifest.schema.icon}
          <span class="database-icon">{manifest.schema.icon}</span>
        {/if}
        <h1 class="database-title">{manifest.schema.name}</h1>
      </div>

      <div class="header-actions">
        <button 
          class="action-btn"
          onclick={() => showShareModal = true}
          title="Share"
        >
          🔗 Share
        </button>
        <button 
          class="action-btn"
          class:syncing
          onclick={handleSync}
          disabled={syncing}
          title="Sync to Storacha"
        >
          {syncing ? '⟳' : '☁'} {syncing ? 'Syncing...' : 'Sync'}
        </button>
      </div>
    </div>

    <!-- View Tabs -->
    <div class="view-tabs">
      <div class="tabs-list">
        {#each manifest.schema.views as view (view.id)}
          <button 
            class="view-tab"
            class:active={currentViewId === view.id}
            onclick={() => handleViewChange(view.id)}
          >
            <span class="view-icon">{getViewIcon(view.type)}</span>
            <span class="view-name">{view.name}</span>
          </button>
        {/each}

        {#if !readonly}
          <div class="add-view-wrapper">
            <button 
              class="add-view-btn"
              onclick={() => showViewMenu = !showViewMenu}
            >
              +
            </button>
            {#if showViewMenu}
              <div class="view-menu">
                <button onclick={() => handleAddView('table')}>
                  <span>☰</span> Table
                </button>
                <button onclick={() => handleAddView('board')}>
                  <span>▦</span> Board
                </button>
                <button onclick={() => handleAddView('calendar')}>
                  <span>📅</span> Calendar
                </button>
                <button onclick={() => handleAddView('gallery')}>
                  <span>▤</span> Gallery
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="view-actions">
        <!-- Filter and sort controls could go here -->
      </div>
    </div>

    <!-- View Content -->
    <div class="view-content">
      {#if getCurrentView()}
        {@const view = getCurrentView()!}
        {#if view.type === 'table'}
          <TableView 
            schema={manifest.schema}
            {rows}
            {view}
            {readonly}
            onRowClick={onRowOpen}
            onRowUpdate={handleRowUpdate}
            onAddRow={() => handleAddRow()}
            onDeleteRow={handleDeleteRow}
            onSortChange={handleSortChange}
            onPropertyAdd={() => showAddPropertyModal = true}
          />
        {:else if view.type === 'board'}
          <BoardView 
            schema={manifest.schema}
            {rows}
            {view}
            {groupedRows}
            {readonly}
            onRowClick={onRowOpen}
            onRowUpdate={handleRowUpdate}
            onAddRow={handleAddRow}
            onDeleteRow={handleDeleteRow}
          />
        {:else if view.type === 'calendar'}
          <CalendarView 
            schema={manifest.schema}
            {rows}
            {view}
            {readonly}
            onRowClick={onRowOpen}
            onAddRow={() => handleAddRow()}
          />
        {:else if view.type === 'gallery'}
          <GalleryView 
            schema={manifest.schema}
            {rows}
            {view}
            {readonly}
            onRowClick={onRowOpen}
            onAddRow={() => handleAddRow()}
          />
        {:else}
          <div class="unsupported-view">
            <p>View type "{view.type}" is not yet supported</p>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<!-- Modals -->
{#if showAddPropertyModal}
  <AddPropertyModal 
    onAdd={handleAddProperty}
    onClose={() => showAddPropertyModal = false}
  />
{/if}

{#if showShareModal && manifest}
  <ShareModal 
    databaseId={databaseId}
    databaseName={manifest.schema.name}
    onClose={() => showShareModal = false}
  />
{/if}

{#if showViewMenu}
  <button 
    class="menu-backdrop"
    onclick={() => showViewMenu = false}
    aria-label="Close menu"
  ></button>
{/if}

<style>
  .database-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary, #ffffff);
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 1rem;
    color: var(--text-tertiary, #9ca3af);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color, #e5e7eb);
    border-top-color: var(--accent-color, #3b82f6);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-state button {
    padding: 0.5rem 1rem;
    background: var(--accent-color, #3b82f6);
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
  }

  .database-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .database-icon {
    font-size: 1.5rem;
  }

  .database-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary, #111827);
    margin: 0;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.8125rem;
    color: var(--text-secondary, #6b7280);
    transition: all 0.15s;
  }

  .action-btn:hover {
    background: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #111827);
  }

  .action-btn.syncing {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .view-tabs {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1.5rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .tabs-list {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .view-tab {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.8125rem;
    color: var(--text-secondary, #6b7280);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all 0.15s;
  }

  .view-tab:hover {
    color: var(--text-primary, #111827);
  }

  .view-tab.active {
    color: var(--text-primary, #111827);
    border-bottom-color: var(--accent-color, #3b82f6);
  }

  .view-icon {
    font-size: 0.875rem;
  }

  .add-view-wrapper {
    position: relative;
  }

  .add-view-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    cursor: pointer;
    color: var(--text-tertiary, #9ca3af);
    font-size: 1rem;
    margin-left: 0.5rem;
  }

  .add-view-btn:hover {
    background: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #111827);
  }

  .view-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 0.25rem;
    min-width: 150px;
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 100;
    padding: 0.25rem;
  }

  .view-menu button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.8125rem;
    color: var(--text-primary, #111827);
    border-radius: 0.375rem;
    text-align: left;
  }

  .view-menu button:hover {
    background: var(--bg-hover, #f3f4f6);
  }

  .view-content {
    flex: 1;
    overflow: hidden;
  }

  .unsupported-view {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-tertiary, #9ca3af);
  }

  .menu-backdrop {
    position: fixed;
    inset: 0;
    background: transparent;
    z-index: 99;
    border: none;
    cursor: default;
  }
</style>
