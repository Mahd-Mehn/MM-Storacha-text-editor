<script lang="ts">
  import type { 
    DatabaseSchema, 
    DatabaseRow, 
    DatabaseView,
    PropertyDefinition,
    PropertyValue
  } from '$lib/types/database';

  // Props
  export let schema: DatabaseSchema;
  export let rows: DatabaseRow[];
  export let view: DatabaseView;
  export let onRowClick: ((row: DatabaseRow) => void) | undefined = undefined;
  export let onAddRow: (() => void) | undefined = undefined;
  export let readonly: boolean = false;

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

  // Get cover image URL
  function getCoverImage(row: DatabaseRow): string | null {
    if (view.galleryProperty) {
      const value = row.properties[view.galleryProperty];
      if (value?.type === 'url' && value.value) {
        return value.value;
      }
      if (value?.type === 'files' && value.value.length > 0) {
        return value.value[0].url;
      }
    }
    return null;
  }

  // Get preview properties (excluding title and cover)
  function getPreviewProperties(): PropertyDefinition[] {
    const titleProp = schema.properties.find(p => p.type === 'text');
    return schema.properties
      .filter(p => 
        p.id !== titleProp?.id && 
        p.id !== view.galleryProperty &&
        p.type !== 'createdTime' &&
        p.type !== 'lastEditedTime' &&
        p.type !== 'createdBy' &&
        p.type !== 'lastEditedBy' &&
        view.visibleProperties.includes(p.id)
      )
      .slice(0, 3);
  }

  // Format property value for display
  function formatPropertyValue(property: PropertyDefinition, value: PropertyValue | undefined): string {
    if (!value) return '';

    switch (value.type) {
      case 'text':
        return value.value.slice(0, 100) + (value.value.length > 100 ? '...' : '');
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

  // Get card size class
  function getCardSizeClass(): string {
    switch (view.cardSize) {
      case 'small': return 'card-small';
      case 'large': return 'card-large';
      default: return 'card-medium';
    }
  }

  // Generate placeholder gradient
  function getPlaceholderGradient(row: DatabaseRow): string {
    const hash = row.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = hash % 360;
    return `linear-gradient(135deg, hsl(${hue}, 70%, 80%), hsl(${(hue + 60) % 360}, 70%, 70%))`;
  }
</script>

<div class="gallery-view">
  <div class="gallery-grid {getCardSizeClass()}">
    {#each rows as row (row.id)}
      {@const coverImage = getCoverImage(row)}
      <button 
        class="gallery-card"
        onclick={() => onRowClick?.(row)}
      >
        <div class="card-cover">
          {#if coverImage}
            <img src={coverImage} alt={getRowTitle(row)} />
          {:else}
            <div 
              class="cover-placeholder"
              style="background: {getPlaceholderGradient(row)};"
            >
              <span class="placeholder-icon">📄</span>
            </div>
          {/if}
        </div>
        
        <div class="card-content">
          <h3 class="card-title">{getRowTitle(row)}</h3>
          
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
        </div>
      </button>
    {/each}

    {#if !readonly}
      <button class="add-card" onclick={onAddRow}>
        <span class="add-icon">+</span>
        <span>New</span>
      </button>
    {/if}
  </div>

  {#if rows.length === 0 && readonly}
    <div class="empty-state">
      <p>No items to display</p>
    </div>
  {/if}
</div>

<style>
  .gallery-view {
    padding: 1.5rem;
    background: var(--bg-primary, #ffffff);
    min-height: 100%;
  }

  .gallery-grid {
    display: grid;
    gap: 1rem;
  }

  .gallery-grid.card-small {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }

  .gallery-grid.card-medium {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }

  .gallery-grid.card-large {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  }

  .gallery-card {
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.75rem;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    padding: 0;
  }

  .gallery-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    border-color: var(--border-hover, #d1d5db);
    transform: translateY(-2px);
  }

  .card-cover {
    aspect-ratio: 16 / 10;
    overflow: hidden;
    background: var(--bg-secondary, #f9fafb);
  }

  .card-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .placeholder-icon {
    font-size: 2rem;
    opacity: 0.5;
  }

  .card-content {
    padding: 0.75rem 1rem 1rem;
  }

  .card-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    margin: 0 0 0.5rem 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
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

  .add-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 200px;
    background: var(--bg-secondary, #f9fafb);
    border: 2px dashed var(--border-color, #e5e7eb);
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--text-tertiary, #9ca3af);
  }

  .add-card:hover {
    background: var(--bg-hover, #f3f4f6);
    border-color: var(--accent-color, #3b82f6);
    color: var(--accent-color, #3b82f6);
  }

  .add-icon {
    font-size: 1.5rem;
    font-weight: 300;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: var(--text-tertiary, #9ca3af);
  }
</style>
