/** 从 window.__INITIAL_STATE__ 解析笔记 / 作者信息 */

import { buildUserLink, formatCreateTime } from './comment_api.js';

/** @param {unknown} n */
function statStr(n) {
    if (n == null || n === '') return '';
    return String(n);
}

/** @param {Record<string, string>} obj */
function dropEmpty(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== ''));
}

/** @param {unknown} type */
function formatNoteType(type) {
    if (type === 'video') return '视频';
    if (type === 'normal') return '图文';
    return type ? String(type) : '';
}

/** @param {unknown} item */
function pickImageUrl(item) {
    if (!item || typeof item !== 'object') return '';
    return item.urlDefault ?? item.url_default ?? item.urlPre ?? item.url_pre ?? '';
}

/** @param {unknown} imageList */
function collectImageUrls(imageList) {
    if (!Array.isArray(imageList)) return '';
    return imageList.map(pickImageUrl).filter(Boolean).join(',');
}

/** @param {unknown} imageList */
function pickCoverPic(imageList) {
    const urls = collectImageUrls(imageList);
    return urls.split(',')[0] ?? '';
}

/** @param {unknown} tagList */
function formatTags(tagList) {
    if (!Array.isArray(tagList)) return '';
    return tagList
        .map((t) => (t && typeof t === 'object' ? t.name ?? '' : ''))
        .filter(Boolean)
        .join('、');
}

/**
 * @param {{ currentNoteId?: string, noteDetailMap?: Record<string, { note?: unknown }> }} payload
 * @returns {{ videoInfo: Record<string, string>, authorInfo: Record<string, string> } | null}
 */
export function parseInitialStatePayload(payload) {
    const detailMap = payload?.noteDetailMap;
    if (!detailMap || typeof detailMap !== 'object') return null;

    const noteId = payload.currentNoteId && detailMap[payload.currentNoteId]
        ? payload.currentNoteId
        : Object.keys(detailMap)[0];
    if (!noteId) return null;

    const note = detailMap[noteId]?.note;
    if (!note || typeof note !== 'object') return null;

    const user = note.user ?? {};
    const interact = note.interactInfo ?? {};

    /** @type {Record<string, string>} */
    const videoInfo = dropEmpty({
        noteTitle: note.title ?? '',
        noteId: note.noteId ?? noteId,
        noteType: formatNoteType(note.type),
        coverPic: pickCoverPic(note.imageList),
        images: collectImageUrls(note.imageList),
        desc: note.desc ?? '',
        publishTime: formatCreateTime(note.time),
        updateTime: formatCreateTime(note.lastUpdateTime),
        ipLocation: note.ipLocation ?? '',
        tags: formatTags(note.tagList),
        likeCount: statStr(interact.likedCount),
        collectCount: statStr(interact.collectedCount),
        shareCount: statStr(interact.shareCount),
        commentCount: statStr(interact.commentCount),
    });

    const authorId = String(user.userId ?? '');
    /** @type {Record<string, string>} */
    const authorInfo = dropEmpty({
        authorId,
        authorName: user.nickname ?? '',
        authorAvatar: user.avatar ?? '',
        authorLink: buildUserLink(authorId),
        followed: interact.followed === true ? '是' : interact.followed === false ? '否' : '',
        relation: interact.relation ?? '',
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
            return data
                ? { videoInfo: { ...data.videoInfo }, authorInfo: { ...data.authorInfo } }
                : { videoInfo: {}, authorInfo: {} };
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
