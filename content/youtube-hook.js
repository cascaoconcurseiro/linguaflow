// content/youtube-hook.js
// Script injetado no MAIN WORLD para contornar o CSP estrito do YouTube
// e capturar a legenda direto da fonte de rede sem atraso.

(function() {
    console.log('[LinguaFlow] ⚡ Hook Superior Ativado (Nível: Main World)');

    const notifyExt = (url, body) => {
        window.postMessage({ 
            type: 'LF_SUBTITLE_HOOK', 
            url: url, 
            data: body,
            timestamp: Date.now()
        }, '*');
    };

    // ── INTERCEPTAÇÃO DE REDE (Fetch & XHR) ───────────────────────────────────
    
    // Hook Fetch (Padrão moderno)
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = args[0];
        const urlStr = typeof url === 'string' ? url : (url instanceof URL ? url.href : '');

        // Padrões Universais: YouTube (timedtext), Netflix (nflxvideo), HBO/Max (vtt/ttml)
        const isSubtitle = urlStr.includes('timedtext') || 
                           urlStr.includes('api/timedtext') || 
                           urlStr.includes('nflxvideo.net') || 
                           urlStr.includes('.vtt') || 
                           urlStr.includes('.ttml') ||
                           urlStr.includes('subtitles');

        if (isSubtitle) {
            try {
                const response = await originalFetch.apply(this, args);
                const clone = response.clone();
                
                // Se for Netflix ou HBO, o conteúdo pode ser binário ou comprimido
                if (urlStr.includes('nflxvideo.net') || urlStr.includes('.vtt')) {
                    clone.arrayBuffer().then(buf => {
                        window.postMessage({ type: 'LF_SUBTITLE_HOOK', url: urlStr, data: buf, isBinary: true }, '*');
                    }).catch(() => {});
                } else {
                    clone.text().then(text => notifyExt(urlStr, text)).catch(() => {});
                }
                return response;
            } catch (e) {
                return originalFetch.apply(this, args);
            }
        }
        return originalFetch.apply(this, args);
    };

    // Hook XHR (Fallback e robustez)
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        const urlStr = typeof url === 'string' ? url : '';
        const isSubtitle = urlStr.includes('timedtext') || 
                           urlStr.includes('nflxvideo.net') || 
                           urlStr.includes('.vtt') || 
                           urlStr.includes('subtitles');

        if (isSubtitle) {
            this.addEventListener('load', function() {
                if (this.responseType === 'arraybuffer' || this.response instanceof ArrayBuffer) {
                    window.postMessage({ type: 'LF_SUBTITLE_HOOK', url: urlStr, data: this.response, isBinary: true }, '*');
                } else {
                    notifyExt(urlStr, this.responseText);
                }
            });
        }
        return originalOpen.apply(this, arguments);
    };

    // ── INTERCEPTAÇÃO DO PLAYER (YouTube API) ────────────────────────────────
    
    // Tenta capturar o player do YouTube para monitorar estados (Pause/Play/Seek)
    let lastPlayerState = -1;
    const monitorPlayer = () => {
        const moviePlayer = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
        if (moviePlayer && moviePlayer.addEventListener) {
            // Se o YouTube trocar de legenda via API interna, pegamos aqui
            moviePlayer.addEventListener('onStateChange', (state) => {
                if (state !== lastPlayerState) {
                    window.postMessage({ type: 'LF_PLAYER_STATE', state: state }, '*');
                    lastPlayerState = state;
                }
            });
            console.log('[LinguaFlow] 🎥 Monitor de Player acoplado com sucesso.');
        } else {
            setTimeout(monitorPlayer, 1000); // Tenta novamente se o player ainda não carregou
        }
    };

    // ── MONITOR DE MENU NATIVO ──────────────────────────────────────────────
    
    // Detecta quando o usuário clica no botão de legenda do YouTube
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.ytp-subtitles-button');
        if (btn) {
            const isActive = btn.getAttribute('aria-pressed') === 'true';
            window.postMessage({ type: 'LF_YT_SUB_TOGGLE', active: !isActive }, '*');
        }
    }, true);

    // Inicializa monitores
    if (document.readyState === 'complete') monitorPlayer();
    else window.addEventListener('load', monitorPlayer);

})();
