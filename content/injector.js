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
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL(scriptToInject);
        script.onload = () => script.remove();
        (document.head || document.documentElement).appendChild(script);
    }
})();
