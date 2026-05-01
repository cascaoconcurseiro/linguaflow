// content/youtube-hook.js
// Script injetado no MAIN WORLD para contornar o CSP estrito do YouTube
// e capturar a legenda direto da fonte de rede sem atraso.

(function() {
    const notifyExt = (url, body) => {
        window.postMessage({ type: 'LF_SUBTITLE_HOOK', url: url, data: body }, '*');
    };
    
    // Hook Fetch (Maioria das requisições modernas)
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = args[0];
        if (typeof url === 'string' && (url.includes('timedtext') || url.includes('api/timedtext'))) {
            const response = await originalFetch.apply(this, args);
            const clone = response.clone();
            clone.text().then(text => notifyExt(url, text)).catch(e => {});
            return response;
        }
        return originalFetch.apply(this, args);
    };
    
    // Hook XHR (Fallback antigo do YouTube)
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string' && (url.includes('timedtext') || url.includes('api/timedtext'))) {
            this.addEventListener('load', function() {
                notifyExt(url, this.responseText);
            });
        }
        return originalOpen.apply(this, arguments);
    };
})();
