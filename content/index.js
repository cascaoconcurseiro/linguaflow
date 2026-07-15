import { SettingsPanel } from './settings-panel.js';
import { SubtitleEngine } from './subtitle-engine.js';
import { VideoSessionTracker } from './video-session-tracker.js';

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

    // Independente do motor de legendas: só contabiliza reprodução visível e contínua.
    new VideoSessionTracker().start();

    // Painel de configurações globais
    const settingsPanel = new SettingsPanel(engine);
    window.__lfSettingsPanel = settingsPanel;

    // Review Overlay — revisão rápida durante vídeos (tecla R)
    try {
      const { ReviewOverlay } = await import(chrome.runtime.getURL('content/review-overlay.js'));
      const reviewOverlay = new ReviewOverlay();
      await reviewOverlay.init();

      // Tecla R = toggle review
      document.addEventListener('keydown', (e) => {
        if (e.key === 'r' || e.key === 'R') {
          if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          reviewOverlay.toggle();
        }
      });
    } catch (e) {
      console.debug('[LinguaFlow] Review overlay não carregado:', e.message);
    }

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
