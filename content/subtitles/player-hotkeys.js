// content/subtitles/player-hotkeys.js — Gerenciamento isolado dos atalhos de teclado do player
// Centro de Comando: A, S, D, Q, R, L, O, C, Espaço

import { isEditableTarget } from '../../utils/dom-events.js';

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
    const reviewOverlay = document.getElementById?.('lf-review-overlay');
    if (reviewOverlay && reviewOverlay.style.display !== 'none') {
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
        db?.saveSetting?.('autoPause', engine.autoPause)?.catch?.(() => {});
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
      const ytSwitch = document.getElementById?.('lf-yt-toggle-wrapper');
      if (ytSwitch) ytSwitch.click();
      else engine.toggleSubtitles();
      const isVisible = (typeof localStorage !== 'undefined' ? localStorage.getItem('lf_sub_visible') : null) === 'true';
      engine._showNotification(isVisible ? '👁️ Legendas Ativadas' : '🙈 Legendas Ocultas');
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
