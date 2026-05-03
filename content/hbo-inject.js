// content/hbo-inject.js
// Injetado via manifest world:MAIN + document_start
// Intercepta XHR e Fetch para capturar VTT de legendas do HBO/Max/Netflix
(function () {
    if (window.__lf_hbo_injected) return;
    window.__lf_hbo_injected = true;

    console.log('[LF-inject] HBO/Max intercept instalado (XHR + Fetch)');

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
        const url = args[0] instanceof Request ? args[0].url : args[0];
        
        if (typeof url === 'string' && (url.includes('.vtt') || url.includes('subtitle') || url.includes('caption'))) {
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
        if (url.includes('empty-dash-subs')) return;

        // Filtro agressivo para VTT ou conteúdo que pareça legenda
        const isVtt = url.includes('.vtt') || url.includes('.webvtt');
        const hasVttHeader = typeof content === 'string' && (content.includes('WEBVTT') || content.includes('-->'));

        if (isVtt || hasVttHeader) {
            console.log('[LF-inject] Legenda detectada, enviando via postMessage');
            window.postMessage({
                type: 'LF_HBO_SUB',
                url: url,
                response: content
            }, '*');
        }
    }
})();
