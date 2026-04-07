/* ====================================================
   🎬 بوابة الأفلام — app.js
   ==================================================== */

// ── Default shortcuts seeded on first load ──────────────────────────
const DEFAULT_SHORTCUTS = [
  {
    id: 'netflix',
    name: 'Netflix',
    url: 'https://www.netflix.com',
    color: '#e50914',
    image: null,
    emoji: 'N'
  },
  {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com/feed/storefront',
    color: '#ff0000',
    image: null,
    emoji: 'Y'
  },
  {
    id: 'prime',
    name: 'Prime Video',
    url: 'https://www.primevideo.com',
    color: '#00a8e0',
    image: null,
    emoji: 'P'
  },
  {
    id: 'disney',
    name: 'Disney+',
    url: 'https://www.disneyplus.com',
    color: '#0b3d91',
    image: null,
    emoji: 'D'
  },
  {
    id: 'shahid',
    name: 'شاهد',
    url: 'https://shahid.mbc.net',
    color: '#be2026',
    image: null,
    emoji: 'ش'
  },
  {
    id: 'cimaclub',
    name: 'سيما كلوب',
    url: 'https://cimaclub.com.ar',
    color: '#f5a623',
    image: null,
    emoji: 'س'
  },
  {
    id: 'egydead',
    name: 'ايجي ديد',
    url: 'https://egydead.live',
    color: '#1db954',
    image: null,
    emoji: 'ا'
  },
  {
    id: 'watch',
    name: 'Watch it',
    url: 'https://watchit.ae',
    color: '#7b2d8b',
    image: null,
    emoji: 'W'
  }
];

// ── State ────────────────────────────────────────────────────────────
let shortcuts = [];
let categories = [{ id: 'general', name: 'عام' }];
let _currentCategory = 'all';
let _navigationStack = ['all']; // Track category history for back button
let editingId = null;
let ctxTargetId = null;
let currentIconImage = null;
let _sortOrder = 'newest'; // 'newest' or 'oldest' - default to newest first
let _currentPage = 1; // Current page for pagination
const ITEMS_PER_PAGE = 20; // Items per page - reduced for better performance

// ── Data loading strategy ─────────────────────────────────────────────
// Priority: localStorage / IndexedDB quick snapshot > initial bundle file > full chunk refresh
const INITIAL_CHUNK_URLS = [
  './database_chunks/initial_load.json',
  './database_chunks/data1.json'
];

// Helper to check if we are on a mobile device
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

function getProgressElements() {
  return {
    wrapper: document.getElementById('updateProgressWrapper'),
    label: document.getElementById('updateProgressLabel'),
    fill: document.getElementById('updateProgressFill')
  };
}

function updateBackgroundProgress(loaded, description) {
  const { wrapper, label, fill } = getProgressElements();
  if (!wrapper || !label || !fill) return;
  wrapper.classList.remove('hidden');
  label.textContent = description || `تحميل البيانات في الخلفية... جزء ${loaded}`;
  fill.style.width = `${Math.min(98, loaded * 18)}%`;
}

function hideBackgroundProgress() {
  const { wrapper, fill } = getProgressElements();
  if (!wrapper || !fill) return;
  fill.style.width = '100%';
  setTimeout(() => wrapper.classList.add('hidden'), 600);
}

async function loadJsonFile(path) {
  const res = await fetch(`${path}?_=${Date.now()}`);
  if (!res.ok) return null;
  return await res.json();
}

async function loadDataFromChunks(progressCallback = null) {
  let combinedStr = '';
  let chunkCount = 0;

  while (true) {
    const fileName = `./database_chunks/data${chunkCount + 1}.json`;
    try {
      const res = await fetch(`${fileName}?_=${Date.now()}`);
      if (!res.ok) break;
      combinedStr += await res.text();
      chunkCount += 1;
      if (typeof progressCallback === 'function') progressCallback(chunkCount, fileName);
      if (chunkCount % 2 === 0 && !progressCallback) showToast(`⏳ جاري تحميل الجزء ${chunkCount}...`);
    } catch (e) {
      break;
    }
  }

  if (chunkCount > 0 && combinedStr) {
    return JSON.parse(combinedStr);
  }

  try {
    const fallback = await loadJsonFile('./data.json');
    if (fallback) return fallback;
  } catch (ignore) {}
  return null;
}

async function loadInitialDataFromChunks() {
  for (const filePath of INITIAL_CHUNK_URLS) {
    try {
      const payload = await loadJsonFile(filePath);
      if (payload && payload.shortcuts) return payload;
    } catch (e) { }
  }
  return null;
}

async function loadQuickSnapshot() {
  try {
    const lsShortcuts = localStorage.getItem('rm_shortcuts');
    if (lsShortcuts) {
      const parsed = JSON.parse(lsShortcuts);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const parsedCats = JSON.parse(localStorage.getItem('rm_categories') || '[]');
        return {
          shortcuts: parsed,
          categories: Array.isArray(parsedCats) ? parsedCats : categories
        };
      }
    }
  } catch (e) {}

  if (typeof IPTV_DB !== 'undefined') {
    try {
      const dbShortcuts = await IPTV_DB.get('rm_shortcuts') || [];
      if (Array.isArray(dbShortcuts) && dbShortcuts.length > 0) {
        const dbCategories = await IPTV_DB.get('rm_categories') || [];
        return {
          shortcuts: dbShortcuts,
          categories: Array.isArray(dbCategories) ? dbCategories : categories
        };
      }
    } catch (e) { console.warn('Failed to read quick snapshot from IndexedDB', e); }
  }

  return null;
}

async function backgroundRefreshFromChunks(preserveLocal = false, showToasts = true) {
  if (showToasts) showToast('⏳ جاري تحديث البيانات في الخلفية...');
  updateBackgroundProgress(0, 'بدء تحديث البيانات في الخلفية...');

  const disk = await loadDataFromChunks((loaded, fileName) => {
    updateBackgroundProgress(loaded, `تحميل ${fileName} (${loaded} جزء)`);
  });

  if (disk && (disk.shortcuts || disk.iptv_sources)) {
    if (Array.isArray(disk.shortcuts)) {
      if (preserveLocal && shortcuts.length > 0) {
        const existingIds = new Set(shortcuts.map(s => s.id));
        const mergedShortcuts = [...shortcuts];
        disk.shortcuts.forEach(item => {
          if (!existingIds.has(item.id)) mergedShortcuts.push(item);
        });
        shortcuts = mergedShortcuts;
      } else {
        shortcuts = disk.shortcuts;
      }
    }

    if (Array.isArray(disk.categories)) {
      if (preserveLocal && categories.length > 0) {
        const existingCatIds = new Set(categories.map(c => c.id));
        const mergedCategories = [...categories];
        disk.categories.forEach(cat => {
          if (!existingCatIds.has(cat.id)) mergedCategories.push(cat);
        });
        categories = mergedCategories;
      } else {
        categories = disk.categories;
      }
    }

    if (Array.isArray(disk.shortcuts) && !shortcuts.some(s => s.categoryId === 'favorites_folder')) {
      const chunkFavs = await loadFavoritesFromChunks();
      shortcuts = [...shortcuts.filter(s => s.categoryId !== 'favorites_folder' && s.categoryId !== 'favorites_folder_2'), ...chunkFavs.favs1, ...chunkFavs.favs2];
    }

    if (disk.iptv_sources && typeof IPTV_DB !== 'undefined') {
      await IPTV_DB.set('rm_iptv', disk.iptv_sources);
      if (disk.iptv_playlists) await IPTV_DB.set('rm_iptv_playlists', disk.iptv_playlists);
      localStorage.setItem('rm_iptv', 'USE_IDB');
      localStorage.setItem('rm_iptv_playlists', 'USE_IDB');
      if (disk.iptv_favs) localStorage.setItem('rm_iptv_favs', JSON.stringify(disk.iptv_favs));
      if (disk.iptv_customCatOrder) localStorage.setItem('rm_iptv_cat_order', JSON.stringify(disk.iptv_customCatOrder));
      if (disk.iptv_playerChoice) localStorage.setItem('rm_iptv_player', disk.iptv_playerChoice);

      if (typeof IPTV !== 'undefined') {
        IPTV.sources = disk.iptv_sources;
        if (disk.iptv_favs) IPTV.favorites = disk.iptv_favs;
        if (disk.iptv_playlists) IPTV.playlists = disk.iptv_playlists;
        if (disk.iptv_customCatOrder) IPTV.customCatOrder = disk.iptv_customCatOrder;
        if (disk.iptv_playerChoice) IPTV.playerChoice = disk.iptv_playerChoice;
        if (typeof iptvBuild === 'function') iptvBuild();
      }
    }

    const uniqueCats = [];
    const catMap = new Map();
    categories.forEach(c => {
      if (!catMap.has(c.id)) {
        catMap.set(c.id, true);
        uniqueCats.push(c);
      }
    });
    categories = uniqueCats;

    shortcuts.forEach(s => { if (!s.categoryId) s.categoryId = 'general'; });
    
    // Ensure all shortcuts have order property
    ensureShortcutOrders();

    await saveShortcuts();
    renderCategorySelector();
    renderIcons();
    renderWelcomeGrid();
    updateBackBtnVisibility();
    if (showToasts) showToast('✅ تم تحديث البيانات في الخلفية بنجاح');
  } else if (showToasts) {
    showToast('❌ فشل في تحديث البيانات في الخلفية');
  }

  hideBackgroundProgress();
}

// ── Favorites File Logic ──────────────────────────────────────────────
async function loadFavoritesFromFile() {
  try {
    const res = await fetch('./favourit.json?_=' + Date.now());
    if (res.ok) {
      const favs = await res.json();
      if (Array.isArray(favs)) {
        return favs.map(f => ({ ...f, categoryId: 'favorites_folder', isExternalFav: true }));
      }
    }
  } catch (e) { console.warn("favourit.json not found."); }
  return [];
}

async function loadFavoritesFromChunks() {
  let favs1 = [];
  let favs2 = [];

  try {
    const fav1Res = await fetch('./database_chunks/favourit.json?_=' + Date.now());
    if (fav1Res.ok) {
      const fav1Data = await fav1Res.json();
      if (Array.isArray(fav1Data)) {
        favs1 = fav1Data.map(f => ({ ...f, categoryId: 'favorites_folder', isExternalFav: true }));
      }
    }
  } catch (e) { console.warn("Failed to load favourit.json from chunks:", e); }

  try {
    const fav2Res = await fetch('./database_chunks/favourit2.json?_=' + Date.now());
    if (fav2Res.ok) {
      const fav2Data = await fav2Res.json();
      if (Array.isArray(fav2Data)) {
        favs2 = fav2Data.map(f => ({ ...f, categoryId: 'favorites_folder_2', isExternalFav: true }));
      }
    }
  } catch (e) { console.warn("Failed to load favourit2.json from chunks:", e); }

  return { favs1, favs2 };
}

async function loadFavorites2FromFile() {
  try {
    const res = await fetch('./favourit2.json?_=' + Date.now());
    if (res.ok) {
      const favs = await res.json();
      if (Array.isArray(favs)) {
        return favs.map(f => ({ ...f, categoryId: 'favorites_folder_2', isExternalFav: true }));
      }
    }
  } catch (e) { console.warn("favourit2.json not found."); }
  return [];
}

async function exportFavoritesOnly() {
  const favs = shortcuts.filter(s => s.categoryId === 'favorites_folder');
  if (favs.length === 0) {
    showToast('⚠️ لا توجد مواقع في مجلد المفضلة لتصديرها');
    return;
  }
  const cleanFavs = favs.map(({ isExternalFav, ...rest }) => rest);
  const blob = new Blob([JSON.stringify(cleanFavs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'favourit.json'; a.click();
  URL.revokeObjectURL(url);
  showToast('✅ تم تصدير ملف favourit.json بنجاح');
}

async function exportFavorites2Only() {
  const favs = shortcuts.filter(s => s.categoryId === 'favorites_folder_2');
  if (favs.length === 0) {
    showToast('⚠️ لا توجد مواقع في مجلد المفضلة 2 لتصديرها');
    return;
  }
  const cleanFavs = favs.map(({ isExternalFav, ...rest }) => rest);
  const blob = new Blob([JSON.stringify(cleanFavs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'favourit2.json'; a.click();
  URL.revokeObjectURL(url);
  showToast('✅ تم تصدير ملف favourit2.json بنجاح');
}

async function initApp() {
  try {
    // Load user preferences
    _sortOrder = localStorage.getItem('rm_sort_order') || 'newest';

    // 1. Load system categories first
    if (!categories.some(c => c.id === 'favorites_folder')) {
      categories.push({ id: 'favorites_folder', name: 'المفضلة', isSystem: true });
    }
    if (!categories.some(c => c.id === 'favorites_folder_2')) {
      categories.push({ id: 'favorites_folder_2', name: 'مفضلة 2', isSystem: true });
    }

    // 2. Fast initial load from browser storage or IndexedDB
    const quickSnapshot = await loadQuickSnapshot();
    const preserveLocal = Boolean(quickSnapshot && Array.isArray(quickSnapshot.shortcuts) && quickSnapshot.shortcuts.length > 0);

    if (preserveLocal) {
      shortcuts = quickSnapshot.shortcuts;
      if (Array.isArray(quickSnapshot.categories) && quickSnapshot.categories.length > 0) {
        quickSnapshot.categories.forEach(c => {
          if (!categories.some(exist => exist.id === c.id)) categories.push(c);
        });
      }
    }

    const dbHasFavs1 = shortcuts.some(s => s.categoryId === 'favorites_folder');
    const dbHasFavs2 = shortcuts.some(s => s.categoryId === 'favorites_folder_2');

    const externalFavs1 = dbHasFavs1 ? [] : await loadFavoritesFromFile();
    const externalFavs2 = dbHasFavs2 ? [] : await loadFavorites2FromFile();

    if (!dbHasFavs1) shortcuts = shortcuts.filter(s => s.categoryId !== 'favorites_folder');
    if (!dbHasFavs2) shortcuts = shortcuts.filter(s => s.categoryId !== 'favorites_folder_2');
    shortcuts = [...shortcuts, ...externalFavs1, ...externalFavs2];

    // 3. Load an initial bundle file if no local snapshot is available
    if (shortcuts.length === 0) {
      const initialPayload = await loadInitialDataFromChunks();
      if (initialPayload) {
        shortcuts = initialPayload.shortcuts || DEFAULT_SHORTCUTS.map(s => ({ ...s }));
        if (Array.isArray(initialPayload.categories)) {
          initialPayload.categories.forEach(c => {
            if (!categories.some(exist => exist.id === c.id)) categories.push(c);
          });
        }

        const chunkFavs = await loadFavoritesFromChunks();
        shortcuts = shortcuts.filter(s => s.categoryId !== 'favorites_folder' && s.categoryId !== 'favorites_folder_2');
        shortcuts = [...shortcuts, ...chunkFavs.favs1, ...chunkFavs.favs2];
      }
    }

    // 4. Fallback to DEFAULT_SHORTCUTS if nothing loaded
    if (shortcuts.length === 0) {
      shortcuts = DEFAULT_SHORTCUTS.map(s => ({ ...s }));
    }

    // Final safety
    if (shortcuts.length === 0) shortcuts = DEFAULT_SHORTCUTS.map(s => ({ ...s }));
    if (!categories.some(c => c.id === 'general')) categories.push({ id: 'general', name: 'عام' });

    // Clean up categories
    const uniqueCats = [];
    const catMap = new Map();
    categories.forEach(c => {
      if (!catMap.has(c.id)) {
        catMap.set(c.id, true);
        uniqueCats.push(c);
      }
    });
    categories = uniqueCats;

    shortcuts.forEach(s => { if (!s.categoryId) s.categoryId = 'general'; });

    renderCategorySelector();
    renderIcons();
    renderWelcomeGrid();
    updateBackBtnVisibility();
    updateSortOrderButton(); // Update sort order button text
    setupEventListeners();
    _updateGlobalModeUI();

    const loader = document.getElementById('globalLoader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 600);
    }

    // Refresh full data in the background after the first page is visible
    backgroundRefreshFromChunks(preserveLocal, false).catch(err => {
      console.warn('Background refresh failed:', err);
    });
  } catch (err) {
    console.error("Critical Init Error:", err);
    showToast('⚠️ خطأ في تحميل البيانات');
  }
}

function setupEventListeners() {
  document.addEventListener('click', (e) => {
    // Hide context menu
    if (!e.target.closest('.icon-card') && !e.target.closest('#colorPickerModal')) closeContextMenu();
    // Hide settings menu
    const sm = document.getElementById('settingsMenu');
    if (sm && !sm.classList.contains('hidden') && !e.target.closest('#settingsMenu') && !e.target.closest('#settingsBtn')) {
      sm.classList.add('hidden');
    }
    // Hide category dropdown
    const cm = document.getElementById('categorySelectMenu');
    if (cm && !cm.classList.contains('hidden') && !e.target.closest('.category-selector-wrapper')) {
      cm.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!document.getElementById('modalOverlay').classList.contains('hidden')) closeModal();
      if (!document.getElementById('manageCategoriesModal').classList.contains('hidden')) closeManageCategoriesModal();
    }
  });

  const siteColorInput = document.getElementById('siteColor');
  if (siteColorInput) {
    siteColorInput.addEventListener('input', function () {
      const previewText = document.getElementById('colorPreviewText');
      if (previewText) previewText.textContent = this.value;
    });
  }

  // Setup drag and drop for folders
  setupDragAndDrop();
}

// ── Drag and Drop for Folders ──────────────────────────────────────────────
function setupDragAndDrop() {
  // Make folders drop targets
  const folders = document.querySelectorAll('.folder-item');
  folders.forEach(folder => {
    folder.addEventListener('dragover', handleDragOver);
    folder.addEventListener('drop', handleDrop);
    folder.addEventListener('dragleave', handleDragLeave);
  });
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

  // Get dropped data
  const data = e.dataTransfer.getData('text/uri-list');
  if (!data) {
    showToast('⚠️ لم يتم العثور على رابط صالح');
    return;
  }

  // Extract URL
  const url = data.trim();
  if (!url) {
    showToast('⚠️ الرابط فارغ');
    return;
  }

  // Get folder ID from the folder's onclick attribute
  const folderId = folder.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
  if (!folderId) {
    showToast('⚠️ لم يتم تحديد المجلد');
    return;
  }

  // Try to fetch page title
  fetchPageTitle(url, folderId);
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
  const color = '#' + Math.floor(Math.random()*16777215).toString(16);

  const newSite = {
    id,
    name,
    url,
    color,
    categoryId: folderId,
    image: null,
    bgImage: null,
    emoji: name.charAt(0).toUpperCase()
  };

  shortcuts.push(newSite);
  saveShortcuts();
  renderIcons();
  renderWelcomeGrid();

  showToast(`✅ تم إضافة "${name}" إلى المجلد`);
}

window.addEventListener('load', () => {
  initApp();
}); // Use 'load' to ensure all assets are ready for mobile

async function forceReloadFromChunks() {
  await backgroundRefreshFromChunks(false, true);
}

// ── Persistence ───────────────────────────────────────────────────────
async function saveShortcuts() {
  if (typeof IPTV_DB !== 'undefined') {
    await IPTV_DB.set('rm_shortcuts', shortcuts);
    await IPTV_DB.set('rm_categories', categories);
  }
  // Keep a lightweight version in localStorage for quick check, but without large images
  try {
    const lightShortcuts = shortcuts.map(s => ({ ...s, image: s.image ? 'IDB_STORED' : null }));
    localStorage.setItem('rm_shortcuts', JSON.stringify(lightShortcuts));
    localStorage.setItem('rm_categories', JSON.stringify(categories));
  } catch (e) {
    console.warn("LocalStorage save failed, relying on IndexedDB only.");
  }
}

// ── Ensure shortcuts have order property ──────────────────────────────
function ensureShortcutOrders() {
  // Group shortcuts by category
  const categoryGroups = {};
  shortcuts.forEach(s => {
    if (!categoryGroups[s.categoryId]) categoryGroups[s.categoryId] = [];
    categoryGroups[s.categoryId].push(s);
  });

  // For each category, ensure order property exists and is sequential
  Object.keys(categoryGroups).forEach(catId => {
    const catShortcuts = categoryGroups[catId];
    // Sort by existing order if available, otherwise by creation time (id)
    catShortcuts.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
      return a.id.localeCompare(b.id);
    });
    
    // Assign sequential orders
    catShortcuts.forEach((s, index) => {
      s.order = index;
    });
  });
}

// ── Export / Import data.json ─────────────────────────────────────────
async function exportData() {
  showToast('⏳ جاري تجميع كل البيانات والتقسيم...');

  // Ensure shortcuts and categories are current
  const currentShortcuts = Array.isArray(shortcuts) && shortcuts.length > 0 ? shortcuts : JSON.parse(localStorage.getItem('rm_shortcuts') || '[]');
  const currentCategories = Array.isArray(categories) && categories.length > 0 ? categories : JSON.parse(localStorage.getItem('rm_categories') || '[{"id":"general","name":"عام"}]');

  const payload = {
    _comment: 'ملف بيانات بوابة الأفلام — ضعه في مجلد database_chunks عند الرفع على الاستضافة',
    version: 2,
    exported: new Date().toISOString(),
    shortcuts: currentShortcuts,
    categories: currentCategories,
  };

  // ── جمع بيانات IPTV ──
  let iptvSources = [], iptvFavs = [], iptvPlaylists = [], iptvCustomCatOrder = [], iptvPlayerChoice = 'browser';

  // 1. Get current in-memory state if IPTV is loaded
  if (typeof IPTV !== 'undefined' && IPTV.initialized) {
    iptvSources        = IPTV.sources        || [];
    iptvFavs           = IPTV.favorites      || [];
    iptvPlaylists      = IPTV.playlists      || [];
    iptvCustomCatOrder = IPTV.customCatOrder || [];
    iptvPlayerChoice   = IPTV.playerChoice   || 'browser';
  }

  // 2. Supplement/Fallback from IndexedDB
  if (typeof IPTV_DB !== 'undefined') {
    const idbSources   = await IPTV_DB.get('rm_iptv');
    const idbPlaylists = await IPTV_DB.get('rm_iptv_playlists');
    
    // Take from DB if memory is empty or if DB has more sources
    if (Array.isArray(idbSources) && idbSources.length > iptvSources.length) {
      iptvSources = idbSources;
    }
    if (Array.isArray(idbPlaylists) && idbPlaylists.length > iptvPlaylists.length) {
      iptvPlaylists = idbPlaylists;
    }
  }

  // 3. Supplement/Fallback from localStorage
  try {
    const lsFavs = JSON.parse(localStorage.getItem('rm_iptv_favs') || '[]');
    if (lsFavs.length > iptvFavs.length) iptvFavs = lsFavs;

    const lsCatOrder = JSON.parse(localStorage.getItem('rm_iptv_cat_order') || '[]');
    if (lsCatOrder.length > iptvCustomCatOrder.length) iptvCustomCatOrder = lsCatOrder;

    const lsPlayer = localStorage.getItem('rm_iptv_player');
    if (lsPlayer) iptvPlayerChoice = lsPlayer;

    const lsSourcesRaw = localStorage.getItem('rm_iptv');
    if (lsSourcesRaw && lsSourcesRaw !== 'USE_IDB') {
      const lsSources = JSON.parse(lsSourcesRaw);
      if (Array.isArray(lsSources) && lsSources.length > iptvSources.length) {
        iptvSources = lsSources;
      }
    }
  } catch (e) { console.error("Export supplement error:", e); }

  payload.iptv_sources        = iptvSources;
  payload.iptv_favs           = iptvFavs;
  payload.iptv_playlists      = iptvPlaylists;
  payload.iptv_customCatOrder = iptvCustomCatOrder;
  payload.iptv_playerChoice   = iptvPlayerChoice;

  const fullDataStr = JSON.stringify(payload);
  const CHUNK_SIZE = 19 * 1024 * 1024; // 19MB per chunk
  const chunks = [];
  
  for (let i = 0; i < fullDataStr.length; i += CHUNK_SIZE) {
    chunks.push(fullDataStr.substring(i, i + CHUNK_SIZE));
  }

  try {
    const zip = new JSZip();
    const dbFolder = zip.folder("database_chunks");

    const initialPayload = {
      version: payload.version,
      exported: payload.exported,
      shortcuts: currentShortcuts.slice(0, 50),
      categories: currentCategories,
      _comment: 'هذا الملف للتحميل الأولي السريع من مجلد database_chunks'
    };
    dbFolder.file('initial_load.json', JSON.stringify(initialPayload, null, 2));

    const favouritesPayload = currentShortcuts
      .filter(s => s.categoryId === 'favorites_folder')
      .map(({ isExternalFav, ...rest }) => rest);
    const favourites2Payload = currentShortcuts
      .filter(s => s.categoryId === 'favorites_folder_2')
      .map(({ isExternalFav, ...rest }) => rest);

    dbFolder.file('favourit.json', JSON.stringify(favouritesPayload, null, 2));
    dbFolder.file('favourit2.json', JSON.stringify(favourites2Payload, null, 2));

    chunks.forEach((chunk, index) => {
      dbFolder.file(`data${index + 1}.json`, chunk);
    });

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().getTime()}.zip`;
    a.click();
    URL.revokeObjectURL(url);

    showToast(
      `✅ تم التصدير بنجاح — ${chunks.length} ملفات مقسمة` 
    );
  } catch (err) {
    console.error(err);
    showToast('❌ فشل في إنشاء الملف المضغوط');
  }
}

async function importDataFile(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  showToast('⏳ جاري استيراد البيانات...');

  try {
    let combinedStr = '';
    
    // Check if the first file is a ZIP
    if (files.length === 1 && files[0].name.endsWith('.zip')) {
      const zip = await JSZip.loadAsync(files[0]);
      const chunkFiles = [];
      
      zip.forEach((relativePath, file) => {
        if (relativePath.includes('data') && relativePath.endsWith('.json')) {
          chunkFiles.push(file);
        }
      });
      
      // Sort files to ensure correct sequence (data1, data2, ...)
      chunkFiles.sort((a, b) => {
        const numA = parseInt(a.name.match(/\d+/)[0]);
        const numB = parseInt(b.name.match(/\d+/)[0]);
        return numA - numB;
      });
      
      for (const file of chunkFiles) {
        combinedStr += await file.async("string");
      }
    } else {
      // Multiple JSON files
      files.sort((a, b) => {
        const numA = parseInt(a.name.match(/\d+/));
        const numB = parseInt(b.name.match(/\d+/));
        return numA - numB;
      });
      
      for (const file of files) {
        const text = await new Promise((resolve) => {
          const r = new FileReader();
          r.onload = e => resolve(e.target.result);
          r.readAsText(file, 'utf-8');
        });
        combinedStr += text;
      }
    }

    if (!combinedStr) throw new Error('Empty data');

    const data = JSON.parse(combinedStr);
    
    if (data.shortcuts) {
      shortcuts = data.shortcuts;
      categories = data.categories || [{ id: 'general', name: 'عام' }];
      shortcuts.forEach(s => { if (!s.categoryId) s.categoryId = 'general'; });
      saveShortcuts();
      renderCategorySelector();
      renderIcons();
      renderWelcomeGrid();
    }
    
    if (data.iptv_sources && typeof IPTV !== 'undefined') {
      IPTV.sources = data.iptv_sources;
      if (data.iptv_favs) IPTV.favorites = data.iptv_favs;
      if (data.iptv_playlists) IPTV.playlists = data.iptv_playlists;
      if (data.iptv_customCatOrder) IPTV.customCatOrder = data.iptv_customCatOrder;
      if (data.iptv_playerChoice) IPTV.playerChoice = data.iptv_playerChoice;
      
      IPTV.initialized = false;
      
      // Save using IDB-safe pattern
      if (typeof IPTV_DB !== 'undefined') {
        await IPTV_DB.set('rm_iptv', IPTV.sources);
        if (IPTV.playlists) await IPTV_DB.set('rm_iptv_playlists', IPTV.playlists);
        localStorage.setItem('rm_iptv', 'USE_IDB');
        localStorage.setItem('rm_iptv_playlists', 'USE_IDB');
      } else {
        try { localStorage.setItem('rm_iptv', JSON.stringify(IPTV.sources)); } catch(e) {}
      }
      
      localStorage.setItem('rm_iptv_favs', JSON.stringify(IPTV.favorites));
      localStorage.setItem('rm_iptv_cat_order', JSON.stringify(IPTV.customCatOrder));
      localStorage.setItem('rm_iptv_player', IPTV.playerChoice);
    }
    
    showToast('✅ تم استيراد البيانات بنجاح');
  } catch (err) {
    console.error(err);
    showToast('❌ ملف غير صالح أو تالف');
  }
  
  event.target.value = '';
}

async function resetAllData() {
  if (!confirm('هل تريد مسح جميع البيانات والعودة للإعدادات الافتراضية؟')) return;
  // مسح localStorage
  ['rm_shortcuts','rm_categories','rm_iptv','rm_iptv_favs',
   'rm_iptv_cat_order','rm_iptv_player','rm_iptv_playlists'].forEach(k => localStorage.removeItem(k));
  // مسح IndexedDB
  if (typeof IPTV_DB !== 'undefined') {
    await IPTV_DB.set('rm_iptv', []);
    await IPTV_DB.set('rm_iptv_playlists', []);
  }
  location.reload();
}

// ── Toast notification ────────────────────────────────────────────────
function showToast(msg) {
  let t = document.getElementById('appToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'appToast';
    t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1e1e32;border:1px solid rgba(255,255,255,0.15);color:#f0f0f5;padding:12px 24px;border-radius:12px;font-family:Cairo,sans-serif;font-size:14px;font-weight:700;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.6);transition:opacity 0.3s;pointer-events:none;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}


// ── Render icon bar ───────────────────────────────────────────────────
function renderIcons() {
  const container = document.getElementById('iconsContainer');
  const strip = document.getElementById('iconsStrip');
  if (strip) strip.classList.toggle('hidden', _currentCategory !== 'all');
  container.innerHTML = '';

  const filtered = _currentCategory === 'all' ? shortcuts : shortcuts.filter(s => s.categoryId === _currentCategory);

  filtered.forEach(s => {
    const card = document.createElement('div');
    card.className = 'icon-card';
    card.id = 'icon-' + s.id;
    card.title = s.name;
    card.dataset.id = s.id;

    // Apply border color (default white if not set, skip if transparent)
    if (s.borderColor !== 'transparent') {
      card.style.borderColor = s.borderColor || '#ffffff';
      card.style.borderWidth = '3px';
      card.style.borderStyle = 'solid';
    }

    card.innerHTML = buildIconImg(s, 42) + `<span class="icon-name">${escHtml(s.name)}</span>`;

    card.addEventListener('click', () => openSite(s));
    card.addEventListener('contextmenu', e => openContextMenu(e, s.id));
    container.appendChild(card);
  });
}

// ── Render welcome grid ───────────────────────────────────────────────
function renderWelcomeGrid() {
  const grid = document.getElementById('welcomeIconsGrid');
  grid.innerHTML = '';

  const isFavView = _currentCategory === 'favorites_folder' || _currentCategory === 'favorites_folder_2';
  const isCategoryView = _currentCategory !== 'all' && !isFavView;

  // Switch grid layout for favorites and category views
  if (isFavView) {
    grid.classList.add('fav-view');
  } else {
    grid.classList.remove('fav-view');
  }
  if (isCategoryView) {
    grid.classList.add('category-view');
  } else {
    grid.classList.remove('category-view');
  }

  if (_currentCategory === 'all') {
    // Show all categories as Folders first
    categories.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'welcome-icon-item folder-item';
      item.title = cat.name;
      
      let iconColor = '#4a4a6a';
      if (cat.id === 'favorites_folder') iconColor = '#e50914';
      if (cat.id === 'favorites_folder_2') iconColor = '#ff6b6b';

      item.innerHTML = `
        <div class="icon-fallback folder-icon" style="width:52px;height:52px;border-radius:12px;background:${iconColor};font-size:24px;">📁</div>
        <span>${escHtml(cat.name)}</span>
      `;
      item.addEventListener('click', () => selectCategory(cat.id));
      grid.appendChild(item);
    });
  } else {
    // Inside a specific category
    let filtered = shortcuts.filter(s => s.categoryId === _currentCategory);
    
    // Sort by date added (newest or oldest first), then by order if dates are equal
    filtered.sort((a, b) => {
      const aTime = parseInt(a.id.split('_')[1]) || 0;
      const bTime = parseInt(b.id.split('_')[1]) || 0;
      if (aTime !== bTime) {
        return _sortOrder === 'newest' ? bTime - aTime : aTime - bTime; // Newest or oldest first
      }
      return (a.order || 0) - (b.order || 0); // Fallback to order
    });
    
    const isFavView = _currentCategory === 'favorites_folder' || _currentCategory === 'favorites_folder_2';
    const itemsPerPage = isFavView ? 20 : ITEMS_PER_PAGE; // Fewer items for favorites for better performance
    
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    // Ensure current page is valid
    if (_currentPage > totalPages) _currentPage = totalPages;
    if (_currentPage < 1) _currentPage = 1;
    
    // Get items for current page
    const startIndex = (_currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filtered.slice(startIndex, endIndex);
    
    // Add pagination controls if needed
    if (totalPages > 1) {
      const paginationControls = createPaginationControls(totalPages);
      grid.appendChild(paginationControls);
    }
    
    // Render items with numbering using DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    pageItems.forEach((s, index) => {
      const globalIndex = startIndex + index + 1; // 1-based global numbering
      
      const item = document.createElement('div');
      item.className = 'welcome-icon-item draggable-item';
      item.title = s.name;
      item.dataset.id = s.id;
      item.draggable = true;
      
      if (isFavView) {
        // Movie Card Style for Favorites with background image
        const accentColor = s.color || '#e50914';
        const bgImageStyle = s.bgImage ? `background-image:url('${s.bgImage}');` : '';
        const borderColor = s.borderColor !== 'transparent' ? `border-color:${s.borderColor || '#ffffff'};border-width:3px;border-style:solid;` : '';
        item.innerHTML = `
          <div class="item-number">${globalIndex}</div>
          <div class="fav-rect-frame" style="--item-color:${accentColor};${bgImageStyle}${borderColor}">
            <div class="fav-rect-overlay"></div>
            <span class="fav-rect-name">${escHtml(s.name)}</span>
          </div>
        `;
      } else {
        if (s.borderColor !== 'transparent') {
          item.style.borderColor = s.borderColor || '#ffffff';
          item.style.borderWidth = '3px';
          item.style.borderStyle = 'solid';
        }
        item.innerHTML = `
          <div class="item-number">${globalIndex}</div>
          ${buildIconImg(s, 52)}
          <span>${escHtml(s.name)}</span>
        `;
      }
      
      // Add event listeners immediately for better performance
      item.addEventListener('dragstart', handleItemDragStart);
      item.addEventListener('dragend', handleItemDragEnd);
      item.addEventListener('dragover', handleItemDragOver);
      item.addEventListener('drop', handleItemDrop);
      item.addEventListener('click', () => openSite(s));
      item.addEventListener('contextmenu', e => openContextMenu(e, s.id));
      
      fragment.appendChild(item);
    });
    
    // Add all items at once
    grid.appendChild(fragment);
    
    // Add pagination controls at bottom if needed
    if (totalPages > 1) {
      const paginationControlsBottom = createPaginationControls(totalPages);
      grid.appendChild(paginationControlsBottom);
    }

    if (totalItems === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = 'grid-column: 1/-1; padding: 20px; color: var(--text-muted); font-size: 14px;';
      emptyMsg.textContent = 'لا توجد مواقع في هذا المجلد بعد.';
      grid.appendChild(emptyMsg);
    }
  }
}

// ── Build icon image/fallback HTML ────────────────────────────────────
function buildIconImg(s, size) {
  const bgStyle = s.bgImage ? `background-image:url('${s.bgImage}');background-size:cover;background-position:center;` : '';
  if (s.image) {
    return `<div style="width:${size}px;height:${size}px;border-radius:${size * 0.23}px;overflow:hidden;position:relative;">
      <img src="${s.image}" alt="${escHtml(s.name)}" style="width:100%;height:100%;object-fit:cover;position:relative;z-index:2;" />
      ${bgStyle ? `<div style="position:absolute;inset:0;z-index:1;${bgStyle}"></div>` : ''}
    </div>`;
  }
  // Fallback: colored bubble with first letter/emoji
  const letter = s.emoji || (s.name.charAt(0).toUpperCase());
  const fontSize = Math.round(size * 0.45);
  return `<div class="icon-fallback" style="width:${size}px;height:${size}px;border-radius:${size * 0.23}px;background:${s.color || '#333'};${bgStyle}font-size:${fontSize}px;">${letter}</div>`;
}

// ── Create pagination controls ─────────────────────────────────────────
function createPaginationControls(totalPages) {
  const controls = document.createElement('div');
  controls.className = 'pagination-controls';
  controls.style.cssText = `
    grid-column: 1/-1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    margin: 10px 0;
  `;
  
  // Previous button
  const prevBtn = document.createElement('button');
  prevBtn.className = 'pagination-btn';
  prevBtn.innerHTML = '⬅️';
  prevBtn.disabled = _currentPage <= 1;
  prevBtn.onclick = () => changePage(_currentPage - 1);
  controls.appendChild(prevBtn);
  
  // Page numbers
  const startPage = Math.max(1, _currentPage - 2);
  const endPage = Math.min(totalPages, _currentPage + 2);
  
  if (startPage > 1) {
    const firstBtn = document.createElement('button');
    firstBtn.className = 'pagination-btn';
    firstBtn.textContent = '1';
    firstBtn.onclick = () => changePage(1);
    controls.appendChild(firstBtn);
    
    if (startPage > 2) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.style.color = 'var(--text-muted)';
      controls.appendChild(dots);
    }
  }
  
  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.className = 'pagination-btn';
    if (i === _currentPage) pageBtn.classList.add('active');
    pageBtn.textContent = i;
    pageBtn.onclick = () => changePage(i);
    controls.appendChild(pageBtn);
  }
  
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.style.color = 'var(--text-muted)';
      controls.appendChild(dots);
    }
    
    const lastBtn = document.createElement('button');
    lastBtn.className = 'pagination-btn';
    lastBtn.textContent = totalPages;
    lastBtn.onclick = () => changePage(totalPages);
    controls.appendChild(lastBtn);
  }
  
  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'pagination-btn';
  nextBtn.innerHTML = '➡️';
  nextBtn.disabled = _currentPage >= totalPages;
  nextBtn.onclick = () => changePage(_currentPage + 1);
  controls.appendChild(nextBtn);
  
  return controls;
}

// ── Change page ───────────────────────────────────────────────────────
function changePage(page) {
  _currentPage = page;
  renderWelcomeGrid();
  // Scroll to top instantly for better performance
  window.scrollTo(0, 0);
}

// ── Drag and drop handlers ────────────────────────────────────────────
let draggedElement = null;

function handleItemDragStart(e) {
  draggedElement = e.target.closest('.draggable-item');
  if (!draggedElement) return;
  draggedElement.style.opacity = '0.5';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedElement.dataset.id);
}

function handleItemDragEnd(e) {
  const item = e.target.closest('.draggable-item');
  if (item) item.style.opacity = '1';
  draggedElement = null;
  document.querySelectorAll('.draggable-item').forEach(item => {
    item.style.borderLeft = '';
    item.style.borderRight = '';
  });
}

function handleItemDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  const target = e.target.closest('.draggable-item');
  if (target && target !== draggedElement) {
    const rect = target.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    
    if (e.clientX < midpoint) {
      target.style.borderLeft = '3px solid var(--accent)';
      target.style.borderRight = '';
    } else {
      target.style.borderRight = '3px solid var(--accent)';
      target.style.borderLeft = '';
    }
  }
}

function handleItemDrop(e) {
  e.preventDefault();
  
  const target = e.target.closest('.draggable-item');
  if (!target || !draggedElement || target === draggedElement) return;
  
  // Reset border styles
  document.querySelectorAll('.draggable-item').forEach(item => {
    item.style.borderLeft = '';
    item.style.borderRight = '';
  });
  
  const draggedId = draggedElement.dataset.id;
  const targetId = target.dataset.id;
  
  if (draggedId === targetId) return;
  
  // Find the shortcuts
  const draggedShortcut = shortcuts.find(s => s.id === draggedId);
  const targetShortcut = shortcuts.find(s => s.id === targetId);
  
  if (!draggedShortcut || !targetShortcut || draggedShortcut.categoryId !== targetShortcut.categoryId) return;
  
  // Determine drop position
  const rect = target.getBoundingClientRect();
  const midpoint = rect.left + rect.width / 2;
  const insertBefore = e.clientX < midpoint;
  
  // Get all shortcuts in the category
  const categoryShortcuts = shortcuts.filter(s => s.categoryId === _currentCategory).sort((a, b) => (a.order || 0) - (b.order || 0));
  
  // Find indices
  const draggedIndex = categoryShortcuts.findIndex(s => s.id === draggedId);
  const targetIndex = categoryShortcuts.findIndex(s => s.id === targetId);
  
  // Remove dragged item
  categoryShortcuts.splice(draggedIndex, 1);
  
  // Insert at new position
  let newIndex = targetIndex;
  if (!insertBefore && draggedIndex < targetIndex) {
    newIndex = targetIndex;
  } else if (insertBefore && draggedIndex > targetIndex) {
    newIndex = targetIndex;
  } else if (!insertBefore) {
    newIndex = targetIndex + 1;
  }
  
  categoryShortcuts.splice(newIndex, 0, draggedShortcut);
  
  // Update orders
  categoryShortcuts.forEach((s, index) => {
    s.order = index;
  });
  
  ensureShortcutOrders();
  saveShortcuts();
  renderWelcomeGrid();
}
// ── Current site ref for viewer toolbar ──────────────────────────────
let _currentSite = null;
let _blockDetectTimer = null;

// ── Open a site ───────────────────────────────────────────────────────
function openSite(s) {
  _currentSite = s;

  // If global browser mode is enabled or user prefers browser mode — open directly
  if (globalBrowserMode || s.openMode === 'browser') {
    window.open(s.url, '_blank', 'noopener,noreferrer');
    showToast(`🌐 تم فتح ${s.name} في المتصفح`);
    return;
  }

  // Update active icon state
  document.querySelectorAll('.icon-card').forEach(c => c.classList.remove('active'));
  const card = document.getElementById('icon-' + s.id);
  if (card) card.classList.add('active');

  // Hide the icons strip to give more space
  document.getElementById('iconsStrip').classList.add('hidden');

  // Show site settings group in settings menu
  document.getElementById('siteSettingsGroup').classList.remove('hidden');
  _updateMenuModeToggle(s);

  // Show viewer, hide welcome
  document.getElementById('welcomeScreen').classList.add('hidden');
  document.getElementById('iframeOverlay').classList.add('hidden');
  const wrapper = document.getElementById('viewerWrapper');
  wrapper.classList.remove('hidden');
  wrapper.style.display = 'flex';

  document.body.classList.add('app-mode');
  document.getElementById('backBtn').classList.remove('hidden');
  updateBackBtnVisibility();


  // Load iframe
  const frame = document.getElementById('siteFrame');
  frame.src = '';

  // Cancel previous block-detection timer
  clearTimeout(_blockDetectTimer);

  setTimeout(() => {
    frame.src = s.url;
    // Auto-detect blocks: if iframe src stays blank/unreachable after 5s show overlay
    _blockDetectTimer = setTimeout(() => {
      // Try to access contentDocument — if null/error, site is blocked
      try {
        const doc = frame.contentDocument;
        // doc exists but body is empty = likely blocked
        if (!doc || !doc.body || doc.body.innerHTML.trim() === '') {
          _showBlockedOverlay();
        }
      } catch (e) {
        // Cross-origin access denied = blocked by X-Frame-Options
        _showBlockedOverlay();
      }
    }, 5000);

    frame.onload = () => { clearTimeout(_blockDetectTimer); };
    frame.onerror = () => { clearTimeout(_blockDetectTimer); _showBlockedOverlay(); };
  }, 50);
}

function _showBlockedOverlay() {
  document.getElementById('iframeOverlay').classList.remove('hidden');
}

function _updateMenuModeToggle(s) {
  const toggleText = document.getElementById('modeToggleText');
  const toggleBtn = document.getElementById('menuModeToggleBtn');
  if (s.openMode === 'browser') {
    toggleText.textContent = 'إلغاء وضع المتصفح الدائم';
    toggleBtn.style.color = '#ff6b6b';
  } else {
    toggleText.textContent = 'جعل الفتح دائماً في المتصفح';
    toggleBtn.style.color = 'var(--text)';
  }
}

// ── Settings Menu Actions ─────────────────────────────────────────────
function toggleSettingsMenu() {
  document.getElementById('settingsMenu').classList.toggle('hidden');
}

function openCurrentInBrowser() {
  if (_currentSite) {
    window.open(_currentSite.url, '_blank', 'noopener,noreferrer');
    document.getElementById('settingsMenu').classList.add('hidden');
  }
}

function toggleOpenMode() {
  if (!_currentSite) return;
  const newMode = (_currentSite.openMode === 'browser') ? 'iframe' : 'browser';
  _setOpenMode(_currentSite.id, newMode);
  _currentSite = shortcuts.find(s => s.id === _currentSite.id);
  _updateMenuModeToggle(_currentSite);

  showToast(newMode === 'browser'
    ? `✅ ${_currentSite.name} — سيفتح دائماً في المتصفح`
    : `✅ ${_currentSite.name} — سيفتح داخل التطبيق`);
}

function saveModeBrowser() {
  if (!_currentSite) return;
  _setOpenMode(_currentSite.id, 'browser');
  _currentSite = shortcuts.find(s => s.id === _currentSite.id);
  _updateMenuModeToggle(_currentSite);
  document.getElementById('iframeOverlay').classList.add('hidden');
  showToast(`✅ تم حفظ التفضيل: ${_currentSite.name} يفتح في المتصفح دائماً`);
  window.open(_currentSite.url, '_blank', 'noopener,noreferrer');
}

function _setOpenMode(id, mode) {
  const idx = shortcuts.findIndex(s => s.id === id);
  if (idx !== -1) {
    shortcuts[idx].openMode = mode;
    saveShortcuts();
    renderIcons(); // refresh to show mode indicator on icon
  }
}

// ── Global Browser Mode ────────────────────────────────────────────────
let globalBrowserMode = localStorage.getItem('rm_global_browser_mode') === 'true';

function toggleGlobalBrowserMode() {
  globalBrowserMode = !globalBrowserMode;
  localStorage.setItem('rm_global_browser_mode', globalBrowserMode);
  _updateGlobalModeUI();
  showToast(globalBrowserMode 
    ? '✅ سيتم فتح جميع المواقع في المتصفح الخارجي'
    : '✅ سيتم فتح المواقع داخل التطبيق');
}

function _updateGlobalModeUI() {
  const btn = document.getElementById('globalBrowserModeBtn');
  const text = document.getElementById('globalModeText');
  if (!btn || !text) return;

  if (globalBrowserMode) {
    btn.classList.add('active');
    text.textContent = 'فتح جميع المواقع في المتصفح (مفعّل)';
  } else {
    btn.classList.remove('active');
    text.textContent = 'فتح جميع المواقع في المتصفح';
  }
}

// ── Context menu mode toggle ──────────────────────────────────────────
function ctxToggleMode() {
  if (!ctxTargetId) return;
  const s = shortcuts.find(x => x.id === ctxTargetId);
  if (!s) return;
  const newMode = (s.openMode === 'browser') ? 'iframe' : 'browser';
  _setOpenMode(ctxTargetId, newMode);
  showToast(newMode === 'browser'
    ? `🌐 ${s.name} — سيفتح في المتصفح`
    : `📺 ${s.name} — سيفتح داخل التطبيق`);
  closeContextMenu();
}


// ── Go Home ───────────────────────────────────────────────────────────
function goHome() {
  _navigationStack = ['all']; // Reset stack
  _currentCategory = 'all';
  
  document.getElementById('currentCategoryLabel').textContent = 'كل المواقع';

  // Show title bar and hide back button
  document.getElementById('titleBar').classList.remove('hidden');
  document.getElementById('titleBackBtn').classList.add('hidden');
  document.getElementById('categoryTitle').textContent = '';
  document.getElementById('welcomeScreen').classList.remove('category-view');
  document.getElementById('welcomeScreen').classList.add('home-view');

  _currentSite = null;
  document.querySelectorAll('.icon-card').forEach(c => c.classList.remove('active'));
  document.getElementById('currentSiteLabel').textContent = '';
  document.getElementById('viewerWrapper').classList.add('hidden');
  document.getElementById('welcomeScreen').classList.remove('hidden');
  document.getElementById('iptvSection').classList.add('hidden');

  // Show icons strip again
  document.getElementById('iconsStrip').classList.remove('hidden');
  // Hide site-specific settings
  document.getElementById('siteSettingsGroup').classList.add('hidden');

  document.body.classList.remove('app-mode');
  // Always show back button if we are not at root home
  updateBackBtnVisibility();
  renderIcons();

  const frame = document.getElementById('siteFrame');
  frame.src = '';
  
  renderIcons();
  renderWelcomeGrid();
  updateSortOrderButton(); // Update sort button visibility
}

// ── Toggle sort order ────────────────────────────────────────────────
function toggleSortOrder() {
  _sortOrder = _sortOrder === 'newest' ? 'oldest' : 'newest';
  localStorage.setItem('rm_sort_order', _sortOrder);
  updateSortOrderButton();
  renderWelcomeGrid();
  showToast(`✅ تم تغيير الترتيب إلى: ${_sortOrder === 'newest' ? 'الأحدث أولاً' : 'الأقدم أولاً'}`);
}

// ── Update sort order button ──────────────────────────────────────────
function updateSortOrderButton() {
  const label = document.getElementById('sortOrderLabel');
  const icon = document.getElementById('sortOrderIcon');
  const btn = document.getElementById('sortOrderBtn');
  
  if (label) {
    label.textContent = _sortOrder === 'newest' ? 'الأحدث' : 'الأقدم';
  }
  
  if (icon) {
    // Rotate icon based on sort order with smooth transition
    icon.style.transition = 'transform 0.3s ease';
    icon.style.transform = _sortOrder === 'newest' ? 'rotate(0deg)' : 'rotate(180deg)';
  }
  
  if (btn) {
    btn.title = `ترتيب العناصر: ${_sortOrder === 'newest' ? 'الأحدث أولاً' : 'الأقدم أولاً'}`;
    // Show button only when in a category/folder view
    btn.style.display = _currentCategory !== 'all' ? 'flex' : 'none';
  }
}

function updateBackBtnVisibility() {
  const btn = document.getElementById('backBtn');
  const isIframeOpen = !document.getElementById('viewerWrapper').classList.contains('hidden');
  const isIptvOpen = !document.getElementById('iptvSection').classList.contains('hidden');
  const isNotRoot = _currentCategory !== 'all';
  
  if (isIframeOpen || isIptvOpen || isNotRoot) {
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}

function goBack() {
  try {
    const frame = document.getElementById('siteFrame');
    if (frame && frame.contentWindow) {
      frame.contentWindow.history.back();
    }
  } catch (e) {
    window.history.back();
  }
}

// ── Context Menu ──────────────────────────────────────────────────────
function openContextMenu(e, id) {
  e.preventDefault();
  e.stopPropagation();
  ctxTargetId = id;
  const menu = document.getElementById('contextMenu');
  menu.classList.remove('hidden');
  // Position near cursor, keep within viewport
  let x = e.clientX, y = e.clientY;
  const mw = 160, mh = 120;
  if (x + mw > window.innerWidth) x = window.innerWidth - mw - 10;
  if (y + mh > window.innerHeight) y = window.innerHeight - mh - 10;
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}
function closeContextMenu() {
  const menu = document.getElementById('contextMenu');
  if (!menu.classList.contains('hidden')) {
    menu.classList.add('hidden');
    ctxTargetId = null;
  }
}
function ctxEdit() {
  if (!ctxTargetId) return;
  const s = shortcuts.find(x => x.id === ctxTargetId);
  if (s) openEditModal(s);
  closeContextMenu();
}
function ctxDelete() {
  if (!ctxTargetId) return;
  const name = (shortcuts.find(x => x.id === ctxTargetId) || {}).name || '';
  if (confirm(`هل تريد حذف "${name}"؟`)) {
    shortcuts = shortcuts.filter(x => x.id !== ctxTargetId);
    saveShortcuts();
    renderIcons();
    renderWelcomeGrid();
    // If this was the active site, go home
    goHome();
  }
  closeContextMenu();
}

function ctxBorderColor() {
  if (!ctxTargetId) return;
  const s = shortcuts.find(x => x.id === ctxTargetId);
  if (!s) return;

  const colors = [
    { name: 'أخضر', value: '#00ff00' },
    { name: 'أصفر', value: '#ffff00' },
    { name: 'أحمر', value: '#ff0000' }
  ];

  const currentColor = (s.borderColor && s.borderColor !== 'transparent') ? s.borderColor : '';
  const colorOptions = colors.map(c => 
    `<button data-color="${c.value}" class="color-option-btn" style="background:${c.value};color:#000;padding:8px 16px;margin:4px;border-radius:4px;border:2px solid ${currentColor === c.value ? '#fff' : 'transparent'};cursor:pointer;position:relative;z-index:10002;">${c.name}</button>`
  ).join('');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.zIndex = '99999';
  modal.style.pointerEvents = 'auto';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';

  modal.innerHTML = `
    <div class="modal" style="max-width:300px;pointer-events:auto;position:relative;z-index:100000;">
      <h3>اختر لون الإطار</h3>
      <div id="colorOptionsContainer" style="display:flex;flex-wrap:wrap;gap:8px;margin:16px 0;position:relative;z-index:100001;">
        ${colorOptions}
      </div>
      <div style="display:flex;gap:8px;">
        <button id="cancelColorBtn" class="ctrl-btn" style="flex:1;">إلغاء</button>
        <button id="removeColorBtn" class="ctrl-btn accent" style="flex:1;">إزالة اللون</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // إضافة event listeners للأزرار
  const colorOptionsContainer = modal.querySelector('#colorOptionsContainer');
  colorOptionsContainer.addEventListener('click', function(e) {
    const btn = e.target.closest('.color-option-btn');
    if (btn) {
      const color = btn.getAttribute('data-color');
      setBorderColor(color);
    }
  });

  modal.querySelector('#cancelColorBtn').addEventListener('click', function() {
    modal.remove();
  });

  modal.querySelector('#removeColorBtn').addEventListener('click', function() {
    removeBorderColor();
  });

  // إخفاء القائمة الجانبية فقط دون مسح ctxTargetId
  document.getElementById('contextMenu').classList.add('hidden');
}

function setBorderColor(color) {
  console.log('🎨 setBorderColor called with color:', color);
  console.log('🔍 ctxTargetId:', ctxTargetId);
  
  if (!ctxTargetId) {
    console.error('❌ ctxTargetId is null');
    return;
  }
  
  const s = shortcuts.find(x => x.id === ctxTargetId);
  console.log('🔍 Found shortcut:', s);
  
  if (s) {
    s.borderColor = color;
    console.log('✅ borderColor set to:', color);
    
    saveShortcuts();
    console.log('✅ Shortcuts saved');
    
    renderIcons();
    console.log('✅ Icons rendered');
    
    renderWelcomeGrid();
    console.log('✅ Welcome grid rendered');
    
    showToast(`✅ تم تغيير لون الإطار إلى ${color}`);
    
    // إغلاق modal بشكل صحيح
    const modal = document.getElementById('colorPickerModal');
    if (modal) {
      modal.classList.add('hidden');
      console.log('✅ Modal closed');
    }
  } else {
    console.error('❌ Shortcut not found with id:', ctxTargetId);
    showToast(`❌ لم يتم العثور على العنصر`);
  }
}

function removeBorderColor() {
  if (!ctxTargetId) return;
  const s = shortcuts.find(x => x.id === ctxTargetId);
  if (s) {
    s.borderColor = 'transparent';
    saveShortcuts();
    renderIcons();
    renderWelcomeGrid();
    showToast(`✅ تم إزالة لون الإطار`);
  }
  const modal = document.getElementById('colorPickerModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// ── Color Picker Functions ─────────────────────────────────────────────
function openColorPicker() {
  console.log('🎨 openColorPicker called, ctxTargetId:', ctxTargetId);
  if (!ctxTargetId) {
    showToast('❌ لم يتم تحديد عنصر');
    return;
  }
  const s = shortcuts.find(x => x.id === ctxTargetId);
  if (!s) {
    showToast('❌ لم يتم العثور على العنصر');
    return;
  }

  const modal = document.getElementById('colorPickerModal');
  const colorOptionsContainer = document.getElementById('colorOptions');
  
  if (!modal || !colorOptionsContainer) {
    console.error('❌ Modal or container not found');
    return;
  }

  // إعادة بناء الأزرار 
  const colors = ['#ffffff', '#00ff00', '#ff00ff', '#0000ff', '#ffff00', '#ffa500', '#ff0000'];
  
  let html = '';
  colors.forEach((color, idx) => {
    const isSelected = s.borderColor === color;
    const styleStr = isSelected ? `border-color:#ffffff !important;box-shadow:0 0 8px ${color} !important;` : 'border-color:transparent;box-shadow:none;';
    // استخدام onmouseup لضمان الاستجابة
    html += `<button type="button" data-color="${color}" onmouseup="window.colorPickerHandler('${color}')" style="width:60px;height:60px;border-radius:8px;background:${color};border:3px solid;cursor:pointer;${styleStr}"></button>`;
  });
  
  colorOptionsContainer.innerHTML = html;
  console.log('✅ HTML injected, button count:', colorOptionsContainer.querySelectorAll('button').length);

  modal.classList.remove('hidden');
  document.getElementById('contextMenu').classList.add('hidden');
  console.log('✅ Color picker modal shown');
}

function closeColorPicker() {
  document.getElementById('colorPickerModal').classList.add('hidden');
}

// Global handler for color picker
window.colorPickerHandler = function(color) {
  console.log('🎨 colorPickerHandler called with color:', color);
  setBorderColor(color);
};

// ── Modal: Add ────────────────────────────────────────────────────────
function openAddModal() {
  editingId = null;
  currentIconImage = null;
  document.getElementById('modalTitle').textContent = 'إضافة موقع جديد';
  document.getElementById('siteName').value = '';
  document.getElementById('siteUrl').value = '';
  document.getElementById('siteColor').value = '#1a1a2e';
  document.getElementById('colorPreviewText').textContent = '#1a1a2e';
  document.getElementById('siteBgImage').value = '';
  
  // Auto-select current category (if not in 'all' view)
  const categorySelect = document.getElementById('siteCategory');
  let autoSelectedCategory = false;
  
  if (_currentCategory !== 'all' && categories.some(c => c.id === _currentCategory)) {
    categorySelect.value = _currentCategory;
    autoSelectedCategory = true;
  } else {
    categorySelect.value = 'general';
  }
  
  resetIconPreview();
  showModal();
  
  // Show toast notification only if auto-selected a category
  if (autoSelectedCategory) {
    const categoryName = categories.find(c => c.id === _currentCategory)?.name || _currentCategory;
    showToast(`✅ تم تحديد المجلد: ${categoryName}`);
  }
}

// ── Modal: Edit ───────────────────────────────────────────────────────
function openEditModal(s) {
  editingId = s.id;
  currentIconImage = s.image || null;
  document.getElementById('modalTitle').textContent = 'تعديل الموقع';
  document.getElementById('siteName').value = s.name;
  document.getElementById('siteUrl').value = s.url;
  document.getElementById('siteColor').value = s.color || '#1a1a2e';
  document.getElementById('colorPreviewText').textContent = s.color || '#1a1a2e';
  document.getElementById('siteCategory').value = s.categoryId || 'general';
  document.getElementById('siteBgImage').value = s.bgImage || '';

  if (s.image) {
    const preview = document.getElementById('iconPreview');
    preview.src = s.image;
    preview.classList.remove('hidden');
    document.getElementById('iconPlaceholder').classList.add('hidden');
  } else {
    resetIconPreview();
  }
  showModal();
}

function showModal() { document.getElementById('modalOverlay').classList.remove('hidden'); document.getElementById('siteName').focus(); }
function closeModal() { document.getElementById('modalOverlay').classList.add('hidden'); }

function handleOverlayClick(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

// ── Image upload ──────────────────────────────────────────────────────
function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    currentIconImage = e.target.result;
    const preview = document.getElementById('iconPreview');
    preview.src = currentIconImage;
    preview.classList.remove('hidden');
    document.getElementById('iconPlaceholder').classList.add('hidden');
  };
  reader.readAsDataURL(file);
  // Reset input so same file can be re-selected
  event.target.value = '';
}

function resetIconPreview() {
  const preview = document.getElementById('iconPreview');
  preview.src = '';
  preview.classList.add('hidden');
  document.getElementById('iconPlaceholder').classList.remove('hidden');
}

// ── Save shortcut ─────────────────────────────────────────────────────
function saveShortcut() {
  const name = document.getElementById('siteName').value.trim();
  const url = document.getElementById('siteUrl').value.trim();
  const color = document.getElementById('siteColor').value;
  const categoryId = document.getElementById('siteCategory').value || 'general';
  const bgImage = document.getElementById('siteBgImage').value.trim();

  if (!name) { flashInput('siteName'); return; }
  if (!url) { flashInput('siteUrl'); return; }

  // Ensure URL has protocol
  const finalUrl = url.match(/^https?:\/\//) ? url : 'https://' + url;

  if (editingId) {
    // Update existing
    const idx = shortcuts.findIndex(x => x.id === editingId);
    if (idx !== -1) {
      const oldCategory = shortcuts[idx].categoryId;
      shortcuts[idx] = {
        ...shortcuts[idx],
        name,
        url: finalUrl,
        color,
        categoryId,
        image: currentIconImage,
        bgImage: bgImage || null,
        emoji: shortcuts[idx].emoji || name.charAt(0).toUpperCase()
      };
      if (oldCategory !== categoryId) {
        ensureShortcutOrders();
      }
    }
  } else {
    // Create new
    const id = 'site_' + Date.now();
    // Find the maximum order in the category
    const categoryShortcuts = shortcuts.filter(s => s.categoryId === categoryId);
    const maxOrder = categoryShortcuts.length > 0 ? Math.max(...categoryShortcuts.map(s => s.order || 0)) : -1;
    shortcuts.push({
      id,
      name,
      url: finalUrl,
      color,
      categoryId,
      image: currentIconImage,
      bgImage: bgImage || null,
      emoji: name.charAt(0).toUpperCase(),
      borderColor: '#ffffff',
      order: maxOrder + 1
    });
  }

  ensureShortcutOrders();
  saveShortcuts();
  renderIcons();
  renderWelcomeGrid();
  closeModal();
}

// ── Flash invalid input ───────────────────────────────────────────────
function flashInput(id) {
  const el = document.getElementById(id);
  el.style.borderColor = '#e50914';
  el.style.boxShadow = '0 0 0 2px rgba(229,9,20,0.3)';
  el.focus();
  setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 1500);
}

// ── Utility ───────────────────────────────────────────────────────────
function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── IPTV Navigation ───────────────────────────────────────────────────
function openIPTV() {
  document.getElementById('welcomeScreen').classList.add('hidden');
  document.getElementById('viewerWrapper').classList.add('hidden');
  document.getElementById('iconsStrip').classList.add('hidden');
  document.getElementById('currentSiteLabel').textContent = '';
  document.querySelectorAll('.icon-card').forEach(c => c.classList.remove('active'));
  document.getElementById('iptvSection').classList.remove('hidden');
  document.getElementById('iptvBtn').classList.add('active');
  if (typeof iptvInit === 'function') iptvInit();
  updateBackBtnVisibility();
}

function closeIPTV() {
  document.getElementById('iptvSection').classList.add('hidden');
  document.getElementById('iptvBtn').classList.remove('active');
  document.getElementById('iconsStrip').classList.remove('hidden');
  if (typeof closeIPTVPlayer === 'function') closeIPTVPlayer();
  updateBackBtnVisibility();
}

// Patch goHome to also close IPTV mode
const _portalGoHome = goHome;
window.goHome = function () {
  closeIPTV();
  _portalGoHome();
};

// ── Category Management ───────────────────────────────────────────────
function renderCategorySelector() {
  // 1. Render top bar dropdown
  const menu = document.getElementById('categorySelectMenu');
  if (menu) {
    let html = `<button onclick="selectCategory('all')">📂 كل المواقع</button><hr class="dropdown-divider" />`;
    categories.forEach(c => {
      html += `<button onclick="selectCategory('${c.id}')">📁 ${escHtml(c.name)}</button>`;
    });
    menu.innerHTML = html;
  }

  // 2. Render Add/Edit modal dropdown
  const selectCombo = document.getElementById('siteCategory');
  if (selectCombo) {
    let html = '';
    categories.forEach(c => {
      html += `<option value="${c.id}">${escHtml(c.name)}</option>`;
    });
    selectCombo.innerHTML = html;
  }
}

function toggleCategorySelectMenu() {
  document.getElementById('categorySelectMenu').classList.toggle('hidden');
}

function selectCategory(id) {
  _currentCategory = id;
  _currentPage = 1; // Reset to first page when entering category
  
  // Update navigation stack
  if (_navigationStack[_navigationStack.length - 1] !== id) {
    _navigationStack.push(id);
  }
  
  const label = id === 'all' ? 'كل المواقع' : (categories.find(c => c.id === id)?.name || 'كل المواقع');
  document.getElementById('currentCategoryLabel').textContent = label;
  
  // Update title bar
  const titleBar = document.getElementById('titleBar');
  const categoryTitle = document.getElementById('categoryTitle');
  const titleBackBtn = document.getElementById('titleBackBtn');
  
  // Always show title bar
  titleBar.classList.remove('hidden');
  
  if (id === 'all') {
    categoryTitle.textContent = '';
    titleBackBtn.classList.add('hidden');
    document.getElementById('welcomeScreen').classList.remove('category-view');
    document.getElementById('welcomeScreen').classList.add('home-view');
  } else {
    categoryTitle.textContent = label;
    titleBackBtn.classList.remove('hidden');
    document.getElementById('welcomeScreen').classList.add('category-view');
    document.getElementById('welcomeScreen').classList.remove('home-view');
  }
  
  // Close menu if open
  const cm = document.getElementById('categorySelectMenu');
  if (cm) cm.classList.add('hidden');
  
  renderIcons();
  renderWelcomeGrid();
  updateBackBtnVisibility();
  updateSortOrderButton(); // Update sort button visibility and state
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBackView() {
  // 1. If an iframe is open (site viewing mode), handle iframe back or close iframe
  const isIframeOpen = !document.getElementById('viewerWrapper').classList.contains('hidden');
  if (isIframeOpen) {
    try {
      const frame = document.getElementById('siteFrame');
      // If we can go back in iframe history, do it
      // Note: This often fails due to CORS, so we might just go home if we can't detect
      if (frame && frame.contentWindow && frame.contentWindow.history.length > 1) {
        frame.contentWindow.history.back();
        return;
      }
    } catch (e) {}
    // If we can't go back in iframe or it's the first page, close iframe and show current folder
    goHome(); 
    return;
  }

  // 2. If IPTV section is open, close it
  const iptvSection = document.getElementById('iptvSection');
  if (iptvSection && !iptvSection.classList.contains('hidden')) {
    goHome();
    return;
  }

  // 3. Folder navigation history
  if (_navigationStack.length > 1) {
    _navigationStack.pop(); // Remove current
    const prev = _navigationStack[_navigationStack.length - 1];
    _currentCategory = prev;
    
    const label = _currentCategory === 'all' ? 'كل المواقع' : (categories.find(c => c.id === _currentCategory)?.name || 'كل المواقع');
    document.getElementById('currentCategoryLabel').textContent = label;
    
    renderIcons();
    renderWelcomeGrid();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    goHome();
  }
}

// ── Modals: Manage Categories ──────────────────────────────────────────
function openManageCategoriesModal() {
  document.getElementById('settingsMenu').classList.add('hidden');
  document.getElementById('manageCategoriesModal').classList.remove('hidden');
  document.getElementById('newCategoryName').value = '';
  renderManageCategoriesList();
}

function closeManageCategoriesModal() {
  document.getElementById('manageCategoriesModal').classList.add('hidden');
}

function renderManageCategoriesList() {
  const list = document.getElementById('categoriesList');
  list.innerHTML = '';
  categories.forEach((c, index) => {
    const isSystem = c.id === 'general' || c.id === 'favorites_folder';
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="category-name-display">${escHtml(c.name)} ${isSystem ? '<small style="opacity:0.5">(أساسي)</small>' : ''}</span>
      <div class="cat-actions" style="display:flex;gap:4px;align-items:center;">
        <button class="cat-btn" onclick="moveCategory('${c.id}', -1)" title="لأعلى" style="font-size:10px; padding:2px 6px; ${index === 0 || isSystem ? 'opacity:0.3;cursor:not-allowed;' : ''}" ${index === 0 || isSystem ? 'disabled' : ''}>▲</button>
        <button class="cat-btn" onclick="moveCategory('${c.id}', 1)" title="لأسفل" style="font-size:10px; padding:2px 6px; ${index === categories.length - 1 || isSystem ? 'opacity:0.3;cursor:not-allowed;' : ''}" ${index === categories.length - 1 || isSystem ? 'disabled' : ''}>▼</button>
        <div style="width:1px;height:16px;background:var(--glass-border);margin:0 2px;"></div>
        ${!isSystem ? `<button class="cat-btn" onclick="renameCategory('${c.id}')" title="تعديل الاسم">✏️</button>` : ''}
        ${!isSystem ? `<button class="cat-btn delete" onclick="deleteCategory('${c.id}')" title="حذف">🗑️</button>` : ''}
      </div>
    `;
    list.appendChild(li);
  });
}

function moveCategory(id, dir) {
  const idx = categories.findIndex(c => c.id === id);
  if (idx < 0) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= categories.length) return;

  const temp = categories[newIdx];
  categories[newIdx] = categories[idx];
  categories[idx] = temp;

  saveShortcuts();
  renderManageCategoriesList();
  renderCategorySelector();
  renderIcons();
  
  if (!document.getElementById('manageSitesModal').classList.contains('hidden')) {
      renderManageSitesList();
  }
}

function renameCategory(id) {
  const cat = categories.find(c => c.id === id);
  if (!cat) return;
  const newName = prompt('تعديل اسم المجلد:', cat.name);
  if (!newName || !newName.trim() || newName.trim() === cat.name) return;
  
  cat.name = newName.trim();
  saveShortcuts();
  renderManageCategoriesList();
  renderCategorySelector();
  renderIcons();
  
  if (!document.getElementById('manageSitesModal').classList.contains('hidden')) {
      renderManageSitesList();
  }
}

function addCategory() {
  const input = document.getElementById('newCategoryName');
  const name = input.value.trim();
  if (!name) return flashInput('newCategoryName');

  const id = 'cat_' + Date.now();
  categories.push({ id, name });
  saveShortcuts();
  renderCategorySelector();
  renderManageCategoriesList();
  input.value = '';
}

function deleteCategory(id) {
  if (id === 'general') return;
  const count = shortcuts.filter(s => s.categoryId === id).length;
  if (!confirm(`سيتم حذف المجلد ونقل ${count} موقع بداخله إلى مجلد "عام". هل أنت متأكد؟`)) return;

  // Migrate shortcuts
  shortcuts.forEach(s => {
    if (s.categoryId === id) s.categoryId = 'general';
  });

  // Remove category
  categories = categories.filter(c => c.id !== id);
  if (_currentCategory === id) selectCategory('all');

  saveShortcuts();
  renderCategorySelector();
  renderManageCategoriesList();
  renderIcons();
  renderWelcomeGrid();
}

// ── Modals: Manage Sites ──────────────────────────────────────────────
function openManageSitesModal() {
  document.getElementById('settingsMenu').classList.add('hidden');
  document.getElementById('manageSitesModal').classList.remove('hidden');
  renderManageSitesList();
}

function closeManageSitesModal() {
  document.getElementById('manageSitesModal').classList.add('hidden');
}

function renderManageSitesList() {
  const list = document.getElementById('sitesList');
  list.innerHTML = '';

  if (shortcuts.length === 0) {
    list.innerHTML = '<li style="justify-content:center;color:var(--text-muted);">لا توجد مواقع مضافة حالياً.</li>';
    return;
  }

  let catOptionsHTML = '';
  categories.forEach(c => {
    catOptionsHTML += `<option value="${c.id}">${escHtml(c.name)}</option>`;
  });

  shortcuts.forEach(s => {
    const li = document.createElement('li');
    li.style.flexWrap = 'nowrap';
    li.style.gap = '10px';
    li.style.alignItems = 'center';

    let selectHTML = `<select class="site-cat-select" onchange="changeSiteCategory('${s.id}', this.value)" style="margin-left: 8px; padding: 4px; border-radius: 6px; background: rgba(255,255,255,0.05); color: var(--text); border: 1px solid var(--glass-border);">${catOptionsHTML}</select>`;
    selectHTML = selectHTML.replace(`value="${s.categoryId || 'general'}"`, `value="${s.categoryId || 'general'}" selected`);

    li.innerHTML = `
      <div class="site-row-info" style="display:flex;align-items:center;gap:10px;flex:1;">
        ${selectHTML}
        ${buildIconImg(s, 32)}
        <span class="site-row-name" style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escHtml(s.name)}</span>
      </div>
      <div class="site-row-actions" style="flex-shrink:0;">
        <button class="cat-btn delete" onclick="quickDeleteSite('${s.id}')" title="حذف" style="padding: 6px;">🗑️</button>
      </div>
    `;
    list.appendChild(li);
  });
}

function changeSiteCategory(siteId, newCatId) {
  const s = shortcuts.find(x => x.id === siteId);
  if (s) {
    s.categoryId = newCatId;
    saveShortcuts();
    renderIcons();
    renderWelcomeGrid();
  }
}

function quickDeleteSite(siteId) {
  const name = (shortcuts.find(x => x.id === siteId) || {}).name || '';
  if (confirm(`هل أنت متأكد من حذف موقع "${name}"؟`)) {
    shortcuts = shortcuts.filter(x => x.id !== siteId);
    saveShortcuts();
    renderManageSitesList();
    renderIcons();
    renderWelcomeGrid();
    if (_currentSite && _currentSite.id === siteId) {
      goHome();
    }
  }
}

// إضافة event listeners لأزرار الألوان
function handleColorClick(e) {
  e.preventDefault();
  e.stopPropagation();
  const color = e.target.getAttribute('data-color');
  console.log('Color clicked:', color); // للتصحيح
  if (color) {
    setBorderColor(color);
  }
}

function initColorPicker() {
  const colorOptions = document.querySelectorAll('.color-option');
  console.log('Found color options:', colorOptions.length); // للتصحيح
  colorOptions.forEach(btn => {
    // إزالة أي event listeners سابقة
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    // إضافة event listener جديد
    newBtn.addEventListener('click', handleColorClick);
  });
}

// تهيئة اختيار اللون عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing color picker'); // للتصحيح
  initColorPicker();
});

// إعادة تهيئة عند فتح نافذة اختيار اللون
const originalOpenColorPicker = openColorPicker;
openColorPicker = function() {
  console.log('Opening color picker'); // للتصحيح
  originalOpenColorPicker();
  setTimeout(initColorPicker, 100);
};
