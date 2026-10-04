// content/subtitle-engine.js — Motor de legendas: captura, sincronização, tradução, palavras clicáveis, painel lateral, dock do YouTube e atalhos do player.


import { isTrustedSubtitleBridgeMessage } from './subtitles/bridge-security.js';
import {
  computeDockResponsiveClass,
  applyDockResponsiveClass,
} from './subtitles/dock-layout.js';
import { readShadowPref } from './subtitles/shadow-mode.js';
import {
  DEFAULT_START_MODE,
  loadStoredActivation,
  normalizeStartMode,
  platformHasSwitch,
  resolveInitialActivation,
  saveActivation,
} from './subtitles/activation-state.js';
import {
  calculateWpm,
  detectConnectedSpeech,
  annotateCaptionSegment,
} from '../utils/speech-cadence.js';

export {
  isTrustedSubtitleBridgeMessage,
  computeDockResponsiveClass,
  applyDockResponsiveClass,
  calculateWpm,
  detectConnectedSpeech,
  annotateCaptionSegment,
};

import { DEFAULT_EXPRESSION_MARKS, EXPRESSION_MARK_SETTINGS } from './subtitles/expression-marks.js';


export { EXPRESSION_MARK_SETTINGS };

import { CaptureMethods } from './subtitles/engine/capture.js';
import { CaptionDisplayMethods } from './subtitles/engine/caption-display.js';
import { PlaybackMethods } from './subtitles/engine/playback.js';
import { YouTubeDockMethods } from './subtitles/engine/youtube-dock.js';
import { SidebarPanelMethods } from './subtitles/engine/sidebar-panel.js';
import { TranscriptTabMethods } from './subtitles/engine/transcript-tab.js';
import { WordsTabMethods } from './subtitles/engine/words-tab.js';
import { ExportMethods } from './subtitles/engine/export.js';
import { installEngineMethods } from './subtitles/engine/install-methods.js';

// ─── Engine Principal ─────────────────────────────────────────────────────────
export class SubtitleEngine {
  constructor() {
    this._disposed = false;
    this._lifecycleController = new AbortController();
    this._navigationController = null;
    this._navigationEpoch = 0;
    this._navigationUrl = '';
    this._domSubtitleEpoch = 0;
    this._managedTimeouts = new Set();
    this._managedIntervals = new Set();
    this._managedObservers = new Set();
    this._sidebarTranslationPromise = null;
    this._sidebarTranslationKey = '';
    this.platform = this._detectPlatform();
    this.cues = []; // Cues do YouTube (via XHR)
    this.shadowMode = readShadowPref(globalThis.localStorage); // Modo shadowing (#456)
    this._shadowRaf = null;
    this.xhrCues = []; // Cues do HBO/Netflix (via XHR intercept)
    this.usingXhr = false; // Flag para saber se está usando XHR
    this.currentCueIndex = -1;
    this.shadowContainer = null;
    this.videoElement = null;
    this.syncInterval = null;
    this.lastText = ''; // Última legenda mostrada
    this._ready = false; // Flag para o sync loop V5
    this._lastFoundIdx = -1; // Índice otimizado para busca de legendas
    this._lastAutoPausedEndTime = -1;
    this._wasPausedByHover = false;
    // Desligado por padrão onde há botão LF visível (#418); o estado real é resolvido
    // em _resolveInitialActivation() depois de ler a configuração "startMode".
    this.isActivated = !platformHasSwitch(this.platform);
    this.startMode = DEFAULT_START_MODE;
    this._activationResolved = false;

    // Settings (defaults) — serão sobrescritos pelo SettingsPanel
    this.displayMode = 'native'; // Padrão: Apenas Original
    this.targetLang = 'pt';
    this.sourceLang = 'en';
    this.translationSpeed = 100; // Número de legendas traduzidas em paralelo (10-200)
    this.translationAnticipation = 0; // Baseline Zero
    this.uiTheme = 'light';
    this.autoPause = false;
    this.currentSubtitleTimestamp = 0;
    this.translationDelay = 0;

    this.flashDuration = 4; // segundos do flash de traducao (configuravel)

    // CEFR Auto-Leveling
    this.cefrList = {};
    this.cefrTargetLevel = 'none'; // 'none', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'
    this.cefrAutoSave = false;
    this.cefrColorsEnabled = true;
    // Marcas de expressão por tipo na legenda e no roteiro (Issue #346).
    this.expressionMarks = { ...DEFAULT_EXPRESSION_MARKS };
    this.maxWordsPerVideo = 15;
    this.maxWordsPerDay = 30;


    // Vocabulário em memória — carregado do banco e atualizado em tempo real
    this.savedWords = new Map(); // word -> status ('new'|'learning'|'review'|'mature')
    this.knownWords = new Set();
    this.ignoredWords = new Set(); // #368: sem cor e fora da aba Palavras

    // Carrega palavras salvas do banco na inicialização
    this._loadSavedWords();

    // WordPopup (Pro V5 style)
    this.wordPopup = null;

    // Atualiza quando uma palavra é salva ou conhecida
    window.addEventListener('LF_WORD_SAVED', (e) => {
      const w = e.detail?.word?.toLowerCase();
      if (w) {
        this.savedWords.set(w, 'new');
        if (document.getElementById('lf-words-scroll')) this._rebuildWordsList();
      }
    }, { signal: this._lifecycleController.signal });
    window.addEventListener('LF_WORD_KNOWN', (e) => {
      const w = (typeof e.detail === 'string' ? e.detail : e.detail?.word)?.toLowerCase();
      if (w) {
        this.knownWords.add(w);
        this.savedWords.delete(w);
        if (document.getElementById('lf-words-scroll')) this._rebuildWordsList();
      }
    }, { signal: this._lifecycleController.signal });
    // #368: card marcou/desmarcou "Ignorar" — recolore e refaz a aba Palavras.
    window.addEventListener('LF_WORD_IGNORED', (e) => {
      const w = e.detail?.word?.toLowerCase();
      if (!w) return;
      if (e.detail.ignored) this.ignoredWords.add(w);
      else this.ignoredWords.delete(w);
      this._updateSubtitleColors();
      if (document.getElementById('lf-words-scroll')) this._rebuildWordsList();
    }, { signal: this._lifecycleController.signal });
    window.addEventListener('LF_UPDATE_DELAY', (e) => {
      this.translationDelay = e.detail;
      console.debug(`[LinguaFlow] Delay de tradução atualizado para: ${e.detail}s`);
    }, { signal: this._lifecycleController.signal });
    window.addEventListener('LF_UPDATE_ANTICIPATION', (e) => {
      this.translationAnticipation = e.detail;
      console.debug(`[LinguaFlow] Antecipação de tradução atualizada para: ${e.detail}s`);
    }, { signal: this._lifecycleController.signal });
    window.addEventListener('LF_UPDATE_AUTOPAUSE', (e) => {
      this.autoPause = e.detail;
      console.debug(`[LinguaFlow] Pausa automática ${e.detail ? 'ATIVADA' : 'DESATIVADA'}`);
    }, { signal: this._lifecycleController.signal });
    window.addEventListener('LF_UPDATE_POSITION', (e) => {
      const host = document.getElementById('linguaflow-subtitle-host');
      if (host) {
        host.style.bottom = `${e.detail}px`;
        this._currentBottom = e.detail;
      }
    }, { signal: this._lifecycleController.signal });
    window.addEventListener('LF_UPDATE_HORIZONTAL', (e) => {
      const host = document.getElementById('linguaflow-subtitle-host');
      if (host) {
        host.style.left = `${e.detail}%`;
        host.style.transform = `translateX(-${e.detail}%)`;
        this._currentHorizontal = e.detail;
      }
    }, { signal: this._lifecycleController.signal });

    // Inicia log de imersão

    // Sincronização global de vocabulário
    this._runtimeMessageListener = (request, _sender, sendResponse) => {
      if (request.type === 'REFRESH_VOCAB') {
        console.debug('[LinguaFlow] Sincronizando vocabulário...');
        this._loadSavedWords();
      } else if (request.action === 'LF_TOGGLE_SETTINGS') {
        window.dispatchEvent(new CustomEvent('LF_TOGGLE_SETTINGS'));
        sendResponse?.({ ok: true });
      } else if (request.action === 'openWordPopup' && request.payload?.word) {
        this.wordPopup?.showForWord?.(request.payload.word, request.payload.word, null, null);
      }
    };
    chrome.runtime.onMessage.addListener(this._runtimeMessageListener);

    window.addEventListener('LF_SETTINGS_CHANGED', async () => {
      console.debug('[LinguaFlow] Configurações alteradas. Recarregando...');
      await this._loadSettings();
      if (this._lastOrig) {
        // Força re-renderização para aplicar novas cores de CEFR
        this.renderDual(this._lastOrig, this._lastTrans);
      }
    }, { signal: this._lifecycleController.signal });

    window.addEventListener('lf_theme_changed', (e) => {
      this.uiTheme = e.detail.theme;
      this._applyThemeToPanel();
    }, { signal: this._lifecycleController.signal });
  }

  _setManagedTimeout(fn, delay) {
    const id = setTimeout(() => {
      this._managedTimeouts.delete(id);
      if (!this._disposed) fn();
    }, delay);
    this._managedTimeouts.add(id);
    return id;
  }

  _setManagedInterval(fn, delay) {
    const id = setInterval(() => {
      if (!this._disposed) fn();
    }, delay);
    this._managedIntervals.add(id);
    return id;
  }

  _beginNavigation(url = window.location.href) {
    if (!this._disposed && this._navigationController && this._navigationUrl === url) {
      return this._navigationSnapshot();
    }
    this._navigationController?.abort('navigation-superseded');
    this._navigationController = new AbortController();
    this._navigationUrl = url;
    this._navigationEpoch += 1;
    this._captionsPendingSince = Date.now();
    return this._navigationSnapshot();
  }

  _navigationSnapshot() {
    return {
      epoch: this._navigationEpoch,
      url: this._navigationUrl,
      signal: this._navigationController?.signal,
    };
  }

  _isNavigationCurrent(snapshot) {
    return !this._disposed
      && !!snapshot
      && !snapshot.signal?.aborted
      && snapshot.epoch === this._navigationEpoch
      && snapshot.url === this._navigationUrl;
  }

  _scheduleForNavigation(fn, delay, snapshot = this._navigationSnapshot()) {
    return this._setManagedTimeout(() => {
      if (this._isNavigationCurrent(snapshot)) fn(snapshot);
    }, delay);
  }

  async _loadSavedWords() {
    try {
      const { db } = await import('../utils/db.js');
      const [words, cards, known, ignored] = await Promise.all([
        db.getAllWords(),
        db.getAllCards(),
        db.getAllKnownWords(),
        typeof db.getAllIgnoredWords === 'function' ? db.getAllIgnoredWords().catch(() => []) : [],
      ]);
      this.ignoredWords = new Set((ignored || []).map((w) => String(w.word).toLowerCase()));
      const cardStatus = new Map((cards || []).map(card => [card.word_id, card.status]));

      this.savedWords.clear();
      (words || []).forEach((w) => this.savedWords.set(w.word.toLowerCase(), cardStatus.get(w.id) || 'new'));

      this.knownWords.clear();
      (known || []).forEach((w) => this.knownWords.add(w.word.toLowerCase()));

      console.debug(
        `[LinguaFlow] Vocabulário carregado: ${this.savedWords.size} salvas, ${this.knownWords.size} conhecidas.`,
      );

      // Recolore as legendas se elas já estiverem na tela
      this._updateSubtitleColors();
    } catch (e) {
      console.error('[LinguaFlow] Erro ao carregar vocabulário:', e);
    }
  }

  _detectPlatform() {
    const h = window.location.hostname;
    if (h.includes('youtube.com')) return 'youtube';
    if (h.includes('netflix.com')) return 'netflix';
    if (h.includes('hbomax.com') || h.includes('max.com') || h.includes('hbo.com')) return 'max';
    if (h.includes('disneyplus.com')) return 'disney';
    if (h.includes('primevideo.com') || h.includes('amazon.com')) return 'prime';
    return 'generic';
  }

  _findPlayerContainer() {
    const selectors = [
      '#movie_player',
      '.html5-video-player',
      '.watch-video',
      '.NFPlayer',
      '[data-testid="player-container"]',
      '[data-testid="video-player"]',
      '[class*="PlayerContainer"]',
      '[class*="VideoPlayer"]',
      '.btm-media-clients',
      '.rendererContainer',
      '.webPlayerContainer',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetHeight > 100) {
        const style = window.getComputedStyle(el);
        if (style.position === 'static') el.style.position = 'relative';
        return el;
      }
    }

    const video = document.querySelector('video');
    if (video) {
      let parent = video.parentElement;
      for (let i = 0; i < 8 && parent; i++) {
        const rect = parent.getBoundingClientRect();
        if (rect.width > 400 && rect.height > 300) {
          if (window.getComputedStyle(parent).position === 'static')
            parent.style.position = 'relative';
          return parent;
        }
        parent = parent.parentElement;
      }
    }
    return document.body;
  }

  _onPageHide(event) {
    if (event?.persisted) return;
    this.destroy();
  }

  async init() {
    console.debug(`[LinguaFlow] 🚀 Inicializando Engine... Plataforma: ${this.platform}`);
    const initialNavigation = this._beginNavigation(window.location.href);
    // Sem `once`: com event.persisted a página vai para o cache de voltar/avançar
    // e pode ser restaurada; destruir aqui deixava o LinguaFlow morto até o F5 (#466).
    window.addEventListener('pagehide', (event) => this._onPageHide(event), {
      signal: this._lifecycleController.signal,
    });

    // Carrega configurações salvas do banco (não bloqueante para evitar travamentos do SW)
    console.debug('[LinguaFlow] Carregando configurações em background...');
    this._loadSettings()
      .then(() => {
        console.debug('[LinguaFlow] Configurações aplicadas.');
        if (this.shadowContainer) this._updateSubtitleColors();
      })
      .catch((e) => console.warn('[LinguaFlow] Falha ao carregar settings:', e));

    fetch(chrome.runtime.getURL('utils/cefr-wordlist.json'))
      .then((res) => res.json())
      .then((data) => {
        this.cefrList = data;
        console.debug('[LinguaFlow] Lista CEFR carregada.');
      })
      .catch((e) => console.warn('[LinguaFlow] Falha ao carregar lista CEFR:', e));

    this._lastOrig = '';
    this._domSubtitleEpoch += 1;

    // Detecção de mudança de URL (SPA navigation)
    let lastUrl = location.href;
    this._setManagedInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        this._onUrlChange();
      }
    }, 1000);

    // Keep the official captions visible until our source-language cues exist.
    if (this.platform === 'youtube') {
      let ytRafId = null;
      this.ytObserver = new MutationObserver(() => {
        if (ytRafId) return;
        ytRafId = requestAnimationFrame(() => {
          ytRafId = null;
          this._syncYouTubeNativeCaptions();
        });
      });
      this.ytObserver.observe(document.body, { childList: true, subtree: true });
    }

    document.addEventListener('yt-navigate-finish', () => {
      console.debug('[LinguaFlow] YouTube SPA Navigation detectada');
      this._onUrlChange();
    }, { signal: this._lifecycleController.signal });

    // ── YouTube: método EXATO do V5 (fetch de legendas via storage) ──────
    if (this.platform === 'youtube') {
      this._ytXhrListener = async () => {
        await this._fetchYoutubeSubtitles(this._navigationSnapshot());
      };
      document.addEventListener('youtubeSubtitleXhrEvent', this._ytXhrListener);
      window.postMessage({ type: 'LF_PRELOAD_SUBTITLES' }, window.location.origin);
      this._scheduleForNavigation(() => {
        window.postMessage({ type: 'LF_PRELOAD_SUBTITLES' }, window.location.origin);
      }, 1200, initialNavigation);
      // Tenta carregar imediatamente (caso webRequest já tenha salvo a URL)
      this._scheduleForNavigation((nav) => this._fetchYoutubeSubtitles(nav), 500, initialNavigation);
    }

    // ── Receptor de mensagens postMessage (HBO Max / Max.com / Netflix) ────
    window.addEventListener('message', (e) => {
      if (this._disposed) return;
      const bridgeState = window.__linguaFlowSubtitleBridge;
      if (!isTrustedSubtitleBridgeMessage(e, bridgeState, window.location.href)) return;

      if (e.data.type === 'LF_CAPTION_AVAILABILITY') {
        this._handleCaptionAvailability(e.data);
        return;
      }
      if (e.data.type === 'LF_HBO_SUB' || e.data.type === 'LF_SUBTITLE_HOOK') {
        let url = e.data.url || '';
        let resp = e.data.response || e.data.data;
        if (!resp) return;

        if (resp instanceof ArrayBuffer) resp = new TextDecoder('utf-8').decode(resp);
        else if (typeof resp !== 'string') {
          try { resp = JSON.stringify(resp); } catch { return; }
        }

        console.debug('[LinguaFlow] Legenda detectada pelo player');

        // Se for YouTube (timedtext), usa o processador específico
        if (url.includes('timedtext')) {
          this._processYouTubeRawSubtitles(url, resp, this._navigationSnapshot());
          return;
        }

        const newCues = this._parseVTT(resp);
        if (newCues.length > 0) {
          let hasNewCues = false;
          if (this.xhrCues.length > 0) {
            const unique = new Map();
            this.xhrCues.forEach((c) => unique.set(c.start + '_' + c.end, c));
            newCues.forEach((nc) => {
              const key = nc.start + '_' + nc.end;
              const existing = unique.get(key);
              if (existing) {
                if (!existing.translatedText && nc.translatedText) {
                  existing.translatedText = nc.translatedText;
                  existing._transLang = nc._transLang;
                }
              } else {
                unique.set(key, nc);
                hasNewCues = true;
              }
            });
            this.xhrCues = Array.from(unique.values()).sort((a, b) => a.start - b.start);
          } else {
            this.xhrCues = newCues;
            hasNewCues = true;
          }
          this.cues = this.xhrCues; // Unifica para o Sidebar
          this.usingXhr = true;
          console.debug(
            '[LinguaFlow] Legendas unificadas via postMessage (' +
              this.xhrCues.length +
              ' frases ativas)',
          );

          // Notifica reconstrução do painel lateral de forma debounced
          if (hasNewCues) {
            this._debouncedRebuildPanels();
          }
        }
      }

      // --- NOVO: Handler de Estado do Player (Language Reactor Style) ---
      if (e.data.type === 'LF_PLAYER_STATE') {
        const state = e.data.state; // 1=Playing, 2=Paused, 3=Buffering
        console.debug(`[LinguaFlow] Estado do Player: ${state}`);
        if (state === 3) {
          // Buffer detectado! Podemos mostrar um pequeno indicador se quisermos
        }
      }

      // --- NOVO: Handler de Toggle de Legenda Nativa ---
      if (e.data.type === 'LF_YT_SUB_TOGGLE') {
        console.debug(
          `[LinguaFlow] Usuário ${e.data.active ? 'ativou' : 'desativou'} legendas no menu nativo.`,
        );
        if (!e.data.active) {
          this.renderDual('', ''); // Limpa nossa legenda se o usuário desligou a nativa
        }
        this._onNativeCaptionToggle(e.data);
      }
    }, { signal: this._lifecycleController.signal });

    if (this.platform === 'max') {
      console.debug('[LinguaFlow] HBO Max: aguardando VTT via XHR intercept');
      this._hideHBONativeSubtitles();
      this._autoEnableHBOSubtitles();
    }

    await this._injectSubtitleUI();
    this._injectYouTubeControls();
    this._setupResizeObserver();
    this._waitForVideo();
    this.startCapture();

    // Inicializa WordPopup (Pro V5 style)
    try {
      const { WordPopup } = await import('./word-popup.js');
      this.wordPopup = new WordPopup(this, this.platform);
      await this.wordPopup.init();
    } catch (e) {
      console.error('[LinguaFlow] Erro ao inicializar WordPopup:', e);
    }

    // ── NOVO: Atalhos de Teclado Profissionais (Padrão LR) ───────────────
    this._setupKeyboardShortcuts();
  }

  // ── Limpeza de estado para troca de vídeo ────────────────────────────────
  async _onUrlChange() {
    const previousEpoch = this._navigationEpoch;
    const navigation = this._beginNavigation(window.location.href);
    if (navigation.epoch === previousEpoch) return;
    console.debug('[LinguaFlow] URL alterada, resetando motor de legendas...');
    this._setCaptionNotice('');

    this.cues = [];
    this.xhrCues = [];
    this._ytFullCueVideoId = null;
    this._syncYouTubeNativeCaptions();
    this._currentCue = null;
    this.currentCueIndex = -1;
    this.lastText = '';
    this.usingXhr = false;
    this._lastOrig = '';
    this.isLooping = false;
    // Encerra completamente o loop anterior (cancela timers, RAF, RVFC e timeupdate)
    this._stopLoop();
    this._stopShadowProgress();

    // Limpa intervalos de espera de vídeo anteriores
    if (this._videoWaitInterval) {
      clearInterval(this._videoWaitInterval);
      this._videoWaitInterval = null;
    }
    this._stopSyncLoop();

    // Esconde a interface atual
    this.renderDual('', '');

    // Remove painel de legendas se aberto
    document.getElementById('lf-subtitle-panel')?.remove();

    // Atualiza a UI das legendas preservando o estado de ativação do usuário
    await this._injectSubtitleUI(true);
    if (!this._isNavigationCurrent(navigation)) return;
    clearTimeout(this._hboAutoEnableTimer);
    this._hboAutoEnableTried = false;
    this.toggleSubtitles(this.isActivated);
    this._waitForVideo();

    // Re-inicializa captura específica da plataforma
    if (this.platform === 'youtube') {
      this._injectYouTubeControls();
      window.postMessage({ type: 'LF_PRELOAD_SUBTITLES' }, window.location.origin);
      this._scheduleForNavigation(() => {
        window.postMessage({ type: 'LF_PRELOAD_SUBTITLES' }, window.location.origin);
      }, 1200, navigation);
      this._scheduleForNavigation((nav) => this._fetchYoutubeSubtitles(nav), 1000, navigation);
    }
  }

  // ── Carrega configurações do banco ───────────────────────────────────────
  async _loadSettings() {
    try {
      const { db } = await import('../utils/db.js');
      await db.initPromise;

      // Fase 4.7 da auditoria (§4d.7): o engine NÃO reescreve mais a escolha
      // do usuário no banco. A versão antiga "migrava" 2.0→0 a cada carga —
      // quem escolhia antecipação de 2s no painel tinha a escolha desfeita
      // em silêncio no próximo carregamento.
      const anticipation = await db.getSetting('translationAnticipation');
      if (anticipation !== undefined && anticipation !== null) {
        this.translationAnticipation = parseFloat(anticipation);
      }

      // Carrega delay de tradução
      const delay = await db.getSetting('translationDelay');
      if (delay !== undefined && delay !== null) {
        this.translationDelay = delay;
        console.debug(`[LinguaFlow] Delay carregado: ${delay}s`);
      }

      // Carrega pausa automática
      const autoPause = await db.getSetting('autoPause');
      if (autoPause !== undefined && autoPause !== null) {
        this.autoPause = autoPause;
        console.debug(`[LinguaFlow] Pausa automática carregada: ${autoPause}`);
      }

      // Carrega velocidade de tradução
      const speed = await db.getSetting('translationSpeed');
      if (speed !== undefined && speed !== null) {
        this.translationSpeed = speed;
        console.debug(`[LinguaFlow] Velocidade carregada: ${speed}`);
      }

      // Fase 4.7 (§4d.7): "Apenas Tradução" é uma opção REAL do painel
      // (sel-mode oferece 'translated') — o engine revertia para 'bilingual'
      // em silêncio a cada carga, desfazendo a escolha que a própria UI
      // vendia. A escolha do usuário agora vale.
      const mode = await db.getSetting('subtitleMode');
      if (mode) {
        this.displayMode = mode;
        console.debug(`[LinguaFlow] Modo de exibição carregado: ${mode}`);
      }

      const targetLang = await db.getSetting('targetLang');
      if (targetLang) this.targetLang = targetLang;

      const sourceLang = await db.getSetting('sourceLang');
      if (sourceLang) {
        this.sourceLang = sourceLang;
        window.postMessage({ type: 'LF_SET_SOURCE_LANG', sourceLang: this.sourceLang }, window.location.origin);
      }

      const theme = await db.getSetting('uiTheme');
      if (theme) {
        this.uiTheme = theme;
        this._applyThemeToPanel();
      }

      const startMode = await db.getSetting('startMode');
      this.startMode = normalizeStartMode(startMode);
      await this._resolveInitialActivation();

      const targetLevel = await db.getSetting('cefrTargetLevel');
      if (targetLevel !== undefined && targetLevel !== null) {
        this.cefrTargetLevel = targetLevel;
      }

      for (const [kind, key] of Object.entries(EXPRESSION_MARK_SETTINGS)) {
        const value = await db.getSetting(key);
        if (typeof value === 'boolean') this.expressionMarks[kind] = value;
      }
      this._applyExpressionMarks();

      const cefrColors = await db.getSetting('cefrColorsEnabled');
      if (cefrColors !== undefined && cefrColors !== null) {
        this.cefrColorsEnabled = cefrColors;
      }

      this.cefrColors = {
        A1: await db.getSetting('cefrColorA1'),
        A2: await db.getSetting('cefrColorA2'),
        B1: await db.getSetting('cefrColorB1'),
        B2: await db.getSetting('cefrColorB2'),
        C1: await db.getSetting('cefrColorC1'),
        C2: await db.getSetting('cefrColorC2'),
      };
    } catch (e) {
      console.warn('[LinguaFlow] Erro ao carregar configurações:', e.message);
    }
  }

  _handleCaptionAvailability({ videoId, available } = {}) {
    let currentId = '';
    try { currentId = new URL(window.location.href).searchParams.get('v') || ''; } catch {}
    if (!videoId || videoId !== currentId) return;
    if (available || this.cues?.length) {
      this._setCaptionNotice('');
      return;
    }
    const code = String(this.sourceLang || 'en').split('-')[0];
    let language = code;
    try { language = new Intl.DisplayNames(['pt-BR'], { type: 'language' }).of(code) || code; } catch {}
    this._setCaptionNotice(`Este vídeo não tem legenda em ${language}.`);
    // Confirmado sem legenda: o roteiro para de mostrar o esqueleto de carregando.
    this._captionsPendingSince = 0;
    if (typeof document !== 'undefined' && document.getElementById?.('lf-subtitle-list')) this._rebuildSubtitleList();
  }

  _setCaptionNotice(message) {
    const notice = this.shadowContainer?.getElementById?.('lf-notice');
    if (!notice) return;
    if (this._captionNoticeTimer) {
      clearTimeout(this._captionNoticeTimer);
      this._captionNoticeTimer = null;
    }
    notice.textContent = message;
    notice.hidden = !message;
    // Status, not a permanent banner: announced once, then out of the way.
    if (message) this._captionNoticeTimer = setTimeout(() => this._setCaptionNotice(''), 6000);
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
            z-index: 2147483640;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideDown 0.3s ease-out;
        `;
    notif.setAttribute('role', 'status');
    notif.setAttribute('aria-live', 'polite');
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

  // ── Salvar Frase (Pro V5 Style) ──────────────────────────────────────────
  async _getVideoUrlWithTimestamp() {
    const videoId = new URLSearchParams(window.location.search).get('v');
    const time = Math.floor(this.videoElement?.currentTime || 0);
    if (this.platform === 'youtube' && videoId) {
      return `https://youtu.be/${videoId}?t=${time}`;
    }
    return window.location.href;
  }

  // Aplica o modo de início uma única vez por página. Navegações SPA mantêm o
  // estado atual (this.isActivated), e uma escolha do usuário nunca é sobrescrita.
  async _resolveInitialActivation() {
    if (this._activationResolved) return;
    this._activationResolved = true;
    if (!platformHasSwitch(this.platform)) return;
    const stored = await loadStoredActivation();
    if (this._activationTouched) return;
    const active = resolveInitialActivation({
      platform: this.platform,
      startMode: this.startMode,
      ...stored,
    });
    if (active !== this.isActivated) {
      this.toggleSubtitles(active);
      if (active) this._ensureNativeSubtitlesActive();
    }
    this._maybeShowStartTip();
    this._trackUsage('player_opened');
  }

  // Alternância feita pelo usuário (botão LF ou tecla C): é a única que persiste.
  userToggleSubtitles(forceState = null) {
    this._activationTouched = true;
    this.toggleSubtitles(forceState);
    saveActivation(this.isActivated);
    this._trackUsage(this.isActivated ? 'lf_enabled' : 'lf_disabled');
    this._dismissStartTip?.();
    this._showNotification(this.isActivated ? '👁️ LinguaFlow ligado · Shift + ? mostra os atalhos' : '🙈 LinguaFlow desligado');
  }

  // Telemetria de produto (#426): fire-and-forget, uma vez por evento por página; nunca atrapalha o player.
  _trackUsage(event) {
    if (!platformHasSwitch(this.platform)) return;
    this._usageSent = this._usageSent || new Set();
    const key = `${event}:${this.platform}`;
    if (this._usageSent.has(key)) return;
    this._usageSent.add(key);
    import('../utils/db.js')
      .then(({ db }) => db.logUsageEvent(event, this.platform))
      .catch(() => {});
  }

  // Dica única de primeira vez, ancorada no botão LF enquanto ele está desligado (#421).
  async _maybeShowStartTip() {
    if (this._startTipScheduled || this.isActivated || !platformHasSwitch(this.platform)) return;
    this._startTipScheduled = true;
    const { wasStartTipSeen, markStartTipSeen, showStartTip } = await import('./subtitles/start-tip.js');
    if (await wasStartTipSeen()) return;
    let attempts = 0;
    const iv = this._setManagedInterval(() => {
      attempts++;
      if (this.isActivated || attempts > 20) return clearInterval(iv);
      const maxToggle = document.querySelector('#lf-max-controls [data-action="toggle"]');
      const anchor = document.getElementById('lf-yt-toggle-wrapper') || maxToggle;
      if (!anchor || anchor.getBoundingClientRect().width === 0) return;
      clearInterval(iv);
      const tip = showStartTip(anchor, {
        placement: anchor === maxToggle ? 'left' : 'above',
        onClose: () => markStartTipSeen(),
      });
      this._dismissStartTip = () => {
        tip?.close();
        this._dismissStartTip = null;
      };
    }, 1500);
  }

  toggleSubtitles(forceState = null) {
    const host = document.getElementById('linguaflow-subtitle-host');
    if (!host) return;

    let isVisible;
    if (forceState !== null) {
      isVisible = !!forceState;
    } else {
      // Se chamado sem argumentos (ex: tecla C), alterna o estado atual
      isVisible = !this.isActivated;
    }
    const changed = isVisible !== this.isActivated;

    host.style.visibility = isVisible ? 'visible' : 'hidden';
    host.style.opacity = isVisible ? '1' : '0';
    host.style.transition = 'opacity 0.2s ease, visibility 0.2s';
    this.isActivated = isVisible;
    this._syncYouTubeNativeCaptions();

    // Sincroniza os switches visuais da interface (YouTube)
    const swYt = document.getElementById('lf-yt-switch');
    if (swYt) swYt.classList.toggle('active', isVisible);
    const toggleBtn = document.getElementById('lf-yt-toggle-wrapper');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', String(isVisible));
      toggleBtn.classList.toggle('active', isVisible);
      toggleBtn.title = isVisible ? 'Desativar LinguaFlow (C)' : 'Ativar LinguaFlow (C)';
    }

    // Sincroniza os switches visuais da interface (HBO/Max)
    const maxToggleBtn =
      document.querySelector('#lf-max-controls [data-action="toggle"]') ||
      document.querySelector('#lf-max-controls button[data-action="toggle"]');
    if (maxToggleBtn) {
      maxToggleBtn.setAttribute('aria-pressed', String(isVisible));
      maxToggleBtn.title = isVisible ? 'Ocultar legendas LinguaFlow (C)' : 'Ativar legendas LinguaFlow (C)';
    }
    if (typeof window !== 'undefined' && window.__lfMaxPlayerUI?.syncActiveState) {
      window.__lfMaxPlayerUI.syncActiveState(isVisible);
    }

    // Desligado: some tudo do dock, exceto o botão LF (#418)
    for (const id of ['lf-yt-horizontal-dock', 'lf-max-controls']) {
      document.getElementById(id)?.classList?.toggle('lf-off', !isVisible);
    }
    if (!isVisible) {
      if (document.getElementById('lf-subtitle-panel-wrapper')) this.toggleSubtitlePanel();
      document.getElementById('lf-speed-popover')?.remove?.();
    }

    // Sincroniza com o CC nativo do YouTube. O YouTube memoriza o CC que o
    // LinguaFlow ligou, então desligado também desliga o CC (#438) — exceto se
    // o usuário ligou o CC na mão nesta página e nada mudou agora.
    if (this.platform === 'youtube') {
      const ytSubBtn = document.querySelector('.ytp-subtitles-button');
      if (ytSubBtn) {
        const isYtSubActive = ytSubBtn.getAttribute('aria-pressed') === 'true';
        if (isVisible !== isYtSubActive && (isVisible || changed || !this._userWantsNativeCC)) {
          ytSubBtn.click();
        }
      }
    }

    // HBO/Max: Desabilita o ocultador de legendas nativas se o engine estiver desligado
    if (this.platform === 'max') {
      const s = document.getElementById('lf-native-hide');
      if (s) s.disabled = !isVisible;
      if (isVisible) this._autoEnableHBOSubtitles();
    }
  }

  destroy() {
    if (this._disposed) return;
    this._disposed = true;
    clearTimeout(this._hboAutoEnableTimer);
    if (this._hiddenYouTubeCaptions) {
      this._hiddenYouTubeCaptions.style.display = '';
      this._hiddenYouTubeCaptions = null;
    }
    this._navigationController?.abort('engine-disposed');
    this._lifecycleController.abort('engine-disposed');
    this._managedTimeouts.forEach((id) => clearTimeout(id));
    this._managedIntervals.forEach((id) => clearInterval(id));
    this._managedTimeouts.clear();
    this._managedIntervals.clear();
    this._managedObservers.forEach((observer) => observer.disconnect());
    this._managedObservers.clear();
    if (this.ytObserver) this.ytObserver.disconnect();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this._dockResizeObserver) {
      try { this._dockResizeObserver.disconnect(); } catch {}
      this._dockResizeObserver = null;
    }
    if (this._ytXhrListener) {
      document.removeEventListener('youtubeSubtitleXhrEvent', this._ytXhrListener);
    }
    if (this._runtimeMessageListener) {
      try { chrome.runtime.onMessage.removeListener(this._runtimeMessageListener); } catch {}
    }

    const v = this.videoElement || document.querySelector('video');
    if (this.syncInterval) {
      if (v && v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(this.syncInterval);
      else cancelAnimationFrame(this.syncInterval);
    }
    if (this._syncTimer) {
      if (v && v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(this._syncTimer);
      else cancelAnimationFrame(this._syncTimer);
    }
    this._stopLoop();
    if (this._watchdogInterval) clearInterval(this._watchdogInterval);
    if (this._videoWaitInterval) clearInterval(this._videoWaitInterval);
    this._stopSyncLoop();
    this.domCapture?.stop?.();
    this.wordPopup?.destroy?.();
    this.shadowContainer?.host?.remove();
    document.getElementById('lf-yt-horizontal-dock')?.remove();
    document.getElementById('lf-yt-btn')?.remove();
    document.getElementById('lf-subtitle-panel')?.remove();
    const pop = document.getElementById('lf-speed-popover');
    if (pop) {
      if (typeof pop._lfCleanup === 'function') pop._lfCleanup();
      else pop.remove();
    }
  }
}

installEngineMethods(SubtitleEngine, [CaptureMethods, CaptionDisplayMethods, PlaybackMethods, YouTubeDockMethods, SidebarPanelMethods, TranscriptTabMethods, WordsTabMethods, ExportMethods]);
