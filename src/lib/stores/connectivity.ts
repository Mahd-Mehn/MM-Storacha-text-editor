/**
 * Connectivity Store
 * Svelte store for managing connection status state
 * Requirements: 3.4, 3.5 - Connection status display and state management
 */

import { writable, derived, type Readable } from 'svelte/store';
import type { ConnectionStatus, ConnectivityEvent } from '../types/index.js';
import { offlineDetectionService } from '../services/offline-detection.js';

/**
 * Writable store for the current connection status
 */
export const connectionStatus = writable<ConnectionStatus>('unknown');

/**
 * Writable store for the last connectivity event
 */
export const lastConnectivityEvent = writable<ConnectivityEvent | null>(null);

/**
 * Derived store for checking if currently online
 */
export const isOnline: Readable<boolean> = derived(
  connectionStatus,
  ($status) => $status === 'online'
);

/**
 * Derived store for checking if currently offline
 */
export const isOffline: Readable<boolean> = derived(
  connectionStatus,
  ($status) => $status === 'offline'
);

/**
 * Derived store for checking if connection is in transition
 */
export const isConnecting: Readable<boolean> = derived(
  connectionStatus,
  ($status) => $status === 'connecting'
);

/**
 * Derived store for getting a human-readable status message
 */
export const connectionStatusMessage: Readable<string> = derived(
  connectionStatus,
  ($status) => {
    switch ($status) {
      case 'online':
        return 'Connected';
      case 'offline':
        return 'Offline';
      case 'connecting':
        return 'Connecting...';
      case 'unknown':
        return 'Checking connection...';
      default:
        return 'Unknown';
    }
  }
);

/**
 * Initialize the connectivity store
 * Sets up the offline detection service and connects it to the stores
 */
export function initializeConnectivityStore(): () => void {
  // Initialize the offline detection service
  offlineDetectionService.initialize();

  // Set initial status
  connectionStatus.set(offlineDetectionService.getConnectionStatus());

  // Subscribe to status changes
  const unsubscribe = offlineDetectionService.onStatusChange((event: ConnectivityEvent) => {
    connectionStatus.set(event.status);
    lastConnectivityEvent.set(event);
  });

  // Return cleanup function
  return () => {
    unsubscribe();
    offlineDetectionService.destroy();
  };
}

/**
 * Manually refresh the connection status
 * Useful for user-triggered connectivity checks
 */
export function refreshConnectionStatus(): void {
  const currentStatus = offlineDetectionService.getConnectionStatus();
  connectionStatus.set(currentStatus);
}