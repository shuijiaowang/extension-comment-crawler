/** @typedef {typeof DEFAULT_DOMAIN_CONFIG} DomainConfig */

export const MESSAGE_START_CRAWL = 'START_CRAWL';

export const DEFAULT_DOMAIN_CONFIG = {
    pluginEnabled: false,
    commentLimit: 100,
    commentReplisePageSizeLimit: 1,
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
