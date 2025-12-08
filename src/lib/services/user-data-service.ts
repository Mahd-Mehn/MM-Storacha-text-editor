/**
 * User Data Service
 * 
 * Manages a global user database on Storacha that indexes all user content:
 * - Workspaces
 * - Pages/Notes
 * - Databases
 * 
 * This ensures all content is linked to a single user account and can be
 * synced across devices.
 */

import { storachaClient } from './storacha';
import { authService } from './auth';

// Storage keys
const USER_DATA_KEY = 'storacha_user_data';
const USER_DATA_CID_KEY = 'storacha_user_data_cid';

/**
 * Reference to content stored on Storacha
 */
export interface ContentReference {
  id: string;
  cid: string;
  type: 'note' | 'page' | 'database' | 'workspace';
  title: string;
  createdAt: string;
  updatedAt: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Workspace data structure
 */
export interface WorkspaceData {
  id: string;
  name: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
}

/**
 * Page/Note reference in the global index
 */
export interface PageReference extends ContentReference {
  type: 'page' | 'note';
  workspaceId: string;
  icon?: string;
  isFolder?: boolean;
  children?: string[]; // IDs of child pages
}

/**
 * Database reference in the global index
 */
export interface DatabaseReference extends ContentReference {
  type: 'database';
  workspaceId: string;
  icon?: string;
  rowCount?: number;
}

/**
 * Global user data structure stored on Storacha
 */
export interface UserData {
  version: number;
  userDID: string;
  createdAt: string;
  updatedAt: string;
  
  // All workspaces
  workspaces: WorkspaceData[];
  
  // Content index - maps content ID to its reference
  contentIndex: Record<string, ContentReference>;
  
  // Quick lookups
  workspaceContents: Record<string, string[]>; // workspaceId -> content IDs
  
  // Sync metadata
  lastSyncAt?: string;
  syncVersion: number;
}

/**
 * User Data Service - Singleton
 */
class UserDataService {
  private initialized = false;
  private userData: UserData | null = null;
  private syncInProgress = false;
  private pendingChanges = false;
  private autoSyncInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load from local storage first
      await this.loadFromLocal();

      // Try to sync with Storacha if available
      if (storachaClient.isReady()) {
        await this.syncFromStoracha();
      }

      // Start auto-sync
      this.startAutoSync();

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize UserDataService:', error);
      // Create default user data if none exists
      await this.createDefaultUserData();
      this.initialized = true;
    }
  }

  /**
   * Create default user data for new users
   */
  private async createDefaultUserData(): Promise<void> {
    const userDID = authService.getDID() || `local_${Date.now()}`;
    const now = new Date().toISOString();

    this.userData = {
      version: 1,
      userDID,
      createdAt: now,
      updatedAt: now,
      workspaces: [
        {
          id: 'default',
          name: 'My Workspace',
          icon: '📝',
          createdAt: now,
          updatedAt: now,
          isDefault: true
        }
      ],
      contentIndex: {},
      workspaceContents: { default: [] },
      lastSyncAt: undefined,
      syncVersion: 0
    };

    await this.saveToLocal();
  }

  /**
   * Load user data from local storage
   */
  private async loadFromLocal(): Promise<void> {
    try {
      const stored = localStorage.getItem(USER_DATA_KEY);
      if (stored) {
        this.userData = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load user data from local storage:', error);
    }
  }

  /**
   * Save user data to local storage
   */
  private async saveToLocal(): Promise<void> {
    if (!this.userData) return;

    try {
      this.userData.updatedAt = new Date().toISOString();
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(this.userData));
    } catch (error) {
      console.error('Failed to save user data to local storage:', error);
    }
  }

  /**
   * Sync user data from Storacha
   */
  async syncFromStoracha(): Promise<void> {
    if (!storachaClient.isReady()) return;

    try {
      const storedCid = localStorage.getItem(USER_DATA_CID_KEY);
      if (!storedCid) return;

      const content = await storachaClient.retrieveContent(storedCid);
      const remoteData: UserData = JSON.parse(new TextDecoder().decode(content));

      // Merge remote data with local data
      if (!this.userData || remoteData.syncVersion > this.userData.syncVersion) {
        this.userData = remoteData;
        await this.saveToLocal();
      } else if (remoteData.syncVersion < this.userData.syncVersion) {
        // Local is newer, sync to Storacha
        await this.syncToStoracha();
      }
    } catch (error) {
      console.error('Failed to sync from Storacha:', error);
    }
  }

  /**
   * Sync user data to Storacha
   */
  async syncToStoracha(): Promise<string | null> {
    if (!storachaClient.isReady() || !this.userData || this.syncInProgress) {
      return null;
    }

    this.syncInProgress = true;

    try {
      this.userData.syncVersion += 1;
      this.userData.lastSyncAt = new Date().toISOString();
      this.userData.updatedAt = new Date().toISOString();

      const content = new TextEncoder().encode(JSON.stringify(this.userData));
      const cid = await storachaClient.uploadContent(content, 'user_data.json');

      localStorage.setItem(USER_DATA_CID_KEY, cid);
      await this.saveToLocal();

      this.pendingChanges = false;
      console.log('User data synced to Storacha:', cid);

      return cid;
    } catch (error) {
      console.error('Failed to sync to Storacha:', error);
      return null;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Start auto-sync interval
   */
  private startAutoSync(): void {
    if (this.autoSyncInterval) return;

    // Sync every 30 seconds if there are pending changes
    this.autoSyncInterval = setInterval(async () => {
      if (this.pendingChanges && storachaClient.isReady()) {
        await this.syncToStoracha();
      }
    }, 30000);
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  }

  // ============================================================================
  // Workspace Operations
  // ============================================================================

  /**
   * Get all workspaces
   */
  getWorkspaces(): WorkspaceData[] {
    return this.userData?.workspaces || [];
  }

  /**
   * Get default workspace
   */
  getDefaultWorkspace(): WorkspaceData | null {
    return this.userData?.workspaces.find(w => w.isDefault) || 
           this.userData?.workspaces[0] || 
           null;
  }

  /**
   * Create a new workspace
   */
  async createWorkspace(name: string, icon: string = '📁'): Promise<WorkspaceData> {
    await this.ensureInitialized();

    const now = new Date().toISOString();
    const workspace: WorkspaceData = {
      id: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      icon,
      createdAt: now,
      updatedAt: now
    };

    this.userData!.workspaces.push(workspace);
    this.userData!.workspaceContents[workspace.id] = [];
    
    await this.markChanged();
    return workspace;
  }

  /**
   * Update workspace
   */
  async updateWorkspace(id: string, updates: Partial<Pick<WorkspaceData, 'name' | 'icon'>>): Promise<void> {
    await this.ensureInitialized();

    const workspace = this.userData!.workspaces.find(w => w.id === id);
    if (workspace) {
      Object.assign(workspace, updates, { updatedAt: new Date().toISOString() });
      await this.markChanged();
    }
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(id: string): Promise<void> {
    await this.ensureInitialized();

    // Don't delete the last workspace
    if (this.userData!.workspaces.length <= 1) {
      throw new Error('Cannot delete the last workspace');
    }

    // Remove all content in the workspace
    const contentIds = this.userData!.workspaceContents[id] || [];
    for (const contentId of contentIds) {
      delete this.userData!.contentIndex[contentId];
    }
    delete this.userData!.workspaceContents[id];

    // Remove workspace
    this.userData!.workspaces = this.userData!.workspaces.filter(w => w.id !== id);

    await this.markChanged();
  }

  // ============================================================================
  // Content Operations
  // ============================================================================

  /**
   * Add content to the index
   */
  async addContent(reference: ContentReference, workspaceId?: string): Promise<void> {
    await this.ensureInitialized();

    this.userData!.contentIndex[reference.id] = reference;

    // Add to workspace if specified
    if (workspaceId) {
      if (!this.userData!.workspaceContents[workspaceId]) {
        this.userData!.workspaceContents[workspaceId] = [];
      }
      if (!this.userData!.workspaceContents[workspaceId].includes(reference.id)) {
        this.userData!.workspaceContents[workspaceId].push(reference.id);
      }
    }

    await this.markChanged();
  }

  /**
   * Update content reference
   */
  async updateContent(id: string, updates: Partial<ContentReference>): Promise<void> {
    await this.ensureInitialized();

    const existing = this.userData!.contentIndex[id];
    if (existing) {
      this.userData!.contentIndex[id] = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await this.markChanged();
    }
  }

  /**
   * Remove content from the index
   */
  async removeContent(id: string): Promise<void> {
    await this.ensureInitialized();

    delete this.userData!.contentIndex[id];

    // Remove from workspace contents
    for (const workspaceId of Object.keys(this.userData!.workspaceContents)) {
      this.userData!.workspaceContents[workspaceId] = 
        this.userData!.workspaceContents[workspaceId].filter(cid => cid !== id);
    }

    await this.markChanged();
  }

  /**
   * Get content by ID
   */
  getContent(id: string): ContentReference | null {
    return this.userData?.contentIndex[id] || null;
  }

  /**
   * Get all content for a workspace
   */
  getWorkspaceContent(workspaceId: string): ContentReference[] {
    const contentIds = this.userData?.workspaceContents[workspaceId] || [];
    return contentIds
      .map(id => this.userData?.contentIndex[id])
      .filter((c): c is ContentReference => c !== undefined);
  }

  /**
   * Get content by type
   */
  getContentByType(type: ContentReference['type']): ContentReference[] {
    if (!this.userData) return [];
    return Object.values(this.userData.contentIndex).filter(c => c.type === type);
  }

  // ============================================================================
  // Page/Note Operations
  // ============================================================================

  /**
   * Add a page/note reference
   */
  async addPage(
    id: string,
    title: string,
    workspaceId: string,
    options: {
      cid?: string;
      icon?: string;
      isFolder?: boolean;
      parentId?: string;
    } = {}
  ): Promise<PageReference> {
    const now = new Date().toISOString();
    const reference: PageReference = {
      id,
      cid: options.cid || '',
      type: options.isFolder ? 'page' : 'note',
      title,
      createdAt: now,
      updatedAt: now,
      workspaceId,
      icon: options.icon,
      isFolder: options.isFolder,
      parentId: options.parentId,
      children: options.isFolder ? [] : undefined
    };

    await this.addContent(reference, workspaceId);
    return reference;
  }

  /**
   * Update page CID after saving to Storacha
   */
  async updatePageCid(id: string, cid: string): Promise<void> {
    await this.updateContent(id, { cid, updatedAt: new Date().toISOString() });
  }

  /**
   * Get pages for a workspace
   */
  getWorkspacePages(workspaceId: string): PageReference[] {
    return this.getWorkspaceContent(workspaceId)
      .filter((c): c is PageReference => c.type === 'page' || c.type === 'note');
  }

  // ============================================================================
  // Database Operations
  // ============================================================================

  /**
   * Add a database reference
   */
  async addDatabase(
    id: string,
    title: string,
    workspaceId: string,
    options: {
      cid?: string;
      icon?: string;
      rowCount?: number;
    } = {}
  ): Promise<DatabaseReference> {
    const now = new Date().toISOString();
    const reference: DatabaseReference = {
      id,
      cid: options.cid || '',
      type: 'database',
      title,
      createdAt: now,
      updatedAt: now,
      workspaceId,
      icon: options.icon,
      rowCount: options.rowCount
    };

    await this.addContent(reference, workspaceId);
    return reference;
  }

  /**
   * Update database CID after syncing to Storacha
   */
  async updateDatabaseCid(id: string, cid: string): Promise<void> {
    await this.updateContent(id, { cid, updatedAt: new Date().toISOString() });
  }

  /**
   * Get databases for a workspace
   */
  getWorkspaceDatabases(workspaceId: string): DatabaseReference[] {
    return this.getWorkspaceContent(workspaceId)
      .filter((c): c is DatabaseReference => c.type === 'database');
  }

  /**
   * Get all databases
   */
  getAllDatabases(): DatabaseReference[] {
    return this.getContentByType('database') as DatabaseReference[];
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.userData) {
      await this.createDefaultUserData();
    }
  }

  /**
   * Mark data as changed (triggers auto-sync)
   */
  private async markChanged(): Promise<void> {
    this.pendingChanges = true;
    await this.saveToLocal();
  }

  /**
   * Get user data for export
   */
  getUserData(): UserData | null {
    return this.userData;
  }

  /**
   * Import user data (for migration)
   */
  async importUserData(data: UserData): Promise<void> {
    this.userData = data;
    await this.markChanged();
    await this.syncToStoracha();
  }

  /**
   * Get sync status
   */
  getSyncStatus(): {
    initialized: boolean;
    hasPendingChanges: boolean;
    lastSyncAt: string | null;
    syncVersion: number;
  } {
    return {
      initialized: this.initialized,
      hasPendingChanges: this.pendingChanges,
      lastSyncAt: this.userData?.lastSyncAt || null,
      syncVersion: this.userData?.syncVersion || 0
    };
  }

  /**
   * Force sync now
   */
  async forceSyncNow(): Promise<string | null> {
    return await this.syncToStoracha();
  }
}

// Export singleton instance
export const userDataService = new UserDataService();
