const listEl = document.getElementById('trashList');
const emptyEl = document.getElementById('trashEmpty');
const btnEmptyTrash = document.getElementById('btnEmptyTrash');

function stripHtml(html) {
  if (!html) return 'Empty note';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const text = doc.body.textContent || '';
  return text.trim() || 'Empty note';
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Recently';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Deleted just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Deleted ${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Deleted ${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `Deleted ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return 'Deleted over 30 days ago';
}

function renderTrash(items) {
  if (!items || items.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    btnEmptyTrash.disabled = true;
    return;
  }

  emptyEl.classList.add('hidden');
  btnEmptyTrash.disabled = false;
  listEl.innerHTML = '';

  items.forEach(note => {
    const item = document.createElement('div');
    item.className = 'trash-item';
    item.dataset.id = note.id;

    const colorClass = `color-${note.color || 'yellow'}`;
    const previewText = stripHtml(note.content);
    const dateText = formatRelativeTime(note.trashedAt);

    item.innerHTML = `
      <div class="item-left">
        <div class="item-color-pill ${colorClass}" title="Theme: ${note.color}"></div>
        <div class="item-details">
          <div class="item-preview">${escapeHtml(previewText)}</div>
          <div class="item-meta">${dateText}</div>
        </div>
      </div>
      <div class="item-actions">
        <button class="btn-restore" title="Restore note">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          Restore
        </button>
        <button class="btn-delete-forever" title="Delete permanently">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          Delete
        </button>
      </div>
    `;

    // Restore click
    item.querySelector('.btn-restore').addEventListener('click', () => {
      window.stickyAPI.restoreFromTrash(note.id);
      item.remove();
      checkIfEmpty();
    });

    // Delete forever click
    item.querySelector('.btn-delete-forever').addEventListener('click', () => {
      if (confirm('Permanently delete this note? This cannot be undone.')) {
        window.stickyAPI.deleteForever(note.id);
        item.remove();
        checkIfEmpty();
      }
    });

    listEl.appendChild(item);
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function checkIfEmpty() {
  if (listEl.children.length === 0) {
    emptyEl.classList.remove('hidden');
    btnEmptyTrash.disabled = true;
  }
}

// Empty Trash confirmation
btnEmptyTrash.addEventListener('click', () => {
  if (confirm('Permanently delete ALL notes in Trash? This cannot be undone.')) {
    window.stickyAPI.emptyTrash();
    renderTrash([]);
  }
});

// Load on start
window.stickyAPI.getTrash().then(items => {
  renderTrash(items);
});

// Real-time updates
if (window.stickyAPI.onTrashUpdated) {
  window.stickyAPI.onTrashUpdated(items => {
    renderTrash(items);
  });
}
