<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Block, RichTextSegment } from '$lib/types/blocks';
  import type { Doc as YDoc, Text as YText } from 'yjs';
  import {
    ensureYTextSeededFromPlainText,
    overwriteYText,
    setInnerTextPreserveCaret
  } from '$lib/utils/yjs-contenteditable';

  let { 
    block, 
    pageYDoc,
    editable = true, 
    isSelected = false,
    onChange,
    onEnter,
    onDelete,
    onMenu
  } = $props<{
    block: Block;
    pageYDoc?: YDoc;
    editable?: boolean;
    isSelected?: boolean;
    onChange?: (content: any) => void;
    onEnter?: () => void;
    onDelete?: () => void;
    onMenu?: (rect: DOMRect) => void;
  }>();

  let editorElement: HTMLElement;
  let lastBlockId = '';

  let ytext: YText | null = null;
  let ytextUnobserve: (() => void) | null = null;

  function localPlainText(): string {
    return block.properties.textContent?.map((s: RichTextSegment) => s.text).join('') || '';
  }

  function bindToYText(): void {
    // cleanup previous
    try {
      ytextUnobserve?.();
    } catch {
      // ignore
    }
    ytextUnobserve = null;
    ytext = null;

    if (!editorElement) return;
    if (!pageYDoc) return;

    const ytextLocal = pageYDoc.getText(`block:${block.id}`);
    ytext = ytextLocal;
    ensureYTextSeededFromPlainText(ytextLocal, localPlainText());

    // Initial render
    setInnerTextPreserveCaret(editorElement, ytextLocal.toString());

    const observer = () => {
      if (!editorElement) return;
      const next = ytextLocal.toString();
      if (editorElement.innerText !== next) {
        setInnerTextPreserveCaret(editorElement, next);
      }

      // Keep local persistence in sync (best-effort)
      onChange?.({ textContent: [{ text: next }] });
    };

    ytextLocal.observe(observer);
    ytextUnobserve = () => ytextLocal.unobserve(observer);
  }

  // Set initial content when component mounts or block changes
  onMount(() => {
    if (editorElement) {
      const text = localPlainText();
      editorElement.innerText = text;
      lastBlockId = block.id;

      bindToYText();
    }
  });

  // Update content when block.id changes (switching to different block)
  $effect(() => {
    if (editorElement && block.id !== lastBlockId) {
      const text = localPlainText();
      editorElement.innerText = text;
      lastBlockId = block.id;

      bindToYText();
    }
  });

  // Rebind if collaboration doc is attached/changed.
  $effect(() => {
    if (editorElement) {
      // touch reactive dependency
      void pageYDoc;
      bindToYText();
    }
  });

  onDestroy(() => {
    try {
      ytextUnobserve?.();
    } catch {
      // ignore
    }
    ytextUnobserve = null;
    ytext = null;
  });

  // Get caret position for slash menu positioning
  function getCaretCoordinates(): { x: number; y: number } {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      return { x: rect.left, y: rect.bottom + 4 };
    }
    // Fallback to element position
    const rect = editorElement.getBoundingClientRect();
    return { x: rect.left, y: rect.bottom + 4 };
  }

  // Handle keyboard navigation
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onEnter?.();
    } else if (event.key === 'Backspace' && (event.target as HTMLElement).innerText === '') {
      event.preventDefault();
      onDelete?.();
    }
  }

  // Handle input to detect slash command
  function handleInput(event: Event) {
    const target = event.target as HTMLElement;
    const text = target.innerText;
    
    // Check if text ends with "/" (user just typed a slash) - trigger anywhere
    if (text.endsWith('/')) {
      // Get caret position for menu
      const coords = getCaretCoordinates();
      const rect = editorElement.getBoundingClientRect();
      
      // Create a rect at the caret position
      const menuRect = {
        left: coords.x || rect.left,
        right: coords.x || rect.left,
        top: coords.y - 20 || rect.top,
        bottom: coords.y || rect.bottom,
        x: coords.x || rect.left,
        y: coords.y - 20 || rect.top,
        width: 0,
        height: 20,
        toJSON: () => ({})
      } as DOMRect;
      
      if (onMenu) {
        onMenu(menuRect);
      }
    }
    
    if (pageYDoc && ytext) {
      pageYDoc.transact(() => overwriteYText(ytext, text));
    }

    onChange?.({ textContent: [{ text }] });
  }
</script>

<div 
  class="block-wrapper"
  class:selected={isSelected}
>
  <!-- Block Actions (visible on hover) -->
  <div class="block-actions">
    <!-- Drag Handle -->
    <button class="action-btn drag-handle" title="Drag to move">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
    </button>
    <!-- Delete Button -->
    <button class="action-btn delete-btn" title="Delete block" onclick={() => onDelete?.()}>
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
    </button>
  </div>

  <!-- Content -->
  <div
    bind:this={editorElement}
    contenteditable={editable}
    class="block-content"
    data-placeholder="Type '/' for commands"
    oninput={handleInput}
    onkeydown={handleKeydown}
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

  .block-content {
    width: 100%;
    outline: none;
    min-height: 1.5em;
    font-size: 1rem;
    line-height: 1.625;
    color: #374151;
  }

  .block-content:empty::before {
    content: attr(data-placeholder);
    color: #9ca3af;
    pointer-events: none;
  }

  .block-content:focus {
    outline: none;
  }
</style>