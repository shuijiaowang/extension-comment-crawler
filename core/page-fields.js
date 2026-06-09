/** @typedef {{ key: string, label: string, link?: boolean, group?: 'meta' | 'stat', suffix?: string }} PageFieldDef */

/** 各平台页面/作品元信息字段（爬取记录页展示） */
/** @type {Record<string, PageFieldDef[]>} */
export const PLATFORM_PAGE_FIELDS = {
    bilibili: [
        { key: 'authorName', label: 'UP主' },
        { key: 'authorId', label: 'mid' },
        { key: 'authorAvatar', label: '头像' },
        { key: 'authorLink', label: '主页', link: true },
        { key: 'videoTitle', label: '标题' },
        { key: 'bvid', label: 'BV' },
        { key: 'avid', label: 'AV' },
        { key: 'category', label: '分区' },
        { key: 'coverPic', label: '封面' },
        { key: 'publishTime', label: '发布', group: 'meta' },
        { key: 'duration', label: '时长', group: 'meta', suffix: '秒' },
        { key: 'resolution', label: '分辨率', group: 'meta' },
        { key: 'playCount', label: '播放', group: 'stat' },
        { key: 'likeCount', label: '点赞', group: 'stat' },
        { key: 'coinCount', label: '投币', group: 'stat' },
        { key: 'favoriteCount', label: '收藏', group: 'stat' },
        { key: 'shareCount', label: '分享', group: 'stat' },
        { key: 'videoCommentCount', label: '评论', group: 'stat' },
        { key: 'danmakuCount', label: '弹幕', group: 'stat' },
    ],
    douyin: [],
    xiaohongshu: [],
    zhihu: [],
};

/** @param {string} platformId */
export function getPlatformPageFields(platformId) {
    return PLATFORM_PAGE_FIELDS[platformId] ?? [];
}

/** @param {string} platformId */
export function getPlatformPageMetaFields(platformId) {
    return getPlatformPageFields(platformId).filter((f) => f.group === 'meta');
}

/** @param {string} platformId */
export function getPlatformPageStatFields(platformId) {
    return getPlatformPageFields(platformId).filter((f) => f.group === 'stat');
}
