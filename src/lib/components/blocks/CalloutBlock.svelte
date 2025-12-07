<script lang="ts">
  import { onMount } from 'svelte';
  import type { Block, CalloutIcon } from '$lib/types/blocks';

  let { 
    block, 
    editable = true, 
    isSelected = false,
    onChange,
    onEnter,
    onDelete,
    onFocus
  } = $props<{
    block: Block;
    editable?: boolean;
    isSelected?: boolean;
    onChange?: (content: any) => void;
    onEnter?: () => void;
    onDelete?: () => void;
    onFocus?: () => void;
  }>();

  let editorElement: HTMLElement;
  let lastBlockId = '';
  let showIconPicker = $state(false);

  const iconOptions: CalloutIcon[] = ['💡', '⚠️', '❌', '✅', '📌', '🔗', '📝', '🎯', '💬', '🚀', '⭐', '🔥'];

  let icon = $derived(block.properties.icon || '💡');
  let bgColor = $derived(block.properties.calloutColor || '#f3f4f6');

  onMount(() => {
    if (editorElement) {
      const text = block.properties.textContent?.map(s => s.text).join('') || '';
      editorElement.innerText = text;
      lastBlockId = block.id;
    }
  });

  $effect(() => {
    if (editorElement && block.id !== lastBlockId) {
      const text = block.properties.textContent?.map(s => s.text).join('') || '';
      editorElement.innerText = text;
      lastBlockId = block.id;
    }
  });

  function selectIcon(newIcon: CalloutIcon) {
    showIconPicker = false;
    onChange?.({
      icon: newIcon,
      calloutColor: bgColor,
      textContent: block.properties.textContent
    });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onEnter?.();
    } else if (event.key === 'Backspace' && (event.target as HTMLElement).innerText === '') {
      event.preventDefault();
      onDelete?.();
    }
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLElement;
    const text = target.innerText;
    onChange?.({
      icon,
      calloutColor: bgColor,
      textContent: [{ text }]
    });
  }
</script>

<div 
  class="block-wrapper"
  class:selected={isSelected}
>
  <div class="block-actions">
    <button class="action-btn drag-handle" title="Drag to move">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
    </button>
    <button class="action-btn delete-btn" title="Delete block" onclick={() => onDelete?.()}>
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
    </button>
  </div>

  <div class="callout-container" style="background-color: {bgColor}">
    <button 
      class="callout-icon"
      onclick={() => showIconPicker = !showIconPicker}
      aria-label="Change icon"
    >
      {icon}
    </button>

    {#if showIconPicker}
      <div class="icon-picker">
        {#each iconOptions as opt}
          <button 
            class="icon-option"
            onclick={() => selectIcon(opt)}
            aria-label="Select {opt}"
          >
            {opt}
          </button>
        {/each}
      </div>
    {/if}

    <div
      bind:this={editorElement}
      contenteditable={editable}
      class="block-content"
      data-placeholder="Type something..."
      oninput={handleInput}
      onkeydown={handleKeydown}
      onfocus={() => onFocus?.()}
      role="textbox"
      tabindex="0"
    ></div>
  </div>
</div>

<style>
  .block-wrapper {
    position: relative;
    display: flex;
    align-items: flex-start;
    padding: 0.25rem 0;
    border-radius: 0.25rem;
    transition: background 0.15s;
  }

  .block-wrapper:hover {
    background: rgba(0, 0, 0, 0.02);
  }

  .block-wrapper.selected {
    background-color: rgba(46, 170, 220, 0.1);
  }

  .block-actions {
    position: absolute;
    left: -2.5rem;
    top: 0.5rem;
    display: flex;
    gap: 0.125rem;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .block-wrapper:hover .block-actions {
    opacity: 1;
  }

  .action-btn {
    padding: 0.25rem;
    color: #9ca3af;
    background: transparent;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .action-btn:hover {
    background: #f3f4f6;
    color: #6b7280;
  }

  .drag-handle {
    cursor: grab;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .delete-btn:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  .callout-container {
    flex: 1;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 0.5rem;
    position: relative;
  }

  .callout-icon {
    font-size: 1.25rem;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    border-radius: 4px;
    transition: background 0.15s;
  }

  .callout-icon:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .icon-picker {
    position: absolute;
    top: 100%;
    left: 0.5rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 0.5rem;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.25rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10;
  }

  .icon-option {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }

  .icon-option:hover {
    background: #f3f4f6;
  }

  .block-content {
    flex: 1;
    outline: none;
    min-height: 1.5rem;
    line-height: 1.5;
  }

  .block-content:empty::before {
    content: attr(data-placeholder);
    color: #9ca3af;
    pointer-events: none;
  }
</style>
