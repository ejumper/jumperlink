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

    // Jellyfin Configuration
    JELLYFIN_SERVER: 'https://media.jumperlink.net',
    JELLYFIN_API_KEY: 'bebdf1595a4343a5ab3cbf79f059af6f',
    JELLYFIN_CLIENT_NAME: 'Jumperlink Dashboard',
    JELLYFIN_DEVICE_ID: 'jumperlink-web-dashboard',
    JELLYFIN_VERSION: '1.0.0',
    JELLYFIN_USER_ID: 'YOUR_JELLYFIN_USER_ID',
    JELLYFIN_CLASSIC_CHANNEL_ID: 'YOUR_CLASSIC_MOVIES_CHANNEL_ID',
    JELLYFIN_HUMOR_CHANNEL_ID: 'YOUR_HUMOR_HUB_CHANNEL_ID',

    // API Endpoints
    WIKI_API: 'https://en.wikipedia.org/w/api.php',
    OPENROUTER_API: 'https://openrouter.ai/api/v1/chat/completions',
    TRAKT_API: 'https://api.trakt.tv',

    // Settings
    INITIAL_FEED_ITEMS: 50, // Initial feed load
    FEED_ITEMS_PER_PAGE: 50, // Items per page when viewing all articles
    SUGGESTION_LIMIT: { wikipedia: 5, bookmarks: 5, trakt: 5, jellyfin: 10 },
    DEBOUNCE_MS: 300,
    UPDATE_TIME_INTERVAL: 1000, // Update clock every second
    SHOW_POST_CONTENT: true, // Show post content in cards
    POST_CONTENT_LIMIT: 280, // Character limit for post preview
    TIMERS_API_BASE: 'https://timers-kv.cloudflare-ceremony099.workers.dev',
    TIMERS_BOARD_ID: 'main',
    TIMER_TICK_INTERVAL: 500
};

const LOCAL_STORAGE_KEYS = {
    readItems: 'jumperlink_read_items',
    readSyncQueue: 'jumperlink_read_sync_queue',
    timerMetadata: 'jumperlink_timer_metadata',
    localIntervalTimers: 'jumperlink_local_interval_timers',
    jellyfinBookBookmarks: 'jumperlink_jellyfin_bookmarks'
};

const FALLBACK_FAVICON = 'icons/web.webp';
const INVIDIOUS_EMBED_HOSTS = ['inv.nadeko.net', 'yewtu.be', 'invidious.f5.si'];
const HTML_ENTITY_PARSER = typeof document !== 'undefined' ? document.createElement('textarea') : null;
const BLUESKY_POST_CACHE = new Map();

function isInvidiousHost(hostname) {
    if (!hostname) return false;
    const host = hostname.toLowerCase();
    return INVIDIOUS_EMBED_HOSTS.some(allowed => host === allowed || host.endsWith(`.${allowed}`)) || host.includes('invidious');
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

function createTimerDraft() {
    return {
        label: '',
        repeat: false,
        durationMenuOpen: false,
        dateMenuOpen: false,
        intervals: [],
        targetDate: '',
        countdown: {
            days: '',
            hours: '',
            minutes: '',
            seconds: ''
        }
    };
}

function createJellyfinPlaybackState() {
    return {
        queue: [],
        currentIndex: -1,
        repeatOne: false,
        context: null,
        mountSelector: null,
        albumId: null,
        albumTitle: '',
        sourceItem: null,
        isFavorite: false
    };
}

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
    showStarredOnly: false,
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
    timerActiveTab: 'active',
    timerDraft: createTimerDraft(),
    timerMetadata: new Map(),
    openIntervalDetails: new Set(),
    autoRepeatQueue: new Set(),
    localIntervalTimers: [],
    localIntervalRuntimeMap: new Map(),
    feedOffset: 0,
    feedHasMore: true,
    feedLoading: false,
    pendingStarToggles: new Set(),
    clockIntervalId: null, // Track clock interval to prevent memory leaks

    // Keyboard navigation state
    navigationMode: null, // null, 'search', 'bookmarks', 'applinks', 'feed'
    navigationIndex: -1, // Current index in the navigable items
    navigationItems: [], // Current list of navigable items
    appLinksMarkup: '',
    jellyfinPlayback: createJellyfinPlaybackState(),
    jellyfinBookBookmarks: new Map()
};

const JELLYFIN_QUICK_ACTIONS = [
    { emoji: '💽', action: 'albums', label: 'Music Albums' },
    { emoji: '🎨', action: 'artists', label: 'Artists' },
    { emoji: '📋', action: 'playlists', label: 'Playlists' },
    { emoji: '⭐', action: 'favorites', label: 'Shuffle Favorites' },
    { emoji: '🔀', action: 'shuffle', label: 'Shuffle Library' },
    { emoji: '🍿', action: 'classic-channel', label: 'Classic Movies' },
    { emoji: '😂', action: 'humor-channel', label: 'Humor Hub' },
    { emoji: '🎬', action: 'movies', label: 'Movies' },
    { emoji: '📺', action: 'tv', label: 'TV Shows' }
];

function normalizeTimerMetadataEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        return { repeat: false, intervals: [] };
    }
    const normalized = {
        repeat: Boolean(entry.repeat),
        intervals: Array.isArray(entry.intervals)
            ? entry.intervals
                .map((interval, index) => ({
                    id: interval.id || `interval-${index}-${Date.now()}`,
                    label: interval.label || `Interval ${index + 1}`,
                    durationMs: Math.max(0, Number(interval.durationMs) || 0),
                    colorIndex: Number.isFinite(interval.colorIndex) ? Number(interval.colorIndex) : index
                }))
                .filter(interval => interval.durationMs > 0)
            : []
    };
    return normalized;
}

function loadTimerMetadata() {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.timerMetadata);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            STATE.timerMetadata = new Map(
                Object.entries(parsed).map(([key, value]) => [key, normalizeTimerMetadataEntry(value)])
            );
        }
    } catch (error) {
        console.warn('Unable to load timer metadata', error);
        STATE.timerMetadata = new Map();
    }
}

function persistTimerMetadata() {
    try {
        const plain = {};
        STATE.timerMetadata.forEach((value, key) => {
            plain[key] = value;
        });
        localStorage.setItem(LOCAL_STORAGE_KEYS.timerMetadata, JSON.stringify(plain));
    } catch (error) {
        console.warn('Unable to persist timer metadata', error);
    }
}

function getTimerMetadata(timerId) {
    if (!timerId) return null;
    return STATE.timerMetadata.get(timerId) || null;
}

function setTimerMetadata(timerId, metadata) {
    if (!timerId) return;
    const toStore = normalizeTimerMetadataEntry(metadata);
    const hasData = toStore.repeat || (toStore.intervals && toStore.intervals.length > 0);
    if (!hasData) {
        deleteTimerMetadata(timerId);
        return;
    }
    STATE.timerMetadata.set(timerId, toStore);
    persistTimerMetadata();
}

function deleteTimerMetadata(timerId) {
    if (!timerId) return;
    if (STATE.timerMetadata.delete(timerId)) {
        persistTimerMetadata();
    }
    STATE.autoRepeatQueue.delete(timerId);
}

function loadJellyfinBookBookmarks() {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.jellyfinBookBookmarks);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            STATE.jellyfinBookBookmarks = new Map(
                Object.entries(parsed).map(([key, value]) => [key, Number(value) || 1])
            );
        }
    } catch (error) {
        console.warn('Unable to load Jellyfin book bookmarks', error);
        STATE.jellyfinBookBookmarks = new Map();
    }
}

function persistJellyfinBookBookmarks() {
    try {
        const plain = {};
        STATE.jellyfinBookBookmarks.forEach((value, key) => {
            plain[key] = value;
        });
        localStorage.setItem(LOCAL_STORAGE_KEYS.jellyfinBookBookmarks, JSON.stringify(plain));
    } catch (error) {
        console.warn('Unable to persist Jellyfin book bookmarks', error);
    }
}

function getJellyfinBookBookmark(bookId) {
    if (!bookId) return null;
    return STATE.jellyfinBookBookmarks.get(bookId) || null;
}

function setJellyfinBookBookmark(bookId, page) {
    if (!bookId) return;
    const safePage = Math.max(1, Number(page) || 1);
    STATE.jellyfinBookBookmarks.set(bookId, safePage);
    persistJellyfinBookBookmarks();
}

function updateTimerDraft(partial = {}) {
    STATE.timerDraft = { ...STATE.timerDraft, ...partial };
    requestTimerDraftUIUpdate();
}

function resetTimerDraft() {
    STATE.timerDraft = createTimerDraft();
    requestTimerDraftUIUpdate(true);
}

let timerDraftUiRaf = null;
function requestTimerDraftUIUpdate(resetForm = false) {
    if (timerDraftUiRaf) {
        cancelAnimationFrame(timerDraftUiRaf);
    }
    timerDraftUiRaf = requestAnimationFrame(() => {
        timerDraftUiRaf = null;
        applyTimerDraftToForm(resetForm);
    });
}

function applyTimerDraftToForm(resetForm = false) {
    const form = document.querySelector('.timer-add-form');
    if (!form) return;
    const draft = STATE.timerDraft || createTimerDraft();

    const labelInput = form.querySelector('.timer-label-input');
    if (labelInput && (resetForm || document.activeElement !== labelInput)) {
        labelInput.value = draft.label || '';
    }

    const durationMenu = form.querySelector('.timer-duration-menu');
    const durationButton = form.querySelector('[data-timer-duration-toggle]');
    durationMenu?.classList.toggle('is-open', Boolean(draft.durationMenuOpen));
    durationButton?.classList.toggle('is-active', Boolean(draft.durationMenuOpen));

    const dateMenu = form.querySelector('.timer-date-menu');
    const dateButton = form.querySelector('[data-timer-date-toggle]');
    dateMenu?.classList.toggle('is-open', Boolean(draft.dateMenuOpen));
    dateButton?.classList.toggle('is-active', Boolean(draft.dateMenuOpen));

    const repeatButton = form.querySelector('[data-timer-repeat-toggle]');
    repeatButton?.classList.toggle('is-active', Boolean(draft.repeat));
    if (repeatButton) {
        repeatButton.setAttribute('aria-pressed', draft.repeat ? 'true' : 'false');
    }

    const dateInput = form.querySelector('.timer-date-input');
    if (dateInput && (resetForm || document.activeElement !== dateInput)) {
        dateInput.value = draft.targetDate || '';
    }

    const countdownInputs = form.querySelectorAll('.timer-count-field');
    countdownInputs.forEach(select => {
        const unit = select.dataset.unit;
        if (!unit) return;
        const value = draft.countdown?.[unit] ?? '';
        if (resetForm || document.activeElement !== select) {
            select.value = value;
        }
    });

    const collection = form.querySelector('.timer-interval-collection');
    if (collection) {
        collection.innerHTML = renderIntervalDraftList(draft);
    }
}

function generateIntervalId() {
    return `interval-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

function appendDraftInterval(durationMs) {
    if (durationMs <= 0) return false;
    const intervals = Array.isArray(STATE.timerDraft?.intervals) ? [...STATE.timerDraft.intervals] : [];
    intervals.push({
        id: generateIntervalId(),
        label: `Interval ${intervals.length + 1}`,
        durationMs,
        colorIndex: intervals.length
    });
    updateTimerDraft({ intervals });
    return true;
}

function removeDraftInterval(intervalId) {
    if (!intervalId) return;
    const intervals = (STATE.timerDraft?.intervals || []).filter(interval => interval.id !== intervalId);
    updateTimerDraft({ intervals });
}

function renameDraftInterval(intervalId, value) {
    if (!intervalId) return;
    const intervals = (STATE.timerDraft?.intervals || []).map(interval =>
        interval.id === intervalId ? { ...interval, label: value } : interval
    );
    updateTimerDraft({ intervals });
}

function renameTimerInterval(timerId, intervalId, value) {
    if (!timerId || !intervalId) return;
    const meta = getTimerMetadata(timerId);
    if (!meta) return;
    const intervals = Array.isArray(meta.intervals)
        ? meta.intervals.map(interval =>
            interval.id === intervalId ? { ...interval, label: value } : interval
        )
        : [];
    setTimerMetadata(timerId, { ...meta, intervals });

    const localTimer = findLocalIntervalTimer(timerId);
    if (localTimer && Array.isArray(localTimer.intervals)) {
        localTimer.intervals = localTimer.intervals.map(interval =>
            interval.id === intervalId ? { ...interval, label: value } : interval
        );
        persistLocalIntervalTimers();
    }

    const row = document.querySelector(`.timer-row[data-timer-id="${timerId}"]`);
    if (row) {
        const inputs = row.querySelectorAll(`[data-interval-meta-field="label"][data-interval-id="${intervalId}"]`);
        inputs.forEach(input => {
            if (document.activeElement !== input) {
                input.value = value;
            }
        });
        const timer = STATE.timers.find(entry => entry.id === timerId);
        if (timer) {
            const intervalState = computeIntervalState(timer, Date.now());
            if (intervalState.currentInterval && intervalState.currentInterval.id === intervalId) {
                const pill = row.querySelector('.timer-interval-name-pill');
                if (pill) {
                    pill.textContent = value;
                }
            }
        }
    }
}

function normalizeLocalInterval(interval, index) {
    if (!interval) {
        return {
            id: `segment-${index}`,
            label: `Interval ${index + 1}`,
            durationMs: 0,
            colorIndex: index
        };
    }
    return {
        id: interval.id || `segment-${index}`,
        label: interval.label || `Interval ${index + 1}`,
        durationMs: Math.max(0, Number(interval.durationMs) || 0),
        colorIndex: Number.isFinite(interval.colorIndex) ? interval.colorIndex : index
    };
}

function loadLocalIntervalTimers() {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.localIntervalTimers);
        if (!raw) {
            STATE.localIntervalTimers = [];
            return;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            STATE.localIntervalTimers = [];
            return;
        }

        STATE.localIntervalTimers = parsed.map(timer => {
            const intervals = Array.isArray(timer.intervals)
                ? timer.intervals.map(normalizeLocalInterval)
                : [];
            const totalDuration = Math.max(
                Number(timer.durationMs) || intervals.reduce((sum, entry) => sum + entry.durationMs, 0),
                0
            );
            const elapsedMs = Math.min(Math.max(Number(timer.elapsedMs) || 0, 0), totalDuration);
            const normalized = {
                id: timer.id || generateLocalIntervalTimerId(),
                label: timer.label || 'Untitled timer',
                intervals,
                durationMs: totalDuration,
                elapsedMs,
                state: timer.state || (totalDuration > 0 ? 'paused' : 'idle'),
                createdAt: timer.createdAt || Date.now(),
                updatedAt: timer.updatedAt || Date.now(),
                mode: timer.mode || (totalDuration > 0 ? 'interval' : 'checklist'),
                startedAt: timer.startedAt || null,
                source: 'local',
                runtimeIntervalIndex: timer.runtimeIntervalIndex || 0
            };
            setTimerMetadata(normalized.id, {
                repeat: false,
                intervals: normalized.intervals
            });
            return normalized;
        });
        STATE.localIntervalRuntimeMap = new Map();
    } catch (error) {
        console.warn('Unable to load local interval timers', error);
        STATE.localIntervalTimers = [];
    }
}

function persistLocalIntervalTimers() {
    try {
        localStorage.setItem(
            LOCAL_STORAGE_KEYS.localIntervalTimers,
            JSON.stringify(STATE.localIntervalTimers)
        );
    } catch (error) {
        console.warn('Unable to persist local interval timers', error);
    }
}

function generateLocalIntervalTimerId() {
    return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function createLocalIntervalTimer(config) {
    const { label, intervals = [] } = config;
    const normalizedIntervals = intervals.map((interval, index) =>
        normalizeLocalInterval(interval, index)
    );
    const totalDuration = normalizedIntervals.reduce(
        (sum, interval) => sum + interval.durationMs,
        0
    );
    const timer = {
        id: generateLocalIntervalTimerId(),
        label: label || 'Timer',
        intervals: normalizedIntervals,
        durationMs: totalDuration,
        elapsedMs: 0,
        state: totalDuration > 0 ? 'paused' : 'idle',
        mode: totalDuration > 0 ? 'interval' : 'checklist',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        startedAt: null,
        source: 'local',
        runtimeIntervalIndex: 0
    };
    STATE.localIntervalTimers.push(timer);
    setTimerMetadata(timer.id, {
        repeat: false,
        intervals: normalizedIntervals
    });
    persistLocalIntervalTimers();
    renderTimerLists();
}

function findLocalIntervalTimer(timerId) {
    if (!timerId) return null;
    return STATE.localIntervalTimers.find(timer => timer.id === timerId) || null;
}

function setLocalIntervalTimerState(timerId, state) {
    const timer = findLocalIntervalTimer(timerId);
    if (!timer) return;
    timer.state = state;
    if (state === 'finished' && timer.mode === 'interval') {
        timer.elapsedMs = timer.durationMs;
        if (STATE.localIntervalRuntimeMap.has(timerId)) {
            const runtime = STATE.localIntervalRuntimeMap.get(timerId);
            runtime?.stop?.();
            STATE.localIntervalRuntimeMap.delete(timerId);
        }
    }
    if (state === 'idle' && timer.mode !== 'interval') {
        timer.elapsedMs = 0;
    }
    timer.updatedAt = Date.now();
    persistLocalIntervalTimers();
    renderTimerLists();
}

function deleteLocalIntervalTimer(timerId) {
    if (!timerId) return;
    const runtime = STATE.localIntervalRuntimeMap.get(timerId);
    if (runtime) {
        runtime.stop();
        STATE.localIntervalRuntimeMap.delete(timerId);
    }
    const nextTimers = STATE.localIntervalTimers.filter(timer => timer.id !== timerId);
    if (nextTimers.length === STATE.localIntervalTimers.length) return;
    STATE.localIntervalTimers = nextTimers;
    deleteTimerMetadata(timerId);
    persistLocalIntervalTimers();
    renderTimerLists();
}

function updateLocalIntervalTimerElapsed(timerId, milliseconds, { persist = false } = {}) {
    const timer = findLocalIntervalTimer(timerId);
    if (!timer) return null;
    timer.elapsedMs = Math.min(Math.max(milliseconds, 0), timer.durationMs);
    timer.updatedAt = Date.now();
    if (persist) {
        persistLocalIntervalTimers();
    }
    return timer;
}

function startLocalIntervalTimer(timerId) {
    const timer = findLocalIntervalTimer(timerId);
    if (!timer || timer.mode === 'checklist') return;
    if (timer.state === 'running') return;
    const timerLib = window.IntervalTimerLib?.Timer;
    if (!timerLib) {
        console.warn('Interval timer library missing');
        return;
    }
    let runtime = STATE.localIntervalRuntimeMap.get(timerId);
    if (!runtime) {
        runtime = new timerLib({
            startTime: timer.elapsedMs,
            endTime: timer.durationMs,
            updateFrequency: 100,
            selfAdjust: true
        });
        runtime.addEventListener('update', event => {
            const instance = event.detail || runtime;
            const ms = instance.getTime?.millisecondsTotal ?? timer.elapsedMs;
            updateLocalIntervalTimerElapsed(timerId, ms);
            timer.elapsedMs = ms;
            const stateSnapshot = computeIntervalState(
                { ...timer, elapsedMs: ms, source: 'local' },
                Date.now()
            );
            if (typeof timer.runtimeIntervalIndex !== 'number') {
                timer.runtimeIntervalIndex = stateSnapshot.currentIndex;
            } else if (stateSnapshot.currentIndex > timer.runtimeIntervalIndex) {
                playTimerSoundOnce();
                timer.runtimeIntervalIndex = stateSnapshot.currentIndex;
            }
            requestAnimationFrame(updateTimerCountdowns);
        });
        runtime.addEventListener('end', () => {
            updateLocalIntervalTimerElapsed(timerId, timer.durationMs, { persist: true });
            playTimerSoundOnce();
            setLocalIntervalTimerState(timerId, 'finished');
            STATE.localIntervalRuntimeMap.delete(timerId);
        });
        STATE.localIntervalRuntimeMap.set(timerId, runtime);
    }
    const initialState = computeIntervalState(
        { ...timer, source: 'local' },
        Date.now()
    );
    timer.runtimeIntervalIndex = initialState.currentIndex;
    runtime.start({
        startTime: timer.elapsedMs,
        endTime: timer.durationMs
    });
    timer.state = 'running';
    timer.startedAt = new Date().toISOString();
    timer.updatedAt = Date.now();
    persistLocalIntervalTimers();
    renderTimerLists();
}

function pauseLocalIntervalTimer(timerId) {
    const timer = findLocalIntervalTimer(timerId);
    if (!timer || timer.mode === 'checklist') return;
    const runtime = STATE.localIntervalRuntimeMap.get(timerId);
    if (!runtime) return;
    runtime.pause();
    const ms = runtime.getTime?.millisecondsTotal ?? timer.elapsedMs;
    updateLocalIntervalTimerElapsed(timerId, ms, { persist: true });
    timer.state = 'paused';
    timer.updatedAt = Date.now();
    renderTimerLists();
}

function resetLocalIntervalTimer(timerId) {
    const timer = findLocalIntervalTimer(timerId);
    if (!timer || timer.mode === 'checklist') return;
    const runtime = STATE.localIntervalRuntimeMap.get(timerId);
    if (runtime) {
        runtime.stop();
        STATE.localIntervalRuntimeMap.delete(timerId);
    }
    timer.elapsedMs = 0;
    timer.state = 'paused';
    timer.startedAt = null;
    timer.updatedAt = Date.now();
    timer.runtimeIntervalIndex = 0;
    persistLocalIntervalTimers();
    renderTimerLists();
}

// ============================================================================
// DOM REFERENCES
// ============================================================================

const DOM = {
    pageTitle: document.querySelector('page-title'),
    pageTitleText: document.querySelector('.page-title-display p'),
    subtitle: document.querySelector('subtitle'),
    headerTimers: document.querySelector('.header-active-bar'),
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
    loadTimerMetadata();
    loadJellyfinBookBookmarks();
    loadLocalIntervalTimers();
    initTaskModal();

    // Auto-detect Jellyfin user ID from API key
    await autoDetectJellyfinUserId();

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

    window.addEventListener('resize', refreshDesktopVideoEmbeds);
    refreshDesktopVideoEmbeds();

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

function isEditableElement(element) {
    if (!element) return false;
    const tag = element.tagName;
    return tag === 'INPUT'
        || tag === 'TEXTAREA'
        || tag === 'SELECT'
        || element.isContentEditable;
}

function handleGlobalKeydown(e) {
    // Ignore if modifier keys are pressed (except Shift for some shortcuts)
    if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
    }

    // Check if user is typing in an input field
    const activeElement = document.activeElement || null;
    const isInputFocused = isEditableElement(activeElement);
    const isTargetInput = isEditableElement(e.target);
    const searchInput = DOM.searchInput;
    const activeIsSearch = Boolean(searchInput && activeElement === searchInput);
    const targetIsSearch = Boolean(searchInput && e.target === searchInput);

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
        // Special handling for feed navigation (left/right for buttons, up/down for items)
        if (STATE.navigationMode === 'feed') {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                navigateFeedLeft();
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                navigateFeedRight();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigateFeedDown();
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigateFeedUp();
                return;
            }
        } else {
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
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            activateCurrentItem();
            return;
        }
    }

    // Special handling for arrow down in search input when not in navigation mode
    // This allows starting navigation from the search input
    if (activeIsSearch) {
        if (e.key === 'ArrowDown' && STATE.currentSuggestions.length > 0 && !STATE.navigationMode) {
            e.preventDefault();
            enterSearchNavigationMode();
            return;
        }
    }

    // Don't process shortcuts if typing in inputs (based on focus or event target),
    // except when interacting with the search input
    const isTypingOutsideSearch = (isInputFocused && !activeIsSearch) || (isTargetInput && !targetIsSearch);
    if (isTypingOutsideSearch) {
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
            if (STATE.timerPanelVisible) {
                e.preventDefault();
                closeTimerPanel();
            } else if (!isInputFocused) {
                e.preventDefault();
                enterFeedNavigationMode();
            }
            break;
        case 't':
            if (!isInputFocused) {
                e.preventDefault();
                if (STATE.timerPanelVisible) {
                    closeTimerPanel();
                } else {
                    openTimerPanel();
                }
            }
            break;
        case 'f': {
            const videoEl = getJellyfinVideoElement();
            if (!videoEl) break;
            const isVideoFullscreen = document.fullscreenElement === videoEl;
            if ((isInputFocused || isTargetInput || activeIsSearch || targetIsSearch) && !isVideoFullscreen) {
                break;
            }
            if (toggleJellyfinVideoFullscreen()) {
                e.preventDefault();
            }
            break;
        }
    }
}

function enterBookmarkNavigationMode() {
    // Select both folder summaries and bookmark links that are visible
    const bookmarkTree = document.querySelector('.bookmark-tree');
    if (!bookmarkTree) {
        console.log('[Navigation] No bookmark tree found');
        return;
    }

    // Get all visible navigable items (summaries for folders, links for bookmarks)
    const items = [];
    const collectVisibleItems = (container) => {
        const children = container.children;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.tagName === 'DETAILS') {
                // Add the summary (folder)
                const summary = child.querySelector(':scope > summary');
                if (summary) {
                    items.push(summary);
                }
                // If open, collect children
                if (child.open) {
                    const childrenContainer = child.querySelector('.bookmark-children');
                    if (childrenContainer) {
                        collectVisibleItems(childrenContainer);
                    }
                }
            } else if (child.classList.contains('bookmark-link')) {
                items.push(child);
            }
        }
    };
    collectVisibleItems(bookmarkTree);

    if (items.length === 0) {
        console.log('[Navigation] No bookmarks to navigate');
        return;
    }

    STATE.navigationMode = 'bookmarks';
    STATE.navigationItems = items;
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
    // Get filter buttons (view toggle and folder buttons)
    const filterButtons = document.querySelectorAll('.feed-folder-menu button, .feed-folder-menu .view-toggle-chip');
    const feedItems = document.querySelectorAll('.feed-item');

    if (filterButtons.length === 0 && feedItems.length === 0) {
        console.log('[Navigation] No feed controls or items to navigate');
        return;
    }

    STATE.navigationMode = 'feed';
    STATE.feedFilterButtons = Array.from(filterButtons);
    STATE.feedItems = Array.from(feedItems);
    STATE.feedNavigationFocus = 'buttons'; // 'buttons' or 'items'
    STATE.feedButtonIndex = 0;
    STATE.feedItemIndex = -1;
    STATE.navigationItems = STATE.feedFilterButtons;
    STATE.navigationIndex = 0;

    if (STATE.feedFilterButtons.length > 0) {
        updateNavigationHighlight();
    }
    console.log('[Navigation] Feed navigation mode activated (filter buttons)');
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

function navigateFeedLeft() {
    if (STATE.feedNavigationFocus !== 'buttons' || STATE.feedFilterButtons.length === 0) {
        return;
    }
    STATE.feedButtonIndex = (STATE.feedButtonIndex - 1 + STATE.feedFilterButtons.length) % STATE.feedFilterButtons.length;
    STATE.navigationItems = STATE.feedFilterButtons;
    STATE.navigationIndex = STATE.feedButtonIndex;
    updateNavigationHighlight();
    scrollToNavigationItem();
}

function navigateFeedRight() {
    if (STATE.feedNavigationFocus !== 'buttons' || STATE.feedFilterButtons.length === 0) {
        return;
    }
    STATE.feedButtonIndex = (STATE.feedButtonIndex + 1) % STATE.feedFilterButtons.length;
    STATE.navigationItems = STATE.feedFilterButtons;
    STATE.navigationIndex = STATE.feedButtonIndex;
    updateNavigationHighlight();
    scrollToNavigationItem();
}

function navigateFeedDown() {
    if (STATE.feedItems.length === 0) {
        return;
    }
    // Switch to items focus
    STATE.feedNavigationFocus = 'items';
    STATE.feedItemIndex = Math.min(STATE.feedItemIndex + 1, STATE.feedItems.length - 1);
    if (STATE.feedItemIndex < 0) STATE.feedItemIndex = 0;
    STATE.navigationItems = STATE.feedItems;
    STATE.navigationIndex = STATE.feedItemIndex;
    updateNavigationHighlight();
    scrollToNavigationItem();
}

function navigateFeedUp() {
    if (STATE.feedNavigationFocus === 'items' && STATE.feedItemIndex > 0) {
        // Move up in items
        STATE.feedItemIndex--;
        STATE.navigationItems = STATE.feedItems;
        STATE.navigationIndex = STATE.feedItemIndex;
        updateNavigationHighlight();
        scrollToNavigationItem();
    } else if (STATE.feedNavigationFocus === 'items' && STATE.feedItemIndex === 0) {
        // Switch back to buttons
        STATE.feedNavigationFocus = 'buttons';
        STATE.feedItemIndex = -1;
        STATE.navigationItems = STATE.feedFilterButtons;
        STATE.navigationIndex = STATE.feedButtonIndex;
        updateNavigationHighlight();
        scrollToNavigationItem();
    }
}

function exitNavigationMode() {
    if (STATE.navigationMode) {
        console.log('[Navigation] Exiting navigation mode:', STATE.navigationMode);
        clearNavigationHighlight();
        STATE.navigationMode = null;
        STATE.navigationIndex = -1;
        STATE.navigationItems = [];
        // Clean up feed-specific state
        STATE.feedFilterButtons = [];
        STATE.feedItems = [];
        STATE.feedNavigationFocus = null;
        STATE.feedButtonIndex = 0;
        STATE.feedItemIndex = -1;
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
            // Check if it's a folder summary or a link
            if (item.tagName === 'SUMMARY') {
                // Toggle the folder open/closed
                const details = item.parentElement;
                if (details && details.tagName === 'DETAILS') {
                    details.open = !details.open;
                    // Refresh the navigation items to include newly visible items
                    setTimeout(() => {
                        const currentItem = item;
                        enterBookmarkNavigationMode();
                        // Find and restore position to the toggled folder
                        const newIndex = STATE.navigationItems.indexOf(currentItem);
                        if (newIndex !== -1) {
                            STATE.navigationIndex = newIndex;
                            updateNavigationHighlight();
                        }
                    }, 10);
                }
            } else {
                // It's a link, open it
                item.click();
                exitNavigationMode();
            }
            break;

        case 'applinks':
            // Click the app link
            item.click();
            exitNavigationMode();
            break;

        case 'feed':
            if (STATE.feedNavigationFocus === 'buttons') {
                // Click the filter button
                item.click();
                // Don't exit navigation mode, just let the feed refresh
            } else {
                // Find and click the feed item link
                const feedLink = item.querySelector('.feed-item-title a, .feed-item-link, a');
                if (feedLink) {
                    feedLink.click();
                }
                exitNavigationMode();
            }
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

    // Start clock (clear any existing interval to prevent memory leaks)
    if (STATE.clockIntervalId) {
        clearInterval(STATE.clockIntervalId);
    }
    updateClock();
    STATE.clockIntervalId = setInterval(updateClock, CONFIG.UPDATE_TIME_INTERVAL);

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
        DOM.subtitle.innerHTML = `<p><a href="https://cloud.jumperlink.net/apps/calendar/timeGridWeek/now" target="_blank">${dateString}</a></p>`;
    }

    // Update time-based background in dark mode
    updateTimeBasedBackground(now);
}

function updateTimeBasedBackground(now) {
    // Only apply in dark mode
    const isDarkMode = !window.matchMedia('(prefers-color-scheme: light)').matches;
    if (!isDarkMode) return;

    const hour = now.getHours();
    let backgroundImage = '';

    // Determine background based on time of day
    if (hour >= 20 || hour < 5) {
        // 20:00 to 05:00 - Night
        backgroundImage = 'backgrounds/night.jpg';
    } else if (hour >= 5 && hour < 8) {
        // 05:00 to 08:00 - Sunrise
        backgroundImage = 'backgrounds/dawn.png';
    } else if (hour >= 8 && hour < 18) {
        // 08:00 to 18:00 - Day
        backgroundImage = 'backgrounds/day.jpg';
    } else {
        // 18:00 to 20:00 - Sunset
        backgroundImage = 'backgrounds/dawn.jpg';
    }

    // Apply background to body
    document.body.style.backgroundImage = `url('${backgroundImage}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
}

function ensureClockToggle() {
    if (DOM.clockToggle) return;

    // Only manipulate the display area, not the entire page-title element
    // to avoid destroying the search input
    const displayElement = document.querySelector('.page-title-display p');
    if (!displayElement) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'clock-toggle';
    button.addEventListener('click', handleClockToggle);

    // Clear and insert the button into the display paragraph
    displayElement.innerHTML = '';
    displayElement.appendChild(button);

    // Update the DOM cache reference
    DOM.clockToggle = button;
    DOM.pageTitleText = displayElement;

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
                const metadata = getTimerMetadata(timer.id);
                if (metadata?.repeat) {
                    queueTimerAutoRepeat(timer);
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
                deleteTimerMetadata(timer.id);
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

function playTimerSoundOnce() {
    try {
        const audio = new Audio('sounds/ringtone.m4a');
        audio.play().catch(() => {});
    } catch (error) {
        console.warn('Unable to play timer sound:', error);
    }
}

function startTimerTicker() {
    if (STATE.timerTickIntervalId) {
        clearInterval(STATE.timerTickIntervalId);
    }
    STATE.timerTickIntervalId = setInterval(updateTimerCountdowns, CONFIG.TIMER_TICK_INTERVAL);
}

function updateTimerCountdowns() {
    if (!STATE.timerBoardLoaded && (!STATE.localIntervalTimers || !STATE.localIntervalTimers.length)) {
        return;
    }
    const now = Date.now();
    STATE.timers.forEach(timer => {
        const row = document.querySelector(`.timer-row[data-timer-id="${timer.id}"]`);
        if (!row) return;

        const remainingEl = row.querySelector('.timer-remaining');
        const progressEl = row.querySelector('.timer-progress-fill');
        const intervalState = computeIntervalState(timer, now);
        const remaining = intervalState.intervalRemaining ?? remainingMs(timer, now);
        const percent = intervalState.progressPercent ?? (
            timer.durationMs > 0
                ? Math.min(100, ((timer.durationMs - remainingMs(timer, now)) / timer.durationMs) * 100)
                : 100
        );

        if (remainingEl) {
            remainingEl.textContent = formatRemaining(remaining);
        }
        if (progressEl) {
            const scale = Math.min(Math.max(percent, 0), 100) / 100;
            progressEl.style.transform = `scaleX(${scale})`;
            if (intervalState.gradient) {
                progressEl.style.backgroundImage = intervalState.gradient;
            }
        }
        if (intervalState.hasMultiple) {
            const pill = row.querySelector('.timer-interval-name-pill');
            if (pill && intervalState.currentInterval) {
                pill.textContent = intervalState.currentInterval.label;
            }
            const total = row.querySelector('.timer-total-length');
            if (total) {
                total.textContent = `Total ${formatDuration(intervalState.totalDuration)}`;
            }
        }
    });

    (STATE.localIntervalTimers || []).forEach(timer => {
        if (timer.mode !== 'interval') return;
        const row = document.querySelector(`.timer-row[data-timer-id="${timer.id}"]`);
        if (!row) return;
        const remainingEl = row.querySelector('.timer-remaining');
        const progressEl = row.querySelector('.timer-progress-fill');
        const intervalState = computeIntervalState({ ...timer, source: 'local' }, now);
        const remaining =
            intervalState.intervalRemaining ??
            Math.max(0, timer.durationMs - (timer.elapsedMs || 0));
        const percent = intervalState.progressPercent ?? (
            timer.durationMs > 0
                ? Math.min(100, ((timer.durationMs - remaining) / timer.durationMs) * 100)
                : 100
        );

        if (remainingEl) {
            remainingEl.textContent = formatRemaining(remaining);
        }
        if (progressEl) {
            const scale = Math.min(Math.max(percent, 0), 100) / 100;
            progressEl.style.transform = `scaleX(${scale})`;
            if (intervalState.gradient) {
                progressEl.style.backgroundImage = intervalState.gradient;
            }
        }
        if (intervalState.hasMultiple) {
            const pill = row.querySelector('.timer-interval-name-pill');
            if (pill && intervalState.currentInterval) {
                pill.textContent = intervalState.currentInterval.label;
            }
            const total = row.querySelector('.timer-total-length');
            if (total) {
                total.textContent = `Total ${formatDuration(intervalState.totalDuration)}`;
            }
        }
    });

    updateHeaderActiveTimers();
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
    const localTimers = Array.isArray(STATE.localIntervalTimers) ? STATE.localIntervalTimers : [];
    const localIntervalActive = localTimers
        .filter(timer => timer.mode === 'interval' && timer.state !== 'finished')
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const localIntervalFinished = localTimers
        .filter(timer => timer.mode === 'interval' && timer.state === 'finished')
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const localChecklistActive = localTimers
        .filter(timer => timer.mode !== 'interval' && timer.state !== 'finished')
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const localChecklistFinished = localTimers
        .filter(timer => timer.mode !== 'interval' && timer.state === 'finished')
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const errorMessage = STATE.timerError
        ? '<div class="timer-empty timer-error">Unable to reach timer service</div>'
        : null;
    const loadingMessage = !STATE.timerBoardLoaded && !STATE.timerError
        ? '<div class="timer-empty">Loading timers…</div>'
        : null;

    const activeSegments = [];
    if (activeTimers.length) {
        activeSegments.push(
            activeTimers.map(timer => renderTimerRow(timer, now, finishingIds.has(timer.id))).join('')
        );
    }
    if (localIntervalActive.length) {
        activeSegments.push(
            localIntervalActive
                .map(timer => renderTimerRow({ ...timer, source: 'local' }, now, false))
                .join('')
        );
    }
    if (localChecklistActive.length) {
        activeSegments.unshift(localChecklistActive.map(timer => renderLocalIntervalTimerRow(timer, false)).join(''));
    }
    activeContainer.innerHTML = errorMessage
        || (activeSegments.length
            ? activeSegments.join('')
            : (loadingMessage || '<div class="timer-empty">No active timers</div>'));

    const finishedSegments = [];
    if (finishedTimers.length) {
        finishedSegments.push(finishedTimers.map(timer => renderFinishedTimerRow(timer)).join(''));
    }
    if (localIntervalFinished.length) {
        finishedSegments.push(
            localIntervalFinished
                .map(timer => renderFinishedTimerRow({ ...timer, source: 'local' }))
                .join('')
        );
    }
    if (localChecklistFinished.length) {
        finishedSegments.push(localChecklistFinished.map(timer => renderLocalIntervalTimerRow(timer, true)).join(''));
    }
    finishedContainer.innerHTML = errorMessage
        || (finishedSegments.length
            ? finishedSegments.join('')
            : (loadingMessage || '<div class="timer-empty">No finished timers</div>'));

    const activeCountEl = panel.querySelector('[data-timer-tab="active"] .timer-tab-count');
    if (activeCountEl) {
        activeCountEl.textContent =
            activeTimers.length +
            localIntervalActive.length +
            localChecklistActive.length;
    }
    const finishedCountEl = panel.querySelector('[data-timer-tab="finished"] .timer-tab-count');
    if (finishedCountEl) {
        finishedCountEl.textContent =
            finishedTimers.length +
            localIntervalFinished.length +
            localChecklistFinished.length;
    }

    const staleDetails = [];
    STATE.openIntervalDetails.forEach(timerId => {
        const row = panel.querySelector(`.timer-row[data-timer-id="${timerId}"] .timer-interval-details`);
        if (!row) {
            staleDetails.push(timerId);
        }
    });
    staleDetails.forEach(id => STATE.openIntervalDetails.delete(id));

    setTimerActiveTab(STATE.timerActiveTab || 'active');
    updateTimerCountdowns();
    syncTimerPanelState();
    updateHeaderActiveTimers();
}

function renderTimerRow(timer, now, isFinishing) {
    const intervalState = computeIntervalState(timer, now);
    const remaining = intervalState.intervalRemaining ?? remainingMs(timer, now);
    const progressPercent = intervalState.progressPercent ?? 0;
    const isRunning = timer.state === 'running';
    const source = timer.source || 'remote';
    const isDetailsOpen = STATE.openIntervalDetails.has(timer.id);
    const rowClasses = [
        'timer-row',
        isRunning ? 'timer-row--running' : '',
        isFinishing ? 'timer-row--finishing' : ''
    ].join(' ');
    const progressStyleParts = [`width:${progressPercent}%`];
    if (intervalState.gradient) {
        progressStyleParts.push(`background-image:${intervalState.gradient}`);
    }
    const progressStyle = progressStyleParts.join(';');
    const hasIntervals = intervalState.hasMultiple;
    const totalLabel = hasIntervals
        ? `<span class="timer-total-length">Total ${formatDuration(intervalState.totalDuration)}</span>`
        : '';
    const intervalLabel = hasIntervals
        ? `<span class="timer-interval-name-pill">${escapeHtml(intervalState.currentInterval.label)}</span>`
        : '';

    return `
        <div class="${rowClasses}" data-timer-id="${timer.id}" data-timer-source="${source}">
            <div class="timer-progress-fill" style="${progressStyle}"></div>
            <div class="timer-row-body">
                <div class="timer-row-info">
                    <div class="timer-name">${escapeHtml(timer.label || 'Timer')}</div>
                    <div class="timer-time">
                        ${intervalLabel}
                        <span class="timer-remaining">${formatRemaining(remaining)}</span>
                        ${totalLabel}
                    </div>
                </div>
                <div class="timer-row-controls">
                    ${hasIntervals ? `
                        <button type="button"
                            class="timer-interval-toggle ${isDetailsOpen ? 'is-open' : ''}"
                            data-interval-panel-toggle="${timer.id}"
                            data-timer-source="${source}"
                            aria-expanded="${isDetailsOpen ? 'true' : 'false'}"
                            title="View intervals">
                            ▾
                        </button>` : ''}
                    <button type="button"
                        class="timer-icon-btn"
                        data-timer-action="${isRunning ? 'pause' : 'start'}"
                        data-timer-id="${timer.id}"
                        data-timer-source="${source}"
                        aria-label="${isRunning ? 'Pause timer' : 'Start timer'}">
                        ${isRunning ? '❚❚' : '►'}
                    </button>
                    <button type="button"
                        class="timer-icon-btn timer-icon-btn--danger"
                        data-timer-action="delete"
                        data-timer-id="${timer.id}"
                        data-timer-source="${source}"
                        aria-label="Delete timer">
                        ×
                    </button>
                </div>
            </div>
            ${hasIntervals ? renderIntervalDetails(timer, intervalState) : ''}
        </div>
    `;
}

function renderFinishedTimerRow(timer) {
    const intervalState = computeIntervalState(timer, Date.now());
    const source = timer.source || 'remote';
    return `
        <div class="timer-row timer-row--finished" data-timer-id="${timer.id}" data-timer-source="${source}">
            <div class="timer-progress-fill" style="width:100%;"></div>
            <div class="timer-row-body">
                <div class="timer-row-info">
                    <div class="timer-name">${escapeHtml(timer.label || 'Timer')}</div>
                    <div class="timer-time">
                        <span class="timer-remaining">Total ${formatDuration(intervalState.totalDuration)}</span>
                    </div>
                </div>
                <div class="timer-row-controls">
                    <button type="button"
                        class="timer-icon-btn"
                        data-timer-action="start"
                        data-timer-id="${timer.id}"
                        data-timer-source="${source}"
                        aria-label="Restart timer">
                        ⟳
                    </button>
                    <button type="button"
                        class="timer-icon-btn timer-icon-btn--danger"
                        data-timer-action="delete"
                        data-timer-id="${timer.id}"
                        data-timer-source="${source}"
                        aria-label="Delete timer">
                        ×
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderIntervalDetails(timer, intervalState) {
    if (!intervalState || !intervalState.hasMultiple) return '';
    const isOpen = STATE.openIntervalDetails.has(timer.id);
    return `
        <div class="timer-interval-details ${isOpen ? 'is-open' : ''}" data-interval-panel="${timer.id}">
            ${intervalState.intervals.map((interval, index) => `
                <div class="timer-interval-detail ${index === intervalState.currentIndex ? 'is-current' : ''}">
                    <div class="timer-interval-detail-main">
                        <input
                            type="text"
                            class="timer-interval-detail-name"
                            value="${escapeHtml(interval.label)}"
                            data-interval-meta-field="label"
                            data-parent-timer="${timer.id}"
                            data-interval-id="${interval.id}">
                        <span class="timer-interval-detail-duration">
                            ${formatDuration(interval.durationMs)}
                        </span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderLocalIntervalTimerRow(timer, isFinished = false) {
    if (!timer) return '';
    const checkboxId = `local-timer-${timer.id}`;
    return `
        <div class="timer-row timer-row--notime" data-timer-id="${timer.id}" data-timer-source="local" data-timer-mode="checklist">
            <div class="timer-row-body">
                <label class="timer-no-time-checkbox" for="${checkboxId}">
                    <input type="checkbox"
                        id="${checkboxId}"
                        data-local-timer-checkbox="${timer.id}"
                        ${isFinished ? 'checked' : ''}>
                    <span class="timer-no-time-checkmark"></span>
                </label>
                <div class="timer-row-info">
                    <div class="timer-name">${escapeHtml(timer.label || 'Timer')}</div>
                    <div class="timer-time">
                        <span class="timer-no-time-label">${isFinished ? 'Completed checklist item' : 'Checklist item'}</span>
                    </div>
                </div>
                <div class="timer-row-controls">
                    ${isFinished ? `
                    <button type="button"
                        class="timer-icon-btn"
                        data-local-timer-action="reset"
                        data-local-timer-id="${timer.id}"
                        aria-label="Reset item">
                        ⟳
                    </button>` : ''}
                    <button type="button"
                        class="timer-icon-btn timer-icon-btn--danger"
                        data-local-timer-action="delete"
                        data-local-timer-id="${timer.id}"
                        aria-label="Remove item">
                        ×
                    </button>
                </div>
            </div>
        </div>
    `;
}

function effectiveElapsedMs(timer, now) {
    if (timer.source === 'local') {
        return Math.max(0, Number(timer.elapsedMs) || 0);
    }
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

function formatDuration(ms) {
    return formatRemaining(ms);
}

function formatHeaderRemaining(ms) {
    if (!Number.isFinite(ms)) return '--';
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return parts.join(' ');
}

const TIMER_INTERVAL_COLORS = [
    '#9fb2ff',
    '#cba7ff',
    '#8ff5ff',
    '#8af7c9',
    '#ffd08b'
];

function getIntervalColor(index = 0) {
    if (!TIMER_INTERVAL_COLORS.length) return '#9fb2ff';
    return TIMER_INTERVAL_COLORS[Math.abs(index) % TIMER_INTERVAL_COLORS.length];
}

function getTimerIntervals(timer) {
    if (!timer) return [];
    const meta = getTimerMetadata(timer.id);
    let intervals = Array.isArray(meta?.intervals) && meta.intervals.length
        ? meta.intervals.map((interval, index) => ({
            id: interval.id || `interval-${timer.id}-${index}`,
            label: interval.label || `Interval ${index + 1}`,
            durationMs: Math.max(0, Number(interval.durationMs) || 0),
            colorIndex: Number.isFinite(interval.colorIndex) ? interval.colorIndex : index
        }))
        : [{
            id: `${timer.id}-default`,
            label: timer.label || 'Timer',
            durationMs: Math.max(0, timer.durationMs || 0),
            colorIndex: 0
        }];

    if (!intervals.length) {
        intervals = [{
            id: `${timer.id}-default`,
            label: timer.label || 'Timer',
            durationMs: Math.max(0, timer.durationMs || 0),
            colorIndex: 0
        }];
    }

    const normalizedTotal = Math.max(1, timer.durationMs || 1);
    let cumulative = intervals.reduce((sum, interval) => sum + interval.durationMs, 0);
    if (cumulative <= 0) {
        const evenDuration = normalizedTotal / intervals.length;
        intervals = intervals.map((interval, index) => ({
            ...interval,
            durationMs: evenDuration,
            colorIndex: interval.colorIndex ?? index
        }));
    } else if (Math.abs(cumulative - normalizedTotal) > 1000 && normalizedTotal > 0) {
        const diff = normalizedTotal - cumulative;
        const last = intervals[intervals.length - 1];
        last.durationMs = Math.max(0, last.durationMs + diff);
        cumulative = intervals.reduce((sum, interval) => sum + interval.durationMs, 0);
    }

    return intervals.map(interval => ({
        ...interval,
        color: getIntervalColor(interval.colorIndex)
    }));
}

function buildIntervalGradient(intervals, totalDuration) {
    if (!intervals || !intervals.length || totalDuration <= 0) {
        return null;
    }
    let cursor = 0;
    const stops = intervals.map(interval => {
        const startPercent = (cursor / totalDuration) * 100;
        cursor += interval.durationMs;
        const endPercent = (cursor / totalDuration) * 100;
        return `${interval.color} ${startPercent}%, ${interval.color} ${endPercent}%`;
    }).join(', ');
    return `linear-gradient(90deg, ${stops})`;
}

function computeIntervalState(timer, now) {
    const intervals = getTimerIntervals(timer);
    const totalDuration = Math.max(1, timer.durationMs || intervals.reduce((sum, interval) => sum + interval.durationMs, 0) || 1);
    const remaining = remainingMs(timer, now);
    const elapsed = Math.max(0, totalDuration - remaining);

    let currentIndex = 0;
    let accumulated = 0;
    for (let index = 0; index < intervals.length; index++) {
        const interval = intervals[index];
        const intervalEnd = accumulated + interval.durationMs;
        if (elapsed < intervalEnd || index === intervals.length - 1) {
            currentIndex = index;
            break;
        }
        accumulated = intervalEnd;
    }

    const currentInterval = intervals[currentIndex] || intervals[0];
    const intervalStart = intervals.slice(0, currentIndex).reduce((sum, interval) => sum + interval.durationMs, 0);
    const intervalElapsed = Math.max(0, elapsed - intervalStart);
    const intervalRemaining = Math.max(0, currentInterval.durationMs - intervalElapsed);
    const progressPercent = totalDuration > 0
        ? Math.min(100, ((totalDuration - remaining) / totalDuration) * 100)
        : 0;

    return {
        intervals,
        currentInterval,
        currentIndex,
        intervalRemaining,
        totalRemaining: remaining,
        totalDuration,
        gradient: buildIntervalGradient(intervals, totalDuration),
        hasMultiple: intervals.length > 1,
        progressPercent
    };
}

function setTimerPanelVisibility(visible) {
    const nextValue = Boolean(visible);
    if (STATE.timerPanelVisible === nextValue) return;
    STATE.timerPanelVisible = nextValue;
    syncTimerPanelState();
    displayFeed(); // Refresh the display to show/hide timer panel
}

function toggleTimerPanel() {
    setTimerPanelVisibility(!STATE.timerPanelVisible);
}

function openTimerPanel() {
    setTimerPanelVisibility(true);
}

function closeTimerPanel() {
    setTimerPanelVisibility(false);
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

function setTimerActiveTab(tab) {
    if (tab !== 'active' && tab !== 'finished') {
        return;
    }
    STATE.timerActiveTab = tab;
    const panel = document.querySelector('.timer-panel');
    if (!panel) return;

    panel.querySelectorAll('.timer-tab-btn').forEach(btn => {
        const isMatch = btn.dataset.timerTab === tab;
        btn.classList.toggle('is-active', isMatch);
        btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });

    panel.querySelectorAll('.timer-tab-content').forEach(content => {
        const isMatch = content.dataset.tab === tab;
        content.classList.toggle('is-visible', isMatch);
        content.setAttribute('aria-hidden', isMatch ? 'false' : 'true');
    });
}

function toggleIntervalDetails(timerId) {
    if (!timerId) return;
    if (STATE.openIntervalDetails.has(timerId)) {
        STATE.openIntervalDetails.delete(timerId);
    } else {
        STATE.openIntervalDetails.add(timerId);
    }
    const row = document.querySelector(`.timer-row[data-timer-id="${timerId}"]`);
    if (!row) return;
    const toggleBtn = row.querySelector(`[data-interval-panel-toggle="${timerId}"]`);
    const details = row.querySelector('.timer-interval-details');
    const isOpen = STATE.openIntervalDetails.has(timerId);
    toggleBtn?.classList.toggle('is-open', isOpen);
    toggleBtn?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    details?.classList.toggle('is-open', isOpen);
}

function queueTimerAutoRepeat(timer) {
    if (!timer || !timer.id) return;
    const metadata = getTimerMetadata(timer.id);
    if (!metadata?.repeat || STATE.autoRepeatQueue.has(timer.id)) {
        return;
    }
    STATE.autoRepeatQueue.add(timer.id);
    (async () => {
        try {
            await sendTimerMutation('command', { id: timer.id, command: 'reset' });
            await sendTimerMutation('command', { id: timer.id, command: 'start' });
        } catch (error) {
            console.error('Timer auto-repeat error:', error);
        } finally {
            STATE.autoRepeatQueue.delete(timer.id);
        }
    })();
}

async function handleTimerFormSubmit(event) {
    event.preventDefault();
    const form = event.target.closest('.timer-add-form');
    if (!form) return;

    const labelInput = form.querySelector('.timer-label-input');
    const countdownInputs = form.querySelectorAll('.timer-count-field');
    const dateInput = form.querySelector('.timer-date-input');

    const draft = STATE.timerDraft || createTimerDraft();
    const label = (draft.label || labelInput?.value || '').trim() || 'Timer';
    const countdownMs = calculateCountdownMs(countdownInputs);
    const dateDurationMs = calculateDateTargetMs(dateInput);
    const hasIntervals = Array.isArray(draft.intervals) && draft.intervals.length > 0;
    const intervalDurationMs = hasIntervals
        ? draft.intervals.reduce((sum, interval) => sum + (Number(interval.durationMs) || 0), 0)
        : 0;

    if (hasIntervals && intervalDurationMs > 0) {
        createLocalIntervalTimer({ label, intervals: draft.intervals });
        countdownInputs.forEach(select => {
            select.value = '';
            select.disabled = false;
        });
        if (dateInput) {
            dateInput.value = '';
            dateInput.disabled = false;
        }
        resetTimerDraft();
        return;
    }

    let durationMs = 0;
    if (hasIntervals) {
        durationMs = intervalDurationMs;
    } else if (countdownMs > 0 && !dateInput?.value) {
        durationMs = countdownMs;
    } else if (dateDurationMs > 0 && countdownMs === 0) {
        durationMs = dateDurationMs;
    }

    if (durationMs <= 0) {
        createLocalIntervalTimer({ label, intervals: draft.intervals || [] });
        countdownInputs.forEach(select => {
            select.value = '';
            select.disabled = false;
        });
        if (dateInput) {
            dateInput.value = '';
            dateInput.disabled = false;
        }
        resetTimerDraft();
        return;
    }

    const previousIds = new Set(STATE.timers.map(timer => timer.id));
    const metadataPayload = {
        repeat: Boolean(draft.repeat),
        intervals: hasIntervals ? draft.intervals : []
    };

    try {
        const board = await sendTimerMutation('create', { label, durationMs });
        const newTimer = board?.timers?.find(timer => !previousIds.has(timer.id));
        if (newTimer) {
            await sendTimerMutation('command', { id: newTimer.id, command: 'start' });
            if (metadataPayload.repeat || metadataPayload.intervals.length) {
                setTimerMetadata(newTimer.id, metadataPayload);
            }
        }
    } catch (error) {
        console.error('Timer create error:', error);
        alert('Unable to create timer. Please try again when the timer service is reachable.');
    }

    countdownInputs.forEach(select => {
        select.value = '';
        select.disabled = false;
    });
    if (dateInput) {
        dateInput.value = '';
        dateInput.disabled = false;
    }
    resetTimerDraft();
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
        updateTimerDraft({ targetDate: '' });
    }
    const newCountdown = { ...(STATE.timerDraft?.countdown || {}) };
    countdownInputs.forEach(select => {
        const unit = select.dataset.unit;
        if (!unit) return;
        newCountdown[unit] = select.value || '';
    });
    updateTimerDraft({ countdown: newCountdown });
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
    const clearedCountdown = hasDate
        ? { days: '', hours: '', minutes: '', seconds: '' }
        : { ...(STATE.timerDraft?.countdown || {}) };
    updateTimerDraft({
        targetDate: dateInput.value,
        countdown: clearedCountdown
    });
}

function handleTimerPanelChange(event) {
    const checkbox = event.target.closest('[data-local-timer-checkbox]');
    if (checkbox) {
        const timerId = checkbox.dataset.localTimerCheckbox;
        if (timerId) {
            setLocalIntervalTimerState(timerId, checkbox.checked ? 'finished' : 'active');
        }
        return;
    }
}

async function handleTimerPanelAction(event) {
    const panel = event.currentTarget;

    const checklistButton = event.target.closest('[data-local-timer-action]');
    if (checklistButton) {
        const { localTimerAction, localTimerId } = checklistButton.dataset;
        if (localTimerAction === 'delete' && localTimerId) {
            deleteLocalIntervalTimer(localTimerId);
            return;
        }
        if (localTimerAction === 'reset' && localTimerId) {
            setLocalIntervalTimerState(localTimerId, 'active');
            return;
        }
        return;
    }

    const tabButton = event.target.closest('[data-timer-tab]');
    if (tabButton) {
        event.preventDefault();
        setTimerActiveTab(tabButton.dataset.timerTab);
        return;
    }

    const durationToggle = event.target.closest('[data-timer-duration-toggle]');
    if (durationToggle) {
        event.preventDefault();
        const willOpen = !STATE.timerDraft.durationMenuOpen;
        updateTimerDraft({
            durationMenuOpen: willOpen,
            dateMenuOpen: willOpen ? false : STATE.timerDraft.dateMenuOpen
        });
        return;
    }

    const dateToggle = event.target.closest('[data-timer-date-toggle]');
    if (dateToggle) {
        event.preventDefault();
        const willOpen = !STATE.timerDraft.dateMenuOpen;
        updateTimerDraft({
            dateMenuOpen: willOpen,
            durationMenuOpen: willOpen ? false : STATE.timerDraft.durationMenuOpen
        });
        return;
    }

    const repeatToggle = event.target.closest('[data-timer-repeat-toggle]');
    if (repeatToggle) {
        event.preventDefault();
        updateTimerDraft({ repeat: !STATE.timerDraft.repeat });
        return;
    }

    const addIntervalBtn = event.target.closest('[data-timer-add-interval]');
    if (addIntervalBtn) {
        event.preventDefault();
        const form = panel.querySelector('.timer-add-form');
        if (!form) return;
        const countdownInputs = form.querySelectorAll('.timer-count-field');
        const durationMs = calculateCountdownMs(countdownInputs);
        if (durationMs <= 0) {
            alert('Select a duration to append to the interval stack.');
            return;
        }
        appendDraftInterval(durationMs);
        const cleared = { days: '', hours: '', minutes: '', seconds: '' };
        countdownInputs.forEach(select => {
            select.value = '';
        });
        updateTimerDraft({
            countdown: cleared
        });
        return;
    }

    const draftIntervalRemove = event.target.closest('[data-draft-interval-remove]');
    if (draftIntervalRemove) {
        event.preventDefault();
        removeDraftInterval(draftIntervalRemove.dataset.draftIntervalRemove);
        return;
    }

    const intervalToggle = event.target.closest('[data-interval-panel-toggle]');
    if (intervalToggle) {
        event.preventDefault();
        toggleIntervalDetails(intervalToggle.dataset.intervalPanelToggle);
        return;
    }

    const actionButton = event.target.closest('[data-timer-action]');
    if (!actionButton) return;

    const { timerAction, timerId } = actionButton.dataset;
    const timerSource = actionButton.dataset.timerSource || 'remote';
    if (!timerId) return;
    if (timerSource === 'local') {
        const localTimer = findLocalIntervalTimer(timerId);
        if (timerAction === 'delete') {
            deleteLocalIntervalTimer(timerId);
            return;
        }
        if (localTimer && localTimer.mode !== 'interval') {
            if (timerAction === 'reset') {
                setLocalIntervalTimerState(timerId, 'active');
            } else if (timerAction === 'start') {
                setLocalIntervalTimerState(timerId, localTimer.state === 'finished' ? 'active' : 'finished');
            }
            return;
        }
        if (timerAction === 'start') {
            if (localTimer && localTimer.state === 'finished') {
                resetLocalIntervalTimer(timerId);
            }
            startLocalIntervalTimer(timerId);
            return;
        }
        if (timerAction === 'pause') {
            pauseLocalIntervalTimer(timerId);
            return;
        }
        if (timerAction === 'reset') {
            resetLocalIntervalTimer(timerId);
            return;
        }
        return;
    }
    const timer = STATE.timers.find(entry => entry.id === timerId);

    if (timerAction === 'delete') {
        try {
            await sendTimerMutation('delete', { id: timerId });
            deleteTimerMetadata(timerId);
        } catch (error) {
            console.error('Timer delete error:', error);
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

function handleTimerPanelInput(event) {
    const labelInput = event.target.closest('.timer-label-input');
    if (labelInput) {
        updateTimerDraft({ label: labelInput.value });
        return;
    }

    const draftIntervalInput = event.target.closest('[data-draft-interval-field="label"]');
    if (draftIntervalInput) {
        renameDraftInterval(draftIntervalInput.dataset.intervalId, draftIntervalInput.value);
        return;
    }

    const intervalMetaInput = event.target.closest('[data-interval-meta-field="label"]');
    if (intervalMetaInput) {
        renameTimerInterval(
            intervalMetaInput.dataset.parentTimer,
            intervalMetaInput.dataset.intervalId,
            intervalMetaInput.value
        );
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

async function loadNextcloudFeed(folderId = null, options = {}) {
    const { append = false, offsetOverride = null } = options;
    if (!CONFIG.NEXTCLOUD_URL || CONFIG.NEXTCLOUD_USER === 'YOUR_USERNAME') {
        STATE.latestItems = [];

        // If timer panel is visible, show it in fullscreen (no feed controls)
        if (STATE.timerPanelVisible) {
            const timerHTML = `<div class="timer-panel-fullscreen">${displayTimerPanel()}</div>`;
            DOM.overview.innerHTML = timerHTML;
            attachTimerControlHandlers();
        } else {
            const placeholder = '<p class="empty-state">Configure Nextcloud credentials to see your news feed</p>';
            DOM.overview.innerHTML = placeholder + getFeedControlsHTML();
            attachViewToggleHandlers();
            attachFolderClickHandlers();
            attachTimerControlHandlers();
        }

        renderTimerLists();
        syncTimerPanelState();
        return;
    }

    if (STATE.feedLoading) return;
    STATE.feedLoading = true;

    try {
        const auth = btoa(`${CONFIG.NEXTCLOUD_USER}:${CONFIG.NEXTCLOUD_PASS}`);

        const includeRead = STATE.feedViewFilter === 'all';
        const batchSize = includeRead ? (CONFIG.FEED_ITEMS_PER_PAGE || CONFIG.INITIAL_FEED_ITEMS) : CONFIG.INITIAL_FEED_ITEMS;
        const isStarredMode = STATE.showStarredOnly;
        let offset = includeRead ? STATE.feedOffset : 0;
        if (offsetOverride !== null) {
            offset = offsetOverride;
        }

        const params = new URLSearchParams({
            type: isStarredMode ? '2' : (folderId === null ? '3' : '1'),
            getRead: includeRead ? 'true' : 'false',
            batchSize: batchSize.toString(),
            offset: offset.toString()
        });

        if (!isStarredMode && folderId !== null) {
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

        const shouldAppend = append && includeRead;

        if (shouldAppend) {
            if (!newItems.length) {
                STATE.feedHasMore = false;
            } else {
                STATE.latestItems = [...STATE.latestItems, ...newItems];
                STATE.feedOffset += newItems.length;
                STATE.feedHasMore = newItems.length === batchSize;
            }
        } else {
            STATE.latestItems = newItems;
            STATE.feedOffset = includeRead ? newItems.length : 0;
            STATE.feedHasMore = includeRead && newItems.length === batchSize;
        }

        applyLocalReadOverrides(STATE.latestItems);
        STATE.feedLoading = false;
        displayFeed();
        processReadSyncQueue();
    } catch (error) {
        console.error('Feed fetch error:', error);
        STATE.feedLoading = false;

        // If timer panel is visible, show it in fullscreen (no feed controls)
        if (STATE.timerPanelVisible) {
            const timerHTML = `<div class="timer-panel-fullscreen">${displayTimerPanel()}</div>`;
            DOM.overview.innerHTML = timerHTML;
            attachTimerControlHandlers();
        } else {
            const message = '<p class="empty-state">Unable to load news feed</p>';
            DOM.overview.innerHTML = message + getFeedControlsHTML();
            attachViewToggleHandlers();
            attachFolderClickHandlers();
            attachTimerControlHandlers();
        }

        renderTimerLists();
        syncTimerPanelState();
    }
}

function displayViewToggle() {
    const nextView = STATE.feedViewFilter === 'unviewed' ? 'all' : 'unviewed';
    const label = STATE.feedViewFilter === 'unviewed' ? '🔵' : '⚫';
    const activeClass = STATE.feedViewFilter === 'unviewed' ? ' is-active' : '';

    return `
        <button class="view-toggle-chip${activeClass}" data-view="${nextView}">
            ${label}
        </button>
    `;
}

function displayTimerPanel() {
    const draft = STATE.timerDraft || createTimerDraft();
    const activeTimers = STATE.timers
        .filter(timer => timer.state !== 'finished' || STATE.finishingTimers.has(timer.id));
    const finishedTimers = STATE.timers
        .filter(timer => timer.state === 'finished' && !STATE.finishingTimers.has(timer.id));

    const tab = STATE.timerActiveTab || 'active';

    return `
        <div class="timer-panel ${STATE.timerPanelVisible ? 'open' : ''}">
            <div class="timer-board">
                <div class="timer-tab-bar" role="tablist">
                    <button type="button"
                        class="timer-tab-btn ${tab === 'active' ? 'is-active' : ''}"
                        data-timer-tab="active">
                        <span>Active Timers</span>
                        <span class="timer-tab-count">${activeTimers.length}</span>
                    </button>
                    <button type="button"
                        class="timer-tab-btn ${tab === 'finished' ? 'is-active' : ''}"
                        data-timer-tab="finished">
                        <span>Finished Timers</span>
                        <span class="timer-tab-count">${finishedTimers.length}</span>
                    </button>
                </div>
                <div class="timer-tab-contents">
                    <div class="timer-tab-content ${tab === 'active' ? 'is-visible' : ''}" data-tab="active">
                        <div class="timer-items"></div>
                    </div>
                    <div class="timer-tab-content ${tab === 'finished' ? 'is-visible' : ''}" data-tab="finished">
                        <div class="finished-timer-items"></div>
                    </div>
                </div>
            </div>

            <form class="timer-add-form">
                <div class="timer-add-shell">
                    <div class="timer-add-row">
                        <input type="text"
                            class="timer-label-input"
                            placeholder="Timer name"
                            value="${escapeHtml(draft.label || '')}">
                        <div class="timer-add-buttons">
                            <button type="button"
                                class="timer-chip ${draft.durationMenuOpen ? 'is-active' : ''}"
                                data-timer-duration-toggle>
                                Timer
                            </button>
                            <button type="button"
                                class="timer-chip ${draft.dateMenuOpen ? 'is-active' : ''}"
                                data-timer-date-toggle>
                                Calendar
                            </button>
                            <button type="button"
                                class="timer-chip timer-chip--repeat ${draft.repeat ? 'is-active' : ''}"
                                data-timer-repeat-toggle
                                aria-pressed="${draft.repeat}">
                                Repeat
                            </button>
                            <button type="button"
                                class="timer-chip timer-chip--add"
                                data-timer-add-interval
                                title="Add interval from current duration">
                                +
                            </button>
                        </div>
                    </div>

                    <div class="timer-duration-menu ${draft.durationMenuOpen ? 'is-open' : ''}">
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
                    </div>

                    <div class="timer-date-menu ${draft.dateMenuOpen ? 'is-open' : ''}">
                        <input type="datetime-local"
                            class="timer-date-input"
                            value="${draft.targetDate || ''}">
                    </div>

                    <div class="timer-interval-collection">
                        ${renderIntervalDraftList(draft)}
                    </div>

                    <div class="timer-add-footer">
                        <button type="submit" class="timer-add-btn">Add Timer</button>
                    </div>
                </div>
            </form>
        </div>
    `;
}

function renderIntervalDraftList(draft) {
    if (!draft || !Array.isArray(draft.intervals) || draft.intervals.length === 0) {
        return '<div class="timer-empty timer-empty--compact">Add intervals to stack complex timers</div>';
    }
    return draft.intervals.map((interval, index) => `
        <div class="timer-interval-draft" data-draft-interval-id="${interval.id}">
            <div class="timer-interval-draft-main">
                <input
                    type="text"
                    class="timer-interval-name"
                    value="${escapeHtml(interval.label || `Interval ${index + 1}`)}"
                    data-draft-interval-field="label"
                    data-interval-id="${interval.id}">
                <div class="timer-interval-duration">
                    ${formatDuration(interval.durationMs)}
                </div>
            </div>
            <button type="button"
                class="timer-interval-remove"
                data-draft-interval-remove="${interval.id}"
                aria-label="Remove interval">
                ×
            </button>
        </div>
    `).join('');
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
                ${displayViewToggle()}
            </div>
        `;
    }

    const isAllActive = STATE.selectedFolder === null && !STATE.showStarredOnly;
    const starActive = STATE.showStarredOnly;
    const menuHTML = `
        <div class="feed-folder-menu">
            ${displayViewToggle()}
            <button class="folder-btn ${isAllActive ? 'active' : ''}" data-folder-id="null" title="All items">
                All
            </button>
            <button class="folder-btn folder-btn--starred ${starActive ? 'active' : ''}" data-folder-starred="true" title="Starred items">
                <img src="icons/${starActive ? 'starred-folder' : 'starred-folder'}.svg" alt="Starred items" class="folder-icon folder-icon--star">
            </button>
            ${STATE.folders.map(folder => {
                const isActive = STATE.selectedFolder === folder.id;
                const display = renderFolderLabel(folder.name);
                return `
                    <button class="folder-btn ${isActive ? 'active' : ''}" data-folder-id="${folder.id}" title="${escapeHtml(display.title)}">
                        ${display.html}
                    </button>
                `;
            }).join('')}
        </div>
    `;

    return menuHTML;
}

function renderFolderLabel(folderName) {
    const name = (folderName || '').trim();
    const iconMap = [
        { match: '🎹', src: 'icons/music.svg', alt: 'Music' },
        { match: '🎵', src: 'icons/tiktok.svg', alt: 'TikTok' },
        { match: '🎶', src: 'icons/tiktok.svg', alt: 'TikTok' },
        { match: '▶', src: 'icons/play.svg', alt: 'Video' },
        { match: '▶️', src: 'icons/video.svg', alt: 'Video' },
        { match: '📰', src: 'icons/blog.svg', alt: 'Blog' }
    ];

    const mapping = iconMap.find(entry => name.includes(entry.match));
    if (mapping) {
        return {
            html: `<img src="${mapping.src}" alt="${escapeHtml(mapping.alt)}" class="folder-icon">`,
            title: mapping.alt
        };
    }
    return {
        html: escapeHtml(name || 'Folder'),
        title: name || 'Folder'
    };
}

function displayFeed() {
    const controlsHTML = getFeedControlsHTML();
    const items = getFilteredFeedItems();

    // If timer panel is visible, show only the timer panel (no feed controls)
    if (STATE.timerPanelVisible) {
        const timerHTML = `
            <div class="timer-panel-fullscreen">
                ${displayTimerPanel()}
            </div>
        `;
        DOM.overview.innerHTML = timerHTML;
        attachTimerControlHandlers();
        renderTimerLists();
        syncTimerPanelState();
        refreshDesktopVideoEmbeds();
        return;
    }

    if (!items || items.length === 0) {
        const message = STATE.feedViewFilter === 'all'
            ? '<p class="empty-state">No items to display</p>'
            : '<p class="empty-state">No unread items</p>';
        const footerHTML = getFeedFooterHTML();
        // Preserve the header-active-bar when updating overview
        const timerBarHTML = '<div class="header-active-bar" aria-live="polite" aria-label="Active timers"></div>';
        DOM.overview.innerHTML = timerBarHTML + message + footerHTML + controlsHTML;
        // Update DOM cache reference to the new timer bar element
        DOM.headerTimers = document.querySelector('.header-active-bar');
        attachViewToggleHandlers();
        attachFolderClickHandlers();
        attachRefreshHandler();
        attachLoadMoreHandler();
        attachTimerControlHandlers();
        renderTimerLists();
        syncTimerPanelState();
        refreshDesktopVideoEmbeds();
        return;
    }

    const footerHTML = getFeedFooterHTML();

    const feedHTML = `
        <div class="feed-region">
            <div class="bluesky-feed">
                ${items.map(item => createFeedCard(item)).join('')}
            </div>
        </div>
        ${footerHTML}
    `;

    // Preserve the header-active-bar when updating overview
    const timerBarHTML = '<div class="header-active-bar" aria-live="polite" aria-label="Active timers"></div>';
    DOM.overview.innerHTML = timerBarHTML + feedHTML + controlsHTML;
    // Update DOM cache reference to the new timer bar element
    DOM.headerTimers = document.querySelector('.header-active-bar');
    renderTimerLists();
    attachViewToggleHandlers();
    attachFolderClickHandlers();
    attachFeedItemInteractions();
    attachStarToggleHandlers();
    attachTimerControlHandlers();
    attachRefreshHandler();
    attachLoadMoreHandler();
    syncTimerPanelState();
    refreshDesktopVideoEmbeds();
    hydrateBlueskyEmbeds();
}

function getFeedControlsHTML() {
    return `
        <div class="feed-controls">
            ${!STATE.timerPanelVisible ? displayTimerPanel() : ''}
            ${displayFolderMenu()}
        </div>
    `;
}

function getFeedFooterHTML() {
    if (STATE.feedViewFilter !== 'all') {
        return `
            <div class="feed-footer">
                <button class="feed-refresh-btn" ${STATE.feedLoading ? 'disabled' : ''}>
                    ${STATE.feedLoading ? 'Loading…' : 'Refresh'}
                </button>
            </div>
        `;
    }

    if (!STATE.feedHasMore) return '';
    return `
        <div class="feed-footer">
            <button class="feed-load-more" ${STATE.feedLoading ? 'disabled' : ''}>
                ${STATE.feedLoading ? 'Loading…' : 'Load More'}
            </button>
        </div>
    `;
}

function attachRefreshHandler() {
    const refreshBtn = document.querySelector('.feed-refresh-btn');
    if (refreshBtn && !refreshBtn.dataset.bound) {
        refreshBtn.dataset.bound = 'true';
        refreshBtn.addEventListener('click', (event) => {
            event.preventDefault();
            refreshUnreadFeed();
        });
    }
}

function attachLoadMoreHandler() {
    const loadMoreBtn = document.querySelector('.feed-load-more');
    if (loadMoreBtn && !loadMoreBtn.dataset.bound) {
        loadMoreBtn.dataset.bound = 'true';
        loadMoreBtn.addEventListener('click', (event) => {
            event.preventDefault();
            loadMoreFeedItems();
        });
    }
}

function refreshUnreadFeed() {
    if (STATE.feedViewFilter === 'all' || STATE.feedLoading) return;
    // Don't mark all items as read - just reload to bring in new unread items
    // Items the user clicked on will already be marked as read individually
    STATE.feedOffset = 0;
    loadNextcloudFeed(STATE.selectedFolder, { offsetOverride: 0 });
}

function loadMoreFeedItems() {
    if (STATE.feedViewFilter !== 'all' || STATE.feedLoading || !STATE.feedHasMore) return;
    loadNextcloudFeed(STATE.selectedFolder, { append: true });
}

function markVisibleItemsAsRead() {
    if (!Array.isArray(STATE.latestItems)) return;
    STATE.latestItems.forEach(item => {
        if (item && item.unread) {
            markFeedItemAsRead(item.id);
        }
    });
}

function getFilteredFeedItems() {
    let items = (STATE.latestItems || []).filter(Boolean);
    if (STATE.showStarredOnly) {
        items = items.filter(item => item && item.starred);
    }
    if (STATE.feedViewFilter === 'all') {
        return items;
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

function buildSourceSignature(domain, feedName, url) {
    return `${domain || ''} ${feedName || ''} ${url || ''}`.toLowerCase();
}

function isBlueskySource(domain, feedName, url) {
    const signature = buildSourceSignature(domain, feedName, url);
    return signature.includes('bluesky') || signature.includes('bsky');
}

function isLemmySource(domain, feedName, url) {
    const signature = buildSourceSignature(domain, feedName, url);
    return signature.includes('lemmy');
}

function extractQuoteText(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    clone.querySelectorAll('script, style').forEach(el => el.remove());
    clone.querySelectorAll('img, video, source').forEach(el => el.remove());
    clone.innerHTML = clone.innerHTML.replace(/<br\s*\/?>/gi, '\n');
    return stripHtml(clone.innerHTML);
}

function isLikelyBlueskyAvatar(src, img) {
    if (!src) return true;
    if (src.startsWith('data:')) return true;
    const lower = src.toLowerCase();
    if (/avatar|profile|icon|emoji/.test(lower)) return true;
    const classes = (img?.className || '').toLowerCase();
    if (classes && /avatar|emoji|icon/.test(classes)) return true;
    const alt = (img?.getAttribute('alt') || '').toLowerCase();
    if (alt && /avatar|emoji/.test(alt)) return true;
    const width = parseInt(img?.getAttribute('width') || '', 10);
    if (Number.isFinite(width) && width <= 80) return true;
    return false;
}

function isLikelyVideoUrl(url) {
    if (!url) return false;
    const plain = url.split('?')[0].toLowerCase();
    return /\.(mp4|webm|mov|m4v|mkv)$/i.test(plain);
}

function guessVideoMime(url) {
    if (!url) return 'video/mp4';
    const plain = url.split('?')[0].toLowerCase();
    if (plain.endsWith('.webm')) return 'video/webm';
    if (plain.endsWith('.mov')) return 'video/quicktime';
    if (plain.endsWith('.m4v')) return 'video/mp4';
    if (plain.endsWith('.mkv')) return 'video/x-matroska';
    return 'video/mp4';
}

function extractBlueskyEnhancements(item, safeItemUrl, domain, feedName) {
    if (!item?.body) return null;
    if (!isBlueskySource(domain, feedName, item?.url)) return null;

    const parser = document.createElement('div');
    parser.innerHTML = item.body;

    const imageAttachments = [];
    const seenSources = new Set();

    parser.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('data-src') || img.getAttribute('src');
        if (!src || seenSources.has(src) || isLikelyBlueskyAvatar(src, img)) return;
        seenSources.add(src);
        imageAttachments.push({
            src,
            alt: img.getAttribute('alt') || ''
        });
    });

    const videoSources = [];
    const pushVideo = (src) => {
        if (!src || seenSources.has(src) || !isLikelyVideoUrl(src)) return;
        seenSources.add(src);
        videoSources.push(src);
    };

    parser.querySelectorAll('video, video source, source').forEach(node => {
        pushVideo(node.getAttribute('src'));
    });
    parser.querySelectorAll('a[href]').forEach(link => pushVideo(link.getAttribute('href')));

    let attachmentsHtml = '';
    if (imageAttachments.length) {
        attachmentsHtml = `
            <div class="bluesky-attachments bluesky-attachments--${Math.min(imageAttachments.length, 4)}">
                ${imageAttachments.slice(0, 4).map(img => `
                    <a class="bluesky-attachment" href="${safeItemUrl}">
                        <img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt || '')}" loading="lazy">
                    </a>
                `).join('')}
            </div>
        `;
    }

    let videosHtml = '';
    if (videoSources.length) {
        videosHtml = `
            <div class="bluesky-videos">
                ${videoSources.slice(0, 2).map(src => `
                    <video controls preload="metadata">
                        <source src="${escapeHtml(src)}" type="${guessVideoMime(src)}">
                    </video>
                `).join('')}
            </div>
        `;
    }

    let quoteHtml = '';
    const quoteNode = parser.querySelector('blockquote, .quote, .quoted-post, .quote-card');
    if (quoteNode) {
        const quoteText = extractQuoteText(quoteNode);
        const citeLink = quoteNode.querySelector('cite a[href], a[href]');
        let citeMarkup = '';
        if (citeLink) {
            const href = citeLink.getAttribute('href');
            const label = citeLink.textContent.trim() || href;
            if (href) {
                citeMarkup = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
            } else if (label) {
                citeMarkup = `<span>${escapeHtml(label)}</span>`;
            }
        }
        if (quoteText) {
            quoteHtml = `
                <div class="bluesky-quote">
                    ${citeMarkup ? `<div class="bluesky-quote-author">${citeMarkup}</div>` : ''}
                    <p>${escapeHtml(quoteText)}</p>
                </div>
            `;
        }
    }

    if (!attachmentsHtml && !videosHtml && !quoteHtml) return null;
    return {
        attachmentsHtml: attachmentsHtml + videosHtml,
        quoteHtml,
        hasRichMedia: Boolean(imageAttachments.length || videoSources.length)
    };
}

function extractLemmyVideo(temp) {
    if (!temp) return null;
    const directVideo = temp.querySelector('video');
    let src = null;
    if (directVideo) {
        src = directVideo.getAttribute('src') || directVideo.querySelector('source')?.getAttribute('src');
    }
    if (!src) {
        const videoLink = Array.from(temp.querySelectorAll('a[href]')).find(link => isLikelyVideoUrl(link.getAttribute('href')));
        if (videoLink) {
            src = videoLink.getAttribute('href');
        }
    }
    if (!src || !isLikelyVideoUrl(src)) return null;

    const posterImg = temp.querySelector('img');
    const poster = posterImg ? (posterImg.getAttribute('src') || posterImg.getAttribute('data-src')) : null;

    return {
        variant: 'video',
        markup: `
            <div class="lemmy-video-embed">
                <video controls preload="metadata" ${poster ? `poster="${escapeHtml(poster)}"` : ''}>
                    <source src="${escapeHtml(src)}" type="${guessVideoMime(src)}">
                </video>
            </div>
        `
    };
}

function shouldUseDesktopVideoEmbeds() {
    const coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    return !coarse && width >= 900;
}

let pendingVideoEmbedRefresh = null;
function refreshDesktopVideoEmbeds() {
    if (pendingVideoEmbedRefresh) return;
    pendingVideoEmbedRefresh = requestAnimationFrame(() => {
        pendingVideoEmbedRefresh = null;
        const preferEmbed = shouldUseDesktopVideoEmbeds();
        if (document.body) {
            document.body.classList.toggle('desktop-video-embeds', preferEmbed);
        }
        document.querySelectorAll('.feed-video-embed[data-embed-src]').forEach(container => {
            const iframe = container.querySelector('iframe');
            if (preferEmbed) {
                if (!iframe) {
                    const src = container.dataset.embedSrc;
                    if (!src) return;
                    const frame = document.createElement('iframe');
                    frame.src = src;
                    frame.loading = 'lazy';
                    frame.allowFullscreen = true;
                    frame.setAttribute('allowfullscreen', 'true');
                    frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
                    frame.referrerPolicy = 'no-referrer';
                    frame.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms');
                    container.appendChild(frame);
                }
            } else if (iframe) {
                iframe.remove();
            }
        });
    });
}

async function hydrateBlueskyEmbeds() {
    if (typeof document === 'undefined') return;
    const cards = Array.from(document.querySelectorAll('.feed-item[data-bsky-uri]'))
        .filter(card => card.dataset.bskyUri && card.dataset.bskyHydrated !== 'true');
    if (!cards.length) return;

    const cardsByUri = new Map();
    cards.forEach(card => {
        const uri = card.dataset.bskyUri;
        if (!uri) return;
        if (!cardsByUri.has(uri)) {
            cardsByUri.set(uri, []);
        }
        cardsByUri.get(uri).push(card);
    });

    const uniqueUris = Array.from(cardsByUri.keys());
    const chunkSize = 20;
    for (let index = 0; index < uniqueUris.length; index += chunkSize) {
        const chunk = uniqueUris.slice(index, index + chunkSize);
        const postsMap = await fetchBlueskyPosts(chunk);
        chunk.forEach(uri => {
            const post = postsMap.get(uri);
            const relatedCards = cardsByUri.get(uri) || [];
            relatedCards.forEach(card => {
                card.dataset.bskyHydrated = 'true';
                const target = card.querySelector('[data-bsky-embed]');
                if (!target) return;
                const html = renderBlueskyEmbedHtml(post);
                if (html) {
                    target.innerHTML = html;
                    target.classList.add('bluesky-rich-embed--visible');
                } else {
                    target.remove();
                }
            });
        });
    }
}

async function fetchBlueskyPosts(uris = []) {
    const result = new Map();
    if (!uris.length) return result;

    const missing = uris.filter(uri => !BLUESKY_POST_CACHE.has(uri));
    if (missing.length) {
        const params = missing.map(uri => `uris=${encodeURIComponent(uri)}`).join('&');
        try {
            const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?${params}`);
            if (!response.ok) {
                throw new Error(`Bluesky API error: ${response.status}`);
            }
            const data = await response.json();
            (data?.posts || []).forEach(post => {
                if (post?.uri) {
                    BLUESKY_POST_CACHE.set(post.uri, post);
                }
            });
            missing.forEach(uri => {
                if (!BLUESKY_POST_CACHE.has(uri)) {
                    BLUESKY_POST_CACHE.set(uri, null);
                }
            });
        } catch (error) {
            console.warn('Unable to load Bluesky embeds', error);
            missing.forEach(uri => {
                if (!BLUESKY_POST_CACHE.has(uri)) {
                    BLUESKY_POST_CACHE.set(uri, null);
                }
            });
        }
    }

    uris.forEach(uri => {
        result.set(uri, BLUESKY_POST_CACHE.get(uri) || null);
    });
    return result;
}

function renderBlueskyEmbedHtml(post) {
    if (!post || !post.embed) return '';
    return renderBlueskyEmbedView(post.embed);
}

function renderBlueskyEmbedView(embed) {
    if (!embed || typeof embed !== 'object') return '';
    switch (embed.$type) {
        case 'app.bsky.embed.external#view':
            return renderBlueskyExternalCard(embed.external);
        case 'app.bsky.embed.images#view':
            return renderBlueskyImages(embed.images);
        case 'app.bsky.embed.record#view':
            return renderBlueskyRecord(embed.record);
        case 'app.bsky.embed.recordWithMedia#view':
            return `${renderBlueskyEmbedView(embed.media)}${renderBlueskyRecord(embed.record)}`;
        case 'app.bsky.embed.video#view':
            return renderBlueskyVideo(embed);
        default:
            return '';
    }
}

function renderBlueskyExternalCard(external) {
    if (!external) return '';
    const host = safeHostname(external.uri);
    return `
        <a class="bluesky-link-card" href="${escapeHtml(external.uri)}" target="_blank" rel="noopener noreferrer">
            ${external.thumb ? `<img src="${escapeHtml(external.thumb)}" alt="" class="bluesky-link-thumb" loading="lazy">` : ''}
            <div class="bluesky-link-details">
                ${external.title ? `<div class="bluesky-link-title">${escapeHtml(external.title)}</div>` : ''}
                ${external.description ? `<p class="bluesky-link-description">${escapeHtml(external.description)}</p>` : ''}
                ${host ? `<span class="bluesky-link-host">${escapeHtml(host)}</span>` : ''}
            </div>
        </a>
    `;
}

function renderBlueskyImages(images) {
    if (!Array.isArray(images) || !images.length) return '';
    return `
        <div class="bluesky-image-grid bluesky-image-grid--${Math.min(images.length, 4)}">
            ${images.map(image => `
                <a href="${escapeHtml(image.fullsize || image.thumb || '')}" target="_blank" rel="noopener noreferrer" class="bluesky-image">
                    <img src="${escapeHtml(image.thumb || image.fullsize || '')}" alt="${escapeHtml(image.alt || '')}" loading="lazy">
                </a>
            `).join('')}
        </div>
    `;
}

function renderBlueskyRecord(record) {
    if (!record) return '';
    const authorName = record.author?.displayName || record.author?.handle || 'Bluesky user';
    const handle = record.author?.handle ? `@${record.author.handle}` : '';
    const href = buildBskyPermalink(record.uri, record.author?.handle);
    const textHtml = renderBlueskyRichText(record.value);
    const nestedEmbeds = Array.isArray(record.embeds)
        ? record.embeds.map(renderBlueskyEmbedView).join('')
        : '';

    return `
        <a class="bluesky-quote-card" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
            <div class="bluesky-quote-header">
                ${record.author?.avatar ? `<img src="${escapeHtml(record.author.avatar)}" alt="" class="bluesky-quote-avatar">` : ''}
                <div>
                    <div class="bluesky-quote-name">${escapeHtml(authorName)}</div>
                    ${handle ? `<div class="bluesky-quote-handle">${escapeHtml(handle)}</div>` : ''}
                </div>
            </div>
            ${textHtml ? `<p class="bluesky-quote-text">${textHtml}</p>` : ''}
            ${nestedEmbeds}
        </a>
    `;
}

function renderBlueskyVideo(embed) {
    const url = embed?.playlist;
    if (!url) return '';
    return `
        <div class="bluesky-video">
            <video controls preload="metadata" ${embed.thumbnail ? `poster="${escapeHtml(embed.thumbnail)}"` : ''}>
                <source src="${escapeHtml(url)}" type="application/x-mpegURL">
            </video>
        </div>
    `;
}

function renderBlueskyRichText(value) {
    if (!value || !value.text) return '';
    const escaped = escapeHtml(value.text);
    return escaped.replace(/\n/g, '<br>');
}

function buildBskyPermalink(uri, handle) {
    if (!uri) return '';
    const segments = uri.split('/');
    const postId = segments[segments.length - 1];
    if (handle) {
        return `https://bsky.app/profile/${handle}/post/${postId}`;
    }
    const did = segments[2];
    return `https://bsky.app/profile/${did}/post/${postId}`;
}

function safeHostname(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./, '');
    } catch (error) {
        return '';
    }
}

function collectHeaderTimers(now) {
    const finishingIds = STATE.finishingTimers || new Set();
    return (STATE.timers || [])
        .filter(timer => timer && (timer.state !== 'finished' || finishingIds.has(timer.id)))
        .map(timer => ({
            id: timer.id,
            label: timer.label || 'Timer',
            remaining: remainingMs(timer, now)
        }))
        .filter(entry => Number.isFinite(entry.remaining))
        .sort((a, b) => a.remaining - b.remaining)
        .slice(0, 4);
}

function updateHeaderActiveTimers() {
    const container = DOM.headerTimers;
    if (!container) return;
    const now = Date.now();
    const timers = collectHeaderTimers(now);
    if (!timers.length) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = timers.map(timer => `
        <div class="header-timer" data-header-timer-id="${timer.id}">
            <div class="header-timer-name">${escapeHtml(timer.label)}</div>
            <div class="header-timer-remaining">${escapeHtml(formatHeaderRemaining(timer.remaining))}</div>
        </div>
    `).join('');
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
    const sourceStrings = [
        item?.url,
        item?.enclosureLink,
        item?.feedLink,
        feed?.url,
        feed?.link
    ]
        .filter(Boolean)
        .map(value => String(value).toLowerCase());
    const matchesSource = (needle) => sourceStrings.some(src => src.includes(needle));
    const forcedAvatarIcon = (() => {
        if (matchesSource('rss-timestamp-adder')) {
            return { src: 'icons/tiktok.svg', alt: 'TikTok feed' };
        }
        if (matchesSource('youtube-rss')) {
            return { src: 'icons/video.svg', alt: 'Video feed' };
        }
        return null;
    })();
    const rawItemUrl = item?.url || '';
    const safeItemUrl = escapeHtml(rawItemUrl);
    const normalizedTitle = (item.title || '').trim();
    const showTitle = shouldDisplayFeedTitle(normalizedTitle);
    const rawExcerpt = CONFIG.SHOW_POST_CONTENT ? getFeedExcerpt(item.body) : '';
    const excerpt = shouldDisplayFeedExcerpt(rawExcerpt, normalizedTitle, domain, feedName) ? rawExcerpt : '';
    const isBluesky = isBlueskySource(domain, feedName, item.url);
    const bskyUri = isBluesky && item.guid && item.guid.startsWith('at://') ? item.guid : null;
    const useApiBlueskyEnhancements = Boolean(bskyUri);
    const media = extractFeedMedia(item);
    const timestamp = formatPublishDate(item.pubDate);
    const metrics = extractEngagementMetrics(item);
    const blueskyExtras = useApiBlueskyEnhancements ? null : extractBlueskyEnhancements(item, safeItemUrl, domain, feedName);
    const blueskyEmbedPlaceholder = useApiBlueskyEnhancements
        ? '<div class="bluesky-rich-embed" data-bsky-embed></div>'
        : '';
    const isUnread = isItemUnread(item);
    const titleMarkup = showTitle ? `
            <a href="${safeItemUrl}"
               class="feed-item-link">
                <h3 class="feed-title">${escapeHtml(normalizedTitle)}</h3>
            </a>
        ` : '';

    const avatarMarkup = (() => {
        if (forcedAvatarIcon) {
            return `<img src="${forcedAvatarIcon.src}" alt="${escapeHtml(forcedAvatarIcon.alt)}" class="feed-avatar feed-avatar--custom">`;
        }
        if (item.feedTitle && item.feedTitle.toLowerCase().includes('tiktok') && item.body) {
            const temp = document.createElement('div');
            temp.innerHTML = item.body;
            const profileImg = temp.querySelector('img');
            if (profileImg && profileImg.getAttribute('src')) {
                return `<img src="${escapeHtml(profileImg.getAttribute('src'))}" alt="" class="feed-avatar">`;
            }
        }
        return domain
            ? `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" alt="" class="feed-avatar">`
            : `<div class="feed-avatar feed-avatar--fallback">${escapeHtml(feedName.charAt(0) || '?')}</div>`;
    })();
    const feedSourceMarkup = `
        <div class="feed-source">
            <span class="feed-source-name">${escapeHtml(feedName)}</span>
            <div class="feed-meta-line">
                ${folder ? `<span class="feed-folder-pill">${escapeHtml(folder.name)}</span>` : ''}
                ${timestamp ? `<span class="feed-date">${escapeHtml(timestamp)}</span>` : ''}
            </div>
        </div>
    `;
    const isStarred = Boolean(item.starred);
    const starButton = `
        <button class="feed-star-btn ${isStarred ? 'is-starred' : ''}"
                type="button"
                data-item-id="${item.id}"
                aria-pressed="${isStarred}"
                title="${isStarred ? 'Unstar item' : 'Star item'}">
            <img src="icons/${isStarred ? 'starred' : 'unstarred'}.png" alt="toggle star">
        </button>
    `;

    return `
        <article class="feed-item ${isUnread ? '' : 'feed-item--read'}"
                 ${bskyUri ? `data-bsky-uri="${escapeHtml(bskyUri)}"` : ''}
                 data-link="${safeItemUrl}"
                 data-item-id="${item.id}"
                 data-unread="${isUnread}">
            <div class="feed-item-top">
                <div class="feed-top-left">
                    <a href="${safeItemUrl}" class="feed-top-link">
                        ${avatarMarkup}
                        ${feedSourceMarkup}
                    </a>
                </div>
                ${starButton}
            </div>
            ${titleMarkup}
            ${excerpt ? `<p class="feed-excerpt"><a href="${safeItemUrl}" class="feed-excerpt-link">${escapeHtml(excerpt)}</a></p>` : ''}
            ${blueskyEmbedPlaceholder}
            ${(!useApiBlueskyEnhancements && (!blueskyExtras || !blueskyExtras.hasRichMedia) && media)
                ? `<div class="${buildMediaClassList(media)}">${media.markup}</div>` : ''}
            ${!useApiBlueskyEnhancements && blueskyExtras ? `${blueskyExtras.attachmentsHtml || ''}${blueskyExtras.quoteHtml || ''}` : ''}
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
    let domain = '';
    try {
        domain = new URL(item.url).hostname.toLowerCase();
    } catch (error) {
        domain = '';
    }

    const temp = item.body ? document.createElement('div') : null;
    if (temp) {
        temp.innerHTML = item.body;
    }

    const lemmyVideo = isLemmySource(domain, item.feedTitle, item.url) ? extractLemmyVideo(temp) : null;
    if (lemmyVideo) {
        return lemmyVideo;
    }

    const videoResult = findEmbeddableVideoUrl(item, temp);
    if (videoResult && videoResult.embedUrl && !/tiktok\.com/.test(videoResult.embedUrl)) {
        // Convert embed URL back to watch URL for click-to-open
        const baseWatchUrl = videoResult.originalUrl || videoResult.embedUrl.replace('/embed/', '/watch?v=');
        const watchUrl = addInvidiousPlaybackSpeed(baseWatchUrl);

        // Try to extract video ID and generate YouTube thumbnail
        let thumbnailSrc = null;
        const videoIdMatch = videoResult.embedUrl.match(/\/embed\/([^?]+)/);
        if (videoIdMatch && videoIdMatch[1]) {
            // Use YouTube's thumbnail service (works for both YouTube and Invidious)
            thumbnailSrc = `https://img.youtube.com/vi/${videoIdMatch[1]}/hqdefault.jpg`;
        }

        // Fallback: try to find thumbnail in feed body
        if (!thumbnailSrc) {
            const image = temp?.querySelector('img');
            thumbnailSrc = image ? (image.getAttribute('src') || image.getAttribute('data-src')) : null;
        }

        const backgroundStyle = thumbnailSrc
            ? `background: linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.6)), url('${escapeHtml(thumbnailSrc)}') center/cover;`
            : `background: rgba(74, 158, 255, 0.1);`;

        return {
            variant: 'link',
            markup: `
                <div class="feed-video-responsive">
                    <a href="${escapeHtml(watchUrl)}" class="feed-video-link feed-video-link--mobile" style="display: flex; align-items: center; justify-content: center; text-align: center; min-height: 200px; padding: 2rem; ${backgroundStyle} border-radius: 12px; text-decoration: none; transition: all 0.2s ease; position: relative; overflow: hidden;">
                        <img src="icons/play.svg" alt="Play" class="feed-video-play-icon">
                    </a>
                    <div class="feed-video-embed" data-embed-src="${escapeHtml(videoResult.embedUrl)}"></div>
                </div>
            `
        };
    }

    const image = temp?.querySelector('img');
    const tiktokThumbnail = extractTikTokThumbnail(image);

    if (tiktokThumbnail) {
        const src = tiktokThumbnail.getAttribute('src') || tiktokThumbnail.getAttribute('data-src');
        if (src) {
            return {
                variant: 'link',
                markup: `<a href="${escapeHtml(item.url || '')}" class="feed-image-link">
                            <img src="${escapeHtml(src)}" alt="${escapeHtml(tiktokThumbnail.getAttribute('alt') || '')}" loading="lazy">
                         </a>`
            };
        }
    }

    if (item.enclosureLink && item.enclosureMime && item.enclosureMime.startsWith('image/')) {
        return {
            variant: 'image',
            markup: `<a href="${escapeHtml(item.url || '')}" class="feed-image-link">
                        <img src="${escapeHtml(item.enclosureLink)}" alt="" loading="lazy">
                     </a>`
        };
    }

    if (image) {
        const src = image.getAttribute('src') || image.getAttribute('data-src');
        if (src && !isTikTokCdn(src)) {
            return {
                variant: 'image',
                markup: `<a href="${escapeHtml(item.url || '')}" class="feed-image-link">
                            <img src="${escapeHtml(src)}" alt="${escapeHtml(image.getAttribute('alt') || '')}" loading="lazy">
                         </a>`
            };
        }
    }

    const video = temp?.querySelector('video, iframe');
    if (video) {
        const src = video.getAttribute('src');
        if (src && !/tiktok\.com/.test(src)) {
            return {
                variant: 'link',
                markup: `<a href="${escapeHtml(src)}" class="feed-media-link">View media</a>`
            };
        }
    }

    return null;
}

function findEmbeddableVideoUrl(item, tempNode) {
    const candidates = [];
    const pushCandidate = (value) => {
        if (!value) return;
        candidates.push(value);
    };

    pushCandidate(item?.url);
    pushCandidate(item?.enclosureLink);

    if (tempNode) {
        tempNode.querySelectorAll('iframe, video').forEach(el => {
            pushCandidate(el.getAttribute('src'));
        });
        tempNode.querySelectorAll('a[href]').forEach(el => {
            pushCandidate(el.getAttribute('href'));
        });
    }

    for (const raw of candidates) {
        const embedUrl = convertUrlToEmbed(raw);
        if (embedUrl) {
            return {
                originalUrl: raw,
                embedUrl: embedUrl
            };
        }
    }
    return null;
}

function convertUrlToEmbed(rawUrl) {
    if (!rawUrl) return null;
    const decoded = decodeHtmlEntities(String(rawUrl).trim());
    if (!decoded) return null;

    let parsed;
    try {
        parsed = new URL(decoded);
    } catch (error) {
        return null;
    }

    const host = parsed.hostname.toLowerCase();
    const origin = parsed.origin;
    const pathname = parsed.pathname;

    if (host === 'youtu.be') {
        const id = pathname.split('/').filter(Boolean)[0];
        return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (host.endsWith('youtube.com')) {
        if (pathname.startsWith('/embed/')) {
            return `${origin}${pathname}${parsed.search}`;
        }
        const shortsMatch = pathname.startsWith('/shorts/') ? pathname.split('/').filter(Boolean)[1] : null;
        const videoId = parsed.searchParams.get('v') || shortsMatch;
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (isInvidiousHost(host)) {
        if (pathname.startsWith('/embed/')) {
            return addInvidiousPlaybackSpeed(`${origin}${pathname}${parsed.search}`);
        }
        const videoId = parsed.searchParams.get('v');
        return videoId ? addInvidiousPlaybackSpeed(`${origin}/embed/${videoId}`) : null;
    }

    if (host.endsWith('tiktok.com')) {
        const videoId = extractTikTokVideoId(pathname);
        if (videoId) {
            const params = new URLSearchParams(parsed.search);
            if (!params.has('loop')) params.set('loop', '1');
            if (!params.has('controls')) params.set('controls', '1');
            params.set('speed', '1.75');
            return `https://www.tiktok.com/embed/${videoId}?${params.toString()}`;
        }
    }

    return null;
}

function addInvidiousPlaybackSpeed(urlString) {
    try {
        const url = new URL(urlString);
        if (!isInvidiousHost(url.hostname)) {
            return urlString;
        }
        url.searchParams.set('speed', '1.75');
        return url.toString();
    } catch (error) {
        console.warn('Unable to set Invidious playback speed for', urlString, error);
        return urlString;
    }
}

function extractTikTokVideoId(pathname) {
    const parts = pathname.split('/').filter(Boolean);
    const videoIndex = parts.findIndex((segment) => segment === 'video');
    if (videoIndex !== -1 && parts[videoIndex + 1]) {
        return parts[videoIndex + 1];
    }
    const lastSegment = parts[parts.length - 1];
    if (lastSegment && /^[0-9A-Za-z_-]+$/.test(lastSegment)) {
        return lastSegment;
    }
    return null;
}

function extractTikTokThumbnail(imageNode) {
    if (!imageNode) return null;
    const src = imageNode.getAttribute('src') || imageNode.getAttribute('data-src');
    if (!src) return null;
    return isTikTokCdn(src) ? imageNode : null;
}

function isTikTokCdn(url) {
    return /tiktokcdn\.com|p\d+-sign/.test(url);
}

function buildMediaClassList(media) {
    const classes = ['feed-media'];
    if (media.variant) classes.push(`feed-media--${media.variant}`);
    if (media.extraClass) classes.push(media.extraClass);
    return classes.join(' ');
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

function attachStarToggleHandlers() {
    document.querySelectorAll('.feed-star-btn').forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = 'true';
        btn.addEventListener('click', async (event) => {
            event.stopPropagation();
            const itemId = parseInt(btn.dataset.itemId, 10);
            if (Number.isNaN(itemId)) return;
            const shouldStar = !btn.classList.contains('is-starred');
            try {
                await updateItemStar(itemId, shouldStar, btn);
            } catch (error) {
                console.error('Star toggle error:', error);
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
            STATE.feedOffset = 0;
            STATE.feedHasMore = true;
            loadNextcloudFeed(STATE.selectedFolder);
        });
    });
}

function attachTimerControlHandlers() {
    const timerPanel = document.querySelector('.timer-panel');
    if (timerPanel && !timerPanel.dataset.bound) {
        timerPanel.dataset.bound = 'true';
        timerPanel.addEventListener('click', handleTimerPanelAction);
        timerPanel.addEventListener('change', handleTimerPanelChange);
        timerPanel.addEventListener('input', handleTimerPanelInput);
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

    requestTimerDraftUIUpdate();
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
            const isStarred = btn.dataset.folderStarred === 'true';
            if (isStarred) {
                if (STATE.showStarredOnly) return;
                STATE.showStarredOnly = true;
                STATE.selectedFolder = null;
                STATE.feedViewFilter = 'all';
            } else {
                const folderId = btn.dataset.folderId;
                STATE.showStarredOnly = false;
                STATE.selectedFolder = folderId === 'null' ? null : parseInt(folderId);
            }
            STATE.feedOffset = 0;
            STATE.feedHasMore = true;
            loadNextcloudFeed(STATE.selectedFolder);
        });
    });
}

async function updateItemStar(itemId, shouldStar, button) {
    if (!CONFIG.NEXTCLOUD_URL || CONFIG.NEXTCLOUD_USER === 'YOUR_USERNAME') return;
    if (!Number.isInteger(itemId)) return;
    if (STATE.pendingStarToggles.has(itemId)) return;

    STATE.pendingStarToggles.add(itemId);
    setStarButtonState(button, shouldStar);
    updateLocalItemStar(itemId, shouldStar);
    if (button) button.disabled = true;

    try {
        const auth = btoa(`${CONFIG.NEXTCLOUD_USER}:${CONFIG.NEXTCLOUD_PASS}`);
        const endpoint = shouldStar ? 'star' : 'unstar';
        const response = await fetch(`${CONFIG.NEXTCLOUD_URL}/index.php/apps/news/api/v1-3/items/${itemId}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        });
        if (!response.ok) throw new Error('Failed to update star status');

        if (STATE.showStarredOnly && !shouldStar) {
            STATE.latestItems = STATE.latestItems.filter(item => item.id !== itemId);
            displayFeed();
        }
    } catch (error) {
        console.error('Star update error:', error);
        setStarButtonState(button, !shouldStar);
        updateLocalItemStar(itemId, !shouldStar);
    } finally {
        if (button) button.disabled = false;
        STATE.pendingStarToggles.delete(itemId);
    }
}

function setStarButtonState(button, shouldStar) {
    if (!button) return;
    button.classList.toggle('is-starred', shouldStar);
    button.setAttribute('aria-pressed', shouldStar);
    button.title = shouldStar ? 'Unstar item' : 'Star item';
    const img = button.querySelector('img');
    if (img) {
        img.src = `icons/${shouldStar ? 'starred' : 'unstarred'}.png`;
        img.alt = shouldStar ? 'starred' : 'unstarred';
    }
}

function updateLocalItemStar(itemId, shouldStar) {
    const targetItem = STATE.latestItems.find(item => item.id === itemId);
    if (targetItem) {
        targetItem.starred = shouldStar;
    }
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
        STATE.appLinksMarkup = '<div style="padding:1rem; color:#888;">No app links configured</div>';
        if (DOM.dock) {
            DOM.dock.innerHTML = STATE.appLinksMarkup;
        }
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
    STATE.appLinksMarkup = `<div class="app-links-horizontal">${linksHTML}</div>`;
    if (DOM.dock) {
        DOM.dock.innerHTML = STATE.appLinksMarkup;
    }
}

function showDefaultDock() {
    if (!DOM.dock) return;
    if (STATE.appLinksMarkup) {
        DOM.dock.innerHTML = STATE.appLinksMarkup;
    } else if (STATE.appLinks && STATE.appLinks.length > 0) {
        displayAppLinks();
    } else {
        DOM.dock.innerHTML = '<div style="padding:1rem; color:#888;">No app links configured</div>';
    }
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

    renderJellyfinHomeContent(treeHTML);
}

function buildJellyfinQuickPanel() {
    const buttons = JELLYFIN_QUICK_ACTIONS.map(action => `
        <button class="jellyfin-quick-button"
                data-jellyfin-action="${action.action}"
                title="${escapeHtml(action.label)}"
                aria-label="${escapeHtml(action.label)}">
            ${action.emoji}
        </button>
    `).join('');
    return `<div class="jellyfin-quick-panel">${buttons}</div>`;
}

function renderJellyfinHomeContent(mainContentHtml, options = {}) {
    const showBackButton = options.showBackButton || false;
    const quickPanelHTML = buildJellyfinQuickPanel();
    const backButtonHTML = showBackButton ? `
        <button class="jellyfin-back-button" onclick="displayBookmarksTree()">
            ← Back to Bookmarks
        </button>
    ` : '';
    DOM.text.innerHTML = `
        <div class="jellyfin-home-panels">
            ${quickPanelHTML}
            <div class="jellyfin-home-main">
                ${backButtonHTML}
                ${mainContentHtml}
            </div>
        </div>
    `;
    setupJellyfinQuickActions();
}

function setupJellyfinQuickActions() {
    const panel = DOM.text.querySelector('.jellyfin-quick-panel');
    if (!panel) return;
    panel.querySelectorAll('[data-jellyfin-action]').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.dataset.jellyfinAction;
            handleJellyfinQuickAction(action);
        });
    });
}

function handleJellyfinQuickAction(action) {
    switch (action) {
        case 'albums':
            showJellyfinAlbumList();
            break;
        case 'artists':
            showJellyfinArtistList();
            break;
        case 'playlists':
            showJellyfinPlaylistList();
            break;
        case 'favorites':
            shuffleJellyfinFavorites(); // Changed to shuffle instead of showing list
            break;
        case 'shuffle':
            shuffleAllJellyfinMusic();
            break;
        case 'classic-channel':
            playJellyfinChannel('classic');
            break;
        case 'humor-channel':
            playJellyfinChannel('humor');
            break;
        case 'movies':
            showJellyfinMovieList();
            break;
        case 'tv':
            showJellyfinTvList();
            break;
        default:
            console.warn('[Jellyfin] Unknown quick action:', action);
    }
}

function renderJellyfinLibraryLoading(title) {
    renderJellyfinHomeContent(`
        <div class="jellyfin-library-panel">
            <div class="jellyfin-library-panel-header">
                <button class="jellyfin-control-button" data-action="jellyfin-library-home">← Bookmarks</button>
                <h2>${escapeHtml(title)}</h2>
            </div>
            <p>Loading…</p>
        </div>
    `);
    const backBtn = DOM.text.querySelector('[data-action="jellyfin-library-home"]');
    if (backBtn) {
        backBtn.addEventListener('click', displayBookmarksTree);
    }
}

function renderJellyfinLibraryCards(title, items, { emptyMessage = 'No items found', onSelect, subtitleExtractor } = {}) {
    if (!items || items.length === 0) {
        renderJellyfinHomeContent(`
            <div class="jellyfin-library-panel">
                <div class="jellyfin-library-panel-header">
                    <button class="jellyfin-control-button" data-action="jellyfin-library-home">← Bookmarks</button>
                    <h2>${escapeHtml(title)}</h2>
                </div>
                <p>${escapeHtml(emptyMessage)}</p>
            </div>
        `);
        const backBtn = DOM.text.querySelector('[data-action="jellyfin-library-home"]');
        if (backBtn) backBtn.addEventListener('click', displayBookmarksTree);
        return;
    }

    const cardsHTML = items.map((item, index) => {
        const imageUrl = getJellyfinImageUrl(item.Id, { maxWidth: 300 });
        const subtitle = subtitleExtractor ? subtitleExtractor(item) : '';
        return `
            <button class="jellyfin-library-card" data-library-index="${index}">
                <img src="${imageUrl}" alt="${escapeHtml(item.Name || item.Title || '')}" onerror="this.style.visibility='hidden'">
                <span>${escapeHtml(item.Name || item.Title || 'Untitled')}</span>
                ${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ''}
            </button>
        `;
    }).join('');

    const content = `
        <div class="jellyfin-library-panel">
            <div class="jellyfin-library-panel-header">
                <button class="jellyfin-control-button" data-action="jellyfin-library-home">← Bookmarks</button>
                <h2>${escapeHtml(title)}</h2>
            </div>
            <div class="jellyfin-library-grid">
                ${cardsHTML}
            </div>
        </div>
    `;

    renderJellyfinHomeContent(content);

    const panel = DOM.text.querySelector('.jellyfin-library-panel');
    if (!panel) return;
    const backBtn = panel.querySelector('[data-action="jellyfin-library-home"]');
    if (backBtn) {
        backBtn.addEventListener('click', displayBookmarksTree);
    }
    if (typeof onSelect === 'function') {
        panel.querySelectorAll('[data-library-index]').forEach(card => {
            const index = Number(card.dataset.libraryIndex);
            card.addEventListener('click', () => {
                onSelect(items[index]);
            });
        });
    }
}

function renderJellyfinTrackList(title, tracks, { emptyMessage = 'No tracks found', onSelect } = {}) {
    if (!tracks || tracks.length === 0) {
        renderJellyfinHomeContent(`
            <div class="jellyfin-library-panel">
                <div class="jellyfin-library-panel-header">
                    <button class="jellyfin-control-button" data-action="jellyfin-library-home">← Bookmarks</button>
                    <h2>${escapeHtml(title)}</h2>
                </div>
                <p>${escapeHtml(emptyMessage)}</p>
            </div>
        `);
        const backBtn = DOM.text.querySelector('[data-action="jellyfin-library-home"]');
        if (backBtn) backBtn.addEventListener('click', displayBookmarksTree);
        return;
    }

    const rows = tracks.map((track, index) => {
        const artist = track.Artists && track.Artists.length ? track.Artists.join(', ') : track.AlbumArtist || '';
        const album = track.Album || '';
        return `
            <button class="jellyfin-control-button jellyfin-library-track" data-library-index="${index}">
                <span>
                    <strong>${escapeHtml(track.Name || track.Title || 'Untitled')}</strong>
                    ${artist ? `<div class="jellyfin-tv-episode-meta">${escapeHtml(artist)}</div>` : ''}
                </span>
                ${album ? `<span class="jellyfin-tv-episode-meta">${escapeHtml(album)}</span>` : ''}
            </button>
        `;
    }).join('');

    renderJellyfinHomeContent(`
        <div class="jellyfin-library-panel">
            <div class="jellyfin-library-panel-header">
                <button class="jellyfin-control-button" data-action="jellyfin-library-home">← Bookmarks</button>
                <h2>${escapeHtml(title)}</h2>
            </div>
            <div class="jellyfin-library-list">
                ${rows}
            </div>
        </div>
    `);

    const panel = DOM.text.querySelector('.jellyfin-library-panel');
    if (!panel) return;
    const backBtn = panel.querySelector('[data-action="jellyfin-library-home"]');
    if (backBtn) backBtn.addEventListener('click', displayBookmarksTree);
    if (typeof onSelect === 'function') {
        panel.querySelectorAll('[data-library-index]').forEach(row => {
            const idx = Number(row.dataset.libraryIndex);
            row.addEventListener('click', () => onSelect(tracks[idx]));
        });
    }
}

async function showJellyfinMovieList() {
    try {
        renderJellyfinLibraryLoading('Movies');
        const params = new URLSearchParams({
            IncludeItemTypes: 'Movie',
            Recursive: 'true',
            SortBy: 'ProductionYear,SortName',
            Fields: 'Overview,ProductionYear',
            Limit: '200'
        });
        const movies = await fetchJellyfinItemsFromParams(params);
        renderJellyfinLibraryCards('Movies', movies, {
            emptyMessage: 'No movies found',
            onSelect: movie => {
                playJellyfinVideo({
                    type: 'jellyfin',
                    jellyfinType: 'Movie',
                    jellyfinId: movie.Id,
                    title: movie.Name,
                    description: movie.Overview || ''
                });
            },
            subtitleExtractor: movie => movie.ProductionYear ? `${movie.ProductionYear}` : ''
        });
    } catch (error) {
        console.error('[Jellyfin] Unable to load movies:', error);
        renderJellyfinHomeContent(`<div class="jellyfin-library-panel"><p>Failed to load movies.</p></div>`);
    }
}

async function showJellyfinTvList() {
    try {
        renderJellyfinLibraryLoading('TV Shows');
        const params = new URLSearchParams({
            IncludeItemTypes: 'Series',
            Recursive: 'true',
            SortBy: 'SortName',
            Fields: 'Overview,ProductionYear',
            Limit: '200'
        });
        const shows = await fetchJellyfinItemsFromParams(params);
        renderJellyfinLibraryCards('TV Shows', shows, {
            emptyMessage: 'No TV shows found',
            onSelect: show => displayJellyfinTvShow(show),
            subtitleExtractor: show => show.ProductionYear ? `${show.ProductionYear}` : ''
        });
    } catch (error) {
        console.error('[Jellyfin] Unable to load TV shows:', error);
        renderJellyfinHomeContent(`<div class="jellyfin-library-panel"><p>Failed to load TV shows.</p></div>`);
    }
}

async function displayJellyfinTvShow(show) {
    renderJellyfinLibraryLoading(show.Name || 'TV Show');
    try {
        const showData = await fetchJellyfinShowData(show.Id);
        const viewHTML = buildTvShowPanelHTML(show, showData.seasons, showData.nextUpEpisode, { includeBackButton: true });
        renderJellyfinHomeContent(viewHTML);
        const panel = DOM.text.querySelector('.jellyfin-tv-panel');
        if (panel) {
            setupTvPanelInteractions(panel, show, { onBack: displayBookmarksTree });
        }
    } catch (error) {
        console.error('[Jellyfin] Unable to show TV series:', error);
        renderJellyfinHomeContent(`<div class="jellyfin-library-panel"><p>Unable to load TV series.</p></div>`);
    }
}

async function fetchJellyfinShowData(showId) {
    const seasonsResponse = await fetch(`${CONFIG.JELLYFIN_SERVER}/Items?ParentId=${showId}&IncludeItemTypes=Season&SortBy=SortName&Fields=ChildCount&api_key=${CONFIG.JELLYFIN_API_KEY}`);
    if (!seasonsResponse.ok) {
        throw new Error(`Failed to load seasons (${seasonsResponse.status})`);
    }
    const seasonsData = await seasonsResponse.json();
    const seasons = Array.isArray(seasonsData.Items) ? seasonsData.Items : [];
    let nextUpEpisode = null;
    if (hasJellyfinUserId()) {
        try {
            const nextResponse = await fetch(`${CONFIG.JELLYFIN_SERVER}/Users/${CONFIG.JELLYFIN_USER_ID}/NextUp?SeriesId=${showId}&Limit=1&api_key=${CONFIG.JELLYFIN_API_KEY}`);
            if (nextResponse.ok) {
                const nextData = await nextResponse.json();
                nextUpEpisode = Array.isArray(nextData.Items) ? nextData.Items[0] : null;
            }
        } catch (error) {
            console.warn('[Jellyfin] Next up request failed', error);
        }
    }
    return { seasons, nextUpEpisode };
}

function buildTvShowPanelHTML(show, seasons, nextUpEpisode, { includeBackButton }) {
    const resumeButtonHTML = nextUpEpisode
        ? `<button class="jellyfin-control-button" data-action="tv-resume" data-episode-id="${nextUpEpisode.Id}">
                Resume ${formatJellyfinEpisodeLabel(nextUpEpisode) || ''}
           </button>`
        : '';

    const seasonsHTML = seasons.length
        ? seasons.map(season => `
            <button class="jellyfin-control-button" data-season-id="${season.Id}">
                ${escapeHtml(season.Name || `Season ${season.IndexNumber ?? ''}`)}
            </button>
        `).join('')
        : '<p>No seasons found.</p>';

    const backButtonHTML = includeBackButton
        ? `<button class="jellyfin-control-button" data-action="jellyfin-library-home">← Bookmarks</button>`
        : '';

    return `
        <div class="jellyfin-library-panel jellyfin-tv-panel" data-tv-show-id="${show.Id}">
            <div class="jellyfin-library-panel-header">
                ${backButtonHTML}
                <h2>${escapeHtml(show.Name || '')}</h2>
            </div>
            ${show.Overview ? `<p class="jellyfin-tv-overview">${escapeHtml(show.Overview)}</p>` : ''}
            ${resumeButtonHTML}
            <div class="jellyfin-tv-seasons">
                ${seasonsHTML}
            </div>
            <div class="jellyfin-tv-episodes" data-tv-episodes>
                <p>Select a season to view episodes.</p>
            </div>
        </div>
    `;
}

function setupTvPanelInteractions(panel, show, { onBack } = {}) {
    const backBtn = panel.querySelector('[data-action="jellyfin-library-home"]');
    if (backBtn && typeof onBack === 'function') {
        backBtn.addEventListener('click', onBack);
    }
    const resumeBtn = panel.querySelector('[data-action="tv-resume"]');
    if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
            const episodeId = resumeBtn.dataset.episodeId;
            if (episodeId) {
                playJellyfinVideo({
                    type: 'jellyfin',
                    jellyfinType: 'Episode',
                    jellyfinId: episodeId,
                    title: `${show.Name} • Resume`
                });
            }
        });
    }
    panel.querySelectorAll('[data-season-id]').forEach(button => {
        button.addEventListener('click', () => {
            loadJellyfinSeasonEpisodesIntoPanel(panel, show, button.dataset.seasonId);
        });
    });
}

async function loadJellyfinSeasonEpisodesIntoPanel(panel, show, seasonId) {
    const episodesContainer = panel.querySelector('[data-tv-episodes]');
    if (!episodesContainer) return;
    episodesContainer.innerHTML = '<p>Loading episodes...</p>';

    try {
        const response = await fetch(`${CONFIG.JELLYFIN_SERVER}/Items?ParentId=${seasonId}&IncludeItemTypes=Episode&SortBy=IndexNumber&Fields=Overview,UserData&api_key=${CONFIG.JELLYFIN_API_KEY}`);
        if (!response.ok) {
            throw new Error(`Failed to load episodes (${response.status})`);
        }
        const data = await response.json();
        const episodes = Array.isArray(data.Items) ? data.Items : [];
        if (!episodes.length) {
            episodesContainer.innerHTML = '<p>No episodes available.</p>';
            return;
        }
        episodesContainer.innerHTML = episodes.map(episode => `
            <button class="jellyfin-control-button" data-episode-id="${episode.Id}">
                ${formatJellyfinEpisodeLabel(episode) || ''} ${escapeHtml(episode.Name || '')}
                <div class="jellyfin-tv-episode-meta">${escapeHtml(episode.Overview || '')}</div>
            </button>
        `).join('');
        episodesContainer.querySelectorAll('[data-episode-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const episodeId = btn.dataset.episodeId;
                playJellyfinVideo({
                    type: 'jellyfin',
                    jellyfinType: 'Episode',
                    jellyfinId: episodeId,
                    title: `${show.Name} • ${btn.textContent.replace(/\s+/, ' ').trim()}`,
                    description: ''
                });
            });
        });
    } catch (error) {
        console.error('[Jellyfin] Unable to load season episodes:', error);
        episodesContainer.innerHTML = '<p>Failed to load episodes.</p>';
    }
}
async function showJellyfinAlbumList() {
    try {
        renderJellyfinLibraryLoading('Albums');
        const params = new URLSearchParams({
            IncludeItemTypes: 'MusicAlbum',
            Recursive: 'true',
            SortBy: 'SortName',
            Fields: 'PrimaryImageAspectRatio,ProductionYear',
            Limit: '200'
        });
        const albums = await fetchJellyfinItemsFromParams(params);
        renderJellyfinLibraryCards('Albums', albums, {
            emptyMessage: 'No albums found',
            onSelect: album => {
                displayJellyfinAlbum({
                    type: 'jellyfin',
                    jellyfinType: 'MusicAlbum',
                    jellyfinId: album.Id,
                    title: album.Name,
                    description: album.Overview || album.Taglines?.[0] || ''
                });
            },
            subtitleExtractor: album => album.ProductionYear ? `${album.ProductionYear}` : ''
        });
    } catch (error) {
        console.error('[Jellyfin] Unable to load albums:', error);
        renderJellyfinHomeContent(`<div class="jellyfin-library-panel"><p>Failed to load albums.</p></div>`);
    }
}

async function showJellyfinArtistList() {
    try {
        renderJellyfinLibraryLoading('Artists');
        const params = new URLSearchParams({
            IncludeItemTypes: 'MusicArtist',
            Recursive: 'true',
            SortBy: 'SortName',
            Fields: 'PrimaryImageAspectRatio',
            Limit: '200'
        });
        const artists = await fetchJellyfinItemsFromParams(params);
        renderJellyfinLibraryCards('Artists', artists, {
            emptyMessage: 'No artists found',
            onSelect: artist => {
                displayJellyfinArtist({
                    type: 'jellyfin',
                    jellyfinType: 'MusicArtist',
                    jellyfinId: artist.Id,
                    title: artist.Name,
                    description: artist.Overview || ''
                });
            }
        });
    } catch (error) {
        console.error('[Jellyfin] Unable to load artists:', error);
        renderJellyfinHomeContent(`<div class="jellyfin-library-panel"><p>Failed to load artists.</p></div>`);
    }
}

async function showJellyfinPlaylistList() {
    try {
        renderJellyfinLibraryLoading('Playlists');
        const params = new URLSearchParams({
            IncludeItemTypes: 'Playlist',
            SortBy: 'SortName',
            Fields: 'ItemCounts',
            Limit: '200'
        });
        const playlists = await fetchJellyfinItemsFromParams(params);
        renderJellyfinLibraryCards('Playlists', playlists, {
            emptyMessage: 'No playlists found',
            onSelect: playlist => {
                displayJellyfinAlbum({
                    type: 'jellyfin',
                    jellyfinType: 'Playlist',
                    jellyfinId: playlist.Id,
                    title: playlist.Name,
                    description: playlist.Overview || ''
                });
            },
            subtitleExtractor: playlist => playlist.ChildCount ? `${playlist.ChildCount} items` : ''
        });
    } catch (error) {
        console.error('[Jellyfin] Unable to load playlists:', error);
        renderJellyfinHomeContent(`<div class="jellyfin-library-panel"><p>Failed to load playlists.</p></div>`);
    }
}

async function showJellyfinFavoriteTracks() {
    if (!hasJellyfinUserId()) {
        renderJellyfinHomeContent(`
            <div class="jellyfin-library-panel">
                <p>Set JELLYFIN_USER_ID in script.js to view favorite tracks.</p>
            </div>
        `);
        return;
    }
    try {
        renderJellyfinLibraryLoading('Favorite Tracks');
        const params = new URLSearchParams({
            IncludeItemTypes: 'Audio',
            Recursive: 'true',
            Filters: 'IsFavorite',
            SortBy: 'SortName',
            Fields: 'Album,Artists',
            Limit: '200',
            UserId: CONFIG.JELLYFIN_USER_ID
        });
        const favoriteTracks = await fetchJellyfinItemsFromParams(params);
        renderJellyfinTrackList('Favorite Tracks', favoriteTracks, {
            emptyMessage: 'No favorite tracks found',
            onSelect: track => {
                playJellyfinAudio({
                    type: 'jellyfin',
                    jellyfinType: 'Audio',
                    jellyfinId: track.Id,
                    title: track.Name,
                    description: track.Album || ''
                });
            }
        });
    } catch (error) {
        console.error('[Jellyfin] Unable to load favorites:', error);
        renderJellyfinHomeContent(`<div class="jellyfin-library-panel"><p>Failed to load favorite tracks.</p></div>`);
    }
}

async function shuffleAllJellyfinMusic() {
    try {
        showJellyfinStatus('Loading random tracks...');
        const tracks = await fetchRandomJellyfinTracks({ limit: 40 });
        if (!tracks.length) {
            showJellyfinStatus('No tracks available', 'error');
            return;
        }
        const queue = tracks.map(track => ({
            ...track,
            jellyfinType: 'Audio',
            album: track.Album || '',
            albumId: track.AlbumId || track.ParentId || track.Id,
            description: track.Album || ''
        }));

        // Mount player in text zone with back button
        const playerHTML = '<div id="jellyfin-shuffle-player" data-embed-player></div>';
        renderJellyfinHomeContent(playerHTML, { showBackButton: true });

        playJellyfinAudio(queue[0], {
            queue,
            startIndex: 0,
            context: 'shuffle-all',
            mountSelector: '#jellyfin-shuffle-player'
        });
    } catch (error) {
        console.error('[Jellyfin] Unable to shuffle library:', error);
        showJellyfinStatus('Unable to shuffle library', 'error');
    }
}

async function playJellyfinChannel(channelKey) {
    let searchName = '';
    let title = '';
    if (channelKey === 'classic') {
        searchName = 'classic';
        title = 'Classic Movies';
    } else if (channelKey === 'humor') {
        searchName = 'humor';
        title = 'Humor Hub';
    }

    try {
        showJellyfinStatus(`Looking for ${title} channel...`);

        // Search for channels matching the name
        const params = new URLSearchParams({
            searchTerm: searchName,
            IncludeItemTypes: 'TvChannel,Video,Movie,Episode',
            Recursive: 'true',
            Limit: '10'
        });

        const results = await fetchJellyfinItemsFromParams(params);

        if (!results || results.length === 0) {
            showJellyfinStatus(`No channels found matching "${searchName}"`, 'error');
            return;
        }

        // Use the first result
        const channel = results[0];
        playJellyfinVideo({
            type: 'jellyfin',
            jellyfinType: channel.Type || 'Video',
            jellyfinId: channel.Id,
            title: channel.Name || title,
            description: channel.Overview || `${title} Channel`
        });
    } catch (error) {
        console.error('[Jellyfin] Channel lookup failed:', error);
        showJellyfinStatus('Unable to find channel', 'error');
    }
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
            // All folders start collapsed for cleaner overview
            return `
                <details class="bookmark-folder">
                    <summary class="bookmark-summary">
                        <span class="folder-name">${escapeHtml(item.name)}</span>
                        <img class="folder-icon" src="icons/folder.webp" alt="" />
                    </summary>
                    <div class="bookmark-children">
                        ${buildBookmarkTree(item.children, level + 1)}
                    </div>
                </details>
            `;
        } else {
            // Extract domain for fresh favicon, ignore embedded data URIs
            let domain = '';
            try {
                const url = new URL(item.url);
                domain = url.hostname;
            } catch (e) {
                domain = '';
            }

            const iconSrc = domain
                ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
                : FALLBACK_FAVICON;

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
        </div>
    `;
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

    // Check if Jellyfin content is active
    const hasJellyfinContent = DOM.text && DOM.text.dataset.jellyfinActive === 'true';

    if (hasJellyfinContent) {
        // Keep Jellyfin player active, only restore home UI
        console.log('[Search] Keeping Jellyfin player active');
        updateClock();
        displayAppLinks();
        loadNextcloudFeed();
        showHomeModeUI();
    } else {
        // Normal restore
        loadHomeMode();
    }
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
            </div>
        `;
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
    DOM.overview.innerHTML = '<div class="loading-message">Searching...</div>';

    // Update URL with search query
    updateURL({ q: query });

    try {
        // Fetch suggestions from all sources in parallel
        const [wikiResults, bookmarkResults, traktResults, jellyfinResults] = await Promise.all([
            searchWikipedia(query),
            searchBookmarks(query),
            searchTrakt(query),
            searchJellyfin(query)
        ]);

        STATE.currentSuggestions = [
            ...bookmarkResults,
            ...jellyfinResults,
            ...wikiResults,
            ...traktResults
        ];

        displaySuggestions(STATE.currentSuggestions, DOM.overview);
    } catch (error) {
        console.error('Search error:', error);
        DOM.overview.innerHTML = '<div class="error-message">Search failed</div>';
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

async function searchJellyfin(query) {
    if (!CONFIG.JELLYFIN_SERVER || !CONFIG.JELLYFIN_API_KEY) {
        console.log('[Jellyfin] Server or API key not configured, skipping search');
        return [];
    }

    try {
        const url = `${CONFIG.JELLYFIN_SERVER}/Items?searchTerm=${encodeURIComponent(query)}&Recursive=true&Limit=${CONFIG.SUGGESTION_LIMIT.jellyfin}&IncludeItemTypes=Movie,Series,Episode,Audio,MusicAlbum,MusicArtist,Playlist,Book,AudioBook,TvChannel`;
        const response = await fetch(url, {
            headers: {
                'X-Emby-Token': CONFIG.JELLYFIN_API_KEY
            }
        });

        if (!response.ok) {
            console.error('[Jellyfin] Search failed:', response.status, response.statusText);
            return [];
        }

        const data = await response.json();

        return data.Items.map(item => {
            // Determine media type for description
            let typeLabel = item.Type;
            let description = '';

            switch (item.Type) {
                case 'Movie':
                    typeLabel = 'Movie';
                    description = item.ProductionYear ? `Movie (${item.ProductionYear})` : 'Movie';
                    break;
                case 'Series':
                    typeLabel = 'TV Show';
                    description = item.ProductionYear ? `TV Show (${item.ProductionYear})` : 'TV Show';
                    break;
                case 'Episode':
                    typeLabel = 'Episode';
                    description = item.SeriesName
                        ? `${item.SeriesName} - S${item.ParentIndexNumber || '?'}E${item.IndexNumber || '?'}`
                        : 'Episode';
                    break;
                case 'Audio':
                    typeLabel = 'Song';
                    description = item.AlbumArtist || item.Album || 'Song';
                    break;
                case 'MusicAlbum':
                    typeLabel = 'Album';
                    description = item.AlbumArtist || 'Album';
                    break;
                case 'MusicArtist':
                    typeLabel = 'Artist';
                    description = 'Music Artist';
                    break;
                case 'Playlist':
                    typeLabel = 'Playlist';
                    description = `Playlist (${item.ChildCount || 0} items)`;
                    break;
                case 'Book':
                    typeLabel = 'Book';
                    description = 'Book';
                    break;
                case 'AudioBook':
                    typeLabel = 'Audiobook';
                    description = 'Audiobook';
                    break;
                case 'TvChannel':
                    typeLabel = 'Live TV';
                    description = 'Live TV Channel';
                    break;
                default:
                    description = item.Type;
            }

            // Build thumbnail URL
            const thumbnailUrl = item.ImageTags?.Primary
                ? `${CONFIG.JELLYFIN_SERVER}/Items/${item.Id}/Images/Primary?maxHeight=48&maxWidth=48&quality=90&api_key=${CONFIG.JELLYFIN_API_KEY}`
                : null;

            return {
                type: 'jellyfin',
                jellyfinType: item.Type,
                jellyfinId: item.Id,
                title: item.Name,
                description: description,
                typeLabel: typeLabel,
                year: item.ProductionYear,
                seriesName: item.SeriesName,
                albumArtist: item.AlbumArtist,
                album: item.Album,
                serverId: item.ServerId,
                thumbnailUrl: thumbnailUrl,
                icon: typeLabel // Will be used to determine which icon to show
            };
        });
    } catch (error) {
        console.error('[Jellyfin] Search error:', error);
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
        </div>
    `;

    if (!suggestions || suggestions.length === 0) {
        container.innerHTML = quickActionsHTML;
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
        } else if (item.type === 'jellyfin') {
            // Use thumbnail if available, otherwise use jellyfin favicon
            if (item.thumbnailUrl) {
                iconHTML = `<img src="${item.thumbnailUrl}" alt="${item.typeLabel}" style="width:48px; height:48px; flex-shrink:0; border-radius:4px; object-fit:cover;" onerror="this.src='icons/jellyfin.webp'">`;
            } else {
                iconHTML = '<img src="icons/jellyfin.webp" alt="Jellyfin" style="width:24px; height:24px; flex-shrink:0;">';
            }
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
    } else if (item.type === 'jellyfin') {
        loadJellyfinItem(item);
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
            <div class="wiki-toc" style="background:transparent; border:1px solid #888; padding:0.75rem;">
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
        <div class="wiki-article">
            ${tempDiv.innerHTML}
            <p style="margin-top:1rem;">
                <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(article.title)}"
                   target="_blank"
                   style="color:#4a9eff;">
                    Read more on Wikipedia
                </a>
            </p>
        </div>
    `;

    // Display TOC and infobox in overview
    DOM.overview.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1%;">
            <div class="wiki-toc-container">
                ${infoboxImageHTML}
                ${tocHTML || '<p>No table of contents</p>'}
            </div>
            <div class="wiki-infobox-container">${infoboxHTML || '<p>No infobox available</p>'}</div>
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
        showDefaultDock();
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
        showDefaultDock();

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
// JELLYFIN DISPLAY
// ============================================================================

async function loadJellyfinItem(item) {
    console.log('[Jellyfin] Loading item:', item);

    // Route to appropriate handler based on media type
    switch (item.jellyfinType) {
        case 'Movie':
        case 'Episode':
        case 'TvChannel':
            playJellyfinVideo(item);
            break;
        case 'Series':
            displayJellyfinSeries(item);
            break;
        case 'Audio':
        case 'AudioBook':
            playJellyfinAudio(item);
            break;
        case 'MusicAlbum':
        case 'Playlist':
            displayJellyfinAlbum(item);
            break;
        case 'MusicArtist':
            displayJellyfinArtist(item);
            break;
        case 'Book':
            displayJellyfinBook(item);
            break;
        default:
            console.warn('[Jellyfin] Unknown media type:', item.jellyfinType);
            openInJellyfin(item.jellyfinId);
    }
}

const JELLYFIN_MAX_AUDIO_BITRATE = '320000';

function resetJellyfinPlaybackState(overrides = {}) {
    STATE.jellyfinPlayback = {
        ...createJellyfinPlaybackState(),
        ...overrides
    };
}

function getActiveJellyfinTrack() {
    const playback = STATE.jellyfinPlayback;
    if (!playback.queue.length) return null;
    return playback.queue[Math.max(0, playback.currentIndex)] || null;
}

function syncPlaybackFavoriteState() {
    const track = getActiveJellyfinTrack();
    STATE.jellyfinPlayback.isFavorite = Boolean(track?.isFavorite);
}

function normalizeJellyfinTrack(raw, overrides = {}) {
    if (!raw) return null;
    const jellyfinId = overrides.jellyfinId || raw.jellyfinId || raw.Id || raw.id;
    if (!jellyfinId) {
        console.warn('[Jellyfin] Track is missing an ID:', raw);
        return null;
    }
    const albumId = overrides.albumId || raw.albumId || raw.AlbumId || raw.ParentId || null;
    const title = overrides.title || raw.title || raw.Name || 'Untitled Track';
    const album = overrides.album || raw.album || raw.Album || '';
    const artist = overrides.artist
        || (Array.isArray(raw.Artists) ? raw.Artists.join(', ') : '')
        || (Array.isArray(raw.AlbumArtists) ? raw.AlbumArtists.join(', ') : '')
        || raw.Artist
        || raw.AlbumArtist
        || '';
    return {
        jellyfinId,
        title,
        description: overrides.description || raw.description || raw.Overview || album || '',
        album,
        albumId,
        artist,
        runTimeTicks: overrides.runTimeTicks ?? raw.RunTimeTicks ?? null,
        indexNumber: overrides.indexNumber ?? raw.IndexNumber ?? null,
        isFavorite: Boolean(
            overrides.isFavorite
            ?? raw.isFavorite
            ?? raw.IsFavorite
            ?? raw.UserData?.IsFavorite
            ?? raw?.source?.UserData?.IsFavorite
        ),
        source: raw
    };
}

function setJellyfinQueue(tracks, startIndex = 0, context = {}) {
    const normalized = (tracks || [])
        .map(track => normalizeJellyfinTrack(track, context.trackOverrides || {}))
        .filter(Boolean);
    if (!normalized.length) {
        console.warn('[Jellyfin] Unable to set playback queue (no tracks)');
        return;
    }
    const initialIndex = Math.max(0, Math.min(startIndex, normalized.length - 1));
    STATE.jellyfinPlayback.queue = normalized;
    STATE.jellyfinPlayback.currentIndex = initialIndex;
    STATE.jellyfinPlayback.repeatOne = Boolean(context.repeatOne);
    STATE.jellyfinPlayback.context = context.context || 'single';
    STATE.jellyfinPlayback.mountSelector = context.mountSelector || null;
    STATE.jellyfinPlayback.albumId = context.albumId || normalized[initialIndex].albumId || null;
    STATE.jellyfinPlayback.albumTitle = context.albumTitle || '';
    STATE.jellyfinPlayback.sourceItem = context.sourceItem || null;
    syncPlaybackFavoriteState();
}

/**
 * Build a Jellyfin API URL with common parameters
 * @param {string} path - API path (without leading slash)
 * @param {Object} params - Additional URL parameters
 * @returns {string} Complete URL with API key
 */
function buildJellyfinUrl(path, params = {}) {
    const urlParams = new URLSearchParams({
        api_key: CONFIG.JELLYFIN_API_KEY,
        ...params
    });
    return `${CONFIG.JELLYFIN_SERVER}/${path}?${urlParams.toString()}`;
}

function getJellyfinImageUrl(itemId, { maxWidth = 500 } = {}) {
    if (!itemId) return '';
    const params = maxWidth ? { maxWidth } : {};
    return buildJellyfinUrl(`Items/${itemId}/Images/Primary`, params);
}

function buildJellyfinAudioSources(trackId) {
    if (!trackId) return [];
    const basePath = `Audio/${trackId}`;
    const streamParams = {
        static: 'true',
        MaxStreamingBitrate: JELLYFIN_MAX_AUDIO_BITRATE
    };
    const hlsParams = {
        Container: 'opus,webm|opus,mp3,aac,m4a|aac,flac,wav,ogg',
        MaxStreamingBitrate: JELLYFIN_MAX_AUDIO_BITRATE,
        AudioCodec: 'aac',
        TranscodingContainer: 'ts',
        TranscodingProtocol: 'hls'
    };
    return [
        {
            type: 'audio/mpeg',
            url: buildJellyfinUrl(`${basePath}/stream.mp3`, streamParams)
        },
        {
            type: 'audio/aac',
            url: buildJellyfinUrl(`${basePath}/stream.aac`, streamParams)
        },
        {
            type: 'application/x-mpegURL',
            url: buildJellyfinUrl(`${basePath}/universal`, hlsParams)
        }
    ];
}

function buildJellyfinDetailUrl(itemId) {
    if (!itemId) return '#';
    return `${CONFIG.JELLYFIN_SERVER}/web/index.html#!/details?id=${itemId}`;
}

function getPrimaryJellyfinArtist(track) {
    const source = track?.source || {};
    const artistItems = source.ArtistItems || source.AlbumArtistItems || source.AlbumArtistsItems;
    if (Array.isArray(artistItems) && artistItems.length > 0) {
        const first = artistItems[0] || {};
        return {
            name: first.Name || first.name || track.artist || '',
            id: first.Id || first.id || null
        };
    }
    if (Array.isArray(source.AlbumArtists) && source.AlbumArtists.length > 0) {
        return { name: source.AlbumArtists[0], id: null };
    }
    if (Array.isArray(source.Artists) && source.Artists.length > 0) {
        return { name: source.Artists[0], id: null };
    }
    if (track.artist) {
        return { name: track.artist, id: null };
    }
    return null;
}

function formatAudioTimestamp(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return '--:--';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateJellyfinProgressUI(audioEl) {
    if (!audioEl) return;
    const container = getJellyfinPlaybackContainer();
    if (!container) return;
    const timeEl = container.querySelector('[data-jellyfin-time]');
    const fillEl = container.querySelector('[data-jellyfin-progress-fill]');
    const duration = Number.isFinite(audioEl.duration) ? audioEl.duration : NaN;
    const ratio = duration > 0 ? Math.min(Math.max(audioEl.currentTime / duration, 0), 1) : 0;
    if (timeEl) {
        const durationText = Number.isFinite(duration) ? formatAudioTimestamp(duration) : '--:--';
        timeEl.textContent = `${formatAudioTimestamp(audioEl.currentTime)} / ${durationText}`;
    }
    if (fillEl) {
        fillEl.style.width = `${ratio * 100}%`;
    }
}

function updateJellyfinPlayButtonState(container) {
    if (!container) container = getJellyfinPlaybackContainer();
    const playBtn = container ? container.querySelector('[data-action="toggle-play"]') : null;
    const audioEl = getJellyfinAudioElement();
    if (!playBtn || !audioEl) return;
    playBtn.textContent = audioEl.paused ? '▶️' : '⏸️';
}

function toggleJellyfinPlayback() {
    const audioEl = getJellyfinAudioElement();
    if (!audioEl) return;
    if (audioEl.paused) {
        audioEl.play().catch(error => {
            console.warn('[Jellyfin] Unable to start playback:', error);
            showJellyfinStatus('Unable to start playback', 'error');
        });
    } else {
        audioEl.pause();
    }
    updateJellyfinPlayButtonState();
}

function handleJellyfinProgressSeek(event, audioEl) {
    if (!audioEl || !Number.isFinite(audioEl.duration) || audioEl.duration <= 0) {
        return;
    }
    const trackEl = event.currentTarget;
    const rect = trackEl.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    audioEl.currentTime = ratio * audioEl.duration;
    updateJellyfinProgressUI(audioEl);
}

function shuffleCurrentJellyfinQueue() {
    const playback = STATE.jellyfinPlayback;
    if (!playback.queue.length) {
        showJellyfinStatus('Nothing to shuffle', 'error');
        return;
    }
    if (playback.queue.length < 2) {
        showJellyfinStatus('Need more tracks to shuffle', 'error');
        return;
    }
    const shuffled = [...playback.queue];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    playback.queue = shuffled;
    playback.currentIndex = 0;
    syncPlaybackFavoriteState();
    renderJellyfinAudioPlayer();
    showJellyfinStatus('Shuffled current queue');
}

async function autoDetectJellyfinUserId() {
    // Skip if already configured
    if (CONFIG.JELLYFIN_USER_ID && CONFIG.JELLYFIN_USER_ID !== 'YOUR_JELLYFIN_USER_ID') {
        return;
    }

    // Skip if Jellyfin not configured
    if (!CONFIG.JELLYFIN_SERVER || !CONFIG.JELLYFIN_API_KEY || CONFIG.JELLYFIN_API_KEY === 'YOUR_API_KEY') {
        return;
    }

    try {
        const response = await fetch(`${CONFIG.JELLYFIN_SERVER}/Users?api_key=${CONFIG.JELLYFIN_API_KEY}`);
        if (!response.ok) return;

        const users = await response.json();
        if (Array.isArray(users) && users.length > 0) {
            // Use the first user (usually the admin/main user)
            CONFIG.JELLYFIN_USER_ID = users[0].Id;
            console.log('[Jellyfin] Auto-detected user ID:', CONFIG.JELLYFIN_USER_ID);
        }
    } catch (error) {
        console.warn('[Jellyfin] Could not auto-detect user ID:', error);
    }
}

function hasJellyfinUserId() {
    return CONFIG.JELLYFIN_USER_ID && CONFIG.JELLYFIN_USER_ID !== 'YOUR_JELLYFIN_USER_ID';
}

async function fetchJellyfinFavoriteStatus(itemId) {
    if (!hasJellyfinUserId()) return null;
    try {
        const response = await fetch(`${CONFIG.JELLYFIN_SERVER}/Users/${CONFIG.JELLYFIN_USER_ID}/Items/${itemId}?api_key=${CONFIG.JELLYFIN_API_KEY}`);
        if (!response.ok) return null;
        const data = await response.json();
        return Boolean(data?.UserData?.IsFavorite);
    } catch (error) {
        console.warn('[Jellyfin] Unable to fetch favorite status', error);
        return null;
    }
}

async function setJellyfinFavorite(itemId, shouldFavorite) {
    if (!hasJellyfinUserId()) {
        showJellyfinStatus('Set JELLYFIN_USER_ID in config to favorite items', 'error');
        return false;
    }
    const method = shouldFavorite ? 'POST' : 'DELETE';
    try {
        const response = await fetch(`${CONFIG.JELLYFIN_SERVER}/Users/${CONFIG.JELLYFIN_USER_ID}/FavoriteItems/${itemId}?api_key=${CONFIG.JELLYFIN_API_KEY}`, {
            method
        });
        if (!response.ok) {
            throw new Error(`Favorite toggle failed (${response.status})`);
        }
        return true;
    } catch (error) {
        console.error('[Jellyfin] Favorite toggle failed:', error);
        showJellyfinStatus('Unable to update favorite', 'error');
        return false;
    }
}

async function toggleCurrentTrackFavorite() {
    const track = getActiveJellyfinTrack();
    if (!track) return;
    const targetState = !track.isFavorite;
    track.isFavorite = targetState;
    STATE.jellyfinPlayback.isFavorite = targetState;
    updateJellyfinFavoriteButtonState();
    const success = await setJellyfinFavorite(track.jellyfinId, targetState);
    if (success) {
        showJellyfinStatus(targetState ? 'Added to favorites' : 'Removed from favorites');
        return;
    }
    // revert on failure
    track.isFavorite = !targetState;
    STATE.jellyfinPlayback.isFavorite = track.isFavorite;
    updateJellyfinFavoriteButtonState();
}

async function fetchRandomJellyfinTracks({ limit = 10, favoritesOnly = false } = {}) {
    const cappedLimit = Math.max(1, Number(limit) || 1);
    const params = new URLSearchParams({
        IncludeItemTypes: 'Audio',
        Recursive: 'true',
        SortBy: 'Random',
        Limit: cappedLimit.toString(),
        Fields: 'AudioInfo,ParentId,Album,AlbumId,Artists'
    });
    if (favoritesOnly) {
        params.set('Filters', 'IsFavorite');
        // IsFavorite filter requires UserId parameter
        if (hasJellyfinUserId()) {
            params.set('UserId', CONFIG.JELLYFIN_USER_ID);
        }
    }

    return await fetchJellyfinItemsFromParams(params);
}

async function shuffleJellyfinFavorites() {
    if (!hasJellyfinUserId()) {
        const message = '<div class="info-message">Set JELLYFIN_USER_ID in script.js to shuffle your favorite tracks.</div>';
        renderJellyfinHomeContent(message, { showBackButton: true });
        showJellyfinStatus('User ID required for favorites', 'error');
        return;
    }
    try {
        showJellyfinStatus('Loading favorite tracks...');
        const favorites = await fetchRandomJellyfinTracks({ limit: 25, favoritesOnly: true });
        if (!favorites.length) {
            showJellyfinStatus('No favorite tracks found', 'error');
            return;
        }
        const queue = favorites.map(track => ({
            ...track,
            jellyfinType: 'Audio',
            album: track.Album || 'Favorites',
            albumId: track.AlbumId || track.ParentId || track.Id,
            description: track.Album || 'Favorite Tracks'
        }));

        // Mount player in text zone with back button
        const playerHTML = '<div id="jellyfin-favorites-player" data-embed-player></div>';
        renderJellyfinHomeContent(playerHTML, { showBackButton: true });

        playJellyfinAudio(queue[0], {
            queue,
            startIndex: 0,
            context: 'favorites',
            mountSelector: '#jellyfin-favorites-player'
        });
        showJellyfinStatus(`Playing ${queue.length} favorite track${queue.length === 1 ? '' : 's'}`);
    } catch (error) {
        console.error('[Jellyfin] Failed to shuffle favorites:', error);
        showJellyfinStatus('Unable to load favorite tracks', 'error');
    }
}

async function queueRandomLibraryTrackNext() {
    if (!STATE.jellyfinPlayback.queue.length) {
        showJellyfinStatus('Start playback before queuing new songs', 'error');
        return;
    }
    try {
        showJellyfinStatus('Fetching a surprise track...');
        const [randomTrack] = await fetchRandomJellyfinTracks({ limit: 1 });
        if (!randomTrack) {
            showJellyfinStatus('No tracks available to queue', 'error');
            return;
        }
        const normalized = normalizeJellyfinTrack(randomTrack, {
            album: randomTrack.Album || randomTrack.SeriesName || 'Library',
            albumId: randomTrack.AlbumId || randomTrack.ParentId || null
        });
        if (!normalized) {
            showJellyfinStatus('Unable to queue track', 'error');
            return;
        }
        STATE.jellyfinPlayback.queue.splice(Math.max(STATE.jellyfinPlayback.currentIndex + 1, 0), 0, normalized);
        const container = getJellyfinPlaybackContainer();
        if (container) {
            updateJellyfinControlStates(container);
        }
        showJellyfinStatus('Random library track queued next');
    } catch (error) {
        console.error('[Jellyfin] Failed to queue random track:', error);
        showJellyfinStatus('Unable to queue track', 'error');
    }
}

async function fetchJellyfinItemsFromParams(params) {
    // Convert URLSearchParams to object for buildJellyfinUrl
    const paramsObj = {};
    for (const [key, value] of params.entries()) {
        paramsObj[key] = value;
    }
    const url = buildJellyfinUrl('Items', paramsObj);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Jellyfin request failed (${response.status})`);
    }
    const data = await response.json();
    return Array.isArray(data.Items) ? data.Items : [];
}

async function fetchJellyfinItemsByArtist(artistId, extraParams = {}, options = {}) {
    if (!artistId) return [];
    const { fallbackToAlbumArtist = true } = options;
    const params = new URLSearchParams({
        Recursive: 'true',
        ArtistIds: artistId,
        ...extraParams
    });

    let items = await fetchJellyfinItemsFromParams(params);
    if (!items.length && fallbackToAlbumArtist) {
        const fallbackParams = new URLSearchParams({
            Recursive: 'true',
            AlbumArtistIds: artistId,
            ...extraParams
        });
        try {
            items = await fetchJellyfinItemsFromParams(fallbackParams);
        } catch {
            items = [];
        }
    }
    return items;
}

function buildJellyfinVideoSources(itemId) {
    if (!itemId) return [];
    const mp4Params = {
        Static: 'false',
        Container: 'mp4',
        VideoCodec: 'h264',
        AudioCodec: 'aac',
        EnableAutoStreamCopy: 'true'
    };
    const hlsParams = {
        TranscodingProtocol: 'hls',
        VideoCodec: 'h264',
        AudioCodec: 'aac',
        PlaylistFileExtension: 'm3u8',
        TranscodingContainer: 'ts',
        EnableAutoStreamCopy: 'true'
    };
    return [
        {
            type: 'video/mp4',
            url: buildJellyfinUrl(`Videos/${itemId}/stream`, mp4Params)
        },
        {
            type: 'application/x-mpegURL',
            url: buildJellyfinUrl(`Videos/${itemId}/master.m3u8`, hlsParams)
        }
    ];
}

async function shuffleArtistTracks(artistId, artistName = 'Artist') {
    if (!artistId) {
        showJellyfinStatus('Missing artist to shuffle', 'error');
        return;
    }
    try {
        showJellyfinStatus(`Shuffling ${artistName}...`);
        const tracks = await fetchJellyfinItemsByArtist(artistId, {
            IncludeItemTypes: 'Audio',
            SortBy: 'Random',
            Limit: '25',
            Fields: 'AudioInfo,ParentId,Album,AlbumId,Artists'
        });
        if (!tracks.length) {
            showJellyfinStatus('No tracks found for this artist', 'error');
            return;
        }
        const queue = tracks.map(track => ({
            ...track,
            jellyfinType: 'Audio',
            album: track.Album || artistName,
            albumId: track.AlbumId || track.ParentId || null,
            description: artistName
        }));
        playJellyfinAudio(queue[0], {
            queue,
            startIndex: 0,
            context: 'single'
        });
        showJellyfinStatus(`Playing ${artistName}`);
    } catch (error) {
        console.error('[Jellyfin] Failed to shuffle artist:', error);
        showJellyfinStatus('Unable to shuffle this artist', 'error');
    }
}

function getJellyfinPlaybackContainer() {
    const selector = STATE.jellyfinPlayback.mountSelector;
    if (selector) {
        const target = document.querySelector(selector);
        if (target) return target;
        console.warn('[Jellyfin] Playback mount not found, falling back to main text container:', selector);
    }
    return DOM.text;
}

function renderJellyfinAudioPlayer() {
    const track = getActiveJellyfinTrack();
    if (!track) {
        showJellyfinStatus('Unable to load track for playback', 'error');
        return;
    }
    const container = getJellyfinPlaybackContainer();
    if (!container) return;

    const embedMode = Boolean(STATE.jellyfinPlayback.mountSelector);
    const coverUrl = getJellyfinImageUrl(track.albumId || track.jellyfinId, { maxWidth: embedMode ? 160 : 220 });
    const sources = buildJellyfinAudioSources(track.jellyfinId);
    const jellyfinUrl = buildJellyfinDetailUrl(track.jellyfinId);
    const queueMetaText = STATE.jellyfinPlayback.queue.length
        ? `Track ${STATE.jellyfinPlayback.currentIndex + 1} of ${STATE.jellyfinPlayback.queue.length}`
        : '';
    const closeButtonHTML = embedMode
        ? ''
        : `<div style="text-align:center;">
                <button class="jellyfin-close-player" style="padding:0.5rem 1rem; background:#333; color:#fff; border:none; border-radius:6px; cursor:pointer;">
                    ← Back to Bookmarks
                </button>
            </div>`;
    const embedAlbumLabel = track.album || STATE.jellyfinPlayback.albumTitle || '';
    const albumTargetId = track.albumId || track.source?.AlbumId || track.jellyfinId;
    const albumUrl = buildJellyfinDetailUrl(albumTargetId);
    const artBlock = `
        <a href="${albumUrl}" target="_blank" rel="noopener" class="jellyfin-mini-art" aria-label="Open album in Jellyfin">
            ${coverUrl ? `<img src="${coverUrl}" alt="Album art" onerror="this.style.display='none'">` : ''}
        </a>
    `;
    const artistInfo = getPrimaryJellyfinArtist(track);
    const artistName = artistInfo?.name || '';
    const artistUrl = artistInfo?.id ? buildJellyfinDetailUrl(artistInfo.id) : null;
    const artistHTML = artistName
        ? (artistUrl
            ? `<a href="${artistUrl}" target="_blank" rel="noopener">${escapeHtml(artistName)}</a>`
            : `<span>${escapeHtml(artistName)}</span>`)
        : '';
    const albumLabel = embedAlbumLabel && embedAlbumLabel !== artistName ? escapeHtml(embedAlbumLabel) : '';
    const subtitleParts = [artistHTML, albumLabel].filter(Boolean).join(' • ');

    container.innerHTML = `
        <div class="jellyfin-audio-player">
            ${closeButtonHTML}
            <div class="jellyfin-mini-player">
                ${artBlock}
                <div class="jellyfin-mini-main">
                    <div class="jellyfin-mini-meta">
                        <div class="jellyfin-mini-title-row">
                            <div class="jellyfin-mini-title">
                                <a href="${jellyfinUrl}" target="_blank" rel="noopener">${escapeHtml(track.title)}</a>
                            </div>
                            <div class="jellyfin-mini-controls" data-jellyfin-controls>
                                <button class="jellyfin-mini-control" data-action="previous" aria-label="Previous track" title="Previous track">⏮️</button>
                                <button class="jellyfin-mini-control" data-action="toggle-play" aria-label="Play or pause" title="Play or pause">▶️</button>
                                <button class="jellyfin-mini-control" data-action="next" aria-label="Next track" title="Next track">⏭️</button>
                                <button class="jellyfin-mini-control ${STATE.jellyfinPlayback.repeatOne ? 'is-active' : ''}" data-action="repeat" aria-label="Repeat current track" title="Repeat current track">${STATE.jellyfinPlayback.repeatOne ? '🔂' : '🔁'}</button>
                                <button class="jellyfin-mini-control" data-action="toggle-favorite" aria-label="Favorite track" title="Favorite track">☆</button>
                                <button class="jellyfin-mini-control" data-action="shuffle-queue" aria-label="Shuffle current queue" title="Shuffle current queue">🔀</button>
                                <button class="jellyfin-mini-control" data-action="shuffle-favorites" aria-label="Shuffle favorites" title="Shuffle favorites">💙</button>
                                <button class="jellyfin-mini-control" data-action="queue-random-library" aria-label="Queue random library track" title="Queue random library track">✨</button>
                            </div>
                        </div>
                        ${subtitleParts ? `<div class="jellyfin-mini-subtitle">${subtitleParts}</div>` : ''}
                        <div class="jellyfin-mini-queue" data-jellyfin-queue-meta>${queueMetaText}</div>
                    </div>
                    <div class="jellyfin-mini-progress">
                        <div class="jellyfin-mini-time" data-jellyfin-time>0:00 / --:--</div>
                        <div class="jellyfin-mini-progress-track" data-jellyfin-progress>
                            <div class="jellyfin-mini-progress-fill" data-jellyfin-progress-fill></div>
                        </div>
                    </div>
                </div>
            </div>
            <audio id="jellyfin-audio-element" autoplay class="jellyfin-hidden-audio">
                ${sources.map(source => `<source src="${source.url}" type="${source.type}">`).join('')}
                Your browser doesn't support audio playback.
            </audio>
            <div class="jellyfin-player-status" data-jellyfin-status style="text-align:center; color:#888; min-height:1.5rem;"></div>
        </div>
    `;

    attachJellyfinAudioEventHandlers(container, embedMode);

    if (hasJellyfinUserId()) {
        fetchJellyfinFavoriteStatus(track.jellyfinId).then(status => {
            if (status === null || status === undefined) return;
            track.isFavorite = Boolean(status);
            STATE.jellyfinPlayback.isFavorite = track.isFavorite;
            updateJellyfinFavoriteButtonState(container);
        }).catch(() => {});
    }
}

function attachJellyfinAudioEventHandlers(container, embedMode) {
    const closeBtn = container.querySelector('.jellyfin-close-player');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeJellyfinPlayer);
    }

    const audioEl = container.querySelector('#jellyfin-audio-element');
    if (audioEl) {
        audioEl.addEventListener('ended', handleJellyfinTrackEnd);
        audioEl.addEventListener('error', () => {
            showJellyfinStatus('Playback failed, trying fallback...', 'error');
        });
        audioEl.addEventListener('timeupdate', () => updateJellyfinProgressUI(audioEl));
        audioEl.addEventListener('durationchange', () => updateJellyfinProgressUI(audioEl));
        audioEl.addEventListener('loadedmetadata', () => updateJellyfinProgressUI(audioEl));
        audioEl.addEventListener('play', () => {
            updateJellyfinPlayButtonState(container);
            showJellyfinStatus('');
        });
        audioEl.addEventListener('pause', () => updateJellyfinPlayButtonState(container));
        audioEl.play().catch(() => {
            updateJellyfinPlayButtonState(container);
        });
        updateJellyfinProgressUI(audioEl);
    }

    container.querySelectorAll('[data-action="previous"]').forEach(btn => {
        btn.addEventListener('click', () => playPreviousJellyfinTrack());
    });
    container.querySelectorAll('[data-action="next"]').forEach(btn => {
        btn.addEventListener('click', () => playNextJellyfinTrack());
    });
    container.querySelectorAll('[data-action="toggle-play"]').forEach(btn => {
        btn.addEventListener('click', () => toggleJellyfinPlayback());
    });
    container.querySelectorAll('[data-action="shuffle-queue"]').forEach(btn => {
        btn.addEventListener('click', () => shuffleCurrentJellyfinQueue());
    });
    container.querySelectorAll('[data-action="toggle-favorite"]').forEach(btn => {
        btn.addEventListener('click', () => toggleCurrentTrackFavorite());
    });
    container.querySelectorAll('[data-action="repeat"]').forEach(btn => {
        btn.addEventListener('click', () => {
            toggleJellyfinRepeatMode();
            // Update button state without re-rendering entire player
            // (re-rendering would restart audio playback)
            const isActive = STATE.jellyfinPlayback.repeatOne;
            btn.classList.toggle('is-active', isActive);
            btn.textContent = isActive ? '🔂' : '🔁';
        });
    });
    container.querySelectorAll('[data-action="shuffle-favorites"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            try {
                await shuffleJellyfinFavorites();
            } finally {
                btn.disabled = false;
            }
        });
    });
    container.querySelectorAll('[data-action="queue-random-library"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            try {
                await queueRandomLibraryTrackNext();
            } finally {
                btn.disabled = false;
            }
        });
    });

    const progressTrack = container.querySelector('[data-jellyfin-progress]');
    if (progressTrack && audioEl) {
        const seek = event => {
            event.preventDefault();
            handleJellyfinProgressSeek(event, audioEl);
        };
        progressTrack.addEventListener('click', seek);
        progressTrack.addEventListener('mousedown', event => {
            if (event.button !== 0) return;
            event.preventDefault();
            const moveHandler = moveEvent => handleJellyfinProgressSeek(moveEvent, audioEl);
            const upHandler = () => {
                window.removeEventListener('mousemove', moveHandler);
                window.removeEventListener('mouseup', upHandler);
            };
            window.addEventListener('mousemove', moveHandler);
            window.addEventListener('mouseup', upHandler);
            handleJellyfinProgressSeek(event, audioEl);
        });
    }

    updateJellyfinControlStates(container);
    updateJellyfinPlayButtonState(container);

    if (!embedMode) {
        DOM.text.dataset.jellyfinActive = 'true';
    }
}

function getJellyfinAudioElement() {
    const container = getJellyfinPlaybackContainer();
    if (!container) return null;
    return container.querySelector('#jellyfin-audio-element');
}

function getJellyfinVideoElement() {
    if (!DOM.text) return null;
    return DOM.text.querySelector('.jellyfin-video-player video');
}

function handleJellyfinTrackEnd() {
    if (STATE.jellyfinPlayback.repeatOne) {
        const audioEl = getJellyfinAudioElement();
        if (audioEl) {
            audioEl.currentTime = 0;
            audioEl.play().catch(error => {
                console.warn('[Jellyfin] Unable to restart repeat playback:', error);
            });
        }
        return;
    }
    playNextJellyfinTrack(true);
}

function playNextJellyfinTrack(autoAdvance = false) {
    if (!STATE.jellyfinPlayback.queue.length) return;

    const canAdvance = STATE.jellyfinPlayback.currentIndex < STATE.jellyfinPlayback.queue.length - 1;
    if (!canAdvance) {
        if (!autoAdvance) {
            showJellyfinStatus('Reached end of queue');
        }
        return;
    }

    STATE.jellyfinPlayback.currentIndex += 1;
    syncPlaybackFavoriteState();
    renderJellyfinAudioPlayer();
}

function playPreviousJellyfinTrack() {
    if (!STATE.jellyfinPlayback.queue.length) return;
    if (STATE.jellyfinPlayback.currentIndex === 0) {
        showJellyfinStatus('Already at start of queue');
        return;
    }
    STATE.jellyfinPlayback.currentIndex -= 1;
    syncPlaybackFavoriteState();
    renderJellyfinAudioPlayer();
}

function toggleJellyfinRepeatMode() {
    STATE.jellyfinPlayback.repeatOne = !STATE.jellyfinPlayback.repeatOne;
    showJellyfinStatus(STATE.jellyfinPlayback.repeatOne ? 'Repeat enabled' : 'Repeat disabled');
}

function updateJellyfinControlStates(container) {
    const playback = STATE.jellyfinPlayback;
    const prevBtn = container.querySelector('[data-action="previous"]');
    const nextBtn = container.querySelector('[data-action="next"]');
    if (prevBtn) {
        prevBtn.disabled = playback.currentIndex <= 0;
    }
    if (nextBtn) {
        nextBtn.disabled = playback.currentIndex >= playback.queue.length - 1;
    }
    const repeatBtn = container.querySelector('[data-action="repeat"]');
    if (repeatBtn) {
        repeatBtn.classList.toggle('is-active', playback.repeatOne);
        repeatBtn.textContent = playback.repeatOne ? '🔂' : '🔁';
    }
    const shuffleQueueBtn = container.querySelector('[data-action="shuffle-queue"]');
    if (shuffleQueueBtn) {
        shuffleQueueBtn.disabled = playback.queue.length < 2;
    }
    updateJellyfinFavoriteButtonState(container);
    const queueMetaEl = container.querySelector('[data-jellyfin-queue-meta]');
    if (queueMetaEl) {
        queueMetaEl.textContent = playback.queue.length
            ? `Track ${playback.currentIndex + 1} of ${playback.queue.length}`
            : '';
    }
    updateJellyfinPlayButtonState(container);
}

function updateJellyfinFavoriteButtonState(container) {
    if (!container) container = getJellyfinPlaybackContainer();
    const favoriteBtn = container ? container.querySelector('[data-action="toggle-favorite"]') : null;
    if (!favoriteBtn) return;
    const track = getActiveJellyfinTrack();
    const isFav = Boolean(track?.isFavorite);
    favoriteBtn.classList.toggle('is-active', isFav);
    favoriteBtn.textContent = isFav ? '⭐' : '☆';
    favoriteBtn.title = isFav ? 'Remove from favorites' : 'Add to favorites';
    favoriteBtn.setAttribute('aria-label', favoriteBtn.title);
}

let jellyfinStatusTimeoutId = null;

function showJellyfinStatus(message, type = 'info') {
    const container = getJellyfinPlaybackContainer();
    if (!container) return;
    const statusEl = container.querySelector('[data-jellyfin-status]');
    if (!statusEl) return;

    if (jellyfinStatusTimeoutId) {
        clearTimeout(jellyfinStatusTimeoutId);
        jellyfinStatusTimeoutId = null;
    }

    statusEl.textContent = message || '';
    statusEl.style.color = type === 'error' ? '#ff8686' : '#888';

    if (message) {
        jellyfinStatusTimeoutId = setTimeout(() => {
            statusEl.textContent = '';
        }, 5000);
    }
}

function showJellyfinVideoStatus(message, type = 'info') {
    if (!DOM.text) return;
    const statusEl = DOM.text.querySelector('[data-jellyfin-video-status]');
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.style.color = type === 'error' ? '#ff8686' : '#888';
}

function toggleJellyfinVideoFullscreen() {
    const videoEl = getJellyfinVideoElement();
    if (!videoEl) return false;

    const currentFullscreen = document.fullscreenElement;
    if (currentFullscreen === videoEl) {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(error => {
                console.warn('[Jellyfin] Failed to exit fullscreen:', error);
            });
        }
        showJellyfinVideoStatus('');
        return true;
    }

    if (videoEl.paused) {
        showJellyfinVideoStatus('Start playback to use fullscreen');
        return false;
    }

    if (videoEl.requestFullscreen) {
        const maybePromise = videoEl.requestFullscreen();
        if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then(() => {
                showJellyfinVideoStatus('');
            }).catch(error => {
                console.warn('[Jellyfin] Fullscreen request failed:', error);
                showJellyfinVideoStatus('Fullscreen blocked by the browser', 'error');
            });
        } else {
            showJellyfinVideoStatus('');
        }
        return true;
    }
    return false;
}

function playJellyfinVideo(item) {
    console.log('[Jellyfin] Playing video:', item);

    // Update page title
    if (DOM.pageTitleText) {
        DOM.pageTitleText.textContent = item.title;
    } else if (DOM.pageTitle) {
        DOM.pageTitle.innerHTML = `<p>${escapeHtml(item.title)}</p>`;
    }
    DOM.subtitle.innerHTML = `<p>${escapeHtml(item.description)}</p>`;

    const posterUrl = getJellyfinImageUrl(item.jellyfinId, { maxWidth: 960 });
    const videoSources = buildJellyfinVideoSources(item.jellyfinId);
    const jellyfinUrl = `${CONFIG.JELLYFIN_SERVER}/web/index.html#!/details?id=${item.jellyfinId}`;

    DOM.text.innerHTML = `
        <div class="jellyfin-video-player">
            <div class="jellyfin-player-toolbar">
                <button class="jellyfin-close-player jellyfin-control-button" style="flex:1; min-width:160px;">
                    ← Back to Bookmarks
                </button>
                <a href="${jellyfinUrl}" target="_blank" class="jellyfin-open-link" style="flex:1; min-width:160px; text-align:center;">
                    Jellyfin
                </a>
            </div>
            <video controls autoplay playsinline preload="metadata" poster="${posterUrl}" crossorigin="anonymous">
                ${videoSources.map(source => `<source src="${source.url}" type="${source.type}">`).join('')}
                Your browser doesn't support video playback.
            </video>
            <div class="jellyfin-player-status" data-jellyfin-video-status style="text-align:center; color:#888; min-height:1.5rem;"></div>
        </div>
    `;

    // Mark that we have jellyfin content active
    DOM.text.dataset.jellyfinActive = 'true';

    // Add click handler for close button
    setTimeout(() => {
        const closeBtn = DOM.text.querySelector('.jellyfin-close-player');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeJellyfinPlayer);
        }
        const videoEl = DOM.text.querySelector('.jellyfin-video-player video');
        if (videoEl) {
            videoEl.addEventListener('playing', () => {
                showJellyfinVideoStatus('');
            });
            videoEl.addEventListener('error', () => {
                showJellyfinVideoStatus('Video failed to load. Try opening directly in Jellyfin.', 'error');
            });
            videoEl.play().catch(() => {
                showJellyfinVideoStatus('Press play to start the video.');
            });
        }
    }, 10);

    DOM.overview.innerHTML = '';
    showDefaultDock();
}

function playJellyfinAudio(item, options = {}) {
    console.log('[Jellyfin] Playing audio:', item);

    const embedMode = Boolean(options.mountSelector);
    if (!embedMode) {
        if (DOM.pageTitleText) {
            DOM.pageTitleText.textContent = item.title;
        } else if (DOM.pageTitle) {
            DOM.pageTitle.innerHTML = `<p>${escapeHtml(item.title)}</p>`;
        }
        DOM.subtitle.innerHTML = `<p>${escapeHtml(item.description)}</p>`;
    }

    const queueItems = Array.isArray(options.queue) && options.queue.length > 0
        ? options.queue
        : [item];
    const startIndex = Number.isFinite(options.startIndex) ? options.startIndex : 0;

    setJellyfinQueue(queueItems, startIndex, {
        context: options.context || (embedMode ? 'album' : 'single'),
        mountSelector: options.mountSelector || null,
        albumId: options.albumId || item.albumId || item.AlbumId || item.jellyfinId,
        albumTitle: options.albumTitle || item.album || item.title,
        sourceItem: item
    });

    renderJellyfinAudioPlayer();

    if (!embedMode) {
        DOM.overview.innerHTML = '';
        showDefaultDock();
    }
}

async function displayJellyfinSeries(item) {
    console.log('[Jellyfin] Displaying series:', item);

    if (DOM.pageTitleText) {
        DOM.pageTitleText.textContent = item.title;
    } else if (DOM.pageTitle) {
        DOM.pageTitle.innerHTML = `<p>${escapeHtml(item.title)}</p>`;
    }
    DOM.subtitle.innerHTML = `<p>${escapeHtml(item.description)}</p>`;

    try {
        const showId = item.jellyfinId;
        const [showDetails, showData] = await Promise.all([
            fetch(`${CONFIG.JELLYFIN_SERVER}/Items/${showId}?api_key=${CONFIG.JELLYFIN_API_KEY}&Fields=Overview`)
                .then(res => res.ok ? res.json() : null)
                .catch(() => null),
            fetchJellyfinShowData(showId)
        ]);
        const show = {
            Id: showId,
            Name: showDetails?.Name || item.title,
            Overview: showDetails?.Overview || item.description || '',
            ...showDetails
        };
        DOM.text.innerHTML = buildTvShowPanelHTML(show, showData.seasons, showData.nextUpEpisode, { includeBackButton: false });
        const panel = DOM.text.querySelector('.jellyfin-tv-panel');
        if (panel) {
            setupTvPanelInteractions(panel, show);
        }
        DOM.overview.innerHTML = '';
        showDefaultDock();
    } catch (error) {
        console.error('[Jellyfin] Unable to load series view:', error);
        DOM.text.innerHTML = '<div style="padding:1rem; color:#f88;">Unable to load this series.</div>';
    }
}

async function displayJellyfinAlbum(item) {
    console.log('[Jellyfin] Displaying album/playlist:', item);

    if (DOM.pageTitleText) {
        DOM.pageTitleText.textContent = item.title;
    } else if (DOM.pageTitle) {
        DOM.pageTitle.innerHTML = `<p>${escapeHtml(item.title)}</p>`;
    }
    DOM.subtitle.innerHTML = `<p>${escapeHtml(item.description)}</p>`;

    try {
        const url = `${CONFIG.JELLYFIN_SERVER}/Items?ParentId=${item.jellyfinId}&SortBy=IndexNumber&Fields=UserData,AudioInfo&api_key=${CONFIG.JELLYFIN_API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load album tracks (${response.status})`);
        }
        const data = await response.json();
        const tracks = Array.isArray(data.Items) ? data.Items : [];

        const jellyfinUrl = `${CONFIG.JELLYFIN_SERVER}/web/index.html#!/details?id=${item.jellyfinId}`;
        const albumArtUrl = getJellyfinImageUrl(item.jellyfinId, { maxWidth: 600 });
        const playerId = `jellyfin-album-player-${item.jellyfinId}`;
        const trackCount = tracks.length;
        const totalRuntimeTicks = tracks.reduce((sum, track) => sum + (track.RunTimeTicks || 0), 0);
        const totalRuntime = totalRuntimeTicks ? formatDuration(totalRuntimeTicks) : null;
        const hasTracks = trackCount > 0;

        const tracksHTML = hasTracks
            ? tracks.map((track, index) => `
                <button class="jellyfin-track" data-track-index="${index}">
                    <span class="jellyfin-track-number">${track.IndexNumber || index + 1}</span>
                    <div class="jellyfin-track-body">
                        <div class="jellyfin-track-title">${escapeHtml(track.Name)}</div>
                        ${track.RunTimeTicks ? `<div class="jellyfin-track-meta">${formatDuration(track.RunTimeTicks)}</div>` : ''}
                    </div>
                </button>
            `).join('')
            : `<div class="jellyfin-empty-state">No tracks available in this album.</div>`;

        const albumHTML = `
            <div class="jellyfin-album-view" data-album-id="${item.jellyfinId}">
                <div class="jellyfin-album-hero">
                    <img src="${albumArtUrl}" alt="Album art" class="jellyfin-album-cover" onerror="this.style.display='none'">
                    <div class="jellyfin-album-meta">
                        <h2 style="margin-bottom:0.5rem;">${escapeHtml(item.title)}</h2>
                        ${item.description ? `<p style="color:#999;">${escapeHtml(item.description)}</p>` : ''}
                        <div style="color:#bbb; font-size:0.95rem;">
                            ${trackCount} track${trackCount === 1 ? '' : 's'}${totalRuntime ? ` • ${totalRuntime}` : ''}
                        </div>
                    </div>
                </div>
                <div id="${playerId}" class="jellyfin-album-player" data-embed-player></div>
                <div class="jellyfin-playback-controls" data-album-controls>
                    <button class="jellyfin-control-button" data-action="shuffle-album" ${hasTracks ? '' : 'disabled'}>🔀</button>
                    <button class="jellyfin-control-button" data-action="play-all" ${hasTracks ? '' : 'disabled'}>▶️</button>
                    <button class="jellyfin-control-button" data-action="album-prev" ${hasTracks ? '' : 'disabled'}>⏮️</button>
                    <button class="jellyfin-control-button" data-action="album-next" ${hasTracks ? '' : 'disabled'}>⏭️</button>
                </div>
                <div class="jellyfin-tracklist">
                    <h3 style="padding:0.75rem 1rem; margin:0;">Tracks</h3>
                    ${tracksHTML}
                </div>
                <div style="text-align:center;">
                    <a href="${jellyfinUrl}" target="_blank" class="jellyfin-open-link" style="display:inline-block; margin-top:1rem; padding:0.5rem 1rem; background:#4a9eff; color:#fff; border-radius:6px; text-decoration:none;">
                        Jellyfin
                    </a>
                </div>
            </div>
        `;

        renderJellyfinHomeContent(albumHTML, { showBackButton: true });

        if (!hasTracks) {
            return;
        }

        const queueTracks = tracks.map(track => ({
            ...track,
            jellyfinType: 'Audio',
            album: track.Album || item.title,
            albumId: item.jellyfinId,
            description: track.Album || item.title
        }));
        const playerSelector = `#${playerId}`;

        const startAlbumPlayback = (playlist, startIndex = 0) => {
            if (!playlist.length) {
                showJellyfinStatus('No tracks to play', 'error');
                return;
            }
            const safeIndex = Math.max(0, Math.min(startIndex, playlist.length - 1));
            playJellyfinAudio(playlist[safeIndex], {
                queue: playlist,
                startIndex: safeIndex,
                context: 'album',
                mountSelector: playerSelector,
                albumId: item.jellyfinId,
                albumTitle: item.title
            });
        };

        DOM.text.querySelectorAll('.jellyfin-track').forEach(trackEl => {
            trackEl.addEventListener('click', () => {
                const trackIndex = Number(trackEl.dataset.trackIndex);
                startAlbumPlayback(queueTracks, Number.isFinite(trackIndex) ? trackIndex : 0);
            });
        });

        const controlsEl = DOM.text.querySelector('[data-album-controls]');
        if (controlsEl) {
            controlsEl.addEventListener('click', event => {
                const controlBtn = event.target.closest('.jellyfin-control-button');
                if (!controlBtn || controlBtn.disabled) return;
                const action = controlBtn.dataset.action;
                switch (action) {
                    case 'shuffle-album': {
                        const shuffled = [...queueTracks];
                        for (let i = shuffled.length - 1; i > 0; i -= 1) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                        }
                        startAlbumPlayback(shuffled, 0);
                        break;
                    }
                    case 'play-all':
                        startAlbumPlayback(queueTracks, 0);
                        break;
                    case 'album-prev':
                        playPreviousJellyfinTrack();
                        break;
                    case 'album-next':
                        playNextJellyfinTrack();
                        break;
                    default:
                        break;
                }
            });
        }
    } catch (error) {
        console.error('[Jellyfin] Error loading album tracks:', error);
        DOM.text.innerHTML = '<div style="padding:1rem; color:#f88;">Failed to load tracks</div>';
    }
}

async function displayJellyfinArtist(item) {
    console.log('[Jellyfin] Displaying artist:', item);

    if (DOM.pageTitleText) {
        DOM.pageTitleText.textContent = item.title;
    } else if (DOM.pageTitle) {
        DOM.pageTitle.innerHTML = `<p>${escapeHtml(item.title)}</p>`;
    }
    DOM.subtitle.innerHTML = `<p>${escapeHtml(item.description)}</p>`;

    const jellyfinUrl = `${CONFIG.JELLYFIN_SERVER}/web/index.html#!/details?id=${item.jellyfinId}`;
    const artistImageUrl = getJellyfinImageUrl(item.jellyfinId, { maxWidth: 600 });

    DOM.text.innerHTML = `
        <div class="jellyfin-artist-page">
            <div style="padding:2rem 0; text-align:center;">Loading artist…</div>
        </div>
    `;

    try {
        const [albums, artistDetails] = await Promise.all([
            fetchJellyfinItemsByArtist(item.jellyfinId, {
                IncludeItemTypes: 'MusicAlbum',
                SortBy: 'ProductionYear,SortName',
                Fields: 'PrimaryImageAspectRatio,ProductionYear',
                Limit: '100'
            }),
            fetch(`${CONFIG.JELLYFIN_SERVER}/Items/${item.jellyfinId}?api_key=${CONFIG.JELLYFIN_API_KEY}`)
                .then(res => (res.ok ? res.json() : null))
                .catch(() => null)
        ]);

        const description = item.description || artistDetails?.Overview || '';

        const albumsGrid = albums.length
            ? albums.map((album, index) => {
                const coverUrl = getJellyfinImageUrl(album.Id, { maxWidth: 400 });
                const year = album.ProductionYear ? `<div style="color:#888; font-size:0.9rem;">${album.ProductionYear}</div>` : '';
                return `
                    <div class="jellyfin-artist-album" data-album-id="${album.Id}" data-album-index="${index}">
                        <img src="${coverUrl}" alt="${escapeHtml(album.Name)} cover" onerror="this.style.display='none'">
                        <div style="font-weight:600;">${escapeHtml(album.Name)}</div>
                        ${year}
                    </div>
                `;
            }).join('')
            : `<div class="jellyfin-empty-state">No albums available for this artist.</div>`;

        const artistHTML = `
            <div class="jellyfin-artist-page">
                <div class="jellyfin-artist-header">
                    <img src="${artistImageUrl}" alt="${escapeHtml(item.title)} portrait" class="jellyfin-artist-image" onerror="this.style.display='none'">
                    <h2 style="margin:0;">${escapeHtml(item.title)}</h2>
                    ${description ? `<p style="color:#bbb; max-width:640px;">${escapeHtml(description)}</p>` : ''}
                    <div class="jellyfin-playback-controls">
                        <button class="jellyfin-control-button" data-action="shuffle-artist" ${albums.length ? '' : 'disabled'}>Shuffle All</button>
                        <a href="${jellyfinUrl}" target="_blank" class="jellyfin-open-link" style="padding:0.65rem 1.4rem;">Jellyfin</a>
                    </div>
                </div>
                <div>
                    <h3 style="margin-bottom:0.5rem;">Albums</h3>
                    <div class="jellyfin-artist-albums">
                        ${albumsGrid}
                    </div>
                </div>
            </div>
        `;

        renderJellyfinHomeContent(artistHTML, { showBackButton: true });

        const shuffleBtn = DOM.text.querySelector('[data-action="shuffle-artist"]');
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', async () => {
                shuffleBtn.disabled = true;
                try {
                    await shuffleArtistTracks(item.jellyfinId, item.title);
                } finally {
                    shuffleBtn.disabled = false;
                }
            });
        }

        DOM.text.querySelectorAll('.jellyfin-artist-album').forEach(albumEl => {
            albumEl.addEventListener('click', () => {
                const albumId = albumEl.dataset.albumId;
                const albumIndex = Number(albumEl.dataset.albumIndex);
                const albumRecord = Number.isFinite(albumIndex) ? albums[albumIndex] : null;
                const albumName = albumRecord?.Name || 'Album';
                if (!albumId) return;
                displayJellyfinAlbum({
                    type: 'jellyfin',
                    jellyfinType: 'MusicAlbum',
                    jellyfinId: albumId,
                    title: albumName,
                    description: `${albumName} • ${item.title}`
                });
            });
        });
    } catch (error) {
        console.error('[Jellyfin] Error loading artist:', error);
        DOM.text.innerHTML = '<div style="padding:1rem; color:#f88;">Failed to load artist data</div>';
        DOM.overview.innerHTML = '';
        showDefaultDock();
    }
}

async function displayJellyfinBook(item) {
    console.log('[Jellyfin] Displaying book:', item);

    if (DOM.pageTitleText) {
        DOM.pageTitleText.textContent = item.title;
    } else if (DOM.pageTitle) {
        DOM.pageTitle.innerHTML = `<p>${escapeHtml(item.title)}</p>`;
    }
    DOM.subtitle.innerHTML = `<p>${escapeHtml(item.description)}</p>`;

    try {
        const detailsResponse = await fetch(`${CONFIG.JELLYFIN_SERVER}/Items/${item.jellyfinId}?api_key=${CONFIG.JELLYFIN_API_KEY}&Fields=Overview,Genres,PageCount,UserData`);
        if (!detailsResponse.ok) {
            throw new Error(`Failed to load book info (${detailsResponse.status})`);
        }
        const details = await detailsResponse.json();
        const coverUrl = getJellyfinImageUrl(item.jellyfinId, { maxWidth: 600 });
        const downloadUrl = `${CONFIG.JELLYFIN_SERVER}/Items/${item.jellyfinId}/Download?api_key=${CONFIG.JELLYFIN_API_KEY}`;
        const viewerUrl = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(downloadUrl)}`;
        const totalPages = Number(details.PageCount) || null;
        let currentPage = getJellyfinBookBookmark(item.jellyfinId) || 1;
        if (totalPages) {
            currentPage = Math.min(currentPage, totalPages);
        }

        DOM.text.innerHTML = `
            <div class="jellyfin-book-viewer" data-book-id="${item.jellyfinId}">
                <div class="jellyfin-book-toolbar">
                    <div class="jellyfin-book-info">
                        <div class="jellyfin-book-title">${escapeHtml(details.Name || item.title)}</div>
                        ${details.Overview ? `<p class="jellyfin-book-overview">${escapeHtml(details.Overview)}</p>` : ''}
                    </div>
                    <div class="jellyfin-book-controls">
                        <button class="jellyfin-control-button" data-action="book-prev">◀️ Prev</button>
                        <div class="jellyfin-book-page" data-book-page>${totalPages ? `${currentPage} / ${totalPages}` : `${currentPage}`}</div>
                        <button class="jellyfin-control-button" data-action="book-next">Next ▶️</button>
                        <button class="jellyfin-control-button" data-action="book-bookmark">🔖 Bookmark</button>
                    </div>
                </div>
                <div class="jellyfin-book-status" data-book-status></div>
                <div class="jellyfin-book-status" data-book-status></div>
                <div class="jellyfin-book-frame">
                    <iframe src="${viewerUrl}#page=${currentPage}" data-book-frame loading="lazy"></iframe>
                </div>
            </div>
        `;

        DOM.overview.innerHTML = `
            <div style="padding:1rem;">
                ${coverUrl ? `<img src="${coverUrl}" alt="Book Cover" style="max-width:200px; width:50%; border-radius:10px; margin-bottom:1rem;" onerror="this.style.display='none'">` : ''}
                ${details.Genres && details.Genres.length ? `<p><strong>Genres:</strong> ${escapeHtml(details.Genres.join(', '))}</p>` : ''}
            </div>
        `;
        showDefaultDock();

        const viewerEl = DOM.text.querySelector('.jellyfin-book-viewer');
        if (viewerEl) {
            const frame = viewerEl.querySelector('[data-book-frame]');
            const pageLabel = viewerEl.querySelector('[data-book-page]');
            const prevBtn = viewerEl.querySelector('[data-action="book-prev"]');
            const nextBtn = viewerEl.querySelector('[data-action="book-next"]');
            const bookmarkBtn = viewerEl.querySelector('[data-action="book-bookmark"]');
            const statusEl = viewerEl.querySelector('[data-book-status]');

            const clampPage = page => {
                if (totalPages) {
                    return Math.min(Math.max(1, page), totalPages);
                }
                return Math.max(1, page);
            };

            const updatePage = (newPage, saveBookmark = false) => {
                currentPage = clampPage(newPage);
                if (frame) {
                    frame.src = `${viewerUrl}#page=${currentPage}`;
                }
                if (pageLabel) {
                    pageLabel.textContent = totalPages ? `${currentPage} / ${totalPages}` : `${currentPage}`;
                }
                if (saveBookmark) {
                    setJellyfinBookBookmark(item.jellyfinId, currentPage);
                    if (statusEl) {
                        statusEl.textContent = 'Bookmark saved';
                        setTimeout(() => {
                            if (statusEl.textContent === 'Bookmark saved') {
                                statusEl.textContent = '';
                            }
                        }, 4000);
                    }
                }
            };

            if (prevBtn) {
                prevBtn.addEventListener('click', () => updatePage(currentPage - 1, true));
            }
            if (nextBtn) {
                nextBtn.addEventListener('click', () => updatePage(currentPage + 1, true));
            }
            if (bookmarkBtn) {
                bookmarkBtn.addEventListener('click', () => {
                    setJellyfinBookBookmark(item.jellyfinId, currentPage);
                    if (statusEl) {
                        statusEl.textContent = 'Bookmark saved';
                        setTimeout(() => {
                            if (statusEl.textContent === 'Bookmark saved') {
                                statusEl.textContent = '';
                            }
                        }, 4000);
                    }
                });
            }
        }
    } catch (error) {
        console.error('[Jellyfin] Unable to display book:', error);
        const jellyfinUrl = `${CONFIG.JELLYFIN_SERVER}/web/index.html#!/details?id=${item.jellyfinId}`;
        DOM.text.innerHTML = `
            <div style="padding:1rem; text-align:center;">
                <p>Unable to embed this book. Click below to open it in Jellyfin.</p>
                <a href="${jellyfinUrl}" target="_blank" class="jellyfin-open-link" style="display:inline-block; padding:0.5rem 1rem; background:#4a9eff; color:#fff; border-radius:6px; text-decoration:none; margin-top:1rem;">
                    Jellyfin
                </a>
            </div>
        `;
        DOM.overview.innerHTML = '';
        showDefaultDock();
    }
}

function openInJellyfin(itemId) {
    const url = `${CONFIG.JELLYFIN_SERVER}/web/index.html#!/details?id=${itemId}`;
    window.open(url, '_blank');
    exitSearchMode();
}

function closeJellyfinPlayer() {
    console.log('[Jellyfin] Closing player, returning to bookmarks');

    // Remove jellyfin active marker
    delete DOM.text.dataset.jellyfinActive;
    resetJellyfinPlaybackState();

    // Restore bookmarks
    displayBookmarksTree();
}

function formatDuration(ticks) {
    // Jellyfin uses ticks (10,000 ticks = 1 millisecond)
    const seconds = Math.floor(ticks / 10000000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatJellyfinEpisodeLabel(episode) {
    const season = Number.isFinite(episode?.ParentIndexNumber) ? episode.ParentIndexNumber : null;
    const ep = Number.isFinite(episode?.IndexNumber) ? episode.IndexNumber : null;
    if (season == null && ep == null) return '';
    const seasonPart = season != null ? `S${season.toString().padStart(2, '0')}` : '';
    const episodePart = ep != null ? `E${ep.toString().padStart(2, '0')}` : '';
    return `${seasonPart}${episodePart}`;
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
        </div>
    `;

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

function decodeHtmlEntities(text) {
    if (!text || !HTML_ENTITY_PARSER) return text || '';
    HTML_ENTITY_PARSER.innerHTML = text;
    return HTML_ENTITY_PARSER.value;
}

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
