// ============================================================================
// ZONE MANAGEMENT
// ============================================================================
// Manages the 4 display zones: header, overview, text, and footer (dock)
// As per the architecture: "all this site does is switch out what is shown
// in which box under certain conditions"

/**
 * Zone configuration for different modes and content types
 */
const ZoneConfigs = {
    HOME: {
        header: 'clock', // Live clock and date
        overview: 'feed', // RSS feed
        text: 'bookmarks', // Bookmark tree
        dock: 'applinks' // App shortcuts
    },
    SEARCH_EMPTY: {
        header: 'search-input', // Search input
        overview: 'external-search-links', // Fallback search engines
        text: 'ai-answer', // AI-generated answer
        dock: 'quick-search-icons' // Quick search icons
    },
    SEARCH_SUGGESTIONS: {
        header: 'search-input',
        overview: 'suggestions', // Live suggestions list
        text: '', // Empty or keep bookmarks
        dock: '' // Empty or keep applinks
    },
    WIKIPEDIA_ARTICLE: {
        header: 'article-title',
        overview: 'toc-and-infobox', // Table of contents + infobox
        text: 'article-content', // Article text
        dock: 'external-links' // Related external links
    },
    JELLYFIN_ALBUM: {
        header: 'album-title',
        overview: 'album-info', // Album metadata
        text: 'track-list', // Songs
        dock: 'related-albums' // Other albums by artist
    },
    JELLYFIN_SERIES: {
        header: 'series-title',
        overview: 'series-info', // Show metadata
        text: 'season-episodes', // Episode list
        dock: 'cast-crew' // Cast thumbnails
    },
    JELLYFIN_BOOK: {
        header: 'book-title',
        overview: 'book-info', // Book metadata
        text: 'book-reader', // EPUB reader
        dock: 'book-nav' // Navigation controls
    },
    TRAKT_MOVIE: {
        header: 'movie-title',
        overview: 'movie-info', // Movie metadata
        text: 'movie-overview', // Synopsis
        dock: 'cast' // Cast thumbnails
    },
    TRAKT_PERSON: {
        header: 'person-name',
        overview: 'person-info', // Personal details + photo
        text: 'biography', // Bio text
        dock: 'known-for' // Movie posters
    }
};

/**
 * Current zone state
 */
let currentZoneConfig = 'HOME';

/**
 * Switch to a different zone configuration
 * @param {string} configName - Name of the zone config (e.g., 'HOME', 'WIKIPEDIA_ARTICLE')
 * @param {Object} data - Optional data object for populating zones
 */
function switchZoneConfig(configName, data = {}) {
    const config = ZoneConfigs[configName];
    if (!config) {
        console.warn(`Unknown zone config: ${configName}`);
        return;
    }

    currentZoneConfig = configName;

    // Each zone can be populated by the respective modules
    // This function just tracks which config is active
    // Actual population is done by content-specific functions
}

/**
 * Get the current zone configuration
 * @returns {Object} Current zone config
 */
function getCurrentZoneConfig() {
    return ZoneConfigs[currentZoneConfig] || ZoneConfigs.HOME;
}

/**
 * Get zone configuration for a specific mode
 * @param {string} configName - Name of the zone config
 * @returns {Object} Zone config object
 */
function getZoneConfig(configName) {
    return ZoneConfigs[configName];
}

/**
 * Clear all zones
 */
function clearAllZones() {
    clearZone('overview');
    clearZone('text');
    clearZone('dock');
    // Header typically not cleared as it contains the title/search input
}

/**
 * Reset to home mode zones
 */
function resetToHomeZones() {
    switchZoneConfig('HOME');
}

/**
 * Check if currently in a specific zone config
 * @param {string} configName - Name to check
 * @returns {boolean}
 */
function isZoneConfig(configName) {
    return currentZoneConfig === configName;
}
