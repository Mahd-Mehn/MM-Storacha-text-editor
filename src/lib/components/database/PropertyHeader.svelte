<script lang="ts">
  import type { PropertyDefinition } from '$lib/types/database';

  // Props
  export let property: PropertyDefinition;
  export let sortDirection: 'asc' | 'desc' | null = null;
  export let onSort: (() => void) | undefined = undefined;
  export let onRename: ((name: string) => void) | undefined = undefined;
  export let onDelete: (() => void) | undefined = undefined;
  export let onHide: (() => void) | undefined = undefined;

  // State
  let showMenu = $state(false);
  let editing = $state(false);
  let editName = $state(property.name);

  function getPropertyIcon(type: string): string {
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
      case 'relation': return '↔';
      case 'rollup': return 'Σ';
      case 'formula': return 'ƒ';
      case 'createdTime': return '🕐';
      case 'lastEditedTime': return '🕐';
      case 'createdBy': return '👤';
      case 'lastEditedBy': return '👤';
      case 'files': return '📎';
      case 'person': return '👥';
      default: return '•';
    }
  }

  function handleRename() {
    if (editName.trim() && editName !== property.name) {
      onRename?.(editName.trim());
    }
    editing = false;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleRename();
    }
    if (event.key === 'Escape') {
      editName = property.name;
      editing = false;
    }
  }
</script>

<div class="property-header">
  <button 
    class="header-content"
    onclick={onSort}
    title="Click to sort"
  >
    <span class="property-icon">{getPropertyIcon(property.type)}</span>
    {#if editing}
      <input
        type="text"
        bind:value={editName}
        onblur={handleRename}
        onkeydown={handleKeyDown}
        class="name-input"
        onclick={(e) => e.stopPropagation()}
      />
    {:else}
      <span class="property-name">{property.name}</span>
    {/if}
    {#if sortDirection}
      <span class="sort-indicator">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    {/if}
  </button>

  <button 
    class="menu-trigger"
    onclick={(e) => {
      e.stopPropagation();
      showMenu = !showMenu;
    }}
    title="Property options"
  >
    ⋮
  </button>

  {#if showMenu}
    <div class="menu" onclick={(e) => e.stopPropagation()}>
      <button 
        class="menu-item"
        onclick={() => {
          editing = true;
          editName = property.name;
          showMenu = false;
        }}
      >
        <span class="menu-icon">✏️</span>
        Rename
      </button>
      <button 
        class="menu-item"
        onclick={() => {
          onSort?.();
          showMenu = false;
        }}
      >
        <span class="menu-icon">{sortDirection === 'asc' ? '↓' : '↑'}</span>
        Sort {sortDirection === 'asc' ? 'descending' : 'ascending'}
      </button>
      {#if onHide}
        <button 
          class="menu-item"
          onclick={() => {
            onHide?.();
            showMenu = false;
          }}
        >
          <span class="menu-icon">👁</span>
          Hide property
        </button>
      {/if}
      {#if onDelete}
        <hr class="menu-divider" />
        <button 
          class="menu-item danger"
          onclick={() => {
            onDelete?.();
            showMenu = false;
          }}
        >
          <span class="menu-icon">🗑</span>
          Delete property
        </button>
      {/if}
    </div>
  {/if}
</div>

{#if showMenu}
  <button 
    class="menu-backdrop"
    onclick={() => showMenu = false}
    aria-label="Close menu"
  ></button>
{/if}

<style>
  .property-header {
    display: flex;
    align-items: center;
    padding: 0.5rem;
    position: relative;
    gap: 0.25rem;
  }

  .header-content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 0.25rem;
    text-align: left;
    min-width: 0;
  }

  .header-content:hover {
    background: var(--bg-hover, #f3f4f6);
  }

  .property-icon {
    font-size: 0.75rem;
    color: var(--text-tertiary, #9ca3af);
    flex-shrink: 0;
    width: 1rem;
    text-align: center;
  }

  .property-name {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary, #6b7280);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .name-input {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-primary, #111827);
    border: 1px solid var(--accent-color, #3b82f6);
    border-radius: 0.25rem;
    padding: 0.125rem 0.25rem;
    outline: none;
    min-width: 60px;
  }

  .sort-indicator {
    font-size: 0.75rem;
    color: var(--accent-color, #3b82f6);
    flex-shrink: 0;
  }

  .menu-trigger {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 0.25rem;
    color: var(--text-tertiary, #9ca3af);
    font-size: 0.875rem;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .property-header:hover .menu-trigger {
    opacity: 1;
  }

  .menu-trigger:hover {
    background: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #111827);
  }

  .menu {
    position: absolute;
    top: 100%;
    right: 0;
    min-width: 180px;
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 100;
    padding: 0.25rem;
  }

  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    font-size: 0.8125rem;
    color: var(--text-primary, #111827);
    border-radius: 0.375rem;
  }

  .menu-item:hover {
    background: var(--bg-hover, #f3f4f6);
  }

  .menu-item.danger {
    color: var(--error-color, #ef4444);
  }

  .menu-item.danger:hover {
    background: var(--error-light, #fef2f2);
  }

  .menu-icon {
    font-size: 0.875rem;
    width: 1.25rem;
    text-align: center;
  }

  .menu-divider {
    border: none;
    border-top: 1px solid var(--border-color, #e5e7eb);
    margin: 0.25rem 0;
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
