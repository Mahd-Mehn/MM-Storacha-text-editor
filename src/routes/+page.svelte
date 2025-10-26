<script lang="ts">
  import { onMount } from 'svelte';
  import { RichTextEditor } from '$lib';
  import { yjsDocumentManager } from '$lib/services';
  import type { Doc as YDoc } from 'yjs';
  
  let yjsDocument: YDoc;
  let editorContent = '';
  
  onMount(() => {
    // Create a test document
    yjsDocument = yjsDocumentManager.createDocument('test-note-1');
    
    // Set some initial content
    yjsDocumentManager.setTextContent(yjsDocument, 'Welcome to Storacha Notes!\n\nThis is a rich text editor with collaborative editing capabilities.');
  });
  
  function handleUpdate(content: string) {
    editorContent = content;
    console.log('Editor content updated:', content);
  }
</script>

<div class="container">
  <header>
    <h1>Storacha Notes</h1>
    <p>Privacy-first, offline-capable note-taking with decentralized storage</p>
  </header>
  
  <main>
    {#if yjsDocument}
      <div class="editor-container">
        <h2>Rich Text Editor Demo</h2>
        <RichTextEditor 
          {yjsDocument} 
          placeholder="Start writing your note..."
          onUpdate={handleUpdate}
        />
        
        <div class="content-preview">
          <h3>Current Content:</h3>
          <pre>{editorContent}</pre>
        </div>
      </div>
    {:else}
      <p>Loading editor...</p>
    {/if}
  </main>
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  header {
    text-align: center;
    margin-bottom: 3rem;
  }
  
  header h1 {
    font-size: 2.5rem;
    font-weight: bold;
    color: #1f2937;
    margin-bottom: 0.5rem;
  }
  
  header p {
    font-size: 1.125rem;
    color: #6b7280;
  }
  
  .editor-container {
    max-width: 800px;
    margin: 0 auto;
  }
  
  .editor-container h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 1rem;
  }
  
  .content-preview {
    margin-top: 2rem;
    padding: 1rem;
    background-color: #f9fafb;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
  }
  
  .content-preview h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }
  
  .content-preview pre {
    background-color: white;
    padding: 1rem;
    border-radius: 0.375rem;
    border: 1px solid #d1d5db;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
    color: #374151;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
</style>
