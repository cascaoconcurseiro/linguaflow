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
        
        // Em um ambiente de produção extrairíamos isso via:
        // const words = await chrome.runtime.sendMessage({ action: 'getAllWords' });
        // this.knownWordsMap = buildMap(words);
        
        // Mock representativo para testes de fluxo
        this.knownWordsMap.set('pessoas', 'people');
        this.knownWordsMap.set('empresa', 'company');
        this.knownWordsMap.set('dinheiro', 'money');
        this.knownWordsMap.set('mundo', 'world');
        this.knownWordsMap.set('tecnologia', 'technology');
        
        console.log(`LinguaFlow: Modo Imersão Ativado [Intensidade: ${intensity}%]`);
        this.processTextNodes(document.body);
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
        let text = textNode.textContent;
        let replaced = false;

        this.knownWordsMap.forEach((targetWord, nativeWord) => {
            const regex = new RegExp(`\\b${nativeWord}\\b`, 'gi');
            if (regex.test(text) && (Math.random() * 100) <= this.intensity) {
                // Preserva cap case original se desejar, mas vamos usar lowercase por simplicidade
                text = escapeHTML(text).replace(regex, `<span class="lf-immersed" data-original="${escapeHTML(nativeWord)}" title="Aviso Imersivo: Original era '${escapeHTML(nativeWord)}'" style="color: #0EA5E9; font-weight: 600; border-bottom: 2px dashed #38BDF8; cursor: help; padding: 0 2px;">${escapeHTML(targetWord)}</span>`);
                replaced = true;
            }
        });

        if (replaced) {
            const span = document.createElement('span');
            span.innerHTML = text;
            if (textNode.parentNode) textNode.parentNode.replaceChild(span, textNode);
        }
    }
}
