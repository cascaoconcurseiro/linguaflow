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

    const originalFetch = window.fetch;
    let preloadedVideoKey = '';
    let interceptedFullTrackKey = '';

    const getCurrentVideoId = () => {
        try {
            return new URLSearchParams(window.location.search).get('v') || '';
        } catch {
            return '';
        }
    };

    const getCaptionTracks = () => {
        try {
            const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
            let response = typeof player?.getPlayerResponse === 'function' ? player.getPlayerResponse() : null;
            if (typeof response === 'string') {
                try { response = JSON.parse(response); } catch {}
            }
            if (!response || !response.captions) {
                const flexy = document.querySelector('ytd-watch-flexy');
                if (flexy && flexy.playerData) {
                    response = flexy.playerData;
                    if (typeof response === 'string') {
                        try { response = JSON.parse(response); } catch {}
                    }
                }
            }
            if (!response || !response.captions) {
                response = window.ytInitialPlayerResponse;
                if (typeof response === 'string') {
                    try { response = JSON.parse(response); } catch {}
                }
            }
            const currentVid = getCurrentVideoId();
            const responseVid = response?.videoDetails?.videoId;
            if (currentVid && responseVid && currentVid !== responseVid) return [];

            const tracks = response?.captions?.playerCaptionsTracklistRenderer?.captionTracks
                || response?.captions?.playerCaptionsRenderer?.captionTracks;
            return Array.isArray(tracks) ? tracks : [];
        } catch {
            return [];
        }
    };

    const preloadFullSubtitleTrack = async (attempt = 0) => {
        const videoId = getCurrentVideoId();
        if (!videoId) return;
        const tracks = getCaptionTracks();
        if (!tracks.length) {
            if (attempt < 8) setTimeout(() => preloadFullSubtitleTrack(attempt + 1), Math.min(1500, 350 * (attempt + 1)));
            return;
        }

        const manual = tracks.find((track) => track.languageCode?.startsWith(currentSourceLang) && track.kind !== 'asr');
        const source = tracks.find((track) => track.languageCode?.startsWith(currentSourceLang));
        const track = manual || source || tracks[0];
        if (!track?.baseUrl) return;

        const url = new URL(track.baseUrl, window.location.href);
        url.searchParams.delete('tlang');
        url.searchParams.delete('t');
        url.searchParams.delete('range');
        url.searchParams.delete('spv');
        url.searchParams.set('fmt', 'json3');
        const preloadKey = `${videoId}:${currentSourceLang}:${url}`;
        if (preloadedVideoKey === preloadKey) return;
        preloadedVideoKey = preloadKey;

        try {
            let response = await originalFetch(url.toString(), { credentials: 'same-origin' });
            if (!response.ok && response.status !== 304) {
                const fallbackUrl = new URL(track.baseUrl, window.location.href);
                fallbackUrl.searchParams.delete('tlang');
                fallbackUrl.searchParams.delete('t');
                fallbackUrl.searchParams.delete('range');
                fallbackUrl.searchParams.delete('spv');
                response = await originalFetch(fallbackUrl.toString(), { credentials: 'same-origin' });
                if (!response.ok) throw new Error(`subtitle_status_${response.status}`);
            }
            const body = await response.text();
            if (body && body.length > 10) notifyExt(url.toString(), body);
            else preloadedVideoKey = '';
        } catch (error) {
            preloadedVideoKey = '';
            console.debug('[LinguaFlow] Falha ao antecipar trilha completa:', error);
        }
    };

    const maybeFetchFullTrackFromSegment = (urlStr) => {
        try {
            if (!urlStr.includes('timedtext') && !urlStr.includes('api/timedtext')) return;
            const u = new URL(urlStr, window.location.href);
            const isSegment = ['t', 'range', 'spv'].some((param) => u.searchParams.has(param));
            if (!isSegment) return;
            const videoId = u.searchParams.get('v') || getCurrentVideoId();
            if (!videoId) return;

            u.searchParams.delete('t');
            u.searchParams.delete('range');
            u.searchParams.delete('spv');
            u.searchParams.delete('tlang');
            const cleanUrl = u.toString();
            const dedupeKey = `${videoId}:${cleanUrl}`;
            if (interceptedFullTrackKey === dedupeKey) return;
            interceptedFullTrackKey = dedupeKey;

            originalFetch(cleanUrl, { credentials: 'same-origin' })
                .then(async (res) => {
                    if (!res.ok) return;
                    const text = await res.text();
                    if (text && text.length > 10) {
                        notifyExt(cleanUrl, text);
                    }
                })
                .catch(() => {});
        } catch {}
    };

    // ── INTERCEPTAÇÃO DE REDE (Fetch & XHR) ───────────────────────────────────
    
    // Hook Fetch (Padrão moderno)
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
                if (urlStr.includes('timedtext') || urlStr.includes('api/timedtext')) {
                    maybeFetchFullTrackFromSegment(urlStr);
                }
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
            if (urlStr.includes('timedtext') || urlStr.includes('api/timedtext')) {
                maybeFetchFullTrackFromSegment(urlStr);
            }
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
        if (e.data.type === 'LF_PRELOAD_SUBTITLES') {
            preloadFullSubtitleTrack();
        } else if (e.data.type === 'LF_SET_SOURCE_LANG' && typeof e.data.sourceLang === 'string') {
            if (currentSourceLang !== e.data.sourceLang) {
                preloadedVideoKey = '';
                interceptedFullTrackKey = '';
            }
            currentSourceLang = e.data.sourceLang;
            ensureOriginalTrack();
            preloadFullSubtitleTrack();
        }
    });

    window.addEventListener('yt-navigate-finish', () => {
        preloadedVideoKey = '';
        interceptedFullTrackKey = '';
        setTimeout(() => preloadFullSubtitleTrack(), 250);
    });

    // ── INTERCEPTAÇÃO DO PLAYER (YouTube API) ────────────────────────────────
    
    // Tenta capturar o player do YouTube para monitorar estados (Pause/Play/Seek)
    let lastPlayerState = -1;
    const monitorPlayer = () => {
        const moviePlayer = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
        if (moviePlayer && moviePlayer.addEventListener) {
            ensureOriginalTrack();
            preloadFullSubtitleTrack();
            // Se o YouTube trocar de legenda via API interna, pegamos aqui
            moviePlayer.addEventListener('onStateChange', (state) => {
                if (state !== lastPlayerState) {
                    postBridgeMessage({ type: 'LF_PLAYER_STATE', state });
                    lastPlayerState = state;
                }
                if (state === 1 || state === -1) {
                    ensureOriginalTrack();
                    preloadFullSubtitleTrack();
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
