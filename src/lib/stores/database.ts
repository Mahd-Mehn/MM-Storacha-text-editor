import { writable, derived, get } from 'svelte/store';
import { databaseService } from '$lib/services/database-service';
import type { DatabaseSchema, DatabaseRow, DatabaseView, FilterGroup, SortRule } from '$lib/types/database';
import { authState } from './auth';

// State interface
interface DatabaseState {
  databases: DatabaseSchema[];
  activeDatabaseId: string | null;
  activeDatabaseRows: DatabaseRow[];
  activeDatabaseViews: DatabaseView[];
  activeViewId: string | null;
  loading: boolean;
  error: string | null;
  syncStatus: {
    status: 'idle' | 'syncing' | 'error' | 'offline' | 'pending' | 'synced';
    lastSync: string | null;
    pendingChanges: number;
  };
}

// Initial state
const initialState: DatabaseState = {
  databases: [],
  activeDatabaseId: null,
  activeDatabaseRows: [],
  activeDatabaseViews: [],
  activeViewId: null,
  loading: false,
  error: null,
  syncStatus: {
    status: 'idle',
    lastSync: null,
    pendingChanges: 0
  }
};

// Create the store
const { subscribe, set, update } = writable<DatabaseState>(initialState);

// Derived stores
export const databases = derived({ subscribe }, $state => $state.databases);
export const activeDatabaseId = derived({ subscribe }, $state => $state.activeDatabaseId);
export const activeDatabase = derived({ subscribe }, $state => 
  $state.databases.find(db => db.id === $state.activeDatabaseId) || null
);
export const activeRows = derived({ subscribe }, $state => $state.activeDatabaseRows);
export const activeViews = derived({ subscribe }, $state => $state.activeDatabaseViews);
export const activeView = derived({ subscribe }, $state => 
  $state.activeDatabaseViews.find(v => v.id === $state.activeViewId) || null
);
export const databaseLoading = derived({ subscribe }, $state => $state.loading);
export const databaseError = derived({ subscribe }, $state => $state.error);
export const databaseSyncStatus = derived({ subscribe }, $state => $state.syncStatus);

// Actions
export const databaseStore = {
  subscribe,
  
  // Initialize and load databases
  async init() {
    update(s => ({ ...s, loading: true, error: null }));
    try {
      await databaseService.initialize();
      const dbs = await databaseService.listDatabases();
      
      // Subscribe to sync status updates
      databaseService.on('sync:started', (dbId) => {
        update(s => ({
          ...s,
          syncStatus: { ...s.syncStatus, status: 'syncing' }
        }));
      });
      
      databaseService.on('sync:completed', (dbId) => {
        update(s => ({
          ...s,
          syncStatus: { ...s.syncStatus, status: 'synced', lastSync: new Date().toISOString() }
        }));
      });

      update(s => ({ 
        ...s, 
        databases: dbs, 
        loading: false 
      }));
    } catch (err) {
      console.error('Failed to initialize database store:', err);
      update(s => ({ 
        ...s, 
        loading: false, 
        error: err instanceof Error ? err.message : 'Failed to initialize databases' 
      }));
    }
  },

  // Create a new database
  async createDatabase(name: string, description?: string) {
    update(s => ({ ...s, loading: true, error: null }));
    try {
      const newDb = await databaseService.createDatabase(name, [], description);
      update(s => ({
        ...s,
        databases: [...s.databases, newDb],
        loading: false
      }));
      return newDb;
    } catch (err) {
      update(s => ({ 
        ...s, 
        loading: false, 
        error: err instanceof Error ? err.message : 'Failed to create database' 
      }));
      throw err;
    }
  },

  // Select and load a database
  async selectDatabase(id: string) {
    update(s => ({ ...s, loading: true, error: null, activeDatabaseId: id }));
    try {
      const result = await databaseService.queryRows({ databaseId: id });
      // In a real app, we'd also fetch views here
      const views: DatabaseView[] = []; 
      
      update(s => ({
        ...s,
        activeDatabaseRows: result.rows,
        activeDatabaseViews: views,
        loading: false
      }));
    } catch (err) {
      update(s => ({ 
        ...s, 
        loading: false, 
        error: err instanceof Error ? err.message : 'Failed to load database' 
      }));
    }
  },

  // Add a row to the active database
  async addRow(data: Record<string, any>) {
    const state = get({ subscribe });
    if (!state.activeDatabaseId) return;

    try {
      const newRow = await databaseService.createRow(state.activeDatabaseId, data);
      if (newRow) {
        update(s => ({
          ...s,
          activeDatabaseRows: [...s.activeDatabaseRows, newRow]
        }));
      }
      return newRow;
    } catch (err) {
      update(s => ({ 
        ...s, 
        error: err instanceof Error ? err.message : 'Failed to add row' 
      }));
      throw err;
    }
  },

  // Update a row in the active database
  async updateRow(rowId: string, data: Record<string, any>) {
    const state = get({ subscribe });
    if (!state.activeDatabaseId) return;

    try {
      const updatedRow = await databaseService.updateRow(rowId, data);
      if (updatedRow) {
        update(s => ({
          ...s,
          activeDatabaseRows: s.activeDatabaseRows.map(r => r.id === rowId ? updatedRow : r)
        }));
      }
      return updatedRow;
    } catch (err) {
      update(s => ({ 
        ...s, 
        error: err instanceof Error ? err.message : 'Failed to update row' 
      }));
      throw err;
    }
  },

  // Delete a row from the active database
  async deleteRow(rowId: string) {
    const state = get({ subscribe });
    if (!state.activeDatabaseId) return;

    try {
      await databaseService.deleteRow(rowId);
      update(s => ({
        ...s,
        activeDatabaseRows: s.activeDatabaseRows.filter(r => r.id !== rowId)
      }));
    } catch (err) {
      update(s => ({ 
        ...s, 
        error: err instanceof Error ? err.message : 'Failed to delete row' 
      }));
      throw err;
    }
  },

  // Sync the active database
  async syncActiveDatabase() {
    const state = get({ subscribe });
    if (!state.activeDatabaseId) return;

    try {
      await databaseService.syncToStoracha(state.activeDatabaseId);
    } catch (err) {
      update(s => ({ 
        ...s, 
        error: err instanceof Error ? err.message : 'Failed to sync database' 
      }));
    }
  }
};

// Initialize when auth is ready
authState.subscribe(auth => {
  if (auth.isAuthenticated) {
    databaseStore.init();
  }
});
