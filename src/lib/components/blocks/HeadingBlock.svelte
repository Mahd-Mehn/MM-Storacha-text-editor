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
    onDelete
  } = $props<{
    block: Block;
    pageYDoc?: YDoc;
    editable?: boolean;
    isSelected?: boolean;
    onChange?: (content: any) => void;
    onEnter?: () => void;
    onDelete?: () => void;
  }>();

  let editorElement: HTMLElement;
  let lastBlockId = '';

  let ytext: YText | null = null;
  let ytextUnobserve: (() => void) | null = null;

  function localPlainText(): string {
    return block.properties.textContent?.map((s: RichTextSegment) => s.text).join('') || '';
  }

  function bindToYText(): void {
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
    setInnerTextPreserveCaret(editorElement, ytextLocal.toString());

    const observer = () => {
      if (!editorElement) return;
      const next = ytextLocal.toString();
      if (editorElement.innerText !== next) {
        setInnerTextPreserveCaret(editorElement, next);
      }
      onChange?.({ textContent: [{ text: next }] });
    };

    ytextLocal.observe(observer);
    ytextUnobserve = () => ytextLocal.unobserve(observer);
  }

  // Determine heading level
  let level = $derived(block.properties.level || 1);
  let placeholder = $derived(level === 1 ? 'Heading 1' : level === 2 ? 'Heading 2' : 'Heading 3');

  // Set initial content when component mounts
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

  $effect(() => {
    if (editorElement) {
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

  function handleInput(event: Event) {
    const target = event.target as HTMLElement;
    const text = target.innerText;

    if (pageYDoc && ytext) {
      pageYDoc.transact(() => overwriteYText(ytext, text));
    }
    
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
  <!-- Block Actions -->
  <div class="block-actions">
    <button class="action-btn drag-handle" title="Drag to move">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
    </button>
    <button class="action-btn delete-btn" title="Delete block" onclick={() => onDelete?.()}>
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
    </button>
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

  .block-actions {
    position: absolute;
    left: -2.5rem;
    top: 50%;
    transform: translateY(-50%);
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