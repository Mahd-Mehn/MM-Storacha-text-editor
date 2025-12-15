<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import type { SharePermission, DatabaseManifest } from '$lib/types/database';
  import type { Page } from '$lib/types/pages';
  import { shareService } from '$lib/services/share-service';
  import { databaseService } from '$lib/services/database-service';
  import { pageManager } from '$lib/services/page-manager';
  import { blockManager } from '$lib/services/block-manager';
  import { Database } from '$lib/components/database';
  import SharedPageContent from '$lib/components/SharedPageContent.svelte';

  // Get token from route params
  let token = $derived($page.params.token ?? '');
  
  // State
  let loading = $state(true);
  let error = $state<string | null>(null);
  let requiresPassword = $state(false);
  let password = $state('');
  let validating = $state(false);
  let resourceType = $state<'database' | 'page' | null>(null);
  let resourceId = $state<string | null>(null);
  let permission = $state<SharePermission | null>(null);
  let manifest = $state<DatabaseManifest | null>(null);
  let sharedPage = $state<Page | null>(null);
  let issuerDid = $state<string | null>(null);

  async function validateToken(pwd?: string) {
    validating = true;
    error = null;

    try {
      await shareService.initialize();
      const result = await shareService.validateShareToken(token, pwd);

      if (!result.valid) {
        if (result.error === 'Password required') {
          requiresPassword = true;
        } else {
          error = result.error || 'Invalid share link';
        }
        return;
      }

      resourceType = result.resourceType ?? 'database';
      resourceId = result.resourceId ?? result.databaseId!;
      permission = result.permission!;
      issuerDid = result.issuerDid ?? null;

      console.log(`Validated share token: type=${resourceType}, id=${resourceId}, cid=${result.cid}`);

      if (resourceType === 'page') {
        // Load page from Storacha - works without authentication via public gateway
        console.log('Loading shared page from CID:', result.cid);
        
        if (result.cid) {
          // Initialize managers (doesn't require auth for loading)
          await pageManager.initialize();
          await blockManager.initialize();
          
          const loaded = await pageManager.loadFromStoracha(result.cid);
          if (loaded) {
            sharedPage = loaded;
            console.log('Successfully loaded shared page:', loaded.title);
            console.log('Loaded blocks:', blockManager.getPageBlocks(loaded.id).length);
          } else {
            error = 'Failed to load shared page. The content may still be propagating across the network. Please try again in a few moments.';
          }
        } else {
          error = 'No content identifier found for this share link';
        }
      } else {
        // Load database
        await databaseService.initialize();
        if (result.cid) {
          const loaded = await databaseService.loadFromStoracha(result.cid);
          manifest = loaded;
          if (loaded) {
            resourceId = loaded.schema.id;
          }
        } else {
          manifest = await databaseService.getDatabase(resourceId!);
        }

        if (!manifest) {
          error = 'Database not found';
        }
      }
    } catch (err) {
      console.error('Failed to validate share token:', err);
      error = 'Failed to access shared content';
    } finally {
      loading = false;
      validating = false;
    }
  }

  function handlePasswordSubmit() {
    if (!password.trim()) return;
    validateToken(password);
  }

  function getPermissionLabel(perm: SharePermission): string {
    switch (perm) {
      case 'view': return 'View only';
      case 'comment': return 'Can comment';
      case 'edit': return 'Can edit';
      case 'admin': return 'Full access';
      default: return perm;
    }
  }

  onMount(() => {
    validateToken();
  });
</script>

<svelte:head>
  <title>{sharedPage?.title || manifest?.schema.name || 'Shared Content'} | Storacha Notes</title>
</svelte:head>

<div class="shared-page">
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading shared content...</p>
    </div>
  {:else if requiresPassword}
    <div class="password-state">
      <div class="password-card">
        <div class="lock-icon">🔒</div>
        <h2>Password Protected</h2>
        <p>This shared content is password protected. Enter the password to continue.</p>
        
        {#if error}
          <div class="error-message">{error}</div>
        {/if}

        <form onsubmit={(e) => { e.preventDefault(); handlePasswordSubmit(); }}>
          <input
            type="password"
            bind:value={password}
            placeholder="Enter password"
            autofocus
          />
          <button type="submit" disabled={validating || !password.trim()}>
            {validating ? 'Verifying...' : 'Access Content'}
          </button>
        </form>
      </div>
    </div>
  {:else if error}
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <h2>Unable to Load Content</h2>
      <p>{error}</p>
      <div class="error-actions">
        <button class="btn-primary" onclick={() => validateToken()}>
          Try Again
        </button>
        <a href="/" class="btn-secondary">Go to Home</a>
      </div>
      <p class="error-hint">
        Tip: Content on the decentralized network may take a few moments to propagate.
        If this persists, the share link may be invalid or the content may have been removed.
      </p>
    </div>
  {:else if resourceType === 'page' && sharedPage}
    <div class="shared-header">
      <div class="header-content">
        <span class="shared-badge">
          🔗 Shared with you
        </span>
        <span class="permission-badge">
          {getPermissionLabel(permission!)}
        </span>
        {#if issuerDid}
          <span class="issuer-badge" title="Shared by {issuerDid}">
            👤 {issuerDid.slice(0, 16)}...
          </span>
        {/if}
      </div>
    </div>
    <div class="page-wrapper">
      <div class="page-header">
        {#if sharedPage.icon?.value}
          <span class="page-icon">{sharedPage.icon.value}</span>
        {/if}
        <h1 class="page-title">{sharedPage.title}</h1>
      </div>
      <SharedPageContent pageId={sharedPage.id} />
    </div>
  {:else if resourceType === 'database' && manifest}
    <div class="shared-header">
      <div class="header-content">
        <span class="shared-badge">
          🔗 Shared with you
        </span>
        <span class="permission-badge">
          {getPermissionLabel(permission!)}
        </span>
        {#if issuerDid}
          <span class="issuer-badge" title="Shared by {issuerDid}">
            👤 {issuerDid.slice(0, 16)}...
          </span>
        {/if}
      </div>
    </div>
    <div class="database-wrapper">
      <Database 
        databaseId={resourceId!}
        readonly={permission === 'view'}
      />
    </div>
  {/if}
</div>

<style>
  .shared-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary, #ffffff);
  }

  .loading-state,
  .error-state,
  .password-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    text-align: center;
    padding: 2rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color, #e5e7eb);
    border-top-color: var(--accent-color, #3b82f6);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-state p {
    color: var(--text-tertiary, #9ca3af);
  }

  .password-card {
    max-width: 400px;
    padding: 2rem;
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 1rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  }

  .lock-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .password-card h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    margin: 0 0 0.5rem 0;
  }

  .password-card p {
    color: var(--text-tertiary, #9ca3af);
    margin: 0 0 1.5rem 0;
    font-size: 0.9375rem;
  }

  .error-message {
    padding: 0.75rem;
    background: var(--error-light, #fef2f2);
    color: var(--error-color, #ef4444);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .password-card form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .password-card input {
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.5rem;
    font-size: 1rem;
    text-align: center;
  }

  .password-card input:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
    box-shadow: 0 0 0 3px var(--accent-light, #e0f2fe);
  }

  .password-card button {
    padding: 0.75rem 1rem;
    background: var(--accent-color, #3b82f6);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }

  .password-card button:hover {
    background: var(--accent-hover, #2563eb);
  }

  .password-card button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .error-state h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    margin: 0 0 0.5rem 0;
  }

  .error-state p {
    color: var(--text-tertiary, #9ca3af);
    margin: 0 0 1.5rem 0;
  }

  .error-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .error-hint {
    font-size: 0.8125rem;
    color: var(--text-tertiary, #9ca3af);
    max-width: 400px;
    line-height: 1.5;
  }

  .btn-primary {
    padding: 0.75rem 1.5rem;
    background: var(--accent-color, #3b82f6);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.15s;
  }

  .btn-primary:hover {
    background: var(--accent-hover, #2563eb);
  }

  .btn-secondary {
    padding: 0.75rem 1.5rem;
    background: var(--bg-secondary, #f3f4f6);
    color: var(--text-primary, #1a1a1a);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.15s;
  }

  .btn-secondary:hover {
    background: var(--bg-tertiary, #e5e7eb);
  }

  .shared-header {
    padding: 0.75rem 1.5rem;
    background: var(--accent-light, #eff6ff);
    border-bottom: 1px solid var(--accent-color, #3b82f6);
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .shared-badge {
    font-size: 0.8125rem;
    color: var(--accent-color, #3b82f6);
    font-weight: 500;
  }

  .permission-badge {
    padding: 0.25rem 0.5rem;
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--accent-color, #3b82f6);
    border-radius: 0.25rem;
    font-size: 0.6875rem;
    color: var(--accent-color, #3b82f6);
    font-weight: 500;
  }

  .database-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .page-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    width: 100%;
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .page-icon {
    font-size: 2rem;
  }

  .page-title {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary, #111827);
    margin: 0;
  }

  .issuer-badge {
    padding: 0.25rem 0.5rem;
    background: var(--bg-secondary, #f3f4f6);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.25rem;
    font-size: 0.6875rem;
    color: var(--text-tertiary, #6b7280);
    font-weight: 500;
    font-family: monospace;
  }
</style>
