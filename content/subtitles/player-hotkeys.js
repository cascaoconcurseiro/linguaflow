// content/subtitles/player-hotkeys.js — Gerenciamento isolado dos atalhos de teclado do player
// Extraído de content/subtitle-engine.js (Centro de Comando A, S, D, Q, L, O, C, Espaço)

/**
 * Registra os listeners de teclado globais do player com suporte a ciclo de vida via AbortSignal.
 * @param {import('../subtitle-engine.js').SubtitleEngine} engine
 * @param {AbortSignal} [signal]
 * @returns {() => void} Função de cleanup
 */
export function setupPlayerHotkeys(engine, signal) {
  const handler = (e) => {
    // Não dispara se o usuário estiver digitando em um input
    if (
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) ||
      document.activeElement?.isContentEditable
    ) {
      return;
    }

    const vid = engine.videoElement || document.querySelector('video');
    if (!vid) return;

    const code = e.code;

    switch (code) {
      case 'KeyA': // Anterior
        e.preventDefault();
        engine.prevSubtitle();
        engine._showNotification('⏮️ Frase Anterior');
        break;
      case 'KeyS': // Repetir atual (Shadowing)
        e.preventDefault();
        engine.repeatSubtitle();
        engine._showNotification('🔄 Repetindo (Shadowing)');
        break;
      case 'KeyD': // Próxima
        e.preventDefault();
        engine.nextSubtitle();
        engine._showNotification('⏭️ Próxima Frase');
        break;
      case 'KeyQ': // Toggle Pausa Automática
        e.preventDefault();
        engine.autoPause = !engine.autoPause;
        engine._showAutoPauseIndicator();
        break;
      case 'KeyL': // Painel de Legendas
        e.preventDefault();
        engine.toggleSubtitlePanel();
        break;
      case 'KeyO': // Configurações
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('LF_TOGGLE_SETTINGS'));
        break;
      case 'KeyC': { // Toggle Legendas
        e.preventDefault();
        // No YouTube o switch injetado é o dono do estado (localStorage,
        // title e visual). Clicá-lo mantém tecla e botão sincronizados.
        const ytSwitch = document.getElementById('lf-yt-toggle-wrapper');
        if (ytSwitch) ytSwitch.click();
        else engine.toggleSubtitles();
        const isVisible = localStorage.getItem('lf_sub_visible') === 'true';
        engine._showNotification(isVisible ? '👁️ Legendas Ativadas' : '🙈 Legendas Ocultas');
        break;
      }
      case 'Space': // Play/Pause
        e.preventDefault();
        if (vid.paused) {
          vid.play();
          engine._showNotification('▶️ Play');
        } else {
          vid.pause();
          engine._showNotification('⏸️ Pause');
        }
        break;
    }
  };

  const options = signal ? { signal } : {};
  document.addEventListener('keydown', handler, options);
  console.debug('[LinguaFlow] ⌨️ Centro de Comando unificado (A, S, D, Q, L, O, C, Espaço).');
  return () => document.removeEventListener('keydown', handler);
}
