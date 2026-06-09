import {
    delayMs,
    getDomainConfigStorage,
    isTotalLimitReached,
    MESSAGE_START_CRAWL,
    normalizeDomainConfig,
    remainingTotalQuota,
} from '../../core/config.js';
import { saveCrawlResults } from '../../core/records.js';
import { createReplyCache, ingestHookPayload } from './reply_api.js';
import { createViewCache, ingestViewPayload } from './view_api.js';

const HOOK_SOURCE = 'bili-reply-hook';

export default defineContentScript({
    matches: ['https://www.bilibili.com/*'],
    runAt: 'document_start',
    main() {
        
        const replyCache = createReplyCache();
        const viewCache = createViewCache();

        window.addEventListener('message', (event) => {
            if (event.source !== window || event.data?.source !== HOOK_SOURCE) return;
            const { url, status, payload } = event.data;
            ingestHookPayload(url, status, payload, replyCache);
            ingestViewPayload(url, status, payload, viewCache);
            console.log('[bilibili hook] 已缓存', {
                roots: replyCache.rootOrder.length,
                view: Object.keys(viewCache.get()).length > 0,
                url,
            });
        });
        console.log('[bilibili hook] 隔离环境监听中，等待评论/视频 view 接口响应…');

        console.log('bilibili comment craw Content Script');
        const configStorage = getDomainConfigStorage(window.location.hostname);
        const getCommentsContainer = () =>
            document.querySelector('bili-comments')?.shadowRoot?.querySelector('#feed');
        const getCommentThreadShadow = (index) =>
            getCommentsContainer()?.querySelectorAll('bili-comment-thread-renderer')[index]?.shadowRoot ??
            null;
        const expandRepliesInDom = async (commentItem, cfg) => {
            const { commentReplisePageSizeLimit, clickDelay } = cfg;
            const replyContainer = commentItem
                .querySelector('bili-comment-replies-renderer')
                ?.shadowRoot?.querySelector('#expander-contents');
            if (!replyContainer) return;
            const replyShowMoreButton = replyContainer.querySelector('#view-more bili-text-button');
            if (replyShowMoreButton) {
                replyShowMoreButton.click();
                await delayMs(clickDelay);
            }
            for (let page = 0; page < commentReplisePageSizeLimit; page++) {
                const replyPageSize = replyContainer.querySelector('#pagination-head');
                if (!replyPageSize?.textContent?.includes('共')) break;
                const nextBtn = [...replyContainer.querySelectorAll('#pagination-body bili-text-button')].find(
                    (b) => b.getAttribute('data-idx') === String(page + 1),
                );
                if (!nextBtn) break;
                nextBtn.click();
                await delayMs(clickDelay);
            }
            const replyCollapseButtons = replyContainer.querySelectorAll('#pagination-foot bili-text-button');
            const replyCollapseButton = replyCollapseButtons[replyCollapseButtons.length - 1];
            if (replyCollapseButton) {
                replyCollapseButton.click();
                await delayMs(clickDelay);
            }
        };
        const collectOneRoot = async (rootIndex, results, cfg) => {
            const { commentTotalLimit, crawlReplies, clickDelay } = cfg;
            const remaining = remainingTotalQuota(results, commentTotalLimit);
            if (remaining <= 0) return false;
            const rootId = replyCache.rootOrder[rootIndex];
            const first = replyCache.roots.get(rootId);
            if (!first) {
                results.push({ error: '解析失败', replies: [] });
                return true;
            }
            const maxReplies = remaining - 1;
            if (crawlReplies && maxReplies > 0 && replyCache.subReplyCount(rootId) < maxReplies) {
                const commentItem = getCommentThreadShadow(rootIndex);
                if (commentItem) {
                    const before = replyCache.subReplyCount(rootId);
                    await expandRepliesInDom(commentItem, cfg);
                    if (replyCache.subReplyCount(rootId) === before) {
                        await delayMs(clickDelay);
                    }
                }
            }
            const replies =
                crawlReplies && maxReplies > 0 ? replyCache.getSubReplies(rootId, maxReplies) : [];
            const row = { ...first, replies };
            results.push(row);
            console.log(`[${results.length}]`, row);
            return true;
        };
        let crawling = false;
        const crawl = async (cfg) => {
            if (crawling) return { ok: false, error: '爬取进行中' };
            const { commentLimit, commentTotalLimit, crawlReplies, scrollDelay, scrollStep, clickDelay } =
                cfg;
            crawling = true;
            const cachedRoots = replyCache.rootOrder.length;
            console.log(`开始爬取评论…（hook 已缓存 ${cachedRoots} 条一级评论，先查缺补漏）`);
            const results = [];
            try {
                while (results.length < commentLimit && !isTotalLimitReached(results, commentTotalLimit)) {
                    while (
                        results.length < commentLimit &&
                        results.length < replyCache.rootOrder.length &&
                        !isTotalLimitReached(results, commentTotalLimit)
                    ) {
                        await collectOneRoot(results.length, results, cfg);
                    }
                    if (results.length >= commentLimit || isTotalLimitReached(results, commentTotalLimit)) {
                        break;
                    }
                    const rootsBefore = replyCache.rootOrder.length;
                    const scrollBefore = window.scrollY;
                    window.scrollBy(0, scrollStep);
                    await delayMs(scrollDelay);
                    if (replyCache.rootOrder.length === rootsBefore) {
                        await delayMs(clickDelay);
                    }
                    const rootsAfter = replyCache.rootOrder.length;
                    if (window.scrollY === scrollBefore && rootsAfter <= results.length) break;
                }
                console.log('爬取完成', results);
                await saveCrawlResults(window.location.hostname, results, viewCache.get());
                return { ok: true, count: results.length };
            } finally {
                crawling = false;
            }
        };
        const runCrawlFromStorage = async () => {
            const cfg = normalizeDomainConfig(await configStorage.getValue());
            return crawl(cfg);
        };
        browser.runtime.onMessage.addListener(async (message) => {
            if (message.type === MESSAGE_START_CRAWL) {
                return runCrawlFromStorage();
            }
        });
    },
});
