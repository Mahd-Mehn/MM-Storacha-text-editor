<script lang="ts">
  import { onMount } from 'svelte';
  import type { Block, CodeLanguage, RichTextSegment } from '$lib/types/blocks';

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
  let showLangPicker = $state(false);

  const languages: { id: CodeLanguage; label: string }[] = [
    { id: 'javascript', label: 'JavaScript' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'python', label: 'Python' },
    { id: 'rust', label: 'Rust' },
    { id: 'go', label: 'Go' },
    { id: 'java', label: 'Java' },
    { id: 'html', label: 'HTML' },
    { id: 'css', label: 'CSS' },
    { id: 'json', label: 'JSON' },
    { id: 'sql', label: 'SQL' },
    { id: 'bash', label: 'Bash' },
    { id: 'plaintext', label: 'Plain Text' },
  ];

  let language = $derived(block.properties.language || 'javascript');

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

  function selectLanguage(lang: CodeLanguage) {
    showLangPicker = false;
    onChange?.({
      language: lang,
      textContent: block.properties.textContent
    });
  }

  function handleKeydown(event: KeyboardEvent) {
    // Allow Enter for new lines in code blocks
    if (event.key === 'Tab') {
      event.preventDefault();
      document.execCommand('insertText', false, '  ');
    } else if (event.key === 'Backspace' && (event.target as HTMLElement).innerText === '') {
      event.preventDefault();
      onDelete?.();
    }
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLElement;
    const text = target.innerText;
    onChange?.({
      language,
      textContent: [{ text }]
    });
  }

  function copyCode() {
    const text = block.properties.textContent?.map((s: RichTextSegment) => s.text).join('') || '';
    navigator.clipboard.writeText(text);
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

  <div class="code-container">
    <div class="code-header">
      <button 
        class="lang-selector"
        onclick={() => showLangPicker = !showLangPicker}
      >
        {languages.find(l => l.id === language)?.label || language}
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>

      {#if showLangPicker}
        <div class="lang-picker">
          {#each languages as lang}
            <button 
              class="lang-option"
              class:selected={lang.id === language}
              onclick={() => selectLanguage(lang.id)}
            >
              {lang.label}
            </button>
          {/each}
        </div>
      {/if}

      <button class="copy-btn" onclick={copyCode} title="Copy code">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
      </button>
    </div>

    <pre><div
      bind:this={editorElement}
      contenteditable={editable}
      class="block-content code-editor"
      data-placeholder="// Write your code here..."
      oninput={handleInput}
      onkeydown={handleKeydown}
      onfocus={() => onFocus?.()}
      role="textbox"
      aria-label="Code editor"
      tabindex="0"
    ></div></pre>
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

  .code-container {
    flex: 1;
    background: #1e1e1e;
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .code-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: #2d2d2d;
    position: relative;
  }

  .lang-selector {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: transparent;
    border: none;
    color: #9ca3af;
    font-size: 0.75rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .lang-selector:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e5e7eb;
  }

  .lang-picker {
    position: absolute;
    top: 100%;
    left: 0.5rem;
    background: #2d2d2d;
    border: 1px solid #404040;
    border-radius: 8px;
    padding: 0.25rem;
    max-height: 200px;
    overflow-y: auto;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .lang-option {
    display: block;
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    color: #e5e7eb;
    font-size: 0.75rem;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    border-radius: 4px;
  }

  .lang-option:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .lang-option.selected {
    background: #2563eb;
  }

  .copy-btn {
    background: transparent;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
  }

  .copy-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e5e7eb;
  }

  pre {
    margin: 0;
    padding: 1rem;
    overflow-x: auto;
  }

  .block-content {
    display: block;
    outline: none;
    min-height: 3rem;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 0.875rem;
    line-height: 1.6;
    color: #e5e7eb;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .block-content:empty::before {
    content: attr(data-placeholder);
    color: #6b7280;
    pointer-events: none;
  }
</style>
