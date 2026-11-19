// dashboard/js/ui/study/youglish.js — Widget do YouGlish na revisão: carrega o script remoto, busca a palavra, pausa o vídeo e limpa o estado ao sair.
import { isExtensionContext as isExtension } from '../../core/env.js';

// Estado do widget: só este módulo o conhece.
let ygWidget = null;
let ygQueuedWord = null;
let youglishLoadTimer = null;

// Nova sessão: o container será recriado, então o widget antigo não serve mais.
export function resetYouglishWidget() {
  ygWidget = null;
}

// Fim da sessão: solta o widget e a palavra que esperava o script carregar.
export function resetYouglish() {
  delete window.onYouglishAPIReady;
  ygQueuedWord = null;
  ygWidget = null;
}

function isMobileVoiceDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
}

export function updateYouglish(word) {
  const box = document.getElementById('youglish-box');
  const fallback = document.getElementById('youglish-fallback');
  const loadBtn = document.getElementById('yg-load-btn');
  if (!box) return;
  box.classList.remove('hidden');
  fallback.href = `https://youglish.com/pronounce/${encodeURIComponent(word)}/english`;
  fallback.textContent = `Abrir no YouGlish: “${word}”`;
  // Em iOS/Android o widget de terceiros pode ser bloqueado sem disparar erro.
  // O link oficial permanece sempre disponível; o embed continua sendo tentado.
  if (isMobileVoiceDevice()) fallback.classList.remove('hidden');

  // Extensão (MV3): scripts remotos são proibidos pelo CSP → só o link.
  if (isExtension) {
    if (loadBtn) loadBtn.classList.add('hidden');
    fallback.classList.remove('hidden');
    return;
  }

  // Widget escondido até o clique; botão volta a aparecer a cada card novo
  document.getElementById('yg-widget-embed')?.classList.add('hidden');
  if (loadBtn) {
    loadBtn.classList.remove('hidden');
    loadBtn.textContent = `▶ Ver nativos falando "${word}"`;
    loadBtn.onclick = () => {
      loadBtn.classList.add('hidden');
      document.getElementById('yg-widget-embed')?.classList.remove('hidden');
      loadYouglishAnd(word);
    };
  }
}

function loadYouglishAnd(word) {
  if (window.YG && window.YG.Widget) {
    ygFetch(word);
    return;
  }
  ygQueuedWord = word;
  if (document.getElementById('yg-script')) return;

  window.onYouglishAPIReady = () => {
    if (ygQueuedWord) ygFetch(ygQueuedWord);
  };
  const s = document.createElement('script');
  s.id = 'yg-script';
  s.async = true;
  s.src = 'https://youglish.com/public/emb/widget.js';
  s.charset = 'utf-8';
  s.onerror = () => document.getElementById('youglish-fallback')?.classList.remove('hidden');
  document.head.appendChild(s);
}

// Pausa o vídeo do YouGlish (chamado ao trocar de card, fechar painel ou sair da sessão)
export function pauseYouglish() {
  if (youglishLoadTimer) { clearTimeout(youglishLoadTimer); youglishLoadTimer = null; }
  try { ygWidget?.pause?.(); } catch { /* widget pode não estar pronto */ }
  try {
    const iframes = document.querySelectorAll('#yg-widget-embed iframe, #study-yt-mount iframe');
    iframes.forEach(iframe => {
      iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }), '*');
    });
  } catch { /* postMessage protegido */ }
  try {
    document.querySelectorAll('#yg-widget-embed video, #study-yt-mount video, #saved-video-context video').forEach(v => v.pause());
  } catch { /* video nativo protegido */ }
}

function ygFetch(word) {
  try {
    if (!ygWidget || !document.getElementById('yg-widget-embed')?.hasChildNodes()) {
      const box = document.getElementById('yg-widget-embed');
      ygWidget = new window.YG.Widget('yg-widget-embed', {
        width: Math.min(box?.clientWidth || 316, 360),
        components: 88, // legenda + controle de velocidade + navegação
        events: {
          onFetchDone: () => {
            if (youglishLoadTimer) clearTimeout(youglishLoadTimer);
            youglishLoadTimer = null;
          },
          onError: () => {
            if (youglishLoadTimer) clearTimeout(youglishLoadTimer);
            youglishLoadTimer = null;
            document.getElementById('youglish-fallback')?.classList.remove('hidden');
          },
        },
      });
    }
    ygWidget.fetch(word, 'english');
    if (youglishLoadTimer) clearTimeout(youglishLoadTimer);
    youglishLoadTimer = setTimeout(() => {
      document.getElementById('youglish-fallback')?.classList.remove('hidden');
      youglishLoadTimer = null;
    }, 7000);
  } catch (e) {
    console.warn('[Study] YouGlish widget falhou:', e);
    document.getElementById('youglish-fallback')?.classList.remove('hidden');
  }
}
