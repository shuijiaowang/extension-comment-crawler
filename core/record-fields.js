/** @typedef {{ key: string, label: string, link?: boolean, suffix?: string, image?: boolean, multiImage?: boolean }} RecordFieldDef */

/** @type {Record<string, RecordFieldDef[]>} */
export const PLATFORM_VIDEO_FIELDS = {
    bilibili: [
        { key: 'videoTitle', label: '标题' },
        { key: 'bvid', label: 'BV号' },
        { key: 'avid', label: 'AV号' },
        { key: 'cid', label: 'CID' },
        { key: 'category', label: '分区' },
        { key: 'coverPic', label: '封面', link: true, image: true },
        { key: 'publishTime', label: '发布时间' },
        { key: 'duration', label: '时长', suffix: '秒' },
        { key: 'resolution', label: '分辨率' },
        { key: 'desc', label: '简介' },
        { key: 'dynamic', label: '动态' },
        { key: 'playCount', label: '播放量' },
        { key: 'likeCount', label: '点赞' },
        { key: 'coinCount', label: '投币' },
        { key: 'favoriteCount', label: '收藏' },
        { key: 'shareCount', label: '分享' },
        { key: 'videoCommentCount', label: '评论数' },
        { key: 'danmakuCount', label: '弹幕' },
    ],
    douyin: [],
    xiaohongshu: [
        { key: 'noteTitle', label: '标题' },
        { key: 'noteId', label: '笔记ID' },
        { key: 'noteType', label: '类型' },
        { key: 'coverPic', label: '封面', link: true, image: true },
        { key: 'images', label: '图文', link: true, multiImage: true },
        { key: 'desc', label: '正文' },
        { key: 'publishTime', label: '发布时间' },
        { key: 'updateTime', label: '更新时间' },
        { key: 'ipLocation', label: 'IP属地' },
        { key: 'tags', label: '话题' },
        { key: 'likeCount', label: '点赞' },
        { key: 'collectCount', label: '收藏' },
        { key: 'shareCount', label: '分享' },
        { key: 'commentCount', label: '评论数' },
    ],
    zhihu: [],
};

/** @type {Record<string, RecordFieldDef[]>} */
export const PLATFORM_AUTHOR_FIELDS = {
    bilibili: [
        { key: 'authorName', label: '昵称' },
        { key: 'authorId', label: 'mid' },
        { key: 'authorAvatar', label: '头像', link: true, image: true },
        { key: 'authorLink', label: '主页', link: true },
        { key: 'sex', label: '性别' },
        { key: 'sign', label: '签名' },
        { key: 'fans', label: '粉丝' },
        { key: 'following', label: '关注' },
        { key: 'level', label: '等级' },
        { key: 'vip', label: '大会员' },
        { key: 'official', label: '认证' },
        { key: 'archiveCount', label: '投稿数' },
        { key: 'nameplate', label: '勋章' },
    ],
    douyin: [],
    xiaohongshu: [
        { key: 'authorName', label: '昵称' },
        { key: 'authorId', label: '用户ID' },
        { key: 'authorAvatar', label: '头像', link: true, image: true },
        { key: 'authorLink', label: '主页', link: true },
        { key: 'followed', label: '已关注' },
        { key: 'relation', label: '关系' },
    ],
    zhihu: [],
};

/** @param {string} platformId */
export function getPlatformVideoFields(platformId) {
    return PLATFORM_VIDEO_FIELDS[platformId] ?? [];
}

/** @param {string} platformId */
export function getPlatformAuthorFields(platformId) {
    return PLATFORM_AUTHOR_FIELDS[platformId] ?? [];
}

/** @param {string} platformId @param {RecordFieldDef[]} fields */
function defaultVisibility(fields) {
    return Object.fromEntries(fields.map((f) => [f.key, true]));
}

/** @param {string} platformId */
export function getVideoFieldVisibilityStorage(platformId) {
    return storage.defineItem(`local:records-video-fields:${platformId}`, {
        fallback: defaultVisibility(getPlatformVideoFields(platformId)),
    });
}

/** @param {string} platformId */
export function getAuthorFieldVisibilityStorage(platformId) {
    return storage.defineItem(`local:records-author-fields:${platformId}`, {
        fallback: defaultVisibility(getPlatformAuthorFields(platformId)),
    });
}

/** @param {import('./record-fields.js').RecordFieldDef} field @param {string} value */
export function formatRecordFieldValue(field, value) {
    return `${value}${field.suffix ?? ''}`;
}

/** 旧版 pageInfo 字段 key → 分区 */
const LEGACY_PAGE_INFO_KEYS = {
    authorName: 'author',
    authorId: 'author',
    authorAvatar: 'author',
    authorLink: 'author',
    sex: 'author',
    sign: 'author',
    fans: 'author',
    following: 'author',
    level: 'author',
    vip: 'author',
    official: 'author',
    archiveCount: 'author',
    nameplate: 'author',
};

/**
 * @param {import('./records.js').CrawlRecord} record
 * @returns {{ videoInfo: Record<string, string>, authorInfo: Record<string, string> }}
 */
export function resolveRecordMeta(record) {
    if (record.videoInfo || record.authorInfo) {
        return {
            videoInfo: { ...(record.videoInfo ?? {}) },
            authorInfo: { ...(record.authorInfo ?? {}) },
        };
    }
    const videoInfo = {};
    const authorInfo = {};
    const legacy = record.pageInfo ?? {};
    for (const [key, val] of Object.entries(legacy)) {
        if (!val) continue;
        if (LEGACY_PAGE_INFO_KEYS[key] === 'author') authorInfo[key] = val;
        else videoInfo[key] = val;
    }
    return { videoInfo, authorInfo };
}
