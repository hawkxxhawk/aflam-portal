/* ====================================================
   🔍 محرك البحث الداخلي — search.js
   بحث متقدم عن الأفلام والمواقع مع دعم العربية
   ==================================================== */

// ── State ────────────────────────────────────────────────────────────
const SearchEngine = {
  isActive: false,
  query: '',
  results: [],
  selectedIndex: -1,
  
  // تنظيف النصوص العربية للبحث
  normalizeArabicText: function(text) {
    if (!text) return '';
    // إزالة التشكيل
    text = text.replace(/[\u064B-\u065F]/g, '');
    // توحيد بعض الأحرف العربية
    text = text.replace(/أ|إ|آ/g, 'ا');
    text = text.replace(/ى/g, 'ي');
    text = text.replace(/ة/g, 'ه');
    return text.trim().toLowerCase();
  },

  // البحث في النصوص (العربية والإنجليزية)
  searchText: function(haystack, needle) {
    if (!haystack || !needle) return false;
    
    const normalizedHaystack = this.normalizeArabicText(haystack);
    const normalizedNeedle = this.normalizeArabicText(needle);
    
    return normalizedHaystack.includes(normalizedNeedle);
  },

  // البحث الرئيسي في جميع الأفلام والمواقع
  search: function(query) {
    if (!query || query.trim().length === 0) {
      this.results = [];
      this.selectedIndex = -1;
      this.hideResults();
      return [];
    }

    this.query = query.trim();
    this.selectedIndex = -1;
    const results = [];

    // البحث في جميع الاختصارات (المواقع/الأفلام)
    if (shortcuts && shortcuts.length > 0) {
      shortcuts.forEach(shortcut => {
        let match = false;
        let matchReason = '';

        // البحث في الاسم
        if (this.searchText(shortcut.name, this.query)) {
          match = true;
          matchReason = 'name';
        }
        // البحث في الرابط
        else if (this.searchText(shortcut.url, this.query)) {
          match = true;
          matchReason = 'url';
        }
        // البحث في الفئة
        else if (shortcut.categoryId && this.searchText(shortcut.categoryId, this.query)) {
          match = true;
          matchReason = 'category';
        }

        if (match) {
          // حساب ترتيب العنصر في مجلده
          const positionInFolder = this.getItemPosition(shortcut);
          // الحصول على اسم المجلد
          const folderName = this.getFolderName(shortcut.categoryId);
          // تحديد نوع القسم (أفلام/مواقع)
          const sectionType = this.getItemSectionType(shortcut.categoryId);

          results.push({
            id: shortcut.id,
            name: shortcut.name,
            url: shortcut.url,
            color: shortcut.color || '#1a1a2e',
            emoji: shortcut.emoji || '🎬',
            image: shortcut.image || null,
            bgImage: shortcut.bgImage || null,
            borderColor: shortcut.borderColor || 'transparent',
            isFavorited: shortcut.isFavorited || false,
            categoryId: shortcut.categoryId,
            folderName: folderName,
            positionInFolder: positionInFolder,
            sectionType: sectionType,
            matchReason: matchReason,
            type: 'shortcut'
          });
        }
      });
    }

    // ترتيب النتائج: النتيجة في الاسم أولاً، ثم الرابط، ثم الفئة
    results.sort((a, b) => {
      const scoreA = a.matchReason === 'name' ? 3 : a.matchReason === 'url' ? 2 : 1;
      const scoreB = b.matchReason === 'name' ? 3 : b.matchReason === 'url' ? 2 : 1;
      return scoreB - scoreA;
    });

    this.results = results;
    return results;
  },

  // حساب ترتيب العنصر في مجلده
  getItemPosition: function(shortcut) {
    if (!shortcut || !shortcut.categoryId) return 0;
    const catItems = shortcuts
      .filter(s => s.categoryId === shortcut.categoryId)
      .sort((a, b) => {
        const aOrd = a.order ?? 0;
        const bOrd = b.order ?? 0;
        if (aOrd !== bOrd) return aOrd - bOrd;
        const aTime = parseInt(a.id.split('_')[1]) || 0;
        const bTime = parseInt(b.id.split('_')[1]) || 0;
        return bTime - aTime;
      });
    return catItems.findIndex(s => s.id === shortcut.id) + 1;
  },

  // الحصول على اسم المجلد
  getFolderName: function(categoryId) {
    if (!categoryId) return 'غير مصنف';
    if (typeof categories !== 'undefined' && categories) {
      const cat = categories.find(c => c.id === categoryId);
      if (cat) return cat.name;
    }
    // أسماء المجلدات الافتراضية
    const defaultNames = {
      'favorites_folder': 'المفضلة',
      'favorites_folder_2': 'المفضلة 2',
      'favorites_folder_3': 'المفضلة 3',
      'general': 'عام'
    };
    return defaultNames[categoryId] || categoryId;
  },

  // تحديد نوع القسم
  getItemSectionType: function(categoryId) {
    if (typeof window.getCategorySection === 'function') {
      const cat = (typeof categories !== 'undefined' && categories) ? categories.find(c => c.id === categoryId) : null;
      if (cat) return window.getCategorySection(cat);
    }
    if (['favorites_folder', 'favorites_folder_2', 'favorites_folder_3'].includes(categoryId)) return 'movies';
    return 'sites';
  },

  // عرض نتائج البحث
  displayResults: function() {
    const container = document.getElementById('searchResultsContainer');
    if (!container) return;

    if (this.results.length === 0) {
      container.innerHTML = `
        <div class="search-no-results">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <p>لم يتم العثور على نتائج</p>
        </div>
      `;
      return;
    }

    let html = `
      <div class="search-results-header">
        <span class="search-count">عدد النتائج: ${this.results.length}</span>
      </div>
      <div class="search-results-grid">
    `;

    this.results.forEach((result, index) => {
      const isSelected = index === this.selectedIndex;
      const selectedClass = isSelected ? 'selected' : '';
      // بناء انماط البطاقة
      const accentColor = result.color || '#e50914';
      let frameStyles = '--item-color:' + accentColor + ';';
      if (result.bgImage) {
        frameStyles += "background-image:url('" + result.bgImage + "');background-size:cover;background-position:center;";
      }
      if (result.borderColor && result.borderColor !== 'transparent') {
        const isOrange = result.borderColor === '#ffa500';
        frameStyles += 'border-color:' + result.borderColor + ';border-width:' + (isOrange ? '5px' : '3px') + ';border-style:' + (isOrange ? 'double' : 'solid') + ';';
      }
      
      html += `
        <div class="search-result-card search-folder-card ${selectedClass}" 
             data-index="${index}" data-id="${result.id}"
             onclick="SearchEngine.selectResult(${index})"
             oncontextmenu="SearchEngine.onContextMenu(event, ${index})">
          <div class="search-item-number">${result.positionInFolder}</div>
            ${result.isFavorited ? '<div class="search-item-heart">❤️</div>' : ''}
            <div class="search-fav-rect-frame" style="${frameStyles}">'#e50914'};${result.bgImage ? "background-image:url('" + result.bgImage + "');background-size:cover;background-position:center;" : ''}${result.borderColor && result.borderColor !== 'transparent' ? 'border-color:' + result.borderColor + ';border-width:' + (result.borderColor === '#ffa500' ? '5px' : '3px') + ';border-style:' + (result.borderColor === '#ffa500' ? 'double' : 'solid') + ';' : ''}">
              <div class="search-fav-rect-overlay"></div>
              <span class="search-fav-rect-name">${result.name}</span>
            </div>
            <div class="search-folder-info">
              <span class="search-folder-badge">📁 ${result.folderName || 'غير مصنف'}</span>
              <span class="search-position-badge">🔢 ${result.positionInFolder}</span>
            </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  },

  // قائمة الكليك يمين
  onContextMenu: function(e, index) {
    e.preventDefault();
    e.stopPropagation();
    if (index < 0 || index >= this.results.length) return;
    const result = this.results[index];
    if (typeof openContextMenu === 'function') {
      openContextMenu(e, result.id);
    }
  },

  // HTML escape
  escHtml: function(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // تمييز النص المطابق
  highlightMatch: function(text) {
    const normalized = this.normalizeArabicText(text);
    const normalizedQuery = this.normalizeArabicText(this.query);
    
    const index = normalized.indexOf(normalizedQuery);
    if (index === -1) return text;

    // حساب التطابق الفعلي في النص الأصلي (تقريبي)
    return text;
  },

  // اختصار الرابط الطويل
  truncateUrl: function(url) {
    if (!url) return '';
    if (url.length > 50) {
      return url.substring(0, 47) + '...';
    }
    return url;
  },

  // الحصول على تسمية نوع التطابق
  getMatchTypeLabel: function(matchReason) {
    const labels = {
      'name': '📝 الاسم',
      'url': '🔗 الرابط',
      'category': '📁 الفئة'
    };
    return labels[matchReason] || '';
  },

  // اختيار نتيجة
  selectResult: function(index) {
    if (index < 0 || index >= this.results.length) return;
    
    const result = this.results[index];
    this.selectedIndex = index;
    this.displayResults();
    
    // فتح الموقع المختار
    this.openResult(result);
  },

  // التنقل بالسهام
  navigateResults: function(direction) {
    if (this.results.length === 0) return;

    if (direction === 'down') {
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.results.length - 1);
    } else if (direction === 'up') {
      this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
    }

    this.displayResults();
    
    // التمرير إلى العنصر المختار
    const cards = document.querySelectorAll('.search-result-card');
    if (this.selectedIndex >= 0 && cards[this.selectedIndex]) {
      cards[this.selectedIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  },

  // فتح النتيجة المختارة
  openResult: function(result) {
    if (result.type === 'shortcut') {
      // محاكاة النقر على المختصر
      const shortcut = shortcuts.find(s => s.id === result.id);
      if (shortcut) {
        handleShortcutClick(shortcut, result.id);
        this.closeSearch();
      }
    }
  },

  // إظهار واجهة البحث
  showSearch: function() {
    const searchWrapper = document.getElementById('searchWrapper');
    const searchInput = document.getElementById('searchInput');
    
    if (searchWrapper && searchInput) {
      searchWrapper.classList.remove('hidden');
      searchInput.focus();
      this.isActive = true;
    }
  },

  // إخفاء واجهة البحث
  hideSearch: function() {
    const searchWrapper = document.getElementById('searchWrapper');
    if (searchWrapper) {
      searchWrapper.classList.add('hidden');
    }
    this.isActive = false;
    this.query = '';
    this.results = [];
  },

  // إظهار النتائج
  showResults: function() {
    const container = document.getElementById('searchResultsContainer');
    if (container) {
      container.classList.remove('hidden');
    }
  },

  // إخفاء النتائج
  hideResults: function() {
    const container = document.getElementById('searchResultsContainer');
    if (container) {
      container.classList.add('hidden');
    }
  },

  // إغلاق البحث
  closeSearch: function() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = '';
    }
    this.hideSearch();
    this.hideResults();
  },

  // تغيير حدث الإدخال
  onInputChange: function(event) {
    const query = event.target.value;
    
    if (query.length === 0) {
      this.hideResults();
      return;
    }

    this.search(query);
    
    if (this.results.length > 0) {
      this.displayResults();
      this.showResults();
    } else {
      this.displayResults(); // عرض رسالة عدم وجود نتائج
      this.showResults();
    }
  },

  // معالجة المفاتيح
  onKeyDown: function(event) {
    if (!this.isActive) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.navigateResults('down');
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.navigateResults('up');
        break;
      case 'Enter':
        event.preventDefault();
        if (this.selectedIndex >= 0) {
          this.selectResult(this.selectedIndex);
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.closeSearch();
        break;
    }
  },

  // تفعيل البحث (عند الضغط على الزر)
  activate: function() {
    this.showSearch();
  }
};

// ── تهيئة البحث عند تحميل الصفحة ────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('searchInput');
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => SearchEngine.onInputChange(e));
    searchInput.addEventListener('keydown', (e) => SearchEngine.onKeyDown(e));
  }

  // إغلاق البحث عند النقر خارج النطاق
  document.addEventListener('click', function(e) {
    const searchWrapper = document.getElementById('searchWrapper');
    const searchBtn = document.getElementById('searchBtn');
    
    if (searchWrapper && searchBtn) {
      if (!searchWrapper.contains(e.target) && !searchBtn.contains(e.target)) {
        if (!e.target.classList.contains('search-result-item')) {
          SearchEngine.hideResults();
        }
      }
    }
  });
});

// ── دالة مساعدة لفتح المختصر ────────────────────────────────────────
function handleShortcutClick(shortcut, id) {
  // استخدام الدالة openSite من app.js
  if (typeof openSite === 'function') {
    openSite(shortcut);
  }
}
