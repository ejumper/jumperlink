// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const CONFIG = {
    // API Keys (REPLACE WITH YOUR OWN)
    OPENROUTER_API_KEY: 'YOUR_OPENROUTER_API_KEY_HERE',

    // Trakt.tv Configuration (REPLACE WITH YOUR OWN)
    TRAKT_CLIENT_ID: '9b9ca3fb155774ee1d2aa86ea64d1b183c7c749510a6d0fdcd040a5b11a7d406',
    TRAKT_CLIENT_SECRET: '1664d2c2e05c336d7187c5f92de9ffbe72fa8a9dd80edd65cda7c42971a2003e',
    TRAKT_ACCESS_TOKEN: 'b3f304e60886997be93c49c9fff9911038bed97ac1050a7f1a7578c461a42a2c',
    TRAKT_API_VERSION: '2',

    // Nextcloud News Configuration
    NEXTCLOUD_URL: 'https://cloud.jumperlink.net',
    NEXTCLOUD_USER: 'admin',
    NEXTCLOUD_PASS: 'J5Lc7-oRQa7-2pyX5-Xdm53-8ERan',
    NEXTCLOUD_TASKS_CALENDAR_PATH: '/remote.php/dav/calendars/admin/personal/', // Update to your tasks calendar

    // API Endpoints
    WIKI_API: 'https://en.wikipedia.org/w/api.php',
    OPENROUTER_API: 'https://openrouter.ai/api/v1/chat/completions',
    TRAKT_API: 'https://api.trakt.tv',

    // Settings
    INITIAL_FEED_ITEMS: 20, // Initial feed load
    FEED_ITEMS_PER_PAGE: 10, // Items to load per "load more" click
    SUGGESTION_LIMIT: { wikipedia: 5, bookmarks: 5, trakt: 5 },
    DEBOUNCE_MS: 300,
    UPDATE_TIME_INTERVAL: 1000, // Update clock every second
    SHOW_POST_CONTENT: true, // Show post content in cards
    POST_CONTENT_LIMIT: 280, // Character limit for post preview
    TIMERS_API_BASE: 'https://timers.cloudflare-ceremony099.workers.dev',
    TIMERS_BOARD_ID: 'main',
    TIMER_TICK_INTERVAL: 500
};

const LOCAL_STORAGE_KEYS = {
    readItems: 'jumperlink_read_items',
    readSyncQueue: 'jumperlink_read_sync_queue'
};

const FALLBACK_FAVICON = 'icons/web.webp';

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
    feedViewFilter: 'unviewed', // 'unviewed' or 'all'
    latestItems: [],
    pendingReadMarks: new Set(),
    readSyncQueue: new Set(),
    localReadItems: new Set(),
    timerBoardId: null,
    timers: [],
    timerPanelVisible: false,
    timerTickIntervalId: null,
    timerBoardLoaded: false,
    timerBoardInitialized: false,
    finishingTimers: new Set(),
    finishedTimers: new Set(),
    timerAudioMap: new Map(),
    timerError: false,
    feedOffset: 0, // Pagination offset for feed items
    feedHasMore: true, // Whether more items are available to load
    feedLoading: false, // Loading state for load more button

    // Keyboard navigation state
    navigationMode: null, // null, 'search', 'bookmarks', 'applinks', 'feed'
    navigationIndex: -1, // Current index in the navigable items
    navigationItems: [] // Current list of navigable items
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
    taskMessage: null,
    clockToggle: null
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

    await initTimerBoard();

    // Initialize home mode
    loadHomeMode();

    // Set up search inputs
    setupSearchInputs();

    // Handle URL parameters for direct navigation
    handleURLRouting();

    // Set up browser history navigation
    setupHistoryNavigation();

    // Set up keyboard navigation
    setupKeyboardNavigation();

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

// ============================================================================
// KEYBOARD NAVIGATION
// ============================================================================

function setupKeyboardNavigation() {
    document.addEventListener('keydown', handleGlobalKeydown);
    console.log('[Navigation] Keyboard shortcuts enabled');
}

function handleGlobalKeydown(e) {
    // Ignore if modifier keys are pressed (except Shift for some shortcuts)
    if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
    }

    // Check if user is typing in an input field
    const isInputFocused = document.activeElement && (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.isContentEditable
    );

    // Handle Escape key (works even in input fields)
    if (e.key === 'Escape') {
        if (STATE.navigationMode) {
            // Exit navigation mode only
            e.preventDefault();
            exitNavigationMode();
            return;
        }
        // Let search input's own handler deal with Escape if not in navigation mode
        // This maintains existing behavior
        return;
    }

    // Handle arrow keys and Enter when in navigation mode
    if (STATE.navigationMode) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            navigateDown();
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            navigateUp();
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            activateCurrentItem();
            return;
        }
    }

    // Special handling for arrow down in search input when not in navigation mode
    // This allows starting navigation from the search input
    if (isInputFocused && document.activeElement === DOM.searchInput) {
        if (e.key === 'ArrowDown' && STATE.currentSuggestions.length > 0 && !STATE.navigationMode) {
            e.preventDefault();
            enterSearchNavigationMode();
            return;
        }
    }

    // Don't process shortcuts if typing in input (except when in search input for arrow navigation)
    if (isInputFocused && document.activeElement !== DOM.searchInput) {
        return;
    }

    // Handle keyboard shortcuts
    switch (e.key.toLowerCase()) {
        case 's':
            if (!isInputFocused) {
                e.preventDefault();
                enterSearchMode();
            }
            break;
        case 'b':
            if (!isInputFocused) {
                e.preventDefault();
                enterBookmarkNavigationMode();
            }
            break;
        case 'a':
            if (!isInputFocused) {
                e.preventDefault();
                enterApplinkNavigationMode();
            }
            break;
        case 'r':
            if (!isInputFocused) {
                e.preventDefault();
                enterFeedNavigationMode();
            }
            break;
    }
}

function enterBookmarkNavigationMode() {
    const bookmarkLinks = document.querySelectorAll('.bookmark-link');
    if (bookmarkLinks.length === 0) {
        console.log('[Navigation] No bookmarks to navigate');
        return;
    }

    STATE.navigationMode = 'bookmarks';
    STATE.navigationItems = Array.from(bookmarkLinks);
    STATE.navigationIndex = 0;
    updateNavigationHighlight();
    console.log('[Navigation] Bookmark navigation mode activated');
}

function enterApplinkNavigationMode() {
    const appLinks = document.querySelectorAll('dock a');
    if (appLinks.length === 0) {
        console.log('[Navigation] No app links to navigate');
        return;
    }

    STATE.navigationMode = 'applinks';
    STATE.navigationItems = Array.from(appLinks);
    STATE.navigationIndex = 0;
    updateNavigationHighlight();
    console.log('[Navigation] Applink navigation mode activated');
}

function enterFeedNavigationMode() {
    const feedItems = document.querySelectorAll('.feed-item');
    if (feedItems.length === 0) {
        console.log('[Navigation] No feed items to navigate');
        return;
    }

    STATE.navigationMode = 'feed';
    STATE.navigationItems = Array.from(feedItems);
    STATE.navigationIndex = 0;
    updateNavigationHighlight();
    console.log('[Navigation] Feed navigation mode activated');
}

function enterSearchNavigationMode() {
    const suggestionItems = document.querySelectorAll('.suggestion-item');
    if (suggestionItems.length === 0) {
        return;
    }

    STATE.navigationMode = 'search';
    STATE.navigationItems = Array.from(suggestionItems);
    STATE.navigationIndex = 0;
    updateNavigationHighlight();
}

function exitNavigationMode() {
    if (STATE.navigationMode) {
        console.log('[Navigation] Exiting navigation mode:', STATE.navigationMode);
        clearNavigationHighlight();
        STATE.navigationMode = null;
        STATE.navigationIndex = -1;
        STATE.navigationItems = [];
    }
}

function navigateDown() {
    if (!STATE.navigationMode || STATE.navigationItems.length === 0) {
        return;
    }

    STATE.navigationIndex = (STATE.navigationIndex + 1) % STATE.navigationItems.length;
    updateNavigationHighlight();
    scrollToNavigationItem();
}

function navigateUp() {
    if (!STATE.navigationMode || STATE.navigationItems.length === 0) {
        return;
    }

    STATE.navigationIndex = (STATE.navigationIndex - 1 + STATE.navigationItems.length) % STATE.navigationItems.length;
    updateNavigationHighlight();
    scrollToNavigationItem();
}

function updateNavigationHighlight() {
    clearNavigationHighlight();

    if (STATE.navigationIndex >= 0 && STATE.navigationIndex < STATE.navigationItems.length) {
        const item = STATE.navigationItems[STATE.navigationIndex];
        item.classList.add('nav-highlight');
    }
}

function clearNavigationHighlight() {
    document.querySelectorAll('.nav-highlight').forEach(el => {
        el.classList.remove('nav-highlight');
    });
}

function scrollToNavigationItem() {
    if (STATE.navigationIndex >= 0 && STATE.navigationIndex < STATE.navigationItems.length) {
        const item = STATE.navigationItems[STATE.navigationIndex];
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function activateCurrentItem() {
    if (STATE.navigationIndex < 0 || STATE.navigationIndex >= STATE.navigationItems.length) {
        return;
    }

    const item = STATE.navigationItems[STATE.navigationIndex];

    switch (STATE.navigationMode) {
        case 'search':
            // Find the suggestion data index
            const index = parseInt(item.getAttribute('data-index'), 10);
            if (!isNaN(index) && STATE.currentSuggestions[index]) {
                selectSuggestion(STATE.currentSuggestions[index]);
            }
            break;

        case 'bookmarks':
            // Click the bookmark link
            item.click();
            exitNavigationMode();
            break;

        case 'applinks':
            // Click the app link
            item.click();
            exitNavigationMode();
            break;

        case 'feed':
            // Find and click the feed item link
            const feedLink = item.querySelector('.feed-item-title a, a');
            if (feedLink) {
                feedLink.click();
            }
            exitNavigationMode();
            break;
    }
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

    ensureClockToggle();
    if (DOM.clockToggle) {
        DOM.clockToggle.textContent = timeString;
    } else if (DOM.pageTitleText) {
        DOM.pageTitleText.textContent = timeString;
    }

    if (DOM.subtitle) {
        DOM.subtitle.innerHTML = `<p>${dateString}</p>`;
    }
}

function ensureClockToggle() {
    if (DOM.clockToggle) return;

    const target = DOM.pageTitleText || DOM.pageTitle;
    if (!target) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'clock-toggle';
    button.addEventListener('click', handleClockToggle);

    if (DOM.pageTitleText) {
        DOM.pageTitleText.innerHTML = '';
        DOM.pageTitleText.appendChild(button);
    } else if (DOM.pageTitle) {
        DOM.pageTitle.innerHTML = '';
        DOM.pageTitle.appendChild(button);
    }

    DOM.clockToggle = button;
    syncTimerPanelState();
}

function handleClockToggle() {
    toggleTimerPanel();
}

// ============================================================================
// TIMER BOARD
// ============================================================================

async function initTimerBoard() {
    STATE.timerBoardId = CONFIG.TIMER_BOARD_ID || 'main';
    await fetchTimerBoard(true);
    startTimerTicker();
}

function getTimersApiBase() {
    const base = CONFIG.TIMERS_API_BASE || '';
    return base.endsWith('/') ? base.slice(0, -1) : base;
}

async function fetchTimerBoard(initial = false) {
    if (!STATE.timerBoardId) return;
    try {
        const response = await fetch(`${getTimersApiBase()}/api/boards/${encodeURIComponent(STATE.timerBoardId)}/timers`);
        if (!response.ok) throw new Error('Failed to fetch timers');
        const data = await response.json();
        handleTimerBoardResponse(data, initial);
        STATE.timerError = false;
    } catch (error) {
        console.error('Timer fetch error:', error);
        STATE.timerError = true;
        renderTimerLists();
    }
}

async function sendTimerMutation(action, payload) {
    if (!STATE.timerBoardId) return;
    try {
        const response = await fetch(`${getTimersApiBase()}/api/boards/${encodeURIComponent(STATE.timerBoardId)}/timers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action, payload })
        });
        if (!response.ok) throw new Error('Timer mutation failed');
        const data = await response.json();
        handleTimerBoardResponse(data);
        STATE.timerError = false;
        return data;
    } catch (error) {
        console.error('Timer mutation error:', error);
        STATE.timerError = true;
        renderTimerLists();
        throw error;
    }
}

function handleTimerBoardResponse(board, initial = false) {
    if (!board || !Array.isArray(board.timers)) {
        STATE.timers = [];
        renderTimerLists();
        return;
    }

    const previousTimers = STATE.timers || [];
    const previousMap = new Map(previousTimers.map(timer => [timer.id, timer]));

    STATE.timers = board.timers;
    STATE.timerBoardLoaded = true;

    if (initial && !STATE.timerBoardInitialized) {
        STATE.finishedTimers = new Set(board.timers.filter(timer => timer.state === 'finished').map(timer => timer.id));
        STATE.timerBoardInitialized = true;
    } else {
        board.timers.forEach(timer => {
            const prevState = previousMap.get(timer.id)?.state;
            if (timer.state === 'finished') {
                if (!STATE.finishedTimers.has(timer.id) && !STATE.finishingTimers.has(timer.id) && prevState !== 'finished') {
                    triggerTimerCompletion(timer);
                }
            } else {
                STATE.finishedTimers.delete(timer.id);
                STATE.finishingTimers.delete(timer.id);
                stopTimerAudio(timer.id);
            }
        });

        previousTimers.forEach(timer => {
            if (!STATE.timers.find(current => current.id === timer.id)) {
                STATE.finishedTimers.delete(timer.id);
                STATE.finishingTimers.delete(timer.id);
                stopTimerAudio(timer.id);
            }
        });
    }

    renderTimerLists();
}

function triggerTimerCompletion(timer) {
    STATE.finishingTimers.add(timer.id);
    renderTimerLists();

    const audio = new Audio('sounds/ringtone.m4a');
    STATE.timerAudioMap.set(timer.id, audio);

    const endHandler = () => {
        STATE.finishingTimers.delete(timer.id);
        STATE.finishedTimers.add(timer.id);
        STATE.timerAudioMap.delete(timer.id);
        renderTimerLists();
    };

    audio.addEventListener('ended', endHandler, { once: true });
    audio.addEventListener('error', endHandler, { once: true });

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => endHandler());
    }
}

function stopTimerAudio(timerId) {
    const audio = STATE.timerAudioMap.get(timerId);
    if (audio) {
        try {
            audio.pause();
            audio.currentTime = 0;
        } catch (err) {
            console.warn('Unable to stop timer audio:', err);
        }
        STATE.timerAudioMap.delete(timerId);
    }
}

function startTimerTicker() {
    if (STATE.timerTickIntervalId) {
        clearInterval(STATE.timerTickIntervalId);
    }
    STATE.timerTickIntervalId = setInterval(updateTimerCountdowns, CONFIG.TIMER_TICK_INTERVAL);
}

function updateTimerCountdowns() {
    if (!STATE.timerBoardLoaded) return;
    const now = Date.now();
    STATE.timers.forEach(timer => {
        const row = document.querySelector(`.timer-row[data-timer-id="${timer.id}"]`);
        if (!row) return;

        const remainingEl = row.querySelector('.timer-remaining');
        const progressEl = row.querySelector('.timer-progress-fill');
        const remaining = remainingMs(timer, now);

        if (remainingEl) {
            remainingEl.textContent = formatRemaining(remaining);
        }
        if (progressEl) {
            const percent = timer.durationMs > 0
                ? Math.min(100, ((timer.durationMs - remaining) / timer.durationMs) * 100)
                : 100;
            progressEl.style.width = `${percent}%`;
        }
    });
}

function renderTimerLists() {
    const panel = document.querySelector('.timer-panel');
    if (!panel) return;

    const activeContainer = panel.querySelector('.timer-items');
    const finishedContainer = panel.querySelector('.finished-timer-items');
    if (!activeContainer || !finishedContainer) return;

    const now = Date.now();
    const finishingIds = STATE.finishingTimers;

    const activeTimers = STATE.timers
        .filter(timer => timer.state !== 'finished' || finishingIds.has(timer.id))
        .sort((a, b) => remainingMs(a, now) - remainingMs(b, now));

    const finishedTimers = STATE.timers
        .filter(timer => timer.state === 'finished' && !finishingIds.has(timer.id))
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

    const errorMessage = STATE.timerError
        ? '<div class="timer-empty timer-error">Unable to reach timer service</div>'
        : null;
    const loadingMessage = !STATE.timerBoardLoaded && !STATE.timerError
        ? '<div class="timer-empty">Loading timers…</div>'
        : null;

    activeContainer.innerHTML = errorMessage
        || (activeTimers.length
            ? activeTimers.map(timer => renderTimerRow(timer, now, finishingIds.has(timer.id))).join('')
            : (loadingMessage || '<div class="timer-empty">No active timers</div>'));

    finishedContainer.innerHTML = errorMessage
        || (finishedTimers.length
            ? finishedTimers.map(timer => renderFinishedTimerRow(timer)).join('')
            : (loadingMessage || '<div class="timer-empty">No finished timers</div>'));

    updateTimerCountdowns();
    syncTimerPanelState();
}

function renderTimerRow(timer, now, isFinishing) {
    const remaining = remainingMs(timer, now);
    const progressPercent = timer.durationMs > 0
        ? Math.min(100, ((timer.durationMs - remaining) / timer.durationMs) * 100)
        : 0;
    const isRunning = timer.state === 'running';
    const rowClasses = [
        'timer-row',
        isRunning ? 'timer-row--running' : '',
        isFinishing ? 'timer-row--finishing' : ''
    ].join(' ');

    return `
        <div class="${rowClasses}" data-timer-id="${timer.id}">
            <div class="timer-progress-fill" style="width:${progressPercent}%"></div>
            <div class="timer-row-main">
                <div class="timer-name">${escapeHtml(timer.label || 'Timer')}</div>
                <div class="timer-remaining">${formatRemaining(remaining)}</div>
            </div>
            <div class="timer-row-actions">
                <button type="button"
                    class="timer-action-btn"
                    data-timer-action="${isRunning ? 'pause' : 'start'}"
                    data-timer-id="${timer.id}">
                    ${isRunning ? 'Pause' : 'Start'}
                </button>
                <button type="button"
                    class="timer-action-btn"
                    data-timer-action="reset"
                    data-timer-id="${timer.id}">
                    Stop
                </button>
            </div>
        </div>
    `;
}

function renderFinishedTimerRow(timer) {
    return `
        <div class="timer-row timer-row--finished" data-timer-id="${timer.id}">
            <div class="timer-progress-fill" style="width:100%;"></div>
            <div class="timer-row-main">
                <div class="timer-name">${escapeHtml(timer.label || 'Timer')}</div>
                <div class="timer-remaining">Finished</div>
            </div>
            <div class="timer-row-actions">
                <button type="button"
                    class="timer-action-btn"
                    data-timer-action="start"
                    data-timer-id="${timer.id}">
                    Restart
                </button>
                <button type="button"
                    class="timer-action-btn"
                    data-timer-action="delete"
                    data-timer-id="${timer.id}">
                    Delete
                </button>
            </div>
        </div>
    `;
}

function effectiveElapsedMs(timer, now) {
    if (timer.state === 'running' && timer.startedAt) {
        const started = Date.parse(timer.startedAt);
        return timer.elapsedMs + (now - started);
    }
    return timer.elapsedMs;
}

function remainingMs(timer, now) {
    const elapsed = effectiveElapsedMs(timer, now);
    return Math.max(0, timer.durationMs - elapsed);
}

function formatRemaining(ms) {
    if (!Number.isFinite(ms)) return '--';
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
}

function toggleTimerPanel() {
    STATE.timerPanelVisible = !STATE.timerPanelVisible;
    syncTimerPanelState();
}

function syncTimerPanelState() {
    const panel = document.querySelector('.timer-panel');
    if (panel) {
        panel.classList.toggle('open', STATE.timerPanelVisible);
    }
    const toggleBtn = document.querySelector('.timer-toggle-btn');
    if (toggleBtn) {
        toggleBtn.classList.toggle('active', STATE.timerPanelVisible);
    }
    if (DOM.clockToggle) {
        DOM.clockToggle.classList.toggle('active', STATE.timerPanelVisible);
    }
}

async function handleTimerFormSubmit(event) {
    event.preventDefault();
    const form = event.target.closest('.timer-add-form');
    if (!form) return;

    const labelInput = form.querySelector('.timer-label-input');
    const countdownInputs = form.querySelectorAll('.timer-count-field');
    const dateInput = form.querySelector('.timer-date-input');

    const label = (labelInput?.value || '').trim() || 'Timer';
    const countdownMs = calculateCountdownMs(countdownInputs);
    const dateDurationMs = calculateDateTargetMs(dateInput);

    let durationMs = 0;
    if (countdownMs > 0 && !dateInput?.value) {
        durationMs = countdownMs;
    } else if (dateDurationMs > 0 && countdownMs === 0) {
        durationMs = dateDurationMs;
    }

    if (durationMs <= 0) {
        alert('Please provide a countdown duration or a future date/time.');
        return;
    }

    const previousIds = new Set(STATE.timers.map(timer => timer.id));
    try {
        const board = await sendTimerMutation('create', { label, durationMs });
        const newTimer = board?.timers?.find(timer => !previousIds.has(timer.id));
        if (newTimer) {
            await sendTimerMutation('command', { id: newTimer.id, command: 'start' });
        }
    } catch (error) {
        console.error('Timer create error:', error);
        alert('Unable to create timer. Please try again when the timer service is reachable.');
    }

    labelInput.value = '';
    countdownInputs.forEach(select => {
        select.value = '';
        select.disabled = false;
    });
    if (dateInput) {
        dateInput.value = '';
        dateInput.disabled = false;
    }
}

function calculateCountdownMs(inputs) {
    if (!inputs || inputs.length === 0) return 0;
    let total = 0;
    inputs.forEach(input => {
        const value = Number(input.value);
        if (!Number.isFinite(value) || value <= 0) {
            return;
        }
        switch (input.dataset.unit) {
            case 'days':
                total += value * 86400000;
                break;
            case 'hours':
                total += value * 3600000;
                break;
            case 'minutes':
                total += value * 60000;
                break;
            case 'seconds':
                total += value * 1000;
                break;
            default:
                break;
        }
    });
    return total;
}

function calculateDateTargetMs(dateInput) {
    if (!dateInput || !dateInput.value) return 0;
    const selected = Date.parse(dateInput.value);
    const now = Date.now();
    if (!Number.isFinite(selected) || selected <= now) {
        return 0;
    }
    return selected - now;
}

function handleCountdownInputChange(form) {
    if (!form) return;
    const countdownInputs = form.querySelectorAll('.timer-count-field');
    const dateInput = form.querySelector('.timer-date-input');
    if (!dateInput) return;

    const hasCountdown = Array.from(countdownInputs).some(input => Number(input.value) > 0);
    dateInput.disabled = hasCountdown;
    if (hasCountdown) {
        dateInput.value = '';
    }
}

function handleDateInputChange(form) {
    if (!form) return;
    const countdownInputs = form.querySelectorAll('.timer-count-field');
    const dateInput = form.querySelector('.timer-date-input');
    if (!dateInput) return;

    const hasDate = Boolean(dateInput.value);
    countdownInputs.forEach(input => {
        input.disabled = hasDate;
        if (hasDate) {
            input.value = '';
        }
    });
}

async function handleTimerPanelAction(event) {
    const actionButton = event.target.closest('[data-timer-action]');
    if (!actionButton) return;

    const { timerAction, timerId } = actionButton.dataset;
    if (!timerId) return;
    const timer = STATE.timers.find(entry => entry.id === timerId);

    if (timerAction === 'delete') {
        try {
            await sendTimerMutation('delete', { id: timerId });
        } catch (error) {
            console.error('Timer delete error:', error);
        }
        return;
    }

    if (timerAction === 'reset') {
        try {
            await sendTimerMutation('command', { id: timerId, command: 'reset' });
        } catch (error) {
            console.error('Timer reset error:', error);
        }
        return;
    }

    if (timerAction === 'start' || timerAction === 'pause') {
        if (timerAction === 'start' && timer && timer.state === 'finished') {
            try {
                await sendTimerMutation('command', { id: timerId, command: 'reset' });
                await sendTimerMutation('command', { id: timerId, command: 'start' });
            } catch (error) {
                console.error('Timer restart error:', error);
            }
            return;
        }
        try {
            await sendTimerMutation('command', {
                id: timerId,
                command: timerAction === 'start' ? 'start' : 'pause'
            });
        } catch (error) {
            console.error('Timer command error:', error);
        }
    }
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

async function loadNextcloudFeed(folderId = null, appendMode = false) {
    if (!CONFIG.NEXTCLOUD_URL || CONFIG.NEXTCLOUD_USER === 'YOUR_USERNAME') {
        STATE.latestItems = [];
        const placeholder = '<p style="padding:1rem;"><em>Configure Nextcloud credentials to see your news feed</em></p>';
        DOM.overview.innerHTML = getFeedControlsHTML() + placeholder;
        attachViewToggleHandlers();
        attachFolderClickHandlers();
        attachTimerControlHandlers();
        renderTimerLists();
        syncTimerPanelState();
        return;
    }

    try {
        const auth = btoa(`${CONFIG.NEXTCLOUD_USER}:${CONFIG.NEXTCLOUD_PASS}`);

        // Determine batch size based on whether this is initial load or load more
        const batchSize = appendMode ? CONFIG.FEED_ITEMS_PER_PAGE : CONFIG.INITIAL_FEED_ITEMS;

        const includeRead = STATE.feedViewFilter === 'all';
        const params = new URLSearchParams({
            type: folderId === null ? '3' : '1',
            getRead: includeRead ? 'true' : 'false',
            batchSize: batchSize.toString(),
            offset: STATE.feedOffset.toString()
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
        const newItems = data.items || [];

        // Check if there are more items to load
        STATE.feedHasMore = newItems.length >= batchSize;

        // Update offset for next load
        STATE.feedOffset += newItems.length;

        // Either append or replace items based on mode
        if (appendMode) {
            STATE.latestItems = [...STATE.latestItems, ...newItems];
        } else {
            STATE.latestItems = newItems;
        }

        applyLocalReadOverrides(STATE.latestItems);
        displayFeed();
        processReadSyncQueue();
    } catch (error) {
        console.error('Feed fetch error:', error);
        const message = '<p style="padding:1rem;"><em>Unable to load news feed</em></p>';
        DOM.overview.innerHTML = getFeedControlsHTML() + message;
        attachViewToggleHandlers();
        attachFolderClickHandlers();
        attachTimerControlHandlers();
        renderTimerLists();
        syncTimerPanelState();
    }
}

function displayViewToggle() {
    const nextView = STATE.feedViewFilter === 'unviewed' ? 'all' : 'unviewed';
    const label = STATE.feedViewFilter === 'unviewed' ? '🟢 New' : '⚫ New';
    const activeClass = STATE.feedViewFilter === 'unviewed' ? ' is-active' : '';

    return `
        <button class="view-toggle-chip${activeClass}" data-view="${nextView}">
            ${label}
        </button>
    `;
}

function displayTimerToggleButton() {
    return `
        <button class="timer-toggle-btn${STATE.timerPanelVisible ? ' active' : ''}" type="button">
            ⏱
        </button>
    `;
}

function displayTimerPanel() {
    return `
        <div class="timer-panel ${STATE.timerPanelVisible ? 'open' : ''}">
            <form class="timer-add-form">
                <input type="text" class="timer-label-input" placeholder="Timer name">
                <div class="timer-countdown-inputs">
                    <select class="timer-count-field" data-unit="days">
                        <option value="">Days</option>
                        ${buildTimerOptions(30)}
                    </select>
                    <select class="timer-count-field" data-unit="hours">
                        <option value="">Hours</option>
                        ${buildTimerOptions(23)}
                    </select>
                    <select class="timer-count-field" data-unit="minutes">
                        <option value="">Minutes</option>
                        ${buildTimerOptions(59)}
                    </select>
                    <select class="timer-count-field" data-unit="seconds">
                        <option value="">Seconds</option>
                        ${buildTimerOptions(59)}
                    </select>
                </div>
                <div class="timer-date-picker">
                    <input type="datetime-local" class="timer-date-input">
                </div>
                <button type="submit" class="timer-add-btn">Add Timer</button>
            </form>
            <div class="timer-lists">
                <div class="timer-list">
                    <div class="timer-list-header">Active Timers</div>
                    <div class="timer-items"></div>
                </div>
                <div class="timer-list">
                    <div class="timer-list-header">Finished Timers</div>
                    <div class="finished-timer-items"></div>
                </div>
            </div>
        </div>
    `;
}

function buildTimerOptions(max) {
    const options = [];
    for (let i = 0; i <= max; i += 1) {
        options.push(`<option value="${i}">${i}</option>`);
    }
    return options.join('');
}

function displayFolderMenu() {
    if (STATE.folders.length === 0) {
        return `
            <div class="feed-folder-menu">
                ${displayTimerToggleButton()}
                ${displayViewToggle()}
            </div>
        `;
    }

    const isAllActive = STATE.selectedFolder === null;
    const menuHTML = `
        <div class="feed-folder-menu">
            ${displayTimerToggleButton()}
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
        const message = STATE.feedViewFilter === 'all'
            ? '<p style="padding:1rem;"><em>No items to display</em></p>'
            : '<p style="padding:1rem;"><em>No unread items</em></p>';
        DOM.overview.innerHTML = controlsHTML + message;
        attachViewToggleHandlers();
        attachFolderClickHandlers();
        attachTimerControlHandlers();
        renderTimerLists();
        syncTimerPanelState();
        return;
    }

    const feedHTML = `
        <div class="bluesky-feed">
            ${items.map(item => createFeedCard(item)).join('')}
        </div>
    `;

    // Load More button (only show if there are more items to load)
    const loadMoreHTML = STATE.feedHasMore ? `
        <div style="padding: 1rem; text-align: center;">
            <button class="feed-load-more" ${STATE.feedLoading ? 'disabled' : ''}>
                ${STATE.feedLoading ? 'Loading...' : `Load More (${CONFIG.FEED_ITEMS_PER_PAGE})`}
            </button>
        </div>
    ` : '';

    DOM.overview.innerHTML = controlsHTML + feedHTML + loadMoreHTML;
    renderTimerLists();
    attachViewToggleHandlers();
    attachFolderClickHandlers();
    attachFeedItemInteractions();
    attachTimerControlHandlers();
    attachLoadMoreHandler();
    syncTimerPanelState();
}

async function loadMoreFeedItems() {
    if (STATE.feedLoading || !STATE.feedHasMore) return;

    STATE.feedLoading = true;
    displayFeed(); // Re-render to show loading state

    try {
        await loadNextcloudFeed(STATE.selectedFolder, true); // true = append mode
    } catch (error) {
        console.error('Error loading more feed items:', error);
    } finally {
        STATE.feedLoading = false;
        displayFeed(); // Re-render with new items or error state
    }
}

function attachLoadMoreHandler() {
    const loadMoreBtn = document.querySelector('.feed-load-more');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreFeedItems);
    }
}

function getFeedControlsHTML() {
    return `
        <div class="feed-controls">
            ${displayTimerPanel()}
            ${displayFolderMenu()}
        </div>
    `;
}

function getFilteredFeedItems() {
    const items = STATE.latestItems || [];
    if (STATE.feedViewFilter === 'all') {
        return items.filter(Boolean);
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
        return `<img src="${escapeHtml(item.enclosureLink)}" alt="" loading="lazy">`;
    }

    if (!item.body) return null;

    const temp = document.createElement('div');
    temp.innerHTML = item.body;

    const image = temp.querySelector('img');
    if (image) {
        const src = image.getAttribute('src');
        if (src) {
            return `<img src="${escapeHtml(src)}" alt="${escapeHtml(image.getAttribute('alt') || '')}" loading="lazy">`;
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
            // Reset pagination when filter changes
            STATE.feedOffset = 0;
            STATE.feedHasMore = true;
            loadNextcloudFeed(STATE.selectedFolder);
        });
    });
}

function attachTimerControlHandlers() {
    const toggleBtn = document.querySelector('.timer-toggle-btn');
    if (toggleBtn && !toggleBtn.dataset.bound) {
        toggleBtn.dataset.bound = 'true';
        toggleBtn.addEventListener('click', toggleTimerPanel);
    }

    const timerPanel = document.querySelector('.timer-panel');
    if (timerPanel && !timerPanel.dataset.bound) {
        timerPanel.dataset.bound = 'true';
        timerPanel.addEventListener('click', handleTimerPanelAction);
    }

    const form = document.querySelector('.timer-add-form');
    if (form && !form.dataset.bound) {
        form.dataset.bound = 'true';
        form.addEventListener('submit', handleTimerFormSubmit);

        const countdownInputs = form.querySelectorAll('.timer-count-field');
        countdownInputs.forEach(select => {
            select.addEventListener('change', () => handleCountdownInputChange(form));
        });

        const dateInput = form.querySelector('.timer-date-input');
        if (dateInput) {
            dateInput.addEventListener('input', () => handleDateInputChange(form));
        }
    }
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
            // Reset pagination when folder changes
            STATE.feedOffset = 0;
            STATE.feedHasMore = true;
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

        const faviconUrl = domain
            ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
            : FALLBACK_FAVICON;

        return `
            <a href="${escapeHtml(link.url)}"
               target="_blank"
               class="app-icon-item"
               data-icon-path="${iconPath || ''}"
               data-favicon-url="${escapeHtml(faviconUrl)}">
                <img src="${iconPath || faviconUrl}"
                     alt="${escapeHtml(link.name)}"
                     class="app-icon-image"
                     data-fallback-url="${iconPath ? escapeHtml(faviconUrl) : ''}"
                     onerror="handleAppIconError(this);">
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
                    url: a.href,
                    icon: a.getAttribute('ICON') || a.getAttribute('icon') || null
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

    const visibleBookmarks = flattenBookmarkRoot(STATE.bookmarks);
    console.log(`[Bookmarks] Displaying ${visibleBookmarks.length} bookmark folders/items (flattened)`);
    const treeHTML = `
        <div class="bookmark-tree">
            ${buildBookmarkTree(visibleBookmarks)}
        </div>
    `;

    console.log('[Bookmarks] Generated HTML length:', treeHTML.length);

    // Put bookmarks tree in text area for home mode
    DOM.text.innerHTML = treeHTML;
}

function flattenBookmarkRoot(bookmarks) {
    if (!Array.isArray(bookmarks) || bookmarks.length === 0) return [];
    const flattened = [];
    bookmarks.forEach(item => {
        if (item.type === 'folder' && item.name && item.name.trim().toLowerCase() === 'bookmarks') {
            flattened.push(...(item.children || []));
        } else {
            flattened.push(item);
        }
    });
    return flattened;
}

function buildBookmarkTree(bookmarks, level = 0) {
    return bookmarks.map(item => {
        if (item.type === 'folder') {
            // Calculate lightness: 100% at top level, decrease by 10% per level, minimum 50%
            const lightness = Math.max(50, 100 - (level * 10));
            const folderColor = `hsl(0, 0%, ${lightness}%)`;

            // All folders start collapsed for cleaner overview
            return `
                <details class="bookmark-folder">
                    <summary class="bookmark-summary">
                        <span class="folder-name" style="color: ${folderColor};">${escapeHtml(item.name)}</span>
                        <img class="folder-icon" src="icons/folder.webp" alt="" />
                    </summary>
                    <div class="bookmark-children">
                        ${buildBookmarkTree(item.children, level + 1)}
                    </div>
                </details>
            `;
        } else {
            const iconSrc = escapeHtml(item.icon || FALLBACK_FAVICON);
            return `
                <a class="bookmark-link" href="${escapeHtml(item.url)}" target="_blank">
                    <span class="bookmark-name">${escapeHtml(item.name)}</span>
                    <img class="bookmark-favicon"
                         src="${iconSrc}"
                         alt=""
                         onerror="handleBookmarkFaviconError(this);">
                </a>
            `;
        }
    }).join('');
}

function handleAppIconError(img) {
    if (!img) return;
    const fallbackUrl = img.dataset ? img.dataset.fallbackUrl : '';
    if (fallbackUrl && !img.dataset.fallbackApplied) {
        img.dataset.fallbackApplied = 'true';
        img.src = fallbackUrl;
        return;
    }
    img.onerror = null;
    img.src = FALLBACK_FAVICON;
}

function handleBookmarkFaviconError(img) {
    if (!img) return;
    img.onerror = null;
    img.src = FALLBACK_FAVICON;
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

    // Show quick action buttons immediately (with empty query)
    const encodedQuery = encodeURIComponent('');
    DOM.overview.innerHTML = `
        <div class="quick-search-links">
            <a href="https://duckduckgo.com/?q=${encodedQuery}" target="_blank">
                <img src="icons/duckduckgo.svg" alt="DuckDuckGo" style="width:24px; height:24px; flex-shrink:0;">
                <span>DuckDuckGo</span>
            </a>
            <a href="https://www.google.com/search?tbm=isch&q=${encodedQuery}" target="_blank">
                <img src="icons/googleimages.png" alt="Google Images" style="width:24px; height:24px; flex-shrink:0;">
                <span>Google Images</span>
            </a>
            <a href="https://www.perplexity.ai/search?q=${encodedQuery}" target="_blank">
                <img src="icons/perplexity.svg" alt="Perplexity" style="width:24px; height:24px; flex-shrink:0;">
                <span>Perplexity AI</span>
            </a>
            <button type="button" class="quick-task-btn">
                <img src="icons/tasks.webp" alt="Tasks" style="width:24px; height:24px; flex-shrink:0;">
                <span>Add to Tasks</span>
            </button>
        </div>
    `;
    attachQuickTaskButton(DOM.overview, '');
}

function exitSearchMode() {
    if (STATE.mode !== 'search') return;

    STATE.mode = 'home';
    document.body.classList.remove('search-mode');
    updateSearchTriggerIcons(false);
    console.log('[Search] Exiting search mode');

    // Exit navigation mode
    exitNavigationMode();

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
    const iconSrc = isActive ? 'icons/X.webp' : 'icons/search.svg';
    const iconAlt = isActive ? 'Close' : 'Search';
    const label = isActive ? 'Close search' : 'Open search';

    DOM.searchTriggers.forEach(trigger => {
        trigger.innerHTML = `<img src="${iconSrc}" alt="${iconAlt}" class="${isActive ? 'close-icon' : 'search-icon'}">`;
        trigger.setAttribute('aria-label', label);
    });
}


async function handleSearchInput(event) {
    const query = event.target.value.trim();

    if (!query) {
        // Show quick action buttons even when query is empty
        const encodedQuery = encodeURIComponent('');
        DOM.overview.innerHTML = `
            <div class="quick-search-links">
                <a href="https://duckduckgo.com/?q=${encodedQuery}" target="_blank">
                    <img src="icons/duckduckgo.svg" alt="DuckDuckGo" style="width:24px; height:24px; flex-shrink:0;">
                    <span>DuckDuckGo</span>
                </a>
                <a href="https://www.google.com/search?tbm=isch&q=${encodedQuery}" target="_blank">
                    <img src="icons/googleimages.png" alt="Google Images" style="width:24px; height:24px; flex-shrink:0;">
                    <span>Google Images</span>
                </a>
                <a href="https://www.perplexity.ai/search?q=${encodedQuery}" target="_blank">
                    <img src="icons/perplexity.svg" alt="Perplexity" style="width:24px; height:24px; flex-shrink:0;">
                    <span>Perplexity AI</span>
                </a>
                <button type="button" class="quick-task-btn">
                    <img src="icons/tasks.webp" alt="Tasks" style="width:24px; height:24px; flex-shrink:0;">
                    <span>Add to Tasks</span>
                </button>
            </div>
        `;
        attachQuickTaskButton(DOM.overview, '');
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

    // Exit any existing navigation mode before showing new search results
    exitNavigationMode();

    // Show loading in overview instead of dropdown
    DOM.overview.innerHTML = '<div style="padding:1rem; color:#888;">Searching...</div>';

    // Update URL with search query
    updateURL({ q: query });

    try {
        // Fetch suggestions from all sources in parallel
        const [wikiResults, bookmarkResults, traktResults] = await Promise.all([
            searchWikipedia(query),
            searchBookmarks(query),
            searchTrakt(query)
        ]);

        STATE.currentSuggestions = [
            ...bookmarkResults,
            ...wikiResults,
            ...traktResults
        ];

        displaySuggestions(STATE.currentSuggestions, DOM.overview);
    } catch (error) {
        console.error('Search error:', error);
        DOM.overview.innerHTML = '<div style="padding:1rem; color:#f88;">Search failed</div>';
    }
}

function handleSearchKeydown(event) {
    // If in navigation mode, let the global handler deal with it
    if (STATE.navigationMode && (event.key === 'Enter' || event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        return;
    }

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

async function searchTrakt(query) {
    if (!CONFIG.TRAKT_CLIENT_ID || CONFIG.TRAKT_CLIENT_ID === 'YOUR_TRAKT_CLIENT_ID_HERE') {
        console.log('[Trakt] API key not configured, skipping search');
        return [];
    }

    try {
        const url = `${CONFIG.TRAKT_API}/search/movie,show?query=${encodeURIComponent(query)}&limit=${CONFIG.SUGGESTION_LIMIT.trakt}`;
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'trakt-api-version': CONFIG.TRAKT_API_VERSION,
                'trakt-api-key': CONFIG.TRAKT_CLIENT_ID
            }
        });

        if (!response.ok) {
            console.error('[Trakt] Search failed:', response.status, response.statusText);
            return [];
        }

        const data = await response.json();

        return data.map(item => {
            const mediaType = item.type; // 'movie' or 'show'
            const media = item[mediaType];

            return {
                type: 'trakt',
                mediaType: mediaType,
                title: media.title,
                year: media.year,
                description: `${mediaType === 'movie' ? 'Movie' : 'TV Show'} (${media.year || 'N/A'})`,
                traktId: media.ids.trakt,
                imdbId: media.ids.imdb,
                tmdbId: media.ids.tmdb,
                slug: media.ids.slug,
                icon: 'Trakt'
            };
        });
    } catch (error) {
        console.error('[Trakt] Search error:', error);
        return [];
    }
}

// ============================================================================
// SUGGESTIONS DISPLAY
// ============================================================================

function displaySuggestions(suggestions, container) {
    const query = STATE.lastQuery || (DOM.searchInput ? DOM.searchInput.value.trim() : '');
    const encodedQuery = encodeURIComponent(query);

    // Build quick action buttons HTML
    const quickActionsHTML = `
        <div class="quick-search-links" style="margin-top: ${suggestions && suggestions.length > 0 ? '1rem' : '0'};">
            <a href="https://duckduckgo.com/?q=${encodedQuery}" target="_blank">
                <img src="icons/duckduckgo.svg" alt="DuckDuckGo" style="width:24px; height:24px; flex-shrink:0;">
                <span>DuckDuckGo</span>
            </a>
            <a href="https://www.google.com/search?tbm=isch&q=${encodedQuery}" target="_blank">
                <img src="icons/googleimages.png" alt="Google Images" style="width:24px; height:24px; flex-shrink:0;">
                <span>Google Images</span>
            </a>
            <a href="https://www.perplexity.ai/search?q=${encodedQuery}" target="_blank">
                <img src="icons/perplexity.svg" alt="Perplexity" style="width:24px; height:24px; flex-shrink:0;">
                <span>Perplexity AI</span>
            </a>
            <button type="button" class="quick-task-btn">
                <img src="icons/tasks.webp" alt="Tasks" style="width:24px; height:24px; flex-shrink:0;">
                <span>Add to Tasks</span>
            </button>
        </div>
    `;

    if (!suggestions || suggestions.length === 0) {
        container.innerHTML = quickActionsHTML;
        attachQuickTaskButton(container, query);
        return;
    }

    const html = suggestions.map((item, index) => {
        let iconHTML = '';
        let titleText = '';

        if (item.type === 'wikipedia') {
            iconHTML = '<img src="icons/wiki.svg" alt="Wiki" style="width:24px; height:24px; flex-shrink:0;">';
            titleText = item.title;
        } else if (item.type === 'bookmark') {
            iconHTML = '<img src="icons/bookmark.webp" alt="Bookmark" style="width:24px; height:24px; flex-shrink:0;">';
            titleText = item.name;
        } else if (item.type === 'trakt') {
            iconHTML = '<img src="icons/web.webp" alt="Trakt" style="width:24px; height:24px; flex-shrink:0;">';
            titleText = item.title;
        }

        return `
            <div class="suggestion-item" data-index="${index}"
                 style="padding:0.75rem; cursor:pointer; border-bottom:1px solid #333; display:flex; align-items:flex-start; gap:0.4rem;">
                ${iconHTML}
                <div style="flex:1;">
                    <div>${escapeHtml(titleText)}</div>
                    ${item.description ? `<div style="font-size:0.85em; color:#888; margin-top:0.2rem;">${escapeHtml(item.description)}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html + quickActionsHTML;

    // Add click handlers for suggestions
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

    // Attach the task button handler
    attachQuickTaskButton(container, query);

    // Enable keyboard navigation for search results
    enterSearchNavigationMode();
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
                <button type="button" class="task-modal-close" aria-label="Close"><img src="icons/X.webp" alt="Close" class="close-icon"></button>
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

    console.log('[Task] Creating task at:', taskUrl);

    const auth = btoa(`${CONFIG.NEXTCLOUD_USER}:${CONFIG.NEXTCLOUD_PASS}`);

    try {
        const response = await fetch(taskUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'text/calendar; charset=utf-8'
            },
            body: icsBody
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'No error details');
            console.error('[Task] Failed:', response.status, response.statusText, errorText);
            throw new Error(`Failed (${response.status}): ${response.statusText}`);
        }

        console.log('[Task] Successfully created');
    } catch (error) {
        console.error('[Task] Fetch error:', error);
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Network error: Check CORS settings or calendar path');
        }
        throw error;
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

    // Exit navigation mode when a selection is made
    exitNavigationMode();

    if (item.type === 'wikipedia') {
        loadWikipediaArticle(item.title);
    } else if (item.type === 'bookmark') {
        window.open(item.url, '_blank');
        exitSearchMode();
    } else if (item.type === 'trakt') {
        loadTraktItem(item);
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

function cleanWikipediaHTML(element) {
    // Remove all inline styles
    element.querySelectorAll('[style]').forEach(el => {
        el.removeAttribute('style');
    });

    // Remove Wikipedia-specific classes but keep semantic HTML
    element.querySelectorAll('[class]').forEach(el => {
        el.removeAttribute('class');
    });

    // Style all tables with gray outline and transparent background
    element.querySelectorAll('table').forEach(table => {
        table.style.border = '1px solid #888';
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        table.style.background = 'transparent';
        table.style.marginBottom = '1rem';
    });

    // Style table cells
    element.querySelectorAll('td, th').forEach(cell => {
        cell.style.border = '1px solid #666';
        cell.style.padding = '0.5rem';
        cell.style.background = 'transparent';
    });

    // Style table headers
    element.querySelectorAll('th').forEach(th => {
        th.style.fontWeight = '600';
        th.style.color = '#ccc';
    });

    // Remove background colors from all elements
    element.querySelectorAll('*').forEach(el => {
        if (el.style.backgroundColor) {
            el.style.backgroundColor = 'transparent';
        }
        if (el.style.background && el.style.background !== 'transparent') {
            el.style.background = 'transparent';
        }
    });

    // Clean up images
    element.querySelectorAll('img').forEach(img => {
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.background = 'transparent';
    });

    // Remove width attributes that might constrain layout
    element.querySelectorAll('[width]').forEach(el => {
        if (el.tagName !== 'TABLE') {
            el.removeAttribute('width');
        }
    });

    return element;
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
    let infoboxImageHTML = '';

    if (infobox) {
        // Extract the main image from infobox before cleaning
        const infoboxImage = infobox.querySelector('img');
        if (infoboxImage) {
            // Clone the image
            const imgClone = infoboxImage.cloneNode(true);
            imgClone.style.maxWidth = '100%';
            imgClone.style.height = 'auto';
            imgClone.style.display = 'block';
            imgClone.style.margin = '0 auto';
            infoboxImageHTML = `<div style="margin-bottom:1rem;">${imgClone.outerHTML}</div>`;

            // Remove the image row and any caption row from the infobox
            const imageRow = infoboxImage.closest('tr');
            if (imageRow) {
                // Get the next row before removing the image row
                const nextRow = imageRow.nextElementSibling;

                imageRow.remove();

                // Also remove the next row if it contains a caption (typically short text or has caption class)
                if (nextRow && (nextRow.textContent.trim().length < 200 || nextRow.querySelector('[class*="caption"]'))) {
                    nextRow.remove();
                }
            }
        }

        cleanWikipediaHTML(infobox);
        infobox.style.outline = '1px solid #888';
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
                         style="padding:0.5rem; cursor:pointer; border-bottom:1px solid #333; background:transparent; transition:background 0.2s ease;">
                        <span style="color:#888;">${section.number}</span>
                        <span style="margin-left:0.5rem;">${escapeHtml(section.line)}</span>
                    </div>
                `;
            })
            .join('');

        tocHTML = `
            <div style="background:transparent; border:1px solid #888; padding:0.75rem;">
                <div style="font-weight:bold; margin-bottom:0.5rem;">Contents</div>
                ${tocItems}
            </div>
        `;
    }

    // Try to extract TOC from HTML as fallback
    if (!tocHTML) {
        const toc = tempDiv.querySelector('#toc, .toc');
        if (toc) {
            cleanWikipediaHTML(toc);
            tocHTML = toc.outerHTML;
            toc.remove();
        }
    }

    // Clean up the full article content
    tempDiv.querySelectorAll('sup.reference').forEach(el => el.remove());
    tempDiv.querySelectorAll('.mw-editsection').forEach(el => el.remove());

    // Apply cleaning to remove Wikipedia formatting
    cleanWikipediaHTML(tempDiv);

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
            <div>
                ${infoboxImageHTML}
                ${tocHTML || '<p>No table of contents</p>'}
            </div>
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
// TRAKT.TV DISPLAY
// ============================================================================

async function loadTraktItem(item) {
    try {
        // Show loading state
        DOM.text.innerHTML = '<div style="padding:1rem; color:#888;">Loading from Trakt.tv...</div>';
        DOM.overview.innerHTML = '<div style="padding:1rem; color:#888;">Loading details...</div>';
        DOM.dock.innerHTML = '';

        // Update page title
        if (DOM.pageTitleText) {
            DOM.pageTitleText.textContent = item.title;
        } else if (DOM.pageTitle) {
            DOM.pageTitle.innerHTML = `<p>${escapeHtml(item.title)}</p>`;
        }
        DOM.subtitle.innerHTML = `<p>Trakt.tv - ${item.mediaType === 'movie' ? 'Movie' : 'TV Show'}</p>`;

        // Fetch detailed information
        const detailUrl = `${CONFIG.TRAKT_API}/${item.mediaType}s/${item.slug}?extended=full`;
        const response = await fetch(detailUrl, {
            headers: {
                'Content-Type': 'application/json',
                'trakt-api-version': CONFIG.TRAKT_API_VERSION,
                'trakt-api-key': CONFIG.TRAKT_CLIENT_ID
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch details: ${response.status}`);
        }

        const details = await response.json();

        // Display overview/plot in text area
        DOM.text.innerHTML = `
            <div style="line-height:1.6;">
                <h2>${escapeHtml(details.title)} ${details.year ? `(${details.year})` : ''}</h2>
                ${details.tagline ? `<p style="font-style:italic; color:#888; margin-bottom:1rem;">"${escapeHtml(details.tagline)}"</p>` : ''}
                <p>${escapeHtml(details.overview || 'No overview available.')}</p>
                <p style="margin-top:1.5rem;">
                    <button id="add-to-trakt-history" style="
                        padding: 0.75rem 1.5rem;
                        background: #ed1c24;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        font-size: 1rem;
                        cursor: pointer;
                        font-weight: 600;
                    ">Add to Watch History</button>
                    <span id="trakt-status" style="margin-left:1rem; color:#888;"></span>
                </p>
                <p style="margin-top:1rem;">
                    <a href="https://trakt.tv/${item.mediaType}s/${item.slug}"
                       target="_blank"
                       style="color:#4a9eff;">
                        View on Trakt.tv
                    </a>
                </p>
            </div>
        `;

        // Add event listener for "Add to Watch History" button
        document.getElementById('add-to-trakt-history').addEventListener('click', async () => {
            const statusEl = document.getElementById('trakt-status');
            statusEl.textContent = 'Adding...';
            statusEl.style.color = '#888';

            try {
                await addToTraktHistory(item);
                statusEl.textContent = '✓ Added to watch history!';
                statusEl.style.color = '#4a9eff';
            } catch (error) {
                statusEl.textContent = '✗ Failed to add';
                statusEl.style.color = '#f88';
                console.error('[Trakt] Failed to add to history:', error);
            }
        });

        // Display metadata in overview
        const metadataHTML = `
            <div style="background:#1a1a1a; border:1px solid #444; padding:1rem; border-radius:8px;">
                <h3 style="margin-bottom:1rem;">Details</h3>
                <table style="width:100%; border-collapse:collapse;">
                    ${details.year ? `<tr><td style="padding:0.5rem 0; color:#888;">Year</td><td style="padding:0.5rem 0;">${details.year}</td></tr>` : ''}
                    ${details.runtime ? `<tr><td style="padding:0.5rem 0; color:#888;">Runtime</td><td style="padding:0.5rem 0;">${details.runtime} min</td></tr>` : ''}
                    ${details.genres && details.genres.length ? `<tr><td style="padding:0.5rem 0; color:#888;">Genres</td><td style="padding:0.5rem 0;">${details.genres.join(', ')}</td></tr>` : ''}
                    ${details.rating ? `<tr><td style="padding:0.5rem 0; color:#888;">Rating</td><td style="padding:0.5rem 0;">${details.rating.toFixed(1)}/10</td></tr>` : ''}
                    ${details.language ? `<tr><td style="padding:0.5rem 0; color:#888;">Language</td><td style="padding:0.5rem 0;">${details.language.toUpperCase()}</td></tr>` : ''}
                    ${details.status ? `<tr><td style="padding:0.5rem 0; color:#888;">Status</td><td style="padding:0.5rem 0;">${details.status}</td></tr>` : ''}
                </table>
            </div>
        `;

        DOM.overview.innerHTML = metadataHTML;

        // Display external links in dock
        const externalLinks = [];

        // Add Wikipedia link (internal navigation)
        externalLinks.push({
            wikiTitle: details.title,
            name: 'Wikipedia',
            icon: 'icons/wiki.svg',
            isInternal: true
        });

        if (item.imdbId) {
            externalLinks.push({ url: `https://www.imdb.com/title/${item.imdbId}`, name: 'IMDb', icon: 'imdb.com' });
        }
        if (item.tmdbId) {
            const tmdbUrl = item.mediaType === 'movie'
                ? `https://www.themoviedb.org/movie/${item.tmdbId}`
                : `https://www.themoviedb.org/tv/${item.tmdbId}`;
            externalLinks.push({ url: tmdbUrl, name: 'TMDB', icon: 'themoviedb.org' });
        }
        externalLinks.push({ url: `https://trakt.tv/${item.mediaType}s/${item.slug}`, name: 'Trakt', icon: 'trakt.tv' });

        if (externalLinks.length > 0) {
            const linksHTML = externalLinks.map(link => {
                if (link.isInternal && link.wikiTitle) {
                    // Wikipedia internal link
                    return `
                        <a href="#" class="wiki-internal-link" data-wiki-title="${escapeHtml(link.wikiTitle)}" style="margin:0.5rem; display:inline-block;">
                            <img src="${link.icon}"
                                 alt="${escapeHtml(link.name)}"
                                 title="${escapeHtml(link.name)}"
                                 style="width:32px; height:32px;">
                        </a>
                    `;
                } else {
                    // External link
                    const iconSrc = `https://www.google.com/s2/favicons?domain=${link.icon}&sz=64`;
                    return `
                        <a href="${escapeHtml(link.url)}" target="_blank" style="margin:0.5rem; display:inline-block;">
                            <img src="${iconSrc}"
                                 alt="${escapeHtml(link.name)}"
                                 title="${escapeHtml(link.name)}"
                                 style="width:32px; height:32px;">
                        </a>
                    `;
                }
            }).join('');

            DOM.dock.innerHTML = linksHTML;

            // Add event listeners to Wikipedia internal links
            document.querySelectorAll('.wiki-internal-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const wikiTitle = link.getAttribute('data-wiki-title');
                    if (wikiTitle) {
                        loadWikipediaArticle(wikiTitle);
                    }
                });
            });
        }

    } catch (error) {
        console.error('[Trakt] Error loading item:', error);
        showError(`Failed to load from Trakt.tv: ${error.message}`);
    }
}

async function addToTraktHistory(item) {
    if (!CONFIG.TRAKT_ACCESS_TOKEN || CONFIG.TRAKT_ACCESS_TOKEN === 'YOUR_TRAKT_ACCESS_TOKEN_HERE') {
        throw new Error('Trakt access token not configured');
    }

    const payload = {
        [item.mediaType === 'movie' ? 'movies' : 'shows']: [
            {
                watched_at: new Date().toISOString(),
                ids: {
                    trakt: item.traktId,
                    ...(item.imdbId && { imdb: item.imdbId }),
                    ...(item.tmdbId && { tmdb: item.tmdbId })
                }
            }
        ]
    };

    console.log('[Trakt] Adding to history:', payload);

    const response = await fetch(`${CONFIG.TRAKT_API}/sync/history`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'trakt-api-version': CONFIG.TRAKT_API_VERSION,
            'trakt-api-key': CONFIG.TRAKT_CLIENT_ID,
            'Authorization': `Bearer ${CONFIG.TRAKT_ACCESS_TOKEN}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[Trakt] Add to history failed:', response.status, errorText);
        throw new Error(`Failed to add to history (${response.status})`);
    }

    const result = await response.json();
    console.log('[Trakt] Successfully added to history:', result);
    return result;
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
