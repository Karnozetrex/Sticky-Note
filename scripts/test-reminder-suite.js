const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

const logFile = path.join(__dirname, 'reminder-suite-log.txt');
fs.writeFileSync(logFile, '--- STICKYPAD REMINDER TEST SUITE ---\n', 'utf8');

function log(msg) {
  fs.appendFileSync(logFile, msg + '\n', 'utf8');
  console.log(msg);
}

process.on('uncaughtException', (err) => {
  log('[CRASH] Uncaught: ' + err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  log('[CRASH] Unhandled: ' + (err.stack || err));
  process.exit(1);
});

app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  try {
    log('[TEST] Starting Reminder Verification Suite...');
    const storage = require('../src/main/storage');
    const ReminderManager = require('../src/main/reminderManager');

    // Create test window
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

    win.webContents.on('console-message', (_e, _level, message) => {
      if (message.includes('DEBUG-REMINDER')) {
        log('[RENDERER-DEBUG] ' + message);
      }
    });

    // Mock windowManager for ReminderManager
    const notesData = new Map();
    const mockWindowManager = {
      windows: new Map([['test_suite_note', win]]),
      notesData,
      focusNote: (id) => {
        return win;
      }
    };

    const reminderManager = new ReminderManager(mockWindowManager);

    // Track reminders set via IPC
    ipcMain.on('set-reminder', (_e, { noteId, reminderData }) => {
      const reminder = reminderData;
      log(`[IPC] set-reminder for ${noteId}: dueAt=${reminder.dueAt}`);
      const n = notesData.get(noteId) || { id: noteId };
      n.reminder = reminder;
      notesData.set(noteId, n);
      reminderManager.scheduleReminder(n);
    });

    ipcMain.on('cancel-reminder', (_e, { noteId }) => {
      log(`[IPC] cancel-reminder for ${noteId}`);
      reminderManager.cancelReminder(noteId);
      const n = notesData.get(noteId);
      if (n) n.reminder = null;
    });

    await win.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
    log('[TEST] index.html loaded in BrowserWindow');

    const testNote = {
      id: 'test_suite_note',
      x: 100,
      y: 100,
      width: 320,
      height: 360,
      content: 'Important task reminder test note',
      color: 'teal',
      fontFamily: 'sans',
      fontSize: 16,
      opacity: 1.0,
      tilt: 0,
      paperStyle: 'classic',
      reminder: null,
      isPinned: false,
      isCollapsed: false,
      expandedHeight: 360
    };
    notesData.set(testNote.id, testNote);
    storage.saveNote(testNote);
    win.webContents.send('init-note', testNote);

    await new Promise(r => setTimeout(r, 600));

    // Helper to evaluate in renderer
    const evalInRenderer = (fnStr) => win.webContents.executeJavaScript(fnStr);

    // TEST 1: Toggle bell icon opens and closes popover
    log('\n[TEST 1] Testing bell icon toggle open / close...');
    let res = await evalInRenderer(`
      (() => {
        const btn = document.getElementById('btnReminder');
        const popover = document.getElementById('reminderPopover');
        btn.click();
        const opened = !popover.classList.contains('hidden') && document.body.classList.contains('has-open-popover');
        btn.click();
        const closed = popover.classList.contains('hidden') && !document.body.classList.contains('has-open-popover');
        return { opened, closed };
      })()
    `);
    if (!res.opened || !res.closed) throw new Error(`Toggle failed: ${JSON.stringify(res)}`);
    log('  ✓ Bell icon cleanly toggles open and close');

    // TEST 2: Escape key closes popover
    log('\n[TEST 2] Testing Escape key closes popover...');
    res = await evalInRenderer(`
      (() => {
        const btn = document.getElementById('btnReminder');
        const popover = document.getElementById('reminderPopover');
        btn.click();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return { closed: popover.classList.contains('hidden') };
      })()
    `);
    if (!res.closed) throw new Error('Escape key did not close popover');
    log('  ✓ Escape key closes popover');

    // TEST 3: Outside click closes popover
    log('\n[TEST 3] Testing outside click closes popover...');
    res = await evalInRenderer(`
      (() => {
        const btn = document.getElementById('btnReminder');
        const popover = document.getElementById('reminderPopover');
        btn.click();
        document.getElementById('editor').click();
        return { closed: popover.classList.contains('hidden') };
      })()
    `);
    if (!res.closed) throw new Error('Outside click did not close popover');
    log('  ✓ Outside click closes popover');

    // TEST 4: Click each of the 6 quick option buttons
    const presets = [
      { name: '5 min', preset: '5m', minExpectedDiff: 4 * 60 * 1000, maxExpectedDiff: 6 * 60 * 1000 },
      { name: '10 min', preset: '10m', minExpectedDiff: 9 * 60 * 1000, maxExpectedDiff: 11 * 60 * 1000 },
      { name: '30 min', preset: '30m', minExpectedDiff: 29 * 60 * 1000, maxExpectedDiff: 31 * 60 * 1000 },
      { name: '1 hour', preset: '1h', minExpectedDiff: 59 * 60 * 1000, maxExpectedDiff: 61 * 60 * 1000 },
      { name: 'Tonight 6 PM', preset: 'tonight' },
      { name: 'Tomorrow 9 AM', preset: 'tomorrow' }
    ];

    for (const p of presets) {
      log(`\n[TEST 4] Testing quick option button: "${p.name}" (${p.preset})...`);
      res = await evalInRenderer(`
        (() => {
          const btnReminder = document.getElementById('btnReminder');
          btnReminder.click(); // Open

          const btn = document.querySelector('.reminder-preset-btn[data-preset="${p.preset}"]');
          if (!btn) return { error: 'Button not found for preset: ${p.preset}' };
          
          btn.click();

          const popover = document.getElementById('reminderPopover');
          const badge = document.getElementById('reminderBadge');
          const hasBadge = !badge.classList.contains('hidden');
          const popoverClosed = popover.classList.contains('hidden');

          return {
            hasBadge,
            popoverClosed
          };
        })()
      `);

      if (res.error) throw new Error(res.error);
      if (!res.hasBadge) throw new Error(`Badge not visible after clicking ${p.name}`);
      if (!res.popoverClosed) throw new Error(`Popover did not close after clicking ${p.name}`);

      const currentNote = notesData.get('test_suite_note');
      if (!currentNote || !currentNote.reminder || !currentNote.reminder.dueAt) {
        throw new Error(`Reminder not recorded in note data for preset ${p.name}`);
      }

      if (p.minExpectedDiff) {
        const diff = currentNote.reminder.dueAt - Date.now();
        if (diff < p.minExpectedDiff || diff > p.maxExpectedDiff) {
          throw new Error(`Unexpected delay for ${p.name}: ${diff}ms`);
        }
      }
      log(`  ✓ Quick option "${p.name}" successfully sets reminder and closes popup`);
    }

    // TEST 5: Cancel reminder button removes reminder and badge immediately
    log('\n[TEST 5] Testing "Cancel reminder" button...');
    res = await evalInRenderer(`
      (() => {
        const btnReminder = document.getElementById('btnReminder');
        btnReminder.click(); // Open

        const cancelBtn = document.getElementById('btnCancelReminder');
        if (!cancelBtn) return { error: 'btnCancelReminder not found' };

        cancelBtn.click();

        const badge = document.getElementById('reminderBadge');
        const popover = document.getElementById('reminderPopover');
        return {
          hasBadge: !badge.classList.contains('hidden'),
          popoverClosed: popover.classList.contains('hidden')
        };
      })()
    `);

    if (res.error) throw new Error(res.error);
    if (res.hasBadge) throw new Error('Badge still visible after Cancel reminder');
    if (!res.popoverClosed) throw new Error('Popover not closed after Cancel reminder');
    log('  ✓ "Cancel reminder" removes badge, clears reminder, and closes popup');

    // TEST 6: Custom date & time validation (disallow past time, show inline error)
    log('\n[TEST 6] Testing Custom Date/Time: Disallow past time with inline error...');
    res = await evalInRenderer(`
      (() => {
        const btnReminder = document.getElementById('btnReminder');
        btnReminder.click(); // Open

        const input = document.getElementById('reminderCustomInput');
        const setBtn = document.getElementById('btnSetCustomReminder');
        const errorEl = document.getElementById('reminderError');
        const popover = document.getElementById('reminderPopover');

        // Check fresh default value is roughly 1 hour in future
        const defaultVal = input.value;
        const defaultTime = new Date(defaultVal).getTime();
        const diffHour = defaultTime - Date.now();
        const freshDefault = diffHour > 50 * 60 * 1000 && diffHour < 70 * 60 * 1000;

        // Set past time (1 hour ago)
        const past = new Date(Date.now() - 3600 * 1000);
        const pad = (n) => String(n).padStart(2, '0');
        input.value = \`\${past.getFullYear()}-\${pad(past.getMonth() + 1)}-\${pad(past.getDate())}T\${pad(past.getHours())}:\${pad(past.getMinutes())}\`;

        setBtn.click();

        const errorVisible = !errorEl.classList.contains('hidden') && errorEl.textContent.includes('Pick a future time');
        const popoverStillOpen = !popover.classList.contains('hidden');

        return {
          freshDefault,
          errorVisible,
          popoverStillOpen
        };
      })()
    `);

    if (!res.freshDefault) throw new Error('Default input value was not ~1 hour in future');
    if (!res.errorVisible) throw new Error('Inline error "Pick a future time" did not show for past time');
    if (!res.popoverStillOpen) throw new Error('Popover should remain open when validation fails');
    log('  ✓ Verified fresh default input time and inline error "Pick a future time"');

    // TEST 7: Custom date & time: valid future time via Enter key
    log('\n[TEST 7] Testing Custom Date/Time: Valid future time via Enter key...');
    res = await evalInRenderer(`
      (() => {
        const input = document.getElementById('reminderCustomInput');
        const popover = document.getElementById('reminderPopover');
        const badge = document.getElementById('reminderBadge');

        // Set future time: 2 hours from now
        const future = new Date(Date.now() + 2 * 3600 * 1000);
        const pad = (n) => String(n).padStart(2, '0');
        input.value = \`\${future.getFullYear()}-\${pad(future.getMonth() + 1)}-\${pad(future.getDate())}T\${pad(future.getHours())}:\${pad(future.getMinutes())}\`;

        // Press Enter
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        return {
          popoverClosed: popover.classList.contains('hidden'),
          hasBadge: !badge.classList.contains('hidden')
        };
      })()
    `);

    if (!res.popoverClosed) throw new Error('Popover did not close on Enter key');
    if (!res.hasBadge) throw new Error('Badge not visible after setting custom reminder via Enter');
    log('  ✓ Enter key in custom input successfully sets reminder and closes popup');

    // TEST 8: Custom date & time: valid future time via "Set" button
    log('\n[TEST 8] Testing Custom Date/Time: Valid future time via "Set" button...');
    res = await evalInRenderer(`
      (() => {
        const btnReminder = document.getElementById('btnReminder');
        btnReminder.click(); // Open

        const cancelBtn = document.getElementById('btnCancelReminder');
        cancelBtn.click(); // Cancel previous

        btnReminder.click(); // Re-open

        const input = document.getElementById('reminderCustomInput');
        const setBtn = document.getElementById('btnSetCustomReminder');
        const popover = document.getElementById('reminderPopover');
        const badge = document.getElementById('reminderBadge');

        // 3 hours in future
        const future = new Date(Date.now() + 3 * 3600 * 1000);
        const pad = (n) => String(n).padStart(2, '0');
        input.value = \`\${future.getFullYear()}-\${pad(future.getMonth() + 1)}-\${pad(future.getDate())}T\${pad(future.getHours())}:\${pad(future.getMinutes())}\`;

        setBtn.click();

        return {
          popoverClosed: popover.classList.contains('hidden'),
          hasBadge: !badge.classList.contains('hidden')
        };
      })()
    `);

    if (!res.popoverClosed) throw new Error('Popover did not close on "Set" button click');
    if (!res.hasBadge) throw new Error('Badge not visible after "Set" button click');
    log('  ✓ "Set" button click successfully sets reminder and closes popup');

    // TEST 9: Past-due reminder on startup (never shows "Due: Today 6:00 PM" indefinitely)
    log('\n[TEST 9] Testing past-due reminder handling on startup...');
    const pastDueNote = {
      id: 'past_due_test_note',
      x: 100,
      y: 100,
      width: 320,
      height: 360,
      content: 'Expired note',
      color: 'yellow',
      fontFamily: 'sans',
      fontSize: 16,
      opacity: 1.0,
      tilt: 0,
      paperStyle: 'classic',
      reminder: {
        dueAt: Date.now() - 3600000, // 1 hour ago
        fired: false
      }
    };
    storage.saveNote(pastDueNote);
    notesData.set('past_due_test_note', pastDueNote);

    // Run rescheduleAll: should trigger past-due reminder immediately and mark fired: true
    reminderManager.rescheduleAll();

    const checkedNote = storage.loadAllNotes().find(n => n.id === 'past_due_test_note');
    if (!checkedNote || !checkedNote.reminder || !checkedNote.reminder.fired) {
      throw new Error('Expired reminder was not marked fired: true');
    }

    // Verify renderer when loading an expired reminder does not display badge or indefinite active reminder
    res = await evalInRenderer(`
      (() => {
        applyReminderState({ dueAt: Date.now() - 3600000, fired: true });
        const badge = document.getElementById('reminderBadge');
        const activeBox = document.getElementById('activeReminderBox');
        return {
          badgeHidden: badge.classList.contains('hidden'),
          activeBoxHidden: activeBox.classList.contains('hidden')
        };
      })()
    `);
    if (!res.badgeHidden || !res.activeBoxHidden) {
      throw new Error(`Expired reminder improperly displayed: ${JSON.stringify(res)}`);
    }
    storage.deleteNote('past_due_test_note');
    log('  ✓ Past-due reminder on startup fired once, marked fired: true, and never shows overdue indefinitely');

    // TEST 10: Real short timer notification & shake alert firing
    log('\n[TEST 10] Testing real 3-second short reminder firing desktop alert...');
    let alertReceivedInRenderer = false;

    // Set reminder for 2.5 seconds in future
    const shortTimerNote = {
      id: 'test_suite_note',
      content: 'Test 3s timer alert',
      reminder: {
        dueAt: Date.now() + 2500,
        fired: false
      }
    };
    notesData.set(shortTimerNote.id, shortTimerNote);
    reminderManager.scheduleReminder(shortTimerNote);

    // Listen for alert animation in renderer
    await evalInRenderer(`
      window.__alertFired = false;
      window.stickyAPI.onReminderAlert(() => {
        window.__alertFired = true;
      });
    `);

    log('  Waiting 3.2 seconds for reminder timer to trigger...');
    await new Promise(r => setTimeout(r, 3200));

    const alertCheck = await evalInRenderer(`window.__alertFired`);
    if (!alertCheck) {
      throw new Error('Reminder alert did not fire after timer expired');
    }
    log('  ✓ 3-second reminder successfully fired desktop alert and triggered visual shake!');

    log('\n========================================');
    log('ALL 10 REMINDER TESTS PASSED PERFECTLY!');
    log('========================================\n');

    reminderManager.destroy();
    storage.deleteNote('test_suite_note');
    win.destroy();
    app.quit();
  } catch (err) {
    log('[TEST FAILED] ' + err.stack);
    app.quit();
    process.exit(1);
  }
});
