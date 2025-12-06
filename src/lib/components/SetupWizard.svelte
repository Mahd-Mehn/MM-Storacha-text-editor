<script lang="ts">
  import { onMount } from 'svelte';
  import { notificationService } from '$lib/services/notification';
  import { authService } from '$lib/services';
  
  let { onClose, onSuccess } = $props<{
    onClose: () => void;
    onSuccess: () => void;
  }>();
  
  let currentStep = $state<'welcome' | 'email' | 'verify' | 'plan' | 'complete'>('welcome');
  let email = $state('');
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  
  async function handleEmailSubmit() {
    if (!email || !email.includes('@')) {
      error = 'Please enter a valid email address';
      return;
    }
    
    isLoading = true;
    error = null;
    
    try {
      await authService.loginWithEmail(email);
      currentStep = 'verify';
      notificationService.success('Email sent!', 'Check your inbox for the verification link');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to send email';
      notificationService.error('Login failed', error);
    } finally {
      isLoading = false;
    }
  }
  
  function handleOpenConsole() {
    window.open('https://console.web3.storage', '_blank');
    currentStep = 'plan';
  }
  
  async function handleComplete() {
    // Check if account is ready
    const status = await authService.checkAccountStatus();
    if (status.hasAccount && status.hasSpace) {
      onSuccess();
    } else {
      error = 'Account not fully set up. Please complete all steps in the Storacha console.';
    }
  }
</script>

<div class="wizard-overlay" onclick={onClose}>
  <div class="wizard-modal" onclick={(e) => e.stopPropagation()}>
    <button class="close-btn" onclick={onClose}>✕</button>
    
    {#if currentStep === 'welcome'}
      <div class="wizard-step">
        <div class="step-icon">🚀</div>
        <h2>Enable Cloud Storage</h2>
        <p>Set up your Storacha account to enable:</p>
        <ul class="features-list">
          <li>☁️ Cloud backup via IPFS</li>
          <li>🔗 Share notes with anyone</li>
          <li>🔄 Sync across devices</li>
          <li>🔒 Decentralized & secure</li>
        </ul>
        <div class="step-actions">
          <button class="btn-secondary" onclick={onClose}>Maybe Later</button>
          <button class="btn-primary" onclick={() => currentStep = 'email'}>Get Started</button>
        </div>
      </div>
    
    {:else if currentStep === 'email'}
      <div class="wizard-step">
        <div class="step-icon">📧</div>
        <h2>Enter Your Email</h2>
        <p>We'll send you a verification link to get started</p>
        
        <form onsubmit={(e) => { e.preventDefault(); handleEmailSubmit(); }}>
          <input 
            type="email" 
            bind:value={email}
            placeholder="your@email.com"
            class="email-input"
            disabled={isLoading}
          />
          
          {#if error}
            <p class="error-message">{error}</p>
          {/if}
          
          <div class="step-actions">
            <button type="button" class="btn-secondary" onclick={() => currentStep = 'welcome'}>Back</button>
            <button type="submit" class="btn-primary" disabled={isLoading}>
              {#if isLoading}
                <span class="spinner-small"></span> Sending...
              {:else}
                Send Email
              {/if}
            </button>
          </div>
        </form>
      </div>
    
    {:else if currentStep === 'verify'}
      <div class="wizard-step">
        <div class="step-icon">✉️</div>
        <h2>Check Your Email</h2>
        <p>We sent a verification link to:</p>
        <p class="email-display">{email}</p>
        
        <div class="info-box">
          <strong>Next steps:</strong>
          <ol>
            <li>Open the email from Storacha</li>
            <li>Click the verification link</li>
            <li>You'll be redirected to the Storacha console</li>
          </ol>
        </div>
        
        <div class="step-actions">
          <button class="btn-secondary" onclick={() => currentStep = 'email'}>Resend Email</button>
          <button class="btn-primary" onclick={handleOpenConsole}>I Verified →</button>
        </div>
      </div>
    
    {:else if currentStep === 'plan'}
      <div class="wizard-step">
        <div class="step-icon">💳</div>
        <h2>Select a Payment Plan</h2>
        <p>Choose a plan in the Storacha console</p>
        
        <div class="info-box">
          <strong>Free Tier Available:</strong>
          <ul>
            <li>✅ 5GB storage</li>
            <li>✅ No credit card required</li>
            <li>✅ Perfect for personal use</li>
          </ul>
        </div>
        
        <p class="help-text">
          The console should open in a new tab. If not, 
          <a href="https://console.web3.storage" target="_blank">click here</a>.
        </p>
        
        <div class="step-actions">
          <button class="btn-secondary" onclick={handleOpenConsole}>Open Console</button>
          <button class="btn-primary" onclick={() => currentStep = 'complete'}>I Selected a Plan →</button>
        </div>
      </div>
    
    {:else if currentStep === 'complete'}
      <div class="wizard-step">
        <div class="step-icon">🎉</div>
        <h2>Almost Done!</h2>
        <p>Let's verify your account is ready</p>
        
        {#if error}
          <div class="error-box">
            <p>{error}</p>
            <p class="help-text">
              Make sure you've completed all steps in the 
              <a href="https://console.web3.storage" target="_blank">Storacha console</a>.
            </p>
          </div>
        {/if}
        
        <div class="step-actions">
          <button class="btn-secondary" onclick={() => currentStep = 'plan'}>Back</button>
          <button class="btn-primary" onclick={handleComplete}>Complete Setup</button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .wizard-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1rem;
  }
  
  .wizard-modal {
    background: white;
    border-radius: 1rem;
    max-width: 500px;
    width: 100%;
    padding: 2rem;
    position: relative;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }
  
  .close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: transparent;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #6b7280;
    padding: 0.5rem;
    line-height: 1;
  }
  
  .close-btn:hover {
    color: #111827;
  }
  
  .wizard-step {
    text-align: center;
  }
  
  .step-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }
  
  h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 0.5rem;
  }
  
  p {
    color: #6b7280;
    margin-bottom: 1.5rem;
  }
  
  .features-list {
    list-style: none;
    padding: 0;
    margin: 1.5rem 0;
    text-align: left;
  }
  
  .features-list li {
    padding: 0.5rem 0;
    color: #374151;
    font-size: 1rem;
  }
  
  .email-input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid #e5e7eb;
    border-radius: 0.5rem;
    font-size: 1rem;
    margin-bottom: 1rem;
    transition: border-color 0.2s;
  }
  
  .email-input:focus {
    outline: none;
    border-color: #3b82f6;
  }
  
  .email-input:disabled {
    background: #f9fafb;
    cursor: not-allowed;
  }
  
  .email-display {
    font-weight: 600;
    color: #3b82f6;
    font-size: 1.125rem;
  }
  
  .info-box {
    background: #f0f9ff;
    border: 1px solid #bfdbfe;
    border-radius: 0.5rem;
    padding: 1rem;
    margin: 1.5rem 0;
    text-align: left;
  }
  
  .info-box strong {
    display: block;
    color: #1e40af;
    margin-bottom: 0.5rem;
  }
  
  .info-box ol, .info-box ul {
    margin: 0.5rem 0 0 1.5rem;
    color: #374151;
  }
  
  .info-box li {
    margin: 0.25rem 0;
  }
  
  .error-box {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.5rem;
    padding: 1rem;
    margin: 1.5rem 0;
  }
  
  .error-box p {
    color: #991b1b;
    margin: 0.5rem 0;
  }
  
  .error-message {
    color: #dc2626;
    font-size: 0.875rem;
    margin-top: -0.5rem;
    margin-bottom: 1rem;
  }
  
  .help-text {
    font-size: 0.875rem;
    color: #6b7280;
  }
  
  .help-text a {
    color: #3b82f6;
    text-decoration: underline;
  }
  
  .step-actions {
    display: flex;
    gap: 1rem;
    margin-top: 2rem;
  }
  
  .btn-primary, .btn-secondary {
    flex: 1;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  
  .btn-primary {
    background: #3b82f6;
    color: white;
  }
  
  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }
  
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-secondary {
    background: white;
    color: #374151;
    border: 1px solid #e5e7eb;
  }
  
  .btn-secondary:hover {
    background: #f9fafb;
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
    .wizard-modal {
      padding: 1.5rem;
    }
    
    .step-icon {
      font-size: 3rem;
    }
    
    h2 {
      font-size: 1.25rem;
    }
    
    .step-actions {
      flex-direction: column;
    }
  }
</style>
