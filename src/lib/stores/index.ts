// Svelte stores for state management in Storacha Notes
// This file will export all Svelte stores for application state

// Authentication stores
export { authState, isAuthenticated, currentDID, initializeAuth, clearAuth } from './auth';

// Space management stores
export { 
  availableSpaces, 
  currentSpace, 
  currentSpaceDID, 
  initializeSpaces, 
  refreshSpaces, 
  createSpace, 
  setCurrentSpace, 
  clearSpaces 
} from './space';

// Database stores
export {
  databaseStore,
  databases,
  activeDatabase,
  activeRows,
  activeViews,
  activeView,
  databaseLoading,
  databaseError,
  databaseSyncStatus
} from './database';

// Connectivity monitoring stores
export {
  connectionStatus,
  lastConnectivityEvent,
  isOnline,
  isOffline,
  isConnecting,
  connectionStatusMessage,
  initializeConnectivityStore,
  refreshConnectionStatus
} from './connectivity';

// Offline synchronization stores
export {
  queuedOperations,
  isSyncing,
  queueSize,
  hasPendingOperations,
  highPriorityOperationsCount,
  failedOperationsCount,
  syncStatusMessage,
  lastSyncTime,
  initializeSyncStore,
  queueSaveOperation,
  queueDeleteOperation,
  queueShareOperation,
  queueVersionOperation,
  triggerSync,
  clearSyncQueue
} from './sync';