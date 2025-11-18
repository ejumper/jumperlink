// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
// General-purpose utility functions used across the application

/**
 * HTML entity parser for decoding entities
 */
const HTML_ENTITY_PARSER = typeof document !== 'undefined' ? document.createElement('textarea') : null;

/**
 * Decode HTML entities from text
 * @param {string} text - Text with HTML entities
 * @returns {string} Decoded text
 */
function decodeHtmlEntities(text) {
    if (!text || !HTML_ENTITY_PARSER) return text || '';
    HTML_ENTITY_PARSER.innerHTML = text;
    return HTML_ENTITY_PARSER.value;
}

/**
 * Escape HTML special characters
 * Used 130+ times throughout the codebase
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Strip HTML tags from a string
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
function stripHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || div.innerText || '').trim();
}

/**
 * Safely extract hostname from URL
 * @param {string} url - URL to parse
 * @returns {string} Hostname without www prefix, or empty string if invalid
 */
function safeHostname(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./, '');
    } catch (error) {
        return '';
    }
}

/**
 * Handle external search redirect based on query modifiers
 * - Query ending with " p" and length > 45: Perplexity AI
 * - Query ending with " p" and length <= 45: Google Images
 * - Default: DuckDuckGo
 * @param {string} query - Search query
 */
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

/**
 * Generate a unique ID
 * @param {string} prefix - Prefix for the ID
 * @returns {string} Unique ID
 */
function generateUID(prefix = 'id') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function execution
 * @param {Function} func - Function to throttle
 * @param {number} limit - Milliseconds to wait between calls
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Format a large number with abbreviations (K, M, B)
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatLargeNumber(num) {
    if (!Number.isFinite(num)) return '0';
    const absNum = Math.abs(num);
    if (absNum >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (absNum >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (absNum >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 * @param {*} value - Value to check
 * @returns {boolean} True if empty
 */
function isEmpty(value) {
    if (value == null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
}

/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after the specified time
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
