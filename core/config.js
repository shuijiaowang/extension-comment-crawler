/** @typedef {typeof DEFAULT_DOMAIN_CONFIG} DomainConfig */
/** @typedef {{ id: string, primary: string, primaryHover: string, primaryRgb: string }} PlatformTheme */

export const MESSAGE_START_CRAWL = 'START_CRAWL';
export const MESSAGE_START_QUEUE = 'START_CRAWL_QUEUE';
export const MESSAGE_OPEN_RECORDS = 'OPEN_RECORDS';

/** 连续无法滚动且没有新评论时，再尝试几次才结束 */
export const CRAWL_SCROLL_STALL_LIMIT = 3;

export class CrawlAbortedError extends Error {
    constructor() {
        super('用户已结束爬取');
        this.name = 'CrawlAbortedError';
    }
}

/** 队列中每个页面加载完成后的等待时间（毫秒） */
export const QUEUE_PAGE_LOAD_WAIT_MS = 5000;

/** 各平台 popup 默认主题色（按 hostname 匹配，先匹配先生效） */
export const PLATFORM_THEME_ENTRIES = [
    {
        id: 'xiaohongshu',
        test: (hostname) => hostname.includes('xiaohongshu'),
        primary: '#ff2442',
        primaryHover: '#ff4d63',
        primaryRgb: '255 36 66',
    },
    {
        id: 'bilibili',
        test: (hostname) => hostname.includes('bilibili'),
        primary: '#fb7299',
        primaryHover: '#ff85a8',
        primaryRgb: '251 114 153',
    },
    {
        id: 'zhihu',
        test: (hostname) => hostname.includes('zhihu'),
        primary: '#0066ff',
        primaryHover: '#3385ff',
        primaryRgb: '0 102 255',
    },
    {
        id: 'douyin',
        test: (hostname) => hostname.includes('douyin'),
        primary: '#25f4ee',
        primaryHover: '#5df7f2',
        primaryRgb: '37 244 238',
    },
];

/** @type {PlatformTheme} */
export const DEFAULT_PLATFORM_THEME = {
    id: 'default',
    primary: '#7c8aff',
    primaryHover: '#95a3ff',
    primaryRgb: '124 138 255',
};

/** @param {string} [hostname] */
export function resolvePlatformTheme(hostname = '') {
    return (
        PLATFORM_THEME_ENTRIES.find((entry) => entry.test(hostname)) ?? DEFAULT_PLATFORM_THEME
    );
}

export const DELAY_JITTER_MS = 50;

/** @param {number} baseMs 基准毫秒，实际休眠在 [baseMs-50, baseMs+50] 随机 */
export function delayMs(baseMs) {
    const ms = Math.max(0, baseMs - DELAY_JITTER_MS + Math.random() * DELAY_JITTER_MS * 2);
    return new Promise((r) => setTimeout(r, ms));
}

export const DEFAULT_DOMAIN_CONFIG = {
    pluginEnabled: false,
    commentLimit: 100,
    commentTotalLimit: 0,
    commentReplisePageSizeLimit: 1,
    commentReplyLimit: 50,
    crawlReplies: false,
    clickDelay: 500,
    scrollDelay: 500,
    scrollStep: 400,
};

/** 累计评论数：一级 + 全部二级 */
export function countTotalComments(results) {
    return results.reduce((n, row) => n + 1 + (row.replies?.length ?? 0), 0);
}

/** 累计上限剩余可采集条数；0 或未设置表示不限制 */
export function remainingTotalQuota(results, commentTotalLimit) {
    const limit = Number(commentTotalLimit);
    if (!limit || limit <= 0) return Infinity;
    return Math.max(0, limit - countTotalComments(results));
}

export function isTotalLimitReached(results, commentTotalLimit) {
    const limit = Number(commentTotalLimit);
    if (!limit || limit <= 0) return false;
    return countTotalComments(results) >= limit;
}

/** @param {number} commentReplyLimit 单条一级下的二级上限，0 表示不采二级 */
export function effectiveReplyLimit(commentReplyLimit, maxReplies) {
    const perParent = Number(commentReplyLimit) > 0 ? Number(commentReplyLimit) : Infinity;
    return Math.min(perParent, maxReplies);
}

/** @param {Record<string, unknown>} [raw] */
export function normalizeDomainConfig(raw = {}) {
    const cfg = { ...DEFAULT_DOMAIN_CONFIG, ...raw };
    if (raw.delayMin != null || raw.delayMax != null) {
        const mid = Math.round(
            ((Number(raw.delayMin) || 400) + (Number(raw.delayMax) || 800)) / 2,
        );
        if (raw.clickDelay == null) cfg.clickDelay = mid;
        if (raw.scrollDelay == null) cfg.scrollDelay = mid;
    }
    return cfg;
}

/** @param {string} hostname */
export function getDomainConfigStorage(hostname) {
    return storage.defineItem(`local:${hostname}`, {
        fallback: { ...DEFAULT_DOMAIN_CONFIG },
    });
}

export const appState = {
    domainConfigStorage: null,
    domainConfig: { ...DEFAULT_DOMAIN_CONFIG },
    saveDomainConfig: async () => {
        if (appState.domainConfigStorage) {
            await appState.domainConfigStorage.setValue({ ...appState.domainConfig });
        }
    },
};
