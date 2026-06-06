import {
    delayMs,
    getDomainConfigStorage,
    MESSAGE_START_CRAWL,
    normalizeDomainConfig,
} from '../../core/config.js';
import { saveCrawlResults } from '../../core/records.js';

export default defineContentScript({
    matches: ['https://www.zhihu.com/*'],
    runAt: 'document_idle',
    main() {
        console.log('zhihu comment craw Content Script');
        const configStorage = getDomainConfigStorage(window.location.hostname);
        const getScrollContainer = () => document.querySelector('.Modal-content > div > div:nth-child(2)');
        const getParentList = () =>
            document.querySelectorAll('.Modal-content > div > div:nth-child(2) > div > div');
        const getReplyScrollContainer = () =>
            document.querySelector('.Modal-content > div:nth-child(2) > div:nth-child(2)');
        const getReplyList = () =>
            document.querySelectorAll(
                '.Modal-content > div:nth-child(2) > div:nth-child(2) > div:nth-child(3) > div',
            );
        const getReturnParentButton = () =>
            document.querySelector('.Modal-content > div:nth-child(2) > div:nth-child(1) span');
        const parseTimeLocTag = (text) => {
            const parts = text.split('·').map((s) => s.trim());
            return {
                time: parts[0] ?? '',
                location: parts[1] ?? '',
                tag: parts[2] ?? '',
            };
        };
        const parseCommentItem = (item) => {
            if (!item) return null;
            const parentCommentMain = item.querySelector(':scope > div > div:nth-child(2)');
            if (!parentCommentMain) return null;
            const userAnchor = parentCommentMain.querySelector(':scope > div:nth-child(1) a');
            const userLink = userAnchor?.getAttribute('href') ?? '';
            const timeLocTag =
                parentCommentMain
                    .querySelector(':scope > div:nth-child(3) > div:nth-child(1) > div:nth-child(1)')
                    ?.textContent?.trim() ?? '';
            const { time, location, tag } = parseTimeLocTag(timeLocTag);
            return {
                userId: userLink.split('/').pop() ?? '',
                userName: userAnchor?.textContent?.trim() ?? '',
                userLink,
                content: parentCommentMain.querySelector(':scope > .CommentContent')?.textContent?.trim() ?? '',
                picture: parentCommentMain.querySelector(':scope > .CommentContent .comment_img') ? '[图片]' : '',
                time,
                location,
                like:
                    parentCommentMain
                        .querySelector(':scope > div:nth-child(3) > div:nth-child(2) > button:nth-child(2)')
                        ?.textContent?.trim() || '0',
                isAuthor: '',
                tag,
            };
        };
        const scrapeVisibleReplies = () => {
            const list = [];
            for (const item of getReplyList()) {
                const row = parseCommentItem(item);
                if (row) list.push(row);
            }
            return list;
        };
        const returnToParentPage = async (clickDelay) => {
            const returnBtn = getReturnParentButton();
            if (returnBtn) {
                returnBtn.click();
                await delayMs(clickDelay);
            }
        };
        const expandAndScrapeReplies = async (parentItem, cfg) => {
            const { commentReplyLimit, clickDelay, scrollDelay, scrollStep } = cfg;
            const replyShowMoreButton = parentItem.querySelector(':scope > button');
            if (!replyShowMoreButton) return [];
            replyShowMoreButton.click();
            await delayMs(clickDelay);
            const all = [];
            try {
                while (all.length < commentReplyLimit) {
                    const batch = scrapeVisibleReplies();
                    for (const row of batch) {
                        if (all.length >= commentReplyLimit) break;
                        const key = `${row.userId}\0${row.time}\0${row.content}`;
                        if (!all.some((r) => `${r.userId}\0${r.time}\0${r.content}` === key)) {
                            all.push(row);
                        }
                    }
                    if (all.length >= commentReplyLimit) break;
                    const replyScrollContainer = getReplyScrollContainer();
                    if (!replyScrollContainer) break;
                    const scrollBefore = replyScrollContainer.scrollTop;
                    replyScrollContainer.scrollBy(0, scrollStep);
                    await delayMs(scrollDelay);
                    if (replyScrollContainer.scrollTop === scrollBefore) break;
                }
            } finally {
                await returnToParentPage(clickDelay);
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
            const scrollContainer = getScrollContainer();
            try {
                while (results.length < commentLimit) {
                    if (!scrollContainer) {
                        console.warn('未找到评论弹窗，请先打开评论区');
                        break;
                    }
                    const parents = getParentList();
                    while (results.length < commentLimit && results.length < parents.length) {
                        const parentItem = parents[results.length];
                        const first = parseCommentItem(parentItem);
                        const replies = crawlReplies
                            ? await expandAndScrapeReplies(parentItem, cfg)
                            : [];
                        const row = first ? { ...first, replies } : { error: '解析失败', replies: [] };
                        results.push(row);
                        console.log(`[${results.length}]`, row);
                    }
                    if (results.length >= commentLimit) break;
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
