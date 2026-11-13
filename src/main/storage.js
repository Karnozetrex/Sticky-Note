const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Safe local JSON persistence module for StickyPad notes.
 * Stores notes in app userData directory and guarantees atomicity via
 * temporary file writing and renaming to avoid partial/corrupted writes.
 */
class NoteStorage {
  constructor() {
    this.userDataPath = app.getPath('userData');
    this.storagePath = path.join(this.userDataPath, 'stickypad-notes.json');
    this.tempPath = path.join(this.userDataPath, 'stickypad-notes.json.tmp');
    this.backupPath = path.join(this.userDataPath, 'stickypad-notes.backup.json');
    this.trashPath = path.join(this.userDataPath, 'stickypad-trash.json');
    this.trashTempPath = path.join(this.userDataPath, 'stickypad-trash.json.tmp');
    this.archivePath = path.join(this.userDataPath, 'stickypad-archive.json');
    this.archiveTempPath = path.join(this.userDataPath, 'stickypad-archive.json.tmp');
    this.settingsPath = path.join(this.userDataPath, 'stickypad-settings.json');
    this.lastTrashedNote = null;
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.userDataPath)) {
      fs.mkdirSync(this.userDataPath, { recursive: true });
    }
  }

  /**
   * Returns default notes created on initial launch.
   */
  getDefaultNotes() {
    return [
      {
        id: `note_${Date.now()}_default`,
        x: 120,
        y: 120,
        width: 320,
        height: 380,
        title: 'Welcome to StickyPad 📝',
        content: `Welcome to StickyPad! 📌

- [x] Try clicking this completed item
- [ ] Type "- [ ] " to make a new checklist
- [ ] Press Ctrl+Shift+N for a new note
- [ ] Pin me on top with the pin icon
- [ ] Customize my color & handwriting font

Your notes auto-save instantly as you type! ✨`,
        color: 'yellow',
        fontFamily: 'handwriting',
        fontSize: 16,
        opacity: 1.0,
        tilt: -2.2,
        paperStyle: 'corner-curl',
        isPinned: false,
        isCollapsed: false,
        collapsedHeight: 82,
        expandedHeight: 380,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];
  }

  /**
   * Load all notes from disk.
   */
  loadAllNotes() {
    this.ensureDirectory();

    // Helper to migrate legacy notes (e.g. replace 'dark' color with 'teal', clamp oversize notes)
    const migrateNotes = (notesList) => {
      let changed = false;
      notesList.forEach(n => {
        if (n.color === 'dark') {
          n.color = 'teal';
          changed = true;
        }
        if ('isAnime' in n) {
          delete n.isAnime;
          changed = true;
        }
        // Cleanup: Clamp notes that already grew too large on drag to max 600x600
        if (typeof n.width === 'number' && n.width > 600) {
          n.width = 600;
          changed = true;
        }
        if (typeof n.height === 'number' && n.height > 600) {
          n.height = 600;
          changed = true;
        }
        if (typeof n.expandedHeight === 'number' && n.expandedHeight > 600) {
          n.expandedHeight = 600;
          changed = true;
        }
        if (typeof n.expandedWidth === 'number' && n.expandedWidth > 600) {
          n.expandedWidth = 600;
          changed = true;
        }
      });
      if (changed) {
        this.saveAllNotes(notesList);
      }
      return notesList;
    };

    // Check main file first
    if (fs.existsSync(this.storagePath)) {
      try {
        const raw = fs.readFileSync(this.storagePath, 'utf8');
        const notes = JSON.parse(raw);
        if (Array.isArray(notes)) {
          return migrateNotes(notes);
        }
      } catch (err) {
        console.error('[StickyPad Storage] Error parsing notes.json:', err);
      }
    }

    // Attempt recovery from temp file if main file was corrupted or missing
    if (fs.existsSync(this.tempPath)) {
      try {
        const raw = fs.readFileSync(this.tempPath, 'utf8');
        const notes = JSON.parse(raw);
        if (Array.isArray(notes)) {
          console.warn('[StickyPad Storage] Recovered notes from temp file');
          const migrated = migrateNotes(notes);
          this.saveAllNotes(migrated);
          return migrated;
        }
      } catch (err) {
        console.error('[StickyPad Storage] Error parsing temp file:', err);
      }
    }

    // Attempt recovery from rolling backup file if main and temp were corrupted
    if (fs.existsSync(this.backupPath)) {
      try {
        const raw = fs.readFileSync(this.backupPath, 'utf8');
        const notes = JSON.parse(raw);
        if (Array.isArray(notes)) {
          console.warn('[StickyPad Storage] Recovered notes from rolling backup file');
          const migrated = migrateNotes(notes);
          this.saveAllNotes(migrated);
          return migrated;
        }
      } catch (err) {
        console.error('[StickyPad Storage] Error parsing backup file:', err);
      }
    }

    // If nothing found or first run, write and return default notes
    const initialNotes = this.getDefaultNotes();
    this.saveAllNotes(initialNotes);
    return initialNotes;
  }

  /**
   * Helper for atomic writes: write to temp file then rename with Windows lock fallback.
   */
  atomicWriteFile(targetPath, tempPath, data) {
    this.ensureDirectory();
    try {
      fs.writeFileSync(tempPath, data, 'utf8');
      try {
        fs.renameSync(tempPath, targetPath);
      } catch (renameErr) {
        if (renameErr.code === 'EPERM' || renameErr.code === 'EBUSY') {
          fs.copyFileSync(tempPath, targetPath);
          try { fs.unlinkSync(tempPath); } catch (_) {}
        } else {
          throw renameErr;
        }
      }
      return true;
    } catch (err) {
      console.error(`[StickyPad Storage] Failed atomic write to ${targetPath}:`, err);
      return false;
    }
  }

  /**
   * Safe atomic save to disk. Writes to .tmp then renames atomically.
   * Also maintains a rolling backup copy.
   */
  saveAllNotes(notes) {
    const data = JSON.stringify(notes, null, 2);
    const success = this.atomicWriteFile(this.storagePath, this.tempPath, data);
    if (success) {
      // Update rolling backup
      try {
        fs.copyFileSync(this.storagePath, this.backupPath);
      } catch (_) {}
    }
    return success;
  }

  /**
   * Save or update a single note by ID.
   */
  saveNote(noteData) {
    const notes = this.loadAllNotes();
    const index = notes.findIndex(n => n.id === noteData.id);

    if (index >= 0) {
      notes[index] = {
        ...notes[index],
        ...noteData,
        updatedAt: typeof noteData.updatedAt === 'number' ? noteData.updatedAt : Date.now()
      };
    } else {
      notes.push({
        createdAt: typeof noteData.createdAt === 'number' ? noteData.createdAt : Date.now(),
        ...noteData,
        updatedAt: typeof noteData.updatedAt === 'number' ? noteData.updatedAt : Date.now()
      });
    }

    this.saveAllNotes(notes);
    return notes;
  }

  /**
   * Delete note by ID permanently (legacy helper).
   */
  deleteNote(id) {
    let notes = this.loadAllNotes();
    notes = notes.filter(n => n.id !== id);
    this.saveAllNotes(notes);
    return notes;
  }

  // ==========================================================================
  // Trash Management & 30-Day Auto Purge
  // ==========================================================================

  /**
   * Loads trash from disk and automatically purges notes older than 30 days.
   */
  loadTrash() {
    this.ensureDirectory();
    const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    const now = Date.now();
    let trash = [];

    if (fs.existsSync(this.trashPath)) {
      try {
        const raw = fs.readFileSync(this.trashPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          trash = parsed;
        }
      } catch (err) {
        console.error('[StickyPad Storage] Error parsing stickypad-trash.json:', err);
      }
    }

    // Auto-purge trashed notes older than 30 days
    const validTrash = trash.filter(item => {
      const trashedAt = item.trashedAt || item.updatedAt || now;
      return (now - trashedAt) <= RETENTION_MS;
    });

    if (validTrash.length !== trash.length) {
      this.saveTrash(validTrash);
    }

    return validTrash.sort((a, b) => (b.trashedAt || 0) - (a.trashedAt || 0));
  }

  /**
   * Safe atomic save for trash.
   */
  saveTrash(trashList) {
    const data = JSON.stringify(trashList, null, 2);
    return this.atomicWriteFile(this.trashPath, this.trashTempPath, data);
  }

  /**
   * Moves a note from active notes to Trash with trashedAt timestamp.
   */
  moveToTrash(id) {
    const notes = this.loadAllNotes();
    const targetNote = notes.find(n => n.id === id);
    if (!targetNote) return null;

    // Remove from active notes
    const remainingNotes = notes.filter(n => n.id !== id);
    this.saveAllNotes(remainingNotes);

    // Add to trash
    const trash = this.loadTrash();
    const trashedRecord = {
      ...targetNote,
      trashedAt: Date.now()
    };
    trash.unshift(trashedRecord);
    this.saveTrash(trash);

    // Track for Undo
    this.lastTrashedNote = { ...trashedRecord };
    return trashedRecord;
  }

  /**
   * Restores a note from Trash back to active notes.
   */
  restoreFromTrash(id) {
    const trash = this.loadTrash();
    const target = trash.find(n => n.id === id);
    if (!target) return null;

    // Remove from trash
    const remainingTrash = trash.filter(n => n.id !== id);
    this.saveTrash(remainingTrash);

    // Clean trashedAt property and restore to active notes
    const restoredNote = { ...target };
    delete restoredNote.trashedAt;
    restoredNote.updatedAt = Date.now();

    this.saveNote(restoredNote);

    if (this.lastTrashedNote && this.lastTrashedNote.id === id) {
      this.lastTrashedNote = null;
    }

    return restoredNote;
  }

  /**
   * Permanently deletes a note from Trash.
   */
  deleteForever(id) {
    const trash = this.loadTrash();
    const remaining = trash.filter(n => n.id !== id);
    this.saveTrash(remaining);
    if (this.lastTrashedNote && this.lastTrashedNote.id === id) {
      this.lastTrashedNote = null;
    }
    return remaining;
  }

  /**
   * Empties all notes in Trash.
   */
  emptyTrash() {
    this.saveTrash([]);
    this.lastTrashedNote = null;
    return [];
  }

  /**
   * Returns the last trashed note for undo.
   */
  getLastTrashedNote() {
    return this.lastTrashedNote;
  }

  // ==========================================================================
  // Archive Management (Auto-fade & Archive)
  // ==========================================================================

  /**
   * Loads archived notes from disk.
   */
  loadArchive() {
    this.ensureDirectory();
    if (fs.existsSync(this.archivePath)) {
      try {
        const raw = fs.readFileSync(this.archivePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
        }
      } catch (err) {
        console.error('[StickyPad Storage] Error parsing stickypad-archive.json:', err);
      }
    }
    return [];
  }

  /**
   * Safe atomic save for archive.
   */
  saveArchive(archiveList) {
    const data = JSON.stringify(archiveList, null, 2);
    return this.atomicWriteFile(this.archivePath, this.archiveTempPath, data);
  }

  /**
   * Moves a note from active notes to Archive with archivedAt timestamp.
   */
  moveToArchive(id) {
    const notes = this.loadAllNotes();
    const targetNote = notes.find(n => n.id === id);
    if (!targetNote) return null;

    // Remove from active notes
    const remainingNotes = notes.filter(n => n.id !== id);
    this.saveAllNotes(remainingNotes);

    // Add to archive
    const archive = this.loadArchive();
    const archivedRecord = {
      ...targetNote,
      archivedAt: Date.now()
    };
    archive.unshift(archivedRecord);
    this.saveArchive(archive);

    return archivedRecord;
  }

  /**
   * Restores a note from Archive back to active notes.
   */
  restoreFromArchive(id) {
    const archive = this.loadArchive();
    const target = archive.find(n => n.id === id);
    if (!target) return null;

    // Remove from archive
    const remaining = archive.filter(n => n.id !== id);
    this.saveArchive(remaining);

    // Clean archivedAt/isAutoFaded and restore to active notes
    const restoredNote = { ...target };
    delete restoredNote.archivedAt;
    restoredNote.isAutoFaded = false;
    restoredNote.updatedAt = Date.now();

    this.saveNote(restoredNote);
    return restoredNote;
  }

  /**
   * Permanently deletes a note from Archive.
   */
  deleteFromArchive(id) {
    const archive = this.loadArchive();
    const remaining = archive.filter(n => n.id !== id);
    this.saveArchive(remaining);
    return remaining;
  }

  /**
   * Empties all notes in Archive.
   */
  emptyArchive() {
    this.saveArchive([]);
    return [];
  }

  /**
   * Checks active notes for auto-fade and auto-archive.
   * Pinned notes and active reminder notes are NEVER faded or archived.
   */
  processAutoFadeAndArchive(fadeDays = 7, archiveDays = 7) {
    const isEnabled = this.getSetting('autoFadeArchive', false);
    if (!isEnabled) {
      return { faded: [], archived: [] };
    }

    const now = Date.now();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const fadeThresholdMs = fadeDays * MS_PER_DAY;
    const archiveThresholdMs = (fadeDays + archiveDays) * MS_PER_DAY;

    const notes = this.loadAllNotes();
    const faded = [];
    const toArchiveIds = [];
    let notesChanged = false;

    notes.forEach(note => {
      // NEVER fade or archive pinned notes or notes with active reminders
      const hasActiveReminder = Boolean(note.reminder && !note.reminder.fired && typeof note.reminder.dueAt === 'number' && note.reminder.dueAt > now);
      if (note.isPinned || hasActiveReminder) {
        if (note.isAutoFaded) {
          note.isAutoFaded = false;
          notesChanged = true;
        }
        return;
      }

      const lastActivity = note.updatedAt || note.createdAt || now;
      const inactiveMs = now - lastActivity;

      if (inactiveMs >= archiveThresholdMs) {
        toArchiveIds.push(note.id);
      } else if (inactiveMs >= fadeThresholdMs) {
        if (!note.isAutoFaded || !note.isCollapsed) {
          note.isAutoFaded = true;
          note.isCollapsed = true;
          notesChanged = true;
        }
        faded.push(note.id);
      } else {
        if (note.isAutoFaded) {
          note.isAutoFaded = false;
          notesChanged = true;
        }
      }
    });

    if (notesChanged) {
      this.saveAllNotes(notes);
    }

    const archived = [];
    toArchiveIds.forEach(id => {
      const rec = this.moveToArchive(id);
      if (rec) archived.push(rec);
    });

    return { faded, archived };
  }

  // ==========================================================================
  // App Settings Persistence (Launch at Login, etc.)
  // ==========================================================================

  getSettings() {
    this.ensureDirectory();
    if (fs.existsSync(this.settingsPath)) {
      try {
        const raw = fs.readFileSync(this.settingsPath, 'utf8');
        return JSON.parse(raw);
      } catch (err) {
        console.error('[StickyPad Storage] Error parsing settings:', err);
      }
    }
    return {};
  }

  getSetting(key, defaultValue = null) {
    const settings = this.getSettings();
    return settings[key] !== undefined ? settings[key] : defaultValue;
  }

  setSetting(key, value) {
    const settings = this.getSettings();
    settings[key] = value;
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('[StickyPad Storage] Failed to save settings:', err);
      return false;
    }
  }
}

module.exports = new NoteStorage();
