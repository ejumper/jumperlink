// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const CONFIG = {
    // API Keys (REPLACE WITH YOUR OWN)
    OPENROUTER_API_KEY: 'YOUR_OPENROUTER_API_KEY_HERE',

    // Nextcloud News Configuration
    NEXTCLOUD_URL: 'https://cloud.jumperlink.net',
    NEXTCLOUD_USER: 'admin',
    NEXTCLOUD_PASS: 'J5Lc7-oRQa7-2pyX5-Xdm53-8ERan',
    NEXTCLOUD_TASKS_CALENDAR_PATH: '/remote.php/dav/calendars/admin/personal/', // Update to your tasks calendar

    // API Endpoints
    WIKI_API: 'https://en.wikipedia.org/w/api.php',
    OPENROUTER_API: 'https://openrouter.ai/api/v1/chat/completions',

    // Settings
    FEED_ITEMS: 100,
    SUGGESTION_LIMIT: { wikipedia: 5, bookmarks: 5 },
    DEBOUNCE_MS: 300,
    UPDATE_TIME_INTERVAL: 1000, // Update clock every second
    SHOW_POST_CONTENT: true, // Show post content in cards
    POST_CONTENT_LIMIT: 280 // Character limit for post preview
};

const LOCAL_STORAGE_KEYS = {
    readItems: 'jumperlink_read_items',
    readSyncQueue: 'jumperlink_read_sync_queue'
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const STATE = {
    mode: 'home', // 'home' or 'search'
    bookmarks: [],
    appLinks: [],
    searchCache: new Map(),
    lastQuery: '',
    currentSuggestions: [],
    debounceTimeout: null,
    folders: [], // Nextcloud News folders
    feeds: [], // Nextcloud News feeds
    selectedFolder: null, // null = all feeds, otherwise folder ID
    feedViewFilter: 'unviewed', // 'unviewed' or 'viewed'
    latestItems: [],
    pendingReadMarks: new Set(),
    readSyncQueue: new Set(),
    localReadItems: new Set()
};

// ============================================================================
// DOM REFERENCES
// ============================================================================

const DOM = {
    pageTitle: document.querySelector('page-title'),
    pageTitleText: document.querySelector('.page-title-display p'),
    subtitle: document.querySelector('subtitle'),
    overview: document.querySelector('overview'),
    text: document.querySelector('text'),
    dock: document.querySelector('dock'),
    links: document.querySelector('links'),
    searchInput: document.getElementById('searchbox'),
    searchTriggers: document.querySelectorAll('.search-trigger'),
    header: document.querySelector('header'),
    top: document.querySelector('top'),
    bottom: document.querySelector('bottom'),
    taskModal: null,
    taskForm: null,
    taskMessage: null
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Jumperlink] Dashboard initializing...');

    initializeLocalReadTracking();
    initTaskModal();

    // Load initial data
    await Promise.all([
        loadAppLinks(),
        loadBookmarks()
    ]);

    // Initialize home mode
    loadHomeMode();

    // Set up search inputs
    setupSearchInputs();

    // Handle URL parameters for direct navigation
    handleURLRouting();

    // Set up browser history navigation
    setupHistoryNavigation();

    console.log('[Jumperlink] Dashboard ready');
});

// ============================================================================
// URL ROUTING
// ============================================================================

function handleURLRouting() {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    const wikiArticle = urlParams.get('wiki');

    if (wikiArticle) {
        // Load Wikipedia article
        console.log('[Routing] Loading Wikipedia article:', wikiArticle);
        enterSearchMode();
        if (DOM.searchInput) {
            DOM.searchInput.value = wikiArticle;
        }
        loadWikipediaArticle(wikiArticle);
    } else if (query) {
        // Perform search
        console.log('[Routing] Performing search:', query);
        if (DOM.searchInput) {
            DOM.searchInput.value = query;
        }
        enterSearchMode();
        performSearch(query);
    }
    // If no params, stay in home mode (already initialized)
}

function setupHistoryNavigation() {
    window.addEventListener('popstate', () => {
        console.log('[Routing] Browser navigation detected');
        handleURLRouting();
    });
}

function updateURL(params, replaceState = false) {
    const url = new URL(window.location);

    // Clear existing params
    url.search = '';

    // Add new params
    Object.keys(params).forEach(key => {
        if (params[key]) {
            url.searchParams.set(key, params[key]);
        }
    });

    // Update browser URL
    if (replaceState) {
        window.history.replaceState({}, '', url.toString());
    } else {
        window.history.pushState({}, '', url.toString());
    }

    console.log('[Routing] URL updated:', url.toString());
}

// ============================================================================
// HOME MODE
// ============================================================================

async function loadHomeMode() {
    STATE.mode = 'home';

    // Start clock
    updateClock();
    setInterval(updateClock, CONFIG.UPDATE_TIME_INTERVAL);

    // Load Nextcloud folders, feeds, and items
    await loadNextcloudFolders();
    await loadNextcloudFeeds();
    loadNextcloudFeed();

    // Display app links
    displayAppLinks();

    // Display bookmarks tree
    displayBookmarksTree();

    // Reset UI
    showHomeModeUI();
}

function updateClock() {
    const now = new Date();

    // Update time (HH:MM:SS format)
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        
        hour12: false
    });

    // Update date (Day, Month DD, YYYY format)
    const dateString = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    if (DOM.pageTitleText) {
        DOM.pageTitleText.textContent = timeString;
    } else if (DOM.pageTitle) {
        DOM.pageTitle.innerHTML = `<p>${timeString}</p>`;
    }
    DOM.subtitle.innerHTML = `<p>${dateString}</p>`;
}

async function loadNextcloudFolders() {
    if (!CONFIG.NEXTCLOUD_URL || CONFIG.NEXTCLOUD_USER === 'YOUR_USERNAME') {
        return;
    }

    try {
        const auth = btoa(`${CONFIG.NEXTCLOUD_USER}:${CONFIG.NEXTCLOUD_PASS}`);
        const response = await fetch(
            `${CONFIG.NEXTCLOUD_URL}/index.php/apps/news/api/v1-3/folders`,
            {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) throw new Error('Failed to fetch folders');

        const data = await response.json();
        STATE.folders = data.folders || [];
        console.log(`[Jumperlink] Loaded ${STATE.folders.length} folders`);
    } catch (error) {
        console.error('Folders fetch error:', error);
        STATE.folders = [];
    }
}

async function loadNextcloudFeeds() {
    if (!CONFIG.NEXTCLOUD_URL || CONFIG.NEXTCLOUD_USER === 'YOUR_USERNAME') {
        return;
    }

    try {
        const auth = btoa(`${CONFIG.NEXTCLOUD_USER}:${CONFIG.NEXTCLOUD_PASS}`);
        const response = await fetch(
            `${CONFIG.NEXTCLOUD_URL}/index.php/apps/news/api/v1-3/feeds`,
            {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) throw new Error('Failed to fetch feeds');

        const data = await response.json();
        STATE.feeds = data.feeds || [];
        console.log(`[Jumperlink] Loaded ${STATE.feeds.length} feeds`);
    } catch (error) {
        console.error('Feeds fetch error:', error);
        STATE.feeds = [];
    }
}

async function loadNextcloudFeed(folderId = null) {
    if (!CONFIG.NEXTCLOUD_URL || CONFIG.NEXTCLOUD_USER === 'YOUR_USERNAME') {
        STATE.latestItems = [];
        const placeholder = '<p style="padding:1rem;"><em>Configure Nextcloud credentials to see your news feed</em></p>';
        DOM.overview.innerHTML = getFeedControlsHTML() + placeholder;
        attachViewToggleHandlers();
        attachFolderClickHandlers();
        return;
    }

    try {
        const auth = btoa(`${CONFIG.NEXTCLOUD_USER}:${CONFIG.NEXTCLOUD_PASS}`);

        const includeRead = STATE.feedViewFilter === 'viewed';
        const params = new URLSearchParams({
            type: folderId === null ? '3' : '1',
            getRead: includeRead ? 'true' : 'false',
            batchSize: CONFIG.FEED_ITEMS.toString()
        });

        if (folderId !== null) {
            params.set('id', folderId.toString());
        }

        const url = `${CONFIG.NEXTCLOUD_URL}/index.php/apps/news/api/v1-3/items?${params.toString()}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Failed to fetch feed');

        const data = await response.json();
        STATE.latestItems = data.items || [];
        applyLocalReadOverrides(STATE.latestItems);
        displayFeed();
        processReadSyncQueue();
    } catch (error) {
        console.error('Feed fetch error:', error);
        const message = '<p style="padding:1rem;"><em>Unable to load news feed</em></p>';
        DOM.overview.innerHTML = getFeedControlsHTML() + message;
        attachViewToggleHandlers();
        attachFolderClickHandlers();
    }
}

function displayViewToggle() {
    const nextView = STATE.feedViewFilter === 'unviewed' ? 'viewed' : 'unviewed';
    const label = STATE.feedViewFilter === 'unviewed' ? '🟢 Viewed' : '⚫ Viewed';

    return `
        <button class="view-toggle-chip" data-view="${nextView}">
            ${label}
        </button>
    `;
}

function displayFolderMenu() {
    if (STATE.folders.length === 0) {
        return displayViewToggle();
    }

    const isAllActive = STATE.selectedFolder === null;
    const menuHTML = `
        <div class="feed-folder-menu">
            ${displayViewToggle()}
            <button class="folder-btn ${isAllActive ? 'active' : ''}" data-folder-id="null">
                All
            </button>
            ${STATE.folders.map(folder => {
                const isActive = STATE.selectedFolder === folder.id;
                return `
                    <button class="folder-btn ${isActive ? 'active' : ''}" data-folder-id="${folder.id}">
                        ${escapeHtml(folder.name)}
                    </button>
                `;
            }).join('')}
        </div>
    `;

    return menuHTML;
}

function displayFeed() {
    const controlsHTML = getFeedControlsHTML();
    const items = getFilteredFeedItems();

    if (!items || items.length === 0) {
        const message = STATE.feedViewFilter === 'viewed'
            ? '<p style="padding:1rem;"><em>No viewed items</em></p>'
            : '<p style="padding:1rem;"><em>No unread items</em></p>';
        DOM.overview.innerHTML = controlsHTML + message;
        attachViewToggleHandlers();
        attachFolderClickHandlers();
        return;
    }

    const feedHTML = `
        <div class="bluesky-feed">
            ${items.map(item => createFeedCard(item)).join('')}
        </div>
    `;

    DOM.overview.innerHTML = controlsHTML + feedHTML;
    attachViewToggleHandlers();
    attachFolderClickHandlers();
    attachFeedItemInteractions();
}

function getFeedControlsHTML() {
    return `
        <div class="feed-controls">
            ${displayFolderMenu()}
        </div>
    `;
}

function getFilteredFeedItems() {
    const items = STATE.latestItems || [];
    if (STATE.feedViewFilter === 'viewed') {
        return items.filter(item => item && !isItemUnread(item));
    }
    return items.filter(item => item && isItemUnread(item));
}

function isItemUnread(item) {
    if (!item) return false;
    if (STATE.localReadItems.has(item.id)) return false;
    if (item.unread === undefined || item.unread === null) return true;
    if (typeof item.unread === 'boolean') return item.unread;
    if (typeof item.unread === 'number') return item.unread !== 0;
    return Boolean(item.unread);
}

function createFeedCard(item) {
    // Extract domain for favicon
    let domain = '';
    try {
        const url = new URL(item.url);
        domain = url.hostname;
    } catch (e) {
        domain = '';
    }

    const folder = STATE.folders.find(f => f.id === item.folderId);
    const feed = STATE.feeds.find(f => f.id === item.feedId);
    const feedName = feed ? feed.title : (item.feedTitle || 'Unknown Feed');
    const normalizedTitle = (item.title || '').trim();
    const showTitle = shouldDisplayFeedTitle(normalizedTitle);
    const rawExcerpt = CONFIG.SHOW_POST_CONTENT ? getFeedExcerpt(item.body) : '';
    const excerpt = shouldDisplayFeedExcerpt(rawExcerpt, normalizedTitle, domain, feedName) ? rawExcerpt : '';
    const mediaMarkup = extractFeedMedia(item);
    const timestamp = formatPublishDate(item.pubDate);
    const metrics = extractEngagementMetrics(item);
    const isUnread = isItemUnread(item);
    const titleMarkup = showTitle ? `
            <a href="${escapeHtml(item.url)}"
               target="_blank"
               rel="noopener noreferrer"
               class="feed-item-link">
                <h3 class="feed-title">${escapeHtml(normalizedTitle)}</h3>
            </a>
        ` : '';

    return `
        <article class="feed-item ${isUnread ? '' : 'feed-item--read'}"
                 data-link="${escapeHtml(item.url || '')}"
                 data-item-id="${item.id}"
                 data-unread="${isUnread}">
            <div class="feed-item-top">
                ${domain
                    ? `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="" class="feed-avatar">`
                    : `<div class="feed-avatar feed-avatar--fallback">${escapeHtml(feedName.charAt(0) || '?')}</div>`}
                <div class="feed-source">
                    <span class="feed-source-name">${escapeHtml(feedName)}</span>
                    <div class="feed-meta-line">
                        ${folder ? `<span class="feed-folder-pill">${escapeHtml(folder.name)}</span>` : ''}
                        ${timestamp ? `<span class="feed-date">${escapeHtml(timestamp)}</span>` : ''}
                    </div>
                </div>
            </div>
            ${titleMarkup}
            ${excerpt ? `<p class="feed-excerpt">${escapeHtml(excerpt)}</p>` : ''}
            ${mediaMarkup ? `<div class="feed-media">${mediaMarkup}</div>` : ''}
            ${metrics ? `
                <div class="feed-metrics">
                    ${metrics.map(metric => `
                        <span class="feed-metric" title="${escapeHtml(metric.label)}">
                            <span class="metric-icon">${escapeHtml(metric.icon)}</span>
                            <span class="metric-value">${escapeHtml(formatMetricValue(metric.value))}</span>
                        </span>
                    `).join('')}
                </div>
            ` : ''}
        </article>
    `;
}

function getFeedExcerpt(body) {
    if (!body) return '';
    const text = stripHtml(body).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    const limit = CONFIG.POST_CONTENT_LIMIT || 280;
    return text.length > limit ? `${text.slice(0, limit - 1).trim()}…` : text;
}

function extractFeedMedia(item) {
    if (!item) return null;

    if (item.enclosureLink && item.enclosureMime && item.enclosureMime.startsWith('image/')) {
        return `<img src="${escapeHtml(item.enclosureLink)}" alt="Post media" loading="lazy">`;
    }

    if (!item.body) return null;

    const temp = document.createElement('div');
    temp.innerHTML = item.body;

    const image = temp.querySelector('img');
    if (image) {
        const src = image.getAttribute('src');
        if (src) {
            return `<img src="${escapeHtml(src)}" alt="${escapeHtml(image.getAttribute('alt') || 'Post media')}" loading="lazy">`;
        }
    }

    const video = temp.querySelector('video, iframe');
    if (video) {
        const src = video.getAttribute('src');
        if (src) {
            return `<a href="${escapeHtml(src)}" target="_blank" rel="noopener noreferrer" class="feed-media-link">View media</a>`;
        }
    }

    return null;
}

function formatPublishDate(pubDate) {
    if (!pubDate) return '';

    let timestamp = pubDate;
    if (typeof pubDate === 'number') {
        timestamp = pubDate > 1e12 ? pubDate : pubDate * 1000;
    } else if (typeof pubDate === 'string') {
        const parsed = Date.parse(pubDate);
        if (!Number.isNaN(parsed)) {
            timestamp = parsed;
        }
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();

    if (sameDay) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function extractEngagementMetrics(item) {
    if (!item) return null;

    const metrics = [];
    const candidates = [
        { key: 'replies', label: 'Replies', icon: '💬' },
        { key: 'comments', label: 'Comments', icon: '💬' },
        { key: 'reposts', label: 'Reposts', icon: '↻' },
        { key: 'shares', label: 'Shares', icon: '↻' },
        { key: 'likes', label: 'Likes', icon: '❤' }
    ];

    candidates.forEach(({ key, label, icon }) => {
        const directValue = item[key] ?? (item.metrics ? item.metrics[key] : undefined);
        if (typeof directValue === 'number') {
            if (!metrics.some(m => m.label === label)) {
                metrics.push({ label, icon, value: directValue });
            }
        }
    });

    if (!metrics.length && item.body) {
        const text = stripHtml(item.body);
        const regexes = [
            { label: 'Replies', icon: '💬', regex: /Replies?:\s*([\d,]+)/i },
            { label: 'Reposts', icon: '↻', regex: /Reposts?:\s*([\d,]+)/i },
            { label: 'Likes', icon: '❤', regex: /Likes?:\s*([\d,]+)/i }
        ];

        regexes.forEach(({ label, icon, regex }) => {
            const match = text.match(regex);
            if (match && !metrics.some(m => m.label === label)) {
                const value = parseInt(match[1].replace(/,/g, ''), 10);
                metrics.push({ label, icon, value: Number.isNaN(value) ? match[1] : value });
            }
        });
    }

    return metrics.length ? metrics : null;
}

function formatMetricValue(value) {
    if (typeof value === 'number') {
        return value.toLocaleString();
    }

    return `${value}`;
}

function shouldDisplayFeedTitle(title) {
    if (!title) return false;
    return title.toLowerCase() !== 'untitled';
}

function shouldDisplayFeedExcerpt(excerpt, title, domain, feedName) {
    if (!excerpt) return false;
    if (isTikTokSource(domain, feedName)) return false;
    if (title && excerpt && excerpt.toLowerCase() === title.toLowerCase()) return false;
    return true;
}

function isTikTokSource(domain, feedName) {
    const domainText = (domain || '').toLowerCase();
    const feedText = (feedName || '').toLowerCase();
    return domainText.includes('tiktok') || feedText.includes('tiktok');
}

function attachFeedItemInteractions() {
    document.querySelectorAll('.feed-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const targetAnchor = e.target.closest('a');
            if (!targetAnchor) {
                const link = item.querySelector('.feed-item-link');
                if (link) link.click();
            }

            const itemId = parseInt(item.dataset.itemId, 10);
            if (!Number.isNaN(itemId)) {
                markFeedItemAsRead(itemId);
            }
        });
    });
}

function attachViewToggleHandlers() {
    document.querySelectorAll('.view-toggle-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            if (!view || view === STATE.feedViewFilter) return;
            STATE.feedViewFilter = view;
            loadNextcloudFeed(STATE.selectedFolder);
        });
    });
}

function markFeedItemAsRead(itemId) {
    const numericId = Number(itemId);
    if (!Number.isInteger(numericId)) return;

    const item = (STATE.latestItems || []).find(entry => entry && entry.id === numericId);
    if (item) {
        item.unread = false;
    }

    STATE.localReadItems.add(numericId);
    trimSetToLimit(STATE.localReadItems, 1000);
    persistLocalReadItems();

    displayFeed();

    if (CONFIG.NEXTCLOUD_URL && CONFIG.NEXTCLOUD_USER !== 'YOUR_USERNAME') {
        STATE.readSyncQueue.add(numericId);
        trimSetToLimit(STATE.readSyncQueue, 1000);
        persistReadSyncQueue();
        syncItemReadStatus(numericId);
    }
}

function applyLocalReadOverrides(items) {
    if (!items || !Array.isArray(items)) return;
    items.forEach(item => {
        if (!item) return;
        if (STATE.localReadItems.has(item.id)) {
            item.unread = false;
        }
    });
}

function initializeLocalReadTracking() {
    STATE.localReadItems = loadSetFromStorage(LOCAL_STORAGE_KEYS.readItems);
    STATE.readSyncQueue = loadSetFromStorage(LOCAL_STORAGE_KEYS.readSyncQueue);
    trimSetToLimit(STATE.localReadItems, 1000);
    trimSetToLimit(STATE.readSyncQueue, 1000);
}

function persistLocalReadItems() {
    saveSetToStorage(LOCAL_STORAGE_KEYS.readItems, STATE.localReadItems);
}

function persistReadSyncQueue() {
    saveSetToStorage(LOCAL_STORAGE_KEYS.readSyncQueue, STATE.readSyncQueue);
}

function loadSetFromStorage(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            const numbers = parsed
                .map(value => Number(value))
                .filter(value => Number.isInteger(value));
            return new Set(numbers);
        }
    } catch (error) {
        console.warn('Storage load failed:', error);
    }
    return new Set();
}

function saveSetToStorage(key, set) {
    try {
        const values = Array.from(set);
        localStorage.setItem(key, JSON.stringify(values));
    } catch (error) {
        console.warn('Storage save failed:', error);
    }
}

function trimSetToLimit(set, limit) {
    if (!set || typeof set.values !== 'function') return;
    while (set.size > limit) {
        const first = set.values().next().value;
        set.delete(first);
    }
}

function processReadSyncQueue() {
    if (!CONFIG.NEXTCLOUD_URL || CONFIG.NEXTCLOUD_USER === 'YOUR_USERNAME') {
        return;
    }
    if (!STATE.readSyncQueue || STATE.readSyncQueue.size === 0) {
        return;
    }
    STATE.readSyncQueue.forEach(id => {
        syncItemReadStatus(id);
    });
}

async function syncItemReadStatus(itemId) {
    if (!CONFIG.NEXTCLOUD_URL || CONFIG.NEXTCLOUD_USER === 'YOUR_USERNAME') {
        return;
    }
    if (!Number.isInteger(itemId)) return;
    if (STATE.pendingReadMarks.has(itemId)) return;

    STATE.pendingReadMarks.add(itemId);

    try {
        const auth = btoa(`${CONFIG.NEXTCLOUD_USER}:${CONFIG.NEXTCLOUD_PASS}`);
        const response = await fetch(`${CONFIG.NEXTCLOUD_URL}/index.php/apps/news/api/v1-3/items/${itemId}/read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Failed to update read status');

        STATE.readSyncQueue.delete(itemId);
        persistReadSyncQueue();
    } catch (error) {
        console.error('Read sync error:', error);
    } finally {
        STATE.pendingReadMarks.delete(itemId);
    }
}

function attachFolderClickHandlers() {
    document.querySelectorAll('.folder-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const folderId = btn.dataset.folderId;
            STATE.selectedFolder = folderId === 'null' ? null : parseInt(folderId);
            loadNextcloudFeed(STATE.selectedFolder);
        });
    });
}

// ============================================================================
// APP LINKS & BOOKMARKS
// ============================================================================

async function loadAppLinks() {
    try {
        const response = await fetch('applinks.txt');
        const text = await response.text();

        STATE.appLinks = text.split('\n')
            .filter(line => line.trim() && !line.startsWith('#'))
            .map(line => {
                const match = line.match(/^(\S+)\s+"([^"]+)"(?:\s+"([^"]+)")?/);
                if (!match) {
                    console.warn('[App Links] Skipping malformed line:', line);
                    return null;
                }
                // Validate URL
                try {
                    new URL(match[1]);
                } catch (e) {
                    console.warn('[App Links] Invalid URL:', match[1]);
                    return null;
                }
                return {
                    url: match[1],
                    name: match[2],
                    icon: match[3] || null
                };
            })
            .filter(Boolean);

        console.log(`[Jumperlink] Loaded ${STATE.appLinks.length} app links`);
    } catch (error) {
        console.error('Error loading app links:', error);
    }
}

function displayAppLinks() {
    if (!STATE.appLinks || STATE.appLinks.length === 0) {
        console.warn('[App Links] No app links to display');
        DOM.dock.innerHTML = '<div style="padding:1rem; color:#888;">No app links configured</div>';
        return;
    }

    console.log(`[App Links] Displaying ${STATE.appLinks.length} app links`);

    const linksHTML = STATE.appLinks.map(link => {
        // Determine image source: use icon if specified, otherwise use favicon
        const iconPath = link.icon ? `icons/${link.icon}` : null;

        // Extract domain for favicon fallback
        let domain = '';
        try {
            const url = new URL(link.url);
            domain = url.hostname;
        } catch (e) {
            domain = '';
        }

        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

        return `
            <a href="${escapeHtml(link.url)}"
               target="_blank"
               class="app-icon-item"
               data-icon-path="${iconPath || ''}"
               data-favicon-url="${escapeHtml(faviconUrl)}">
                <img src="${iconPath || faviconUrl}"
                     alt="${escapeHtml(link.name)}"
                     class="app-icon-image"
                     onerror="this.onerror=null; this.src='${escapeHtml(faviconUrl)}';">
                <div class="app-icon-title">${escapeHtml(link.name)}</div>
            </a>
        `;
    }).join('');

    // Display app links in dock with horizontal scrolling
    DOM.dock.innerHTML = `<div class="app-links-horizontal">${linksHTML}</div>`;
}

async function loadBookmarks() {
    try {
        const response = await fetch('bookmarks/bookmarks.html');
        const html = await response.text();

        console.log('[Bookmarks] Fetched HTML, length:', html.length);

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Find all DL elements to debug
        const allDLs = doc.querySelectorAll('DL');
        console.log('[Bookmarks] Found DL elements:', allDLs.length);

        // The first DL should be the root
        const dlElement = allDLs[0];
        console.log('[Bookmarks] Using first DL element, children count:', dlElement ? dlElement.children.length : 0);

        if (dlElement) {
            // Log first few children to debug
            for (let i = 0; i < Math.min(3, dlElement.children.length); i++) {
                const child = dlElement.children[i];
                console.log(`[Bookmarks] Child ${i}:`, child.tagName, child.querySelector('H3')?.textContent || child.querySelector('A')?.textContent);
            }
        }

        STATE.bookmarks = parseBookmarkNode(dlElement);

        console.log('[Bookmarks] Parsed bookmarks:', STATE.bookmarks);
        console.log('[Bookmarks] Bookmarks count:', STATE.bookmarks.length);
        console.log(`[Jumperlink] Loaded ${countBookmarks(STATE.bookmarks)} bookmarks`);

        if (STATE.mode === 'home') {
            displayBookmarksTree();
        }
    } catch (error) {
        console.error('Error loading bookmarks:', error);
    }
}

function parseBookmarkNode(node, depth = 0) {
    if (!node) {
        console.log(`[Parse] Depth ${depth}: Node is null`);
        return [];
    }

    const bookmarks = [];
    console.log(`[Parse] Depth ${depth}: Processing node with ${node.children.length} children`);

    for (const child of node.children) {
        if (child.tagName === 'DT') {
            const h3 = child.querySelector('H3');
            const a = child.querySelector('A');

            if (h3) {
                console.log(`[Parse] Depth ${depth}: Found folder - ${h3.textContent}`);
                // It's a folder - find the next DL sibling
                let dl = child.nextElementSibling;
                console.log(`[Parse] Depth ${depth}: First sibling of DT:`, dl?.tagName);

                // Some bookmark exports nest the DL inside the DT, so check descendants too
                if (!dl || dl.tagName !== 'DL') {
                    const nested = child.querySelector('DL');
                    if (nested) {
                        console.log(`[Parse] Depth ${depth}: Found nested DL inside DT`);
                        dl = nested;
                    }
                }

                let attempts = 0;
                while (dl && dl.tagName !== 'DL' && attempts < 10) {
                    console.log(`[Parse] Depth ${depth}: Skipping sibling:`, dl.tagName);
                    dl = dl.nextElementSibling;
                    attempts++;
                }

                console.log(`[Parse] Depth ${depth}: Final DL found:`, dl?.tagName, 'with', dl?.children.length, 'children');

                const folderItem = {
                    type: 'folder',
                    name: h3.textContent,
                    children: dl && dl.tagName === 'DL' ? parseBookmarkNode(dl, depth + 1) : []
                };
                bookmarks.push(folderItem);
                console.log(`[Parse] Depth ${depth}: Folder "${h3.textContent}" has ${folderItem.children.length} children`);
            } else if (a) {
                console.log(`[Parse] Depth ${depth}: Found bookmark - ${a.textContent}`);
                // It's a bookmark
                bookmarks.push({
                    type: 'bookmark',
                    name: a.textContent,
                    url: a.href
                });
            }
        }
    }

    console.log(`[Parse] Depth ${depth}: Returning ${bookmarks.length} items`);
    return bookmarks;
}

function countBookmarks(bookmarks) {
    return bookmarks.reduce((count, item) => {
        if (item.type === 'bookmark') return count + 1;
        if (item.type === 'folder') return count + countBookmarks(item.children);
        return count;
    }, 0);
}

function displayBookmarksTree() {
    console.log('[Bookmarks] displayBookmarksTree called, STATE.bookmarks:', STATE.bookmarks);

    if (!STATE.bookmarks || STATE.bookmarks.length === 0) {
        console.warn('[Bookmarks] No bookmarks to display');
        DOM.text.innerHTML = '<div style="padding:1rem; color:#888;">No bookmarks loaded</div>';
        return;
    }

    console.log(`[Bookmarks] Displaying ${STATE.bookmarks.length} bookmark folders/items`);
    const treeHTML = buildBookmarkTree(STATE.bookmarks);

    console.log('[Bookmarks] Generated HTML length:', treeHTML.length);

    // Put bookmarks tree in text area for home mode
    DOM.text.innerHTML = treeHTML;
}

function buildBookmarkTree(bookmarks, level = 0) {
    return bookmarks.map(item => {
        if (item.type === 'folder') {
            // Open root level folders by default
            const openAttr = level === 0 ? ' open' : '';
            return `
                <details${openAttr} style="margin-left:${level * 1}em;">
                    <summary style="cursor:pointer; padding:0.2rem; color:#ffd700;">
                        ${escapeHtml(item.name)}
                    </summary>
                    <div style="margin-left:1em;">
                        ${buildBookmarkTree(item.children, level + 1)}
                    </div>
                </details>
            `;
        } else {
            return `
                <div style="margin-left:${level * 1}em; padding:0.2rem;">
                    <a href="${escapeHtml(item.url)}" target="_blank"
                       style="color:#4a9eff; text-decoration:none;">
                        ${escapeHtml(item.name)}
                    </a>
                </div>
            `;
        }
    }).join('');
}

// ============================================================================
// SEARCH MODE
// ============================================================================

function setupSearchInputs() {
    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('focus', () => enterSearchMode());
        DOM.searchInput.addEventListener('input', handleSearchInput);
        DOM.searchInput.addEventListener('keydown', handleSearchKeydown);
    }

    DOM.searchTriggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            if (STATE.mode === 'search') {
                exitSearchMode();
            } else {
                enterSearchMode(true);
            }
        });
    });

    updateSearchTriggerIcons(false);
}

function enterSearchMode(clearInput = false) {
    if (STATE.mode === 'search') {
        if (DOM.searchInput) DOM.searchInput.focus();
        return;
    }

    STATE.mode = 'search';
    document.body.classList.add('search-mode');
    updateSearchTriggerIcons(true);
    console.log('[Search] Entering search mode');

    if (DOM.subtitle) {
        DOM.subtitle.style.display = 'none';
    }

    if (DOM.searchInput) {
        if (clearInput) DOM.searchInput.value = '';
        DOM.searchInput.placeholder = 'Search...';
        DOM.searchInput.focus();
        DOM.searchInput.select();
    }

    // Clear only the feed area; keep bookmarks and dock links visible
    DOM.overview.innerHTML = '';
}

function exitSearchMode() {
    if (STATE.mode !== 'search') return;

    STATE.mode = 'home';
    document.body.classList.remove('search-mode');
    updateSearchTriggerIcons(false);
    console.log('[Search] Exiting search mode');

    if (DOM.searchInput) {
        DOM.searchInput.value = '';
        DOM.searchInput.blur();
    }

    if (DOM.subtitle) {
        DOM.subtitle.style.display = '';
    }

    // Clear URL parameters
    window.history.pushState({}, '', window.location.pathname);

    // Restore home mode
    loadHomeMode();
}

function updateSearchTriggerIcons(isActive) {
    const icon = isActive ? '✕' : '🔍';
    const label = isActive ? 'Close search' : 'Open search';

    DOM.searchTriggers.forEach(trigger => {
        trigger.textContent = icon;
        trigger.setAttribute('aria-label', label);
    });
}


async function handleSearchInput(event) {
    const query = event.target.value.trim();

    if (!query) {
        DOM.overview.innerHTML = '';
        return;
    }

    // Debounce
    clearTimeout(STATE.debounceTimeout);
    STATE.debounceTimeout = setTimeout(() => {
        performSearch(query);
    }, CONFIG.DEBOUNCE_MS);
}

async function performSearch(query) {
    STATE.lastQuery = query;

    // Show loading in overview instead of dropdown
    DOM.overview.innerHTML = '<div style="padding:1rem; color:#888;">Searching...</div>';

    // Update URL with search query
    updateURL({ q: query });

    try {
        // Fetch suggestions from all sources in parallel
        const [wikiResults, bookmarkResults] = await Promise.all([
            searchWikipedia(query),
            searchBookmarks(query)
        ]);

        STATE.currentSuggestions = [
            ...wikiResults,
            ...bookmarkResults
        ];

        displaySuggestions(STATE.currentSuggestions, DOM.overview);
    } catch (error) {
        console.error('Search error:', error);
        DOM.overview.innerHTML = '<div style="padding:1rem; color:#f88;">Search failed</div>';
    }
}

function handleSearchKeydown(event) {
    if (event.key === 'Enter') {
        const query = event.target.value.trim();
        if (STATE.currentSuggestions.length > 0) {
            // Select first suggestion
            selectSuggestion(STATE.currentSuggestions[0]);
        } else if (query) {
            handleExternalSearchRedirect(query);
        }
    } else if (event.key === 'Escape') {
        exitSearchMode();
    }
}

// ============================================================================
// SEARCH SOURCES
// ============================================================================

async function searchWikipedia(query) {
    try {
        const url = `${CONFIG.WIKI_API}?origin=*&action=opensearch&search=${encodeURIComponent(query)}&limit=${CONFIG.SUGGESTION_LIMIT.wikipedia}&format=json`;
        const response = await fetch(url);
        const data = await response.json();

        const titles = data[1] || [];
        const descriptions = data[2] || [];

        return titles.map((title, i) => ({
            type: 'wikipedia',
            title: title,
            description: descriptions[i] || '',
            icon: 'Wiki'
        }));
    } catch (error) {
        console.error('Wikipedia search error:', error);
        return [];
    }
}

function searchBookmarks(query) {
    const lowerQuery = query.toLowerCase();
    const results = [];

    function searchNode(bookmarks) {
        for (const item of bookmarks) {
            if (item.type === 'bookmark') {
                if (item.name.toLowerCase().includes(lowerQuery) ||
                    item.url.toLowerCase().includes(lowerQuery)) {
                    results.push({
                        type: 'bookmark',
                        name: item.name,
                        url: item.url,
                        icon: 'Bookmark'
                    });
                }
            } else if (item.type === 'folder') {
                searchNode(item.children);
            }
        }
    }

    searchNode(STATE.bookmarks);
    return results.slice(0, CONFIG.SUGGESTION_LIMIT.bookmarks);
}

// ============================================================================
// SUGGESTIONS DISPLAY
// ============================================================================

function displaySuggestions(suggestions, container) {
    if (!suggestions || suggestions.length === 0) {
        const query = STATE.lastQuery || (DOM.searchInput ? DOM.searchInput.value.trim() : '');
        const encodedQuery = encodeURIComponent(query);
        container.innerHTML = `
            <div class="quick-search-links">
                <a href="https://duckduckgo.com/?q=${encodedQuery}" target="_blank">DuckDuckGo</a>
                <a href="https://www.google.com/search?tbm=isch&q=${encodedQuery}" target="_blank">Google Images</a>
                <a href="https://www.perplexity.ai/search?q=${encodedQuery}" target="_blank">Perplexity AI</a>
                <button type="button" class="quick-task-btn">Add to Tasks</button>
            </div>
        `;
        attachQuickTaskButton(container, query);
        return;
    }

    const html = suggestions.map((item, index) => {
        let label = '';
        if (item.type === 'wikipedia') {
            label = `[${item.icon}] ${item.title}`;
        } else if (item.type === 'bookmark') {
            label = `[${item.icon}] ${item.name}`;
        }

        return `
            <div class="suggestion-item" data-index="${index}"
                 style="padding:0.75rem; cursor:pointer; border-bottom:1px solid #333;">
                ${escapeHtml(label)}
                ${item.description ? `<div style="font-size:0.85em; color:#888; margin-top:0.2rem;">${escapeHtml(item.description)}</div>` : ''}
            </div>
        `;
    }).join('');

    container.innerHTML = html;

    // Add click handlers
    container.querySelectorAll('.suggestion-item').forEach(el => {
        el.addEventListener('click', () => {
            const index = parseInt(el.dataset.index);
            selectSuggestion(suggestions[index]);
        });

        el.addEventListener('mouseenter', () => {
            el.style.background = '#2a2a2a';
        });

        el.addEventListener('mouseleave', () => {
            el.style.background = '';
        });
    });
}

function attachQuickTaskButton(container, query) {
    if (!container) return;
    const btn = container.querySelector('.quick-task-btn');
    if (btn) {
        btn.addEventListener('click', () => openTaskModal(query));
    }
}

function initTaskModal() {
    if (DOM.taskModal) return;

    const modal = document.createElement('div');
    modal.id = 'task-modal';
    modal.innerHTML = `
        <div class="task-modal-overlay"></div>
        <div class="task-modal-dialog">
            <div class="task-modal-header">
                <h2>Add to Tasks</h2>
                <button type="button" class="task-modal-close" aria-label="Close">&times;</button>
            </div>
            <form id="task-form">
                <label>
                    Title
                    <input type="text" name="task-title" required>
                </label>
                <label>
                    Description
                    <textarea name="task-description" rows="4"></textarea>
                </label>
                <label>
                    Start
                    <input type="datetime-local" name="task-start">
                </label>
                <label>
                    Due
                    <input type="datetime-local" name="task-due">
                </label>
                <div class="task-modal-actions">
                    <button type="button" class="task-modal-cancel">Cancel</button>
                    <button type="submit">Create Task</button>
                </div>
                <div class="task-modal-message"></div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    DOM.taskModal = modal;
    DOM.taskForm = modal.querySelector('#task-form');
    DOM.taskMessage = modal.querySelector('.task-modal-message');

    modal.querySelector('.task-modal-close').addEventListener('click', closeTaskModal);
    modal.querySelector('.task-modal-overlay').addEventListener('click', closeTaskModal);
    modal.querySelector('.task-modal-cancel').addEventListener('click', closeTaskModal);
    DOM.taskForm.addEventListener('submit', handleTaskFormSubmit);
}

function openTaskModal(initialTitle = '') {
    initTaskModal();
    if (!DOM.taskModal) return;

    DOM.taskForm.reset();
    DOM.taskMessage.textContent = '';
    DOM.taskModal.classList.add('visible');
    document.body.classList.add('task-modal-open');

    const titleInput = DOM.taskForm.querySelector('input[name="task-title"]');
    titleInput.value = initialTitle || '';
    titleInput.focus();
    titleInput.select();
}

function closeTaskModal() {
    if (!DOM.taskModal) return;
    DOM.taskModal.classList.remove('visible');
    document.body.classList.remove('task-modal-open');
}

async function handleTaskFormSubmit(event) {
    event.preventDefault();
    if (!DOM.taskForm) return;

    const form = DOM.taskForm;
    const title = form.querySelector('input[name="task-title"]').value.trim();
    const description = form.querySelector('textarea[name="task-description"]').value.trim();
    const startDate = form.querySelector('input[name="task-start"]').value;
    const dueDate = form.querySelector('input[name="task-due"]').value;

    if (!title) {
        DOM.taskMessage.textContent = 'Title is required.';
        return;
    }

    DOM.taskMessage.textContent = 'Creating task...';
    form.querySelector('button[type="submit"]').disabled = true;

    try {
        await createNextcloudTask({ title, description, startDate, dueDate });
        DOM.taskMessage.textContent = 'Task created!';
        setTimeout(() => closeTaskModal(), 800);
    } catch (error) {
        console.error('Task creation failed:', error);
        DOM.taskMessage.textContent = error.message || 'Unable to create task.';
    } finally {
        form.querySelector('button[type="submit"]').disabled = false;
    }
}

async function createNextcloudTask(task) {
    if (!CONFIG.NEXTCLOUD_URL || CONFIG.NEXTCLOUD_USER === 'YOUR_USERNAME' ||
        !CONFIG.NEXTCLOUD_PASS || !CONFIG.NEXTCLOUD_TASKS_CALENDAR_PATH) {
        throw new Error('Configure Nextcloud task credentials and calendar path.');
    }

    const uid = generateUID();
    const dtstamp = formatToICS(new Date());
    const dtstart = formatToICS(task.startDate);
    const due = formatToICS(task.dueDate);
    const summary = escapeICSText(task.title);
    const description = escapeICSText(task.description);

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Jumperlink//Tasks//EN',
        'BEGIN:VTODO',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `SUMMARY:${summary || 'Task'}`
    ];

    if (description) lines.push(`DESCRIPTION:${description}`);
    if (dtstart) lines.push(`DTSTART:${dtstart}`);
    if (due) lines.push(`DUE:${due}`);

    lines.push('STATUS:NEEDS-ACTION');
    lines.push('END:VTODO');
    lines.push('END:VCALENDAR');

    const icsBody = lines.join('\r\n');

    const baseUrl = CONFIG.NEXTCLOUD_URL.replace(/\/$/, '');
    let calendarPath = CONFIG.NEXTCLOUD_TASKS_CALENDAR_PATH.replace(/^\//, '/');
    if (!calendarPath.endsWith('/')) {
        calendarPath += '/';
    }
    const taskUrl = `${baseUrl}${calendarPath}${uid}.ics`;

    const auth = btoa(`${CONFIG.NEXTCLOUD_USER}:${CONFIG.NEXTCLOUD_PASS}`);

    const response = await fetch(taskUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'text/calendar; charset=utf-8'
        },
        body: icsBody
    });

    if (!response.ok) {
        throw new Error('Nextcloud rejected the task request.');
    }
}

function formatToICS(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeICSText(text) {
    if (!text) return '';
    return text
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
}

function generateUID() {
    if (window.crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ============================================================================
// RESULT SELECTION
// ============================================================================

function selectSuggestion(item) {
    console.log('[Search] Selected:', item);

    if (item.type === 'wikipedia') {
        loadWikipediaArticle(item.title);
    } else if (item.type === 'bookmark') {
        window.open(item.url, '_blank');
        exitSearchMode();
    }
}

// ============================================================================
// WIKIPEDIA DISPLAY
// ============================================================================

async function loadWikipediaArticle(title) {
    try {
        const url = `${CONFIG.WIKI_API}?origin=*&action=parse&page=${encodeURIComponent(title)}&prop=text|sections&format=json&redirects=1`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            showError(`Wikipedia: ${data.error.info}`);
            return;
        }

        displayWikipediaArticle(data.parse);

        // Update URL to reflect current article
        updateURL({ wiki: data.parse.title });
    } catch (error) {
        console.error('Wikipedia load error:', error);
        showError('Failed to load Wikipedia article');
    }
}

function displayWikipediaArticle(article) {
    // Update page title
    if (DOM.pageTitleText) {
        DOM.pageTitleText.textContent = article.title;
    } else if (DOM.pageTitle) {
        DOM.pageTitle.innerHTML = `<p>${escapeHtml(article.title)}</p>`;
    }
    DOM.subtitle.innerHTML = `<p>Wikipedia</p>`;

    // Parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = article.text['*'];

    // Extract infobox
    const infobox = tempDiv.querySelector('.infobox');
    let infoboxHTML = '';
    if (infobox) {
        infobox.style.outline = '1px solid gray';
        infobox.style.width = '100%';
        infoboxHTML = infobox.outerHTML;
        infobox.remove();
    }

    // Build TOC from sections data
    let tocHTML = '';
    if (article.sections && article.sections.length > 0) {
        const tocItems = article.sections
            .filter(section => section.toclevel === 1) // Only show major categories
            .map(section => {
                return `
                    <div class="toc-item" data-anchor="${escapeHtml(section.anchor)}"
                         style="padding:0.5rem; cursor:pointer; border-bottom:1px solid #333; transition:background 0.2s ease;">
                        <span style="color:#888;">${section.number}</span>
                        <span style="margin-left:0.5rem;">${escapeHtml(section.line)}</span>
                    </div>
                `;
            })
            .join('');

        tocHTML = `
            <div style="background:#1a1a1a; border:1px solid #444; padding:0.75rem;">
                <div style="font-weight:bold; margin-bottom:0.5rem;">Contents</div>
                ${tocItems}
            </div>
        `;
    }

    // Try to extract TOC from HTML as fallback
    if (!tocHTML) {
        const toc = tempDiv.querySelector('#toc, .toc');
        if (toc) {
            tocHTML = toc.outerHTML;
            toc.remove();
        }
    }

    // Clean up the full article content
    tempDiv.querySelectorAll('sup.reference').forEach(el => el.remove());
    tempDiv.querySelectorAll('.mw-editsection').forEach(el => el.remove());

    // Display full article in text
    DOM.text.innerHTML = `
        ${tempDiv.innerHTML}
        <p style="margin-top:1rem;">
            <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(article.title)}"
               target="_blank"
               style="color:#4a9eff;">
                Read more on Wikipedia
            </a>
        </p>
    `;

    // Display TOC and infobox in overview
    DOM.overview.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1%;">
            <div>${tocHTML || '<p>No table of contents</p>'}</div>
            <div>${infoboxHTML || '<p>No infobox available</p>'}</div>
        </div>
    `;

    // Add click handlers to TOC items
    document.querySelectorAll('.toc-item').forEach(item => {
        item.addEventListener('click', () => {
            const anchor = item.dataset.anchor;
            const targetElement = DOM.text.querySelector(`#${anchor}, [id="${anchor}"]`);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });

        item.addEventListener('mouseenter', () => {
            item.style.background = '#2a2a2a';
        });

        item.addEventListener('mouseleave', () => {
            item.style.background = '';
        });
    });

    // Intercept clicks on internal Wikipedia links
    DOM.text.querySelectorAll('a[href^="/wiki/"]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            // Extract article title from /wiki/Article_Title
            const articleTitle = decodeURIComponent(href.replace('/wiki/', ''));
            // Don't load special pages or file pages
            if (!articleTitle.includes(':')) {
                loadWikipediaArticle(articleTitle);
            }
        });
    });

    // Extract external links from intro
    const externalLinks = [];
    tempDiv.querySelectorAll('a[href^="http"]').forEach(a => {
        if (!a.href.includes('wikipedia.org') && !a.href.includes('wikimedia.org')) {
            const domain = new URL(a.href).hostname;
            externalLinks.push({ url: a.href, domain });
        }
    });

    // Display external links in dock
    if (externalLinks.length > 0) {
        const linksHTML = externalLinks.slice(0, 5).map(link => `
            <a href="${escapeHtml(link.url)}" target="_blank" style="margin:0.5rem; display:inline-block;">
                <img src="https://www.google.com/s2/favicons?domain=${link.domain}"
                     alt="${link.domain}"
                     title="${link.domain}"
                     style="width:32px; height:32px;">
            </a>
        `).join('');

        DOM.dock.innerHTML = linksHTML;
    } else {
        DOM.dock.innerHTML = '';
    }
}

// ============================================================================
// SEARCH FALLBACK
// ============================================================================

async function showSearchFallback(query) {
    console.log('[Search] No direct results, showing fallback for:', query);

    const encodedQuery = encodeURIComponent(query);

    // Show fallback search links in overview
    DOM.overview.innerHTML = `
        <p style="margin-bottom:1rem; font-size:1.1em;">No direct results. Try searching on:</p>
        <div class="quick-search-links">
            <a href="https://duckduckgo.com/?q=${encodedQuery}" target="_blank">DuckDuckGo</a>
            <a href="https://www.google.com/search?tbm=isch&q=${encodedQuery}" target="_blank">Google Images</a>
            <a href="https://www.perplexity.ai/search?q=${encodedQuery}" target="_blank">Perplexity AI</a>
            <button type="button" class="quick-task-btn">Add to Tasks</button>
        </div>
    `;
    attachQuickTaskButton(DOM.overview, query);

    // Get AI answer in text area
    DOM.text.innerHTML = '<div style="padding:1rem; color:#888;">Getting AI answer...</div>';

    try {
        const aiAnswer = await getOpenRouterAnswer(query);
        DOM.text.innerHTML = `
            <p style="font-style:italic; color:#888; margin-bottom:1rem;">AI-generated answer:</p>
            <p style="line-height:1.6;">${escapeHtml(aiAnswer)}</p>
            <p style="margin-top:1rem;">
                <a href="https://chat.jumperlink.net" target="_blank" style="color:#4a9eff;">
                    Continue conversation
                </a>
            </p>
        `;
    } catch (error) {
        console.error('OpenRouter error:', error);
        DOM.text.innerHTML = `
            <p style="color:#f88;">Unable to get AI answer. Configure OpenRouter API key.</p>
            <p style="margin-top:1rem;">
                <a href="https://chat.jumperlink.net" target="_blank" style="color:#4a9eff;">
                    Ask on chat.jumperlink.net
                </a>
            </p>
        `;
    }

    // Quick search icons in dock
    DOM.dock.innerHTML = `
        <div style="display:flex; gap:1rem; align-items:center;">
            <a href="https://duckduckgo.com/?q=${encodedQuery}" target="_blank" title="DuckDuckGo">
                <img src="https://duckduckgo.com/favicon.ico" alt="DDG" style="width:32px; height:32px;">
            </a>
            <a href="https://www.google.com/search?tbm=isch&q=${encodedQuery}" target="_blank" title="Google Images">
                <img src="https://www.google.com/favicon.ico" alt="Google" style="width:32px; height:32px;">
            </a>
            <a href="https://www.youtube.com/results?search_query=${encodedQuery}" target="_blank" title="YouTube">
                <img src="https://www.youtube.com/favicon.ico" alt="YouTube" style="width:32px; height:32px;">
            </a>
            <a href="https://chat.jumperlink.net" target="_blank" title="Chat">
                <span style="font-size:32px;">&#128172;</span>
            </a>
        </div>
    `;
}

async function getOpenRouterAnswer(query) {
    if (CONFIG.OPENROUTER_API_KEY === 'YOUR_OPENROUTER_API_KEY_HERE') {
        throw new Error('OpenRouter API key not configured');
    }

    const response = await fetch(CONFIG.OPENROUTER_API, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.href,
            'X-Title': 'Jumperlink Dashboard'
        },
        body: JSON.stringify({
            model: 'openai/gpt-3.5-turbo',
            messages: [
                {
                    role: 'user',
                    content: query
                }
            ]
        })
    });

    if (!response.ok) throw new Error('OpenRouter request failed');

    const data = await response.json();
    return data.choices[0].message.content;
}

// ============================================================================
// UI HELPERS
// ============================================================================

function showHomeModeUI() {
    if (DOM.subtitle) {
        DOM.subtitle.style.display = '';
    }
    document.body.classList.remove('search-mode');
    updateSearchTriggerIcons(false);
}

function showError(message) {
    DOM.text.innerHTML = `<div style="padding:1rem; color:#f88;">${escapeHtml(message)}</div>`;
}

// ============================================================================
// UTILITIES
// ============================================================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function stripHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || div.innerText || '').trim();
}

// ============================================================================
// CONSOLE BANNER
// ============================================================================

console.log('%c JUMPERLINK DASHBOARD v1.0 ', 'background: #4a9eff; color: #000; font-weight: bold; padding: 4px;');
console.log('Personal Search & Info Dashboard');
console.log('Configure API keys in script.js CONFIG object');
function handleExternalSearchRedirect(query) {
    const raw = (query ?? '').toString();
    const trimmed = raw.trim();
    if (!trimmed) return;

    const endsWithCommand = /\sp\s*$/i.test(raw);
    const baseQuery = endsWithCommand
        ? raw.replace(/\sp\s*$/i, '').trim()
        : trimmed;

    let targetUrl = `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;

    if (endsWithCommand) {
        const commandLength = baseQuery.length;
        const encodedBase = encodeURIComponent(baseQuery);
        if (commandLength > 45) {
            targetUrl = `https://www.perplexity.ai/search?q=${encodedBase}`;
        } else {
            targetUrl = `https://www.google.com/search?tbm=isch&q=${encodedBase}`;
        }
    }

    window.open(targetUrl, '_blank', 'noopener');
}
