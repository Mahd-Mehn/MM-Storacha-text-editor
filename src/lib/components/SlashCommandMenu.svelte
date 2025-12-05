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

  const commands = [
    { id: 'paragraph', icon: '📝', label: 'Text', description: 'Just start writing with plain text' },
    { id: 'heading1', icon: 'H1', label: 'Heading 1', description: 'Big section heading' },
    { id: 'heading2', icon: 'H2', label: 'Heading 2', description: 'Medium section heading' },
    { id: 'heading3', icon: 'H3', label: 'Heading 3', description: 'Small section heading' },
    { id: 'bullet-list', icon: '•', label: 'Bulleted List', description: 'Create a simple bulleted list' },
    { id: 'numbered-list', icon: '1.', label: 'Numbered List', description: 'Create a numbered list' },
    { id: 'todo', icon: '☐', label: 'To-do List', description: 'Track tasks with a to-do list' },
    { id: 'quote', icon: '"', label: 'Quote', description: 'Capture a quote' },
    { id: 'divider', icon: '—', label: 'Divider', description: 'Visually divide blocks' },
    { id: 'code', icon: '</>', label: 'Code', description: 'Capture a code snippet' },
    { id: 'callout', icon: '💡', label: 'Callout', description: 'Make writing stand out' },
  ];

  let filteredCommands = $derived(
    searchQuery
      ? commands.filter(cmd => 
          cmd.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cmd.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : commands
  );

  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = (selectedIndex + 1) % filteredCommands.length;
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
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

  function selectCommand(commandId: string) {
    onSelect?.(commandId);
    onClose?.();
  }

  function handleClickOutside(event: MouseEvent) {
    if (menuRef && !menuRef.contains(event.target as Node)) {
      onClose?.();
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('mousedown', handleClickOutside);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('mousedown', handleClickOutside);
  });

  // Reset selection when filtered commands change
  $effect(() => {
    if (filteredCommands.length > 0 && selectedIndex >= filteredCommands.length) {
      selectedIndex = 0;
    }
  });
</script>

{#if isOpen}
  <div 
    class="slash-menu"
    bind:this={menuRef}
    style="left: {position.x}px; top: {position.y}px;"
  >
    <div class="menu-header">
      <span class="menu-title">Basic blocks</span>
    </div>
    
    <div class="menu-list">
      {#each filteredCommands as command, index (command.id)}
        <button
          class="menu-item"
          class:selected={index === selectedIndex}
          onclick={() => selectCommand(command.id)}
          onmouseenter={() => selectedIndex = index}
        >
          <span class="item-icon" class:text-icon={command.icon.length > 2}>
            {command.icon}
          </span>
          <div class="item-content">
            <span class="item-label">{command.label}</span>
            <span class="item-description">{command.description}</span>
          </div>
        </button>
      {/each}
      
      {#if filteredCommands.length === 0}
        <div class="no-results">
          No results found
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .slash-menu {
    position: fixed;
    z-index: 1000;
    width: 320px;
    max-height: 400px;
    background: white;
    border-radius: 0.75rem;
    box-shadow: 
      0 0 0 1px rgba(0, 0, 0, 0.05),
      0 10px 40px -10px rgba(0, 0, 0, 0.2),
      0 20px 25px -5px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    animation: slideIn 0.15s ease-out;
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

  .menu-header {
    padding: 0.75rem 1rem 0.5rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .menu-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .menu-list {
    padding: 0.5rem;
    max-height: 340px;
    overflow-y: auto;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
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

  .item-icon {
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .item-icon.text-icon {
    font-size: 0.875rem;
    font-weight: 700;
    color: #374151;
  }

  .item-content {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  .item-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #111827;
  }

  .item-description {
    font-size: 0.75rem;
    color: #6b7280;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .no-results {
    padding: 1rem;
    text-align: center;
    color: #9ca3af;
    font-size: 0.875rem;
  }
</style>
