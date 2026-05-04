import { SubtitleEngine } from './subtitle-engine.js';
import { ImmersionMode } from './immersion-mode.js';
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
    console.log('[LinguaFlow] Site não suportado, extensão não será carregada.');
} else {
    console.log("[LinguaFlow] Inicializando Arquitetura Premium (Language Reactor Style).");

    const bootstrap = () => {
        const engine = new SubtitleEngine();
        engine.init();
        
        // Painel de configurações globais
        new SettingsPanel(engine);
        
        // Roteamento inteligente de domínios
        if (engine.platform === 'generic') {
            // Sites genéricos de leitura (Wikipedia, Notícias)
            const immersion = new ImmersionMode();
            immersion.activate('en', 30);
        }
    };

    if (window.__LF_INITIALIZED__) {
        console.log('[LinguaFlow] Engine já inicializada nesta aba.');
    } else {
        window.__LF_INITIALIZED__ = true;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bootstrap);
        } else {
            bootstrap();
        }
    }
}
