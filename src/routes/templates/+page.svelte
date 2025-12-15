<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import {
    templateManager,
    type PageTemplate,
  } from "$lib/services/template-manager";
  import { workspaceState } from "$lib/stores/workspace";
  import { notificationService } from "$lib/services/notification";

  let templates = $state<PageTemplate[]>([]);
  let selectedCategory = $state<"all" | "builtin" | "custom">("all");
  let searchQuery = $state("");

  onMount(async () => {
    templates = await templateManager.getAllTemplates();
  });

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

  function handleTemplateSelect(template: PageTemplate) {
    try {
      // Create a new page from template using workspace store
      const pageId = workspaceState.createPage(
        template.name,
        template.icon,
        "file"
      );

      notificationService.success(
        "Template applied",
        `Created page from ${template.name}`
      );

      // Small delay to ensure workspace state updates before navigation
      setTimeout(() => {
        goto(`/page/${pageId}`);
      }, 100);
    } catch (error) {
      console.error("Failed to apply template:", error);
      notificationService.error("Failed to apply template", "Please try again");
    }
  }
</script>

<div class="templates-page">
  <div class="page-header">
    <div class="header-content">
      <button class="back-btn" onclick={() => goto("/dashboard")}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>
      <div>
        <h1>Templates</h1>
        <p>Choose a template to start your new page</p>
      </div>
    </div>
  </div>

  <div class="page-content">
    <!-- Controls -->
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

    <!-- Templates Grid -->
    <div class="templates-container">
      {#if groupedTemplates().basic.length > 0}
        <div class="template-section">
          <h2>Basic</h2>
          <div class="templates-grid">
            {#each groupedTemplates().basic as template}
              <button
                class="template-card"
                onclick={() => handleTemplateSelect(template)}
              >
                <div class="template-icon">{template.icon}</div>
                <div class="template-info">
                  <h3 class="template-name">{template.name}</h3>
                  <p class="template-description">{template.description}</p>
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
          <h2>Work & Productivity</h2>
          <div class="templates-grid">
            {#each groupedTemplates().work as template}
              <button
                class="template-card"
                onclick={() => handleTemplateSelect(template)}
              >
                <div class="template-icon">{template.icon}</div>
                <div class="template-info">
                  <h3 class="template-name">{template.name}</h3>
                  <p class="template-description">{template.description}</p>
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
          <h2>Personal</h2>
          <div class="templates-grid">
            {#each groupedTemplates().personal as template}
              <button
                class="template-card"
                onclick={() => handleTemplateSelect(template)}
              >
                <div class="template-icon">{template.icon}</div>
                <div class="template-info">
                  <h3 class="template-name">{template.name}</h3>
                  <p class="template-description">{template.description}</p>
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
          <h2>Other</h2>
          <div class="templates-grid">
            {#each groupedTemplates().other as template}
              <button
                class="template-card"
                onclick={() => handleTemplateSelect(template)}
              >
                <div class="template-icon">{template.icon}</div>
                <div class="template-info">
                  <h3 class="template-name">{template.name}</h3>
                  <p class="template-description">{template.description}</p>
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
          <h3>No templates found</h3>
          <p>Try a different search or category</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .templates-page {
    min-height: 100vh;
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .page-header {
    background: var(--bg-card);
    border-bottom: 1px solid var(--border-color);
    padding: 24px;
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .back-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 8px;
    border-radius: 6px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
  }

  .back-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .page-header h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .page-header p {
    margin: 4px 0 0 0;
    font-size: 14px;
    color: var(--text-secondary);
  }

  .page-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px 24px;
  }

  .controls {
    margin-bottom: 32px;
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
    color: var(--text-tertiary);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 10px 12px 10px 40px;
    background: var(--bg-input);
    border: 2px solid var(--border-input);
    border-radius: 8px;
    font-size: 14px;
    color: var(--text-primary);
    outline: none;
    transition: border-color 0.2s;
  }

  .search-input:focus {
    border-color: var(--border-input-focus);
    box-shadow: 0 0 0 4px var(--accent-glow);
  }

  .category-tabs {
    display: flex;
    gap: 8px;
    border-bottom: 1px solid var(--border-color);
  }

  .category-tab {
    padding: 8px 16px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .category-tab:hover {
    color: var(--text-primary);
  }

  .category-tab.active {
    color: var(--accent-color);
    border-bottom-color: var(--accent-color);
  }

  .templates-container {
    display: flex;
    flex-direction: column;
    gap: 40px;
  }

  .template-section h2 {
    margin: 0 0 16px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
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
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
    position: relative;
  }

  .template-card:hover {
    border-color: var(--accent-color);
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  .template-icon {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border-radius: 8px;
    font-size: 24px;
  }

  .template-info {
    flex: 1;
    min-width: 0;
  }

  .template-name {
    margin: 0 0 4px 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .template-description {
    margin: 0;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .custom-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 2px 8px;
    background: rgba(59, 130, 246, 0.1);
    color: var(--accent-color);
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .empty-state {
    text-align: center;
    padding: 80px 20px;
    color: var(--text-tertiary);
  }

  .empty-state svg {
    margin-bottom: 16px;
    color: var(--text-secondary);
  }

  .empty-state h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .empty-state p {
    margin: 0;
    font-size: 14px;
    color: var(--text-tertiary);
  }
</style>
