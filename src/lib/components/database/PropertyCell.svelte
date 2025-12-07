<script lang="ts">
  import type { PropertyDefinition, PropertyValue, SelectOption } from '$lib/types/database';

  // Props
  export let property: PropertyDefinition;
  export let value: PropertyValue | undefined;
  export let editing: boolean = false;
  export let readonly: boolean = false;
  export let onUpdate: ((value: PropertyValue) => void) | undefined = undefined;
  export let onBlur: (() => void) | undefined = undefined;

  // State
  let inputElement: HTMLInputElement | HTMLTextAreaElement | null = null;
  let showDropdown = $state(false);

  $effect(() => {
    if (editing && inputElement) {
      inputElement.focus();
      if (inputElement instanceof HTMLInputElement && inputElement.type === 'text') {
        inputElement.select();
      }
    }
  });

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onBlur?.();
    }
    if (event.key === 'Escape') {
      onBlur?.();
    }
  }

  function updateTextValue(newValue: string) {
    onUpdate?.({ type: 'text', value: newValue });
  }

  function updateNumberValue(newValue: string) {
    const num = newValue === '' ? null : parseFloat(newValue);
    onUpdate?.({ type: 'number', value: isNaN(num as number) ? null : num });
  }

  function updateCheckboxValue(checked: boolean) {
    onUpdate?.({ type: 'checkbox', value: checked });
  }

  function updateSelectValue(optionId: string | null) {
    onUpdate?.({ type: 'select', value: optionId });
    showDropdown = false;
  }

  function updateMultiSelectValue(optionId: string, add: boolean) {
    const currentValue = value?.type === 'multiSelect' ? value.value : [];
    const newValue = add 
      ? [...currentValue, optionId]
      : currentValue.filter(id => id !== optionId);
    onUpdate?.({ type: 'multiSelect', value: newValue });
  }

  function updateDateValue(dateStr: string) {
    if (!dateStr) {
      onUpdate?.({ type: 'date', value: null });
    } else {
      onUpdate?.({ type: 'date', value: { start: new Date(dateStr).toISOString() } });
    }
  }

  function updateUrlValue(url: string) {
    onUpdate?.({ type: 'url', value: url || null });
  }

  function getDisplayValue(): string {
    if (!value) return '';
    
    switch (value.type) {
      case 'text':
        return value.value;
      case 'number':
        return value.value?.toString() ?? '';
      case 'date':
        if (!value.value) return '';
        return new Date(value.value.start).toLocaleDateString();
      case 'checkbox':
        return value.value ? '✓' : '';
      case 'select':
        if (!value.value) return '';
        const option = property.options?.find(o => o.id === value.value);
        return option?.name ?? '';
      case 'multiSelect':
        return value.value
          .map(id => property.options?.find(o => o.id === id)?.name)
          .filter(Boolean)
          .join(', ');
      case 'url':
        return value.value ?? '';
      case 'timestamp':
        return new Date(value.value).toLocaleString();
      case 'user':
        return value.value;
      default:
        return '';
    }
  }

  function getSelectOption(optionId: string): SelectOption | undefined {
    return property.options?.find(o => o.id === optionId);
  }

  function formatDate(isoString: string): string {
    return isoString.split('T')[0];
  }
</script>

<div class="property-cell" class:editing class:readonly>
  {#if property.type === 'text'}
    {#if editing && !readonly}
      <input
        bind:this={inputElement}
        type="text"
        value={value?.type === 'text' ? value.value : ''}
        oninput={(e) => updateTextValue(e.currentTarget.value)}
        onblur={onBlur}
        onkeydown={handleKeyDown}
        class="cell-input"
      />
    {:else}
      <span class="cell-value text">{getDisplayValue()}</span>
    {/if}

  {:else if property.type === 'number'}
    {#if editing && !readonly}
      <input
        bind:this={inputElement}
        type="number"
        value={value?.type === 'number' ? value.value ?? '' : ''}
        oninput={(e) => updateNumberValue(e.currentTarget.value)}
        onblur={onBlur}
        onkeydown={handleKeyDown}
        class="cell-input"
      />
    {:else}
      <span class="cell-value number">{getDisplayValue()}</span>
    {/if}

  {:else if property.type === 'checkbox'}
    <label class="checkbox-wrapper">
      <input
        type="checkbox"
        checked={value?.type === 'checkbox' ? value.value : false}
        onchange={(e) => !readonly && updateCheckboxValue(e.currentTarget.checked)}
        disabled={readonly}
      />
      <span class="checkmark"></span>
    </label>

  {:else if property.type === 'select'}
    {#if editing && !readonly}
      <div class="select-wrapper">
        <button 
          class="select-trigger"
          onclick={() => showDropdown = !showDropdown}
        >
          {#if value?.type === 'select' && value.value}
            {@const option = getSelectOption(value.value)}
            {#if option}
              <span class="tag" style="background: {option.color}20; color: {option.color};">
                {option.name}
              </span>
            {/if}
          {:else}
            <span class="placeholder">Select...</span>
          {/if}
        </button>
        {#if showDropdown}
          <div class="dropdown">
            <button class="dropdown-item" onclick={() => updateSelectValue(null)}>
              <span class="placeholder">None</span>
            </button>
            {#each property.options || [] as option (option.id)}
              <button 
                class="dropdown-item"
                onclick={() => updateSelectValue(option.id)}
              >
                <span class="tag" style="background: {option.color}20; color: {option.color};">
                  {option.name}
                </span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      {#if value?.type === 'select' && value.value}
        {@const option = getSelectOption(value.value)}
        {#if option}
          <span class="tag" style="background: {option.color}20; color: {option.color};">
            {option.name}
          </span>
        {/if}
      {/if}
    {/if}

  {:else if property.type === 'multiSelect'}
    <div class="multi-select-wrapper">
      {#if value?.type === 'multiSelect'}
        {#each value.value as optionId (optionId)}
          {@const option = getSelectOption(optionId)}
          {#if option}
            <span class="tag" style="background: {option.color}20; color: {option.color};">
              {option.name}
              {#if !readonly}
                <button 
                  class="tag-remove"
                  onclick={() => updateMultiSelectValue(optionId, false)}
                >×</button>
              {/if}
            </span>
          {/if}
        {/each}
      {/if}
      {#if editing && !readonly}
        <button 
          class="add-tag-btn"
          onclick={() => showDropdown = !showDropdown}
        >+</button>
        {#if showDropdown}
          <div class="dropdown">
            {#each (property.options || []).filter(o => !(value?.type === 'multiSelect' && value.value.includes(o.id))) as option (option.id)}
              <button 
                class="dropdown-item"
                onclick={() => updateMultiSelectValue(option.id, true)}
              >
                <span class="tag" style="background: {option.color}20; color: {option.color};">
                  {option.name}
                </span>
              </button>
            {/each}
          </div>
        {/if}
      {/if}
    </div>

  {:else if property.type === 'date'}
    {#if editing && !readonly}
      <input
        bind:this={inputElement}
        type="date"
        value={value?.type === 'date' && value.value ? formatDate(value.value.start) : ''}
        oninput={(e) => updateDateValue(e.currentTarget.value)}
        onblur={onBlur}
        onkeydown={handleKeyDown}
        class="cell-input"
      />
    {:else}
      <span class="cell-value date">{getDisplayValue()}</span>
    {/if}

  {:else if property.type === 'url' || property.type === 'email' || property.type === 'phone'}
    {#if editing && !readonly}
      <input
        bind:this={inputElement}
        type={property.type === 'email' ? 'email' : property.type === 'phone' ? 'tel' : 'url'}
        value={value?.type === 'url' ? value.value ?? '' : ''}
        oninput={(e) => updateUrlValue(e.currentTarget.value)}
        onblur={onBlur}
        onkeydown={handleKeyDown}
        class="cell-input"
      />
    {:else}
      {#if value?.type === 'url' && value.value}
        <a href={value.value} target="_blank" rel="noopener noreferrer" class="cell-link">
          {value.value}
        </a>
      {/if}
    {/if}

  {:else if property.type === 'createdTime' || property.type === 'lastEditedTime'}
    <span class="cell-value timestamp">{getDisplayValue()}</span>

  {:else if property.type === 'createdBy' || property.type === 'lastEditedBy'}
    <span class="cell-value user">{getDisplayValue()}</span>

  {:else}
    <span class="cell-value">{getDisplayValue()}</span>
  {/if}
</div>

<style>
  .property-cell {
    padding: 0.5rem;
    min-height: 36px;
    display: flex;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
  }

  .cell-input {
    width: 100%;
    padding: 0.25rem 0.5rem;
    border: none;
    background: transparent;
    font-size: 0.875rem;
    color: var(--text-primary, #111827);
    outline: none;
  }

  .cell-input:focus {
    outline: none;
  }

  .cell-value {
    font-size: 0.875rem;
    color: var(--text-primary, #111827);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cell-value.timestamp,
  .cell-value.user {
    color: var(--text-tertiary, #9ca3af);
    font-size: 0.8125rem;
  }

  .cell-link {
    color: var(--accent-color, #3b82f6);
    text-decoration: none;
    font-size: 0.875rem;
  }

  .cell-link:hover {
    text-decoration: underline;
  }

  /* Checkbox */
  .checkbox-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .checkbox-wrapper input {
    width: 16px;
    height: 16px;
    accent-color: var(--accent-color, #3b82f6);
    cursor: pointer;
  }

  /* Select */
  .select-wrapper {
    position: relative;
    width: 100%;
  }

  .select-trigger {
    width: 100%;
    padding: 0.25rem;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    display: flex;
    align-items: center;
  }

  .placeholder {
    color: var(--text-tertiary, #9ca3af);
    font-size: 0.875rem;
  }

  /* Tags */
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .tag-remove {
    background: none;
    border: none;
    padding: 0;
    margin-left: 0.125rem;
    cursor: pointer;
    font-size: 0.875rem;
    line-height: 1;
    opacity: 0.7;
  }

  .tag-remove:hover {
    opacity: 1;
  }

  /* Multi-select */
  .multi-select-wrapper {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
    position: relative;
  }

  .add-tag-btn {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary, #f3f4f6);
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--text-tertiary, #9ca3af);
  }

  .add-tag-btn:hover {
    background: var(--bg-hover, #e5e7eb);
    color: var(--text-primary, #111827);
  }

  /* Dropdown */
  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 150px;
    max-height: 200px;
    overflow-y: auto;
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 100;
    padding: 0.25rem;
  }

  .dropdown-item {
    width: 100%;
    padding: 0.5rem;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    border-radius: 0.25rem;
    display: flex;
    align-items: center;
  }

  .dropdown-item:hover {
    background: var(--bg-hover, #f3f4f6);
  }
</style>
