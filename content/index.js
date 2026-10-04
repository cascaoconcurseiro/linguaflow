// content/index.js — Entrada dos scripts de vídeo: só roda em sites suportados e monta o motor de legendas, o dock, o painel de configurações e a revisão rápida.
import { SettingsPanel } from './settings-panel.js';
import { SubtitleEngine } from './subtitle-engine.js';
import { isEditableTarget } from '../utils/dom-events.js';

// Verifica se está em um site suportado
const hostname = window.location.hostname;
const supportedSites = [
  'youtube.com',
  'netflix.com',
  'hbomax.com',
  'max.com',
  'hbo.com',
  'disneyplus.com',
  'primevideo.com',
  'amazon.com',
];

const isSupported = supportedSites.some((site) => hostname.includes(site));

if (!isSupported) {
  console.debug('[LinguaFlow] Site não suportado, extensão não será carregada.');
} else {
  console.debug('[LinguaFlow] Inicializando Arquitetura Premium (Language Reactor Style).');

  const bootstrap = async () => {
    const engine = new SubtitleEngine();
    engine.init();
    const lifecycle = new AbortController();
    let maxPlayerUI = null;
    let reviewOverlay = null;

    // Max/HBO, Netflix, Disney+ e Prime recebem o dock lateral. No YouTube, os controles
    // vivem fixos na barra inferior horizontal.
    if (['max', 'netflix', 'disney', 'prime'].includes(engine.platform)) {
      const { MaxPlayerUI } = await import(chrome.runtime.getURL('content/max-player-ui.js'));
      maxPlayerUI = new MaxPlayerUI(engine);
      maxPlayerUI.init();
      window.__lfMaxPlayerUI = maxPlayerUI;
    }

    // Painel de configurações globais
    const settingsPanel = new SettingsPanel(engine);
    window.__lfSettingsPanel = settingsPanel;

    // Review Overlay — revisão rápida durante vídeos (tecla R)
    try {
      const { ReviewOverlay } = await import(chrome.runtime.getURL('content/review-overlay.js'));
      reviewOverlay = new ReviewOverlay();
      await reviewOverlay.init();

      window.addEventListener('LF_TOGGLE_REVIEW', () => {
        reviewOverlay.toggle();
      }, { signal: lifecycle.signal });

      // Tecla R = toggle review (fallback com proteção isEditableTarget)
      document.addEventListener('keydown', (e) => {
        if (e.key === 'r' || e.key === 'R') {
          if (isEditableTarget(e)) return;
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          e.preventDefault?.();
          e.stopPropagation?.();
          reviewOverlay.toggle();
        }
      }, { signal: lifecycle.signal });
    } catch (e) {
      console.debug('[LinguaFlow] Review overlay não carregado:', e.message);
    }

    // Saída de verdade da página: remove listeners e painéis. Com event.persisted a
    // página pode voltar do cache de voltar/avançar e precisa continuar viva (#466).
    window.addEventListener('pagehide', (event) => {
      if (event.persisted) return;
      lifecycle.abort();
      settingsPanel.destroy();
      reviewOverlay?.destroy?.();
      maxPlayerUI?.destroy?.();
    });

    // Roteamento inteligente de domínios
    if (engine.platform === 'generic') {
      console.debug('[LinguaFlow] Web Reader Mode disabled.');
    }
  };

  if (window.__LF_INITIALIZED__) {
    console.debug('[LinguaFlow] Engine já inicializada nesta aba.');
  } else {
    window.__LF_INITIALIZED__ = true;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
      bootstrap();
    }
  }
}
