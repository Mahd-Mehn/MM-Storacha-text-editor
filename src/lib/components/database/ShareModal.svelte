<script lang="ts">
  import { onMount } from 'svelte';
  import type { PublicShareLink, SharePermission } from '$lib/types/database';
  import { shareService } from '$lib/services/share-service';

  // Props
  export let databaseId: string;
  export let databaseName: string;
  export let onClose: () => void;

  // State
  let shareLinks = $state<PublicShareLink[]>([]);
  let loading = $state(true);
  let creating = $state(false);
  let newLinkPermission = $state<SharePermission>('view');
  let newLinkPassword = $state('');
  let newLinkExpiry = $state('');
  let showNewLinkForm = $state(false);
  let copiedLinkId = $state<string | null>(null);

  async function loadShareLinks() {
    loading = true;
    try {
      await shareService.initialize();
      shareLinks = await shareService.getShareLinks(databaseId);
    } catch (error) {
      console.error('Failed to load share links:', error);
    } finally {
      loading = false;
    }
  }

  async function createShareLink() {
    creating = true;
    try {
      const link = await shareService.createPublicLink(databaseId, newLinkPermission, {
        password: newLinkPassword || undefined,
        expiresAt: newLinkExpiry ? new Date(newLinkExpiry).toISOString() : undefined
      });
      shareLinks = [...shareLinks, link];
      showNewLinkForm = false;
      newLinkPassword = '';
      newLinkExpiry = '';
    } catch (error) {
      console.error('Failed to create share link:', error);
    } finally {
      creating = false;
    }
  }

  async function revokeLink(linkId: string) {
    try {
      await shareService.revokeShareLink(linkId);
      shareLinks = shareLinks.filter(l => l.id !== linkId);
    } catch (error) {
      console.error('Failed to revoke link:', error);
    }
  }

  async function copyLink(link: PublicShareLink) {
    try {
      await navigator.clipboard.writeText(link.url);
      copiedLinkId = link.id;
      setTimeout(() => {
        copiedLinkId = null;
      }, 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  }

  function getPermissionLabel(permission: SharePermission): string {
    switch (permission) {
      case 'view': return 'Can view';
      case 'comment': return 'Can comment';
      case 'edit': return 'Can edit';
      case 'admin': return 'Full access';
      default: return permission;
    }
  }

  function formatDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }

  onMount(() => {
    loadShareLinks();
  });
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="modal-backdrop" onclick={onClose}>
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <div class="header-content">
        <h2>Share "{databaseName}"</h2>
        <p class="subtitle">Create shareable links for others to access this database</p>
      </div>
      <button class="close-btn" onclick={onClose}>×</button>
    </div>

    <div class="modal-body">
      {#if loading}
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading share links...</p>
        </div>
      {:else}
        <!-- Existing Links -->
        {#if shareLinks.length > 0}
          <div class="links-section">
            <h3>Active Links</h3>
            <div class="links-list">
              {#each shareLinks as link (link.id)}
                <div class="link-item">
                  <div class="link-info">
                    <div class="link-url">
                      <span class="url-text">{link.url}</span>
                      <button 
                        class="copy-btn"
                        onclick={() => copyLink(link)}
                      >
                        {copiedLinkId === link.id ? '✓ Copied' : '📋 Copy'}
                      </button>
                    </div>
                    <div class="link-meta">
                      <span class="permission-badge">{getPermissionLabel(link.permission)}</span>
                      {#if link.password}
                        <span class="meta-tag">🔒 Password protected</span>
                      {/if}
                      {#if link.expiresAt}
                        <span class="meta-tag">⏰ Expires {formatDate(link.expiresAt)}</span>
                      {/if}
                      <span class="meta-tag">👁 {link.viewCount} views</span>
                    </div>
                  </div>
                  <button 
                    class="revoke-btn"
                    onclick={() => revokeLink(link.id)}
                    title="Revoke link"
                  >
                    🗑
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Create New Link -->
        {#if showNewLinkForm}
          <div class="new-link-form">
            <h3>Create New Link</h3>
            
            <div class="form-group">
              <label>Permission Level</label>
              <div class="permission-options">
                {#each ['view', 'comment', 'edit'] as perm}
                  <button
                    class="permission-option"
                    class:selected={newLinkPermission === perm}
                    onclick={() => newLinkPermission = perm as SharePermission}
                  >
                    <span class="perm-icon">
                      {perm === 'view' ? '👁' : perm === 'comment' ? '💬' : '✏️'}
                    </span>
                    <span class="perm-label">{getPermissionLabel(perm as SharePermission)}</span>
                  </button>
                {/each}
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="link-password">Password (optional)</label>
                <input
                  id="link-password"
                  type="password"
                  bind:value={newLinkPassword}
                  placeholder="Enter password"
                />
              </div>

              <div class="form-group">
                <label for="link-expiry">Expires (optional)</label>
                <input
                  id="link-expiry"
                  type="date"
                  bind:value={newLinkExpiry}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div class="form-actions">
              <button 
                class="btn-secondary"
                onclick={() => showNewLinkForm = false}
              >
                Cancel
              </button>
              <button 
                class="btn-primary"
                onclick={createShareLink}
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create Link'}
              </button>
            </div>
          </div>
        {:else}
          <button 
            class="create-link-btn"
            onclick={() => showNewLinkForm = true}
          >
            <span class="icon">+</span>
            <span>Create new share link</span>
          </button>
        {/if}

        <!-- Info -->
        <div class="share-info">
          <h4>About sharing</h4>
          <ul>
            <li><strong>View</strong> - Recipients can only view the database</li>
            <li><strong>Comment</strong> - Recipients can view and add comments</li>
            <li><strong>Edit</strong> - Recipients can view, comment, and edit entries</li>
          </ul>
          <p class="note">
            Links are stored on Storacha and can be accessed by anyone with the URL.
            Use password protection for sensitive data.
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal {
    width: 100%;
    max-width: 560px;
    background: var(--bg-primary, #ffffff);
    border-radius: 0.75rem;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    animation: slideIn 0.2s ease-out;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  @keyframes slideIn {
    from { 
      opacity: 0;
      transform: translateY(-20px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .header-content h2 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    margin: 0 0 0.25rem 0;
  }

  .subtitle {
    font-size: 0.8125rem;
    color: var(--text-tertiary, #9ca3af);
    margin: 0;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 0.375rem;
    color: var(--text-tertiary, #9ca3af);
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: var(--bg-hover, #f3f4f6);
    color: var(--text-primary, #111827);
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
    color: var(--text-tertiary, #9ca3af);
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color, #e5e7eb);
    border-top-color: var(--accent-color, #3b82f6);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 0.75rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .links-section {
    margin-bottom: 1.5rem;
  }

  .links-section h3 {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-secondary, #6b7280);
    margin: 0 0 0.75rem 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .links-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .link-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--bg-secondary, #f9fafb);
    border-radius: 0.5rem;
  }

  .link-info {
    flex: 1;
    min-width: 0;
  }

  .link-url {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .url-text {
    font-size: 0.8125rem;
    color: var(--text-primary, #111827);
    font-family: monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .copy-btn {
    padding: 0.25rem 0.5rem;
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.6875rem;
    color: var(--text-secondary, #6b7280);
    white-space: nowrap;
  }

  .copy-btn:hover {
    background: var(--bg-hover, #f3f4f6);
  }

  .link-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .permission-badge {
    padding: 0.125rem 0.375rem;
    background: var(--accent-light, #e0f2fe);
    color: var(--accent-color, #3b82f6);
    border-radius: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 500;
  }

  .meta-tag {
    font-size: 0.6875rem;
    color: var(--text-tertiary, #9ca3af);
  }

  .revoke-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    opacity: 0.5;
    transition: all 0.15s;
  }

  .revoke-btn:hover {
    background: var(--error-light, #fef2f2);
    opacity: 1;
  }

  .create-link-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--bg-secondary, #f9fafb);
    border: 2px dashed var(--border-color, #e5e7eb);
    border-radius: 0.5rem;
    cursor: pointer;
    color: var(--text-secondary, #6b7280);
    font-size: 0.875rem;
    transition: all 0.15s;
    margin-bottom: 1.5rem;
  }

  .create-link-btn:hover {
    background: var(--bg-hover, #f3f4f6);
    border-color: var(--accent-color, #3b82f6);
    color: var(--accent-color, #3b82f6);
  }

  .create-link-btn .icon {
    font-size: 1.125rem;
    font-weight: 300;
  }

  .new-link-form {
    background: var(--bg-secondary, #f9fafb);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .new-link-form h3 {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    margin: 0 0 1rem 0;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary, #6b7280);
    margin-bottom: 0.375rem;
  }

  .form-group input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    background: var(--bg-primary, #ffffff);
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .permission-options {
    display: flex;
    gap: 0.5rem;
  }

  .permission-option {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.625rem;
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .permission-option:hover {
    border-color: var(--border-hover, #d1d5db);
  }

  .permission-option.selected {
    background: var(--accent-light, #e0f2fe);
    border-color: var(--accent-color, #3b82f6);
  }

  .perm-icon {
    font-size: 1rem;
  }

  .perm-label {
    font-size: 0.6875rem;
    color: var(--text-secondary, #6b7280);
  }

  .permission-option.selected .perm-label {
    color: var(--accent-color, #3b82f6);
    font-weight: 500;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .btn-secondary,
  .btn-primary {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--border-color, #e5e7eb);
    color: var(--text-secondary, #6b7280);
  }

  .btn-secondary:hover {
    background: var(--bg-hover, #f3f4f6);
  }

  .btn-primary {
    background: var(--accent-color, #3b82f6);
    border: none;
    color: white;
  }

  .btn-primary:hover {
    background: var(--accent-hover, #2563eb);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .share-info {
    background: var(--bg-secondary, #f9fafb);
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .share-info h4 {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    margin: 0 0 0.5rem 0;
  }

  .share-info ul {
    margin: 0 0 0.75rem 0;
    padding-left: 1.25rem;
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
  }

  .share-info li {
    margin-bottom: 0.25rem;
  }

  .share-info .note {
    font-size: 0.6875rem;
    color: var(--text-tertiary, #9ca3af);
    margin: 0;
    font-style: italic;
  }
</style>
