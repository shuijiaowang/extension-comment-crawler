import { getDomainConfigStorage, MESSAGE_START_CRAWL } from '../../core/config.js';

export default defineContentScript({
    matches: ['https://www.xiaohongshu.com/explore/*'],
    runAt: 'document_idle',
    main() {
        console.log('xiaohongshu comment craw Content Script');
        const configStorage = getDomainConfigStorage(window.location.hostname);
        const delay = (min, max) => new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
        const getScroller = () => document.querySelector('.note-scroller');
        const getCommentsListContainer = () =>
            document.querySelector('.comments-el .comments-container')?.querySelector('.list-container');
        const parseCommentItem = (item) => {
            if (!item) return null;
            const avatar = item.querySelector('.avatar a');
            return {
                userId: avatar?.getAttribute('data-user-id') ?? '',
                userName: item.querySelector('.author a')?.textContent?.trim() ?? '',
                isAuthor: item.querySelector('.author span')?.textContent?.trim() ?? '',
                content: item.querySelector('.content')?.textContent?.trim() ?? '',
                picture: item.querySelector('.comment-picture') ? '[图片]' : '',
                time: item.querySelector('.date span')?.textContent?.trim() ?? '',
                location: item.querySelector('.date .location')?.textContent?.trim() ?? '',
                like: item.querySelector('.interactions .like .count')?.textContent?.trim() || '0',
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
        const expandAndScrapeReplies = async (parentEl, cfg) => {
            const { commentReplyLimit, delayMin, delayMax } = cfg;
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
                const showMore = parentEl.querySelector('.reply-container .show-more');
                if (!showMore) break;
                const before = parentEl.querySelectorAll('.reply-container .list-container .comment-item').length;
                showMore.click();
                await delay(delayMin, delayMax);
                const after = parentEl.querySelectorAll('.reply-container .list-container .comment-item').length;
                if (after <= before) break;
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
            const scroller = getScroller();
            try {
                while (results.length < commentLimit) {
                    const listContainer = getCommentsListContainer();
                    if (!listContainer) {
                        console.warn('未找到评论区域');
                        break;
                    }
                    const parents = listContainer.querySelectorAll('.parent-comment');
                    while (results.length < commentLimit && results.length < parents.length) {
                        const parentEl = parents[results.length];
                        const first = parseParentComment(parentEl);
                        const replies = crawlReplies ? await expandAndScrapeReplies(parentEl, cfg) : [];
                        const row = first ? { ...first, replies } : { error: '解析失败', replies: [] };
                        results.push(row);
                        console.log(`[${results.length}]`, row);
                    }
                    if (results.length >= commentLimit) break;
                    if (!scroller) break;
                    const scrollBefore = scroller.scrollTop;
                    scroller.scrollBy(0, scrollStep);
                    await delay(delayMin, delayMax);
                    const parentsAfter = getCommentsListContainer()?.querySelectorAll('.parent-comment').length ?? 0;
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
