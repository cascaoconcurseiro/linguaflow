// content/youtube-hook.js
// Script injetado no MAIN WORLD para contornar o CSP estrito do YouTube
// e capturar a legenda direto da fonte de rede sem atraso.

(function() {
    const injectedScript = document.currentScript;
    let bridgeNonce = injectedScript?.dataset?.lfNonce || '';
    const previousNonce = injectedScript?.dataset?.lfPreviousNonce || '';
    let bridgeUrl = injectedScript?.dataset?.lfNavigationUrl || window.location.href;
    if (!bridgeNonce) return;

    if (typeof window.__lf_youtube_bridge_update === 'function') {
        window.__lf_youtube_bridge_update(previousNonce, bridgeNonce, bridgeUrl);
        return;
    }
    window.__lf_youtube_bridge_update = (currentNonce, nonce, navigationUrl) => {
        if (currentNonce !== bridgeNonce || !nonce) return false;
        bridgeNonce = nonce;
        bridgeUrl = navigationUrl;
        return true;
    };

    console.debug('[LinguaFlow] ⚡ Hook Superior Ativado (Nível: Main World)');

    const postBridgeMessage = (payload) => window.postMessage({
        ...payload,
        nonce: bridgeNonce,
        pageUrl: bridgeUrl,
    }, window.location.origin);

    const notifyExt = (url, body) => {
        postBridgeMessage({
            type: 'LF_SUBTITLE_HOOK', 
            url: url, 
            data: body,
            timestamp: Date.now()
        });
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
                        postBridgeMessage({ type: 'LF_SUBTITLE_HOOK', url: urlStr, data: buf, isBinary: true });
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
                    postBridgeMessage({ type: 'LF_SUBTITLE_HOOK', url: urlStr, data: this.response, isBinary: true });
                } else {
                    notifyExt(urlStr, this.responseText);
                }
            });
        }
        return originalOpen.apply(this, arguments);
    };

    // ── GESTÃO DE TRILHA ORIGINAL (YouTube Player API) ──────────────────────
    let currentSourceLang = 'en';

    const ensureOriginalTrack = () => {
        try {
            const moviePlayer = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
            if (!moviePlayer || typeof moviePlayer.getOption !== 'function' || typeof moviePlayer.setOption !== 'function') {
                return false;
            }
            const tracklist = moviePlayer.getOption('captions', 'tracklist') || [];
            if (!Array.isArray(tracklist) || tracklist.length === 0) return false;

            const currentTrack = moviePlayer.getOption('captions', 'track') || {};
            const isSourceLang = currentTrack.languageCode && currentTrack.languageCode.startsWith(currentSourceLang);
            const isTranslated = Boolean(currentTrack.translationLanguage);

            // Se a trilha atual já for do idioma original sem auto-tradução ativa, mantém
            if (isSourceLang && !isTranslated) return true;

            // Busca a melhor trilha original: 1º manual em sourceLang, 2º qualquer em sourceLang (ex: ASR)
            const manualTrack = tracklist.find((t) => t.languageCode?.startsWith(currentSourceLang) && t.kind !== 'asr');
            const anySourceTrack = tracklist.find((t) => t.languageCode?.startsWith(currentSourceLang));
            const bestTrack = manualTrack || anySourceTrack;

            if (bestTrack) {
                console.debug('[LinguaFlow] 🎯 Forçando trilha original no YouTube:', bestTrack.languageCode);
                moviePlayer.setOption('captions', 'track', {
                    languageCode: bestTrack.languageCode,
                    vssId: bestTrack.vssId,
                });
                try {
                    moviePlayer.setOption('captions', 'translationLanguages', []);
                } catch {}
                return true;
            }
        } catch (err) {
            console.debug('[LinguaFlow] Erro ao selecionar trilha original:', err);
        }
        return false;
    };

    window.addEventListener('message', (e) => {
        if (e.origin !== window.location.origin || e.source !== window) return;
        if (!e.data || typeof e.data !== 'object') return;
        if (e.data.type === 'LF_SET_SOURCE_LANG' && typeof e.data.sourceLang === 'string') {
            currentSourceLang = e.data.sourceLang;
            ensureOriginalTrack();
        }
    });

    // ── INTERCEPTAÇÃO DO PLAYER (YouTube API) ────────────────────────────────
    
    // Tenta capturar o player do YouTube para monitorar estados (Pause/Play/Seek)
    let lastPlayerState = -1;
    const monitorPlayer = () => {
        const moviePlayer = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
        if (moviePlayer && moviePlayer.addEventListener) {
            ensureOriginalTrack();
            // Se o YouTube trocar de legenda via API interna, pegamos aqui
            moviePlayer.addEventListener('onStateChange', (state) => {
                if (state !== lastPlayerState) {
                    postBridgeMessage({ type: 'LF_PLAYER_STATE', state });
                    lastPlayerState = state;
                }
                if (state === 1 || state === -1) {
                    ensureOriginalTrack();
                }
            });
            console.debug('[LinguaFlow] 🎥 Monitor de Player acoplado com sucesso.');
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
            postBridgeMessage({ type: 'LF_YT_SUB_TOGGLE', active: !isActive });
        }
    }, true);

    // Inicializa monitores
    if (document.readyState === 'complete') monitorPlayer();
    else window.addEventListener('load', monitorPlayer);

})();
