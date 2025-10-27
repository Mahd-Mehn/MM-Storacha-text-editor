/**
 * Notification Service
 * Toast notifications and user feedback system
 * Requirements: 3.4, 2.1 - User feedback for status updates and operations
 */

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // milliseconds, 0 for persistent
  action?: {
    label: string;
    callback: () => void;
  };
  dismissible: boolean;
  timestamp: Date;
}

type NotificationCallback = (notification: Notification) => void;

/**
 * Notification Manager Service
 * Manages toast notifications and user feedback
 */
export class NotificationService {
  private notifications: Notification[] = [];
  private callbacks: Set<NotificationCallback> = new Set();
  private readonly DEFAULT_DURATION = 5000; // 5 seconds
  private readonly MAX_NOTIFICATIONS = 5;
  private timeouts: Map<string, number> = new Map();

  /**
   * Show a success notification
   */
  success(title: string, message?: string, duration?: number): string {
    return this.show({
      type: 'success',
      title,
      message,
      duration: duration ?? this.DEFAULT_DURATION,
      dismissible: true
    });
  }

  /**
   * Show an error notification
   */
  error(title: string, message?: string, action?: Notification['action']): string {
    return this.show({
      type: 'error',
      title,
      message,
      duration: 0, // Errors persist until dismissed
      dismissible: true,
      action
    });
  }

  /**
   * Show a warning notification
   */
  warning(title: string, message?: string, duration?: number): string {
    return this.show({
      type: 'warning',
      title,
      message,
      duration: duration ?? this.DEFAULT_DURATION * 1.5,
      dismissible: true
    });
  }

  /**
   * Show an info notification
   */
  info(title: string, message?: string, duration?: number): string {
    return this.show({
      type: 'info',
      title,
      message,
      duration: duration ?? this.DEFAULT_DURATION,
      dismissible: true
    });
  }

  /**
   * Show a loading notification
   */
  loading(title: string, message?: string): string {
    return this.show({
      type: 'loading',
      title,
      message,
      duration: 0, // Loading notifications persist
      dismissible: false
    });
  }

  /**
   * Show a generic notification
   */
  show(config: Omit<Notification, 'id' | 'timestamp'>): string {
    const notification: Notification = {
      ...config,
      id: this.generateId(),
      timestamp: new Date()
    };

    // Add to notifications list
    this.notifications.push(notification);

    // Limit number of notifications
    if (this.notifications.length > this.MAX_NOTIFICATIONS) {
      const removed = this.notifications.shift();
      if (removed) {
        this.clearTimeout(removed.id);
      }
    }

    // Notify listeners
    this.notifyCallbacks(notification);

    // Set auto-dismiss timeout if duration is specified
    if (notification.duration && notification.duration > 0) {
      this.setAutoDismiss(notification.id, notification.duration);
    }

    return notification.id;
  }

  /**
   * Update an existing notification
   */
  update(id: string, updates: Partial<Omit<Notification, 'id' | 'timestamp'>>): boolean {
    const index = this.notifications.findIndex(n => n.id === id);
    
    if (index === -1) {
      return false;
    }

    // Clear existing timeout
    this.clearTimeout(id);

    // Update notification
    this.notifications[index] = {
      ...this.notifications[index],
      ...updates
    };

    // Notify listeners
    this.notifyCallbacks(this.notifications[index]);

    // Set new auto-dismiss timeout if duration changed
    const duration = updates.duration ?? this.notifications[index].duration;
    if (duration && duration > 0) {
      this.setAutoDismiss(id, duration);
    }

    return true;
  }

  /**
   * Dismiss a notification
   */
  dismiss(id: string): boolean {
    const index = this.notifications.findIndex(n => n.id === id);
    
    if (index === -1) {
      return false;
    }

    // Clear timeout
    this.clearTimeout(id);

    // Remove notification
    this.notifications.splice(index, 1);

    // Notify listeners about dismissal
    this.notifyCallbacks(null as any); // Signal to refresh

    return true;
  }

  /**
   * Dismiss all notifications
   */
  dismissAll(): void {
    // Clear all timeouts
    this.timeouts.forEach((_, id) => this.clearTimeout(id));

    // Clear notifications
    this.notifications = [];

    // Notify listeners
    this.notifyCallbacks(null as any); // Signal to refresh
  }

  /**
   * Get all active notifications
   */
  getNotifications(): Notification[] {
    return [...this.notifications];
  }

  /**
   * Get a specific notification by ID
   */
  getNotification(id: string): Notification | null {
    return this.notifications.find(n => n.id === id) || null;
  }

  /**
   * Subscribe to notification changes
   */
  subscribe(callback: NotificationCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Show a progress notification that can be updated
   */
  progress(title: string, message?: string): {
    id: string;
    update: (progress: number, message?: string) => void;
    complete: (message?: string) => void;
    error: (message?: string) => void;
  } {
    const id = this.loading(title, message);

    return {
      id,
      update: (progress: number, msg?: string) => {
        this.update(id, {
          message: msg || `${Math.round(progress * 100)}% complete`
        });
      },
      complete: (msg?: string) => {
        this.update(id, {
          type: 'success',
          message: msg || 'Complete',
          duration: this.DEFAULT_DURATION,
          dismissible: true
        });
      },
      error: (msg?: string) => {
        this.update(id, {
          type: 'error',
          message: msg || 'Failed',
          duration: 0,
          dismissible: true
        });
      }
    };
  }

  /**
   * Show a notification with a confirmation action
   */
  confirm(
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ): string {
    return this.show({
      type: 'warning',
      title,
      message,
      duration: 0,
      dismissible: true,
      action: {
        label: 'Confirm',
        callback: () => {
          onConfirm();
          // Dismiss after action
          setTimeout(() => this.dismiss(this.notifications[this.notifications.length - 1]?.id), 100);
        }
      }
    });
  }

  /**
   * Set auto-dismiss timeout for a notification
   */
  private setAutoDismiss(id: string, duration: number): void {
    const timeoutId = window.setTimeout(() => {
      this.dismiss(id);
    }, duration);

    this.timeouts.set(id, timeoutId);
  }

  /**
   * Clear timeout for a notification
   */
  private clearTimeout(id: string): void {
    const timeoutId = this.timeouts.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      this.timeouts.delete(id);
    }
  }

  /**
   * Notify all callbacks
   */
  private notifyCallbacks(notification: Notification): void {
    this.callbacks.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        console.error('Error in notification callback:', error);
      }
    });
  }

  /**
   * Generate unique notification ID
   */
  private generateId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create and export singleton instance
export const notificationService = new NotificationService();
