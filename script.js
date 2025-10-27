// Parse a line from the links file
function parseLink(line) {
    line = line.trim();
    if (!line) return null;

    // Split by spaces, but handle quoted strings
    const parts = line.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

    if (parts.length === 0) return null;

    const url = parts[0];
    let displayName = parts[1] || '';
    let imagePath = parts[2] || '';

    // Remove quotes if present
    displayName = displayName.replace(/^"(.*)"$/, '$1');
    imagePath = imagePath.replace(/^"(.*)"$/, '$1');

    // If no display name, extract from URL
    if (!displayName) {
        try {
            const urlObj = new URL(url);
            displayName = urlObj.hostname.replace(/^www\./, '').split('.')[0];
        } catch (e) {
            displayName = 'Link';
        }
    }

    return { url, displayName, imagePath };
}

// Get favicon URL for a domain
function getFaviconUrl(url, imagePath) {
    // If custom image path is provided and exists, use it
    if (imagePath && imagePath.trim()) {
        return `icons/${imagePath}`;
    }

    // Otherwise, use Google's favicon service
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    } catch (e) {
        return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="%23666"/></svg>';
    }
}

// Create an icon element for the launcher grid
function createLauncherIcon(linkData) {
    const container = document.createElement('a');
    container.className = 'icon-container';
    container.href = linkData.url;
    container.target = '_blank';
    container.rel = 'noopener noreferrer';

    const iconImage = document.createElement('div');
    iconImage.className = 'icon-image';

    const img = document.createElement('img');
    img.src = getFaviconUrl(linkData.url, linkData.imagePath);
    img.alt = linkData.displayName;
    img.onerror = function() {
        // Fallback to a different favicon service if Google fails
        this.onerror = null;
        this.src = `https://icons.duckduckgo.com/ip3/${new URL(linkData.url).hostname}.ico`;
    };

    iconImage.appendChild(img);

    const label = document.createElement('div');
    label.className = 'icon-label';
    label.textContent = linkData.displayName;

    container.appendChild(iconImage);
    container.appendChild(label);

    return container;
}

// Create a panel icon
function createPanelIcon(linkData) {
    const icon = document.createElement('a');
    icon.className = 'panel-icon';
    icon.href = linkData.url;
    icon.target = '_blank';
    icon.rel = 'noopener noreferrer';
    icon.title = linkData.displayName;

    const img = document.createElement('img');
    img.src = getFaviconUrl(linkData.url, linkData.imagePath);
    img.alt = linkData.displayName;
    img.onerror = function() {
        this.onerror = null;
        this.src = `https://icons.duckduckgo.com/ip3/${new URL(linkData.url).hostname}.ico`;
    };

    icon.appendChild(img);

    return icon;
}

// Load and parse a links file
async function loadLinks(filename) {
    try {
        const response = await fetch(filename);
        const text = await response.text();
        const lines = text.split('\n');

        const links = [];
        for (const line of lines) {
            const linkData = parseLink(line);
            if (linkData) {
                links.push(linkData);
            }
        }

        return links;
    } catch (error) {
        console.error(`Error loading ${filename}:`, error);
        return [];
    }
}

// Update clock
function updateClock() {
    const now = new Date();

    // Format time as hh:mm a (e.g., 02:30 PM)
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;

    // Format date as E, M/d (e.g., Mon, 10/26)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[now.getDay()];
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const dateStr = `${dayName}, ${month}/${day}`;

    // Combine: hh:mm a | E, M/d
    const clockElement = document.getElementById('clock');
    if (clockElement) {
        clockElement.textContent = `${timeStr} | ${dateStr}`;
    }
}

// Set random background image
async function setRandomBackground() {
    try {
        const response = await fetch('backgrounds/backgrounds.txt');
        const text = await response.text();
        const backgrounds = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        if (backgrounds.length > 0) {
            const randomIndex = Math.floor(Math.random() * backgrounds.length);
            const selectedBackground = backgrounds[randomIndex];
            document.body.style.backgroundImage = `url('backgrounds/${selectedBackground}')`;
        }
    } catch (error) {
        console.error('Error loading backgrounds:', error);
    }
}


// Mac-style dock effect - generic function
function setupDockEffect(container, iconSelector, maxDistance = 150, maxScale = 0.3) {
    const icons = container.querySelectorAll(iconSelector);

    let mouseX = 0;
    let mouseY = 0;
    let isHovering = false;

    container.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        isHovering = true;
        updateIconScales();
    });

    container.addEventListener('mouseleave', () => {
        isHovering = false;
        // Reset all icons to normal size
        icons.forEach(icon => {
            icon.style.transform = 'scale(1)';
            icon.style.filter = '';

            // Reset backdrop blur to default
            const iconImage = icon.querySelector('.icon-image');
            if (iconImage) {
                iconImage.style.backdropFilter = 'blur(1.5px)';
                iconImage.style.webkitBackdropFilter = 'blur(1.5px)';
            }
        });
    });

    function updateIconScales() {
        if (!isHovering) return;

        icons.forEach(icon => {
            const rect = icon.getBoundingClientRect();
            const iconCenterX = rect.left + rect.width / 2;
            const iconCenterY = rect.top + rect.height / 2;

            // Calculate distance from mouse to icon center
            const distanceX = mouseX - iconCenterX;
            const distanceY = mouseY - iconCenterY;
            const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

            // Calculate scale based on distance
            let scale = 1;
            let shadowBlur = 8;
            let shadowSpread = 4;
            let backdropBlur = 1.5;
            let proximity = 0;

            if (distance < maxDistance) {
                // Scale ranges from 1 to 1 + maxScale
                proximity = 1 - (distance / maxDistance);
                scale = 1 + (proximity * maxScale);
                // Increased shadow intensity
                shadowBlur = 8 + (proximity * 25);
                shadowSpread = 4 + (proximity * 10);
                // Increase backdrop blur from 1.5px to 3px
                backdropBlur = 1.5 + (proximity * 1.5);
            }

            icon.style.transform = `scale(${scale})`;
            icon.style.filter = `drop-shadow(0 ${shadowSpread}px ${shadowBlur}px rgba(0, 0, 0, ${0.4 + proximity * 0.3}))`;

            // Update backdrop blur on the icon-image element (launcher icons only)
            const iconImage = icon.querySelector('.icon-image');
            if (iconImage) {
                iconImage.style.backdropFilter = `blur(${backdropBlur}px)`;
                iconImage.style.webkitBackdropFilter = `blur(${backdropBlur}px)`;
            }
        });
    }
}

// Click animation effect
function setupClickAnimation(container, iconSelector) {
    const icons = container.querySelectorAll(iconSelector);

    icons.forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.preventDefault();

            const originalTransform = icon.style.transform || 'scale(1)';
            const href = icon.href;

            // Shrink animation
            icon.style.transition = 'transform 0.08s ease-out';
            icon.style.transform = 'scale(0.85)';

            setTimeout(() => {
                // Grow back animation
                icon.style.transform = originalTransform;

                setTimeout(() => {
                    // Navigate to link
                    if (href) {
                        window.open(href, icon.target || '_self');
                    }
                }, 80);
            }, 80);
        });
    });
}

// Global storage for all links
let allLinks = [];
let bookmarks = [];
let bookmarkStructure = null;
let isSearchMode = false;
let isBrowserMode = false;

// Parse bookmark structure with folders
function parseBookmarkStructure(doc) {
    const structure = {
        name: 'Bookmarks',
        type: 'folder',
        children: []
    };

    const body = doc.body;
    if (body) {
        // Parse top-level folders and links
        const topLevelH3s = body.querySelectorAll(':scope > dt > h3, body > h3');

        topLevelH3s.forEach(h3 => {
            const folder = {
                name: h3.textContent.trim(),
                type: 'folder',
                children: []
            };
            structure.children.push(folder);

            // Find the next DL sibling that contains this folder's contents
            let nextEl = h3.parentElement.nextElementSibling;
            if (nextEl && nextEl.tagName === 'DL') {
                // Get direct child DTs of this DL only
                const directDTs = Array.from(nextEl.children).filter(el => el.tagName === 'DT');

                directDTs.forEach(dt => {
                    // Check if this DT contains a nested folder (H3)
                    const nestedH3 = dt.querySelector(':scope > h3');
                    if (nestedH3) {
                        // This is a nested folder
                        const nestedFolder = {
                            name: nestedH3.textContent.trim(),
                            type: 'folder',
                            children: []
                        };
                        folder.children.push(nestedFolder);

                        // Find nested DL for this subfolder
                        let nestedDL = dt.nextElementSibling;
                        if (nestedDL && nestedDL.tagName === 'DL') {
                            const nestedLinks = nestedDL.querySelectorAll('dt > a[href]');
                            nestedLinks.forEach(link => {
                                if (link.href && link.href.startsWith('http')) {
                                    nestedFolder.children.push({
                                        name: link.textContent.trim(),
                                        url: link.href,
                                        type: 'link'
                                    });
                                }
                            });
                        }
                    } else {
                        // This is a link
                        const link = dt.querySelector(':scope > a[href]');
                        if (link && link.href && link.href.startsWith('http')) {
                            folder.children.push({
                                name: link.textContent.trim(),
                                url: link.href,
                                type: 'link'
                            });
                        }
                    }
                });
            }
        });

        // Also get root-level links (not in any folder)
        const rootLinks = body.querySelectorAll(':scope > dt > a[href]');
        rootLinks.forEach(link => {
            if (link.href && link.href.startsWith('http')) {
                structure.children.push({
                    name: link.textContent.trim(),
                    url: link.href,
                    type: 'link'
                });
            }
        });
    }

    console.log('Parsed bookmark structure:', structure);
    return structure;
}

// Parse bookmark HTML files
async function loadBookmarks() {
    try {
        let possibleFiles = [];

        // First try to read an index file that lists bookmark HTML files
        try {
            const indexResponse = await fetch('bookmarks/index.txt');
            if (indexResponse.ok) {
                const indexText = await indexResponse.text();
                possibleFiles = indexText.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));
            }
        } catch (e) {
            // Index file doesn't exist, use defaults
        }

        // If no index file, try common bookmark filenames including date-based patterns
        if (possibleFiles.length === 0) {
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

            possibleFiles = [
                `${dateStr}.html`,  // Today's date
                'bookmarks.html',
                'Bookmarks.html',
                'firefox-bookmarks.html',
                'chrome-bookmarks.html',
                'export.html'
            ];
        }

        // Try each file in order
        for (const filename of possibleFiles) {
            try {
                const response = await fetch(`bookmarks/${filename}`);
                if (response.ok) {
                    const html = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const links = doc.querySelectorAll('a[href]');

                    const bookmarkList = [];
                    links.forEach(link => {
                        const url = link.href;
                        const title = link.textContent.trim();
                        if (url && title && url.startsWith('http')) {
                            bookmarkList.push({
                                url: url,
                                displayName: title,
                                imagePath: ''
                            });
                        }
                    });

                    // Also parse folder structure
                    bookmarkStructure = parseBookmarkStructure(doc);

                    console.log(`Loaded ${bookmarkList.length} bookmarks from ${filename}`);
                    return bookmarkList;
                }
            } catch (e) {
                // Try next file
                continue;
            }
        }

        console.log('No bookmark files found');
        return [];
    } catch (error) {
        console.error('Error loading bookmarks:', error);
        return [];
    }
}

// Initialize the launcher
async function init() {
    // Set random background on load
    setRandomBackground();

    // Initialize clock
    updateClock();
    setInterval(updateClock, 1000);

    const launcherGrid = document.getElementById('launcherGrid');
    const sidePanel = document.getElementById('sidePanel');

    // Load app links
    const appLinks = await loadLinks('applinks.txt');
    appLinks.forEach(linkData => {
        const icon = createLauncherIcon(linkData);
        launcherGrid.appendChild(icon);
    });

    // Load panel links
    const panelLinks = await loadLinks('panellinks.txt');
    panelLinks.forEach(linkData => {
        const icon = createPanelIcon(linkData);
        sidePanel.appendChild(icon);
    });

    // Store all links for search
    allLinks = [...appLinks, ...panelLinks];

    // Load bookmarks
    bookmarks = await loadBookmarks();

    // Setup Mac-style dock effect for both panels
    setupDockEffect(sidePanel, '.panel-icon', 150, 0.5);
    setupDockEffect(launcherGrid, '.icon-container', 200, 0.4);

    // Setup click animations
    setupClickAnimation(sidePanel, '.panel-icon');
    setupClickAnimation(launcherGrid, '.icon-container');

    // Setup search functionality
    setupSearch();

    // Setup bookmark browser
    setupBookmarkBrowser();

    // Setup keyboard navigation
    setupKeyboardNavigation();
}

// Search functionality
function setupSearch() {
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
    const searchClose = document.getElementById('searchClose');
    const launcherGrid = document.getElementById('launcherGrid');
    const searchResults = document.getElementById('searchResults');

    // Toggle search mode
    function enterSearchMode() {
        isSearchMode = true;
        searchButton.style.display = 'none';
        searchInput.style.display = 'block';
        searchClose.style.display = 'flex';
        launcherGrid.style.display = 'none';
        searchResults.style.display = 'grid';
        searchInput.focus();
        performSearch('');
    }

    function exitSearchMode() {
        isSearchMode = false;
        searchButton.style.display = 'block';
        searchInput.style.display = 'none';
        searchClose.style.display = 'none';
        searchInput.value = '';
        launcherGrid.style.display = 'grid';
        searchResults.style.display = 'none';
        searchResults.innerHTML = '';
    }

    function performSearch(query) {
        searchResults.innerHTML = '';

        const lowerQuery = query.toLowerCase().trim();

        // First search app/panel links
        let filtered = lowerQuery === ''
            ? allLinks
            : allLinks.filter(link =>
                link.displayName.toLowerCase().includes(lowerQuery) ||
                link.url.toLowerCase().includes(lowerQuery)
            );

        // If no app matches and query is not empty, search bookmarks
        if (filtered.length === 0 && lowerQuery !== '' && bookmarks.length > 0) {
            console.log(`No app matches for "${query}", searching ${bookmarks.length} bookmarks...`);
            filtered = bookmarks.filter(link =>
                link.displayName.toLowerCase().includes(lowerQuery) ||
                link.url.toLowerCase().includes(lowerQuery)
            );
            console.log(`Found ${filtered.length} bookmark matches`);
        }

        // Debug logging
        if (lowerQuery !== '') {
            console.log(`Search query: "${query}", Apps found: ${filtered.length === allLinks.length ? 'showing all' : filtered.length}, Total bookmarks available: ${bookmarks.length}`);
        }

        filtered.forEach(linkData => {
            const icon = createLauncherIcon(linkData);
            searchResults.appendChild(icon);
        });

        // Setup effects for search results
        setupDockEffect(searchResults, '.icon-container', 200, 0.4);
        setupClickAnimation(searchResults, '.icon-container');
    }

    // Event listeners
    searchButton.addEventListener('click', enterSearchMode);
    searchClose.addEventListener('click', exitSearchMode);

    searchInput.addEventListener('input', (e) => {
        performSearch(e.target.value);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape to exit search
        if (e.key === 'Escape' && isSearchMode) {
            exitSearchMode();
            return;
        }

        // Space to trigger search (when not in search mode and not typing in input)
        if (!isSearchMode && e.key === ' ') {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                enterSearchMode();
                return;
            }
        }

        // Enter to open top result or search
        if (isSearchMode && e.key === 'Enter' && e.target === searchInput) {
            const query = searchInput.value.trim();
            const results = searchResults.querySelectorAll('.icon-container');

            if (results.length > 0) {
                // Open top result
                results[0].click();
            } else if (query) {
                // No results - search DuckDuckGo or chat
                if (e.shiftKey) {
                    // Shift+Enter: Search chat
                    window.open(`https://chat.jumperlink.net/?model=qwen3-vl-235b-a22b-thinking:online&q=${encodeURIComponent(query)}`, '_blank');
                } else {
                    // Enter: Search DuckDuckGo
                    window.open(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, '_blank');
                }
            }
        }
    });
}

// Bookmark browser functionality
function setupBookmarkBrowser() {
    const bookmarkButton = document.getElementById('bookmarkButton');
    const bookmarkBrowser = document.getElementById('bookmarkBrowser');
    const bookmarkGrid = document.getElementById('bookmarkGrid');
    const bookmarkPath = document.getElementById('bookmarkPath');
    const backButton = document.getElementById('backButton');
    const launcherGrid = document.getElementById('launcherGrid');
    const searchButton = document.getElementById('searchButton');
    const searchClose = document.getElementById('searchClose');

    let currentFolder = null;
    let folderStack = [];

    function createFolderIcon(folder) {
        const container = document.createElement('div');
        container.className = 'icon-container';
        container.style.cursor = 'pointer';

        const iconImage = document.createElement('div');
        iconImage.className = 'icon-image';

        const img = document.createElement('img');
        img.src = 'icons/folder.png';
        img.alt = folder.name;
        img.onerror = function() {
            // Fallback folder icon
            this.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="48" y="16" fill="%23FDB813" rx="4"/><rect width="32" height="8" fill="%23FDB813" rx="2"/></svg>');
        };

        iconImage.appendChild(img);

        const label = document.createElement('div');
        label.className = 'icon-label';
        label.textContent = folder.name;

        container.appendChild(iconImage);
        container.appendChild(label);

        container.addEventListener('click', () => openFolder(folder));

        return container;
    }

    function createBookmarkIcon(bookmark) {
        return createLauncherIcon({
            url: bookmark.url,
            displayName: bookmark.name,
            imagePath: ''
        });
    }

    function openFolder(folder) {
        folderStack.push(currentFolder);
        currentFolder = folder;
        displayFolder(folder);
        backButton.style.display = 'block';
    }

    function goBack() {
        if (folderStack.length > 0) {
            currentFolder = folderStack.pop();
            if (currentFolder) {
                displayFolder(currentFolder);
            } else {
                displayFolder(bookmarkStructure);
            }

            if (folderStack.length === 0) {
                backButton.style.display = 'none';
            }
        }
    }

    function displayFolder(folder) {
        bookmarkGrid.innerHTML = '';
        bookmarkPath.textContent = folder ? folder.name : 'Bookmarks';

        const items = folder ? folder.children : (bookmarkStructure ? bookmarkStructure.children : []);

        items.forEach(item => {
            if (item.type === 'folder') {
                const icon = createFolderIcon(item);
                bookmarkGrid.appendChild(icon);
            } else if (item.type === 'link') {
                const icon = createBookmarkIcon(item);
                bookmarkGrid.appendChild(icon);
            }
        });

        // Setup effects
        setupDockEffect(bookmarkGrid, '.icon-container', 200, 0.4);
        setupClickAnimation(bookmarkGrid, '.icon-container');
    }

    function enterBrowserMode() {
        if (!bookmarkStructure) {
            console.log('No bookmarks loaded');
            return;
        }

        isBrowserMode = true;
        currentFolder = null;
        folderStack = [];

        bookmarkButton.style.display = 'none';
        searchButton.style.display = 'none';
        searchClose.style.display = 'flex';

        launcherGrid.style.display = 'none';
        bookmarkBrowser.style.display = 'flex';

        backButton.style.display = 'none';
        displayFolder(bookmarkStructure);
    }

    function exitBrowserMode() {
        isBrowserMode = false;

        bookmarkButton.style.display = 'block';
        searchButton.style.display = 'block';
        searchClose.style.display = 'none';

        launcherGrid.style.display = 'grid';
        bookmarkBrowser.style.display = 'none';

        bookmarkGrid.innerHTML = '';
        currentFolder = null;
        folderStack = [];
    }

    // Event listeners
    bookmarkButton.addEventListener('click', enterBrowserMode);
    searchClose.addEventListener('click', () => {
        if (isBrowserMode) {
            exitBrowserMode();
        }
    });
    backButton.addEventListener('click', goBack);

    // Keyboard shortcuts for bookmark browser
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd or Alt/Opt to trigger bookmark browser
        if (!isSearchMode && !isBrowserMode && (e.ctrlKey || e.metaKey || e.altKey)) {
            if (e.key === 'Control' || e.key === 'Meta' || e.key === 'Alt') {
                enterBrowserMode();
                e.preventDefault();
            }
        }

        // Escape to exit browser mode or go back
        if (isBrowserMode && e.key === 'Escape') {
            if (folderStack.length > 0) {
                goBack();
            } else {
                exitBrowserMode();
            }
            e.preventDefault();
        }
    });
}

// Keyboard navigation functionality
let keyboardNavEnabled = false;
let selectedIndex = 0;
let selectedPanel = 'grid'; // 'grid' or 'panel'

function setupKeyboardNavigation() {
    const launcherGrid = document.getElementById('launcherGrid');
    const sidePanel = document.getElementById('sidePanel');

    function getGridItems() {
        return Array.from(launcherGrid.querySelectorAll('.icon-container'));
    }

    function getPanelItems() {
        return Array.from(sidePanel.querySelectorAll('.panel-icon'));
    }

    function clearSelection() {
        document.querySelectorAll('.keyboard-selected').forEach(el => {
            el.classList.remove('keyboard-selected');
        });
    }

    function updateSelection() {
        clearSelection();

        const items = selectedPanel === 'grid' ? getGridItems() : getPanelItems();
        if (items.length > 0 && selectedIndex >= 0 && selectedIndex < items.length) {
            items[selectedIndex].classList.add('keyboard-selected');
            items[selectedIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    function moveSelection(direction) {
        const items = selectedPanel === 'grid' ? getGridItems() : getPanelItems();
        if (items.length === 0) return;

        // Get grid columns by checking items' positions
        const firstItemRect = items[0].getBoundingClientRect();
        let columns = 1;

        if (selectedPanel === 'grid') {
            for (let i = 1; i < items.length; i++) {
                const rect = items[i].getBoundingClientRect();
                if (Math.abs(rect.top - firstItemRect.top) < 5) {
                    columns++;
                } else {
                    break;
                }
            }
        } else {
            columns = items.length; // Panel is horizontal
        }

        switch (direction) {
            case 'left':
                selectedIndex = Math.max(0, selectedIndex - 1);
                break;
            case 'right':
                selectedIndex = Math.min(items.length - 1, selectedIndex + 1);
                break;
            case 'up':
                if (selectedPanel === 'grid') {
                    selectedIndex = Math.max(0, selectedIndex - columns);
                }
                break;
            case 'down':
                if (selectedPanel === 'grid') {
                    selectedIndex = Math.min(items.length - 1, selectedIndex + columns);
                }
                break;
        }

        updateSelection();
    }

    function openSelected() {
        const items = selectedPanel === 'grid' ? getGridItems() : getPanelItems();
        if (items.length > 0 && selectedIndex >= 0 && selectedIndex < items.length) {
            items[selectedIndex].click();
        }
    }

    function togglePanel() {
        selectedPanel = selectedPanel === 'grid' ? 'panel' : 'grid';
        selectedIndex = 0;
        updateSelection();
    }

    // Keyboard event handler
    document.addEventListener('keydown', (e) => {
        // Don't interfere with search or browser mode
        if (isSearchMode || isBrowserMode) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Arrow keys to enable and navigate
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();

            if (!keyboardNavEnabled) {
                keyboardNavEnabled = true;
                selectedIndex = 0;
                selectedPanel = 'grid';
                updateSelection();
                return;
            }

            const direction = e.key.replace('Arrow', '').toLowerCase();
            moveSelection(direction);
        }

        // Tab to toggle between grid and panel
        if (e.key === 'Tab' && keyboardNavEnabled) {
            e.preventDefault();
            togglePanel();
        }

        // Enter to open selected item
        if (e.key === 'Enter' && keyboardNavEnabled) {
            e.preventDefault();
            openSelected();
        }

        // Escape to disable keyboard nav
        if (e.key === 'Escape' && keyboardNavEnabled) {
            e.preventDefault();
            keyboardNavEnabled = false;
            clearSelection();
        }
    });
}

// Run when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
