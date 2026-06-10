const HOOK_SOURCE = 'xhs-comment-hook';
const CRAWLER_SOURCE = 'xhs-crawler';

export default defineContentScript({
    matches: ['https://www.xiaohongshu.com/explore/*'],
    world: 'MAIN',
    runAt: 'document_start',
    main() {
        /** @param {unknown} input */
        const resolveUrl = (input) => {
            if (typeof input === 'string') return input;
            if (input && typeof input === 'object') {
                if (typeof input.url === 'string') return input.url;
                if (typeof input.href === 'string') return input.href;
            }
            return String(input);
        };

        const isCommentApi = (url) => {
            const u = resolveUrl(url);
            return u.includes('/api/sns/web/v2/comment/page') || u.includes('/api/sns/web/v2/comment/sub/page');
        };

        const emit = (url, status, payload) => {
            window.postMessage({ source: HOOK_SOURCE, url, status, payload }, '*');
        };

        const readInitialStateSlice = () => {
            const noteState = window.__INITIAL_STATE__?.note;
            if (!noteState?.noteDetailMap || typeof noteState.noteDetailMap !== 'object') return null;
            return {
                currentNoteId: noteState.currentNoteId ?? noteState.firstNoteId ?? '',
                noteDetailMap: noteState.noteDetailMap,
            };
        };

        const emitInitialState = () => {
            const slice = readInitialStateSlice();
            if (!slice?.noteDetailMap || !Object.keys(slice.noteDetailMap).length) return false;
            window.postMessage({ source: HOOK_SOURCE, type: 'initial-state', payload: slice }, '*');
            return true;
        };

        const handleBody = (url, status, text) => {
            if (!isCommentApi(url)) return;
            let payload;
            try {
                payload = JSON.parse(text);
            } catch {
                payload = { _raw: text };
            }
            emit(url, status, payload);
        };

        const originalFetch = window.fetch;
        window.fetch = async function (...args) {
            const url = resolveUrl(args[0]);
            const response = await originalFetch.apply(this, args);
            if (isCommentApi(url)) {
                try {
                    const text = await response.clone().text();
                    handleBody(url, response.status, text);
                } catch (e) {
                    console.error('[xhs-comment-hook] fetch 解析失败', e);
                }
            }
            return response;
        };

        const open = XMLHttpRequest.prototype.open;
        const send = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            this._xhsHookUrl = resolveUrl(url);
            return open.call(this, method, url, ...rest);
        };

        XMLHttpRequest.prototype.send = function (...args) {
            this.addEventListener('load', function () {
                if (!isCommentApi(this._xhsHookUrl)) return;
                handleBody(this._xhsHookUrl, this.status, this.responseText);
            });
            return send.apply(this, args);
        };

        window.addEventListener('message', (event) => {
            if (event.source !== window || event.data?.source !== CRAWLER_SOURCE) return;
            if (event.data.type === 'read-initial-state') {
                emitInitialState();
            }
        });

        const poll = window.setInterval(() => {
            if (emitInitialState()) window.clearInterval(poll);
        }, 200);
        window.setTimeout(() => window.clearInterval(poll), 30000);

        console.log('[xhs-comment-hook] 主世界 hook 已启动（评论 API + __INITIAL_STATE__）');
    },
});
