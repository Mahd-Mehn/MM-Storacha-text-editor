<script lang="ts">
  import type { 
    DatabaseSchema, 
    DatabaseRow, 
    DatabaseView,
    PropertyDefinition,
    PropertyValue,
    SelectOption
  } from '$lib/types/database';

  // Props
  interface Props {
    schema: DatabaseSchema;
    rows: DatabaseRow[];
    view: DatabaseView;
    groupedRows: Map<string, DatabaseRow[]>;
    onRowClick?: (row: DatabaseRow) => void;
    onRowUpdate?: (rowId: string, propertyId: string, value: PropertyValue) => void;
    onAddRow?: (groupId?: string) => void;
    onDeleteRow?: (rowId: string) => void;
    readonly?: boolean;
  }
  
  let { 
    schema, 
    rows, 
    view, 
    groupedRows, 
    onRowClick = undefined, 
    onRowUpdate = undefined, 
    onAddRow = undefined, 
    onDeleteRow = undefined, 
    readonly = false 
  }: Props = $props();

  // State
  let draggedRow = $state<DatabaseRow | null>(null);
  let dragOverGroup = $state<string | null>(null);
  let dragOverIndex = $state<number | null>(null);

  // Get the groupBy property
  function getGroupByProperty(): PropertyDefinition | undefined {
    if (!view.groupBy) return undefined;
    return schema.properties.find(p => p.id === view.groupBy);
  }

  // Get groups with their options
  function getGroups(): { id: string; name: string; color: string; rows: DatabaseRow[] }[] {
    const groupByProp = getGroupByProperty();
    if (!groupByProp) return [];

    const groups: { id: string; name: string; color: string; rows: DatabaseRow[] }[] = [];

    if (groupByProp.type === 'select' && groupByProp.options) {
      for (const option of groupByProp.options) {
        groups.push({
          id: option.id,
          name: option.name,
          color: option.color,
          rows: groupedRows.get(option.id) || []
        });
      }
    }

    // Add "No Status" group
    const noStatusRows = groupedRows.get('_none') || [];
    if (noStatusRows.length > 0 || view.showEmptyGroups) {
      groups.push({
        id: '_none',
        name: 'No Status',
        color: '#9ca3af',
        rows: noStatusRows
      });
    }

    return groups;
  }

  // Get the title of a row
  function getRowTitle(row: DatabaseRow): string {
    const titleProp = schema.properties.find(p => p.type === 'text');
    if (titleProp) {
      const value = row.properties[titleProp.id];
      if (value?.type === 'text' && value.value) {
        return value.value;
      }
    }
    return 'Untitled';
  }

  // Get preview properties (excluding title and groupBy)
  function getPreviewProperties(): PropertyDefinition[] {
    const titleProp = schema.properties.find(p => p.type === 'text');
    return schema.properties
      .filter(p => 
        p.id !== titleProp?.id && 
        p.id !== view.groupBy &&
        p.type !== 'createdTime' &&
        p.type !== 'lastEditedTime' &&
        p.type !== 'createdBy' &&
        p.type !== 'lastEditedBy'
      )
      .slice(0, 3);
  }

  // Format property value for display
  function formatPropertyValue(property: PropertyDefinition, value: PropertyValue | undefined): string {
    if (!value) return '';

    switch (value.type) {
      case 'text':
        return value.value.slice(0, 50) + (value.value.length > 50 ? '...' : '');
      case 'number':
        return value.value?.toString() ?? '';
      case 'date':
        if (!value.value) return '';
        return new Date(value.value.start).toLocaleDateString();
      case 'checkbox':
        return value.value ? '✓' : '✗';
      case 'select':
        if (!value.value) return '';
        const option = property.options?.find(o => o.id === value.value);
        return option?.name ?? '';
      case 'multiSelect':
        return value.value
          .map(id => property.options?.find(o => o.id === id)?.name)
          .filter(Boolean)
          .join(', ');
      default:
        return '';
    }
  }

  // Drag and drop handlers
  function handleDragStart(event: DragEvent, row: DatabaseRow) {
    if (readonly) return;
    draggedRow = row;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', row.id);
    }
  }

  function handleDragOver(event: DragEvent, groupId: string, index?: number) {
    if (readonly || !draggedRow) return;
    event.preventDefault();
    dragOverGroup = groupId;
    dragOverIndex = index ?? null;
  }

  function handleDragLeave() {
    dragOverGroup = null;
    dragOverIndex = null;
  }

  function handleDrop(event: DragEvent, groupId: string) {
    if (readonly || !draggedRow) return;
    event.preventDefault();

    const groupByProp = getGroupByProperty();
    if (groupByProp && draggedRow) {
      // Update the row's group property
      const newValue: PropertyValue = groupId === '_none'
        ? { type: 'select', value: null }
        : { type: 'select', value: groupId };
      
      onRowUpdate?.(draggedRow.id, groupByProp.id, newValue);
    }

    draggedRow = null;
    dragOverGroup = null;
    dragOverIndex = null;
  }

  function handleDragEnd() {
    draggedRow = null;
    dragOverGroup = null;
    dragOverIndex = null;
  }
</script>

<div class="board-view">
  <div class="board-container">
    {#each getGroups() as group (group.id)}
      <div 
        class="board-column"
        class:drag-over={dragOverGroup === group.id}
        ondragover={(e) => handleDragOver(e, group.id)}
        ondragleave={handleDragLeave}
        ondrop={(e) => handleDrop(e, group.id)}
      >
        <div class="column-header">
          <div class="column-title">
            <span 
              class="status-dot" 
              style="background: {group.color};"
            ></span>
            <span class="column-name">{group.name}</span>
            <span class="column-count">{group.rows.length}</span>
          </div>
          {#if !readonly}
            <button 
              class="add-card-btn"
              onclick={() => onAddRow?.(group.id)}
              title="Add card"
            >
              +
            </button>
          {/if}
        </div>

        <div class="column-content">
          {#each group.rows as row, index (row.id)}
            <div 
              class="board-card"
              class:dragging={draggedRow?.id === row.id}
              class:drag-over={dragOverGroup === group.id && dragOverIndex === index}
              draggable={!readonly}
              ondragstart={(e) => handleDragStart(e, row)}
              ondragover={(e) => handleDragOver(e, group.id, index)}
              ondragend={handleDragEnd}
              onclick={() => onRowClick?.(row)}
            >
              <div class="card-title">{getRowTitle(row)}</div>
              
              {#each getPreviewProperties() as property (property.id)}
                {@const value = row.properties[property.id]}
                {@const displayValue = formatPropertyValue(property, value)}
                {#if displayValue}
                  <div class="card-property">
                    <span class="property-name">{property.name}</span>
                    <span class="property-value">{displayValue}</span>
                  </div>
                {/if}
              {/each}

              {#if !readonly}
                <button 
                  class="card-menu"
                  onclick={(e) => {
                    e.stopPropagation();
                    // TODO: Show card menu
                  }}
                >
                  ⋮
                </button>
              {/if}
            </div>
          {/each}

          {#if group.rows.length === 0}
            <div class="empty-column">
              <span>No items</span>
            </div>
          {/if}
        </div>

        {#if !readonly}
          <button 
            class="add-card-bottom"
            onclick={() => onAddRow?.(group.id)}
          >
            <span>+ New</span>
          </button>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .board-view {
    height: 100%;
    overflow: hidden;
    background: var(--bg-secondary, #f9fafb);
    padding: 1rem;
  }

  .board-container {
    display: flex;
    gap: 1rem;
    height: 100%;
    overflow-x: auto;
    padding-bottom: 1rem;
  }

  .board-column {
    flex-shrink: 0;
    width: 280px;
    display: flex;
    flex-direction: column;
    background: var(--bg-tertiary, #f3f4f6);
    border-radius: 0.75rem;
    max-height: 100%;
    transition: background 0.15s;
  }

  .board-column.drag-over {
    background: var(--accent-light, #e0f2fe);
  }

  .column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .column-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .column-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
  }

  .column-count {
    font-size: 0.75rem;
    color: var(--text-tertiary, #9ca3af);
    background: var(--bg-primary, #ffffff);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
  }

  .add-card-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 0.25rem;
    color: var(--text-tertiary, #9ca3af);
    font-size: 1rem;
  }

  .add-card-btn:hover {
    background: var(--bg-hover, #e5e7eb);
    color: var(--text-primary, #111827);
  }

  .column-content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .board-card {
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.5rem;
    padding: 0.75rem;
    cursor: pointer;
    transition: all 0.15s;
    position: relative;
  }

  .board-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border-color: var(--border-hover, #d1d5db);
  }

  .board-card.dragging {
    opacity: 0.5;
    transform: rotate(2deg);
  }

  .board-card.drag-over {
    border-top: 2px solid var(--accent-color, #3b82f6);
  }

  .card-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary, #111827);
    margin-bottom: 0.5rem;
    line-height: 1.4;
  }

  .card-property {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }

  .card-property .property-name {
    color: var(--text-tertiary, #9ca3af);
    flex-shrink: 0;
  }

  .card-property .property-value {
    color: var(--text-secondary, #6b7280);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-menu {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
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
    opacity: 0;
    transition: opacity 0.15s;
  }

  .board-card:hover .card-menu {
    opacity: 1;
  }

  .card-menu:hover {
    background: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #111827);
  }

  .empty-column {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: var(--text-tertiary, #9ca3af);
    font-size: 0.8125rem;
  }

  .add-card-bottom {
    padding: 0.5rem 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-tertiary, #9ca3af);
    font-size: 0.8125rem;
    text-align: left;
    border-top: 1px solid var(--border-color, #e5e7eb);
    transition: all 0.15s;
  }

  .add-card-bottom:hover {
    background: var(--bg-hover, #e5e7eb);
    color: var(--text-primary, #111827);
  }
</style>
