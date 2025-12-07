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

<div class="dialog-overlay" onclick={handleClose} onkeydown={(e) => e.key === 'Escape' && handleClose()} role="dialog" aria-modal="true" aria-label="Email login dialog" tabindex="-1">
  <div class="dialog" role="document">
    <div class="dialog-header">
      <h2>
        {#if step === 'email'}
          Enable Cloud Storage
        {:else if step === 'waiting'}
          Verify Your Email
        {:else if step === 'creating-space'}
          Setting Up Storage
        {:else}
          All Set!
        {/if}
      </h2>
      {#if step !== 'waiting'}
        <button class="close-button" onclick={handleClose}>✕</button>
      {/if}
    </div>

    <div class="dialog-content">
      {#if step === 'email'}
        <div class="step-content">
          <p class="description">
            Enter your email to enable cloud storage and sharing via IPFS.
            You'll receive a verification link to get started.
          </p>

          <form onsubmit={(e) => { e.preventDefault(); handleEmailSubmit(); }}>
            <div class="form-group">
              <label for="email">Email Address</label>
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

            {#if error}
              <div class="error-message">
                {error}
              </div>
            {/if}

            <button type="submit" class="submit-button" disabled={isLoading}>
              {#if isLoading}
                <span class="spinner"></span>
                Sending...
              {:else}
                Continue with Email
              {/if}
            </button>
          </form>

          <div class="info-box">
            <strong>Why email?</strong>
            <p>Storacha requires email verification to provision your storage space and prevent abuse.</p>
          </div>
        </div>
      {:else if step === 'waiting'}
        <div class="step-content centered">
          <div class="icon-large">📧</div>
          <h3>Check Your Inbox</h3>
          <p class="description">
            We sent a verification link to <strong>{email}</strong>
          </p>
          <p class="description">
            Click the link in the email to verify your account and select a plan.
          </p>
          
          <div class="loading-indicator">
            <div class="spinner-large"></div>
            <p>Waiting for verification...</p>
          </div>

          <div class="help-text">
            <p>Didn't receive the email?</p>
            <button class="text-button" onclick={() => { step = 'email'; isLoading = false; }}>
              Try a different email
            </button>
          </div>
        </div>
      {:else if step === 'creating-space'}
        <div class="step-content centered">
          <div class="spinner-large"></div>
          <h3>Creating Your Storage Space</h3>
          <p class="description">This will only take a moment...</p>
        </div>
      {:else if step === 'success'}
        <div class="step-content centered">
          <div class="icon-large success">✅</div>
          <h3>You're All Set!</h3>
          <p class="description">
            Your storage space is ready. You can now upload and share notes via IPFS.
          </p>
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
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1rem;
  }

  .dialog {
    background: white;
    border-radius: 1rem;
    max-width: 500px;
    width: 100%;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
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

  .step-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .step-content.centered {
    align-items: center;
    text-align: center;
  }

  .description {
    margin: 0;
    color: #6b7280;
    line-height: 1.6;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }

  .email-input {
    padding: 0.75rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
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

  .submit-button {
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

  .submit-button:hover:not(:disabled) {
    background: #2563eb;
  }

  .submit-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error-message {
    padding: 0.75rem 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.5rem;
    color: #991b1b;
    font-size: 0.875rem;
  }

  .info-box {
    padding: 1rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 0.5rem;
    font-size: 0.875rem;
  }

  .info-box strong {
    display: block;
    margin-bottom: 0.25rem;
    color: #1e40af;
  }

  .info-box p {
    margin: 0;
    color: #1e40af;
  }

  .icon-large {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .icon-large.success {
    animation: scaleIn 0.5s ease-out;
  }

  @keyframes scaleIn {
    from {
      transform: scale(0);
    }
    to {
      transform: scale(1);
    }
  }

  .step-content h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
  }

  .loading-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem 0;
  }

  .spinner,
  .spinner-large {
    border: 3px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .spinner {
    width: 1.25rem;
    height: 1.25rem;
  }

  .spinner-large {
    width: 3rem;
    height: 3rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .help-text {
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }

  .help-text p {
    margin: 0 0 0.5rem 0;
    color: #6b7280;
    font-size: 0.875rem;
  }

  .text-button {
    background: transparent;
    border: none;
    color: #3b82f6;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
  }

  .text-button:hover {
    color: #2563eb;
  }

  @media (max-width: 640px) {
    .dialog {
      max-width: 100%;
      margin: 0;
      border-radius: 1rem 1rem 0 0;
    }
  }
</style>
