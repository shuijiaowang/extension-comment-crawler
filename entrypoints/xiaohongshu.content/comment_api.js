/** 小红书评论 API 响应解析与缓存 */

/** @param {unknown} ts 毫秒时间戳 */
export function formatCreateTime(ts) {
    const n = Number(ts);
    if (!n || n <= 0) return '';
    const d = new Date(n);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** @param {string} userId */
export function buildUserLink(userId) {
    return userId ? `https://www.xiaohongshu.com/user/profile/${userId}` : '';
}

/** @param {unknown} pictures */
export function extractPictureUrls(pictures) {
    if (!Array.isArray(pictures) || pictures.length === 0) return '';
    return pictures
        .map((p) => (p && typeof p === 'object' ? p.url_default ?? p.urlDefault ?? '' : ''))
        .filter(Boolean)
        .join(',');
}

/** @param {unknown} tags */
export function formatShowTags(tags) {
    if (!Array.isArray(tags)) return { isAuthor: '', tag: '' };
    const isAuthor = tags.includes('is_author') ? '作者' : '';
    const parts = [];
    if (tags.includes('user_top')) parts.push('置顶');
    return { isAuthor, tag: parts.join(' ') };
}

/** @param {unknown} item */
export function parseApiComment(item) {
    if (!item || typeof item !== 'object') return null;
    const user = item.user_info ?? {};
    const userId = user.user_id ?? '';
    const { isAuthor, tag } = formatShowTags(item.show_tags);
    return {
        userId: String(userId),
        userName: user.nickname ?? '',
        userLink: buildUserLink(userId),
        userAvatar: user.image ?? '',
        aiAgent: user.ai_agent === true ? 'AI' : '',
        content: item.content ?? '',
        picture: extractPictureUrls(item.pictures),
        time: formatCreateTime(item.create_time),
        location: item.ip_location ?? '',
        like: String(item.like_count ?? 0),
        isAuthor,
        tag,
        replyCount: item.sub_comment_count != null ? String(item.sub_comment_count) : '',
    };
}

/** @param {string} url */
export function isMainCommentApi(url) {
    return /\/api\/sns\/web\/v2\/comment\/page/.test(url);
}

/** @param {string} url */
export function isSubCommentApi(url) {
    return /\/api\/sns\/web\/v2\/comment\/sub\/page/.test(url);
}

/** @param {unknown} item */
export function getCommentId(item) {
    if (!item || typeof item !== 'object') return '';
    return item.id != null ? String(item.id) : '';
}

/** @param {string} url */
export function getRootFromSubUrl(url) {
    try {
        return new URL(url, location.origin).searchParams.get('root_comment_id');
    } catch {
        const m = String(url).match(/[?&]root_comment_id=([^&]+)/);
        return m?.[1] ?? null;
    }
}

/** @param {unknown} payload */
export function isApiSuccess(payload) {
    return payload?.code === 0 || payload?.success === true;
}

export function createCommentCache() {
    /** @type {Map<string, ReturnType<typeof parseApiComment>>} */
    const roots = new Map();
    /** @type {string[]} */
    const rootOrder = [];
    /** @type {Map<string, Map<string, ReturnType<typeof parseApiComment>>>} */
    const repliesByRoot = new Map();

    const upsertRoot = (rootId, item) => {
        const row = parseApiComment(item);
        if (!row) return;
        if (!roots.has(rootId)) rootOrder.push(rootId);
        roots.set(rootId, row);
    };

    const insertPinnedRoot = (rootId, item) => {
        const row = parseApiComment(item);
        if (!row) return;
        roots.set(rootId, row);
        upsertSubReplies(rootId, item.sub_comments);
        const idx = rootOrder.indexOf(rootId);
        if (idx >= 0) rootOrder.splice(idx, 1);
        rootOrder.unshift(rootId);
    };

    const upsertSubReplies = (rootId, list) => {
        if (!rootId || !Array.isArray(list) || list.length === 0) return;
        if (!repliesByRoot.has(rootId)) repliesByRoot.set(rootId, new Map());
        const map = repliesByRoot.get(rootId);
        for (const item of list) {
            const id = getCommentId(item);
            if (!id || map.has(id)) continue;
            const row = parseApiComment(item);
            if (row) map.set(id, row);
        }
    };

    const ingestComment = (item) => {
        const rootId = getCommentId(item);
        if (!rootId) return;
        const pinned = Array.isArray(item.show_tags) && item.show_tags.includes('user_top');
        if (pinned) insertPinnedRoot(rootId, item);
        else upsertRoot(rootId, item);
        upsertSubReplies(rootId, item.sub_comments);
    };

    return {
        roots,
        rootOrder,
        repliesByRoot,
        reset() {
            roots.clear();
            rootOrder.length = 0;
            repliesByRoot.clear();
        },
        upsertRoot,
        upsertSubReplies,
        /** @param {unknown} payload */
        ingestMainData(payload) {
            const comments = payload?.data?.comments;
            if (!Array.isArray(comments)) return;
            for (const item of comments) ingestComment(item);
        },
        getSubReplies(rootId, limit = Infinity) {
            const map = repliesByRoot.get(rootId);
            if (!map) return [];
            const list = [...map.values()];
            return limit === Infinity ? list : list.slice(0, limit);
        },
        subReplyCount(rootId) {
            return repliesByRoot.get(rootId)?.size ?? 0;
        },
        /** @param {unknown} item */
        expectedSubReplyCount(item) {
            const n = Number(item?.sub_comment_count);
            return Number.isFinite(n) && n >= 0 ? n : 0;
        },
    };
}

/**
 * @param {string} url
 * @param {number} status
 * @param {unknown} payload
 * @param {ReturnType<typeof createCommentCache>} cache
 */
export function ingestHookPayload(url, status, payload, cache) {
    if (status !== 200 || !isApiSuccess(payload)) return;
    if (isMainCommentApi(url)) {
        cache.ingestMainData(payload);
        return;
    }
    if (isSubCommentApi(url)) {
        const rootId = getRootFromSubUrl(url);
        cache.upsertSubReplies(rootId, payload?.data?.comments);
    }
}
