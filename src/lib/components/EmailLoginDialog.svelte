<script lang="ts">
  import { authService, spaceService } from '$lib/services';
  import { notificationService } from '$lib/services/notification';

  interface Props {
    onClose?: () => void;
    onSuccess?: () => void;
  }

  let { onClose, onSuccess }: Props = $props();

  let email = $state('');
  let isLoading = $state(false);
  let step = $state<'email' | 'waiting' | 'creating-space' | 'success'>('email');
  let error = $state<string | null>(null);

  async function handleEmailSubmit() {
    if (!email || !email.includes('@')) {
      error = 'Please enter a valid email address';
      return;
    }

    isLoading = true;
    error = null;

    try {
      // Login with email
      await authService.loginWithEmail(email);
      
      // Move to waiting step
      step = 'waiting';
      
      notificationService.info(
        'Check your email!',
        `We sent a verification link to ${email}`,
        10000
      );

      // Start polling for account status
      pollForAccountStatus();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to send verification email';
      isLoading = false;
    }
  }

  async function pollForAccountStatus() {
    const maxAttempts = 60; // 5 minutes (5 seconds * 60)
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;

      try {
        const status = await authService.checkAccountStatus();
        
        if (status.hasAccount) {
          clearInterval(interval);
          
          // Check if space exists
          if (status.hasSpace) {
            step = 'success';
            notificationService.success('You\'re all set!', 'Your storage space is ready');
            setTimeout(() => {
              if (onSuccess) onSuccess();
              if (onClose) onClose();
            }, 2000);
          } else {
            // Create space automatically
            await createSpace();
          }
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          error = 'Verification timeout. Please try again.';
          step = 'email';
          isLoading = false;
        }
      } catch (err) {
        console.error('Error checking account status:', err);
      }
    }, 5000); // Check every 5 seconds
  }

  async function createSpace() {
    step = 'creating-space';
    
    try {
      await spaceService.initialize();
      const spaces = await spaceService.getSpaces();
      
      if (spaces.length === 0) {
        // Create new space
        await spaceService.createSpace('My Notes');
        notificationService.success('Space created!', 'Your storage space is ready');
      }
      
      step = 'success';
      
      setTimeout(() => {
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      }, 2000);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create storage space';
      step = 'email';
      isLoading = false;
    }
  }

  function handleClose() {
    if (step === 'waiting') {
      // Don't close while waiting for verification
      return;
    }
    if (onClose) onClose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="dialog-overlay" onclick={handleClose} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Email login dialog" onclick={(e) => e.stopPropagation()}>
    <!-- Close button -->
    {#if step !== 'waiting' && step !== 'creating-space'}
      <button class="close-button" onclick={handleClose} aria-label="Close dialog">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    {/if}

    <!-- Storacha branding header -->
    <div class="dialog-brand">
      <div class="brand-icon">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect width="40" height="40" rx="10" fill="url(#gradient)"/>
          <path d="M12 20l4 4 12-12" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <defs>
            <linearGradient id="gradient" x1="0" y1="0" x2="40" y2="40">
              <stop offset="0%" stop-color="#667eea"/>
              <stop offset="100%" stop-color="#764ba2"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <span class="brand-name">Storacha</span>
    </div>

    <div class="dialog-content">
      {#if step === 'email'}
        <div class="step-content">
          <div class="step-header">
            <h2>Enable Cloud Storage</h2>
            <p class="subtitle">Connect your email to unlock IPFS-powered cloud sync and sharing</p>
          </div>

          <div class="features-list">
            <div class="feature">
              <div class="feature-icon">☁️</div>
              <div class="feature-text">
                <strong>Cloud Sync</strong>
                <span>Access notes from anywhere</span>
              </div>
            </div>
            <div class="feature">
              <div class="feature-icon">🔗</div>
              <div class="feature-text">
                <strong>Share via IPFS</strong>
                <span>Decentralized, permanent links</span>
              </div>
            </div>
            <div class="feature">
              <div class="feature-icon">🔒</div>
              <div class="feature-text">
                <strong>End-to-End Encrypted</strong>
                <span>Your data stays private</span>
              </div>
            </div>
          </div>

          <form onsubmit={(e) => { e.preventDefault(); handleEmailSubmit(); }}>
            <div class="form-group">
              <label for="email">Email Address</label>
              <div class="input-wrapper">
                <svg class="input-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="1" y="3" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M1 5l8 5 8-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <input
                  id="email"
                  type="email"
                  bind:value={email}
                  placeholder="you@example.com"
                  class="email-input"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {#if error}
              <div class="error-message">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M8 5v3M8 10.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                {error}
              </div>
            {/if}

            <button type="submit" class="submit-button" disabled={isLoading}>
              {#if isLoading}
                <span class="spinner"></span>
                Sending verification...
              {:else}
                Get Started
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              {/if}
            </button>
          </form>

          <p class="terms-text">
            By continuing, you agree to Storacha's Terms of Service and Privacy Policy
          </p>
        </div>

      {:else if step === 'waiting'}
        <div class="step-content centered">
          <div class="email-animation">
            <div class="email-icon-wrapper">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <rect x="4" y="12" width="56" height="40" rx="4" fill="#EEF2FF" stroke="#667eea" stroke-width="2"/>
                <path d="M4 16l28 18 28-18" stroke="#667eea" stroke-width="2" stroke-linecap="round"/>
                <circle cx="52" cy="16" r="10" fill="#10B981"/>
                <path d="M48 16l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
          
          <h2>Check Your Inbox</h2>
          <p class="description">
            We sent a verification link to<br/>
            <strong class="email-highlight">{email}</strong>
          </p>
          
          <div class="steps-indicator">
            <div class="step-item completed">
              <div class="step-dot"></div>
              <span>Email sent</span>
            </div>
            <div class="step-item active">
              <div class="step-dot">
                <span class="pulse"></span>
              </div>
              <span>Verify email</span>
            </div>
            <div class="step-item">
              <div class="step-dot"></div>
              <span>Ready to go</span>
            </div>
          </div>

          <div class="waiting-info">
            <div class="spinner-ring"></div>
            <span>Waiting for verification...</span>
          </div>

          <div class="help-section">
            <p>Didn't receive the email?</p>
            <div class="help-actions">
              <button class="text-button" onclick={() => { step = 'email'; isLoading = false; }}>
                Try different email
              </button>
              <span class="divider">•</span>
              <button class="text-button">
                Resend email
              </button>
            </div>
          </div>
        </div>

      {:else if step === 'creating-space'}
        <div class="step-content centered">
          <div class="creating-animation">
            <div class="orbit">
              <div class="planet"></div>
            </div>
            <div class="center-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M16 4v24M4 16h24" stroke="#667eea" stroke-width="3" stroke-linecap="round"/>
              </svg>
            </div>
          </div>
          <h2>Setting Up Your Space</h2>
          <p class="description">Creating your personal storage space on IPFS...</p>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
        </div>

      {:else if step === 'success'}
        <div class="step-content centered">
          <div class="success-animation">
            <div class="success-circle">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <path class="checkmark" d="M12 24l8 8 16-16" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
          <h2>You're All Set!</h2>
          <p class="description">
            Your Storacha space is ready. Start creating and sharing notes with the power of IPFS.
          </p>
          <div class="success-features">
            <span class="success-tag">✓ Cloud sync enabled</span>
            <span class="success-tag">✓ IPFS sharing ready</span>
            <span class="success-tag">✓ End-to-end encrypted</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1rem;
  }

  .dialog {
    position: relative;
    background: var(--bg-primary, white);
    border-radius: 1.25rem;
    max-width: 440px;
    width: 100%;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    animation: modalIn 0.3s ease-out;
    overflow: hidden;
  }

  @keyframes modalIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .close-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary, #f3f4f6);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    color: var(--text-secondary, #6b7280);
    transition: all 0.2s;
    z-index: 10;
  }

  .close-button:hover {
    background: var(--bg-tertiary, #e5e7eb);
    color: var(--text-primary, #111827);
  }

  .dialog-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1.5rem 1.5rem 0.5rem;
  }

  .brand-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .brand-name {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary, #111827);
    letter-spacing: -0.02em;
  }

  .dialog-content {
    padding: 1rem 1.5rem 1.5rem;
  }

  .step-content {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .step-content.centered {
    align-items: center;
    text-align: center;
  }

  .step-header {
    text-align: center;
  }

  .step-header h2 {
    margin: 0 0 0.5rem;
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--text-primary, #111827);
  }

  .step-header .subtitle {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--text-secondary, #6b7280);
    line-height: 1.5;
  }

  .features-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--bg-secondary, #f9fafb);
    border-radius: 0.75rem;
  }

  .feature {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .feature-icon {
    font-size: 1.25rem;
    width: 2rem;
    text-align: center;
  }

  .feature-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .feature-text strong {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
  }

  .feature-text span {
    font-size: 0.8125rem;
    color: var(--text-secondary, #6b7280);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-weight: 600;
    color: var(--text-primary, #374151);
    font-size: 0.875rem;
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-icon {
    position: absolute;
    left: 0.875rem;
    color: var(--text-tertiary, #9ca3af);
    pointer-events: none;
  }

  .email-input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 2.75rem;
    border: 1.5px solid var(--border-color, #e5e7eb);
    border-radius: 0.625rem;
    font-size: 1rem;
    background: var(--bg-primary, white);
    color: var(--text-primary, #111827);
    transition: all 0.2s;
  }

  .email-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
  }

  .email-input:disabled {
    background: var(--bg-secondary, #f3f4f6);
    cursor: not-allowed;
  }

  .email-input::placeholder {
    color: var(--text-tertiary, #9ca3af);
  }

  .submit-button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 0.625rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
  }

  .submit-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.45);
  }

  .submit-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .submit-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.5rem;
    color: #dc2626;
    font-size: 0.875rem;
  }

  .terms-text {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-tertiary, #9ca3af);
    text-align: center;
    line-height: 1.5;
  }

  /* Waiting step styles */
  .step-content h2 {
    margin: 0;
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--text-primary, #111827);
  }

  .description {
    margin: 0;
    color: var(--text-secondary, #6b7280);
    line-height: 1.6;
    font-size: 0.9375rem;
  }

  .email-highlight {
    color: #667eea;
    font-weight: 600;
  }

  .email-animation {
    padding: 1rem 0;
  }

  .email-icon-wrapper {
    animation: float 3s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }

  .steps-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem 0;
  }

  .step-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0 1rem;
  }

  .step-item span {
    font-size: 0.75rem;
    color: var(--text-tertiary, #9ca3af);
    white-space: nowrap;
  }

  .step-item.completed span,
  .step-item.active span {
    color: var(--text-secondary, #6b7280);
    font-weight: 500;
  }

  .step-dot {
    position: relative;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--border-color, #e5e7eb);
  }

  .step-item.completed .step-dot {
    background: #10B981;
  }

  .step-item.active .step-dot {
    background: #667eea;
  }

  .pulse {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    background: rgba(102, 126, 234, 0.3);
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.5); opacity: 0; }
  }

  .waiting-info {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
    background: var(--bg-secondary, #f9fafb);
    border-radius: 2rem;
    font-size: 0.875rem;
    color: var(--text-secondary, #6b7280);
  }

  .spinner-ring {
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid var(--border-color, #e5e7eb);
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .spinner {
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .help-section {
    padding-top: 1rem;
    border-top: 1px solid var(--border-color, #e5e7eb);
  }

  .help-section p {
    margin: 0 0 0.5rem;
    font-size: 0.8125rem;
    color: var(--text-tertiary, #9ca3af);
  }

  .help-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }

  .divider {
    color: var(--text-tertiary, #9ca3af);
  }

  .text-button {
    background: transparent;
    border: none;
    color: #667eea;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.2s;
  }

  .text-button:hover {
    color: #764ba2;
    text-decoration: underline;
  }

  /* Creating space animation */
  .creating-animation {
    position: relative;
    width: 80px;
    height: 80px;
    margin: 1rem 0;
  }

  .orbit {
    position: absolute;
    inset: 0;
    border: 2px dashed var(--border-color, #e5e7eb);
    border-radius: 50%;
    animation: rotate 3s linear infinite;
  }

  .planet {
    position: absolute;
    top: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 12px;
    height: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
  }

  .center-icon {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @keyframes rotate {
    to { transform: rotate(360deg); }
  }

  .progress-bar {
    width: 100%;
    max-width: 200px;
    height: 4px;
    background: var(--bg-secondary, #e5e7eb);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    animation: progress 2s ease-in-out infinite;
  }

  @keyframes progress {
    0% { width: 0%; }
    50% { width: 70%; }
    100% { width: 100%; }
  }

  /* Success animation */
  .success-animation {
    padding: 1rem 0;
  }

  .success-circle {
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, #10B981 0%, #059669 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: successPop 0.5s ease-out;
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35);
  }

  @keyframes successPop {
    0% { transform: scale(0); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
  }

  .checkmark {
    stroke-dasharray: 50;
    stroke-dashoffset: 50;
    animation: drawCheck 0.5s ease-out 0.3s forwards;
  }

  @keyframes drawCheck {
    to { stroke-dashoffset: 0; }
  }

  .success-features {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .success-tag {
    padding: 0.375rem 0.75rem;
    background: #ecfdf5;
    color: #059669;
    font-size: 0.8125rem;
    font-weight: 500;
    border-radius: 1rem;
  }

  @media (max-width: 480px) {
    .dialog {
      max-width: 100%;
      margin: 0 0.5rem;
      border-radius: 1rem;
    }

    .features-list {
      padding: 0.75rem;
    }

    .steps-indicator {
      gap: 0.25rem;
    }

    .step-item {
      padding: 0 0.5rem;
    }
  }
</style>
