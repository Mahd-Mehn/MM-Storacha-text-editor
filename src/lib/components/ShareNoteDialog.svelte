<script lang="ts">
  import { storachaClient } from '$lib/services';
  import { notificationService } from '$lib/services/notification';
  import type { Note } from '$lib/types';

  interface Props {
    note: Note;
    onClose?: () => void;
  }

  let { note, onClose }: Props = $props();

  let isUploading = $state(false);
  let uploadError = $state<string | null>(null);
  let shareableLink = $state<string | null>(null);
  let verificationStatus = $state<'checking' | 'verified' | 'failed' | null>(null);

  // Check if note is already uploaded
  $effect(() => {
    if (note.metadata.storachaCID) {
      shareableLink = `https://storacha.link/ipfs/${note.metadata.storachaCID}`;
    }
  });

  async function uploadToStoracha() {
    isUploading = true;
    uploadError = null;

    try {
      // Check if client is ready
      if (!storachaClient.isReady()) {
        throw new Error('Storacha client not initialized. Please ensure you are online.');
      }

      // Serialize note data
      const yjsUpdate = new Uint8Array(); // You'd get this from the actual Yjs document
      const noteData = {
        noteId: note.id,
        yjsUpdate,
        metadata: note.metadata,
        versionHistory: []
      };

      // Upload to Storacha
      const cid = await storachaClient.uploadNoteData(noteData);
      
      // Update note metadata
      note.metadata.storachaCID = cid;
      
      // Generate shareable link
      shareableLink = `https://storacha.link/ipfs/${cid}`;
      
      // Verify upload
      await verifyUpload(cid);
      
      notificationService.success(
        'Note uploaded to Storacha!',
        'Your note is now accessible via IPFS'
      );
    } catch (error) {
      uploadError = error instanceof Error ? error.message : 'Upload failed';
      notificationService.error('Upload failed', uploadError);
    } finally {
      isUploading = false;
    }
  }

  async function verifyUpload(cid: string) {
    verificationStatus = 'checking';
    
    try {
      const response = await fetch(`https://storacha.link/ipfs/${cid}`, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        verificationStatus = 'verified';
      } else {
        verificationStatus = 'failed';
      }
    } catch (error) {
      verificationStatus = 'failed';
    }
  }

  function copyToClipboard() {
    if (shareableLink) {
      navigator.clipboard.writeText(shareableLink);
      notificationService.success('Link copied!', 'Share link copied to clipboard');
    }
  }

  function openInNewTab() {
    if (shareableLink) {
      window.open(shareableLink, '_blank');
    }
  }

  function copyShortCID() {
    if (note.metadata.storachaCID) {
      navigator.clipboard.writeText(note.metadata.storachaCID);
      notificationService.success('CID copied!', 'Content identifier copied to clipboard');
    }
  }
</script>

<div class="share-dialog-overlay" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()} role="dialog" aria-modal="true" aria-label="Share note dialog" tabindex="-1">
  <div class="share-dialog" role="document">
    <div class="dialog-header">
      <h2>Share Note</h2>
      <button class="close-button" onclick={onClose}>✕</button>
    </div>

    <div class="dialog-content">
      <div class="note-info">
        <h3>{note.title}</h3>
        <p class="note-meta">
          Last modified: {note.metadata.modified.toLocaleDateString()}
        </p>
      </div>

      {#if !note.metadata.storachaCID}
        <div class="upload-section">
          <div class="info-box">
            <span class="info-icon">ℹ️</span>
            <p>
              Upload your note to Storacha to make it accessible via IPFS.
              Once uploaded, you can share the link with anyone.
            </p>
          </div>

          <button 
            class="upload-button"
            onclick={uploadToStoracha}
            disabled={isUploading}
          >
            {#if isUploading}
              <span class="spinner-small"></span>
              Uploading to Storacha...
            {:else}
              📤 Upload to Storacha
            {/if}
          </button>

          {#if uploadError}
            <div class="error-box">
              <span class="error-icon">⚠️</span>
              <p>{uploadError}</p>
            </div>
          {/if}
        </div>
      {:else}
        <div class="share-section">
          <div class="success-box">
            <span class="success-icon">✅</span>
            <p>Your note is stored on Storacha and accessible via IPFS!</p>
          </div>

          <!-- CID Display -->
          <div class="cid-section">
            <span id="cid-label" class="section-label">Content Identifier (CID)</span>
            <div class="cid-display" aria-labelledby="cid-label">
              <code class="cid-text">{note.metadata.storachaCID}</code>
              <button class="copy-button" onclick={copyShortCID} title="Copy CID">
                📋
              </button>
            </div>
          </div>

          <!-- Shareable Link -->
          <div class="link-section">
            <label for="shareable-link">Shareable Link</label>
            <div class="link-display">
              <input 
                type="text" 
                readonly 
                value={shareableLink || ''} 
                class="link-input"
                id="shareable-link"
              />
              <button class="copy-button" onclick={copyToClipboard} title="Copy link">
                📋
              </button>
              <button class="open-button" onclick={openInNewTab} title="Open in new tab">
                🔗
              </button>
            </div>
          </div>

          <!-- Verification Status -->
          {#if verificationStatus}
            <div class="verification-status {verificationStatus}">
              {#if verificationStatus === 'checking'}
                <span class="spinner-small"></span>
                Verifying accessibility...
              {:else if verificationStatus === 'verified'}
                ✅ Verified: Content is accessible on IPFS
              {:else}
                ⚠️ Content may take a few moments to propagate
              {/if}
            </div>
          {/if}

          <!-- Alternative Gateways -->
          <div class="gateways-section">
            <span class="section-label">Alternative IPFS Gateways</span>
            <div class="gateway-links">
              <a 
                href="https://ipfs.io/ipfs/{note.metadata.storachaCID}" 
                target="_blank"
                class="gateway-link"
              >
                ipfs.io →
              </a>
              <a 
                href="https://dweb.link/ipfs/{note.metadata.storachaCID}" 
                target="_blank"
                class="gateway-link"
              >
                dweb.link →
              </a>
              <a 
                href="https://cloudflare-ipfs.com/ipfs/{note.metadata.storachaCID}" 
                target="_blank"
                class="gateway-link"
              >
                cloudflare-ipfs.com →
              </a>
            </div>
          </div>

          <!-- Share Actions -->
          <div class="share-actions">
            <button class="action-button primary" onclick={copyToClipboard}>
              📋 Copy Link
            </button>
            <button class="action-button secondary" onclick={openInNewTab}>
              🔗 Open in Browser
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .share-dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .share-dialog {
    background: white;
    border-radius: 1rem;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .dialog-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
  }

  .close-button {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 1.5rem;
    color: #6b7280;
    transition: all 0.2s;
  }

  .close-button:hover {
    background: #f3f4f6;
    color: #111827;
  }

  .dialog-content {
    padding: 1.5rem;
  }

  .note-info {
    margin-bottom: 1.5rem;
  }

  .note-info h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
  }

  .note-meta {
    margin: 0;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .info-box,
  .success-box,
  .error-box {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }

  .info-box {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
  }

  .success-box {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
  }

  .error-box {
    background: #fef2f2;
    border: 1px solid #fecaca;
  }

  .info-icon,
  .success-icon,
  .error-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .info-box p,
  .success-box p,
  .error-box p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .info-box p {
    color: #1e40af;
  }

  .success-box p {
    color: #166534;
  }

  .error-box p {
    color: #991b1b;
  }

  .upload-button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .upload-button:hover:not(:disabled) {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .upload-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .cid-section,
  .link-section {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  .cid-display,
  .link-display {
    display: flex;
    gap: 0.5rem;
  }

  .cid-text {
    flex: 1;
    padding: 0.75rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.75rem;
    color: #111827;
    overflow-x: auto;
    white-space: nowrap;
  }

  .link-input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: #111827;
  }

  .copy-button,
  .open-button {
    padding: 0.75rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 1.125rem;
    transition: all 0.2s;
  }

  .copy-button:hover,
  .open-button:hover {
    background: #f3f4f6;
    border-color: #3b82f6;
  }

  .verification-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }

  .verification-status.checking {
    background: #fef3c7;
    color: #92400e;
  }

  .verification-status.verified {
    background: #dcfce7;
    color: #166534;
  }

  .verification-status.failed {
    background: #fee2e2;
    color: #991b1b;
  }

  .gateways-section {
    margin-bottom: 1.5rem;
  }

  .gateway-links {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .gateway-link {
    padding: 0.75rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    color: #3b82f6;
    text-decoration: none;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .gateway-link:hover {
    background: #eff6ff;
    border-color: #3b82f6;
  }

  .share-actions {
    display: flex;
    gap: 0.75rem;
  }

  .action-button {
    flex: 1;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-button.primary {
    background: #3b82f6;
    color: white;
  }

  .action-button.primary:hover {
    background: #2563eb;
  }

  .action-button.secondary {
    background: white;
    color: #3b82f6;
    border: 1px solid #3b82f6;
  }

  .action-button.secondary:hover {
    background: #eff6ff;
  }

  .spinner-small {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 640px) {
    .share-dialog {
      max-width: 100%;
      margin: 0;
      border-radius: 1rem 1rem 0 0;
    }

    .share-actions {
      flex-direction: column;
    }
  }
</style>
