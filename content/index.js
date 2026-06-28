import { SubtitleEngine } from './subtitle-engine.js';
import { SettingsPanel } from './settings-panel.js';

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
    'amazon.com'
];

const isSupported = supportedSites.some(site => hostname.includes(site));

if (!isSupported) {
    console.debug('[LinguaFlow] Site não suportado, extensão não será carregada.');
} else {
    console.debug("[LinguaFlow] Inicializando Arquitetura Premium (Language Reactor Style).");

    const bootstrap = () => {
        const engine = new SubtitleEngine();
        engine.init();
        
        // Painel de configurações globais
        new SettingsPanel(engine);
        
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
