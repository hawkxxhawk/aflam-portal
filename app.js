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

// ── Data loading strategy ─────────────────────────────────────────────
// Priority: IndexedDB (newest user changes) > database_chunks/dataX.json (bundled seed)

// Helper to check if we are on a mobile device
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

async function loadDataFromChunks() {
  let combinedStr = '';
  let i = 1;
  let success = false;
  
  try {
    while (true) {
      try {
        const res = await fetch(`./database_chunks/data${i}.json?_=${Date.now()}`);
        if (res.ok) {
          const text = await res.text();
          combinedStr += text;
          i++;
          success = true;
          if (i % 2 === 0) showToast(`⏳ جاري تحميل الجزء ${i}...`);
        } else {
          break;
        }
      } catch (e) {
        break;
      }
    }
    
    if (success && combinedStr) {
      return JSON.parse(combinedStr);
    }
    
    // Fallback to old data.json
    try {
      const res = await fetch('./data.json?_=' + Date.now());
      if (res.ok) return await res.json();
    } catch (e) {}
  } catch (err) {
    console.error("Error loading data chunks:", err);
  }
  return null;
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
    // 1. Load system categories first
    if (!categories.some(c => c.id === 'favorites_folder')) {
      categories.push({ id: 'favorites_folder', name: 'المفضلة', isSystem: true });
    }
    if (!categories.some(c => c.id === 'favorites_folder_2')) {
      categories.push({ id: 'favorites_folder_2', name: 'مفضلة 2', isSystem: true });
    }

    // 2. Load from IndexedDB
    let dbShortcuts = [];
    if (typeof IPTV_DB !== 'undefined') {
      dbShortcuts = await IPTV_DB.get('rm_shortcuts') || [];
      const dbCategories = await IPTV_DB.get('rm_categories');
      if (dbShortcuts.length > 0) {
        shortcuts = dbShortcuts;
        if (dbCategories && Array.isArray(dbCategories)) {
          dbCategories.forEach(c => {
            if (!categories.some(exist => exist.id === c.id)) categories.push(c);
          });
        }
      }
    }

    // 3. Load external favorites from files — only if the user has no saved favorites in DB
    //    This prevents wiping user-added favorites on every page reload.
    const dbHasFavs1 = dbShortcuts.some(s => s.categoryId === 'favorites_folder');
    const dbHasFavs2 = dbShortcuts.some(s => s.categoryId === 'favorites_folder_2');

    const externalFavs1 = dbHasFavs1 ? [] : await loadFavoritesFromFile();
    const externalFavs2 = dbHasFavs2 ? [] : await loadFavorites2FromFile();

    // Remove file-sourced favorites only when we are about to replace them with file data
    if (!dbHasFavs1) shortcuts = shortcuts.filter(s => s.categoryId !== 'favorites_folder');
    if (!dbHasFavs2) shortcuts = shortcuts.filter(s => s.categoryId !== 'favorites_folder_2');
    shortcuts = [...shortcuts, ...externalFavs1, ...externalFavs2];

    // 4. Fallback to localStorage (legacy)
    if (shortcuts.length === 0) {
      const lsData = localStorage.getItem('rm_shortcuts');
      const lsCat = localStorage.getItem('rm_categories');
      if (lsData) {
        try {
          const parsed = JSON.parse(lsData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            shortcuts = parsed;
            const parsedCat = JSON.parse(lsCat);
            if (Array.isArray(parsedCat)) {
              parsedCat.forEach(c => {
                if (!categories.some(exist => exist.id === c.id)) categories.push(c);
              });
            }
          }
        } catch (e) {}
      }
    }

    // 5. Load from chunks if still empty
    if (shortcuts.length === 0) {
      const disk = await loadDataFromChunks();
      if (disk) {
        shortcuts = disk.shortcuts || DEFAULT_SHORTCUTS.map(s => ({ ...s }));
        // Load favorites from database_chunks
        const chunkFavs = await loadFavoritesFromChunks();
        // Remove existing favorites and add from chunks
        shortcuts = shortcuts.filter(s => s.categoryId !== 'favorites_folder' && s.categoryId !== 'favorites_folder_2');
        shortcuts = [...shortcuts, ...chunkFavs.favs1, ...chunkFavs.favs2];
      }
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
    setupEventListeners();
    _updateGlobalModeUI();

    const loader = document.getElementById('globalLoader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 600);
    }
  } catch (err) {
    console.error("Critical Init Error:", err);
    showToast('⚠️ خطأ في تحميل البيانات');
  }
}

function setupEventListeners() {
  document.addEventListener('click', (e) => {
    // Hide context menu
    if (!e.target.closest('.icon-card')) closeContextMenu();
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
}

window.addEventListener('load', () => {
  initApp();
}); // Use 'load' to ensure all assets are ready for mobile

async function forceReloadFromChunks() {
  showToast('⏳ جاري جلب أحدث البيانات من السيرفر...');
  const disk = await loadDataFromChunks();

  if (disk && (disk.shortcuts || disk.iptv_sources)) {
    if (disk.shortcuts) {
      // Load favorites from database_chunks
      const chunkFavs = await loadFavoritesFromChunks();

      // ✅ Use favorites from database_chunks instead of user's favorites
      const diskNonFavs = disk.shortcuts.filter(
        s => s.categoryId !== 'favorites_folder' && s.categoryId !== 'favorites_folder_2'
      );
      shortcuts = [...diskNonFavs, ...chunkFavs.favs1, ...chunkFavs.favs2];
    }

    if (disk.categories) {
      // Merge: use disk categories as base, but keep any user-created folders not in disk
      const diskCatIds = new Set(disk.categories.map(c => c.id));
      const userOnlyCats = categories.filter(
        c => !diskCatIds.has(c.id) &&
             c.id !== 'favorites_folder' &&
             c.id !== 'favorites_folder_2'
      );
      categories = [...disk.categories, ...userOnlyCats];
      // Always ensure system folders are present
      if (!categories.some(c => c.id === 'favorites_folder'))
        categories.unshift({ id: 'favorites_folder', name: 'المفضلة', isSystem: true });
      if (!categories.some(c => c.id === 'favorites_folder_2'))
        categories.splice(1, 0, { id: 'favorites_folder_2', name: 'مفضلة 2', isSystem: true });
    }

    shortcuts.forEach(s => { if (!s.categoryId) s.categoryId = 'general'; });
    
    // Save to IDB
    await saveShortcuts();
    
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
    
    renderCategorySelector();
    renderIcons();
    renderWelcomeGrid();
    
    document.getElementById('settingsMenu').classList.add('hidden');
    showToast('✅ تم تحديث كافة البيانات بنجاح');
  } else {
    showToast('❌ فشل في جلب البيانات. تأكد من اتصالك بالإنترنت');
  }
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
  container.innerHTML = '';

  const filtered = _currentCategory === 'all' ? shortcuts : shortcuts.filter(s => s.categoryId === _currentCategory);

  filtered.forEach(s => {
    const card = document.createElement('div');
    card.className = 'icon-card';
    card.id = 'icon-' + s.id;
    card.title = s.name;
    card.dataset.id = s.id;

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

  // Switch grid layout for favorites
  if (isFavView) {
    grid.classList.add('fav-view');
  } else {
    grid.classList.remove('fav-view');
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
    const backItem = document.createElement('div');
    backItem.className = 'welcome-icon-item back-item';
    backItem.title = 'العودة للمجلدات';
    backItem.innerHTML = `
      <div class="icon-fallback" style="width:52px;height:52px;border-radius:12px;background:rgba(255,255,255,0.1);font-size:24px;">🔙</div>
      <span>رجوع</span>
    `;
    backItem.addEventListener('click', () => goBackView());
    grid.appendChild(backItem);

    const filtered = shortcuts.filter(s => s.categoryId === _currentCategory);
    filtered.forEach(s => {
      const item = document.createElement('div');
      
      if (isFavView) {
        // Movie Card Style for Favorites with background image
        item.className = 'welcome-icon-item fav-rectangular-item';
        const accentColor = s.color || '#e50914';
        const bgImageStyle = s.bgImage ? `background-image:url('${s.bgImage}');` : '';
        item.innerHTML = `
          <div class="fav-rect-frame" style="--item-color:${accentColor};${bgImageStyle}">
            <div class="fav-rect-overlay"></div>
            <span class="fav-rect-name">${escHtml(s.name)}</span>
          </div>
        `;
      } else {
        item.className = 'welcome-icon-item';
        item.innerHTML = buildIconImg(s, 52) + `<span>${escHtml(s.name)}</span>`;
      }
      
      item.title = s.name;
      item.addEventListener('click', () => openSite(s));
      grid.appendChild(item);
    });

    if (filtered.length === 0) {
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

  const frame = document.getElementById('siteFrame');
  frame.src = '';
  
  renderIcons();
  renderWelcomeGrid();
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
  document.getElementById('contextMenu').classList.add('hidden');
  ctxTargetId = null;
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
  resetIconPreview();
  showModal();
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
    }
  } else {
    // Create new
    const id = 'site_' + Date.now();
    shortcuts.push({
      id,
      name,
      url: finalUrl,
      color,
      categoryId,
      image: currentIconImage,
      bgImage: bgImage || null,
      emoji: name.charAt(0).toUpperCase()
    });
  }

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
  
  // Update navigation stack
  if (_navigationStack[_navigationStack.length - 1] !== id) {
    _navigationStack.push(id);
  }
  
  const label = id === 'all' ? 'كل المواقع' : (categories.find(c => c.id === id)?.name || 'كل المواقع');
  document.getElementById('currentCategoryLabel').textContent = label;
  
  // Close menu if open
  const cm = document.getElementById('categorySelectMenu');
  if (cm) cm.classList.add('hidden');
  
  renderIcons();
  renderWelcomeGrid();
  updateBackBtnVisibility();
  
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
