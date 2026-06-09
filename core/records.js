import { resolvePlatformTheme } from './config.js';

/** @typedef {{
 *   userId: string, userName: string, userLink: string, content: string,
 *   picture: string, time: string, location: string, like: string,
 *   isAuthor?: string, tag?: string, vip?: string, level?: string,
 *   replies?: CommentItem[]
 * }} CommentItem */

/** @typedef {{
 *   id: string, url: string, title: string, crawledAt: string,
 *   commentCount: number, comments: CommentItem[]
 * }} CrawlRecord */

export const PLATFORM_IDS = ['bilibili', 'douyin', 'xiaohongshu', 'zhihu'];

export const PLATFORM_LABELS = {
    bilibili: 'B站',
    douyin: '抖音',
    xiaohongshu: '小红书',
    zhihu: '知乎',
};

/** @param {string} [hostname] */
export function resolvePlatformId(hostname = '') {
    const theme = resolvePlatformTheme(hostname);
    return theme.id === 'default' ? null : theme.id;
}

/** @param {string} platformId */
export function getPlatformRecordsStorage(platformId) {
    return storage.defineItem(`local:records:${platformId}`, {
        fallback: [],
    });
}

/** @param {CommentItem[]} comments */
function cloneComments(comments) {
    return comments.map((c) => ({
        ...c,
        replies: [...(c.replies ?? [])],
    }));
}

/**
 * 爬取完成后追加一条记录（按平台独立、累计数组，新记录在前）
 * @param {string} hostname
 * @param {{ url: string, title?: string, comments: CommentItem[] }} payload
 */
export async function appendCrawlRecord(hostname, { url, title = '', comments }) {
    const platformId = resolvePlatformId(hostname);
    if (!platformId || !comments?.length) return null;

    const item = getPlatformRecordsStorage(platformId);
    const list = [...(await item.getValue())];
    /** @type {CrawlRecord} */
    const record = {
        id: globalThis.crypto.randomUUID(),
        url,
        title,
        crawledAt: new Date().toISOString(),
        commentCount: comments.length,
        comments: cloneComments(comments),
    };
    list.unshift(record);
    await item.setValue(list);
    return record;
}

/** content script 爬取完成后调用 */
export async function saveCrawlResults(hostname, results) {
    if (!results?.length) return null;
    return appendCrawlRecord(hostname, {
        url: globalThis.location.href,
        title: globalThis.document.title,
        comments: results,
    });
}

/** @param {string} platformId @param {string} recordId */
export async function deleteRecord(platformId, recordId) {
    const item = getPlatformRecordsStorage(platformId);
    const list = [...(await item.getValue())];
    const next = list.filter((r) => r.id !== recordId);
    await item.setValue(next);
    return next;
}

/** @param {string} platformId */
export async function clearPlatformRecords(platformId) {
    await getPlatformRecordsStorage(platformId).setValue([]);
}

/**
 * @param {string} platformId
 * @param {string} recordId
 * @param {Partial<CrawlRecord>} patch
 */
export async function updateRecord(platformId, recordId, patch) {
    const item = getPlatformRecordsStorage(platformId);
    const list = [...(await item.getValue())];
    const idx = list.findIndex((r) => r.id === recordId);
    if (idx < 0) return list;
    list[idx] = { ...list[idx], ...patch };
    if (patch.comments) {
        list[idx].commentCount = patch.comments.length;
        list[idx].comments = cloneComments(patch.comments);
    }
    await item.setValue(list);
    return list;
}

/**
 * @param {string} platformId
 * @param {string} recordId
 * @param {number} commentIndex
 * @param {Partial<CommentItem>} patch
 */
export async function updateComment(platformId, recordId, commentIndex, patch) {
    const item = getPlatformRecordsStorage(platformId);
    const list = [...(await item.getValue())];
    const record = list.find((r) => r.id === recordId);
    if (!record?.comments[commentIndex]) return list;
    record.comments[commentIndex] = { ...record.comments[commentIndex], ...patch };
    record.commentCount = record.comments.length;
    await item.setValue(list);
    return list;
}

/**
 * @param {string} platformId
 * @param {string} recordId
 * @param {number} commentIndex
 * @param {number} [replyIndex] 不传则删一级评论
 */
export async function deleteComment(platformId, recordId, commentIndex, replyIndex) {
    const item = getPlatformRecordsStorage(platformId);
    const list = [...(await item.getValue())];
    const record = list.find((r) => r.id === recordId);
    if (!record) return list;

    if (replyIndex == null) {
        record.comments.splice(commentIndex, 1);
    } else {
        const comment = record.comments[commentIndex];
        if (comment?.replies) {
            comment.replies.splice(replyIndex, 1);
        }
    }
    record.commentCount = record.comments.length;
    await item.setValue(list);
    return list;
}
