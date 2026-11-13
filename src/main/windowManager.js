const { BrowserWindow, screen, app } = require('electron');
const path = require('path');
const storage = require('./storage');
const ReminderManager = require('./reminderManager');
const { sanitizeNoteHtml } = require('../common/sanitizer');

/**
 * Attaches standard security guards to a window:
 * Blocks new window creation and external navigation.
 */
function secureWindow(win) {
  if (!win) return;
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
}

/**
 * WindowManager tracks and coordinates all active sticky note windows.
 */
class WindowManager {
  constructor() {
    this.windows = new Map(); // noteId -> BrowserWindow
    this.notesData = new Map(); // noteId -> noteData
    this.trayManager = null;
    this.debounceTimers = new Map(); // noteId -> timer
    this.activeDrags = new Map(); // noteId -> { width, height, startX, startY }
    this.reminderManager = new ReminderManager(this);
    this.trashWindow = null;
    this.allNotesWindow = null;
    this.archiveWindow = null;
  }

  notifyAllNotesUpdated() {
    if (this.allNotesWindow && !this.allNotesWindow.isDestroyed()) {
      this.allNotesWindow.webContents.send('all-notes-updated', storage.loadAllNotes());
    }
  }

  notifyArchiveUpdated() {
    if (this.archiveWindow && !this.archiveWindow.isDestroyed()) {
      this.archiveWindow.webContents.send('archive-updated', storage.loadArchive());
    }
  }

  debounceSave(noteId) {
    if (this.debounceTimers.has(noteId)) {
      clearTimeout(this.debounceTimers.get(noteId));
    }
    this.debounceTimers.set(
      noteId,
      setTimeout(() => {
        const data = this.notesData.get(noteId);
        if (data) {
          storage.saveNote(data);
          this.notifyAllNotesUpdated();
        }
        this.debounceTimers.delete(noteId);
      }, 500)
    );
  }

  setTrayManager(trayManager) {
    this.trayManager = trayManager;
  }

  getOpenNoteCount() {
    return this.windows.size;
  }

  /**
   * Initialize and restore all notes from persistent storage.
   */
  restoreNotes() {
    this.checkAutoFadeAndArchive();
    const savedNotes = storage.loadAllNotes();
    if (savedNotes.length === 0) {
      this.createNewNote({ isDefault: true });
    } else {
      savedNotes.forEach(note => {
        this.createNoteWindow(note);
      });
    }
    this.reminderManager.init();
  }

  /**
   * Clamps and guarantees note coordinates are on an active display workArea.
   * If detached or off-screen, snaps to primary display.
   */
  ensureVisibleCoordinates(x, y, width = 320, height = 360) {
    try {
      const displays = screen.getAllDisplays();
      const isVisibleOnAnyDisplay = displays.some(d => {
        const { x: dx, y: dy, width: dw, height: dh } = d.workArea;
        return typeof x === 'number' && typeof y === 'number' &&
               x < dx + dw - 40 && x + width > dx + 40 &&
               y < dy + dh - 40 && y + height > dy + 40;
      });
      if (isVisibleOnAnyDisplay) {
        return { x, y };
      }
      const primary = screen.getPrimaryDisplay().workArea;
      return {
        x: Math.max(primary.x, Math.min(primary.x + primary.width - width, primary.x + 80)),
        y: Math.max(primary.y, Math.min(primary.y + primary.height - height, primary.y + 80))
      };
    } catch (_) {
      return { x: 100, y: 100 };
    }
  }

  /**
   * Determine safe default coordinates for a new note on the active display.
   */
  calculateNextPosition(preferredX, preferredY, width = 300, height = 340) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { workArea } = primaryDisplay;

    if (preferredX !== undefined && preferredY !== undefined) {
      return {
        x: Math.min(Math.max(workArea.x, preferredX), workArea.x + workArea.width - width),
        y: Math.min(Math.max(workArea.y, preferredY), workArea.y + workArea.height - height)
      };
    }

    // Offset based on open windows count so notes cascade nicely
    const count = this.windows.size;
    const offset = (count * 30) % 240;
    const x = workArea.x + 100 + offset;
    const y = workArea.y + 80 + offset;

    return { x, y };
  }

  /**
   * Create a new note with default fields and open its window.
   */
  createNewNote(options = {}) {
    const id = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const { x, y } = this.calculateNextPosition(options.x, options.y, 320, 360);

    // Pick random paper style and random color from the 8 palettes
    const styles = ['classic', 'corner-curl', 'bent-edge', 'wavy-curl', 'taped'];
    const chosenStyle = options.paperStyle || styles[Math.floor(Math.random() * styles.length)];

    const colors = ['yellow', 'peach', 'pink', 'purple', 'blue', 'green', 'taupe', 'teal'];
    let chosenColor = options.color || colors[Math.floor(Math.random() * colors.length)];
    if (chosenColor === 'dark') chosenColor = 'teal';

    // Visible tilt: 2-3 degrees for classic/taped, -1.5 to +2.0 for others
    let calculatedTilt;
    if (chosenStyle === 'classic' || chosenStyle === 'taped') {
      const sign = Math.random() > 0.5 ? 1 : -1;
      calculatedTilt = Math.round(sign * (2.0 + Math.random() * 1.0) * 10) / 10;
    } else {
      calculatedTilt = Math.round((-1.5 + Math.random() * 3.0) * 10) / 10;
    }

    const newNote = {
      id,
      x,
      y,
      width: 320,
      height: 360,
      content: options.content !== undefined ? options.content : '',
      color: chosenColor,
      fontFamily: options.fontFamily || 'sans',
      fontSize: options.fontSize || 16,
      opacity: options.opacity !== undefined ? options.opacity : 1.0, // 100% solid paper
      tilt: options.tilt !== undefined ? options.tilt : calculatedTilt,
      paperStyle: chosenStyle,
      isPinned: false,
      isCollapsed: false,
      isLocked: options.isLocked !== undefined ? options.isLocked : false,
      isAutoFaded: Boolean(options.isAutoFaded),
      stickers: Array.isArray(options.stickers) ? options.stickers : [],
      doodles: options.doodles || null,
      timer: options.timer || null,
      collapsedHeight: 82,
      expandedHeight: 360,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Save to storage
    storage.saveNote(newNote);
    this.notifyAllNotesUpdated();

    // Open window
    const win = this.createNoteWindow(newNote);
    if (options.focus !== false && win) {
      win.focus();
    }
    return win;
  }

  /**
   * Create a new note from a template definition.
   */
  createNoteFromTemplate(templateId) {
    const templates = require('./templates');
    const tpl = templates.find(t => t.id === templateId) || templates[0];

    const styles = ['classic', 'corner-curl', 'bent-edge', 'wavy-curl', 'taped'];
    const chosenStyle = tpl.paperStyle || styles[Math.floor(Math.random() * styles.length)];

    return this.createNewNote({
      content: tpl.content || '',
      color: tpl.color || 'yellow',
      paperStyle: chosenStyle,
      focus: true
    });
  }

  /**
   * Create BrowserWindow for a given note.
   */
  createNoteWindow(note) {
    if (this.windows.has(note.id)) {
      const existingWin = this.windows.get(note.id);
      existingWin.show();
      existingWin.focus();
      return existingWin;
    }

    // Clamp sizes on load (min 220x160, max 800x800)
    const safeWidth = Math.min(800, Math.max(220, Math.round(note.width || 320)));
    const safeHeight = Math.min(800, Math.max(160, Math.round(note.height || 360)));
    const safeExpandedHeight = Math.min(800, Math.max(160, Math.round(note.expandedHeight || safeHeight)));
    note.width = safeWidth;
    note.height = safeHeight;
    note.expandedHeight = safeExpandedHeight;

    const isCollapsed = Boolean(note.isCollapsed);
    const COLLAPSED_HEIGHT = 84;
    const winHeight = isCollapsed ? COLLAPSED_HEIGHT : safeHeight;

    // Ensure note coordinates are visible on at least one currently active display
    const visibleCoords = this.ensureVisibleCoordinates(note.x, note.y, safeWidth, winHeight);
    note.x = visibleCoords.x;
    note.y = visibleCoords.y;

    const win = new BrowserWindow({
      x: note.x,
      y: note.y,
      width: safeWidth,
      height: winHeight,
      minWidth: 220,
      minHeight: isCollapsed ? 0 : 160,
      maxWidth: 800,
      maxHeight: isCollapsed ? COLLAPSED_HEIGHT : 800,
      frame: false,
      transparent: true,
      hasShadow: false, // Using styled CSS paper drop shadow with padding
      resizable: !isCollapsed,
      alwaysOnTop: Boolean(note.isLocked || note.isPinned),
      skipTaskbar: false,
      icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        devTools: !app.isPackaged,
        backgroundThrottling: false
      }
    });

    // Enforce navigation & pop-up restrictions
    secureWindow(win);

    // Apply saved opacity
    if (typeof note.opacity === 'number') {
      win.setOpacity(Math.max(0.2, Math.min(1.0, note.opacity)));
    }

    if (note.isLocked) {
      win.setAlwaysOnTop(true, 'screen-saver');
      win.setIgnoreMouseEvents(true, { forward: true });
    }

    this.windows.set(note.id, win);
    this.notesData.set(note.id, { ...note });

    // Load HTML file
    const htmlPath = path.join(__dirname, '..', 'renderer', 'index.html');
    win.loadFile(htmlPath);

    // Send note data once DOM is ready
    win.webContents.on('did-finish-load', () => {
      win.webContents.send('init-note', note);
    });

    // On move: ONLY update x and y coordinates. NEVER touch width or height!
    const handleMove = () => {
      if (win.isDestroyed()) return;
      const [x, y] = win.getPosition();
      const current = this.notesData.get(note.id);
      if (current) {
        current.x = Math.round(x);
        current.y = Math.round(y);
        this.debounceSave(note.id);
      }
    };

    // On resize: update width and height only when explicitly resized
    const handleResize = () => {
      if (win.isDestroyed()) return;
      if (this.activeDrags.has(note.id)) return;

      const current = this.notesData.get(note.id);
      if (current && !current.isCollapsed) {
        const [w, h] = win.getSize();
        current.width = Math.min(600, Math.max(260, Math.round(w)));
        current.height = Math.min(600, Math.max(180, Math.round(h)));
        current.expandedHeight = current.height;
        this.debounceSave(note.id);
      }
    };

    win.on('move', handleMove);
    win.on('resize', handleResize);

    win.on('closed', () => {
      this.windows.delete(note.id);
      this.notesData.delete(note.id);
      if (this.debounceTimers.has(note.id)) {
        clearTimeout(this.debounceTimers.get(note.id));
        this.debounceTimers.delete(note.id);
      }
      if (this.trayManager) {
        this.trayManager.updateContextMenu();
      }
      this.notifyAllNotesUpdated();
    });

    if (this.trayManager) {
      this.trayManager.updateContextMenu();
    }

    return win;
  }

  /**
   * Update and save note data emitted from renderer
   */
  handleSaveNote(noteData) {
    if (!noteData || typeof noteData !== 'object' || typeof noteData.id !== 'string') return;
    const current = this.notesData.get(noteData.id) || {};
    const safeData = { ...noteData };

    // Sanitize HTML content
    if (typeof safeData.content === 'string') {
      safeData.content = sanitizeNoteHtml(safeData.content.slice(0, 500000));
    }

    // Validate and limit doodles (max 2MB, valid base64 PNG)
    if (typeof safeData.doodles === 'string') {
      if (!safeData.doodles.startsWith('data:image/png;base64,') || safeData.doodles.length > 2 * 1024 * 1024) {
        safeData.doodles = null;
      }
    }

    // Limit stickers count to 30
    if (Array.isArray(safeData.stickers)) {
      safeData.stickers = safeData.stickers.slice(0, 30);
    }

    // If collapsed, prevent auto-save from overwriting expanded dimensions
    if (current.isCollapsed) {
      safeData.width = current.expandedWidth || current.width || 320;
      safeData.height = current.expandedHeight || 360;
      safeData.expandedHeight = current.expandedHeight || 360;
    }
    const updated = {
      ...current,
      ...safeData,
      updatedAt: Date.now()
    };
    if (updated.isAutoFaded) {
      updated.isAutoFaded = false;
    }
    this.notesData.set(noteData.id, updated);
    storage.saveNote(updated);

    if (updated.reminder && !updated.reminder.fired && typeof updated.reminder.dueAt === 'number') {
      this.reminderManager.scheduleReminder(updated);
    }
    this.notifyAllNotesUpdated();
  }

  /**
   * Set or toggle lock state for a note.
   * Locked notes stay on top, cannot be edited or moved, and clicks pass through
   * except over the lock icon.
   */
  handleSetLocked(noteId, isLocked) {
    const win = this.windows.get(noteId);
    const current = this.notesData.get(noteId) || storage.loadAllNotes().find(n => n.id === noteId);
    if (current) {
      current.isLocked = Boolean(isLocked);
      current.updatedAt = Date.now();
      this.notesData.set(noteId, current);
      storage.saveNote(current);
      this.notifyAllNotesUpdated();
    }
    if (win && !win.isDestroyed()) {
      if (isLocked) {
        win.setAlwaysOnTop(true, 'screen-saver');
        win.setIgnoreMouseEvents(true, { forward: true });
      } else {
        win.setAlwaysOnTop(Boolean(current?.isPinned));
        win.setIgnoreMouseEvents(false);
      }
      win.webContents.send('init-note', current);
    }
  }

  /**
   * Set or update reminder for note
   */
  handleSetReminder(noteId, reminderData) {
    const current = this.notesData.get(noteId) || storage.loadAllNotes().find(n => n.id === noteId);
    if (current && reminderData) {
      const dueAt = typeof reminderData === 'number' ? reminderData : reminderData.dueAt;
      current.reminder = {
        dueAt,
        fired: false
      };
      this.notesData.set(noteId, current);
      storage.saveNote(current);
      this.reminderManager.scheduleReminder(current);

      const win = this.windows.get(noteId);
      if (win && !win.isDestroyed()) {
        win.webContents.send('init-note', current);
      }
    }
  }

  /**
   * Cancel reminder for note
   */
  handleCancelReminder(noteId) {
    this.reminderManager.cancelReminder(noteId);
  }

  /**
   * Focus or reopen a note window by ID
   */
  focusNote(noteId) {
    let win = this.windows.get(noteId);
    if (!win || win.isDestroyed()) {
      const notes = storage.loadAllNotes();
      const n = notes.find(item => item.id === noteId);
      if (n) {
        win = this.createNoteWindow(n);
      }
    }
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
      win.show();
      win.focus();
      win.moveTop();
      win.webContents.send('note-highlighted');
    }
    return win;
  }

  /**
   * Directly resize note window (e.g. from resize grip or edge drag)
   */
  handleResizeNote(noteId, width, height, x, y) {
    const win = this.windows.get(noteId);
    if (win && !win.isDestroyed()) {
      const current = this.notesData.get(noteId) || {};
      if (current.isLocked) return; // Locked notes cannot be resized
      const safeW = Math.min(800, Math.max(220, Math.round(width)));
      const safeH = current.isCollapsed
        ? (win.getBounds().height)
        : Math.min(800, Math.max(160, Math.round(height)));

      const bounds = win.getBounds();
      const targetX = typeof x === 'number' ? Math.round(x) : bounds.x;
      const targetY = typeof y === 'number' ? Math.round(y) : bounds.y;
      win.setBounds({ x: targetX, y: targetY, width: safeW, height: safeH });
      current.x = targetX;
      current.y = targetY;
      current.width = safeW;
      if (!current.isCollapsed) {
        current.height = safeH;
        current.expandedHeight = safeH;
      }
      this.notesData.set(noteId, current);
      storage.saveNote(current);
    }
  }

  /**
   * Delete note moves it to Trash (kept for 30 days).
   */
  handleDeleteNote(noteId) {
    this.reminderManager.cancelReminder(noteId);
    const trashedRecord = storage.moveToTrash(noteId);
    this.notesData.delete(noteId);
    const win = this.windows.get(noteId);
    if (win && !win.isDestroyed()) {
      win.destroy();
    }
    this.windows.delete(noteId);

    if (this.trayManager) {
      this.trayManager.updateContextMenu();
    }
    this.notifyAllNotesUpdated();
  }

  /**
   * Restores the most recently trashed note (Ctrl+Z or Trash window restore).
   */
  handleUndoTrash() {
    const lastTrashed = storage.getLastTrashedNote();
    if (!lastTrashed) return null;

    const restored = storage.restoreFromTrash(lastTrashed.id);
    if (restored) {
      const win = this.createNoteWindow(restored);
      if (win) {
        win.show();
        win.focus();
      }
      if (this.trayManager) {
        this.trayManager.updateContextMenu();
      }
      this.notifyAllNotesUpdated();
      return restored;
    }
    return null;
  }

  /**
   * Opens the dedicated Trash window.
   */
  openTrashWindow() {
    if (this.trashWindow && !this.trashWindow.isDestroyed()) {
      this.trashWindow.show();
      this.trashWindow.focus();
      return this.trashWindow;
    }

    const trashHtml = path.join(__dirname, '..', 'renderer', 'trash.html');
    this.trashWindow = new BrowserWindow({
      width: 520,
      height: 560,
      minWidth: 380,
      minHeight: 400,
      icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
      title: 'StickyPad — Trash',
      autoHideMenuBar: true,
      backgroundColor: '#fdfbf7',
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        devTools: !app.isPackaged
      }
    });

    secureWindow(this.trashWindow);
    this.trashWindow.loadFile(trashHtml);
    this.trashWindow.on('closed', () => {
      this.trashWindow = null;
    });

    return this.trashWindow;
  }

  /**
   * Opens the dedicated All Notes search & list window.
   */
  openAllNotesWindow() {
    if (this.allNotesWindow && !this.allNotesWindow.isDestroyed()) {
      this.allNotesWindow.show();
      this.allNotesWindow.focus();
      return this.allNotesWindow;
    }

    const allNotesHtml = path.join(__dirname, '..', 'renderer', 'all-notes.html');
    this.allNotesWindow = new BrowserWindow({
      width: 420,
      height: 520,
      minWidth: 320,
      minHeight: 380,
      icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
      title: 'StickyPad — All Notes',
      autoHideMenuBar: true,
      backgroundColor: '#faf7f2',
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        devTools: !app.isPackaged
      }
    });

    secureWindow(this.allNotesWindow);
    this.allNotesWindow.loadFile(allNotesHtml);
    this.allNotesWindow.on('closed', () => {
      this.allNotesWindow = null;
    });

    return this.allNotesWindow;
  }

  /**
   * Opens the dedicated Archive window.
   */
  openArchiveWindow() {
    if (this.archiveWindow && !this.archiveWindow.isDestroyed()) {
      this.archiveWindow.show();
      this.archiveWindow.focus();
      return this.archiveWindow;
    }

    const archiveHtml = path.join(__dirname, '..', 'renderer', 'archive.html');
    this.archiveWindow = new BrowserWindow({
      width: 520,
      height: 560,
      minWidth: 380,
      minHeight: 400,
      icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
      title: 'StickyPad — Archive',
      autoHideMenuBar: true,
      backgroundColor: '#fdfbf7',
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        devTools: !app.isPackaged
      }
    });

    secureWindow(this.archiveWindow);
    this.archiveWindow.loadFile(archiveHtml);
    this.archiveWindow.on('closed', () => {
      this.archiveWindow = null;
    });

    return this.archiveWindow;
  }

  /**
   * Restores a note from Archive back to active notes.
   */
  handleRestoreFromArchive(noteId) {
    const restored = storage.restoreFromArchive(noteId);
    if (restored) {
      this.createNoteWindow(restored);
      if (this.trayManager) {
        this.trayManager.updateContextMenu();
      }
      this.notifyArchiveUpdated();
      this.notifyAllNotesUpdated();
      return restored;
    }
    return null;
  }

  /**
   * Permanently deletes a note from Archive.
   */
  handleDeleteFromArchive(noteId) {
    storage.deleteFromArchive(noteId);
    if (this.trayManager) {
      this.trayManager.updateContextMenu();
    }
    this.notifyArchiveUpdated();
  }

  /**
   * Empties all notes in Archive.
   */
  handleEmptyArchive() {
    storage.emptyArchive();
    if (this.trayManager) {
      this.trayManager.updateContextMenu();
    }
    this.notifyArchiveUpdated();
  }

  /**
   * Checks active notes for auto-fade and auto-archive.
   */
  checkAutoFadeAndArchive() {
    const fadeDays = storage.getSetting('fadeDays', 7);
    const archiveDays = storage.getSetting('archiveDays', 7);
    const res = storage.processAutoFadeAndArchive(fadeDays, archiveDays);

    if (res.archived && res.archived.length > 0) {
      res.archived.forEach(note => {
        const win = this.windows.get(note.id);
        if (win && !win.isDestroyed()) {
          win.close();
        }
        this.windows.delete(note.id);
        this.notesData.delete(note.id);
      });
      if (this.trayManager) {
        this.trayManager.updateContextMenu();
      }
      this.notifyAllNotesUpdated();
      this.notifyArchiveUpdated();
    }

    if (res.faded && res.faded.length > 0) {
      res.faded.forEach(noteId => {
        const win = this.windows.get(noteId);
        const data = storage.loadAllNotes().find(n => n.id === noteId);
        if (win && !win.isDestroyed() && data) {
          this.handleSetCollapsed(noteId, true);
          win.webContents.send('init-note', data);
        }
      });
    }

    return res;
  }

  /**
   * Restores a note from Trash back to active notes and opens its window.
   */
  handleRestoreFromTrash(noteId) {
    const restored = storage.restoreFromTrash(noteId);
    if (restored) {
      this.createNoteWindow(restored);
      if (this.trayManager) {
        this.trayManager.updateContextMenu();
      }
      if (this.trashWindow && !this.trashWindow.isDestroyed()) {
        this.trashWindow.webContents.send('trash-updated', storage.loadTrash());
      }
      this.notifyAllNotesUpdated();
      return restored;
    }
    return null;
  }

  /**
   * Permanently deletes a note from Trash.
   */
  handleDeleteForever(noteId) {
    storage.deleteForever(noteId);
    if (this.trayManager) {
      this.trayManager.updateContextMenu();
    }
    if (this.trashWindow && !this.trashWindow.isDestroyed()) {
      this.trashWindow.webContents.send('trash-updated', storage.loadTrash());
    }
  }

  /**
   * Empties all trashed notes.
   */
  handleEmptyTrash() {
    storage.emptyTrash();
    if (this.trayManager) {
      this.trayManager.updateContextMenu();
    }
    if (this.trashWindow && !this.trashWindow.isDestroyed()) {
      this.trashWindow.webContents.send('trash-updated', []);
    }
  }

  /**
   * Merges imported notes into existing active notes.
   */
  handleMergeNotes(importedNotes) {
    const existing = storage.loadAllNotes();
    const existingIds = new Set(existing.map(n => n.id));

    importedNotes.forEach((n, idx) => {
      let safeId = n.id;
      if (!safeId || existingIds.has(safeId)) {
        safeId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${idx}`;
      }
      existingIds.add(safeId);

      const mergedNote = {
        ...n,
        id: safeId,
        x: (typeof n.x === 'number' ? n.x : 100) + ((idx * 25) % 150),
        y: (typeof n.y === 'number' ? n.y : 100) + ((idx * 25) % 150),
        updatedAt: Date.now()
      };
      storage.saveNote(mergedNote);
      this.createNoteWindow(mergedNote);
      if (mergedNote.reminder && !mergedNote.reminder.fired) {
        this.reminderManager.scheduleReminder(mergedNote);
      }
    });

    if (this.trayManager) {
      this.trayManager.updateContextMenu();
    }
  }

  /**
   * Replaces current notes with imported notes (moving current to Trash).
   */
  handleReplaceAllNotes(importedNotes) {
    const existing = storage.loadAllNotes();
    existing.forEach(n => {
      storage.moveToTrash(n.id);
    });

    this.windows.forEach(win => {
      if (!win.isDestroyed()) win.destroy();
    });
    this.windows.clear();
    this.notesData.clear();

    storage.saveAllNotes(importedNotes);

    importedNotes.forEach(note => {
      this.createNoteWindow(note);
      if (note.reminder && !note.reminder.fired) {
        this.reminderManager.scheduleReminder(note);
      }
    });

    if (this.trayManager) {
      this.trayManager.updateContextMenu();
    }
  }

  /**
   * Toggle always-on-top pin
   */
  handleSetAlwaysOnTop(noteId, isPinned) {
    const win = this.windows.get(noteId);
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(isPinned, 'floating');
    }
    const current = this.notesData.get(noteId);
    if (current) {
      current.isPinned = isPinned;
      storage.saveNote(current);
    }
  }

  /**
   * Toggle collapsed state
   */
  handleSetCollapsed(noteId, isCollapsed) {
    const win = this.windows.get(noteId);
    const current = this.notesData.get(noteId);
    if (!win || win.isDestroyed() || !current) return;

    current.isCollapsed = Boolean(isCollapsed);
    const COLLAPSED_HEIGHT = 84;

    if (current.isCollapsed) {
      // 1. Remember expanded height and width before collapsing
      const bounds = win.getBounds();
      const expH = Math.min(600, Math.max(180, Math.round(current.expandedHeight || bounds.height)));
      const expW = Math.min(600, Math.max(260, Math.round(current.expandedWidth || current.width || bounds.width)));
      current.expandedHeight = expH;
      current.expandedWidth = expW;
      current.collapsedHeight = COLLAPSED_HEIGHT;

      // 2. Remove/lower minHeight limit so Windows allows shrinking to 84px
      win.setMinimumSize(260, 0);
      win.setMaximumSize(9999, COLLAPSED_HEIGHT);

      // 3. Set collapsed size
      win.setBounds({
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: expW,
        height: COLLAPSED_HEIGHT
      });
      win.setResizable(false);
    } else {
      // 1. Restore exact saved expanded values
      const restoreWidth = Math.min(600, Math.max(260, Math.round(current.expandedWidth || current.width || 320)));
      const restoreHeight = Math.min(600, Math.max(180, Math.round(current.expandedHeight || 360)));
      current.width = restoreWidth;
      current.height = restoreHeight;

      // 2. Re-enable resizing FIRST on Windows so OS accepts size limit changes
      win.setResizable(true);
      win.setMaximumSize(0, 0);
      win.setMinimumSize(260, 180);

      // 3. Restore window bounds
      const bounds = win.getBounds();
      win.setBounds({
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: restoreWidth,
        height: restoreHeight
      });
    }

    storage.saveNote(current);
  }

  /**
   * Update window opacity
   */
  handleSetOpacity(noteId, opacity) {
    const win = this.windows.get(noteId);
    const safeOpacity = Math.max(0.2, Math.min(1.0, opacity));
    if (win && !win.isDestroyed()) {
      win.setOpacity(safeOpacity);
    }
    const current = this.notesData.get(noteId);
    if (current) {
      current.opacity = safeOpacity;
      storage.saveNote(current);
    }
  }

  /**
   * Record window width and height once at drag start.
   */
  handleStartDrag(noteId, screenX, screenY) {
    const win = this.windows.get(noteId);
    if (!win || win.isDestroyed()) return;

    const bounds = win.getBounds();
    this.activeDrags.set(noteId, {
      startX: bounds.x,
      startY: bounds.y,
      width: Math.round(bounds.width),
      height: Math.round(bounds.height)
    });
  }

  /**
   * Calculate snapped position against screen edges and other notes' edges within ~12px.
   * Holding Shift disables snapping.
   * STRICT: Snapping only calculates x and y, never alters width or height!
   */
  calculateSnappedPosition(noteId, targetX, targetY, width, height, shiftKey) {
    if (shiftKey) {
      return { x: Math.round(targetX), y: Math.round(targetY), snapped: false };
    }

    const SNAP_THRESHOLD = 12;
    const currentDisplay = screen.getDisplayMatching({
      x: Math.round(targetX),
      y: Math.round(targetY),
      width: Math.round(width),
      height: Math.round(height)
    }) || screen.getPrimaryDisplay();

    const workArea = currentDisplay.workArea;

    // Screen edge candidates
    const candidatesX = [
      workArea.x,                           // Left edge
      workArea.x + workArea.width - width   // Right edge
    ];

    const candidatesY = [
      workArea.y,                            // Top edge
      workArea.y + workArea.height - height  // Bottom edge
    ];

    // Other notes' edge candidates
    for (const [otherId, otherWin] of this.windows.entries()) {
      if (otherId === noteId || !otherWin || otherWin.isDestroyed()) continue;
      const otherData = this.notesData.get(otherId);
      if (!otherData) continue;

      const oX = Math.round(otherData.x);
      const oY = Math.round(otherData.y);
      const oW = Math.round(otherData.width);
      const oH = Math.round(otherData.height);

      // Snap left edge to other's right or left
      candidatesX.push(oX + oW);
      candidatesX.push(oX);
      // Snap right edge to other's left or right
      candidatesX.push(oX - width);
      candidatesX.push(oX + oW - width);

      // Snap top edge to other's bottom or top
      candidatesY.push(oY + oH);
      candidatesY.push(oY);
      // Snap bottom edge to other's top or bottom
      candidatesY.push(oY - height);
      candidatesY.push(oY + oH - height);
    }

    let snappedX = targetX;
    let minDiffX = SNAP_THRESHOLD + 1;
    let isSnappedX = false;
    for (const candX of candidatesX) {
      const diff = Math.abs(targetX - candX);
      if (diff <= SNAP_THRESHOLD && diff < minDiffX) {
        minDiffX = diff;
        snappedX = candX;
        isSnappedX = true;
      }
    }

    let snappedY = targetY;
    let minDiffY = SNAP_THRESHOLD + 1;
    let isSnappedY = false;
    for (const candY of candidatesY) {
      const diff = Math.abs(targetY - candY);
      if (diff <= SNAP_THRESHOLD && diff < minDiffY) {
        minDiffY = diff;
        snappedY = candY;
        isSnappedY = true;
      }
    }

    return {
      x: Math.round(snappedX),
      y: Math.round(snappedY),
      snapped: isSnappedX || isSnappedY
    };
  }

  /**
   * Move window by screen coordinate delta (for Alt-drag).
   * During drag, ONLY changes x and y. Always passes the same recorded width & height.
   */
  handleMoveWindowDelta(noteId, dx, dy, shiftKey = false) {
    const win = this.windows.get(noteId);
    if (!win || win.isDestroyed()) return;

    let drag = this.activeDrags.get(noteId);
    if (!drag) {
      const bounds = win.getBounds();
      drag = {
        startX: bounds.x,
        startY: bounds.y,
        width: Math.round(bounds.width),
        height: Math.round(bounds.height)
      };
      this.activeDrags.set(noteId, drag);
    }

    drag.startX += dx;
    drag.startY += dy;

    // Apply snap to edges & other notes (disabled if Shift is held)
    const snapResult = this.calculateSnappedPosition(
      noteId,
      drag.startX,
      drag.startY,
      drag.width,
      drag.height,
      shiftKey
    );

    const newX = snapResult.x;
    const newY = snapResult.y;

    win.setBounds({
      x: newX,
      y: newY,
      width: drag.width,
      height: drag.height
    });

    win.webContents.send('snap-highlight', { snapped: snapResult.snapped });

    const current = this.notesData.get(noteId);
    if (current) {
      current.x = newX;
      current.y = newY;
    }
  }

  /**
   * End drag: confirm bounds with fixed recorded width and height.
   */
  handleEndDrag(noteId) {
    const win = this.windows.get(noteId);
    const drag = this.activeDrags.get(noteId);
    if (win && !win.isDestroyed()) {
      win.webContents.send('snap-highlight', { snapped: false });
      if (drag) {
        const [x, y] = win.getPosition();
        win.setBounds({
          x: Math.round(x),
          y: Math.round(y),
          width: drag.width,
          height: drag.height
        });
        const current = this.notesData.get(noteId);
        if (current) {
          current.x = Math.round(x);
          current.y = Math.round(y);
          if (!current.isCollapsed) {
            current.width = drag.width;
            current.height = drag.height;
          }
          storage.saveNote(current);
          this.notifyAllNotesUpdated();
        }
      }
    }
    this.activeDrags.delete(noteId);
  }

  /**
   * Set whether mouse events pass through transparent padding
   */
  handleSetIgnoreMouseEvents(noteId, ignore, forward) {
    const win = this.windows.get(noteId);
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(Boolean(ignore), { forward: Boolean(forward) });
    }
  }

  /**
   * Export note paper as PNG image (Copy to clipboard or Save file)
   */
  async handleExportImage(noteId, action, transparentBg) {
    const win = this.windows.get(noteId);
    if (!win || win.isDestroyed()) {
      return { success: false, error: 'Note window not found' };
    }

    try {
      // 1. Tell renderer to enter export mode and get crop rectangle
      const exportData = await win.webContents.executeJavaScript(`
        window.__prepareForExport(${Boolean(transparentBg)})
      `);

      // 2. Allow brief tick for DOM to reflow/paint
      await new Promise(resolve => setTimeout(resolve, 60));

      // 3. Capture page rectangle
      const image = await win.webContents.capturePage(exportData.rect);

      // 4. Restore normal UI in renderer
      await win.webContents.executeJavaScript(`
        window.__finishExport()
      `);

      // Upscale for 2x crispness if needed
      const imgSize = image.getSize();
      const scaledImage = image.resize({
        width: Math.round(imgSize.width * 2),
        height: Math.round(imgSize.height * 2),
        quality: 'best'
      });

      if (action === 'copy') {
        const { clipboard } = require('electron');
        clipboard.writeImage(scaledImage);
        return { success: true, action: 'copied' };
      } else if (action === 'save') {
        const { dialog } = require('electron');
        const fs = require('fs');
        const { filePath, canceled } = await dialog.showSaveDialog(win, {
          title: 'Save Sticky Note as Image',
          defaultPath: `stickypad-${Date.now()}.png`,
          filters: [{ name: 'PNG Image (*.png)', extensions: ['png'] }]
        });

        if (canceled || !filePath) {
          return { success: false, canceled: true };
        }

        fs.writeFileSync(filePath, scaledImage.toPNG());
        return { success: true, action: 'saved', filePath };
      }

      return { success: false, error: 'Unknown export action' };
    } catch (err) {
      console.error('[StickyPad] handleExportImage error:', err);
      try {
        await win.webContents.executeJavaScript(`window.__finishExport()`);
      } catch (_) {}
      return { success: false, error: err.message };
    }
  }

  /**
   * Show all note windows
   */
  showAllNotes() {
    this.windows.forEach(win => {
      if (!win.isDestroyed()) {
        win.show();
      }
    });
  }

  /**
   * Hide all note windows
   */
  hideAllNotes() {
    this.windows.forEach(win => {
      if (!win.isDestroyed()) {
        win.hide();
      }
    });
  }
}

module.exports = WindowManager;
