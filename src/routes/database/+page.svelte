<script lang="ts">
  import { onMount } from 'svelte';
  import type { DatabaseSchema } from '$lib/types/database';
  import { databaseService } from '$lib/services/database-service';

  // State
  let databases = $state<DatabaseSchema[]>([]);
  let loading = $state(true);
  let showCreateModal = $state(false);
  let newDbName = $state('');
  let newDbIcon = $state('📊');
  let creating = $state(false);

  const defaultIcons = ['📊', '📋', '📝', '📁', '🗂️', '📈', '🎯', '✅', '🚀', '💡'];

  async function loadDatabases() {
    loading = true;
    try {
      await databaseService.initialize();
      databases = await databaseService.listDatabases();
    } catch (error) {
      console.error('Failed to load databases:', error);
    } finally {
      loading = false;
    }
  }

  async function createDatabase() {
    if (!newDbName.trim()) return;

    creating = true;
    try {
      const db = await databaseService.createDatabase(newDbName.trim(), [], newDbIcon);
      databases = [...databases, db];
      showCreateModal = false;
      newDbName = '';
      newDbIcon = '📊';
      
      // Navigate to the new database
      window.location.href = `/database/${db.id}`;
    } catch (error) {
      console.error('Failed to create database:', error);
    } finally {
      creating = false;
    }
  }

  async function deleteDatabase(id: string) {
    if (!confirm('Are you sure you want to delete this database? This action cannot be undone.')) {
      return;
    }

    try {
      await databaseService.deleteDatabase(id);
      databases = databases.filter(db => db.id !== id);
    } catch (error) {
      console.error('Failed to delete database:', error);
    }
  }

  function formatDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  onMount(() => {
    loadDatabases();
  });
</script>

<svelte:head>
  <title>Databases | Storacha Notes</title>
</svelte:head>

<div class="databases-page">
  <header class="page-header">
    <div class="header-content">
      <h1>Databases</h1>
      <p class="subtitle">Create and manage structured data with custom properties and views</p>
    </div>
    <button class="create-btn" onclick={() => showCreateModal = true}>
      <span class="icon">+</span>
      <span>New Database</span>
    </button>
  </header>

  <main class="page-content">
    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading databases...</p>
      </div>
    {:else if databases.length === 0}
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <h2>No databases yet</h2>
        <p>Create your first database to organize structured data with custom properties, filters, and multiple views.</p>
        <button class="create-btn-large" onclick={() => showCreateModal = true}>
          <span class="icon">+</span>
          <span>Create Database</span>
        </button>
      </div>
    {:else}
      <div class="databases-grid">
        {#each databases as db (db.id)}
          <a href="/database/{db.id}" class="database-card">
            <div class="card-header">
              <span class="db-icon">{db.icon || '📊'}</span>
              <button 
                class="delete-btn"
                onclick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  deleteDatabase(db.id);
                }}
                title="Delete database"
              >
                🗑
              </button>
            </div>
            <h3 class="db-name">{db.name}</h3>
            <div class="db-meta">
              <span class="meta-item">
                <span class="meta-icon">📋</span>
                {db.properties.length} properties
              </span>
              <span class="meta-item">
                <span class="meta-icon">👁</span>
                {db.views.length} views
              </span>
            </div>
            <div class="db-footer">
              <span class="updated">Updated {formatDate(db.updatedAt)}</span>
            </div>
          </a>
        {/each}

        <button class="add-database-card" onclick={() => showCreateModal = true}>
          <span class="add-icon">+</span>
          <span>New Database</span>
        </button>
      </div>
    {/if}
  </main>
</div>

<!-- Create Database Modal -->
{#if showCreateModal}
  <div class="modal-backdrop" onclick={() => showCreateModal = false}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>Create Database</h2>
        <button class="close-btn" onclick={() => showCreateModal = false}>×</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label>Icon</label>
          <div class="icon-picker">
            {#each defaultIcons as icon}
              <button
                class="icon-option"
                class:selected={newDbIcon === icon}
                onclick={() => newDbIcon = icon}
              >
                {icon}
              </button>
            {/each}
          </div>
        </div>

        <div class="form-group">
          <label for="db-name">Name</label>
          <input
            id="db-name"
            type="text"
            bind:value={newDbName}
            placeholder="My Database"
            autofocus
            onkeydown={(e) => e.key === 'Enter' && createDatabase()}
          />
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" onclick={() => showCreateModal = false}>
          Cancel
        </button>
        <button 
          class="btn-primary" 
          onclick={createDatabase}
          disabled={!newDbName.trim() || creating}
        >
          {creating ? 'Creating...' : 'Create Database'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .databases-page {
    min-height: 100vh;
    background: var(--bg-primary, #ffffff);
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2rem 3rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .header-content h1 {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary, #111827);
    margin: 0 0 0.25rem 0;
  }

  .subtitle {
    font-size: 0.9375rem;
    color: var(--text-tertiary, #9ca3af);
    margin: 0;
  }

  .create-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: var(--accent-color, #3b82f6);
    color: white;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background 0.15s;
  }

  .create-btn:hover {
    background: var(--accent-hover, #2563eb);
  }

  .create-btn .icon {
    font-size: 1.125rem;
    font-weight: 300;
  }

  .page-content {
    padding: 2rem 3rem;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    color: var(--text-tertiary, #9ca3af);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color, #e5e7eb);
    border-top-color: var(--accent-color, #3b82f6);
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
    padding: 4rem;
    text-align: center;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1.5rem;
  }

  .empty-state h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    margin: 0 0 0.5rem 0;
  }

  .empty-state p {
    font-size: 0.9375rem;
    color: var(--text-tertiary, #9ca3af);
    max-width: 400px;
    margin: 0 0 1.5rem 0;
  }

  .create-btn-large {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--accent-color, #3b82f6);
    color: white;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    transition: background 0.15s;
  }

  .create-btn-large:hover {
    background: var(--accent-hover, #2563eb);
  }

  .databases-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .database-card {
    display: flex;
    flex-direction: column;
    padding: 1.25rem;
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.75rem;
    text-decoration: none;
    transition: all 0.2s;
  }

  .database-card:hover {
    border-color: var(--accent-color, #3b82f6);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .db-icon {
    font-size: 2rem;
  }

  .delete-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    opacity: 0;
    transition: all 0.15s;
  }

  .database-card:hover .delete-btn {
    opacity: 0.5;
  }

  .delete-btn:hover {
    background: var(--error-light, #fef2f2);
    opacity: 1 !important;
  }

  .db-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    margin: 0 0 0.75rem 0;
  }

  .db-meta {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-tertiary, #9ca3af);
  }

  .meta-icon {
    font-size: 0.875rem;
  }

  .db-footer {
    margin-top: auto;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-color, #e5e7eb);
  }

  .updated {
    font-size: 0.6875rem;
    color: var(--text-tertiary, #9ca3af);
  }

  .add-database-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 180px;
    background: var(--bg-secondary, #f9fafb);
    border: 2px dashed var(--border-color, #e5e7eb);
    border-radius: 0.75rem;
    cursor: pointer;
    color: var(--text-tertiary, #9ca3af);
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .add-database-card:hover {
    background: var(--bg-hover, #f3f4f6);
    border-color: var(--accent-color, #3b82f6);
    color: var(--accent-color, #3b82f6);
  }

  .add-icon {
    font-size: 2rem;
    font-weight: 300;
  }

  /* Modal styles */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    width: 100%;
    max-width: 400px;
    background: var(--bg-primary, #ffffff);
    border-radius: 0.75rem;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .modal-header h2 {
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

  .modal-body {
    padding: 1.5rem;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-group label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary, #6b7280);
    margin-bottom: 0.5rem;
  }

  .form-group input {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    font-size: 0.9375rem;
    color: var(--text-primary, #111827);
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
    box-shadow: 0 0 0 3px var(--accent-light, #e0f2fe);
  }

  .icon-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .icon-option {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary, #f9fafb);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 1.25rem;
    transition: all 0.15s;
  }

  .icon-option:hover {
    background: var(--bg-hover, #f3f4f6);
  }

  .icon-option.selected {
    background: var(--accent-light, #e0f2fe);
    border-color: var(--accent-color, #3b82f6);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border-color, #e5e7eb);
  }

  .btn-secondary,
  .btn-primary {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
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

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
      padding: 1.5rem;
    }

    .page-content {
      padding: 1.5rem;
    }

    .databases-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
