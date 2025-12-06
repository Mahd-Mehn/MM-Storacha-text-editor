import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

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
    
    // Create a new page
    createPage: (title: string, icon: string, type: 'folder' | 'file', parentId?: string) => {
      update(state => {
        const newPage: Page = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title,
          icon,
          type,
          children: [],
          parentId,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

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
