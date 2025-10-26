<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Typography from '@tiptap/extension-typography';
  import Collaboration from '@tiptap/extension-collaboration';
  import type { Doc as YDoc } from 'yjs';
  import EditorToolbar from './EditorToolbar.svelte';
  
  // Props
  export let yjsDocument: YDoc;
  export let editable: boolean = true;
  export let placeholder: string = 'Start writing...';
  export let onUpdate: ((content: string) => void) | undefined = undefined;
  export let showToolbar: boolean = true;
  
  // Editor instance
  let editor: Editor | null = null;
  let editorElement: HTMLElement;
  
  // Initialize editor on mount
  onMount(() => {
    if (!yjsDocument) {
      console.error('YjsDocument is required for RichTextEditor');
      return;
    }
    
    editor = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Typography,
        Collaboration.configure({
          document: yjsDocument,
          field: 'content', // This should match the field name used in YjsDocumentManager
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
  });
  
  // Cleanup on destroy
  onDestroy(() => {
    if (editor) {
      editor.destroy();
      editor = null;
    }
  });
  
  // Reactive updates for editable prop
  $: if (editor) {
    editor.setEditable(editable);
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