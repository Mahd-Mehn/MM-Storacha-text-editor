<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  interface SlashCommand {
    id: string;
    title: string;
    description: string;
    icon: string;
    keywords: string[];
    action: () => void;
  }

  interface Props {
    position: { x: number; y: number };
    onSelect: (command: SlashCommand) => void;
    onClose: () => void;
  }

  let { position, onSelect, onClose }: Props = $props();

  let searchQuery = $state("");
  let selectedIndex = $state(0);
  let menuElement: HTMLDivElement;

  const commands: SlashCommand[] = [
    {
      id: "heading1",
      title: "Heading 1",
      description: "Large section heading",
      icon: "H1",
      keywords: ["h1", "heading", "title"],
      action: () => console.log("Insert H1"),
    },
    {
      id: "heading2",
      title: "Heading 2",
      description: "Medium section heading",
      icon: "H2",
      keywords: ["h2", "heading", "subtitle"],
      action: () => console.log("Insert H2"),
    },
    {
      id: "heading3",
      title: "Heading 3",
      description: "Small section heading",
      icon: "H3",
      keywords: ["h3", "heading"],
      action: () => console.log("Insert H3"),
    },
    {
      id: "bulletList",
      title: "Bullet List",
      description: "Create a simple bullet list",
      icon: "•",
      keywords: ["ul", "list", "bullet"],
      action: () => console.log("Insert bullet list"),
    },
    {
      id: "numberedList",
      title: "Numbered List",
      description: "Create a numbered list",
      icon: "1.",
      keywords: ["ol", "list", "numbered", "ordered"],
      action: () => console.log("Insert numbered list"),
    },
    {
      id: "checkList",
      title: "To-do List",
      description: "Track tasks with a checklist",
      icon: "☑",
      keywords: ["todo", "task", "checkbox", "checklist"],
      action: () => console.log("Insert checklist"),
    },
    {
      id: "quote",
      title: "Quote",
      description: "Capture a quote",
      icon: '"',
      keywords: ["quote", "blockquote", "citation"],
      action: () => console.log("Insert quote"),
    },
    {
      id: "divider",
      title: "Divider",
      description: "Visually divide blocks",
      icon: "—",
      keywords: ["hr", "divider", "separator", "line"],
      action: () => console.log("Insert divider"),
    },
    {
      id: "code",
      title: "Code Block",
      description: "Insert a code snippet",
      icon: "</>",
      keywords: ["code", "snippet", "programming"],
      action: () => console.log("Insert code block"),
    },
    {
      id: "image",
      title: "Image",
      description: "Upload or embed an image",
      icon: "🖼",
      keywords: ["image", "picture", "photo", "upload"],
      action: () => console.log("Insert image"),
    },
    {
      id: "file",
      title: "File",
      description: "Attach a file",
      icon: "📎",
      keywords: ["file", "attachment", "upload"],
      action: () => console.log("Insert file"),
    },
    {
      id: "table",
      title: "Table",
      description: "Create a table",
      icon: "⊞",
      keywords: ["table", "grid", "spreadsheet"],
      action: () => console.log("Insert table"),
    },
  ];

  const filteredCommands = $derived(
    searchQuery.trim() === ""
      ? commands
      : commands.filter((cmd) => {
          const query = searchQuery.toLowerCase();
          return (
            cmd.title.toLowerCase().includes(query) ||
            cmd.description.toLowerCase().includes(query) ||
            cmd.keywords.some((kw) => kw.includes(query))
          );
        })
  );

  function handleKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        selectedIndex = (selectedIndex + 1) % filteredCommands.length;
        scrollToSelected();
        break;
      case "ArrowUp":
        event.preventDefault();
        selectedIndex =
          selectedIndex === 0 ? filteredCommands.length - 1 : selectedIndex - 1;
        scrollToSelected();
        break;
      case "Enter":
        event.preventDefault();
        if (filteredCommands[selectedIndex]) {
          selectCommand(filteredCommands[selectedIndex]);
        }
        break;
      case "Escape":
        event.preventDefault();
        onClose();
        break;
    }
  }

  function selectCommand(command: SlashCommand) {
    onSelect(command);
    onClose();
  }

  function scrollToSelected() {
    const selectedElement = menuElement?.querySelector(
      `[data-index="${selectedIndex}"]`
    );
    selectedElement?.scrollIntoView({ block: "nearest" });
  }

  function handleClickOutside(event: MouseEvent) {
    if (menuElement && !menuElement.contains(event.target as Node)) {
      onClose();
    }
  }

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    // Reset selected index when search changes
    selectedIndex = 0;
  });

  onDestroy(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  $effect(() => {
    // Reset selected index when filtered commands change
    if (selectedIndex >= filteredCommands.length) {
      selectedIndex = 0;
    }
  });
</script>

<div
  bind:this={menuElement}
  class="slash-menu"
  style="left: {position.x}px; top: {position.y}px;"
  role="menu"
  onkeydown={handleKeyDown}
>
  <div class="slash-menu-search">
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="Search commands..."
      autofocus
      class="slash-menu-input"
    />
  </div>

  <div class="slash-menu-items">
    {#if filteredCommands.length > 0}
      {#each filteredCommands as command, index}
        <button
          class="slash-menu-item"
          class:selected={index === selectedIndex}
          data-index={index}
          onclick={() => selectCommand(command)}
          onmouseenter={() => (selectedIndex = index)}
          role="menuitem"
        >
          <span class="slash-menu-icon">{command.icon}</span>
          <div class="slash-menu-content">
            <div class="slash-menu-title">{command.title}</div>
            <div class="slash-menu-description">{command.description}</div>
          </div>
        </button>
      {/each}
    {:else}
      <div class="slash-menu-empty">No commands found</div>
    {/if}
  </div>
</div>

<style>
  .slash-menu {
    position: fixed;
    z-index: 1000;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    min-width: 320px;
    max-width: 400px;
    max-height: 400px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .slash-menu-search {
    padding: 12px;
    border-bottom: 1px solid #e0e0e0;
  }

  .slash-menu-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  .slash-menu-input:focus {
    border-color: #4f46e5;
  }

  .slash-menu-items {
    overflow-y: auto;
    max-height: 340px;
    padding: 4px;
  }

  .slash-menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.15s;
  }

  .slash-menu-item:hover,
  .slash-menu-item.selected {
    background: #f3f4f6;
  }

  .slash-menu-icon {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f9fafb;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 600;
  }

  .slash-menu-content {
    flex: 1;
    min-width: 0;
  }

  .slash-menu-title {
    font-size: 14px;
    font-weight: 500;
    color: #111827;
    margin-bottom: 2px;
  }

  .slash-menu-description {
    font-size: 12px;
    color: #6b7280;
  }

  .slash-menu-empty {
    padding: 20px;
    text-align: center;
    color: #9ca3af;
    font-size: 14px;
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .slash-menu {
      background: #1f2937;
      border-color: #374151;
    }

    .slash-menu-search {
      border-bottom-color: #374151;
    }

    .slash-menu-input {
      background: #111827;
      border-color: #374151;
      color: #f9fafb;
    }

    .slash-menu-input:focus {
      border-color: #6366f1;
    }

    .slash-menu-item:hover,
    .slash-menu-item.selected {
      background: #374151;
    }

    .slash-menu-icon {
      background: #374151;
    }

    .slash-menu-title {
      color: #f9fafb;
    }

    .slash-menu-description {
      color: #9ca3af;
    }

    .slash-menu-empty {
      color: #6b7280;
    }
  }
</style>
