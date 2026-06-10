import {
    delayMs,
    effectiveReplyLimit,
    getDomainConfigStorage,
    isTotalLimitReached,
    MESSAGE_START_CRAWL,
    normalizeDomainConfig,
    remainingTotalQuota,
} from '../../core/config.js';
import { saveCrawlResults } from '../../core/records.js';
import { createCommentCache, ingestHookPayload } from './comment_api.js';
import { createPageMetaCache } from './initial_state.js';

const HOOK_SOURCE = 'xhs-comment-hook';
const CRAWLER_SOURCE = 'xhs-crawler';

export default defineContentScript({
    matches: ['https://www.xiaohongshu.com/explore/*'],
    runAt: 'document_start',
    main() {
        const commentCache = createCommentCache();
        const pageMetaCache = createPageMetaCache();

        const requestInitialState = () => {
            window.postMessage({ source: CRAWLER_SOURCE, type: 'read-initial-state' }, '*');
        };

        window.addEventListener('message', (event) => {
            if (event.source !== window || event.data?.source !== HOOK_SOURCE) return;
            if (event.data.type === 'initial-state') {
                pageMetaCache.ingest(event.data.payload);
                console.log('[xiaohongshu] 已缓存页面元信息', pageMetaCache.get());
                return;
            }
            const { url, status, payload } = event.data;
            ingestHookPayload(url, status, payload, commentCache);
            console.log('[xiaohongshu hook] 已缓存评论', {
                roots: commentCache.rootOrder.length,
                url,
            });
        });
        requestInitialState();
        console.log('[xiaohongshu] 隔离环境监听中（评论 hook + __INITIAL_STATE__）…');

        const configStorage = getDomainConfigStorage(window.location.hostname);
        const getScrollContainer = () => document.querySelector('.note-scroller');
        const getCommentListContainer = () =>
            document.querySelector('.comments-el .comments-container')?.querySelector('.list-container');
        const getParentCommentEl = (index) =>
            getCommentListContainer()?.querySelectorAll('.parent-comment')[index] ?? null;
        const expandRepliesInDom = async (parentEl, cfg) => {
            const { clickDelay } = cfg;
            while (true) {
                const replyShowMoreButton = parentEl.querySelector('.reply-container .show-more');
                if (!replyShowMoreButton) break;
                const before = parentEl.querySelectorAll('.reply-container .list-container .comment-item').length;
                replyShowMoreButton.click();
                await delayMs(clickDelay);
                const after = parentEl.querySelectorAll('.reply-container .list-container .comment-item').length;
                if (after <= before) break;
            }
        };
        const collectOneRoot = async (rootIndex, results, cfg) => {
            const { commentTotalLimit, crawlReplies, clickDelay } = cfg;
            const remaining = remainingTotalQuota(results, commentTotalLimit);
            if (remaining <= 0) return false;
            const rootId = commentCache.rootOrder[rootIndex];
            const first = commentCache.roots.get(rootId);
            if (!first) {
                results.push({ error: '解析失败', replies: [] });
                return true;
            }
            const maxReplies = effectiveReplyLimit(cfg.commentReplyLimit, remaining - 1);
            if (crawlReplies && maxReplies > 0 && commentCache.subReplyCount(rootId) < maxReplies) {
                const parentEl = getParentCommentEl(rootIndex);
                if (parentEl) {
                    const before = commentCache.subReplyCount(rootId);
                    await expandRepliesInDom(parentEl, cfg);
                    if (commentCache.subReplyCount(rootId) === before) {
                        await delayMs(clickDelay);
                    }
                }
            }
            const replies =
                crawlReplies && maxReplies > 0 ? commentCache.getSubReplies(rootId, maxReplies) : [];
            const row = { ...first, replies };
            results.push(row);
            console.log(`[${results.length}]`, row);
            return true;
        };
        const ensurePageMeta = async () => {
            if (pageMetaCache.hasData()) return pageMetaCache.get();
            requestInitialState();
            await delayMs(400);
            return pageMetaCache.get();
        };
        let crawling = false;
        const crawl = async (cfg) => {
            if (crawling) return { ok: false, error: '爬取进行中' };
            const { commentLimit, commentTotalLimit, crawlReplies, scrollDelay, scrollStep, clickDelay } =
                cfg;
            crawling = true;
            const cachedRoots = commentCache.rootOrder.length;
            console.log(`开始爬取评论…（hook 已缓存 ${cachedRoots} 条一级评论，先查缺补漏）`);
            const results = [];
            const scrollContainer = getScrollContainer();
            try {
                while (results.length < commentLimit && !isTotalLimitReached(results, commentTotalLimit)) {
                    while (
                        results.length < commentLimit &&
                        results.length < commentCache.rootOrder.length &&
                        !isTotalLimitReached(results, commentTotalLimit)
                    ) {
                        await collectOneRoot(results.length, results, cfg);
                    }
                    if (results.length >= commentLimit || isTotalLimitReached(results, commentTotalLimit)) {
                        break;
                    }
                    const rootsBefore = commentCache.rootOrder.length;
                    const scrollBefore = scrollContainer?.scrollTop ?? window.scrollY;
                    if (scrollContainer) scrollContainer.scrollBy(0, scrollStep);
                    else window.scrollBy(0, scrollStep);
                    await delayMs(scrollDelay);
                    if (commentCache.rootOrder.length === rootsBefore) {
                        await delayMs(clickDelay);
                    }
                    const scrollAfter = scrollContainer?.scrollTop ?? window.scrollY;
                    const rootsAfter = commentCache.rootOrder.length;
                    if (scrollAfter === scrollBefore && rootsAfter <= results.length) break;
                }
                console.log('爬取完成', results);
                const meta = await ensurePageMeta();
                await saveCrawlResults(window.location.hostname, results, meta);
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
