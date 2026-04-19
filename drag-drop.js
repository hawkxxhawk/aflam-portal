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

// Initialize drag and drop when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setupDragAndDrop();
});
