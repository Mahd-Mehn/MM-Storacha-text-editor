/**
 * Offline Detection Service
 * Implements network connectivity monitoring and status management
 * Requirements: 3.4, 3.5 - Connection status display and offline handling
 */

import type { 
  ConnectionStatus, 
  ConnectivityEvent, 
  OfflineDetectionServiceInterface 
} from '../types/index.js';

export class OfflineDetectionService implements OfflineDetectionServiceInterface {
  private currentStatus: ConnectionStatus = 'unknown';
  private statusChangeCallbacks: Set<(event: ConnectivityEvent) => void> = new Set();
  private isInitialized = false;
  private connectivityCheckInterval: number | null = null;
  private lastOnlineCheck = 0;
  private readonly CONNECTIVITY_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly CONNECTIVITY_CHECK_TIMEOUT = 5000; // 5 seconds

  /**
   * Initialize the offline detection service
   * Sets up event listeners and starts connectivity monitoring
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    // Initial status check
    this.updateConnectionStatus(this.detectInitialStatus());

    // Listen to browser online/offline events
    window.addEventListener('online', this.handleOnlineEvent);
    window.addEventListener('offline', this.handleOfflineEvent);

    // Set up periodic connectivity checks for more reliable detection
    this.startConnectivityChecks();

    this.isInitialized = true;
  }

  /**
   * Get the current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return this.currentStatus === 'online';
  }

  /**
   * Check if currently offline
   */
  isOffline(): boolean {
    return this.currentStatus === 'offline';
  }

  /**
   * Register a callback for status change events
   * Returns an unsubscribe function
   */
  onStatusChange(callback: (event: ConnectivityEvent) => void): () => void {
    this.statusChangeCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.statusChangeCallbacks.delete(callback);
    };
  }

  /**
   * Clean up event listeners and intervals
   */
  destroy(): void {
    if (!this.isInitialized) {
      return;
    }

    window.removeEventListener('online', this.handleOnlineEvent);
    window.removeEventListener('offline', this.handleOfflineEvent);

    if (this.connectivityCheckInterval) {
      clearInterval(this.connectivityCheckInterval);
      this.connectivityCheckInterval = null;
    }

    this.statusChangeCallbacks.clear();
    this.isInitialized = false;
  }

  /**
   * Detect initial connection status based on navigator.onLine
   */
  private detectInitialStatus(): ConnectionStatus {
    if (typeof navigator === 'undefined' || typeof navigator.onLine === 'undefined') {
      return 'unknown';
    }
    
    return navigator.onLine ? 'online' : 'offline';
  }

  /**
   * Handle browser online event
   */
  private handleOnlineEvent = (): void => {
    this.updateConnectionStatus('connecting');
    
    // Verify actual connectivity with a quick check
    this.performConnectivityCheck().then(isConnected => {
      this.updateConnectionStatus(isConnected ? 'online' : 'offline');
    });
  };

  /**
   * Handle browser offline event
   */
  private handleOfflineEvent = (): void => {
    this.updateConnectionStatus('offline');
  };

  /**
   * Start periodic connectivity checks
   */
  private startConnectivityChecks(): void {
    this.connectivityCheckInterval = window.setInterval(() => {
      // Only perform checks if we think we're online or it's been a while
      const now = Date.now();
      const shouldCheck = this.currentStatus === 'online' || 
                         (now - this.lastOnlineCheck) > this.CONNECTIVITY_CHECK_INTERVAL;

      if (shouldCheck) {
        this.performConnectivityCheck().then(isConnected => {
          const expectedStatus = isConnected ? 'online' : 'offline';
          if (this.currentStatus !== expectedStatus) {
            this.updateConnectionStatus(expectedStatus);
          }
        });
      }
    }, this.CONNECTIVITY_CHECK_INTERVAL);
  }

  /**
   * Perform actual connectivity check by attempting to fetch a small resource
   * This provides more reliable detection than just navigator.onLine
   */
  private async performConnectivityCheck(): Promise<boolean> {
    this.lastOnlineCheck = Date.now();

    try {
      // Use a small, fast endpoint to check connectivity
      // We'll use a data URL to avoid external dependencies
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.CONNECTIVITY_CHECK_TIMEOUT);

      const response = await fetch('data:text/plain;base64,', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      // If fetch fails, we're likely offline
      return false;
    }
  }

  /**
   * Update the connection status and notify listeners
   */
  private updateConnectionStatus(newStatus: ConnectionStatus): void {
    if (this.currentStatus === newStatus) {
      return;
    }

    const previousStatus = this.currentStatus;
    this.currentStatus = newStatus;

    const event: ConnectivityEvent = {
      status: newStatus,
      timestamp: new Date(),
      context: `Changed from ${previousStatus} to ${newStatus}`
    };

    // Notify all registered callbacks
    this.statusChangeCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in connectivity status callback:', error);
      }
    });
  }
}

// Create and export a singleton instance
export const offlineDetectionService = new OfflineDetectionService();