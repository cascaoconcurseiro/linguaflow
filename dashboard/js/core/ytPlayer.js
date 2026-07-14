// Player único de trechos. A fronteira start/end é controlada por uma única
// máquina de estados local; o iframe não é recarregado a cada repetição.
let apiReadyPromise;
let player;
let playerReadyPromise;
let wrapperEl;
let requestId = 0;
let activeClip = null;
let endTimer = null;
let loopEnabled = true;
let desiredPlaying = false;
let playbackCycle = 0;
let boundaryHandled = false;

function stopEndTimer() {
  if (endTimer !== null) window.clearInterval(endTimer);
  endTimer = null;
}

function ensureApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiReadyPromise) return apiReadyPromise;

  apiReadyPromise = new Promise((resolve, reject) => {
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
      tag.onerror = () => {
        window.clearTimeout(timeout);
        tag.remove?.();
        reject(new Error('yt_api_load_failed'));
      };
      document.head.appendChild(tag);
    }
  }).catch((error) => {
    // Timeout/erro de rede não condena a aba até o próximo reload.
    apiReadyPromise = null;
    throw error;
  });
  return apiReadyPromise;
}

function seekToClipStart() {
  if (!player || !activeClip) return false;
  try {
    player.seekTo?.(activeClip.start, true);
    return true;
  } catch {
    return false;
  }
}

function handleClipBoundary(expectedRequest, expectedCycle) {
  if (!activeClip || activeClip.request !== expectedRequest || playbackCycle !== expectedCycle) return;
  if (boundaryHandled) return;
  boundaryHandled = true;
  stopEndTimer();

  if (loopEnabled && desiredPlaying) {
    // seekTo preserva o mesmo iframe/frame já decodificado, evitando o flash
    // preto causado por loadVideoById em toda volta.
    playbackCycle += 1;
    seekToClipStart();
    boundaryHandled = false;
    player.playVideo?.();
    startEndMonitor();
    return;
  }

  // Sem loop, nunca deixe o YouTube escapar para o restante do vídeo.
  desiredPlaying = false;
  player.pauseVideo?.();
  seekToClipStart();
}

function startEndMonitor() {
  stopEndTimer();
  if (!desiredPlaying || !activeClip?.end || !player) return;
  const expectedRequest = activeClip.request;
  const expectedCycle = playbackCycle;
  const timerId = window.setInterval(() => {
    if (!desiredPlaying || !activeClip || activeClip.request !== expectedRequest || playbackCycle !== expectedCycle) {
      // Um callback antigo já enfileirado não pode cancelar o monitor novo.
      if (endTimer === timerId) stopEndTimer();
      return;
    }
    const current = Number(player.getCurrentTime?.());
    if (!Number.isFinite(current)) return;
    if (current < activeClip.start - 0.15) {
      seekToClipStart();
      return;
    }
    if (current >= activeClip.end - 0.06) handleClipBoundary(expectedRequest, expectedCycle);
  }, 80);
  endTimer = timerId;
}

function onPlayerStateChange({ data }) {
  if (data === window.YT?.PlayerState?.PLAYING) {
    if (desiredPlaying) startEndMonitor();
    return;
  }
  if (data === window.YT?.PlayerState?.PAUSED) {
    stopEndTimer();
    return;
  }
  if (data !== window.YT?.PlayerState?.ENDED) return;

  stopEndTimer();
  if (!desiredPlaying || !activeClip?.end) return;
  // ENDED é apenas fallback para o monitor. Eventos atrasados de um vídeo
  // anterior são ignorados porque o tempo do novo clip não está no seu fim.
  const current = Number(player?.getCurrentTime?.());
  if (Number.isFinite(current) && current >= activeClip.end - 0.15) {
    handleClipBoundary(activeClip.request, playbackCycle);
  }
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
      let readySettled = false;
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
          onReady: () => {
            readySettled = true;
            resolve(player);
          },
          onError: () => {
            if (readySettled) return;
            readySettled = true;
            player = null;
            playerReadyPromise = null;
            placeholder.remove?.();
            reject(new Error('yt_player_error'));
          },
          onStateChange: onPlayerStateChange,
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
  desiredPlaying = false;
  activeClip = null;
  stopEndTimer();
  try { player?.pauseVideo?.(); } catch { /* player ainda não ficou pronto */ }

  try {
    const ready = await ensurePlayer(targetEl, id);
    if (!ready || id !== requestId) return false;
    const clipStart = Math.max(0, Number(start) || 0);
    activeClip = {
      request: id,
      videoId,
      start: clipStart,
      end: Number(end) > clipStart ? Number(end) : null,
    };
    playbackCycle += 1;
    boundaryHandled = false;
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
  playbackCycle += 1;
  boundaryHandled = false;
  desiredPlaying = true;
  seekToClipStart();
  player.playVideo?.();
  startEndMonitor();
  return true;
}

export function playClip() {
  if (!player || !activeClip) return false;
  const current = Number(player.getCurrentTime?.());
  if (!Number.isFinite(current) || current < activeClip.start - 0.15 || (activeClip.end && current >= activeClip.end - 0.06)) {
    return replayClip();
  }
  boundaryHandled = false;
  desiredPlaying = true;
  player.playVideo?.();
  startEndMonitor();
  return true;
}

export function setClipLoop(enabled) {
  loopEnabled = enabled !== false;
  return loopEnabled;
}

export function isClipPlaying() {
  return desiredPlaying && player?.getPlayerState?.() === window.YT?.PlayerState?.PLAYING;
}

export function pausePlayer() {
  desiredPlaying = false;
  boundaryHandled = false;
  stopEndTimer();
  try { player?.pauseVideo?.(); } catch { /* player ainda não ficou pronto */ }
}

export function hidePlayer() {
  ++requestId; // invalida promises, callbacks e timers de um card anterior
  activeClip = null;
  pausePlayer();
  if (wrapperEl) wrapperEl.style.display = 'none';
}
