<script lang="ts">
  import { onMount } from 'svelte';
  import { authService } from '$lib/services/auth';
  import { storachaClient } from '$lib/services/storacha';
  import { notificationService } from '$lib/services/notification';
  import { goto } from '$app/navigation';
  
  let email = $state('');
  let isLoggingIn = $state(false);
  let accountStatus = $state<{
    hasAccount: boolean;
    hasSpace: boolean;
    email: string | null;
  }>({ hasAccount: false, hasSpace: false, email: null });
  let clientStatus = $state<{
    initialized: boolean;
    authenticated: boolean;
    currentSpace: string | null;
    clientReady: boolean;
  }>({ initialized: false, authenticated: false, currentSpace: null, clientReady: false });
  
  // Identity & Key management
  let userDID = $state<string | null>(null);
  let didCopied = $state(false);
  let generatingKeys = $state(false);
  let hasEncryptionKeys = $state(false);
  
  onMount(async () => {
    await loadStatus();
    await loadIdentity();
  });
  
  async function loadStatus() {
    try {
      accountStatus = await authService.checkAccountStatus();
      clientStatus = storachaClient.getStatus();
    } catch (error) {
      console.error('Failed to load status:', error);
    }
  }
  
  async function loadIdentity() {
    try {
      userDID = authService.getDID();
      // Check if we have encryption keys in localStorage
      const storedKeys = localStorage.getItem('encryption_keys');
      hasEncryptionKeys = !!storedKeys;
    } catch (error) {
      console.error('Failed to load identity:', error);
    }
  }
  
  async function copyDID() {
    if (!userDID) return;
    try {
      await navigator.clipboard.writeText(userDID);
      didCopied = true;
      setTimeout(() => { didCopied = false; }, 2000);
      notificationService.success('Copied!', 'Your DID has been copied to clipboard');
    } catch (error) {
      notificationService.error('Failed to copy', 'Could not copy to clipboard');
    }
  }
  
  async function generateEncryptionKeys() {
    generatingKeys = true;
    try {
      // Generate ECDH key pair for encryption
      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
      );
      
      // Export public key for sharing
      const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
      const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
      
      // Store in localStorage (in production, use more secure storage)
      localStorage.setItem('encryption_keys', JSON.stringify({
        publicKey: publicKeyJwk,
        privateKey: privateKeyJwk,
        createdAt: new Date().toISOString()
      }));
      
      hasEncryptionKeys = true;
      notificationService.success('Keys Generated', 'Your encryption keys have been created');
    } catch (error) {
      console.error('Failed to generate keys:', error);
      notificationService.error('Generation Failed', 'Could not generate encryption keys');
    } finally {
      generatingKeys = false;
    }
  }
  
  async function exportPublicKey() {
    try {
      const storedKeys = localStorage.getItem('encryption_keys');
      if (!storedKeys) return;
      
      const keys = JSON.parse(storedKeys);
      const publicKeyData = JSON.stringify(keys.publicKey, null, 2);
      await navigator.clipboard.writeText(publicKeyData);
      notificationService.success('Copied!', 'Public key copied to clipboard');
    } catch (error) {
      notificationService.error('Failed to export', 'Could not export public key');
    }
  }
  
  async function handleEmailLogin() {
    if (!email || !email.includes('@')) {
      notificationService.error('Invalid email', 'Please enter a valid email address');
      return;
    }
    
    isLoggingIn = true;
    try {
      await authService.loginWithEmail(email);
      notificationService.success(
        'Check your email', 
        'We sent you a verification link. Click it to complete setup.'
      );
      await loadStatus();
    } catch (error) {
      notificationService.error(
        'Login failed', 
        error instanceof Error ? error.message : 'Please try again'
      );
    } finally {
      isLoggingIn = false;
    }
  }
  
  function goBack() {
    goto('/');
  }
</script>

<div class="settings-page">
  <div class="settings-container">
    <div class="settings-header">
      <button class="back-button" onclick={goBack}>
        ← Back
      </button>
      <h1>Settings</h1>
    </div>
    
    <div class="settings-content">
      <!-- Storage Status -->
      <section class="settings-section">
        <h2>Storage Status</h2>
        <div class="status-grid">
          <div class="status-item">
            <span class="status-label">Authentication:</span>
            <span class="status-value {clientStatus.authenticated ? 'success' : 'warning'}">
              {clientStatus.authenticated ? '✓ Authenticated' : '⚠ Not authenticated'}
            </span>
          </div>
          <div class="status-item">
            <span class="status-label">Cloud Storage:</span>
            <span class="status-value {clientStatus.clientReady ? 'success' : 'warning'}">
              {clientStatus.clientReady ? '✓ Ready' : '⚠ Not configured'}
            </span>
          </div>
          {#if accountStatus.email}
            <div class="status-item">
              <span class="status-label">Email:</span>
              <span class="status-value">{accountStatus.email}</span>
            </div>
          {/if}
          {#if clientStatus.currentSpace}
            <div class="status-item">
              <span class="status-label">Space DID:</span>
              <span class="status-value mono">{clientStatus.currentSpace.slice(0, 20)}...</span>
            </div>
          {/if}
        </div>
      </section>
      
      <!-- Email Login -->
      {#if !accountStatus.hasAccount}
        <section class="settings-section">
          <h2>Enable Cloud Storage</h2>
          <p class="section-description">
            Login with email to provision cloud storage space. This enables:
          </p>
          <ul class="feature-list">
            <li>✓ Automatic backup to decentralized storage</li>
            <li>✓ Access notes from any device</li>
            <li>✓ Share notes via IPFS links</li>
            <li>✓ Version history in the cloud</li>
          </ul>
          
          <div class="email-login-form">
            <input 
              type="email" 
              class="email-input"
              bind:value={email}
              placeholder="your@email.com"
              disabled={isLoggingIn}
            />
            <button 
              class="login-button"
              onclick={handleEmailLogin}
              disabled={isLoggingIn || !email}
            >
              {#if isLoggingIn}
                <span class="spinner-small"></span>
                Sending...
              {:else}
                Login with Email
              {/if}
            </button>
          </div>
          
          <div class="info-box">
            <strong>Note:</strong> Without email login, your notes are stored locally only. 
            They won't sync across devices or backup to the cloud.
          </div>
        </section>
      {:else}
        <section class="settings-section">
          <h2>Cloud Storage Active</h2>
          <p class="success-message">
            ✓ Your notes are being backed up to decentralized storage
          </p>
          {#if !clientStatus.clientReady}
            <div class="warning-box">
              <strong>Setup incomplete:</strong> Please check your email and complete the verification process.
              After verification, select a payment plan (free tier available).
            </div>
          {/if}
        </section>
      {/if}
      
      <!-- Identity & Encryption Keys -->
      <section class="settings-section">
        <h2>Identity & Security</h2>
        
        <!-- Your DID -->
        <div class="identity-section">
          <h3>Your Decentralized Identifier (DID)</h3>
          <p class="section-description">
            Your DID is your unique identity on the decentralized web. Share it with others to receive encrypted content.
          </p>
          
          {#if userDID}
            <div class="did-display">
              <code class="did-value">{userDID}</code>
              <button class="copy-did-btn" onclick={copyDID}>
                {didCopied ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
          {:else}
            <div class="warning-box">
              <strong>No identity found.</strong> Login to create your decentralized identity.
            </div>
          {/if}
        </div>
        
        <!-- Encryption Keys -->
        <div class="encryption-section">
          <h3>Encryption Keys</h3>
          <p class="section-description">
            Encryption keys are used to securely share content. When someone shares with your DID, 
            they use your public key to encrypt the content.
          </p>
          
          {#if hasEncryptionKeys}
            <div class="keys-status">
              <span class="status-badge success">✓ Keys configured</span>
              <button class="secondary-btn" onclick={exportPublicKey}>
                📤 Export Public Key
              </button>
            </div>
            <p class="help-text">
              Share your public key with collaborators so they can encrypt content for you.
            </p>
          {:else}
            <div class="keys-setup">
              <button 
                class="primary-btn" 
                onclick={generateEncryptionKeys}
                disabled={generatingKeys}
              >
                {#if generatingKeys}
                  <span class="spinner-small"></span>
                  Generating...
                {:else}
                  🔐 Generate Encryption Keys
                {/if}
              </button>
              <p class="help-text">
                Generate keys to enable end-to-end encrypted sharing with other users.
              </p>
            </div>
          {/if}
        </div>
      </section>
      
      <!-- About -->
      <section class="settings-section">
        <h2>About</h2>
        <p>
          Storacha Notes uses decentralized storage powered by 
          <a href="https://storacha.network" target="_blank" rel="noopener">Storacha</a> 
          and IPFS. Your notes are encrypted and stored across a distributed network.
        </p>
      </section>
    </div>
  </div>
</div>

<style>
  .settings-page {
    min-height: 100vh;
    background: #f9fafb;
    padding: 2rem;
  }
  
  .settings-container {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }
  
  .settings-header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .settings-header h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }
  
  .back-button {
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    color: #6b7280;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }
  
  .back-button:hover {
    background: #f3f4f6;
    border-color: #3b82f6;
    color: #3b82f6;
  }
  
  .settings-content {
    padding: 2rem;
  }
  
  .settings-section {
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .settings-section:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
  
  .settings-section h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 1rem 0;
  }
  
  .section-description {
    color: #6b7280;
    margin-bottom: 1rem;
  }
  
  .status-grid {
    display: grid;
    gap: 0.75rem;
  }
  
  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: #f9fafb;
    border-radius: 0.375rem;
  }
  
  .status-label {
    font-weight: 500;
    color: #374151;
  }
  
  .status-value {
    color: #6b7280;
  }
  
  .status-value.success {
    color: #059669;
    font-weight: 500;
  }
  
  .status-value.warning {
    color: #d97706;
    font-weight: 500;
  }
  
  .status-value.mono {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.875rem;
  }
  
  .feature-list {
    list-style: none;
    padding: 0;
    margin: 1rem 0;
  }
  
  .feature-list li {
    padding: 0.5rem 0;
    color: #374151;
  }
  
  .email-login-form {
    display: flex;
    gap: 0.75rem;
    margin: 1.5rem 0;
  }
  
  .email-input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 1rem;
    transition: all 0.2s;
  }
  
  .email-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .email-input:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
  }
  
  .login-button {
    padding: 0.75rem 1.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    white-space: nowrap;
  }
  
  .login-button:hover:not(:disabled) {
    background: #2563eb;
  }
  
  .login-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
  
  .info-box {
    padding: 1rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 0.375rem;
    color: #1e40af;
    font-size: 0.875rem;
    margin-top: 1rem;
  }
  
  .warning-box {
    padding: 1rem;
    background: #fef3c7;
    border: 1px solid #fcd34d;
    border-radius: 0.375rem;
    color: #92400e;
    font-size: 0.875rem;
    margin-top: 1rem;
  }
  
  .success-message {
    color: #059669;
    font-weight: 500;
    padding: 1rem;
    background: #d1fae5;
    border-radius: 0.375rem;
  }
  
  a {
    color: #3b82f6;
    text-decoration: none;
  }
  
  a:hover {
    text-decoration: underline;
  }
  
  /* Identity & Security Section */
  .identity-section,
  .encryption-section {
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .encryption-section {
    border-bottom: none;
    margin-bottom: 0;
  }
  
  .identity-section h3,
  .encryption-section h3 {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 0.5rem 0;
  }
  
  .did-display {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: #f3f4f6;
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  .did-value {
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
    color: #1f2937;
    word-break: break-all;
    flex: 1;
    padding: 0.375rem 0.5rem;
    background: white;
    border-radius: 0.25rem;
  }
  
  .copy-did-btn {
    flex-shrink: 0;
    padding: 0.5rem 0.75rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  
  .copy-did-btn:hover {
    background: #2563eb;
  }
  
  .keys-status {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: #f0fdf4;
    border-radius: 0.5rem;
  }
  
  .status-badge {
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
  }
  
  .status-badge.success {
    background: #dcfce7;
    color: #166534;
  }
  
  .keys-setup {
    margin-top: 0.75rem;
  }
  
  .primary-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  
  .primary-btn:hover {
    background: #2563eb;
  }
  
  .primary-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .secondary-btn {
    padding: 0.5rem 0.75rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s;
  }
  
  .secondary-btn:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }
  
  .help-text {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.5rem;
  }

  @media (max-width: 640px) {
    .settings-page {
      padding: 1rem;
    }
    
    .settings-content {
      padding: 1rem;
    }
    
    .email-login-form {
      flex-direction: column;
    }
    
    .login-button {
      width: 100%;
      justify-content: center;
    }
  }
</style>
