import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import {
    DEFAULT_DOMAIN_CONFIG,
    getDomainConfigStorage,
    MESSAGE_START_CRAWL,
} from '../core/config.js';

export const useConfigStore = defineStore('config', () => {
    const hostname = ref('');
    const tabError = ref('');
    const domainConfig = reactive({ ...DEFAULT_DOMAIN_CONFIG });

    const loadActiveTabConfig = async () => {
        tabError.value = '';
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url?.startsWith('http')) {
            hostname.value = '';
            tabError.value = '请在目标网页标签页打开 popup';
            Object.assign(domainConfig, { ...DEFAULT_DOMAIN_CONFIG });
            return;
        }
        hostname.value = new URL(tab.url).hostname;
        const saved = await getDomainConfigStorage(hostname.value).getValue();
        Object.assign(domainConfig, { ...DEFAULT_DOMAIN_CONFIG }, saved);
    };

    const saveConfig = async () => {
        if (!hostname.value) return;
        await getDomainConfigStorage(hostname.value).setValue({ ...domainConfig });
    };

    const notifyContentScript = async (type) => {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
            throw new Error('无活动标签页');
        }
        return browser.tabs.sendMessage(tab.id, { type });
    };

    const startCrawl = async () => {
        await saveConfig();
        return notifyContentScript(MESSAGE_START_CRAWL);
    };

    return {
        hostname,
        tabError,
        domainConfig,
        loadActiveTabConfig,
        saveConfig,
        startCrawl,
        notifyContentScript,
    };
});
