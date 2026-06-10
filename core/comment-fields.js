import { PLATFORM_IDS } from './records.js';

/** @typedef {{ key: string, label: string, textarea?: boolean }} CommentFieldDef */

/** @type {CommentFieldDef[]} */
const BASE_COMMENT_FIELDS = [
    { key: 'userName', label: '昵称' },
    { key: 'userId', label: '用户 ID' },
    { key: 'userLink', label: '主页链接' },
    { key: 'content', label: '内容', textarea: true },
    { key: 'picture', label: '图片' },
    { key: 'time', label: '时间' },
    { key: 'location', label: '地点' },
    { key: 'like', label: '点赞' },
];

/** 各平台可显示/导出的评论字段（含本站特有字段） */
/** @type {Record<string, CommentFieldDef[]>} */
export const PLATFORM_COMMENT_FIELDS = {
    bilibili: [
        ...BASE_COMMENT_FIELDS.slice(0, 3),
        { key: 'userAvatar', label: '头像' },
        ...BASE_COMMENT_FIELDS.slice(3),
        { key: 'sex', label: '性别' },
        { key: 'sign', label: '签名' },
        { key: 'isAuthor', label: '是否作者' },
        { key: 'tag', label: '标签' },
        { key: 'vip', label: '大会员' },
        { key: 'level', label: '等级' },
        { key: 'official', label: '认证' },
        { key: 'nameplate', label: '勋章' },
    ],
    douyin: [...BASE_COMMENT_FIELDS],
    xiaohongshu: [
        ...BASE_COMMENT_FIELDS,
        { key: 'isAuthor', label: '是否作者' },
    ],
    zhihu: [
        ...BASE_COMMENT_FIELDS,
        { key: 'tag', label: '标签' },
    ],
};

/** @param {string} platformId */
export function getPlatformCommentFields(platformId) {
    return PLATFORM_COMMENT_FIELDS[platformId] ?? BASE_COMMENT_FIELDS;
}

/** @param {string} platformId */
function defaultFieldVisibility(platformId) {
    return Object.fromEntries(getPlatformCommentFields(platformId).map((f) => [f.key, true]));
}

/** 各平台独立记忆显示/导出字段勾选 */
/** @param {string} platformId */
export function getFieldVisibilityStorage(platformId) {
    return storage.defineItem(`local:records-field-visibility:${platformId}`, {
        fallback: defaultFieldVisibility(platformId),
    });
}

/** 从旧版全局配置迁移到各平台（仅执行一次） */
export async function migrateLegacyFieldVisibility() {
    const legacy = storage.defineItem('local:records-field-visibility', {
        fallback: null,
    });
    const saved = await legacy.getValue();
    if (!saved) return;

    for (const platformId of PLATFORM_IDS) {
        const item = getFieldVisibilityStorage(platformId);
        const current = await item.getValue();
        const fields = getPlatformCommentFields(platformId);
        /** @type {Record<string, boolean>} */
        const merged = { ...current };
        for (const f of fields) {
            if (saved[f.key] != null) {
                merged[f.key] = saved[f.key];
            }
        }
        await item.setValue(merged);
    }
    await legacy.removeValue();
}
