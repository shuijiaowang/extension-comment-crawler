/** B 站视频 view 接口响应解析与缓存 */

import { buildUserLink, formatCtime } from './reply_api.js';

/** @param {unknown} n */
function statStr(n) {
    const num = Number(n);
    return Number.isFinite(num) && num >= 0 ? String(num) : '';
}

/** @param {{ width?: unknown, height?: unknown } | null | undefined} dim */
export function formatResolution(dim) {
    const w = Number(dim?.width);
    const h = Number(dim?.height);
    if (!w || !h) return '';
    return `${w}x${h}`;
}

/** @param {string} url */
export function isViewApi(url) {
    try {
        const path = new URL(url, location.origin).pathname;
        return path === '/x/web-interface/view' || path === '/x/web-interface/wbi/view';
    } catch {
        return false;
    }
}

/** @returns {string} */
function currentPageBvid() {
    const m = location.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/i);
    return m?.[1] ?? '';
}

/** @param {unknown} payload */
export function parseViewApiData(payload) {
    if (!payload || typeof payload !== 'object' || payload.code !== 0) return null;
    const d = payload.data;
    if (!d || typeof d !== 'object') return null;

    const owner = d.owner ?? {};
    const stat = d.stat ?? {};
    const dim = d.dimension ?? d.pages?.[0]?.dimension ?? {};
    const mid = String(owner.mid ?? '');

    /** @type {Record<string, string>} */
    const info = {
        authorId: mid,
        authorName: owner.name ?? '',
        authorAvatar: owner.face ?? '',
        authorLink: buildUserLink(mid),
        videoTitle: d.title ?? '',
        bvid: d.bvid ?? '',
        avid: d.aid != null ? String(d.aid) : '',
        category: d.tname_v2 || d.tname || '',
        coverPic: d.pic ?? '',
        playCount: statStr(stat.view),
        likeCount: statStr(stat.like),
        coinCount: statStr(stat.coin),
        favoriteCount: statStr(stat.favorite),
        shareCount: statStr(stat.share),
        videoCommentCount: statStr(stat.reply),
        danmakuCount: statStr(stat.danmaku),
        publishTime: formatCtime(d.pubdate),
        duration: statStr(d.duration),
        resolution: formatResolution(dim),
    };
    return Object.fromEntries(Object.entries(info).filter(([, v]) => v !== ''));
}

export function createViewCache() {
    /** @type {Record<string, string> | null} */
    let pageInfo = null;

    return {
        get() {
            return pageInfo ? { ...pageInfo } : {};
        },
        /** @param {Record<string, string>} info */
        set(info) {
            pageInfo = info;
        },
        reset() {
            pageInfo = null;
        },
    };
}

/**
 * @param {string} url
 * @param {number} status
 * @param {unknown} payload
 * @param {ReturnType<typeof createViewCache>} cache
 */
export function ingestViewPayload(url, status, payload, cache) {
    if (status !== 200 || !isViewApi(url)) return;
    const parsed = parseViewApiData(payload);
    if (!parsed) return;
    const pageBvid = currentPageBvid();
    if (pageBvid && parsed.bvid && parsed.bvid.toUpperCase() !== pageBvid.toUpperCase()) return;
    cache.set(parsed);
}
