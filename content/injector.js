// content/injector.js
// Injeta scripts no MAIN world contornando o bug do Chrome (Manifest V3) que gera spam
// de "Blocked script execution in 'about:blank'" quando usamos "world": "MAIN" no manifest.json.

(function() {
    // Apenas injeta no top frame, para evitar rodar em iframes do YouTube (ads, etc)
    if (window !== window.top) return;

    const hostname = window.location.hostname;
    const isYouTube = hostname.includes('youtube.com');
    const isHBO = hostname.includes('hbomax.com') || hostname.includes('max.com') || hostname.includes('hbo.com');

    let scriptToInject = null;
    if (isYouTube) scriptToInject = 'content/youtube-hook.js';
    else if (isHBO) scriptToInject = 'content/hbo-inject.js';

    if (scriptToInject) {
      const bridgeStateKey = '__linguaFlowSubtitleBridge';
      const createNonce = () => {
        const bytes = new Uint8Array(24);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      };

      const installBridge = () => {
        const navigationUrl = window.location.href;
        const current = window[bridgeStateKey];
        if (current?.url === navigationUrl) return;

        const previousNonce = current?.nonce || '';
        const nonce = createNonce();
        window[bridgeStateKey] = Object.freeze({ nonce, url: navigationUrl });

        const script = document.createElement('script');
        script.src = chrome.runtime.getURL(scriptToInject);
        script.dataset.lfNonce = nonce;
        script.dataset.lfPreviousNonce = previousNonce;
        script.dataset.lfNavigationUrl = navigationUrl;
        script.onload = () => script.remove();
        (document.head || document.documentElement).appendChild(script);
      };

      installBridge();
      setInterval(installBridge, 500);
    }
})();
