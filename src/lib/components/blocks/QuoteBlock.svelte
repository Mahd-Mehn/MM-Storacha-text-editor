<script lang="ts">
  import { onMount } from 'svelte';
  import type { Block } from '$lib/types/blocks';

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
      textContent: [{ text }]
    });
  }
</script>

<div 
  class="block-wrapper"
  class:selected={isSelected}
>
  <div class="drag-handle">
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
  </div>

  <div class="quote-container">
    <div
      bind:this={editorElement}
      contenteditable={editable}
      class="block-content"
      data-placeholder="Quote"
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

  .drag-handle {
    position: absolute;
    left: -1.5rem;
    top: 0.5rem;
    padding: 0.25rem;
    color: #9ca3af;
    cursor: grab;
    border-radius: 0.25rem;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .block-wrapper:hover .drag-handle {
    opacity: 1;
  }

  .quote-container {
    flex: 1;
    border-left: 3px solid #374151;
    padding-left: 1rem;
  }

  .block-content {
    outline: none;
    min-height: 1.5rem;
    line-height: 1.6;
    font-size: 1.1em;
    font-style: italic;
    color: #374151;
  }

  .block-content:empty::before {
    content: attr(data-placeholder);
    color: #9ca3af;
    pointer-events: none;
  }
</style>
