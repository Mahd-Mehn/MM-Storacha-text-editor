<script lang="ts">
  import { onMount } from "svelte";
  import { encryptionService } from "$lib/services/encryption";

  let isEnabled = $state(false);
  let showExportDialog = $state(false);
  let showImportDialog = $state(false);
  let exportedKey = $state("");
  let importKeyInput = $state("");
  let copySuccess = $state(false);

  onMount(async () => {
    await encryptionService.initialize();
    isEnabled = encryptionService.isEnabled();
  });

  async function handleExportKey() {
    try {
      exportedKey = await encryptionService.exportKey();
      showExportDialog = true;
    } catch (error) {
      alert("Failed to export encryption key");
    }
  }

  async function handleImportKey() {
    try {
      await encryptionService.importKey(importKeyInput);
      isEnabled = true;
      showImportDialog = false;
      importKeyInput = "";
      alert("Encryption key imported successfully");
    } catch (error) {
      alert("Failed to import encryption key. Please check the key format.");
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(exportedKey);
    copySuccess = true;
    setTimeout(() => {
      copySuccess = false;
    }, 2000);
  }
</script>

<div class="encryption-status">
  <div class="status-indicator">
    {#if isEnabled}
      <svg
        class="icon enabled"
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="status-text enabled">Encrypted</span>
    {:else}
      <svg
        class="icon disabled"
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z"
        />
      </svg>
      <span class="status-text disabled">Not Encrypted</span>
    {/if}
  </div>

  <div class="actions">
    <button
      class="action-btn"
      onclick={handleExportKey}
      title="Export encryption key"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          d="M4 16v1a3 3 0 003 3h6a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m0-4v12"
        />
      </svg>
      Export Key
    </button>
    <button
      class="action-btn"
      onclick={() => (showImportDialog = true)}
      title="Import encryption key"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          d="M4 16v1a3 3 0 003 3h6a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      Import Key
    </button>
  </div>
</div>

{#if showExportDialog}
  <div
    class="modal-backdrop"
    onclick={() => (showExportDialog = false)}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3>Export Encryption Key</h3>
        <button class="close-btn" onclick={() => (showExportDialog = false)}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M6 6l8 8M14 6l-8 8" />
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <p class="warning">
          ⚠️ <strong>Important:</strong> Store this key safely. You'll need it to
          decrypt your notes on other devices.
        </p>
        <div class="key-display">
          <code>{exportedKey}</code>
        </div>
        <button class="copy-btn" onclick={copyToClipboard}>
          {#if copySuccess}
            ✓ Copied!
          {:else}
            Copy to Clipboard
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showImportDialog}
  <div
    class="modal-backdrop"
    onclick={() => (showImportDialog = false)}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3>Import Encryption Key</h3>
        <button class="close-btn" onclick={() => (showImportDialog = false)}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M6 6l8 8M14 6l-8 8" />
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <p>Paste your encryption key below:</p>
        <textarea
          bind:value={importKeyInput}
          placeholder="Paste encryption key here..."
          rows="4"
        ></textarea>
        <button
          class="import-btn"
          onclick={handleImportKey}
          disabled={!importKeyInput.trim()}
        >
          Import Key
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .encryption-status {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: #f9fafb;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .icon {
    flex-shrink: 0;
  }

  .icon.enabled {
    color: #10b981;
  }

  .icon.disabled {
    color: #9ca3af;
  }

  .status-text {
    font-size: 13px;
    font-weight: 500;
  }

  .status-text.enabled {
    color: #059669;
  }

  .status-text.disabled {
    color: #6b7280;
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 12px;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
    color: #111827;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 500px;
    width: 100%;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #111827;
  }

  .close-btn {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: #6b7280;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: #f3f4f6;
    color: #111827;
  }

  .modal-body {
    padding: 20px;
  }

  .warning {
    padding: 12px;
    background: #fef3c7;
    border: 1px solid #fbbf24;
    border-radius: 6px;
    font-size: 13px;
    color: #92400e;
    margin-bottom: 16px;
  }

  .key-display {
    padding: 12px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    margin-bottom: 12px;
    max-height: 200px;
    overflow-y: auto;
  }

  .key-display code {
    font-family: "SF Mono", "Monaco", "Inconsolata", "Fira Code", "Consolas",
      monospace;
    font-size: 11px;
    color: #374151;
    word-break: break-all;
  }

  .copy-btn,
  .import-btn {
    width: 100%;
    padding: 10px;
    background: #4f46e5;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .copy-btn:hover,
  .import-btn:hover {
    background: #4338ca;
  }

  .import-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-family: "SF Mono", "Monaco", "Inconsolata", "Fira Code", "Consolas",
      monospace;
    font-size: 12px;
    resize: vertical;
    margin-bottom: 12px;
    outline: none;
  }

  textarea:focus {
    border-color: #4f46e5;
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .encryption-status {
      background: #111827;
      border-color: #374151;
    }

    .status-text.enabled {
      color: #10b981;
    }

    .status-text.disabled {
      color: #9ca3af;
    }

    .action-btn {
      background: #1f2937;
      border-color: #374151;
      color: #9ca3af;
    }

    .action-btn:hover {
      background: #374151;
      border-color: #4b5563;
      color: #f9fafb;
    }

    .modal-content {
      background: #1f2937;
    }

    .modal-header {
      border-bottom-color: #374151;
    }

    .modal-header h3 {
      color: #f9fafb;
    }

    .close-btn {
      color: #9ca3af;
    }

    .close-btn:hover {
      background: #374151;
      color: #f9fafb;
    }

    .warning {
      background: #78350f;
      border-color: #92400e;
      color: #fef3c7;
    }

    .key-display {
      background: #111827;
      border-color: #374151;
    }

    .key-display code {
      color: #d1d5db;
    }

    textarea {
      background: #111827;
      border-color: #374151;
      color: #f9fafb;
    }

    textarea:focus {
      border-color: #6366f1;
    }

    .copy-btn,
    .import-btn {
      background: #6366f1;
    }

    .copy-btn:hover,
    .import-btn:hover {
      background: #4f46e5;
    }

    .import-btn:disabled {
      background: #6b7280;
    }
  }
</style>
