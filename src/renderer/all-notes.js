// All Notes Search & List Module

let allNotes = [];
let filteredNotes = [];
let selectedIndex = 0;

const elements = {
  searchInput: document.getElementById('searchInput'),
  btnClearSearch: document.getElementById('btnClearSearch'),
  notesList: document.getElementById('notesList'),
  notesCount: document.getElementById('notesCount'),
  notesEmpty: document.getElementById('notesEmpty'),
  emptyTitle: document.getElementById('emptyTitle'),
  emptySubtitle: document.getElementById('emptySubtitle')
};

// Strip HTML tags to get pure plain text
function extractText(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').trim();
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHour / 24);

  if (diffSec < 45) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  const d = new Date(timestamp);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function parseNoteContent(content) {
  const plain = extractText(content);
  if (!plain) {
    return {
      title: 'Blank note',
      preview: 'No content yet...'
    };
  }

  const lines = plain.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const title = lines[0] || 'Blank note';
  const preview = lines.slice(1).join(' ') || title;
  return { title, preview };
}

function renderNotes() {
  const query = elements.searchInput.value.trim().toLowerCase();

  filteredNotes = allNotes.filter(note => {
    if (!query) return true;
    const text = extractText(note.content).toLowerCase();
    return text.includes(query);
  });

  // Sort notes by updatedAt / createdAt descending (most recent first)
  filteredNotes.sort((a, b) => {
    const timeA = a.updatedAt || a.createdAt || 0;
    const timeB = b.updatedAt || b.createdAt || 0;
    return timeB - timeA;
  });

  elements.notesCount.textContent = `${filteredNotes.length} note${filteredNotes.length === 1 ? '' : 's'}`;

  if (filteredNotes.length === 0) {
    elements.notesList.innerHTML = '';
    elements.notesEmpty.classList.remove('hidden');
    if (query) {
      elements.emptyTitle.textContent = `No notes matching "${query}"`;
      elements.emptySubtitle.textContent = 'Check spelling or try a different search word.';
    } else {
      elements.emptyTitle.textContent = 'No sticky notes yet';
      elements.emptySubtitle.textContent = 'Press Ctrl+Shift+N to create your first note!';
    }
    return;
  }

  elements.notesEmpty.classList.add('hidden');
  elements.notesList.innerHTML = '';

  if (selectedIndex >= filteredNotes.length) {
    selectedIndex = Math.max(0, filteredNotes.length - 1);
  }

  filteredNotes.forEach((note, index) => {
    const { title, preview } = parseNoteContent(note.content);
    const timeStr = formatRelativeTime(note.updatedAt || note.createdAt);
    const colorClass = `dot-${note.color || 'yellow'}`;

    const item = document.createElement('div');
    item.className = 'note-item';
    if (index === selectedIndex) {
      item.classList.add('is-selected');
    }
    item.setAttribute('data-id', note.id);

    // Badges
    const badgesHtml = [];
    if (note.isLocked) badgesHtml.push('<span class="mini-badge" title="Locked">🔒</span>');
    if (note.isPinned) badgesHtml.push('<span class="mini-badge" title="Always on Top">📌</span>');
    if (note.reminder && !note.reminder.fired) badgesHtml.push('<span class="mini-badge" title="Reminder Active">🔔</span>');
    if (note.isCollapsed) badgesHtml.push('<span class="mini-badge" title="Collapsed">➖</span>');

    item.innerHTML = `
      <div class="color-dot ${colorClass}" title="${note.color || 'yellow'}"></div>
      <div class="note-info">
        <div class="note-title-row">
          <span class="note-title">${escapeHtml(title)}</span>
          <span class="note-time">${timeStr}</span>
        </div>
        <div class="note-preview-row">
          <span class="note-preview">${escapeHtml(preview)}</span>
          <div class="note-badges">${badgesHtml.join('')}</div>
        </div>
      </div>
    `;

    item.addEventListener('click', () => {
      focusNote(note.id);
    });

    elements.notesList.appendChild(item);
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function focusNote(noteId) {
  if (window.stickyAPI && window.stickyAPI.focusNote) {
    window.stickyAPI.focusNote(noteId);
  }
}

// Search input live filtering
elements.searchInput.addEventListener('input', () => {
  const hasVal = elements.searchInput.value.length > 0;
  elements.btnClearSearch.classList.toggle('hidden', !hasVal);
  selectedIndex = 0;
  renderNotes();
});

elements.btnClearSearch.addEventListener('click', () => {
  elements.searchInput.value = '';
  elements.btnClearSearch.classList.add('hidden');
  elements.searchInput.focus();
  selectedIndex = 0;
  renderNotes();
});

// Keyboard navigation
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (elements.searchInput.value) {
      elements.searchInput.value = '';
      elements.btnClearSearch.classList.add('hidden');
      renderNotes();
    } else {
      window.close();
    }
    return;
  }

  if (e.key === 'ArrowDown') {
    if (filteredNotes.length > 0) {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % filteredNotes.length;
      updateSelection();
    }
  } else if (e.key === 'ArrowUp') {
    if (filteredNotes.length > 0) {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + filteredNotes.length) % filteredNotes.length;
      updateSelection();
    }
  } else if (e.key === 'Enter') {
    if (filteredNotes.length > 0 && filteredNotes[selectedIndex]) {
      e.preventDefault();
      focusNote(filteredNotes[selectedIndex].id);
    }
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    elements.searchInput.focus();
    elements.searchInput.select();
  }
});

function updateSelection() {
  const items = elements.notesList.querySelectorAll('.note-item');
  items.forEach((item, idx) => {
    item.classList.toggle('is-selected', idx === selectedIndex);
    if (idx === selectedIndex) {
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
}

// Initialize notes list
async function init() {
  if (window.stickyAPI && window.stickyAPI.getAllNotes) {
    try {
      allNotes = await window.stickyAPI.getAllNotes();
      renderNotes();
    } catch (err) {
      console.error('Failed to load all notes:', err);
    }
  }

  if (window.stickyAPI && window.stickyAPI.onAllNotesUpdated) {
    window.stickyAPI.onAllNotesUpdated((updatedList) => {
      allNotes = updatedList || [];
      renderNotes();
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
