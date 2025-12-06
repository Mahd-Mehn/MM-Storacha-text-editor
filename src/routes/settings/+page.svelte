<script lang="ts">
  import { userStore } from "$lib/stores/user";

  let name = $userStore.name;
  let email = $userStore.email;
  let saved = false;

  function saveProfile() {
    userStore.updateUser({ name, email });
    saved = true;
    setTimeout(() => (saved = false), 2000);
  }
</script>

<div class="settings-page">
  <header class="page-header">
    <h1>Settings</h1>
    <p>Manage your profile and preferences</p>
  </header>

  <div class="settings-content">
    <section class="settings-section">
      <h2>Profile Information</h2>

      <div class="form-group">
        <label for="name">Name</label>
        <input
          id="name"
          type="text"
          bind:value={name}
          placeholder="Your name"
          class="input-field"
        />
      </div>

      <div class="form-group">
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          placeholder="your.email@example.com"
          class="input-field"
        />
      </div>

      <button class="save-btn" on:click={saveProfile}>
        {#if saved}
          ✓ Saved!
        {:else}
          Save Changes
        {/if}
      </button>
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

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .input-field {
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--bg-input);
    border: 2px solid var(--border-input);
    border-radius: 0.5rem;
    font-size: 1rem;
    color: var(--text-primary);
    transition: all 0.2s;
  }

  .input-field:focus {
    outline: none;
    border-color: var(--border-input-focus);
    box-shadow: 0 0 0 4px var(--accent-glow);
  }

  .input-field::placeholder {
    color: var(--text-tertiary);
  }

  .save-btn {
    padding: 0.75rem 2rem;
    background: var(--accent-color);
    color: #000;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 0 15px var(--accent-glow);
  }

  .save-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px var(--accent-glow);
  }

  .save-btn:active {
    transform: translateY(0);
  }

  @media (max-width: 768px) {
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
