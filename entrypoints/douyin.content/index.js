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
    matches: ['https://www.douyin.com/*'],
    runAt: 'document_idle',
    main() {
        console.log('douyin comment craw Content Script');
        const configStorage = getDomainConfigStorage(window.location.hostname);
        const getCommentsContainer = () =>
            document.querySelector(
                '[data-e2e="feed-active-video"] #merge-all-comment-container .comment-mainContent',
            );
        const getParentList = () => {
            const commentsContainer = getCommentsContainer();
            if (!commentsContainer) return [];
            return [...commentsContainer.querySelectorAll(':scope > div')].filter((el) =>
                el.querySelector('[data-e2e="comment-item"]'),
            );
        };
        const parseTimeLoc = (text) => {
            const parts = text.split('·').map((s) => s.trim());
            return { time: parts[0] ?? '', location: parts[1] ?? '' };
        };
        const parseCommentItem = (item) => {
            if (!item) return null;
            const parentCommentMain = item.querySelector(':scope > div:nth-child(2) > div:nth-child(1)');
            if (!parentCommentMain) return null;
            const userAnchor = parentCommentMain.querySelector(':scope > div:nth-child(1) a');
            const userLink = userAnchor?.getAttribute('href') ?? '';
            const timeLocText =
                parentCommentMain.querySelector(':scope > div:nth-child(3) span')?.textContent?.trim() ?? '';
            const { time, location } = parseTimeLoc(timeLocText);
            return {
                userId: userLink.split('/').pop() ?? '',
                userName: userAnchor?.textContent?.trim() ?? '',
                userLink,
                content: parentCommentMain.querySelector(':scope > div:nth-child(2)')?.textContent?.trim() ?? '',
                picture: parentCommentMain.querySelector(':scope > div:nth-child(2) > div') ? '[图片]' : '',
                time,
                location,
                like:
                    parentCommentMain.querySelector(':scope > div:nth-child(4) p span')?.textContent?.trim() || '0',
                isAuthor: '',
                tag: '',
            };
        };
        const parseParentComment = (parentEl) => {
            const item = parentEl.querySelector('[data-e2e="comment-item"]');
            const row = parseCommentItem(item);
            if (!row) return null;
            row.replyCount =
                item?.querySelector(':scope > div:nth-child(2) button div span')?.textContent?.trim() ?? '';
            return row;
        };
        const scrapeVisibleReplies = (parentEl) => {
            const item = parentEl.querySelector('[data-e2e="comment-item"]');
            if (!item) return [];
            const list = [];
            for (const replyItem of item.querySelectorAll('.replyContainer [data-e2e="comment-item"]')) {
                const row = parseCommentItem(replyItem);
                if (row) list.push(row);
            }
            return list;
        };
        const getReplyShowMoreButton = (parentEl) => {
            const item = parentEl.querySelector('[data-e2e="comment-item"]');
            return item?.querySelector(':scope > div:nth-child(2) button div span');
        };
        const expandAndScrapeReplies = async (parentEl, cfg, maxReplies = Infinity) => {
            const { commentReplyLimit, clickDelay } = cfg;
            const limit = effectiveReplyLimit(commentReplyLimit, maxReplies);
            const item = parentEl.querySelector('[data-e2e="comment-item"]');
            if (!item) return [];
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
                const replyShowMoreButton = getReplyShowMoreButton(parentEl);
                if (!replyShowMoreButton?.textContent?.includes('展开')) break;
                const before = item.querySelectorAll('.replyContainer [data-e2e="comment-item"]').length;
                replyShowMoreButton.click();
                await delayMs(clickDelay);
                const after = item.querySelectorAll('.replyContainer [data-e2e="comment-item"]').length;
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
            try {
                while (results.length < commentLimit && !isTotalLimitReached(results, commentTotalLimit)) {
                    const scrollContainer = getCommentsContainer();
                    if (!scrollContainer) {
                        console.warn('未找到评论区域');
                        break;
                    }
                    const parents = getParentList();
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
                    const scrollBefore = scrollContainer.scrollTop;
                    scrollContainer.scrollBy(0, scrollStep);
                    await delayMs(scrollDelay);
                    const parentsAfter = getParentList().length;
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
