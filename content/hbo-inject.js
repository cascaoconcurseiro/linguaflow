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
        return true;
    };
    window.__lf_hbo_injected = true;

    const postBridgeMessage = (payload) => window.postMessage({
        ...payload,
        nonce: bridgeNonce,
        pageUrl: bridgeUrl,
    }, window.location.origin);

    console.debug('[LF-inject] HBO/Max intercept instalado (XHR + Fetch)');

    // ── Intercepta XMLHttpRequest ───────────────────────────────────────────
    var _open = XMLHttpRequest.prototype.open;
    var _send = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
        this._lf_url = (typeof url === 'string') ? url : String(url || '');
        return _open.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
        var self = this;
        this.addEventListener('load', function () {
            var url = self._lf_url || '';
            handleSubtitleData(url, self.response || self.responseText);
        });
        return _send.apply(this, arguments);
    };

    // ── Intercepta Fetch API ────────────────────────────────────────────────
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        const rawUrl = args[0] instanceof Request ? args[0].url : (args[0] instanceof URL ? args[0].href : String(args[0]?.url || args[0] || ''));
        const url = typeof rawUrl === 'string' ? rawUrl : String(rawUrl || '');
        
        const isUrlCandidate = url && (
            url.includes('.vtt') ||
            url.includes('.webvtt') ||
            url.includes('.m3u8') ||
            url.includes('.mpd') ||
            url.includes('subtitle') ||
            url.includes('caption') ||
            url.includes('timedtext') ||
            url.includes('segment') ||
            url.includes('seg-') ||
            url.includes('seg_')
        );
        const contentType = response?.headers?.get?.('content-type') || '';
        const isContentTypeCandidate = contentType.includes('text/vtt') ||
                                       contentType.includes('application/x-subrip') ||
                                       contentType.includes('application/ttml+xml') ||
                                       contentType.includes('application/vnd.apple.mpegurl') ||
                                       contentType.includes('application/x-mpegurl');

        if (isUrlCandidate || isContentTypeCandidate) {
            const clone = response.clone();
            clone.text().then(text => {
                handleSubtitleData(url, text);
            }).catch(() => {});
        }
        return response;
    };

    // ── Processamento de Dados de Legenda ───────────────────────────────────
    function handleSubtitleData(url, content) {
        if (!url || !content) return;
        if (typeof url !== 'string') url = String(url);
        if (url.includes('empty-dash-subs')) return;

        const isVtt = url.includes('.vtt') || url.includes('.webvtt');
        let textSample = '';
        if (typeof content === 'string') {
            textSample = content.substring(0, 4096);
        } else if (content instanceof ArrayBuffer) {
            try {
                textSample = new TextDecoder('utf-8').decode(content.slice(0, 4096));
            } catch (e) {}
        }

        const hasVttHeader = textSample.includes('WEBVTT') || textSample.includes('-->');
        const isM3u8Subtitle = textSample.includes('#EXTM3U') && (
            textSample.includes('.vtt') ||
            textSample.includes('SUBTITLES') ||
            textSample.includes('#EXTINF') ||
            url.includes('sub') ||
            url.includes('caption')
        );

        if (isVtt || hasVttHeader || isM3u8Subtitle) {
            console.debug('[LF-inject] Legenda ou playlist detectada, enviando via postMessage');
            postBridgeMessage({
                type: 'LF_HBO_SUB',
                url: url,
                response: content
            });
        }
    }
})();
