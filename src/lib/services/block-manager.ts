// Block Manager Service
// Handles block CRUD operations, tree management, and serialization

import { Doc as YDoc, encodeStateAsUpdate, applyUpdate } from 'yjs';
import type {
  Block,
  BlockType,
  BlockProperties,
  BlockTree,
  CreateBlockInput,
  UpdateBlockInput,
  MoveBlockInput,
  SerializedBlock,
  BlockClipboardData,
  BlockSearchResult
} from '$lib/types/blocks.js';

/**
 * Block Manager Service Interface
 */
export interface BlockManagerInterface {
  initialize(): Promise<void>;
  createBlock(input: CreateBlockInput): Block;
  getBlock(blockId: string): Block | undefined;
  updateBlock(input: UpdateBlockInput): Block | undefined;
  deleteBlock(blockId: string): boolean;
  moveBlock(input: MoveBlockInput): boolean;
  getBlockTree(rootBlockId: string): BlockTree | null;
  getPageBlocks(pageId: string): Block[];
  getChildBlocks(parentId: string): Block[];
  serializeBlock(block: Block): SerializedBlock;
  deserializeBlock(data: SerializedBlock): Block;
  duplicateBlock(blockId: string, targetPageId?: string): Block | null;
  searchBlocks(query: string, pageId?: string): BlockSearchResult[];
}

/**
 * Block Manager Service Implementation
 * Manages block lifecycle, hierarchy, and persistence
 */
export class BlockManager implements BlockManagerInterface {
  private blocks: Map<string, Block> = new Map();
  private pageBlockIndex: Map<string, Set<string>> = new Map(); // pageId -> blockIds
  private childBlockIndex: Map<string, string[]> = new Map(); // parentId -> ordered childIds
  private initialized = false;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly SAVE_DEBOUNCE_MS = 300;
  
  // Storacha cloud sync
  private cloudSyncTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly CLOUD_SYNC_DEBOUNCE_MS = 5000; // 5 seconds after last change
  private modifiedPages: Set<string> = new Set();
  private cloudSyncEnabled = false;
  private pageManagerRef: { syncToStoracha: (pageId: string) => Promise<string | null> } | null = null;

  /**
   * Enable cloud sync with Storacha
   * Call this after pageManager is available
   */
  enableCloudSync(pageManager: { syncToStoracha: (pageId: string) => Promise<string | null> }): void {
    this.pageManagerRef = pageManager;
    this.cloudSyncEnabled = true;
    console.log('BlockManager: Cloud sync enabled');
  }

  /**
   * Disable cloud sync
   */
  disableCloudSync(): void {
    this.cloudSyncEnabled = false;
    this.pageManagerRef = null;
    if (this.cloudSyncTimeout) {
      clearTimeout(this.cloudSyncTimeout);
      this.cloudSyncTimeout = null;
    }
  }

  /**
   * Schedule a debounced cloud sync to Storacha
   */
  private scheduleCloudSync(pageId: string): void {
    if (!this.cloudSyncEnabled) return;
    
    // Mark page as modified
    this.modifiedPages.add(pageId);
    
    // Clear existing timer
    if (this.cloudSyncTimeout) {
      clearTimeout(this.cloudSyncTimeout);
    }
    
    // Set new timer
    this.cloudSyncTimeout = setTimeout(() => {
      this.executeCloudSync();
      this.cloudSyncTimeout = null;
    }, this.CLOUD_SYNC_DEBOUNCE_MS);
  }

  /**
   * Execute cloud sync for all modified pages
   */
  private async executeCloudSync(): Promise<void> {
    if (!this.cloudSyncEnabled || !this.pageManagerRef) return;
    if (this.modifiedPages.size === 0) return;
    
    const pagesToSync = Array.from(this.modifiedPages);
    this.modifiedPages.clear();
    
    console.log(`BlockManager: Syncing ${pagesToSync.length} page(s) to Storacha...`);
    
    for (const pageId of pagesToSync) {
      try {
        const cid = await this.pageManagerRef.syncToStoracha(pageId);
        if (cid) {
          console.log(`BlockManager: Page ${pageId} synced to Storacha (CID: ${cid})`);
        }
      } catch (error) {
        console.warn(`BlockManager: Failed to sync page ${pageId} to Storacha:`, error);
        // Re-add to modified set to retry later
        this.modifiedPages.add(pageId);
      }
    }
  }

  /**
   * Force immediate cloud sync for a specific page
   */
  async forceCloudSync(pageId: string): Promise<string | null> {
    if (!this.cloudSyncEnabled || !this.pageManagerRef) {
      console.warn('BlockManager: Cloud sync not enabled');
      return null;
    }
    
    this.modifiedPages.delete(pageId);
    try {
      return await this.pageManagerRef.syncToStoracha(pageId);
    } catch (error) {
      console.error('BlockManager: Force cloud sync failed:', error);
      return null;
    }
  }

  /**
   * Initialize the block manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Load blocks from local storage if available
    await this.loadFromStorage();
    
    this.initialized = true;
    console.log('BlockManager initialized');
  }

  /**
   * Schedule a debounced save to storage
   */
  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveToStorage();
      this.saveTimeout = null;
    }, this.SAVE_DEBOUNCE_MS);
  }

  /**
   * Force immediate save (useful before page navigation)
   */
  flushSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.saveToStorage();
  }

  /**
   * Generate a unique block ID
   */
  private generateBlockId(): string {
    return `block_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get the next order value for a new block in a page/parent
   */
  private getNextOrder(pageId: string, parentId: string | null): number {
    const existingBlocks = Array.from(this.blocks.values())
      .filter(b => b.pageId === pageId && b.parentId === parentId);
    
    if (existingBlocks.length === 0) return 0;
    
    return Math.max(...existingBlocks.map(b => b.order)) + 1;
  }

  /**
   * Create a new block
   */
  createBlock(input: CreateBlockInput): Block {
    const now = new Date();
    const blockId = this.generateBlockId();

    // Calculate order based on insertAfter/insertBefore or append at end
    let order = this.getNextOrder(input.pageId, input.parentId ?? null);
    
    if (input.insertAfter) {
      const afterBlock = this.blocks.get(input.insertAfter);
      if (afterBlock) {
        order = afterBlock.order + 0.5; // Will be normalized later
        this.normalizeBlockOrder(input.pageId, input.parentId ?? null);
      }
    } else if (input.insertBefore) {
      const beforeBlock = this.blocks.get(input.insertBefore);
      if (beforeBlock) {
        order = beforeBlock.order - 0.5; // Will be normalized later
        this.normalizeBlockOrder(input.pageId, input.parentId ?? null);
      }
    }

    const block: Block = {
      id: blockId,
      type: input.type,
      properties: input.properties || this.getDefaultProperties(input.type),
      children: input.children || [],
      parentId: input.parentId ?? null,
      pageId: input.pageId,
      order,
      createdAt: now,
      modifiedAt: now
    };

    // Create Yjs document for text-based blocks
    if (this.isTextBlock(input.type)) {
      block.content = new YDoc();
    }

    // Store the block
    this.blocks.set(blockId, block);

    // Update page index
    if (!this.pageBlockIndex.has(input.pageId)) {
      this.pageBlockIndex.set(input.pageId, new Set());
    }
    this.pageBlockIndex.get(input.pageId)!.add(blockId);

    // Update child index for parent
    if (input.parentId) {
      const siblings = this.childBlockIndex.get(input.parentId) || [];
      
      if (input.insertAfter) {
        const afterIndex = siblings.indexOf(input.insertAfter);
        siblings.splice(afterIndex + 1, 0, blockId);
      } else if (input.insertBefore) {
        const beforeIndex = siblings.indexOf(input.insertBefore);
        siblings.splice(beforeIndex, 0, blockId);
      } else {
        siblings.push(blockId);
      }
      
      this.childBlockIndex.set(input.parentId, siblings);
    }

    // Auto-save after creation
    this.saveToStorage();
    
    // Schedule cloud sync
    this.scheduleCloudSync(input.pageId);

    console.log(`Created block: ${blockId} (${input.type})`);
    return block;
  }

  /**
   * Get default properties for a block type
   */
  private getDefaultProperties(type: BlockType): BlockProperties {
    switch (type) {
      case 'heading1':
      case 'heading2':
      case 'heading3':
        return { textContent: [], level: parseInt(type.slice(-1)) as 1 | 2 | 3 };
      case 'todo':
        return { textContent: [], checked: false };
      case 'toggle':
        return { textContent: [], collapsed: false };
      case 'callout':
        return { textContent: [], icon: '💡', calloutColor: '#f0f0f0' };
      case 'code':
        return { textContent: [], language: 'javascript' };
      case 'columnList':
        return { columnRatio: [0.5, 0.5] };
      default:
        return { textContent: [] };
    }
  }

  /**
   * Check if block type supports text content
   */
  private isTextBlock(type: BlockType): boolean {
    const textBlocks: BlockType[] = [
      'paragraph', 'heading1', 'heading2', 'heading3',
      'bulletList', 'numberedList', 'todo', 'toggle',
      'quote', 'callout', 'code'
    ];
    return textBlocks.includes(type);
  }

  /**
   * Get a block by ID
   */
  getBlock(blockId: string): Block | undefined {
    return this.blocks.get(blockId);
  }

  /**
   * Update a block
   */
  updateBlock(input: UpdateBlockInput): Block | undefined {
    const block = this.blocks.get(input.id);
    if (!block) return undefined;

    // Update properties
    if (input.properties) {
      block.properties = { ...block.properties, ...input.properties };
    }

    // Update type if provided
    if (input.type && input.type !== block.type) {
      block.type = input.type;
      
      // Create or remove Yjs document based on new type
      if (this.isTextBlock(input.type) && !block.content) {
        block.content = new YDoc();
      }
    }

    block.modifiedAt = new Date();
    this.blocks.set(input.id, block);

    // Schedule debounced save for updates (called frequently during typing)
    this.scheduleSave();
    
    // Schedule cloud sync
    this.scheduleCloudSync(block.pageId);

    console.log(`Updated block: ${input.id}`);
    return block;
  }

  /**
   * Delete a block and its children
   */
  deleteBlock(blockId: string): boolean {
    const block = this.blocks.get(blockId);
    if (!block) return false;

    // Recursively delete children
    for (const childId of block.children) {
      this.deleteBlock(childId);
    }

    // Remove from parent's children
    if (block.parentId) {
      const siblings = this.childBlockIndex.get(block.parentId) || [];
      const index = siblings.indexOf(blockId);
      if (index > -1) {
        siblings.splice(index, 1);
        this.childBlockIndex.set(block.parentId, siblings);
      }
    }

    // Remove from page index
    const pageBlocks = this.pageBlockIndex.get(block.pageId);
    if (pageBlocks) {
      pageBlocks.delete(blockId);
    }

    // Delete the block
    const pageId = block.pageId;
    this.blocks.delete(blockId);

    // Auto-save after deletion
    this.saveToStorage();
    
    // Schedule cloud sync
    this.scheduleCloudSync(pageId);

    console.log(`Deleted block: ${blockId}`);
    return true;
  }

  /**
   * Move a block to a new parent or position
   */
  moveBlock(input: MoveBlockInput): boolean {
    const block = this.blocks.get(input.blockId);
    if (!block) return false;

    // Remove from old parent
    if (block.parentId) {
      const oldSiblings = this.childBlockIndex.get(block.parentId) || [];
      const index = oldSiblings.indexOf(input.blockId);
      if (index > -1) {
        oldSiblings.splice(index, 1);
        this.childBlockIndex.set(block.parentId, oldSiblings);
      }
    }

    // Update page if moving to different page
    if (input.targetPageId && input.targetPageId !== block.pageId) {
      const oldPageBlocks = this.pageBlockIndex.get(block.pageId);
      if (oldPageBlocks) {
        oldPageBlocks.delete(input.blockId);
      }

      if (!this.pageBlockIndex.has(input.targetPageId)) {
        this.pageBlockIndex.set(input.targetPageId, new Set());
      }
      this.pageBlockIndex.get(input.targetPageId)!.add(input.blockId);
      
      block.pageId = input.targetPageId;
    }

    // Add to new parent
    block.parentId = input.targetParentId;
    
    if (input.targetParentId) {
      const newSiblings = this.childBlockIndex.get(input.targetParentId) || [];
      
      if (input.insertAfter) {
        const afterIndex = newSiblings.indexOf(input.insertAfter);
        newSiblings.splice(afterIndex + 1, 0, input.blockId);
      } else if (input.insertBefore) {
        const beforeIndex = newSiblings.indexOf(input.insertBefore);
        newSiblings.splice(beforeIndex, 0, input.blockId);
      } else {
        newSiblings.push(input.blockId);
      }
      
      this.childBlockIndex.set(input.targetParentId, newSiblings);
    }

    // Update order based on new position
    if (input.insertAfter) {
      const afterBlock = this.blocks.get(input.insertAfter);
      if (afterBlock) {
        block.order = afterBlock.order + 0.5;
      }
    } else if (input.insertBefore) {
      const beforeBlock = this.blocks.get(input.insertBefore);
      if (beforeBlock) {
        block.order = beforeBlock.order - 0.5;
      }
    } else {
      block.order = this.getNextOrder(block.pageId, block.parentId);
    }

    // Normalize order values
    this.normalizeBlockOrder(block.pageId, block.parentId);

    block.modifiedAt = new Date();
    this.blocks.set(input.blockId, block);

    // Auto-save after move
    this.saveToStorage();
    
    // Schedule cloud sync
    this.scheduleCloudSync(block.pageId);

    console.log(`Moved block: ${input.blockId}`);
    return true;
  }

  /**
   * Normalize block order values to integers (0, 1, 2, ...)
   */
  private normalizeBlockOrder(pageId: string, parentId: string | null): void {
    const blocks = Array.from(this.blocks.values())
      .filter(b => b.pageId === pageId && b.parentId === parentId)
      .sort((a, b) => a.order - b.order);
    
    blocks.forEach((block, index) => {
      block.order = index;
      this.blocks.set(block.id, block);
    });
  }

  /**
   * Get block tree with resolved children
   */
  getBlockTree(rootBlockId: string): BlockTree | null {
    const block = this.blocks.get(rootBlockId);
    if (!block) return null;

    const buildTree = (b: Block): BlockTree => {
      const childBlocks = b.children
        .map(id => this.blocks.get(id))
        .filter((child): child is Block => child !== undefined);

      return {
        ...b,
        resolvedChildren: childBlocks.map(buildTree)
      };
    };

    return buildTree(block);
  }

  /**
   * Get all top-level blocks for a page (blocks without a parent block)
   * Returns blocks sorted by order field
   */
  getPageBlocks(pageId: string): Block[] {
    const blockIds = this.pageBlockIndex.get(pageId);
    if (!blockIds) return [];

    return Array.from(blockIds)
      .map(id => this.blocks.get(id))
      .filter((block): block is Block => block !== undefined && block.parentId === null)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get child blocks of a parent (ordered)
   */
  getChildBlocks(parentId: string): Block[] {
    const childIds = this.childBlockIndex.get(parentId) || [];
    return childIds
      .map(id => this.blocks.get(id))
      .filter((block): block is Block => block !== undefined);
  }

  /**
   * Get ALL blocks for a page (including nested children)
   */
  getBlocksForPage(pageId: string): Block[] {
    const ids = this.pageBlockIndex.get(pageId);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.blocks.get(id))
      .filter((b): b is Block => b !== undefined);
  }

  /**
   * Restore a block (from Storacha) without triggering createBlock logic
   */
  restoreBlock(block: Block): void {
    this.blocks.set(block.id, block);

    // Index by page
    let pageBlocks = this.pageBlockIndex.get(block.pageId);
    if (!pageBlocks) {
      pageBlocks = new Set();
      this.pageBlockIndex.set(block.pageId, pageBlocks);
    }
    pageBlocks.add(block.id);

    // Index by parent
    if (block.parentId) {
      const siblings = this.childBlockIndex.get(block.parentId) || [];
      if (!siblings.includes(block.id)) {
        siblings.push(block.id);
        this.childBlockIndex.set(block.parentId, siblings);
      }
    }
  }

  /**
   * Serialize a block for storage
   */
  serializeBlock(block: Block): SerializedBlock {
    return {
      id: block.id,
      type: block.type,
      properties: block.properties,
      children: block.children,
      parentId: block.parentId,
      pageId: block.pageId,
      order: block.order,
      yjsUpdate: block.content ? encodeStateAsUpdate(block.content) : undefined,
      storachaCID: block.storachaCID,
      createdAt: block.createdAt.toISOString(),
      modifiedAt: block.modifiedAt.toISOString(),
      createdBy: block.createdBy,
      modifiedBy: block.modifiedBy
    };
  }

  /**
   * Deserialize a block from storage
   */
  deserializeBlock(data: SerializedBlock): Block {
    const block: Block = {
      id: data.id,
      type: data.type,
      properties: data.properties,
      children: data.children,
      parentId: data.parentId,
      pageId: data.pageId,
      order: data.order ?? 0,
      storachaCID: data.storachaCID,
      createdAt: new Date(data.createdAt),
      modifiedAt: new Date(data.modifiedAt),
      createdBy: data.createdBy,
      modifiedBy: data.modifiedBy
    };

    // Restore Yjs document if present
    if (data.yjsUpdate && this.isTextBlock(data.type)) {
      block.content = new YDoc();
      applyUpdate(block.content, data.yjsUpdate);
    }

    return block;
  }

  /**
   * Duplicate a block and its children
   */
  duplicateBlock(blockId: string, targetPageId?: string): Block | null {
    const original = this.blocks.get(blockId);
    if (!original) return null;

    const pageId = targetPageId || original.pageId;

    // Create duplicate
    const duplicate = this.createBlock({
      type: original.type,
      properties: { ...original.properties },
      parentId: original.parentId,
      pageId
    });

    // Copy Yjs content if present
    if (original.content && duplicate.content) {
      const update = encodeStateAsUpdate(original.content);
      applyUpdate(duplicate.content, update);
    }

    // Recursively duplicate children
    for (const childId of original.children) {
      const duplicatedChild = this.duplicateBlock(childId, pageId);
      if (duplicatedChild) {
        duplicatedChild.parentId = duplicate.id;
        duplicate.children.push(duplicatedChild.id);
        this.blocks.set(duplicatedChild.id, duplicatedChild);
      }
    }

    this.blocks.set(duplicate.id, duplicate);
    return duplicate;
  }

  /**
   * Search blocks by text content
   */
  searchBlocks(query: string, pageId?: string): BlockSearchResult[] {
    const results: BlockSearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    const blocksToSearch = pageId
      ? this.getPageBlocks(pageId)
      : Array.from(this.blocks.values());

    for (const block of blocksToSearch) {
      const textContent = this.getBlockTextContent(block);
      const lowerText = textContent.toLowerCase();
      
      if (lowerText.includes(lowerQuery)) {
        const matchIndex = lowerText.indexOf(lowerQuery);
        const start = Math.max(0, matchIndex - 30);
        const end = Math.min(textContent.length, matchIndex + query.length + 30);
        
        results.push({
          block,
          pageId: block.pageId,
          pageTitle: '', // Will be resolved by caller
          matchedText: textContent.substring(matchIndex, matchIndex + query.length),
          context: textContent.substring(start, end)
        });
      }
    }

    return results;
  }

  /**
   * Extract plain text from a block
   */
  private getBlockTextContent(block: Block): string {
    if (!block.properties.textContent) return '';
    
    return block.properties.textContent
      .map(segment => segment.text)
      .join('');
  }

  /**
   * Load blocks from local storage
   */
  private async loadFromStorage(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('storacha-blocks');
      if (stored) {
        const data = JSON.parse(stored) as SerializedBlock[];
        let loadedCount = 0;
        let skippedCount = 0;
        
        for (const serialized of data) {
          try {
            const block = this.deserializeBlock(serialized);
            this.blocks.set(block.id, block);
            
            // Rebuild indexes
            if (!this.pageBlockIndex.has(block.pageId)) {
              this.pageBlockIndex.set(block.pageId, new Set());
            }
            this.pageBlockIndex.get(block.pageId)!.add(block.id);
            loadedCount++;
          } catch (blockError) {
            // Skip corrupted blocks but continue loading others
            console.warn(`Skipping corrupted block ${serialized?.id || 'unknown'}:`, blockError);
            skippedCount++;
          }
        }
        console.log(`Loaded ${loadedCount} blocks from storage (skipped ${skippedCount} corrupted)`);
      }
    } catch (error) {
      console.warn('Failed to load blocks from storage:', error);
    }
  }

  /**
   * Save blocks to local storage
   */
  async saveToStorage(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const serialized = Array.from(this.blocks.values())
        .map(block => this.serializeBlock(block));
      localStorage.setItem('storacha-blocks', JSON.stringify(serialized));
      console.log(`Saved ${serialized.length} blocks to storage`);
    } catch (error) {
      console.warn('Failed to save blocks to storage:', error);
    }
  }

  /**
   * Clear all blocks
   */
  clear(): void {
    this.blocks.clear();
    this.pageBlockIndex.clear();
    this.childBlockIndex.clear();
  }

  /**
   * Get block count
   */
  getBlockCount(): number {
    return this.blocks.size;
  }
}

// Export singleton instance
export const blockManager = new BlockManager();
