import { getDomainConfigStorage, MESSAGE_START_CRAWL } from '../../core/config.js';

export default defineContentScript({
    matches: ['https://www.bilibili.com/*'],
    runAt: 'document_idle',
    main() {
        console.log('bilibili comment craw Content Script');
        const configStorage = getDomainConfigStorage(window.location.hostname);
        const delay = (min, max) => new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
        const getFeed = () => document.querySelector('bili-comments')?.shadowRoot?.querySelector('#feed');
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
            return {
                userId: userInfo?.querySelector('#user-name')?.getAttribute('data-user-profile-id') ?? '',
                userName: userInfo?.querySelector('a')?.textContent?.trim() ?? '',
                content: parseRichContent(main),
                picture: main.querySelector('#pictures') ? '[图片]' : '',
                time: footer.querySelector('#pubdate')?.textContent?.trim() ?? '',
                like: footer.querySelector('#like #count')?.textContent?.trim() || '0',
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
        const expandAndScrapeReplies = async (commentItem, cfg) => {
            const { commentReplisePageSizeLimit, delayMin, delayMax } = cfg;
            const expander = commentItem.querySelector('bili-comment-replies-renderer')?.shadowRoot?.querySelector('#expander-contents');
            if (!expander) return [];
            const viewMore = expander.querySelector('#view-more bili-text-button');
            if (viewMore) {
                viewMore.click();
                await delay(delayMin, delayMax);
            }
            const all = [];
            for (let page = 0; page < commentReplisePageSizeLimit; page++) {
                all.push(...scrapeReplyPage(expander));
                const head = expander.querySelector('#pagination-head');
                if (!head?.textContent?.includes('共')) break;
                const nextBtn = [...expander.querySelectorAll('#pagination-body bili-text-button')].find((b) => b.getAttribute('data-idx') === String(page + 1));
                if (!nextBtn) break;
                nextBtn.click();
                await delay(delayMin, delayMax);
            }
            const footBtns = expander.querySelectorAll('#pagination-foot bili-text-button');
            const collapse = footBtns[footBtns.length - 1];
            if (collapse) {
                collapse.click();
                await delay(delayMin, delayMax);
            }
            return all;
        };
        let crawling = false;
        const crawl = async (cfg) => {
            if (crawling) return { ok: false, error: '爬取进行中' };
            const { commentLimit, crawlReplies, delayMin, delayMax, scrollStep } = cfg;
            crawling = true;
            console.log('开始爬取评论…');
            const results = [];
            try {
                while (results.length < commentLimit) {
                    const feed = getFeed();
                    if (!feed) {
                        console.warn('未找到评论区域');
                        break;
                    }
                    const threads = feed.querySelectorAll('bili-comment-thread-renderer');
                    while (results.length < commentLimit && results.length < threads.length) {
                        const item = threads[results.length].shadowRoot;
                        if (!item) {
                            results.push({ error: 'shadowRoot 为空', replies: [] });
                            continue;
                        }
                        const first = parseFirst(item);
                        const replies = crawlReplies ? await expandAndScrapeReplies(item, cfg) : [];
                        const row = { ...first, replies };
                        results.push(row);
                        console.log(`[${results.length}]`, row);
                    }
                    if (results.length >= commentLimit) break;
                    const scrollBefore = window.scrollY;
                    window.scrollBy(0, scrollStep);
                    await delay(delayMin, delayMax);
                    const threadsAfter = getFeed()?.querySelectorAll('bili-comment-thread-renderer').length;
                    if (window.scrollY === scrollBefore && (threadsAfter ?? 0) <= results.length) break;
                }
                console.log('爬取完成', results);
                return { ok: true, count: results.length };
            } finally {
                crawling = false;
            }
        };
        const runCrawlFromStorage = async () => {
            const cfg = await configStorage.getValue();
            return crawl(cfg);
        };
        browser.runtime.onMessage.addListener(async (message) => {
            if (message.type === MESSAGE_START_CRAWL) {
                return runCrawlFromStorage();
            }
        });
    },
});