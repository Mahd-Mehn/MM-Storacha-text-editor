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
  
  onMount(async () => {
    await loadStatus();
  });
  
  async function loadStatus() {
    try {
      accountStatus = await authService.checkAccountStatus();
      clientStatus = storachaClient.getStatus();
    } catch (error) {
      console.error('Failed to load status:', error);
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
