import {
    countTotalComments,
    CrawlAbortedError,
    CRAWL_SCROLL_STALL_LIMIT,
    delayMs,
    getDomainConfigStorage,
    isTotalLimitReached,
    MESSAGE_START_CRAWL,
    normalizeDomainConfig,
    remainingTotalQuota,
    resolvePlatformTheme,
} from '../../core/config.js';
import { createCrawlProgressPanel } from '../../core/crawl-progress-ui.js';
import { saveCrawlResults } from '../../core/records.js';
import { createPageMetaCache } from './initial_state.js';
import { createReplyCache, ingestHookPayload } from './reply_api.js';

const HOOK_SOURCE = 'bili-reply-hook';
const CRAWLER_SOURCE = 'bili-crawler';

export default defineContentScript({
    matches: ['https://www.bilibili.com/*'],
    runAt: 'document_start',
    main() {
        const replyCache = createReplyCache();
        const pageMetaCache = createPageMetaCache();

        const requestInitialState = () => {
            window.postMessage({ source: CRAWLER_SOURCE, type: 'read-initial-state' }, '*');
        };

        window.addEventListener('message', (event) => {
            if (event.source !== window || event.data?.source !== HOOK_SOURCE) return;
            if (event.data.type === 'initial-state') {
                pageMetaCache.ingest(event.data.payload);
                console.log('[bilibili] 已缓存页面元信息', pageMetaCache.get());
                return;
            }
            const { url, status, payload } = event.data;
            ingestHookPayload(url, status, payload, replyCache);
            console.log('[bilibili hook] 已缓存评论', {
                roots: replyCache.rootOrder.length,
                url,
            });
        });
        requestInitialState();
        console.log('[bilibili] 隔离环境监听中（评论 hook + __INITIAL_STATE__）…');

        const configStorage = getDomainConfigStorage(window.location.hostname);
        const getCommentsContainer = () =>
            document.querySelector('bili-comments')?.shadowRoot?.querySelector('#feed');
        const getCommentThreadShadow = (index) =>
            getCommentsContainer()?.querySelectorAll('bili-comment-thread-renderer')[index]?.shadowRoot ??
            null;
        const expandRepliesInDom = async (commentItem, cfg, checkpoint) => {
            const { commentReplisePageSizeLimit, clickDelay } = cfg;
            const replyContainer = commentItem
                .querySelector('bili-comment-replies-renderer')
                ?.shadowRoot?.querySelector('#expander-contents');
            if (!replyContainer) return;
            const replyShowMoreButton = replyContainer.querySelector('#view-more bili-text-button');
            if (replyShowMoreButton) {
                await checkpoint('replies');
                replyShowMoreButton.click();
                await delayMs(clickDelay);
            }
            for (let page = 0; page < commentReplisePageSizeLimit; page++) {
                await checkpoint('replies');
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
                await checkpoint('replies');
                replyCollapseButton.click();
                await delayMs(clickDelay);
            }
        };
        const collectOneRoot = async (rootIndex, results, cfg, checkpoint) => {
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
                    await expandRepliesInDom(commentItem, cfg, checkpoint);
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
                platformLabel: 'B站',
                platformId: theme.id,
            });

            const results = [];
            const report = (phase) => {
                progressPanel.setProgress(phase, {
                    roots: results.length,
                    rootLimit: commentLimit,
                    total: countTotalComments(results),
                    totalLimit: Number(commentTotalLimit) || 0,
                    cachedRoots: replyCache.rootOrder.length,
                });
            };
            const checkpoint = async (phase = 'running') => {
                report(phase);
                progressPanel.throwIfAborted();
            };

            crawling = true;
            let scrollStallCount = 0;
            const cachedRoots = replyCache.rootOrder.length;
            console.log(`开始爬取评论…（hook 已缓存 ${cachedRoots} 条一级评论，先查缺补漏）`);

            try {
                await checkpoint('running');
                while (results.length < commentLimit && !isTotalLimitReached(results, commentTotalLimit)) {
                    while (
                        results.length < commentLimit &&
                        results.length < replyCache.rootOrder.length &&
                        !isTotalLimitReached(results, commentTotalLimit)
                    ) {
                        await checkpoint('running');
                        await collectOneRoot(results.length, results, cfg, checkpoint);
                        report('running');
                    }
                    if (results.length >= commentLimit || isTotalLimitReached(results, commentTotalLimit)) {
                        break;
                    }
                    await checkpoint('scrolling');
                    const rootsBefore = replyCache.rootOrder.length;
                    const scrollBefore = window.scrollY;
                    window.scrollBy(0, scrollStep);
                    await delayMs(scrollDelay);
                    if (replyCache.rootOrder.length === rootsBefore) {
                        await delayMs(clickDelay);
                    }
                    const scrollAfter = window.scrollY;
                    const rootsAfter = replyCache.rootOrder.length;
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
                if (e instanceof CrawlAbortedError) {
                    console.log('用户结束爬取', results);
                    if (results.length > 0) {
                        report('saving');
                        const meta = await ensurePageMeta();
                        await saveCrawlResults(window.location.hostname, results, meta);
                    }
                    const total = countTotalComments(results);
                    progressPanel.setDone({
                        rootCount: results.length,
                        totalCount: total,
                        note:
                            results.length > 0
                                ? `已手动结束，已保存 ${results.length} 条一级评论（累计 ${total} 条）。`
                                : '已手动结束，未采集到评论。',
                    });
                    return { ok: true, count: results.length, aborted: true };
                }
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
