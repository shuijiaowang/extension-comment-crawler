/** 从 window.__INITIAL_STATE__ 解析视频 / UP 主信息 */

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

/** @param {Record<string, string>} obj */
function dropEmpty(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== ''));
}

/**
 * @param {{ videoData?: unknown, upData?: unknown }} payload
 * @returns {{ videoInfo: Record<string, string>, authorInfo: Record<string, string> } | null}
 */
export function parseInitialStatePayload(payload) {
    const videoData = payload?.videoData;
    if (!videoData || typeof videoData !== 'object') return null;

    const up = payload.upData && typeof payload.upData === 'object' ? payload.upData : {};
    const stat = videoData.stat ?? {};
    const dim = videoData.dimension ?? videoData.pages?.[0]?.dimension ?? {};
    const owner = videoData.owner ?? {};

    /** @type {Record<string, string>} */
    const videoInfo = dropEmpty({
        videoTitle: videoData.title ?? '',
        bvid: videoData.bvid ?? '',
        avid: videoData.aid != null ? String(videoData.aid) : '',
        category: videoData.tname_v2 || videoData.tname || '',
        coverPic: videoData.pic ?? '',
        publishTime: formatCtime(videoData.pubdate),
        duration: statStr(videoData.duration),
        resolution: formatResolution(dim),
        cid: videoData.cid != null ? String(videoData.cid) : '',
        desc: videoData.desc ?? '',
        dynamic: videoData.dynamic ?? '',
        playCount: statStr(stat.view),
        likeCount: statStr(stat.like),
        coinCount: statStr(stat.coin),
        favoriteCount: statStr(stat.favorite),
        shareCount: statStr(stat.share),
        videoCommentCount: statStr(stat.reply),
        danmakuCount: statStr(stat.danmaku),
    });

    const mid = String(up.mid ?? owner.mid ?? '');
    /** @type {Record<string, string>} */
    const authorInfo = dropEmpty({
        authorId: mid,
        authorName: up.name ?? owner.name ?? '',
        authorAvatar: up.face ?? owner.face ?? '',
        authorLink: buildUserLink(mid),
        sex: up.sex ?? '',
        sign: up.sign ?? '',
        fans: statStr(up.fans),
        following: statStr(up.attention),
        level: statStr(up.level_info?.current_level),
        vip: up.vip?.label?.text ?? '',
        official: up.official_verify?.desc || up.Official?.title || '',
        archiveCount: statStr(up.archiveCount),
        nameplate: up.nameplate?.name ?? '',
    });

    if (!Object.keys(videoInfo).length && !Object.keys(authorInfo).length) return null;
    return { videoInfo, authorInfo };
}

export function createPageMetaCache() {
    /** @type {{ videoInfo: Record<string, string>, authorInfo: Record<string, string> } | null} */
    let data = null;

    return {
        hasData() {
            return Boolean(data && (Object.keys(data.videoInfo).length || Object.keys(data.authorInfo).length));
        },
        get() {
            return data ? { videoInfo: { ...data.videoInfo }, authorInfo: { ...data.authorInfo } } : { videoInfo: {}, authorInfo: {} };
        },
        /** @param {{ videoInfo?: Record<string, string>, authorInfo?: Record<string, string> }} parsed */
        set(parsed) {
            if (!parsed) return;
            data = {
                videoInfo: { ...(parsed.videoInfo ?? {}) },
                authorInfo: { ...(parsed.authorInfo ?? {}) },
            };
        },
        /** @param {unknown} payload */
        ingest(payload) {
            const parsed = parseInitialStatePayload(payload);
            if (parsed) data = parsed;
        },
    };
}
