/* =======================================================
   📺 iptv.js — IPTV Module v2
   Supports: Xtream Code API, M3U files/URLs, HLS.js player
   Features: Language filter, Multi-playlist, Selection mode
   ======================================================= */

// ── IndexedDB Storage Helper ──
const IPTV_DB = {
    open: () => new Promise((resolve, reject) => {
        const req = indexedDB.open('RmIPTV', 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore('iptv');
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => reject();
    }),
    get: async (key) => {
        try {
            const db = await IPTV_DB.open();
            return new Promise(r => {
                const req = db.transaction('iptv').objectStore('iptv').get(key);
                req.onsuccess = () => r(req.result);
                req.onerror = () => r(null);
            });
        } catch { return null; }
    },
    set: async (key, val) => {
        try {
            const db = await IPTV_DB.open();
            return new Promise(r => {
                const req = db.transaction('iptv', 'readwrite').objectStore('iptv').put(val, key);
                req.onsuccess = () => r(true);
                req.onerror = () => r(false);
            });
        } catch { return false; }
    }
};

// ── Language Definitions ──
const IPTV_LANGS = {
    'ar': { name: 'عربي',    flag: '🇸🇦' },
    'en': { name: 'إنجليزي', flag: '🇬🇧' },
    'fr': { name: 'فرنسي',   flag: '🇫🇷' },
    'tr': { name: 'تركي',    flag: '🇹🇷' },
    'de': { name: 'ألماني',  flag: '🇩🇪' },
    'es': { name: 'إسباني',  flag: '🇪🇸' },
    'it': { name: 'إيطالي',  flag: '🇮🇹' },
    'ru': { name: 'روسي',    flag: '🇷🇺' },
    'fa': { name: 'فارسي',   flag: '🇮🇷' },
    'hi': { name: 'هندي',    flag: '🇮🇳' },
    'ku': { name: 'كردي',    flag: '🏴' },
    'pt': { name: 'برتغالي', flag: '🇵🇹' },
};

// ── Language Detection from channel data ──
function iptvDetectLang(ch) {
    if (ch._lang) {
        const l = ch._lang.toLowerCase();
        if (/^ar$|arab/.test(l)) return 'ar';
        if (/^en$|engl/.test(l)) return 'en';
        if (/^fr$|fren/.test(l)) return 'fr';
        if (/^tr$|turk/.test(l)) return 'tr';
        if (/^de$|germ|deut/.test(l)) return 'de';
        if (/^es$|span|espa/.test(l)) return 'es';
        if (/^it$|ital/.test(l)) return 'it';
        if (/^ru$|russ/.test(l)) return 'ru';
        if (/^fa$|fars|iran|pers/.test(l)) return 'fa';
        if (/^hi$|hind|indi/.test(l)) return 'hi';
        if (/^ku$|kurd/.test(l)) return 'ku';
        if (/^pt$|port/.test(l)) return 'pt';
    }
    const nc = ((ch.name || '') + '  ' + (ch.category || '')).toUpperCase();
    if (/\|AR(ABIC)?\||\bARABIC\b/.test(nc)) return 'ar';
    if (/\|EN(G|GLISH)?\||\bENGLISH\b/.test(nc)) return 'en';
    if (/\|FR(ENCH)?\||\bFRENCH\b|\bFRANCE\b/.test(nc)) return 'fr';
    if (/\|TR(K)?\||\bTURKISH\b|\bTURKIYE\b/.test(nc)) return 'tr';
    if (/\|DE\||\bGERMAN(Y)?\b|\bDEUTSCH\b/.test(nc)) return 'de';
    if (/\|ES\||\bSPANISH\b|\bESPANA\b/.test(nc)) return 'es';
    if (/\|IT(AL)?\||\bITALIAN\b/.test(nc)) return 'it';
    if (/\|RU\||\bRUSSIAN\b/.test(nc)) return 'ru';
    if (/\|FA\||\|IR\||\bPERSIAN\b|\bFARSI\b|\bIRANIAN\b/.test(nc)) return 'fa';
    if (/\|HI\||\|IN\||\bHINDI\b|\bINDIAN\b/.test(nc)) return 'hi';
    if (/\|KU\||\bKURDISH\b/.test(nc)) return 'ku';
    if (/\|PT\||\bPORTUGUESE\b|\bBRAZIL\b/.test(nc)) return 'pt';
    if (/[\u0600-\u06FF]/.test(ch.name || '')) return 'ar';
    return null;
}

// ── State ─────────────────────────────────────────────
const IPTV = {
    sources: [],
    allChannels: [],
    filtered: [],
    categories: [],
    languages: [],
    playlists: [],
    activeSrc: 'all',
    activeCat: 'all',
    activeLang: 'all',
    query: '',
    currentPage: 1,
    activeType: 'live',
    currentCh: null,
    hls: null,
    initialized: false,
    favorites: [],
    selectionMode: false,
    selectedChannels: [],
    langExpanded: false,
    customCatOrder: [],
    playerChoice: 'browser',
};

// ── Init ──────────────────────────────────────────────
async function iptvInit() {
    if (IPTV.initialized) { iptvRenderAll(); return; }
    IPTV.initialized = true;

    // Fetch initial data from chunks or data.json
    let disk = null;
    if (typeof loadDataFromChunks === 'function') {
        disk = await loadDataFromChunks();
    } else {
        try {
            const res = await fetch('./data.json?_=' + Date.now());
            if (res.ok) disk = await res.json();
        } catch (_) {}
    }

    const savedPlayer = localStorage.getItem('rm_iptv_player');
    if (savedPlayer) {
        IPTV.playerChoice = savedPlayer;
    } else if (disk && disk.iptv_playerChoice) {
        IPTV.playerChoice = disk.iptv_playerChoice;
    }
    const sel = document.getElementById('iptvPlayerSelect');
    if (sel) sel.value = IPTV.playerChoice;

    const lsFavs = localStorage.getItem('rm_iptv_favs');
    if (lsFavs) { try { IPTV.favorites = JSON.parse(lsFavs); } catch { IPTV.favorites = []; } }
    else if (disk && disk.iptv_favs) { IPTV.favorites = disk.iptv_favs; }

    const savedCatOrder = localStorage.getItem('rm_iptv_cat_order');
    if (savedCatOrder) { try { IPTV.customCatOrder = JSON.parse(savedCatOrder); } catch { IPTV.customCatOrder = []; } }
    else if (disk && disk.iptv_customCatOrder) { IPTV.customCatOrder = disk.iptv_customCatOrder; }

    const savedPlaylists = await IPTV_DB.get('rm_iptv_playlists');
    if (savedPlaylists) {
        IPTV.playlists = savedPlaylists;
    } else {
        const lsPl = localStorage.getItem('rm_iptv_playlists');
        if (lsPl && lsPl !== 'USE_IDB') { try { IPTV.playlists = JSON.parse(lsPl); } catch { IPTV.playlists = []; } }
        else if (disk && disk.iptv_playlists) { IPTV.playlists = disk.iptv_playlists; }
    }

    let idbSources = await IPTV_DB.get('rm_iptv');
    if (!idbSources || (Array.isArray(idbSources) && idbSources.length === 0)) {
        try { 
            const ls = localStorage.getItem('rm_iptv');
            if (ls && ls !== 'USE_IDB' && ls.startsWith('[')) {
                idbSources = JSON.parse(ls);
            } else {
                idbSources = null;
            }
        } catch { idbSources = null; }
    }
    
    if (idbSources && idbSources.length > 0) {
        IPTV.sources = idbSources;
    } else if (disk && disk.iptv_sources && disk.iptv_sources.length > 0) {
        IPTV.sources = disk.iptv_sources;
        await iptvSave();
    } else {
        IPTV.sources = [];
    }

    iptvBuild();
}

// ── Persist ────────────────────────────────────────────
async function iptvSave() {
    if (typeof IPTV_DB !== 'undefined') {
        await IPTV_DB.set('rm_iptv', IPTV.sources);
        try { localStorage.setItem('rm_iptv', 'USE_IDB'); } catch (_) { }
    } else {
        try { localStorage.setItem('rm_iptv', JSON.stringify(IPTV.sources)); } catch (_) { }
    }
}

async function iptvSavePlaylists() {
    if (typeof IPTV_DB !== 'undefined') {
        await IPTV_DB.set('rm_iptv_playlists', IPTV.playlists);
        try { localStorage.setItem('rm_iptv_playlists', 'USE_IDB'); } catch (_) { }
    } else {
        try { localStorage.setItem('rm_iptv_playlists', JSON.stringify(IPTV.playlists)); } catch (_) { }
    }
}

// ── Adult content detection helper ───────────────────
function _iptvIsAdult(name, category) {
    // Combine name + category, lowercase
    const text = ((name || '') + ' ' + (category || '')).toLowerCase();
    // Remove special chars, keep letters/digits/arabic and spaces
    const clean = text.replace(/[^a-z0-9\u0600-\u06FF\s+]/g, ' ');

    // Unambiguous adult keywords (any occurrence)
    if (/porn|fuck|hentai|erotic|playboy/.test(clean)) return true;

    // Context-sensitive keywords as standalone words
    if (/(?:^|\s)adult(?:\s|$)/.test(clean)) return true;
    if (/(?:^|\s)sex(?:y|ual|xx)?(?:\s|$)/.test(clean)) return true;
    if (/(?:^|\s)lesb[a-z]*(?:\s|$)/.test(clean)) return true;
    if (/(?:^|\s)x{2,}(?:\s|$)/.test(clean)) return true;

    // Arabic & numeric patterns
    if (/18\s*\+/.test(text)) return true;
    if (/(?:\s|^)\+?18(?:\s|$)/.test(clean)) return true;
    if (/للكبار/.test(text)) return true;

    return false;
}

// ── Logo Handling with HTTPS fallback ──
function iptvBuild() {
    IPTV.allChannels = [];
    const isHttpsPage = window.location.protocol === 'https:';
    
    IPTV.sources.forEach(src => {
        (src.channels || []).forEach(ch => {
            let cat = ch.category || 'غير مصنف';
            if (_iptvIsAdult(ch.name, cat)) cat = '🔞 للكبار فقط';
            
            // Handle Mixed Content for Logos
            let finalLogo = ch.logo || '';
            if (isHttpsPage && finalLogo.startsWith('http:')) {
                // We can't easily upgrade all logos as many don't support HTTPS
                // but we can at least try or let browser handle it (some will block it)
            }

            IPTV.allChannels.push({ 
                ...ch, 
                logo: finalLogo,
                category: cat, 
                _srcId: src.id, 
                _srcName: src.name, 
                _detectedLang: iptvDetectLang(ch) 
            });
        });
    });
    iptvFilter();
    iptvRenderAll();
}

// ── Filter ─────────────────────────────────────────────
function iptvFilter() {
    let list = IPTV.allChannels;

    // 1. Source filter
    if (IPTV.activeSrc.startsWith('playlist_')) {
        const pl = IPTV.playlists.find(p => p.id === IPTV.activeSrc);
        const plUrls = new Set(pl ? pl.channels : []);
        list = list.filter(c => plUrls.has(c.url));
    } else if (IPTV.activeSrc === 'fav') {
        const favIds = new Set(IPTV.favorites);
        list = list.filter(c => favIds.has(c.url));
    } else if (IPTV.activeSrc !== 'all') {
        list = list.filter(c => c._srcId === IPTV.activeSrc);
    }
    
    // 2. Stream Type filter
    list = list.filter(c => c._stream_type === IPTV.activeType || (IPTV.activeType === 'live' && !c._stream_type));

    // Build categories — Auto and Manual Sorting
    const catMap = {};
    list.forEach(ch => { const c = ch.category || 'غير مصنف'; catMap[c] = (catMap[c] || 0) + 1; });
    IPTV.categories = Object.entries(catMap)
        .sort((a, b) => {
            const nameA = a[0];
            const nameB = b[0];

            // 1. Manual sorting overrules default if both are in customCatOrder
            const idxA = IPTV.customCatOrder.indexOf(nameA);
            const idxB = IPTV.customCatOrder.indexOf(nameB);
            if (idxA > -1 && idxB > -1) {
                return idxA - idxB;
            } else if (idxA > -1) {
                return -1; // user ranked A comes before unranked B
            } else if (idxB > -1) {
                return 1;
            }

            // 2. Default sorting: Adult first > AR second > rest by count descending
            const aAdult = nameA.includes('🔞') ? 1 : 0;
            const bAdult = nameB.includes('🔞') ? 1 : 0;
            if (aAdult !== bAdult) return bAdult - aAdult;

            const isArA = (nameA.toUpperCase().includes('AR') || nameA.includes('عرب') || /[\u0600-\u06FF]/.test(nameA)) ? 1 : 0;
            const isArB = (nameB.toUpperCase().includes('AR') || nameB.includes('عرب') || /[\u0600-\u06FF]/.test(nameB)) ? 1 : 0;
            if (isArA !== isArB) return isArB - isArA;

            return b[1] - a[1];
        })
        .map(([name, count]) => ({ name, count }));

    // Build languages
    const langMap = {};
    list.forEach(ch => { if (ch._detectedLang) langMap[ch._detectedLang] = (langMap[ch._detectedLang] || 0) + 1; });
    IPTV.languages = Object.entries(langMap).sort((a, b) => b[1] - a[1]).map(([code, count]) => ({
        code, count, ...(IPTV_LANGS[code] || { name: code, flag: '🌐' })
    }));

    if (IPTV.activeCat !== 'all') list = list.filter(c => (c.category || 'غير مصنف') === IPTV.activeCat);
    if (IPTV.activeLang !== 'all') list = list.filter(c => c._detectedLang === IPTV.activeLang);
    if (IPTV.query) { const q = IPTV.query.toLowerCase(); list = list.filter(c => c.name.toLowerCase().includes(q)); }

    IPTV.filtered = list;
    IPTV.currentPage = 1;
}

// ── Render all ─────────────────────────────────────────
function iptvRenderAll() {
    iptvRenderSidebar();
    iptvRenderGrid();
}

// ── Render sidebar ─────────────────────────────────────
function iptvRenderSidebar() {
    const srcEl = document.getElementById('sourcesList');
    const catEl = document.getElementById('iptvCategoriesList');
    const langEl = document.getElementById('languagesList');
    const plEl = document.getElementById('playlistsList');
    if (!srcEl || !catEl) return;

    const liveCount = IPTV.allChannels.filter(c => c._stream_type === 'live' || !c._stream_type).length;
    const srcItems = [
        { id: 'all', icon: '📡', name: 'جميع المصادر', count: liveCount },
        { id: 'fav', icon: '⭐', name: 'المفضلة', count: IPTV.favorites.length }
    ].concat(IPTV.sources.map(s => ({
        id: s.id, icon: s.type === 'xtream' ? '🌐' : '📋', name: s.name, count: (s.channels || []).length
    })));

    srcEl.innerHTML = srcItems.map(s => `
    <div class="cat-item ${IPTV.activeSrc === s.id ? 'active' : ''}" onclick="iptvSetSrc('${s.id}')">
      <span class="cat-icon">${s.icon}</span>
      <span class="cat-name">${escHtml(s.name)}</span>
      <span class="cat-count">${s.count}</span>
    </div>`).join('');

    // Playlists
    if (plEl) {
        plEl.innerHTML = IPTV.playlists.length === 0
            ? `<div class="sidebar-empty-hint">اضغط + لإنشاء قائمة</div>`
            : IPTV.playlists.map(pl => `
              <div class="cat-item pl-item ${IPTV.activeSrc === pl.id ? 'active' : ''}" onclick="iptvSetSrc('${pl.id}')">
                <span class="cat-icon">📋</span>
                <span class="cat-name">${escHtml(pl.name)}</span>
                <span class="cat-count">${pl.channels.length}</span>
                <button class="pl-del-btn" onclick="event.stopPropagation();deletePlaylist('${pl.id}')" title="حذف">🗑</button>
              </div>`).join('');
    }

    // Languages — show All + Arabic by default, others collapsible
    if (langEl) {
        if (IPTV.languages.length === 0) {
            langEl.innerHTML = `<div class="sidebar-empty-hint">لم يتم اكتشاف لغات</div>`;
        } else {
            const tot = IPTV.languages.reduce((a, l) => a + l.count, 0);
            const arLang = IPTV.languages.find(l => l.code === 'ar');
            const otherLangs = IPTV.languages.filter(l => l.code !== 'ar');

            let langHtml = `
            <div class="cat-item ${IPTV.activeLang === 'all' ? 'active' : ''}" onclick="iptvSetLang('all')">
              <span class="cat-icon">🌐</span><span class="cat-name">الكل</span><span class="cat-count">${tot}</span>
            </div>`;

            if (arLang) {
                langHtml += `
            <div class="cat-item ${IPTV.activeLang === 'ar' ? 'active' : ''}" onclick="iptvSetLang('ar')">
              <span class="cat-icon">${arLang.flag}</span><span class="cat-name">${arLang.name}</span><span class="cat-count">${arLang.count}</span>
            </div>`;
            }

            if (otherLangs.length > 0) {
                langHtml += `<div id="langOthersContainer" style="display:${IPTV.langExpanded ? 'block' : 'none'}">`;
                langHtml += otherLangs.map(l => `
            <div class="cat-item ${IPTV.activeLang === l.code ? 'active' : ''}" onclick="iptvSetLang('${l.code}')">
              <span class="cat-icon">${l.flag}</span><span class="cat-name">${l.name}</span><span class="cat-count">${l.count}</span>
            </div>`).join('');
                langHtml += `</div>`;
                langHtml += `<div class="lang-expand-btn" onclick="iptvToggleLangExpand()">${IPTV.langExpanded ? '▴ إخفاء' : `▾ لغات أخرى (${otherLangs.length})`}</div>`;
            }

            langEl.innerHTML = langHtml;
        }
    }

    // Categories
    const allCount = IPTV.categories.reduce((acc, c) => acc + c.count, 0);
    catEl.innerHTML = `
    <div class="cat-item ${IPTV.activeCat === 'all' ? 'active' : ''}" onclick="iptvSetCat('all')">
      <span class="cat-icon">📺</span><span class="cat-name">الكل</span><span class="cat-count">${allCount}</span>
    </div>` + IPTV.categories.map(c => `
    <div class="cat-item sortable-cat ${IPTV.activeCat === c.name ? 'active' : ''}" 
         draggable="true" 
         ondragstart='catDragStart(event, ${JSON.stringify(c.name).replace(/'/g, "&apos;")})'
         ondragover='catDragOver(event)'
         ondrop='catDrop(event, ${JSON.stringify(c.name).replace(/'/g, "&apos;")})'
         onclick='iptvSetCat(${JSON.stringify(c.name).replace(/'/g, "&apos;")})'>
      <span class="cat-icon dragger" title="إسحب للترتيب" onmousedown="event.stopPropagation()">⋮⋮</span>
      <span class="cat-icon">${iptvCatIcon(c.name)}</span>
      <span class="cat-name">${escHtml(c.name)}</span>
      <span class="cat-count">${c.count}</span>
      <div class="cat-order-btns">
        <button class="order-btn" onclick='event.stopPropagation(); catMove(event, ${JSON.stringify(c.name).replace(/'/g, "&apos;")}, -1)' title="لأعلى">▲</button>
        <button class="order-btn" onclick='event.stopPropagation(); catMove(event, ${JSON.stringify(c.name).replace(/'/g, "&apos;")}, 1)' title="لأسفل">▼</button>
      </div>
    </div>`).join('');
}

// ── Category Reordering ────────────────────────────────
function _ensureCustomCatOrder() {
    if (IPTV.customCatOrder.length === 0) {
        IPTV.customCatOrder = IPTV.categories.map(c => c.name);
    } else {
        IPTV.categories.forEach(c => {
            if (!IPTV.customCatOrder.includes(c.name)) IPTV.customCatOrder.push(c.name);
        });
    }
}

function _saveCustomCatOrder() {
    localStorage.setItem('rm_iptv_cat_order', JSON.stringify(IPTV.customCatOrder));
    iptvFilter();
    iptvRenderSidebar();
}

function catMove(e, name, dir) {
    if (e) e.stopPropagation();
    _ensureCustomCatOrder();
    const idx = IPTV.customCatOrder.indexOf(name);
    if (idx === -1) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= IPTV.customCatOrder.length) return;
    
    const temp = IPTV.customCatOrder[newIdx];
    IPTV.customCatOrder[newIdx] = name;
    IPTV.customCatOrder[idx] = temp;
    _saveCustomCatOrder();
}

let iptvDraggedCat = null;
function catDragStart(e, name) {
    iptvDraggedCat = name;
    e.dataTransfer.effectAllowed = 'move';
    e.target.classList.add('dragging');
}
function catDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
function catDrop(e, targetName) {
    e.preventDefault();
    if (e.target) e.target.classList.remove('dragging');
    if (!iptvDraggedCat || iptvDraggedCat === targetName || targetName === 'all') return;
    
    _ensureCustomCatOrder();
    const fromIdx = IPTV.customCatOrder.indexOf(iptvDraggedCat);
    const toIdx = IPTV.customCatOrder.indexOf(targetName);
    if (fromIdx > -1 && toIdx > -1) {
        IPTV.customCatOrder.splice(fromIdx, 1);
        IPTV.customCatOrder.splice(toIdx, 0, iptvDraggedCat);
        _saveCustomCatOrder();
    }
    iptvDraggedCat = null;
}
document.addEventListener('dragend', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('sortable-cat')) {
        e.target.classList.remove('dragging');
    }
});

function iptvCatIcon(n) {
    const l = n.toLowerCase();
    if (/🔞|للكبار|adult|porn|sex|lesb|xx/.test(l)) return '🔞';
    if (/sport|رياض|كرة|football|soccer/.test(l)) return '⚽';
    if (/movie|film|أفلام|سينما|cinema/.test(l)) return '🎬';
    if (/kid|cartoon|أطفال|child/.test(l)) return '🧸';
    if (/news|أخبار|breaking/.test(l)) return '📰';
    if (/music|موسيقى|طرب|clip/.test(l)) return '🎵';
    if (/doc|وثائق/.test(l)) return '🎥';
    if (/islam|قرآن|religion|دين/.test(l)) return '🕌';
    if (/entertain|ترفيه/.test(l)) return '🎭';
    return '📺';
}

// ── Toggle language expand/collapse ────────────────
function iptvToggleLangExpand() {
    IPTV.langExpanded = !IPTV.langExpanded;
    const container = document.getElementById('langOthersContainer');
    const btn = document.querySelector('.lang-expand-btn');
    if (container) container.style.display = IPTV.langExpanded ? 'block' : 'none';
    if (btn) btn.textContent = IPTV.langExpanded ? '▴ إخفاء' : `▾ لغات أخرى`;
}

// ── Render channels grid ────────────────────────────────
function iptvRenderGrid() {
    const grid = document.getElementById('channelsGrid');
    const empty = document.getElementById('channelsEmpty');
    if (!grid || !empty) return;

    if (IPTV.filtered.length === 0) {
        grid.classList.add('hidden');
        empty.classList.remove('hidden');
        empty.innerHTML = IPTV.allChannels.length > 0
            ? `<div class="empty-icon">🔍</div><h3>لا توجد نتائج</h3><p>جرب تغيير التصنيف أو كلمة البحث</p>`
            : `<div class="empty-icon">📡</div><h3>لا توجد قنوات</h3><p>أضف مصدر Xtream أو ملف M3U للبدء</p><button class="ctrl-btn accent" onclick="openSourceModal()">+ إضافة مصدر</button>`;
        return;
    }

    empty.classList.add('hidden');
    grid.classList.remove('hidden');
    grid.innerHTML = '';

    // Xtream banner
    if (IPTV.activeSrc !== 'all' && IPTV.activeSrc !== 'fav' && !IPTV.activeSrc.startsWith('playlist_')) {
        const src = IPTV.sources.find(s => s.id === IPTV.activeSrc);
        if (src && src.type === 'xtream' && src.userInfo) {
            const exp = src.userInfo.exp_date ? new Date(src.userInfo.exp_date * 1000).toLocaleDateString('ar-EG') : 'غير محدد';
            grid.insertAdjacentHTML('beforeend', `<div class="xtream-banner">
              <div><strong>الحالة:</strong> ${src.userInfo.status || 'Active'}</div>
              <div><strong>الانتهاء:</strong> ${exp}</div>
              <div><strong>الاتصالات:</strong> ${src.userInfo.max_connections || 1}</div>
              <div><strong>متصل الآن:</strong> ${src.userInfo.active_cons || 0}</div>
            </div>`);
        }
    }

    const limit = 60;
    const totalPages = Math.ceil(IPTV.filtered.length / limit);
    if (IPTV.currentPage > totalPages) IPTV.currentPage = totalPages || 1;
    const startIdx = (IPTV.currentPage - 1) * limit;
    const display = IPTV.filtered.slice(startIdx, startIdx + limit);

    const container = document.createElement('div');
    container.className = 'channels-cards-container';

    display.forEach((ch, idx) => {
        const globalIdx = startIdx + idx;
        const isSelected = IPTV.selectionMode && IPTV.selectedChannels.includes(ch.url);
        const isFav = IPTV.favorites.includes(ch.url);
        const langInfo = ch._detectedLang ? IPTV_LANGS[ch._detectedLang] : null;

        const card = document.createElement('div');
        card.className = 'ch-card' + (isSelected ? ' ch-selected' : '');
        card.title = ch.name;
        card.onclick = () => {
            if (IPTV.selectionMode) { iptvToggleSelect(ch.url); return; }
            iptvPlay(globalIdx);
        };

        // Fav button
        const favBtn = document.createElement('button');
        favBtn.className = 'ch-action-btn fav-btn';
        favBtn.innerHTML = '★';
        favBtn.style.left = '4px';
        favBtn.style.color = isFav ? '#ffd700' : 'rgba(255,255,255,0.7)';
        favBtn.onclick = e => { e.stopPropagation(); iptvToggleFav(ch.url, favBtn); };

        // Playlist add button
        const plBtn = document.createElement('button');
        plBtn.className = 'ch-action-btn pl-btn';
        plBtn.innerHTML = '＋';
        plBtn.title = 'أضف لقائمة';
        plBtn.style.right = '4px';
        plBtn.onclick = e => { e.stopPropagation(); showPlaylistPicker(ch, e); };

        // Selection overlay
        const selOverlay = document.createElement('div');
        selOverlay.className = 'ch-sel-overlay' + (isSelected ? ' active' : '');
        selOverlay.style.display = IPTV.selectionMode ? 'flex' : 'none';
        selOverlay.innerHTML = isSelected ? '✓' : '';

        // Language badge
        const langBadge = langInfo ? (() => {
            const b = document.createElement('div');
            b.className = 'ch-lang-badge';
            b.textContent = langInfo.flag;
            b.title = langInfo.name;
            return b;
        })() : null;

        // Logo
        const logoDiv = document.createElement('div');
        logoDiv.className = 'ch-logo';
        if (ch.logo) {
            const img = document.createElement('img');
            img.src = ch.logo; img.alt = '';
            const fb = document.createElement('div');
            fb.className = 'ch-fallback'; fb.style.display = 'none';
            fb.textContent = ch.name.charAt(0).toUpperCase();
            img.onerror = () => { img.style.display = 'none'; fb.style.display = 'flex'; };
            logoDiv.append(img, fb);
        } else {
            const fb = document.createElement('div');
            fb.className = 'ch-fallback';
            fb.textContent = ch.name.charAt(0).toUpperCase();
            logoDiv.appendChild(fb);
        }

        // Info
        const info = document.createElement('div');
        info.className = 'ch-info';
        info.innerHTML = `<div class="ch-name">${escHtml(ch.name)}</div>${ch.category ? `<div class="ch-cat">${escHtml(ch.category)}</div>` : ''}`;

        // Live dot
        const dot = document.createElement('div');
        dot.className = 'live-dot';
        if (IPTV.activeType !== 'live' && !(!ch._stream_type)) dot.style.display = 'none';

        card.append(favBtn, plBtn, selOverlay, logoDiv, info, dot);
        if (langBadge) card.appendChild(langBadge);
        container.appendChild(card);
    });

    grid.appendChild(container);

    if (totalPages > 1) {
        const pag = document.createElement('div');
        pag.className = 'iptv-pagination';
        pag.innerHTML = `
            <button class="ctrl-btn" ${IPTV.currentPage === 1 ? 'disabled' : ''} onclick="IPTV.currentPage--;iptvRenderGrid()">السابق</button>
            <span>صفحة ${IPTV.currentPage} من ${totalPages}</span>
            <button class="ctrl-btn" ${IPTV.currentPage === totalPages ? 'disabled' : ''} onclick="IPTV.currentPage++;iptvRenderGrid()">التالي</button>`;
        grid.appendChild(pag);
    }

    _updateSelectionBar();
}

// ── Sidebar interactions ────────────────────────────────
function iptvSetSrc(id) {
    IPTV.activeSrc = id;
    IPTV.activeCat = 'all';
    IPTV.activeLang = 'all';
    IPTV.activeType = 'live';

    const tabs = document.getElementById('iptvTypeTabs');
    if (tabs) {
        tabs.classList.remove('hidden');
        document.getElementById('tabLive').classList.add('active');
        document.getElementById('tabVod').classList.remove('active');
        document.getElementById('tabSeries').classList.remove('active');
    }
    iptvFilter();
    iptvRenderAll();
}

function iptvSetCat(name) { IPTV.activeCat = name; iptvFilter(); iptvRenderAll(); }
function iptvSetLang(code) { IPTV.activeLang = code; iptvFilter(); iptvRenderGrid(); iptvRenderSidebar(); }
function iptvSearch(q) { IPTV.query = q; iptvFilter(); iptvRenderGrid(); }

async function switchIptvType(type) {
    if (IPTV.activeType === type) return;
    IPTV.activeType = type;
    document.getElementById('tabLive').classList.toggle('active', type === 'live');
    document.getElementById('tabVod').classList.toggle('active', type === 'vod');
    document.getElementById('tabSeries').classList.toggle('active', type === 'series');
    IPTV.activeCat = 'all';
    IPTV.activeLang = 'all';
    iptvFilter();
    iptvRenderAll();
}

// ── Toggle Favorite ─────────────────────────────────────
function iptvToggleFav(url, btn) {
    const idx = IPTV.favorites.indexOf(url);
    if (idx > -1) {
        IPTV.favorites.splice(idx, 1);
        if (btn) btn.style.color = 'rgba(255,255,255,0.7)';
    } else {
        IPTV.favorites.push(url);
        if (btn) btn.style.color = '#ffd700';
    }
    localStorage.setItem('rm_iptv_favs', JSON.stringify(IPTV.favorites));
    if (IPTV.activeSrc === 'fav') { iptvFilter(); iptvRenderGrid(); }
    iptvRenderSidebar();
}

// ── Selection Mode ──────────────────────────────────────
function iptvToggleSelectionMode() {
    IPTV.selectionMode = !IPTV.selectionMode;
    if (!IPTV.selectionMode) IPTV.selectedChannels = [];
    const btn = document.getElementById('iptvSelectBtn');
    if (btn) {
        btn.classList.toggle('active', IPTV.selectionMode);
        btn.textContent = IPTV.selectionMode ? '✕ إنهاء التحديد' : '☑ تحديد';
    }
    iptvRenderGrid();
}

function iptvToggleSelect(url) {
    const idx = IPTV.selectedChannels.indexOf(url);
    if (idx > -1) IPTV.selectedChannels.splice(idx, 1);
    else IPTV.selectedChannels.push(url);
    _updateSelectionBar();
    // Update card visually
    iptvRenderGrid();
}

function iptvClearSelection() {
    IPTV.selectedChannels = [];
    _updateSelectionBar();
    iptvRenderGrid();
}

function _updateSelectionBar() {
    const bar = document.getElementById('iptvSelectionBar');
    const cnt = document.getElementById('iptvSelCount');
    if (!bar) return;
    if (IPTV.selectionMode && IPTV.selectedChannels.length > 0) {
        bar.classList.remove('hidden');
        if (cnt) cnt.textContent = `${IPTV.selectedChannels.length} قناة محددة`;
    } else {
        bar.classList.add('hidden');
    }
}

// ── Playlist Management ─────────────────────────────────
function openCreatePlaylistModal() {
    const name = prompt('أدخل اسم قائمة التشغيل الجديدة:');
    if (name && name.trim()) createPlaylist(name.trim());
}

function createPlaylist(name) {
    const pl = { id: 'playlist_' + Date.now(), name, channels: [] };
    IPTV.playlists.push(pl);
    iptvSavePlaylists();
    iptvRenderSidebar();
    if (typeof showToast === 'function') showToast(`✅ تم إنشاء قائمة "${name}"`);
}

function deletePlaylist(id) {
    const pl = IPTV.playlists.find(p => p.id === id);
    if (!pl || !confirm(`هل تريد حذف قائمة "${pl.name}"؟`)) return;
    IPTV.playlists = IPTV.playlists.filter(p => p.id !== id);
    if (IPTV.activeSrc === id) { IPTV.activeSrc = 'all'; iptvFilter(); }
    iptvSavePlaylists();
    iptvRenderSidebar();
    if (IPTV.activeSrc === 'all') iptvRenderGrid();
}

function addChannelToPlaylist(url, playlistId) {
    const pl = IPTV.playlists.find(p => p.id === playlistId);
    if (!pl) return;
    if (pl.channels.includes(url)) {
        if (typeof showToast === 'function') showToast('⚠️ القناة موجودة بالفعل في هذه القائمة');
        return;
    }
    pl.channels.push(url);
    iptvSavePlaylists();
    iptvRenderSidebar();
    if (typeof showToast === 'function') showToast(`✅ تمت الإضافة إلى "${pl.name}"`);
}

function iptvAddSelectionToPlaylist() {
    if (IPTV.selectedChannels.length === 0) return;
    _showPlaylistPickerModal(IPTV.selectedChannels);
}

// ── Playlist Picker (floating menu or modal) ─────────────
function showPlaylistPicker(ch, evt) {
    _showPlaylistPickerModal([ch.url]);
}

function _showPlaylistPickerModal(urls) {
    const existing = document.getElementById('iptvPlaylistPickerModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'iptvPlaylistPickerModal';
    modal.className = 'pl-picker-overlay';
    modal.onclick = e => { if (e.target === modal) modal.remove(); };

    const box = document.createElement('div');
    box.className = 'pl-picker-box';
    box.innerHTML = `
      <div class="pl-picker-header">
        <span>إضافة إلى قائمة تشغيل</span>
        <button onclick="document.getElementById('iptvPlaylistPickerModal').remove()">✕</button>
      </div>
      <div class="pl-picker-body">
        ${IPTV.playlists.length === 0
            ? '<p class="pl-picker-empty">لا توجد قوائم بعد. أنشئ قائمة أولاً.</p>'
            : IPTV.playlists.map(pl => `
              <button class="pl-picker-item" onclick="_addUrlsToPlaylist(${JSON.stringify(urls).replace(/"/g, '&quot;')}, '${pl.id}', this.closest('.pl-picker-overlay'))">
                <span>📋</span>
                <span>${escHtml(pl.name)}</span>
                <span class="pl-picker-count">${pl.channels.length}</span>
              </button>`).join('')
        }
      </div>
      <div class="pl-picker-footer">
        <button class="ctrl-btn accent" onclick="_createAndAddToPlaylist(${JSON.stringify(urls).replace(/"/g, '&quot;')}, this.closest('.pl-picker-overlay'))">+ إنشاء قائمة جديدة</button>
      </div>`;

    modal.appendChild(box);
    document.body.appendChild(modal);
}

function _addUrlsToPlaylist(urls, playlistId, overlay) {
    const pl = IPTV.playlists.find(p => p.id === playlistId);
    if (!pl) return;
    let added = 0;
    urls.forEach(url => { if (!pl.channels.includes(url)) { pl.channels.push(url); added++; } });
    iptvSavePlaylists();
    iptvRenderSidebar();
    if (overlay) overlay.remove();
    if (IPTV.selectionMode) { IPTV.selectedChannels = []; _updateSelectionBar(); iptvRenderGrid(); }
    if (typeof showToast === 'function') showToast(`✅ تمت إضافة ${added} قناة إلى "${pl.name}"`);
}

function _createAndAddToPlaylist(urls, overlay) {
    const name = prompt('اسم القائمة الجديدة:');
    if (!name || !name.trim()) return;
    const pl = { id: 'playlist_' + Date.now(), name: name.trim(), channels: [] };
    IPTV.playlists.push(pl);
    _addUrlsToPlaylist(urls, pl.id, overlay);
}

// =====================================================
// SOURCE MANAGEMENT
// =====================================================
let _srcTab = 'xtream';
let _m3uTab = 'url';

function openSourceModal() {
    iptvRenderSavedSources();
    document.getElementById('sourceModal').classList.remove('hidden');
}
function closeSourceModal() { document.getElementById('sourceModal').classList.add('hidden'); }
function handleSourceOverlayClick(e) { if (e.target === document.getElementById('sourceModal')) closeSourceModal(); }

function switchSrcTab(tab) {
    _srcTab = tab;
    document.getElementById('xtreamForm').classList.toggle('hidden', tab !== 'xtream');
    document.getElementById('m3uForm').classList.toggle('hidden', tab !== 'm3u');
    document.getElementById('tabXtream').classList.toggle('active', tab === 'xtream');
    document.getElementById('tabM3u').classList.toggle('active', tab === 'm3u');
}
function switchM3UTab(tab) {
    _m3uTab = tab;
    document.getElementById('m3uUrlArea').classList.toggle('hidden', tab !== 'url');
    document.getElementById('m3uFileArea').classList.toggle('hidden', tab !== 'file');
    document.getElementById('m3uTabUrl').classList.toggle('active', tab === 'url');
    document.getElementById('m3uTabFile').classList.toggle('active', tab === 'file');
}

function iptvRenderSavedSources() {
    const el = document.getElementById('savedSourcesList');
    if (!el) return;
    if (!IPTV.sources.length) { el.innerHTML = ''; return; }
    el.innerHTML = `
    <div class="saved-sources">
      <div class="saved-sources-title">المصادر المضافة</div>
      ${IPTV.sources.map(s => `
        <div class="saved-source-item">
          <span class="src-icon">${s.type === 'xtream' ? '🌐' : '📋'}</span>
          <span class="src-name">${escHtml(s.name)}</span>
          <span class="src-count">${(s.channels || []).length} قناة</span>
          <button class="src-delete" onclick="iptvDeleteSrc('${s.id}')" title="حذف">🗑️</button>
        </div>`).join('')}
    </div><hr style="border-color:var(--glass-border);margin:12px 0"/>`;
}

function iptvDeleteSrc(id) {
    if (!confirm('هل تريد حذف هذا المصدر؟')) return;
    IPTV.sources = IPTV.sources.filter(s => s.id !== id);
    iptvSave();
    IPTV.activeSrc = 'all';
    IPTV.activeCat = 'all';
    iptvBuild();
    iptvRenderSavedSources();
}

// ── Add Xtream Source ───────────────────────────────────
async function addXtreamSource() {
    const host = document.getElementById('xtreamHost').value.trim().replace(/\/$/, '');
    const user = document.getElementById('xtreamUser').value.trim();
    const pass = document.getElementById('xtreamPass').value.trim();
    const name = document.getElementById('xtreamName').value.trim() || 'Xtream Server';
    if (!host || !user || !pass) { alert('يرجى إدخال جميع البيانات'); return; }

    const btn = document.getElementById('xtreamAddBtn');
    btn.textContent = '⏳ جاري التحميل...';
    btn.disabled = true;

    try {
        const baseUrl = `${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
        btn.textContent = '⏳ معلومات السيرفر...';
        const userRes = await fetch(baseUrl, { signal: AbortSignal.timeout(10000) }).catch(() => null);
        let userInfo = null;
        if (userRes && userRes.ok) { const ud = await userRes.json(); userInfo = ud.user_info || null; }

        btn.textContent = '⏳ تحميل القنوات...';
        const [catRes, stRes] = await Promise.all([
            fetch(baseUrl + '&action=get_live_categories', { signal: AbortSignal.timeout(15000) }),
            fetch(baseUrl + '&action=get_live_streams', { signal: AbortSignal.timeout(25000) })
        ]);
        if (!catRes.ok || !stRes.ok) throw new Error('فشل جلب القنوات المباشرة');
        const cats = await catRes.json();
        const streams = await stRes.json();
        const liveMap = {};
        (cats || []).forEach(c => { liveMap[c.category_id] = c.category_name; });

        const channels = (streams || []).map(s => ({
            id: String(s.stream_id),
            name: s.name || 'Unknown',
            logo: s.stream_icon || '',
            category: liveMap[s.category_id] || 'غير مصنف',
            url: `${host}/live/${encodeURIComponent(user)}/${encodeURIComponent(pass)}/${s.stream_id}.m3u8`,
            _stream_type: 'live'
        }));

        const newId = 'xt_' + Date.now();
        IPTV.sources.push({ id: newId, type: 'xtream', name, host, user, pass, userInfo, channels });
        await iptvSave();
        iptvBuild();
        ['xtreamHost', 'xtreamUser', 'xtreamPass', 'xtreamName'].forEach(id => document.getElementById(id).value = '');
        iptvRenderSavedSources();
        closeSourceModal();
        iptvSetSrc(newId);
        if (typeof showToast === 'function') showToast(`✅ أُضيفت القنوات. جاري تحميل الأفلام في الخلفية...`);
        _fetchXtreamVodAndSeries(newId, baseUrl, host, user, pass);
    } catch (e) {
        alert(`❌ خطأ: ${e.message}\n\nتأكد من صحة البيانات والسيرفر.`);
    } finally {
        btn.textContent = 'تحميل وإضافة';
        btn.disabled = false;
    }
}

async function _fetchXtreamVodAndSeries(sourceId, baseUrl, host, user, pass) {
    try {
        await new Promise(r => setTimeout(r, 2000));
        const [vodCatRes, vodStRes] = await Promise.all([
            fetch(baseUrl + '&action=get_vod_categories').catch(() => null),
            fetch(baseUrl + '&action=get_vod_streams').catch(() => null)
        ]);
        let newChannels = [];
        if (vodCatRes && vodCatRes.ok && vodStRes && vodStRes.ok) {
            const vodCats = await vodCatRes.json().catch(() => []);
            const vodStreams = await vodStRes.json().catch(() => []);
            const vodMap = {};
            (vodCats || []).forEach(c => { vodMap[c.category_id] = c.category_name; });
            (vodStreams || []).forEach(s => {
                newChannels.push({
                    id: String(s.stream_id), name: s.name || 'Unknown',
                    logo: s.stream_icon || '', category: vodMap[s.category_id] || 'غير مصنف',
                    url: `${host}/movie/${encodeURIComponent(user)}/${encodeURIComponent(pass)}/${s.stream_id}.${s.container_extension || 'mp4'}`,
                    _stream_type: 'vod'
                });
            });
            if (typeof showToast === 'function') showToast(`🎬 تم جلب الأفلام. جاري المسلسلات...`);
        }
        await new Promise(r => setTimeout(r, 2000));
        const [serCatRes, serStRes] = await Promise.all([
            fetch(baseUrl + '&action=get_series_categories').catch(() => null),
            fetch(baseUrl + '&action=get_series').catch(() => null)
        ]);
        if (serCatRes && serCatRes.ok && serStRes && serStRes.ok) {
            const serCats = await serCatRes.json().catch(() => []);
            const serStreams = await serStRes.json().catch(() => []);
            const serMap = {};
            (serCats || []).forEach(c => { serMap[c.category_id] = c.category_name; });
            (serStreams || []).forEach(s => {
                newChannels.push({
                    id: String(s.series_id), name: s.name || 'Unknown',
                    logo: s.cover || '', category: serMap[s.category_id] || 'غير مصنف',
                    url: `#series_${s.series_id}`, _stream_type: 'series'
                });
            });
            if (typeof showToast === 'function') showToast(`📺 اكتمل تحميل المسلسلات!`);
        }
        if (newChannels.length > 0) {
            const src = IPTV.sources.find(s => s.id === sourceId);
            if (src) {
                src.channels = src.channels.concat(newChannels);
                await iptvSave();
                if (IPTV.activeSrc === sourceId || IPTV.activeSrc === 'all') iptvBuild();
            }
        }
    } catch (e) { console.error('Background VOD error:', e); }
}

// ── Add M3U Source ──────────────────────────────────────
async function addM3USource() {
    const name = document.getElementById('m3uName').value.trim() || 'M3U Source';
    const btn = document.getElementById('m3uAddBtn');
    btn.textContent = '⏳ جاري التحميل...';
    btn.disabled = true;
    try {
        let content = '';
        if (_m3uTab === 'url') {
            const url = document.getElementById('m3uUrl').value.trim();
            if (!url) throw new Error('يرجى إدخال رابط M3U');
            const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
            if (!res.ok) throw new Error('فشل تحميل الملف');
            content = await res.text();
        } else {
            if (!window._m3uContent) throw new Error('يرجى اختيار ملف M3U أولاً');
            content = window._m3uContent;
        }
        const channels = parseM3U(content);
        if (!channels.length) throw new Error('لم يتم العثور على قنوات في الملف');
        IPTV.sources.push({ id: 'm3u_' + Date.now(), type: 'm3u', name, channels });
        iptvSave();
        iptvBuild();
        ['m3uName', 'm3uUrl'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('m3uFileInput').value = '';
        window._m3uContent = null;
        iptvRenderSavedSources();
        alert(`✅ تمت إضافة ${channels.length} قناة بنجاح!`);
    } catch (e) {
        alert(`❌ ${e.message}`);
    } finally {
        btn.textContent = 'إضافة المصدر';
        btn.disabled = false;
    }
}

function handleM3UFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = ev => { window._m3uContent = ev.target.result; };
    r.readAsText(file, 'utf-8');
}

// ── M3U Parser (with language extraction) ──────────────
function parseM3U(content) {
    const lines = content.replace(/\r/g, '').split('\n');
    const channels = [];
    let cur = null;
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith('#EXTINF')) {
            const nameM = line.match(/,([^,]+)$/);
            const logoM = line.match(/tvg-logo="([^"]*)"/);
            const groupM = line.match(/group-title="([^"]*)"/);
            const tvgN = line.match(/tvg-name="([^"]*)"/);
            const tvgLang = line.match(/tvg-language="([^"]*)"/);
            const tvgCountry = line.match(/tvg-country="([^"]*)"/);
            cur = {
                id: 'ch_' + channels.length,
                name: (tvgN?.[1] || nameM?.[1] || 'Unknown').trim(),
                logo: logoM?.[1] || '',
                category: groupM?.[1] || 'غير مصنف',
                url: '',
                _lang: tvgLang?.[1] || null,
                _country: tvgCountry?.[1] || null,
            };
        } else if (/^https?:|^rtmp:|^rtsp:/.test(line)) {
            if (cur) { cur.url = line; channels.push(cur); cur = null; }
        }
    }
    return channels;
}

// =====================================================
// VIDEO PLAYER
// =====================================================
function iptvChangePlayer(val) {
    IPTV.playerChoice = val;
    localStorage.setItem('rm_iptv_player', val);
}

function iptvPlay(idx) {
    const ch = IPTV.filtered[idx];
    if (!ch) return;
    if (ch.url && ch.url.startsWith('#series_')) { playSeriesFirstEpisode(ch); return; }

    if (IPTV.playerChoice === 'vlc') {
        window.open('vlc://' + ch.url, '_self');
        if (typeof showToast === 'function') showToast(`🟠 جاري فتح ${ch.name} في VLC (ويندوز)...`);
        return;
    } else if (IPTV.playerChoice === 'vlc_android') {
        // VLC Android Intent
        const vlcUrl = `intent:${ch.url}#Intent;package=org.videolan.vlc;type=video/*;S.title=${encodeURIComponent(ch.name)};end`;
        window.location.href = vlcUrl;
        if (typeof showToast === 'function') showToast(`🧡 جاري فتح ${ch.name} في VLC (أندرويد)...`);
        return;
    } else if (IPTV.playerChoice === 'mx_android') {
        // MX Player Android Intent
        const mxUrl = `intent:${ch.url}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encodeURIComponent(ch.name)};end`;
        window.location.href = mxUrl;
        if (typeof showToast === 'function') showToast(`💚 جاري فتح ${ch.name} في MX Player (أندرويد)...`);
        return;
    } else if (IPTV.playerChoice === 'potplayer') {
        window.open('potplayer://' + ch.url, '_self');
        if (typeof showToast === 'function') showToast(`🟡 جاري فتح ${ch.name} في PotPlayer (ويندوز)...`);
        return;
    } else if (IPTV.playerChoice === 'external') {
        // Direct link to trigger system player (Best for Mobile)
        const a = document.createElement('a');
        a.href = ch.url;
        a.target = '_blank';
        a.click();
        if (typeof showToast === 'function') showToast(`🔵 جاري فتح ${ch.name} في المشغل الافتراضي...`);
        return;
    }

    IPTV.currentCh = ch;
    const overlay = document.getElementById('iptvPlayerOverlay');
    overlay.classList.remove('hidden');
    document.getElementById('playerChName').textContent = ch.name;
    const logo = document.getElementById('playerChLogo');
    if (ch.logo) { logo.src = ch.logo; logo.style.display = 'block'; logo.onerror = () => { logo.style.display = 'none'; }; }
    else { logo.style.display = 'none'; }
    document.getElementById('playerErrMsg').classList.add('hidden');
    document.getElementById('iptvVideo').style.display = 'block';
    _iptvLoadStream(ch.url);
}

async function playSeriesFirstEpisode(ch) {
    const srcId = ch._xtream_src;
    if (!srcId) return;
    const src = IPTV.sources.find(s => s.id === srcId);
    if (!src) return;
    const seriesId = ch.url.split('_')[1];
    const baseUrl = `${src.host}/player_api.php?username=${encodeURIComponent(src.user)}&password=${encodeURIComponent(src.pass)}`;
    try {
        const res = await fetch(baseUrl + '&action=get_series_info&series_id=' + seriesId);
        const data = await res.json();
        let firstEp = null;
        if (data.episodes) {
            for (const sKey in data.episodes) {
                if (data.episodes[sKey] && data.episodes[sKey].length > 0) { firstEp = data.episodes[sKey][0]; break; }
            }
        }
        if (firstEp && firstEp.id) {
            const epUrl = `${src.host}/series/${encodeURIComponent(src.user)}/${encodeURIComponent(src.pass)}/${firstEp.id}.${firstEp.container_extension || 'mp4'}`;
            const epName = `${ch.name} - S${firstEp.season} E${firstEp.episode_num}`;
            
            if (IPTV.playerChoice === 'vlc') {
                window.open('vlc://' + epUrl, '_self');
                if (typeof showToast === 'function') showToast(`🟠 جاري فتح ${epName} في VLC...`);
                return;
            } else if (IPTV.playerChoice === 'potplayer') {
                window.open('potplayer://' + epUrl, '_self');
                if (typeof showToast === 'function') showToast(`🟡 جاري فتح ${epName} في PotPlayer...`);
                return;
            }

            IPTV.currentCh = { name: epName, url: epUrl, logo: ch.logo };
            const overlay = document.getElementById('iptvPlayerOverlay');
            overlay.classList.remove('hidden');
            document.getElementById('playerChName').textContent = IPTV.currentCh.name;
            const logo = document.getElementById('playerChLogo');
            if (IPTV.currentCh.logo) { logo.src = IPTV.currentCh.logo; logo.style.display = 'block'; logo.onerror = () => { logo.style.display = 'none'; }; }
            else { logo.style.display = 'none'; }
            document.getElementById('playerErrMsg').classList.add('hidden');
            document.getElementById('iptvVideo').style.display = 'block';
            _iptvLoadStream(epUrl);
        } else { alert('لا توجد حلقات متاحة لهذا المسلسل'); }
    } catch (e) { alert('فشل جلب الحلقات'); }
}

function _iptvLoadStream(url) {
    const video = document.getElementById('iptvVideo');
    if (IPTV.hls) { IPTV.hls.destroy(); IPTV.hls = null; }
    
    // ── Mixed Content Handling ──
    // If the page is HTTPS, browsers block HTTP requests.
    // We try to upgrade http:// to https:// if possible.
    let streamUrl = url;
    const isHttpsPage = window.location.protocol === 'https:';
    if (isHttpsPage && streamUrl.startsWith('http:')) {
        // Only try to upgrade if it's not a direct IP (most IPs don't have SSL)
        const isIP = /http:\/\/(\d{1,3}\.){3}\d{1,3}/.test(streamUrl);
        if (!isIP) {
            streamUrl = streamUrl.replace('http:', 'https:');
            console.log("Upgraded stream to HTTPS for secure page context:", streamUrl);
        } else {
            console.warn("Stream is on an IP address with HTTP. This may be blocked by browser on HTTPS page.");
            if (typeof showToast === 'function') {
                showToast('⚠️ تنبيه: القناة تعمل برابط غير آمن (HTTP) وقد يمنع المتصفح تشغيلها على GitHub');
            }
        }
    }

    // Clear video element before loading new source
    video.pause();
    video.removeAttribute('src');
    video.load();

    const isHls = streamUrl.includes('.m3u8') || streamUrl.includes('/live/') || streamUrl.includes('type=m3u8');
    
    if (isHls && typeof Hls !== 'undefined') {
        if (Hls.isSupported()) {
            const hls = new Hls({ 
                enableWorker: true, 
                lowLatencyMode: true, 
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                startLevel: -1,
                abrEwmaDefaultEstimate: 500000,
                // Add more robust error handling
                xhrSetup: function(xhr, url) {
                    xhr.withCredentials = false; // Important for some IPTV providers
                }
            });
            
            hls.on(Hls.Events.ERROR, function (event, data) {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error("Fatal network error encountered, try to recover");
                            // If initial load failed and we upgraded to HTTPS, maybe fallback to HTTP if possible?
                            // But browsers will block it anyway.
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.error("Fatal media error encountered, try to recover");
                            hls.recoverMediaError();
                            break;
                        default:
                            console.error("Fatal error, cannot recover");
                            hls.destroy();
                            _iptvShowErr();
                            break;
                    }
                }
            });

            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(e => {
                    console.warn("Autoplay blocked or failed:", e);
                });
            });
            IPTV.hls = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari/iOS)
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(e => console.warn("Native HLS play failed:", e));
            });
            video.onerror = _iptvShowErr;
        } else {
            _iptvShowErr("المتصفح لا يدعم تشغيل HLS");
        }
    } else {
        // Direct stream (MP4/MKV etc)
        video.src = streamUrl;
        video.play().catch(e => console.warn("Direct play failed:", e));
        video.onerror = _iptvShowErr;
    }
}

function _iptvShowErr(customMsg, isMixedContent) {
    const errPanel = document.getElementById('playerErrMsg');
    const errText = document.getElementById('playerErrText');
    const mixedHelp = document.getElementById('mixedContentHelp');
    
    if (customMsg && errText) errText.textContent = customMsg;
    else if (errText) errText.textContent = "تعذّر تشغيل هذه القناة. تأكد من صحة الرابط أو جرّب قناة أخرى.";
    
    if (mixedHelp) {
        if (isMixedContent || (window.location.protocol === 'https:' && IPTV.currentCh && IPTV.currentCh.url.startsWith('http:'))) {
            mixedHelp.classList.remove('hidden');
        } else {
            mixedHelp.classList.add('hidden');
        }
    }
    
    errPanel.classList.remove('hidden');
    document.getElementById('iptvVideo').style.display = 'none';
}

function closeIPTVPlayer() {
    const video = document.getElementById('iptvVideo');
    video.pause(); video.src = ''; video.style.display = 'block';
    if (IPTV.hls) { IPTV.hls.destroy(); IPTV.hls = null; }
    document.getElementById('iptvPlayerOverlay').classList.add('hidden');
    document.getElementById('playerErrMsg').classList.add('hidden');
    const mixedHelp = document.getElementById('mixedContentHelp');
    if (mixedHelp) mixedHelp.classList.add('hidden');
    IPTV.currentCh = null;
}

function toggleIPTVFs() {
    const el = document.getElementById('iptvPlayerOverlay');
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => { });
    else document.exitFullscreen().catch(() => { });
}
