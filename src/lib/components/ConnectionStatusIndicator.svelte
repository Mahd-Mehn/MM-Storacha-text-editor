<!--
  Connection Status Indicator Component
  Displays the current network connectivity status to users
  Requirements: 3.4 - Display connection status to users
-->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    connectionStatus, 
    connectionStatusMessage, 
    isOnline, 
    isOffline, 
    isConnecting,
    initializeConnectivityStore,
    refreshConnectionStatus
  } from '../stores/connectivity.js';

  // Component props
  export let showText = true;
  export let showIcon = true;
  export let size: 'small' | 'medium' | 'large' = 'medium';
  export let position: 'inline' | 'fixed' = 'inline';

  let cleanupConnectivity: (() => void) | null = null;

  onMount(() => {
    // Initialize connectivity monitoring
    cleanupConnectivity = initializeConnectivityStore();
  });

  onDestroy(() => {
    if (cleanupConnectivity) {
      cleanupConnectivity();
    }
  });

  function handleRefreshClick() {
    refreshConnectionStatus();
  }

  // Reactive styles based on size
  $: sizeClass = `status-indicator--${size}`;
  $: positionClass = `status-indicator--${position}`;
</script>

<div 
  class="status-indicator {sizeClass} {positionClass}"
  class:online={$isOnline}
  class:offline={$isOffline}
  class:connecting={$isConnecting}
  role="status"
  aria-live="polite"
  aria-label="Connection status: {$connectionStatusMessage}"
>
  {#if showIcon}
    <div class="status-icon" aria-hidden="true">
      {#if $isOnline}
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      {:else if $isOffline}
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.64 7c-.45-.34-4.93-4-11.64-4-1.5 0-2.89.19-4.15.48L18.18 13.8 23.64 7zm-6.6 8.22L3.27 1.44 2 2.72l2.05 2.06C1.91 5.76.59 6.82.36 7l11.63 14.49.01.01.01-.01L16.67 16l1.42 1.42 1.91-1.92z"/>
        </svg>
      {:else if $isConnecting}
        <svg viewBox="0 0 24 24" fill="currentColor" class="spinning">
          <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
      {/if}
    </div>
  {/if}

  {#if showText}
    <span class="status-text">
      {$connectionStatusMessage}
    </span>
  {/if}

  {#if $isOffline || $connectionStatus === 'unknown'}
    <button 
      class="refresh-button" 
      on:click={handleRefreshClick}
      aria-label="Refresh connection status"
      title="Check connection"
    >
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
      </svg>
    </button>
  {/if}
</div>

<style>
  .status-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s ease-in-out;
  }

  .status-indicator--small {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    gap: 0.25rem;
  }

  .status-indicator--medium {
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
    gap: 0.5rem;
  }

  .status-indicator--large {
    font-size: 1rem;
    padding: 0.375rem 0.75rem;
    gap: 0.75rem;
  }

  .status-indicator--fixed {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1000;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .status-indicator.online {
    background-color: #dcfce7;
    color: #166534;
    border: 1px solid #bbf7d0;
  }

  .status-indicator.offline {
    background-color: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  .status-indicator.connecting {
    background-color: #fef3c7;
    color: #92400e;
    border: 1px solid #fde68a;
  }

  .status-indicator:not(.online):not(.offline):not(.connecting) {
    background-color: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .status-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .status-icon svg {
    width: 1em;
    height: 1em;
  }

  .status-indicator--small .status-icon svg {
    width: 0.875em;
    height: 0.875em;
  }

  .status-indicator--large .status-icon svg {
    width: 1.125em;
    height: 1.125em;
  }

  .spinning {
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

  .refresh-button {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 0.125rem;
    border-radius: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s ease-in-out;
  }

  .refresh-button:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }

  .refresh-button:focus {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  .refresh-button svg {
    width: 1em;
    height: 1em;
  }

  .status-text {
    white-space: nowrap;
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .status-indicator--fixed {
      background: rgba(0, 0, 0, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .status-indicator.online {
      background-color: #064e3b;
      color: #a7f3d0;
      border: 1px solid #065f46;
    }

    .status-indicator.offline {
      background-color: #7f1d1d;
      color: #fca5a5;
      border: 1px solid #991b1b;
    }

    .status-indicator.connecting {
      background-color: #78350f;
      color: #fcd34d;
      border: 1px solid #92400e;
    }

    .status-indicator:not(.online):not(.offline):not(.connecting) {
      background-color: #374151;
      color: #f3f4f6;
      border: 1px solid #4b5563;
    }

    .refresh-button:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }
</style>