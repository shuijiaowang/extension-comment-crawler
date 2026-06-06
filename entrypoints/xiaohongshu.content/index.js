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

export default defineContentScript({
    matches: ['https://www.xiaohongshu.com/explore/*'],
    runAt: 'document_idle',
    main() {
        console.log('xiaohongshu comment craw Content Script');
        const configStorage = getDomainConfigStorage(window.location.hostname);
        const getScrollContainer = () => document.querySelector('.note-scroller');
        const getCommentsContainer = () => document.querySelector('.comments-el .comments-container');
        const getCommentListContainer = () => getCommentsContainer()?.querySelector('.list-container');
        const parseCommentItem = (item) => {
            if (!item) return null;
            const avatar = item.querySelector('.avatar a');
            return {
                userId: avatar?.getAttribute('data-user-id') ?? '',
                userName: item.querySelector('.author a')?.textContent?.trim() ?? '',
                userLink: avatar?.getAttribute('href') ?? '',
                content: item.querySelector('.content')?.textContent?.trim() ?? '',
                picture: item.querySelector('.comment-picture') ? '[图片]' : '',
                time: item.querySelector('.date span')?.textContent?.trim() ?? '',
                location: item.querySelector('.date .location')?.textContent?.trim() ?? '',
                like: item.querySelector('.interactions .like .count')?.textContent?.trim() || '0',
                isAuthor: item.querySelector('.author span')?.textContent?.trim() ?? '',
                tag: '',
            };
        };
        const parseParentComment = (parentEl) => {
            const item = parentEl.querySelector(':scope > .comment-item');
            const row = parseCommentItem(item);
            if (!row) return null;
            row.replyCount = item?.querySelector('.reply .count')?.textContent?.trim() ?? '';
            return row;
        };
        const scrapeVisibleReplies = (parentEl) => {
            const list = [];
            for (const item of parentEl.querySelectorAll('.reply-container .list-container .comment-item')) {
                const row = parseCommentItem(item);
                if (row) list.push(row);
            }
            return list;
        };
        const expandAndScrapeReplies = async (parentEl, cfg, maxReplies = Infinity) => {
            const { commentReplyLimit, clickDelay } = cfg;
            const limit = effectiveReplyLimit(commentReplyLimit, maxReplies);
            const all = [];
            while (all.length < limit) {
                const batch = scrapeVisibleReplies(parentEl);
                for (const row of batch) {
                    if (all.length >= limit) break;
                    const key = `${row.userId}\0${row.time}\0${row.content}`;
                    if (!all.some((r) => `${r.userId}\0${r.time}\0${r.content}` === key)) {
                        all.push(row);
                    }
                }
                if (all.length >= limit) break;
                const replyShowMoreButton = parentEl.querySelector('.reply-container .show-more');
                if (!replyShowMoreButton) break;
                const before = parentEl.querySelectorAll('.reply-container .list-container .comment-item').length;
                replyShowMoreButton.click();
                await delayMs(clickDelay);
                const after = parentEl.querySelectorAll('.reply-container .list-container .comment-item').length;
                if (after <= before) break;
            }
            return all.slice(0, limit);
        };
        let crawling = false;
        const crawl = async (cfg) => {
            if (crawling) return { ok: false, error: '爬取进行中' };
            const { commentLimit, commentTotalLimit, commentReplyLimit, crawlReplies, scrollDelay, scrollStep } =
                cfg;
            crawling = true;
            console.log('开始爬取评论…');
            const results = [];
            const scrollContainer = getScrollContainer();
            try {
                while (results.length < commentLimit && !isTotalLimitReached(results, commentTotalLimit)) {
                    const commentListContainer = getCommentListContainer();
                    if (!commentListContainer) {
                        console.warn('未找到评论区域');
                        break;
                    }
                    const parents = commentListContainer.querySelectorAll('.parent-comment');
                    while (
                        results.length < commentLimit &&
                        results.length < parents.length &&
                        !isTotalLimitReached(results, commentTotalLimit)
                    ) {
                        const remaining = remainingTotalQuota(results, commentTotalLimit);
                        if (remaining <= 0) break;
                        const parentEl = parents[results.length];
                        const first = parseParentComment(parentEl);
                        const maxReplies = effectiveReplyLimit(commentReplyLimit, remaining - 1);
                        const replies =
                            crawlReplies && maxReplies > 0
                                ? await expandAndScrapeReplies(parentEl, cfg, maxReplies)
                                : [];
                        const row = first ? { ...first, replies } : { error: '解析失败', replies: [] };
                        results.push(row);
                        console.log(`[${results.length}]`, row);
                    }
                    if (results.length >= commentLimit || isTotalLimitReached(results, commentTotalLimit)) break;
                    if (!scrollContainer) break;
                    const scrollBefore = scrollContainer.scrollTop;
                    scrollContainer.scrollBy(0, scrollStep);
                    await delayMs(scrollDelay);
                    const parentsAfter =
                        getCommentListContainer()?.querySelectorAll('.parent-comment').length ?? 0;
                    if (scrollContainer.scrollTop === scrollBefore && parentsAfter <= results.length) break;
                }
                console.log('爬取完成', results);
                await saveCrawlResults(window.location.hostname, results);
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
