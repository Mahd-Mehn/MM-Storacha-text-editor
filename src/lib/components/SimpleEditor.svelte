<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Editor, Extension } from "@tiptap/core";
  import StarterKit from "@tiptap/starter-kit";
  import Placeholder from "@tiptap/extension-placeholder";
  import { Plugin, PluginKey } from '@tiptap/pm/state';

  // Props
  interface Props {
    content?: string;
    editable?: boolean;
    placeholder?: string;
    onUpdate?: (content: string) => void;
  }
  
  let { 
    content = "", 
    editable = true, 
    placeholder = "Type '/' for commands...", 
    onUpdate 
  }: Props = $props();

  // Editor instance
  let editor: Editor | null = null;
  let editorElement: HTMLElement;
  
  // Slash command menu state
  let showSlashMenu = $state(false);
  let slashMenuPosition = $state({ x: 0, y: 0 });
  let selectedCommandIndex = $state(0);
  let slashRange = $state<{ from: number; to: number } | null>(null);

  // Command definitions
  const commands = [
    { id: 'paragraph', icon: '📝', label: 'Text', description: 'Plain text', action: (e: Editor) => e.chain().focus().setParagraph().run() },
    { id: 'heading1', icon: 'H₁', label: 'Heading 1', description: 'Large heading', action: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run() },
    { id: 'heading2', icon: 'H₂', label: 'Heading 2', description: 'Medium heading', action: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run() },
    { id: 'heading3', icon: 'H₃', label: 'Heading 3', description: 'Small heading', action: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run() },
    { id: 'bulletList', icon: '•', label: 'Bullet List', description: 'Unordered list', action: (e: Editor) => e.chain().focus().toggleBulletList().run() },
    { id: 'numberedList', icon: '1.', label: 'Numbered List', description: 'Ordered list', action: (e: Editor) => e.chain().focus().toggleOrderedList().run() },
    { id: 'blockquote', icon: '❝', label: 'Quote', description: 'Block quote', action: (e: Editor) => e.chain().focus().toggleBlockquote().run() },
    { id: 'codeBlock', icon: '⟨/⟩', label: 'Code Block', description: 'Code snippet', action: (e: Editor) => e.chain().focus().toggleCodeBlock().run() },
    { id: 'divider', icon: '─', label: 'Divider', description: 'Horizontal line', action: (e: Editor) => e.chain().focus().setHorizontalRule().run() },
  ];

  // Create slash command extension
  const SlashCommands = Extension.create({
    name: 'slashCommands',
    
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey('slashCommands'),
          props: {
            handleKeyDown(view, event) {
              // Handle slash key - trigger menu anywhere
              if (event.key === '/') {
                const { state } = view;
                const { selection } = state;
                
                // Get cursor position for menu
                const coords = view.coordsAtPos(selection.from);
                
                // Store the position where slash will be inserted
                setTimeout(() => {
                  slashRange = { from: selection.from, to: selection.from + 1 };
                  slashMenuPosition = { x: coords.left, y: coords.bottom + 8 };
                  showSlashMenu = true;
                  selectedCommandIndex = 0;
                }, 10);
              }
              
              // Handle menu navigation when open
              if (showSlashMenu) {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  selectedCommandIndex = (selectedCommandIndex + 1) % commands.length;
                  return true;
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  selectedCommandIndex = (selectedCommandIndex - 1 + commands.length) % commands.length;
                  return true;
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  executeCommand(selectedCommandIndex);
                  return true;
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  closeSlashMenu();
                  return true;
                }
              }
              
              return false;
            },
          },
        }),
      ];
    },
  });

  function executeCommand(index: number) {
    if (!editor || !slashRange) return;
    
    const command = commands[index];
    
    // Delete the slash character
    editor.chain()
      .focus()
      .deleteRange(slashRange)
      .run();
    
    // Execute the command
    command.action(editor);
    
    closeSlashMenu();
  }

  function closeSlashMenu() {
    showSlashMenu = false;
    slashRange = null;
    selectedCommandIndex = 0;
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.slash-menu')) {
      closeSlashMenu();
    }
  }

  // Initialize editor on mount
  onMount(() => {
    editor = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Placeholder.configure({
          placeholder,
        }),
        SlashCommands,
      ],
      content,
      editable,
      editorProps: {
        attributes: {
          class: "editor-content-area",
        },
      },
      onUpdate: ({ editor }) => {
        if (onUpdate) {
          const html = editor.getHTML();
          onUpdate(html);
        }
      },
    });

    document.addEventListener('click', handleClickOutside);
  });

  onDestroy(() => {
    if (editor) {
      editor.destroy();
    }
    document.removeEventListener('click', handleClickOutside);
  });

  $effect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  });
</script>

<div class="rich-text-editor">
  <div bind:this={editorElement} class="editor-wrapper"></div>
  
  <!-- Slash Command Menu -->
  {#if showSlashMenu}
    <div 
      class="slash-menu"
      style="left: {slashMenuPosition.x}px; top: {slashMenuPosition.y}px;"
    >
      <div class="slash-menu-header">
        <span>Commands</span>
        <span class="hint">↑↓ Navigate · ↵ Select · Esc Close</span>
      </div>
      <div class="slash-menu-list">
        {#each commands as command, index (command.id)}
          <button
            class="slash-menu-item"
            class:selected={index === selectedCommandIndex}
            onclick={() => executeCommand(index)}
            onmouseenter={() => selectedCommandIndex = index}
          >
            <span class="item-icon" class:text-icon={command.icon.length > 1 && !command.icon.match(/^\p{Emoji}/u)}>
              {command.icon}
            </span>
            <div class="item-content">
              <span class="item-label">{command.label}</span>
              <span class="item-description">{command.description}</span>
            </div>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap");

  .rich-text-editor {
    background: var(--bg-primary);
    min-height: 100vh;
    width: 100%;
  }

  .editor-wrapper {
    max-width: 750px;
    margin: 0 auto;
    padding: 2rem;
  }

  :global(.editor-content-area) {
    outline: none;
    font-family:
      "Inter",
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    font-size: 16px;
    line-height: 1.7;
    color: var(--text-primary);
    min-height: 60vh;
  }

  :global(.editor-content-area .tiptap.ProseMirror-focused) {
    outline: none;
  }

  :global(.editor-content-area p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    float: left;
    color: var(--text-tertiary);
    pointer-events: none;
    height: 0;
    font-size: 1.125rem;
    font-weight: 300;
  }

  :global(.editor-content-area h1) {
    font-size: 2.5rem;
    font-weight: 700;
    margin: 2.5rem 0 1.5rem 0;
    line-height: 1.2;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  :global(.editor-content-area h1:first-child) {
    margin-top: 0;
  }

  :global(.editor-content-area h2) {
    font-size: 1.875rem;
    font-weight: 600;
    margin: 2rem 0 1rem 0;
    line-height: 1.3;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  :global(.editor-content-area h3) {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 1.75rem 0 0.875rem 0;
    line-height: 1.4;
    color: var(--text-primary);
  }

  :global(.editor-content-area p) {
    margin: 1.25rem 0;
    line-height: 1.7;
    color: var(--text-secondary);
  }

  :global(.editor-content-area ul, .editor-content-area ol) {
    margin: 1.25rem 0;
    padding-left: 1.75rem;
  }

  :global(.editor-content-area li) {
    margin: 0.5rem 0;
    line-height: 1.7;
    color: var(--text-secondary);
  }

  :global(.editor-content-area li p) {
    margin: 0.25rem 0;
  }

  :global(.editor-content-area strong) {
    font-weight: 600;
    color: var(--text-primary);
  }

  :global(.editor-content-area em) {
    font-style: italic;
  }

  :global(.editor-content-area blockquote) {
    border-left: 3px solid var(--accent-color);
    padding-left: 1.5rem;
    margin: 1.5rem 0;
    color: var(--text-secondary);
    font-style: italic;
  }

  :global(.editor-content-area code) {
    background-color: var(--bg-tertiary);
    padding: 0.2em 0.4em;
    border-radius: 0.25rem;
    font-family: "JetBrains Mono", "Monaco", "Menlo", monospace;
    font-size: 0.9em;
    color: var(--text-primary);
  }

  :global(.editor-content-area pre) {
    background-color: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin: 1.5rem 0;
    border: 1px solid var(--border-color);
  }

  :global(.editor-content-area pre code) {
    background: none;
    padding: 0;
    font-size: 0.875rem;
    line-height: 1.6;
  }

  :global(.editor-content-area a) {
    color: var(--accent-color);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s;
  }

  :global(.editor-content-area a:hover) {
    border-bottom-color: var(--accent-color);
  }

  :global(.editor-content-area hr) {
    border: none;
    border-top: 1px solid var(--border-color);
    margin: 2rem 0;
  }

  /* Placeholder styling */
  :global(.editor-content-area .is-empty::before) {
    content: attr(data-placeholder);
    float: left;
    color: var(--text-tertiary);
    pointer-events: none;
    height: 0;
  }

  @media (max-width: 768px) {
    .editor-wrapper {
      padding: 1.5rem;
      max-width: 100%;
    }

    :global(.editor-content-area) {
      font-size: 15px;
    }

    :global(.editor-content-area h1) {
      font-size: 2rem;
    }

    :global(.editor-content-area h2) {
      font-size: 1.5rem;
    }

    :global(.editor-content-area h3) {
      font-size: 1.25rem;
    }
  }

  /* Slash Command Menu Styles */
  .slash-menu {
    position: fixed;
    z-index: 1000;
    width: 280px;
    max-height: 350px;
    background: var(--bg-primary, white);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.75rem;
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05);
    overflow: hidden;
    animation: slideIn 0.15s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .slash-menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.625rem 0.875rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--text-tertiary, #9ca3af);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .slash-menu-header .hint {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    font-size: 0.625rem;
  }

  .slash-menu-list {
    padding: 0.375rem;
    max-height: 300px;
    overflow-y: auto;
  }

  .slash-menu-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    padding: 0.5rem 0.625rem;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }

  .slash-menu-item:hover,
  .slash-menu-item.selected {
    background: var(--bg-hover, #f3f4f6);
  }

  .item-icon {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary, white);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    font-size: 1rem;
    flex-shrink: 0;
  }

  .item-icon.text-icon {
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--text-secondary, #6b7280);
    font-family: ui-monospace, monospace;
  }

  .item-content {
    display: flex;
    flex-direction: column;
    gap: 0.0625rem;
    min-width: 0;
    flex: 1;
  }

  .item-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-primary, #111827);
  }

  .item-description {
    font-size: 0.6875rem;
    color: var(--text-tertiary, #9ca3af);
  }
</style>
