import {
    delayMs,
    getDomainConfigStorage,
    MESSAGE_START_CRAWL,
    normalizeDomainConfig,
} from '../../core/config.js';

export default defineContentScript({
    matches: ['https://www.douyin.com/*'],
    runAt: 'document_idle',
    main() {
        console.log('douyin comment craw Content Script');
        const configStorage = getDomainConfigStorage(window.location.hostname);
        const getCommentMainContent = () =>
            document.querySelector(
                '[data-e2e="feed-active-video"] #merge-all-comment-container .comment-mainContent',
            );
        const getParentList = () => {
            const main = getCommentMainContent();
            if (!main) return [];
            return [...main.querySelectorAll(':scope > div')].filter((el) =>
                el.querySelector('[data-e2e="comment-item"]'),
            );
        };
        const parseCommentItem = (item) => {
            if (!item) return null;
            const body = item.querySelector(':scope > div:nth-child(2) > div:nth-child(1)');
            if (!body) return null;
            const userLink = body.querySelector(':scope > div:nth-child(1) a');
            const href = userLink?.getAttribute('href') ?? '';
            const timeLocText =
                body.querySelector(':scope > div:nth-child(3) span')?.textContent?.trim() ?? '';
            const parts = timeLocText.split('·').map((s) => s.trim());
            return {
                userId: href.split('/').pop() ?? '',
                userLink: href,
                userName: userLink?.textContent?.trim() ?? '',
                content: body.querySelector(':scope > div:nth-child(2)')?.textContent?.trim() ?? '',
                picture: body.querySelector(':scope > div:nth-child(2) > div') ? '[图片]' : '',
                time: parts[0] ?? '',
                location: parts[1] ?? '',
                like: body.querySelector(':scope > div:nth-child(4) p span')?.textContent?.trim() || '0',
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
        const getShowMoreButton = (parentEl) => {
            const item = parentEl.querySelector('[data-e2e="comment-item"]');
            return item?.querySelector(':scope > div:nth-child(2) button div span');
        };
        const expandAndScrapeReplies = async (parentEl, cfg) => {
            const { commentReplyLimit, clickDelay } = cfg;
            const item = parentEl.querySelector('[data-e2e="comment-item"]');
            if (!item) return [];
            const all = [];
            while (all.length < commentReplyLimit) {
                const batch = scrapeVisibleReplies(parentEl);
                for (const row of batch) {
                    if (all.length >= commentReplyLimit) break;
                    const key = `${row.userId}\0${row.time}\0${row.content}`;
                    if (!all.some((r) => `${r.userId}\0${r.time}\0${r.content}` === key)) {
                        all.push(row);
                    }
                }
                if (all.length >= commentReplyLimit) break;
                const showMore = getShowMoreButton(parentEl);
                if (!showMore?.textContent?.includes('展开')) break;
                const before = item.querySelectorAll('.replyContainer [data-e2e="comment-item"]').length;
                showMore.click();
                await delayMs(clickDelay);
                const after = item.querySelectorAll('.replyContainer [data-e2e="comment-item"]').length;
                if (after <= before) break;
            }
            return all.slice(0, commentReplyLimit);
        };
        let crawling = false;
        const crawl = async (cfg) => {
            if (crawling) return { ok: false, error: '爬取进行中' };
            const { commentLimit, crawlReplies, scrollDelay, scrollStep } = cfg;
            crawling = true;
            console.log('开始爬取评论…');
            const results = [];
            try {
                while (results.length < commentLimit) {
                    const scroller = getCommentMainContent();
                    if (!scroller) {
                        console.warn('未找到评论区域');
                        break;
                    }
                    const parents = getParentList();
                    while (results.length < commentLimit && results.length < parents.length) {
                        const parentEl = parents[results.length];
                        const first = parseParentComment(parentEl);
                        const replies = crawlReplies ? await expandAndScrapeReplies(parentEl, cfg) : [];
                        const row = first ? { ...first, replies } : { error: '解析失败', replies: [] };
                        results.push(row);
                        console.log(`[${results.length}]`, row);
                    }
                    if (results.length >= commentLimit) break;
                    const scrollBefore = scroller.scrollTop;
                    scroller.scrollBy(0, scrollStep);
                    await delayMs(scrollDelay);
                    const parentsAfter = getParentList().length;
                    if (scroller.scrollTop === scrollBefore && parentsAfter <= results.length) break;
                }
                console.log('爬取完成', results);
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
