<script lang="ts">
  import { onMount } from "svelte";
  import favicon from "$lib/assets/favicon.svg";
  import ToastNotification from "$lib/components/ToastNotification.svelte";
  import ConnectionStatusIndicator from "$lib/components/ConnectionStatusIndicator.svelte";
  import SyncStatusIndicator from "$lib/components/SyncStatusIndicator.svelte";
  import EmailLoginDialog from "$lib/components/EmailLoginDialog.svelte";
  import Sidebar from "$lib/components/sidebar/Sidebar.svelte";
  import {
    authService,
    spaceService,
    storachaClient,
    offlineDetectionService,
    offlineSyncManager,
  } from "$lib/services";
  import { errorHandler } from "$lib/services/error-handler";
  import { notificationService } from "$lib/services/notification";

  let { children } = $props();

  let isInitializing = $state(true);
  let initializationError = $state<string | null>(null);
  let isFirstTimeUser = $state(false);
  let showEmailLogin = $state(false);
  let needsEmailLogin = $state(false);

  onMount(async () => {
    await initializeApplication();
  });

  async function initializeApplication() {
    try {
      isInitializing = true;
      initializationError = null;

      // Show loading notification
      const loadingNotif = notificationService.loading(
        "Initializing application",
        "Setting up your secure environment..."
      );

      // Initialize offline detection first
      offlineDetectionService.initialize();

      // Initialize authentication and identity
      await errorHandler.withRetry(
        async () => {
          await authService.initialize();
        },
        {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
        },
        { operation: "auth_initialization" }
      );

      // Check if this is first time user
      const authState = authService.getAuthState();
      isFirstTimeUser = !authState.isAuthenticated;

      // Check if user needs to login with email for cloud storage
      const accountStatus = await authService.checkAccountStatus();
      needsEmailLogin = !accountStatus.hasAccount;

      // Initialize space management
      if (authState.isAuthenticated) {
        await errorHandler.withRetry(
          async () => {
            await spaceService.initialize();
          },
          {
            maxRetries: 2,
            baseDelay: 1000,
            maxDelay: 3000,
            backoffMultiplier: 2,
          },
          { operation: "space_initialization" }
        );

        // Initialize Storacha client if online
        if (offlineDetectionService.isOnline()) {
          try {
            await storachaClient.initialize();
          } catch (error) {
            console.warn(
              "Storacha client initialization failed, will work in offline mode:",
              error
            );
          }
        }

        // Initialize offline sync manager
        await offlineSyncManager.initialize();
      }

      // Setup error handler recovery strategies
      setupErrorRecovery();

      // Dismiss loading notification and show success
      notificationService.dismiss(loadingNotif);
      notificationService.success(
        "Ready to go!",
        "Your notes are secure and ready to use"
      );

      // Show onboarding message for first-time users
      if (isFirstTimeUser) {
        setTimeout(() => {
          notificationService.info(
            "Welcome to Storacha Notes!",
            "Your identity has been created automatically. All your notes are encrypted and stored securely.",
            8000
          );
        }, 1000);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown initialization error";
      initializationError = errorMessage;

      notificationService.error("Initialization Failed", errorMessage, {
        label: "Retry",
        callback: () => {
          window.location.reload();
        },
      });

      console.error("Application initialization failed:", error);
    } finally {
      isInitializing = false;
    }
  }

  function setupErrorRecovery() {
    // Network error recovery
    errorHandler.registerRecoveryHandler("network", async (error) => {
      // Wait for connection to be restored
      if (offlineDetectionService.isOnline()) {
        notificationService.info(
          "Connection restored",
          "Syncing pending changes..."
        );
        await offlineSyncManager.processQueue();
        return true;
      }
      return false;
    });

    // Storage error recovery
    errorHandler.registerRecoveryHandler("storage", async (error) => {
      // Attempt to clear space and retry
      if (error.message.includes("quota")) {
        notificationService.warning(
          "Storage quota exceeded",
          "Please free up some space or delete old notes"
        );
      }
      return false;
    });

    // Listen to all errors and show notifications
    errorHandler.onError((error) => {
      if (error.severity === "critical" || error.severity === "high") {
        notificationService.error(
          error.message,
          error.context ? JSON.stringify(error.context) : undefined
        );
      } else if (error.severity === "medium") {
        notificationService.warning(error.message);
      }
    });
  }
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>Storacha Notes - Privacy-First Note Taking</title>
  <meta
    name="description"
    content="Privacy-first, offline-capable note-taking with decentralized storage"
  />
</svelte:head>

{#if isInitializing}
  <div class="initialization-screen">
    <div class="init-content">
      <div class="spinner"></div>
      <h1>Storacha Notes</h1>
      <p>Setting up your secure environment...</p>
    </div>
  </div>
{:else if initializationError}
  <div class="error-screen">
    <div class="error-content">
      <div class="error-icon">⚠</div>
      <h1>Initialization Failed</h1>
      <p class="error-message">{initializationError}</p>
      <button onclick={() => window.location.reload()} class="retry-button">
        Retry
      </button>
    </div>
  </div>
{:else}
  <div class="app-container">
    <Sidebar />
    <div class="main-content-wrapper">
      <!-- Email login banner -->
      {#if needsEmailLogin && !showEmailLogin}
        <div class="email-banner">
          <div class="banner-content">
            <span class="banner-icon">📧</span>
            <div class="banner-text">
              <strong>Enable Cloud Storage</strong>
              <p>Login with email to upload and share notes via Storacha</p>
            </div>
          </div>
          <button class="banner-button" onclick={() => (showEmailLogin = true)}>
            Get Started
          </button>
        </div>
      {/if}

      <!-- Status indicators -->
      <div class="status-bar">
        <ConnectionStatusIndicator />
        <SyncStatusIndicator />
      </div>

      <!-- Main content -->
      <main class="app-main">
        {@render children?.()}
      </main>

      <!-- Toast notifications -->
      <ToastNotification />

      <!-- Email login dialog -->
      {#if showEmailLogin}
        <EmailLoginDialog
          onClose={() => (showEmailLogin = false)}
          onSuccess={() => {
            needsEmailLogin = false;
            showEmailLogin = false;
            notificationService.success(
              "Cloud storage enabled!",
              "You can now upload and share notes"
            );
          }}
        />
      {/if}
    </div>
  </div>
{/if}

<style>
  :global(:root) {
    /* Light theme (default) */
    --bg-primary: #ffffff;
    --bg-secondary: #f7f7f7;
    --bg-tertiary: #f3f4f6;
    --bg-hover: rgba(0, 0, 0, 0.05);
    --bg-active: rgba(0, 255, 67, 0.1);
    --bg-card: #ffffff;
    --bg-input: #ffffff;

    --text-primary: #1a1a1a;
    --text-secondary: #6b7280;
    --text-tertiary: #9ca3af;

    --border-color: #e5e7eb;
    --border-input: #d1d5db;
    --border-input-focus: #00ff43;

    --accent-color: #00ff43;
    --accent-hover: #00dd3a;
    --accent-glow: rgba(0, 255, 67, 0.3);

    --gray-dark: #484c51;
    --gray-light: #c2c4c8;

    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
    --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.1);
    --shadow-glow: 0 0 20px rgba(0, 255, 67, 0.2);
  }

  :global([data-theme="dark"]) {
    /* Dark theme */
    --bg-primary: #1e1e1e;
    --bg-secondary: #2a2a2a;
    --bg-tertiary: #333333;
    --bg-hover: rgba(255, 255, 255, 0.08);
    --bg-active: rgba(0, 255, 67, 0.15);
    --bg-card: #252525;
    --bg-input: #2a2a2a;

    --text-primary: #f9fafb;
    --text-secondary: #c2c4c8;
    --text-tertiary: #9ca3af;

    --border-color: #3d3d3d;
    --border-input: #484c51;
    --border-input-focus: #00ff43;

    --accent-color: #00ff43;
    --accent-hover: #00dd3a;
    --accent-glow: rgba(0, 255, 67, 0.4);

    --gray-dark: #484c51;
    --gray-light: #c2c4c8;

    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
    --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.5);
    --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.7);
    --shadow-glow: 0 0 25px rgba(0, 255, 67, 0.3);
  }

  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
      Ubuntu, Cantarell, sans-serif;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    transition:
      background-color 0.2s,
      color 0.2s;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .initialization-screen,
  .error-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .init-content,
  .error-content {
    text-align: center;
    color: white;
    padding: 2rem;
  }

  .spinner {
    width: 3rem;
    height: 3rem;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 2rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .init-content h1,
  .error-content h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    font-weight: 700;
  }

  .init-content p {
    font-size: 1.125rem;
    opacity: 0.9;
  }

  .error-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .error-message {
    font-size: 1rem;
    opacity: 0.9;
    margin-bottom: 2rem;
    max-width: 500px;
  }

  .retry-button {
    padding: 0.75rem 2rem;
    background: var(--bg-primary);
    color: var(--accent-color);
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .retry-button:hover {
    transform: scale(1.05);
  }

  .app-container {
    display: flex;
    flex-direction: row;
    min-height: 100vh;
    overflow: hidden;
  }

  .main-content-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    margin-left: 260px;
    transition: margin-left 0.3s ease;
    position: relative;
  }

  @media (max-width: 768px) {
    .main-content-wrapper {
      margin-left: 0;
    }
  }

  :global(body.sidebar-collapsed) .main-content-wrapper {
    margin-left: 70px;
  }

  @media (max-width: 768px) {
    :global(body.sidebar-collapsed) .main-content-wrapper {
      margin-left: 0;
    }
  }

  .email-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.875rem 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    gap: 1rem;
    position: relative;
    z-index: 50;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  }

  .banner-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
  }

  .banner-icon {
    font-size: 2rem;
  }

  .banner-text strong {
    display: block;
    font-size: 1rem;
    margin-bottom: 0.25rem;
  }

  .banner-text p {
    margin: 0;
    font-size: 0.875rem;
    opacity: 0.9;
  }

  .banner-button {
    padding: 0.625rem 1.5rem;
    background: var(--bg-primary);
    color: var(--accent-color);
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .banner-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  }

  @media (max-width: 768px) {
    .email-banner {
      flex-direction: column;
      text-align: center;
    }

    .banner-content {
      flex-direction: column;
    }

    .banner-button {
      width: 100%;
    }
  }

  .status-bar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1.5rem;
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 50;
    min-height: 48px;
  }

  .app-main {
    flex: 1;
    overflow: auto;
  }
</style>
