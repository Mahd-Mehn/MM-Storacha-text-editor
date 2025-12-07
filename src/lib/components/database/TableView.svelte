<script lang="ts">
  import { onMount } from 'svelte';
  import type { 
    DatabaseSchema, 
    DatabaseRow, 
    DatabaseView,
    PropertyDefinition,
    PropertyValue,
    SortRule
  } from '$lib/types/database';
  import PropertyCell from './PropertyCell.svelte';
  import PropertyHeader from './PropertyHeader.svelte';

  // Props
  export let schema: DatabaseSchema;
  export let rows: DatabaseRow[];
  export let view: DatabaseView;
  export let onRowClick: ((row: DatabaseRow) => void) | undefined = undefined;
  export let onRowUpdate: ((rowId: string, propertyId: string, value: PropertyValue) => void) | undefined = undefined;
  export let onAddRow: (() => void) | undefined = undefined;
  export let onDeleteRow: ((rowId: string) => void) | undefined = undefined;
  export let onSortChange: ((sorts: SortRule[]) => void) | undefined = undefined;
  export let onPropertyAdd: (() => void) | undefined = undefined;
  export let readonly: boolean = false;

  // State
  let selectedRowIds = $state<Set<string>>(new Set());
  let editingCell = $state<{ rowId: string; propertyId: string } | null>(null);
  let hoveredRowId = $state<string | null>(null);
  let resizingColumn = $state<string | null>(null);
  let columnWidths = $state<Record<string, number>>({});

  // Get visible properties in order
  $effect(() => {
    const widths: Record<string, number> = {};
    for (const propId of view.visibleProperties) {
      widths[propId] = view.propertyWidths?.[propId] || 200;
    }
    columnWidths = widths;
  });

  function getVisibleProperties(): PropertyDefinition[] {
    return view.visibleProperties
      .map(id => schema.properties.find(p => p.id === id))
      .filter((p): p is PropertyDefinition => p !== undefined);
  }

  function handleCellClick(rowId: string, propertyId: string) {
    if (readonly) return;
    editingCell = { rowId, propertyId };
  }

  function handleCellBlur() {
    editingCell = null;
  }

  function handleCellUpdate(rowId: string, propertyId: string, value: PropertyValue) {
    if (onRowUpdate) {
      onRowUpdate(rowId, propertyId, value);
    }
    editingCell = null;
  }

  function handleRowSelect(rowId: string, event: MouseEvent) {
    if (event.shiftKey && selectedRowIds.size > 0) {
      // Range selection
      const rowIds = rows.map(r => r.id);
      const lastSelected = Array.from(selectedRowIds).pop()!;
      const startIdx = rowIds.indexOf(lastSelected);
      const endIdx = rowIds.indexOf(rowId);
      const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
      
      for (let i = from; i <= to; i++) {
        selectedRowIds.add(rowIds[i]);
      }
      selectedRowIds = new Set(selectedRowIds);
    } else if (event.metaKey || event.ctrlKey) {
      // Toggle selection
      if (selectedRowIds.has(rowId)) {
        selectedRowIds.delete(rowId);
      } else {
        selectedRowIds.add(rowId);
      }
      selectedRowIds = new Set(selectedRowIds);
    } else {
      // Single selection
      selectedRowIds = new Set([rowId]);
    }
  }

  function handleSort(propertyId: string) {
    if (!onSortChange) return;

    const existingSort = view.sorts.find(s => s.propertyId === propertyId);
    let newSorts: SortRule[];

    if (!existingSort) {
      newSorts = [{ id: `sort_${Date.now()}`, propertyId, direction: 'asc' }];
    } else if (existingSort.direction === 'asc') {
      newSorts = [{ ...existingSort, direction: 'desc' }];
    } else {
      newSorts = [];
    }

    onSortChange(newSorts);
  }

  function getSortDirection(propertyId: string): 'asc' | 'desc' | null {
    const sort = view.sorts.find(s => s.propertyId === propertyId);
    return sort?.direction || null;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      editingCell = null;
      selectedRowIds = new Set();
    }
    if (event.key === 'Delete' && selectedRowIds.size > 0 && onDeleteRow) {
      for (const rowId of selectedRowIds) {
        onDeleteRow(rowId);
      }
      selectedRowIds = new Set();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="table-view">
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th class="checkbox-column">
            <input 
              type="checkbox" 
              checked={selectedRowIds.size === rows.length && rows.length > 0}
              onchange={() => {
                if (selectedRowIds.size === rows.length) {
                  selectedRowIds = new Set();
                } else {
                  selectedRowIds = new Set(rows.map(r => r.id));
                }
              }}
            />
          </th>
          {#each getVisibleProperties() as property (property.id)}
            <th 
              style="width: {columnWidths[property.id]}px; min-width: {columnWidths[property.id]}px;"
              class:sorting={getSortDirection(property.id) !== null}
            >
              <PropertyHeader 
                {property}
                sortDirection={getSortDirection(property.id)}
                onSort={() => handleSort(property.id)}
              />
            </th>
          {/each}
          {#if !readonly}
            <th class="add-column">
              <button class="add-property-btn" onclick={onPropertyAdd} title="Add property">
                <span>+</span>
              </button>
            </th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.id)}
          <tr 
            class:selected={selectedRowIds.has(row.id)}
            class:hovered={hoveredRowId === row.id}
            onmouseenter={() => hoveredRowId = row.id}
            onmouseleave={() => hoveredRowId = null}
            onclick={(e) => handleRowSelect(row.id, e)}
            ondblclick={() => onRowClick?.(row)}
          >
            <td class="checkbox-column">
              <input 
                type="checkbox" 
                checked={selectedRowIds.has(row.id)}
                onclick={(e) => e.stopPropagation()}
                onchange={() => {
                  if (selectedRowIds.has(row.id)) {
                    selectedRowIds.delete(row.id);
                  } else {
                    selectedRowIds.add(row.id);
                  }
                  selectedRowIds = new Set(selectedRowIds);
                }}
              />
            </td>
            {#each getVisibleProperties() as property (property.id)}
              <td 
                style="width: {columnWidths[property.id]}px;"
                class:editing={editingCell?.rowId === row.id && editingCell?.propertyId === property.id}
                onclick={(e) => {
                  e.stopPropagation();
                  handleCellClick(row.id, property.id);
                }}
              >
                <PropertyCell 
                  {property}
                  value={row.properties[property.id]}
                  editing={editingCell?.rowId === row.id && editingCell?.propertyId === property.id}
                  {readonly}
                  onUpdate={(value) => handleCellUpdate(row.id, property.id, value)}
                  onBlur={handleCellBlur}
                />
              </td>
            {/each}
            {#if !readonly}
              <td class="add-column"></td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if !readonly}
    <button class="add-row-btn" onclick={onAddRow}>
      <span class="icon">+</span>
      <span>New</span>
    </button>
  {/if}

  {#if rows.length === 0}
    <div class="empty-state">
      <p>No entries yet</p>
      {#if !readonly}
        <button onclick={onAddRow}>Add your first entry</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .table-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary, #ffffff);
  }

  .table-container {
    flex: 1;
    overflow: auto;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.5rem;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--bg-secondary, #f9fafb);
  }

  th {
    padding: 0;
    text-align: left;
    font-weight: 500;
    color: var(--text-secondary, #6b7280);
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    user-select: none;
  }

  th.sorting {
    background: var(--bg-tertiary, #f3f4f6);
  }

  td {
    padding: 0;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    height: 36px;
    vertical-align: middle;
  }

  tr {
    cursor: pointer;
    transition: background 0.1s;
  }

  tr:hover, tr.hovered {
    background: var(--bg-hover, #f9fafb);
  }

  tr.selected {
    background: var(--accent-light, #e0f2fe);
  }

  tr.selected:hover {
    background: var(--accent-light-hover, #bae6fd);
  }

  .checkbox-column {
    width: 40px;
    min-width: 40px;
    padding: 0 0.5rem;
    text-align: center;
  }

  .checkbox-column input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--accent-color, #3b82f6);
  }

  .add-column {
    width: 40px;
    min-width: 40px;
    padding: 0;
  }

  .add-property-btn {
    width: 100%;
    height: 100%;
    padding: 0.5rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-tertiary, #9ca3af);
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .add-property-btn:hover {
    background: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #111827);
  }

  td.editing {
    background: var(--bg-primary, #ffffff);
    box-shadow: inset 0 0 0 2px var(--accent-color, #3b82f6);
  }

  .add-row-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    margin-top: 0.5rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-tertiary, #9ca3af);
    font-size: 0.875rem;
    transition: all 0.15s;
    border-radius: 0.375rem;
  }

  .add-row-btn:hover {
    background: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #111827);
  }

  .add-row-btn .icon {
    font-size: 1rem;
    font-weight: 500;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: var(--text-tertiary, #9ca3af);
  }

  .empty-state p {
    margin-bottom: 1rem;
  }

  .empty-state button {
    padding: 0.5rem 1rem;
    background: var(--accent-color, #3b82f6);
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background 0.15s;
  }

  .empty-state button:hover {
    background: var(--accent-hover, #2563eb);
  }
</style>
