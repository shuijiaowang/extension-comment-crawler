const HOOK_SOURCE = 'bili-reply-hook';

export default defineContentScript({
    matches: ['https://www.bilibili.com/*'],
    world: 'MAIN',
    runAt: 'document_start',
    main() {
        const isReplyApi = (url) => String(url).includes('/x/v2/reply/');

        const emit = (url, status, payload) => {
            window.postMessage({ source: HOOK_SOURCE, url, status, payload }, '*');
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
            const url = String(args[0]);
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
            this._biliHookUrl = url;
            return open.call(this, method, url, ...rest);
        };

        XMLHttpRequest.prototype.send = function (...args) {
            this.addEventListener('load', function () {
                if (!isReplyApi(this._biliHookUrl)) return;
                handleBody(this._biliHookUrl, this.status, this.responseText);
            });
            return send.apply(this, args);
        };

        console.log('[bilibili-reply-hook] 主世界 hook 已启动');
    },
});
