// content/immersion-mode.js
import { db } from '../utils/db.js';

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

/**
 * LinguaFlow - Modo Imersão em Web (Etapa 11)
 * Substitui palavras conhecidas do DB em sites aleatórios pelo idioma alvo.
 */

export class ImmersionMode {
    constructor() {
        this.intensity = 30; // 30% default (regras do prompt)
        this.knownWordsMap = new Map();
    }

    async activate(targetLang, intensity) {
        this.intensity = intensity;
        
        // Extrai palavras reais conhecidas do banco de dados do usuário
        try {
            const words = await new Promise(resolve => {
                chrome.runtime.sendMessage({ action: 'lf_get_all_known_words' }, resolve);
            });
            if (words && words.length > 0) {
                words.forEach(w => {
                    // Mapeia { word: "palavra", lang: "pt-br" } para word -> alvo (inglês)
                    // Como não armazenamos a tradução na tabela known_words, 
                    // precisaremos garantir que o background nos envie a tradução também
                    // Mas assumindo que 'w.word' é o que queremos substituir
                    if (w.word && w.translation) {
                        this.knownWordsMap.set(w.word.toLowerCase(), w.translation.toLowerCase());
                    }
                });

                // Compila Motor O(1) Unificado
                const keys = Array.from(this.knownWordsMap.keys())
                    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) // escape regex chars
                    .sort((a,b) => b.length - a.length); // Maiores primeiro para evitar overlap parcial
                
                if (keys.length > 0) {
                    this.unifiedRegex = new RegExp(`\\b(${keys.join('|')})\\b`, 'gi');
                }
            }
        } catch (e) {
            console.error('Erro ao carregar palavras reais:', e);
        }
        
        console.debug(`LinguaFlow: Modo Imersão Ativado [Intensidade: ${intensity}%]`);
        if (this.unifiedRegex) this.processTextNodes(document.body);
    }

    processTextNodes(node) {
        // Bloqueadores de quebra de layout web
        const ignoreTags = ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT', 'CODE', 'PRE'];
        if (ignoreTags.includes(node.nodeName)) return;

        if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent.trim().length > 0) this.replaceWords(node);
        } else {
            Array.from(node.childNodes).forEach(child => this.processTextNodes(child));
        }
    }

    replaceWords(textNode) {
        if (!this.unifiedRegex) return;

        let originalText = textNode.textContent;
        this.unifiedRegex.lastIndex = 0; // Reset
        if (!this.unifiedRegex.test(originalText)) return;

        let text = escapeHTML(originalText);
        let replaced = false;
        
        this.unifiedRegex.lastIndex = 0; // Reset before replace
        text = text.replace(this.unifiedRegex, (match) => {
            if ((Math.random() * 100) > this.intensity) return match; // skip by probability
            const targetWord = this.knownWordsMap.get(match.toLowerCase());
            if (!targetWord) return match;
            
            replaced = true;
            return `<span class="lf-immersed" data-original="${escapeHTML(match)}" title="Aviso Imersivo: Original era '${escapeHTML(match)}'" style="color: #0EA5E9; font-weight: 600; border-bottom: 2px dashed #38BDF8; cursor: help; padding: 0 2px;">${escapeHTML(targetWord)}</span>`;
        });

        if (replaced) {
            const span = document.createElement('span');
            span.innerHTML = text;
            if (textNode.parentNode) textNode.parentNode.replaceChild(span, textNode);
        }
    }
}
