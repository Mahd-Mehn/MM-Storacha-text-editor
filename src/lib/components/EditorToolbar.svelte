<script lang="ts">
  import type { Editor } from '@tiptap/core';
  
  // Props
  export let editor: Editor | null;
  
  // Reactive state for button active states
  $: isHeading1 = editor?.isActive('heading', { level: 1 }) ?? false;
  $: isHeading2 = editor?.isActive('heading', { level: 2 }) ?? false;
  $: isHeading3 = editor?.isActive('heading', { level: 3 }) ?? false;
  $: isBold = editor?.isActive('bold') ?? false;
  $: isItalic = editor?.isActive('italic') ?? false;
  $: isBulletList = editor?.isActive('bulletList') ?? false;
  $: isOrderedList = editor?.isActive('orderedList') ?? false;
  $: isBlockquote = editor?.isActive('blockquote') ?? false;
  $: isCodeBlock = editor?.isActive('codeBlock') ?? false;
  
  // Toolbar actions
  function toggleHeading1() {
    if (!editor) return;
    editor.chain().focus().toggleHeading({ level: 1 }).run();
  }
  
  function toggleHeading2() {
    if (!editor) return;
    editor.chain().focus().toggleHeading({ level: 2 }).run();
  }
  
  function toggleHeading3() {
    if (!editor) return;
    editor.chain().focus().toggleHeading({ level: 3 }).run();
  }
  
  function toggleBold() {
    if (!editor) return;
    editor.chain().focus().toggleBold().run();
  }
  
  function toggleItalic() {
    if (!editor) return;
    editor.chain().focus().toggleItalic().run();
  }
  
  function toggleBulletList() {
    if (!editor) return;
    editor.chain().focus().toggleBulletList().run();
  }
  
  function toggleOrderedList() {
    if (!editor) return;
    editor.chain().focus().toggleOrderedList().run();
  }
  
  function toggleBlockquote() {
    if (!editor) return;
    editor.chain().focus().toggleBlockquote().run();
  }
  
  function toggleCodeBlock() {
    if (!editor) return;
    editor.chain().focus().toggleCodeBlock().run();
  }
  
  function undo() {
    if (!editor) return;
    editor.chain().focus().undo().run();
  }
  
  function redo() {
    if (!editor) return;
    editor.chain().focus().redo().run();
  }
  
  // Check if actions are available
  $: canUndo = editor?.can().undo() ?? false;
  $: canRedo = editor?.can().redo() ?? false;
</script>

<div class="editor-toolbar">
  <div class="toolbar-group">
    <!-- Heading buttons -->
    <button
      class="toolbar-button"
      class:active={isHeading1}
      on:click={toggleHeading1}
      title="Heading 1 (Ctrl+Alt+1)"
      disabled={!editor}
    >
      H1
    </button>
    
    <button
      class="toolbar-button"
      class:active={isHeading2}
      on:click={toggleHeading2}
      title="Heading 2 (Ctrl+Alt+2)"
      disabled={!editor}
    >
      H2
    </button>
    
    <button
      class="toolbar-button"
      class:active={isHeading3}
      on:click={toggleHeading3}
      title="Heading 3 (Ctrl+Alt+3)"
      disabled={!editor}
    >
      H3
    </button>
  </div>
  
  <div class="toolbar-separator"></div>
  
  <div class="toolbar-group">
    <!-- Text formatting buttons -->
    <button
      class="toolbar-button"
      class:active={isBold}
      on:click={toggleBold}
      title="Bold (Ctrl+B)"
      disabled={!editor}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
        <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
      </svg>
    </button>
    
    <button
      class="toolbar-button"
      class:active={isItalic}
      on:click={toggleItalic}
      title="Italic (Ctrl+I)"
      disabled={!editor}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <line x1="19" y1="4" x2="10" y2="4"></line>
        <line x1="14" y1="20" x2="5" y2="20"></line>
        <line x1="15" y1="4" x2="9" y2="20"></line>
      </svg>
    </button>
  </div>
  
  <div class="toolbar-separator"></div>
  
  <div class="toolbar-group">
    <!-- List buttons -->
    <button
      class="toolbar-button"
      class:active={isBulletList}
      on:click={toggleBulletList}
      title="Bullet List (Ctrl+Shift+8)"
      disabled={!editor}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </svg>
    </button>
    
    <button
      class="toolbar-button"
      class:active={isOrderedList}
      on:click={toggleOrderedList}
      title="Ordered List (Ctrl+Shift+7)"
      disabled={!editor}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <line x1="10" y1="6" x2="21" y2="6"></line>
        <line x1="10" y1="12" x2="21" y2="12"></line>
        <line x1="10" y1="18" x2="21" y2="18"></line>
        <path d="M4 6h1v4"></path>
        <path d="M4 10h2"></path>
        <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>
      </svg>
    </button>
  </div>
  
  <div class="toolbar-separator"></div>
  
  <div class="toolbar-group">
    <!-- Additional formatting -->
    <button
      class="toolbar-button"
      class:active={isBlockquote}
      on:click={toggleBlockquote}
      title="Blockquote (Ctrl+Shift+B)"
      disabled={!editor}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path>
        <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path>
      </svg>
    </button>
    
    <button
      class="toolbar-button"
      class:active={isCodeBlock}
      on:click={toggleCodeBlock}
      title="Code Block (Ctrl+Alt+C)"
      disabled={!editor}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <polyline points="16,18 22,12 16,6"></polyline>
        <polyline points="8,6 2,12 8,18"></polyline>
      </svg>
    </button>
  </div>
  
  <div class="toolbar-separator"></div>
  
  <div class="toolbar-group">
    <!-- Undo/Redo buttons -->
    <button
      class="toolbar-button"
      on:click={undo}
      title="Undo (Ctrl+Z)"
      disabled={!editor || !canUndo}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 7v6h6"></path>
        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
      </svg>
    </button>
    
    <button
      class="toolbar-button"
      on:click={redo}
      title="Redo (Ctrl+Y)"
      disabled={!editor || !canRedo}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 7v6h-6"></path>
        <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path>
      </svg>
    </button>
  </div>
</div>

<style>
  .editor-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    background-color: #f9fafb;
    border-radius: 0.5rem 0.5rem 0 0;
    flex-wrap: wrap;
  }
  
  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .toolbar-separator {
    width: 1px;
    height: 1.5rem;
    background-color: #d1d5db;
    margin: 0 0.25rem;
  }
  
  .toolbar-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid transparent;
    border-radius: 0.375rem;
    background-color: transparent;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s ease-in-out;
    font-size: 0.875rem;
    font-weight: 500;
  }
  
  .toolbar-button:hover:not(:disabled) {
    background-color: #e5e7eb;
    border-color: #d1d5db;
  }
  
  .toolbar-button:active:not(:disabled) {
    background-color: #d1d5db;
  }
  
  .toolbar-button.active {
    background-color: #3b82f6;
    color: white;
    border-color: #2563eb;
  }
  
  .toolbar-button.active:hover {
    background-color: #2563eb;
  }
  
  .toolbar-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .toolbar-button svg {
    width: 1rem;
    height: 1rem;
    stroke: currentColor;
    stroke-width: 2;
    fill: none;
  }
  
  .toolbar-button svg[fill="currentColor"] {
    fill: currentColor;
    stroke: none;
  }
  
  /* Responsive design */
  @media (max-width: 640px) {
    .editor-toolbar {
      padding: 0.5rem;
      gap: 0.25rem;
    }
    
    .toolbar-button {
      width: 1.75rem;
      height: 1.75rem;
    }
    
    .toolbar-separator {
      height: 1.25rem;
    }
  }
</style>