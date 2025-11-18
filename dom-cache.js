// ============================================================================
// DOM ELEMENT CACHE
// ============================================================================
// Caches frequently accessed DOM elements to eliminate ~194 querySelector calls
// All elements are cached on page load and accessed via the DOM object

const DOM = {
    // Core zones (4 main display areas)
    header: null,
    overview: null,
    text: null,
    footer: null, // links/dock area
    dock: null,

    // Header elements
    headerMain: null,
    headerActiveBar: null,
    pageTitle: null,
    pageTitleDisplay: null,
    subtitle: null,
    subtitleP: null,
    mainText: null,

    // Search elements
    searchBox: null,
    pageTitleInput: null,
    searchTriggers: [],
    searchContainers: [],

    // Body
    body: null,

    // Computed properties for convenience
    get isSearchMode() {
        return this.searchBox?.classList.contains('active') || false;
    }
};

/**
 * Initialize the DOM cache - call this once on page load
 * @returns {Object} The populated DOM cache object
 */
function initDOMCache() {
    // Core zones
    DOM.header = document.querySelector('header');
    DOM.overview = document.querySelector('overview');
    DOM.text = document.querySelector('text');
    DOM.footer = document.querySelector('links');
    DOM.dock = document.querySelector('dock');

    // Header elements
    DOM.headerMain = document.querySelector('.header-main');
    DOM.headerActiveBar = document.querySelector('.header-active-bar');
    DOM.pageTitle = document.querySelector('page-title');
    DOM.pageTitleDisplay = document.querySelector('.page-title-display');
    DOM.subtitle = document.querySelector('subtitle');
    DOM.subtitleP = DOM.subtitle?.querySelector('p');
    DOM.mainText = document.querySelector('main-text');

    // Search elements
    DOM.searchBox = document.getElementById('searchbox');
    DOM.pageTitleInput = document.querySelector('.page-title-input');
    DOM.searchTriggers = Array.from(document.querySelectorAll('.search-trigger'));
    DOM.searchContainers = Array.from(document.querySelectorAll('search-container'));

    // Body
    DOM.body = document.body;

    return DOM;
}

/**
 * Clear a zone's content
 * @param {string} zoneName - One of: 'header', 'overview', 'text', 'footer', 'dock'
 */
function clearZone(zoneName) {
    const zone = DOM[zoneName];
    if (zone) {
        zone.innerHTML = '';
    }
}

/**
 * Set a zone's content
 * @param {string} zoneName - One of: 'header', 'overview', 'text', 'footer', 'dock'
 * @param {string} html - HTML content to set
 */
function setZoneContent(zoneName, html) {
    const zone = DOM[zoneName];
    if (zone) {
        zone.innerHTML = html;
    }
}

/**
 * Append to a zone's content
 * @param {string} zoneName - One of: 'header', 'overview', 'text', 'footer', 'dock'
 * @param {string} html - HTML content to append
 */
function appendZoneContent(zoneName, html) {
    const zone = DOM[zoneName];
    if (zone) {
        zone.innerHTML += html;
    }
}

/**
 * Check if an element exists in the DOM cache
 * @param {string} elementName - Name of the cached element
 * @returns {boolean}
 */
function hasElement(elementName) {
    return DOM[elementName] != null;
}
