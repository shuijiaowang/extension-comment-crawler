(function () {
    console.log("🚀 Reply Hook 已启动");

    // fetch
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
        const url = String(args[0]);

        const response = await originalFetch.apply(this, args);

        if (url.includes("reply")) {
            const clone = response.clone();

            try {
                const text = await clone.text();

                console.group("📡 FETCH REPLY");
                console.log("URL:", url);
                console.log("STATUS:", response.status);

                try {
                    console.log(JSON.parse(text));
                } catch {
                    console.log(text);
                }

                console.groupEnd();
            } catch (e) {
                console.error(e);
            }
        }

        return response;
    };

    // xhr
    const open = XMLHttpRequest.prototype.open;
    const send = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
        this._url = url;
        return open.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
        this.addEventListener("load", function () {
            if (!String(this._url).includes("reply")) {
                return;
            }

            console.group("📡 XHR REPLY");
            console.log("URL:", this._url);
            console.log("STATUS:", this.status);

            try {
                console.log(JSON.parse(this.responseText));
            } catch {
                console.log(this.responseText);
            }

            console.groupEnd();
        });

        return send.apply(this, arguments);
    };
})();