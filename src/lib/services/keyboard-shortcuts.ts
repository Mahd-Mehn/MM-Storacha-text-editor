/**
 * Keyboard Shortcuts Service
 * Manages global keyboard shortcuts for the application
 */

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
  category: 'navigation' | 'editing' | 'formatting' | 'general';
}

class KeyboardShortcutsService {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private enabled = true;

  constructor() {
    this.setupDefaultShortcuts();
    this.attachListener();
  }

  /**
   * Register a keyboard shortcut
   */
  register(id: string, shortcut: KeyboardShortcut): void {
    this.shortcuts.set(id, shortcut);
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  /**
   * Get all registered shortcuts
   */
  getAll(): Map<string, KeyboardShortcut> {
    return new Map(this.shortcuts);
  }

  /**
   * Get shortcuts by category
   */
  getByCategory(category: KeyboardShortcut['category']): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values()).filter(
      (shortcut) => shortcut.category === category
    );
  }

  /**
   * Enable or disable shortcuts
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if a keyboard event matches a shortcut
   */
  private matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    
    // Check key
    if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
      return false;
    }

    // Check modifiers
    const ctrlKey = isMac ? event.metaKey : event.ctrlKey;
    const metaKey = isMac ? event.metaKey : event.ctrlKey;

    if (shortcut.ctrl && !ctrlKey) return false;
    if (shortcut.meta && !metaKey) return false;
    if (shortcut.shift && !event.shiftKey) return false;
    if (shortcut.alt && !event.altKey) return false;

    // Check that no extra modifiers are pressed
    if (!shortcut.ctrl && !shortcut.meta && (event.ctrlKey || event.metaKey)) return false;
    if (!shortcut.shift && event.shiftKey) return false;
    if (!shortcut.alt && event.altKey) return false;

    return true;
  }

  /**
   * Handle keyboard events
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;

    // Don't trigger shortcuts when typing in input fields (except for specific shortcuts)
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || 
                    target.tagName === 'TEXTAREA' || 
                    target.isContentEditable;

    for (const [id, shortcut] of this.shortcuts) {
      if (this.matchesShortcut(event, shortcut)) {
        // Allow certain shortcuts even in input fields (like Cmd+K)
        if (isInput && !['quick-switcher', 'save'].includes(id)) {
          continue;
        }

        event.preventDefault();
        event.stopPropagation();
        shortcut.action();
        break;
      }
    }
  };

  /**
   * Attach keyboard event listener
   */
  private attachListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
    }
  }

  /**
   * Detach keyboard event listener
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
    }
  }

  /**
   * Setup default shortcuts (will be overridden by app)
   */
  private setupDefaultShortcuts(): void {
    // These are placeholders - actual actions will be registered by components
  }

  /**
   * Get shortcut display string
   */
  static getShortcutDisplay(shortcut: KeyboardShortcut): string {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const parts: string[] = [];

    if (shortcut.ctrl || shortcut.meta) {
      parts.push(isMac ? '⌘' : 'Ctrl');
    }
    if (shortcut.shift) {
      parts.push(isMac ? '⇧' : 'Shift');
    }
    if (shortcut.alt) {
      parts.push(isMac ? '⌥' : 'Alt');
    }
    parts.push(shortcut.key.toUpperCase());

    return parts.join(isMac ? '' : '+');
  }
}

// Export singleton instance
export const keyboardShortcuts = new KeyboardShortcutsService();
