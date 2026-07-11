// ytPlayer.js — Player YouTube ÚNICO e reutilizável (Onda 2.5).
//
// Antes: cada card de estudo criava um <iframe src=...> novo do zero (era
// literalmente destruído e recriado toda vez que o aluno trocava de card,
// ou toda vez que clicava "Ver aqui"). Agora existe UMA instância da API
// oficial do YouTube (YT.Player), criada uma única vez; trocar de vídeo
// entre cards é só uma chamada de método (cueVideoById), não recriação de
// DOM/iframe. TTS (Google Neural) continua sendo o único áudio canônico das
// palavras — o vídeo aqui é puramente contexto visual opcional, nunca
// bloqueia o estudo, e falha graciosamente se o vídeo não existir/carregar.
//
// Detalhe importante da API do YouTube: `new YT.Player(el, ...)` SUBSTITUI
// o elemento `el` por um <iframe> (não injeta dentro dele). Por isso o nó
// que passamos pra API é descartável — o que reaproveitamos de verdade é um
// WRAPPER estável em volta dele, que nunca é tocado pela API e por isso
// pode ser reanexado (reparent) em telas diferentes sem perder o player.

let apiReadyPromise = null;
let player = null;
let playerReadyPromise = null;
let wrapperEl = null;

function ensureApi() {
  if (apiReadyPromise) return apiReadyPromise;
  apiReadyPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) { resolve(window.YT); return; }
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevCallback === 'function') prevCallback();
      resolve(window.YT);
    };
    if (!document.getElementById('yt-iframe-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  });
  return apiReadyPromise;
}

async function ensurePlayer(targetEl) {
  await ensureApi();
  if (!wrapperEl) {
    wrapperEl = document.createElement('div');
    wrapperEl.id = 'lf-yt-player-wrapper';
    wrapperEl.style.width = '100%';
    wrapperEl.style.height = '100%';
  }
  // Reparent do WRAPPER: só acontece quando a tela de estudo é (re)construída
  // — não a cada card. O wrapper nunca é substituído pela API do YouTube
  // (só o placeholder interno é), então mover ele preserva o player.
  if (wrapperEl.parentElement !== targetEl) {
    targetEl.appendChild(wrapperEl);
  }
  if (!player) {
    const placeholder = document.createElement('div');
    wrapperEl.appendChild(placeholder);
    playerReadyPromise = new Promise((resolve, reject) => {
      player = new window.YT.Player(placeholder, {
        height: '100%',
        width: '100%',
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => resolve(player),
          onError: () => reject(new Error('yt_player_error')),
        },
      });
    });
  }
  return playerReadyPromise;
}

// Carrega (ou troca) o vídeo do player global no ponto salvo. Não autoplay
// por padrão — o vídeo é contexto sob demanda, não compete com o TTS.
export async function loadVideo(targetEl, videoId, { start = 0 } = {}) {
  if (!targetEl || !videoId) return false;
  try {
    const p = await ensurePlayer(targetEl);
    p.cueVideoById({ videoId, startSeconds: Math.max(0, start || 0) });
    if (wrapperEl) wrapperEl.style.display = '';
    return true;
  } catch (e) {
    console.warn('[ytPlayer] Vídeo indisponível — degradando graciosamente:', e);
    return false;
  }
}

export function pausePlayer() {
  try { player?.pauseVideo?.(); } catch { /* player pode não estar pronto ainda */ }
}

export function hidePlayer() {
  pausePlayer();
  if (wrapperEl) wrapperEl.style.display = 'none';
}
