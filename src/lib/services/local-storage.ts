/**
 * Local Storage Manager Service
 * Implements IndexedDB wrapper for local note storage fallback
 * Requirements: 3.1, 3.5 - Local storage fallback and sync mechanism
 */

import type {
    StoredNoteData,
    LocalStorageEntry,
    LocalStorageManagerInterface
} from '../types/index.js';

export class LocalStorageManager implements LocalStorageManagerInterface {
    private db: IDBDatabase | null = null;
    private readonly DB_NAME = 'storacha-notes-local';
    private readonly DB_VERSION = 1;
    private readonly STORE_NAME = 'notes';
    private isInitialized = false;

    /**
     * Initialize the IndexedDB database
     */
    async initialize(): Promise<void> {
        if (this.isInitialized && this.db) {
            return;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => {
                reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isInitialized = true;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create the notes object store
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'noteId' });

                    // Create indexes for efficient querying
                    store.createIndex('synced', 'synced', { unique: false });
                    store.createIndex('storedAt', 'storedAt', { unique: false });
                    store.createIndex('lastSyncAttempt', 'lastSyncAttempt', { unique: false });
                }
            };
        });
    }

    /**
     * Store note data locally
     */
    async storeNote(noteData: StoredNoteData): Promise<void> {
        if (!this.db) {
            throw new Error('LocalStorageManager not initialized');
        }

        try {
            // Create a deep serializable copy of the note data
            // Ensure Uint8Array is properly handled and all Date objects are properly cloned
            const serializableData: StoredNoteData = {
                noteId: noteData.noteId,
                yjsUpdate: new Uint8Array(noteData.yjsUpdate), // Create new Uint8Array to ensure it's cloneable
                metadata: {
                    created: new Date(noteData.metadata.created),
                    modified: new Date(noteData.metadata.modified),
                    version: noteData.metadata.version,
                    storachaCID: noteData.metadata.storachaCID,
                    shareLinks: noteData.metadata.shareLinks ? noteData.metadata.shareLinks.map(link => ({
                        id: link.id,
                        url: link.url,
                        permissions: link.permissions,
                        created: new Date(link.created),
                        expiresAt: link.expiresAt ? new Date(link.expiresAt) : undefined
                    })) : []
                },
                versionHistory: noteData.versionHistory.map(version => ({
                    version: version.version,
                    timestamp: new Date(version.timestamp),
                    storachaCID: version.storachaCID,
                    changeDescription: version.changeDescription
                }))
            };

            const entry: LocalStorageEntry = {
                noteId: noteData.noteId,
                data: serializableData,
                storedAt: new Date(),
                synced: false,
                syncAttempts: 0
            };

            return new Promise((resolve, reject) => {
                const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
                const store = transaction.objectStore(this.STORE_NAME);
                const request = store.put(entry);

                request.onerror = () => {
                    console.error('IndexedDB put error:', request.error);
                    console.error('Failed entry:', entry);
                    reject(new Error(`Failed to store note: ${request.error?.message}`));
                };

                request.onsuccess = () => {
                    resolve();
                };
            });
        } catch (error) {
            console.error('Error preparing note data for storage:', error);
            console.error('Note data:', noteData);
            throw error;
        }
    }

    /**
     * Retrieve note data from local storage
     */
    async retrieveNote(noteId: string): Promise<StoredNoteData | null> {
        if (!this.db) {
            throw new Error('LocalStorageManager not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.get(noteId);

            request.onerror = () => {
                reject(new Error(`Failed to retrieve note: ${request.error?.message}`));
            };

            request.onsuccess = () => {
                const entry = request.result as LocalStorageEntry | undefined;
                resolve(entry ? entry.data : null);
            };
        });
    }

    /**
     * List all stored notes
     */
    async listNotes(): Promise<LocalStorageEntry[]> {
        if (!this.db) {
            throw new Error('LocalStorageManager not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.getAll();

            request.onerror = () => {
                reject(new Error(`Failed to list notes: ${request.error?.message}`));
            };

            request.onsuccess = () => {
                resolve(request.result as LocalStorageEntry[]);
            };
        });
    }

    /**
     * Delete note from local storage
     */
    async deleteNote(noteId: string): Promise<void> {
        if (!this.db) {
            throw new Error('LocalStorageManager not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.delete(noteId);

            request.onerror = () => {
                reject(new Error(`Failed to delete note: ${request.error?.message}`));
            };

            request.onsuccess = () => {
                resolve();
            };
        });
    }

    /**
     * Mark a note as synced to remote storage
     */
    async markAsSynced(noteId: string): Promise<void> {
        if (!this.db) {
            throw new Error('LocalStorageManager not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const getRequest = store.get(noteId);

            getRequest.onerror = () => {
                reject(new Error(`Failed to get note for sync marking: ${getRequest.error?.message}`));
            };

            getRequest.onsuccess = () => {
                const entry = getRequest.result as LocalStorageEntry | undefined;
                if (!entry) {
                    reject(new Error(`Note ${noteId} not found in local storage`));
                    return;
                }

                entry.synced = true;
                entry.lastSyncAttempt = new Date();

                const putRequest = store.put(entry);

                putRequest.onerror = () => {
                    reject(new Error(`Failed to mark note as synced: ${putRequest.error?.message}`));
                };

                putRequest.onsuccess = () => {
                    resolve();
                };
            };
        });
    }

    /**
     * Get all notes that haven't been synced to remote storage
     */
    async getUnsyncedNotes(): Promise<LocalStorageEntry[]> {
        if (!this.db) {
            throw new Error('LocalStorageManager not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const index = store.index('synced');
            const request = index.getAll(IDBKeyRange.only(false)); // Get all unsynced notes

            request.onerror = () => {
                reject(new Error(`Failed to get unsynced notes: ${request.error?.message}`));
            };

            request.onsuccess = () => {
                resolve(request.result as LocalStorageEntry[]);
            };
        });
    }

    /**
     * Clear all local storage data
     */
    async clearStorage(): Promise<void> {
        if (!this.db) {
            throw new Error('LocalStorageManager not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.clear();

            request.onerror = () => {
                reject(new Error(`Failed to clear storage: ${request.error?.message}`));
            };

            request.onsuccess = () => {
                resolve();
            };
        });
    }

    /**
     * Get approximate storage size in bytes
     */
    async getStorageSize(): Promise<number> {
        if (!this.db) {
            throw new Error('LocalStorageManager not initialized');
        }

        const entries = await this.listNotes();
        let totalSize = 0;

        for (const entry of entries) {
            // Rough estimation of entry size
            totalSize += JSON.stringify(entry).length * 2; // UTF-16 encoding
            totalSize += entry.data.yjsUpdate.byteLength;
        }

        return totalSize;
    }

    /**
     * Clean up database connection
     */
    destroy(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        this.isInitialized = false;
    }

    /**
     * Update sync attempt information for a note
     */
    async updateSyncAttempt(noteId: string): Promise<void> {
        if (!this.db) {
            throw new Error('LocalStorageManager not initialized');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const getRequest = store.get(noteId);

            getRequest.onerror = () => {
                reject(new Error(`Failed to get note for sync attempt update: ${getRequest.error?.message}`));
            };

            getRequest.onsuccess = () => {
                const entry = getRequest.result as LocalStorageEntry | undefined;
                if (!entry) {
                    reject(new Error(`Note ${noteId} not found in local storage`));
                    return;
                }

                entry.syncAttempts++;
                entry.lastSyncAttempt = new Date();

                const putRequest = store.put(entry);

                putRequest.onerror = () => {
                    reject(new Error(`Failed to update sync attempt: ${putRequest.error?.message}`));
                };

                putRequest.onsuccess = () => {
                    resolve();
                };
            };
        });
    }

    /**
     * Check if IndexedDB is supported
     */
    static isSupported(): boolean {
        return typeof indexedDB !== 'undefined';
    }

    /**
     * Get database info for debugging
     */
    async getDatabaseInfo(): Promise<{ name: string; version: number; storeNames: string[] }> {
        if (!this.db) {
            throw new Error('LocalStorageManager not initialized');
        }

        return {
            name: this.db.name,
            version: this.db.version,
            storeNames: Array.from(this.db.objectStoreNames)
        };
    }
}

// Create and export a singleton instance
export const localStorageManager = new LocalStorageManager();