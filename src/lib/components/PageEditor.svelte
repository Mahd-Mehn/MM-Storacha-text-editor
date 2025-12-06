<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { pageManager } from '$lib/services/page-manager';
  import { blockManager } from '$lib/services/block-manager';
  import type { Page } from '$lib/types/pages';
  import type { Block } from '$lib/types/blocks';
  import ParagraphBlock from './blocks/ParagraphBlock.svelte';
  import HeadingBlock from './blocks/HeadingBlock.svelte';
  import SlashCommandMenu from './SlashCommandMenu.svelte';

  let { pageId } = $props<{ pageId: string }>();

  let page = $state<Page | undefined>(undefined);
  let blocks = $state<Block[]>([]);
  let loading = $state(true);
  
  // Slash command menu state
  let showSlashMenu = $state(false);
  let slashMenuPosition = $state({ x: 0, y: 0 });
  let activeBlockId = $state<string | null>(null);

  // Cleanup on destroy
  onDestroy(() => {
    // Flush any pending saves before unmounting
    blockManager.flushSave();
  });

  async function loadPageData(id: string) {
    loading = true;
    // Ensure services are initialized
    await pageManager.initialize();
    await blockManager.initialize();

    page = pageManager.getPage(id);
    
    if (page) {
      // Load blocks for the page
      blocks = blockManager.getPageBlocks(id);
      
      // If no blocks, create a default one
      if (blocks.length === 0) {
        const newBlock = blockManager.createBlock({
          type: 'paragraph',
          pageId: id,
          properties: { textContent: [] }
        });
        blocks = [newBlock];
      }
    }
    loading = false;
  }

  $effect(() => {
    if (pageId) {
      loadPageData(pageId);
    }
  });

  function updateTitle(e: Event) {
    const target = e.target as HTMLInputElement;
    if (page) {
      pageManager.updatePage({
        id: page.id,
        title: target.value
      });
    }
  }

  function handleBlockChange(blockId: string, content: any) {
    // Update the block with new content via block manager
    blockManager.updateBlock({
      id: blockId,
      properties: content
    });
    // Refresh blocks list to reflect changes
    blocks = blockManager.getPageBlocks(pageId);
  }

  function addBlock(afterBlockId: string, blockType: string = 'paragraph') {
    const newBlock = blockManager.createBlock({
      type: blockType,
      pageId: pageId,
      properties: blockType.startsWith('heading') 
        ? { textContent: [], level: parseInt(blockType.replace('heading', '')) || 1 }
        : { textContent: [] }
    });
    
    // Move block to correct position
    blockManager.moveBlock({
      blockId: newBlock.id,
      targetParentId: null,
      targetPageId: pageId,
      insertAfter: afterBlockId
    });
    
    blocks = blockManager.getPageBlocks(pageId);
  }

  function deleteBlock(blockId: string) {
    // Don't delete if it's the only block
    if (blocks.length <= 1) {
      return;
    }
    
    // Find the index of the block to delete
    const blockIndex = blocks.findIndex(b => b.id === blockId);
    
    // Delete the block
    blockManager.deleteBlock(blockId);
    
    // Refresh blocks list
    blocks = blockManager.getPageBlocks(pageId);
    
    // Focus the previous block if possible
    if (blockIndex > 0 && blocks.length > 0) {
      // We'll need to focus the previous block after the DOM updates
      setTimeout(() => {
        const prevBlock = document.querySelector(`[data-block-id="${blocks[blockIndex - 1]?.id}"] [contenteditable]`) as HTMLElement;
        if (prevBlock) {
          prevBlock.focus();
          // Move cursor to end
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(prevBlock);
          range.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }, 0);
    }
  }

  function handleSlashMenu(blockId: string, rect: DOMRect) {
    activeBlockId = blockId;
    slashMenuPosition = {
      x: rect.left,
      y: rect.bottom + 8
    };
    showSlashMenu = true;
  }

  function handleSlashCommand(command: string) {
    if (!activeBlockId) return;
    
    // Convert the current block to the selected type
    const currentBlock = blocks.find(b => b.id === activeBlockId);
    if (currentBlock) {
      // Clear the slash character from the block
      blockManager.updateBlock({
        id: activeBlockId,
        type: command,
        properties: command.startsWith('heading') 
          ? { textContent: [], level: parseInt(command.replace('heading', '')) || 1 }
          : { textContent: [] }
      });
      blocks = blockManager.getPageBlocks(pageId);
    }
    
    showSlashMenu = false;
    activeBlockId = null;
  }

  function closeSlashMenu() {
    showSlashMenu = false;
    activeBlockId = null;
  }
</script>

<div class="page-editor">
  {#if loading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <span>Loading...</span>
    </div>
  {:else if page}
    <!-- Page Cover (if exists) -->
    {#if page.cover}
      <div class="page-cover">
        {#if page.cover.type === 'image'}
          <img src={page.cover.value} alt="Cover" class="cover-image" />
        {:else if page.cover.type === 'color'}
          <div class="cover-color" style="background-color: {page.cover.value}"></div>
        {:else}
          <div class="cover-gradient" style="background: {page.cover.value}"></div>
        {/if}
      </div>
    {/if}

    <div class="page-content">
      <!-- Page Icon & Title -->
      <div class="page-header">
        {#if page.icon}
          <div class="page-icon">{page.icon.value}</div>
        {/if}
        
        <input
          type="text"
          class="page-title-input"
          placeholder="Untitled"
          value={page.title}
          oninput={updateTitle}
        />
      </div>

      <!-- Blocks -->
      <div class="blocks-container">
        {#each blocks as block (block.id)}
          <div class="block-wrapper" data-block-id={block.id}>
            {#if block.type === 'paragraph'}
              <ParagraphBlock 
                {block} 
                onChange={(content) => handleBlockChange(block.id, content)}
                onEnter={() => addBlock(block.id)}
                onDelete={() => deleteBlock(block.id)}
                onMenu={(rect) => handleSlashMenu(block.id, rect)}
              />
            {:else if block.type === 'heading1' || block.type === 'heading2' || block.type === 'heading3'}
              <HeadingBlock 
                {block} 
                onChange={(content) => handleBlockChange(block.id, content)}
                onEnter={() => addBlock(block.id)}
                onDelete={() => deleteBlock(block.id)}
              />
            {:else}
              <div class="unknown-block">
                Unknown block type: {block.type}
              </div>
            {/if}
          </div>
        {/each}
      </div>
      
      <!-- Empty state / Click to add -->
      <div 
        class="click-area"
        role="button"
        tabindex="0"
        onclick={() => {
          if (blocks.length > 0) {
            addBlock(blocks[blocks.length - 1].id);
          }
        }}
        onkeydown={(e) => {
          if (e.key === 'Enter' && blocks.length > 0) {
            addBlock(blocks[blocks.length - 1].id);
          }
        }}
      ></div>
    </div>

  {:else}
    <div class="not-found">
      <div class="not-found-icon">📄</div>
      <div class="not-found-title">Page not found</div>
      <div class="not-found-text">The page you are looking for does not exist or has been deleted.</div>
    </div>
  {/if}
</div>

<!-- Slash Command Menu -->
<SlashCommandMenu 
  isOpen={showSlashMenu}
  position={slashMenuPosition}
  onSelect={handleSlashCommand}
  onClose={closeSlashMenu}
/>

<style>
  .page-editor {
    min-height: 100%;
    background: white;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    gap: 1rem;
    color: #9ca3af;
  }

  .loading-spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid #e5e7eb;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .page-cover {
    height: 200px;
    width: 100%;
    background: #f3f4f6;
    overflow: hidden;
    position: relative;
  }

  .cover-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cover-color,
  .cover-gradient {
    width: 100%;
    height: 100%;
  }

  .page-content {
    max-width: 900px;
    margin: 0 auto;
    padding: 3rem 4rem 6rem;
  }

  .page-header {
    margin-bottom: 2rem;
  }

  .page-icon {
    font-size: 4rem;
    margin-bottom: 0.75rem;
    line-height: 1;
  }

  .page-title-input {
    width: 100%;
    font-size: 2.5rem;
    font-weight: 700;
    color: #111827;
    border: none;
    background: transparent;
    outline: none;
    padding: 0;
    line-height: 1.2;
  }

  .page-title-input::placeholder {
    color: #d1d5db;
  }

  .blocks-container {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .block-wrapper {
    position: relative;
  }

  .unknown-block {
    padding: 0.75rem 1rem;
    border: 1px solid #fecaca;
    background: #fef2f2;
    color: #dc2626;
    font-size: 0.875rem;
    border-radius: 0.5rem;
  }

  .click-area {
    height: 150px;
    cursor: text;
  }

  .not-found {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    text-align: center;
    color: #6b7280;
  }

  .not-found-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .not-found-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #374151;
  }

  .not-found-text {
    font-size: 0.9375rem;
  }

  @media (max-width: 768px) {
    .page-content {
      padding: 2rem 1.5rem 4rem;
    }

    .page-title-input {
      font-size: 2rem;
    }

    .page-icon {
      font-size: 3rem;
    }
  }
</style>