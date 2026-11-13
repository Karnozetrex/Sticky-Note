const fs = require('fs');
const path = require('path');

const dir = path.join(process.env.APPDATA, 'stickypad');
const storagePath = path.join(dir, 'stickypad-notes.json');
const trashPath = path.join(dir, 'stickypad-trash.json');

const defaultNotes = [
  {
    id: 'note_welcome_stickypad',
    x: 140,
    y: 120,
    width: 320,
    height: 380,
    content: `<div>Welcome to <b>StickyPad</b>! 📌</div><br><div class="checklist-item" data-checked="true"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Click completed checklist items</span></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Type "- [ ] " for a new checklist item</span></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Mix <span class="font-sans" data-font="sans">Clean</span>, <span class="font-handwriting" data-font="handwriting">Handwriting</span> &amp; <span class="font-manga" data-font="manga">Manga</span> fonts!</span></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Click the <b>+</b> button to pick a ready-to-use template 📝</span></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Set reminders with the bell icon 🔔</span></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Lock notes (clicks pass through) with the lock icon 🔒</span></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Search all notes with <b>Ctrl+Shift+F</b></span></div><div class="checklist-item" data-checked="false"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">Drag anywhere with <b>Alt</b>; snaps to edges &amp; other notes (hold Shift to disable snap)</span></div><br><div>Your notes auto-save instantly as you type! ✨</div>`,
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

if (fs.existsSync(dir)) {
  fs.writeFileSync(storagePath, JSON.stringify(defaultNotes, null, 2), 'utf8');
  fs.writeFileSync(trashPath, JSON.stringify([], null, 2), 'utf8');
  console.log('[CLEANUP] Successfully reset storage to 1 welcome note and cleared trash.');
}
