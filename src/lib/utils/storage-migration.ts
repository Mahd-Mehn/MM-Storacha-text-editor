/**
 * Storage Migration Utilities
 * Handles migration of data between incompatible storage formats
 */

/**
 * Clear all data from IndexedDB
 * Use this when the data format has changed incompatibly
 */
export async function clearAllStorageData(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    // Clear IndexedDB databases
    const databases = await window.indexedDB.databases();
    
    for (const db of databases) {
      if (db.name) {
        console.log(`Deleting database: ${db.name}`);
        window.indexedDB.deleteDatabase(db.name);
      }
    }
    
    // Clear localStorage items related to notes
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('note_') || key.startsWith('storacha-'))) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      console.log(`Removing localStorage key: ${key}`);
      localStorage.removeItem(key);
    });
    
    console.log('Storage cleared successfully');
  } catch (error) {
    console.error('Failed to clear storage:', error);
    throw error;
  }
}

/**
 * Check if storage needs migration
 * Returns true if old format data is detected
 */
export async function needsMigration(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  try {
    // Check for migration flag
    const migrationVersion = localStorage.getItem('storage-migration-version');
    const currentVersion = '2.0'; // Increment this when format changes
    
    return migrationVersion !== currentVersion;
  } catch (error) {
    console.error('Failed to check migration status:', error);
    return false;
  }
}

/**
 * Mark migration as complete
 */
export function markMigrationComplete(): void {
  if (typeof window === 'undefined') return;
  
  const currentVersion = '2.0';
  localStorage.setItem('storage-migration-version', currentVersion);
  console.log(`Migration marked complete: version ${currentVersion}`);
}

/**
 * Perform automatic migration if needed
 * This will clear old data if the format is incompatible
 */
export async function autoMigrate(): Promise<boolean> {
  const needsUpdate = await needsMigration();
  
  if (needsUpdate) {
    console.warn('Incompatible storage format detected. Clearing old data...');
    console.warn('Note: This is a one-time operation due to Yjs structure changes.');
    
    try {
      await clearAllStorageData();
      markMigrationComplete();
      return true;
    } catch (error) {
      console.error('Migration failed:', error);
      return false;
    }
  }
  
  return false;
}
