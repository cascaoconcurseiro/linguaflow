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
      let intervalId = null;
      let stopped = false;
      const stopBridge = () => {
        stopped = true;
        if (intervalId !== null) clearInterval(intervalId);
        document.removeEventListener('yt-navigate-finish', installBridge);
        document.removeEventListener('yt-navigate-start', installBridge);
        window.removeEventListener('popstate', installBridge);
      };
      const createNonce = () => {
        const bytes = new Uint8Array(24);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      };

      const installBridge = () => {
        if (stopped) return;
        if (!globalThis.chrome?.runtime?.id || !globalThis.chrome?.runtime?.getURL) {
          stopBridge();
          return;
        }
        const navigationUrl = window.location.href;
        const current = window[bridgeStateKey];
        if (current?.url === navigationUrl) return;

        const previousNonce = current?.nonce || '';
        const nonce = createNonce();
        const script = document.createElement('script');
        try {
          script.src = chrome.runtime.getURL(scriptToInject);
        } catch (error) {
          if (!globalThis.chrome?.runtime?.id || /Extension context invalidated/i.test(error?.message || '')) {
            stopBridge();
            return;
          }
          throw error;
        }
        script.dataset.lfNonce = nonce;
        script.dataset.lfPreviousNonce = previousNonce;
        script.dataset.lfNavigationUrl = navigationUrl;
        script.onload = () => script.remove();
        window[bridgeStateKey] = Object.freeze({ nonce, url: navigationUrl });
        (document.head || document.documentElement).appendChild(script);
      };

      installBridge();
      if (stopped) return;
      intervalId = setInterval(installBridge, 500);
      if (isYouTube) {
        document.addEventListener('yt-navigate-finish', installBridge);
        document.addEventListener('yt-navigate-start', installBridge);
      }
      window.addEventListener('popstate', installBridge);
    }
})();
