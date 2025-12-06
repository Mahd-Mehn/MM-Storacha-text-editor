<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Editor } from "@tiptap/core";
  import StarterKit from "@tiptap/starter-kit";
  import Typography from "@tiptap/extension-typography";
  import Collaboration from "@tiptap/extension-collaboration";
  import type { Doc as YDoc } from "yjs";

  // Props
  export let yjsDocument: YDoc;
  export let editable: boolean = true;
  export let placeholder: string = "Start writing...";
  export let onUpdate: ((content: string) => void) | undefined = undefined;
  export let showToolbar: boolean = false;

  // Editor instance
  let editor: Editor | null = null;
  let editorElement: HTMLElement;

  // Initialize editor on mount
  onMount(() => {
    if (!yjsDocument) {
      console.error("YjsDocument is required for RichTextEditor");
      return;
    }

    if (editor) {
      try {
        editor.destroy();
      } catch (e) {
        console.warn("Error destroying previous editor:", e);
      }
      editor = null;
    }

    try {
      editor = new Editor({
        element: editorElement,
        extensions: [
          StarterKit.configure({
            history: false as any,
          }),
          Typography,
          Collaboration.configure({
            document: yjsDocument,
            field: "content",
          }),
        ],
        content: "",
        editable,
        editorProps: {
          attributes: {
            class: "editor-content-area",
            "data-placeholder": placeholder,
          },
        },
        onUpdate: ({ editor }) => {
          if (onUpdate) {
            const content = editor.getText();
            onUpdate(content);
          }
        },
      });
    } catch (error) {
      console.error("Failed to initialize editor:", error);
    }
  });

  onDestroy(() => {
    if (editor) {
      try {
        editor.destroy();
      } catch (e) {
        console.warn("Error destroying editor on cleanup:", e);
      }
      editor = null;
    }
  });

  $: if (editor) {
    editor.setEditable(editable);
  }

  export function getEditor(): Editor | null {
    return editor;
  }

  export function focus(): void {
    if (editor) {
      editor.commands.focus();
    }
  }

  export function getContent(): string {
    return editor ? editor.getText() : "";
  }

  export function getHTML(): string {
    return editor ? editor.getHTML() : "";
  }
</script>

<div class="rich-text-editor">
  <div bind:this={editorElement} class="editor-wrapper"></div>
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
    padding: 4rem 2rem;
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

  :global(.editor-content-area strong) {
    font-weight: 600;
    color: var(--text-primary);
  }

  :global(.editor-content-area em) {
    font-style: italic;
  }

  :global(.editor-content-area blockquote) {
    border-left: 3px solid var(--border-color);
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
