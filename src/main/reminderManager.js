const { Notification, powerMonitor } = require('electron');
const path = require('path');
const storage = require('./storage');

/**
 * Manages sticky note reminders, scheduling, desktop notifications,
 * and visual alerts (glow/shake) across app lifecycles.
 */
class ReminderManager {
  constructor(windowManager) {
    this.windowManager = windowManager;
    this.timers = new Map();
    this.pollInterval = null;
    this.iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');
    this._onResumeHandler = null;
    this._onUnlockHandler = null;
  }

  /**
   * Initializes reminder scheduling on app launch.
   * Survives app restarts by loading all notes from disk.
   */
  init() {
    this.rescheduleAll();

    // Check periodically (every 15 seconds) against in-memory notes without hammering disk
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      this.checkDueReminders();
    }, 15000);

    // Listen to OS wake/unlock events to immediately check due reminders after sleep
    try {
      if (powerMonitor && typeof powerMonitor.on === 'function') {
        this._onResumeHandler = () => this.checkDueReminders();
        this._onUnlockHandler = () => this.checkDueReminders();
        powerMonitor.on('resume', this._onResumeHandler);
        powerMonitor.on('unlock-screen', this._onUnlockHandler);
      }
    } catch (e) {
      // Ignore if powerMonitor is unsupported or unavailable
    }
  }

  /**
   * Scan storage and schedule active reminders.
   */
  rescheduleAll() {
    // Clear existing timers
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();

    const notes = storage.loadAllNotes();
    notes.forEach(note => {
      if (note.reminder && !note.reminder.fired && typeof note.reminder.dueAt === 'number') {
        this.scheduleReminder(note);
      }
    });
  }

  /**
   * Schedules a reminder timer for a specific note.
   */
  scheduleReminder(note) {
    if (!note || !note.id) return;

    if (this.timers.has(note.id)) {
      clearTimeout(this.timers.get(note.id));
      this.timers.delete(note.id);
    }

    if (!note.reminder || note.reminder.fired || typeof note.reminder.dueAt !== 'number') {
      return;
    }

    const now = Date.now();
    const delay = Math.max(0, note.reminder.dueAt - now);

    // If already due, fire immediately
    if (delay === 0) {
      this.triggerReminder(note.id);
      return;
    }

    // Schedule timer (up to ~24 days supported by Node.js setTimeout 32-bit int limit)
    if (delay < 2147483647) {
      const timer = setTimeout(() => {
        this.triggerReminder(note.id);
      }, delay);
      this.timers.set(note.id, timer);
    }
  }

  /**
   * Cancels a reminder for a note.
   */
  cancelReminder(noteId) {
    if (this.timers.has(noteId)) {
      clearTimeout(this.timers.get(noteId));
      this.timers.delete(noteId);
    }

    const current = this.windowManager.notesData.get(noteId);
    if (current) {
      current.reminder = null;
      storage.saveNote(current);

      const win = this.windowManager.windows.get(noteId);
      if (win && !win.isDestroyed()) {
        win.webContents.send('init-note', current);
      }
    } else {
      const notes = storage.loadAllNotes();
      const n = notes.find(item => item.id === noteId);
      if (n) {
        n.reminder = null;
        storage.saveNote(n);
      }
    }
  }

  /**
   * Periodic check ensuring overdue reminders fire even after system sleep.
   * Uses in-memory note representations to avoid periodic disk reading overhead.
   */
  checkDueReminders() {
    const now = Date.now();
    const notes = this.windowManager?.notesData
      ? Array.from(this.windowManager.notesData.values())
      : storage.loadAllNotes();

    notes.forEach(note => {
      if (note && note.reminder && !note.reminder.fired && typeof note.reminder.dueAt === 'number') {
        if (note.reminder.dueAt <= now) {
          this.triggerReminder(note.id);
        }
      }
    });
  }

  /**
   * Fires the reminder:
   * 1. Marks reminder as fired and saves note.
   * 2. Shows native desktop notification with first line of note.
   * 3. Brings note window to front and triggers glow/shake animation.
   */
  triggerReminder(noteId) {
    if (this.timers.has(noteId)) {
      clearTimeout(this.timers.get(noteId));
      this.timers.delete(noteId);
    }

    // Retrieve note data
    let note = this.windowManager.notesData.get(noteId);
    if (!note) {
      const notes = storage.loadAllNotes();
      note = notes.find(n => n.id === noteId);
    }

    if (!note) return;
    if (note.reminder && note.reminder.fired) return; // Prevent duplicate trigger

    // 1. Mark fired and persist
    if (!note.reminder) {
      note.reminder = { dueAt: Date.now(), fired: true };
    } else {
      note.reminder.fired = true;
    }
    storage.saveNote(note);

    // 2. Extract first line text for notification
    const firstLine = this.extractFirstLine(note.content);

    // 3. Show native desktop notification
    try {
      if (Notification.isSupported()) {
        const notif = new Notification({
          title: 'StickyPad Reminder 📌',
          body: firstLine,
          icon: this.iconPath,
          silent: false
        });

        notif.on('click', () => {
          this.windowManager.focusNote(noteId);
        });

        notif.show();
      }
    } catch (err) {
      console.warn('[ReminderManager] Notification error:', err.message);
    }

    // 4. Bring note to front and trigger glow & shake
    const win = this.windowManager.focusNote(noteId);
    if (win && !win.isDestroyed()) {
      win.webContents.send('init-note', note);
      win.webContents.send('reminder-alert', {
        noteId,
        text: firstLine,
        dueAt: note.reminder.dueAt
      });
    }
  }

  /**
   * Helper extracting a readable plain-text first line from HTML note content.
   */
  extractFirstLine(content) {
    if (!content) return 'Reminder for your note';
    // Strip HTML tags and entities
    const clean = content
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) return 'Reminder for your note';
    const firstLine = clean.split('\n')[0].trim();
    return firstLine.length > 70 ? firstLine.substring(0, 67) + '...' : firstLine;
  }

  destroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    try {
      if (powerMonitor && typeof powerMonitor.removeListener === 'function') {
        if (this._onResumeHandler) powerMonitor.removeListener('resume', this._onResumeHandler);
        if (this._onUnlockHandler) powerMonitor.removeListener('unlock-screen', this._onUnlockHandler);
      }
    } catch (e) {
      // Ignore cleanup error
    }
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
  }
}

module.exports = ReminderManager;
