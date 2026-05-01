// utils/lang-detect.js

/**
 * LinguaFlow - Language Detection (Módulo 3)
 * Resolve a dependência de deteção de idioma localmente.
 * Como o Manifest V3 proíbe a injeção de CDNs externos (franc-min) por questões de Content Security Policy (CSP),
 * utilizamos a API robusta do Chrome chrome.i18n.detectLanguage como método primário 100% gratuito,
 * mantendo o fallback para franc-min caso o usuário injete a build compilada no popup.
 */

export class LangDetect {
    constructor() {
        // Tabela de conversão ISO 639-3 (franc) para BCP-47
        this.isoMap = {
            'eng': 'en', 'spa': 'es', 'por': 'pt',
            'fra': 'fr', 'deu': 'de', 'ita': 'it',
            'rus': 'ru', 'jpn': 'ja', 'kor': 'ko',
            'zho': 'zh'
        };
    }

    async detect(text) {
        if (!text || text.trim() === '') return 'en'; // default seguro

        // Prioridade 1: API Nativa do Chrome (Zero custo de CPU/Rede/Bundle)
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.detectLanguage) {
                chrome.i18n.detectLanguage(text, (result) => {
                    if (result && result.languages && result.languages.length > 0) {
                        resolve(result.languages[0].language); // Retorna BCP-47 (ex: 'en', 'pt')
                    } else {
                        resolve(this._fallbackDetect(text));
                    }
                });
            } else {
                resolve(this._fallbackDetect(text));
            }
        });
    }

    _fallbackDetect(text) {
        // Prioridade 2: Se a biblioteca franc-min foi anexada globalmente
        if (typeof window.franc === 'function') {
            const iso3 = window.franc(text);
            return this.isoMap[iso3] || 'en';
        }
        
        // Fallback heurisitico de segurança
        return 'en';
    }
}

export const langDetect = new LangDetect();
