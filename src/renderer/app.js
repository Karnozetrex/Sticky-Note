/**
 * StickyPad — Note Renderer Controller
 */

// Application State
const state = {
  id: null,
  color: 'yellow',
  fontFamily: 'sans',
  fontSize: 16,
  opacity: 1.0,
  tilt: 0,
  paperStyle: 'classic',
  isPinned: false,
  isCollapsed: false,
  isLocked: false,
  isAutoFaded: false,
  stickers: [],
  doodles: null,
  timer: null,
  expandedHeight: 360,
  reminder: null,
  shareBg: 'transparent',
  saveTimeout: null,
  isLoaded: false
};

// DOM Element References
const elements = {
  stickyNote: document.getElementById('stickyNote'),
  noteHeader: document.getElementById('noteHeader'),
  collapsedPreview: document.getElementById('collapsedPreview'),
  noteBody: document.getElementById('noteBody'),
  editor: document.getElementById('editor'),
  noteFooter: document.getElementById('noteFooter'),
  saveStatus: document.getElementById('saveStatus'),
  toast: document.getElementById('toast'),

  // Header Buttons
  btnNew: document.getElementById('btnNew'),
  templatesPopover: document.getElementById('templatesPopover'),
  templatesList: document.getElementById('templatesList'),
  btnCollapse: document.getElementById('btnCollapse'),
  collapseIcon: document.getElementById('collapseIcon'),
  btnReminder: document.getElementById('btnReminder'),
  reminderBadge: document.getElementById('reminderBadge'),
  btnTimer: document.getElementById('btnTimer'),
  timerBadge: document.getElementById('timerBadge'),
  btnSticker: document.getElementById('btnSticker'),
  btnColor: document.getElementById('btnColor'),
  btnStyle: document.getElementById('btnStyle'),
  btnShare: document.getElementById('btnShare'),
  btnPin: document.getElementById('btnPin'),
  btnLock: document.getElementById('btnLock'),
  lockBadge: document.getElementById('lockBadge'),
  lockShackle: document.getElementById('lockShackle'),
  btnMore: document.getElementById('btnMore'),
  btnDelete: document.getElementById('btnDelete'),

  // Popovers
  morePopover: document.getElementById('morePopover'),
  btnTemplatesMenu: document.getElementById('btnTemplatesMenu'),
  reminderPopover: document.getElementById('reminderPopover'),
  activeReminderBox: document.getElementById('activeReminderBox'),
  activeReminderText: document.getElementById('activeReminderText'),
  btnCancelReminder: document.getElementById('btnCancelReminder'),
  reminderPresets: document.querySelectorAll('.reminder-preset-btn'),
  reminderCustomInput: document.getElementById('reminderCustomInput'),
  btnSetCustomReminder: document.getElementById('btnSetCustomReminder'),
  reminderError: document.getElementById('reminderError'),

  timerPopover: document.getElementById('timerPopover'),
  btnPresetPomodoro: document.getElementById('btnPresetPomodoro'),
  timerPresets: document.querySelectorAll('.timer-presets-grid .btn-timer-preset'),
  customTimerMinutes: document.getElementById('customTimerMinutes'),
  btnStartCustomTimer: document.getElementById('btnStartCustomTimer'),

  stickerPopover: document.getElementById('stickerPopover'),
  tabBtnStickers: document.getElementById('tabBtnStickers'),
  tabBtnDoodle: document.getElementById('tabBtnDoodle'),
  stickerTraySection: document.getElementById('stickerTraySection'),
  doodleControlsSection: document.getElementById('doodleControlsSection'),
  stickerChoices: document.querySelectorAll('.sticker-choice-btn'),
  stickersContainer: document.getElementById('stickersContainer'),
  doodleCanvas: document.getElementById('doodleCanvas'),

  // Doodle Controls
  btnTogglePen: document.getElementById('btnTogglePen'),
  doodleColorBtns: document.querySelectorAll('.doodle-color-btn'),
  doodleSizeBtns: document.querySelectorAll('.doodle-size-btn'),
  btnToolPen: document.getElementById('btnToolPen'),
  btnToolEraser: document.getElementById('btnToolEraser'),
  btnUndoDoodle: document.getElementById('btnUndoDoodle'),
  btnClearDoodles: document.getElementById('btnClearDoodles'),

  // Timer Strip
  timerStrip: document.getElementById('timerStrip'),
  timerStripIcon: document.getElementById('timerStripIcon'),
  timerStripLabel: document.getElementById('timerStripLabel'),
  timerStripTime: document.getElementById('timerStripTime'),
  timerPlayPauseBtn: document.getElementById('timerPlayPauseBtn'),
  timerResetBtn: document.getElementById('timerResetBtn'),
  timerCloseBtn: document.getElementById('timerCloseBtn'),

  colorPopover: document.getElementById('colorPopover'),
  stylePopover: document.getElementById('stylePopover'),
  sharePopover: document.getElementById('sharePopover'),
  deleteConfirm: document.getElementById('deleteConfirm'),
  btnCancelDelete: document.getElementById('btnCancelDelete'),
  btnConfirmDelete: document.getElementById('btnConfirmDelete'),

  // Style Controls
  styleChips: document.querySelectorAll('.style-thumb-btn, .style-chip'),
  fontBtnSans: document.getElementById('fontBtnSans'),
  fontBtnHand: document.getElementById('fontBtnHand'),
  fontBtnManga: document.getElementById('fontBtnManga'),
  btnFontSmaller: document.getElementById('btnFontSmaller'),
  btnFontBigger: document.getElementById('btnFontBigger'),
  fontSizeDisplay: document.getElementById('fontSizeDisplay'),
  opacitySlider: document.getElementById('opacitySlider'),
  opacityDisplay: document.getElementById('opacityDisplay'),

  // Share Controls
  bgBtnTransparent: document.getElementById('bgBtnTransparent'),
  bgBtnWhite: document.getElementById('bgBtnWhite'),
  btnCopyImage: document.getElementById('btnCopyImage'),
  btnSaveImage: document.getElementById('btnSaveImage'),

  resizeGrip: document.querySelector('.resize-grip'),
  resizeHandleBR: document.getElementById('resizeHandleBR'),
  resizeHandleBL: document.getElementById('resizeHandleBL'),
  resizeEdgeR: document.getElementById('resizeEdgeR'),
  resizeEdgeB: document.getElementById('resizeEdgeB')
};

// Available 8 Solid Paper Colors (Replaced 'dark' with 'teal')
const NOTE_COLORS = ['yellow', 'peach', 'pink', 'purple', 'blue', 'green', 'taupe', 'teal'];

// Available 3 Font Definitions for In-Note Mixing
const FONT_DEFS = {
  sans: {
    id: 'sans',
    label: 'Clean',
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    className: 'font-sans'
  },
  handwriting: {
    id: 'handwriting',
    label: 'Handwriting',
    family: 'Caveat, cursive',
    className: 'font-handwriting'
  },
  manga: {
    id: 'manga',
    label: 'Manga',
    family: 'Patrick Hand, cursive',
    className: 'font-manga'
  }
};

// Saved editor selection range for popovers and rich-text commands
let savedSelectionRange = null;

// ============================================================================
// Initialization from Main Process
// ============================================================================

window.stickyAPI.onInitNote((noteData) => {
  state.id = noteData.id;
  // Auto-migrate legacy dark notes to new aqua teal pastel color
  let noteColor = noteData.color || 'yellow';
  if (noteColor === 'dark') noteColor = 'teal';
  state.color = noteColor;

  state.fontFamily = noteData.fontFamily || 'sans';
  state.fontSize = noteData.fontSize || 16;
  state.opacity = noteData.opacity !== undefined ? noteData.opacity : 1.0;
  state.tilt = typeof noteData.tilt === 'number' ? noteData.tilt : (Math.round((-1.0 + Math.random() * 2.5) * 10) / 10);
  state.paperStyle = noteData.paperStyle || 'classic';
  state.isPinned = Boolean(noteData.isPinned);
  state.isCollapsed = Boolean(noteData.isCollapsed);
  state.isLocked = Boolean(noteData.isLocked);
  state.isAutoFaded = Boolean(noteData.isAutoFaded);
  state.stickers = Array.isArray(noteData.stickers) ? noteData.stickers : [];
  state.doodles = noteData.doodles || null;
  state.timer = noteData.timer || null;
  state.expandedHeight = noteData.expandedHeight || 360;

  // Apply UI Themes and Settings
  applyColor(state.color);
  applyPaperStyle(state.paperStyle);
  applyBaseNoteFont(state.fontFamily);
  applyFontSize(state.fontSize);
  applyOpacity(state.opacity);
  applyTilt(state.tilt);
  applyPinState(state.isPinned);
  applyLockState(state.isLocked);
  applyAutoFadeState(state.isAutoFaded);
  applyCollapseState(state.isCollapsed);
  applyReminderState(noteData.reminder);

  // Initialize Canvas Doodling & Stickers
  initDoodleCanvas(state.doodles);
  renderStickers(state.stickers);

  // Initialize Timer if active
  if (state.timer) {
    restoreTimer(state.timer);
  }

  // Play soft paper peel sound on note opening
  if (window.soundEffects) {
    window.soundEffects.playPeelSound();
  }

  // Render content (supports rich HTML with mixed fonts or legacy plain text)
  renderNoteContent(noteData.content || '');
  updateCollapsedPreview();

  // If newly created empty note, autofocus the editor
  if (!noteData.content || noteData.content.trim() === '') {
    setTimeout(() => {
      elements.editor.focus();
    }, 50);
  }

  state.isLoaded = true;
});

// ============================================================================
// Content Parsing & Rendering (Rich Text with Mixed Fonts & Checklists)
// ============================================================================

/**
 * Escapes raw HTML special characters
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Parses raw text/markdown or rich HTML into interactive DOM nodes
 */
function renderNoteContent(raw) {
  elements.editor.innerHTML = '';

  if (!raw || !raw.trim()) {
    const emptyLine = document.createElement('div');
    emptyLine.innerHTML = '<br>';
    elements.editor.appendChild(emptyLine);
    return;
  }

  // Sanitize raw content to prevent XSS attacks
  const sanitized = window.stickySanitizer ? window.stickySanitizer.sanitizeNoteHtml(raw) : raw;

  // Detect whether content is saved rich HTML (has <div>, <span>, <p>, or <br>)
  // vs legacy plain-text note
  const isHtml = /<(?:div|span|p|br|checklist)[\s>]/i.test(sanitized);

  if (isHtml) {
    const temp = document.createElement('div');
    temp.innerHTML = sanitized;

    const children = Array.from(temp.childNodes);
    if (children.length === 0) {
      const emptyLine = document.createElement('div');
      emptyLine.innerHTML = '<br>';
      elements.editor.appendChild(emptyLine);
      return;
    }

    children.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent.trim() !== '') {
          const div = document.createElement('div');
          div.textContent = child.textContent;
          elements.editor.appendChild(div);
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.classList.contains('checklist-item')) {
          // Rebuild interactive checklist item
          const isChecked = child.getAttribute('data-checked') === 'true';
          const textElem = child.querySelector('.checklist-text');
          const innerHtml = textElem ? textElem.innerHTML : child.innerHTML;
          const checkItem = createChecklistElement(isChecked, innerHtml, true);
          elements.editor.appendChild(checkItem);
        } else {
          elements.editor.appendChild(child);
        }
      }
    });
  } else {
    // Legacy plain-text note (e.g. initial notes or notes created before rich fonts)
    const lines = raw.split('\n');
    lines.forEach(line => {
      const checkMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)$/);
      if (checkMatch) {
        const isChecked = checkMatch[2].toLowerCase() === 'x';
        const text = checkMatch[3];
        const checkItem = createChecklistElement(isChecked, text, false);
        elements.editor.appendChild(checkItem);
      } else {
        const div = document.createElement('div');
        if (line === '') {
          div.innerHTML = '<br>';
        } else {
          div.textContent = line;
        }
        elements.editor.appendChild(div);
      }
    });
  }

  // Tag font spans
  formatFontSpans(elements.editor);
}

/**
 * Creates an interactive checklist DOM item
 */
function createChecklistElement(isChecked, content, isHtml = false) {
  const item = document.createElement('div');
  item.className = 'checklist-item';
  item.setAttribute('data-checked', isChecked ? 'true' : 'false');

  const checkbox = document.createElement('span');
  checkbox.className = 'checkbox-custom';
  checkbox.setAttribute('contenteditable', 'false');

  const textSpan = document.createElement('span');
  textSpan.className = 'checklist-text';
  textSpan.setAttribute('contenteditable', 'true');

  if (isHtml) {
    textSpan.innerHTML = content || '<br>';
  } else {
    textSpan.textContent = content;
  }

  item.appendChild(checkbox);
  item.appendChild(textSpan);

  return item;
}

/**
 * Serializes the editor DOM into sanitized HTML with font spans and checklists
 */
function serializeEditor() {
  const parts = [];
  const nodes = elements.editor.childNodes;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) {
        // Strip zero-width spaces when saving if empty
        const cleaned = node.textContent.replace(/\u200B/g, '');
        if (cleaned) {
          parts.push(`<div>${escapeHtml(cleaned)}</div>`);
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList.contains('checklist-item')) {
        const isChecked = node.getAttribute('data-checked') === 'true';
        const textElem = node.querySelector('.checklist-text');
        let innerHtml = textElem ? textElem.innerHTML : '';
        // Remove solitary zero-width spaces
        if (innerHtml === '\u200B') innerHtml = '<br>';
        parts.push(`<div class="checklist-item" data-checked="${isChecked}"><span class="checkbox-custom" contenteditable="false"></span><span class="checklist-text" contenteditable="true">${innerHtml}</span></div>`);
      } else {
        // Clean empty spans with only zero-width space
        const clone = node.cloneNode(true);
        clone.querySelectorAll('span').forEach(sp => {
          if (sp.textContent === '\u200B') {
            sp.remove();
          }
        });
        parts.push(clone.outerHTML);
      }
    }
  }

  const raw = parts.join('');
  return window.stickySanitizer ? window.stickySanitizer.sanitizeNoteHtml(raw) : raw;
}

// ============================================================================
// Auto-Save Management
// ============================================================================

function flushPendingSave() {
  if (state.saveTimeout) {
    clearTimeout(state.saveTimeout);
    state.saveTimeout = null;
  }
  if (!state.isLoaded || !state.id) return;

  const content = serializeEditor();
  updateCollapsedPreview();

  window.stickyAPI.saveNote({
    id: state.id,
    content,
    color: state.color,
    fontFamily: state.fontFamily,
    fontSize: state.fontSize,
    opacity: state.opacity,
    tilt: state.tilt,
    paperStyle: state.paperStyle,
    isPinned: state.isPinned,
    isCollapsed: state.isCollapsed,
    isLocked: state.isLocked,
    isAutoFaded: state.isAutoFaded,
    stickers: state.stickers,
    doodles: state.doodles,
    timer: state.timer ? {
      mode: state.timer.mode,
      totalSecs: state.timer.totalSecs,
      remainingSecs: state.timer.remainingSecs,
      isRunning: state.timer.isRunning,
      isWork: Boolean(state.timer.isWork)
    } : null
  });

  elements.saveStatus.textContent = 'Saved';
}

// Flush pending debounced save before window unloads
window.addEventListener('beforeunload', () => {
  flushPendingSave();
});

if (window.stickyAPI && window.stickyAPI.onFlushPendingSave) {
  window.stickyAPI.onFlushPendingSave(() => {
    flushPendingSave();
  });
}

function triggerAutoSave() {
  if (!state.isLoaded || !state.id) return;

  elements.saveStatus.textContent = 'Saving...';

  if (state.saveTimeout) {
    clearTimeout(state.saveTimeout);
  }

  state.saveTimeout = setTimeout(() => {
    flushPendingSave();
  }, 400);
}

function updateCollapsedPreview() {
  if (state.timer && state.timer.isRunning) {
    const min = Math.floor(state.timer.remainingSecs / 60);
    const sec = state.timer.remainingSecs % 60;
    const timeStr = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    elements.collapsedPreview.textContent = `[${timeStr}] ${state.timer.mode === 'pomodoro' ? '🍅 Pomodoro' : '⏱️ Timer'}`;
    return;
  }

  const text = (elements.editor.innerText || elements.editor.textContent || '').trim();
  if (!text) {
    elements.collapsedPreview.textContent = 'Empty note';
    return;
  }
  const firstLine = text.split('\n').map(l => l.trim()).find(l => l.length > 0) || 'Sticky Note';
  elements.collapsedPreview.textContent = firstLine.replace(/^-\s*\[[ xX]\]\s*/, '').trim() || 'Sticky Note';
}

// ============================================================================
// Real-time Checklist & Keystroke Handling
// ============================================================================

// 1. Checklist click toggle
elements.editor.addEventListener('click', (e) => {
  const checkbox = e.target.closest('.checkbox-custom');
  if (checkbox) {
    const item = checkbox.closest('.checklist-item');
    if (item) {
      const isChecked = item.getAttribute('data-checked') === 'true';
      item.setAttribute('data-checked', isChecked ? 'false' : 'true');
      triggerAutoSave();
    }
  }
});

// 2. Keystroke detection for typing "- [ ] " or "- [x] "
elements.editor.addEventListener('keyup', (e) => {
  saveEditorSelection();
  if (e.key === ' ' || e.key === 'Spacebar') {
    handleChecklistTrigger();
  }
});

function handleChecklistTrigger() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  let node = range.startContainer;

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent;
    const match = text.match(/^(\s*)-\s*\[([ xX])\]\s(.*)$/);
    if (match) {
      let targetToReplace = node;
      if (node.parentElement && node.parentElement !== elements.editor && !node.parentElement.classList.contains('checklist-item')) {
        targetToReplace = node.parentElement;
      }

      const isChecked = match[2].toLowerCase() === 'x';
      const remainingText = match[3] || '';
      const newItem = createChecklistElement(isChecked, remainingText, false);

      targetToReplace.replaceWith(newItem);

      const textSpan = newItem.querySelector('.checklist-text');
      textSpan.focus();

      const newRange = document.createRange();
      newRange.selectNodeContents(textSpan);
      newRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(newRange);

      triggerAutoSave();
    }
  }
}

// 3. Enter and Backspace management inside checklist items
elements.editor.addEventListener('keydown', (e) => {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const currentItem = selection.anchorNode.closest ? 
    selection.anchorNode.closest('.checklist-item') : 
    selection.anchorNode.parentElement?.closest('.checklist-item');

  if (!currentItem) return;

  const textSpan = currentItem.querySelector('.checklist-text');

  if (e.key === 'Enter') {
    e.preventDefault();
    const itemText = textSpan ? textSpan.textContent.trim() : '';

    if (itemText === '') {
      const regularLine = document.createElement('div');
      regularLine.innerHTML = '<br>';
      currentItem.replaceWith(regularLine);

      const newRange = document.createRange();
      newRange.setStart(regularLine, 0);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    } else {
      const newItem = createChecklistElement(false, '');
      currentItem.after(newItem);

      const newText = newItem.querySelector('.checklist-text');
      newText.focus();
    }
    triggerAutoSave();
  } else if (e.key === 'Backspace') {
    const textContent = textSpan ? textSpan.textContent : '';
    if (textContent === '' || textSpan.innerHTML === '<br>' || textSpan.innerHTML === '\u200B') {
      e.preventDefault();
      const regularLine = document.createElement('div');
      regularLine.innerHTML = '<br>';
      currentItem.replaceWith(regularLine);

      const newRange = document.createRange();
      newRange.setStart(regularLine, 0);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
      triggerAutoSave();
    }
  }
});

elements.editor.addEventListener('input', () => {
  if (state.isAutoFaded) {
    applyAutoFadeState(false);
  }
  triggerAutoSave();
});

// Safe clipboard paste handling (Sanitize HTML, prevent XSS and tag injection)
elements.editor.addEventListener('paste', (e) => {
  e.preventDefault();
  const clipboardData = e.clipboardData || window.clipboardData;
  if (!clipboardData) return;

  const html = clipboardData.getData('text/html');
  const text = clipboardData.getData('text/plain');

  if (html && window.stickySanitizer) {
    const cleanHtml = window.stickySanitizer.sanitizeNoteHtml(html);
    if (cleanHtml) {
      document.execCommand('insertHTML', false, cleanHtml);
      formatFontSpans(elements.editor);
      triggerAutoSave();
      return;
    }
  }

  // Fallback to safe plain text
  if (text) {
    document.execCommand('insertText', false, text);
    triggerAutoSave();
  }
});

// Track selection changes to update active font indicator
function saveEditorSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (elements.editor.contains(range.commonAncestorContainer)) {
      savedSelectionRange = range.cloneRange();
    }
  }
}

elements.editor.addEventListener('mouseup', () => {
  saveEditorSelection();
  updateActiveFontIndicator();
});

document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && elements.editor.contains(sel.anchorNode)) {
    saveEditorSelection();
    updateActiveFontIndicator();
  }
});

// ============================================================================
// Mixed Font Engine (Change selected text OR set next-typing font)
// ============================================================================

/**
 * Normalizes font styling spans in container to match font classes & attributes
 */
function formatFontSpans(container) {
  const spans = container.querySelectorAll('span[style*="font-family"], font[face]');
  spans.forEach(s => {
    const style = s.getAttribute('style') || '';
    const face = s.getAttribute('face') || '';
    if (style.includes('Caveat') || face.includes('Caveat')) {
      s.className = 'font-handwriting';
      s.setAttribute('data-font', 'handwriting');
    } else if (style.includes('Patrick Hand') || face.includes('Patrick Hand')) {
      s.className = 'font-manga';
      s.setAttribute('data-font', 'manga');
    } else if (style.includes('sans-serif') || style.includes('Segoe UI') || face.includes('sans')) {
      s.className = 'font-sans';
      s.setAttribute('data-font', 'sans');
    }
  });
}

/**
 * Applies default fallback font to the note body (does not overwrite spans)
 */
function applyBaseNoteFont(fontId) {
  state.fontFamily = fontId;
  document.body.classList.remove('font-sans', 'font-handwriting', 'font-manga');
  document.body.classList.add(`font-${fontId}`);
  updateFontSegmentUI(fontId);
}

/**
 * Update active button in Font Family segmented control
 */
function updateFontSegmentUI(fontId) {
  elements.fontBtnSans.classList.toggle('active', fontId === 'sans');
  elements.fontBtnHand.classList.toggle('active', fontId === 'handwriting');
  elements.fontBtnManga.classList.toggle('active', fontId === 'manga');
}

/**
 * Inspects font of element under cursor/selection and highlights corresponding button
 */
function updateActiveFontIndicator() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const node = sel.anchorNode;
  if (!node || !elements.editor.contains(node)) return;

  const fontEl = node.nodeType === Node.ELEMENT_NODE ? 
    node.closest('[data-font], .font-handwriting, .font-manga, .font-sans, span[style*="font-family"]') :
    node.parentElement?.closest('[data-font], .font-handwriting, .font-manga, .font-sans, span[style*="font-family"]');

  if (fontEl) {
    const dataFont = fontEl.getAttribute('data-font');
    if (dataFont && FONT_DEFS[dataFont]) {
      updateFontSegmentUI(dataFont);
      return;
    }
    const style = fontEl.getAttribute('style') || '';
    if (style.includes('Caveat')) { updateFontSegmentUI('handwriting'); return; }
    if (style.includes('Patrick Hand')) { updateFontSegmentUI('manga'); return; }
    if (style.includes('sans-serif') || style.includes('Segoe UI')) { updateFontSegmentUI('sans'); return; }
  }

  // Fallback to note's default font
  updateFontSegmentUI(state.fontFamily || 'sans');
}

/**
 * Mixed Font Applicator:
 * - If text is selected: ONLY the selected text changes font.
 * - If nothing is selected: applies to whatever is typed NEXT from cursor onward.
 * - Empty note: updates default note font.
 */
function applyMixedFont(fontId) {
  const def = FONT_DEFS[fontId];
  if (!def) return;

  // 1. Ensure editor is focused and restore range if needed
  elements.editor.focus();
  const sel = window.getSelection();
  if (savedSelectionRange && (!sel.rangeCount || !elements.editor.contains(sel.anchorNode))) {
    sel.removeAllRanges();
    sel.addRange(savedSelectionRange);
  }

  // 2. Empty note: change default note font
  const editorText = (elements.editor.textContent || '').trim();
  if (!editorText) {
    applyBaseNoteFont(fontId);
    triggerAutoSave();
    return;
  }

  // 3. Selection exists inside the editor
  if (sel && sel.rangeCount > 0 && elements.editor.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);

    if (!range.collapsed) {
      // User selected text: change ONLY the selected text!
      document.execCommand('styleWithCSS', false, true);
      document.execCommand('fontName', false, def.family);

      formatFontSpans(elements.editor);
      saveEditorSelection();
      updateFontSegmentUI(fontId);
      triggerAutoSave();
      return;
    } else {
      // Cursor only: applies to whatever is typed NEXT from the cursor onward
      document.execCommand('styleWithCSS', false, true);
      document.execCommand('fontName', false, def.family);

      // Insert zero-width space span so insertion point stays formatted
      const span = document.createElement('span');
      span.className = def.className;
      span.setAttribute('data-font', fontId);
      span.style.fontFamily = def.family;
      const textNode = document.createTextNode('\u200B');
      span.appendChild(textNode);

      range.insertNode(span);

      // Move cursor inside the span after the zero-width marker
      const newRange = document.createRange();
      newRange.setStart(textNode, 1);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      savedSelectionRange = newRange.cloneRange();
      updateFontSegmentUI(fontId);
      triggerAutoSave();
      return;
    }
  }

  // Fallback: update default note font
  applyBaseNoteFont(fontId);
  triggerAutoSave();
}

// Attach mousedown preventDefault to font buttons so editor never loses selection!
[elements.fontBtnSans, elements.fontBtnHand, elements.fontBtnManga].forEach(btn => {
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault(); // Keeps selection in contenteditable!
  });
});

elements.fontBtnSans.addEventListener('click', () => applyMixedFont('sans'));
elements.fontBtnHand.addEventListener('click', () => applyMixedFont('handwriting'));
elements.fontBtnManga.addEventListener('click', () => applyMixedFont('manga'));

// ============================================================================
// Drag Anywhere Engine (Empty Margins, Footer, Blank Space, Alt+Drag Anywhere)
// ============================================================================

/**
 * Checks if a mousedown event occurred on a draggable region.
 * Native -webkit-app-region: drag handles top bar, footer, and empty margins.
 * Custom JS drag is reserved strictly for Alt+drag anywhere on the note (including over text).
 */
function isDraggableArea(e) {
  // If locked, cannot be moved
  if (state.isLocked) return false;

  // Only primary mouse button (left click)
  if (e.button !== 0) return false;

  // Never drag while a popover or dialog is open
  if (document.body.classList.contains('has-open-popover')) return false;

  // Never drag from buttons, controls, popovers, confirm dialogs, inputs, or resize grip
  if (e.target.closest('button, .icon-btn, .popover, .confirm-dialog, .resize-grip, .checkbox-custom, input, textarea, select, label')) {
    return false;
  }

  // Custom JS drag is strictly for Alt+drag anywhere on the note (even over text)
  if (e.altKey) {
    return true;
  }

  return false;
}

let isDraggingWindow = false;
let dragStartScreenX = 0;
let dragStartScreenY = 0;
let totalDragDistance = 0;
let dragTargetElement = null;

// Track Alt key state to show move cursor everywhere on the note
window.addEventListener('keydown', (e) => {
  if (e.key === 'Alt') {
    document.body.classList.add('alt-drag-active');
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Alt') {
    document.body.classList.remove('alt-drag-active');
  }
});

window.addEventListener('blur', () => {
  document.body.classList.remove('alt-drag-active');
});

// Cursor when hovering editor
elements.editor.addEventListener('mousemove', (e) => {
  if (document.body.classList.contains('alt-drag-active')) {
    elements.editor.style.cursor = 'move';
  } else {
    elements.editor.style.cursor = 'text';
  }
});

// Mousedown handler for custom Alt-dragging note
document.addEventListener('mousedown', (e) => {
  // Ignore drag logic completely for any mousedown that starts inside popovers, dialogs, buttons or inputs
  if (e.target.closest('.popover, .confirm-dialog, button, input, textarea, select')) {
    return;
  }

  if (!isDraggableArea(e)) return;

  isDraggingWindow = true;
  dragStartScreenX = e.screenX;
  dragStartScreenY = e.screenY;
  totalDragDistance = 0;
  dragTargetElement = e.target;

  // Record window width and height once in main process at drag start
  if (window.stickyAPI && window.stickyAPI.startWindowDrag) {
    window.stickyAPI.startWindowDrag(state.id, e.screenX, e.screenY);
  }

  // Prevent default browser text selection when initiating a window drag
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (!isDraggingWindow) return;

  const dx = e.screenX - dragStartScreenX;
  const dy = e.screenY - dragStartScreenY;
  totalDragDistance += Math.abs(dx) + Math.abs(dy);

  if (dx !== 0 || dy !== 0) {
    dragStartScreenX = e.screenX;
    dragStartScreenY = e.screenY;
    window.stickyAPI.moveWindowDelta(state.id, dx, dy, e.shiftKey);
  }
});

window.addEventListener('mouseup', (e) => {
  if (isDraggingWindow) {
    isDraggingWindow = false;

    // Confirm bounds with fixed recorded width and height in main process
    if (window.stickyAPI && window.stickyAPI.endWindowDrag) {
      window.stickyAPI.endWindowDrag(state.id);
    }
  }
});

// ============================================================================
// Visual Customization: Color, Paper Styles, Opacity, Pin, Collapse
// ============================================================================

function applyColor(colorName) {
  if (colorName === 'dark') colorName = 'teal';
  state.color = colorName;

  NOTE_COLORS.forEach(c => document.body.classList.remove(`theme-${c}`));
  document.body.classList.add(`theme-${colorName}`);

  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.classList.toggle('active', swatch.dataset.color === colorName);
  });
}

function applyPaperStyle(styleName) {
  state.paperStyle = styleName;
  const styles = ['classic', 'corner-curl', 'bent-edge', 'wavy-curl', 'taped'];
  styles.forEach(s => document.body.classList.remove(`style-${s}`));
  document.body.classList.add(`style-${styleName}`);

  document.querySelectorAll('.style-thumb-btn, .style-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.style === styleName);
  });
}

function applyFontSize(size) {
  state.fontSize = size;
  elements.editor.style.fontSize = `${size}px`;
  elements.fontSizeDisplay.textContent = `${size}px`;
}

function applyOpacity(val) {
  state.opacity = val;
  const percent = Math.round(val * 100);
  elements.opacitySlider.value = percent;
  elements.opacityDisplay.textContent = `${percent}%`;
}

function applyTilt(val) {
  state.tilt = val;
  elements.stickyNote.style.setProperty('--note-tilt', `${val}deg`);
}

function applyPinState(isPinned) {
  state.isPinned = isPinned;
  elements.btnPin.classList.toggle('active', isPinned);
  elements.btnPin.title = isPinned ? 'Unpin from Top' : 'Always on Top (Pin)';
}

function applyLockState(isLocked) {
  state.isLocked = isLocked;
  document.body.classList.toggle('is-locked', isLocked);
  if (elements.btnLock) {
    elements.btnLock.classList.toggle('active', isLocked);
    elements.btnLock.title = isLocked ? 'Unlock Note' : 'Lock Note (Clicks pass through)';
  }
  if (elements.lockBadge) {
    elements.lockBadge.classList.toggle('hidden', !isLocked);
  }
  if (elements.editor) {
    elements.editor.setAttribute('contenteditable', isLocked ? 'false' : 'true');
  }
  if (elements.lockShackle) {
    if (isLocked) {
      elements.lockShackle.setAttribute('d', 'M7 11V7a5 5 0 0 1 10 0v4');
    } else {
      elements.lockShackle.setAttribute('d', 'M7 11V7a5 5 0 0 1 9.9-1');
    }
  }
  if (isLocked) {
    isIgnoringMouse = true;
    window.stickyAPI.setIgnoreMouseEvents(state.id, true, { forward: true });
  } else {
    isIgnoringMouse = false;
    window.stickyAPI.setIgnoreMouseEvents(state.id, false);
  }
}

function applyAutoFadeState(isAutoFaded) {
  state.isAutoFaded = isAutoFaded;
  document.body.classList.toggle('is-auto-faded', isAutoFaded);
}

function applyCollapseState(isCollapsed) {
  state.isCollapsed = isCollapsed;
  if (isCollapsed) {
    closeAllPopoversExcept(null);
  }
  elements.stickyNote.classList.toggle('is-collapsed', isCollapsed);
  elements.collapseIcon.innerHTML = isCollapsed
    ? '<polyline points="6 9 12 15 18 9"></polyline>'
    : '<polyline points="18 15 12 9 6 15"></polyline>';
  elements.btnCollapse.title = isCollapsed ? 'Expand Note' : 'Collapse Note';
  updateCollapsedPreview();
}

function applyReminderState(reminder) {
  state.reminder = reminder;
  const hasActive = Boolean(reminder && !reminder.fired && typeof reminder.dueAt === 'number' && reminder.dueAt > Date.now());

  if (elements.reminderBadge) {
    elements.reminderBadge.classList.toggle('hidden', !hasActive);
  }
  if (elements.btnReminder) {
    elements.btnReminder.classList.toggle('has-reminder', hasActive);
    if (hasActive) {
      const formatted = formatReminderDate(reminder.dueAt);
      elements.btnReminder.title = `Reminder: ${formatted} (Click to edit or cancel)`;
      if (elements.activeReminderText) elements.activeReminderText.textContent = formatted;
      if (elements.activeReminderBox) elements.activeReminderBox.classList.remove('hidden');
    } else {
      elements.btnReminder.title = 'Set Reminder';
      if (elements.activeReminderBox) elements.activeReminderBox.classList.add('hidden');
    }
  }
}

function formatTime(hour, min) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  const mStr = min > 0 ? `:${min.toString().padStart(2, '0')}` : ':00';
  return `${h12}${mStr} ${ampm}`;
}

function formatReminderDate(timestamp) {
  const d = new Date(timestamp);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const timeStr = formatTime(d.getHours(), d.getMinutes());
  if (isToday) return `Today ${timeStr}`;
  if (isTomorrow) return `Tomorrow ${timeStr}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
}

// ============================================================================
// Unified Popup & Confirmation Dialog Controller
// ============================================================================

const ALL_POPOVERS = [
  elements.morePopover,
  elements.templatesPopover,
  elements.colorPopover,
  elements.stylePopover,
  elements.sharePopover,
  elements.reminderPopover,
  elements.timerPopover,
  elements.stickerPopover,
  elements.deleteConfirm
].filter(Boolean);

// Capture-phase stop-propagation on mousedown, pointerdown, and touchstart for ALL popovers
// Ensures note drag, alt-drag, and transparent click-through never intercept popup interactions
ALL_POPOVERS.forEach(popover => {
  ['mousedown', 'pointerdown', 'touchstart'].forEach(evtName => {
    popover.addEventListener(evtName, (e) => {
      e.stopPropagation();
    }, true);
  });
});

/**
 * Updates document.body and stickyNote classes to reflect whether any popover is currently open.
 * Disables window drag and transparent click-through while open.
 */
function updateOpenPopoverClass() {
  const anyOpen = ALL_POPOVERS.some(p => !p.classList.contains('hidden'));
  document.body.classList.toggle('has-open-popover', anyOpen);
  if (elements.stickyNote) {
    elements.stickyNote.classList.toggle('has-open-popover', anyOpen);
  }
  if (anyOpen && isIgnoringMouse) {
    isIgnoringMouse = false;
    window.stickyAPI.setIgnoreMouseEvents(state.id, false);
  }
}

/**
 * Closes all popovers except the specified one (or all if none specified)
 */
function closeAllPopoversExcept(openOne = null) {
  ALL_POPOVERS.forEach(p => {
    if (p !== openOne) {
      p.classList.add('hidden');
    }
  });
  updateOpenPopoverClass();
}

/**
 * Opens a specific popover and closes all others
 */
function openPopup(popoverEl, onOpened) {
  if (!popoverEl) return;
  if (state.isCollapsed) {
    // Expand note first if a popup is triggered while collapsed
    applyCollapseState(false);
    window.stickyAPI.setCollapsed(state.id, false);
  }
  closeAllPopoversExcept(popoverEl);
  popoverEl.classList.remove('hidden');
  updateOpenPopoverClass();
  if (typeof onOpened === 'function') {
    onOpened();
  }
}

/**
 * Closes a specific popover
 */
function closePopup(popoverEl) {
  if (!popoverEl) return;
  popoverEl.classList.add('hidden');
  updateOpenPopoverClass();
}

/**
 * Toggles a popover open/close
 */
function togglePopup(popoverEl, onOpened) {
  if (!popoverEl) return;
  if (state.isCollapsed) {
    openPopup(popoverEl, onOpened);
    return;
  }
  const isCurrentlyOpen = !popoverEl.classList.contains('hidden');
  if (isCurrentlyOpen) {
    closePopup(popoverEl);
  } else {
    openPopup(popoverEl, onOpened);
  }
}

// Close popovers when clicking elsewhere (handled on click, NOT mousedown, so clicks inside finish first)
document.addEventListener('click', (e) => {
  if (!e.target.closest('.popover') && !e.target.closest('.confirm-dialog') && !e.target.closest('.icon-btn')) {
    closeAllPopoversExcept(null);
  }
});

// Close popovers on Escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (elements.deleteConfirm && !elements.deleteConfirm.classList.contains('hidden')) {
      closePopup(elements.deleteConfirm);
      if (elements.btnDelete) elements.btnDelete.focus();
      return;
    }
    closeAllPopoversExcept(null);
  }
});

// ============================================================================
// Header Control Buttons & Actions
// ============================================================================

// 1. New Note (+) Popover Menu & Templates
if (elements.btnNew) {
  elements.btnNew.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopup(elements.templatesPopover);
  });
}

document.querySelectorAll('.template-item-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const templateId = btn.dataset.template || 'blank';
    closePopup(elements.templatesPopover);
    window.stickyAPI.createNoteFromTemplate(templateId);
  });
});

// 2. Collapse / Expand
elements.btnCollapse.addEventListener('click', () => {
  closeAllPopoversExcept(null);
  const nextCollapsed = !state.isCollapsed;
  applyCollapseState(nextCollapsed);
  window.stickyAPI.setCollapsed(state.id, state.isCollapsed);
});

// 3. Pin (Always on Top)
elements.btnPin.addEventListener('click', () => {
  applyPinState(!state.isPinned);
  window.stickyAPI.setAlwaysOnTop(state.id, state.isPinned);
});

// Lock Note Toggle (stays on top, clicks pass through, dimmed with badge)
if (elements.btnLock) {
  elements.btnLock.addEventListener('mouseenter', () => {
    if (isIgnoringMouse) {
      isIgnoringMouse = false;
      window.stickyAPI.setIgnoreMouseEvents(state.id, false);
    }
  });

  elements.btnLock.addEventListener('mouseleave', () => {
    if (state.isLocked && !isIgnoringMouse) {
      isIgnoringMouse = true;
      window.stickyAPI.setIgnoreMouseEvents(state.id, true, { forward: true });
    }
  });

  elements.btnLock.addEventListener('click', (e) => {
    e.stopPropagation();
    const nextLocked = !state.isLocked;
    applyLockState(nextLocked);
    window.stickyAPI.setLocked(state.id, nextLocked);
    showToast(nextLocked ? 'Note locked 🔒' : 'Note unlocked 🔓');
    triggerAutoSave();
  });
}

// More Options (⋯) Dropdown Menu
if (elements.btnMore) {
  elements.btnMore.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.isCollapsed) return;
    togglePopup(elements.morePopover);
  });
}

if (elements.btnTemplatesMenu) {
  elements.btnTemplatesMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    openPopup(elements.templatesPopover);
  });
}

// 4. Color Popover Toggle
if (elements.btnColor) {
  elements.btnColor.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopup(elements.colorPopover);
  });
}

document.querySelectorAll('.color-swatch').forEach(swatch => {
  swatch.addEventListener('click', (e) => {
    e.stopPropagation();
    const chosen = swatch.dataset.color;
    applyColor(chosen);
    closePopup(elements.colorPopover);
    triggerAutoSave();
  });
});

// 5. Style Popover Toggle
if (elements.btnStyle) {
  elements.btnStyle.addEventListener('click', (e) => {
    e.stopPropagation();
    saveEditorSelection();
    togglePopup(elements.stylePopover);
  });
}

// Paper Style Selection (Thumbnails)
document.querySelectorAll('.style-thumb-btn, .style-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    applyPaperStyle(btn.dataset.style);
    triggerAutoSave();
  });
});

// Font Size Controls
elements.btnFontSmaller.addEventListener('click', () => {
  if (state.fontSize > 12) {
    applyFontSize(state.fontSize - 2);
    triggerAutoSave();
  }
});

elements.btnFontBigger.addEventListener('click', () => {
  if (state.fontSize < 32) {
    applyFontSize(state.fontSize + 2);
    triggerAutoSave();
  }
});

// Opacity Slider
elements.opacitySlider.addEventListener('input', (e) => {
  const percent = parseInt(e.target.value, 10);
  const opacityVal = percent / 100;
  elements.opacityDisplay.textContent = `${percent}%`;
  window.stickyAPI.setOpacity(state.id, opacityVal);
});

elements.opacitySlider.addEventListener('change', (e) => {
  const percent = parseInt(e.target.value, 10);
  state.opacity = percent / 100;
  triggerAutoSave();
});

// 6. Share Popover Toggle
if (elements.btnShare) {
  elements.btnShare.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopup(elements.sharePopover);
  });
}

// Background selection (Transparent / White)
elements.bgBtnTransparent.addEventListener('click', () => {
  state.shareBg = 'transparent';
  elements.bgBtnTransparent.classList.add('active');
  elements.bgBtnWhite.classList.remove('active');
});

elements.bgBtnWhite.addEventListener('click', () => {
  state.shareBg = 'white';
  elements.bgBtnWhite.classList.add('active');
  elements.bgBtnTransparent.classList.remove('active');
});

// Share Actions: Copy / Save
elements.btnCopyImage.addEventListener('click', async () => {
  closePopup(elements.sharePopover);
  const res = await window.stickyAPI.exportNoteImage({
    noteId: state.id,
    action: 'copy',
    transparentBg: state.shareBg === 'transparent'
  });
  if (res && res.success) {
    showToast('Copied to clipboard! 📋');
  }
});

elements.btnSaveImage.addEventListener('click', async () => {
  closePopup(elements.sharePopover);
  const res = await window.stickyAPI.exportNoteImage({
    noteId: state.id,
    action: 'save',
    transparentBg: state.shareBg === 'transparent'
  });
  if (res && res.success) {
    showToast('Saved as image! 💾');
  }
});

// Toast notification helper
let toastTimer = null;
function showToast(msg) {
  if (!elements.toast) return;
  elements.toast.textContent = msg;
  elements.toast.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 2200);
}

// 7. Delete Note & Confirmation Dialog
function showDeleteConfirmation() {
  openPopup(elements.deleteConfirm, () => {
    // Focus "Not yet" by default so accidental Enter does not delete note
    if (elements.btnCancelDelete) {
      elements.btnCancelDelete.focus();
    }
  });
}

function handleConfirmDelete() {
  closePopup(elements.deleteConfirm);
  if (window.soundEffects) {
    window.soundEffects.playCrumpleSound();
  }
  elements.stickyNote.classList.add('is-crumpling');
  setTimeout(() => {
    window.stickyAPI.deleteNote(state.id);
  }, 320);
}

// Diagnostic check: log element under mouse on mousedown/click inside deleteConfirm
if (elements.deleteConfirm) {
  ['mousedown', 'click'].forEach(evtType => {
    elements.deleteConfirm.addEventListener(evtType, (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      console.log(`[DEBUG-DELETE] ${evtType} at (${e.clientX}, ${e.clientY}) elementUnderMouse:`, el ? `${el.tagName}#${el.id}.${el.className}` : 'null', 'target:', e.target.tagName);
    }, true);
  });
}

if (elements.btnDelete) {
  elements.btnDelete.addEventListener('click', (e) => {
    e.stopPropagation();
    if (elements.deleteConfirm && !elements.deleteConfirm.classList.contains('hidden')) {
      closePopup(elements.deleteConfirm);
    } else {
      showDeleteConfirmation();
    }
  });
}

// Delegated click handler on deleteConfirm container for reliable button clicks
if (elements.deleteConfirm) {
  elements.deleteConfirm.addEventListener('click', (e) => {
    e.stopPropagation();
    const btnCancel = e.target.closest('#btnCancelDelete') || e.target.closest('.btn-cancel');
    const btnConfirm = e.target.closest('#btnConfirmDelete') || e.target.closest('.btn-danger');

    if (btnCancel) {
      closePopup(elements.deleteConfirm);
      if (elements.btnDelete) elements.btnDelete.focus();
    } else if (btnConfirm) {
      handleConfirmDelete();
    }
  });

  // Keyboard navigation inside delete confirmation dialog:
  // - Tab cycles between "Not yet" and "Yes, toss it"
  // - Enter confirms the currently focused button
  // - Esc cancels and closes confirmation
  elements.deleteConfirm.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closePopup(elements.deleteConfirm);
      if (elements.btnDelete) elements.btnDelete.focus();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      if (document.activeElement === elements.btnCancelDelete) {
        if (elements.btnConfirmDelete) elements.btnConfirmDelete.focus();
      } else {
        if (elements.btnCancelDelete) elements.btnCancelDelete.focus();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (document.activeElement === elements.btnConfirmDelete) {
        handleConfirmDelete();
      } else {
        closePopup(elements.deleteConfirm);
        if (elements.btnDelete) elements.btnDelete.focus();
      }
    }
  });
}

// ============================================================================
// Reminders System (Triggered strictly through the bell icon)
// ============================================================================

// Step 1 Diagnostic Check: log element under mouse on mousedown/click inside popup
if (elements.reminderPopover) {
  ['mousedown', 'click'].forEach(evtType => {
    elements.reminderPopover.addEventListener(evtType, (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      console.log(`[DEBUG-REMINDER] ${evtType} at (${e.clientX}, ${e.clientY}) elementUnderMouse:`, el ? `${el.tagName}#${el.id}.${el.className}` : 'null', 'target:', e.target.tagName);
    }, true);
  });

  // Stop mousedown and pointerdown propagation in capture phase so note drag & document handlers never intercept
  ['mousedown', 'pointerdown', 'touchstart'].forEach(evtName => {
    elements.reminderPopover.addEventListener(evtName, (e) => {
      e.stopPropagation();
    }, true);
  });
}

// Toggle reminder popover
if (elements.btnReminder) {
  elements.btnReminder.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopup(elements.reminderPopover, () => {
      if (elements.reminderError) elements.reminderError.classList.add('hidden');
      if (elements.reminderCustomInput) {
        // Default custom input to 1 hour from now (always fresh)
        const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
        const pad = (n) => String(n).padStart(2, '0');
        elements.reminderCustomInput.value = `${inOneHour.getFullYear()}-${pad(inOneHour.getMonth() + 1)}-${pad(inOneHour.getDate())}T${pad(inOneHour.getHours())}:${pad(inOneHour.getMinutes())}`;
      }
    });
  });
}

function setAndSaveReminder(dueAt) {
  const reminderObj = {
    dueAt,
    fired: false
  };
  applyReminderState(reminderObj);
  window.stickyAPI.setReminder(state.id, reminderObj);
  closePopup(elements.reminderPopover);
  showToast('Reminder set! 🔔');
  triggerAutoSave();
}

function handlePresetClick(preset) {
  let targetTime = Date.now();
  if (preset === '5m') {
    targetTime += 5 * 60 * 1000;
  } else if (preset === '10m') {
    targetTime += 10 * 60 * 1000;
  } else if (preset === '30m') {
    targetTime += 30 * 60 * 1000;
  } else if (preset === '1h') {
    targetTime += 60 * 60 * 1000;
  } else if (preset === 'tonight') {
    const d = new Date();
    d.setHours(18, 0, 0, 0);
    if (d.getTime() <= Date.now()) {
      d.setDate(d.getDate() + 1);
    }
    targetTime = d.getTime();
  } else if (preset === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    targetTime = d.getTime();
  }
  setAndSaveReminder(targetTime);
}

function handleSetCustomReminder() {
  const val = elements.reminderCustomInput ? elements.reminderCustomInput.value : '';
  if (!val) {
    if (elements.reminderError) {
      elements.reminderError.textContent = 'Pick a future time';
      elements.reminderError.classList.remove('hidden');
    }
    return;
  }
  const target = new Date(val).getTime();
  if (isNaN(target) || target <= Date.now()) {
    if (elements.reminderError) {
      elements.reminderError.textContent = 'Pick a future time';
      elements.reminderError.classList.remove('hidden');
    }
    return;
  }
  if (elements.reminderError) elements.reminderError.classList.add('hidden');
  setAndSaveReminder(target);
}

function handleCancelReminder() {
  applyReminderState(null);
  window.stickyAPI.cancelReminder(state.id);
  closePopup(elements.reminderPopover);
  showToast('Reminder cancelled');
  triggerAutoSave();
}

// Delegated click handler on reminder popover for reliable button clicks
if (elements.reminderPopover) {
  elements.reminderPopover.addEventListener('click', (e) => {
    e.stopPropagation();

    // 1. Preset button click
    const presetBtn = e.target.closest('.reminder-preset-btn');
    if (presetBtn) {
      handlePresetClick(presetBtn.dataset.preset);
      return;
    }

    // 2. Custom date/time Set button
    if (e.target.closest('#btnSetCustomReminder')) {
      handleSetCustomReminder();
      return;
    }

    // 3. Cancel reminder button
    if (e.target.closest('#btnCancelReminder')) {
      handleCancelReminder();
      return;
    }
  });
}

// Keyboard shortcuts inside custom date/time input
if (elements.reminderCustomInput) {
  elements.reminderCustomInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSetCustomReminder();
    }
  });
  elements.reminderCustomInput.addEventListener('input', () => {
    if (elements.reminderError) elements.reminderError.classList.add('hidden');
  });
}

// Reminder alert trigger (glow/shake)
if (window.stickyAPI.onReminderAlert) {
  window.stickyAPI.onReminderAlert(() => {
    elements.stickyNote.classList.remove('reminder-alert');
    void elements.stickyNote.offsetWidth;
    elements.stickyNote.classList.add('reminder-alert');

    setTimeout(() => {
      elements.stickyNote.classList.remove('reminder-alert');
    }, 2500);
  });
}

// ============================================================================
// Stickers & Doodles System
// ============================================================================

// Toggle sticker popover
if (elements.btnSticker) {
  elements.btnSticker.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopup(elements.stickerPopover);
  });
}

// Tabs switching in sticker popover
if (elements.tabBtnStickers && elements.tabBtnDoodle) {
  elements.tabBtnStickers.addEventListener('click', () => {
    elements.tabBtnStickers.classList.add('active');
    elements.tabBtnDoodle.classList.remove('active');
    if (elements.stickerTraySection) elements.stickerTraySection.classList.remove('hidden');
    if (elements.doodleControlsSection) elements.doodleControlsSection.classList.add('hidden');
  });

  elements.tabBtnDoodle.addEventListener('click', () => {
    elements.tabBtnDoodle.classList.add('active');
    elements.tabBtnStickers.classList.remove('active');
    if (elements.doodleControlsSection) elements.doodleControlsSection.classList.remove('hidden');
    if (elements.stickerTraySection) elements.stickerTraySection.classList.add('hidden');
  });
}

// Add sticker when clicking choices in tray
if (elements.stickerChoices) {
  elements.stickerChoices.forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.stickers.length >= 30) {
        showToast('Max 30 stickers per note 📌');
        return;
      }
      const emoji = btn.dataset.emoji || btn.textContent.trim();
      const newSticker = {
        id: 'stk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        emoji,
        x: Math.max(20, Math.floor(Math.random() * 80) + 40),
        y: Math.max(20, Math.floor(Math.random() * 80) + 40),
        size: 36
      };
      state.stickers.push(newSticker);
      renderStickers(state.stickers);
      triggerAutoSave();
    });
  });
}

/**
 * Renders all stickers in the stickers overlay container
 */
function renderStickers(stickers) {
  if (!elements.stickersContainer) return;
  elements.stickersContainer.innerHTML = '';
  if (!Array.isArray(stickers)) return;

  stickers.forEach(sticker => {
    const el = document.createElement('div');
    el.className = 'sticky-sticker';
    el.dataset.id = sticker.id;
    el.style.left = (sticker.x || 30) + 'px';
    el.style.top = (sticker.y || 30) + 'px';
    el.style.fontSize = (sticker.size || 36) + 'px';

    const contentSpan = document.createElement('span');
    contentSpan.className = 'sticker-content';
    contentSpan.textContent = sticker.emoji || '⭐';
    el.appendChild(contentSpan);

    const btnDelete = document.createElement('button');
    btnDelete.className = 'sticker-btn-delete';
    btnDelete.type = 'button';
    btnDelete.title = 'Remove sticker';
    btnDelete.textContent = '✕';
    el.appendChild(btnDelete);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'sticker-resize-handle';
    resizeHandle.title = 'Drag to resize sticker';
    el.appendChild(resizeHandle);

    // Remove sticker on delete button click
    btnDelete.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      state.stickers = state.stickers.filter(s => s.id !== sticker.id);
      renderStickers(state.stickers);
      triggerAutoSave();
    });

    // Drag sticker
    el.addEventListener('mousedown', (e) => {
      if (e.target === btnDelete || e.target === resizeHandle) return;
      e.stopPropagation();
      e.preventDefault();

      const startMouseX = e.clientX;
      const startMouseY = e.clientY;
      const startX = sticker.x || 30;
      const startY = sticker.y || 30;
      el.classList.add('is-selected');

      const onMouseMove = (moveEvt) => {
        const dx = moveEvt.clientX - startMouseX;
        const dy = moveEvt.clientY - startMouseY;
        sticker.x = Math.max(0, Math.round(startX + dx));
        sticker.y = Math.max(0, Math.round(startY + dy));
        el.style.left = sticker.x + 'px';
        el.style.top = sticker.y + 'px';
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        el.classList.remove('is-selected');
        triggerAutoSave();
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // Resize sticker
    resizeHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();

      const startMouseX = e.clientX;
      const startMouseY = e.clientY;
      const startSize = sticker.size || 36;
      el.classList.add('is-selected');

      const onMouseMove = (moveEvt) => {
        const dx = moveEvt.clientX - startMouseX;
        const dy = moveEvt.clientY - startMouseY;
        const delta = Math.max(dx, dy);
        const newSize = Math.max(16, Math.min(140, Math.round(startSize + delta)));
        sticker.size = newSize;
        el.style.fontSize = newSize + 'px';
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        el.classList.remove('is-selected');
        triggerAutoSave();
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    elements.stickersContainer.appendChild(el);
  });
}

// Doodle Drawing State
let doodleCanvasCtx = null;
let isPenMode = false;
let doodleTool = 'pen'; // 'pen' | 'eraser'
let doodleColor = '#1e293b';
let doodleSize = 4;
let isDrawingStroke = false;
let lastStrokeX = 0;
let lastStrokeY = 0;
let doodleHistory = []; // DataURL undo history

function syncDoodleCanvasSize() {
  if (!elements.doodleCanvas || !elements.noteBody) return;
  if (!doodleCanvasCtx) {
    doodleCanvasCtx = elements.doodleCanvas.getContext('2d');
  }
  const rect = elements.noteBody.getBoundingClientRect();
  const width = Math.max(100, Math.floor(rect.width));
  const height = Math.max(80, Math.floor(rect.height));

  if (elements.doodleCanvas.width !== width || elements.doodleCanvas.height !== height) {
    const prevData = state.doodles;
    elements.doodleCanvas.width = width;
    elements.doodleCanvas.height = height;
    if (prevData) {
      const img = new Image();
      img.onload = () => {
        if (doodleCanvasCtx) {
          doodleCanvasCtx.drawImage(img, 0, 0);
        }
      };
      img.src = prevData;
    }
  }
}

/**
 * Initializes the doodle canvas with optional existing drawing data
 */
function initDoodleCanvas(savedDataUrl) {
  if (!elements.doodleCanvas) return;
  doodleCanvasCtx = elements.doodleCanvas.getContext('2d');
  syncDoodleCanvasSize();

  if (savedDataUrl) {
    const img = new Image();
    img.onload = () => {
      if (doodleCanvasCtx) {
        doodleCanvasCtx.drawImage(img, 0, 0);
        doodleHistory = [savedDataUrl];
      }
    };
    img.src = savedDataUrl;
  }

  // Window resize syncs canvas bounds
  window.addEventListener('resize', () => {
    syncDoodleCanvasSize();
  });

  // Canvas drawing listeners
  elements.doodleCanvas.addEventListener('mousedown', (e) => {
    if (!isPenMode || !doodleCanvasCtx) return;
    isDrawingStroke = true;
    const rect = elements.doodleCanvas.getBoundingClientRect();
    lastStrokeX = e.clientX - rect.left;
    lastStrokeY = e.clientY - rect.top;

    doodleCanvasCtx.beginPath();
    doodleCanvasCtx.moveTo(lastStrokeX, lastStrokeY);
    doodleCanvasCtx.lineCap = 'round';
    doodleCanvasCtx.lineJoin = 'round';

    if (doodleTool === 'eraser') {
      doodleCanvasCtx.globalCompositeOperation = 'destination-out';
      doodleCanvasCtx.lineWidth = doodleSize * 2.5;
    } else {
      doodleCanvasCtx.globalCompositeOperation = 'source-over';
      doodleCanvasCtx.strokeStyle = doodleColor;
      doodleCanvasCtx.lineWidth = doodleSize;
    }

    // Single click dot
    doodleCanvasCtx.lineTo(lastStrokeX + 0.1, lastStrokeY + 0.1);
    doodleCanvasCtx.stroke();
  });

  elements.doodleCanvas.addEventListener('mousemove', (e) => {
    if (!isDrawingStroke || !doodleCanvasCtx) return;
    const rect = elements.doodleCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    doodleCanvasCtx.lineTo(x, y);
    doodleCanvasCtx.stroke();
    lastStrokeX = x;
    lastStrokeY = y;
  });

  const finishStroke = () => {
    if (!isDrawingStroke || !doodleCanvasCtx) return;
    isDrawingStroke = false;
    doodleCanvasCtx.closePath();

    const dataUrl = elements.doodleCanvas.toDataURL();
    if (dataUrl.length > 2 * 1024 * 1024) {
      showToast('Doodle limit reached');
      return;
    }
    doodleHistory.push(dataUrl);
    if (doodleHistory.length > 20) doodleHistory.shift();
    state.doodles = dataUrl;
    triggerAutoSave();
  };

  elements.doodleCanvas.addEventListener('mouseup', finishStroke);
  elements.doodleCanvas.addEventListener('mouseleave', finishStroke);
}

// Toggle Pen Mode
if (elements.btnTogglePen) {
  elements.btnTogglePen.addEventListener('click', () => {
    isPenMode = !isPenMode;
    document.body.classList.toggle('pen-mode-active', isPenMode);
    elements.btnTogglePen.classList.toggle('active', isPenMode);
    elements.btnTogglePen.textContent = isPenMode ? '✏️ Pen Mode: ON' : '✏️ Pen Mode: OFF';
    syncDoodleCanvasSize();
  });
}

// Pen Color selection
if (elements.doodleColorBtns) {
  elements.doodleColorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      doodleColor = btn.dataset.color || '#1e293b';
      elements.doodleColorBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Switch back to pen if eraser was active
      if (doodleTool === 'eraser') {
        doodleTool = 'pen';
        if (elements.btnToolPen) elements.btnToolPen.classList.add('active');
        if (elements.btnToolEraser) elements.btnToolEraser.classList.remove('active');
      }
    });
  });
}

// Brush Size selection
if (elements.doodleSizeBtns) {
  elements.doodleSizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      doodleSize = parseInt(btn.dataset.size, 10) || 4;
      elements.doodleSizeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// Tool Selection (Pen vs Eraser)
if (elements.btnToolPen) {
  elements.btnToolPen.addEventListener('click', () => {
    doodleTool = 'pen';
    elements.btnToolPen.classList.add('active');
    if (elements.btnToolEraser) elements.btnToolEraser.classList.remove('active');
  });
}

if (elements.btnToolEraser) {
  elements.btnToolEraser.addEventListener('click', () => {
    doodleTool = 'eraser';
    elements.btnToolEraser.classList.add('active');
    if (elements.btnToolPen) elements.btnToolPen.classList.remove('active');
  });
}

// Undo doodle
if (elements.btnUndoDoodle) {
  elements.btnUndoDoodle.addEventListener('click', () => {
    if (!doodleCanvasCtx || doodleHistory.length === 0) return;
    doodleHistory.pop(); // Remove current state
    doodleCanvasCtx.clearRect(0, 0, elements.doodleCanvas.width, elements.doodleCanvas.height);

    if (doodleHistory.length > 0) {
      const prevUrl = doodleHistory[doodleHistory.length - 1];
      const img = new Image();
      img.onload = () => {
        if (doodleCanvasCtx) {
          doodleCanvasCtx.drawImage(img, 0, 0);
        }
      };
      img.src = prevUrl;
      state.doodles = prevUrl;
    } else {
      state.doodles = null;
    }
    triggerAutoSave();
  });
}

// Clear all doodles
if (elements.btnClearDoodles) {
  elements.btnClearDoodles.addEventListener('click', () => {
    if (!doodleCanvasCtx) return;
    doodleCanvasCtx.clearRect(0, 0, elements.doodleCanvas.width, elements.doodleCanvas.height);
    doodleHistory = [];
    state.doodles = null;
    triggerAutoSave();
  });
}

// ============================================================================
// Timer & Pomodoro System
// ============================================================================

let timerInterval = null;

// Toggle timer popover
if (elements.btnTimer) {
  elements.btnTimer.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopup(elements.timerPopover);
  });
}

function formatTimerDisplay(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function renderTimerStrip() {
  if (!state.timer) {
    if (elements.timerStrip) elements.timerStrip.classList.add('hidden');
    if (elements.timerBadge) elements.timerBadge.classList.add('hidden');
    updateCollapsedPreview();
    return;
  }

  if (elements.timerStrip) elements.timerStrip.classList.remove('hidden');
  if (elements.timerBadge) {
    elements.timerBadge.classList.remove('hidden');
    elements.timerBadge.textContent = formatTimerDisplay(state.timer.remainingSecs);
  }

  if (elements.timerStripTime) {
    elements.timerStripTime.textContent = formatTimerDisplay(state.timer.remainingSecs);
  }

  if (state.timer.mode === 'pomodoro') {
    if (elements.timerStripIcon) elements.timerStripIcon.textContent = state.timer.isWork ? '🍅' : '☕';
    if (elements.timerStripLabel) elements.timerStripLabel.textContent = state.timer.isWork ? 'Focus' : 'Break';
  } else {
    if (elements.timerStripIcon) elements.timerStripIcon.textContent = '⏱️';
    if (elements.timerStripLabel) elements.timerStripLabel.textContent = 'Timer';
  }

  if (elements.timerPlayPauseBtn) {
    elements.timerPlayPauseBtn.textContent = state.timer.isRunning ? '⏸️' : '▶️';
    elements.timerPlayPauseBtn.title = state.timer.isRunning ? 'Pause' : 'Resume';
  }

  updateCollapsedPreview();
}

function startTimer(minutes, mode = 'countdown', isWork = true) {
  if (timerInterval) clearInterval(timerInterval);

  const totalSecs = Math.max(1, Math.round(minutes * 60));
  state.timer = {
    mode,
    totalSecs,
    remainingSecs: totalSecs,
    isRunning: true,
    isWork
  };

  closeAllPopoversExcept(null);
  renderTimerStrip();
  runTimerLoop();
  triggerAutoSave();
}

function restoreTimer(savedTimer) {
  if (!savedTimer) return;
  state.timer = {
    mode: savedTimer.mode || 'countdown',
    totalSecs: savedTimer.totalSecs || 1500,
    remainingSecs: typeof savedTimer.remainingSecs === 'number' ? savedTimer.remainingSecs : 1500,
    isRunning: Boolean(savedTimer.isRunning),
    isWork: savedTimer.isWork !== false
  };

  renderTimerStrip();
  if (state.timer.isRunning) {
    runTimerLoop();
  }
}

function runTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!state.timer || !state.timer.isRunning) return;

    state.timer.remainingSecs--;
    if (state.timer.remainingSecs <= 0) {
      state.timer.remainingSecs = 0;
      onTimerCompleted();
    }
    renderTimerStrip();
  }, 1000);
}

function onTimerCompleted() {
  // Play soft chime sound
  if (window.soundEffects) {
    window.soundEffects.playChimeSound();
  }

  // Show desktop notification
  try {
    const isPomodoro = state.timer.mode === 'pomodoro';
    const title = isPomodoro
      ? (state.timer.isWork ? '🍅 Pomodoro Finished!' : '☕ Break Finished!')
      : '⏱️ StickyPad Timer Finished!';
    const rawText = (elements.editor.innerText || '').trim();
    const excerpt = rawText.split('\n')[0].slice(0, 50) || 'Sticky Note';
    const bodyMsg = isPomodoro
      ? (state.timer.isWork ? 'Great work! Take a 5 min break.' : 'Break is over! Time to focus.')
      : `Timer completed: "${excerpt}"`;

    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        new Notification(title, { body: bodyMsg });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
          if (p === 'granted') new Notification(title, { body: bodyMsg });
        });
      }
    }
  } catch (_) {}

  // Visual shake/glow alert on note
  elements.stickyNote.classList.remove('reminder-alert');
  void elements.stickyNote.offsetWidth;
  elements.stickyNote.classList.add('reminder-alert');
  setTimeout(() => {
    elements.stickyNote.classList.remove('reminder-alert');
  }, 2500);

  // Transition Pomodoro work -> break or break -> work, or stop countdown
  if (state.timer.mode === 'pomodoro') {
    if (state.timer.isWork) {
      // Transition to 5m break
      state.timer.isWork = false;
      state.timer.totalSecs = 5 * 60;
      state.timer.remainingSecs = 5 * 60;
      state.timer.isRunning = true;
    } else {
      // Transition back to 25m work (paused)
      state.timer.isWork = true;
      state.timer.totalSecs = 25 * 60;
      state.timer.remainingSecs = 25 * 60;
      state.timer.isRunning = false;
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = null;
    }
  } else {
    state.timer.isRunning = false;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }

  renderTimerStrip();
  triggerAutoSave();
}

// Timer strip Play / Pause
if (elements.timerPlayPauseBtn) {
  elements.timerPlayPauseBtn.addEventListener('click', () => {
    if (!state.timer) return;
    state.timer.isRunning = !state.timer.isRunning;
    if (state.timer.isRunning) {
      if (state.timer.remainingSecs <= 0) {
        state.timer.remainingSecs = state.timer.totalSecs;
      }
      runTimerLoop();
    } else {
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = null;
    }
    renderTimerStrip();
    triggerAutoSave();
  });
}

// Timer strip Reset
if (elements.timerResetBtn) {
  elements.timerResetBtn.addEventListener('click', () => {
    if (!state.timer) return;
    state.timer.remainingSecs = state.timer.totalSecs;
    renderTimerStrip();
    triggerAutoSave();
  });
}

// Timer strip Close
if (elements.timerCloseBtn) {
  elements.timerCloseBtn.addEventListener('click', () => {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    state.timer = null;
    renderTimerStrip();
    triggerAutoSave();
  });
}

// Timer Popover Preset & Custom Button Handlers
if (elements.btnPresetPomodoro) {
  elements.btnPresetPomodoro.addEventListener('click', () => {
    startTimer(25, 'pomodoro', true);
  });
}

if (elements.timerPresets) {
  elements.timerPresets.forEach(btn => {
    btn.addEventListener('click', () => {
      const mins = parseInt(btn.dataset.mins, 10) || 5;
      startTimer(mins, 'countdown');
    });
  });
}

if (elements.btnStartCustomTimer) {
  elements.btnStartCustomTimer.addEventListener('click', () => {
    const mins = parseFloat(elements.customTimerMinutes ? elements.customTimerMinutes.value : 20) || 20;
    startTimer(mins, 'countdown');
  });
}

if (elements.customTimerMinutes) {
  elements.customTimerMinutes.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const mins = parseFloat(elements.customTimerMinutes.value) || 20;
      startTimer(mins, 'countdown');
    }
  });
}

// Keyboard shortcuts: Ctrl+Z / Cmd+Z restores the last deleted note from Trash
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    if (document.activeElement !== elements.editor) {
      e.preventDefault();
      window.stickyAPI.undoDelete();
    }
  }
});

// 8. Multi-Edge & Corner Interactive Window Resizing
let isResizing = false;
let resizeDirection = null; // 'br' | 'bl' | 'r' | 'b'
let resizeStartScreenX = 0;
let resizeStartScreenY = 0;
let resizeStartW = 0;
let resizeStartH = 0;
let resizeStartWinX = 0;
let resizeStartWinY = 0;

function startResize(direction, e) {
  if (state.isLocked || state.isCollapsed) return; // Locked or collapsed notes cannot be resized
  isResizing = true;
  resizeDirection = direction;
  resizeStartScreenX = e.screenX;
  resizeStartScreenY = e.screenY;
  resizeStartW = window.innerWidth || window.outerWidth;
  resizeStartH = window.innerHeight || window.outerHeight;
  resizeStartWinX = window.screenX;
  resizeStartWinY = window.screenY;
  e.preventDefault();
  e.stopPropagation();
}

const resizeTargets = [
  { el: elements.resizeGrip, dir: 'br' },
  { el: elements.resizeHandleBR, dir: 'br' },
  { el: elements.resizeHandleBL, dir: 'bl' },
  { el: elements.resizeEdgeR, dir: 'r' },
  { el: elements.resizeEdgeB, dir: 'b' }
];

resizeTargets.forEach(({ el, dir }) => {
  if (el) {
    el.addEventListener('mousedown', (e) => startResize(dir, e));
  }
});

window.addEventListener('mousemove', (e) => {
  if (!isResizing || state.isLocked || state.isCollapsed) return;

  const dx = e.screenX - resizeStartScreenX;
  const dy = e.screenY - resizeStartScreenY;
  const MIN_W = 220;
  const MAX_W = 800;
  const MIN_H = 160;
  const MAX_H = 800;

  let newW = resizeStartW;
  let newH = resizeStartH;
  let newX = undefined;
  let newY = undefined;

  if (resizeDirection === 'br') {
    newW = Math.min(MAX_W, Math.max(MIN_W, Math.round(resizeStartW + dx)));
    if (!state.isCollapsed) {
      newH = Math.min(MAX_H, Math.max(MIN_H, Math.round(resizeStartH + dy)));
    }
  } else if (resizeDirection === 'r') {
    newW = Math.min(MAX_W, Math.max(MIN_W, Math.round(resizeStartW + dx)));
  } else if (resizeDirection === 'b') {
    if (!state.isCollapsed) {
      newH = Math.min(MAX_H, Math.max(MIN_H, Math.round(resizeStartH + dy)));
    }
  } else if (resizeDirection === 'bl') {
    newW = Math.min(MAX_W, Math.max(MIN_W, Math.round(resizeStartW - dx)));
    newX = Math.round(resizeStartWinX + (resizeStartW - newW));
    if (!state.isCollapsed) {
      newH = Math.min(MAX_H, Math.max(MIN_H, Math.round(resizeStartH + dy)));
    }
  }

  window.stickyAPI.resizeNote(state.id, newW, newH, newX, newY);
});

window.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    resizeDirection = null;
    triggerAutoSave();
  }
});

// ============================================================================
// Click-Through on Transparent Padding Outside Paper
// ============================================================================
let isIgnoringMouse = false;
window.addEventListener('mousemove', (e) => {
  if (isResizing || isDraggingWindow) return;

  // Never ignore mouse events when a popover or dialog is open
  if (document.body.classList.contains('has-open-popover')) {
    if (isIgnoringMouse) {
      isIgnoringMouse = false;
      window.stickyAPI.setIgnoreMouseEvents(state.id, false);
    }
    return;
  }

  // Lock mode: clicks pass through to whatever is behind except over the lock button itself
  if (state.isLocked) {
    const overLockButton = Boolean(e.target && e.target.closest && e.target.closest('#btnLock'));
    if (overLockButton) {
      if (isIgnoringMouse) {
        isIgnoringMouse = false;
        window.stickyAPI.setIgnoreMouseEvents(state.id, false);
      }
    } else {
      if (!isIgnoringMouse) {
        isIgnoringMouse = true;
        window.stickyAPI.setIgnoreMouseEvents(state.id, true, { forward: true });
      }
    }
    return;
  }

  const insideCard = Boolean(
    e.target && e.target.closest && (
      e.target.closest('#stickyNote') ||
      e.target.closest('.resize-handle-br') ||
      e.target.closest('.resize-handle-bl') ||
      e.target.closest('.resize-edge-r') ||
      e.target.closest('.resize-edge-b') ||
      e.target.closest('.resize-grip')
    )
  );
  if (insideCard) {
    if (isIgnoringMouse) {
      isIgnoringMouse = false;
      window.stickyAPI.setIgnoreMouseEvents(state.id, false);
    }
  } else {
    // Over the 24px invisible outer window padding: forward clicks to windows beneath
    if (!isIgnoringMouse) {
      isIgnoringMouse = true;
      window.stickyAPI.setIgnoreMouseEvents(state.id, true, { forward: true });
    }
  }
});

// Restore normal event handling when mouse enters the note card
elements.stickyNote.addEventListener('mouseenter', () => {
  if (state.isLocked) return;
  if (isIgnoringMouse) {
    isIgnoringMouse = false;
    window.stickyAPI.setIgnoreMouseEvents(state.id, false);
  }
});

// Snap highlight listener
if (window.stickyAPI.onSnapHighlight) {
  window.stickyAPI.onSnapHighlight(({ snapped }) => {
    elements.stickyNote.classList.toggle('is-snapping', Boolean(snapped));
  });
}

// ============================================================================
// Clean Image Export Hooks (Exposed to Main Process for capturePage)
// ============================================================================

window.__prepareForExport = function(transparentBg) {
  closeAllPopoversExcept(null);
  document.body.classList.add('exporting-image');

  if (!transparentBg) {
    document.body.style.backgroundColor = '#ffffff';
  } else {
    document.body.style.backgroundColor = 'transparent';
  }

  // Calculate paper bounding box with shadow margin
  const rect = elements.stickyNote.getBoundingClientRect();
  const margin = 16;
  const crop = {
    x: Math.max(0, Math.floor(rect.left - margin)),
    y: Math.max(0, Math.floor(rect.top - margin)),
    width: Math.min(window.innerWidth, Math.ceil(rect.width + margin * 2)),
    height: Math.min(window.innerHeight, Math.ceil(rect.height + margin * 2))
  };

  return { rect: crop };
};

window.__finishExport = function() {
  document.body.classList.remove('exporting-image');
  document.body.style.backgroundColor = 'transparent';
};
