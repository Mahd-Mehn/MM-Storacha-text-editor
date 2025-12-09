<script lang="ts">
  import { onMount } from 'svelte';
  import type { Block, RichTextSegment } from '$lib/types/blocks';

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

  let checked = $derived(block.properties.checked ?? false);

  onMount(() => {
    if (editorElement) {
      const text = block.properties.textContent?.map((s: RichTextSegment) => s.text).join('') || '';
      editorElement.innerText = text;
      lastBlockId = block.id;
    }
  });

  $effect(() => {
    if (editorElement && block.id !== lastBlockId) {
      const text = block.properties.textContent?.map((s: RichTextSegment) => s.text).join('') || '';
      editorElement.innerText = text;
      lastBlockId = block.id;
    }
  });

  function toggleChecked() {
    onChange?.({
      checked: !checked,
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
      checked,
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

  <button 
    class="checkbox"
    class:checked
    onclick={toggleChecked}
    aria-label={checked ? 'Mark as incomplete' : 'Mark as complete'}
  >
    {#if checked}
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
    {/if}
  </button>

  <div
    bind:this={editorElement}
    contenteditable={editable}
    class="block-content"
    class:completed={checked}
    data-placeholder="To-do"
    oninput={handleInput}
    onkeydown={handleKeydown}
    onfocus={() => onFocus?.()}
    role="textbox"
    tabindex="0"
  ></div>
</div>

<style>
  .block-wrapper {
    position: relative;
    display: flex;
    align-items: flex-start;
    padding: 0.25rem 0;
    border-radius: 0.25rem;
    transition: background 0.15s;
    gap: 0.5rem;
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
    top: 0.125rem;
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

  .checkbox {
    width: 18px;
    height: 18px;
    min-width: 18px;
    border: 2px solid #d1d5db;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 2px;
    transition: all 0.15s;
  }

  .checkbox:hover {
    border-color: #2563eb;
  }

  .checkbox.checked {
    background: #2563eb;
    border-color: #2563eb;
    color: white;
  }

  .block-content {
    flex: 1;
    outline: none;
    min-height: 1.5rem;
    line-height: 1.5;
  }

  .block-content.completed {
    text-decoration: line-through;
    color: #9ca3af;
  }

  .block-content:empty::before {
    content: attr(data-placeholder);
    color: #9ca3af;
    pointer-events: none;
  }
</style>
