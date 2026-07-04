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

// Ativação manual: injetada sob demanda via activeTab (clique no ícone da extensão)
// em sites fora da lista fixa abaixo — ver background/service-worker.js.
const isSupported = supportedSites.some(site => hostname.includes(site)) || window.__LF_FORCE_GENERIC__ === true;

if (!isSupported) {
    console.debug('[LinguaFlow] Site não suportado, extensão não será carregada.');
} else {
    console.debug("[LinguaFlow] Inicializando Arquitetura Premium (Language Reactor Style).");

    const bootstrap = () => {
        const engine = new SubtitleEngine();
        engine.init();

        // Painel de configurações globais
        new SettingsPanel(engine);

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
