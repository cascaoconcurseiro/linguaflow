import { SettingsPanel } from './settings-panel.js';
import { SubtitleEngine } from './subtitle-engine.js';

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

// Ativação manual: injetada sob demanda via activeTab (clique em "Ativar Nesta Página" no
// popup) em sites fora da lista fixa abaixo — ver popup/popup.js.
const isSupported = supportedSites.some((site) => hostname.includes(site)) || window.__LF_FORCE_GENERIC__ === true;

if (!isSupported) {
  console.debug('[LinguaFlow] Site não suportado, extensão não será carregada.');
} else {
  console.debug('[LinguaFlow] Inicializando Arquitetura Premium (Language Reactor Style).');

  const bootstrap = async () => {
    const engine = new SubtitleEngine();
    engine.init();

    // Painel de configurações globais
    new SettingsPanel(engine);

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

      // Botão flutuante de review
      const reviewBtn = document.createElement('button');
      reviewBtn.id = 'lf-review-float-btn';
      reviewBtn.textContent = '🃏';
      reviewBtn.title = 'Revisão Rápida (R)';
      Object.assign(reviewBtn.style, {
        position: 'fixed',
        bottom: '140px',
        right: '20px',
        zIndex: '2147483644',
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        border: '2px solid rgba(56,189,248,0.4)',
        background: 'rgba(15,23,42,0.9)',
        color: '#38bdf8',
        fontSize: '20px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        transition: 'transform 0.2s',
      });
      reviewBtn.addEventListener('mouseenter', () => (reviewBtn.style.transform = 'scale(1.1)'));
      reviewBtn.addEventListener('mouseleave', () => (reviewBtn.style.transform = 'scale(1)'));
      reviewBtn.addEventListener('click', () => reviewOverlay.toggle());
      document.body.appendChild(reviewBtn);
    } catch (e) {
      console.debug('[LinguaFlow] Review overlay não carregado:', e.message);
    }

    if (engine.platform === 'generic') {
      console.debug('[LinguaFlow] Modo genérico ativado neste site (legendas via <track> nativo, se disponível).');
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
