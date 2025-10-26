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