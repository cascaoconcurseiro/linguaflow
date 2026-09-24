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
    let currentSourceLang = 'en';
    let preloadedVideoKey = '';
    // A failed track is not retried on every player event or button click.
    // Navigation/source-language changes allow a fresh, single attempt.

    const getCaptionTracks = () => {
        try {
            const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
            const response = (typeof player?.getPlayerResponse === 'function' ? player.getPlayerResponse() : null)
                || window.ytInitialPlayerResponse;
            const currentId = new URLSearchParams(window.location.search).get('v');
            if (response?.videoDetails?.videoId && response.videoDetails.videoId !== currentId) return [];
            const tracks = response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            return Array.isArray(tracks) ? tracks : [];
        } catch {
            return [];
        }
    };

    const preloadFullSubtitleTrack = async (attempt = 0) => {
        const videoId = new URLSearchParams(window.location.search).get('v');
        if (!videoId) return;
        const tracks = getCaptionTracks();
        if (!tracks.length) {
            if (attempt < 4) setTimeout(() => preloadFullSubtitleTrack(attempt + 1), 400 * (attempt + 1));
            return;
        }

        const matches = tracks.filter((item) => item.baseUrl && item.languageCode?.toLowerCase().split('-')[0] === currentSourceLang.toLowerCase().split('-')[0]);
        const track = matches.find((item) => item.kind !== 'asr') || matches[0];
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
            const response = await originalFetch(url.toString());
            if (!response.ok) {
                console.warn('[LinguaFlow] caption_track_unavailable', { status: Number(response.status) || 0 });
                return;
            }
            const body = await response.text();
            if (body.length > 10) notifyExt(url.toString(), body);
        } catch (error) {
            console.warn('[LinguaFlow] caption_track_error', { code: error?.name || 'network' });
        }
    };

    // ── INTERCEPTAÇÃO DE REDE (Fetch & XHR) ───────────────────────────────────
    
    // Hook Fetch (Padrão moderno)
    window.fetch = async function(...args) {
        const url = args[0];
        const urlStr = typeof url === 'string' ? url : (url instanceof URL ? url.href : (url && typeof url.url === 'string' ? url.url : ''));

        // Padrões Universais: YouTube (timedtext), Netflix (nflxvideo), HBO/Max (vtt/ttml)
        const isSubtitle = urlStr.includes('timedtext') || 
                           urlStr.includes('api/timedtext') || 
                           urlStr.includes('nflxvideo.net') || 
                           urlStr.includes('.vtt') || 
                           urlStr.includes('.ttml') ||
                           urlStr.includes('subtitles');

        if (isSubtitle) {
            // Never duplicate a failed player request: the YouTube player owns retries.
            const response = await originalFetch.apply(this, args);
            try {
                const clone = response.clone();
                if (urlStr.includes('nflxvideo.net') || urlStr.includes('.vtt')) {
                    clone.arrayBuffer().then(buf => {
                        postBridgeMessage({ type: 'LF_SUBTITLE_HOOK', url: urlStr, data: buf, isBinary: true });
                    }).catch(() => {});
                } else {
                    clone.text().then(text => notifyExt(urlStr, text)).catch(() => {});
                }
            } catch { /* Capture must never affect playback. */ }
            return response;
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
                try {
                    if (this.responseType === 'arraybuffer' || this.response instanceof ArrayBuffer) {
                        postBridgeMessage({ type: 'LF_SUBTITLE_HOOK', url: urlStr, data: this.response, isBinary: true });
                    } else {
                        notifyExt(urlStr, this.responseText);
                    }
                } catch { /* Player responses are never modified by the extension. */ }
            });
        }
        return originalOpen.apply(this, arguments);
    };

    // ── GESTÃO DE TRILHA ORIGINAL (YouTube Player API) ──────────────────────

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
        if (e.data.type === 'LF_GET_AUDIO_LANGUAGE') {
            // Prefer the selected audio. Original ASR is a qualified fallback;
            // manual and translated subtitles do not establish spoken language.
            const player = document.getElementById('movie_player');
            let language = null;
            let evidence = null;
            try {
                const track = player?.getAudioTrack?.();
                const candidate = String(track?.languageCode || track?.language || track?.id?.split('.')[0] || '').toLowerCase();
                if (/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(candidate)) {
                    language = candidate;
                    evidence = 'audio_track';
                } else {
                    const response = player?.getPlayerResponse?.();
                    const videoId = new URLSearchParams(window.location.search).get('v');
                    const playerId = response?.videoDetails?.videoId;
                    const available = player?.getAvailableAudioTracks?.();
                    const formatTracks = response?.streamingData?.adaptiveFormats
                        ?.map(format => format.audioTrack?.id).filter(Boolean) || [];
                    const hasAlternativeAudio = (Array.isArray(available) && available.length > 1)
                        || new Set(formatTracks).size > 1;
                    if (playerId === videoId && !hasAlternativeAudio) {
                        const tracks = response?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
                        const languages = [...new Set(tracks.filter(item => {
                            if (item.kind !== 'asr' || !item.baseUrl || item.translationLanguage) return false;
                            try { return !new URL(item.baseUrl, window.location.href).searchParams.has('tlang'); }
                            catch { return false; }
                        }).map(item => String(item.languageCode || '').toLowerCase())
                            .filter(code => /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(code)))];
                        if (languages.length === 1) {
                            language = languages[0];
                            evidence = 'caption_asr';
                        }
                    }
                }
            } catch { /* The platform may not expose the selected track. */ }
            postBridgeMessage({ type:'LF_AUDIO_LANGUAGE', language, evidence });
        } else if (e.data.type === 'LF_PRELOAD_SUBTITLES') {
            preloadFullSubtitleTrack();
        } else if (e.data.type === 'LF_SET_SOURCE_LANG' && typeof e.data.sourceLang === 'string') {
            if (currentSourceLang !== e.data.sourceLang) preloadedVideoKey = '';
            currentSourceLang = e.data.sourceLang;
            ensureOriginalTrack();
            preloadFullSubtitleTrack();
        }
    });

    window.addEventListener('yt-navigate-finish', () => {
        preloadedVideoKey = '';
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
