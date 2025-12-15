import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { userDataService } from '$lib/services/user-data-service';

export interface Page {
  id: string;
  title: string;
  icon: string;
  type: 'folder' | 'file';
  cover?: string;
  parentId?: string;
  children: Page[];
  createdAt: number;
  updatedAt: number;
  storachaCID?: string; // Link to content on Storacha
}

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  pages: Page[];
}

interface WorkspaceState {
  workspace: Workspace;
  selectedPageId: string | null;
  expandedIds: Set<string>;
}

const STORAGE_KEY = 'workspace-state-v2';

function generateWorkspacePageId(): string {
  try {
    const randomUUID = globalThis.crypto?.randomUUID;
    if (typeof randomUUID === 'function') {
      return `page_${randomUUID()}`;
    }
  } catch {
    // ignore
  }

  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Load initial state from localStorage
function loadInitialState(): WorkspaceState {
  if (browser) {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          workspace: parsed.workspace,
          selectedPageId: parsed.selectedPageId,
          expandedIds: new Set(parsed.expandedIds || [])
        };
      } catch (e) {
        console.error('Failed to parse workspace state:', e);
      }
    }
  }

  // Default state with sample data
  return {
    workspace: {
      id: 'default',
      name: 'My Workspace',
      icon: '📝',
      pages: [
        {
          id: '1',
          title: 'Getting Started',
          icon: '📚',
          type: 'folder',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          children: [
            { id: '1-1', title: 'Introduction', icon: '👋', type: 'file', children: [], parentId: '1', createdAt: Date.now(), updatedAt: Date.now() },
            { id: '1-2', title: 'Quick Start', icon: '⚡', type: 'file', children: [], parentId: '1', createdAt: Date.now(), updatedAt: Date.now() },
          ],
        },
        {
          id: '2',
          title: 'Projects',
          icon: '📁',
          type: 'folder',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          children: [
            { id: '2-1', title: 'Website Redesign', icon: '🎨', type: 'file', children: [], parentId: '2', createdAt: Date.now(), updatedAt: Date.now() },
            { id: '2-2', title: 'Mobile App', icon: '📱', type: 'file', children: [], parentId: '2', createdAt: Date.now(), updatedAt: Date.now() },
          ],
        },
        {
          id: '3',
          title: 'Meeting Notes',
          icon: '📝',
          type: 'file',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          children: [],
        },
        {
          id: '4',
          title: 'Personal',
          icon: '🏠',
          type: 'folder',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          children: [
            { id: '4-1', title: 'Journal', icon: '📖', type: 'file', children: [], parentId: '4', createdAt: Date.now(), updatedAt: Date.now() },
            { id: '4-2', title: 'Ideas', icon: '💡', type: 'file', children: [], parentId: '4', createdAt: Date.now(), updatedAt: Date.now() },
          ],
        },
      ]
    },
    selectedPageId: null,
    expandedIds: new Set(['1', '2', '4'])
  };
}

function createWorkspaceStateStore() {
  const { subscribe, set, update } = writable<WorkspaceState>(loadInitialState());

  // Save to localStorage whenever state changes
  if (browser) {
    subscribe((state) => {
      const toStore = {
        workspace: state.workspace,
        selectedPageId: state.selectedPageId,
        expandedIds: Array.from(state.expandedIds)
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    });
  }

  // Helper function to update a page in the tree
  function updatePageInTree(pages: Page[], id: string, updater: (page: Page) => Page): Page[] {
    return pages.map(page => {
      if (page.id === id) {
        return updater(page);
      }
      if (page.children.length > 0) {
        return {
          ...page,
          children: updatePageInTree(page.children, id, updater)
        };
      }
      return page;
    });
  }

  // Helper function to remove a page from the tree
  function removePageFromTree(pages: Page[], id: string): Page[] {
    return pages.filter(page => page.id !== id).map(page => ({
      ...page,
      children: removePageFromTree(page.children, id)
    }));
  }

  return {
    subscribe,
    set,
    update,
    
    // Create a new page
    createPage: (title: string, icon: string, type: 'folder' | 'file', parentId?: string): Page | null => {
      let createdPage: Page | null = null;
      
      update(state => {
        const newPage: Page = {
          id: generateWorkspacePageId(),
          title,
          icon,
          type,
          children: [],
          parentId,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        createdPage = newPage;

        if (parentId) {
          // Add to parent's children
          const updatedPages = updatePageInTree(state.workspace.pages, parentId, (parent) => ({
            ...parent,
            children: [...parent.children, newPage],
            updatedAt: Date.now()
          }));
          
          // Expand parent
          state.expandedIds.add(parentId);
          
          return {
            ...state,
            workspace: {
              ...state.workspace,
              pages: updatedPages
            },
            selectedPageId: newPage.id
          };
        } else {
          // Add to root
          return {
            ...state,
            workspace: {
              ...state.workspace,
              pages: [...state.workspace.pages, newPage]
            },
            selectedPageId: newPage.id
          };
        }
      });
      
      // Sync to user data service (async, don't await)
      if (createdPage && browser) {
        syncPageToUserData(createdPage, 'default').catch(console.error);
      }

      return createdPage;
    },

    // Rename a page
    renamePage: (id: string, newTitle: string) => {
      update(state => ({
        ...state,
        workspace: {
          ...state.workspace,
          pages: updatePageInTree(state.workspace.pages, id, (page) => ({
            ...page,
            title: newTitle,
            updatedAt: Date.now()
          }))
        }
      }));
    },

    // Change page icon
    changeIcon: (id: string, newIcon: string) => {
      update(state => ({
        ...state,
        workspace: {
          ...state.workspace,
          pages: updatePageInTree(state.workspace.pages, id, (page) => ({
            ...page,
            icon: newIcon,
            updatedAt: Date.now()
          }))
        }
      }));
    },

    // Delete a page
    deletePage: (id: string) => {
      update(state => ({
        ...state,
        workspace: {
          ...state.workspace,
          pages: removePageFromTree(state.workspace.pages, id)
        },
        selectedPageId: state.selectedPageId === id ? null : state.selectedPageId
      }));
      
      // Sync deletion to user data service
      if (browser) {
        removePageFromUserData(id).catch(console.error);
      }
    },

    // Toggle expanded state
    toggleExpanded: (id: string) => {
      update(state => {
        const newExpandedIds = new Set(state.expandedIds);
        if (newExpandedIds.has(id)) {
          newExpandedIds.delete(id);
        } else {
          newExpandedIds.add(id);
        }
        return {
          ...state,
          expandedIds: newExpandedIds
        };
      });
    },

    // Select a page
    selectPage: (id: string | null) => {
      update(state => ({
        ...state,
        selectedPageId: id
      }));
    }
  };
}

export const workspaceState = createWorkspaceStateStore();

// Sync page to user data service
async function syncPageToUserData(page: Page, workspaceId: string): Promise<void> {
  if (!browser) return;
  
  try {
    await userDataService.initialize();
    await userDataService.addPage(
      page.id,
      page.title,
      workspaceId,
      {
        icon: page.icon,
        isFolder: page.type === 'folder',
        parentId: page.parentId,
        cid: page.storachaCID
      }
    );
  } catch (error) {
    console.error('Failed to sync page to user data:', error);
  }
}

// Remove page from user data service
async function removePageFromUserData(pageId: string): Promise<void> {
  if (!browser) return;
  
  try {
    await userDataService.initialize();
    await userDataService.removeContent(pageId);
  } catch (error) {
    console.error('Failed to remove page from user data:', error);
  }
}

// Update page CID in user data
export async function updatePageStorachaCID(pageId: string, cid: string): Promise<void> {
  if (!browser) return;
  
  try {
    await userDataService.initialize();
    await userDataService.updatePageCid(pageId, cid);
    
    // Also update local state
    workspaceState.update((state) => ({
      ...state,
      workspace: {
        ...state.workspace,
        pages: updatePageInTreeHelper(state.workspace.pages, pageId, (page) => ({
          ...page,
          storachaCID: cid,
          updatedAt: Date.now()
        }))
      }
    }));
  } catch (error) {
    console.error('Failed to update page CID:', error);
  }
}

// Helper for updating pages in tree (exported for use in updatePageStorachaCID)
function updatePageInTreeHelper(pages: Page[], id: string, updater: (page: Page) => Page): Page[] {
  return pages.map(page => {
    if (page.id === id) {
      return updater(page);
    }
    if (page.children.length > 0) {
      return {
        ...page,
        children: updatePageInTreeHelper(page.children, id, updater)
      };
    }
    return page;
  });
}

// Legacy exports for backward compatibility
export const workspaceStore = derived(workspaceState, $state => $state.workspace);

export function addPage(page: Omit<Page, 'createdAt' | 'updatedAt' | 'children'>) {
  workspaceState.createPage(
    page.title,
    page.icon || '📄',
    (page as any).type || 'file',
    page.parentId
  );
}

export function updatePage(id: string, updates: Partial<Page>) {
  if (updates.title) {
    workspaceState.renamePage(id, updates.title);
  }
  if (updates.icon) {
    workspaceState.changeIcon(id, updates.icon);
  }
}

export function deletePage(id: string) {
  workspaceState.deletePage(id);
}
