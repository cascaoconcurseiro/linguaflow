// content/hbo-inject.js
// Injetado via manifest world:MAIN + document_start
// Intercepta XHR para capturar VTT de legendas do HBO/Max
(function () {
    if (window.__lf_hbo_injected) return;
    window.__lf_hbo_injected = true;

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
            if (!url.includes('.vtt')) return;
            if (url.includes('empty-dash-subs')) return;

            // Usa this.response — funciona com qualquer responseType
            var raw = self.response;
            var text = '';

            if (typeof raw === 'string') {
                text = raw;
            } else if (raw instanceof ArrayBuffer) {
                try { text = new TextDecoder('utf-8').decode(raw); } catch (e) {}
            } else {
                // responseType não é string nem arraybuffer — tenta responseText com try/catch
                try { text = self.responseText || ''; } catch (e) {}
            }

            if (text && (text.includes('WEBVTT') || text.includes('-->'))) {
                console.log('[LF-inject] VTT interceptado:', url.substring(0, 80));
                document.dispatchEvent(new CustomEvent('LF_HBO_SUB', {
                    detail: { url: url, response: text }
                }));
            }
        });
        return _send.apply(this, arguments);
    };

    console.log('[LF-inject] HBO intercept instalado');
})();
