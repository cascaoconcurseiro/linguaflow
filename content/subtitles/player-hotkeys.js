// content/subtitles/player-hotkeys.js — Gerenciamento isolado dos atalhos de teclado do player
// Centro de Comando: A, S, D, Q, R, L, O, C, Espaço, Z, X, B, V, F, ? (lista em subtitles/shortcuts-help.js)

import { isEditableTarget } from '../../utils/dom-events.js';

// O overlay nasce escondido pela folha de estilo (style.display === ''), então só o
// estilo computado diz se ele está de fato aberto (#425).
function isElementShown(element) {
  if (!element) return false;
  try {
    if (typeof getComputedStyle === 'function') return getComputedStyle(element).display !== 'none';
  } catch {
    // Sem DOM real (testes): cai no estilo inline.
  }
  return element.style?.display !== 'none' && element.style?.display !== '';
}

/**
 * Registra os listeners de teclado globais do player com suporte a ciclo de vida via AbortSignal.
 * @param {import('../subtitle-engine.js').SubtitleEngine} engine
 * @param {AbortSignal} [signal]
 * @returns {() => void} Função de cleanup
 */
export function setupPlayerHotkeys(engine, signal) {
  const handler = (e) => {
    // 1. Não dispara se o usuário estiver digitando em um input (incluindo Shadow DOM do YouTube)
    if (isEditableTarget(e)) {
      return;
    }

    // 2. Não interfere em atalhos de sistema com teclas modificadoras (Ctrl, Alt, Meta/Cmd)
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    // 3. Se o overlay de revisão rápida estiver visível, deixa o overlay controlar as teclas
    if (isElementShown(document.getElementById?.('lf-review-overlay'))) {
      return;
    }

    // 3b. Painel de atalhos aberto: ele cuida das próprias teclas (Esc, ?, H, Tab)
    if (document.getElementById?.('lf-shortcuts-help')) {
      return;
    }

    // 4. Se o diálogo de configurações estiver aberto e focado em seus botões, não dispara
    const settingsHost = document.querySelector?.('lingua-settings');
    if (settingsHost && settingsHost.shadowRoot?.activeElement && (e.code === 'Space' || e.key === ' ')) {
      return;
    }

    const vid = engine.videoElement || document.querySelector?.('.html5-main-video') || document.querySelector?.('video');
    if (!vid) return;

    const code = e.code || '';
    const key = (e.key || '').toLowerCase();

    // LinguaFlow desligado (#418): só a tecla C age; o resto volta ao player nativo.
    if (engine.isActivated === false && code !== 'KeyC' && key !== 'c') return;

    const swallow = () => {
      e.preventDefault?.();
      e.stopPropagation?.();
      e.stopImmediatePropagation?.();
    };

    // Navegação pelas palavras da legenda (#432): com uma palavra em foco, as setas, Enter e Esc são dela.
    if (engine.isWordNavActive?.()) {
      if (code === 'ArrowRight' || key === 'arrowright') { swallow(); engine.moveWordFocus(1); return; }
      if (code === 'ArrowLeft' || key === 'arrowleft') { swallow(); engine.moveWordFocus(-1); return; }
      if (code === 'Enter' || key === 'enter') { swallow(); engine.activateFocusedWord(); return; }
      if (code === 'Escape' || key === 'escape') { swallow(); engine.leaveWordFocus(); return; }
    }

    // Sincronia da legenda: Z = mais tarde, X = mais cedo (0,1 s por toque)
    if (code === 'KeyZ' || key === 'z') { swallow(); engine.nudgeSync(-0.1); return; }
    if (code === 'KeyX' || key === 'x') { swallow(); engine.nudgeSync(0.1); return; }

    // Laço A–B (B)
    if (code === 'KeyB' || key === 'b') { swallow(); engine.toggleAbLoop(); return; }

    // Escuta primeiro (V)
    if (code === 'KeyV' || key === 'v') { swallow(); engine.toggleListenFirst(); return; }

    // Escolher palavra da legenda pelo teclado (F)
    if (code === 'KeyF' || key === 'f') { swallow(); engine.focusSubtitleWords(); return; }

    // Lista de atalhos (? ou H)
    if (key === '?' || code === 'KeyH' || key === 'h') { swallow(); engine.showShortcuts(); return; }

    // Trecho anterior (A)
    if (code === 'KeyA' || key === 'a') {
      e.preventDefault?.();
      e.stopPropagation?.();
      e.stopImmediatePropagation?.();
      engine.prevSubtitle();
      engine._showNotification('⏮️ Frase Anterior');
      return;
    }

    // Repetir trecho atual - Shadowing (S)
    if (code === 'KeyS' || key === 's') {
      e.preventDefault?.();
      e.stopPropagation?.();
      e.stopImmediatePropagation?.();
      engine.repeatSubtitle();
      engine._showNotification('🔄 Repetindo (Shadowing)');
      return;
    }

    // Próximo trecho (D)
    if (code === 'KeyD' || key === 'd') {
      e.preventDefault?.();
      e.stopPropagation?.();
      e.stopImmediatePropagation?.();
      engine.nextSubtitle();
      engine._showNotification('⏭️ Próxima Frase');
      return;
    }

    // Toggle Pausa Automática (Q)
    if (code === 'KeyQ' || key === 'q') {
      e.preventDefault?.();
      e.stopPropagation?.();
      e.stopImmediatePropagation?.();
      engine.autoPause = !engine.autoPause;
      engine._showAutoPauseIndicator();
      window.dispatchEvent?.(new CustomEvent('LF_UPDATE_AUTOPAUSE', { detail: engine.autoPause }));
      import('../../utils/db.js').then(({ db }) => {
        db?.setSetting?.('autoPause', engine.autoPause)?.catch?.(() => {});
      }).catch(() => {});
      return;
    }

    // Abrir/fechar roteiro/painel de legendas (L)
    if (code === 'KeyL' || key === 'l') {
      e.preventDefault?.();
      e.stopPropagation?.();
      e.stopImmediatePropagation?.();
      engine.toggleSubtitlePanel();
      return;
    }

    // Configurações (O)
    if (code === 'KeyO' || key === 'o') {
      e.preventDefault?.();
      e.stopPropagation?.();
      e.stopImmediatePropagation?.();
      window.dispatchEvent?.(new CustomEvent('LF_TOGGLE_SETTINGS'));
      return;
    }

    // Mostrar ou ocultar legendas (C)
    if (code === 'KeyC' || key === 'c') {
      e.preventDefault?.();
      e.stopPropagation?.();
      e.stopImmediatePropagation?.();
      engine.userToggleSubtitles();
      return;
    }

    // Revisão Rápida (R)
    if (code === 'KeyR' || key === 'r') {
      e.preventDefault?.();
      e.stopPropagation?.();
      e.stopImmediatePropagation?.();
      window.dispatchEvent?.(new CustomEvent('LF_TOGGLE_REVIEW'));
      return;
    }

    // Reproduzir ou pausar (Espaço)
    if (code === 'Space' || key === ' ') {
      e.preventDefault?.();
      e.stopPropagation?.();
      e.stopImmediatePropagation?.();
      if (vid.paused) {
        if (engine._currentCue) {
          engine._lastAutoPausedEndTime = engine._currentCue.end;
        }
        vid.play()?.catch?.(() => {});
        engine._showNotification('▶️ Play');
      } else {
        vid.pause();
        engine._showNotification('⏸️ Pause');
      }
      return;
    }
  };

  const options = signal ? { capture: true, signal } : { capture: true };
  document.addEventListener('keydown', handler, options);
  console.debug('[LinguaFlow] ⌨️ Centro de Comando unificado (A, S, D, Q, R, L, O, C, Espaço).');
  return () => document.removeEventListener('keydown', handler, true);
}
