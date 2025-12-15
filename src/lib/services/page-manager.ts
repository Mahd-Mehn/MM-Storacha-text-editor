// Page Manager Service
// Handles page CRUD operations, hierarchy management, and persistence

import type {
  Page,
  PageType,
  CreatePageInput,
  UpdatePageInput,
  MovePageInput,
  SerializedPage,
  PageTreeNode
} from '$lib/types/pages.js';
import { blockManager } from './block-manager.js';
import { storachaClient } from './storacha.js';

/**
 * Page Manager Service Interface
 */
export interface PageManagerInterface {
  initialize(): Promise<void>;
  createPage(input: CreatePageInput): Page;
  getPage(pageId: string): Page | undefined;
  getAllPages(): Page[];
  updatePage(input: UpdatePageInput): Page | undefined;
  deletePage(pageId: string): boolean;
  movePage(input: MovePageInput): boolean;
  getPageTree(workspaceId: string): PageTreeNode[];
  getRootPages(workspaceId: string): Page[];
  getChildPages(parentId: string): Page[];
  serializePage(page: Page): SerializedPage;
  deserializePage(data: SerializedPage): Page;
}

/**
 * Page Manager Service Implementation
 */
export class PageManager implements PageManagerInterface {
  private pages: Map<string, Page> = new Map();
  private workspaceRootIndex: Map<string, string[]> = new Map(); // workspaceId -> rootPageIds
  private childPageIndex: Map<string, string[]> = new Map(); // parentId -> childPageIds
  private initialized = false;

  /**
   * Initialize the page manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Load pages from local storage if available
    await this.loadFromStorage();
    
    this.initialized = true;
    console.log('PageManager initialized');
  }

  /**
   * Generate a unique page ID
   */
  private generatePageId(): string {
    try {
      const randomUUID = globalThis.crypto?.randomUUID;
      if (typeof randomUUID === 'function') {
        return `page_${randomUUID()}`;
      }
    } catch {
      // ignore
    }

    return `page_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Create a new page
   */
  createPage(input: CreatePageInput): Page {
    const now = new Date();
    const pageId = this.generatePageId();

    const page: Page = {
      id: pageId,
      title: input.title || 'Untitled',
      type: input.type || 'page',
      icon: input.icon,
      cover: input.cover,
      parentId: input.parentId ?? null,
      workspaceId: input.workspaceId,
      childPages: [],
      blocks: [],
      metadata: {
        created: now,
        modified: now,
        version: 1,
        storachaCID: '',
        shareLinks: [],
        isDeleted: false,
        isTemplate: input.isTemplate || false,
        isFavorite: false,
        viewCount: 0
      },
      databaseSchema: input.databaseSchema as any
    };

    // Store the page
    this.pages.set(pageId, page);

    // Update indexes
    if (page.parentId) {
      const siblings = this.childPageIndex.get(page.parentId) || [];
      siblings.push(pageId);
      this.childPageIndex.set(page.parentId, siblings);
      
      // Update parent's childPages array
      const parent = this.pages.get(page.parentId);
      if (parent) {
        parent.childPages.push(pageId);
        this.pages.set(parent.id, parent);
      }
    } else {
      const roots = this.workspaceRootIndex.get(page.workspaceId) || [];
      roots.push(pageId);
      this.workspaceRootIndex.set(page.workspaceId, roots);
    }

    // Create initial block for the page
    blockManager.createBlock({
      type: 'paragraph',
      pageId: pageId,
      properties: { textContent: [] }
    });

    this.saveToStorage();
    console.log(`Created page: ${pageId}`);
    return page;
  }

  /**
   * Get a page by ID
   */
  getPage(pageId: string): Page | undefined {
    return this.pages.get(pageId);
  }

  /**
   * Get all pages
   */
  getAllPages(): Page[] {
    return Array.from(this.pages.values());
  }

  /**
   * Update a page
   */
  updatePage(input: UpdatePageInput): Page | undefined {
    const page = this.pages.get(input.id);
    if (!page) return undefined;

    if (input.title !== undefined) page.title = input.title;
    if (input.icon !== undefined) page.icon = input.icon;
    if (input.cover !== undefined) page.cover = input.cover;
    if (input.isFavorite !== undefined) page.metadata.isFavorite = input.isFavorite;

    page.metadata.modified = new Date();
    this.pages.set(input.id, page);
    
    this.saveToStorage();
    return page;
  }

  /**
   * Delete a page (move to trash)
   */
  deletePage(pageId: string): boolean {
    const page = this.pages.get(pageId);
    if (!page) return false;

    page.metadata.isDeleted = true;
    page.metadata.deletedAt = new Date();
    this.pages.set(pageId, page);
    
    this.saveToStorage();
    return true;
  }

  /**
   * Move a page
   */
  movePage(input: MovePageInput): boolean {
    const page = this.pages.get(input.pageId);
    if (!page) return false;

    // Remove from old location
    if (page.parentId) {
      const siblings = this.childPageIndex.get(page.parentId) || [];
      const index = siblings.indexOf(input.pageId);
      if (index > -1) {
        siblings.splice(index, 1);
        this.childPageIndex.set(page.parentId, siblings);
      }
      
      const parent = this.pages.get(page.parentId);
      if (parent) {
        const idx = parent.childPages.indexOf(input.pageId);
        if (idx > -1) parent.childPages.splice(idx, 1);
      }
    } else {
      const roots = this.workspaceRootIndex.get(page.workspaceId) || [];
      const index = roots.indexOf(input.pageId);
      if (index > -1) {
        roots.splice(index, 1);
        this.workspaceRootIndex.set(page.workspaceId, roots);
      }
    }

    // Add to new location
    page.parentId = input.targetParentId;
    if (input.targetWorkspaceId) page.workspaceId = input.targetWorkspaceId;

    if (page.parentId) {
      const siblings = this.childPageIndex.get(page.parentId) || [];
      if (input.insertAfter) {
        const idx = siblings.indexOf(input.insertAfter);
        siblings.splice(idx + 1, 0, input.pageId);
      } else {
        siblings.push(input.pageId);
      }
      this.childPageIndex.set(page.parentId, siblings);
      
      const parent = this.pages.get(page.parentId);
      if (parent) {
        parent.childPages = siblings;
      }
    } else {
      const roots = this.workspaceRootIndex.get(page.workspaceId) || [];
      if (input.insertAfter) {
        const idx = roots.indexOf(input.insertAfter);
        roots.splice(idx + 1, 0, input.pageId);
      } else {
        roots.push(input.pageId);
      }
      this.workspaceRootIndex.set(page.workspaceId, roots);
    }

    this.saveToStorage();
    return true;
  }

  /**
   * Get page tree for a workspace
   */
  getPageTree(workspaceId: string): PageTreeNode[] {
    const rootPages = this.getRootPages(workspaceId);
    
    const buildTree = (page: Page, depth: number): PageTreeNode => {
      const children = this.getChildPages(page.id);
      return {
        page,
        children: children.map(child => buildTree(child, depth + 1)),
        depth,
        isExpanded: false // Default state
      };
    };

    return rootPages.map(page => buildTree(page, 0));
  }

  /**
   * Get root pages for a workspace
   */
  getRootPages(workspaceId: string): Page[] {
    const rootIds = this.workspaceRootIndex.get(workspaceId) || [];
    return rootIds
      .map(id => this.pages.get(id))
      .filter((p): p is Page => p !== undefined && !p.metadata.isDeleted);
  }

  /**
   * Get child pages
   */
  getChildPages(parentId: string): Page[] {
    const childIds = this.childPageIndex.get(parentId) || [];
    return childIds
      .map(id => this.pages.get(id))
      .filter((p): p is Page => p !== undefined && !p.metadata.isDeleted);
  }

  /**
   * Serialize page
   */
  serializePage(page: Page): SerializedPage {
    return {
      id: page.id,
      title: page.title,
      type: page.type,
      icon: page.icon,
      cover: page.cover,
      parentId: page.parentId,
      workspaceId: page.workspaceId,
      childPages: page.childPages,
      blocks: page.blocks,
      metadata: {
        ...page.metadata,
        created: page.metadata.created.toISOString(),
        modified: page.metadata.modified.toISOString(),
        deletedAt: page.metadata.deletedAt?.toISOString(),
        lastViewed: page.metadata.lastViewed?.toISOString()
      },
      databaseSchema: page.databaseSchema
    };
  }

  /**
   * Deserialize page
   */
  deserializePage(data: SerializedPage): Page {
    return {
      id: data.id,
      title: data.title,
      type: data.type,
      icon: data.icon,
      cover: data.cover,
      parentId: data.parentId,
      workspaceId: data.workspaceId,
      childPages: data.childPages,
      blocks: data.blocks,
      metadata: {
        ...data.metadata,
        created: new Date(data.metadata.created),
        modified: new Date(data.metadata.modified),
        deletedAt: data.metadata.deletedAt ? new Date(data.metadata.deletedAt) : undefined,
        lastViewed: data.metadata.lastViewed ? new Date(data.metadata.lastViewed) : undefined
      },
      databaseSchema: data.databaseSchema
    };
  }

  /**
   * Load from local storage
   */
  private async loadFromStorage(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('storacha-pages');
      if (stored) {
        const data = JSON.parse(stored) as SerializedPage[];
        for (const serialized of data) {
          const page = this.deserializePage(serialized);
          this.pages.set(page.id, page);
          
          // Rebuild indexes
          if (page.parentId) {
            const siblings = this.childPageIndex.get(page.parentId) || [];
            if (!siblings.includes(page.id)) siblings.push(page.id);
            this.childPageIndex.set(page.parentId, siblings);
          } else {
            const roots = this.workspaceRootIndex.get(page.workspaceId) || [];
            if (!roots.includes(page.id)) roots.push(page.id);
            this.workspaceRootIndex.set(page.workspaceId, roots);
          }
        }
        console.log(`Loaded ${data.length} pages from storage`);
      }
    } catch (error) {
      console.warn('Failed to load pages from storage:', error);
    }
  }

  /**
   * Save to local storage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const serialized = Array.from(this.pages.values())
        .map(page => this.serializePage(page));
      localStorage.setItem('storacha-pages', JSON.stringify(serialized));
    } catch (error) {
      console.warn('Failed to save pages to storage:', error);
    }
  }

  /**
   * Sync a page to Storacha and return its CID.
   * Includes all blocks so recipients can load the full page.
   */
  async syncToStoracha(pageId: string): Promise<string | null> {
    const page = this.pages.get(pageId);
    if (!page) return null;

    try {
      if (!storachaClient.isReady()) {
        console.warn('Storacha client not ready for page sync');
        return null;
      }

      // Build serializable payload with blocks
      const pageBlocks = blockManager.getBlocksForPage(pageId);
      const payload = {
        page: this.serializePage(page),
        blocks: pageBlocks.map((b) => blockManager.serializeBlock(b))
      };

      const json = JSON.stringify(payload);
      const content = new TextEncoder().encode(json);
      const filename = `page_${pageId}.json`;

      const cid = await storachaClient.uploadContent(content, filename);

      // Persist CID on the page
      page.metadata.storachaCID = cid;
      this.pages.set(pageId, page);
      this.saveToStorage();

      console.log(`Page ${pageId} synced to Storacha with CID: ${cid}`);
      return cid;
    } catch (error) {
      console.error('Failed to sync page to Storacha:', error);
      return null;
    }
  }

  /**
   * Load a page from Storacha by CID (for shared access).
   * Works for both authenticated and anonymous users via public IPFS gateway.
   */
  async loadFromStoracha(cid: string): Promise<Page | null> {
    try {
      console.log(`Loading page from Storacha CID: ${cid}`);
      
      // Use the public gateway directly to avoid auth requirements
      // Try multiple gateways for redundancy
      const gateways = [
        `https://w3s.link/ipfs/${cid}`,
        `https://${cid}.ipfs.w3s.link`,
        `https://dweb.link/ipfs/${cid}`
      ];
      
      let response: Response | null = null;
      let lastError: Error | null = null;
      
      for (const gatewayUrl of gateways) {
        console.log(`Trying gateway: ${gatewayUrl}`);
        try {
          response = await fetch(gatewayUrl, {
            headers: {
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            console.log(`Successfully fetched from: ${gatewayUrl}`);
            break;
          } else {
            console.warn(`Gateway ${gatewayUrl} returned ${response.status}`);
            response = null;
          }
        } catch (fetchError) {
          console.warn(`Gateway ${gatewayUrl} failed:`, fetchError);
          lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
        }
      }
      
      if (!response || !response.ok) {
        console.error(`All gateways failed. Last error:`, lastError);
        throw new Error(`Failed to fetch from any gateway`);
      }
      
      const json = await response.text();
      console.log(`Received ${json.length} bytes from gateway`);
      
      if (!json || json.length === 0) {
        throw new Error('Empty response from gateway');
      }
      
      let payload: { page: SerializedPage; blocks?: any[] };
      try {
        payload = JSON.parse(json);
      } catch (parseError) {
        console.error('Failed to parse JSON:', json.substring(0, 200));
        throw new Error('Invalid JSON response from gateway');
      }
      
      if (!payload.page) {
        throw new Error('Invalid page payload: missing page data');
      }

      const page = this.deserializePage(payload.page);
      this.pages.set(page.id, page);

      // Restore blocks
      if (Array.isArray(payload.blocks)) {
        await blockManager.initialize();
        console.log(`Restoring ${payload.blocks.length} blocks`);
        for (const serialized of payload.blocks) {
          try {
            const block = blockManager.deserializeBlock(serialized);
            blockManager.restoreBlock(block);
          } catch (blockError) {
            console.warn(`Failed to restore block:`, blockError);
          }
        }
      }

      this.saveToStorage();
      console.log(`Successfully loaded page from Storacha: ${page.id} - ${page.title}`);
      return page;
    } catch (error) {
      console.error('Failed to load page from Storacha:', error);
      return null;
    }
  }
}

// Export singleton instance
export const pageManager = new PageManager();
