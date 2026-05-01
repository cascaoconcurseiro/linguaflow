import { SubtitleEngine } from './subtitle-engine.js';
import { VideoControls } from './video-controls.js';
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
        
        // Panel de configurações globais
        const settingsPanel = new SettingsPanel(engine);
        
        // Roteamento inteligente de domínios
        if (engine.platform !== 'generic') {
            new VideoControls(engine);
        } else {
            // Sites genéricos de leitura (Wikipedia, Notícias): Módulo 11 (Imersão)
            const immersion = new ImmersionMode();
            immersion.activate('en', 30);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
}
