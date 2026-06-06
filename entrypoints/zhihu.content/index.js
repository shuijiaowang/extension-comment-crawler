import { getDomainConfigStorage, MESSAGE_START_CRAWL } from '../../core/config.js';

export default defineContentScript({
    matches: ['https://www.zhihu.com/*'],
    runAt: 'document_idle',
    main() {
        console.log('zhihu comment craw Content Script');
        const configStorage = getDomainConfigStorage(window.location.hostname);
        const delay = (min, max) => new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
        const getParentScroller = () => document.querySelector('.Modal-content > div > div:nth-child(2)');
        const getParentList = () =>
            document.querySelectorAll('.Modal-content > div > div:nth-child(2) > div > div');
        const getReplyScroller = () =>
            document.querySelector('.Modal-content > div:nth-child(2) > div:nth-child(2)');
        const getReplyList = () =>
            document.querySelectorAll(
                '.Modal-content > div:nth-child(2) > div:nth-child(2) > div:nth-child(3) > div',
            );
        const getReturnParentButton = () =>
            document.querySelector('.Modal-content > div:nth-child(2) > div:nth-child(1) span');
        const parseDateLoc = (text) => {
            const parts = text.split('·').map((s) => s.trim());
            return {
                time: parts[0] ?? '',
                location: parts[1] ?? '',
                tag: parts[2] ?? '',
            };
        };
        const parseCommentItem = (item) => {
            if (!item) return null;
            const body = item.querySelector(':scope > div > div:nth-child(2)');
            if (!body) return null;
            const userLink = body.querySelector(':scope > div:nth-child(1) a');
            const href = userLink?.getAttribute('href') ?? '';
            const dateLocText =
                body.querySelector(':scope > div:nth-child(3) > div:nth-child(1) > div:nth-child(1)')
                    ?.textContent?.trim() ?? '';
            const { time, location, tag } = parseDateLoc(dateLocText);
            return {
                userId: href.split('/').pop() ?? '',
                userLink: href,
                userName: userLink?.textContent?.trim() ?? '',
                content: body.querySelector(':scope > .CommentContent')?.textContent?.trim() ?? '',
                picture: body.querySelector(':scope > .CommentContent .comment_img') ? '[图片]' : '',
                time,
                location,
                tag,
                like:
                    body
                        .querySelector(':scope > div:nth-child(3) > div:nth-child(2) > button:nth-child(2)')
                        ?.textContent?.trim() || '0',
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
        const returnToParentPage = async (delayMin, delayMax) => {
            const returnBtn = getReturnParentButton();
            if (returnBtn) {
                returnBtn.click();
                await delay(delayMin, delayMax);
            }
        };
        const expandAndScrapeReplies = async (parentItem, cfg) => {
            const { commentReplyLimit, delayMin, delayMax, scrollStep } = cfg;
            const showMoreBtn = parentItem.querySelector(':scope > button');
            if (!showMoreBtn) return [];
            showMoreBtn.click();
            await delay(delayMin, delayMax);
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
                    const scroller = getReplyScroller();
                    if (!scroller) break;
                    const scrollBefore = scroller.scrollTop;
                    scroller.scrollBy(0, scrollStep);
                    await delay(delayMin, delayMax);
                    if (scroller.scrollTop === scrollBefore) break;
                }
            } finally {
                await returnToParentPage(delayMin, delayMax);
            }
            return all.slice(0, commentReplyLimit);
        };
        let crawling = false;
        const crawl = async (cfg) => {
            if (crawling) return { ok: false, error: '爬取进行中' };
            const { commentLimit, crawlReplies, delayMin, delayMax, scrollStep } = cfg;
            crawling = true;
            console.log('开始爬取评论…');
            const results = [];
            const scroller = getParentScroller();
            try {
                while (results.length < commentLimit) {
                    if (!scroller) {
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
                    const scrollBefore = scroller.scrollTop;
                    scroller.scrollBy(0, scrollStep);
                    await delay(delayMin, delayMax);
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
