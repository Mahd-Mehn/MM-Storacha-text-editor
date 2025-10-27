<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { notificationService } from '$lib/services/notification';
  import type { Notification } from '$lib/services/notification';

  let notifications = $state<Notification[]>([]);
  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    // Load initial notifications
    notifications = notificationService.getNotifications();

    // Subscribe to changes
    unsubscribe = notificationService.subscribe(() => {
      notifications = notificationService.getNotifications();
    });
  });

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });

  function handleDismiss(id: string) {
    notificationService.dismiss(id);
  }

  function handleAction(notification: Notification) {
    if (notification.action) {
      notification.action.callback();
    }
  }

  function getIcon(type: Notification['type']): string {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      case 'loading':
        return '⟳';
      default:
        return '';
    }
  }
</script>

<div class="toast-container">
  {#each notifications as notification (notification.id)}
    <div 
      class="toast toast-{notification.type}"
      class:dismissible={notification.dismissible}
    >
      <div class="toast-icon">
        <span class:spinning={notification.type === 'loading'}>
          {getIcon(notification.type)}
        </span>
      </div>

      <div class="toast-content">
        <div class="toast-title">{notification.title}</div>
        {#if notification.message}
          <div class="toast-message">{notification.message}</div>
        {/if}
        
        {#if notification.action}
          <button 
            class="toast-action"
            onclick={() => handleAction(notification)}
          >
            {notification.action.label}
          </button>
        {/if}
      </div>

      {#if notification.dismissible}
        <button 
          class="toast-dismiss"
          onclick={() => handleDismiss(notification.id)}
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 400px;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
                0 4px 6px -2px rgba(0, 0, 0, 0.05);
    border-left: 4px solid;
    pointer-events: auto;
    animation: slideIn 0.3s ease-out;
    min-width: 300px;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .toast-success {
    border-left-color: #10b981;
  }

  .toast-error {
    border-left-color: #ef4444;
  }

  .toast-warning {
    border-left-color: #f59e0b;
  }

  .toast-info {
    border-left-color: #3b82f6;
  }

  .toast-loading {
    border-left-color: #6366f1;
  }

  .toast-icon {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    font-weight: bold;
  }

  .toast-success .toast-icon {
    color: #10b981;
  }

  .toast-error .toast-icon {
    color: #ef4444;
  }

  .toast-warning .toast-icon {
    color: #f59e0b;
  }

  .toast-info .toast-icon {
    color: #3b82f6;
  }

  .toast-loading .toast-icon {
    color: #6366f1;
  }

  .spinning {
    display: inline-block;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .toast-content {
    flex: 1;
    min-width: 0;
  }

  .toast-title {
    font-weight: 600;
    font-size: 0.875rem;
    color: #111827;
    margin-bottom: 0.25rem;
  }

  .toast-message {
    font-size: 0.875rem;
    color: #6b7280;
    line-height: 1.4;
  }

  .toast-action {
    margin-top: 0.75rem;
    padding: 0.375rem 0.75rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .toast-action:hover {
    background: #2563eb;
  }

  .toast-dismiss {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    border-radius: 0.25rem;
    transition: all 0.2s;
    font-size: 1rem;
    line-height: 1;
  }

  .toast-dismiss:hover {
    background: #f3f4f6;
    color: #374151;
  }

  @media (max-width: 640px) {
    .toast-container {
      left: 1rem;
      right: 1rem;
      max-width: none;
    }

    .toast {
      min-width: 0;
    }
  }
</style>
