const { dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const storage = require('./storage');
const { sanitizeImportedNotes } = require('../common/sanitizer');

/**
 * Handles exporting all StickyPad notes to a single JSON backup file
 * and importing notes with validation and user-confirmed Merge or Replace options.
 */
class BackupManager {
  /**
   * Export all notes to a single JSON backup file.
   */
  static async exportAllNotes(parentWindow) {
    const notes = storage.loadAllNotes();
    const dateStr = new Date().toISOString().slice(0, 10);
    const defaultFilename = `stickypad-backup-${dateStr}.json`;

    const { filePath, canceled } = await dialog.showSaveDialog(parentWindow || null, {
      title: 'Export All Notes — StickyPad',
      defaultPath: defaultFilename,
      filters: [
        { name: 'StickyPad Backup (*.json)', extensions: ['json'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    const payload = {
      app: 'StickyPad',
      version: '1.0.0',
      exportedAt: Date.now(),
      noteCount: notes.length,
      notes: notes
    };

    try {
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');

      await dialog.showMessageBox(parentWindow || null, {
        type: 'info',
        title: 'Export Complete',
        message: 'StickyPad notes exported successfully! 📋',
        detail: `Saved ${notes.length} note(s) to:\n${filePath}`
      });

      return { success: true, filePath, count: notes.length };
    } catch (err) {
      console.error('[BackupManager] Export error:', err);
      await dialog.showMessageBox(parentWindow || null, {
        type: 'error',
        title: 'Export Failed',
        message: 'Failed to write backup file.',
        detail: err.message
      });
      return { success: false, error: err.message };
    }
  }

  /**
   * Import notes from a JSON backup file with validation,
   * never overwriting without confirmation, offering Merge or Replace.
   */
  static async importNotes(parentWindow, windowManager) {
    const { filePaths, canceled } = await dialog.showOpenDialog(parentWindow || null, {
      title: 'Import Notes — StickyPad',
      filters: [
        { name: 'StickyPad Backup (*.json)', extensions: ['json'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (canceled || !filePaths || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const filePath = filePaths[0];

    // File size check (max 10MB)
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > 10 * 1024 * 1024) {
        await dialog.showMessageBox(parentWindow || null, {
          type: 'error',
          title: 'File Too Large',
          message: 'The selected backup file exceeds the maximum allowed size of 10 MB.',
          detail: 'Please choose a valid StickyPad backup file.'
        });
        return { success: false, error: 'File exceeds 10 MB limit' };
      }
    } catch (statErr) {
      return { success: false, error: statErr.message };
    }

    let rawContent;
    try {
      rawContent = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      await dialog.showMessageBox(parentWindow || null, {
        type: 'error',
        title: 'File Read Error',
        message: 'Could not read the selected file.',
        detail: err.message
      });
      return { success: false, error: err.message };
    }

    // 1. JSON Parse, Schema Validation & Sanitization (Guards against Prototype Pollution, XSS, DoS)
    let validNotes;
    try {
      validNotes = sanitizeImportedNotes(rawContent);
    } catch (valErr) {
      await dialog.showMessageBox(parentWindow || null, {
        type: 'error',
        title: 'Invalid Backup File',
        message: 'Could not validate notes in this backup file.',
        detail: valErr.message
      });
      return { success: false, error: valErr.message };
    }

    if (validNotes.length === 0) {
      await dialog.showMessageBox(parentWindow || null, {
        type: 'error',
        title: 'Invalid Note Data',
        message: 'None of the items in this backup are valid StickyPad notes.',
        detail: 'Please check the file format.'
      });
      return { success: false, error: 'No valid note records' };
    }

    // 3. User Confirmation & Choice: Merge or Replace
    const choice = await dialog.showMessageBox(parentWindow || null, {
      type: 'question',
      title: 'Import Notes',
      message: `Found ${validNotes.length} note(s) in "${path.basename(filePath)}".`,
      detail: 'How would you like to import these notes?\n\n• Merge: Add imported notes alongside your current notes.\n• Replace: Replace current notes (existing notes are moved to Trash).',
      buttons: ['Merge with Existing Notes', 'Replace All Current Notes', 'Cancel'],
      defaultId: 0,
      cancelId: 2
    });

    if (choice.response === 2) {
      // User cancelled
      return { success: false, canceled: true };
    }

    if (choice.response === 1) {
      // Replace: secondary confirmation prompt
      const confirmReplace = await dialog.showMessageBox(parentWindow || null, {
        type: 'warning',
        title: 'Confirm Replace Notes',
        message: 'Are you sure you want to replace all current notes?',
        detail: 'All existing notes will be moved to Trash, where you can restore them anytime within 30 days.',
        buttons: ['Yes, Replace All Notes', 'Cancel'],
        defaultId: 0,
        cancelId: 1
      });

      if (confirmReplace.response === 1) {
        return { success: false, canceled: true };
      }

      windowManager.handleReplaceAllNotes(validNotes);

      await dialog.showMessageBox(parentWindow || null, {
        type: 'info',
        title: 'Import Complete',
        message: `Successfully replaced active notes with ${validNotes.length} imported note(s)!`
      });

      return { success: true, action: 'replace', count: validNotes.length };
    }

    // Merge
    windowManager.handleMergeNotes(validNotes);

    await dialog.showMessageBox(parentWindow || null, {
      type: 'info',
      title: 'Import Complete',
      message: `Successfully merged ${validNotes.length} imported note(s) into your notes!`
    });

    return { success: true, action: 'merge', count: validNotes.length };
  }
}

module.exports = BackupManager;
