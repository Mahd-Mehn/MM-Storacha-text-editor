<script lang="ts">
  import { onMount } from 'svelte';
  import type { Block } from '$lib/types/blocks';

  let { 
    block, 
    editable = true, 
    isSelected = false,
    onChange,
    onEnter,
    onDelete
  } = $props<{
    block: Block;
    editable?: boolean;
    isSelected?: boolean;
    onChange?: (content: any) => void;
    onEnter?: () => void;
    onDelete?: () => void;
  }>();

  let editorElement: HTMLElement;
  let lastBlockId = '';

  // Determine heading level
  let level = $derived(block.properties.level || 1);
  let placeholder = $derived(level === 1 ? 'Heading 1' : level === 2 ? 'Heading 2' : 'Heading 3');

  // Set initial content when component mounts
  onMount(() => {
    if (editorElement) {
      const text = block.properties.textContent?.map(s => s.text).join('') || '';
      editorElement.innerText = text;
      lastBlockId = block.id;
    }
  });

  // Update content when block.id changes (switching to different block)
  $effect(() => {
    if (editorElement && block.id !== lastBlockId) {
      const text = block.properties.textContent?.map(s => s.text).join('') || '';
      editorElement.innerText = text;
      lastBlockId = block.id;
    }
  });

  function handleInput(event: Event) {
    const target = event.target as HTMLElement;
    const text = target.innerText;
    
    onChange?.({
      textContent: [{ text }]
    });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      onEnter?.();
    } else if (event.key === 'Backspace' && (event.target as HTMLElement).innerText === '') {
      event.preventDefault();
      onDelete?.();
    }
  }
</script>

<div 
  class="block-wrapper"
  class:selected={isSelected}
>
  <!-- Drag Handle -->
  <div class="drag-handle">
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
  </div>

  <!-- Content -->
  <div
    bind:this={editorElement}
    contenteditable={editable}
    class="block-content"
    class:h1={level === 1}
    class:h2={level === 2}
    class:h3={level === 3}
    data-placeholder={placeholder}
    oninput={handleInput}
    onkeydown={handleKeydown}
    role="heading"
    aria-level={level}
  ></div>
</div>

<style>
  .block-wrapper {
    position: relative;
    display: flex;
    align-items: flex-start;
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
    top: 50%;
    transform: translateY(-50%);
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

  .drag-handle:hover {
    background: #f3f4f6;
    color: #6b7280;
  }

  .block-content {
    width: 100%;
    outline: none;
    color: #111827;
  }

  .block-content:empty::before {
    content: attr(data-placeholder);
    color: #d1d5db;
    pointer-events: none;
  }

  .block-content:focus {
    outline: none;
  }

  .block-content.h1 {
    font-size: 1.875rem;
    font-weight: 700;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    line-height: 1.25;
  }

  .block-content.h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-top: 1.25rem;
    margin-bottom: 0.5rem;
    line-height: 1.3;
  }

  .block-content.h3 {
    font-size: 1.25rem;
    font-weight: 500;
    margin-top: 1rem;
    margin-bottom: 0.25rem;
    line-height: 1.4;
  }
</style>