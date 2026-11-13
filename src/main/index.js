const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const WindowManager = require('./windowManager');
const TrayManager = require('./tray');
const ShortcutManager = require('./shortcuts');

// Global Error Handling & Local File Logging (Item 23)
function logError(err, context = '') {
  console.error(`[StickyPad Unhandled ${context}]`, err);
  try {
    const logPath = path.join(app.getPath('userData'), 'stickypad-error.log');
    const msg = err && err.stack ? err.stack : (err && err.message ? err.message : String(err));
    const entry = `[${new Date().toISOString()}] [${context}] ${msg}\n`;
    fs.appendFileSync(logPath, entry, 'utf8');
  } catch (_) {}
}

process.on('uncaughtException', (err) => {
  logError(err, 'uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logError(reason, 'unhandledRejection');
});

// Prevent multiple instances running at the same time
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

const windowManager = new WindowManager();
const trayManager = new TrayManager(windowManager);
windowManager.setTrayManager(trayManager);
const shortcutManager = new ShortcutManager(windowManager);

// Sender & Input Validation Helpers (Item 3)
function isTrustedSender(event) {
  if (!event || !event.senderFrame) return true;
  const senderUrl = event.senderFrame.url || '';
  return senderUrl.startsWith('file://');
}

function isValidNoteId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 100 && /^[a-zA-Z0-9_-]+$/.test(id);
}

const ALLOWED_SETTING_KEYS = new Set([
  'openAtLogin', 'soundsEnabled', 'autoFadeArchive', 'fadeDays', 'archiveDays'
]);

// Handle second instance launch (e.g. user clicked shortcut while already running)
app.on('second-instance', () => {
  if (windowManager.getOpenNoteCount() === 0) {
    windowManager.createNewNote({ focus: true });
  } else {
    windowManager.showAllNotes();
  }
});

// App Lifecycle
app.whenReady().then(() => {
  // Set app user model ID for Windows notifications & taskbar grouping
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.stickypad.app');
  }

  // 1. Initialize System Tray
  trayManager.createTray();

  // 2. Register Global Shortcuts (Ctrl/Cmd+Shift+N)
  shortcutManager.registerShortcuts();

  // 3. Restore saved sticky notes from disk
  windowManager.restoreNotes();

  // macOS dock behavior
  app.on('activate', () => {
    if (windowManager.getOpenNoteCount() === 0) {
      windowManager.createNewNote({ focus: true });
    } else {
      windowManager.showAllNotes();
    }
  });
});

// Setup IPC communication channels with renderer windows
ipcMain.on('save-note', (event, noteData) => {
  if (!isTrustedSender(event)) return;
  if (!noteData || typeof noteData !== 'object' || !isValidNoteId(noteData.id)) return;
  windowManager.handleSaveNote(noteData);
});

ipcMain.on('resize-note', (event, payload) => {
  if (!isTrustedSender(event)) return;
  if (!payload || !isValidNoteId(payload.noteId)) return;
  const width = typeof payload.width === 'number' ? Math.max(220, Math.min(800, Math.round(payload.width))) : 320;
  const height = typeof payload.height === 'number' ? Math.max(160, Math.min(800, Math.round(payload.height))) : 360;
  const x = typeof payload.x === 'number' ? Math.round(payload.x) : undefined;
  const y = typeof payload.y === 'number' ? Math.round(payload.y) : undefined;
  windowManager.handleResizeNote(payload.noteId, width, height, x, y);
});

ipcMain.on('create-new-note', (event, preset) => {
  if (!isTrustedSender(event)) return;
  windowManager.createNewNote(preset && typeof preset === 'object' ? preset : {});
});

ipcMain.on('delete-note', (event, noteId) => {
  if (!isTrustedSender(event)) return;
  if (!isValidNoteId(noteId)) return;
  windowManager.handleDeleteNote(noteId);
});

ipcMain.on('set-always-on-top', (event, payload) => {
  if (!isTrustedSender(event)) return;
  if (!payload || !isValidNoteId(payload.noteId)) return;
  windowManager.handleSetAlwaysOnTop(payload.noteId, Boolean(payload.isPinned));
});

ipcMain.on('set-collapsed', (event, payload) => {
  if (!isTrustedSender(event)) return;
  if (!payload || !isValidNoteId(payload.noteId)) return;
  windowManager.handleSetCollapsed(payload.noteId, Boolean(payload.isCollapsed));
});

ipcMain.on('set-opacity', (event, payload) => {
  if (!isTrustedSender(event)) return;
  if (!payload || !isValidNoteId(payload.noteId)) return;
  const opacity = typeof payload.opacity === 'number' ? Math.max(0.1, Math.min(1.0, payload.opacity)) : 1.0;
  windowManager.handleSetOpacity(payload.noteId, opacity);
});

ipcMain.on('set-ignore-mouse-events', (event, payload) => {
  if (!isTrustedSender(event)) return;
  if (!payload || !isValidNoteId(payload.noteId)) return;
  windowManager.handleSetIgnoreMouseEvents(payload.noteId, Boolean(payload.ignore), Boolean(payload.forward));
});

ipcMain.on('start-window-drag', (event, payload) => {
  if (!isTrustedSender(event)) return;
  if (!payload || !isValidNoteId(payload.noteId)) return;
  windowManager.handleStartDrag(payload.noteId, Number(payload.screenX) || 0, Number(payload.screenY) || 0);
});

ipcMain.on('move-window-delta', (event, payload) => {
  if (!isTrustedSender(event)) return;
  if (!payload || !isValidNoteId(payload.noteId)) return;
  windowManager.handleMoveWindowDelta(payload.noteId, Number(payload.dx) || 0, Number(payload.dy) || 0, Boolean(payload.shiftKey));
});

ipcMain.on('end-window-drag', (event, payload) => {
  if (!isTrustedSender(event)) return;
  if (!payload || !isValidNoteId(payload.noteId)) return;
  windowManager.handleEndDrag(payload.noteId);
});

ipcMain.on('set-locked', (event, payload) => {
  if (!isTrustedSender(event)) return;
  if (!payload || !isValidNoteId(payload.noteId)) return;
  windowManager.handleSetLocked(payload.noteId, Boolean(payload.isLocked));
});

// All Notes & Search IPCs
ipcMain.on('open-all-notes-window', (event) => {
  if (!isTrustedSender(event)) return;
  windowManager.openAllNotesWindow();
});

ipcMain.handle('get-all-notes', (event) => {
  if (!isTrustedSender(event)) return [];
  const storage = require('./storage');
  return storage.loadAllNotes();
});

ipcMain.on('focus-note', (event, payload) => {
  if (!isTrustedSender(event)) return;
  if (!payload || !isValidNoteId(payload.noteId)) return;
  windowManager.focusNote(payload.noteId);
});

// Templates IPCs
ipcMain.handle('get-templates', (event) => {
  if (!isTrustedSender(event)) return [];
  const templates = require('./templates');
  return templates;
});

ipcMain.on('create-note-from-template', (event, payload) => {
  if (!isTrustedSender(event)) return;
  if (!payload || typeof payload.templateId !== 'string') return;
  windowManager.createNoteFromTemplate(payload.templateId);
});

// Reminder IPCs
ipcMain.on('set-reminder', (event, payload) => {
  if (!isTrustedSender(event)) return;
  if (!payload || !isValidNoteId(payload.noteId)) return;
  windowManager.handleSetReminder(payload.noteId, payload.reminderData);
});

ipcMain.on('cancel-reminder', (event, payload) => {
  if (!isTrustedSender(event)) return;
  if (!payload || !isValidNoteId(payload.noteId)) return;
  windowManager.handleCancelReminder(payload.noteId);
});

// Trash & Undo IPCs
ipcMain.on('undo-trash', (event) => {
  if (!isTrustedSender(event)) return;
  windowManager.handleUndoTrash();
});

ipcMain.on('open-trash-window', (event) => {
  if (!isTrustedSender(event)) return;
  windowManager.openTrashWindow();
});

ipcMain.handle('get-trash', (event) => {
  if (!isTrustedSender(event)) return [];
  const storage = require('./storage');
  return storage.loadTrash();
});

ipcMain.on('restore-from-trash', (event, payload) => {
  if (!isTrustedSender(event)) return;
  if (!payload || !isValidNoteId(payload.noteId)) return;
  windowManager.handleRestoreFromTrash(payload.noteId);
});

ipcMain.on('delete-forever', (event, payload) => {
  if (!isTrustedSender(event)) return;
  if (!payload || !isValidNoteId(payload.noteId)) return;
  windowManager.handleDeleteForever(payload.noteId);
});

ipcMain.on('empty-trash', (event) => {
  if (!isTrustedSender(event)) return;
  windowManager.handleEmptyTrash();
});

// Archive IPCs
ipcMain.on('open-archive-window', (event) => {
  if (!isTrustedSender(event)) return;
  windowManager.openArchiveWindow();
});

ipcMain.handle('get-archive', (event) => {
  if (!isTrustedSender(event)) return [];
  const storage = require('./storage');
  return storage.loadArchive();
});

ipcMain.on('restore-from-archive', (event, payload) => {
  if (!isTrustedSender(event)) return;
  if (!payload || !isValidNoteId(payload.noteId)) return;
  windowManager.handleRestoreFromArchive(payload.noteId);
});

ipcMain.on('delete-from-archive', (event, payload) => {
  if (!isTrustedSender(event)) return;
  if (!payload || !isValidNoteId(payload.noteId)) return;
  windowManager.handleDeleteFromArchive(payload.noteId);
});

ipcMain.on('empty-archive', (event) => {
  if (!isTrustedSender(event)) return;
  windowManager.handleEmptyArchive();
});

ipcMain.handle('get-setting', (event, payload) => {
  if (!isTrustedSender(event)) return null;
  const key = payload?.key;
  if (!ALLOWED_SETTING_KEYS.has(key)) return payload?.defaultValue ?? null;
  const storage = require('./storage');
  return storage.getSetting(key, payload.defaultValue);
});

ipcMain.on('set-setting', (event, payload) => {
  if (!isTrustedSender(event)) return;
  const key = payload?.key;
  if (!ALLOWED_SETTING_KEYS.has(key)) return;
  const storage = require('./storage');
  storage.setSetting(key, payload.value);
  if (key === 'autoFadeArchive' && payload.value) {
    windowManager.checkAutoFadeAndArchive();
  }
  if (trayManager) {
    trayManager.updateContextMenu();
  }
});

// Backup & Export IPCs
ipcMain.handle('export-all-notes', async (event) => {
  if (!isTrustedSender(event)) return { success: false, error: 'Unauthorized sender' };
  const BackupManager = require('./backupManager');
  return await BackupManager.exportAllNotes(null);
});

ipcMain.handle('import-notes', async (event) => {
  if (!isTrustedSender(event)) return { success: false, error: 'Unauthorized sender' };
  const BackupManager = require('./backupManager');
  return await BackupManager.importNotes(null, windowManager);
});

ipcMain.handle('export-note-image', async (event, payload) => {
  if (!isTrustedSender(event)) return { success: false, error: 'Unauthorized sender' };
  if (!payload || !isValidNoteId(payload.noteId)) return { success: false, error: 'Invalid note ID' };
  return await windowManager.handleExportImage(payload.noteId, payload.action, Boolean(payload.transparentBg));
});

// Flush any pending debounced saves across all notes on quit
app.on('before-quit', () => {
  app.isQuitting = true;
  windowManager.windows.forEach(win => {
    if (win && !win.isDestroyed()) {
      try {
        win.webContents.send('flush-pending-save');
      } catch (_) {}
    }
  });
});

// Keep background process alive when notes are closed so tray and global shortcuts remain active
app.on('window-all-closed', () => {
  if (app.isQuitting) {
    app.quit();
  }
});

app.on('will-quit', () => {
  shortcutManager.unregisterAll();
  trayManager.destroy();
});
