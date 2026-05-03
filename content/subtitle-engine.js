// content/subtitle-engine.js
import { subtitleParsers } from '../utils/subtitle-parsers.js';


function fixUtf8(text) {
    if (!text) return text;
    try {
        const bytes = new Uint8Array([...text].map(c => c.charCodeAt(0) & 0xFF));
        const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        const hasBad = (decoded.match(/\uFFFD/g) || []).length;
        const hasCtrl = (text.match(/[\x80-\x9F]/g) || []).length;
        if (hasBad === 0 && hasCtrl > 0) return decoded;
    } catch {}
    return text;
}

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}


// ─── Engine Principal ─────────────────────────────────────────────────────────
export class SubtitleEngine {
    constructor() {
        this.platform           = this._detectPlatform();
        this.cues               = []; // Cues do YouTube (via XHR)
        this.xhrCues            = []; // Cues do HBO/Netflix (via XHR intercept)
        this.usingXhr           = false; // Flag para saber se está usando XHR
        this.currentCueIndex    = -1;
        this.shadowContainer    = null;
        this.videoElement       = null;
        this.syncInterval       = null;
        this._isTranslatingBg   = false;
        this.lastText           = ''; // Última legenda mostrada
        this._ready             = false; // Flag para o sync loop V5

        // Settings (defaults) — serão sobrescritos pelo SettingsPanel
        this.displayMode  = 'bilingual'; // bilingual | native | translated | blur
        this.targetLang   = 'pt';
        this.translationSpeed = 100; // Número de legendas traduzidas em paralelo (10-200)
        this.translationAnticipation = 0; // Antecipação desabilitada (não usamos mais)
        this.autoPause = false; // Pausa automática ao fim de cada fala
        this.currentSubtitleTimestamp = 0; // Timestamp da legenda atual (para salvar palavras)
        this.translationDelay = 0;

        this.flashDuration = 4; // segundos do flash de traducao (configuravel)

        // Vocabulário em memória — carregado do banco e atualizado em tempo real
        this.savedWords = new Map();  // word -> status ('new'|'learning'|'review'|'mature')
        this.knownWords = new Set();

        // Carrega palavras salvas do banco na inicialização
        this._loadSavedWords();

        // WordPopup (Pro V5 style)
        this.wordPopup = null;

        // Atualiza quando uma palavra é salva ou conhecida
        window.addEventListener('LF_WORD_SAVED', e => {
            const w = e.detail?.word?.toLowerCase();
            if (w) this.savedWords.set(w, 'new');
        });
        window.addEventListener('LF_WORD_KNOWN', e => {
            const w = (typeof e.detail === 'string' ? e.detail : e.detail?.word)?.toLowerCase();
            if (w) { this.knownWords.add(w); this.savedWords.delete(w); }
        });
        window.addEventListener('LF_UPDATE_DELAY', e => {
            this.translationDelay = e.detail;
            console.log(`[LinguaFlow] Delay de tradução atualizado para: ${e.detail}s`);
        });
        window.addEventListener('LF_UPDATE_ANTICIPATION', e => {
            this.translationAnticipation = e.detail;
            console.log(`[LinguaFlow] Antecipação de tradução atualizada para: ${e.detail}s`);
        });
        window.addEventListener('LF_UPDATE_AUTOPAUSE', e => {
            this.autoPause = e.detail;
            console.log(`[LinguaFlow] Pausa automática ${e.detail ? 'ATIVADA' : 'DESATIVADA'}`);
        });
        window.addEventListener('LF_UPDATE_POSITION', e => {
            const host = document.getElementById('linguaflow-subtitle-host');
            if (host) {
                host.style.bottom = `${e.detail}px`;
                this._currentBottom = e.detail;
            }
        });
        window.addEventListener('LF_UPDATE_HORIZONTAL', e => {
            const host = document.getElementById('linguaflow-subtitle-host');
            if (host) {
                host.style.left = `${e.detail}%`;
                host.style.transform = `translateX(-${e.detail}%)`;
                this._currentHorizontal = e.detail;
            }
        });

        // Inicia log de imersão
        this._startImmersionLog();

        // Sincronização global de vocabulário
        chrome.runtime.onMessage.addListener(request => {
            if (request.type === 'REFRESH_VOCAB') {
                console.log('[LinguaFlow] Sincronizando vocabulário...');
                this._loadSavedWords();
            }
        });
    }

    _startImmersionLog() {
        setInterval(async () => {
            if (this.videoElement && !this.videoElement.paused) {
                try {
                    const { db } = await import('../utils/db.js');
                    await db.logSession(10, this.platform);
                } catch (e) {}
            }
        }, 10000);
    }

    async _loadSavedWords() {
        try {
            const { db } = await import('../utils/db.js');
            const words = await db.getAllWords();
            const known = await db.getAllKnownWords();
            
            this.savedWords.clear();
            words.forEach(w => this.savedWords.set(w.word.toLowerCase(), w.status || 'new'));
            
            this.knownWords.clear();
            known.forEach(w => this.knownWords.add(w.word.toLowerCase()));
            
            console.log(`[LinguaFlow] Vocabulário carregado: ${this.savedWords.size} salvas, ${this.knownWords.size} conhecidas.`);
            
            // Recolore as legendas se elas já estiverem na tela
            this._updateSubtitleColors();
        } catch (e) {
            console.error('[LinguaFlow] Erro ao carregar vocabulário:', e);
        }
    }

    _updateSubtitleColors() {
        if (this.shadowContainer) {
            const words = this.shadowContainer.querySelectorAll('.lf-word');
            words.forEach(el => {
                const w = el.dataset.word?.toLowerCase();
                if (!w) return;
                
                el.classList.remove('lf-new', 'lf-learning', 'lf-review', 'lf-mature', 'lf-known', 'lf-saved');
                if (this.knownWords.has(w)) {
                    el.classList.add('lf-known');
                } else if (this.savedWords.has(w)) {
                    const status = this.savedWords.get(w);
                    const classMap = { 'new': 'lf-saved', 'learning': 'lf-learning', 'review': 'lf-review', 'mature': 'lf-mature' };
                    el.classList.add(classMap[status] || 'lf-saved');
                } else {
                    el.classList.add('lf-new');
                }
            });
        }
    }

    _detectPlatform() {
        const h = window.location.hostname;
        if (h.includes('youtube.com'))    return 'youtube';
        if (h.includes('netflix.com'))    return 'netflix';
        if (h.includes('hbomax.com') || h.includes('max.com') || h.includes('hbo.com')) return 'max';
        if (h.includes('disneyplus.com')) return 'disney';
        if (h.includes('primevideo.com') || h.includes('amazon.com')) return 'prime';
        return 'generic';
    }

    _findPlayerContainer() {
        // Seletores de container do player por plataforma
        const selectors = {
            'youtube': [
                '#movie_player',
                '.html5-video-player',
                '#player-container',
                '#player'
            ],
            'netflix': [
                '.watch-video',
                '.NFPlayer',
                '[data-uia="player"]',
                '.PlayerControlsNeo__layout'
            ],
            'max': [
                '[data-testid="player-container"]',
                '[data-testid="video-player"]',
                '[class*="PlayerContainer"]',
                '[class*="player-container"]',
                '[class*="VideoPlayer"]',
                '[class*="Player__"]',
                '[class*="Player"]',
                '[class*="player"]'
            ],
            'disney': [
                '.btm-media-clients',
                '[class*="player"]',
                '[data-testid="player"]'
            ],
            'prime': [
                '.rendererContainer',
                '[class*="player"]',
                '.webPlayerContainer'
            ]
        };

        const platformSelectors = selectors[this.platform] || [];
        
        for (const selector of platformSelectors) {
            const container = document.querySelector(selector);
            if (container) {
                // Garante que o container tem position relative ou absolute
                const position = window.getComputedStyle(container).position;
                if (position === 'static') {
                    container.style.position = 'relative';
                }
                console.log(`[LinguaFlow] Player container encontrado: ${selector}`);
                return container;
            }
        }
        
        // Última tentativa: procurar por elemento video e pegar o pai
        const video = document.querySelector('video');
        if (video) {
            let parent = video.parentElement;
            let attempts = 0;
            while (parent && attempts < 5) {
                const rect = parent.getBoundingClientRect();
                // Se o pai tem tamanho razoável, provavelmente é o player
                if (rect.width > 400 && rect.height > 300) {
                    const position = window.getComputedStyle(parent).position;
                    if (position === 'static') {
                        parent.style.position = 'relative';
                    }
                    console.log(`[LinguaFlow] Player container encontrado via video parent`);
                    return parent;
                }
                parent = parent.parentElement;
                attempts++;
            }
        }
        
        console.warn('[LinguaFlow] Player container não encontrado, usando fallback');
        return null;
    }

    async init() {
        console.log(`[LinguaFlow] 🚀 Inicializando Engine... Plataforma: ${this.platform}`);
        
        // Carrega configurações salvas do banco (não bloqueante para evitar travamentos do SW)
        console.log('[LinguaFlow] Carregando configurações em background...');
        this._loadSettings().then(() => {
            console.log('[LinguaFlow] Configurações aplicadas.');
            if (this.shadowContainer) this._updateSubtitleColors();
        }).catch(e => console.warn('[LinguaFlow] Falha ao carregar settings:', e));

        // Detecção de mudança de URL (SPA navigation)
        let lastUrl = location.href;
        setInterval(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                this._onUrlChange();
            }
        }, 1000);

        // Observer para esconder legenda nativa (YouTube altera o DOM frequentemente)
        if (this.platform === 'youtube') {
            const ytObserver = new MutationObserver(() => {
                const nativeWindow = document.querySelector('.ytp-caption-window-container');
                if (nativeWindow && nativeWindow.style.display !== 'none') {
                    nativeWindow.style.display = 'none';
                    console.log('[LinguaFlow] Legenda nativa detectada e ocultada novamente');
                }
            });
            ytObserver.observe(document.body, { childList: true, subtree: true });
        }
        
        document.addEventListener('yt-navigate-finish', () => {
            console.log('[LinguaFlow] YouTube SPA Navigation detectada');
            this._waitForVideo();
            // Re-checa legendas após navegação
            setTimeout(() => this._fetchYoutubeSubtitles(), 1000);
        });

        // ── YouTube: método EXATO do V5 (fetch de legendas via storage) ──────
        if (this.platform === 'youtube') {
            this._ytXhrListener = async (e) => {
                await this._fetchYoutubeSubtitles();
            };
            document.addEventListener('youtubeSubtitleXhrEvent', this._ytXhrListener);
            // Tenta carregar imediatamente (caso webRequest já tenha salvo a URL)
            setTimeout(() => this._fetchYoutubeSubtitles(), 500);
        }
        
        // ── Receptor de mensagens postMessage (HBO Max / Max.com / Netflix) ────
        window.addEventListener('message', (e) => {
            if (e.source !== window || !e.data?.type) return;
            
            if (e.data.type === 'LF_HBO_SUB' || e.data.type === 'LF_SUBTITLE_HOOK') {
                let resp = e.data.response || e.data.data;
                if (!resp) return;

                if (resp instanceof ArrayBuffer) resp = new TextDecoder('utf-8').decode(resp);
                else if (typeof resp !== 'string') { try { resp = JSON.stringify(resp); } catch {} }
                
                const cues = this._parseVTT(resp);
                if (cues.length > 0) {
                    this.xhrCues = cues;
                    this.cues = cues; // Unifica para o Sidebar
                    this.usingXhr = true;
                    console.log('[LinguaFlow] Legendas unificadas via postMessage (' + cues.length + ' frases)');
                    
                    // Se o painel lateral já estiver aberto, solicita reconstrução
                    const panel = document.getElementById('lf-subtitle-panel');
                    if (panel && panel.style.display !== 'none') {
                        this._rebuildSubtitleList();
                    }
                }
            }
        });

        if (this.platform === 'max') {
            console.log('[LinguaFlow] HBO Max: aguardando VTT via XHR intercept');
            this._hideHBONativeSubtitles();
        }
        
        await this._injectSubtitleUI();
        this._injectYouTubeControls();
        this._injectNavigationControls();
        this._injectFloatingButton();
        this._setupResizeObserver();
        this._waitForVideo();
        this.startCapture();

        // Inicializa WordPopup (Pro V5 style)
        try {
            const { WordPopup } = await import('./word-popup.js');
            this.wordPopup = new WordPopup(this, this.platform);
            this.wordPopup.init();
            console.log('[LinguaFlow] ✅ WordPopup inicializado com sucesso');
            console.log('[LinguaFlow] WordPopup popup element:', this.wordPopup.popup);
            
            // Teste: criar botão para abrir popup manualmente
            if (this.platform === 'youtube') {
                // Botão de teste removido — funcionalidade em produção
            }
        } catch (e) {
            console.error('[LinguaFlow] ❌ Erro ao inicializar WordPopup:', e);
        }
    }

    // ── Esconde legenda nativa do HBO Max — método Pro V5 ───────────────────
    _hideHBONativeSubtitles() {
        let s = document.getElementById('lf-native-hide');
        if (!s) {
            s = document.createElement('style');
            s.id = 'lf-native-hide';
            document.head.appendChild(s);
        }
        s.textContent = '[data-testid="caption_renderer_overlay"],[class*="SubtitleText"],[class*="subtitle-text"],.track-text-container{opacity:0!important;pointer-events:none!important;}';
        console.log('[LinguaFlow] HBO Max: legenda nativa escondida via CSS (Pro V5)');
    }

    // ── Carrega configurações do banco ───────────────────────────────────────
    async _loadSettings() {
        try {
            const { db } = await import('../utils/db.js');
            await db.initPromise;
            
            // Carrega antecipação de tradução
            const anticipation = await db.getSetting('translationAnticipation');
            if (anticipation !== undefined && anticipation !== null) {
                this.translationAnticipation = anticipation;
                console.log(`[LinguaFlow] Antecipação carregada: ${anticipation}s`);
            }
            
            // Carrega delay de tradução
            const delay = await db.getSetting('translationDelay');
            if (delay !== undefined && delay !== null) {
                this.translationDelay = delay;
                console.log(`[LinguaFlow] Delay carregado: ${delay}s`);
            }
            
            // Carrega pausa automática
            const autoPause = await db.getSetting('autoPause');
            if (autoPause !== undefined && autoPause !== null) {
                this.autoPause = autoPause;
                console.log(`[LinguaFlow] Pausa automática carregada: ${autoPause}`);
            }
            
            // Carrega velocidade de tradução
            const speed = await db.getSetting('translationSpeed');
            if (speed !== undefined && speed !== null) {
                this.translationSpeed = speed;
                console.log(`[LinguaFlow] Velocidade carregada: ${speed}`);
            }
        } catch (e) {
            console.warn('[LinguaFlow] Erro ao carregar configurações:', e.message);
        }
    }

    // ── ResizeObserver para ajustar legenda quando player muda ───────────────
    _setupResizeObserver() {
        const checkAndObserve = () => {
            const playerContainer = this._findPlayerContainer();
            const subtitleHost = document.getElementById('linguaflow-subtitle-host');
            
            if (playerContainer && subtitleHost) {
                const resizeObserver = new ResizeObserver(() => {
                    console.log('[LinguaFlow] Player redimensionado, ajustando legenda...');
                    // Reaplica posicionamento quando player muda de tamanho
                    this._repositionSubtitle();
                });
                
                resizeObserver.observe(playerContainer);
                console.log('[LinguaFlow] ResizeObserver ativado para legenda');
            } else {
                // Tenta novamente após 2 segundos
                setTimeout(checkAndObserve, 2000);
            }
        };
        
        checkAndObserve();

        // Listener para fullscreen
        document.addEventListener('fullscreenchange', () => {
            setTimeout(() => {
                this._repositionSubtitle();
            }, 100);
        });

        // Listener para resize da janela
        window.addEventListener('resize', () => {
            this._repositionSubtitle();
        });
    }

    async _repositionSubtitle() {
        const host = document.getElementById('linguaflow-subtitle-host');
        if (!host) return;

        if (this._currentHorizontal !== undefined) {
            host.style.left = `${this._currentHorizontal}%`;
            host.style.transform = `translateX(-${this._currentHorizontal}%)`;
        }

        // HBO/Max: recalcula bottom baseado na barra de controles real
        if (this.platform === 'max' && this._currentBottom === undefined) {
            const selectors = [
                '[data-testid="control_footer"]',
                '[class*="ControlsFooter"]',
                '[class*="PlayerControls"]',
                '[class*="controls-footer"]',
            ];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    if (rect.height > 0) {
                        host.style.bottom = `${rect.height + 20}px`;
                        return;
                    }
                }
            }
        }

        if (this._currentBottom !== undefined) {
            host.style.bottom = `${this._currentBottom}px`;
        }
    }

    // ── UI de Legendas (Shadow DOM) ──────────────────────────────────────────
    async _injectSubtitleUI() {
        // Remove instâncias anteriores (hot-reload)
        document.getElementById('linguaflow-subtitle-host')?.remove();

        const host = document.createElement('div');
        host.id = 'linguaflow-subtitle-host';

        // Carrega posição salva ou usa padrão
        // YouTube: linha do tempo fica em ~48-60px, então usamos 100px para ficar acima
        // HBO/Max: calculado dinamicamente baseado na barra de controles real
        let bottomPos = this.platform === 'youtube' ? 100 : null; // null = auto para HBO
        let horizontalPos = 50;
        let userSavedBottom = false;
        try {
            const { db } = await import('../utils/db.js');
            const savedBottom = await db.getSetting('subtitleBottom');
            const savedHorizontal = await db.getSetting('subtitleHorizontal');
            if (savedBottom !== undefined && savedBottom !== null) {
                bottomPos = savedBottom;
                userSavedBottom = true;
            }
            if (savedHorizontal !== undefined && savedHorizontal !== null) horizontalPos = savedHorizontal;
        } catch(e) {}

        if (bottomPos === null) bottomPos = 100; // fallback temporário, será recalculado

        // Salva em memoria para o ResizeObserver nao sobrescrever
        this._currentBottom = bottomPos;
        this._currentHorizontal = horizontalPos;

        // Tenta encontrar o container do player (com retry mais agressivo para HBO/Max)
        let playerContainer = this._findPlayerContainer();

        if (!playerContainer && this.platform !== 'generic') {
            // Tenta até 5x com intervalos crescentes (HBO demora para montar o player)
            for (const delay of [1000, 2000, 3000, 4000, 5000]) {
                await new Promise(resolve => setTimeout(resolve, delay));
                playerContainer = this._findPlayerContainer();
                if (playerContainer) break;
            }
        }
        
        if (this.platform === 'max') {
            const effectiveBottom = userSavedBottom ? bottomPos : 120;
            this._currentBottom = effectiveBottom;
            host.style.cssText = `
                position: fixed !important;
                bottom: ${effectiveBottom}px !important;
                left: ${horizontalPos}% !important;
                transform: translateX(-${horizontalPos}%) !important;
                z-index: 2147483640 !important;
                width: 94% !important;
                max-width: 900px !important;
                text-align: center !important;
                pointer-events: none !important;
                padding: 0 !important;
            `;
            document.body.appendChild(host);
            console.log(`[LinguaFlow] HBO: legenda fixed bottom=${effectiveBottom}px`);
        } else if (playerContainer) {
            // YouTube e outros: absoluto dentro do player
            host.style.cssText = `
                position: absolute !important;
                bottom: ${bottomPos}px !important;
                left: ${horizontalPos}% !important;
                transform: translateX(-${horizontalPos}%) !important;
                z-index: 2147483647 !important;
                width: 80% !important;
                max-width: 900px !important;
                text-align: center !important;
                pointer-events: none !important;
                padding: 0 !important;
            `;
            playerContainer.appendChild(host);
            console.log(`[LinguaFlow] Legenda posicionada: ${horizontalPos}% horizontal, ${bottomPos}px vertical`);
        } else {
            // Fallback: posição fixa
            host.style.cssText = `
                position: fixed !important;
                bottom: ${bottomPos}px !important;
                left: ${horizontalPos}% !important;
                transform: translateX(-${horizontalPos}%) !important;
                z-index: 2147483647 !important;
                width: 80% !important;
                max-width: 900px !important;
                text-align: center !important;
                pointer-events: none !important;
                padding: 0 !important;
            `;
            document.body.appendChild(host);
            console.log(`[LinguaFlow] Legenda posicionada (fallback): ${horizontalPos}% horizontal, ${bottomPos}px vertical`);
        }

        this.shadowContainer = host.attachShadow({ mode: 'open' });
        this.shadowContainer.innerHTML = `
            <style>
                :host { all: initial; }
                .lf-wrap {
                    display: inline-flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    pointer-events: auto;
                }
                .lf-orig-row {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                .lf-orig {
                    font-family: 'Inter', Arial, sans-serif;
                    font-weight: 800;
                    font-size: var(--lf-font-size, 31px);
                    color: #FFF;
                    text-shadow: 0 2px 12px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.8);
                    line-height: 1.25;
                    letter-spacing: 0.4px;
                }
                .lf-trans {
                    font-family: 'Inter', Arial, sans-serif;
                    font-weight: 600;
                    font-size: var(--lf-font-size-trans, 18px);
                    color: #38BDF8;
                    background: rgba(10,15,30, var(--lf-bg-opacity, 0.78));
                    backdrop-filter: blur(10px);
                    padding: 5px 18px;
                    border-radius: 12px;
                    border: 1px solid rgba(56,189,248,0.2);
                    transition: filter 0.25s, opacity 0.25s;
                    text-shadow: 0 1px 6px rgba(0,0,0,0.8);
                }
                /* Modo Blur */
                .mode-blur .lf-trans {
                    filter: blur(8px);
                    opacity: 0.55;
                    cursor: pointer;
                }
                .mode-blur .lf-trans:hover {
                    filter: none;
                    opacity: 1;
                }
                /* Palavras clicáveis */
                .lf-word {
                    cursor: pointer;
                    display: inline-block;
                    transition: transform 0.12s, color 0.12s;
                    border-radius: 3px;
                }
                .lf-word:hover {
                    transform: scale(1.18) translateY(-2px);
                    color: #FBBF24 !important;
                }
                .lf-known    { color: var(--lf-color-known, #86EFAC); }  /* verde claro — já sei */
                .lf-mature   { color: #34D399; text-decoration: underline dotted; text-underline-offset: 3px; } /* verde — dominada */
                .lf-review   { color: #38BDF8; text-decoration: underline dashed; text-underline-offset: 3px; } /* azul — revisando */
                .lf-learning { color: #FBBF24; text-decoration: underline dashed; text-underline-offset: 3px; } /* amarelo — aprendendo */
                .lf-saved    { color: var(--lf-color-saved, #93C5FD); text-decoration: underline dashed; text-underline-offset: 4px; } /* azul claro — nova */
                .lf-new      { color: #FFF; } /* branco — nunca vista */

                /* Botão de tradução rápida */
                .lf-translate-btn {
                    background: rgba(56,189,248,0.15);
                    border: 1px solid rgba(56,189,248,0.4);
                    color: #38BDF8;
                    padding: 3px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    font-family: 'Inter', Arial, sans-serif;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-right: 8px;
                    margin-left: 0;
                    vertical-align: middle;
                    backdrop-filter: blur(8px);
                    pointer-events: auto;
                    display: inline-block;
                }
                .lf-translate-btn:hover {
                    background: rgba(56,189,248,0.3);
                    transform: scale(1.05);
                }
                /* Botão de salvar frase */
                .lf-save-btn {
                    background: rgba(125,209,252,0.12);
                    border: 1px solid rgba(125,209,252,0.25);
                    color: #7dd3fc;
                    padding: 3px 10px;
                    border-radius: 16px;
                    font-size: 11px;
                    font-weight: 700;
                    font-family: 'Inter', Arial, sans-serif;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-right: 8px;
                    margin-left: 0;
                    vertical-align: middle;
                    backdrop-filter: blur(8px);
                    pointer-events: auto;
                    display: inline-block;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .lf-save-btn:hover {
                    background: rgba(125,209,252,0.28);
                    border-color: rgba(125,209,252,0.6);
                    transform: scale(1.05);
                }
                .lf-save-btn.ok {
                    color: #4ade80;
                    border-color: rgba(74,222,128,0.5);
                    background: rgba(74,222,128,0.15);
                }
                /* Tradução temporária (flash) */
                .lf-trans-flash {
                    animation: flashIn 0.3s ease-out;
                }
                @keyframes flashIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                
                /* Tooltip de hover */
                .lf-hover-tooltip {
                    position: fixed;
                    background: rgba(16, 185, 129, 0.95);
                    color: white;
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    font-family: 'Inter', sans-serif;
                    z-index: 999999;
                    pointer-events: none;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    white-space: nowrap;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateX(-50%) translateY(-5px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
                
                @keyframes fadeOut {
                    from { opacity: 1; transform: translateX(-50%) translateY(0); }
                    to { opacity: 0; transform: translateX(-50%) translateY(-5px); }
                }
            </style>
            <div class="lf-wrap" id="lf-wrap">
                <div class="lf-orig-row">
                    <button class="lf-save-btn" id="lf-save-btn" style="display:none;" title="Salvar frase">+ Salvar frase</button>
                    <div class="lf-orig" id="lf-orig" style="display:none;"></div>
                    <button class="lf-translate-btn" id="lf-translate-btn" style="display:none;" title="Traduzir frase">🌐 Traduzir</button>
                </div>
                <div class="lf-trans" id="lf-trans" style="display:none;">
                    <span id="lf-trans-txt"></span>
                </div>
            </div>
        `;
        
        // Ativa o observer para esconder/mostrar botão de salvar frase conforme o texto
        this._setupSaveButtonObserver();

        // Auto-pause video on hover (Language Reactor feature) e Arrastar Legenda
        const wrap = this.shadowContainer.getElementById('lf-wrap');
        
        let isDragging = false;
        let startY = 0;
        let startBottom = 0;

        wrap.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('lf-word')) return; // Não arrasta se clicar numa palavra
            isDragging = true;
            startY = e.clientY;
            const computedBottom = window.getComputedStyle(host).bottom;
            startBottom = parseFloat(computedBottom);
            wrap.style.cursor = 'grabbing';
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const deltaY = startY - e.clientY;
            const newBottom = Math.max(0, startBottom + deltaY);
            host.style.bottom = `${newBottom}px`;
            this._currentBottom = newBottom;
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                wrap.style.cursor = 'default';
            }
        });

        wrap.addEventListener('mouseenter', () => {
            if (!isDragging) wrap.style.cursor = 'grab';
            if (this.videoElement && !this.videoElement.paused) {
                this.videoElement.pause();
                this._wasPausedByHover = true;
            }
        });
        wrap.addEventListener('mouseleave', () => {
            wrap.style.cursor = 'default';
        });

        // Botão de tradução rápida
        const translateBtn = this.shadowContainer.getElementById('lf-translate-btn');
        if (translateBtn) {
            translateBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const transDiv = this.shadowContainer.getElementById('lf-trans');
                if (!transDiv) return;

                // Usa _currentCue (funciona para YouTube e HBO)
                const cue = this._currentCue || this.cues[this.currentCueIndex];
                const text = cue?.translatedText;

                if (text) {
                    this._showTranslationFlash(text);
                } else if (cue?.text) {
                    // Traduz agora
                    translateBtn.textContent = '⏳';
                    translateBtn.disabled = true;
                    try {
                        const { translator } = await import('../utils/translator.js');
                        const result = await translator.translate(cue.text, 'auto', this.targetLang);
                        cue.translatedText = result.translation;
                        this._showTranslationFlash(result.translation);
                    } catch {}
                    translateBtn.textContent = '🌐 Traduzir';
                    translateBtn.disabled = false;
                }
            });
        }

        // Botão de salvar frase
        const saveBtn = this.shadowContainer.getElementById('lf-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this._saveSentence();
            });
        }

        // Observer para mostrar/esconder botão baseado na presença de legenda
        this._setupSaveButtonObserver();
    }

    // ── Injeção dos Botões na Barra do YouTube ───────────────────────────────
    _injectYouTubeControls() {
        if (this.platform !== 'youtube') return;

        const tryInject = () => {
            const rightCtrl = document.querySelector('.ytp-right-controls');
            if (!rightCtrl || document.getElementById('lf-yt-btn')) return false;

            // Injeta CSS para os botões e switch (apenas uma vez)
            if (!document.getElementById('lf-yt-styles')) {
                const style = document.createElement('style');
                style.id = 'lf-yt-styles';
                style.textContent = `
                    .lf-yt-btn {
                        width: 44px; height: 44px;
                        display: inline-flex; align-items: center; justify-content: center;
                        background: transparent; border: none; cursor: pointer;
                        vertical-align: top; opacity: 0.9;
                        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        position: relative;
                    }
                    .lf-yt-btn:hover { opacity: 1; transform: scale(1.1); }
                    .lf-yt-btn svg { width: 22px; height: 22px; fill: #64748B; transition: fill 0.3s; }
                    .lf-yt-btn.active svg { fill: #38BDF8; filter: drop-shadow(0 0 5px rgba(56, 189, 248, 0.5)); }
                    
                    .lf-switch-wrapper {
                        display: inline-flex; align-items: center; justify-content: center;
                        width: 50px; height: 44px; vertical-align: top; cursor: pointer;
                        opacity: 0.9; transition: opacity 0.2s;
                    }
                    .lf-switch-wrapper:hover { opacity: 1; }
                    .lf-switch {
                        width: 34px; height: 18px;
                        background: rgba(100, 116, 139, 0.3);
                        border-radius: 20px; position: relative;
                        transition: background 0.3s;
                    }
                    .lf-switch.active { background: rgba(56, 189, 248, 0.4); }
                    .lf-switch-slider {
                        width: 12px; height: 12px;
                        background: #64748B; border-radius: 50%;
                        position: absolute; top: 3px; left: 3px;
                        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                    }
                    .lf-switch.active .lf-switch-slider {
                        left: 19px; background: #38BDF8;
                        box-shadow: 0 0 8px rgba(56, 189, 248, 0.8);
                    }
                `;
                document.head.appendChild(style);
            }

            // Wrapper do Switch
            const isSubVisible = localStorage.getItem('lf_sub_visible') === 'true';
            const switchWrapper = document.createElement('div');
            switchWrapper.id = 'lf-yt-toggle-wrapper';
            switchWrapper.className = 'lf-switch-wrapper';
            switchWrapper.title = isSubVisible ? 'Desativar LinguaFlow (C)' : 'Ativar LinguaFlow (C)';
            switchWrapper.innerHTML = `
                <div class="lf-switch ${isSubVisible ? 'active' : ''}" id="lf-yt-switch">
                    <div class="lf-switch-slider"></div>
                </div>
            `;
            
            switchWrapper.onclick = () => {
                const sw = document.getElementById('lf-yt-switch');
                if (!sw) return;
                
                const nowVisible = !sw.classList.contains('active');
                localStorage.setItem('lf_sub_visible', nowVisible);
                switchWrapper.title = nowVisible ? 'Desativar LinguaFlow (C)' : 'Ativar LinguaFlow (C)';
                
                // toggleSubtitles agora gerencia a sincronia global e com o botão nativo do YouTube
                this.toggleSubtitles(nowVisible);
            };

            // Botão de Configurações (Bolt Premium)
            const btnSettings = document.createElement('button');
            btnSettings.id        = 'lf-yt-btn';
            btnSettings.className = 'lf-yt-btn';
            btnSettings.title     = 'Configurações LinguaFlow (O)';
            btnSettings.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="url(#boltGrad)" stroke="#38BDF8" stroke-width="1.2" stroke-linejoin="round"/>
                    <defs>
                        <linearGradient id="boltGrad" x1="13" y1="2" x2="11" y2="22" gradientUnits="userSpaceOnUse">
                            <stop stop-color="#38BDF8"/>
                            <stop offset="1" stop-color="#818CF8"/>
                        </linearGradient>
                    </defs>
                </svg>
            `;
            
            btnSettings.onclick = () => {
                window.dispatchEvent(new CustomEvent('LF_TOGGLE_SETTINGS'));
            };

            // Insere no player
            rightCtrl.insertBefore(btnSettings, rightCtrl.firstChild);
            rightCtrl.insertBefore(switchWrapper, btnSettings);
            
            // Atalhos de teclado (apenas se ainda não houver)
            if (!this._kbAttached) {
                document.addEventListener('keydown', e => {
                    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
                    if (e.key.toLowerCase() === 'c') switchWrapper.click();
                    if (e.key.toLowerCase() === 'o') btnSettings.click();
                });
                this._kbAttached = true;
            }

            // Aplica estado inicial
            this.toggleSubtitles();
            return true;
        };

        // Tenta imediatamente e depois a cada 1.5 s (YouTube é SPA)
        const iv = setInterval(() => { if (tryInject()) clearInterval(iv); }, 1500);
    }

    _injectDeckSelector() {
        // Deck selector removed from production - not needed in UI
        document.getElementById('lf-deck-host')?.remove();
    }

    // ── Botão Flutuante para plataformas não-YouTube (HBO, Netflix, etc) ──────
    _injectFloatingButton() {
        if (document.getElementById('lf-float-btn')) return;
        if (!document.body) {
            console.warn('[LinguaFlow] document.body não encontrado, adiando criação de botões');
            setTimeout(() => this._injectFloatingButton(), 500);
            return;
        }

        // Botão principal de configurações (todos os sites exceto YouTube)
        if (this.platform !== 'youtube') {
            const btn = document.createElement('button');
            btn.id = 'lf-float-btn';
            btn.title = 'LinguaFlow — Configurações';
            btn.style.cssText = `
                position: fixed;
                top: 80px;
                right: 16px;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                border: none;
                background: rgba(15,23,42,0.85);
                backdrop-filter: blur(8px);
                box-shadow: 0 4px 16px rgba(0,0,0,0.5);
                cursor: pointer;
                z-index: 2147483646;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                transition: transform 0.15s, opacity 0.15s;
                opacity: 0.75;
            `;
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <defs>
    <linearGradient id="lf-float-grad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFD700"/>
      <stop offset="50%" stop-color="#FF8C00"/>
      <stop offset="100%" stop-color="#FF3D3D"/>
    </linearGradient>
  </defs>
  <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z" fill="url(#lf-float-grad)"/>
</svg>`;
            btn.onmouseenter = () => { btn.style.opacity = '1'; btn.style.transform = 'scale(1.1)'; };
            btn.onmouseleave = () => { btn.style.opacity = '0.75'; btn.style.transform = 'scale(1)'; };
            btn.onclick = () => window.dispatchEvent(new CustomEvent('LF_TOGGLE_SETTINGS'));
            document.body.appendChild(btn);
        }

        // Switch de Ativar/Desativar legendas (HBO/Max)
        if (this.platform === 'max') {
            const isSubVisible = localStorage.getItem('lf_sub_visible') === 'true';
            
            // Injeta CSS se necessário
            if (!document.getElementById('lf-hbo-styles')) {
                const style = document.createElement('style');
                style.id = 'lf-hbo-styles';
                style.textContent = `
                    .lf-hbo-switch-wrapper {
                        position: fixed; top: 132px; right: 16px;
                        width: 44px; height: 44px; z-index: 2147483646;
                        display: flex; align-items: center; justify-content: center;
                        cursor: pointer; opacity: 0.8; transition: opacity 0.2s;
                    }
                    .lf-hbo-switch-wrapper:hover { opacity: 1; }
                    .lf-hbo-switch {
                        width: 38px; height: 20px;
                        background: rgba(100, 116, 139, 0.3);
                        border-radius: 20px; position: relative;
                        transition: background 0.3s;
                        border: 1px solid rgba(255,255,255,0.1);
                    }
                    .lf-hbo-switch.active { background: rgba(56, 189, 248, 0.4); border-color: rgba(56, 189, 248, 0.5); }
                    .lf-hbo-slider {
                        width: 14px; height: 14px;
                        background: #64748B; border-radius: 50%;
                        position: absolute; top: 2px; left: 2px;
                        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                    }
                    .lf-hbo-switch.active .lf-hbo-slider {
                        left: 20px; background: #38BDF8;
                        box-shadow: 0 0 8px rgba(56, 189, 248, 0.8);
                    }
                `;
                document.head.appendChild(style);
            }

            const switchWrapper = document.createElement('div');
            switchWrapper.id = 'lf-hbo-toggle-wrapper';
            switchWrapper.className = 'lf-hbo-switch-wrapper';
            switchWrapper.title = isSubVisible ? 'Desativar LinguaFlow (C)' : 'Ativar LinguaFlow (C)';
            switchWrapper.innerHTML = `
                <div class="lf-hbo-switch ${isSubVisible ? 'active' : ''}" id="lf-hbo-switch">
                    <div class="lf-hbo-slider"></div>
                </div>
            `;
            
            switchWrapper.onclick = () => {
                const sw = document.getElementById('lf-hbo-switch');
                const nowVisible = !sw.classList.contains('active');
                sw.classList.toggle('active', nowVisible);
                localStorage.setItem('lf_sub_visible', nowVisible);
                this.toggleSubtitles(nowVisible);
            };
            document.body.appendChild(switchWrapper);
            
            // Atalho de teclado para HBO
            document.addEventListener('keydown', e => {
                if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
                if (e.key.toLowerCase() === 'c') switchWrapper.click();
            });
        }

        // Botão do painel de legendas (todos os sites exceto YouTube)
        if (this.platform !== 'youtube') {
            const btnPanel = document.createElement('button');
            btnPanel.id = 'lf-float-panel-btn';
            btnPanel.title = 'LinguaFlow — Painel de Legendas';
            btnPanel.style.cssText = `
                position: fixed;
                top: 184px;
                right: 16px;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                border: none;
                background: rgba(15,23,42,0.85);
                backdrop-filter: blur(8px);
                box-shadow: 0 4px 16px rgba(0,0,0,0.5);
                cursor: pointer;
                z-index: 2147483646;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                transition: transform 0.15s, opacity 0.15s;
                opacity: 0.75;
            `;
            btnPanel.textContent = '📜';
            btnPanel.onmouseenter = () => { btnPanel.style.opacity = '1'; btnPanel.style.transform = 'scale(1.1)'; };
            btnPanel.onmouseleave = () => { btnPanel.style.opacity = '0.75'; btnPanel.style.transform = 'scale(1)'; };
            btnPanel.onclick = () => this.toggleSubtitlePanel();
            document.body.appendChild(btnPanel);
        }
    }

    // ── Controles de Navegação (Anterior, Próxima, Repetir, Painel) ──────────
    _injectNavigationControls() {
        if (this.platform !== 'youtube') return;

        this.isLooping = false;
        this.loopStartTime = 0;
        this.loopEndTime = 0;

        const tryInject = () => {
            const leftCtrl = document.querySelector('.ytp-left-controls');
            if (!leftCtrl || document.getElementById('lf-nav-controls')) return false;
            
            const container = document.createElement('div');
            container.id = 'lf-nav-controls';
            container.style.cssText = `
                display: inline-flex;
                align-items: center;
                gap: 4px;
                margin-left: 8px;
            `;
            
            // Botão Anterior
            const btnPrev = this._createNavButton('⏮️', 'Frase Anterior (A)', () => this.gotoPreviousCue());
            
            // Botão Repetir (Loop)
            const btnLoop = this._createNavButton('🔁', 'Repetir Frase (R)', () => this.toggleLoop());
            btnLoop.id = 'lf-btn-loop';
            
            // Botão Próxima
            const btnNext = this._createNavButton('⏭️', 'Próxima Frase (D)', () => this.gotoNextCue());
            
            // Botão Painel de Legendas
            const btnPanel = this._createNavButton('📜', 'Painel de Legendas (L)', () => this.toggleSubtitlePanel());
            btnPanel.id = 'lf-btn-panel';
            
            container.appendChild(btnPrev);
            container.appendChild(btnLoop);
            container.appendChild(btnNext);
            container.appendChild(btnPanel);
            
            leftCtrl.appendChild(container);
            
            // Atalhos de teclado
            document.addEventListener('keydown', (e) => {
                if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
                
                if (e.key.toLowerCase() === 'a') {
                    e.preventDefault();
                    this.gotoPreviousCue();
                } else if (e.key.toLowerCase() === 'd') {
                    e.preventDefault();
                    this.gotoNextCue();
                } else if (e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    this.video.currentTime = (this.cues[this.currentCueIndex].start / 1000) + 0.01;
                    this.video.play();
                } else if (e.key.toLowerCase() === 'r') {
                    e.preventDefault();
                    this.toggleLoop();
                } else if (e.key.toLowerCase() === 'l') {
                    e.preventDefault();
                    this.toggleSubtitlePanel();
                } else if (e.key.toLowerCase() === 'o') {
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent('LF_TOGGLE_SETTINGS'));
                } else if (e.key.toLowerCase() === ' ') {
                    e.preventDefault();
                    if (this.video.paused) this.video.play();
                    else this.video.pause();
                } else if (e.key.toLowerCase() === 'q') {
                    e.preventDefault();
                    this.autoPause = !this.autoPause;
                    console.log(`[LinguaFlow] Pausa automática ${this.autoPause ? 'ATIVADA' : 'DESATIVADA'}`);
                    this._showNotification(this.autoPause ? '⏸️ Pausa Automática ATIVADA' : '▶️ Pausa Automática DESATIVADA');
                }
            });
            
            return true;
        };
        
        const iv = setInterval(() => { if (tryInject()) clearInterval(iv); }, 1500);
    }
    
    _createNavButton(icon, title, onclick) {
        const btn = document.createElement('button');
        btn.className = 'ytp-button';
        btn.title = title;
        btn.style.cssText = `
            width: 36px; height: 36px;
            display: inline-flex; align-items: center; justify-content: center;
            background: rgba(255,255,255,0.1); border: none; cursor: pointer;
            font-size: 16px; border-radius: 6px; opacity: 0.9;
            transition: all 0.2s;
        `;
        btn.textContent = icon;
        btn.onmouseenter = () => {
            btn.style.opacity = '1';
            btn.style.background = 'rgba(255,255,255,0.2)';
        };
        btn.onmouseleave = () => {
            btn.style.opacity = '0.9';
            btn.style.background = 'rgba(255,255,255,0.1)';
        };
        btn.onclick = onclick;
        return btn;
    }
    
    gotoPreviousCue() {
        if (!this.videoElement || this.cues.length === 0) return;
        
        const currentTime = this.videoElement.currentTime * 1000;
        let targetIdx = -1;
        
        // Se estamos no início de uma frase (primeiros 500ms), volta para a anterior
        if (this.currentCueIndex >= 0) {
            const currentCue = this.cues[this.currentCueIndex];
            if (currentTime - currentCue.start < 500 && this.currentCueIndex > 0) {
                targetIdx = this.currentCueIndex - 1;
            } else {
                // Senão, volta para o início da frase atual
                this.videoElement.currentTime = currentCue.start / 1000;
                return;
            }
        } else {
            // Procura a frase anterior
            for (let i = this.cues.length - 1; i >= 0; i--) {
                if (this.cues[i].end < currentTime) {
                    targetIdx = i;
                    break;
                }
            }
        }
        
        if (targetIdx >= 0) {
            this.videoElement.currentTime = this.cues[targetIdx].start / 1000;
            console.log('[LinguaFlow] Voltou para frase anterior');
        }
    }
    
    gotoNextCue() {
        if (!this.videoElement || this.cues.length === 0) return;
        
        const currentTime = this.videoElement.currentTime * 1000;
        let targetIdx = -1;
        
        // Procura a próxima frase
        for (let i = 0; i < this.cues.length; i++) {
            if (this.cues[i].start > currentTime) {
                targetIdx = i;
                break;
            }
        }
        
        if (targetIdx >= 0) {
            this.videoElement.currentTime = this.cues[targetIdx].start / 1000;
            console.log('[LinguaFlow] Pulou para próxima frase');
        }
    }
    
    toggleLoop() {
        if (!this.videoElement || this.currentCueIndex < 0) return;
        
        this.isLooping = !this.isLooping;
        const btnLoop = document.getElementById('lf-btn-loop');
        
        if (this.isLooping) {
            const currentCue = this.cues[this.currentCueIndex];
            this.loopStartTime = currentCue.start / 1000;
            this.loopEndTime = currentCue.end / 1000;
            
            if (btnLoop) {
                btnLoop.style.background = 'rgba(56, 189, 248, 0.3)';
                btnLoop.style.color = '#38BDF8';
            }
            
            // Listener para loop
            this._loopInterval = setInterval(() => {
                if (this.isLooping && this.videoElement.currentTime >= this.loopEndTime) {
                    this.videoElement.currentTime = this.loopStartTime;
                }
            }, 100);
            
            console.log(`[LinguaFlow] Loop ATIVADO: ${this.loopStartTime.toFixed(2)}s - ${this.loopEndTime.toFixed(2)}s`);
            this._showNotification('🔁 Repetindo Frase');
        } else {
            if (btnLoop) {
                btnLoop.style.background = 'rgba(255,255,255,0.1)';
                btnLoop.style.color = '';
            }
            
            if (this._loopInterval) {
                clearInterval(this._loopInterval);
                this._loopInterval = null;
            }
            
            console.log('[LinguaFlow] Loop DESATIVADO');
            this._showNotification('▶️ Loop Desativado');
        }
    }
    
    _showNotification(message) {
        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(15, 23, 42, 0.95);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            font-weight: 600;
            z-index: 2147483647;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideDown 0.3s ease-out;
        `;
        notif.textContent = message;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideDown {
                from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(notif);
        
        setTimeout(() => {
            notif.style.animation = 'slideDown 0.3s ease-out reverse';
            setTimeout(() => {
                notif.remove();
                style.remove();
            }, 300);
        }, 2000);
    }
    
    toggleSubtitlePanel() {
        const existingPanel = document.getElementById('lf-subtitle-panel');
        if (existingPanel) {
            existingPanel.remove();
            const btnPanel = document.getElementById('lf-btn-panel');
            if (btnPanel) {
                btnPanel.style.background = 'rgba(255,255,255,0.1)';
                btnPanel.style.color = '';
            }
            return;
        }
        
        this._createSubtitlePanel();
    }
    
    
    _createSubtitlePanel() {
        const panel = document.createElement('div');
        panel.id = 'lf-subtitle-panel';
        panel.style.cssText = `
            position: fixed;
            top: 0;
            right: 0;
            width: 400px;
            height: 100vh;
            background: rgba(10, 22, 40, 0.98);
            backdrop-filter: blur(10px);
            border-left: 1px solid rgba(255,255,255,0.1);
            z-index: 2147483646;
            display: flex;
            flex-direction: column;
            font-family: 'Inter', sans-serif;
            animation: slideInRight 0.3s ease-out;
        `;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
            }
        `;
        document.head.appendChild(style);
        
        // ── Header ──────────────────────────────────────────────────────────
        const header = document.createElement('div');
        header.style.cssText = 'padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';
        header.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none">
                <defs><linearGradient id="lf-hdr-grad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#FFD700"/><stop offset="50%" stop-color="#FF8C00"/><stop offset="100%" stop-color="#FF3D3D"/>
                </linearGradient></defs>
                <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z" fill="url(#lf-hdr-grad)"/>
              </svg>
              <span style="font-size:15px;font-weight:700;color:#F1F5F9;">LinguaFlow</span>
            </div>
            <button id="lf-close-panel" style="background:rgba(255,255,255,0.08);border:none;color:#94A3B8;width:30px;height:30px;border-radius:6px;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;">✕</button>
        `;

        // ── Abas Subtitles / Words ────────────────────────────────────────────
        const tabs = document.createElement('div');
        tabs.style.cssText = 'display:flex;border-bottom:1px solid rgba(255,255,255,0.1);flex-shrink:0;';
        tabs.innerHTML = `
            <button id="lf-tab-subtitles" style="flex:1;padding:12px;background:transparent;border:none;border-bottom:2px solid #38BDF8;color:#38BDF8;font-size:13px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;transition:all 0.2s;">Subtitles</button>
            <button id="lf-tab-words" style="flex:1;padding:12px;background:transparent;border:none;border-bottom:2px solid transparent;color:#64748B;font-size:13px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;transition:all 0.2s;">Words</button>
        `;

        // ── Painel Subtitles ──────────────────────────────────────────────────
        const subtitlePane = document.createElement('div');
        subtitlePane.id = 'lf-pane-subtitles';
        subtitlePane.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';

        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'padding:10px 16px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;gap:6px;align-items:center;flex-shrink:0;';
        toolbar.innerHTML = `
            <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:#94A3B8;cursor:pointer;">
                <input type="checkbox" id="lf-show-translation" checked style="cursor:pointer;">
                <span>Tradução</span>
            </label>
            <input id="lf-panel-search" type="search" placeholder="Buscar..." style="width:80px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#E2E8F0;border-radius:6px;padding:5px 7px;font-size:11px;outline:none;">
            <button id="lf-follow-btn" title="Seguir legenda atual" style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);color:#10B981;padding:4px 7px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;">📍</button>
            <div style="flex:1;"></div>
            <button id="lf-export-html" style="background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.3);color:#38BDF8;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;">HTML</button>
            <button id="lf-export-pdf" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#EF4444;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;">PDF</button>
        `;

        const list = document.createElement('div');
        list.id = 'lf-subtitle-list';
        list.style.cssText = 'flex:1;overflow-y:auto;padding:10px;scrollbar-width:thin;scrollbar-color:#334155 transparent;';
        list._userScrolling = false;
        let _scrollTimer = null;
        list.addEventListener('scroll', () => {
            list._userScrolling = true;
            clearTimeout(_scrollTimer);
            _scrollTimer = setTimeout(() => { list._userScrolling = false; }, 3000);
        }, { passive: true });

        this._rebuildSubtitleList();

        subtitlePane.appendChild(toolbar);
        subtitlePane.appendChild(list);

        subtitlePane.appendChild(toolbar);
        subtitlePane.appendChild(list);

        // ── Painel Words (Frequência estilo Lingosieve) ───────────────────────
        const wordsPane = document.createElement('div');
        wordsPane.id = 'lf-pane-words';
        wordsPane.style.cssText = 'flex:1;display:none;flex-direction:column;overflow:hidden;';

        const wordsScroll = document.createElement('div');
        wordsScroll.style.cssText = 'flex:1;overflow-y:auto;padding:14px;scrollbar-width:thin;scrollbar-color:#334155 transparent;';

        const stopWords = new Set(['the','a','an','and','or','but','to','of','in','on','at','for','with','is','are','was','were','be','been','it','this','that','you','i','we','they','he','she','do','does','did','not','so','as','if','my','your','our','their','his','her','its','by','from','up','about','into','than','then','when','what','which','who','how','all','each','more','also','just','can','will','would','could','should','may','might','have','has','had','get','got','go','come','know','think','see','look','want','use','find','give','tell','work','call','try','ask','need','feel','become','leave','put','mean','keep','let','begin','show','hear','play','run','move','live','believe','hold','bring','happen','write','provide','sit','stand','lose','pay','meet','include','continue','set','learn','change','lead','understand','watch','follow','stop','create','speak','read','spend','grow','open','walk','win','offer','remember','love','consider','appear','buy','wait','serve','die','send','expect','build','stay','fall','cut','reach','kill','remain','suggest','raise','pass','sell','require','report','decide','pull']);
        const freqMap = new Map();
        this.cues.forEach(cue => {
            (cue.text || '').toLowerCase().match(/[a-z][a-z'-]{1,}/g)?.forEach(w => {
                const clean = w.replace(/^'+|'+$/g, '');
                if (clean.length > 2 && !stopWords.has(clean)) freqMap.set(clean, (freqMap.get(clean) || 0) + 1);
            });
        });

        const TOP5K = 'the,be,to,of,and,a,in,that,have,it,for,not,on,with,he,as,you,do,at,this,but,his,by,from,they,we,say,her,she,or,an,will,my,one,all,would,there,their,what,so,up,out,if,about,who,get,which,go,me,when,make,can,like,time,no,just,him,know,take,people,into,year,your,good,some,could,them,see,other,than,then,now,look,only,come,its,over,think,also,back,after,use,two,how,our,work,first,well,way,even,new,want,because,any,these,give,day,most,us,great,between,need,large,often,hand,high,place,hold,real,life,few,north,open,seem,together,next,white,children,begin,got,walk,example,ease,paper,always,music,those,both,mark,book,letter,until,mile,river,car,feet,care,second,enough,plain,girl,usual,young,ready,above,ever,red,list,though,feel,talk,bird,soon,body,dog,family,direct,pose,leave,song,measure,door,product,black,short,numeral,class,wind,question,happen,complete,ship,area,half,rock,order,fire,south,problem,piece,told,knew,pass,since,top,whole,king,space,heard,best,hour,better,true,during,hundred,five,remember,step,early,hold,west,ground,interest,reach,fast,verb,sing,listen,six,table,travel,less,morning,ten,simple,several,vowel,toward,war,lay,against,pattern,slow,center,love,person,money,serve,appear,road,map,rain,rule,govern,pull,cold,notice,voice,unit,power,town,fine,drive,led,cry,dark,machine,note,wait,plan,figure,star,box,noun,field,rest,correct,able,pound,done,beauty,drive,stood,contain,front,teach,week,final,gave,green,oh,quick,develop,ocean,warm,free,minute,strong,special,mind,behind,clear,tail,produce,fact,street,inch,multiply,nothing,course,stay,wheel,full,force,blue,object,decide,surface,deep,moon,island,foot,system,busy,test,record,boat,common,gold,possible,plane,stead,dry,wonder,laugh,thousand,ago,ran,check,game,shape,equate,hot,miss,brought,heat,snow,tire,bring,yes,distant,fill,east,paint,language,among,grand,ball,yet,wave,drop,heart,am,present,heavy,dance,engine,position,arm,wide,sail,material,size,vary,settle,speak,weight,general,ice,matter,circle,pair,include,divide,syllable,felt,perhaps,pick,sudden,count,square,reason,length,represent,art,subject,region,energy,hunt,probable,bed,brother,egg,ride,cell,believe,fraction,forest,sit,race,window,store,summer,train,sleep,prove,lone,leg,exercise,wall,catch,mount,wish,sky,board,joy,winter,sat,written,wild,instrument,kept,glass,grass,cow,job,edge,sign,visit,past,soft,fun,bright,gas,weather,month,million,bear,finish,happy,hope,flower,clothe,strange,gone,jump,baby,eight,village,meet,root,buy,raise,solve,metal,whether,push,seven,paragraph,third,shall,held,hair,describe,cook,floor,either,result,burn,hill,safe,cat,century,consider,type,law,bit,coast,copy,phrase,silent,tall,sand,soil,roll,temperature,finger,industry,value,fight,lie,beat,excite,natural,view,sense,ear,else,quite,broke,case,middle,kill,son,lake,moment,scale,loud,spring,observe,child,straight,consonant,nation,dictionary,milk,speed,method,organ,pay,age,section,dress,cloud,surprise,quiet,stone,tiny,climb,cool,design,poor,lot,experiment,bottom,key,iron,single,stick,flat,twenty,skin,smile,crease,hole,trade,melody,trip,office,receive,row,mouth,exact,symbol,die,least,trouble,shout,except,wrote,seed,tone,join,suggest,clean,break,lady,yard,rise,bad,blow,oil,blood,touch,grew,cent,mix,team,wire,cost,lost,brown,wear,garden,equal,sent,choose,fell,fit,flow,fair,bank,collect,save,control,decimal,gentle,woman,captain,practice,separate,difficult,doctor,please,protect,noon,whose,locate,ring,character,insect,caught,period,indicate,radio,spoke,atom,human,history,effect,electric,expect,crop,modern,element,hit,student,corner,party,supply,bone,rail,imagine,provide,agree,thus,capital,chair,danger,fruit,rich,thick,soldier,process,operate,guess,necessary,sharp,wing,create,neighbor,wash,bat,rather,crowd,corn,compare,poem,string,bell,depend,meat,rub,tube,famous,dollar,stream,fear,sight,thin,triangle,planet,hurry,chief,colony,clock,mine,tie,enter,major,fresh,search,send,yellow,gun,allow,print,dead,spot,desert,suit,current,lift,rose,continue,block,chart,hat,sell,success,company,subtract,event,particular,deal,swim,term,opposite,wife,shoe,shoulder,spread,arrange,camp,invent,cotton,born,determine,quart,nine,truck,noise,level,chance,gather,shop,stretch,throw,shine,property,column,molecule,select,wrong,gray,repeat,require,broad,prepare,salt,nose,plural,anger,claim,continent,oxygen,sugar,death,pretty,skill,women,season,solution,magnet,silver,thank,branch,match,suffix,especially,fig,afraid,huge,sister,steel,discuss,forward,similar,guide,experience,score,apple,bought,led,pitch,coat,mass,card,band,rope,slip,win,dream,evening,condition,feed,tool,total,basic,smell,valley,nor,double,seat,arrive,master,track,parent,shore,division,sheet,substance,favor,connect,post,spend,chord,fat,glad,original,share,station,dad,bread,charge,proper,bar,offer,segment,slave,duck,instant,market,degree,populate,chick,dear,enemy,reply,drink,occur,support,speech,nature,range,steam,motion,path,liquid,log,meant,quotient,teeth,shell,neck'.split(',');

        const rankMap = new Map();
        TOP5K.forEach((w, i) => rankMap.set(w, i + 1));

        const bands = [];
        for (let s = 1; s <= 5000; s += 100) bands.push({ label: s + ' – ' + (s + 99), start: s, end: s + 99, words: [] });
        const outOfTop = { label: 'Fora do top-5k', words: [] };

        freqMap.forEach((count, word) => {
            const rank = rankMap.get(word);
            if (rank) { const bi = Math.floor((rank - 1) / 100); if (bands[bi]) bands[bi].words.push({ word, count, rank }); }
            else outOfTop.words.push({ word, count, rank: 99999 });
        });

        const totalUnique = freqMap.size;
        const inTop5k = [...freqMap.keys()].filter(w => rankMap.has(w)).length;

        // ── Stats card — renderiza com dados atuais e re-renderiza após reload do DB ──
        const statsDiv = document.createElement('div');
        statsDiv.style.cssText = 'background:rgba(255,255,255,0.04);border-radius:10px;padding:14px 16px;margin-bottom:14px;';

        const renderStats = (knownWords, savedWords) => {
            const videoWords = [...freqMap.keys()];
            const cKnown    = videoWords.filter(w => knownWords.has(w)).length;
            const cLearning = videoWords.filter(w => savedWords.get(w) === 'learning').length;
            const cReview   = videoWords.filter(w => savedWords.get(w) === 'review').length;
            const cMature   = videoWords.filter(w => savedWords.get(w) === 'mature').length;
            const cSaved    = videoWords.filter(w => savedWords.get(w) === 'new').length;
            const cNew      = videoWords.filter(w => !knownWords.has(w) && !savedWords.has(w)).length;
            const pct = (n) => totalUnique ? Math.round(n / totalUnique * 100) : 0;

            statsDiv.innerHTML = `
                <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:14px;">
                  <div style="font-size:28px;font-weight:800;color:#F1F5F9;line-height:1;">${totalUnique}</div>
                  <div style="font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;">UNIQUE WORDS</div>
                </div>

                <div style="margin-bottom:9px;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="font-size:11px;color:#94A3B8;font-weight:600;">Top-5k frequência</span>
                    <span style="font-size:11px;color:#FFD700;font-weight:700;">${inTop5k}<span style="color:#475569;font-weight:400;"> / ${totalUnique}</span></span>
                  </div>
                  <div style="background:rgba(255,255,255,0.06);border-radius:6px;height:6px;overflow:hidden;">
                    <div style="height:100%;width:${pct(inTop5k)}%;background:linear-gradient(90deg,#FF8C00,#FFD700);border-radius:6px;transition:width 0.5s;"></div>
                  </div>
                </div>

                <div style="margin-bottom:9px;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="font-size:11px;color:#94A3B8;font-weight:600;">Novas (nunca vistas)</span>
                    <span style="font-size:11px;color:#E2E8F0;font-weight:700;">${cNew}<span style="color:#475569;font-weight:400;"> / ${totalUnique}</span></span>
                  </div>
                  <div style="background:rgba(255,255,255,0.06);border-radius:6px;height:6px;overflow:hidden;">
                    <div style="height:100%;width:${pct(cNew)}%;background:linear-gradient(90deg,#475569,#94A3B8);border-radius:6px;transition:width 0.5s;"></div>
                  </div>
                </div>

                <div style="margin-bottom:9px;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="font-size:11px;color:#94A3B8;font-weight:600;">Salvas no deck</span>
                    <span style="font-size:11px;color:#93C5FD;font-weight:700;">${cSaved}<span style="color:#475569;font-weight:400;"> / ${totalUnique}</span></span>
                  </div>
                  <div style="background:rgba(255,255,255,0.06);border-radius:6px;height:6px;overflow:hidden;">
                    <div style="height:100%;width:${pct(cSaved)}%;background:linear-gradient(90deg,#2563EB,#93C5FD);border-radius:6px;transition:width 0.5s;"></div>
                  </div>
                </div>

                <div style="margin-bottom:9px;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="font-size:11px;color:#94A3B8;font-weight:600;">Aprendendo</span>
                    <span style="font-size:11px;color:#FBBF24;font-weight:700;">${cLearning}<span style="color:#475569;font-weight:400;"> / ${totalUnique}</span></span>
                  </div>
                  <div style="background:rgba(255,255,255,0.06);border-radius:6px;height:6px;overflow:hidden;">
                    <div style="height:100%;width:${pct(cLearning)}%;background:linear-gradient(90deg,#D97706,#FBBF24);border-radius:6px;transition:width 0.5s;"></div>
                  </div>
                </div>

                <div style="margin-bottom:9px;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="font-size:11px;color:#94A3B8;font-weight:600;">Revisando</span>
                    <span style="font-size:11px;color:#38BDF8;font-weight:700;">${cReview}<span style="color:#475569;font-weight:400;"> / ${totalUnique}</span></span>
                  </div>
                  <div style="background:rgba(255,255,255,0.06);border-radius:6px;height:6px;overflow:hidden;">
                    <div style="height:100%;width:${pct(cReview)}%;background:linear-gradient(90deg,#0284C7,#38BDF8);border-radius:6px;transition:width 0.5s;"></div>
                  </div>
                </div>

                <div style="margin-bottom:9px;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="font-size:11px;color:#94A3B8;font-weight:600;">Dominadas</span>
                    <span style="font-size:11px;color:#34D399;font-weight:700;">${cMature}<span style="color:#475569;font-weight:400;"> / ${totalUnique}</span></span>
                  </div>
                  <div style="background:rgba(255,255,255,0.06);border-radius:6px;height:6px;overflow:hidden;">
                    <div style="height:100%;width:${pct(cMature)}%;background:linear-gradient(90deg,#059669,#34D399);border-radius:6px;transition:width 0.5s;"></div>
                  </div>
                </div>

                <div style="margin-bottom:0;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="font-size:11px;color:#94A3B8;font-weight:600;">Conhecidas</span>
                    <span style="font-size:11px;color:#86EFAC;font-weight:700;">${cKnown}<span style="color:#475569;font-weight:400;"> / ${totalUnique}</span></span>
                  </div>
                  <div style="background:rgba(255,255,255,0.06);border-radius:6px;height:6px;overflow:hidden;">
                    <div style="height:100%;width:${pct(cKnown)}%;background:linear-gradient(90deg,#16A34A,#86EFAC);border-radius:6px;transition:width 0.5s;"></div>
                  </div>
                </div>
            `;
        };

        // Renderiza imediatamente com o que já está em memória
        renderStats(this.knownWords, this.savedWords);
        wordsScroll.appendChild(statsDiv);

        // Recarrega do DB para garantir dados frescos e re-renderiza
        import('../utils/db.js').then(async ({ db }) => {
            try {
                await db.initPromise;
                const tx = db.db.transaction(['words', 'cards'], 'readonly');
                const words = await new Promise(r => { const req = tx.objectStore('words').getAll(); req.onsuccess = () => r(req.result || []); req.onerror = () => r([]); });
                const cards = await new Promise(r => { const req = tx.objectStore('cards').getAll(); req.onsuccess = () => r(req.result || []); req.onerror = () => r([]); });
                const cardStatus = {};
                cards.forEach(c => { cardStatus[c.word_id] = c.status; });
                const freshSaved = new Map();
                const freshKnown = new Set(this.knownWords); // mantém os marcados em sessão
                words.forEach(w => {
                    const status = cardStatus[w.id];
                    if (status) freshSaved.set(w.word.toLowerCase(), status);
                });
                // Atualiza o mapa em memória também
                this.savedWords = freshSaved;
                renderStats(freshKnown, freshSaved);
            } catch(e) {
                console.warn('[LinguaFlow] Stats: erro ao recarregar do DB', e.message);
            }
        });

        const allBands = [...bands.filter(b => b.words.length > 0), ...(outOfTop.words.length > 0 ? [outOfTop] : [])];

        if (allBands.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'text-align:center;color:#475569;font-size:13px;padding:40px 20px;';
            empty.textContent = 'Nenhuma legenda carregada ainda. Inicie o vídeo para ver as palavras.';
            wordsScroll.appendChild(empty);
        }

        allBands.forEach(band => {
            band.words.sort((a, b) => (a.rank || 99999) - (b.rank || 99999));
            const section = document.createElement('div');
            section.style.cssText = 'margin-bottom:10px;';

            const isTop1k = band.start && band.start <= 1000;
            const hColor = isTop1k ? '#FFD700' : (band.start <= 2000 ? '#FF8C00' : (band.start <= 3000 ? '#38BDF8' : '#94A3B8'));
            const bandHeader = document.createElement('div');
            bandHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:rgba(255,255,255,0.05);border-radius:7px;cursor:pointer;margin-bottom:6px;border-left:3px solid ' + hColor + ';';
            bandHeader.innerHTML = '<span style="font-size:12px;font-weight:700;color:' + hColor + '">' + band.label + '</span><span style="font-size:11px;color:#64748B;">' + band.words.length + ' palavras <span class="lf-band-arrow" style="margin-left:4px;">▼</span></span>';

            const wordGrid = document.createElement('div');
            wordGrid.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;padding:4px 2px 8px;';

            band.words.forEach(({ word, count }) => {
                const chip = document.createElement('button');
                chip.type = 'button';
                const isKnown = this.knownWords.has(word);
                const status = this.savedWords.get(word);
                let cc = '#94A3B8', cb = 'rgba(255,255,255,0.05)', cbo = 'rgba(255,255,255,0.1)';
                if (isKnown)              { cc = '#86EFAC'; cb = 'rgba(134,239,172,0.1)'; cbo = 'rgba(134,239,172,0.25)'; }
                else if (status === 'mature')   { cc = '#34D399'; cb = 'rgba(52,211,153,0.1)'; cbo = 'rgba(52,211,153,0.25)'; }
                else if (status === 'learning') { cc = '#FBBF24'; cb = 'rgba(251,191,36,0.1)'; cbo = 'rgba(251,191,36,0.25)'; }
                else if (status === 'new')      { cc = '#93C5FD'; cb = 'rgba(147,197,253,0.1)'; cbo = 'rgba(147,197,253,0.25)'; }
                chip.style.cssText = 'background:' + cb + ';border:1px solid ' + cbo + ';color:' + cc + ';border-radius:999px;padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;transition:all 0.15s;';
                chip.textContent = count > 1 ? (word + ' ×' + count) : word;
                chip.title = 'Ir para "' + word + '"';
                chip.addEventListener('mouseenter', () => { chip.style.transform = 'scale(1.08)'; });
                chip.addEventListener('mouseleave', () => { chip.style.transform = ''; });
                chip.addEventListener('click', () => {
                    const fi = this.cues.findIndex(cue => new RegExp('\\b' + word + '\\b', 'i').test(cue.text || ''));
                    if (fi >= 0 && this.videoElement) {
                        this.videoElement.currentTime = this.cues[fi].start / 1000;
                        document.getElementById('lf-tab-subtitles')?.click();
                    }
                });
                wordGrid.appendChild(chip);
            });

            let collapsed = false;
            bandHeader.addEventListener('click', () => {
                collapsed = !collapsed;
                wordGrid.style.display = collapsed ? 'none' : 'flex';
                const arrow = bandHeader.querySelector('.lf-band-arrow');
                if (arrow) arrow.textContent = collapsed ? '▶' : '▼';
            });

            section.appendChild(bandHeader);
            section.appendChild(wordGrid);
            wordsScroll.appendChild(section);
        });

        wordsPane.appendChild(wordsScroll);

        // ── Monta painel ──────────────────────────────────────────────────────
        panel.appendChild(header);
        panel.appendChild(tabs);
        panel.appendChild(subtitlePane);
        panel.appendChild(wordsPane);
        document.body.appendChild(panel);

        // ── Lógica das abas ───────────────────────────────────────────────────
        const tabSubtitles = document.getElementById('lf-tab-subtitles');
        const tabWords = document.getElementById('lf-tab-words');
        const switchTab = (active) => {
            if (active === 'subtitles') {
                subtitlePane.style.display = 'flex';
                wordsPane.style.display = 'none';
                tabSubtitles.style.borderBottomColor = '#38BDF8';
                tabSubtitles.style.color = '#38BDF8';
                tabWords.style.borderBottomColor = 'transparent';
                tabWords.style.color = '#64748B';
            } else {
                subtitlePane.style.display = 'none';
                wordsPane.style.display = 'flex';
                tabWords.style.borderBottomColor = '#38BDF8';
                tabWords.style.color = '#38BDF8';
                tabSubtitles.style.borderBottomColor = 'transparent';
                tabSubtitles.style.color = '#64748B';
            }
        };
        tabSubtitles.addEventListener('click', () => switchTab('subtitles'));
        tabWords.addEventListener('click', () => switchTab('words'));
        switchTab('subtitles');

        // ── Eventos ───────────────────────────────────────────────────────────
        document.getElementById('lf-close-panel').onclick = () => this.toggleSubtitlePanel();
        document.getElementById('lf-show-translation').onchange = (e) => {
            list.querySelectorAll('.lf-translation-text').forEach(t => { t.style.display = e.target.checked ? 'block' : 'none'; });
        };
        document.getElementById('lf-panel-search').addEventListener('input', e => {
            const q = e.target.value.toLowerCase();
            list.querySelectorAll('.lf-subtitle-item').forEach(item => {
                const cue = this.cues[Number(item.dataset.index)];
                const text = ((cue?.text || '') + ' ' + (cue?.translatedText || '')).toLowerCase();
                item.style.display = text.includes(q) ? 'block' : 'none';
            });
        });
        document.getElementById('lf-export-html').onclick = () => this._exportSubtitlesHTML();
        document.getElementById('lf-export-pdf').onclick = () => this._exportSubtitlesPDF();
        document.getElementById('lf-follow-btn').onclick = () => { list._userScrolling = false; this._updateSubtitlePanelHighlight(); };

        const btnPanel = document.getElementById('lf-btn-panel');
        if (btnPanel) { btnPanel.style.background = 'rgba(56,189,248,0.3)'; btnPanel.style.color = '#38BDF8'; }

        this._updateSubtitlePanelHighlight();
        setInterval(() => this._updateSubtitlePanelHighlight(), 500);
    }
    
    _exportSubtitlesHTML() {
        const videoTitle = document.title || 'Legendas';
        const showTranslation = document.getElementById('lf-show-translation').checked;

        const rows = this.cues.map(cue => {
            const time = this._formatTime(cue.start / 1000);
            const trans = cue.translatedText || '';
            return `<tr>
  <td class="t">${time}</td>
  <td class="o">${escapeHTML(cue.text)}${showTranslation && trans ? `<span class="tr">${escapeHTML(trans)}</span>` : ''}</td>
</tr>`;
        }).join('\n');

        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>${videoTitle}</title>
<style>
body{font-family:Arial,sans-serif;font-size:13px;margin:24px;color:#1e293b;}
h2{color:#0ea5e9;margin-bottom:4px;}
p{color:#64748b;margin:0 0 16px;font-size:12px;}
table{width:100%;border-collapse:collapse;}
td{padding:5px 8px;vertical-align:top;border-bottom:1px solid #e2e8f0;}
.t{color:#94a3b8;font-size:11px;white-space:nowrap;width:48px;}
.o{line-height:1.5;}
.tr{display:block;color:#0ea5e9;font-size:12px;margin-top:2px;cursor:pointer;}
.tr:not(.vis){display:none;}
</style></head>
<body>
<h2>${videoTitle}</h2>
<p>${this.cues.length} legendas &bull; ${new Date().toLocaleDateString('pt-BR')} &bull; LinguaFlow${showTranslation ? ' &bull; <em>Clique na linha para ver tradu&ccedil;&atilde;o</em>' : ''}</p>
<table>${rows}</table>
</body></html>`;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${videoTitle.replace(/[^a-z0-9]/gi, '_').slice(0,40)}_legendas.html`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    _exportSubtitlesPDF() {
        const videoTitle = document.title || 'Legendas';
        const showTranslation = document.getElementById('lf-show-translation').checked;

        const rows = this.cues.map(cue => {
            const time = this._formatTime(cue.start / 1000);
            const trans = cue.translatedText || '';
            return `<tr>
  <td class="t">${time}</td>
  <td class="o">${escapeHTML(cue.text)}${showTranslation && trans ? `<br><span class="tr">${escapeHTML(trans)}</span>` : ''}</td>
</tr>`;
        }).join('\n');

        const printHTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>${videoTitle}</title>
<style>
@page{margin:1.5cm 2cm;}
body{font-family:Arial,sans-serif;font-size:11px;color:#1e293b;}
h2{color:#0ea5e9;font-size:14px;margin-bottom:2px;}
p{color:#64748b;font-size:10px;margin:0 0 10px;}
table{width:100%;border-collapse:collapse;}
tr{page-break-inside:avoid;}
td{padding:3px 6px;vertical-align:top;border-bottom:1px solid #e2e8f0;}
.t{color:#94a3b8;font-size:10px;white-space:nowrap;width:40px;}
.o{line-height:1.4;}
.tr{color:#0ea5e9;font-size:10px;}
</style></head>
<body>
<h2>${videoTitle}</h2>
<p>${this.cues.length} legendas &bull; ${new Date().toLocaleDateString('pt-BR')} &bull; LinguaFlow</p>
<table>${rows}</table>
</body></html>`;

        const w = window.open('', '_blank');
        w.document.write(printHTML);
        w.document.close();
        w.onload = () => setTimeout(() => w.print(), 250);
    }
    
    _updateSubtitlePanelHighlight() {
        const list = document.getElementById('lf-subtitle-list');
        if (!list) return;
        
        const items = list.querySelectorAll('.lf-subtitle-item');
        items.forEach((item, idx) => {
            if (idx === this.currentCueIndex) {
                item.style.background = 'rgba(56, 189, 248, 0.15)';
                item.style.borderLeftColor = '#38BDF8';
                
                // Só faz scroll automático se o usuário não estiver rolando manualmente
                // _userScrolling é definido como true quando o usuário rola, e volta a false após 3s
                if (!list._userScrolling) {
                    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else {
                item.style.background = 'rgba(255,255,255,0.03)';
                item.style.borderLeftColor = 'transparent';
            }
        });
    }

    _renderVideoWordPrep() {
        const box = document.getElementById('lf-video-words');
        if (!box) return;
        box.textContent = '';

        const stop = new Set(['the','a','an','and','or','but','to','of','in','on','at','for','with','is','are','was','were','be','been','it','this','that','you','i','we','they','he','she','do','does','did','not','so','as','if','my','your','our','their']);
        const counts = new Map();
        this.cues.forEach(cue => {
            (cue.text || '').toLowerCase().match(/[a-z][a-z'-]{2,}/g)?.forEach(word => {
                const clean = word.replace(/^'+|'+$/g, '');
                if (!stop.has(clean) && !this.knownWords.has(clean)) counts.set(clean, (counts.get(clean) || 0) + 1);
            });
        });

        const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
        if (top.length === 0) {
            const empty = document.createElement('span');
            empty.style.cssText = 'font-size:12px;color:#64748B;';
            empty.textContent = 'Nenhuma palavra candidata encontrada ainda.';
            box.appendChild(empty);
            return;
        }

        top.forEach(([word, count]) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.style.cssText = 'background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);color:#86EFAC;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:700;cursor:pointer;';
            chip.textContent = `${word} ×${count}`;
            chip.addEventListener('click', () => {
                const firstIndex = this.cues.findIndex(cue => new RegExp(`\\b${word}\\b`, 'i').test(cue.text || ''));
                if (firstIndex >= 0 && this.videoElement) this.videoElement.currentTime = this.cues[firstIndex].start / 1000;
            });
            box.appendChild(chip);
        });
    }

    async _saveCueAsPhrase(cue, item) {
        const btn = item.querySelector('.lf-save-line');
        if (btn) btn.disabled = true;
        
        try {
            const { db } = await import('../utils/db.js');
            if (!cue.translatedText) {
                const { translator } = await import('../utils/translator.js');
                const result = await translator.translate(cue.text, 'auto', this.targetLang);
                cue.translatedText = result.translation;
            }
            const data = {
                item_type: 'phrase',
                word: cue.text,
                lang: 'en',
                translation: cue.translatedText || '',
                phrase_text: cue.text,
                phrase_translation: cue.translatedText || '',
                context_sentence: cue.text,
                deck_id: 1,
                video_url: await this._getVideoUrlWithTimestamp(),
                timestamp: cue.start / 1000,
                platform: this.platform,
                tags: ['phrase']
            };
            const saveRes = await db.saveSentence(data);
            if (!saveRes || !saveRes.ok) throw new Error('Falha ao salvar frase');
            if (btn) {
                btn.textContent = 'Salva';
                btn.style.background = 'rgba(16,185,129,0.18)';
                btn.style.color = '#86EFAC';
            }
        } catch (e) {
            console.error('[LinguaFlow] Erro ao salvar frase do painel:', e);
            if (btn) {
                btn.textContent = 'Erro';
                btn.disabled = false;
            }
        }
    }
    
    async _formatTime(seconds) {
        const BASE = chrome.runtime.getURL('utils/');
        const { videoUtils } = await import(BASE + 'video-utils.js');
        return videoUtils.formatTime(seconds);
    }

    // ── VTT Parser (HBO Max) — V5 version ────────────────────────────────────
    _parseVTT(vttStr) {
        const cues = [];
        const blocks = vttStr.split(/\n\s*\n/);
        blocks.forEach(b => {
            const lines = b.trim().split('\n');
            let timeLine = lines.find(l => l.includes('-->'));
            if (!timeLine) return;
            const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
            const parseTime = t => {
                const timePart = t.split(/\s+/)[0].replace(',', '.');
                const p = timePart.split(':');
                let sec = parseFloat(p.pop() || 0);
                if(p.length) sec += parseInt(p.pop() || 0) * 60;
                if(p.length) sec += parseInt(p.pop() || 0) * 3600;
                return sec;
            };
            const text = lines.slice(lines.indexOf(timeLine) + 1).map(l => l.replace(/<[^>]+>/g, '').trim()).join(' ').trim();
            if(text) cues.push({ start: parseTime(startStr), end: parseTime(endStr), text });
        });
        return cues;
    }

    // ── fetchYoutubeSubtitles — cópia exata do V5 ────────────────────────────
    async _fetchYoutubeSubtitles() {
        try {
            const { lastYoutubeSubtitleUrls } = await chrome.storage.local.get('lastYoutubeSubtitleUrls');
            const urls = lastYoutubeSubtitleUrls ?? [];
            console.log('[LinguaFlow] Fetched', urls.length, 'subtitle URLs');

            const videoId = new URL(window.location.href).searchParams.get('v');
            if (!videoId) return;

            const url = urls.find(r => {
                try { return new URL(r).searchParams.get('v') === videoId; }
                catch { return false; }
            });
            if (!url) {
                console.log('[LinguaFlow] No subtitle URL found for video', videoId);
                return;
            }

            const response = await fetch(new URL(url).toString());
            const text = await response.text();
            const data = (() => { try { return JSON.parse(text); } catch { return null; } })();
            if (!data?.events) {
                console.log('[LinguaFlow] No events in data');
                return;
            }

            const cues = this._processYtSub(data);
            console.log('[LinguaFlow] Loaded', cues.length, 'cues');
            if (cues.length > 0) {
                this.cues = cues; // Sincroniza para o Sync Loop do YouTube
                this.xhrCues = cues;
                this.usingXhr = true;
                window.dispatchEvent(new CustomEvent('LF_CUES_LOADED', { detail: cues }));
                console.log('[LinguaFlow] Legendas carregadas e sincronizadas.');
            }
        } catch (e) {
            console.error('[LinguaFlow] Fetch error', e);
        }
    }

    // ── processYtSub — cópia EXATA do V5 ──────────────────────────────────────
    _processYtSub(data) {
        const l = {_a:4,_b:14,_c:1e3,_d:600,_e:5,_f:400,_g:7,_h:3,_i:5,_j:6,_k:4};

        function decodeHtml(s) {
            if (!s) return s;
            const o = document.createElement('textarea');
            o.innerHTML = s;
            let r = o.value, e = '', a = 5;
            while (r !== e && a > 0) { e = r; o.innerHTML = r; r = o.value; a--; }
            return r;
        }

        function round(s, o) {
            if (!(isNaN(s) || typeof o !== 'number' || o < 0)) return Number(s.toFixed(o));
        }

        const D = {
            en: new Set(["but","so","and","because","when","while","if","then","however","although","also","or","yet","since","after","before","until","unless","where","which","who","that","though","whether","once","now","still","even","just","already","never","always","sometimes","meanwhile","furthermore","moreover","therefore","otherwise","instead","anyway","besides","finally","actually","basically","honestly","apparently","obviously","clearly","unfortunately","seriously"]),
            es: new Set(["pero","porque","cuando","mientras","aunque","entonces","también","donde","como","si","después","antes","hasta","sin","además","ya","ahora","nunca","siempre","todavía","incluso","solo","primero","luego","finalmente","básicamente","obviamente","desafortunadamente","realmente","actualmente","simplemente"]),
            de: new Set(["aber","weil","wenn","während","obwohl","dann","also","auch","oder","denn","damit","nachdem","bevor","bis","seit","wo","dass","noch","schon","nie","immer","jetzt","trotzdem","außerdem","deshalb","allerdings","eigentlich","grundsätzlich","natürlich","tatsächlich","normalerweise","übrigens"]),
            fr: new Set(["mais","parce","quand","pendant","bien","alors","aussi","donc","car","après","avant","depuis","si","où","comme","puis","encore","déjà","jamais","toujours","maintenant","même","cependant","pourtant","néanmoins","ensuite","finalement","évidemment","malheureusement","franchement","simplement","vraiment","apparemment","normalement","heureusement"]),
        };

        function detectLang(words) {
            const o = words.slice(0, 50).map(a => a.toLowerCase().replace(/[^a-záàâäãéèêëíìîïóòôöõúùûüñçß]/g, ''));
            const r = {};
            for (const [a, g] of Object.entries(D)) r[a] = o.filter(m => g.has(m)).length;
            const e = Object.entries(r).sort((a, g) => g[1] - a[1])[0];
            return e && e[1] >= 2 ? e[0] : null;
        }

        function processEvents(s) {
            if (!s?.events?.length) return [];
            const CJK = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/;
            const maxSample = 100;
            let e = 0, a = 0;
            for (const n of s.events) {
                if (e >= maxSample) break;
                if (n.segs) for (const b of n.segs) {
                    if (e >= maxSample) break;
                    const d = (b.utf8 || '').trim();
                    e++;
                    const x = d.includes(' '), y = CJK.test(d) && d.length > 2;
                    if (x || y) a++;
                }
            }
            const isCJK = e > 0 && a / e > 0.5;
            const m = [];

            if (isCJK) {
                s.events.forEach(n => {
                    if (!n.segs) return;
                    const b = n.segs.map(y => y.utf8 || '').join('').replace(/\n/g, ' ').trim();
                    if (!b) return;
                    const d = n.tStartMs ?? 0, x = n.dDurationMs ?? 0;
                    m.push({ text: b, start: d / 1000, end: (d + x) / 1000 });
                });
            } else {
                const n = [];
                s.events.forEach(t => {
                    if (!t.segs) return;
                    const c = t.tStartMs ?? 0, p = t.dDurationMs ?? 0;
                    t.segs.forEach(W => {
                        let S = (W.utf8 ?? '').replace(/\n/g, ' ').trim();
                        if (!S) return;
                        const f = S.split(/\s+/);
                        if (f.length > 1) {
                            const i = p > 0 ? p / f.length : 500;
                            f.forEach((h, j) => { n.push({ word: h, startMs: c + j * i }); });
                        } else {
                            const i = W.tOffsetMs ?? 0;
                            n.push({ word: S, startMs: c + i });
                        }
                    });
                });
                n.sort((t, c) => t.startMs - c.startMs);

                const langKey = detectLang(n.map(t => t.word));
                const d = langKey ? D[langKey] : null;
                const isConn = t => d ? d.has(t.toLowerCase().replace(/[^a-záàâäãéèêëíìîïóòôöõúùûüñçß]/g, '')) : false;
                const hasComma = t => /[,;]$/.test(t);
                const pushCue = (words, startMs, endMs) => {
                    const sep = CJK.test(words[0] ?? '') ? '' : ' ';
                    m.push({ text: words.join(sep), start: startMs / 1000, end: endMs / 1000 });
                };

                let u = [], _ = -1, M = [];
                if (n.length > 0) { _ = n[0].startMs; u.push(n[0].word); M.push(0); }

                for (let t = 0; t < n.length - 1; t++) {
                    const c = n[t], p = n[t + 1];
                    const W = Math.max(c.word.length * 50, 200);
                    const S = c.startMs + W;
                    const f = Math.max(0, p.startMs - S);
                    const i = u.length;
                    let h = false;
                    const j = /[.?!。？！]["']?$/.test(c.word);

                    if (
                        (j && i >= l._h) ||
                        f > l._c ||
                        i >= l._b ||
                        (d && i >= l._i && isConn(p.word)) ||
                        (hasComma(c.word) && i >= l._j) ||
                        (i >= l._e && f > l._d) ||
                        (i >= l._g && f > l._f)
                    ) h = true;

                    if (h) {
                        let w = i - 1;
                        if (i >= l._b && !j && f <= l._c) {
                            for (let v = 1; v <= Math.min(l._k, i - l._a); v++) {
                                const E = i - 1 - v, k = u[E], T = u[E + 1];
                                if (hasComma(k)) { w = E; break; }
                                if (d && isConn(T)) { w = E; break; }
                            }
                        }
                        if (w < i - 1) {
                            const v = u.slice(0, w + 1), E = u.slice(w + 1);
                            const k = M[w], T = n[k], N = Math.max(T.word.length * 50, 200);
                            pushCue(v, _, T.startMs + N);
                            const O = M[w + 1];
                            u = [...E]; M = M.slice(w + 1); _ = n[O].startMs;
                        } else {
                            pushCue(u, _, c.startMs + W);
                            u = []; M = []; _ = p.startMs;
                        }
                    }
                    u.push(p.word); M.push(t + 1);
                }
                if (u.length > 0) {
                    const t = n[n.length - 1], c = Math.max(t.word.length * 50, 200);
                    pushCue(u, _ !== -1 ? _ : t.startMs, t.startMs + c);
                }
            }
            return m;
        }

        const raw = processEvents(data);
        console.log('[LinguaFlow] Raw cues from processEvents:', raw.length);
        for (let e = 0; e < raw.length - 1; e++) {
            if (raw[e].end > raw[e + 1].start) raw[e].end = raw[e + 1].start;
        }
        const result = raw.map(e => {
            const a = round(e.start, 2), g = round(e.end - e.start, 2), m = round(e.end, 2);
            if (a == null || g == null || m == null) return null;
            return {
                startTime: a,
                duration:  g,
                finishTime: m,
                id: `subtitle_${a}_${m}`,
                sentence: decodeHtml(e.text.trim()),
                start: a,
                end:   m,
                text:  decodeHtml(e.text.trim()),
            };
        }).filter(e => e != null);
        console.log('[LinguaFlow] Final cues:', result.length);
        return result;
    }

    // ── Aguarda elemento <video> ─────────────────────────────────────────────
    _waitForVideo() {
        const iv = setInterval(() => {
            const vid = document.querySelector('video');
            if (!vid) return;
            this.videoElement = vid;
            clearInterval(iv);
            if (this.platform === 'youtube' || this.platform === 'max') this._startSyncLoop();

            // Reinjecta botão caso o YT tenha remontado o player
            vid.addEventListener('play', () => this._injectYouTubeControls());

            // Para HBO/Max: se a legenda foi posicionada em fallback, reposiciona
            // dentro do player agora que o vídeo (e o player) estão prontos
            if (this.platform !== 'youtube') {
                const host = document.getElementById('linguaflow-subtitle-host');
                if (host && host.parentElement === document.body) {
                    // Ainda está no body (fallback) — tenta mover para o player
                    setTimeout(() => {
                        const player = this._findPlayerContainer();
                        if (player) {
                            const bottom = this._currentBottom ?? 188;
                            const horiz  = this._currentHorizontal ?? 50;
                            host.style.cssText = `
                                position: absolute !important;
                                bottom: ${bottom}px !important;
                                left: ${horiz}% !important;
                                transform: translateX(-${horiz}%) !important;
                                z-index: 2147483647 !important;
                                width: 80% !important;
                                max-width: 900px !important;
                                text-align: center !important;
                                pointer-events: none !important;
                                padding: 0 !important;
                            `;
                            player.appendChild(host);
                            console.log('[LinguaFlow] Legenda reposicionada dentro do player');
                        }
                    }, 1500);
                }
            }
        }, 800);
    }

    // ── Captura ──────────────────────────────────────────────────────────────
    startCapture() {
        if (this.platform === 'youtube') {
            this._injectYouTubeHook();
        }
        // V5: Inicia o sync loop para todas as plataformas (exceto YouTube/Max que usam o novo motor)
        if (this.platform !== 'youtube' && this.platform !== 'max') {
            this._ready = true;
            this._syncLoop = () => {
                this._syncXhrCues();
                if (this._ready) this._syncTimer = requestAnimationFrame(this._syncLoop);
            };
            this._syncTimer = requestAnimationFrame(this._syncLoop);
            console.log('[LinguaFlow] Sync loop legado iniciado');
        } else {
            console.log('[LinguaFlow] Utilizando novo motor de sincronização');
        }
    }

    // ── Recupera legendas do YouTube do storage local (Persistência F5) ────────
    async _fetchYoutubeSubtitles() {
        if (this.cues.length > 0) return;
        
        chrome.storage.local.get('lastYoutubeSubtitleUrls', async (res) => {
            const urls = res.lastYoutubeSubtitleUrls || [];
            if (urls.length === 0) return;
            
            console.log('[LinguaFlow] Tentando recuperar legendas de URLs salvas:', urls.length);
            
            // Tenta a URL mais recente que combine com o vídeo atual
            // No YouTube, as URLs de legenda contêm o v=VIDEO_ID
            const videoId = new URLSearchParams(window.location.search).get('v');
            if (!videoId) return;
            
            const matchingUrls = urls.filter(u => u.includes(videoId)).reverse();
            
            for (const url of matchingUrls) {
                try {
                    const resp = await fetch(url);
                    if (resp.ok) {
                        const text = await resp.text();
                        this._processYouTubeRawSubtitles(url, text);
                        if (this.cues.length > 0) {
                            console.log('[LinguaFlow] Legendas recuperadas com sucesso via F5 Cache');
                            break;
                        }
                    }
                } catch (e) {
                    console.warn('[LinguaFlow] Falha ao fetch subtitle cache:', e);
                }
            }
        });
    }

    _injectYouTubeHook() {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('content/youtube-hook.js');
        script.onload = () => script.remove();
        (document.head || document.documentElement).appendChild(script);

        window.addEventListener('message', (ev) => {
            if (ev.source !== window || !ev.data || ev.data.type !== 'LF_SUBTITLE_HOOK') return;
            this._processYouTubeRawSubtitles(ev.data.url, ev.data.data);
        });
    }

    _processYouTubeRawSubtitles(url, raw) {
        if (!raw || raw.length < 10) return;
        let cues = [];

        if (raw.startsWith('{')) {
            try { cues = subtitleParsers.parseYouTubeJSON(JSON.parse(raw)); } catch(e) {}
        } else if (raw.includes('WEBVTT')) {
            cues = subtitleParsers.parseVTT(raw);
        } else if (raw.includes('<p') || raw.includes('<?xml')) {
            cues = subtitleParsers.parseTTML(raw);
        } else if (raw.includes('-->')) {
            cues = subtitleParsers.parseSRT(raw);
        }

        if (cues.length > 0) {
            this.cues = cues;
            this._renderVideoWordPrep();
            
            // Persistência para F5
            chrome.storage.local.get('lastYoutubeSubtitleUrls', (res) => {
                let urls = res.lastYoutubeSubtitleUrls || [];
                if (!urls.includes(url)) {
                    urls.push(url);
                    if (urls.length > 10) urls.shift();
                    chrome.storage.local.set({ 'lastYoutubeSubtitleUrls': urls });
                }
            });

            // Esconde legenda nativa do YouTube
            const ytWrap = document.querySelector('.ytp-caption-window-container');
            if (ytWrap) {
                ytWrap.style.display = 'none';
                console.log('[LinguaFlow] Legenda nativa do YouTube escondida');
            }
        }
    }

    // ── Atualização via DOM (Netflix/etc) ─────────────────────────────────────
    async _onDomSubtitleUpdate(text, timeMs) {
        if (!text) { this.renderDual('', ''); return; }

        const cue = { start: timeMs, end: timeMs + 8000, text };
        this.cues.push(cue);
        this._renderVideoWordPrep();

        // Mostra original imediatamente
        this.renderDual(text, '');

        // Traduz INSTANTANEAMENTE com detecção automática de idioma
        try {
            const { translator } = await import('../utils/translator.js');
            const result = await translator.translate(text, 'auto', this.targetLang);
            cue.translatedText = result.translation;
            this.renderDual(text, result.translation);
            
            // Log de performance (apenas em dev)
            if (result.source !== 'memory_cache') {
                console.log(`[LinguaFlow] Tradução: ${result.source} (${result.cached ? 'cached' : 'new'})`);
            }
        } catch(e) {
            console.error('[LinguaFlow] Erro na tradução:', e);
            this.renderDual(text, '');
        }
    }

    // ── V5 Sync Method (cópia exata do LinguaFlow Pro V5) ────────────────────
    _syncXhrCues() {
        if (!this.xhrCues || !this.xhrCues.length) return;

        // YouTube: respeita o botão de legendas nativo
        if (this.platform === 'youtube') {
            const subBtn = document.querySelector('.ytp-subtitles-button');
            if (subBtn && subBtn.getAttribute('aria-pressed') === 'false') {
                if (this.lastText !== '') {
                    this.lastText = '';
                    this.renderDual('', '');
                }
                return;
            }
        }

        const v = this.videoElement || document.querySelector('video');
        if (!v) return;
        
        const t = v.currentTime;
        
        // Encontra a cue atual (para auto-captions que sobrepõem, pegamos a mais longa)
        const activeCues = this.xhrCues.filter(c => t >= c.start && t <= c.end);
        let cue = null;
        if (activeCues.length > 0) {
            cue = activeCues.reduce((prev, current) => 
                (prev.text.length > current.text.length) ? prev : current
            );
        }
        
        if (cue && cue.text !== this.lastText) {
            this.lastText = cue.text;
            console.log('[LinguaFlow] Mostrando legenda:', cue.text.substring(0, 50));
            this.onSubtitle(cue);
        } else if (!cue && this.lastText !== '') {
            this.lastText = '';
            console.log('[LinguaFlow] Escondendo legenda');
            this.renderDual('', '');
        }
    }

    // ── Sync Loop (YouTube + HBO, RAF) ───────────────────────────────────────
    _startSyncLoop() {
        let lastCueEndTime = 0;
        let autoPausedAt = 0;
        
        const loop = () => {
            // HBO/Max: usa xhrCues (VTT completo)
            if (this.platform === 'max' && this.xhrCues.length > 0) {
                const v = this.videoElement || document.querySelector('video');
                if (!v) {
                    this.syncInterval = requestAnimationFrame(loop);
                    return;
                }
                const t = v.currentTime;
                
                // Encontra TODAS as cues ativas no tempo atual
                const cuesToSearch = (this.xhrCues && this.xhrCues.length > 0) ? this.xhrCues : this.cues;
                const activeCues = cuesToSearch.filter(c => t >= c.start && t <= c.end);
                
                // Se houver múltiplas cues ativas (overlap), pega a mais longa
                let cue = null;
                if (activeCues.length > 0) {
                    cue = activeCues.reduce((prev, current) => 
                        (prev.text.length > current.text.length) ? prev : current
                    );
                }
                
                if (cue && cue.text !== this.lastText) {
                    this.lastText = cue.text;
                    this.onSubtitle(cue);
                } else if (!cue && this.lastText !== '') {
                    this.lastText = '';
                    this._currentCue = null;
                    this.renderDual('', '');
                }
                
                this.syncInterval = requestAnimationFrame(loop);
                return;
            }
            
            // YouTube: respeita o botão de legendas nativo
            if (this.platform === 'youtube') {
                const subBtn = document.querySelector('.ytp-subtitles-button');
                if (subBtn && subBtn.getAttribute('aria-pressed') === 'false') {
                    if (this.lastText !== '') {
                        this.lastText = '';
                        this.renderDual('', '');
                    }
                    this.syncInterval = requestAnimationFrame(loop);
                    return;
                }
            }
            
            // YouTube: usa cues normais (ou fallback para xhrCues se populado por fetch direto)
            const activeCuesList = this.cues.length > 0 ? this.cues : (this.platform === 'youtube' ? this.xhrCues : []);
            if (this.videoElement && activeCuesList.length > 0) {
                const currentTimeMs = this.videoElement.currentTime * 1000;
                const t = currentTimeMs / 1000; // Converte para segundos
                
                // Encontra TODAS as cues ativas no tempo atual
                const activeCues = activeCuesList.filter(c => t >= c.start/1000 && t <= c.end/1000);
                
                // Se houver múltiplas cues ativas (overlap), pega a mais longa
                let idx = -1;
                if (activeCues.length > 0) {
                    const longestCue = activeCues.reduce((prev, current) => 
                        (prev.text.length > current.text.length) ? prev : current
                    );
                    idx = activeCuesList.indexOf(longestCue);
                }

                if (idx !== this.currentCueIndex) {
                    this.currentCueIndex = idx;
                    if (idx !== -1) {
                        const currentCue = activeCuesList[idx];
                        this.onSubtitle(currentCue);
                        lastCueEndTime = currentCue.end;
                        
                        // SAFE LOOKAHEAD: pre-translate next 3 cues sequentially to avoid rate-limits
                        const nextCues = activeCuesList.slice(idx + 1, idx + 4).filter(c => !c.translatedText && !c.isTranslating);
                        if (nextCues.length > 0) {
                            nextCues.forEach(c => c.isTranslating = true);
                            import('../utils/translator.js').then(({ translator }) => {
                                nextCues.reduce((promise, nextCue) => {
                                    return promise.then(() => translator.translate(nextCue.text, 'auto', this.targetLang).then(res => {
                                        nextCue.translatedText = res.translation;
                                        nextCue.isTranslating = false;
                                    }).catch(() => { nextCue.isTranslating = false; }));
                                }, Promise.resolve());
                            });
                        }
                    }
                    else {
                        this.renderDual('', '');
                        
                        // PAUSA AUTOMÁTICA: Pausa quando legenda termina
                        if (this.autoPause && 
                            !this.videoElement.paused && 
                            lastCueEndTime > 0 && 
                            currentTimeMs >= lastCueEndTime &&
                            currentTimeMs - autoPausedAt > 1000) { // Evita pausas múltiplas
                            
                            this.videoElement.pause();
                            autoPausedAt = currentTimeMs;
                            console.log('[LinguaFlow AutoPause] Vídeo pausado ao fim da fala');
                            
                            // Mostra indicador visual de pausa
                            this._showAutoPauseIndicator();
                        }
                    }
                }
            }
            this.syncInterval = requestAnimationFrame(loop);
        };
        this.syncInterval = requestAnimationFrame(loop);
    }
    
    _showAutoPauseIndicator() {
        if (!this.shadowContainer) return;
        
        const indicator = document.createElement('div');
        indicator.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(16, 185, 129, 0.95);
            color: white;
            padding: 16px 32px;
            border-radius: 12px;
            font-family: 'Inter', sans-serif;
            font-size: 16px;
            font-weight: 600;
            z-index: 2147483647;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            animation: fadeInOut 1.5s ease-in-out;
        `;
        indicator.textContent = '⏸️ Pausa Automática';
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(indicator);
        
        setTimeout(() => {
            indicator.remove();
            style.remove();
        }, 1500);
    }

    async onSubtitle(cue) {
        const delayMs = (this.translationDelay || 0) * 1000;
        
        // Armazena o timestamp da legenda atual para uso ao clicar em palavras
        this.currentSubtitleTimestamp = cue.start / 1000;
        // Guarda referência da cue atual (funciona para xhrCues e cues)
        this._currentCue = cue;
        
        if (cue.translatedText) {
            if (!cue.firstRenderedAt) cue.firstRenderedAt = Date.now();
            const elapsed = Date.now() - cue.firstRenderedAt;
            
            if (elapsed >= delayMs) {
                this.renderDual(cue.text, cue.translatedText);
            } else {
                this.renderDual(cue.text, '...');
                setTimeout(() => {
                    if (this._currentCue === cue) {
                        this.renderDual(cue.text, cue.translatedText);
                    }
                }, delayMs - elapsed);
            }
        } else {
            // Mostra imediatamente o original
            this.renderDual(cue.text, '...');
            if (!cue.firstRenderedAt) cue.firstRenderedAt = Date.now();
            
            if (!cue.isTranslating) {
                cue.isTranslating = true;
                try {
                    const { translator } = await import('../utils/translator.js');
                    const result = await translator.translate(cue.text, 'auto', this.targetLang);
                    cue.translatedText = result.translation;
                    cue.isTranslating = false;
                    
                    const elapsed = Date.now() - cue.firstRenderedAt;
                    const remainingDelay = Math.max(0, delayMs - elapsed);
                    
                    if (remainingDelay > 0) {
                        setTimeout(() => {
                            if (this._currentCue === cue) {
                                this.renderDual(cue.text, cue.translatedText);
                            }
                        }, remainingDelay);
                    } else {
                        if (this._currentCue === cue) {
                            this.renderDual(cue.text, cue.translatedText);
                        }
                    }
                } catch(e) {
                    cue.isTranslating = false;
                    if (this._currentCue === cue) {
                        this.renderDual(cue.text, '');
                    }
                }
            }
        }
    }

    // ── Renderização ─────────────────────────────────────────────────────────
    _showTranslationFlash(text) {
        const transDiv = this.shadowContainer?.getElementById('lf-trans');
        const btn = this.shadowContainer?.getElementById('lf-translate-btn');
        if (!transDiv) return;

        // Cancela flash anterior
        if (this._flashTimeout) {
            clearTimeout(this._flashTimeout);
            this._flashTimeout = null;
        }

        const transSpan = this.shadowContainer?.getElementById('lf-trans-txt');
        if (transSpan) transSpan.textContent = this._fixEncoding(text);
        transDiv.style.display = 'block';
        transDiv.classList.add('lf-trans-flash');
        if (btn) btn.style.display = 'none';

        // Some após o tempo configurado (flashDuration)
        this._flashTimeout = setTimeout(() => {
            transDiv.classList.remove('lf-trans-flash');
            if (this.displayMode === 'native') {
                transDiv.style.display = 'none';
                if (btn) btn.style.display = 'block';
            }
            this._flashTimeout = null;
        }, (this.flashDuration || 4) * 1000);
    }

    // ── Salvar Frase (Pro V5 Style) ──────────────────────────────────────────
    async _getVideoUrlWithTimestamp() {
        const BASE = chrome.runtime.getURL('utils/');
        const { videoUtils } = await import(BASE + 'video-utils.js');
        return videoUtils.getVideoUrlWithTimestamp();
    }

    async _saveSentence() {
        const saveBtn = this.shadowContainer?.getElementById('lf-save-btn');
        const cue = this._currentCue || this.cues[this.currentCueIndex];
        
        if (!cue || !cue.text) return;

        try {
            const { db } = await import('../utils/db.js');
            const sentenceData = {
                original: cue.text,
                translation: cue.translatedText || '',
                videoUrl: await this._getVideoUrlWithTimestamp(),
                videoTitle: document.title,
                platform: this.platform,
                timestamp: this.videoElement?.currentTime || 0
            };

            const res = await db.saveSentence(sentenceData);

            // Feedback visual
            if (res.ok && saveBtn) {
                saveBtn.textContent = '✅ Salva!';
                saveBtn.classList.add('ok');
                setTimeout(() => {
                    saveBtn.textContent = '+ Salvar frase';
                    saveBtn.classList.remove('ok');
                }, 2000);
            }
            console.log('[LinguaFlow] 📌 Frase salva via DB Proxy:', sentenceData.original);
        } catch (e) {
            console.error('[LinguaFlow] Erro ao salvar frase:', e);
        }
    }

    renderDual(orig, trans) {
        if (!this.shadowContainer) return;
        const wrap     = this.shadowContainer.getElementById('lf-wrap');
        const origDiv  = this.shadowContainer.getElementById('lf-orig');
        const transDiv = this.shadowContainer.getElementById('lf-trans');
        const saveBtn  = this.shadowContainer.getElementById('lf-save-btn');
        if (!wrap || !origDiv || !transDiv) return;

        // Verifica se há legenda válida (texto não vazio após trim)
        const hasValidSubtitle = orig && orig.trim().length > 0;

        if (!hasValidSubtitle) {
            origDiv.style.display  = 'none';
            transDiv.style.display = 'none';
            if (saveBtn) {
                saveBtn.style.display = 'none';
                saveBtn.textContent = '+ Salvar frase'; // Reseta texto se estava "Salvo"
            }
            return;
        }
        
        // Mostra botão salvar APENAS quando há legenda ativa e válida
        if (saveBtn) {
            saveBtn.style.display = 'inline-block';
        }

        const mode = this.displayMode;

        origDiv.innerHTML = '';
        origDiv.appendChild(this._makeClickable(orig));

        // Corrige encoding de caracteres especiais
        const decodedTrans = this._fixEncoding(trans);
        
        // Log para debug de encoding (apenas se houver caracteres suspeitos)
        if (trans && (trans.includes('◆') || trans.includes('�') || trans.includes('Ã'))) {
            console.warn('[LinguaFlow] ⚠️ Encoding issue detectado:');
            console.warn('  Original:', trans);
            console.warn('  Corrigido:', decodedTrans);
        }
        
        const transSpan = this.shadowContainer.getElementById('lf-trans-txt');
        if (transSpan) transSpan.textContent = decodedTrans;
        else { const s = transDiv.querySelector('#lf-trans-txt'); if(s) s.textContent = decodedTrans; }

        origDiv.style.display  = (mode === 'translated') ? 'none' : 'block';
        transDiv.style.display = (mode === 'native')     ? 'none' : 'block';

        // Mostra botão de tradução rápida apenas quando tradução está oculta
        const translateBtn = this.shadowContainer.getElementById('lf-translate-btn');
        if (translateBtn) {
            const showBtn = orig && (mode === 'native');
            translateBtn.style.display = showBtn ? 'block' : 'none';
            if (showBtn) translateBtn.textContent = '🌐 Traduzir';
        }

        if (mode === 'blur') wrap.classList.add('mode-blur');
        else                 wrap.classList.remove('mode-blur');
    }

    _makeClickable(text) {
        const frag = document.createDocumentFragment();

        // Normaliza entidades HTML de apostrofo antes de tokenizar
        const normalized = text
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            .replace(/\u2019/g, "'")
            .replace(/\u2018/g, "'");

        // Split em espacos/pontuacao, mas NAO em apostrofo entre letras (preserva contracoes)
        const tokens = normalized.split(/([ \n\t\r.,!?;"()[\]{}<>]+)/);

        tokens.forEach(token => {
            if (/[a-zA-Z\u00C0-\u024F]/.test(token)) {
                const span = document.createElement('span');
                span.textContent = token;
                span.className   = 'lf-word ' + this._wordClass(token);
                
                // Hover: abre o popup completo após 400ms (igual ao Language Reactor)
                let hoverTimeout = null;
                
                span.addEventListener('mouseenter', async (e) => {
                    hoverTimeout = setTimeout(() => {
                        if (this.wordPopup) {
                            const rect = span.getBoundingClientRect();
                            console.log('[LinguaFlow] Abrindo popup para:', token, 'rect:', rect);
                            // showForWord(word, context, rect)
                            this.wordPopup.showForWord(token, fixUtf8(text), rect);
                        } else {
                            console.warn('[LinguaFlow] WordPopup não inicializado');
                        }
                    }, 400);
                });
                
                span.addEventListener('mouseleave', () => {
                    if (hoverTimeout) {
                        clearTimeout(hoverTimeout);
                        hoverTimeout = null;
                    }
                    // Não fecha o popup — o popup fecha sozinho quando o mouse sai dele
                });
                
                span.addEventListener('click', e => {
                    e.stopPropagation();
                    // Click imediato (sem delay)
                    if (hoverTimeout) { clearTimeout(hoverTimeout); hoverTimeout = null; }
                    if (this.wordPopup) {
                        const rect = span.getBoundingClientRect();
                        console.log('[LinguaFlow] Click no popup para:', token, 'rect:', rect);
                        this.wordPopup.showForWord(token, fixUtf8(text), rect);
                    } else {
                        console.warn('[LinguaFlow] WordPopup não inicializado');
                    }
                });
                frag.appendChild(span);
            } else {
                frag.appendChild(document.createTextNode(token));
            }
        });
        return frag;
    }


    _wordClass(word) {
        // Normaliza contracoes: i'm -> i'm, don't -> don't (apostrofo simples)
        const w = word.toLowerCase().replace(/\u2019/g, "'").replace(/&#39;/g, "'");
        if (this.knownWords.has(w)) return 'lf-known';
        // Tenta lookup com a contracao inteira e tambem com a forma base (antes do apostrofo)
        const status = this.savedWords.get(w) || this.savedWords.get(w.split("'")[0]);
        if (status === 'mature')   return 'lf-mature';
        if (status === 'review')   return 'lf-review';
        if (status === 'learning') return 'lf-learning';
        if (status === 'new')      return 'lf-saved';
        return 'lf-new';
    }
    
    _setupSaveButtonObserver() {
        // Observa mudanças no DOM para garantir que o botão só apareça com legenda
        const origDiv = this.shadowContainer?.getElementById('lf-orig');
        if (!origDiv) return;

        const observer = new MutationObserver(() => {
            const saveBtn = this.shadowContainer?.getElementById('lf-save-btn');
            if (!saveBtn) return;

            const hasText = origDiv.textContent && origDiv.textContent.trim().length > 0;
            const isVisible = origDiv.style.display !== 'none';
            
            saveBtn.style.display = (hasText && isVisible) ? 'inline-block' : 'none';
            if (!hasText || !isVisible) saveBtn.textContent = '+ Salvar frase';
        });

        observer.observe(origDiv, {
            childList: true,
            characterData: true,
            subtree: true
        });

        // Também observa mudanças no atributo style
        const styleObserver = new MutationObserver(() => {
            const saveBtn = this.shadowContainer?.getElementById('lf-save-btn');
            if (!saveBtn) return;

            const hasText = origDiv.textContent && origDiv.textContent.trim().length > 0;
            const isVisible = origDiv.style.display !== 'none';
            
            saveBtn.style.display = (hasText && isVisible) ? 'inline-block' : 'none';
        });

        styleObserver.observe(origDiv, {
            attributes: true,
            attributeFilter: ['style']
        });
    }

    toggleSubtitles(forceState = null) {
        const host = document.getElementById('linguaflow-subtitle-host');
        if (!host) return;
        
        let isVisible;
        if (forceState !== null) {
            isVisible = forceState;
        } else {
            // Se for chamado sem argumentos, alterna o estado
            isVisible = localStorage.getItem('lf_sub_visible') === 'true';
        }
        
        host.style.visibility = isVisible ? 'visible' : 'hidden';
        host.style.opacity = isVisible ? '1' : '0';
        host.style.transition = 'opacity 0.2s ease, visibility 0.2s';
        
        // Sincroniza os switches visuais da interface
        const swYt = document.getElementById('lf-yt-switch');
        if (swYt) swYt.classList.toggle('active', isVisible);
        
        const swHbo = document.getElementById('lf-hbo-switch');
        if (swHbo) swHbo.classList.toggle('active', isVisible);

        // Sincronização Automática com o botão de Legendas Ocultas (CC) do YouTube
        if (this.platform === 'youtube') {
            const ytSubBtn = document.querySelector('.ytp-subtitles-button');
            if (ytSubBtn) {
                const isYtSubActive = ytSubBtn.getAttribute('aria-pressed') === 'true';
                if (isVisible !== isYtSubActive) {
                    ytSubBtn.click();
                    console.log(`[LinguaFlow] Legenda nativa do YouTube sincronizada para: ${isVisible ? 'LIGADA' : 'DESLIGADA'}`);
                }
            }
        }
    }

    _fixEncoding(text) {
        if (!text) return text;
        
        try {
            // Remove losangos/diamonds que aparecem no lugar de caracteres especiais
            let fixed = text.replace(/[◆�]/g, '');
            
            // Tenta decodificar UTF-8 mal interpretado (double encoding)
            // Verifica se há sequências de bytes mal interpretadas
            if (fixed.includes('Ã') || fixed.includes('â€')) {
                fixed = fixed
                    // Minúsculas com acentos
                    .replace(/Ã§/g, 'ç')
                    .replace(/Ã£/g, 'ã')
                    .replace(/Ã¡/g, 'á')
                    .replace(/Ã©/g, 'é')
                    .replace(/Ã­/g, 'í')
                    .replace(/Ã³/g, 'ó')
                    .replace(/Ãº/g, 'ú')
                    .replace(/Ã¢/g, 'â')
                    .replace(/Ãª/g, 'ê')
                    .replace(/Ã´/g, 'ô')
                    .replace(/Ã /g, 'à')
                    .replace(/Ã¹/g, 'ù')
                    .replace(/Ã¨/g, 'è')
                    .replace(/Ã¬/g, 'ì')
                    .replace(/Ã²/g, 'ò')
                    // Maiúsculas com acentos
                    .replace(/Ã‡/g, 'Ç')
                    .replace(/Ã/g, 'Ã')
                    .replace(/Ã�/g, 'Á')
                    .replace(/Ã‰/g, 'É')
                    .replace(/Ã�/g, 'Í')
                    .replace(/Ã"/g, 'Ó')
                    .replace(/Ãš/g, 'Ú')
                    .replace(/Ã‚/g, 'Â')
                    .replace(/ÃŠ/g, 'Ê')
                    .replace(/Ã"/g, 'Ô')
                    .replace(/Ã€/g, 'À')
                    // Pontuação
                    .replace(/â€™/g, "'")
                    .replace(/â€œ/g, '"')
                    .replace(/â€�/g, '"')
                    .replace(/â€"/g, '—')
                    .replace(/â€"/g, '–')
                    .replace(/â€¦/g, '…');
            }
            
            // Tenta usar TextDecoder como fallback para casos extremos
            // Se ainda houver caracteres estranhos, tenta decodificar como Latin-1 e re-encodar como UTF-8
            if (/[\x80-\xFF]/.test(fixed) && !/[À-ÿ]/.test(fixed)) {
                try {
                    const bytes = new Uint8Array([...fixed].map(c => c.charCodeAt(0)));
                    const decoder = new TextDecoder('utf-8', { fatal: false });
                    fixed = decoder.decode(bytes);
                } catch (decodeError) {
                    console.warn('[LinguaFlow] TextDecoder fallback falhou:', decodeError);
                }
            }
            
            // Remove qualquer caractere de substituição Unicode (�) que sobrou
            fixed = fixed.replace(/�/g, '');
            
            return fixed;
        } catch (e) {
            console.error('[LinguaFlow] Erro ao corrigir encoding:', e);
            // Fallback: pelo menos remove os losangos e caracteres de substituição
            return text.replace(/[◆�]/g, '');
        }
    }
    _rebuildSubtitleList() {
        const list = document.getElementById('lf-subtitle-list');
        if (!list) return;
        list.innerHTML = '';
        
        this.cues.forEach((cue, idx) => {
            const item = document.createElement('div');
            item.className = 'lf-subtitle-item';
            item.dataset.index = idx;
            item.style.cssText = 'padding:9px 11px;margin-bottom:5px;background:rgba(255,255,255,0.03);border-radius:8px;cursor:pointer;transition:all 0.2s;border-left:3px solid transparent;';
            const time = this._formatTime(cue.start / 1000 || cue.start);
            item.innerHTML = `
                <div style="font-size:10px;color:#64748B;margin-bottom:2px;font-weight:600;">${time}</div>
                <div style="font-size:13px;color:#E2E8F0;line-height:1.4;">${escapeHTML(cue.text)}</div>
                <div class="lf-translation-text" style="font-size:12px;color:#38BDF8;margin-top:3px;min-height:15px;">${cue.translatedText || '<span style="color:#475569;font-style:italic;">traduzindo...</span>'}</div>
                <button class="lf-save-line" style="margin-top:6px;background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.3);color:#C4B5FD;border-radius:6px;padding:3px 7px;font-size:11px;cursor:pointer;">Salvar frase</button>
            `;
            
            if (!cue.translatedText) {
                import('../utils/translator.js').then(({ translator }) => {
                    translator.translate(cue.text, 'auto', this.targetLang).then(res => {
                        cue.translatedText = res.translation;
                        const el = item.querySelector('.lf-translation-text');
                        if (el) el.textContent = res.translation;
                    }).catch(() => {});
                });
            }
            
            item.onmouseenter = () => { item.style.background = 'rgba(255,255,255,0.08)'; item.style.borderLeftColor = '#38BDF8'; };
            item.onmouseleave = () => { if (idx !== this.currentCueIndex) { item.style.background = 'rgba(255,255,255,0.03)'; item.style.borderLeftColor = 'transparent'; } };
            item.onclick = () => { if (this.videoElement) this.videoElement.currentTime = (cue.start / 1000) || cue.start; };
            item.querySelector('.lf-save-line')?.addEventListener('click', ev => { ev.stopPropagation(); this._saveCueAsPhrase(cue, item); });
            list.appendChild(item);
        });
    }

    _formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return (h > 0 ? h + ':' : '') + (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
    }

    destroy() {
        if (this.syncInterval) cancelAnimationFrame(this.syncInterval);
        if (this._loopInterval) clearInterval(this._loopInterval);
        this.domCapture.stop();
        this.shadowContainer?.host?.remove();
        document.getElementById('lf-yt-btn')?.remove();
        document.getElementById('lf-float-btn')?.remove();
        document.getElementById('lf-float-panel-btn')?.remove();
        document.getElementById('lf-nav-controls')?.remove();
        document.getElementById('lf-subtitle-panel')?.remove();
    }
}
