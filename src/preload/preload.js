const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose secure IPC bridge to renderer process.
 * Node integration is disabled in renderer for security and low-memory footprint.
 */
contextBridge.exposeInMainWorld('stickyAPI', {
  /**
   * Listen for note initialization data sent from main process
   */
  onInitNote: (callback) => {
    ipcRenderer.on('init-note', (_event, noteData) => callback(noteData));
  },

  /**
   * Auto-save note data (content, color, font, opacity, etc.)
   */
  saveNote: (noteData) => {
    ipcRenderer.send('save-note', noteData);
  },

  /**
   * Request new sticky note creation
   */
  createNewNote: (preset) => {
    ipcRenderer.send('create-new-note', preset);
  },

  /**
   * Request deletion of this sticky note
   */
  deleteNote: (noteId) => {
    ipcRenderer.send('delete-note', noteId);
  },

  /**
   * Toggle always-on-top pin status
   */
  setAlwaysOnTop: (noteId, isPinned) => {
    ipcRenderer.send('set-always-on-top', { noteId, isPinned });
  },

  /**
   * Toggle collapsed state (shrinks note window to top bar)
   */
  setCollapsed: (noteId, isCollapsed) => {
    ipcRenderer.send('set-collapsed', { noteId, isCollapsed });
  },

  /**
   * Set window opacity from slider
   */
  setOpacity: (noteId, opacity) => {
    ipcRenderer.send('set-opacity', { noteId, opacity });
  },

  /**
   * Resize window smoothly from grip handles or edges
   */
  resizeNote: (noteId, width, height, x, y) => {
    ipcRenderer.send('resize-note', { noteId, width, height, x, y });
  },

  /**
   * Start window drag (records starting dimensions)
   */
  startWindowDrag: (noteId, screenX, screenY) => {
    ipcRenderer.send('start-window-drag', { noteId, screenX, screenY });
  },

  /**
   * Move window by delta coordinates (for drag anywhere & Alt-drag)
   */
  moveWindowDelta: (noteId, dx, dy, shiftKey) => {
    ipcRenderer.send('move-window-delta', { noteId, dx, dy, shiftKey });
  },

  /**
   * End window drag (confirms bounds with fixed recorded dimensions)
   */
  endWindowDrag: (noteId) => {
    ipcRenderer.send('end-window-drag', { noteId });
  },

  /**
   * Listen for drag snapping visual highlight
   */
  onSnapHighlight: (callback) => {
    ipcRenderer.on('snap-highlight', (_event, data) => callback(data));
  },

  /**
   * Set note lock state (clicks pass through, no edit/drag)
   */
  setLocked: (noteId, isLocked) => {
    ipcRenderer.send('set-locked', { noteId, isLocked });
  },

  /**
   * Ignore mouse clicks on transparent padding outside paper
   */
  setIgnoreMouseEvents: (noteId, ignore, options) => {
    ipcRenderer.send('set-ignore-mouse-events', { noteId, ignore, forward: options?.forward });
  },

  /**
   * Export note as image (copy to clipboard or save file)
   */
  exportNoteImage: (params) => {
    return ipcRenderer.invoke('export-note-image', params);
  },

  /**
   * Set reminder for a note
   */
  setReminder: (noteId, reminderData) => {
    ipcRenderer.send('set-reminder', { noteId, reminderData });
  },

  /**
   * Cancel reminder for a note
   */
  cancelReminder: (noteId) => {
    ipcRenderer.send('cancel-reminder', { noteId });
  },

  /**
   * Listen for reminder alert triggers
   */
  onReminderAlert: (callback) => {
    ipcRenderer.on('reminder-alert', (_event, data) => callback(data));
  },

  /**
   * Undo last note deletion
   */
  undoDelete: () => {
    ipcRenderer.send('undo-trash');
  },

  /**
   * Listen for pending save flush broadcast before quit
   */
  onFlushPendingSave: (callback) => {
    ipcRenderer.on('flush-pending-save', () => callback());
  },

  /**
   * Open the trash window
   */
  openTrashWindow: () => {
    ipcRenderer.send('open-trash-window');
  },

  /**
   * Retrieve all trashed notes
   */
  getTrash: () => {
    return ipcRenderer.invoke('get-trash');
  },

  /**
   * Restore note from trash
   */
  restoreFromTrash: (noteId) => {
    ipcRenderer.send('restore-from-trash', { noteId });
  },

  /**
   * Permanently delete note from trash
   */
  deleteForever: (noteId) => {
    ipcRenderer.send('delete-forever', { noteId });
  },

  /**
   * Empty trash
   */
  emptyTrash: () => {
    ipcRenderer.send('empty-trash');
  },

  /**
   * Listen for trash updates
   */
  onTrashUpdated: (callback) => {
    ipcRenderer.on('trash-updated', (_event, data) => callback(data));
  },

  /**
   * Export all notes
   */
  exportAllNotes: () => {
    return ipcRenderer.invoke('export-all-notes');
  },

  /**
   * Import notes
   */
  importNotes: () => {
    return ipcRenderer.invoke('import-notes');
  },

  /**
   * Open the All Notes search & list window
   */
  openAllNotesWindow: () => {
    ipcRenderer.send('open-all-notes-window');
  },

  /**
   * Get all active notes for search & list panel
   */
  getAllNotes: () => {
    return ipcRenderer.invoke('get-all-notes');
  },

  /**
   * Listen for updates to all notes
   */
  onAllNotesUpdated: (callback) => {
    ipcRenderer.on('all-notes-updated', (_event, data) => callback(data));
  },

  /**
   * Bring a specific note to the front and focus it
   */
  focusNote: (noteId) => {
    ipcRenderer.send('focus-note', { noteId });
  },

  /**
   * Get available note templates configuration
   */
  getTemplates: () => {
    return ipcRenderer.invoke('get-templates');
  },

  /**
   * Create a note from a specific template
   */
  createNoteFromTemplate: (templateId) => {
    ipcRenderer.send('create-note-from-template', { templateId });
  },

  /**
   * Open the Archive window
   */
  openArchiveWindow: () => {
    ipcRenderer.send('open-archive-window');
  },

  /**
   * Retrieve all archived notes
   */
  getArchive: () => {
    return ipcRenderer.invoke('get-archive');
  },

  /**
   * Restore note from archive
   */
  restoreFromArchive: (noteId) => {
    ipcRenderer.send('restore-from-archive', { noteId });
  },

  /**
   * Permanently delete note from archive
   */
  deleteFromArchive: (noteId) => {
    ipcRenderer.send('delete-from-archive', { noteId });
  },

  /**
   * Empty archive
   */
  emptyArchive: () => {
    ipcRenderer.send('empty-archive');
  },

  /**
   * Listen for archive updates
   */
  onArchiveUpdated: (callback) => {
    ipcRenderer.on('archive-updated', (_event, data) => callback(data));
  },

  /**
   * Get app setting
   */
  getSetting: (key, defaultValue) => {
    return ipcRenderer.invoke('get-setting', { key, defaultValue });
  },

  /**
   * Set app setting
   */
  setSetting: (key, value) => {
    ipcRenderer.send('set-setting', { key, value });
  }
});
