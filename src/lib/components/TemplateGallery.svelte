<script lang="ts">
  import { onMount } from "svelte";
  import {
    templateManager,
    type PageTemplate,
  } from "$lib/services/template-manager";

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelectTemplate: (template: PageTemplate) => void;
  }

  let { isOpen = $bindable(), onClose, onSelectTemplate }: Props = $props();

  let templates = $state<PageTemplate[]>([]);
  let selectedCategory = $state<"all" | "builtin" | "custom">("all");
  let searchQuery = $state("");

  const filteredTemplates = $derived(
    templates.filter((template) => {
      const matchesCategory =
        selectedCategory === "all" || template.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === "" ||
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        template.tags.some((tag) =>
          tag.toLowerCase().includes(searchQuery.toLowerCase())
        );

      return matchesCategory && matchesSearch;
    })
  );

  const groupedTemplates = $derived(() => {
    const groups: Record<string, PageTemplate[]> = {
      basic: [],
      work: [],
      personal: [],
      other: [],
    };

    filteredTemplates.forEach((template) => {
      if (template.tags.includes("basic")) {
        groups.basic.push(template);
      } else if (
        template.tags.includes("work") ||
        template.tags.includes("productivity")
      ) {
        groups.work.push(template);
      } else if (
        template.tags.includes("personal") ||
        template.tags.includes("journal")
      ) {
        groups.personal.push(template);
      } else {
        groups.other.push(template);
      }
    });

    return groups;
  });

  onMount(async () => {
    templates = await templateManager.getAllTemplates();
  });

  function handleTemplateSelect(template: PageTemplate) {
    onSelectTemplate(template);
    onClose();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      onClose();
    }
  }
</script>

{#if isOpen}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeyDown}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="modal-content">
      <div class="modal-header">
        <h2>Choose a Template</h2>
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
        <div class="controls">
          <div class="search-box">
            <svg
              class="search-icon"
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="9" cy="9" r="6" />
              <path d="M14 14l4 4" />
            </svg>
            <input
              type="text"
              bind:value={searchQuery}
              placeholder="Search templates..."
              class="search-input"
            />
          </div>

          <div class="category-tabs">
            <button
              class="category-tab"
              class:active={selectedCategory === "all"}
              onclick={() => (selectedCategory = "all")}
            >
              All
            </button>
            <button
              class="category-tab"
              class:active={selectedCategory === "builtin"}
              onclick={() => (selectedCategory = "builtin")}
            >
              Built-in
            </button>
            <button
              class="category-tab"
              class:active={selectedCategory === "custom"}
              onclick={() => (selectedCategory = "custom")}
            >
              Custom
            </button>
          </div>
        </div>

        <div class="templates-container">
          {#if groupedTemplates().basic.length > 0}
            <div class="template-section">
              <h3>Basic</h3>
              <div class="templates-grid">
                {#each groupedTemplates().basic as template}
                  <button
                    class="template-card"
                    onclick={() => handleTemplateSelect(template)}
                  >
                    <div class="template-icon">{template.icon}</div>
                    <div class="template-info">
                      <div class="template-name">{template.name}</div>
                      <div class="template-description">
                        {template.description}
                      </div>
                    </div>
                    {#if template.category === "custom"}
                      <span class="custom-badge">Custom</span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          {#if groupedTemplates().work.length > 0}
            <div class="template-section">
              <h3>Work & Productivity</h3>
              <div class="templates-grid">
                {#each groupedTemplates().work as template}
                  <button
                    class="template-card"
                    onclick={() => handleTemplateSelect(template)}
                  >
                    <div class="template-icon">{template.icon}</div>
                    <div class="template-info">
                      <div class="template-name">{template.name}</div>
                      <div class="template-description">
                        {template.description}
                      </div>
                    </div>
                    {#if template.category === "custom"}
                      <span class="custom-badge">Custom</span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          {#if groupedTemplates().personal.length > 0}
            <div class="template-section">
              <h3>Personal</h3>
              <div class="templates-grid">
                {#each groupedTemplates().personal as template}
                  <button
                    class="template-card"
                    onclick={() => handleTemplateSelect(template)}
                  >
                    <div class="template-icon">{template.icon}</div>
                    <div class="template-info">
                      <div class="template-name">{template.name}</div>
                      <div class="template-description">
                        {template.description}
                      </div>
                    </div>
                    {#if template.category === "custom"}
                      <span class="custom-badge">Custom</span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          {#if groupedTemplates().other.length > 0}
            <div class="template-section">
              <h3>Other</h3>
              <div class="templates-grid">
                {#each groupedTemplates().other as template}
                  <button
                    class="template-card"
                    onclick={() => handleTemplateSelect(template)}
                  >
                    <div class="template-icon">{template.icon}</div>
                    <div class="template-info">
                      <div class="template-name">{template.name}</div>
                      <div class="template-description">
                        {template.description}
                      </div>
                    </div>
                    {#if template.category === "custom"}
                      <span class="custom-badge">Custom</span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          {#if filteredTemplates.length === 0}
            <div class="empty-state">
              <svg
                width="64"
                height="64"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path
                  d="M9 12h6M9 8h6M6 16h8a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <p>No templates found</p>
              <span>Try a different search or category</span>
            </div>
          {/if}
        </div>
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
    max-width: 900px;
    width: 100%;
    max-height: 85vh;
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
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .search-box {
    position: relative;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 10px 12px 10px 40px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  .search-input:focus {
    border-color: #4f46e5;
  }

  .category-tabs {
    display: flex;
    gap: 8px;
    border-bottom: 1px solid #e5e7eb;
  }

  .category-tab {
    padding: 8px 16px;
    border: none;
    background: transparent;
    color: #6b7280;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .category-tab:hover {
    color: #111827;
  }

  .category-tab.active {
    color: #4f46e5;
    border-bottom-color: #4f46e5;
  }

  .templates-container {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .template-section h3 {
    margin: 0 0 16px 0;
    font-size: 14px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .templates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .template-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border: 1px solid #e5e7eb;
    background: white;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
    position: relative;
  }

  .template-card:hover {
    border-color: #4f46e5;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1);
    transform: translateY(-2px);
  }

  .template-icon {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f9fafb;
    border-radius: 8px;
    font-size: 24px;
  }

  .template-info {
    flex: 1;
    min-width: 0;
  }

  .template-name {
    font-size: 15px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 4px;
  }

  .template-description {
    font-size: 13px;
    color: #6b7280;
    line-height: 1.4;
  }

  .custom-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 2px 8px;
    background: #dbeafe;
    color: #1e40af;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
    color: #9ca3af;
  }

  .empty-state svg {
    margin-bottom: 16px;
  }

  .empty-state p {
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 500;
    color: #6b7280;
  }

  .empty-state span {
    font-size: 14px;
    color: #9ca3af;
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

    .search-input {
      background: #111827;
      border-color: #374151;
      color: #f9fafb;
    }

    .search-input:focus {
      border-color: #6366f1;
    }

    .category-tabs {
      border-bottom-color: #374151;
    }

    .category-tab {
      color: #9ca3af;
    }

    .category-tab:hover {
      color: #f9fafb;
    }

    .category-tab.active {
      color: #6366f1;
      border-bottom-color: #6366f1;
    }

    .template-section h3 {
      color: #9ca3af;
    }

    .template-card {
      background: #111827;
      border-color: #374151;
    }

    .template-card:hover {
      border-color: #6366f1;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
    }

    .template-icon {
      background: #374151;
    }

    .template-name {
      color: #f9fafb;
    }

    .template-description {
      color: #9ca3af;
    }

    .custom-badge {
      background: #1e3a8a;
      color: #93c5fd;
    }

    .empty-state p {
      color: #9ca3af;
    }

    .empty-state span {
      color: #6b7280;
    }
  }
</style>
