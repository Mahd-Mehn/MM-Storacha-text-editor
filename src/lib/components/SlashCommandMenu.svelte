<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    isOpen?: boolean;
    position?: { x: number; y: number };
    onSelect?: (command: string) => void;
    onClose?: () => void;
  }

  let { isOpen = false, position = { x: 0, y: 0 }, onSelect, onClose }: Props = $props();

  let menuRef: HTMLElement;
  let selectedIndex = $state(0);
  let searchQuery = $state('');

  interface CommandCategory {
    title: string;
    commands: Command[];
  }

  interface Command {
    id: string;
    icon: string;
    label: string;
    description: string;
    keywords?: string[];
  }

  const commandCategories: CommandCategory[] = [
    {
      title: 'Basic blocks',
      commands: [
        { id: 'paragraph', icon: '📝', label: 'Text', description: 'Just start writing with plain text', keywords: ['text', 'plain'] },
        { id: 'heading1', icon: 'H₁', label: 'Heading 1', description: 'Big section heading', keywords: ['h1', 'title', 'header'] },
        { id: 'heading2', icon: 'H₂', label: 'Heading 2', description: 'Medium section heading', keywords: ['h2', 'subtitle', 'header'] },
        { id: 'heading3', icon: 'H₃', label: 'Heading 3', description: 'Small section heading', keywords: ['h3', 'header'] },
        { id: 'divider', icon: '─', label: 'Divider', description: 'Visually divide blocks', keywords: ['line', 'separator', 'hr'] },
      ]
    },
    {
      title: 'Lists',
      commands: [
        { id: 'bulletList', icon: '•', label: 'Bulleted List', description: 'Create a simple bulleted list', keywords: ['bullet', 'unordered', 'ul'] },
        { id: 'numberedList', icon: '1.', label: 'Numbered List', description: 'Create a numbered list', keywords: ['number', 'ordered', 'ol'] },
        { id: 'todo', icon: '☑', label: 'To-do List', description: 'Track tasks with a to-do list', keywords: ['checkbox', 'task', 'check'] },
        { id: 'toggle', icon: '▶', label: 'Toggle', description: 'Toggles can hide and show content', keywords: ['collapse', 'expand', 'accordion'] },
      ]
    },
    {
      title: 'Media & Embeds',
      commands: [
        { id: 'code', icon: '⟨/⟩', label: 'Code', description: 'Capture a code snippet', keywords: ['programming', 'snippet', 'syntax'] },
        { id: 'quote', icon: '❝', label: 'Quote', description: 'Capture a quote', keywords: ['blockquote', 'cite'] },
        { id: 'callout', icon: '💡', label: 'Callout', description: 'Make writing stand out', keywords: ['info', 'warning', 'alert', 'note'] },
      ]
    },
    {
      title: 'Advanced',
      commands: [
        { id: 'image', icon: '🖼️', label: 'Image', description: 'Upload or embed an image', keywords: ['picture', 'photo', 'img'] },
        { id: 'table', icon: '▦', label: 'Table', description: 'Add a table', keywords: ['grid', 'spreadsheet'] },
        { id: 'page', icon: '📄', label: 'Page', description: 'Embed a sub-page inside', keywords: ['subpage', 'nested'] },
      ]
    }
  ];

  // Flatten all commands for filtering and navigation
  let allCommands = $derived(commandCategories.flatMap(cat => cat.commands));

  let filteredCommands = $derived(
    searchQuery
      ? allCommands.filter(cmd => 
          cmd.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cmd.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cmd.keywords?.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : allCommands
  );

  // Group filtered commands by category
  let groupedFilteredCommands = $derived(() => {
    if (searchQuery) {
      // When searching, show flat list
      return [{ title: 'Results', commands: filteredCommands }];
    }
    return commandCategories;
  });

  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = (selectedIndex + 1) % filteredCommands.length;
        scrollToSelected();
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
        scrollToSelected();
        break;
      case 'Enter':
        event.preventDefault();
        if (filteredCommands[selectedIndex]) {
          selectCommand(filteredCommands[selectedIndex].id);
        }
        break;
      case 'Escape':
        event.preventDefault();
        onClose?.();
        break;
    }
  }

  function scrollToSelected() {
    setTimeout(() => {
      const selectedEl = menuRef?.querySelector('.menu-item.selected');
      selectedEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 0);
  }

  function selectCommand(commandId: string) {
    onSelect?.(commandId);
    searchQuery = '';
    selectedIndex = 0;
    onClose?.();
  }

  function handleClickOutside(event: MouseEvent) {
    if (menuRef && !menuRef.contains(event.target as Node)) {
      onClose?.();
    }
  }

  function handleSearchInput(event: Event) {
    searchQuery = (event.target as HTMLInputElement).value;
    selectedIndex = 0;
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('mousedown', handleClickOutside);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('mousedown', handleClickOutside);
  });

  // Reset on open
  $effect(() => {
    if (isOpen) {
      searchQuery = '';
      selectedIndex = 0;
      // Focus search input
      setTimeout(() => {
        const input = menuRef?.querySelector('input');
        input?.focus();
      }, 0);
    }
  });

  // Reset selection when filtered commands change
  $effect(() => {
    if (filteredCommands.length > 0 && selectedIndex >= filteredCommands.length) {
      selectedIndex = 0;
    }
  });

  // Track which command is at which global index for keyboard nav
  function getGlobalIndex(command: Command): number {
    return filteredCommands.findIndex(c => c.id === command.id);
  }
</script>

{#if isOpen}
  <div 
    class="slash-menu"
    bind:this={menuRef}
    style="left: {position.x}px; top: {position.y}px;"
  >
    <div class="menu-search">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <input 
        type="text"
        placeholder="Filter actions..."
        value={searchQuery}
        oninput={handleSearchInput}
      />
      <span class="search-hint">↑↓ Navigate</span>
    </div>
    
    <div class="menu-list">
      {#each groupedFilteredCommands() as category}
        {#if category.commands.length > 0}
          <div class="menu-category">
            <span class="category-title">{category.title}</span>
          </div>
          
          {#each category.commands as command (command.id)}
            {@const globalIdx = getGlobalIndex(command)}
            <button
              class="menu-item"
              class:selected={globalIdx === selectedIndex}
              onclick={() => selectCommand(command.id)}
              onmouseenter={() => selectedIndex = globalIdx}
            >
              <span class="item-icon" class:text-icon={command.icon.length > 2 && !command.icon.match(/^\p{Emoji}/u)}>
                {command.icon}
              </span>
              <div class="item-content">
                <span class="item-label">{command.label}</span>
                <span class="item-description">{command.description}</span>
              </div>
              <span class="item-shortcut">↵</span>
            </button>
          {/each}
        {/if}
      {/each}
      
      {#if filteredCommands.length === 0}
        <div class="no-results">
          <span class="no-results-icon">🔍</span>
          <span>No results found</span>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .slash-menu {
    position: fixed;
    z-index: 1000;
    width: 340px;
    max-height: 420px;
    background: white;
    border-radius: 0.75rem;
    box-shadow: 
      0 0 0 1px rgba(0, 0, 0, 0.05),
      0 10px 40px -10px rgba(0, 0, 0, 0.2),
      0 20px 25px -5px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    animation: slideIn 0.15s ease-out;
    display: flex;
    flex-direction: column;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .menu-search {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f3f4f6;
    color: #9ca3af;
  }

  .menu-search input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 0.875rem;
    color: #111827;
    outline: none;
  }

  .menu-search input::placeholder {
    color: #9ca3af;
  }

  .search-hint {
    font-size: 0.625rem;
    color: #d1d5db;
    padding: 0.125rem 0.375rem;
    background: #f9fafb;
    border-radius: 0.25rem;
  }

  .menu-list {
    flex: 1;
    padding: 0.5rem;
    overflow-y: auto;
  }

  .menu-category {
    padding: 0.5rem 0.75rem 0.375rem;
  }

  .category-title {
    font-size: 0.6875rem;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
  }

  .menu-item:hover,
  .menu-item.selected {
    background: #f3f4f6;
  }

  .menu-item.selected .item-shortcut {
    opacity: 1;
  }

  .item-icon {
    width: 2.25rem;
    height: 2.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    font-size: 1.125rem;
    flex-shrink: 0;
  }

  .item-icon.text-icon {
    font-size: 0.75rem;
    font-weight: 700;
    color: #374151;
    font-family: ui-monospace, monospace;
  }

  .item-content {
    display: flex;
    flex-direction: column;
    gap: 0.0625rem;
    min-width: 0;
    flex: 1;
  }

  .item-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #111827;
  }

  .item-description {
    font-size: 0.6875rem;
    color: #9ca3af;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-shortcut {
    font-size: 0.6875rem;
    color: #d1d5db;
    padding: 0.125rem 0.375rem;
    background: #f9fafb;
    border-radius: 0.25rem;
    opacity: 0;
    transition: opacity 0.1s;
  }

  .no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem 1rem;
    text-align: center;
    color: #9ca3af;
    font-size: 0.875rem;
  }

  .no-results-icon {
    font-size: 1.5rem;
    opacity: 0.5;
  }
</style>
