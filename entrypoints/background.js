import {
    MESSAGE_START_CRAWL,
    MESSAGE_START_QUEUE,
    QUEUE_PAGE_LOAD_WAIT_MS,
} from '../core/config.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/** 等待指定标签页加载完成（status === 'complete'） */
function waitForTabComplete(tabId) {
    return new Promise((resolve) => {
        const onUpdated = (id, changeInfo) => {
            if (id === tabId && changeInfo.status === 'complete') {
                browser.tabs.onUpdated.removeListener(onUpdated);
                resolve();
            }
        };
        browser.tabs.onUpdated.addListener(onUpdated);
    });
}

/** 依次打开每个链接并触发爬取，前一个爬完再开下一个 */
async function runQueue(urls) {
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const label = `[队列 ${i + 1}/${urls.length}]`;
        console.log(`${label} 打开`, url);
        try {
            const tab = await browser.tabs.create({ url, active: true });
            await waitForTabComplete(tab.id);
            await delay(QUEUE_PAGE_LOAD_WAIT_MS);
            // content script 的 onMessage 监听是 async 的，整页爬完才会返回
            const result = await browser.tabs.sendMessage(tab.id, { type: MESSAGE_START_CRAWL });
            console.log(`${label} 完成`, result);
        } catch (e) {
            console.warn(`${label} 失败，跳过`, e);
        }
    }
    console.log('[队列] 全部执行完毕');
}

export default defineBackground(() => {
    console.log('Background script started', { id: browser.runtime.id });

    browser.runtime.onMessage.addListener((message) => {
        if (message?.type === MESSAGE_START_QUEUE) {
            const urls = Array.isArray(message.urls)
                ? message.urls.filter((u) => typeof u === 'string' && u.trim())
                : [];
            // 不 await，队列在后台执行，popup 关闭也不影响
            runQueue(urls);
            return Promise.resolve({ ok: true, total: urls.length });
        }
    });
});
