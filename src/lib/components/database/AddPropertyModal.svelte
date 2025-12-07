<script lang="ts">
  import type { PropertyDefinition, PropertyType, SelectOption } from '$lib/types/database';

  // Props
  export let onAdd: (property: PropertyDefinition) => void;
  export let onClose: () => void;

  // State
  let name = $state('');
  let type = $state<PropertyType>('text');
  let options = $state<SelectOption[]>([]);
  let newOptionName = $state('');

  const propertyTypes: { value: PropertyType; label: string; icon: string }[] = [
    { value: 'text', label: 'Text', icon: 'Aa' },
    { value: 'number', label: 'Number', icon: '#' },
    { value: 'select', label: 'Select', icon: '▼' },
    { value: 'multiSelect', label: 'Multi-select', icon: '⊞' },
    { value: 'date', label: 'Date', icon: '📅' },
    { value: 'checkbox', label: 'Checkbox', icon: '☑' },
    { value: 'url', label: 'URL', icon: '🔗' },
    { value: 'email', label: 'Email', icon: '✉' },
    { value: 'phone', label: 'Phone', icon: '📞' },
  ];

  const defaultColors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#1f2937'
  ];

  function generateId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  function addOption() {
    if (!newOptionName.trim()) return;

    const color = defaultColors[options.length % defaultColors.length];
    options = [...options, {
      id: `opt_${generateId()}`,
      name: newOptionName.trim(),
      color
    }];
    newOptionName = '';
  }

  function removeOption(optionId: string) {
    options = options.filter(o => o.id !== optionId);
  }

  function updateOptionColor(optionId: string, color: string) {
    options = options.map(o => o.id === optionId ? { ...o, color } : o);
  }

  function handleSubmit() {
    if (!name.trim()) return;

    const property: PropertyDefinition = {
      id: `prop_${generateId()}`,
      name: name.trim(),
      type,
      isVisible: true
    };

    if (type === 'select' || type === 'multiSelect') {
      property.options = options;
    }

    onAdd(property);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="modal-backdrop" onclick={onClose}>
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2>Add Property</h2>
      <button class="close-btn" onclick={onClose}>×</button>
    </div>

    <div class="modal-body">
      <div class="form-group">
        <label for="property-name">Name</label>
        <input
          id="property-name"
          type="text"
          bind:value={name}
          placeholder="Property name"
          autofocus
        />
      </div>

      <div class="form-group">
        <label>Type</label>
        <div class="type-grid">
          {#each propertyTypes as propType (propType.value)}
            <button
              class="type-option"
              class:selected={type === propType.value}
              onclick={() => type = propType.value}
            >
              <span class="type-icon">{propType.icon}</span>
              <span class="type-label">{propType.label}</span>
            </button>
          {/each}
        </div>
      </div>

      {#if type === 'select' || type === 'multiSelect'}
        <div class="form-group">
          <label>Options</label>
          <div class="options-list">
            {#each options as option (option.id)}
              <div class="option-item">
                <input
                  type="color"
                  value={option.color}
                  onchange={(e) => updateOptionColor(option.id, e.currentTarget.value)}
                  class="color-picker"
                />
                <span 
                  class="option-tag"
                  style="background: {option.color}20; color: {option.color};"
                >
                  {option.name}
                </span>
                <button 
                  class="remove-option"
                  onclick={() => removeOption(option.id)}
                >×</button>
              </div>
            {/each}
          </div>
          <div class="add-option">
            <input
              type="text"
              bind:value={newOptionName}
              placeholder="Add option..."
              onkeydown={(e) => e.key === 'Enter' && addOption()}
            />
            <button onclick={addOption}>Add</button>
          </div>
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" onclick={onClose}>Cancel</button>
      <button 
        class="btn-primary" 
        onclick={handleSubmit}
        disabled={!name.trim()}
      >
        Add Property
      </button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal {
    width: 100%;
    max-width: 480px;
    background: var(--bg-primary, #ffffff);
    border-radius: 0.75rem;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from { 
      opacity: 0;
      transform: translateY(-20px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
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
    max-height: 60vh;
    overflow-y: auto;
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

  .form-group input[type="text"] {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: var(--text-primary, #111827);
    background: var(--bg-primary, #ffffff);
    transition: border-color 0.15s;
  }

  .form-group input[type="text"]:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
    box-shadow: 0 0 0 3px var(--accent-light, #e0f2fe);
  }

  .type-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .type-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.75rem 0.5rem;
    background: var(--bg-secondary, #f9fafb);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .type-option:hover {
    background: var(--bg-hover, #f3f4f6);
    border-color: var(--border-hover, #d1d5db);
  }

  .type-option.selected {
    background: var(--accent-light, #e0f2fe);
    border-color: var(--accent-color, #3b82f6);
  }

  .type-icon {
    font-size: 1rem;
    color: var(--text-secondary, #6b7280);
  }

  .type-option.selected .type-icon {
    color: var(--accent-color, #3b82f6);
  }

  .type-label {
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
  }

  .type-option.selected .type-label {
    color: var(--accent-color, #3b82f6);
    font-weight: 500;
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .option-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .color-picker {
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
  }

  .option-tag {
    flex: 1;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .remove-option {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-tertiary, #9ca3af);
    border-radius: 0.25rem;
  }

  .remove-option:hover {
    background: var(--error-light, #fef2f2);
    color: var(--error-color, #ef4444);
  }

  .add-option {
    display: flex;
    gap: 0.5rem;
  }

  .add-option input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    font-size: 0.8125rem;
  }

  .add-option input:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
  }

  .add-option button {
    padding: 0.5rem 0.75rem;
    background: var(--bg-secondary, #f9fafb);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.8125rem;
    color: var(--text-secondary, #6b7280);
  }

  .add-option button:hover {
    background: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #111827);
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
    color: var(--text-primary, #111827);
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
</style>
