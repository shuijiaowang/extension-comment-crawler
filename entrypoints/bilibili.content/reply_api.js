/** B 站评论 API 响应解析与缓存 */

/** @param {unknown} ts Unix 秒级时间戳 */
export function formatCtime(ts) {
    const n = Number(ts);
    if (!n || n <= 0) return '';
    const d = new Date(n * 1000);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** @param {unknown} content */
export function extractPictureUrls(content) {
    if (!content || typeof content !== 'object') return '';
    const pictures = content.pictures;
    if (!Array.isArray(pictures) || pictures.length === 0) return '';
    return pictures
        .map((p) => (p && typeof p === 'object' ? p.img_src ?? p.imgSrc ?? '' : ''))
        .filter(Boolean)
        .join(',');
}

/** @param {string} mid */
export function buildUserLink(mid) {
    return mid ? `https://space.bilibili.com/${mid}/` : '';
}

/** @param {unknown} item */
export function isTopLevelReply(item) {
    if (!item || typeof item !== 'object') return false;
    const root = item.root_str ?? String(item.root ?? '');
    const parent = item.parent_str ?? String(item.parent ?? '');
    return root === '0' || parent === '0';
}

/** @param {unknown} member */
export function parseMemberFields(member) {
    if (!member || typeof member !== 'object') {
        return {
            userAvatar: '',
            sex: '',
            sign: '',
            level: '',
            vip: '',
            official: '',
            nameplate: '',
        };
    }
    const level = member.level_info?.current_level;
    return {
        userAvatar: member.avatar ?? '',
        sex: member.sex ?? '',
        sign: member.sign ?? '',
        level: level != null && level !== '' ? String(level) : '',
        vip: member.vip?.label?.text ?? '',
        official: member.official_verify?.desc ?? '',
        nameplate: member.nameplate?.name ?? '',
    };
}

/**
 * @param {unknown} item
 * @param {{ upperMid?: string }} [ctx]
 */
export function parseApiReply(item, ctx = {}) {
    if (!item || typeof item !== 'object') return null;
    const mid = item.member?.mid ?? '';
    const upperMid = ctx.upperMid ? String(ctx.upperMid) : '';
    return {
        userId: String(mid),
        userName: item.member?.uname ?? '',
        userLink: buildUserLink(mid),
        ...parseMemberFields(item.member),
        content: item.content?.message ?? '',
        picture: extractPictureUrls(item.content),
        time: formatCtime(item.ctime),
        location: item.reply_control?.location ?? '',
        like: String(item.like ?? 0),
        isAuthor: upperMid && String(mid) === upperMid ? '作者' : '',
        tag: '',
    };
}

/** @param {string} url */
export function isMainReplyApi(url) {
    return /\/x\/v2\/reply\/(?:wbi\/)?main/.test(url);
}

/** @param {string} url */
export function isSubReplyApi(url) {
    return /\/x\/v2\/reply\/reply/.test(url);
}

/** @param {unknown} item */
export function getRootId(item) {
    if (!item || typeof item !== 'object') return '';
    return item.rpid_str ?? String(item.rpid ?? '');
}

/** @param {string} url */
export function getRootFromReplyUrl(url) {
    try {
        return new URL(url, location.origin).searchParams.get('root');
    } catch {
        const m = String(url).match(/[?&]root=(\d+)/);
        return m?.[1] ?? null;
    }
}

export function createReplyCache() {
    /** @type {Map<string, ReturnType<typeof parseApiReply>>} */
    const roots = new Map();
    /** @type {string[]} */
    const rootOrder = [];
    /** @type {Map<string, Map<string, ReturnType<typeof parseApiReply>>>} */
    const repliesByRoot = new Map();
    /** @type {string} */
    let upperMid = '';

    const replyCtx = () => (upperMid ? { upperMid } : {});

    const upsertRoot = (rootId, item) => {
        const row = parseApiReply(item, replyCtx());
        if (!row) return;
        if (!roots.has(rootId)) rootOrder.push(rootId);
        roots.set(rootId, row);
    };

    /** 置顶评论插入列表最前（管理员置顶在前，UP 置顶在后） */
    const insertPinnedRoots = (items) => {
        const ids = [];
        for (const item of items) {
            const rootId = getRootId(item);
            if (!rootId) continue;
            const row = parseApiReply(item, replyCtx());
            if (!row) continue;
            row.tag = '置顶';
            roots.set(rootId, row);
            upsertSubReplies(rootId, item.replies);
            if (!ids.includes(rootId)) ids.push(rootId);
        }
        for (const id of ids) {
            const idx = rootOrder.indexOf(id);
            if (idx >= 0) rootOrder.splice(idx, 1);
        }
        rootOrder.unshift(...ids);
    };

    const ingestThread = (thread) => {
        if (thread?.root && (thread.root.rpid != null || thread.root.rpid_str)) {
            const rootItem = thread.root;
            const rootId = getRootId(rootItem);
            upsertRoot(rootId, rootItem);
            upsertSubReplies(rootId, thread.replies);
            return;
        }
        if (isTopLevelReply(thread)) {
            const rootId = getRootId(thread);
            upsertRoot(rootId, thread);
            upsertSubReplies(rootId, thread.replies);
        }
    };

    const upsertSubReplies = (rootId, list) => {
        if (!rootId || !Array.isArray(list) || list.length === 0) return;
        if (!repliesByRoot.has(rootId)) repliesByRoot.set(rootId, new Map());
        const map = repliesByRoot.get(rootId);
        for (const item of list) {
            const id = item?.rpid_str ?? String(item?.rpid ?? '');
            if (!id || map.has(id)) continue;
            const row = parseApiReply(item, replyCtx());
            if (row) map.set(id, row);
        }
    };

    return {
        roots,
        rootOrder,
        repliesByRoot,
        reset() {
            roots.clear();
            rootOrder.length = 0;
            repliesByRoot.clear();
            upperMid = '';
        },
        upsertRoot,
        upsertSubReplies,
        /** @param {unknown} data */
        ingestMainData(data) {
            const body = data?.data;
            if (!body) return;

            if (body.upper?.mid != null) upperMid = String(body.upper.mid);

            const pinned = [];
            const top = body.top;
            if (top?.admin) pinned.push(top.admin);
            if (top?.upper) pinned.push(top.upper);
            insertPinnedRoots(pinned);

            if (Array.isArray(body.top_replies)) {
                for (const thread of body.top_replies) {
                    if (thread?.root && (thread.root.rpid != null || thread.root.rpid_str)) {
                        insertPinnedRoots([thread.root]);
                        upsertSubReplies(getRootId(thread.root), thread.replies);
                    } else if (isTopLevelReply(thread)) {
                        insertPinnedRoots([thread]);
                    }
                }
            }

            const threads = body.replies;
            if (!Array.isArray(threads)) return;
            for (const thread of threads) {
                ingestThread(thread);
            }
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
    };
}

/**
 * @param {string} url
 * @param {number} status
 * @param {unknown} payload
 * @param {ReturnType<typeof createReplyCache>} cache
 */
export function ingestHookPayload(url, status, payload, cache) {
    if (status !== 200 || payload?.code !== 0) return;
    if (isMainReplyApi(url)) {
        cache.ingestMainData(payload);
        return;
    }
    if (isSubReplyApi(url)) {
        const rootId = getRootFromReplyUrl(url);
        cache.upsertSubReplies(rootId, payload?.data?.replies);
    }
}
