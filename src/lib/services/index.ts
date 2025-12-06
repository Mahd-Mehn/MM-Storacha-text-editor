// Service layer exports for Storacha Notes
// This file will export all business logic services and managers

// Yjs document management
export { YjsDocumentManager, yjsDocumentManager } from './yjs-document';

// UCAN authentication and identity management
export { UCANAuthService, authService } from './auth';

// Storacha space management
export { StorachaSpaceService, spaceService } from './space';

// Storacha storage integration
export { StorachaClient, storachaClient } from './storacha';

// Auto-save functionality
export { AutoSaveService, autoSaveService } from './autosave';

// Version history management
export { VersionHistoryService, versionHistoryService } from './version-history';

// Offline detection and connectivity monitoring
export { OfflineDetectionService, offlineDetectionService } from './offline-detection';

// Offline synchronization management
export { OfflineSyncManager, offlineSyncManager } from './offline-sync';

// Local storage management
export { LocalStorageManager, localStorageManager } from './local-storage';

// Hybrid storage service
export { HybridStorageService, hybridStorageService } from './hybrid-storage';

// Note management service
export { NoteManager, noteManager } from './note-manager';

// Block management service
export { BlockManager, blockManager } from './block-manager';

// Page management service
export { PageManager, pageManager } from './page-manager';

// Error handling service
export { ErrorHandlerService, errorHandler } from './error-handler';

// Notification service
export { NotificationService, notificationService } from './notification';