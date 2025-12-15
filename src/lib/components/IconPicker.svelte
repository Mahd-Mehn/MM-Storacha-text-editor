<script lang="ts">
  interface Props {
    currentIcon?: string;
    onSelect: (icon: string) => void;
    onClose: () => void;
  }

  let { currentIcon = "📄", onSelect, onClose }: Props = $props();

  let searchQuery = $state("");
  let selectedCategory = $state("all");

  const iconCategories = {
    all: "All",
    smileys: "Smileys & People",
    animals: "Animals & Nature",
    food: "Food & Drink",
    activities: "Activities",
    travel: "Travel & Places",
    objects: "Objects",
    symbols: "Symbols",
    flags: "Flags",
  };

  const icons = {
    smileys: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😅",
      "😂",
      "🤣",
      "😊",
      "😇",
      "🙂",
      "🙃",
      "😉",
      "😌",
      "😍",
      "🥰",
      "😘",
      "😗",
      "😙",
      "😚",
      "😋",
      "😛",
      "😝",
      "😜",
      "🤪",
      "🤨",
      "🧐",
      "🤓",
      "😎",
      "🤩",
      "🥳",
    ],
    animals: [
      "🐶",
      "🐱",
      "🐭",
      "🐹",
      "🐰",
      "🦊",
      "🐻",
      "🐼",
      "🐨",
      "🐯",
      "🦁",
      "🐮",
      "🐷",
      "🐸",
      "🐵",
      "🐔",
      "🐧",
      "🐦",
      "🐤",
      "🦆",
      "🦅",
      "🦉",
      "🦇",
      "🐺",
      "🐗",
      "🐴",
      "🦄",
      "🐝",
      "🐛",
      "🦋",
    ],
    food: [
      "🍎",
      "🍊",
      "🍋",
      "🍌",
      "🍉",
      "🍇",
      "🍓",
      "🍈",
      "🍒",
      "🍑",
      "🥭",
      "🍍",
      "🥥",
      "🥝",
      "🍅",
      "🍆",
      "🥑",
      "🥦",
      "🥬",
      "🥒",
      "🌶",
      "🌽",
      "🥕",
      "🧄",
      "🧅",
      "🥔",
      "🍠",
      "🥐",
      "🥯",
      "🍞",
    ],
    activities: [
      "⚽",
      "🏀",
      "🏈",
      "⚾",
      "🥎",
      "🎾",
      "🏐",
      "🏉",
      "🥏",
      "🎱",
      "🪀",
      "🏓",
      "🏸",
      "🏒",
      "🏑",
      "🥍",
      "🏏",
      "🪃",
      "🥅",
      "⛳",
      "🪁",
      "🏹",
      "🎣",
      "🤿",
      "🥊",
      "🥋",
      "🎽",
      "🛹",
      "🛼",
      "🛷",
    ],
    travel: [
      "🚗",
      "🚕",
      "🚙",
      "🚌",
      "🚎",
      "🏎",
      "🚓",
      "🚑",
      "🚒",
      "🚐",
      "🛻",
      "🚚",
      "🚛",
      "🚜",
      "🦯",
      "🦽",
      "🦼",
      "🛴",
      "🚲",
      "🛵",
      "🏍",
      "🛺",
      "🚨",
      "🚔",
      "🚍",
      "🚘",
      "🚖",
      "🚡",
      "🚠",
      "🚟",
    ],
    objects: [
      "⌚",
      "📱",
      "📲",
      "💻",
      "⌨",
      "🖥",
      "🖨",
      "🖱",
      "🖲",
      "🕹",
      "🗜",
      "💾",
      "💿",
      "📀",
      "📼",
      "📷",
      "📸",
      "📹",
      "🎥",
      "📽",
      "🎞",
      "📞",
      "☎",
      "📟",
      "📠",
      "📺",
      "📻",
      "🎙",
      "🎚",
      "🎛",
    ],
    symbols: [
      "❤",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "🤎",
      "💔",
      "❣",
      "💕",
      "💞",
      "💓",
      "💗",
      "💖",
      "💘",
      "💝",
      "💟",
      "☮",
      "✝",
      "☪",
      "🕉",
      "☸",
      "✡",
      "🔯",
      "🕎",
      "☯",
      "☦",
      "🛐",
    ],
    flags: [
      "🏁",
      "🚩",
      "🎌",
      "🏴",
      "🏳",
      "🏳️‍🌈",
      "🏳️‍⚧️",
      "🏴‍☠️",
      "🇺🇳",
      "🇦🇫",
      "🇦🇱",
      "🇩🇿",
      "🇦🇸",
      "🇦🇩",
      "🇦🇴",
      "🇦🇮",
      "🇦🇶",
      "🇦🇬",
      "🇦🇷",
      "🇦🇲",
      "🇦🇼",
      "🇦🇺",
      "🇦🇹",
      "🇦🇿",
      "🇧🇸",
      "🇧🇭",
      "🇧🇩",
      "🇧🇧",
      "🇧🇾",
    ],
  };

  const allIcons = $derived(Object.values(icons).flat());

  const filteredIcons = $derived(() => {
    let iconList =
      selectedCategory === "all"
        ? allIcons
        : icons[selectedCategory as keyof typeof icons] || [];

    if (searchQuery.trim()) {
      // For simplicity, we can't really search emojis by name without a library
      // So we'll just show all icons when searching
      iconList = allIcons;
    }

    return iconList;
  });

  function handleIconSelect(icon: string) {
    onSelect(icon);
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

<div
  class="modal-backdrop"
  onclick={handleBackdropClick}
  onkeydown={handleKeyDown}
  role="dialog"
  aria-modal="true"
>
  <div class="modal-content">
    <div class="modal-header">
      <h2>Choose an Icon</h2>
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
          placeholder="Search icons..."
          class="search-input"
        />
      </div>

      <div class="categories">
        {#each Object.entries(iconCategories) as [key, label]}
          <button
            class="category-btn"
            class:active={selectedCategory === key}
            onclick={() => (selectedCategory = key)}
          >
            {label}
          </button>
        {/each}
      </div>

      <div class="icons-grid">
        {#each filteredIcons() as icon}
          <button
            class="icon-btn"
            class:selected={icon === currentIcon}
            onclick={() => handleIconSelect(icon)}
            title={icon}
          >
            {icon}
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>

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
    display: flex;
    flex-direction: column;
    gap: 20px;
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

  .categories {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .category-btn {
    padding: 6px 12px;
    border: 1px solid #e5e7eb;
    background: white;
    border-radius: 6px;
    font-size: 13px;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .category-btn:hover {
    border-color: #4f46e5;
    color: #4f46e5;
  }

  .category-btn.active {
    background: #4f46e5;
    border-color: #4f46e5;
    color: white;
  }

  .icons-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
    gap: 8px;
    max-height: 400px;
    overflow-y: auto;
  }

  .icon-btn {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    background: #f9fafb;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .icon-btn:hover {
    background: #f3f4f6;
    transform: scale(1.1);
  }

  .icon-btn.selected {
    border-color: #4f46e5;
    background: #eef2ff;
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

    .category-btn {
      background: #111827;
      border-color: #374151;
      color: #9ca3af;
    }

    .category-btn:hover {
      border-color: #6366f1;
      color: #6366f1;
    }

    .category-btn.active {
      background: #6366f1;
      border-color: #6366f1;
      color: white;
    }

    .icon-btn {
      background: #111827;
    }

    .icon-btn:hover {
      background: #374151;
    }

    .icon-btn.selected {
      border-color: #6366f1;
      background: #312e81;
    }
  }
</style>
