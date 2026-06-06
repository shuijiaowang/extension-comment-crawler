/** @typedef {typeof DEFAULT_DOMAIN_CONFIG} DomainConfig */
/** @typedef {{ id: string, primary: string, primaryHover: string, primaryRgb: string }} PlatformTheme */

export const MESSAGE_START_CRAWL = 'START_CRAWL';

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

export const DEFAULT_DOMAIN_CONFIG = {
    pluginEnabled: false,
    commentLimit: 100,
    commentReplisePageSizeLimit: 1,
    commentReplyLimit: 50,
    crawlReplies: false,
    delayMin: 400,
    delayMax: 800,
    scrollStep: 400,
};

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
