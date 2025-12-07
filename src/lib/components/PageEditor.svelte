<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { pageManager } from '$lib/services/page-manager';
  import { blockManager } from '$lib/services/block-manager';
  import { workspaceState, type Page as WorkspacePage } from '$lib/stores/workspace';
  import { get } from 'svelte/store';
  import type { Page } from '$lib/types/pages';
  import type { Block, BlockType } from '$lib/types/blocks';
  import ParagraphBlock from './blocks/ParagraphBlock.svelte';
  import HeadingBlock from './blocks/HeadingBlock.svelte';
  import TodoBlock from './blocks/TodoBlock.svelte';
  import ToggleBlock from './blocks/ToggleBlock.svelte';
  import QuoteBlock from './blocks/QuoteBlock.svelte';
  import CalloutBlock from './blocks/CalloutBlock.svelte';
  import CodeBlock from './blocks/CodeBlock.svelte';
  import DividerBlock from './blocks/DividerBlock.svelte';
  import BulletListBlock from './blocks/BulletListBlock.svelte';
  import NumberedListBlock from './blocks/NumberedListBlock.svelte';
  import SlashCommandMenu from './SlashCommandMenu.svelte';

  let { pageId } = $props<{ pageId: string }>();

  let page = $state<Page | undefined>(undefined);
  let blocks = $state<Block[]>([]);
  let loading = $state(true);
  
  // Slash command menu state
  let showSlashMenu = $state(false);
  let slashMenuPosition = $state({ x: 0, y: 0 });
  let activeBlockId = $state<string | null>(null);

  // Drag & drop state
  let draggedBlockId = $state<string | null>(null);
  let dropTargetId = $state<string | null>(null);
  let dropPosition = $state<'before' | 'after' | null>(null);

  // Cleanup on destroy
  onDestroy(() => {
    // Flush any pending saves before unmounting
    blockManager.flushSave();
  });

  // Drag & drop handlers
  function handleDragStart(e: DragEvent, blockId: string) {
    draggedBlockId = blockId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', blockId);
    }
    // Add a slight delay to allow drag image to appear
    setTimeout(() => {
      const el = document.querySelector(`[data-block-id="${blockId}"]`);
      if (el) el.classList.add('dragging');
    }, 0);
  }

  function handleDragOver(e: DragEvent, blockId: string) {
    e.preventDefault();
    if (!draggedBlockId || draggedBlockId === blockId) return;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    
    dropTargetId = blockId;
    dropPosition = e.clientY < midY ? 'before' : 'after';
    
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }

  function handleDragLeave(e: DragEvent) {
    // Only clear if leaving the block entirely
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget?.contains(relatedTarget)) {
      dropTargetId = null;
      dropPosition = null;
    }
  }

  function handleDragEnd(e: DragEvent) {
    const el = document.querySelector(`[data-block-id="${draggedBlockId}"]`);
    if (el) el.classList.remove('dragging');
    draggedBlockId = null;
    dropTargetId = null;
    dropPosition = null;
  }

  function handleDrop(e: DragEvent, targetBlockId: string) {
    e.preventDefault();
    
    if (!draggedBlockId || draggedBlockId === targetBlockId) {
      handleDragEnd(e);
      return;
    }
    
    // Calculate insert position
    const targetIndex = blocks.findIndex(b => b.id === targetBlockId);
    const draggedIndex = blocks.findIndex(b => b.id === draggedBlockId);
    
    if (targetIndex === -1 || draggedIndex === -1) {
      handleDragEnd(e);
      return;
    }

    // Determine where to insert
    const insertAfter = dropPosition === 'after' ? targetBlockId : 
      (targetIndex > 0 ? blocks[targetIndex - 1].id : null);

    // Move the block
    blockManager.moveBlock({
      blockId: draggedBlockId,
      targetParentId: null,
      targetPageId: pageId,
      insertAfter: insertAfter
    });
    
    // Refresh blocks
    blocks = blockManager.getPageBlocks(pageId);
    
    handleDragEnd(e);
  }

  // Helper to find a page in workspace state tree
  function findWorkspacePage(pages: WorkspacePage[], id: string): WorkspacePage | null {
    for (const p of pages) {
      if (p.id === id) return p;
      if (p.children && p.children.length > 0) {
        const found = findWorkspacePage(p.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  // Convert workspace page to Page type for PageEditor
  function convertWorkspacePage(wp: WorkspacePage): Page {
    return {
      id: wp.id,
      title: wp.title,
      type: 'page',
      icon: wp.icon,
      cover: wp.cover ? { type: 'image', value: wp.cover } : undefined,
      parentId: wp.parentId ?? null,
      workspaceId: 'default',
      childPages: wp.children?.map(c => c.id) || [],
      blocks: [],
      metadata: {
        created: new Date(wp.createdAt),
        modified: new Date(wp.updatedAt),
        version: 1,
        storachaCID: '',
        shareLinks: [],
        isDeleted: false,
        isTemplate: false,
        isFavorite: false,
        viewCount: 0
      }
    };
  }

  async function loadPageData(id: string) {
    loading = true;
    // Ensure services are initialized
    await pageManager.initialize();
    await blockManager.initialize();

    // First try pageManager
    page = pageManager.getPage(id);
    
    // If not found, check workspaceState
    if (!page) {
      const state = get(workspaceState);
      const workspacePage = findWorkspacePage(state.workspace.pages, id);
      
      if (workspacePage) {
        // Convert and use the workspace page
        page = convertWorkspacePage(workspacePage);
      }
    }
    
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
      const newTitle = target.value;
      
      // Update in pageManager if it exists there
      pageManager.updatePage({
        id: page.id,
        title: newTitle
      });
      
      // Also update in workspaceState for compatibility
      workspaceState.renamePage(page.id, newTitle);
      
      // Update local state
      page = { ...page, title: newTitle };
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

  function addBlock(afterBlockId: string, blockType: BlockType = 'paragraph') {
    // Set default properties based on block type
    let properties: Record<string, any> = { textContent: [] };
    
    if (blockType.startsWith('heading')) {
      properties.level = parseInt(blockType.replace('heading', '')) || 1;
    } else if (blockType === 'todo') {
      properties.checked = false;
    } else if (blockType === 'toggle') {
      properties.collapsed = false;
    } else if (blockType === 'callout') {
      properties.icon = '💡';
      properties.calloutColor = '#f3f4f6';
    } else if (blockType === 'code') {
      properties.language = 'javascript';
    }

    const newBlock = blockManager.createBlock({
      type: blockType,
      pageId: pageId,
      properties
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

  // Helper to get correct index for numbered list items
  function getNumberedListIndex(allBlocks: Block[], currentIndex: number): number {
    let count = 1;
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (allBlocks[i].type === 'numberedList') {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  function handleSlashCommand(command: string) {
    if (!activeBlockId) return;
    
    // Build properties for the new block type
    let properties: Record<string, any> = { textContent: [] };
    
    if (command.startsWith('heading')) {
      properties.level = parseInt(command.replace('heading', '')) || 1;
    } else if (command === 'todo') {
      properties.checked = false;
    } else if (command === 'toggle') {
      properties.collapsed = false;
    } else if (command === 'callout') {
      properties.icon = '💡';
      properties.calloutColor = '#f3f4f6';
    } else if (command === 'code') {
      properties.language = 'javascript';
    }
    
    // Convert the current block to the selected type
    const currentBlock = blocks.find(b => b.id === activeBlockId);
    if (currentBlock) {
      // Get current text and remove the slash command trigger
      const currentText = currentBlock.properties.textContent?.map((s: any) => s.text).join('') || '';
      // Remove the trailing "/" or "/ " from the text
      const cleanedText = currentText.replace(/\/\s*$/, '').trim();
      
      // Update block with new type and cleaned text
      blockManager.updateBlock({
        id: activeBlockId,
        type: command as BlockType,
        properties: {
          ...properties,
          textContent: cleanedText ? [{ text: cleanedText }] : []
        }
      });
      blocks = blockManager.getPageBlocks(pageId);
      
      // Focus the block after update
      setTimeout(() => {
        const blockEl = document.querySelector(`[data-block-id="${activeBlockId}"] [contenteditable]`) as HTMLElement;
        if (blockEl) {
          blockEl.focus();
        }
      }, 50);
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
        {#each blocks as block, index (block.id)}
          <div 
            class="block-wrapper" 
            class:drop-before={dropTargetId === block.id && dropPosition === 'before'}
            class:drop-after={dropTargetId === block.id && dropPosition === 'after'}
            class:is-dragging={draggedBlockId === block.id}
            data-block-id={block.id}
            draggable="true"
            ondragstart={(e) => handleDragStart(e, block.id)}
            ondragover={(e) => handleDragOver(e, block.id)}
            ondragleave={handleDragLeave}
            ondragend={handleDragEnd}
            ondrop={(e) => handleDrop(e, block.id)}
            role="listitem"
          >
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
            {:else if block.type === 'todo'}
              <TodoBlock 
                {block} 
                onChange={(content) => handleBlockChange(block.id, content)}
                onEnter={() => addBlock(block.id, 'todo')}
                onDelete={() => deleteBlock(block.id)}
              />
            {:else if block.type === 'toggle'}
              <ToggleBlock 
                {block} 
                onChange={(content) => handleBlockChange(block.id, content)}
                onEnter={() => addBlock(block.id)}
                onDelete={() => deleteBlock(block.id)}
              />
            {:else if block.type === 'quote'}
              <QuoteBlock 
                {block} 
                onChange={(content) => handleBlockChange(block.id, content)}
                onEnter={() => addBlock(block.id)}
                onDelete={() => deleteBlock(block.id)}
              />
            {:else if block.type === 'callout'}
              <CalloutBlock 
                {block} 
                onChange={(content) => handleBlockChange(block.id, content)}
                onEnter={() => addBlock(block.id)}
                onDelete={() => deleteBlock(block.id)}
              />
            {:else if block.type === 'code'}
              <CodeBlock 
                {block} 
                onChange={(content) => handleBlockChange(block.id, content)}
                onDelete={() => deleteBlock(block.id)}
              />
            {:else if block.type === 'divider'}
              <DividerBlock 
                {block} 
                onDelete={() => deleteBlock(block.id)}
              />
            {:else if block.type === 'bulletList'}
              <BulletListBlock 
                {block} 
                onChange={(content) => handleBlockChange(block.id, content)}
                onEnter={() => addBlock(block.id, 'bulletList')}
                onDelete={() => deleteBlock(block.id)}
              />
            {:else if block.type === 'numberedList'}
              <NumberedListBlock 
                {block}
                index={getNumberedListIndex(blocks, index)}
                onChange={(content) => handleBlockChange(block.id, content)}
                onEnter={() => addBlock(block.id, 'numberedList')}
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
    transition: transform 0.15s, opacity 0.15s;
  }

  .block-wrapper.is-dragging {
    opacity: 0.4;
  }

  .block-wrapper.drop-before::before {
    content: '';
    position: absolute;
    top: -2px;
    left: 0;
    right: 0;
    height: 3px;
    background: #3b82f6;
    border-radius: 2px;
    z-index: 10;
  }

  .block-wrapper.drop-after::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    right: 0;
    height: 3px;
    background: #3b82f6;
    border-radius: 2px;
    z-index: 10;
  }

  :global(.block-wrapper.dragging) {
    opacity: 0.5;
    cursor: grabbing;
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