// ── Drag and Drop for Folders ──────────────────────────────────────────────
function setupDragAndDrop() {
  // Make folders drop targets
  const folders = document.querySelectorAll('.folder-item');
  folders.forEach(folder => {
    folder.addEventListener('dragover', handleDragOver);
    folder.addEventListener('drop', handleDrop);
    folder.addEventListener('dragleave', handleDragLeave);
  });

  // Make the welcome grid a drop target for open folders
  const welcomeGrid = document.getElementById('welcomeIconsGrid');
  if (welcomeGrid) {
    welcomeGrid.addEventListener('dragover', handleGridDragOver);
    welcomeGrid.addEventListener('drop', handleGridDrop);
    welcomeGrid.addEventListener('dragleave', handleGridDragLeave);
  }

  // Also make the folder bar a drop target (convenient drop zone)
  const folderBar = document.getElementById('folderBar');
  if (folderBar) {
    folderBar.addEventListener('dragover', handleGridDragOver);
    folderBar.addEventListener('drop', handleGridDrop);
    folderBar.addEventListener('dragleave', handleGridDragLeave);
  }

  // Setup drag and drop for items inside folders
  setupDragAndDropForItems();
}

// ── Global body drop zone (catch URL drops anywhere on the page) ──────────
(function setupBodyUrlDrop() {
  let _bodyDragActive = false;
  let _dropIndicator = null;

  function _getDropIndicator() {
    if (!_dropIndicator) {
      _dropIndicator = document.createElement('div');
      _dropIndicator.id = 'bodyDropIndicator';
      _dropIndicator.style.cssText = `
        position: fixed; inset: 0; z-index: 99990; pointer-events: none;
        border: 3px dashed var(--accent, #e50914);
        border-radius: 12px; margin: 8px;
        background: rgba(229,9,20,0.06);
        display: flex; align-items: center; justify-content: center;
        opacity: 0; transition: opacity 0.2s ease;
      `;
      _dropIndicator.innerHTML = `
        <div style="background:rgba(0,0,0,0.75);color:#fff;padding:18px 32px;
          border-radius:12px;font-size:20px;font-family:Cairo,sans-serif;
          text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.4);">
          🔗 أفلت الرابط هنا لإضافته
        </div>`;
      document.body.appendChild(_dropIndicator);
    }
    return _dropIndicator;
  }

  function _isUrlDrag(e) {
    const types = Array.from(e.dataTransfer.types || []);
    return types.some(t => ['text/uri-list','URL','text/x-moz-url','text/plain'].includes(t));
  }

  document.addEventListener('dragover', function(e) {
    if (!_isUrlDrag(e)) return;
    // Let specific targets (folders, grid) handle their own visual feedback
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!_bodyDragActive) {
      _bodyDragActive = true;
      const ind = _getDropIndicator();
      ind.style.pointerEvents = 'none';
      requestAnimationFrame(() => { ind.style.opacity = '1'; });
    }
  });

  document.addEventListener('dragleave', function(e) {
    // Only hide when leaving the window entirely
    if (e.relatedTarget === null || e.relatedTarget === document.documentElement) {
      _bodyDragActive = false;
      const ind = _getDropIndicator();
      ind.style.opacity = '0';
    }
  });

  document.addEventListener('drop', function(e) {
    _bodyDragActive = false;
    const ind = _getDropIndicator();
    ind.style.opacity = '0';

    // If a more specific handler already handled this drop, skip
    if (e.defaultPrevented) return;

    // Extract URL from drop data
    let url = e.dataTransfer.getData('text/uri-list')
            || e.dataTransfer.getData('URL')
            || e.dataTransfer.getData('text/x-moz-url')
            || e.dataTransfer.getData('text/plain');

    if (!url) return;
    url = url.split('\n')[0].trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('ftp://')) return;

    e.preventDefault();
    openAddModalWithUrl(url, null);
  });
})();

function setupDragAndDropForItems() {
  // Drag and drop for items is handled in app.js
}

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  const folder = e.target.closest('.folder-item');
  if (folder) {
    folder.style.background = 'rgba(229, 9, 20, 0.15)';
    folder.style.transform = 'scale(1.05)';
    folder.style.transition = 'all 0.2s ease';
  }
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  const folder = e.target.closest('.folder-item');
  if (folder) {
    folder.style.background = '';
    folder.style.transform = '';
  }
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();

  const folder = e.target.closest('.folder-item');
  if (!folder) return;

  // Reset folder style
  folder.style.background = '';
  folder.style.transform = '';

  // Get dropped data — try multiple formats
  let url = e.dataTransfer.getData('text/uri-list')
          || e.dataTransfer.getData('URL')
          || e.dataTransfer.getData('text/x-moz-url')
          || e.dataTransfer.getData('text/plain');

  if (!url) { showToast('⚠️ لم يتم العثور على رابط صالح'); return; }

  url = url.split('\n')[0].trim();
  if (!url) { showToast('⚠️ الرابط فارغ'); return; }

  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('ftp://')) {
    showToast('⚠️ الرابط غير صالح — تأكد من سحب رابط URL');
    return;
  }

  // Get folder ID from folder's onclick attribute
  const folderId = folder.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] || null;

  // Open add modal with URL pre-filled
  openAddModalWithUrl(url, folderId);
}

// Handle drag over grid / folder-bar when a folder is open
function handleGridDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'copy';

  // Only show highlight when a folder is open
  if (!_currentCategory || _currentCategory === 'all') return;

  const welcomeGrid = document.getElementById('welcomeIconsGrid');
  if (welcomeGrid) {
    welcomeGrid.style.outline = '2px dashed var(--accent)';
    welcomeGrid.style.outlineOffset = '-4px';
    welcomeGrid.style.background = 'rgba(229, 9, 20, 0.07)';
    welcomeGrid.style.transition = 'all 0.2s ease';
  }
  const folderBar = document.getElementById('folderBar');
  if (folderBar) {
    folderBar.style.borderColor = 'var(--accent)';
    folderBar.style.background = 'rgba(229, 9, 20, 0.1)';
  }
}

function handleGridDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  // Only reset if leaving the grid area entirely
  const welcomeGrid = document.getElementById('welcomeIconsGrid');
  if (welcomeGrid) {
    welcomeGrid.style.outline = '';
    welcomeGrid.style.background = '';
  }
  const folderBar = document.getElementById('folderBar');
  if (folderBar) {
    folderBar.style.borderColor = '';
    folderBar.style.background = '';
  }
}

// Handle drop on grid / folder-bar when a folder is open
function handleGridDrop(e) {
  e.preventDefault();
  e.stopPropagation();

  // Reset visual feedback
  const welcomeGrid = document.getElementById('welcomeIconsGrid');
  if (welcomeGrid) { welcomeGrid.style.outline = ''; welcomeGrid.style.background = ''; }
  const folderBar = document.getElementById('folderBar');
  if (folderBar) { folderBar.style.borderColor = ''; folderBar.style.background = ''; }

  // Must be inside an open folder
  const folderId = _currentCategory;
  if (!folderId || folderId === 'all') {
    showToast('⚠️ يرجى فتح مجلد أولاً ثم أعد السحب');
    return;
  }

  // Get dropped data - try multiple formats (browser drag, OS drag)
  let url = e.dataTransfer.getData('text/uri-list')
         || e.dataTransfer.getData('URL')
         || e.dataTransfer.getData('text/x-moz-url')
         || e.dataTransfer.getData('text/plain');

  if (!url) { showToast('⚠️ لم يتم العثور على رابط صالح'); return; }

  // text/x-moz-url format is "url\ntitle" — take first line
  url = url.split('\n')[0].trim();
  if (!url) { showToast('⚠️ الرابط فارغ'); return; }

  // Ignore if this looks like an internal item ID (not a URL)
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('ftp://')) {
    showToast('⚠️ الرابط غير صالح — تأكد من سحب رابط URL');
    return;
  }

  // Open add modal with URL pre-filled
  openAddModalWithUrl(url, folderId);
}

// ── Open Add Modal with a pre-filled URL (called on drag & drop) ──────────
function openAddModalWithUrl(url, folderId) {
  const modalOverlay = document.getElementById('modalOverlay');
  const isModalOpen = modalOverlay && !modalOverlay.classList.contains('hidden');

  // ── Modal already open → fill background image field ──────────────────
  if (isModalOpen) {
    const bgField = document.getElementById('siteBgImage');
    if (bgField) {
      bgField.value = url;
      // Briefly highlight the field so the user notices the change
      bgField.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
      bgField.style.boxShadow = '0 0 0 3px rgba(229,9,20,0.5)';
      bgField.style.borderColor = 'var(--accent, #e50914)';
      setTimeout(() => {
        bgField.style.boxShadow = '';
        bgField.style.borderColor = '';
      }, 1500);
      bgField.focus();
      showToast('🖼️ تم إضافة الرابط كصورة خلفية');
    }
    return;
  }

  // ── Modal closed → open it and fill the site URL field ────────────────
  // Derive a display name from the URL hostname
  let autoName = '';
  try {
    const urlObj = new URL(url);
    autoName = urlObj.hostname.replace(/^www\./, '');
    autoName = autoName.charAt(0).toUpperCase() + autoName.slice(1);
  } catch (_) { /* invalid URL — leave name empty */ }

  // Open the standard add modal (resets all fields)
  openAddModal();

  // Pre-fill URL field
  document.getElementById('siteUrl').value = url;

  // Pre-fill name field
  const nameEl = document.getElementById('siteName');
  if (!nameEl.value && autoName) nameEl.value = autoName;

  // If a specific folder was targeted, select it
  if (folderId) {
    const categorySelect = document.getElementById('siteCategory');
    if (categorySelect) categorySelect.value = folderId;
  }

  // Focus the name field so the user can adjust it quickly
  setTimeout(() => nameEl.focus(), 80);
}

async function fetchPageTitle(url, folderId) {
  showToast('⏳ جاري جلب معلومات الصفحة...');

  try {
    // Try to fetch the page
    const response = await fetch(url, {
      method: 'GET',
      mode: 'no-cors'
    });

    // Since we can't access the actual content due to CORS,
    // we'll use the URL to generate a name
    const urlObj = new URL(url);
    let name = urlObj.hostname;

    // Remove www. prefix if present
    if (name.startsWith('www.')) {
      name = name.substring(4);
    }

    // Capitalize first letter
    name = name.charAt(0).toUpperCase() + name.slice(1);

    // Add the site to the folder
    addSiteToFolder(url, name, folderId);
  } catch (error) {
    console.error('Error fetching page:', error);
    // Fallback: use URL as name
    const urlObj = new URL(url);
    let name = urlObj.hostname;
    if (name.startsWith('www.')) {
      name = name.substring(4);
    }
    name = name.charAt(0).toUpperCase() + name.slice(1);
    addSiteToFolder(url, name, folderId);
  }
}

function addSiteToFolder(url, name, folderId) {
  const id = 'site_' + Date.now();
  const color = '#' + Math.floor(Math.random() * 16777215).toString(16);

  // ── Determine position based on current sort direction ──
  // 'newest' → appear LAST  (highest order value)
  // 'oldest' → appear FIRST (lowest order value, shift others down)
  const catItems = shortcuts
    .filter(s => s.categoryId === folderId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  let newOrder;
  if (_sortOrder === 'oldest') {
    // Insert at the beginning: bump all existing items' order by 1
    catItems.forEach(item => { item.order = (item.order ?? 0) + 1; });
    newOrder = 0;
  } else {
    // Insert at the end: one step after the last item
    newOrder = catItems.length > 0 ? (catItems[catItems.length - 1].order ?? 0) + 1 : 0;
  }

  const newSite = {
    id,
    name,
    url,
    color,
    categoryId: folderId,
    image: null,
    bgImage: null,
    emoji: name.charAt(0).toUpperCase(),
    order: newOrder
  };

  shortcuts.push(newSite);
  saveShortcuts();
  renderIcons();
  renderWelcomeGrid();

  const pos = _sortOrder === 'oldest' ? 'أول' : 'آخر';
  showToast(`✅ تمت إضافة "${name}" في ${pos} المجلد`);
}

// ── Drag and Drop for Items Inside Folders ──────────────────────────────
// Handled in app.js

// Initialize drag and drop when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setupDragAndDrop();
});

// Also setup drag and drop after renderWelcomeGrid is called
const originalRenderWelcomeGrid = window.renderWelcomeGrid;
if (originalRenderWelcomeGrid) {
  window.renderWelcomeGrid = function() {
    originalRenderWelcomeGrid.apply(this, arguments);
    setupDragAndDrop();
  };
}