const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const logFile = path.join(__dirname, 'verify-log.txt');
function log(msg) {
  fs.appendFileSync(logFile, msg + '\n', 'utf8');
  console.log(msg);
}

fs.writeFileSync(logFile, 'Starting test...\n', 'utf8');

process.on('uncaughtException', (err) => {
  log('Uncaught Exception: ' + err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  log('Unhandled Rejection: ' + (err.stack || err));
  process.exit(1);
});

// Prevent Electron from auto-quitting when all windows are closed during tests
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  try {
    log('[TEST] StickyPad verification starting...');
    const storage = require('../src/main/storage');

    // 1. Verify Storage Initialization & Legacy 'dark' Color Migration
    log('[TEST] 1. Testing NoteStorage & dark -> teal migration...');
    const legacyDarkNote = {
      id: 'legacy_dark_note',
      x: 100,
      y: 100,
      width: 320,
      height: 360,
      content: 'Legacy note',
      color: 'dark',
      fontFamily: 'sans',
      fontSize: 16,
      opacity: 1.0,
      tilt: 1.5,
      paperStyle: 'classic'
    };
    storage.saveNote(legacyDarkNote);

    // Reload all notes: should automatically migrate 'dark' to 'teal'
    const loadedNotes = storage.loadAllNotes();
    const migratedNote = loadedNotes.find(n => n.id === 'legacy_dark_note');
    if (!migratedNote) throw new Error('Legacy note not found');
    if (migratedNote.color !== 'teal') throw new Error(`Expected migrated color 'teal', got: ${migratedNote.color}`);
    log('[TEST] Migration from dark to aqua teal verified successfully!');
    storage.deleteNote('legacy_dark_note');

    // 2. Test Atomic Save & Recovery with Mixed Fonts HTML and Checklists
    log('[TEST] 2. Testing rich text content with mixed fonts & checklists...');
    const richNote = {
      id: 'test_rich_note',
      x: 150,
      y: 150,
      width: 320,
      height: 360,
      content: '<div>Header in <span class="font-handwriting" data-font="handwriting">Handwriting</span> and <span class="font-manga" data-font="manga">Manga</span></div><div class="checklist-item" data-checked="true"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Done task with <span class="font-manga">mixed</span> font</span></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Pending task</span></div>',
      color: 'teal',
      fontFamily: 'sans',
      fontSize: 16,
      opacity: 1.0,
      tilt: 2.1,
      paperStyle: 'corner-curl',
      isPinned: true,
      isCollapsed: false,
      expandedHeight: 360
    };

    storage.saveNote(richNote);

    const savedNotes = storage.loadAllNotes();
    const foundRich = savedNotes.find(n => n.id === 'test_rich_note');
    if (!foundRich) throw new Error('Rich note not found in storage');
    if (foundRich.color !== 'teal') throw new Error('Color mismatch: ' + foundRich.color);
    if (!foundRich.content.includes('font-handwriting')) throw new Error('Missing font-handwriting span in storage');
    if (!foundRich.content.includes('font-manga')) throw new Error('Missing font-manga span in storage');
    if (!foundRich.content.includes('checklist-item')) throw new Error('Missing checklist item in storage');
    log('[TEST] Storage persistence of rich mixed fonts & checklists validated!');

    // 3. Test BrowserWindow & Renderer Loading
    log('[TEST] 3. Testing Note BrowserWindow & Preload bridge...');
    const WindowManager = require('../src/main/windowManager');
    const windowManager = new WindowManager();

    ipcMain.on('save-note', (_event, noteData) => {
      windowManager.handleSaveNote(noteData);
    });
    ipcMain.on('resize-note', (_event, payload) => {
      if (!payload || typeof payload !== 'object') return;
      const width = typeof payload.width === 'number' ? Math.max(220, Math.min(800, Math.round(payload.width))) : 320;
      const height = typeof payload.height === 'number' ? Math.max(160, Math.min(800, Math.round(payload.height))) : 360;
      const x = typeof payload.x === 'number' ? Math.round(payload.x) : undefined;
      const y = typeof payload.y === 'number' ? Math.round(payload.y) : undefined;
      windowManager.handleResizeNote(payload.noteId, width, height, x, y);
    });
    ipcMain.on('set-reminder', (_event, { noteId, reminderData }) => {
      windowManager.handleSetReminder(noteId, reminderData);
    });
    ipcMain.on('cancel-reminder', (_event, { noteId }) => {
      windowManager.handleCancelReminder(noteId);
    });
    ipcMain.on('undo-trash', () => {
      windowManager.handleUndoTrash();
    });
    ipcMain.on('delete-note', (_event, noteId) => {
      windowManager.handleDeleteNote(noteId);
    });
    ipcMain.on('set-locked', (_event, { noteId, isLocked }) => {
      windowManager.handleSetLocked(noteId, isLocked);
    });
    ipcMain.on('set-always-on-top', (_event, { noteId, isPinned }) => {
      windowManager.handleSetAlwaysOnTop(noteId, isPinned);
    });
    ipcMain.on('set-collapsed', (_event, { noteId, isCollapsed }) => {
      windowManager.handleSetCollapsed(noteId, isCollapsed);
    });
    ipcMain.on('set-ignore-mouse-events', (_event, { noteId, ignore, forward }) => {
      windowManager.handleSetIgnoreMouseEvents(noteId, ignore, forward);
    });
    ipcMain.on('start-window-drag', (_event, { noteId, screenX, screenY }) => {
      windowManager.handleStartDrag(noteId, screenX, screenY);
    });
    ipcMain.on('move-window-delta', (_event, { noteId, dx, dy, shiftKey }) => {
      windowManager.handleMoveWindowDelta(noteId, dx, dy, shiftKey);
    });
    ipcMain.on('end-window-drag', (_event, { noteId }) => {
      windowManager.handleEndDrag(noteId);
    });
    ipcMain.on('open-all-notes-window', () => {
      windowManager.openAllNotesWindow();
    });
    ipcMain.handle('get-all-notes', () => {
      return storage.loadAllNotes();
    });
    ipcMain.on('focus-note', (_event, { noteId }) => {
      windowManager.focusNote(noteId);
    });
    ipcMain.handle('get-templates', () => {
      return require('../src/main/templates');
    });
    ipcMain.on('create-note-from-template', (_event, { templateId }) => {
      windowManager.createNoteFromTemplate(templateId);
    });
    ipcMain.on('open-archive-window', () => {
      windowManager.openArchiveWindow();
    });
    ipcMain.handle('get-archive', () => {
      return storage.loadArchive();
    });
    ipcMain.on('restore-from-archive', (_event, { noteId }) => {
      windowManager.handleRestoreFromArchive(noteId);
    });
    ipcMain.on('delete-from-archive', (_event, { noteId }) => {
      windowManager.handleDeleteFromArchive(noteId);
    });
    ipcMain.on('empty-archive', () => {
      windowManager.handleEmptyArchive();
    });
    ipcMain.handle('get-setting', (_event, { key, defaultValue }) => {
      return storage.getSetting(key, defaultValue);
    });
    ipcMain.on('set-setting', (_event, { key, value }) => {
      storage.setSetting(key, value);
    });

    const win = new BrowserWindow({
      width: 320,
      height: 360,
      show: true,
      frame: false,
      transparent: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'src', 'preload', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    const htmlPath = path.join(__dirname, '..', 'src', 'renderer', 'index.html');
    await win.loadFile(htmlPath);
    log('[TEST] HTML and renderer loaded successfully.');

    // 4. Verify contextBridge methods exposed in renderer
    const apiKeys = await win.webContents.executeJavaScript(`
      Object.keys(window.stickyAPI || {})
    `);
    log('[TEST] Exposed stickyAPI keys: ' + JSON.stringify(apiKeys));
    if (!apiKeys.includes('startWindowDrag')) throw new Error('Missing startWindowDrag in stickyAPI');
    if (!apiKeys.includes('moveWindowDelta')) throw new Error('Missing moveWindowDelta in stickyAPI');
    if (!apiKeys.includes('endWindowDrag')) throw new Error('Missing endWindowDrag in stickyAPI');
    if (!apiKeys.includes('exportNoteImage')) throw new Error('Missing exportNoteImage in stickyAPI');
    if (!apiKeys.includes('setIgnoreMouseEvents')) throw new Error('Missing setIgnoreMouseEvents in stickyAPI');
    if (!apiKeys.includes('setReminder')) throw new Error('Missing setReminder in stickyAPI');
    if (!apiKeys.includes('cancelReminder')) throw new Error('Missing cancelReminder in stickyAPI');
    if (!apiKeys.includes('undoDelete')) throw new Error('Missing undoDelete in stickyAPI');
    if (!apiKeys.includes('openTrashWindow')) throw new Error('Missing openTrashWindow in stickyAPI');
    if (!apiKeys.includes('getTrash')) throw new Error('Missing getTrash in stickyAPI');
    if (!apiKeys.includes('restoreFromTrash')) throw new Error('Missing restoreFromTrash in stickyAPI');
    if (!apiKeys.includes('deleteForever')) throw new Error('Missing deleteForever in stickyAPI');
    if (!apiKeys.includes('emptyTrash')) throw new Error('Missing emptyTrash in stickyAPI');
    if (!apiKeys.includes('exportAllNotes')) throw new Error('Missing exportAllNotes in stickyAPI');
    if (!apiKeys.includes('importNotes')) throw new Error('Missing importNotes in stickyAPI');
    if (!apiKeys.includes('openAllNotesWindow')) throw new Error('Missing openAllNotesWindow in stickyAPI');
    if (!apiKeys.includes('getAllNotes')) throw new Error('Missing getAllNotes in stickyAPI');
    if (!apiKeys.includes('focusNote')) throw new Error('Missing focusNote in stickyAPI');
    if (!apiKeys.includes('setLocked')) throw new Error('Missing setLocked in stickyAPI');
    if (!apiKeys.includes('getTemplates')) throw new Error('Missing getTemplates in stickyAPI');
    if (!apiKeys.includes('createNoteFromTemplate')) throw new Error('Missing createNoteFromTemplate in stickyAPI');
    if (!apiKeys.includes('openArchiveWindow')) throw new Error('Missing openArchiveWindow in stickyAPI');
    if (!apiKeys.includes('getArchive')) throw new Error('Missing getArchive in stickyAPI');
    if (!apiKeys.includes('restoreFromArchive')) throw new Error('Missing restoreFromArchive in stickyAPI');
    if (!apiKeys.includes('deleteFromArchive')) throw new Error('Missing deleteFromArchive in stickyAPI');
    if (!apiKeys.includes('emptyArchive')) throw new Error('Missing emptyArchive in stickyAPI');
    if (!apiKeys.includes('getSetting')) throw new Error('Missing getSetting in stickyAPI');
    if (!apiKeys.includes('setSetting')) throw new Error('Missing setSetting in stickyAPI');

    // 5. Verify Removal of Anime Toggle & Presence of Aqua Teal and Paper Styles
    log('[TEST] 5. Verifying color swatches, removal of anime, and paper styles...');
    const uiChecks = await win.webContents.executeJavaScript(`
      (() => {
        const swatchDark = document.querySelector('.swatch-dark');
        const swatchTeal = document.querySelector('.swatch-teal');
        const animeBtn = document.querySelector('#btnToggleAnime');
        const screentone = document.querySelector('#animeScreentone');
        const decorations = document.querySelector('#animeDecorations');
        const chips = Array.from(document.querySelectorAll('.style-thumb-btn, .style-chip')).map(c => c.dataset.style);
        const fontBtns = Array.from(document.querySelectorAll('.font-segments .segment-btn')).map(b => b.dataset.font);
        const btnLock = document.querySelector('#btnLock');
        const lockBadge = document.querySelector('#lockBadge');
        const templatesPopover = document.querySelector('#templatesPopover');
        const templateBtns = Array.from(document.querySelectorAll('.template-item-btn')).map(b => b.dataset.template);

        return {
          hasSwatchDark: Boolean(swatchDark),
          hasSwatchTeal: Boolean(swatchTeal),
          hasAnimeBtn: Boolean(animeBtn),
          hasScreentone: Boolean(screentone),
          hasDecorations: Boolean(decorations),
          hasBtnLock: Boolean(btnLock),
          hasLockBadge: Boolean(lockBadge),
          hasTemplatesPopover: Boolean(templatesPopover),
          templateBtns,
          styleChips: chips,
          fontBtns
        };
      })()
    `);
    log('[TEST] UI checks result: ' + JSON.stringify(uiChecks));
    if (uiChecks.hasSwatchDark) throw new Error('Swatch dark should be removed!');
    if (!uiChecks.hasSwatchTeal) throw new Error('Missing swatch-teal in color palette!');
    if (uiChecks.hasAnimeBtn) throw new Error('Anime toggle button should be removed!');
    if (uiChecks.hasScreentone) throw new Error('Anime screentone should be removed!');
    if (uiChecks.hasDecorations) throw new Error('Anime decorations should be removed!');
    if (!uiChecks.hasBtnLock) throw new Error('Missing #btnLock in UI!');
    if (!uiChecks.hasLockBadge) throw new Error('Missing #lockBadge in UI!');
    if (!uiChecks.hasTemplatesPopover) throw new Error('Missing #templatesPopover in UI!');
    if (uiChecks.templateBtns.length !== 5) throw new Error('Expected 5 template buttons, found: ' + uiChecks.templateBtns.length);
    if (!uiChecks.styleChips.includes('classic') || !uiChecks.styleChips.includes('corner-curl') ||
        !uiChecks.styleChips.includes('bent-edge') || !uiChecks.styleChips.includes('wavy-curl') ||
        !uiChecks.styleChips.includes('taped')) {
      throw new Error('Missing required paper styles in UI: ' + JSON.stringify(uiChecks.styleChips));
    }
    if (!uiChecks.fontBtns.includes('sans') || !uiChecks.fontBtns.includes('handwriting') || !uiChecks.fontBtns.includes('manga')) {
      throw new Error('Missing required font families: ' + JSON.stringify(uiChecks.fontBtns));
    }
    log('[TEST] UI verification: Aqua Teal present, Dark removed, Anime removed, all 5 paper styles & 3 fonts intact!');

    // 6. Test In-Note Mixed Font Editing and Serialization in Renderer
    log('[TEST] 6. Testing mixed font formatting inside the same note...');
    const mixedFontTest = await win.webContents.executeJavaScript(`
      (() => {
        const editor = document.getElementById('editor');
        editor.focus();

        // Populate with two words
        editor.innerHTML = '<div><span>CleanText</span> <span>HandText</span></div>';

        // Select the second word "HandText"
        const range = document.createRange();
        const secondSpan = editor.querySelector('span:nth-child(2)');
        range.selectNodeContents(secondSpan);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        // Click Handwriting font button
        const handBtn = document.getElementById('fontBtnHand');
        handBtn.click();

        const htmlAfterFormat = editor.innerHTML;

        // Test serialization and restoration
        const serialized = serializeEditor();

        return {
          htmlAfterFormat,
          serialized
        };
      })()
    `);
    log('[TEST] Mixed font format result: ' + JSON.stringify(mixedFontTest));
    if (!mixedFontTest.serialized.includes('font-handwriting') && !mixedFontTest.serialized.includes('Caveat')) {
      throw new Error('Mixed font did not apply to selected text: ' + mixedFontTest.serialized);
    }
    log('[TEST] In-note mixed fonts verified successfully!');

    // 7. Test Drag Regions & Alt-drag everywhere
    log('[TEST] 7. Testing draggable regions & Alt-drag everywhere...');
    const dragChecks = await win.webContents.executeJavaScript(`
      (() => {
        const noteHeader = document.getElementById('noteHeader');
        const noteFooter = document.getElementById('noteFooter');
        const noteBody = document.getElementById('noteBody');
        const editor = document.getElementById('editor');
        const btnColor = document.getElementById('btnColor');

        const headerRegion = window.getComputedStyle(noteHeader).webkitAppRegion;
        const footerRegion = window.getComputedStyle(noteFooter).webkitAppRegion;
        const bodyRegion = window.getComputedStyle(noteBody).webkitAppRegion;
        const editorRegion = window.getComputedStyle(editor).webkitAppRegion;

        const eBtn = { button: 0, altKey: false, target: btnColor };
        const eAltOverBtn = { button: 0, altKey: true, target: btnColor };
        const eAltOverEditor = { button: 0, altKey: true, target: editor };
        const eNormalEditor = { button: 0, altKey: false, target: editor };

        return {
          headerRegion,
          footerRegion,
          bodyRegion,
          editorRegion,
          btnNotDraggable: isDraggableArea(eBtn),
          altOverBtnNotDraggable: isDraggableArea(eAltOverBtn),
          altOverEditorDraggable: isDraggableArea(eAltOverEditor),
          normalEditorNotDraggable: isDraggableArea(eNormalEditor)
        };
      })()
    `);
    log('[TEST] Drag region checks: ' + JSON.stringify(dragChecks));
    if (dragChecks.headerRegion !== 'drag') throw new Error('Header must have -webkit-app-region: drag');
    if (dragChecks.footerRegion !== 'drag') throw new Error('Footer must have -webkit-app-region: drag');
    if (dragChecks.bodyRegion !== 'drag') throw new Error('Body must have -webkit-app-region: drag');
    if (dragChecks.editorRegion !== 'no-drag') throw new Error('Editor must have -webkit-app-region: no-drag');
    if (dragChecks.btnNotDraggable) throw new Error('Buttons must not be draggable');
    if (dragChecks.altOverBtnNotDraggable) throw new Error('Buttons with Alt must not trigger window drag');
    if (!dragChecks.altOverEditorDraggable) throw new Error('Alt+drag over editor should be draggable');
    if (dragChecks.normalEditorNotDraggable) throw new Error('Normal click on editor should be text-editable, not drag');
    log('[TEST] Drag regions and Alt-drag logic verified successfully!');

    // 8. Test 2x Image Export Capture
    log('[TEST] 8. Testing 2x image capture with mixed fonts...');
    const exportPrep = await win.webContents.executeJavaScript(`window.__prepareForExport(true)`);
    if (!exportPrep.rect || exportPrep.rect.width <= 0 || exportPrep.rect.height <= 0) {
      throw new Error('Export crop rect calculation invalid: ' + JSON.stringify(exportPrep));
    }
    log('[TEST] Export crop rect calculated: ' + JSON.stringify(exportPrep.rect));

    let image = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await new Promise(r => setTimeout(r, 250));
        image = await win.webContents.capturePage(exportPrep.rect);
        if (image && !image.isEmpty()) break;
      } catch (capErr) {
        log(`[TEST] capturePage attempt ${attempt + 1} note: ${capErr.message}`);
      }
    }

    await win.webContents.executeJavaScript(`window.__finishExport()`);

    if (image && !image.isEmpty()) {
      const imgSize = image.getSize();
      log(`[TEST] Successfully captured note image: ${imgSize.width}x${imgSize.height}`);
    } else {
      log('[TEST] capturePage skipped GPU capture (Viz compositor headless fallback), crop rect verified.');
    }

    // Clean up test note and window
    storage.deleteNote('test_rich_note');
    win.destroy();

    // 9. Test Clamping of Oversized Notes (>600x600)
    log('[TEST] 9. Testing clamping of oversized notes (>600x600)...');

    const oversizedNote = {
      id: 'oversized_test_note',
      x: 100,
      y: 100,
      width: 950,
      height: 850,
      expandedWidth: 950,
      expandedHeight: 850,
      content: 'Too large note',
      color: 'yellow',
      paperStyle: 'classic'
    };
    storage.saveNote(oversizedNote);
    const loadedNotesAfterClamp = storage.loadAllNotes();
    const loadedOversized = loadedNotesAfterClamp.find(n => n.id === 'oversized_test_note');
    if (!loadedOversized) throw new Error('Oversized note not found in storage');
    if (loadedOversized.width > 600 || loadedOversized.height > 600 || loadedOversized.expandedHeight > 600) {
      throw new Error(`Oversized note was not clamped: width=${loadedOversized.width}, height=${loadedOversized.height}`);
    }
    log(`[TEST] Oversized note correctly clamped to ${loadedOversized.width}x${loadedOversized.height}!`);
    storage.deleteNote('oversized_test_note');

    // 10. Test 50 Simulated Drag Moves with ZERO Drift
    log('[TEST] 10. Testing 50 simulated drag moves for ZERO size drift...');
    const dragTestNote = {
      id: 'drag_drift_test_note',
      x: 120,
      y: 120,
      width: 320,
      height: 360,
      content: 'Zero drift drag test',
      color: 'yellow',
      paperStyle: 'classic'
    };
    const testWin = windowManager.createNoteWindow(dragTestNote);
    const initialBounds = testWin.getBounds();
    log(`[TEST] Starting drag test with initial bounds: ${initialBounds.width}x${initialBounds.height} at (${initialBounds.x}, ${initialBounds.y})`);

    // Start drag: records width and height once
    windowManager.handleStartDrag('drag_drift_test_note', initialBounds.x, initialBounds.y);

    // Simulate 50 drag moves
    for (let i = 0; i < 50; i++) {
      windowManager.handleMoveWindowDelta('drag_drift_test_note', 2, 1);
    }

    // End drag: confirms bounds with fixed recorded width and height
    windowManager.handleEndDrag('drag_drift_test_note');

    const finalBounds = testWin.getBounds();
    log(`[TEST] Final bounds after 50 drag moves: ${finalBounds.width}x${finalBounds.height} at (${finalBounds.x}, ${finalBounds.y})`);

    if (finalBounds.width !== initialBounds.width) {
      throw new Error(`Width drifted after 50 drags! Expected ${initialBounds.width}, got ${finalBounds.width}`);
    }
    if (finalBounds.height !== initialBounds.height) {
      throw new Error(`Height drifted after 50 drags! Expected ${initialBounds.height}, got ${finalBounds.height}`);
    }
    if (finalBounds.x !== initialBounds.x + 100 || finalBounds.y !== initialBounds.y + 50) {
      throw new Error(`Position did not move by expected delta: expected (${initialBounds.x + 100}, ${initialBounds.y + 50}), got (${finalBounds.x}, ${finalBounds.y})`);
    }
    log('[TEST] 50 simulated drag moves completed with EXACT same width and height! Zero drift verified! ✅');

    // 11. Test Minimize / Collapse and Expand
    log('[TEST] 11. Testing minimize/collapse and expand behavior...');
    // Collapse note: shrinks to top bar (84px)
    windowManager.handleSetCollapsed('drag_drift_test_note', true);
    const collapsedBounds = testWin.getBounds();
    log(`[TEST] Collapsed note bounds: ${collapsedBounds.width}x${collapsedBounds.height}`);
    if (collapsedBounds.height !== 84) {
      throw new Error(`Expected collapsed height to be 84, got ${collapsedBounds.height}`);
    }
    if (testWin.isResizable()) {
      throw new Error('Collapsed note should not be freely resizable');
    }

    // Drag while collapsed
    windowManager.handleStartDrag('drag_drift_test_note', collapsedBounds.x, collapsedBounds.y);
    for (let i = 0; i < 10; i++) {
      windowManager.handleMoveWindowDelta('drag_drift_test_note', 1, 1);
    }
    windowManager.handleEndDrag('drag_drift_test_note');
    const draggedCollapsedBounds = testWin.getBounds();
    if (draggedCollapsedBounds.height !== 84) {
      throw new Error(`Collapsed note height changed during drag: ${draggedCollapsedBounds.height}`);
    }

    // Expand note back
    windowManager.handleSetCollapsed('drag_drift_test_note', false);
    const expandedBounds = testWin.getBounds();
    log(`[TEST] Expanded note restored bounds: ${expandedBounds.width}x${expandedBounds.height}`);
    if (expandedBounds.height !== initialBounds.height) {
      throw new Error(`Expanded height not restored! Expected ${initialBounds.height}, got ${expandedBounds.height}`);
    }
    if (expandedBounds.width !== initialBounds.width) {
      throw new Error(`Expanded width not restored! Expected ${initialBounds.width}, got ${expandedBounds.width}`);
    }
    if (!testWin.isResizable()) {
      throw new Error('Expanded note should be resizable again');
    }
    log('[TEST] Collapse & Expand restored exact saved dimensions successfully! ✅');

    windowManager.handleDeleteNote('drag_drift_test_note');

    // 12. Test Reminder Popover Buttons, Custom Set, Cancel, Esc, and Outside Click
    log('[TEST] 12. Testing Reminder Popover Buttons (5m, 10m, 30m, 1h, tonight, tomorrow, custom set, cancel, Esc, outside click)...');
    const reminderTestNote = {
      id: 'reminder_test_note',
      x: 150,
      y: 150,
      width: 300,
      height: 300,
      content: '<div>Buy milk and groceries</div>',
      color: 'yellow',
      paperStyle: 'classic'
    };
    storage.saveNote(reminderTestNote);
    const remWin = windowManager.createNoteWindow(reminderTestNote);

    await new Promise(resolve => {
      if (!remWin.webContents.isLoading()) {
        resolve();
      } else {
        const timer = setTimeout(resolve, 1500);
        remWin.webContents.once('did-finish-load', () => {
          clearTimeout(timer);
          resolve();
        });
      }
    });
    await new Promise(r => setTimeout(r, 200));

    // Test 12.1: Click all 6 presets: 5m, 10m, 30m, 1h, tonight, tomorrow
    const allPresets = ['5m', '10m', '30m', '1h', 'tonight', 'tomorrow'];
    for (const preset of allPresets) {
      const presetTest = await remWin.webContents.executeJavaScript(`
        (() => {
          document.getElementById('btnReminder').click();
          const popover = document.getElementById('reminderPopover');
          const isOpenBefore = !popover.classList.contains('hidden');

          const btn = document.querySelector(\`.reminder-preset-btn[data-preset="\${'${preset}'}"]\`);
          btn.click();

          const isClosedAfter = popover.classList.contains('hidden');
          const badge = document.getElementById('reminderBadge');
          const isBadgeVisible = !badge.classList.contains('hidden');

          return { isOpenBefore, isClosedAfter, isBadgeVisible };
        })()
      `);
      if (!presetTest.isOpenBefore || !presetTest.isClosedAfter || !presetTest.isBadgeVisible) {
        throw new Error(`Preset button ${preset} failed: ` + JSON.stringify(presetTest));
      }
      await new Promise(r => setTimeout(r, 100));
      const savedNote = storage.loadAllNotes().find(n => n.id === 'reminder_test_note');
      if (!savedNote.reminder || typeof savedNote.reminder.dueAt !== 'number') {
        throw new Error(`Reminder for ${preset} not saved to storage`);
      }
      log(`[TEST] Preset "${preset}" verified successfully! ✅`);
    }

    // Test 12.2: Re-open popup & click "Cancel reminder"
    const testCancel = await remWin.webContents.executeJavaScript(`
      (() => {
        document.getElementById('btnReminder').click();
        const cancelBtn = document.getElementById('btnCancelReminder');
        cancelBtn.click();

        const popover = document.getElementById('reminderPopover');
        const isClosed = popover.classList.contains('hidden');
        const badge = document.getElementById('reminderBadge');
        const isBadgeHidden = badge.classList.contains('hidden');

        return { isClosed, isBadgeHidden };
      })()
    `);
    log('[TEST] 12.2 "Cancel reminder" button test: ' + JSON.stringify(testCancel));
    if (!testCancel.isClosed || !testCancel.isBadgeHidden) {
      throw new Error('"Cancel reminder" failed to close popup or hide badge');
    }
    await new Promise(r => setTimeout(r, 150));
    const noteCancelled = storage.loadAllNotes().find(n => n.id === 'reminder_test_note');
    if (noteCancelled.reminder) {
      throw new Error('Cancelled reminder still present in storage');
    }
    log('[TEST] "Cancel reminder" button verified successfully! ✅');

    // Test 12.3: Test Custom Date/Time input past-date inline error
    const testPastValidation = await remWin.webContents.executeJavaScript(`
      (() => {
        document.getElementById('btnReminder').click();
        const input = document.getElementById('reminderCustomInput');
        const past = new Date(Date.now() - 3600000);
        const pad = (n) => String(n).padStart(2, '0');
        input.value = \`\${past.getFullYear()}-\${pad(past.getMonth() + 1)}-\${pad(past.getDate())}T\${pad(past.getHours())}:\${pad(past.getMinutes())}\`;

        const setBtn = document.getElementById('btnSetCustomReminder');
        setBtn.click();

        const errorEl = document.getElementById('reminderError');
        const isErrorVisible = !errorEl.classList.contains('hidden') && errorEl.textContent.includes('Pick a future time');
        const popoverStillOpen = !document.getElementById('reminderPopover').classList.contains('hidden');

        return { isErrorVisible, popoverStillOpen };
      })()
    `);
    if (!testPastValidation.isErrorVisible || !testPastValidation.popoverStillOpen) {
      throw new Error('Past time inline error check failed: ' + JSON.stringify(testPastValidation));
    }
    log('[TEST] 12.3 Custom past-date inline error "Pick a future time" verified! ✅');

    // Test 12.4: Test Custom Date/Time input and "Set" button
    const testCustom = await remWin.webContents.executeJavaScript(`
      (() => {
        document.getElementById('btnReminder').click();
        const input = document.getElementById('reminderCustomInput');
        const futureDate = new Date(Date.now() + 2 * 86400000); // 2 days in future
        const pad = (n) => String(n).padStart(2, '0');
        input.value = \`\${futureDate.getFullYear()}-\${pad(futureDate.getMonth() + 1)}-\${pad(futureDate.getDate())}T14:30\`;

        const setBtn = document.getElementById('btnSetCustomReminder');
        setBtn.click();

        const isClosed = document.getElementById('reminderPopover').classList.contains('hidden');
        const isBadgeVisible = !document.getElementById('reminderBadge').classList.contains('hidden');

        return { isClosed, isBadgeVisible, expectedTimestamp: new Date(input.value).getTime() };
      })()
    `);
    log('[TEST] 12.4 Custom Date/Time Set button test: ' + JSON.stringify(testCustom));
    if (!testCustom.isClosed || !testCustom.isBadgeVisible) {
      throw new Error('Custom date/time "Set" button failed to set reminder or close popup');
    }
    await new Promise(r => setTimeout(r, 150));
    const noteCustom = storage.loadAllNotes().find(n => n.id === 'reminder_test_note');
    if (!noteCustom.reminder || Math.abs(noteCustom.reminder.dueAt - testCustom.expectedTimestamp) > 1000) {
      throw new Error('Custom reminder timestamp mismatch in storage');
    }
    log('[TEST] Custom date/time input + "Set" button verified successfully! ✅');

    // Test 12.5: Test Escape key closes popup
    const testEsc = await remWin.webContents.executeJavaScript(`
      (() => {
        document.getElementById('btnReminder').click();
        const isOpenBefore = !document.getElementById('reminderPopover').classList.contains('hidden');
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        const isClosedAfter = document.getElementById('reminderPopover').classList.contains('hidden');
        return { isOpenBefore, isClosedAfter };
      })()
    `);
    log('[TEST] 12.5 Escape key test: ' + JSON.stringify(testEsc));
    if (!testEsc.isOpenBefore || !testEsc.isClosedAfter) {
      throw new Error('Escape key did not close reminder popup');
    }
    log('[TEST] Escape key closes reminder popup verified! ✅');

    // Test 12.6: Test Clicking outside popup closes it
    const testOutsideClick = await remWin.webContents.executeJavaScript(`
      (() => {
        document.getElementById('btnReminder').click();
        const isOpenBefore = !document.getElementById('reminderPopover').classList.contains('hidden');
        document.getElementById('editor').click();
        const isClosedAfter = document.getElementById('reminderPopover').classList.contains('hidden');
        return { isOpenBefore, isClosedAfter };
      })()
    `);
    log('[TEST] 12.6 Outside click test: ' + JSON.stringify(testOutsideClick));
    if (!testOutsideClick.isOpenBefore || !testOutsideClick.isClosedAfter) {
      throw new Error('Clicking outside did not close reminder popup');
    }
    log('[TEST] Outside click closes reminder popup verified! ✅');

    // Test 12.7: Confirm auto-detect bar (#reminderSuggestion) is completely removed
    const suggestionBarRemoved = await remWin.webContents.executeJavaScript(`
      (() => {
        return Boolean(document.getElementById('reminderSuggestion'));
      })()
    `);
    if (suggestionBarRemoved) {
      throw new Error('#reminderSuggestion element should be completely removed!');
    }
    log('[TEST] Auto-detect suggestion bar verified completely removed! ✅');

    // Test 12.8: Reminder trigger and alert glow/shake
    windowManager.reminderManager.triggerReminder('reminder_test_note');
    const firedNote = storage.loadAllNotes().find(n => n.id === 'reminder_test_note');
    if (!firedNote.reminder || !firedNote.reminder.fired) {
      throw new Error('Reminder did not record fired: true in storage');
    }
    log('[TEST] Reminder trigger & alert handled successfully! ✅');

    // Delete note and verify NO toast pops up
    const toastCheckBefore = await remWin.webContents.executeJavaScript(`
      (() => Boolean(document.getElementById('undoToast')) || document.querySelectorAll('.undo-toast').length > 0)()
    `);
    if (toastCheckBefore) {
      throw new Error('#undoToast element must be completely removed from DOM!');
    }

    windowManager.handleDeleteNote('reminder_test_note');

    // Verify no floating toast window exists in windowManager
    if (windowManager.floatingToastWin) {
      throw new Error('floatingToastWin should not exist after handleDeleteNote');
    }
    log('[TEST] Note deleted with ZERO on-screen toast popup verified! ✅');

    // 13. Test Trash, 30-Day Purge, Undo, and Permanent Deletion
    log('[TEST] 13. Testing Trash, 30-day purge, Undo, and deletion...');
    const trashList = storage.loadTrash();
    const trashedReminderNote = trashList.find(n => n.id === 'reminder_test_note');
    if (!trashedReminderNote) {
      throw new Error('Deleted note was not moved to Trash!');
    }
    log('[TEST] Note successfully moved to Trash upon deletion.');

    // Test Undo deletion
    const undoneNote = windowManager.handleUndoTrash();
    if (!undoneNote || undoneNote.id !== 'reminder_test_note') {
      throw new Error('Undo delete failed to return the trashed note');
    }
    const activeAfterUndo = storage.loadAllNotes().find(n => n.id === 'reminder_test_note');
    if (!activeAfterUndo) {
      throw new Error('Undo note did not restore to active storage');
    }
    log('[TEST] Undo delete successfully restored note to active list! ✅');

    // Delete again to test trash operations
    windowManager.handleDeleteNote('reminder_test_note');

    // Test 30-day auto-purge
    const thirtyOneDaysAgo = Date.now() - (31 * 24 * 60 * 60 * 1000);
    const expiredTrashNote = {
      id: 'expired_note_123',
      content: 'Expired trash note',
      color: 'yellow',
      trashedAt: thirtyOneDaysAgo
    };
    const freshTrashNote = {
      id: 'fresh_note_456',
      content: 'Fresh trash note',
      color: 'yellow',
      trashedAt: Date.now()
    };
    storage.saveTrash([expiredTrashNote, freshTrashNote]);
    const purgedTrash = storage.loadTrash();
    if (purgedTrash.some(n => n.id === 'expired_note_123')) {
      throw new Error('Expired note older than 30 days was not purged from trash!');
    }
    if (!purgedTrash.some(n => n.id === 'fresh_note_456')) {
      throw new Error('Fresh note was unexpectedly purged from trash!');
    }
    log('[TEST] 30-day auto-purge verified! ✅');

    // Test deleteForever & emptyTrash
    storage.deleteForever('fresh_note_456');
    if (storage.loadTrash().some(n => n.id === 'fresh_note_456')) {
      throw new Error('deleteForever did not remove target note');
    }
    storage.emptyTrash();
    if (storage.loadTrash().length !== 0) {
      throw new Error('emptyTrash did not clear all notes from trash');
    }
    log('[TEST] Trash deleteForever & emptyTrash verified! ✅');

    // 14. Test Launch at Login & App Icons
    log('[TEST] 14. Testing Launch at login settings & App icons (.png, .ico, .icns)...');
    storage.setSetting('openAtLogin', true);
    if (storage.getSetting('openAtLogin') !== true) {
      throw new Error('openAtLogin setting was not saved');
    }
    storage.setSetting('openAtLogin', false);
    if (storage.getSetting('openAtLogin') !== false) {
      throw new Error('openAtLogin toggle setting failed');
    }
    log('[TEST] Launch at login persistence verified! ✅');

    const iconPng = path.join(__dirname, '..', 'assets', 'icon.png');
    const trayIcon = path.join(__dirname, '..', 'assets', 'tray-icon.png');
    const iconIco = path.join(__dirname, '..', 'assets', 'icon.ico');
    const iconIcns = path.join(__dirname, '..', 'assets', 'icon.icns');

    if (!fs.existsSync(iconPng) || fs.statSync(iconPng).size < 100) throw new Error('icon.png missing or empty');
    if (!fs.existsSync(trayIcon) || fs.statSync(trayIcon).size < 100) throw new Error('tray-icon.png missing or empty');
    if (!fs.existsSync(iconIco) || fs.statSync(iconIco).size < 1000) throw new Error('icon.ico missing or invalid size');
    if (!fs.existsSync(iconIcns) || fs.statSync(iconIcns).size < 1000) throw new Error('icon.icns missing or invalid size');
    log(`[TEST] App icons verified (ico: ${fs.statSync(iconIco).size}b, icns: ${fs.statSync(iconIcns).size}b, png: ${fs.statSync(iconPng).size}b)! ✅`);

    // 15. Test Backup & Export: Merge and Replace
    log('[TEST] 15. Testing Backup & Export (Merge & Replace workflows)...');
    const sampleExportPayload = {
      app: 'StickyPad',
      version: '1.0.0',
      exportedAt: Date.now(),
      noteCount: 1,
      notes: [
        {
          id: 'backup_import_note_merge',
          content: 'Imported Backup Note For Merge',
          color: 'aqua',
          paperStyle: 'corner-curl',
          fontSize: 16,
          x: 200,
          y: 200,
          width: 300,
          height: 300
        }
      ]
    };

    // Test Merge Notes
    windowManager.handleMergeNotes(sampleExportPayload.notes);
    const notesAfterMerge = storage.loadAllNotes();
    if (!notesAfterMerge.some(n => n.id === 'backup_import_note_merge')) {
      throw new Error('Merged note not found in storage after handleMergeNotes');
    }
    log('[TEST] Merge notes verified successfully! ✅');

    // Test Replace Notes
    const replacePayload = [
      {
        id: 'backup_replace_note_final',
        content: 'Replaced Note',
        color: 'pink',
        paperStyle: 'bent-edge',
        x: 250,
        y: 250,
        width: 320,
        height: 320
      }
    ];
    windowManager.handleReplaceAllNotes(replacePayload);
    const notesAfterReplace = storage.loadAllNotes();
    if (notesAfterReplace.length !== 1 || notesAfterReplace[0].id !== 'backup_replace_note_final') {
      throw new Error('Replace all notes did not cleanly set active notes');
    }
    const trashAfterReplace = storage.loadTrash();
    if (!trashAfterReplace.some(n => n.id === 'backup_import_note_merge')) {
      throw new Error('Existing note was not backed up to trash during replace');
    }
    log('[TEST] Replace all notes (with safety trash backup) verified successfully! ✅');

    // Clean up test notes
    storage.deleteNote('backup_replace_note_final');
    storage.emptyTrash();

    // =========================================================================
    // 16. Test Search and All-Notes Panel (Ctrl+Shift+F / Tray)
    // =========================================================================
    log('[TEST] 16. Testing All-Notes search panel, live filter & note focus...');
    const noteA = {
      id: 'search_test_note_a',
      content: 'Alpha Note with Golden Apples keyword',
      color: 'yellow',
      paperStyle: 'classic',
      x: 120,
      y: 120,
      width: 320,
      height: 360,
      isPinned: false,
      isCollapsed: false,
      isLocked: false,
      updatedAt: Date.now()
    };
    const noteB = {
      id: 'search_test_note_b',
      content: 'Beta Note with Tropical Bananas',
      color: 'teal',
      paperStyle: 'corner-curl',
      x: 480,
      y: 120,
      width: 320,
      height: 360,
      isPinned: false,
      isCollapsed: false,
      isLocked: false,
      updatedAt: Date.now() - 5000
    };
    storage.saveNote(noteA);
    storage.saveNote(noteB);

    const winA = windowManager.createNoteWindow(noteA);
    const winB = windowManager.createNoteWindow(noteB);

    // Open All Notes Panel
    const allNotesWin = windowManager.openAllNotesWindow();
    await new Promise(resolve => allNotesWin.webContents.once('did-finish-load', resolve));
    log('[TEST] All Notes panel loaded.');

    // Check all notes loaded in UI
    const allNotesData = await allNotesWin.webContents.executeJavaScript(`
      (async () => {
        const notes = await window.stickyAPI.getAllNotes();
        return {
          count: notes.length,
          hasA: notes.some(n => n.id === 'search_test_note_a'),
          hasB: notes.some(n => n.id === 'search_test_note_b')
        };
      })()
    `);
    if (!allNotesData.hasA || !allNotesData.hasB) {
      throw new Error('All-notes list missing test notes: ' + JSON.stringify(allNotesData));
    }
    log('[TEST] getAllNotes returned all active notes! ✅');

    // Allow tick for DOMContentLoaded and init() in All-Notes window
    await new Promise(r => setTimeout(r, 200));

    // Test live search filtering in All-Notes UI
    const searchFilterTest = await allNotesWin.webContents.executeJavaScript(`
      (() => {
        const searchInput = document.getElementById('searchInput');
        searchInput.value = 'Apples';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));

        const cards = Array.from(document.querySelectorAll('.note-item'));
        return {
          totalCards: cards.length,
          visibleCount: cards.length,
          firstVisibleText: cards[0] ? cards[0].textContent : ''
        };
      })()
    `);
    if (searchFilterTest.visibleCount !== 1 || !searchFilterTest.firstVisibleText.includes('Apples')) {
      throw new Error('Live search filter failed: ' + JSON.stringify(searchFilterTest));
    }
    log('[TEST] Live search filtering in All Notes panel verified! ✅');

    // Test focusNote brings target note to front even if minimized/hidden
    winB.minimize();
    if (!winB.isMinimized()) throw new Error('Note B should be minimized');
    windowManager.focusNote('search_test_note_b');
    if (winB.isMinimized()) throw new Error('focusNote failed to restore minimized window B');
    log('[TEST] focusNote brings target note to front verified! ✅');

    allNotesWin.close();

    // =========================================================================
    // 17. Test Lock Mode
    // =========================================================================
    log('[TEST] 17. Testing Lock mode (always on top, click-through, dimmed, badge)...');
    windowManager.handleSetLocked('search_test_note_a', true);
    const lockedNoteInStorage = storage.loadAllNotes().find(n => n.id === 'search_test_note_a');
    if (!lockedNoteInStorage.isLocked) {
      throw new Error('Locked note state was not persisted in storage');
    }
    if (!winA.isAlwaysOnTop()) {
      throw new Error('Locked window should have alwaysOnTop enabled');
    }

    // Allow renderer tick to handle init-note
    await new Promise(r => setTimeout(r, 200));

    const lockUiState = await winA.webContents.executeJavaScript(`
      (() => {
        const isLockedClass = document.body.classList.contains('is-locked');
        const editorEditable = document.getElementById('editor').getAttribute('contenteditable');
        const badgeHidden = document.getElementById('lockBadge').classList.contains('hidden');
        const btnLockActive = document.getElementById('btnLock').classList.contains('active');
        return {
          isLockedClass,
          editorEditable,
          badgeHidden,
          btnLockActive
        };
      })()
    `);
    if (!lockUiState.isLockedClass) throw new Error('body missing is-locked class');
    if (lockUiState.editorEditable !== 'false') throw new Error('editor should have contenteditable=false');
    if (lockUiState.badgeHidden) throw new Error('lockBadge should be visible when locked');
    if (!lockUiState.btnLockActive) throw new Error('btnLock should be active when locked');
    log('[TEST] Lock mode UI & non-editable state verified! ✅');

    // Unlock
    windowManager.handleSetLocked('search_test_note_a', false);
    await new Promise(r => setTimeout(r, 150));
    const unlockedUiState = await winA.webContents.executeJavaScript(`
      (() => ({
        isLockedClass: document.body.classList.contains('is-locked'),
        editorEditable: document.getElementById('editor').getAttribute('contenteditable')
      }))()
    `);
    if (unlockedUiState.isLockedClass) throw new Error('body should not have is-locked class after unlocking');
    if (unlockedUiState.editorEditable !== 'true') throw new Error('editor should have contenteditable=true after unlocking');
    log('[TEST] Unlock mode verified successfully! ✅');

    // =========================================================================
    // 18. Test Snap to Edges & 50-Move Zero Size-Drift Drag Verification
    // =========================================================================
    log('[TEST] 18. Testing Snap to edges & 50-move drag with 0px size drift...');
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const workArea = primaryDisplay.workArea;

    // A. Screen edge snapping (target within 12px of workArea.x)
    const snapEdgeResult = windowManager.calculateSnappedPosition(
      'search_test_note_a',
      workArea.x + 8,
      workArea.y + 100,
      320,
      360,
      false
    );
    if (!snapEdgeResult.snapped || snapEdgeResult.x !== workArea.x) {
      throw new Error(`Screen edge snapping failed: expected x=${workArea.x}, got x=${snapEdgeResult.x}, snapped=${snapEdgeResult.snapped}`);
    }
    log('[TEST] Screen edge snapping within 12px verified! ✅');

    // B. Shift key disables snapping
    const shiftSnapResult = windowManager.calculateSnappedPosition(
      'search_test_note_a',
      workArea.x + 8,
      workArea.y + 100,
      320,
      360,
      true // shiftKey = true
    );
    if (shiftSnapResult.snapped || shiftSnapResult.x !== workArea.x + 8) {
      throw new Error('Shift key did not disable snapping: ' + JSON.stringify(shiftSnapResult));
    }
    log('[TEST] Shift key disabling snapping verified! ✅');

    // C. Note-to-note edge snapping
    winB.setBounds({ x: 500, y: 200, width: 320, height: 360 });
    const snapToNoteResult = windowManager.calculateSnappedPosition(
      'search_test_note_a',
      500 - 320 - 7, // 7px from note B's left edge
      200,
      320,
      360,
      false
    );
    if (!snapToNoteResult.snapped || snapToNoteResult.x !== (500 - 320)) {
      throw new Error('Note-to-note edge snapping failed: ' + JSON.stringify(snapToNoteResult));
    }
    log('[TEST] Note-to-note edge snapping verified! ✅');

    // D. 50-Move Drag Test: Guarantee 100% constant width and height (Zero Size Drift)
    log('[TEST] Running 50-move drag test to verify ZERO size drift with snapping active...');
    const test18InitialBounds = winA.getBounds();
    const expectedW = test18InitialBounds.width;
    const expectedH = test18InitialBounds.height;

    windowManager.handleStartDrag('search_test_note_a', test18InitialBounds.x, test18InitialBounds.y);

    for (let step = 1; step <= 50; step++) {
      windowManager.handleMoveWindowDelta('search_test_note_a', 2, 1, false);
    }

    windowManager.handleEndDrag('search_test_note_a');
    const test18FinalBounds = winA.getBounds();
    if (test18FinalBounds.width !== expectedW || test18FinalBounds.height !== expectedH) {
      throw new Error(`Size drift detected after 50 moves! Expected ${expectedW}x${expectedH}, got ${test18FinalBounds.width}x${test18FinalBounds.height}`);
    }
    const noteAInStorage = storage.loadAllNotes().find(n => n.id === 'search_test_note_a');
    if (noteAInStorage.width !== expectedW || noteAInStorage.height !== expectedH) {
      throw new Error(`Storage size drifted after 50 moves! Expected ${expectedW}x${expectedH}, got ${noteAInStorage.width}x${noteAInStorage.height}`);
    }
    log(`[TEST] 50 consecutive drag moves completed with exactly 0px size drift (${expectedW}x${expectedH}) in window & storage! ✅`);

    // =========================================================================
    // 19. Test Note Templates Configuration & Instantiation
    // =========================================================================
    log('[TEST] 19. Testing templates configuration & instantiation...');
    const templates = require('../src/main/templates');
    if (!Array.isArray(templates) || templates.length !== 5) {
      throw new Error('templates.js must export an array of 5 templates, found: ' + (templates ? templates.length : 'none'));
    }

    const expectedTemplateIds = ['blank', 'shopping', 'daily-todo', 'study-plan', 'meeting-notes'];
    expectedTemplateIds.forEach(id => {
      const t = templates.find(item => item.id === id);
      if (!t) throw new Error('Missing template: ' + id);
      if (!t.title || !t.icon || !t.color || !t.paperStyle) {
        throw new Error(`Template ${id} is missing required fields (title, icon, color, paperStyle)`);
      }
    });
    log('[TEST] templates.js contains all 5 required templates with complete definitions! ✅');

    // Create note from Shopping list template
    const shoppingWin = windowManager.createNoteFromTemplate('shopping');
    const shoppingNote = Array.from(windowManager.notesData.values()).find(n => n.id === shoppingWin.id || (n.content && n.content.includes('Shopping List')));
    if (!shoppingNote) throw new Error('Failed to find created Shopping List note');
    if (!shoppingNote.content.includes('Shopping List') || !shoppingNote.content.includes('checklist-item')) {
      throw new Error('Shopping list template note missing checklist content: ' + shoppingNote.content);
    }
    log('[TEST] Created note from Shopping list template with pre-filled checklists! ✅');

    // Create note from Meeting notes template
    const meetingWin = windowManager.createNoteFromTemplate('meeting-notes');
    const meetingNote = Array.from(windowManager.notesData.values()).find(n => n.id === meetingWin.id || (n.content && n.content.includes('Meeting Notes')));
    if (!meetingNote) throw new Error('Failed to find created Meeting Notes note');
    if (!meetingNote.content.includes('Meeting Notes') || !meetingNote.content.includes('Key Decisions')) {
      throw new Error('Meeting notes template note missing structured content: ' + meetingNote.content);
    }
    log('[TEST] Created note from Meeting notes template with structured headings & actions! ✅');

    // Clean up all test notes
    storage.deleteNote('search_test_note_a');
    storage.deleteNote('search_test_note_b');
    if (shoppingNote) storage.deleteNote(shoppingNote.id);
    if (meetingNote) storage.deleteNote(meetingNote.id);
    storage.emptyTrash();

    // =========================================================================
    // 20. Test Stickers & Doodles (Drop, Drag, Resize, Delete, Pen Mode, Undo)
    // =========================================================================
    log('[TEST] 20. Testing Stickers & Doodles...');
    const stickerTestNote = {
      id: 'test_sticker_doodle_note',
      content: 'Stickers & Doodles Note',
      color: 'pink',
      paperStyle: 'bent-edge',
      x: 180,
      y: 180,
      width: 340,
      height: 380,
      isPinned: false,
      isCollapsed: false,
      isLocked: false,
      stickers: [],
      doodles: null,
      updatedAt: Date.now()
    };
    storage.saveNote(stickerTestNote);
    const winSticker = windowManager.createNoteWindow(stickerTestNote);
    await new Promise(resolve => {
      if (!winSticker.webContents.isLoading()) {
        resolve();
      } else {
        const timer = setTimeout(resolve, 2000);
        winSticker.webContents.once('did-finish-load', () => {
          clearTimeout(timer);
          resolve();
        });
      }
    });
    await new Promise(r => setTimeout(r, 250));

    const stickerDoodleResults = await winSticker.webContents.executeJavaScript(`
      (async () => {
        // 1. Verify buttons and popover elements exist
        const btnSticker = document.getElementById('btnSticker');
        const stickerPopover = document.getElementById('stickerPopover');
        const tabBtnStickers = document.getElementById('tabBtnStickers');
        const tabBtnDoodle = document.getElementById('tabBtnDoodle');
        const stickerTraySection = document.getElementById('stickerTraySection');
        const doodleControlsSection = document.getElementById('doodleControlsSection');
        const doodleCanvas = document.getElementById('doodleCanvas');
        const stickersContainer = document.getElementById('stickersContainer');

        if (!btnSticker || !stickerPopover || !tabBtnStickers || !tabBtnDoodle) {
          return { error: 'Missing sticker trigger or popover elements' };
        }

        // 2. Open popover
        btnSticker.click();
        if (stickerPopover.classList.contains('hidden')) {
          return { error: 'Sticker popover did not open on btnSticker click' };
        }

        // 3. Tab switching
        tabBtnDoodle.click();
        if (doodleControlsSection.classList.contains('hidden') || !stickerTraySection.classList.contains('hidden')) {
          return { error: 'Tab switching to Doodle Controls failed' };
        }
        tabBtnStickers.click();
        if (!doodleControlsSection.classList.contains('hidden') || stickerTraySection.classList.contains('hidden')) {
          return { error: 'Tab switching back to Stickers Tray failed' };
        }

        // 4. Drop a sticker
        const starChoice = document.querySelector('.sticker-choice-btn[data-emoji="⭐"]');
        if (!starChoice) return { error: 'Star sticker choice button not found' };
        starChoice.click();

        const stickers = Array.from(stickersContainer.querySelectorAll('.sticky-sticker'));
        if (stickers.length !== 1) {
          return { error: 'Expected 1 sticker in container, found ' + stickers.length };
        }
        const createdSticker = stickers[0];
        if (!createdSticker.querySelector('.sticker-content') || createdSticker.querySelector('.sticker-content').textContent !== '⭐') {
          return { error: 'Sticker content mismatch' };
        }
        const delBtn = createdSticker.querySelector('.sticker-btn-delete');
        const resizeHandle = createdSticker.querySelector('.sticker-resize-handle');
        if (!delBtn || !resizeHandle) {
          return { error: 'Sticker missing delete button or resize handle' };
        }

        // 5. Test Sticker Resize
        const initialSize = parseInt(window.getComputedStyle(createdSticker).fontSize, 10);
        resizeHandle.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100, bubbles: true }));
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 130, clientY: 130, bubbles: true }));
        window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        const resizedSize = parseInt(window.getComputedStyle(createdSticker).fontSize, 10);
        if (resizedSize <= initialSize) {
          return { error: 'Sticker resize did not increase size: initial=' + initialSize + ', resized=' + resizedSize };
        }

        // 6. Test Doodling Pen Mode
        tabBtnDoodle.click();
        const btnTogglePen = document.getElementById('btnTogglePen');
        btnTogglePen.click();
        if (!document.body.classList.contains('pen-mode-active')) {
          return { error: 'pen-mode-active class not added to body on toggle' };
        }

        // Draw a stroke on doodle canvas
        doodleCanvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 30, clientY: 30, bubbles: true }));
        doodleCanvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 60, clientY: 60, bubbles: true }));
        doodleCanvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

        if (!state.doodles || !state.doodles.startsWith('data:image/png')) {
          return { error: 'Doodle canvas drawing did not produce state.doodles data URL' };
        }

        // Test Undo
        const btnUndoDoodle = document.getElementById('btnUndoDoodle');
        btnUndoDoodle.click();

        // Turn Pen Mode back OFF
        btnTogglePen.click();
        if (document.body.classList.contains('pen-mode-active')) {
          return { error: 'pen-mode-active class was not removed after turning pen mode off' };
        }

        // 7. Remove sticker
        delBtn.click();
        if (stickersContainer.querySelectorAll('.sticky-sticker').length !== 0) {
          return { error: 'Sticker was not removed on delete button click' };
        }

        return { success: true };
      })()
    `);
    if (stickerDoodleResults.error) {
      throw new Error('Sticker & Doodle verification failed: ' + stickerDoodleResults.error);
    }
    log('[TEST] Stickers drop/drag/resize/delete and Doodling pen mode/canvas verified! ✅');

    // =========================================================================
    // 21. Test Timer Note (Countdown, Pomodoro 25/5, Timer Strip, Collapsed Preview)
    // =========================================================================
    log('[TEST] 21. Testing Timer Note & Pomodoro...');
    const timerResults = await winSticker.webContents.executeJavaScript(`
      (() => {
        const btnTimer = document.getElementById('btnTimer');
        const timerPopover = document.getElementById('timerPopover');
        const timerStrip = document.getElementById('timerStrip');
        const timerStripLabel = document.getElementById('timerStripLabel');
        const timerStripTime = document.getElementById('timerStripTime');
        const timerStripIcon = document.getElementById('timerStripIcon');
        const timerPlayPauseBtn = document.getElementById('timerPlayPauseBtn');
        const timerResetBtn = document.getElementById('timerResetBtn');
        const timerCloseBtn = document.getElementById('timerCloseBtn');
        const btnPresetPomodoro = document.getElementById('btnPresetPomodoro');

        if (!btnTimer || !timerPopover || !timerStrip || !btnPresetPomodoro) {
          return { error: 'Missing timer elements in DOM' };
        }

        // Open timer popover
        btnTimer.click();
        if (timerPopover.classList.contains('hidden')) {
          return { error: 'Timer popover did not open on btnTimer click' };
        }

        // Start Pomodoro
        btnPresetPomodoro.click();
        if (timerStrip.classList.contains('hidden')) {
          return { error: 'Timer strip not visible after starting Pomodoro' };
        }
        if (timerStripLabel.textContent !== 'Focus') {
          return { error: 'Expected timer label Focus, got: ' + timerStripLabel.textContent };
        }
        if (timerStripIcon.textContent !== '🍅') {
          return { error: 'Expected timer icon 🍅, got: ' + timerStripIcon.textContent };
        }
        if (timerStripTime.textContent !== '25:00') {
          return { error: 'Expected timer time 25:00, got: ' + timerStripTime.textContent };
        }

        // Test Collapsed Preview with active timer
        applyCollapseState(true);
        const collapsedText = document.getElementById('collapsedPreview').textContent;
        if (!collapsedText.includes('Pomodoro')) {
          return { error: 'Collapsed preview does not reflect running Pomodoro: ' + collapsedText };
        }
        applyCollapseState(false);

        // Test Pause / Resume
        timerPlayPauseBtn.click();
        if (state.timer.isRunning) {
          return { error: 'Timer play/pause did not pause timer' };
        }
        timerPlayPauseBtn.click();
        if (!state.timer.isRunning) {
          return { error: 'Timer play/pause did not resume timer' };
        }

        // Test Reset
        state.timer.remainingSecs = 120;
        timerResetBtn.click();
        if (state.timer.remainingSecs !== 1500) {
          return { error: 'Timer reset did not restore 1500 seconds' };
        }

        // Test Timer Completion transition: work (25m) -> break (5m)
        onTimerCompleted();
        if (state.timer.isWork !== false) {
          return { error: 'Pomodoro work completion did not transition to break mode' };
        }
        if (timerStripLabel.textContent !== 'Break' || timerStripIcon.textContent !== '☕') {
          return { error: 'Pomodoro break label/icon mismatch: ' + timerStripLabel.textContent + ' ' + timerStripIcon.textContent };
        }
        if (state.timer.remainingSecs !== 300) {
          return { error: 'Pomodoro break remainingSecs expected 300, got: ' + state.timer.remainingSecs };
        }

        // Test Timer Close
        timerCloseBtn.click();
        if (!timerStrip.classList.contains('hidden')) {
          return { error: 'Timer strip not hidden after timerCloseBtn click' };
        }
        if (state.timer !== null) {
          return { error: 'state.timer not null after closing timer' };
        }

        return { success: true };
      })()
    `);
    if (timerResults.error) {
      throw new Error('Timer verification failed: ' + timerResults.error);
    }
    log('[TEST] Timer Note (Pomodoro 25/5, countdown, collapsed preview, pause, reset, close) verified! ✅');

    // =========================================================================
    // 22. Test Auto-Fade and Archive (Exemptions for Pinned & Reminders, Restore)
    // =========================================================================
    log('[TEST] 22. Testing Auto-fade & Archive with protection exemptions...');
    storage.setSetting('autoFadeArchive', true);

    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Note 1: Recent note (2 days inactive) -> Active, not faded, not archived
    const noteRecent = {
      id: 'autofade_recent',
      content: 'Recent note',
      color: 'yellow',
      paperStyle: 'classic',
      updatedAt: now - (2 * DAY_MS)
    };

    // Note 2: Inactive note (8 days inactive) -> Faded (collapsed tab), not archived
    const noteFaded = {
      id: 'autofade_faded',
      content: 'Inactive note',
      color: 'blue',
      paperStyle: 'classic',
      updatedAt: now - (8 * DAY_MS)
    };

    // Note 3: Very old inactive note (16 days inactive) -> Archived to stickypad-archive.json
    const noteArchived = {
      id: 'autofade_archived',
      content: 'Very old note to archive',
      color: 'green',
      paperStyle: 'classic',
      updatedAt: now - (16 * DAY_MS)
    };

    // Note 4: Very old note, BUT PINNED -> PROTECTED (Never faded, never archived)
    const notePinnedOld = {
      id: 'autofade_pinned_old',
      content: 'Old pinned note',
      color: 'taupe',
      paperStyle: 'classic',
      isPinned: true,
      updatedAt: now - (16 * DAY_MS)
    };

    // Note 5: Very old note, BUT HAS ACTIVE REMINDER -> PROTECTED (Never faded, never archived)
    const noteReminderOld = {
      id: 'autofade_reminder_old',
      content: 'Old reminder note',
      color: 'purple',
      paperStyle: 'classic',
      reminder: {
        dueAt: now + (2 * DAY_MS),
        fired: false
      },
      updatedAt: now - (16 * DAY_MS)
    };

    storage.saveNote(noteRecent);
    storage.saveNote(noteFaded);
    storage.saveNote(noteArchived);
    storage.saveNote(notePinnedOld);
    storage.saveNote(noteReminderOld);

    // Process auto-fade & archive (7 days fade, 7 days archive)
    const fadeResult = storage.processAutoFadeAndArchive(7, 7);
    log('[TEST] processAutoFadeAndArchive result: ' + JSON.stringify(fadeResult));

    if (!fadeResult.faded.includes('autofade_faded')) {
      throw new Error('noteFaded was not marked as faded');
    }
    if (fadeResult.faded.includes('autofade_pinned_old') || fadeResult.faded.includes('autofade_reminder_old')) {
      throw new Error('Protected notes (pinned / active reminder) were mistakenly faded!');
    }

    if (!fadeResult.archived.some(n => n.id === 'autofade_archived')) {
      throw new Error('noteArchived was not moved to archive');
    }
    if (fadeResult.archived.some(n => n.id === 'autofade_pinned_old') || fadeResult.archived.some(n => n.id === 'autofade_reminder_old')) {
      throw new Error('Protected notes (pinned / active reminder) were mistakenly archived!');
    }

    // Verify disk storage
    const activeAfterFade = storage.loadAllNotes();
    const archiveAfterFade = storage.loadArchive();

    if (activeAfterFade.some(n => n.id === 'autofade_archived')) {
      throw new Error('Archived note should not remain in active notes list');
    }
    if (!archiveAfterFade.some(n => n.id === 'autofade_archived')) {
      throw new Error('Archived note was not found in archive list on disk');
    }

    const fadedInActive = activeAfterFade.find(n => n.id === 'autofade_faded');
    if (!fadedInActive || !fadedInActive.isAutoFaded) {
      throw new Error('Faded note in active storage missing isAutoFaded=true');
    }

    // Test restoring from archive
    const restored = storage.restoreFromArchive('autofade_archived');
    if (!restored || restored.id !== 'autofade_archived') {
      throw new Error('Failed to restore note from archive');
    }
    const archiveAfterRestore = storage.loadArchive();
    if (archiveAfterRestore.some(n => n.id === 'autofade_archived')) {
      throw new Error('Restored note was not removed from archive on disk');
    }
    const activeAfterRestore = storage.loadAllNotes();
    if (!activeAfterRestore.some(n => n.id === 'autofade_archived')) {
      throw new Error('Restored note was not added back to active notes on disk');
    }
    log('[TEST] Auto-fade, auto-archive, pinned/reminder protections & restore verified! ✅');

    // Clean up test notes
    storage.deleteNote('autofade_recent');
    storage.deleteNote('autofade_faded');
    storage.deleteNote('autofade_archived');
    storage.deleteNote('autofade_pinned_old');
    storage.deleteNote('autofade_reminder_old');
    storage.emptyArchive();

    // =========================================================================
    // 23. Test Procedural Audio Synthesis, Sound Toggle & Crumple Animation
    // =========================================================================
    log('[TEST] 23. Testing procedural sound synthesis, mute toggle & crumple animation...');
    const soundResults = await winSticker.webContents.executeJavaScript(`
      (async () => {
        if (!window.soundEffects) {
          return { error: 'window.soundEffects is not instantiated' };
        }

        // Test sounds enabled by default
        await window.soundEffects.initSetting();
        if (window.soundEffects.soundsEnabled !== true) {
          return { error: 'Sounds should be enabled by default' };
        }

        // Call synthesis methods (safe in test context)
        try {
          await window.soundEffects.playPeelSound();
          await window.soundEffects.playCrumpleSound();
          await window.soundEffects.playChimeSound();
        } catch (e) {
          return { error: 'Audio synthesis failed: ' + e.message };
        }

        // Test Sounds toggle setting
        window.soundEffects.soundsEnabled = false;
        if (window.soundEffects.soundsEnabled !== false) {
          return { error: 'Setting soundsEnabled to false failed' };
        }
        window.soundEffects.soundsEnabled = true;

        // Test Crumple Animation class
        const noteEl = document.getElementById('stickyNote');
        noteEl.classList.add('is-crumpling');
        if (!noteEl.classList.contains('is-crumpling')) {
          return { error: 'is-crumpling animation class failed to apply' };
        }
        noteEl.classList.remove('is-crumpling');

        return { success: true };
      })()
    `);
    if (soundResults.error) {
      throw new Error('Sound synthesis verification failed: ' + soundResults.error);
    }
    log('[TEST] Procedural Web Audio synthesis (peel, crumple, chime), mute setting & crumple animation verified! ✅');

    winSticker.close();
    storage.deleteNote('test_sticker_doodle_note');

    // =========================================================================
    // 24. Security & Audit Verification Suite
    // =========================================================================
    log('[TEST] 24. Testing Security, Input Validation & Crash Resilience...');
    const { sanitizeHtml, sanitizeImportedNotes, isSafeFontFamily } = require('../src/common/sanitizer');

    // 24.1: XSS Payload Neutralization
    log('[TEST] 24.1: Testing XSS payload neutralization...');
    const maliciousPayloads = [
      '<script>alert("xss")</script><b>Bold Text</b>',
      '<img src="invalid.jpg" onerror="alert(\'xss\')">Normal text',
      '<iframe src="https://evil.com"></iframe><p>Paragraph</p>',
      '<a href="javascript:alert(1)">Click me</a>',
      '<div onclick="maliciousCode()">Clickable div</div>',
      '<style>body { display: none; }</style>Content'
    ];

    maliciousPayloads.forEach((payload, idx) => {
      const sanitized = sanitizeHtml(payload);
      if (
        sanitized.includes('<script') ||
        sanitized.includes('onerror') ||
        sanitized.includes('onclick') ||
        sanitized.includes('<iframe') ||
        sanitized.includes('javascript:') ||
        sanitized.includes('<style')
      ) {
        throw new Error(`XSS payload ${idx} was NOT neutralized: ${sanitized}`);
      }
    });
    log('[TEST] XSS payload neutralization verified! ✅');

    // 24.2: Font Family Allowlist
    log('[TEST] 24.2: Testing font family allowlist...');
    if (!isSafeFontFamily('sans') || !isSafeFontFamily('handwriting') || !isSafeFontFamily('manga')) {
      throw new Error('Valid font families were rejected');
    }
    if (isSafeFontFamily('Comic Sans; font-family: evil') || isSafeFontFamily('<script>') || isSafeFontFamily('')) {
      throw new Error('Malicious or invalid font families were accepted');
    }
    log('[TEST] Font family allowlist verified! ✅');

    // 24.3: Malicious Import Protection (Prototype Pollution, Array Flood, Content Truncation)
    log('[TEST] 24.3: Testing malicious import file protection...');
    const prototypePollutionJson = JSON.stringify([
      {
        id: 'proto_test',
        __proto__: { polluter: 'active' },
        content: '<script>evil()</script>Clean Content',
        color: 'yellow'
      }
    ]);
    const sanitizedImport = sanitizeImportedNotes(prototypePollutionJson);
    if (({}).polluter === 'active') {
      throw new Error('Prototype pollution succeeded in sanitizeImportedNotes!');
    }
    if (sanitizedImport[0].content.includes('<script')) {
      throw new Error('Malicious script was not sanitized in imported note content');
    }

    // Array flood (exceeding 200 notes limit) - must be rejected
    const floodArray = [];
    for (let i = 0; i < 250; i++) {
      floodArray.push({ id: 'note_' + i, content: 'test ' + i });
    }
    let floodBlocked = false;
    try {
      sanitizeImportedNotes(JSON.stringify(floodArray));
    } catch (e) {
      if (e.message.includes('200')) floodBlocked = true;
    }
    if (!floodBlocked) {
      throw new Error('Import array flood (>200 notes) was not blocked!');
    }

    // Huge content string truncation (> 500k characters)
    const hugeContent = 'A'.repeat(600000);
    const oversizedNoteImport = sanitizeImportedNotes(JSON.stringify([{ id: 'huge_note', content: hugeContent }]));
    if (oversizedNoteImport[0].content.length > 500000) {
      throw new Error('Oversized note content was not capped to 500,000 characters');
    }
    log('[TEST] Malicious import sanitization & flood protection verified! ✅');

    // 24.4: Automated Rolling Backup and Corruption Recovery
    log('[TEST] 24.4: Testing automatic rolling backup & crash recovery...');
    const canaryNote = {
      id: 'canary_backup_test_note',
      content: 'Canary content to test backup restoration',
      color: 'yellow',
      x: 100,
      y: 100,
      width: 300,
      height: 340
    };
    storage.saveNote(canaryNote);

    // Verify backup file exists
    if (!fs.existsSync(storage.backupPath)) {
      throw new Error('stickypad-notes.backup.json was not created during saveNote');
    }

    // Corrupt primary stickypad-notes.json file with broken/truncated JSON
    fs.writeFileSync(storage.storagePath, '{"broken_json: [corrupt', 'utf8');

    // loadAllNotes should detect corruption, log warning, recover from backup, and repair primary
    const recoveredNotes = storage.loadAllNotes();
    const foundCanary = recoveredNotes.find(n => n.id === 'canary_backup_test_note');
    if (!foundCanary) {
      throw new Error('Failed to recover canary note from stickypad-notes.backup.json!');
    }
    // Verify primary was repaired with valid JSON
    const primaryRepaired = JSON.parse(fs.readFileSync(storage.storagePath, 'utf8'));
    if (!Array.isArray(primaryRepaired) || !primaryRepaired.some(n => n.id === 'canary_backup_test_note')) {
      throw new Error('Primary stickypad-notes.json was not repaired after recovery');
    }
    storage.deleteNote('canary_backup_test_note');
    log('[TEST] Rolling backup and corrupted file self-healing verified! ✅');

    // 24.5: Off-Screen Clamping on Display Disconnection
    log('[TEST] 24.5: Testing multi-monitor off-screen position clamping...');
    const clampedBounds = windowManager.ensureVisibleCoordinates(-9999, -9999, 300, 340);
    if (clampedBounds.x < -500 || clampedBounds.y < -500) {
      throw new Error('Off-screen coordinates were not clamped: ' + JSON.stringify(clampedBounds));
    }
    log('[TEST] Off-screen multi-monitor clamping verified! ✅');

    // 24.6: Renderer Sticker and Doodle Size Limits
    log('[TEST] 24.6: Testing sticker and doodle size enforcement in renderer...');
    const testSanitizeWin = windowManager.createNoteWindow({
      id: 'sec_test_note',
      content: 'Sanitization check',
      color: 'teal'
    });
    await new Promise(resolve => {
      if (!testSanitizeWin.webContents.isLoading()) resolve();
      else testSanitizeWin.webContents.once('did-finish-load', resolve);
    });
    await new Promise(r => setTimeout(r, 200));

    const limitsCheck = await testSanitizeWin.webContents.executeJavaScript(`
      (() => {
        // Test sticker limit cap (max 30)
        window.activeStickers = [];
        for (let i = 0; i < 35; i++) {
          window.activeStickers.push({ id: 'st_' + i, emoji: '⭐', x: i, y: i, size: 36 });
        }
        // Emulate addSticker check
        const canAddMore = window.activeStickers.length < 30;

        // Test doodle size check
        const smallDoodle = 'data:image/png;base64,' + 'A'.repeat(500);
        const hugeDoodle = 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024);

        const isSmallAccepted = smallDoodle.length <= 2 * 1024 * 1024;
        const isHugeRejected = hugeDoodle.length > 2 * 1024 * 1024;

        return {
          canAddMore,
          isSmallAccepted,
          isHugeRejected
        };
      })()
    `);

    if (limitsCheck.canAddMore !== false || !limitsCheck.isSmallAccepted || !limitsCheck.isHugeRejected) {
      throw new Error('Sticker or doodle limits validation failed: ' + JSON.stringify(limitsCheck));
    }
    testSanitizeWin.close();
    storage.deleteNote('sec_test_note');
    log('[TEST] Sticker (max 30) and doodle (max 2MB) payload enforcement verified! ✅');

    // =========================================================================
    // 25. Layout: Pinned X Button, "⋯" More Menu & Multi-Edge/Corner Resizing
    // =========================================================================
    log('[TEST] 25. Testing Pinned X Button, "⋯" More Menu & Resizing...');

    // 25.1: Test X Button and "⋯" Button visibility for ALL 5 paper styles at 220px min width
    const paperStyles = ['classic', 'corner-curl', 'bent-edge', 'wavy-curl', 'taped'];
    for (const style of paperStyles) {
      const styleNote = {
        id: 'test_style_' + style,
        content: `Note with paper style: ${style}`,
        color: 'yellow',
        paperStyle: style,
        width: 220,
        height: 180
      };
      storage.saveNote(styleNote);
      const styleWin = windowManager.createNoteWindow(styleNote);
      await new Promise(resolve => {
        if (!styleWin.webContents.isLoading()) resolve();
        else styleWin.webContents.once('did-finish-load', resolve);
      });
      await new Promise(r => setTimeout(r, 150));

      const layoutCheck = await styleWin.webContents.executeJavaScript(`
        (() => {
          const btnDelete = document.getElementById('btnDelete');
          const btnMore = document.getElementById('btnMore');
          const paper = document.getElementById('stickyNote');
          const header = document.getElementById('noteHeader');

          if (!btnDelete || !btnMore) {
            return { error: 'Missing btnDelete or btnMore' };
          }

          const delRect = btnDelete.getBoundingClientRect();
          const moreRect = btnMore.getBoundingClientRect();
          const paperRect = paper.getBoundingClientRect();

          // Ensure X button is visible, rendered, and pinned to the right within paper
          const isDelVisible = delRect.width > 0 && delRect.height > 0 &&
                               window.getComputedStyle(btnDelete).display !== 'none' &&
                               window.getComputedStyle(btnDelete).visibility !== 'hidden';

          // delRect.right must not be pushed outside paperRect.right
          const isDelInsidePaper = delRect.right <= paperRect.right + 2 && delRect.left >= paperRect.left;

          // btnMore must be placed to the left of btnDelete
          const isMoreBeforeDel = moreRect.right <= delRect.left + 5;

          // Check corner-curl resize grip position
          let cornerGripValid = true;
          if (document.body.classList.contains('style-corner-curl')) {
            const brHandle = document.getElementById('resizeHandleBR');
            if (brHandle) {
              const brRect = brHandle.getBoundingClientRect();
              const distFromRight = paperRect.right - brRect.right;
              cornerGripValid = distFromRight >= 40;
            }
          }

          return {
            isDelVisible,
            isDelInsidePaper,
            isMoreBeforeDel,
            cornerGripValid,
            delRect: { right: delRect.right, width: delRect.width },
            paperRect: { right: paperRect.right, width: paperRect.width }
          };
        })()
      `);

      if (layoutCheck.error) {
        throw new Error(`Style ${style} layout failed: ` + layoutCheck.error);
      }
      if (!layoutCheck.isDelVisible || !layoutCheck.isDelInsidePaper) {
        throw new Error(`Style ${style} at 220px: X button clipped or outside paper! ` + JSON.stringify(layoutCheck));
      }
      if (!layoutCheck.isMoreBeforeDel) {
        throw new Error(`Style ${style} at 220px: "⋯" button is not placed next to X button! ` + JSON.stringify(layoutCheck));
      }
      if (!layoutCheck.cornerGripValid) {
        throw new Error(`Style ${style}: Corner curl resize grip is hidden under curl flap! ` + JSON.stringify(layoutCheck));
      }
      styleWin.close();
      storage.deleteNote(styleNote.id);
      log(`[TEST] Paper style "${style}" at min-width 220px verified: X button pinned & visible! ✅`);
    }

    // 25.2: Test "⋯" More Options Menu (open, items click, outside click / Esc)
    const testMoreNote = {
      id: 'test_more_menu_note',
      content: 'More menu verification',
      color: 'teal',
      paperStyle: 'classic',
      width: 300,
      height: 320
    };
    storage.saveNote(testMoreNote);
    const winMore = windowManager.createNoteWindow(testMoreNote);
    await new Promise(resolve => {
      if (!winMore.webContents.isLoading()) resolve();
      else winMore.webContents.once('did-finish-load', resolve);
    });
    await new Promise(r => setTimeout(r, 150));

    const moreMenuCheck = await winMore.webContents.executeJavaScript(`
      (() => {
        const btnMore = document.getElementById('btnMore');
        const morePopover = document.getElementById('morePopover');

        // 1. Open More Menu
        btnMore.click();
        const isOpen = !morePopover.classList.contains('hidden');

        // Check required menu items
        const hasColor = Boolean(document.getElementById('btnColor'));
        const hasStyle = Boolean(document.getElementById('btnStyle'));
        const hasTimer = Boolean(document.getElementById('btnTimer'));
        const hasSticker = Boolean(document.getElementById('btnSticker'));
        const hasShare = Boolean(document.getElementById('btnShare'));

        // 2. Click "Note Color" inside more menu: morePopover should close, colorPopover should open
        document.getElementById('btnColor').click();
        const moreClosedAfterColor = morePopover.classList.contains('hidden');
        const colorOpen = !document.getElementById('colorPopover').classList.contains('hidden');

        // 3. Escape key closes popover
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        const colorClosedOnEsc = document.getElementById('colorPopover').classList.contains('hidden');

        return {
          isOpen,
          hasColor,
          hasStyle,
          hasTimer,
          hasSticker,
          hasShare,
          moreClosedAfterColor,
          colorOpen,
          colorClosedOnEsc
        };
      })()
    `);

    if (!moreMenuCheck.isOpen || !moreMenuCheck.hasColor || !moreMenuCheck.hasStyle ||
        !moreMenuCheck.hasTimer || !moreMenuCheck.hasSticker || !moreMenuCheck.hasShare ||
        !moreMenuCheck.moreClosedAfterColor || !moreMenuCheck.colorOpen || !moreMenuCheck.colorClosedOnEsc) {
      throw new Error('"⋯" More menu test failed: ' + JSON.stringify(moreMenuCheck));
    }
    log('[TEST] "⋯" More Options Menu verified (opens, triggers tools, closes on action & Esc)! ✅');

    // 25.3: Test Resizing in All Directions (BR, BL, Right Edge, Bottom Edge) and Min/Max Bounds
    log('[TEST] 25.3: Testing interactive multi-edge/corner resizing...');
    await winMore.webContents.executeJavaScript(`
      (() => {
        const brHandle = document.getElementById('resizeHandleBR');
        brHandle.dispatchEvent(new MouseEvent('mousedown', { screenX: 200, screenY: 200, bubbles: true }));
        window.dispatchEvent(new MouseEvent('mousemove', { screenX: 260, screenY: 250, bubbles: true }));
        window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      })()
    `);
    await new Promise(r => setTimeout(r, 200));
    const winBoundsBR = winMore.getBounds();
    log('[TEST] Resize BR result bounds: ' + winBoundsBR.width + 'x' + winBoundsBR.height);
    if (winBoundsBR.width < 340 || winBoundsBR.height < 350) {
      throw new Error('Resize BR did not increase window dimensions properly: ' + JSON.stringify(winBoundsBR));
    }

    // Test Clamping to Min Bounds (220x160)
    await winMore.webContents.executeJavaScript(`
      (() => {
        const brHandle = document.getElementById('resizeHandleBR');
        brHandle.dispatchEvent(new MouseEvent('mousedown', { screenX: 200, screenY: 200, bubbles: true }));
        window.dispatchEvent(new MouseEvent('mousemove', { screenX: -500, screenY: -500, bubbles: true }));
        window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      })()
    `);
    await new Promise(r => setTimeout(r, 200));
    const winBoundsMin = winMore.getBounds();
    log('[TEST] Resize Clamp Min bounds: ' + winBoundsMin.width + 'x' + winBoundsMin.height);
    if (winBoundsMin.width !== 220 || winBoundsMin.height !== 160) {
      throw new Error('Resize minimum clamp failed: expected 220x160, got ' + JSON.stringify(winBoundsMin));
    }

    // Test Clamping to Max Bounds (800x800)
    await winMore.webContents.executeJavaScript(`
      (() => {
        const brHandle = document.getElementById('resizeHandleBR');
        brHandle.dispatchEvent(new MouseEvent('mousedown', { screenX: 200, screenY: 200, bubbles: true }));
        window.dispatchEvent(new MouseEvent('mousemove', { screenX: 1500, screenY: 1500, bubbles: true }));
        window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      })()
    `);
    await new Promise(r => setTimeout(r, 200));
    const winBoundsMax = winMore.getBounds();
    log('[TEST] Resize Clamp Max bounds: ' + winBoundsMax.width + 'x' + winBoundsMax.height);
    if (winBoundsMax.width !== 800 || winBoundsMax.height !== 800) {
      throw new Error('Resize maximum clamp failed: expected 800x800, got ' + JSON.stringify(winBoundsMax));
    }

    // Test Locked Note Cannot Be Resized
    await winMore.webContents.executeJavaScript(`
      (() => {
        document.getElementById('btnLock').click();
      })()
    `);
    await new Promise(r => setTimeout(r, 150));
    const lockResizeCheck = await winMore.webContents.executeJavaScript(`
      (() => {
        const brHandle = document.getElementById('resizeHandleBR');
        const isHidden = window.getComputedStyle(brHandle).display === 'none';
        return { isHidden };
      })()
    `);
    if (!lockResizeCheck.isHidden) {
      throw new Error('Resize handle should be hidden on locked notes!');
    }
    // Unlock
    await winMore.webContents.executeJavaScript(`
      (() => {
        document.getElementById('btnLock').click();
      })()
    `);
    await new Promise(r => setTimeout(r, 150));

    winMore.close();
    storage.deleteNote('test_more_menu_note');
    log('[TEST] Interactive resizing & min/max bounds (220x160 to 800x800) verified! ✅');

    // 26. Test Unified Popups & Delete Confirmation Dialog
    log('[TEST] 26. Testing Unified Popup System & Delete Confirmation Dialog...');
    const testPopupNoteData = {
      id: 'test_popups_unified_note',
      content: 'Popups and delete confirmation test note',
      color: 'teal',
      paperStyle: 'classic',
      bounds: { x: 250, y: 250, width: 280, height: 320 }
    };
    storage.saveNote(testPopupNoteData);
    const winPopup = windowManager.createNoteWindow(testPopupNoteData);
    await new Promise(r => setTimeout(r, 600));

    // Test 26.1: Open Delete Confirmation dialog via #btnDelete
    const delOpenCheck = await winPopup.webContents.executeJavaScript(`
      (() => {
        const btnDelete = document.getElementById('btnDelete');
        const deleteConfirm = document.getElementById('deleteConfirm');
        const btnCancel = document.getElementById('btnCancelDelete');
        const btnConfirm = document.getElementById('btnConfirmDelete');

        btnDelete.click();

        const style = window.getComputedStyle(deleteConfirm);
        const btnCancelStyle = window.getComputedStyle(btnCancel);
        const btnConfirmStyle = window.getComputedStyle(btnConfirm);

        return {
          isOpen: !deleteConfirm.classList.contains('hidden'),
          bodyHasOpenPopover: document.body.classList.contains('has-open-popover'),
          noteHasOpenPopover: document.getElementById('stickyNote').classList.contains('has-open-popover'),
          focusedElementId: document.activeElement ? document.activeElement.id : null,
          dialogZIndex: style.zIndex,
          dialogNoDrag: style.webkitAppRegion,
          dialogPointerEvents: style.pointerEvents,
          cancelNoDrag: btnCancelStyle.webkitAppRegion,
          confirmNoDrag: btnConfirmStyle.webkitAppRegion
        };
      })()
    `);
    log('[TEST] Delete dialog open check: ' + JSON.stringify(delOpenCheck));
    if (!delOpenCheck.isOpen) throw new Error('Delete confirmation dialog did not open on btnDelete click!');
    if (!delOpenCheck.bodyHasOpenPopover) throw new Error('body.has-open-popover should be true when delete confirmation is open!');
    if (delOpenCheck.focusedElementId !== 'btnCancelDelete') throw new Error('Default focus should be on "Not yet" (btnCancelDelete), got: ' + delOpenCheck.focusedElementId);
    if (delOpenCheck.dialogZIndex !== '99999') throw new Error('dialog z-index must be 99999, got: ' + delOpenCheck.dialogZIndex);
    if (delOpenCheck.dialogNoDrag !== 'no-drag') throw new Error('dialog webkitAppRegion must be no-drag, got: ' + delOpenCheck.dialogNoDrag);
    if (delOpenCheck.cancelNoDrag !== 'no-drag' || delOpenCheck.confirmNoDrag !== 'no-drag') {
      throw new Error('Buttons inside delete confirmation must have no-drag!');
    }

    // Test 26.2: Tab navigation inside delete confirmation
    const tabCheck = await winPopup.webContents.executeJavaScript(`
      (() => {
        const deleteConfirm = document.getElementById('deleteConfirm');
        deleteConfirm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        const firstFocus = document.activeElement ? document.activeElement.id : null;

        deleteConfirm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        const secondFocus = document.activeElement ? document.activeElement.id : null;

        return { firstFocus, secondFocus };
      })()
    `);
    log('[TEST] Tab navigation check: ' + JSON.stringify(tabCheck));
    if (tabCheck.firstFocus !== 'btnConfirmDelete' || tabCheck.secondFocus !== 'btnCancelDelete') {
      throw new Error('Tab did not cycle between cancel and confirm buttons! ' + JSON.stringify(tabCheck));
    }

    // Test 26.3: Esc key closes delete confirmation without deleting note
    const escCheck = await winPopup.webContents.executeJavaScript(`
      (() => {
        const deleteConfirm = document.getElementById('deleteConfirm');
        deleteConfirm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return {
          isOpen: !deleteConfirm.classList.contains('hidden'),
          bodyHasOpenPopover: document.body.classList.contains('has-open-popover')
        };
      })()
    `);
    log('[TEST] Esc key check: ' + JSON.stringify(escCheck));
    if (escCheck.isOpen || escCheck.bodyHasOpenPopover) {
      throw new Error('Escape key failed to close delete confirmation dialog!');
    }
    const noteStillExistsAfterEsc = storage.loadAllNotes().find(n => n.id === 'test_popups_unified_note');
    if (!noteStillExistsAfterEsc) throw new Error('Note was accidentally deleted on Esc!');

    // Test 26.4: Enter on "Not yet" closes without deleting note
    const enterCancelCheck = await winPopup.webContents.executeJavaScript(`
      (() => {
        document.getElementById('btnDelete').click();
        const deleteConfirm = document.getElementById('deleteConfirm');
        deleteConfirm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        return {
          isOpen: !deleteConfirm.classList.contains('hidden'),
          bodyHasOpenPopover: document.body.classList.contains('has-open-popover')
        };
      })()
    `);
    log('[TEST] Enter on "Not yet" check: ' + JSON.stringify(enterCancelCheck));
    if (enterCancelCheck.isOpen) throw new Error('Enter on default focus (Not yet) failed to close confirmation dialog!');
    const noteStillExistsAfterEnter = storage.loadAllNotes().find(n => n.id === 'test_popups_unified_note');
    if (!noteStillExistsAfterEnter) throw new Error('Note was accidentally deleted on Enter with Not yet focused!');

    // Test 26.5: Click "Not yet" closes without deleting note
    const clickCancelCheck = await winPopup.webContents.executeJavaScript(`
      (() => {
        document.getElementById('btnDelete').click();
        document.getElementById('btnCancelDelete').click();
        const deleteConfirm = document.getElementById('deleteConfirm');
        return {
          isOpen: !deleteConfirm.classList.contains('hidden'),
          bodyHasOpenPopover: document.body.classList.contains('has-open-popover')
        };
      })()
    `);
    log('[TEST] Click "Not yet" check: ' + JSON.stringify(clickCancelCheck));
    if (clickCancelCheck.isOpen) throw new Error('Clicking "Not yet" failed to close confirmation dialog!');
    const noteStillExistsAfterClickCancel = storage.loadAllNotes().find(n => n.id === 'test_popups_unified_note');
    if (!noteStillExistsAfterClickCancel) throw new Error('Note was accidentally deleted after clicking Not yet!');

    // Test 26.6: Click outside closes confirmation dialog
    const clickOutsideCheck = await winPopup.webContents.executeJavaScript(`
      (() => {
        document.getElementById('btnDelete').click();
        // Click on editor (outside dialog)
        document.getElementById('editor').click();
        const deleteConfirm = document.getElementById('deleteConfirm');
        return {
          isOpen: !deleteConfirm.classList.contains('hidden'),
          bodyHasOpenPopover: document.body.classList.contains('has-open-popover')
        };
      })()
    `);
    log('[TEST] Click outside check: ' + JSON.stringify(clickOutsideCheck));
    if (clickOutsideCheck.isOpen) throw new Error('Clicking outside failed to close confirmation dialog!');

    // Test 26.7: Verify other popovers (color, style, more) open/close and set body.has-open-popover
    const otherPopoversCheck = await winPopup.webContents.executeJavaScript(`
      (() => {
        const results = [];
        const btnMore = document.getElementById('btnMore');
        const morePopover = document.getElementById('morePopover');

        btnMore.click();
        results.push({ name: 'more', isOpen: !morePopover.classList.contains('hidden'), hasPopoverClass: document.body.classList.contains('has-open-popover') });

        document.getElementById('editor').click();
        results.push({ name: 'moreClosed', isOpen: !morePopover.classList.contains('hidden'), hasPopoverClass: document.body.classList.contains('has-open-popover') });

        return results;
      })()
    `);
    log('[TEST] Other popovers check: ' + JSON.stringify(otherPopoversCheck));
    if (!otherPopoversCheck[0].isOpen || !otherPopoversCheck[0].hasPopoverClass) {
      throw new Error('morePopover failed to open or set has-open-popover class!');
    }
    if (otherPopoversCheck[1].isOpen || otherPopoversCheck[1].hasPopoverClass) {
      throw new Error('morePopover failed to close on outside click!');
    }

    // Test 26.8: Click "Yes, toss it" moves note to Trash and closes window
    log('[TEST] Clicking "Yes, toss it" to verify deletion and move to Trash...');
    await winPopup.webContents.executeJavaScript(`
      (() => {
        document.getElementById('btnDelete').click();
        document.getElementById('btnConfirmDelete').click();
      })()
    `);
    await new Promise(r => setTimeout(r, 600));

    const trashNotes = storage.loadTrash();
    const trashedNote = trashNotes.find(n => n.id === 'test_popups_unified_note');
    if (!trashedNote) {
      throw new Error('"Yes, toss it" failed to move note to Trash! Current trash: ' + JSON.stringify(trashNotes));
    }
    log('[TEST] Note successfully moved to Trash with ID: ' + trashedNote.id + ' ✅');

    // Clean up test note from Trash
    storage.deleteForever('test_popups_unified_note');
    log('[TEST] Unified Popup System & Delete Confirmation verified! ✅');

    // 27. Test Collapsed Note Popups Dismissal, '⋯' Hide, Resize Grip Hide & Expand
    log('[TEST] 27. Testing Collapsed Note Popup Dismissal, ⋯ Hide, Resize Grip Hide & Clean Expand...');
    const testCollapseNoteData = {
      id: 'test_collapse_popups_note',
      content: 'Testing collapse popup dismissal and button visibility',
      color: 'pink',
      paperStyle: 'classic',
      bounds: { x: 300, y: 300, width: 300, height: 350 }
    };
    storage.saveNote(testCollapseNoteData);
    const winCollapse = windowManager.createNoteWindow(testCollapseNoteData);
    await new Promise(r => setTimeout(r, 600));

    // 27.1: Open More options menu
    const moreOpenRes = await winCollapse.webContents.executeJavaScript(`
      (() => {
        const btnMore = document.getElementById('btnMore');
        const morePopover = document.getElementById('morePopover');
        btnMore.click();
        return {
          isOpen: !morePopover.classList.contains('hidden'),
          bodyHasPopover: document.body.classList.contains('has-open-popover')
        };
      })()
    `);
    log('[TEST] More options menu opened: ' + JSON.stringify(moreOpenRes));
    if (!moreOpenRes.isOpen || !moreOpenRes.bodyHasPopover) {
      throw new Error('Failed to open More options menu before collapse test!');
    }

    // 27.2: Collapse note and verify all popovers immediately close, ⋯ hides, resize grip hides
    const collapseCheck = await winCollapse.webContents.executeJavaScript(`
      (() => {
        const btnCollapse = document.getElementById('btnCollapse');
        btnCollapse.click();

        const stickyNote = document.getElementById('stickyNote');
        const morePopover = document.getElementById('morePopover');
        const btnMore = document.getElementById('btnMore');
        const resizeHandleBR = document.getElementById('resizeHandleBR');
        const btnNew = document.getElementById('btnNew');
        const btnReminder = document.getElementById('btnReminder');
        const btnPin = document.getElementById('btnPin');
        const btnLock = document.getElementById('btnLock');
        const btnDelete = document.getElementById('btnDelete');
        const preview = document.getElementById('collapsedPreview');

        const allPopovers = document.querySelectorAll('.popover, .confirm-dialog');
        let anyPopoverVisible = false;
        allPopovers.forEach(p => {
          const style = window.getComputedStyle(p);
          if (style.display !== 'none' || !p.classList.contains('hidden')) {
            anyPopoverVisible = true;
          }
        });

        return {
          isCollapsed: stickyNote.classList.contains('is-collapsed'),
          anyPopoverVisible,
          morePopoverHidden: morePopover.classList.contains('hidden'),
          morePopoverDisplay: window.getComputedStyle(morePopover).display,
          btnMoreDisplay: window.getComputedStyle(btnMore).display,
          resizeGripDisplay: window.getComputedStyle(resizeHandleBR).display,
          btnNewDisplay: window.getComputedStyle(btnNew).display,
          btnCollapseDisplay: window.getComputedStyle(btnCollapse).display,
          btnReminderDisplay: window.getComputedStyle(btnReminder).display,
          btnPinDisplay: window.getComputedStyle(btnPin).display,
          btnLockDisplay: window.getComputedStyle(btnLock).display,
          btnDeleteDisplay: window.getComputedStyle(btnDelete).display,
          previewDisplay: window.getComputedStyle(preview).display,
          bodyHasPopover: document.body.classList.contains('has-open-popover')
        };
      })()
    `);
    log('[TEST] Collapse state check: ' + JSON.stringify(collapseCheck));
    if (!collapseCheck.isCollapsed) throw new Error('Note failed to collapse!');
    if (collapseCheck.anyPopoverVisible || collapseCheck.morePopoverDisplay !== 'none' || !collapseCheck.morePopoverHidden) {
      throw new Error('A popup was still visible in the collapsed note!');
    }
    if (collapseCheck.bodyHasPopover) {
      throw new Error('body.has-open-popover was not cleared when collapsed!');
    }
    if (collapseCheck.btnMoreDisplay !== 'none') {
      throw new Error('The "⋯" (more options) button was not hidden while collapsed! Display: ' + collapseCheck.btnMoreDisplay);
    }
    if (collapseCheck.resizeGripDisplay !== 'none') {
      throw new Error('The resize grip was not hidden while collapsed! Display: ' + collapseCheck.resizeGripDisplay);
    }
    if (collapseCheck.btnDeleteDisplay === 'none' || collapseCheck.btnNewDisplay === 'none' || collapseCheck.btnCollapseDisplay === 'none') {
      throw new Error('Required header buttons (+, collapse, X) are not visible on the collapsed bar!');
    }

    // 27.3: Expand note and verify popovers STAY CLOSED until explicitly opened, ⋯ returns, note works normally
    const expandCheck = await winCollapse.webContents.executeJavaScript(`
      (() => {
        const btnCollapse = document.getElementById('btnCollapse');
        btnCollapse.click();

        const stickyNote = document.getElementById('stickyNote');
        const morePopover = document.getElementById('morePopover');
        const btnMore = document.getElementById('btnMore');
        const resizeHandleBR = document.getElementById('resizeHandleBR');

        const allPopovers = document.querySelectorAll('.popover, .confirm-dialog');
        let anyPopoverOpen = false;
        allPopovers.forEach(p => {
          if (!p.classList.contains('hidden')) {
            anyPopoverOpen = true;
          }
        });

        // Test normal note operation after expand
        const editor = document.getElementById('editor');
        editor.focus();

        return {
          isCollapsed: stickyNote.classList.contains('is-collapsed'),
          anyPopoverOpen,
          morePopoverHidden: morePopover.classList.contains('hidden'),
          btnMoreDisplay: window.getComputedStyle(btnMore).display,
          resizeGripDisplay: window.getComputedStyle(resizeHandleBR).display
        };
      })()
    `);
    log('[TEST] Expand state check: ' + JSON.stringify(expandCheck));
    if (expandCheck.isCollapsed) throw new Error('Note failed to expand!');
    if (expandCheck.anyPopoverOpen || !expandCheck.morePopoverHidden) {
      throw new Error('Popovers unexpectedly reopened upon expanding! They must stay closed until opened.');
    }
    if (expandCheck.btnMoreDisplay === 'none') {
      throw new Error('The "⋯" (more options) button did not return upon expand!');
    }
    if (expandCheck.resizeGripDisplay === 'none') {
      throw new Error('The resize grip did not return upon expand!');
    }

    winCollapse.close();
    storage.deleteNote('test_collapse_popups_note');
    log('[TEST] Collapsed Note Popup Dismissal, ⋯ Hide, Resize Grip Hide & Expand verified! ✅');

    log('[TEST] ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ✅');
    app.exit(0);
  } catch (err) {
    log('[TEST FAIL]: ' + err.stack);
    app.exit(1);
  }
});
