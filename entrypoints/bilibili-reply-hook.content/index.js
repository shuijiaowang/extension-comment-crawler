const HOOK_SOURCE = 'bili-reply-hook';

export default defineContentScript({
    matches: ['https://www.bilibili.com/*'],
    world: 'MAIN',
    runAt: 'document_start',
    main() {
        /** @param {unknown} input */
        const resolveUrl = (input) => {
            if (typeof input === 'string') return input;
            if (input instanceof Request) return input.url;
            if (input instanceof URL) return input.href;
            return String(input);
        };

        const isMainViewApi = (url) => {
            try {
                const path = new URL(url, location.origin).pathname;
                return path === '/x/web-interface/view' || path === '/x/web-interface/wbi/view';
            } catch {
                return false;
            }
        };

        const isHookedApi = (url) => {
            const u = resolveUrl(url);
            return u.includes('/x/v2/reply/') || isMainViewApi(u);
        };

        const emit = (url, status, payload) => {
            window.postMessage({ source: HOOK_SOURCE, url, status, payload }, '*');
        };

        const handleBody = (url, status, text) => {
            if (!isHookedApi(url)) return;
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
            if (isHookedApi(url)) {
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
            this._biliHookUrl = url;
            return open.call(this, method, url, ...rest);
        };

        XMLHttpRequest.prototype.send = function (...args) {
            this.addEventListener('load', function () {
                if (!isHookedApi(this._biliHookUrl)) return;
                handleBody(this._biliHookUrl, this.status, this.responseText);
            });
            return send.apply(this, args);
        };

        console.log('[bilibili-reply-hook] 主世界 hook 已启动');
    },
});
