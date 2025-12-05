<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Typography from '@tiptap/extension-typography';
  import Collaboration from '@tiptap/extension-collaboration';
  import type { Doc as YDoc } from 'yjs';
  
  // Props
  export let yjsDocument: YDoc;
  export let editable: boolean = true;
  export let placeholder: string = 'Start writing...';
  export let onUpdate: ((content: string) => void) | undefined = undefined;
  export let showToolbar: boolean = false; // Disabled by default for clean design
  
  // Editor instance
  let editor: Editor | null = null;
  let editorElement: HTMLElement;
  
  // Initialize editor on mount
  onMount(() => {
    if (!yjsDocument) {
      console.error('YjsDocument is required for RichTextEditor');
      return;
    }
    
    // Cleanup any existing editor instance
    if (editor) {
      try {
        editor.destroy();
      } catch (e) {
        console.warn('Error destroying previous editor:', e);
      }
      editor = null;
    }
    
    try {
      editor = new Editor({
        element: editorElement,
        extensions: [
          StarterKit.configure({
            // Disable history extension as Collaboration provides its own
            history: false,
          }),
          Typography,
          Collaboration.configure({
            document: yjsDocument,
            field: 'content',
          }),
        ],
        content: '',
        editable,
        editorProps: {
          attributes: {
            class: 'editor-content-area',
            'data-placeholder': placeholder,
          },
          handleKeyDown: (view, event) => {
            // Custom keyboard shortcuts
            if (event.ctrlKey || event.metaKey) {
              switch (event.key) {
                case 'b':
                  event.preventDefault();
                editor?.chain().focus().toggleBold().run();
                return true;
              case 'i':
                event.preventDefault();
                editor?.chain().focus().toggleItalic().run();
                return true;
              case '1':
                if (event.altKey) {
                  event.preventDefault();
                  editor?.chain().focus().toggleHeading({ level: 1 }).run();
                  return true;
                }
                break;
              case '2':
                if (event.altKey) {
                  event.preventDefault();
                  editor?.chain().focus().toggleHeading({ level: 2 }).run();
                  return true;
                }
                break;
              case '3':
                if (event.altKey) {
                  event.preventDefault();
                  editor?.chain().focus().toggleHeading({ level: 3 }).run();
                  return true;
                }
                break;
              case '8':
                if (event.shiftKey) {
                  event.preventDefault();
                  editor?.chain().focus().toggleBulletList().run();
                  return true;
                }
                break;
              case '7':
                if (event.shiftKey) {
                  event.preventDefault();
                  editor?.chain().focus().toggleOrderedList().run();
                  return true;
                }
                break;
              case 'c':
                if (event.altKey) {
                  event.preventDefault();
                  editor?.chain().focus().toggleCodeBlock().run();
                  return true;
                }
                break;
            }
          }
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        if (onUpdate) {
          const content = editor.getText();
          onUpdate(content);
        }
      },
      onCreate: ({ editor }) => {
        // Editor is ready
        console.log('Tiptap editor created successfully');
      },
      onDestroy: () => {
        console.log('Tiptap editor destroyed');
      },
    });
    } catch (error) {
      console.error('Failed to initialize editor:', error);
      // If it's a duplicate type error, try to recover
      if (error instanceof Error && error.message.includes('already been defined')) {
        console.warn('Yjs type conflict detected. This may happen on hot reload.');
      }
    }
  });
  
  // Cleanup on destroy
  onDestroy(() => {
    if (editor) {
      try {
        editor.destroy();
      } catch (e) {
        console.warn('Error destroying editor on cleanup:', e);
      }
      editor = null;
    }
  });
  
  // Reactive updates for editable prop
  $: if (editor) {
    editor.setEditable(editable);
  }
  
  // Watch for yjsDocument changes and recreate editor if needed
  $: if (yjsDocument && editorElement) {
    // If the document changes, we need to recreate the editor
    // This is handled by the key block in the parent component
  }
  
  // Export editor instance for parent components
  export function getEditor(): Editor | null {
    return editor;
  }
  
  // Focus the editor
  export function focus(): void {
    if (editor) {
      editor.commands.focus();
    }
  }
  
  // Get current content
  export function getContent(): string {
    return editor ? editor.getText() : '';
  }
  
  // Get HTML content
  export function getHTML(): string {
    return editor ? editor.getHTML() : '';
  }
</script>

<div class="rich-text-editor">
  <div bind:this={editorElement} class="editor-wrapper"></div>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  
  .rich-text-editor {
    background: #ffffff;
    min-height: 100vh;
    width: 100%;
  }
  
  .editor-wrapper {
    max-width: 750px;
    margin: 0 auto;
    padding: 4rem 2rem;
  }
  
  :global(.editor-content-area) {
    outline: none;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 16px;
    line-height: 1.7;
    color: #1a1a1a;
    min-height: 60vh;
  }
  
  /* Placeholder */
  :global(.editor-content-area p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    float: left;
    color: #9ca3af;
    pointer-events: none;
    height: 0;
    font-size: 1.125rem;
    font-weight: 300;
  }
  
  /* Headings - Professional styling */
  :global(.editor-content-area h1) {
    font-size: 2.5rem;
    font-weight: 700;
    margin: 2.5rem 0 1.5rem 0;
    line-height: 1.2;
    color: #0a0a0a;
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
    color: #0a0a0a;
    letter-spacing: -0.01em;
  }
  
  :global(.editor-content-area h3) {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 1.75rem 0 0.875rem 0;
    line-height: 1.4;
    color: #0a0a0a;
  }
  
  :global(.editor-content-area h4) {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 1.5rem 0 0.75rem 0;
    line-height: 1.4;
    color: #1a1a1a;
  }
  
  /* Paragraphs */
  :global(.editor-content-area p) {
    margin: 1.25rem 0;
    line-height: 1.7;
    color: #374151;
  }
  
  /* Lists - Clean styling */
  :global(.editor-content-area ul, .editor-content-area ol) {
    margin: 1.25rem 0;
    padding-left: 1.75rem;
  }
  
  :global(.editor-content-area li) {
    margin: 0.5rem 0;
    line-height: 1.7;
    color: #374151;
  }
  
  :global(.editor-content-area ul li) {
    list-style-type: disc;
  }
  
  :global(.editor-content-area ul ul li) {
    list-style-type: circle;
  }
  
  :global(.editor-content-area ol li) {
    list-style-type: decimal;
  }
  
  /* Text formatting */
  :global(.editor-content-area strong) {
    font-weight: 600;
    color: #1a1a1a;
  }
  
  :global(.editor-content-area em) {
    font-style: italic;
    color: #1a1a1a;
  }
  
  /* Blockquotes - Elegant styling */
  :global(.editor-content-area blockquote) {
    border-left: 3px solid #e5e7eb;
    padding-left: 1.5rem;
    margin: 1.5rem 0;
    color: #6b7280;
    font-style: italic;
  }
  
  /* Code - Professional monospace */
  :global(.editor-content-area code) {
    background-color: #f3f4f6;
    padding: 0.2em 0.4em;
    border-radius: 0.25rem;
    font-family: 'JetBrains Mono', 'Monaco', 'Menlo', monospace;
    font-size: 0.9em;
    color: #1a1a1a;
    font-weight: 400;
  }
  
  :global(.editor-content-area pre) {
    background-color: #1a1a1a;
    padding: 1.5rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin: 1.5rem 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  :global(.editor-content-area pre code) {
    background: none;
    padding: 0;
    color: #e5e7eb;
    font-size: 0.875rem;
    line-height: 1.6;
  }
  
  /* Links */
  :global(.editor-content-area a) {
    color: #3b82f6;
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s;
  }
  
  :global(.editor-content-area a:hover) {
    border-bottom-color: #3b82f6;
  }
  
  /* Horizontal rule */
  :global(.editor-content-area hr) {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 2rem 0;
  }
  
  /* Selection */
  :global(.editor-content-area ::selection) {
    background-color: #dbeafe;
  }
  
  /* Focus state */
  .rich-text-editor:focus-within {
    /* Subtle focus indication */
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .editor-wrapper {
      padding: 2rem 1.5rem;
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
</style>

  
  // Editor instance
  let editor: Editor | null = null;
  let editorElement: HTMLElement;
  
  // Initialize editor on mount
  onMount(() => {
    if (!yjsDocument) {
      console.error('YjsDocument is required for RichTextEditor');
      return;
    }
    
    // Cleanup any existing editor instance
    if (editor) {
      try {
        editor.destroy();
      } catch (e) {
        console.warn('Error destroying previous editor:', e);
      }
      editor = null;
    }
    
    try {
      editor = new Editor({
        element: editorElement,
        extensions: [
          StarterKit.configure({
            // Disable history extension as Collaboration provides its own
            history: false,
          }),
          Typography,
          Collaboration.configure({
            document: yjsDocument,
            field: 'content',
          }),
        ],
        content: '',
        editable,
        editorProps: {
          attributes: {
            class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[200px] p-4',
            'data-placeholder': placeholder,
          },
          handleKeyDown: (view, event) => {
            // Custom keyboard shortcuts
            if (event.ctrlKey || event.metaKey) {
              switch (event.key) {
                case 'b':
                  event.preventDefault();
                editor?.chain().focus().toggleBold().run();
                return true;
              case 'i':
                event.preventDefault();
                editor?.chain().focus().toggleItalic().run();
                return true;
              case '1':
                if (event.altKey) {
                  event.preventDefault();
                  editor?.chain().focus().toggleHeading({ level: 1 }).run();
                  return true;
                }
                break;
              case '2':
                if (event.altKey) {
                  event.preventDefault();
                  editor?.chain().focus().toggleHeading({ level: 2 }).run();
                  return true;
                }
                break;
              case '3':
                if (event.altKey) {
                  event.preventDefault();
                  editor?.chain().focus().toggleHeading({ level: 3 }).run();
                  return true;
                }
                break;
              case '8':
                if (event.shiftKey) {
                  event.preventDefault();
                  editor?.chain().focus().toggleBulletList().run();
                  return true;
                }
                break;
              case '7':
                if (event.shiftKey) {
                  event.preventDefault();
                  editor?.chain().focus().toggleOrderedList().run();
                  return true;
                }
                break;
              case 'c':
                if (event.altKey) {
                  event.preventDefault();
                  editor?.chain().focus().toggleCodeBlock().run();
                  return true;
                }
                break;
            }
          }
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        if (onUpdate) {
          const content = editor.getText();
          onUpdate(content);
        }
      },
      onCreate: ({ editor }) => {
        // Editor is ready
        console.log('Tiptap editor created successfully');
      },
      onDestroy: () => {
        console.log('Tiptap editor destroyed');
      },
    });
    } catch (error) {
      console.error('Failed to initialize editor:', error);
      // If it's a duplicate type error, try to recover
      if (error instanceof Error && error.message.includes('already been defined')) {
        console.warn('Yjs type conflict detected. This may happen on hot reload.');
      }
    }
  });
  
  // Cleanup on destroy
  onDestroy(() => {
    if (editor) {
      try {
        editor.destroy();
      } catch (e) {
        console.warn('Error destroying editor on cleanup:', e);
      }
      editor = null;
    }
  });
  
  // Reactive updates for editable prop
  $: if (editor) {
    editor.setEditable(editable);
  }
  
  // Watch for yjsDocument changes and recreate editor if needed
  $: if (yjsDocument && editorElement) {
    // If the document changes, we need to recreate the editor
    // This is handled by the key block in the parent component
  }
  
  // Export editor instance for parent components
  export function getEditor(): Editor | null {
    return editor;
  }
  
  // Focus the editor
  export function focus(): void {
    if (editor) {
      editor.commands.focus();
    }
  }
  
  // Get current content
  export function getContent(): string {
    return editor ? editor.getText() : '';
  }
  
  // Get HTML content
  export function getHTML(): string {
    return editor ? editor.getHTML() : '';
  }
</script>

<div class="rich-text-editor">
  {#if showToolbar}
    <EditorToolbar {editor} />
  {/if}
  <div bind:this={editorElement} class="editor-content"></div>
</div>

<style>
  .rich-text-editor {
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    background: white;
    min-height: 200px;
  }
  
  .rich-text-editor:focus-within {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  :global(.ProseMirror) {
    outline: none;
    padding: 1rem;
    min-height: 200px;
    white-space: pre-wrap;
  }
  
  :global(.ProseMirror p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    float: left;
    color: #9ca3af;
    pointer-events: none;
    height: 0;
  }
  
  /* Typography styles */
  :global(.ProseMirror h1) {
    font-size: 2rem;
    font-weight: bold;
    margin: 1.5rem 0 1rem 0;
    line-height: 1.2;
  }
  
  :global(.ProseMirror h2) {
    font-size: 1.5rem;
    font-weight: bold;
    margin: 1.25rem 0 0.75rem 0;
    line-height: 1.3;
  }
  
  :global(.ProseMirror h3) {
    font-size: 1.25rem;
    font-weight: bold;
    margin: 1rem 0 0.5rem 0;
    line-height: 1.4;
  }
  
  :global(.ProseMirror p) {
    margin: 0.75rem 0;
    line-height: 1.6;
  }
  
  :global(.ProseMirror ul, .ProseMirror ol) {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }
  
  :global(.ProseMirror li) {
    margin: 0.25rem 0;
    line-height: 1.6;
  }
  
  :global(.ProseMirror strong) {
    font-weight: bold;
  }
  
  :global(.ProseMirror em) {
    font-style: italic;
  }
  
  :global(.ProseMirror blockquote) {
    border-left: 4px solid #e5e7eb;
    padding-left: 1rem;
    margin: 1rem 0;
    color: #6b7280;
  }
  
  :global(.ProseMirror code) {
    background-color: #f3f4f6;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875em;
  }
  
  :global(.ProseMirror pre) {
    background-color: #f3f4f6;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin: 1rem 0;
  }
  
  :global(.ProseMirror pre code) {
    background: none;
    padding: 0;
  }
</style>