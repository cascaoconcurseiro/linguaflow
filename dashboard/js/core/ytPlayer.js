// Player único de trechos: o vídeo só toca após gesto explícito e, quando há
// fim conhecido, volta ao começo ao terminar para servir como replay da frase.
let apiReadyPromise;
let player;
let playerReadyPromise;
let wrapperEl;
let requestId = 0;
let activeClip = null;
let endTimer = null;
let loopEnabled = true;

function stopEndTimer() {
  if (endTimer) window.clearInterval(endTimer);
  endTimer = null;
}

function ensureApi() {
  if (apiReadyPromise) return apiReadyPromise;
  apiReadyPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const timeout = window.setTimeout(() => reject(new Error('yt_api_timeout')), 12000);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous();
      window.clearTimeout(timeout);
      resolve(window.YT);
    };
    if (!document.getElementById('yt-iframe-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = () => { window.clearTimeout(timeout); reject(new Error('yt_api_load_failed')); };
      document.head.appendChild(tag);
    }
  });
  return apiReadyPromise;
}

function enforceClipEnd() {
  stopEndTimer();
  if (!activeClip?.end || !player) return;
  endTimer = window.setInterval(() => {
    if (!activeClip || !player) return stopEndTimer();
    if (player.getCurrentTime?.() >= activeClip.end - 0.08) {
      stopEndTimer();
      if (loopEnabled) {
        // loadVideoById é intencional: a documentação do YouTube informa que
        // seekTo cancela o endSeconds. Recarregar o pequeno trecho preserva
        // os dois limites em cada repetição.
        player.loadVideoById?.({
          videoId: activeClip.videoId,
          startSeconds: activeClip.start,
          endSeconds: activeClip.end,
        });
      } else {
        player.pauseVideo?.();
        player.cueVideoById?.({
          videoId: activeClip.videoId,
          startSeconds: activeClip.start,
          endSeconds: activeClip.end,
        });
      }
    }
  }, 100);
}

async function ensurePlayer(targetEl, expectedRequest) {
  const yt = await ensureApi();
  if (expectedRequest !== requestId) return null;
  if (!wrapperEl) {
    wrapperEl = document.createElement('div');
    wrapperEl.id = 'lf-yt-player-wrapper';
    wrapperEl.style.cssText = 'width:100%;height:100%';
  }
  if (wrapperEl.parentElement !== targetEl) targetEl.appendChild(wrapperEl);
  if (!player) {
    const placeholder = document.createElement('div');
    wrapperEl.appendChild(placeholder);
    playerReadyPromise = new Promise((resolve, reject) => {
      player = new yt.Player(placeholder, {
        height: '100%', width: '100%',
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => resolve(player),
          onError: () => reject(new Error('yt_player_error')),
          onStateChange: ({ data }) => {
            if (data === window.YT?.PlayerState?.PLAYING) enforceClipEnd();
            else if (data === window.YT?.PlayerState?.PAUSED) stopEndTimer();
            else if (data === window.YT?.PlayerState?.ENDED) {
              stopEndTimer();
              if (loopEnabled && activeClip) replayClip();
            }
          },
        },
      });
    });
  }
  const ready = await playerReadyPromise;
  return expectedRequest === requestId ? ready : null;
}

// Prepara o trecho sem autoplay. Retorna false se o pedido ficou obsoleto.
export async function loadVideo(targetEl, videoId, { start = 0, end = null } = {}) {
  if (!targetEl || !videoId) return false;
  const id = ++requestId;
  stopEndTimer();
  try {
    const ready = await ensurePlayer(targetEl, id);
    if (!ready || id !== requestId) return false;
    activeClip = { videoId, start: Math.max(0, Number(start) || 0), end: Number(end) > Number(start) ? Number(end) : null };
    ready.cueVideoById({ videoId, startSeconds: activeClip.start, endSeconds: activeClip.end || undefined });
    if (wrapperEl) wrapperEl.style.display = '';
    return true;
  } catch (error) {
    if (id === requestId) console.warn('[ytPlayer] Vídeo indisponível:', error);
    return false;
  }
}

// Deve ser chamado somente por click/tecla do usuário (política mobile).
export function replayClip() {
  if (!player || !activeClip) return false;
  stopEndTimer();
  player.loadVideoById({ videoId: activeClip.videoId, startSeconds: activeClip.start, endSeconds: activeClip.end || undefined });
  return true;
}

export function playClip() {
  if (!player || !activeClip) return false;
  const current = Number(player.getCurrentTime?.()) || 0;
  if (current < activeClip.start - 0.15 || (activeClip.end && current >= activeClip.end - 0.08)) {
    return replayClip();
  }
  player.playVideo?.();
  return true;
}

export function setClipLoop(enabled) {
  loopEnabled = enabled !== false;
  return loopEnabled;
}

export function isClipPlaying() {
  return player?.getPlayerState?.() === window.YT?.PlayerState?.PLAYING;
}

export function pausePlayer() {
  stopEndTimer();
  try { player?.pauseVideo?.(); } catch { /* player ainda não ficou pronto */ }
}

export function hidePlayer() {
  ++requestId; // invalida promises pendentes de um card anterior
  activeClip = null;
  pausePlayer();
  if (wrapperEl) wrapperEl.style.display = 'none';
}
