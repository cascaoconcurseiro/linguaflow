// content/hbo-inject.js
// Injetado via manifest world:MAIN + document_start
// Intercepta XHR e Fetch para capturar VTT de legendas do HBO/Max/Netflix
(function () {
    const injectedScript = document.currentScript;
    let bridgeNonce = injectedScript?.dataset?.lfNonce || '';
    const previousNonce = injectedScript?.dataset?.lfPreviousNonce || '';
    let bridgeUrl = injectedScript?.dataset?.lfNavigationUrl || window.location.href;
    if (!bridgeNonce) return;

    if (typeof window.__lf_hbo_bridge_update === 'function') {
        window.__lf_hbo_bridge_update(previousNonce, bridgeNonce, bridgeUrl);
        return;
    }
    window.__lf_hbo_bridge_update = (currentNonce, nonce, navigationUrl) => {
        if (currentNonce !== bridgeNonce || !nonce) return false;
        bridgeNonce = nonce;
        bridgeUrl = navigationUrl;
        replayCapturedCaptions();
        return true;
    };
    window.__lf_hbo_injected = true;

    const postBridgeMessage = (payload) => window.postMessage({
        ...payload,
        nonce: bridgeNonce,
        pageUrl: bridgeUrl,
    }, window.location.origin);

    const capturedCaptions = [];
    const replayCapturedCaptions = () => {
        for (const entry of capturedCaptions) {
            if (entry.pageUrl === window.location.href) postBridgeMessage(entry.payload);
        }
    };
    window.addEventListener('message', (event) => {
        if (event.source !== window || event.origin !== window.location.origin) return;
        if (event.data?.type === 'LF_PRELOAD_SUBTITLES') replayCapturedCaptions();
    });

    console.debug('[LF-inject] HBO/Max intercept instalado (XHR + Fetch)');

    // ── Intercepta XMLHttpRequest ───────────────────────────────────────────
    var _open = XMLHttpRequest.prototype.open;
    var _send = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
        this._lf_url = (typeof url === 'string') ? url : String(url || '');
        this._lf_pageUrl = window.location.href;
        return _open.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
        var self = this;
        this.addEventListener('load', function () {
            var url = self._lf_url || '';
            handleSubtitleData(url, self.response || self.responseText, self._lf_pageUrl);
        });
        return _send.apply(this, arguments);
    };

    // ── Intercepta Fetch API ────────────────────────────────────────────────
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const pageUrl = window.location.href;
        const response = await originalFetch(...args);
        const rawUrl = args[0] instanceof Request ? args[0].url : (args[0] instanceof URL ? args[0].href : String(args[0]?.url || args[0] || ''));
        const url = typeof rawUrl === 'string' ? rawUrl : String(rawUrl || '');
        
        const isUrlCandidate = url && (
            url.includes('.vtt') ||
            url.includes('.webvtt') ||
            url.includes('subtitle') ||
            url.includes('caption') ||
            url.includes('timedtext')
        );
        const contentType = response?.headers?.get?.('content-type') || '';
        const isContentTypeCandidate = contentType.includes('text/vtt') ||
                                       contentType.includes('application/x-subrip') ||
                                       contentType.includes('application/ttml+xml');

        if (isUrlCandidate || isContentTypeCandidate) {
            const clone = response.clone();
            clone.text().then(text => {
                handleSubtitleData(url, text, pageUrl);
            }).catch(() => {});
        }
        return response;
    };

    // ── Processamento de Dados de Legenda ───────────────────────────────────
    function handleSubtitleData(url, content, pageUrl) {
        if (!url || !content) return;
        if (pageUrl !== window.location.href) return;
        if (typeof url !== 'string') url = String(url);
        if (url.includes('empty-dash-subs')) return;

        // Filtro agressivo para VTT ou conteúdo que pareça legenda
        const isVtt = url.includes('.vtt') || url.includes('.webvtt');
        let hasVttHeader = false;
        if (typeof content === 'string') {
            hasVttHeader = content.includes('WEBVTT') || content.includes('-->');
        } else if (content instanceof ArrayBuffer) {
            try {
                const sample = new TextDecoder('utf-8').decode(content.slice(0, 2048));
                hasVttHeader = sample.includes('WEBVTT') || sample.includes('-->');
            } catch (e) {}
        }

        if (isVtt || hasVttHeader) {
            console.debug('[LF-inject] Legenda detectada, enviando via postMessage');
            const payload = {
                type: 'LF_HBO_SUB',
                url: url,
                response: content
            };
            // Bounded in-memory replay for the engine loaded at document_idle.
            // Scope to the request's page so late responses cannot cross videos.
            const size = typeof content === 'string' ? content.length * 2 : content.byteLength;
            if (size <= 1024 * 1024) {
                for (let i = capturedCaptions.length - 1; i >= 0; i--) {
                    if (capturedCaptions[i].pageUrl !== pageUrl || capturedCaptions[i].payload.url === url) capturedCaptions.splice(i, 1);
                }
                capturedCaptions.push({ pageUrl, payload });
                if (capturedCaptions.length > 4) capturedCaptions.shift();
            }
            postBridgeMessage(payload);
        }
    }
})();
