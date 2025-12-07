<script lang="ts">
  import type { Block } from '$lib/types/blocks';

  let { 
    block, 
    isSelected = false,
    onDelete
  } = $props<{
    block: Block;
    isSelected?: boolean;
    onDelete?: () => void;
  }>();

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      onDelete?.();
    }
  }
</script>

<div 
  class="block-wrapper"
  class:selected={isSelected}
  tabindex="0"
  onkeydown={handleKeydown}
  role="separator"
>
  <div class="drag-handle">
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
  </div>

  <div class="divider-line"></div>
</div>

<style>
  .block-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    padding: 0.75rem 0;
    border-radius: 0.25rem;
    transition: background 0.15s;
    cursor: pointer;
    outline: none;
  }

  .block-wrapper:hover {
    background: rgba(0, 0, 0, 0.02);
  }

  .block-wrapper:focus {
    background: rgba(0, 0, 0, 0.02);
  }

  .block-wrapper.selected {
    background-color: rgba(46, 170, 220, 0.1);
  }

  .drag-handle {
    position: absolute;
    left: -1.5rem;
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

  .divider-line {
    flex: 1;
    height: 1px;
    background: #e5e7eb;
  }

  .block-wrapper:hover .divider-line {
    background: #d1d5db;
  }
</style>
