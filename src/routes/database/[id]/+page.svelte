<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import type { DatabaseRow, DatabaseManifest } from '$lib/types/database';
  import { databaseService } from '$lib/services/database-service';
  import { Database } from '$lib/components/database';

  // Get database ID from route params
  let databaseId = $derived($page.params.id);
  
  // State
  let manifest = $state<DatabaseManifest | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let selectedRow = $state<DatabaseRow | null>(null);
  let showRowEditor = $state(false);

  async function loadDatabase() {
    loading = true;
    error = null;

    try {
      await databaseService.initialize();
      manifest = await databaseService.getDatabase(databaseId);
      
      if (!manifest) {
        error = 'Database not found';
      }
    } catch (err) {
      console.error('Failed to load database:', err);
      error = 'Failed to load database';
    } finally {
      loading = false;
    }
  }

  function handleRowOpen(row: DatabaseRow) {
    selectedRow = row;
    showRowEditor = true;
  }

  function closeRowEditor() {
    selectedRow = null;
    showRowEditor = false;
  }

  onMount(() => {
    loadDatabase();
  });

  // Reload when database ID changes
  $effect(() => {
    if (databaseId) {
      loadDatabase();
    }
  });
</script>

<svelte:head>
  <title>{manifest?.schema.name || 'Database'} | Storacha Notes</title>
</svelte:head>

<div class="database-page">
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading database...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <h2>{error}</h2>
      <p>The database you're looking for doesn't exist or couldn't be loaded.</p>
      <div class="error-actions">
        <a href="/database" class="btn-secondary">← Back to Databases</a>
        <button class="btn-primary" onclick={loadDatabase}>Try Again</button>
      </div>
    </div>
  {:else if manifest}
    <Database 
      {databaseId}
      onRowOpen={handleRowOpen}
    />
  {/if}
</div>

<!-- Row Editor Sidebar -->
{#if showRowEditor && selectedRow && manifest}
  <div class="row-editor-backdrop" onclick={closeRowEditor}>
    <div class="row-editor" onclick={(e) => e.stopPropagation()}>
      <div class="editor-header">
        <h2>Edit Entry</h2>
        <button class="close-btn" onclick={closeRowEditor}>×</button>
      </div>
      
      <div class="editor-content">
        {#each manifest.schema.properties as property (property.id)}
          {@const value = selectedRow.properties[property.id]}
          <div class="property-row">
            <label class="property-label">
              <span class="label-icon">{getPropertyIcon(property.type)}</span>
              {property.name}
            </label>
            <div class="property-value">
              {#if property.type === 'text'}
                <input
                  type="text"
                  value={value?.type === 'text' ? value.value : ''}
                  oninput={(e) => updateProperty(property.id, { type: 'text', value: e.currentTarget.value })}
                />
              {:else if property.type === 'number'}
                <input
                  type="number"
                  value={value?.type === 'number' ? value.value ?? '' : ''}
                  oninput={(e) => updateProperty(property.id, { type: 'number', value: e.currentTarget.value ? parseFloat(e.currentTarget.value) : null })}
                />
              {:else if property.type === 'checkbox'}
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    checked={value?.type === 'checkbox' ? value.value : false}
                    onchange={(e) => updateProperty(property.id, { type: 'checkbox', value: e.currentTarget.checked })}
                  />
                  <span>{value?.type === 'checkbox' && value.value ? 'Yes' : 'No'}</span>
                </label>
              {:else if property.type === 'date'}
                <input
                  type="date"
                  value={value?.type === 'date' && value.value ? value.value.start.split('T')[0] : ''}
                  oninput={(e) => updateProperty(property.id, { 
                    type: 'date', 
                    value: e.currentTarget.value ? { start: new Date(e.currentTarget.value).toISOString() } : null 
                  })}
                />
              {:else if property.type === 'select'}
                <select
                  value={value?.type === 'select' ? value.value ?? '' : ''}
                  onchange={(e) => updateProperty(property.id, { type: 'select', value: e.currentTarget.value || null })}
                >
                  <option value="">Select...</option>
                  {#each property.options || [] as option (option.id)}
                    <option value={option.id}>{option.name}</option>
                  {/each}
                </select>
              {:else if property.type === 'url'}
                <input
                  type="url"
                  value={value?.type === 'url' ? value.value ?? '' : ''}
                  oninput={(e) => updateProperty(property.id, { type: 'url', value: e.currentTarget.value || null })}
                  placeholder="https://..."
                />
              {:else if property.type === 'createdTime' || property.type === 'lastEditedTime'}
                <span class="readonly-value">
                  {value?.type === 'timestamp' ? new Date(value.value).toLocaleString() : '-'}
                </span>
              {:else}
                <span class="readonly-value">
                  {JSON.stringify(value?.value ?? '-')}
                </span>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <div class="editor-footer">
        <button class="btn-danger" onclick={deleteCurrentRow}>
          🗑 Delete
        </button>
        <button class="btn-primary" onclick={closeRowEditor}>
          Done
        </button>
      </div>
    </div>
  </div>
{/if}

<script context="module" lang="ts">
  import type { PropertyValue, PropertyType } from '$lib/types/database';

  function getPropertyIcon(type: PropertyType): string {
    switch (type) {
      case 'text': return 'Aa';
      case 'number': return '#';
      case 'date': return '📅';
      case 'checkbox': return '☑';
      case 'select': return '▼';
      case 'multiSelect': return '⊞';
      case 'url': return '🔗';
      case 'email': return '✉';
      case 'phone': return '📞';
      case 'createdTime': return '🕐';
      case 'lastEditedTime': return '🕐';
      default: return '•';
    }
  }
</script>

<script lang="ts">
  async function updateProperty(propertyId: string, value: PropertyValue) {
    if (!selectedRow) return;

    await databaseService.updateRow(selectedRow.id, { [propertyId]: value });
    
    // Refresh the row
    const updatedRow = await databaseService.getRow(selectedRow.id);
    if (updatedRow) {
      selectedRow = updatedRow;
    }
  }

  async function deleteCurrentRow() {
    if (!selectedRow) return;

    if (confirm('Are you sure you want to delete this entry?')) {
      await databaseService.deleteRow(selectedRow.id);
      closeRowEditor();
    }
  }
</script>

<style>
  .database-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary, #ffffff);
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 2rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color, #e5e7eb);
    border-top-color: var(--accent-color, #3b82f6);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-state p {
    color: var(--text-tertiary, #9ca3af);
  }

  .error-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .error-state h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    margin: 0 0 0.5rem 0;
  }

  .error-state p {
    color: var(--text-tertiary, #9ca3af);
    margin: 0 0 1.5rem 0;
  }

  .error-actions {
    display: flex;
    gap: 0.75rem;
  }

  .btn-secondary,
  .btn-primary,
  .btn-danger {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.15s;
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--border-color, #e5e7eb);
    color: var(--text-secondary, #6b7280);
  }

  .btn-secondary:hover {
    background: var(--bg-hover, #f3f4f6);
  }

  .btn-primary {
    background: var(--accent-color, #3b82f6);
    border: none;
    color: white;
  }

  .btn-primary:hover {
    background: var(--accent-hover, #2563eb);
  }

  .btn-danger {
    background: transparent;
    border: 1px solid var(--error-color, #ef4444);
    color: var(--error-color, #ef4444);
  }

  .btn-danger:hover {
    background: var(--error-light, #fef2f2);
  }

  /* Row Editor Sidebar */
  .row-editor-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 1000;
    display: flex;
    justify-content: flex-end;
  }

  .row-editor {
    width: 100%;
    max-width: 480px;
    height: 100%;
    background: var(--bg-primary, #ffffff);
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .editor-header h2 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    margin: 0;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 0.375rem;
    color: var(--text-tertiary, #9ca3af);
    font-size: 1.25rem;
  }

  .close-btn:hover {
    background: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #111827);
  }

  .editor-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .property-row {
    margin-bottom: 1.25rem;
  }

  .property-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary, #6b7280);
    margin-bottom: 0.375rem;
  }

  .label-icon {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .property-value input,
  .property-value select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: var(--text-primary, #111827);
    background: var(--bg-primary, #ffffff);
  }

  .property-value input:focus,
  .property-value select:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
    box-shadow: 0 0 0 3px var(--accent-light, #e0f2fe);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--accent-color, #3b82f6);
  }

  .readonly-value {
    font-size: 0.875rem;
    color: var(--text-tertiary, #9ca3af);
    padding: 0.5rem 0;
  }

  .editor-footer {
    display: flex;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border-color, #e5e7eb);
  }
</style>
