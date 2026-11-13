const { Tray, Menu, app, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const storage = require('./storage');
const BackupManager = require('./backupManager');

/**
 * System tray integration for StickyPad.
 * Supports:
 * - New note creation
 * - Show / hide all notes
 * - Trash window
 * - Export & Import notes
 * - Launch at login setting
 * - Tray click toggling
 * - Clean quit
 */
class TrayManager {
  constructor(windowManager) {
    this.windowManager = windowManager;
    this.tray = null;
    this.allHidden = false;
  }

  createTray() {
    const iconPath = path.join(__dirname, '..', '..', 'assets', 'tray-icon.png');
    let trayIcon;

    if (fs.existsSync(iconPath)) {
      trayIcon = nativeImage.createFromPath(iconPath);
      // macOS dark mode template icon handling
      if (process.platform === 'darwin') {
        trayIcon.setTemplateImage(true);
      }
    } else {
      // Fallback empty icon if file somehow missing
      trayIcon = nativeImage.createEmpty();
    }

    this.tray = new Tray(trayIcon);
    this.tray.setToolTip('StickyPad — Digital Sticky Notes');

    this.updateContextMenu();

    // Single click toggles show/hide all
    this.tray.on('click', () => {
      this.toggleShowHide();
    });
  }

  getLaunchAtLogin() {
    try {
      const loginSettings = app.getLoginItemSettings();
      if (typeof loginSettings.openAtLogin === 'boolean') {
        return loginSettings.openAtLogin;
      }
    } catch (_) {}
    return Boolean(storage.getSetting('openAtLogin', false));
  }

  setLaunchAtLogin(enabled) {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: process.execPath
      });
    } catch (err) {
      console.warn('[TrayManager] Failed to setLoginItemSettings:', err.message);
    }
    storage.setSetting('openAtLogin', enabled);
    this.updateContextMenu();
  }

  updateContextMenu() {
    if (!this.tray) return;

    const count = this.windowManager.getOpenNoteCount();
    const trash = storage.loadTrash();
    const trashCount = trash.length;
    const archive = storage.loadArchive();
    const archiveCount = archive.length;
    const isLaunchAtLogin = this.getLaunchAtLogin();
    const isSoundsEnabled = storage.getSetting('soundsEnabled', true);
    const isAutoFadeArchive = storage.getSetting('autoFadeArchive', false);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'New Note',
        accelerator: 'CmdOrCtrl+Shift+N',
        click: () => {
          this.windowManager.createNewNote({ focus: true });
        }
      },
      {
        label: 'All notes',
        accelerator: 'CmdOrCtrl+Shift+F',
        click: () => {
          this.windowManager.openAllNotesWindow();
        }
      },
      { type: 'separator' },
      {
        label: 'Show All Notes',
        click: () => {
          this.windowManager.showAllNotes();
          this.allHidden = false;
        }
      },
      {
        label: 'Hide All Notes',
        click: () => {
          this.windowManager.hideAllNotes();
          this.allHidden = true;
        }
      },
      { type: 'separator' },
      {
        label: `Archive${archiveCount > 0 ? ` (${archiveCount})` : ''}`,
        click: () => {
          this.windowManager.openArchiveWindow();
        }
      },
      {
        label: `Trash${trashCount > 0 ? ` (${trashCount})` : ''}`,
        click: () => {
          this.windowManager.openTrashWindow();
        }
      },
      { type: 'separator' },
      {
        label: 'Sounds',
        type: 'checkbox',
        checked: isSoundsEnabled,
        click: (menuItem) => {
          storage.setSetting('soundsEnabled', menuItem.checked);
          this.updateContextMenu();
        }
      },
      {
        label: 'Auto-fade & archive inactive (7d)',
        type: 'checkbox',
        checked: isAutoFadeArchive,
        click: (menuItem) => {
          storage.setSetting('autoFadeArchive', menuItem.checked);
          if (menuItem.checked) {
            this.windowManager.checkAutoFadeAndArchive();
          }
          this.updateContextMenu();
        }
      },
      {
        label: 'Launch at login',
        type: 'checkbox',
        checked: isLaunchAtLogin,
        click: (menuItem) => {
          this.setLaunchAtLogin(menuItem.checked);
        }
      },
      { type: 'separator' },
      {
        label: 'Export all notes...',
        click: () => {
          BackupManager.exportAllNotes(null);
        }
      },
      {
        label: 'Import notes...',
        click: () => {
          BackupManager.importNotes(null, this.windowManager);
        }
      },
      { type: 'separator' },
      {
        label: `${count} active note${count === 1 ? '' : 's'}`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Quit StickyPad',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  toggleShowHide() {
    if (this.allHidden) {
      this.windowManager.showAllNotes();
      this.allHidden = false;
    } else {
      this.windowManager.hideAllNotes();
      this.allHidden = true;
    }
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = TrayManager;
