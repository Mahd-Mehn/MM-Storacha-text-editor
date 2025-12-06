import { writable } from 'svelte/store';

export interface Page {
  id: string;
  title: string;
  icon?: string;
  cover?: string;
  parentId?: string;
  children: Page[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Workspace {
  id: string;
  name: string;
  icon?: string;
  pages: Page[];
}

// Initial workspace data
const initialWorkspace: Workspace = {
  id: 'default',
  name: 'My Workspace',
  icon: '📝',
  pages: []
};

export const workspaceStore = writable<Workspace>(initialWorkspace);

// Helper functions
export function addPage(page: Omit<Page, 'createdAt' | 'updatedAt' | 'children'>) {
  workspaceStore.update(ws => {
    const newPage: Page = {
      ...page,
      children: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    if (page.parentId) {
      // Add as child to parent
      const addToParent = (pages: Page[]): Page[] => {
        return pages.map(p => {
          if (p.id === page.parentId) {
            return { ...p, children: [...p.children, newPage] };
          }
          if (p.children.length > 0) {
            return { ...p, children: addToParent(p.children) };
          }
          return p;
        });
      };
      ws.pages = addToParent(ws.pages);
    } else {
      // Add as top-level page
      ws.pages = [...ws.pages, newPage];
    }
    
    return ws;
  });
}

export function updatePage(id: string, updates: Partial<Page>) {
  workspaceStore.update(ws => {
    const updateInPages = (pages: Page[]): Page[] => {
      return pages.map(p => {
        if (p.id === id) {
          return { ...p, ...updates, updatedAt: new Date() };
        }
        if (p.children.length > 0) {
          return { ...p, children: updateInPages(p.children) };
        }
        return p;
      });
    };
    
    ws.pages = updateInPages(ws.pages);
    return ws;
  });
}

export function deletePage(id: string) {
  workspaceStore.update(ws => {
    const deleteFromPages = (pages: Page[]): Page[] => {
      return pages.filter(p => p.id !== id).map(p => ({
        ...p,
        children: deleteFromPages(p.children)
      }));
    };
    
    ws.pages = deleteFromPages(ws.pages);
    return ws;
  });
}
