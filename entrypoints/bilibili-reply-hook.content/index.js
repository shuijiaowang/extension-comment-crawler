const HOOK_SOURCE = 'bili-reply-hook';
const CRAWLER_SOURCE = 'bili-crawler';

export default defineContentScript({
    matches: ['https://www.bilibili.com/*'],
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

        const isReplyApi = (url) => resolveUrl(url).includes('/x/v2/reply/');

        const emit = (url, status, payload) => {
            window.postMessage({ source: HOOK_SOURCE, url, status, payload }, '*');
        };

        const readInitialStateSlice = () => {
            const state = window.__INITIAL_STATE__;
            if (!state?.videoData) return null;
            return {
                videoData: state.videoData,
                upData: state.upData ?? null,
            };
        };

        const emitInitialState = () => {
            const slice = readInitialStateSlice();
            if (!slice) return false;
            window.postMessage({ source: HOOK_SOURCE, type: 'initial-state', payload: slice }, '*');
            return true;
        };

        const handleBody = (url, status, text) => {
            if (!isReplyApi(url)) return;
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
            if (isReplyApi(url)) {
                try {
                    const text = await response.clone().text();
                    handleBody(url, response.status, text);
                } catch (e) {
                    console.error('[bilibili-reply-hook] fetch 解析失败', e);
                }
            }
            return response;
        };

        const open = XMLHttpRequest.prototype.open;
        const send = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            this._biliHookUrl = resolveUrl(url);
            return open.call(this, method, url, ...rest);
        };

        XMLHttpRequest.prototype.send = function (...args) {
            this.addEventListener('load', function () {
                if (!isReplyApi(this._biliHookUrl)) return;
                handleBody(this._biliHookUrl, this.status, this.responseText);
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

        console.log('[bilibili-reply-hook] 主世界 hook 已启动（评论 API + __INITIAL_STATE__）');
    },
});
