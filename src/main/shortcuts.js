const { globalShortcut } = require('electron');

/**
 * Global keyboard shortcuts manager for StickyPad.
 * Registers Ctrl/Cmd+Shift+N for instant quick note creation.
 */
class ShortcutManager {
  constructor(windowManager) {
    this.windowManager = windowManager;
  }

  registerShortcuts() {
    // Quick capture: CommandOrControl+Shift+N
    const shortcut = 'CommandOrControl+Shift+N';
    const registered = globalShortcut.register(shortcut, () => {
      this.windowManager.createNewNote({
        focus: true
      });
    });

    if (!registered) {
      console.warn(`[StickyPad Shortcuts] Failed to register global shortcut: ${shortcut}`);
    } else {
      console.log(`[StickyPad Shortcuts] Registered global shortcut: ${shortcut}`);
    }

    // All Notes / Search: CommandOrControl+Shift+F
    const searchShortcut = 'CommandOrControl+Shift+F';
    const searchRegistered = globalShortcut.register(searchShortcut, () => {
      this.windowManager.openAllNotesWindow();
    });

    if (!searchRegistered) {
      console.warn(`[StickyPad Shortcuts] Failed to register global shortcut: ${searchShortcut}`);
    } else {
      console.log(`[StickyPad Shortcuts] Registered global shortcut: ${searchShortcut}`);
    }
  }

  unregisterAll() {
    globalShortcut.unregisterAll();
  }
}

module.exports = ShortcutManager;
