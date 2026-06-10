import {
    countTotalComments,
    CRAWL_SCROLL_STALL_LIMIT,
    delayMs,
    delayWithPause,
    effectiveReplyLimit,
    getDomainConfigStorage,
    isTotalLimitReached,
    MESSAGE_START_CRAWL,
    normalizeDomainConfig,
    remainingTotalQuota,
    resolvePlatformTheme,
} from '../../core/config.js';
import { createCrawlProgressPanel } from '../../core/crawl-progress-ui.js';
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
        const expandRepliesInDom = async (parentEl, cfg, rootId, maxReplies, checkpoint, pauseDelay) => {
            const { clickDelay } = cfg;
            const countDomReplies = () =>
                parentEl.querySelectorAll('.reply-container .list-container .comment-item').length;
            while (commentCache.subReplyCount(rootId) < maxReplies) {
                const replyShowMoreButton = parentEl.querySelector('.reply-container .show-more');
                if (!replyShowMoreButton) break;
                await checkpoint('replies');
                const beforeCache = commentCache.subReplyCount(rootId);
                const beforeDom = countDomReplies();
                replyShowMoreButton.click();
                await pauseDelay(clickDelay);
                if (
                    commentCache.subReplyCount(rootId) <= beforeCache &&
                    countDomReplies() <= beforeDom
                ) {
                    break;
                }
            }
        };
        const collectOneRoot = async (rootIndex, results, cfg, checkpoint, pauseDelay) => {
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
                    await expandRepliesInDom(parentEl, cfg, rootId, maxReplies, checkpoint, pauseDelay);
                    if (commentCache.subReplyCount(rootId) === before) {
                        await pauseDelay(clickDelay);
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
        /** @type {ReturnType<typeof createCrawlProgressPanel> | null} */
        let progressPanel = null;

        const crawl = async (cfg) => {
            if (crawling) return { ok: false, error: '爬取进行中' };
            const { commentLimit, commentTotalLimit, scrollDelay, scrollStep, clickDelay } = cfg;
            const theme = resolvePlatformTheme(window.location.hostname);
            progressPanel?.destroy();
            progressPanel = createCrawlProgressPanel({
                accent: theme.primary,
                accentHover: theme.primaryHover,
                accentRgb: theme.primaryRgb,
                platformLabel: '小红书',
                platformId: theme.id,
            });

            const results = [];
            const report = (phase) => {
                progressPanel.setProgress(phase, {
                    roots: results.length,
                    rootLimit: commentLimit,
                    total: countTotalComments(results),
                    totalLimit: Number(commentTotalLimit) || 0,
                    cachedRoots: commentCache.rootOrder.length,
                });
            };
            const checkpoint = async (phase = 'running') => {
                report(phase);
                await progressPanel.waitIfPaused();
            };
            const pauseDelay = (ms) => delayWithPause(ms, () => progressPanel.waitIfPaused());

            crawling = true;
            let scrollStallCount = 0;
            const cachedRoots = commentCache.rootOrder.length;
            console.log(`开始爬取评论…（hook 已缓存 ${cachedRoots} 条一级评论，先查缺补漏）`);

            const scrollContainer = getScrollContainer();
            try {
                await checkpoint('running');
                while (results.length < commentLimit && !isTotalLimitReached(results, commentTotalLimit)) {
                    while (
                        results.length < commentLimit &&
                        results.length < commentCache.rootOrder.length &&
                        !isTotalLimitReached(results, commentTotalLimit)
                    ) {
                        await checkpoint('running');
                        await collectOneRoot(results.length, results, cfg, checkpoint, pauseDelay);
                        report('running');
                    }
                    if (results.length >= commentLimit || isTotalLimitReached(results, commentTotalLimit)) {
                        break;
                    }
                    await checkpoint('scrolling');
                    const rootsBefore = commentCache.rootOrder.length;
                    const scrollBefore = scrollContainer?.scrollTop ?? window.scrollY;
                    if (scrollContainer) scrollContainer.scrollBy(0, scrollStep);
                    else window.scrollBy(0, scrollStep);
                    await pauseDelay(scrollDelay);
                    if (commentCache.rootOrder.length === rootsBefore) {
                        await pauseDelay(clickDelay);
                    }
                    const scrollAfter = scrollContainer?.scrollTop ?? window.scrollY;
                    const rootsAfter = commentCache.rootOrder.length;
                    if (rootsAfter > results.length || rootsAfter > rootsBefore) {
                        scrollStallCount = 0;
                    } else if (scrollAfter === scrollBefore && rootsAfter <= results.length) {
                        scrollStallCount += 1;
                        if (scrollStallCount >= CRAWL_SCROLL_STALL_LIMIT) break;
                    }
                }
                console.log('爬取完成', results);
                report('saving');
                await checkpoint('saving');
                const meta = await ensurePageMeta();
                await saveCrawlResults(window.location.hostname, results, meta);
                const target = Number(commentLimit) || 0;
                const stoppedEarly = target > 0 && results.length < target;
                progressPanel.setDone({
                    rootCount: results.length,
                    totalCount: countTotalComments(results),
                    note: stoppedEarly
                        ? `已达页面可加载上限，采集 ${results.length}/${target} 条一级评论（累计 ${countTotalComments(results)} 条）。`
                        : '',
                });
                return { ok: true, count: results.length };
            } catch (e) {
                const message = e?.message ?? '爬取失败';
                progressPanel.setError(message);
                return { ok: false, error: message };
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
