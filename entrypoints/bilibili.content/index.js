import {
    delayMs,
    getDomainConfigStorage,
    isTotalLimitReached,
    MESSAGE_START_CRAWL,
    normalizeDomainConfig,
    remainingTotalQuota,
} from '../../core/config.js';
import { saveCrawlResults } from '../../core/records.js';

export default defineContentScript({
    matches: ['https://www.bilibili.com/*'],
    runAt: 'document_idle',
    main() {
        console.log('bilibili comment craw Content Script');
        const configStorage = getDomainConfigStorage(window.location.hostname);
        const getCommentsContainer = () =>
            document.querySelector('bili-comments')?.shadowRoot?.querySelector('#feed');
        const parseRichContent = (main) => {
            const contents = main?.querySelector('bili-rich-text')?.shadowRoot?.querySelector('#contents');
            if (!contents) return '';
            let text = '';
            const walk = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    text += node.textContent;
                    return;
                }
                if (node.nodeType !== Node.ELEMENT_NODE) return;
                if (node.tagName === 'IMG') {
                    text += node.getAttribute('alt') || '';
                    return;
                }
                node.childNodes.forEach(walk);
            };
            walk(contents);
            return text.trim();
        };
        const parseComment = (main, footer) => {
            if (!main || !footer) return null;
            const userInfo = main.querySelector('bili-comment-user-info')?.shadowRoot;
            const userAnchor = userInfo?.querySelector('a');
            return {
                userId: userInfo?.querySelector('#user-name')?.getAttribute('data-user-profile-id') ?? '',
                userName: userAnchor?.textContent?.trim() ?? '',
                userLink: userAnchor?.getAttribute('href') ?? '',
                content: parseRichContent(main),
                picture: main.querySelector('#pictures') ? '[图片]' : '',
                time: footer.querySelector('#pubdate')?.textContent?.trim() ?? '',
                location: '',
                like: footer.querySelector('#like #count')?.textContent?.trim() || '0',
                isAuthor: '',
                tag: '',
            };
        };
        const parseFirst = (commentItem) => {
            const root = commentItem.querySelector('bili-comment-renderer')?.shadowRoot;
            if (!root) return null;
            const main = root.querySelector('#body #main');
            const footer = root.querySelector('#body #footer bili-comment-action-buttons-renderer')?.shadowRoot;
            return parseComment(main, footer);
        };
        const parseReply = (replyEl) => {
            const root = replyEl.shadowRoot;
            if (!root) return null;
            const main = root.querySelector('#body #main');
            const footer = root.querySelector('#body #footer bili-comment-action-buttons-renderer')?.shadowRoot;
            return parseComment(main, footer);
        };
        const scrapeReplyPage = (expander) => {
            const list = [];
            for (const el of expander.querySelectorAll('bili-comment-reply-renderer')) {
                const row = parseReply(el);
                if (row) list.push(row);
            }
            return list;
        };
        const expandAndScrapeReplies = async (commentItem, cfg, maxReplies = Infinity) => {
            const { commentReplisePageSizeLimit, clickDelay } = cfg;
            const replyContainer = commentItem
                .querySelector('bili-comment-replies-renderer')
                ?.shadowRoot?.querySelector('#expander-contents');
            if (!replyContainer) return [];
            const replyShowMoreButton = replyContainer.querySelector('#view-more bili-text-button');
            if (replyShowMoreButton) {
                replyShowMoreButton.click();
                await delayMs(clickDelay);
            }
            const all = [];
            for (let page = 0; page < commentReplisePageSizeLimit; page++) {
                for (const row of scrapeReplyPage(replyContainer)) {
                    if (all.length >= maxReplies) break;
                    all.push(row);
                }
                if (all.length >= maxReplies) break;
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
            return all.slice(0, maxReplies);
        };
        let crawling = false;
        const crawl = async (cfg) => {
            if (crawling) return { ok: false, error: '爬取进行中' };
            const { commentLimit, commentTotalLimit, crawlReplies, scrollDelay, scrollStep } = cfg;
            crawling = true;
            console.log('开始爬取评论…');
            const results = [];
            try {
                while (results.length < commentLimit && !isTotalLimitReached(results, commentTotalLimit)) {
                    const commentsContainer = getCommentsContainer();
                    if (!commentsContainer) {
                        console.warn('未找到评论区域');
                        break;
                    }
                    const threads = commentsContainer.querySelectorAll('bili-comment-thread-renderer');
                    while (
                        results.length < commentLimit &&
                        results.length < threads.length &&
                        !isTotalLimitReached(results, commentTotalLimit)
                    ) {
                        const remaining = remainingTotalQuota(results, commentTotalLimit);
                        if (remaining <= 0) break;
                        const item = threads[results.length].shadowRoot;
                        if (!item) {
                            results.push({ error: 'shadowRoot 为空', replies: [] });
                            continue;
                        }
                        const first = parseFirst(item);
                        const maxReplies = remaining - 1;
                        const replies =
                            crawlReplies && maxReplies > 0
                                ? await expandAndScrapeReplies(item, cfg, maxReplies)
                                : [];
                        const row = { ...first, replies };
                        results.push(row);
                        console.log(`[${results.length}]`, row);
                    }
                    if (results.length >= commentLimit || isTotalLimitReached(results, commentTotalLimit)) break;
                    const scrollBefore = window.scrollY;
                    window.scrollBy(0, scrollStep);
                    await delayMs(scrollDelay);
                    const threadsAfter =
                        getCommentsContainer()?.querySelectorAll('bili-comment-thread-renderer').length;
                    if (window.scrollY === scrollBefore && (threadsAfter ?? 0) <= results.length) break;
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