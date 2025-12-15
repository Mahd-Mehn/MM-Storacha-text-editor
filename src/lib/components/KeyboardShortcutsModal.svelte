<script lang="ts">
  import {
    keyboardShortcuts,
    type KeyboardShortcut,
  } from "$lib/services/keyboard-shortcuts";

  interface Props {
    isOpen: boolean;
    onClose: () => void;
  }

  let { isOpen = $bindable(), onClose }: Props = $props();

  const shortcuts = $derived(keyboardShortcuts.getAll());

  const categories = $derived({
    navigation: Array.from(shortcuts.values()).filter(
      (s) => s.category === "navigation"
    ),
    editing: Array.from(shortcuts.values()).filter(
      (s) => s.category === "editing"
    ),
    formatting: Array.from(shortcuts.values()).filter(
      (s) => s.category === "formatting"
    ),
    general: Array.from(shortcuts.values()).filter(
      (s) => s.category === "general"
    ),
  });

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      onClose();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function getShortcutDisplay(shortcut: KeyboardShortcut): string {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const parts: string[] = [];

    if (shortcut.ctrl || shortcut.meta) {
      parts.push(isMac ? "⌘" : "Ctrl");
    }
    if (shortcut.shift) {
      parts.push(isMac ? "⇧" : "Shift");
    }
    if (shortcut.alt) {
      parts.push(isMac ? "⌥" : "Alt");
    }
    parts.push(shortcut.key.toUpperCase());

    return parts.join(isMac ? " " : "+");
  }
</script>

{#if isOpen}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeyDown}
    role="dialog"
    aria-modal="true"
  >
    <div class="modal-content">
      <div class="modal-header">
        <h2>Keyboard Shortcuts</h2>
        <button class="close-btn" onclick={onClose} aria-label="Close">
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
        {#if categories.navigation.length > 0}
          <div class="shortcut-section">
            <h3>Navigation</h3>
            <div class="shortcut-list">
              {#each categories.navigation as shortcut}
                <div class="shortcut-item">
                  <span class="shortcut-description"
                    >{shortcut.description}</span
                  >
                  <kbd class="shortcut-keys">{getShortcutDisplay(shortcut)}</kbd
                  >
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if categories.editing.length > 0}
          <div class="shortcut-section">
            <h3>Editing</h3>
            <div class="shortcut-list">
              {#each categories.editing as shortcut}
                <div class="shortcut-item">
                  <span class="shortcut-description"
                    >{shortcut.description}</span
                  >
                  <kbd class="shortcut-keys">{getShortcutDisplay(shortcut)}</kbd
                  >
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if categories.formatting.length > 0}
          <div class="shortcut-section">
            <h3>Formatting</h3>
            <div class="shortcut-list">
              {#each categories.formatting as shortcut}
                <div class="shortcut-item">
                  <span class="shortcut-description"
                    >{shortcut.description}</span
                  >
                  <kbd class="shortcut-keys">{getShortcutDisplay(shortcut)}</kbd
                  >
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if categories.general.length > 0}
          <div class="shortcut-section">
            <h3>General</h3>
            <div class="shortcut-list">
              {#each categories.general as shortcut}
                <div class="shortcut-item">
                  <span class="shortcut-description"
                    >{shortcut.description}</span
                  >
                  <kbd class="shortcut-keys">{getShortcutDisplay(shortcut)}</kbd
                  >
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if shortcuts.size === 0}
          <div class="empty-state">
            <p>No keyboard shortcuts configured yet.</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
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
    max-width: 600px;
    width: 100%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #111827;
  }

  .close-btn {
    background: none;
    border: none;
    padding: 8px;
    cursor: pointer;
    color: #6b7280;
    border-radius: 6px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: #f3f4f6;
    color: #111827;
  }

  .modal-body {
    padding: 24px;
    overflow-y: auto;
  }

  .shortcut-section {
    margin-bottom: 32px;
  }

  .shortcut-section:last-child {
    margin-bottom: 0;
  }

  .shortcut-section h3 {
    margin: 0 0 16px 0;
    font-size: 14px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .shortcut-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .shortcut-description {
    font-size: 14px;
    color: #374151;
    flex: 1;
  }

  .shortcut-keys {
    font-family: "SF Mono", "Monaco", "Inconsolata", "Fira Code", "Consolas",
      monospace;
    font-size: 13px;
    padding: 6px 12px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    color: #111827;
    white-space: nowrap;
    font-weight: 500;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #9ca3af;
  }

  .empty-state p {
    margin: 0;
    font-size: 14px;
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .modal-content {
      background: #1f2937;
    }

    .modal-header {
      border-bottom-color: #374151;
    }

    .modal-header h2 {
      color: #f9fafb;
    }

    .close-btn {
      color: #9ca3af;
    }

    .close-btn:hover {
      background: #374151;
      color: #f9fafb;
    }

    .shortcut-section h3 {
      color: #9ca3af;
    }

    .shortcut-description {
      color: #d1d5db;
    }

    .shortcut-keys {
      background: #374151;
      border-color: #4b5563;
      color: #f9fafb;
    }

    .empty-state {
      color: #6b7280;
    }
  }
</style>
