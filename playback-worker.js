const MAX_TRACKED_VIDEOS = 20;
const COMPLETION_THRESHOLD = 95; // percent
const TTL_MS = 72 * 60 * 60 * 1000; // 72 hours
const TTL_SECONDS = TTL_MS / 1000;

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        if (url.pathname === '/api/playback' && request.method === 'POST') {
            return handlePlaybackLog(request, env);
        }
        if (url.pathname === '/api/playback' && request.method === 'GET') {
            return handlePlaybackList(env);
        }
        return new Response('Not Found', { status: 404 });
    }
};

async function handlePlaybackLog(request, env) {
    let payload;
    try {
        payload = await request.json();
    } catch (error) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const {
        videoId,
        title = '',
        url,
        durationMs,
        positionMs,
        percentage,
        feedType
    } = payload || {};

    if ((feedType || '').toLowerCase() !== 'youtube-rss') {
        return jsonResponse({ status: 'ignored', reason: 'not youtube-rss' }, 202);
    }

    if (!videoId || !url || typeof durationMs !== 'number' || typeof positionMs !== 'number') {
        return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    if (durationMs < 260000) {
        return jsonResponse({ status: 'ignored', reason: 'short video' }, 202);
    }

    const now = Date.now();
    const progressPercent = clampPercentage(
        typeof percentage === 'number' && !Number.isNaN(percentage)
            ? percentage
            : (durationMs > 0 ? (positionMs / durationMs) * 100 : 0)
    );

    let index = await getIndex(env);
    index = await pruneExpired(env, index);

    const entryKey = playbackKey(videoId);

    if (progressPercent >= COMPLETION_THRESHOLD) {
        await env.PLAYBACK_LOGS.delete(entryKey);
        index = index.filter(item => item.videoId !== videoId);
        await saveIndex(env, index);
        return jsonResponse({ status: 'cleared' }, 200);
    }

    const record = {
        videoId,
        title,
        url,
        durationMs,
        positionMs,
        percentage: progressPercent,
        lastUpdated: now
    };

    await env.PLAYBACK_LOGS.put(entryKey, JSON.stringify(record), {
        expirationTtl: TTL_SECONDS
    });

    const existingIndexEntry = index.find(item => item.videoId === videoId);
    if (existingIndexEntry) {
        existingIndexEntry.percentage = progressPercent;
        existingIndexEntry.lastUpdated = now;
    } else {
        index.push({ videoId, percentage: progressPercent, lastUpdated: now });
    }

    index = await enforceIndexLimit(env, index);
    await saveIndex(env, index);

    return jsonResponse({ status: 'ok', entry: record }, 200);
}

async function handlePlaybackList(env) {
    let index = await getIndex(env);
    index = await pruneExpired(env, index);
    await saveIndex(env, index);

    const entries = await Promise.all(
        index.map(async (item) => {
            const entry = await env.PLAYBACK_LOGS.get(playbackKey(item.videoId), { type: 'json' });
            return entry || null;
        })
    );

    const filtered = entries.filter(Boolean);
    return jsonResponse({ items: filtered }, 200);
}

async function getIndex(env) {
    const indexRaw = await env.PLAYBACK_LOGS.get('playback:index', { type: 'json' });
    return Array.isArray(indexRaw) ? indexRaw : [];
}

async function saveIndex(env, index) {
    await env.PLAYBACK_LOGS.put('playback:index', JSON.stringify(index), {
        expirationTtl: TTL_SECONDS
    });
}

async function pruneExpired(env, index) {
    if (!Array.isArray(index) || !index.length) return [];
    const now = Date.now();
    const filtered = [];

    for (const entry of index) {
        if (!entry || !entry.videoId) continue;
        if (!entry.lastUpdated || now - entry.lastUpdated > TTL_MS) {
            await env.PLAYBACK_LOGS.delete(playbackKey(entry.videoId));
            continue;
        }
        filtered.push(entry);
    }
    return filtered;
}

async function enforceIndexLimit(env, index) {
    if (index.length <= MAX_TRACKED_VIDEOS) {
        return index;
    }

    const sorted = [...index].sort((a, b) => b.percentage - a.percentage);
    while (sorted.length > MAX_TRACKED_VIDEOS) {
        const victim = sorted.shift();
        if (victim) {
            await env.PLAYBACK_LOGS.delete(playbackKey(victim.videoId));
        }
    }
    return sorted;
}

function playbackKey(videoId) {
    return `playback:${videoId}`;
}

function clampPercentage(value) {
    if (Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(100, value));
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
        }
    });
}
