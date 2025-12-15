<script lang="ts">
  import { onMount } from "svelte";
  import { authService } from "$lib/services/auth";
  import { storachaClient } from "$lib/services/storacha";
  import { notificationService } from "$lib/services/notification";
  
  let email = $state("");
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
      console.error("Failed to load status:", error);
    }
  }
  
  async function loadIdentity() {
    try {
      userDID = authService.getDID();
      // Check if we have encryption keys in localStorage
      const storedKeys = localStorage.getItem("encryption_keys");
      hasEncryptionKeys = !!storedKeys;
    } catch (error) {
      console.error("Failed to load identity:", error);
    }
  }
  
  async function copyDID() {
    if (!userDID) return;
    try {
      await navigator.clipboard.writeText(userDID);
      didCopied = true;
      setTimeout(() => { didCopied = false; }, 2000);
      notificationService.success("Copied!", "Your DID has been copied to clipboard");
    } catch (error) {
      notificationService.error("Failed to copy", "Could not copy to clipboard");
    }
  }
  
  async function generateEncryptionKeys() {
    generatingKeys = true;
    try {
      // Generate ECDH key pair for encryption
      const keyPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey", "deriveBits"]
      );
      
      // Export public key for sharing
      const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
      const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
      
      // Store in localStorage (in production, use more secure storage)
      localStorage.setItem("encryption_keys", JSON.stringify({
        publicKey: publicKeyJwk,
        privateKey: privateKeyJwk,
        createdAt: new Date().toISOString()
      }));
      
      hasEncryptionKeys = true;
      notificationService.success("Keys Generated", "Your encryption keys have been created");
    } catch (error) {
      console.error("Failed to generate keys:", error);
      notificationService.error("Generation Failed", "Could not generate encryption keys");
    } finally {
      generatingKeys = false;
    }
  }
  
  async function exportPublicKey() {
    try {
      const storedKeys = localStorage.getItem("encryption_keys");
      if (!storedKeys) return;
      
      const keys = JSON.parse(storedKeys);
      const publicKeyData = JSON.stringify(keys.publicKey, null, 2);
      await navigator.clipboard.writeText(publicKeyData);
      notificationService.success("Copied!", "Public key copied to clipboard");
    } catch (error) {
      notificationService.error("Failed to export", "Could not export public key");
    }
  }
  
  async function handleEmailLogin() {
    if (!email || !email.includes('@')) {
      notificationService.error("Invalid email", "Please enter a valid email address");
      return;
    }
    
    isLoggingIn = true;
    try {
      await authService.loginWithEmail(email);
      notificationService.success(
        "Check your email", 
        "We sent you a verification link. Click it to complete setup."
      );
      await loadStatus();
    } catch (error) {
      notificationService.error(
        "Login failed", 
        error instanceof Error ? error.message : "Please try again"
      );
    } finally {
      isLoggingIn = false;
    }
  }
</script>

<div class="settings-page">
  <header class="page-header">
    <h1>Settings</h1>
    <p>Manage storage, identity, and security</p>
  </header>

  <div class="settings-content">
    <!-- Storage Status -->
    <section class="settings-section">
      <h2>Storage Status</h2>
      <div class="status-grid">
        <div class="status-item">
          <span class="status-label">Authentication:</span>
          <span class="status-value" class:success={clientStatus.authenticated} class:warning={!clientStatus.authenticated}>
            {clientStatus.authenticated ? "Authenticated" : "Not authenticated"}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">Cloud Storage:</span>
          <span class="status-value" class:success={clientStatus.clientReady} class:warning={!clientStatus.clientReady}>
            {clientStatus.clientReady ? "Ready" : "Not configured"}
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
          Login with email to provision cloud storage. This enables:
        </p>
        <ul class="feature-list">
          <li>Automatic backup to decentralized storage</li>
          <li>Access notes from any device</li>
          <li>Share notes via IPFS links</li>
          <li>Version history in the cloud</li>
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
              <span class="spinner-small" aria-hidden="true"></span>
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
        <h2>Cloud Storage</h2>
        <p class="success-message">Cloud backup is enabled.</p>
        {#if !clientStatus.clientReady}
          <div class="warning-box">
            <strong>Setup incomplete:</strong> Check your email and complete verification.
            After verification, select a plan (free tier available).
          </div>
        {/if}
      </section>
    {/if}

    <!-- Identity & Encryption Keys -->
    <section class="settings-section">
      <h2>Identity & Security</h2>

      <div class="identity-section">
        <h3>Your Decentralized Identifier (DID)</h3>
        <p class="section-description">
          Share your DID to receive encrypted content.
        </p>

        {#if userDID}
          <div class="did-display">
            <code class="did-value">{userDID}</code>
            <button class="copy-did-btn" onclick={copyDID}>
              {didCopied ? "Copied" : "Copy"}
            </button>
          </div>
        {:else}
          <div class="warning-box">
            <strong>No identity found.</strong> Login to create your decentralized identity.
          </div>
        {/if}
      </div>

      <div class="encryption-section">
        <h3>Encryption Keys</h3>
        <p class="section-description">
          Keys are used to securely share content end-to-end.
        </p>

        {#if hasEncryptionKeys}
          <div class="keys-status">
            <span class="status-badge success">Keys configured</span>
            <button class="secondary-btn" onclick={exportPublicKey}>
              Export Public Key
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
                <span class="spinner-small" aria-hidden="true"></span>
                Generating...
              {:else}
                Generate Encryption Keys
              {/if}
            </button>
            <p class="help-text">
              Generate keys to enable encrypted sharing with other users.
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
        and IPFS.
      </p>
    </section>
  </div>
</div>

<style>
  .settings-page {
    min-height: 100vh;
    background: var(--bg-tertiary);
    padding: 3rem 4rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .page-header {
    margin-bottom: 3rem;
  }

  .page-header h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 0.5rem;
  }

  .page-header p {
    font-size: 1.125rem;
    color: var(--text-secondary);
    margin: 0;
  }

  .settings-content {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 1rem;
    padding: 2rem;
  }

  .settings-section {
    margin-bottom: 2rem;
  }

  .settings-section:last-child {
    margin-bottom: 0;
  }

  .settings-section h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 1.5rem;
  }

  .section-description {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin: 0.25rem 0 1rem;
  }

  .status-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--bg-secondary);
  }

  .status-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .status-value {
    color: var(--text-primary);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .status-value.success {
    color: var(--accent-color);
  }

  .status-value.warning {
    color: var(--text-secondary);
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-weight: 500;
  }

  .feature-list {
    margin: 0 0 1rem;
    padding-left: 1.25rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .email-login-form {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .email-input {
    flex: 1;
    min-width: 220px;
    padding: 0.75rem 1rem;
    background: var(--bg-input);
    border: 2px solid var(--border-input);
    border-radius: 0.5rem;
    font-size: 1rem;
    color: var(--text-primary);
    transition: all 0.2s;
  }

  .email-input:focus {
    outline: none;
    border-color: var(--border-input-focus);
    box-shadow: 0 0 0 4px var(--accent-glow);
  }

  .login-button {
    padding: 0.75rem 1rem;
    background: var(--accent-color);
    color: #000;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 0 15px var(--accent-glow);
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .login-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
  }

  
  .spinner-small {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(0, 0, 0, 0.15);
    border-top-color: rgba(0, 0, 0, 0.55);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  :global([data-theme="dark"]) .spinner-small {
    border: 2px solid rgba(255, 255, 255, 0.25);
    border-top-color: rgba(255, 255, 255, 0.75);
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .info-box {
    padding: 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-top: 1rem;
  }
  
  .warning-box {
    padding: 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-top: 1rem;
  }
  
  .success-message {
    color: var(--text-primary);
    font-weight: 500;
    padding: 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
  }
  
  a {
    color: var(--text-primary);
    text-decoration: none;
    border-bottom: 1px solid var(--border-color);
  }
  
  a:hover {
    border-bottom-color: var(--accent-color);
  }
  
  /* Identity & Security Section */
  .identity-section,
  .encryption-section {
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .encryption-section {
    border-bottom: none;
    margin-bottom: 0;
  }
  
  .identity-section h3,
  .encryption-section h3 {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
  }
  
  .did-display {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  .did-value {
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
    color: var(--text-primary);
    word-break: break-all;
    flex: 1;
    padding: 0.375rem 0.5rem;
    background: var(--bg-input);
    border-radius: 0.25rem;
    border: 1px solid var(--border-color);
  }
  
  .copy-did-btn {
    flex-shrink: 0;
    padding: 0.5rem 0.75rem;
    background: var(--accent-color);
    color: #000;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  
  .copy-did-btn:hover {
    background: var(--accent-hover);
  }
  
  .keys-status {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
  }
  
  .status-badge {
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
  }
  
  .status-badge.success {
    background: var(--bg-active);
    color: var(--text-primary);
  }
  
  .keys-setup {
    margin-top: 0.75rem;
  }
  
  .primary-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: var(--accent-color);
    color: #000;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
    box-shadow: 0 0 15px var(--accent-glow);
  }
  
  .primary-btn:hover {
    background: var(--accent-hover);
  }
  
  .primary-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .secondary-btn {
    padding: 0.5rem 0.75rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    font-size: 0.75rem;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.15s;
  }
  
  .secondary-btn:hover {
    background: var(--bg-hover);
    border-color: var(--accent-color);
  }
  
  .help-text {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: 0.5rem;
  }

  @media (max-width: 640px) {
    .settings-page {
      padding: 2rem 1.5rem;
    }

    .settings-content {
      padding: 1.5rem;
    }

    .page-header h1 {
      font-size: 2rem;
    }
  }
</style>
