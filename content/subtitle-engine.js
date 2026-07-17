import { expressionsDB } from '../utils/expressions-db.js';
import { videoUtils } from '../utils/video-utils.js';

import { escapeHTML } from '../utils/html.js';

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
    this.platform = this._detectPlatform();
    this.cues = []; // Cues do YouTube (via XHR)
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
    this.isActivated = true; // Ativado por padrão — usuário pode desligar nas configs

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
    this.maxWordsPerVideo = 15;
    this.maxWordsPerDay = 30;

    this._sessionStartTime = Date.now();
    this._streakShown = false;
    this._setManagedTimeout(() => this._checkStreakNotification(), 10 * 60 * 1000);

    // Vocabulário em memória — carregado do banco e atualizado em tempo real
    this.savedWords = new Map(); // word -> status ('new'|'learning'|'review'|'mature')
    this.knownWords = new Set();

    // Carrega palavras salvas do banco na inicialização
    this._loadSavedWords();

    // WordPopup (Pro V5 style)
    this.wordPopup = null;

    // Atualiza quando uma palavra é salva ou conhecida
    window.addEventListener('LF_WORD_SAVED', (e) => {
      const w = e.detail?.word?.toLowerCase();
      if (w) this.savedWords.set(w, 'new');
    }, { signal: this._lifecycleController.signal });
    window.addEventListener('LF_WORD_KNOWN', (e) => {
      const w = (typeof e.detail === 'string' ? e.detail : e.detail?.word)?.toLowerCase();
      if (w) {
        this.knownWords.add(w);
        this.savedWords.delete(w);
      }
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
    this._startImmersionLog();

    // Sincronização global de vocabulário
    this._runtimeMessageListener = (request) => {
      if (request.type === 'REFRESH_VOCAB') {
        console.debug('[LinguaFlow] Sincronizando vocabulário...');
        this._loadSavedWords();
      } else if (request.action === 'LF_TOGGLE_SETTINGS') {
        window.dispatchEvent(new CustomEvent('LF_TOGGLE_SETTINGS'));
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

  _applyThemeToPanel() {
    const panel = document.getElementById('lf-subtitle-panel');
    if (panel) {
      if (this.uiTheme === 'dark') {
        panel.classList.add('theme-dark');
        panel.classList.remove('theme-light');
      } else {
        panel.classList.add('theme-light');
        panel.classList.remove('theme-dark');
      }
    }
  }

  _startImmersionLog() {
    this._setManagedInterval(async () => {
      if (this.videoElement && !this.videoElement.paused) {
        try {
          // Prevenção de contagem dupla (Múltiplas abas abertas)
          const { last_lf_immersion } = await chrome.storage.local.get('last_lf_immersion');
          const now = Date.now();
          if (last_lf_immersion && now - last_lf_immersion < 9000) return;

          await chrome.storage.local.set({ last_lf_immersion: now });
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
      words.forEach((w) => this.savedWords.set(w.word.toLowerCase(), w.status || 'new'));

      this.knownWords.clear();
      known.forEach((w) => this.knownWords.add(w.word.toLowerCase()));

      console.debug(
        `[LinguaFlow] Vocabulário carregado: ${this.savedWords.size} salvas, ${this.knownWords.size} conhecidas.`,
      );

      // Recolore as legendas se elas já estiverem na tela
      this._updateSubtitleColors();
    } catch (e) {
      console.error('[LinguaFlow] Erro ao carregar vocabulário:', e);
    }
  }

  _updateSubtitleColors() {
    if (this.shadowContainer) {
      if (this.cefrColors) {
        const inner = this.shadowContainer.querySelector('#lf-wrap');
        if (inner) {
          inner.style.setProperty('--cefr-a1', this.cefrColors.A1 || '#4ade80');
          inner.style.setProperty('--cefr-a2', this.cefrColors.A2 || '#38bdf8');
          inner.style.setProperty('--cefr-b1', this.cefrColors.B1 || '#22d3ee');
          inner.style.setProperty('--cefr-b2', this.cefrColors.B2 || '#fbbf24');
          inner.style.setProperty('--cefr-c1', this.cefrColors.C1 || '#fb923c');
          inner.style.setProperty('--cefr-c2', this.cefrColors.C2 || '#a78bfa');
        }
      }

      const words = this.shadowContainer.querySelectorAll('.lf-word');
      words.forEach((el) => {
        const w = el.dataset.word?.toLowerCase();
        if (!w) return;

        el.classList.remove(
          'lf-new',
          'lf-learning',
          'lf-review',
          'lf-mature',
          'lf-known',
          'lf-saved',
        );
        if (this.knownWords.has(w)) {
          el.classList.add('lf-known');
        } else if (this.savedWords.has(w)) {
          const status = this.savedWords.get(w);
          const classMap = {
            new: 'lf-saved',
            learning: 'lf-learning',
            review: 'lf-review',
            mature: 'lf-mature',
          };
          el.classList.add(classMap[status] || 'lf-saved');
        } else {
          el.classList.add('lf-new');
        }
      });
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

  // ── Busca otimizada de Cue (O(1) no caso comum, O(log N) no pior caso) ──
  _binarySearchCue(list, time) {
    if (!list || list.length === 0) return -1;

    // 1. Otimização de Cache (Caso comum: vídeo rolando pra frente)
    const lastIdx = this._lastFoundIdx || 0;
    if (lastIdx >= 0 && lastIdx < list.length) {
      const current = list[lastIdx];
      if (time >= current.start && time <= current.end) return lastIdx;

      if (lastIdx + 1 < list.length) {
        const next = list[lastIdx + 1];
        if (time >= next.start && time <= next.end) {
          this._lastFoundIdx = lastIdx + 1;
          return lastIdx + 1;
        }
      }
    }

    // 2. Busca Binária de Elite (O(log N)) para saltos (seek)
    let low = 0;
    let high = list.length - 1;
    while (low <= high) {
      let mid = (low + high) >>> 1;
      const c = list[mid];
      if (time >= c.start && time <= c.end) {
        this._lastFoundIdx = mid;
        return mid;
      }
      if (time < c.start) high = mid - 1;
      else low = mid + 1;
    }
    return -1;
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

  async init() {
    console.debug(`[LinguaFlow] 🚀 Inicializando Engine... Plataforma: ${this.platform}`);
    const initialNavigation = this._beginNavigation(window.location.href);
    window.addEventListener('pagehide', () => this.destroy(), {
      once: true,
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

    // Observer para esconder legenda nativa (YouTube altera o DOM frequentemente)
    if (this.platform === 'youtube') {
      this.ytObserver = new MutationObserver(() => {
        const nativeWindow = document.querySelector('.ytp-caption-window-container');
        if (nativeWindow && nativeWindow.style.display !== 'none') {
          nativeWindow.style.display = 'none';
          console.debug('[LinguaFlow] Legenda nativa detectada e ocultada novamente');
        }
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
      // Tenta carregar imediatamente (caso webRequest já tenha salvo a URL)
      this._scheduleForNavigation((nav) => this._fetchYoutubeSubtitles(nav), 500, initialNavigation);
    }

    // ── Receptor de mensagens postMessage (HBO Max / Max.com / Netflix) ────
    window.addEventListener('message', (e) => {
      if (this._disposed) return;
      if (e.source !== window || !e.data?.type) return;

      if (e.data.type === 'LF_HBO_SUB' || e.data.type === 'LF_SUBTITLE_HOOK') {
        let url = e.data.url || '';
        let resp = e.data.response || e.data.data;
        if (!resp) return;

        console.debug(`[LinguaFlow] Captura de Legenda detectada: ${url.substring(0, 50)}...`);

        // Se for YouTube (timedtext), usa o processador específico
        if (url.includes('timedtext')) {
          this._processYouTubeRawSubtitles(url, resp, this._navigationSnapshot());
          return;
        }

        if (resp instanceof ArrayBuffer) resp = new TextDecoder('utf-8').decode(resp);
        else if (typeof resp !== 'string') {
          try {
            resp = JSON.stringify(resp);
          } catch {}
        }

        const newCues = this._parseVTT(resp);
        if (newCues.length > 0) {
          if (this.xhrCues.length > 0) {
            const merged = [...this.xhrCues, ...newCues];
            const unique = new Map();
            merged.forEach((c) => unique.set(c.start + '_' + c.end, c));
            this.xhrCues = Array.from(unique.values()).sort((a, b) => a.start - b.start);
          } else {
            this.xhrCues = newCues;
          }
          this.cues = this.xhrCues; // Unifica para o Sidebar
          this.usingXhr = true;
          console.debug(
            '[LinguaFlow] Legendas unificadas via postMessage (' +
              this.xhrCues.length +
              ' frases ativas)',
          );

          // Notifica reconstrução do painel lateral
          this._rebuildSubtitleList();
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
      this.wordPopup.init();
    } catch (e) {
      console.error('[LinguaFlow] Erro ao inicializar WordPopup:', e);
    }

    // ── NOVO: Atalhos de Teclado Profissionais (Padrão LR) ───────────────
    this._setupKeyboardShortcuts();
  }

  _setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Não dispara se o usuário estiver digitando em um input
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) ||
        document.activeElement.isContentEditable
      )
        return;

      const vid = this.videoElement || document.querySelector('video');
      if (!vid) return;

      const key = e.key.toLowerCase();
      const code = e.code;

      // Bloqueia scroll por espaço/setas se o foco não estiver no vídeo
      if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        // e.preventDefault(); // Opcional: remover se quebrar scroll da página
      }

      switch (code) {
        case 'KeyA': // Anterior
          e.preventDefault();
          this.prevSubtitle();
          this._showNotification('⏮️ Frase Anterior');
          break;
        case 'KeyS': // Repetir atual (Shadowing)
          e.preventDefault();
          this.repeatSubtitle();
          this._showNotification('🔄 Repetindo (Shadowing)');
          break;
        case 'KeyD': // Próxima
          e.preventDefault();
          this.nextSubtitle();
          this._showNotification('⏭️ Próxima Frase');
          break;
        case 'KeyQ': // Toggle Pausa Automática
          e.preventDefault();
          this.autoPause = !this.autoPause;
          this._showAutoPauseIndicator();
          break;
        case 'KeyL': // Painel de Legendas
          e.preventDefault();
          this.toggleSubtitlePanel();
          break;
        case 'KeyO': // Configurações
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('LF_TOGGLE_SETTINGS'));
          break;
        case 'KeyC': { // Toggle Legendas
          e.preventDefault();
          // No YouTube o switch injetado é o dono do estado (localStorage,
          // title e visual). Clicá-lo mantém tecla e botão sincronizados.
          const ytSwitch = document.getElementById('lf-yt-toggle-wrapper');
          if (ytSwitch) ytSwitch.click();
          else this.toggleSubtitles();
          const isVisible = localStorage.getItem('lf_sub_visible') === 'true';
          this._showNotification(isVisible ? '👁️ Legendas Ativadas' : '🙈 Legendas Ocultas');
          break;
        }
        case 'Space': // Play/Pause
          e.preventDefault();
          if (vid.paused) {
            vid.play();
            this._showNotification('▶️ Play');
          } else {
            vid.pause();
            this._showNotification('⏸️ Pause');
          }
          break;
      }
    }, { signal: this._lifecycleController.signal });
    console.debug('[LinguaFlow] ⌨️ Centro de Comando unificado (A, S, D, Q, L, O, C, Espaço).');
  }

  // ── Navegação por Legenda ───────────────────────────────────────────────

  repeatSubtitle() {
    const cue = this._currentCue || (this.cues && this.cues[this.currentCueIndex]);
    if (cue && this.videoElement) {
      this.videoElement.currentTime = cue.start;
      this.videoElement.play();
      console.debug('[LinguaFlow] 🔄 Repetindo legenda:', cue.text);
    }
  }

  prevSubtitle() {
    if (!this.cues || this.cues.length === 0) return;
    const v = this.videoElement;
    if (!v) return;

    // Se estivermos no meio de uma frase, volta pro início dela.
    // Se estivermos no início, volta pra anterior.
    const t = v.currentTime;
    let idx = this._binarySearchCue(this.cues, t);

    if (idx === -1) {
      // Se não há legenda agora, procura a última que terminou antes de agora
      for (let i = this.cues.length - 1; i >= 0; i--) {
        if (this.cues[i].end < t) {
          idx = i;
          break;
        }
      }
    } else {
      // Se o tempo atual já passou de 1s do início da legenda, apenas repete ela
      if (t - this.cues[idx].start > 1) {
        this.repeatSubtitle();
        return;
      }
      idx = Math.max(0, idx - 1);
    }

    if (idx !== -1) {
      v.currentTime = this.cues[idx].start;
      v.play();
    }
  }

  nextSubtitle() {
    if (!this.cues || this.cues.length === 0) return;
    const v = this.videoElement;
    if (!v) return;

    const t = v.currentTime;
    let idx = this._binarySearchCue(this.cues, t);

    if (idx === -1) {
      // Procura a próxima que começa após agora
      for (let i = 0; i < this.cues.length; i++) {
        if (this.cues[i].start > t) {
          idx = i;
          break;
        }
      }
    } else {
      idx = Math.min(this.cues.length - 1, idx + 1);
    }

    if (idx !== -1) {
      v.currentTime = this.cues[idx].start;
      v.play();
    }
  }

  // ── Limpeza de estado para troca de vídeo ────────────────────────────────
  async _onUrlChange() {
    const previousEpoch = this._navigationEpoch;
    const navigation = this._beginNavigation(window.location.href);
    if (navigation.epoch === previousEpoch) return;
    console.debug('[LinguaFlow] URL alterada, resetando motor de legendas...');

    this.cues = [];
    this.xhrCues = [];
    this.currentCueIndex = -1;
    this.lastText = '';
    this.usingXhr = false;
    this._lastOrig = '';
    // Limpa intervalos de espera de vídeo anteriores
    if (this._videoWaitInterval) {
      clearInterval(this._videoWaitInterval);
      this._videoWaitInterval = null;
    }
    this._stopSyncLoop();

    // Limpa intervalos e timers pendentes para evitar vazamento de memória
    if (this._videoWaitInterval) {
      clearInterval(this._videoWaitInterval);
      this._videoWaitInterval = null;
    }

    // Esconde a interface atual
    this.renderDual('', '');

    // Remove painel de legendas se aberto
    document.getElementById('lf-subtitle-panel')?.remove();

    // Inicia sempre DESLIGADO por padrão (conforme pedido do usuário)
    await this._injectSubtitleUI();
    if (!this._isNavigationCurrent(navigation)) return;
    this.toggleSubtitles(false);
    this._waitForVideo();

    // Re-inicializa captura específica da plataforma
    if (this.platform === 'youtube') {
      this._scheduleForNavigation((nav) => this._fetchYoutubeSubtitles(nav), 1000, navigation);
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
    s.textContent =
      '[data-testid="caption_renderer_overlay"],[class*="SubtitleText"],[class*="subtitle-text"],.track-text-container{opacity:0!important;pointer-events:none!important;}';
    console.debug('[LinguaFlow] HBO Max: legenda nativa escondida via CSS (Pro V5)');
  }

  // ── Habilita legenda nativa automaticamente caso esteja desativada ────────
  _autoEnableHBOSubtitles() {
    if (this._hboAutoEnableTried) return;
    this._hboAutoEnableTried = true;

    let attempts = 0;
    const tryEnable = () => {
      attempts++;
      // Se já recebemos legenda via XHR, não precisa fazer nada
      if (this.xhrCues && this.xhrCues.length > 0) return;

      // Procura o botão de legendas nativo da Max
      const ccBtn = document.querySelector(
        '[data-testid="player-ui-controls-subtitle-btn"], [aria-label*="Subtitle"], [aria-label*="Caption"], button[class*="subtitle"]',
      );

      if (ccBtn) {
        // Tenta descobrir se está desligado (frequentemente aria-pressed="false" ou menu mostra "Off")
        const isOff = ccBtn.getAttribute('aria-pressed') === 'false';
        if (isOff || !this.usingXhr) {
          console.debug('[LinguaFlow] Tentando auto-ativar legenda nativa na HBO Max...');
          try {
            ccBtn.click();
            setTimeout(() => {
              // Clica no primeiro item do menu que pareça ser uma legenda (ex: Inglês)
              // A Max tem radio buttons no menu de legendas
              const menus = document.querySelectorAll('[role="menuitemradio"], [role="radio"]');
              for (let m of menus) {
                // Evita clicar em "Off" ou "Desativado"
                if (
                  m.textContent &&
                  !m.textContent.toLowerCase().includes('off') &&
                  !m.textContent.toLowerCase().includes('desligado')
                ) {
                  m.click();
                  break;
                }
              }
              // Fecha o menu clicando de volta no CC ou clicando fora
              ccBtn.click();
            }, 300);
          } catch (e) {}
        }
      } else if (attempts < 10) {
        setTimeout(tryEnable, 2000);
      }
    };
    setTimeout(tryEnable, 5000); // Dá 5s para o player montar
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

      const theme = await db.getSetting('uiTheme');
      if (theme) {
        this.uiTheme = theme;
        this._applyThemeToPanel();
      }

      const targetLevel = await db.getSetting('cefrTargetLevel');
      if (targetLevel !== undefined && targetLevel !== null) {
        this.cefrTargetLevel = targetLevel;
      }

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

  // ── ResizeObserver para ajustar legenda quando player muda ───────────────
  _setupResizeObserver() {
    const checkAndObserve = () => {
      const playerContainer = this._findPlayerContainer();
      const subtitleHost = document.getElementById('linguaflow-subtitle-host');

      if (playerContainer && subtitleHost) {
        if (this.resizeObserver) this.resizeObserver.disconnect();
        this.resizeObserver = new ResizeObserver(() => {
          // Debounce: durante o carregamento da página o player dispara vários
          // resizes intermediários (anúncios, layout shift) e reposicionar a
          // cada um deles fazia a fonte da legenda oscilar de tamanho.
          clearTimeout(this._repositionDebounce);
          this._repositionDebounce = this._setManagedTimeout(() => {
            console.debug('[LinguaFlow] Player redimensionado, ajustando legenda...');
            this._repositionSubtitle();
          }, 150);
        });

        this.resizeObserver.observe(playerContainer);
        console.debug('[LinguaFlow] ResizeObserver ativado para legenda');
      } else {
        // Tenta novamente após 2 segundos
        this._setManagedTimeout(checkAndObserve, 2000);
      }
    };

    checkAndObserve();

    // Listener para fullscreen
    document.addEventListener('fullscreenchange', () => {
      this._setManagedTimeout(() => {
        this._repositionSubtitle();
      }, 100);
    }, { signal: this._lifecycleController.signal });

    // Listener para resize da janela
    window.addEventListener('resize', () => {
      clearTimeout(this._repositionDebounce);
      this._repositionDebounce = this._setManagedTimeout(() => this._repositionSubtitle(), 150);
    }, { signal: this._lifecycleController.signal });
  }

  async _repositionSubtitle() {
    const host = document.getElementById('linguaflow-subtitle-host');
    if (!host) return;

    const player = this._findPlayerContainer() || document.body;
    const playerWidth = player.getBoundingClientRect().width;

    // Cálculo proporcional de fonte (Base: 1280px -> 31px / 18px)
    // Usamos uma escala linear com um "piso" para não ficar minúsculo
    const scaleFactor = Math.max(0.4, Math.min(1.2, playerWidth / 1280));
    const fontSizeOrig = Math.round(31 * scaleFactor);
    const fontSizeTrans = Math.round(18 * scaleFactor);

    host.style.setProperty('--lf-font-size', `${fontSizeOrig}px`);
    host.style.setProperty('--lf-font-size-trans', `${fontSizeTrans}px`);

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
      if (savedHorizontal !== undefined && savedHorizontal !== null)
        horizontalPos = savedHorizontal;
    } catch (e) {}

    if (bottomPos === null) bottomPos = 100; // fallback temporário, será recalculado

    // Salva em memoria para o ResizeObserver nao sobrescrever
    this._currentBottom = bottomPos;
    this._currentHorizontal = horizontalPos;

    // Tenta encontrar o container do player (com retry mais agressivo para HBO/Max)
    let playerContainer = this._findPlayerContainer();

    if (!playerContainer && this.platform !== 'generic') {
      // Tenta até 5x com intervalos crescentes (HBO demora para montar o player)
      for (const delay of [1000, 2000, 3000, 4000, 5000]) {
        await new Promise((resolve) => setTimeout(resolve, delay));
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
                pointer-events: none;
                padding: 0 !important;
            `;
      document.body.appendChild(host);
      console.debug(`[LinguaFlow] HBO: legenda fixed bottom=${effectiveBottom}px`);
    } else if (playerContainer) {
      // YouTube e outros: absoluto dentro do player
      host.style.cssText = `
                position: absolute !important;
                bottom: ${bottomPos}px !important;
                left: ${horizontalPos}% !important;
                transform: translateX(-${horizontalPos}%) !important;
                z-index: 2147483640 !important;
                width: 94% !important;
                max-width: 900px !important;
                text-align: center !important;
                pointer-events: none;
                padding: 0 !important;
                display: flex !important;
                justify-content: center !important;
            `;
      playerContainer.appendChild(host);
      console.debug(
        `[LinguaFlow] Legenda posicionada: ${horizontalPos}% horizontal, ${bottomPos}px vertical`,
      );
    } else {
      // Fallback: posição fixa
      host.style.cssText = `
                position: fixed !important;
                bottom: ${bottomPos}px !important;
                left: ${horizontalPos}% !important;
                transform: translateX(-${horizontalPos}%) !important;
                z-index: 2147483640 !important;
                width: 94% !important;
                max-width: 900px !important;
                text-align: center !important;
                pointer-events: none;
                padding: 0 !important;
                display: flex !important;
                justify-content: center !important;
            `;
      document.body.appendChild(host);
      console.debug(
        `[LinguaFlow] Legenda posicionada (fallback): ${horizontalPos}% horizontal, ${bottomPos}px vertical`,
      );
    }

    // Aplica o estado de ativação atual após a injeção para evitar que o cssText resetado mostre a legenda
    this.toggleSubtitles(this.isActivated);

    this.shadowContainer = host.attachShadow({ mode: 'open' });
    this.shadowContainer.innerHTML = `
            <style>
                :host { all: initial; pointer-events: auto; }
                .lf-wrap {
                    display: inline-flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    pointer-events: auto;
                }
                .lf-orig-row {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
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
                /* Modo Blur Premium (Frosted Glass) */
                .mode-blur .lf-trans {
                    filter: blur(12px) saturate(1.8);
                    opacity: 0.35;
                    cursor: pointer;
                    background: rgba(255, 255, 255, 0.05);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .mode-blur .lf-trans:hover {
                    filter: blur(0px) saturate(1);
                    opacity: 1;
                    background: rgba(10, 15, 30, var(--lf-bg-opacity, 0.78));
                    transform: scale(1.02);
                }
                /* Palavras clicáveis */
                .lf-word {
                    cursor: pointer;
                    display: inline-block;
                    transition: transform 0.12s, color 0.12s;
                    border-radius: 3px;
                    font-family: var(--lf-font-family, 'Inter'), sans-serif;
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
                .lf-cefr-A1 { text-decoration: underline solid var(--cefr-a1, #60a5fa) !important; text-underline-offset: 4px; text-decoration-thickness: 3px; color: inherit !important; }
                .lf-cefr-A2 { text-decoration: underline solid var(--cefr-a2, #4ade80) !important; text-underline-offset: 4px; text-decoration-thickness: 3px; color: inherit !important; }
                .lf-cefr-B1 { text-decoration: underline solid var(--cefr-b1, #facc15) !important; text-underline-offset: 4px; text-decoration-thickness: 3px; color: inherit !important; }
                .lf-cefr-B2 { text-decoration: underline solid var(--cefr-b2, #fb923c) !important; text-underline-offset: 4px; text-decoration-thickness: 3px; color: inherit !important; }
                .lf-cefr-C1 { text-decoration: underline solid var(--cefr-c1, #f87171) !important; text-underline-offset: 4px; text-decoration-thickness: 3px; color: inherit !important; }
                .lf-cefr-C2 { text-decoration: underline solid var(--cefr-c2, #c084fc) !important; text-underline-offset: 4px; text-decoration-thickness: 3px; color: inherit !important; }
                .lf-expression {
                    border-bottom: 2px dotted rgba(56, 189, 248, 0.6);
                    padding-bottom: 1px;
                    border-radius: 4px;
                }
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
                    backdrop-filter: blur(8px);
                    pointer-events: auto;
                    display: inline-block;
                    white-space: nowrap;
                    position: absolute;
                    left: calc(100% + 12px);
                    top: 50%;
                    transform: translateY(-50%);
                }
                .lf-translate-btn:hover {
                    background: rgba(56,189,248,0.3);
                    transform: translateY(-50%) scale(1.05);
                }


                .lf-blur {
                    filter: blur(5px);
                    opacity: 0.8;
                    transition: filter 0.3s ease, opacity 0.3s ease;
                }

                .lf-blur:hover {
                    filter: blur(0px);
                    opacity: 1;
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
            <div class="lf-wrap" id="lf-wrap" data-subtitle-mode="native">
                <div class="lf-orig-row">
                    <div class="lf-orig" id="lf-orig"></div>
                    <button class="lf-translate-btn" id="lf-translate-btn" style="display:none;" title="Traduzir frase">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"></path><path d="m4 14 6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="m22 22-5-10-5 10"></path><path d="M14 18h6"></path></svg>
                    </button>
                </div>
                <div class="lf-trans" id="lf-trans" style="display:none;">
                    <span id="lf-trans-txt"></span>
                </div>
            </div>
        `;

    // Aplica as cores carregadas
    this._updateSubtitleColors();

    // Auto-pause video on hover (Language Reactor feature) e Arrastar Legenda
    const wrap = this.shadowContainer.getElementById('lf-wrap');

    // §4d.5: o estado do drag vive na INSTÂNCIA, não em closures. Os listeners
    // de janela abaixo são presos uma única vez (_dragEventsAttached) e, na
    // versão antiga, fechavam sobre isDragging/startY/host da PRIMEIRA
    // injeção — a segunda injeção (via _waitForVideo) criava um wrap novo cujo
    // mousedown setava um closure novo que o mousemove da janela nunca lia.
    // Resultado: arrastar a legenda nunca funcionava no YouTube/Max.
    this._drag = { active: false, startY: 0, startBottom: 0, wrap };

    wrap.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('lf-word')) return;
      const liveHost = document.getElementById('linguaflow-subtitle-host');
      if (!liveHost) return;
      this._drag.active = true;
      this._drag.startY = e.clientY;
      this._drag.startBottom = parseFloat(window.getComputedStyle(liveHost).bottom) || 0;
      this._drag.wrap = wrap;
      wrap.style.cursor = 'grabbing';
      e.preventDefault();
    });

    // Listeners de janela protegidos contra duplicação
    if (!this._dragEventsAttached) {
      window.addEventListener('mousemove', (e) => {
        if (!this._drag?.active) return;
        const liveHost = document.getElementById('linguaflow-subtitle-host');
        if (!liveHost) return;
        const deltaY = this._drag.startY - e.clientY;
        const newBottom = Math.max(0, this._drag.startBottom + deltaY);
        liveHost.style.bottom = `${newBottom}px`;
        this._currentBottom = newBottom;
      }, { signal: this._lifecycleController.signal });

      window.addEventListener('mouseup', () => {
        if (this._drag?.active) {
          this._drag.active = false;
          if (this._drag.wrap) this._drag.wrap.style.cursor = 'default';
        }
      }, { signal: this._lifecycleController.signal });
      this._dragEventsAttached = true;
    }

    wrap.addEventListener('mouseenter', () => {
      if (!this._drag?.active) wrap.style.cursor = 'grab';
      if (this._pauseCooldown) return; // Ignora se acabou de dar play
      if (this.videoElement && !this.videoElement.paused) {
        this.videoElement.pause();
        this._wasPausedByHover = true;
      }
    });
    wrap.addEventListener('mouseleave', () => {
      wrap.style.cursor = 'default';
      // Se o popup estiver aberto, deixamos o fechamento do popup cuidar do play
      const popupOpen =
        this.wordPopup && this.wordPopup.popup && this.wordPopup.popup.style.display !== 'none';
      if (!popupOpen && this.videoElement && this.videoElement.paused) {
        const hoverPause = this._wasPausedByHover;
        const autoPauseOn = this.autoPause && this._lastAutoPausedEndTime > 0;
        if (hoverPause || autoPauseOn) {
          this.videoElement.play().catch(() => {});
          this._wasPausedByHover = false;
          this._lastAutoPausedEndTime = -1;

          this._pauseCooldown = true;
          setTimeout(() => (this._pauseCooldown = false), 500);
        }
      }
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
          const navigation = this._navigationSnapshot();
          // Traduz agora
          translateBtn.textContent = '⏳';
          translateBtn.disabled = true;
          try {
            const { translator } = await import('../utils/translator.js');
            if (!this._isNavigationCurrent(navigation)) return;
            const result = await translator.translate(cue.text, 'auto', this.targetLang);
            if (!this._isNavigationCurrent(navigation) || this._currentCue !== cue) return;
            cue.translatedText = result.translation;
            this._showTranslationFlash(result.translation);
          } catch {}
          if (this._isNavigationCurrent(navigation) && translateBtn.isConnected) {
            translateBtn.textContent = '🌐 Traduzir';
            translateBtn.disabled = false;
          }
        }
      });
    }

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
      // Inicia sempre com o switch DESLIGADO visualmente
      const isSubVisible = false;
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
      btnSettings.id = 'lf-yt-btn';
      btnSettings.className = 'lf-yt-btn';
      btnSettings.title = 'Configurações LinguaFlow (O)';
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

      // Botão do Painel Lateral (SVG minimalista)
      const btnPanel = document.createElement('button');
      btnPanel.id = 'lf-yt-panel-btn';
      btnPanel.className = 'lf-yt-btn';
      btnPanel.title = 'Painel de Legendas (L)';
      btnPanel.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                </svg>
            `;
      btnPanel.onclick = () => {
        this.toggleSubtitlePanel();
      };

      // Insere no player
      rightCtrl.insertBefore(btnPanel, rightCtrl.firstChild);
      rightCtrl.insertBefore(btnSettings, btnPanel);
      rightCtrl.insertBefore(switchWrapper, btnSettings);

      // Atalhos C/O ficam SÓ em _setupKeyboardShortcuts. O listener duplicado
      // que vivia aqui fazia C ligar+desligar a legenda na mesma tecla e O
      // abrir+fechar as configurações no YouTube (§4d.4 da auditoria).

      // Inicia sempre DESLIGADO (OFF by default)
      this.toggleSubtitles(false);
      return true;
    };

    // Tenta por no máximo 30 segundos (20 tentativas de 1.5s)
    let attempts = 0;
    const iv = this._setManagedInterval(() => {
      attempts++;
      if (tryInject() || attempts > 20) clearInterval(iv);
    }, 1500);
  }

  // Fase 5 da auditoria (§4b.6/§4h.3): stubs vazios removidos
  // (_injectDeckSelector/_injectFloatingButton/_injectNavigationControls/_createNavButton)

  gotoPreviousCue() {
    if (!this.videoElement || this.cues.length === 0) return;

    const currentTime = this.videoElement.currentTime;

    let targetIdx = -1;

    // Se estamos no início de uma frase (primeiros 500ms), volta para a anterior
    if (this.currentCueIndex >= 0) {
      const currentCue = this.cues[this.currentCueIndex];
      if (currentTime - currentCue.start < 0.5 && this.currentCueIndex > 0) {
        targetIdx = this.currentCueIndex - 1;
      } else {
        // Senão, volta para o início da frase atual
        this.videoElement.currentTime = currentCue.start;
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
      this.videoElement.currentTime = this.cues[targetIdx].start;
      console.debug('[LinguaFlow] Voltou para frase anterior');
    }
  }

  gotoNextCue() {
    if (!this.videoElement || this.cues.length === 0) return;

    const currentTime = this.videoElement.currentTime;

    let targetIdx = -1;

    // Procura a próxima frase
    for (let i = 0; i < this.cues.length; i++) {
      if (this.cues[i].start > currentTime) {
        targetIdx = i;
        break;
      }
    }

    if (targetIdx >= 0) {
      this.videoElement.currentTime = this.cues[targetIdx].start;
      console.debug('[LinguaFlow] Pulou para próxima frase');
    }
  }

  toggleLoop() {
    if (!this.videoElement || this.currentCueIndex < 0) return;

    this.isLooping = !this.isLooping;
    const btnLoop = document.getElementById('lf-btn-loop');

    if (this.isLooping) {
      const currentCue = this.cues[this.currentCueIndex];
      this.loopStartTime = currentCue.start;
      this.loopEndTime = currentCue.end;

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

      console.debug(
        `[LinguaFlow] Loop ATIVADO: ${this.loopStartTime.toFixed(2)}s - ${this.loopEndTime.toFixed(2)}s`,
      );
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

      console.debug('[LinguaFlow] Loop DESATIVADO');
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
            z-index: 2147483640;
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
    const wrapper = document.getElementById('lf-subtitle-panel-wrapper');
    if (wrapper) {
      const overlay = wrapper.querySelector('div');
      const panel = wrapper.querySelector('#lf-subtitle-panel');
      if (overlay && panel) {
        overlay.style.opacity = '0';
        panel.style.transform = 'translateX(100%)';
        setTimeout(() => wrapper.remove(), 300);
      } else {
        wrapper.remove();
      }

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
    const existing = document.getElementById('lf-subtitle-panel-wrapper');
    if (existing) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'lf-subtitle-panel-wrapper';
    wrapper.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 2147483640;
            display: flex;
            justify-content: flex-end;
            pointer-events: none;
        `;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.4);
            backdrop-filter: blur(2px);
            pointer-events: auto;
            opacity: 0;
            transition: opacity 0.3s;
        `;

    const panel = document.createElement('div');
    panel.id = 'lf-subtitle-panel';
    panel.className = this.uiTheme === 'dark' ? 'theme-dark' : 'theme-light';
    panel.style.cssText = `
            width: 420px;
            height: 100%;
            display: flex;
            flex-direction: column;
            position: relative;
            z-index: 2;
            pointer-events: auto;
            transform: translateX(100%);
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        `;

    // Injeta estilos de palavras no painel (fora do shadow dom)
    const panelStyle = document.createElement('style');
    panelStyle.textContent = `
            #lf-subtitle-panel .lf-word {
                cursor: pointer;
                display: inline-block;
                transition: color 0.12s;
                border-radius: 3px;
                padding: 0 1px;
            }
            #lf-subtitle-panel .lf-word:hover {
                color: #FBBF24 !important;
                background: rgba(251, 191, 36, 0.1);
            }
            #lf-subtitle-panel .lf-known { color: #86EFAC; }
            #lf-subtitle-panel .lf-mature { color: #34D399; text-decoration: underline dotted; }
            #lf-subtitle-panel .lf-review { color: #38BDF8; text-decoration: underline dashed; }
            #lf-subtitle-panel .lf-learning { color: #FBBF24; text-decoration: underline dashed; }
            #lf-subtitle-panel .lf-saved { color: #93C5FD; text-decoration: underline dashed; }
            #lf-subtitle-panel .lf-expression { border-bottom: 2px dotted rgba(56, 189, 248, 0.6); }
            #lf-subtitle-panel .lf-new { color: #f8fafc; }

            #lf-subtitle-panel .lf-subtitle-item.active {
                background: rgba(28, 176, 246, 0.2) !important;
                border-left-color: #1cb0f6 !important;
                transform: scale(1.02);
                z-index: 10;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
            #lf-subtitle-panel .lf-subtitle-item {
                transition: all 0.1s;
            }
            #lf-subtitle-panel .lf-subtitle-item:not(.active) {
                opacity: 0.8;
            }

            /* --- THEME STYLES --- */
            #lf-subtitle-panel {
                font-family: 'Nunito', sans-serif;
                box-shadow: -2px 0 12px rgba(0,0,0,0.5);
            }
            #lf-subtitle-panel.theme-light {
                background: #ffffff;
                border-left: 1px solid #d1d5db;
                color: #3c3c3c;
            }
            #lf-subtitle-panel.theme-dark {
                background: #0f172a;
                border-left: 1px solid #1e293b;
                color: #f8fafc;
            }
            
            #lf-subtitle-panel.theme-light .lf-panel-header { background: #ffffff; border-bottom: 2px solid #e5e5e5; }
            #lf-subtitle-panel.theme-dark .lf-panel-header { background: #0f172a; border-bottom: 2px solid #1e293b; }
            
            #lf-subtitle-panel.theme-light .lf-panel-title { color: #3c3c3c; }
            #lf-subtitle-panel.theme-dark .lf-panel-title { color: #f8fafc; }
            
            #lf-subtitle-panel.theme-light .lf-close-btn { color: #afafaf; }
            #lf-subtitle-panel.theme-light .lf-close-btn:hover { background: #f7f7f7; color: #777777; }
            #lf-subtitle-panel.theme-dark .lf-close-btn { color: #64748B; }
            #lf-subtitle-panel.theme-dark .lf-close-btn:hover { background: #1e293b; color: #f8fafc; }

            #lf-subtitle-panel.theme-light .lf-tabs { background: #f7f7f7; border-bottom: 2px solid #e5e5e5; }
            #lf-subtitle-panel.theme-dark .lf-tabs { background: #0f172a; border-bottom: 2px solid #1e293b; }
            
            #lf-subtitle-panel.theme-light .lf-toolbar { background: #f7f7f7; border-bottom: 1px solid #e5e5e5; }
            #lf-subtitle-panel.theme-dark .lf-toolbar { background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.08); }
            
            #lf-subtitle-panel.theme-light .lf-search-input { background: #ffffff; border: 1px solid #d1d5db; color: #3c3c3c; }
            #lf-subtitle-panel.theme-dark .lf-search-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #E2E8F0; }

            #lf-subtitle-panel.theme-light .lf-search-input::placeholder { color: #afafaf; }
            
            #lf-subtitle-panel.theme-light .lf-subtitle-list { background: #ffffff; }
            #lf-subtitle-panel.theme-dark .lf-subtitle-list { background: #0f172a; }

            #lf-subtitle-panel.theme-light .lf-subtitle-item { border-bottom: 1px solid #e5e5e5; border-left: 4px solid transparent; }
            #lf-subtitle-panel.theme-dark .lf-subtitle-item { border-bottom: 1px solid #1e293b; border-left: 4px solid transparent; }
            
            #lf-subtitle-panel.theme-light .lf-subtitle-item:hover { background: #f7f7f7; }
            #lf-subtitle-panel.theme-dark .lf-subtitle-item:hover { background: #1e293b; }
            
            #lf-subtitle-panel.theme-light .lf-time { color: #afafaf; }
            #lf-subtitle-panel.theme-dark .lf-time { color: #64748B; }
            
            #lf-subtitle-panel.theme-light .lf-trans-text { color: #1cb0f6; }
            #lf-subtitle-panel.theme-dark .lf-trans-text { color: #38BDF8; }

            #lf-subtitle-panel.theme-light .lf-checkbox-label { color: #777777; }
            #lf-subtitle-panel.theme-dark .lf-checkbox-label { color: #94a3b8; }
        `;
    panel.appendChild(panelStyle);

    wrapper.appendChild(overlay);
    wrapper.appendChild(panel);
    document.body.appendChild(wrapper);

    // Animação de entrada
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      panel.style.transform = 'translateX(0)';
    });

    const closePanel = () => {
      overlay.style.opacity = '0';
      panel.style.transform = 'translateX(100%)';
      setTimeout(() => wrapper.remove(), 300);

      const btnPanel = document.getElementById('lf-btn-panel');
      if (btnPanel) {
        btnPanel.style.background = 'rgba(255,255,255,0.1)';
        btnPanel.style.color = '';
      }
    };

    overlay.onclick = closePanel;

    const header = document.createElement('div');
    header.className = 'lf-panel-header';
    header.style.cssText =
      'padding:20px 24px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';
    header.innerHTML = `
            <div class="lf-panel-title" style="display:flex;align-items:center;gap:10px;font-size:20px;font-weight:800;">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none">
                <defs><linearGradient id="lf-hdr-grad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#58cc02"/><stop offset="100%" stop-color="#58a700"/>
                </linearGradient></defs>
                <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z" fill="url(#lf-hdr-grad)"/>
              </svg>
              <span>LinguaFlow</span>
            </div>
            <button id="lf-close-panel" class="lf-close-btn" style="background:transparent;border:none;width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;transition:0.2s;">✕</button>
        `;

    const closeBtn = header.querySelector('#lf-close-panel');
    closeBtn.onclick = closePanel;

    // ── Abas Subtitles / Words ────────────────────────────────────────────
    const tabs = document.createElement('div');
    tabs.className = 'lf-tabs';
    tabs.style.cssText =
      'display:flex;flex-shrink:0;';
    tabs.innerHTML = `
            <button id="lf-tab-subtitles" style="flex:1;padding:14px;background:transparent;border:none;border-bottom:4px solid #1cb0f6;color:#1cb0f6;font-size:14px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;transition:all 0.1s;text-transform:uppercase;">Subtitles</button>
            <button id="lf-tab-words" class="lf-checkbox-label" style="flex:1;padding:14px;background:transparent;border:none;border-bottom:4px solid transparent;font-size:14px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;transition:all 0.1s;text-transform:uppercase;">Words</button>
        `;

    // ── Painel Subtitles ──────────────────────────────────────────────────
    const subtitlePane = document.createElement('div');
    subtitlePane.id = 'lf-pane-subtitles';
    subtitlePane.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';

    const toolbar = document.createElement('div');
    toolbar.className = 'lf-toolbar';
    toolbar.style.cssText =
      'padding:12px 16px;display:flex;flex-direction:column;gap:10px;flex-shrink:0;';
    toolbar.innerHTML = `
            <div style="display:flex;gap:8px;align-items:center;">
                <div style="position:relative;flex:1;">
                    <input id="lf-panel-search" class="lf-search-input" type="search" placeholder="Buscar no script..." style="width:100%;border-radius:8px;padding:8px 12px 8px 32px;font-size:12px;outline:none;transition:border-color 0.2s;">
                    <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#64748B;font-size:14px;">🔍</span>
                </div>
                <button id="lf-follow-btn" title="Seguir legenda atual" style="background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.3);color:#38BDF8;width:34px;height:34px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:0.2s;">📍</button>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div style="display:flex;gap:12px;">
                    <label class="lf-checkbox-label" style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;">
                        <input type="checkbox" id="lf-show-translation" ${this.displayMode === 'bilingual' ? 'checked' : ''} style="cursor:pointer;accent-color:#38BDF8;">
                        <span>Tradução</span>
                    </label>
                    <label class="lf-checkbox-label" style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;">
                        <input type="checkbox" id="lf-autoscroll-panel" checked style="cursor:pointer;accent-color:#38BDF8;">
                        <span>Auto-scroll</span>
                    </label>
                </div>
                <div style="display:flex;gap:6px;">
                    <button id="lf-export-pdf" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#CBD5E1;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:10px;font-weight:600;text-transform:uppercase;">PDF</button>
                    <button id="lf-export-csv" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#CBD5E1;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:10px;font-weight:600;text-transform:uppercase;">CSV</button>
                    <button id="lf-export-anki" style="background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.3);color:#38BDF8;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:10px;font-weight:600;text-transform:uppercase;">Anki</button>
                </div>
            </div>
        `;

    // Evento de busca
    const searchInput = toolbar.querySelector('#lf-panel-search');
    searchInput.addEventListener('input', (e) => {
      this._filterSubtitleList(e.target.value);
    });

    const list = document.createElement('div');
    list.id = 'lf-subtitle-list';
    list.style.cssText =
      'flex:1;overflow-y:auto;padding:10px;scrollbar-width:thin;scrollbar-color:#334155 transparent;';
    list._userScrolling = false;
    let _scrollTimer = null;
    list.addEventListener(
      'scroll',
      () => {
        list._userScrolling = true;
        clearTimeout(_scrollTimer);
        _scrollTimer = setTimeout(() => {
          list._userScrolling = false;
        }, 3000);
      },
      { passive: true },
    );

    this._rebuildSubtitleList(list);

    subtitlePane.appendChild(toolbar);
    subtitlePane.appendChild(list);

    // ── Painel Words (Frequência estilo Lingosieve) ───────────────────────
    const wordsPane = document.createElement('div');
    wordsPane.id = 'lf-pane-words';
    wordsPane.style.cssText = 'flex:1;display:none;flex-direction:column;overflow:hidden;';

    const wordsScroll = document.createElement('div');
    wordsScroll.style.cssText =
      'flex:1;overflow-y:auto;padding:14px;scrollbar-width:thin;scrollbar-color:#334155 transparent;';

    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'to',
      'of',
      'in',
      'on',
      'at',
      'for',
      'with',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'it',
      'this',
      'that',
      'you',
      'i',
      'we',
      'they',
      'he',
      'she',
      'do',
      'does',
      'did',
      'not',
      'so',
      'as',
      'if',
      'my',
      'your',
      'our',
      'their',
      'his',
      'her',
      'its',
      'by',
      'from',
      'up',
      'about',
      'into',
      'than',
      'then',
      'when',
      'what',
      'which',
      'who',
      'how',
      'all',
      'each',
      'more',
      'also',
      'just',
      'can',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'have',
      'has',
      'had',
      'get',
      'got',
      'go',
      'come',
      'know',
      'think',
      'see',
      'look',
      'want',
      'use',
      'find',
      'give',
      'tell',
      'work',
      'call',
      'try',
      'ask',
      'need',
      'feel',
      'become',
      'leave',
      'put',
      'mean',
      'keep',
      'let',
      'begin',
      'show',
      'hear',
      'play',
      'run',
      'move',
      'live',
      'believe',
      'hold',
      'bring',
      'happen',
      'write',
      'provide',
      'sit',
      'stand',
      'lose',
      'pay',
      'meet',
      'include',
      'continue',
      'set',
      'learn',
      'change',
      'lead',
      'understand',
      'watch',
      'follow',
      'stop',
      'create',
      'speak',
      'read',
      'spend',
      'grow',
      'open',
      'walk',
      'win',
      'offer',
      'remember',
      'love',
      'consider',
      'appear',
      'buy',
      'wait',
      'serve',
      'die',
      'send',
      'expect',
      'build',
      'stay',
      'fall',
      'cut',
      'reach',
      'kill',
      'remain',
      'suggest',
      'raise',
      'pass',
      'sell',
      'require',
      'report',
      'decide',
      'pull',
    ]);
    const freqMap = new Map();
    this.cues.forEach((cue) => {
      (cue.text || '')
        .toLowerCase()
        .match(/[a-z][a-z'-]{1,}/g)
        ?.forEach((w) => {
          const clean = w.replace(/^'+|'+$/g, '');
          if (clean.length > 2 && !stopWords.has(clean))
            freqMap.set(clean, (freqMap.get(clean) || 0) + 1);
        });
    });

    const TOP5K =
      'the,be,to,of,and,a,in,that,have,it,for,not,on,with,he,as,you,do,at,this,but,his,by,from,they,we,say,her,she,or,an,will,my,one,all,would,there,their,what,so,up,out,if,about,who,get,which,go,me,when,make,can,like,time,no,just,him,know,take,people,into,year,your,good,some,could,them,see,other,than,then,now,look,only,come,its,over,think,also,back,after,use,two,how,our,work,first,well,way,even,new,want,because,any,these,give,day,most,us,great,between,need,large,often,hand,high,place,hold,real,life,few,north,open,seem,together,next,white,children,begin,got,walk,example,ease,paper,always,music,those,both,mark,book,letter,until,mile,river,car,feet,care,second,enough,plain,girl,usual,young,ready,above,ever,red,list,though,feel,talk,bird,soon,body,dog,family,direct,pose,leave,song,measure,door,product,black,short,numeral,class,wind,question,happen,complete,ship,area,half,rock,order,fire,south,problem,piece,told,knew,pass,since,top,whole,king,space,heard,best,hour,better,true,during,hundred,five,remember,step,early,hold,west,ground,interest,reach,fast,verb,sing,listen,six,table,travel,less,morning,ten,simple,several,vowel,toward,war,lay,against,pattern,slow,center,love,person,money,serve,appear,road,map,rain,rule,govern,pull,cold,notice,voice,unit,power,town,fine,drive,led,cry,dark,machine,note,wait,plan,figure,star,box,noun,field,rest,correct,able,pound,done,beauty,drive,stood,contain,front,teach,week,final,gave,green,oh,quick,develop,ocean,warm,free,minute,strong,special,mind,behind,clear,tail,produce,fact,street,inch,multiply,nothing,course,stay,wheel,full,force,blue,object,decide,surface,deep,moon,island,foot,system,busy,test,record,boat,common,gold,possible,plane,stead,dry,wonder,laugh,thousand,ago,ran,check,game,shape,equate,hot,miss,brought,heat,snow,tire,bring,yes,distant,fill,east,paint,language,among,grand,ball,yet,wave,drop,heart,am,present,heavy,dance,engine,position,arm,wide,sail,material,size,vary,settle,speak,weight,general,ice,matter,circle,pair,include,divide,syllable,felt,perhaps,pick,sudden,count,square,reason,length,represent,art,subject,region,energy,hunt,probable,bed,brother,egg,ride,cell,believe,fraction,forest,sit,race,window,store,summer,train,sleep,prove,lone,leg,exercise,wall,catch,mount,wish,sky,board,joy,winter,sat,written,wild,instrument,kept,glass,grass,cow,job,edge,sign,visit,past,soft,fun,bright,gas,weather,month,million,bear,finish,happy,hope,flower,clothe,strange,gone,jump,baby,eight,village,meet,root,buy,raise,solve,metal,whether,push,seven,paragraph,third,shall,held,hair,describe,cook,floor,either,result,burn,hill,safe,cat,century,consider,type,law,bit,coast,copy,phrase,silent,tall,sand,soil,roll,temperature,finger,industry,value,fight,lie,beat,excite,natural,view,sense,ear,else,quite,broke,case,middle,kill,son,lake,moment,scale,loud,spring,observe,child,straight,consonant,nation,dictionary,milk,speed,method,organ,pay,age,section,dress,cloud,surprise,quiet,stone,tiny,climb,cool,design,poor,lot,experiment,bottom,key,iron,single,stick,flat,twenty,skin,smile,crease,hole,trade,melody,trip,office,receive,row,mouth,exact,symbol,die,least,trouble,shout,except,wrote,seed,tone,join,suggest,clean,break,lady,yard,rise,bad,blow,oil,blood,touch,grew,cent,mix,team,wire,cost,lost,brown,wear,garden,equal,sent,choose,fell,fit,flow,fair,bank,collect,save,control,decimal,gentle,woman,captain,practice,separate,difficult,doctor,please,protect,noon,whose,locate,ring,character,insect,caught,period,indicate,radio,spoke,atom,human,history,effect,electric,expect,crop,modern,element,hit,student,corner,party,supply,bone,rail,imagine,provide,agree,thus,capital,chair,danger,fruit,rich,thick,soldier,process,operate,guess,necessary,sharp,wing,create,neighbor,wash,bat,rather,crowd,corn,compare,poem,string,bell,depend,meat,rub,tube,famous,dollar,stream,fear,sight,thin,triangle,planet,hurry,chief,colony,clock,mine,tie,enter,major,fresh,search,send,yellow,gun,allow,print,dead,spot,desert,suit,current,lift,rose,continue,block,chart,hat,sell,success,company,subtract,event,particular,deal,swim,term,opposite,wife,shoe,shoulder,spread,arrange,camp,invent,cotton,born,determine,quart,nine,truck,noise,level,chance,gather,shop,stretch,throw,shine,property,column,molecule,select,wrong,gray,repeat,require,broad,prepare,salt,nose,plural,anger,claim,continent,oxygen,sugar,death,pretty,skill,women,season,solution,magnet,silver,thank,branch,match,suffix,especially,fig,afraid,huge,sister,steel,discuss,forward,similar,guide,experience,score,apple,bought,led,pitch,coat,mass,card,band,rope,slip,win,dream,evening,condition,feed,tool,total,basic,smell,valley,nor,double,seat,arrive,master,track,parent,shore,division,sheet,substance,favor,connect,post,spend,chord,fat,glad,original,share,station,dad,bread,charge,proper,bar,offer,segment,slave,duck,instant,market,degree,populate,chick,dear,enemy,reply,drink,occur,support,speech,nature,range,steam,motion,path,liquid,log,meant,quotient,teeth,shell,neck'.split(
        ',',
      );

    const rankMap = new Map();
    TOP5K.forEach((w, i) => rankMap.set(w, i + 1));

    const bands = [];
    for (let s = 1; s <= 5000; s += 100)
      bands.push({ label: s + ' – ' + (s + 99), start: s, end: s + 99, words: [] });
    const outOfTop = { label: 'Fora do top-5k', words: [] };

    freqMap.forEach((count, word) => {
      const rank = rankMap.get(word);
      if (rank) {
        const bi = Math.floor((rank - 1) / 100);
        if (bands[bi]) bands[bi].words.push({ word, count, rank });
      } else outOfTop.words.push({ word, count, rank: 99999 });
    });

    const totalUnique = freqMap.size;
    const inTop5k = [...freqMap.keys()].filter((w) => rankMap.has(w)).length;

    // ── Stats card — renderiza com dados atuais e re-renderiza após reload do DB ──
    const statsDiv = document.createElement('div');
    statsDiv.style.cssText =
      'background:rgba(255,255,255,0.04);border-radius:10px;padding:14px 16px;margin-bottom:14px;';

    // --- CÁLCULO DE EXPRESSÕES ---
    const expressionsFound = new Set();
    this.cues.forEach((cue) => {
      const text = (cue.text || '').toLowerCase();
      expressionsDB.forEach((expr) => {
        if (text.includes(expr)) expressionsFound.add(expr);
      });
    });
    const totalExpressions = expressionsFound.size;

    const renderStats = (knownWords, savedWords) => {
      const videoWords = [...freqMap.keys()];
      const cKnown = videoWords.filter((w) => knownWords.has(w)).length;
      const cLearning = videoWords.filter((w) => savedWords.get(w) === 'learning').length;
      const cReview = videoWords.filter((w) => savedWords.get(w) === 'review').length;
      const cMature = videoWords.filter((w) => savedWords.get(w) === 'mature').length;
      const cSaved = videoWords.filter((w) => savedWords.get(w) === 'new').length;
      const cNew = videoWords.filter((w) => !knownWords.has(w) && !savedWords.has(w)).length;
      const pct = (val) => Math.round((val / totalUnique) * 100) || 0;

      // Comprehension score (ponderado por frequência de tokens)
      let totalTokens = 0,
        understoodTokens = 0;
      freqMap.forEach((freq, w) => {
        totalTokens += freq;
        if (knownWords.has(w) || savedWords.get(w) === 'mature' || savedWords.get(w) === 'review') {
          understoodTokens += freq;
        } else if (savedWords.get(w) === 'learning') {
          understoodTokens += Math.round(freq * 0.5);
        }
      });
      const comprehension =
        totalTokens > 0 ? Math.round((understoodTokens / totalTokens) * 100) : 0;
      const compColor =
        comprehension >= 80 ? '#34D399' : comprehension >= 60 ? '#FBBF24' : '#f87171';
      const compLabel =
        comprehension >= 95
          ? 'Fluente'
          : comprehension >= 80
            ? 'Compreensão alta'
            : comprehension >= 60
              ? 'Intermediário'
              : 'Desafio';

      statsDiv.innerHTML = `
                <div style="background:rgba(0,0,0,0.3);border:1px solid ${compColor}33;border-radius:14px;padding:14px 16px;margin-bottom:14px;text-align:center;">
                  <div style="font-size:36px;font-weight:900;color:${compColor};line-height:1;letter-spacing:-1px;">${comprehension}%</div>
                  <div style="font-size:11px;color:${compColor};font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">${compLabel}</div>
                  <div style="font-size:10px;color:#475569;margin-top:4px;">Score de compreensão deste episódio</div>
                  <div style="background:rgba(255,255,255,0.06);border-radius:6px;height:6px;overflow:hidden;margin-top:8px;">
                    <div style="height:100%;width:${comprehension}%;background:linear-gradient(90deg,${compColor}88,${compColor});border-radius:6px;transition:width 0.8s;"></div>
                  </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
                  <div style="display:flex;align-items:baseline;gap:8px;">
                    <div style="font-size:28px;font-weight:800;color:#F1F5F9;line-height:1;">${totalUnique}</div>
                    <div style="font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;">UNIQUE WORDS</div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:18px;font-weight:800;color:#f472b6;line-height:1;">${totalExpressions}</div>
                    <div style="font-size:9px;color:#f472b6;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;">PHRASAL VERBS</div>
                  </div>
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
        const words = await db.getAllWords();
        const cards = await db.getAllCards();
        const cardStatus = {};
        if (cards)
          cards.forEach((c) => {
            cardStatus[c.word_id] = c.status;
          });
        const freshSaved = new Map();
        const freshKnown = new Set(this.knownWords); // mantém os marcados em sessão
        words.forEach((w) => {
          // §4d.3: palavra salva SEM card não pode sumir do mapa — antes, o
          // `if (status)` descartava e `this.savedWords = freshSaved` apagava
          // a palavra da legenda ao vivo (voltava a cor de "nunca vista").
          freshSaved.set(w.word.toLowerCase(), cardStatus[w.id] || 'new');
        });
        // Atualiza o mapa em memória também
        this.savedWords = freshSaved;
        renderStats(freshKnown, freshSaved);
        // Repinta a legenda com os status reais dos cards (learning/review/
        // mature), que são mais precisos que o 'new' genérico do boot.
        this._updateSubtitleColors();
      } catch (e) {
        console.warn('[LinguaFlow] Stats: erro ao recarregar do DB', e.message);
      }
    });

    const allBands = [
      ...bands.filter((b) => b.words.length > 0),
      ...(outOfTop.words.length > 0 ? [outOfTop] : []),
    ];

    if (allBands.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align:center;color:#475569;font-size:13px;padding:40px 20px;';
      empty.textContent = 'Nenhuma legenda carregada ainda. Inicie o vídeo para ver as palavras.';
      wordsScroll.appendChild(empty);
    }

    allBands.forEach((band) => {
      band.words.sort((a, b) => (a.rank || 99999) - (b.rank || 99999));
      const section = document.createElement('div');
      section.style.cssText = 'margin-bottom:10px;';

      const isTop1k = band.start && band.start <= 1000;
      const hColor = isTop1k
        ? '#FFD700'
        : band.start <= 2000
          ? '#FF8C00'
          : band.start <= 3000
            ? '#38BDF8'
            : '#94A3B8';
      const bandHeader = document.createElement('div');
      bandHeader.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:rgba(255,255,255,0.05);border-radius:7px;cursor:pointer;margin-bottom:6px;border-left:3px solid ' +
        hColor +
        ';';
      bandHeader.innerHTML =
        '<span style="font-size:12px;font-weight:700;color:' +
        hColor +
        '">' +
        band.label +
        '</span><span style="font-size:11px;color:#64748B;">' +
        band.words.length +
        ' palavras <span class="lf-band-arrow" style="margin-left:4px;">▼</span></span>';

      const wordGrid = document.createElement('div');
      wordGrid.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;padding:4px 2px 8px;';

      band.words.forEach(({ word, count }) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        const isKnown = this.knownWords.has(word);
        const status = this.savedWords.get(word);
        let cc = '#94A3B8',
          cb = 'rgba(255,255,255,0.05)',
          cbo = 'rgba(255,255,255,0.1)';
        if (isKnown) {
          cc = '#86EFAC';
          cb = 'rgba(134,239,172,0.1)';
          cbo = 'rgba(134,239,172,0.25)';
        } else if (status === 'mature') {
          cc = '#34D399';
          cb = 'rgba(52,211,153,0.1)';
          cbo = 'rgba(52,211,153,0.25)';
        } else if (status === 'learning') {
          cc = '#FBBF24';
          cb = 'rgba(251,191,36,0.1)';
          cbo = 'rgba(251,191,36,0.25)';
        } else if (status === 'new') {
          cc = '#93C5FD';
          cb = 'rgba(147,197,253,0.1)';
          cbo = 'rgba(147,197,253,0.25)';
        }
        chip.style.cssText =
          'background:' +
          cb +
          ';border:1px solid ' +
          cbo +
          ';color:' +
          cc +
          ';border-radius:999px;padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;transition:all 0.15s;';
        chip.textContent = count > 1 ? word + ' ×' + count : word;
        chip.title = 'Ir para "' + word + '"';
        chip.addEventListener('mouseenter', () => {
          chip.style.transform = 'scale(1.08)';
        });
        chip.addEventListener('mouseleave', () => {
          chip.style.transform = '';
        });
        chip.addEventListener('click', () => {
          const fi = this.cues.findIndex((cue) =>
            new RegExp('\\b' + word + '\\b', 'i').test(cue.text || ''),
          );
          if (fi >= 0 && this.videoElement) {
            this.videoElement.currentTime = this.cues[fi].start;
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

    // ── Eventos do Painel (Fiação Final) ──────────────────────────────────
    document.getElementById('lf-close-panel').onclick = closePanel;

    document.getElementById('lf-show-translation').onchange = (e) => {
      this._rebuildSubtitleList(list, document.getElementById('lf-panel-search').value);
    };

    document.getElementById('lf-export-pdf').onclick = () => this._exportPDF();
    document.getElementById('lf-export-csv').onclick = () => this._exportCSV();
    document.getElementById('lf-export-anki').onclick = () => this._exportAnki();

    document.getElementById('lf-follow-btn').onclick = () => {
      list._userScrolling = false;
      this._updateSubtitlePanelHighlight();
    };

    const btnPanel = document.getElementById('lf-btn-panel');
    if (btnPanel) {
      btnPanel.style.background = 'rgba(56,189,248,0.3)';
      btnPanel.style.color = '#38BDF8';
    }

    // Highlight Inicial e Loop de Sincronia
    this._updateSubtitlePanelHighlight();
    const panelSync = setInterval(() => {
      if (!document.getElementById('lf-subtitle-panel')) {
        clearInterval(panelSync);
        return;
      }
      this._updateSubtitlePanelHighlight();
    }, 500);
  }

  // Fase 5 (§4d.10): _renderVideoWordPrep removida — 80 linhas cujo container
  // #lf-video-words nunca existiu em lugar nenhum do DOM.

  // Removido _formatTime duplicado e assíncrono (usando a versão síncrona no fim do arquivo)

  // ── VTT Parser (HBO Max) — V5 version ────────────────────────────────────
  _parseVTT(vttStr) {
    const cues = [];
    const blocks = vttStr.split(/\n\s*\n/);
    blocks.forEach((b) => {
      const lines = b.trim().split('\n');
      let timeLine = lines.find((l) => l.includes('-->'));
      if (!timeLine) return;
      const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim());
      const parseTime = (t) => {
        const timePart = t.split(/\s+/)[0].replace(',', '.');
        const p = timePart.split(':');
        let sec = parseFloat(p.pop() || 0);
        if (p.length) sec += parseInt(p.pop() || 0) * 60;
        if (p.length) sec += parseInt(p.pop() || 0) * 3600;
        return sec;
      };
      const text = lines
        .slice(lines.indexOf(timeLine) + 1)
        .map((l) => l.replace(/<[^>]+>/g, '').trim())
        .join(' ')
        .trim();
      if (text) cues.push({ start: parseTime(startStr), end: parseTime(endStr), text });
    });
    return cues;
  }

  async _fetchYoutubeSubtitles(navigation = this._navigationSnapshot()) {
    if (!this._isNavigationCurrent(navigation)) return;
    if (this.cues.length > 0) return;

    try {
      const { lastYoutubeSubtitleUrls } = await chrome.storage.local.get('lastYoutubeSubtitleUrls');
      if (!this._isNavigationCurrent(navigation)) return;
      const urls = lastYoutubeSubtitleUrls ?? [];

      const videoId = new URL(navigation.url).searchParams.get('v');
      if (!videoId) return;

      // Filtra URLs que pertencem ao vídeo atual
      let matchingUrls = urls
        .filter((r) => {
          try {
            return new URL(r).searchParams.get('v') === videoId;
          } catch {
            return false;
          }
        })
        .reverse();

      if (matchingUrls.length === 0) {
        console.debug('[LinguaFlow] Nenhuma URL de legenda encontrada para o vídeo', videoId);
        return;
      }

      // Prioriza URLs no idioma original do vídeo (sourceLang) para evitar pegar
      // traduções automáticas (ex: legenda PT quando o vídeo é em inglês)
      const srcLang = this.sourceLang || 'en';
      const preferredUrls = matchingUrls.filter((r) => {
        try {
          const u = new URL(r);
          const lang = u.searchParams.get('lang') || u.searchParams.get('tlang') || '';
          // Aceita se não tiver tlang (é original) OU se o lang bater com sourceLang
          return !u.searchParams.has('tlang') && (lang === '' || lang.startsWith(srcLang));
        } catch {
          return false;
        }
      });

      // Usa as preferidas ou cai de volta para qualquer URL do vídeo
      const urlsToTry = preferredUrls.length > 0 ? preferredUrls : matchingUrls;
      console.debug(`[LinguaFlow] Legendas: ${urlsToTry.length} candidatas (lang=${srcLang})`);

      for (const url of urlsToTry) {
        if (!this._isNavigationCurrent(navigation)) return;
        console.debug('[LinguaFlow] Tentando carregar legendas de:', url);
        const response = await fetch(new URL(url).toString(), { signal: navigation.signal });
        if (!this._isNavigationCurrent(navigation)) return;
        if (!response.ok) continue;

        const text = await response.text();
        if (!this._isNavigationCurrent(navigation)) return;
        let data = null;

        if (text.startsWith('{')) {
          try {
            data = JSON.parse(text);
          } catch {}
        }

        if (data && data.events) {
          const cues = this._processYtSub(data);
          if (cues && cues.length > 0) {
            if (!this._isNavigationCurrent(navigation)) return;
            this.cues = cues;
            this.xhrCues = cues;
            this.usingXhr = true;
            console.debug(
              '[LinguaFlow] Legendas carregadas com sucesso (' + cues.length + ' frases)',
            );
            return;
          }
        }
      }
    } catch (e) {
      if (e?.name === 'AbortError' || !this._isNavigationCurrent(navigation)) return;
      console.error('[LinguaFlow] Erro ao recuperar legendas:', e);
    }
  }

  // ── processYtSub — cópia EXATA do V5 ──────────────────────────────────────
  _processYtSub(data) {
    const l = {
      _a: 4,
      _b: 14,
      _c: 1e3,
      _d: 600,
      _e: 5,
      _f: 400,
      _g: 7,
      _h: 3,
      _i: 5,
      _j: 6,
      _k: 4,
    };

    function decodeHtml(s) {
      if (!s) return s;
      const o = document.createElement('textarea');
      o.innerHTML = s;
      let r = o.value,
        e = '',
        a = 5;
      while (r !== e && a > 0) {
        e = r;
        o.innerHTML = r;
        r = o.value;
        a--;
      }
      return r;
    }

    function round(s, o) {
      if (!(isNaN(s) || typeof o !== 'number' || o < 0)) return Number(s.toFixed(o));
    }

    const D = {
      en: new Set([
        'but',
        'so',
        'and',
        'because',
        'when',
        'while',
        'if',
        'then',
        'however',
        'although',
        'also',
        'or',
        'yet',
        'since',
        'after',
        'before',
        'until',
        'unless',
        'where',
        'which',
        'who',
        'that',
        'though',
        'whether',
        'once',
        'now',
        'still',
        'even',
        'just',
        'already',
        'never',
        'always',
        'sometimes',
        'meanwhile',
        'furthermore',
        'moreover',
        'therefore',
        'otherwise',
        'instead',
        'anyway',
        'besides',
        'finally',
        'actually',
        'basically',
        'honestly',
        'apparently',
        'obviously',
        'clearly',
        'unfortunately',
        'seriously',
      ]),
      es: new Set([
        'pero',
        'porque',
        'cuando',
        'mientras',
        'aunque',
        'entonces',
        'también',
        'donde',
        'como',
        'si',
        'después',
        'antes',
        'hasta',
        'sin',
        'además',
        'ya',
        'ahora',
        'nunca',
        'siempre',
        'todavía',
        'incluso',
        'solo',
        'primero',
        'luego',
        'finalmente',
        'básicamente',
        'obviamente',
        'desafortunadamente',
        'realmente',
        'actualmente',
        'simplemente',
      ]),
      de: new Set([
        'aber',
        'weil',
        'wenn',
        'während',
        'obwohl',
        'dann',
        'also',
        'auch',
        'oder',
        'denn',
        'damit',
        'nachdem',
        'bevor',
        'bis',
        'seit',
        'wo',
        'dass',
        'noch',
        'schon',
        'nie',
        'immer',
        'jetzt',
        'trotzdem',
        'außerdem',
        'deshalb',
        'allerdings',
        'eigentlich',
        'grundsätzlich',
        'natürlich',
        'tatsächlich',
        'normalerweise',
        'übrigens',
      ]),
      fr: new Set([
        'mais',
        'parce',
        'quand',
        'pendant',
        'bien',
        'alors',
        'aussi',
        'donc',
        'car',
        'après',
        'avant',
        'depuis',
        'si',
        'où',
        'comme',
        'puis',
        'encore',
        'déjà',
        'jamais',
        'toujours',
        'maintenant',
        'même',
        'cependant',
        'pourtant',
        'néanmoins',
        'ensuite',
        'finalement',
        'évidemment',
        'malheureusement',
        'franchement',
        'simplement',
        'vraiment',
        'apparemment',
        'normalement',
        'heureusement',
      ]),
    };

    function detectLang(words) {
      const o = words
        .slice(0, 50)
        .map((a) => a.toLowerCase().replace(/[^a-záàâäãéèêëíìîïóòôöõúùûüñçß]/g, ''));
      const r = {};
      for (const [a, g] of Object.entries(D)) r[a] = o.filter((m) => g.has(m)).length;
      const e = Object.entries(r).sort((a, g) => g[1] - a[1])[0];
      return e && e[1] >= 2 ? e[0] : null;
    }

    function processEvents(s) {
      if (!s?.events?.length) return [];
      const CJK =
        /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/;
      const maxSample = 100;
      let e = 0,
        a = 0;
      for (const n of s.events) {
        if (e >= maxSample) break;
        if (n.segs)
          for (const b of n.segs) {
            if (e >= maxSample) break;
            const d = (b.utf8 || '').trim();
            e++;
            const x = d.includes(' '),
              y = CJK.test(d) && d.length > 2;
            if (x || y) a++;
          }
      }
      const isCJK = e > 0 && a / e > 0.5;
      const m = [];

      if (isCJK) {
        s.events.forEach((n) => {
          if (!n.segs) return;
          const b = n.segs
            .map((y) => y.utf8 || '')
            .join('')
            .replace(/\n/g, ' ')
            .trim();
          if (!b) return;
          const d = n.tStartMs ?? 0,
            x = n.dDurationMs ?? 0;
          m.push({ text: b, start: d / 1000, end: (d + x) / 1000 });
        });
      } else {
        // Estratégia de Precisão: Captura eventos e respeita os tempos de cada segmento (word-level timing)
        s.events.forEach((evt) => {
          if (!evt.segs || evt.segs.length === 0) return;

          const startMs = evt.tStartMs ?? 0;
          const durationMs = evt.dDurationMs ?? 0;

          // Se houver múltiplos segmentos, tentamos capturar a frase inteira com seu tempo real
          let text = '';
          evt.segs.forEach((seg) => {
            text += seg.utf8 || '';
          });

          text = text.replace(/\n/g, ' ').trim();
          if (!text) return;

          // Higienização de texto (remove marcadores de música/ruído [Music], [Laughter])
          const cleanText = text.replace(/\[.*?\]/g, '').trim();
          if (!cleanText) return;

          m.push({
            text: cleanText,
            start: startMs / 1000,
            end: (startMs + durationMs) / 1000,
          });
        });

        // Ordenação e remoção de sobreposições
        m.sort((a, b) => a.start - b.start);
      }
      return m;
    }

    const raw = processEvents(data);
    console.debug('[LinguaFlow] Raw cues from processEvents:', raw.length);
    for (let e = 0; e < raw.length - 1; e++) {
      if (raw[e].end > raw[e + 1].start) raw[e].end = raw[e + 1].start;
    }
    const result = raw
      .map((e) => {
        const a = round(e.start, 2),
          g = round(e.end - e.start, 2),
          m = round(e.end, 2);
        if (a == null || g == null || m == null) return null;
        return {
          startTime: a,
          duration: g,
          finishTime: m,
          id: `subtitle_${a}_${m}`,
          sentence: this._cleanSubtitleText(e.text),
          start: a,
          end: m,
          text: this._cleanSubtitleText(e.text),
        };
      })
      .filter((e) => e != null);
    console.debug('[LinguaFlow] Final cues:', result.length);
    return result;
  }

  // ── Aguarda elemento <video> ─────────────────────────────────────────────
  _waitForVideo() {
    // Cancela busca anterior se houver
    if (this._videoWaitInterval) clearInterval(this._videoWaitInterval);

    this._videoWaitInterval = setInterval(() => {
      const vid = document.querySelector('video');
      if (!vid) return;

      this.videoElement = vid;
      clearInterval(this._videoWaitInterval);
      this._videoWaitInterval = null;

      if (this.platform === 'youtube' || this.platform === 'max') {
        // INJEÇÃO CRÍTICA: Cria o DOM das legendas antes de iniciar o loop
        this._injectSubtitleUI()
          .then(() => {
            console.debug('[LinguaFlow] ✅ UI das legendas injetada com sucesso.');
            this._startSyncLoop();
          })
          .catch((e) => {
            console.error('[LinguaFlow] ❌ Erro ao injetar UI das legendas:', e);
          });
      }

      // Injeta botões e controles
      this._injectYouTubeControls();
      vid.addEventListener('play', () => {
        this._injectYouTubeControls();
        this._wasPausedByHover = false;
      });
      vid.addEventListener('seeking', () => {
        this.lastText = '';
        this._lastFoundIdx = -1; // Reset do índice otimizado
        this._lastAutoPausedEndTime = -1;
      });

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
              const horiz = this._currentHorizontal ?? 50;
              host.style.cssText = `
                                position: absolute !important;
                                bottom: ${bottom}px !important;
                                left: ${horiz}% !important;
                                transform: translateX(-${horiz}%) !important;
                                z-index: 2147483640 !important;
                                width: 80% !important;
                                max-width: 900px !important;
                                text-align: center !important;
                                pointer-events: none;
                                padding: 0 !important;
                            `;
              player.appendChild(host);
              console.debug('[LinguaFlow] Legenda reposicionada dentro do player');
            }
          }, 1500);
        }
      }
    }, 800);
  }

  // ── Captura ──────────────────────────────────────────────────────────────
  startCapture() {
    if (this.platform === 'youtube') {
      // A injeção do hook agora é feita pelo injector.js
      this._fetchYoutubeSubtitles(); // Tenta carregar do cache imediatamente
    }
    // V5: Inicia o sync loop para todas as plataformas (exceto YouTube/Max que usam o novo motor)
    if (this.platform !== 'youtube' && this.platform !== 'max') {
      this._ready = true;
      this._syncLoop = (now, metadata) => {
        const v = this.videoElement || document.querySelector('video');
        const t =
          (metadata ? metadata.mediaTime : v ? v.currentTime : 0) +
          (this.translationAnticipation || 0);
        // Loop legado unificado com o motor de elite
        const cuesToSearch = this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues;
        const idx = this._binarySearchCue(cuesToSearch, t);
        const cue = idx !== -1 ? cuesToSearch[idx] : null;

        if (cue && cue.text !== this.lastText) {
          this.lastText = cue.text;
          this.onSubtitle(cue);
        } else if (!cue && this.lastText !== '') {
          this.lastText = '';
          this.renderDual('', '');
        }

        if (this._ready) {
          if (v && v.requestVideoFrameCallback) {
            this._syncTimer = v.requestVideoFrameCallback(this._syncLoop);
          } else {
            this._syncTimer = requestAnimationFrame(this._syncLoop);
          }
        }
      };

      const v = this.videoElement || document.querySelector('video');
      if (v && v.requestVideoFrameCallback) {
        this._syncTimer = v.requestVideoFrameCallback(this._syncLoop);
      } else {
        this._syncTimer = requestAnimationFrame(this._syncLoop);
      }
      console.debug('[LinguaFlow] Sync loop legado iniciado com precisão de frame');
    } else {
      console.debug('[LinguaFlow] Utilizando novo motor de sincronização');
    }
  }

  // A injeção do youtube-hook.js agora é feita pelo injector.js em document_start

  _processYouTubeRawSubtitles(url, raw, navigation = this._navigationSnapshot()) {
    if (!this._isNavigationCurrent(navigation)) return;
    try {
      const cueVideoId = new URL(url).searchParams.get('v');
      const currentVideoId = new URL(navigation.url).searchParams.get('v');
      if (cueVideoId && currentVideoId && cueVideoId !== currentVideoId) return;
    } catch { return; }
    if (!raw || raw.length < 10) return;
    let cues = [];

    if (raw.startsWith('{')) {
      try {
        cues = this._processYtSub(JSON.parse(raw));
      } catch (e) {}
    } else if (raw.includes('WEBVTT')) {
      cues = this._parseVTT(raw);
    } else if (raw.includes('-->')) {
      cues = this._parseVTT(raw); // VTT/SRT unificado
    }

    if (cues.length > 0 && this._isNavigationCurrent(navigation)) {
      this.cues = cues;
      this.xhrCues = cues; // Unifica para garantir que o sync loop e sidebar vejam o mesmo
      this._rebuildSubtitleList(); // Atualiza painel lateral IMEDIATAMENTE
      // this.toggleSubtitles(); // Removido: Não forçar ativação automática

      // Persistência para F5
      chrome.storage.local.get('lastYoutubeSubtitleUrls', (res) => {
        let urls = res.lastYoutubeSubtitleUrls || [];
        if (!urls.includes(url)) {
          urls.push(url);
          if (urls.length > 10) urls.shift();
          chrome.storage.local.set({ lastYoutubeSubtitleUrls: urls });
        }
      });

      // Esconde legenda nativa do YouTube
      const ytWrap = document.querySelector('.ytp-caption-window-container');
      if (ytWrap) {
        ytWrap.style.display = 'none';
        console.debug('[LinguaFlow] Legenda nativa do YouTube escondida');
      }
    }
  }

  // ── Atualização via DOM (Netflix/etc) ─────────────────────────────────────
  async _onDomSubtitleUpdate(text, timeMs) {
    const navigation = this._navigationSnapshot();
    const subtitleEpoch = ++this._domSubtitleEpoch;
    if (!this._isNavigationCurrent(navigation)) return;
    if (!text) {
      this.renderDual('', '');
      return;
    }

    const cue = { start: timeMs, end: timeMs + 8000, text };
    this.cues.push(cue);

    // Mostra original imediatamente
    this.renderDual(text, '');

    // Traduz INSTANTANEAMENTE com detecção automática de idioma
    try {
      const { translator } = await import('../utils/translator.js');
      if (!this._isNavigationCurrent(navigation) || subtitleEpoch !== this._domSubtitleEpoch) return;
      const result = await translator.translate(text, 'auto', this.targetLang);
      if (!this._isNavigationCurrent(navigation)
        || subtitleEpoch !== this._domSubtitleEpoch
        || !this.cues.includes(cue)) return;
      cue.translatedText = result.translation;
      this.renderDual(text, result.translation);

      // Log de performance (apenas em dev)
      if (result.source !== 'memory_cache') {
        console.debug(
          `[LinguaFlow] Tradução: ${result.source} (${result.cached ? 'cached' : 'new'})`,
        );
      }
    } catch (e) {
      if (!this._isNavigationCurrent(navigation) || subtitleEpoch !== this._domSubtitleEpoch) return;
      console.error('[LinguaFlow] Erro na tradução:', e);
      this.renderDual(text, '');
    }
  }

  // ── Sync Loop (YouTube + HBO, RAF/rVFC) ───────────────────────────────────────
  _startSyncLoop() {
    this._stopSyncLoop();

    let lastSyncPulse = Date.now();
    let lastVideoTime = -1;

    const loop = (now, metadata) => {
      try {
        const v = this.videoElement || document.querySelector('video');
        if (!v) {
          this._continueLoop(loop, v);
          return;
        }

        lastSyncPulse = Date.now();
        lastVideoTime = v.currentTime;

        // SINCRONIA ROBUSTA
        let t = v.currentTime;

        // Verificação de Popup: Se estiver aberto e não estiver fechando, pausa o vídeo e mantém a legenda
        const isPopupOpen =
          this.wordPopup &&
          this.wordPopup.popup &&
          this.wordPopup.popup.style.display !== 'none' &&
          !this.wordPopup._isHiding;
        if (isPopupOpen) {
          if (!v.paused) v.pause();
          this._continueLoop(loop, v);
          return;
        }

        const cuesToSearch = this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues;

        // Netflix / DOM Fallback
        if (this.platform === 'netflix' && this.isActivated) {
          const netflixContainer = document.querySelector('.player-timedtext');
          if (netflixContainer) {
            netflixContainer.style.opacity = '0'; // Oculta nativo
            const text = netflixContainer.innerText.trim();
            if (text && text !== this.lastText) {
              this.lastText = text;
              this._onDomSubtitleUpdate(text, t);
            } else if (!text && this.lastText) {
              this.lastText = '';
              this.renderDual('', '');
            }
          }
        } else if (cuesToSearch && cuesToSearch.length > 0) {
          // Otimização: Se o vídeo está pausado, não precisamos filtrar cues repetidamente
          if (v.paused && this.lastText !== '') {
            this._continueLoop(loop, v);
            return;
          }

          // Sincronia com Legenda Nativa (YouTube)
          if (this.platform === 'youtube' && this.isActivated) {
            const ytNative = document.querySelector('.ytp-caption-window-container');
            if (ytNative && ytNative.style.display !== 'none') {
              ytNative.style.display = 'none';
            }
          }

          // Encontra a cue ativa (Otimizado: usa busca binária primeiro se não houver sobreposição conhecida)
          // Para manter compatibilidade com sobreposições, usamos o filter apenas se necessário
          const activeCues = cuesToSearch.filter((c) => t >= c.start && t <= c.end);

          let cue = null;
          if (activeCues.length > 0) {
            cue = activeCues.reduce((prev, current) =>
              prev.text.length > current.text.length ? prev : current,
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

          // Auto-Pause (Shadowing Mode)
          if (this.autoPause && !v.paused && cue && t >= cue.end - 0.05) {
            v.pause();
            this._showAutoPauseIndicator();
            this._lastAutoPausedEndTime = cue.end;
            console.log(`[LinguaFlow] Auto-paused at ${cue.end}. _lastAutoPausedEndTime set.`);
          }
        }

        this._continueLoop(loop, v);
      } catch (err) {
        if (err.message && err.message.includes('Extension context invalidated')) {
          console.warn(
            '[LinguaFlow] Contexto da extensão invalidado (atualização). Loop abortado de forma limpa.',
          );
          this._stopSyncLoop();
          return; // Aborta sem encher o log de erros
        }
        console.error('[LinguaFlow] Erro crítico no sync loop:', err);
        // Tenta continuar o loop após um pequeno respiro para não travar a aba se for erro contínuo
        setTimeout(() => this._continueLoop(loop, this.videoElement), 100);
      }
    };

    // Watchdog Timer: Se o loop morrer (e a página estiver visível e o vídeo carregado), reinicia
    this._watchdogInterval = setInterval(() => {
      if (document.hidden) {
        // Em background, rVFC/RAF são pausados nativamente pelo navegador para poupar bateria
        return;
      }
      const v = this.videoElement || document.querySelector('video');
      // Só reinicia se o vídeo não estiver pausado, se já tiver dados carregados (readyState >= 3)
      // e se o último pulso de sincronia ocorreu há mais de 2500ms.
      if (v && !v.paused && v.readyState >= 3 && Date.now() - lastSyncPulse > 2500) {
        // Verifica se o vídeo realmente avançou no tempo (evita falsos positivos em "buffering fantasma" do YT)
        if (v.currentTime !== lastVideoTime) {
          console.warn(
            '[LinguaFlow] Watchdog: Sync loop congelado detectado (vídeo avançou). Reiniciando...',
          );
          this._startSyncLoop();
        } else {
          // Vídeo não avançou, loop parou naturalmente por falta de novos quadros.
          // Atualizamos o pulso para não re-verificar imediatamente.
          lastSyncPulse = Date.now();
        }
      }
    }, 3000);

    this._continueLoop(loop, this.videoElement || document.querySelector('video'));
  }

  _prefetchTranslations(cues, currentIdx) {
    const navigation = this._navigationSnapshot();
    const nextCues = cues
      .slice(currentIdx + 1, currentIdx + 5)
      .filter((c) => !c.translatedText && !c.isTranslating);
    nextCues.forEach((c) => {
      c.isTranslating = true;
      chrome.runtime.sendMessage(
        {
          action: 'translate',
          text: c.text,
          from: this.sourceLang,
          to: this.targetLang,
        },
        (res) => {
          if (!this._isNavigationCurrent(navigation) || !this.cues.includes(c)) return;
          if (res?.translation) c.translatedText = res.translation;
          c.isTranslating = false;
        },
      );
    });
  }

  _cleanSubtitleText(text) {
    if (!text) return '';
    return text
      .replace(/\[.*?\]/g, '') // Remove [Music], [Laughter]
      .replace(/\(.*?\)/g, '') // Remove (shouting)
      // §4j.1/§4l.2: entidades HTML decodificadas AQUI, na fonte da cue —
      // antes só a legenda na tela era consertada (_makeClickable) e o card
      // recebia "don&#39;t" cru em context_sentence, contaminando frente,
      // builder, ditado e TTS. Numéricas (dec/hex) + as nomeadas comuns.
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\s+/g, ' ') // Unifica espaços
      .trim();
  }

  _continueLoop(loop, v) {
    if (v && v.requestVideoFrameCallback) {
      this.syncInterval = v.requestVideoFrameCallback(loop);
    } else {
      this.syncInterval = requestAnimationFrame(loop);
    }
  }

  _stopSyncLoop() {
    const v = this.videoElement || document.querySelector('video');
    if (this._watchdogInterval) {
      clearInterval(this._watchdogInterval);
      this._watchdogInterval = null;
    }
    if (this.syncInterval) {
      if (v && v.cancelVideoFrameCallback) {
        try {
          v.cancelVideoFrameCallback(this.syncInterval);
        } catch (e) {}
      } else {
        cancelAnimationFrame(this.syncInterval);
      }
      this.syncInterval = null;
    }
    if (this._syncTimer) {
      if (v && v.cancelVideoFrameCallback) {
        try {
          v.cancelVideoFrameCallback(this._syncTimer);
        } catch (e) {}
      } else {
        cancelAnimationFrame(this._syncTimer);
      }
      this._syncTimer = null;
    }
  }

  _showAutoPauseIndicator() {
    const container = this._findPlayerContainer() || document.body;

    const indicator = document.createElement('div');
    indicator.style.cssText = `
            position: ${container === document.body ? 'fixed' : 'absolute'};
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
            z-index: 2147483640;
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
    container.appendChild(indicator);

    setTimeout(() => {
      indicator.remove();
      style.remove();
    }, 1500);
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
    this._flashTimeout = setTimeout(
      () => {
        transDiv.classList.remove('lf-trans-flash');
        if (this.displayMode === 'native') {
          transDiv.style.display = 'none';
          if (btn) btn.style.display = 'block';
        }
        this._flashTimeout = null;
      },
      (this.flashDuration || 4) * 1000,
    );
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
        timestamp: this.videoElement?.currentTime || 0,
      };

      const res = await db.saveSentence(sentenceData);

      if (res.ok && saveBtn) {
        saveBtn.textContent = '✅ Salva!';
        saveBtn.style.color = '#34D399';
        setTimeout(() => {
          saveBtn.textContent = '+ Salvar frase';
          saveBtn.style.color = '';
        }, 2000);
      }
    } catch (e) {
      console.error('[LinguaFlow] Erro ao salvar frase:', e);
    }
  }

  // ── Motor de Renderização de Elite (onSubtitle) ──────────────────────────
  onSubtitle(cue) {
    if (!cue) return;
    console.debug('[LinguaFlow] onSubtitle triggered:', cue.text.substring(0, 30) + '...');
    if (cue.text === this._lastProcessedText) return;
    this._lastProcessedText = cue.text;
    this._currentCue = cue;
    this.currentSubtitleTimestamp = cue.start;

    // --- NOVO: Contexto Expandido (Melhor que o Lingosive) ---
    const cues = this.xhrCues && this.xhrCues.length ? this.xhrCues : this.cues;
    const idx = cues.indexOf(cue);
    const prevText = idx > 0 ? cues[idx - 1].text : '';
    const nextText = idx < cues.length - 1 ? cues[idx + 1].text : '';

    cue.fullContext = {
      prev: prevText,
      current: cue.text,
      next: nextText,
    };

    // 1. Pre-renderização: Cria os spans clicáveis antes de mostrar
    if (!cue._renderedNode) {
      cue._renderedNode = this._makeClickable(cue.text);
    }

    // 2. Tradução Dinâmica: Se não tiver, busca ou usa placeholder
    const trans = cue.translatedText || (cue.isTranslating ? '...' : '');

    // 3. Exibição Instantânea
    if (this.shadowContainer) {
      this.renderDual(cue.text, trans);
    } else {
      console.warn('[LinguaFlow] ⚠️ shadowContainer não pronto em onSubtitle. Tentando injetar...');
      const navigation = this._navigationSnapshot();
      this._injectSubtitleUI().then(() => {
        if (!this._isNavigationCurrent(navigation) || this._currentCue !== cue) return;
        this.renderDual(cue.text, trans);
      });
    }

    // 4. Se a tradução chegou depois, atualiza
    if (!cue.translatedText && !cue.isTranslating) {
      const navigation = this._navigationSnapshot();
      cue.isTranslating = true;
      chrome.runtime.sendMessage(
        {
          action: 'translate',
          text: cue.text,
          from: this.sourceLang,
          to: this.targetLang,
        },
        (res) => {
          if (!this._isNavigationCurrent(navigation) || !this.cues.includes(cue)) return;
          cue.isTranslating = false;
          if (res?.translation) {
            cue.translatedText = res.translation;
            if (this._currentCue === cue) {
              this.renderDual(cue.text, res.translation);
            }
          }
        },
      );
    }
  }

  renderDual(orig, trans) {
    if (!this.shadowContainer) {
      console.warn('[LinguaFlow] renderDual failed: shadowContainer not ready');
      return;
    }
    console.debug('[LinguaFlow] renderDual called with:', {
      orig: orig?.substring(0, 20),
      trans: trans?.substring(0, 20),
    });
    const wrap = this.shadowContainer.getElementById('lf-wrap');
    const origDiv = this.shadowContainer.getElementById('lf-orig');
    const transDiv = this.shadowContainer.getElementById('lf-trans');
    if (!wrap || !origDiv || !transDiv) return;

    // Verifica se há legenda válida (texto não vazio após trim)
    const hasValidSubtitle = orig && orig.trim().length > 0;

    // Bloqueia renderização se o motor não estiver ativado ou não houver legenda
    if (!hasValidSubtitle || !this.isActivated) {
      origDiv.style.display = 'none';
      transDiv.style.display = 'none';
      if (wrap) wrap.style.display = 'none';
      return;
    }

    // (O _lastOrig e a visibilidade do transDiv serão atualizados na lógica do modo de exibição mais abaixo)

    origDiv.innerHTML = '';
    // Força recriação do nó clicável para garantir que ele pertença ao Shadow Root atual
    origDiv.appendChild(this._makeClickable(orig));

    // Modo Hardcore: blur na linha original até o usuário passar o mouse
    const origRow = this.shadowContainer.querySelector('.lf-orig-row');
    if (origRow) {
      if (this.blurSubtitles) origRow.classList.add('lf-blur');
      else origRow.classList.remove('lf-blur');
    }

    // Corrige encoding de caracteres especiais
    const decodedTrans = this._fixEncoding(trans);

    // Log para debug de encoding (apenas se houver caracteres suspeitos)
    if (trans && (trans.includes('◆') || trans.includes('Ã'))) {
      console.warn('[LinguaFlow] ⚠️ Encoding issue detectado:');
      console.warn('  Original:', trans);
      console.warn('  Corrigido:', decodedTrans);
    }

    const transSpan = this.shadowContainer.getElementById('lf-trans-txt');
    if (transSpan) transSpan.textContent = decodedTrans;
    else {
      const s = transDiv.querySelector('#lf-trans-txt');
      if (s) s.textContent = decodedTrans;
    }

    // Aplica o modo de exibição e visibilidade real baseada em conteúdo
    const mode = this.displayMode || 'bilingual';
    if (wrap) wrap.setAttribute('data-subtitle-mode', mode);

    const hasTrans = decodedTrans && decodedTrans.trim().length > 0;

    // Lógica de visibilidade baseada no modo
    if (mode === 'translated') {
      origDiv.style.display = 'none';
      if (transDiv && hasTrans) transDiv.style.display = 'block';
    } else if (mode === 'bilingual' || mode === 'blur') {
      origDiv.style.display = 'block';
      if (transDiv && hasTrans) transDiv.style.display = 'block';
    } else {
      // mode === 'native'
      origDiv.style.display = 'block';
      // No modo nativo, transDiv fica oculto por padrão (até clicar em Traduzir)
      if (orig !== this._lastOrig && transDiv) {
         transDiv.style.display = 'none';
      }
    }

    this._lastOrig = orig;

    // Esconde o container principal se não houver nada para mostrar
    if (wrap) {
      const isOrigVisible = origDiv.style.display !== 'none';
      const isTransVisible = transDiv && transDiv.style.display !== 'none';
      wrap.style.display = (isOrigVisible || isTransVisible) ? 'inline-flex' : 'none';
    }

    console.debug(
      `[LinguaFlow] Render: mode=${mode}, origDisplay=${origDiv.style.display}, transDisplay=${transDiv.style.display}`,
    );

    // Mostra botão de tradução rápida apenas quando tradução está oculta e engine ligado
    const translateBtn = this.shadowContainer.getElementById('lf-translate-btn');
    if (translateBtn) {
      const showBtn = orig && mode === 'native' && this.isActivated;
      translateBtn.style.display = showBtn ? 'block' : 'none';
    }

    if (mode === 'blur') wrap.classList.add('mode-blur');
    else wrap.classList.remove('mode-blur');
  }

  _makeClickable(text, disableHoverPause = false) {
    const frag = document.createDocumentFragment();

    // Normaliza entidades HTML de apostrofo antes de tokenizar
    const normalized = text
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/\u2019/g, "'")
      .replace(/\u2018/g, "'");

    // Captura palavras e separadores mantendo a ordem original.
    const tokens = Array.from(
      normalized.matchAll(/[a-zA-Z\u00C0-\u024F']+|[^a-zA-Z\u00C0-\u024F']+/g),
      (m) => m[0],
    );

    const isWord = (token) => /[a-zA-Z\u00C0-\u024F]/.test(token);
    const cleanWord = (token) => token.toLowerCase().replace(/^'+|'+$/g, '');
    const maxExpressionWords = this._getMaxExpressionWords();

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Se for pontuação ou espaço, apenas adiciona
      if (!isWord(token)) {
        frag.appendChild(document.createTextNode(token));
        continue;
      }

      // --- DETECÇÃO DE EXPRESSÕES ---
      // Olha para as próximas palavras ignorando espaços/pontuação e escolhe
      // o maior bloco conhecido. Assim clicar em "put" dentro de "put up with"
      // abre "put up with", não "put".
      let longestMatch = null;
      let matchEndTokenIndex = i;
      let seenWords = [];

      for (let j = i; j < tokens.length && seenWords.length < maxExpressionWords; j++) {
        if (!isWord(tokens[j])) continue;
        seenWords.push(cleanWord(tokens[j]));

        if (seenWords.length < 2) continue;

        const candidate = seenWords.join(' ');
        if (expressionsDB.has(candidate)) {
          longestMatch = candidate;
          matchEndTokenIndex = j;
        }
      }

      if (longestMatch) {
        const matchText = tokens.slice(i, matchEndTokenIndex + 1).join('');
        const span = this._createWordSpan(matchText, true, disableHoverPause);
        span.dataset.expression = longestMatch;
        frag.appendChild(span);
        i = matchEndTokenIndex;
      } else {
        // Palavra isolada
        const span = this._createWordSpan(token, false, disableHoverPause);
        frag.appendChild(span);
      }
    }
    return frag;
  }

  _getMaxExpressionWords() {
    if (!this._maxExpressionWords) {
      this._maxExpressionWords = Math.max(
        2,
        ...Array.from(expressionsDB, (expr) => expr.split(/\s+/).length),
      );
    }
    return this._maxExpressionWords;
  }

  _createWordSpan(text, isExpression, disableHoverPause = false) {
    const span = document.createElement('span');
    span.textContent = text;

    // Se for expressão, adiciona uma classe especial para destaque visual (underline sutil)
    const baseClass = isExpression ? 'lf-word lf-expression' : 'lf-word';
    let cefrClass = '';
    const wordStatus =
      this.savedWords.get(text.toLowerCase()) ||
      (this.knownWords.has(text.toLowerCase()) ? 'known' : null);

    // Aplica a cor CEFR apenas se a palavra for nova (não salva e não conhecida)
    if (this.cefrColorsEnabled && !wordStatus && this.cefrList) {
      const level = this.cefrList[text.toLowerCase()];
      if (level && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level)) {
        if (this.cefrTargetLevel === 'all' || this.cefrTargetLevel === level) {
          cefrClass = ' lf-cefr-' + level;
        }
      }
    }
    span.className = baseClass + cefrClass + ' ' + this._wordClass(text);

    let hoverTimeout = null;

    span.addEventListener('pointerenter', (e) => {
      // Se for touch, o touchstart ou o click resolvem, não pausa por pointerenter de touch pra não conflitar
      if (e.pointerType === 'touch') return;
      // Debounce de Elite: Só pausa se o usuário realmente quiser interagir (150ms)
      this._hoverPauseTimer = setTimeout(() => {
        if (!disableHoverPause && this.videoElement && !this.videoElement.paused) {
          this.videoElement.pause();
          this._wasPausedByHover = true;
        }

        // Mostra tradução rápida no popup
        if (this.wordPopup) {
          const rect = span.getBoundingClientRect();
          this.wordPopup.showForWord(text, this.lastText, rect, this._currentCue);
        }
      }, 150);
    });

    span.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'touch') return;
      if (this._hoverPauseTimer) {
        clearTimeout(this._hoverPauseTimer);
        this._hoverPauseTimer = null;
      }

      // NÃO retoma o vídeo aqui. O vídeo só retoma se o usuário clicar fora do popup ou no X.
      // Isso evita que o vídeo volte a tocar enquanto o usuário move o mouse para o popup.
      const isPopupOpen =
        this.wordPopup && this.wordPopup.popup && this.wordPopup.popup.style.display !== 'none';
      if (this.wordPopup && !isPopupOpen) {
        this.wordPopup.hide();
      }
    });

    const onClickOrTouch = (e) => {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault(); // Evita eventos duplicados no mobile
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
      if (!disableHoverPause && this.videoElement && !this.videoElement.paused) {
        this.videoElement.pause();
        this._wasPausedByHover = true;
      }
      if (this.wordPopup) {
        const rect = span.getBoundingClientRect();
        this.wordPopup.showForWord(text, this.lastText, rect, this._currentCue);
      }
    };

    span.addEventListener('click', onClickOrTouch);
    span.addEventListener('touchstart', onClickOrTouch, { passive: false });

    return span;
  }

  _wordClass(word) {
    // Normaliza contracoes: i'm -> i'm, don't -> don't (apostrofo simples)
    const w = word
      .toLowerCase()
      .replace(/\u2019/g, "'")
      .replace(/&#39;/g, "'");
    if (this.knownWords.has(w)) return 'lf-known';
    // Tenta lookup com a contracao inteira e tambem com a forma base (antes do apostrofo)
    const status = this.savedWords.get(w) || this.savedWords.get(w.split("'")[0]);
    if (status === 'mature') return 'lf-mature';
    if (status === 'review') return 'lf-review';
    if (status === 'learning') return 'lf-learning';
    if (status === 'new') return 'lf-saved';
    return 'lf-new';
  }

  _setupSaveButtonObserver() {
    // Observa mudanças no DOM para garantir que o botão só apareça com legenda
    const origDiv = this.shadowContainer?.getElementById('lf-orig');
    if (!origDiv) return;

    if (this._saveButtonObservers) {
      this._saveButtonObservers.forEach((item) => item.disconnect());
      this._saveButtonObservers.clear();
    } else {
      this._saveButtonObservers = new Set();
    }

    const observer = new MutationObserver(() => {
      const saveBtn = this.shadowContainer?.getElementById('lf-save-btn');
      if (!saveBtn) return;

      const hasText = origDiv.textContent && origDiv.textContent.trim().length > 0;
      const isVisible = origDiv.style.display !== 'none';

      saveBtn.style.display = hasText && isVisible && this.isActivated ? 'inline-block' : 'none';
      if (!hasText || !isVisible || !this.isActivated) saveBtn.textContent = '+ Salvar frase';
    });

    observer.observe(origDiv, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    this._saveButtonObservers.add(observer);
    this._managedObservers.add(observer);

    // Também observa mudanças no atributo style
    const styleObserver = new MutationObserver(() => {
      const saveBtn = this.shadowContainer?.getElementById('lf-save-btn');
      if (!saveBtn) return;

      const hasText = origDiv.textContent && origDiv.textContent.trim().length > 0;
      const isVisible = origDiv.style.display !== 'none';

      saveBtn.style.display = hasText && isVisible && this.isActivated ? 'inline-block' : 'none';
    });

    styleObserver.observe(origDiv, {
      attributes: true,
      attributeFilter: ['style'],
    });
    this._saveButtonObservers.add(styleObserver);
    this._managedObservers.add(styleObserver);
  }

  toggleSubtitles(forceState = null) {
    const host = document.getElementById('linguaflow-subtitle-host');
    if (!host) return;

    let isVisible;
    if (forceState !== null) {
      isVisible = forceState;
    } else {
      // Se for chamado sem argumentos, alterna o estado.
      // NOVO PADRÃO: Sempre começa DESLIGADO (false) se não houver registro explícito de 'true'.
      const stored = localStorage.getItem('lf_sub_visible');
      isVisible = stored === 'true';
    }

    host.style.visibility = isVisible ? 'visible' : 'hidden';
    host.style.opacity = isVisible ? '1' : '0';
    host.style.transition = 'opacity 0.2s ease, visibility 0.2s';
    this.isActivated = isVisible;

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
        }
      }
    }

    // HBO/Max: Desabilita o ocultador de legendas nativas se o engine estiver desligado
    if (this.platform === 'max') {
      const s = document.getElementById('lf-native-hide');
      if (s) s.disabled = !isVisible;
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
          .replace(/ç/g, 'ç')
          .replace(/ã/g, 'ã')
          .replace(/á/g, 'á')
          .replace(/é/g, 'é')
          .replace(/í/g, 'í')
          .replace(/ó/g, 'ó')
          .replace(/ú/g, 'ú')
          .replace(/â/g, 'â')
          .replace(/ê/g, 'ê')
          .replace(/ô/g, 'ô')
          .replace(/à/g, 'à')
          .replace(/Ã¹/g, 'ù')
          .replace(/Ã¨/g, 'è')
          .replace(/Ã¬/g, 'ì')
          .replace(/Ã²/g, 'ò')
          // Maiúsculas com acentos
          .replace(/Ç/g, 'Ç')
          .replace(/Ã/g, 'Ã')
          .replace(/Ã�/g, 'Á')
          .replace(/É/g, 'É')
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
          const bytes = new Uint8Array([...fixed].map((c) => c.charCodeAt(0)));
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

  _toggleCueLoop(idx, btn) {
    const cues = this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues;
    const cue = cues[idx];
    if (!cue) return;

    // Se já está em loop desta frase, desativa
    if (this.isLooping && this.loopStartTime === cue.start) {
      this.isLooping = false;
      if (this._loopInterval) clearInterval(this._loopInterval);
      this._loopInterval = null;
      btn.style.background = 'rgba(255,255,255,0.05)';
      btn.style.color = '#94A3B8';
      this._showNotification('▶️ Loop Desativado');
    } else {
      // Ativa loop para esta frase
      if (this._loopInterval) clearInterval(this._loopInterval);

      this.isLooping = true;
      this.loopStartTime = cue.start;
      this.loopEndTime = cue.end;

      // Limpa outros botões de loop (estilo)
      document.querySelectorAll('.lf-loop-cue').forEach((b) => {
        b.style.background = 'rgba(255,255,255,0.05)';
        b.style.color = '#94A3B8';
      });

      btn.style.background = 'rgba(56, 189, 248, 0.2)';
      btn.style.color = '#38BDF8';

      if (this.videoElement) {
        this.videoElement.currentTime = cue.start;
        this.videoElement.play();
      }

      this._loopInterval = setInterval(() => {
        if (this.isLooping && this.videoElement.currentTime >= this.loopEndTime) {
          this.videoElement.currentTime = this.loopStartTime;
        }
      }, 100);

      this._showNotification('🔁 Loop Ativado');
    }
  }

  _formatTime(seconds) {
    if (isNaN(seconds) || seconds === null) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return (h > 0 ? h + ':' : '') + (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  _rebuildSubtitleList(container, filter = '') {
    if (!container) container = document.getElementById('lf-subtitle-list');
    if (!container) return;

    container.innerHTML = '';
    const cues = this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues;

    if (!cues || cues.length === 0) {
      container.innerHTML =
        '<div style="padding:40px 20px;text-align:center;color:#64748B;font-size:14px;">Nenhuma legenda encontrada para este vídeo.</div>';
      return;
    }

    const showTrans = document.getElementById('lf-show-translation')?.checked ?? true;

    cues.forEach((cue, idx) => {
      const matchesFilter =
        !filter ||
        cue.text.toLowerCase().includes(filter.toLowerCase()) ||
        (cue.translatedText && cue.translatedText.toLowerCase().includes(filter.toLowerCase()));

      if (!matchesFilter) return;

      const item = document.createElement('div');
      item.className = 'lf-subtitle-item';
      item.dataset.index = idx;
      item.style.cssText = `
                padding: 12px 16px;
                cursor: pointer;
                transition: all 0.1s;
                position: relative;
                display: flex;
                flex-direction: column;
                gap: 4px;
            `;

      // Garante que o tempo está em segundos para formatar
      const startTime = cue.start > 100000 ? cue.start / 1000 : cue.start;

      item.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
                    <span class="lf-time lf-sub-time" style="font-size:11px;font-family:'Nunito',monospace;font-weight:700;flex-shrink:0;margin-top:3px;">${this._formatTime(startTime)}</span>
                    <div class="lf-sub-text" style="flex:1;font-size:15px;line-height:1.4;font-weight:700;">${escapeHTML(cue.text)}</div>
                    <div style="display:flex;gap:4px;">
                        <button class="lf-loop-cue" title="Repetir frase" style="background:transparent;border:none;color:inherit;cursor:pointer;font-size:14px;padding:0 2px;">🔁</button>
                    </div>
                </div>
                <div class="lf-translation-text lf-trans-text" style="font-size:13px;padding-left:42px;font-weight:600;display:${showTrans ? 'block' : 'none'};">
                    ${cue.translatedText || '<span style="opacity:0.6;font-style:italic;">traduzindo...</span>'}
                </div>
            `;

      // Auto-tradução na barra lateral se estiver faltando
      if (!cue.translatedText && showTrans) {
        const navigation = this._navigationSnapshot();
        import('../utils/translator.js').then(({ translator }) => {
          if (!this._isNavigationCurrent(navigation)) return;
          translator
            .translate(cue.text, 'auto', this.targetLang)
            .then((res) => {
              if (!this._isNavigationCurrent(navigation) || !this.cues.includes(cue)) return;
              cue.translatedText = res.translation;
              const tDiv = item.querySelector('.lf-translation-text');
              if (tDiv) tDiv.textContent = res.translation;
            })
            .catch(() => {
              if (!this._isNavigationCurrent(navigation)) return;
              const tDiv = item.querySelector('.lf-translation-text');
              if (tDiv) tDiv.textContent = '';
            });
        });
      }

      item.onclick = (e) => {

        if (e.target.classList.contains('lf-loop-cue')) {
          this._toggleCueLoop(idx, e.target);
          return;
        }
        if (this.videoElement) {
          this.videoElement.currentTime = startTime;
          this.videoElement.play();
        }
      };

      item.onmouseenter = () => {
        if (this.currentCueIndex !== idx) item.style.background = '#f7f7f7';
      };
      item.onmouseleave = () => {
        if (this.currentCueIndex !== idx) item.style.background = '#ffffff';
      };

      container.appendChild(item);
    });

    this._updateSubtitlePanelHighlight();
  }

  async _checkStreakNotification() {
    if (this._streakShown) return;
    this._streakShown = true;
    try {
      const { db } = await import('../utils/db.js');
      const stats = await db.getStats();
      const streak = stats?.streak || 0;
      if (streak < 1) return;
      const id = 'lf-streak-hud';
      let hud = document.getElementById(id);
      if (!hud) {
        hud = document.createElement('div');
        hud.id = id;
        hud.style.cssText =
          'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(15,23,42,0.95);color:#e2e8f0;font-family:Inter,sans-serif;font-size:14px;font-weight:700;padding:12px 22px;border-radius:14px;border:1px solid rgba(251,191,36,0.4);backdrop-filter:blur(8px);pointer-events:none;transition:opacity 0.5s;box-shadow:0 4px 24px rgba(0,0,0,0.5);text-align:center;';
        document.body.appendChild(hud);
      }
      hud.style.opacity = '1';
      hud.innerHTML = `🔥 <span style="color:#fbbf24">${streak} ${streak === 1 ? 'dia' : 'dias'}</span> de streak mantido!`;
      setTimeout(() => {
        hud.style.opacity = '0';
        setTimeout(() => hud.remove(), 500);
      }, 5000);
    } catch (e) {}
  }

  _filterSubtitleList(text) {
    const list = document.getElementById('lf-subtitle-list');
    if (list) this._rebuildSubtitleList(list, text);
  }

  _updateSubtitlePanelHighlight() {
    const list = document.getElementById('lf-subtitle-list');
    if (!list) return;

    const autoScroll = document.getElementById('lf-autoscroll-panel')?.checked ?? true;
    const items = list.querySelectorAll('.lf-subtitle-item');

    items.forEach((item) => {
      const idx = parseInt(item.dataset.index);
      if (idx === this.currentCueIndex) {
        item.style.background = 'rgba(56, 189, 248, 0.12)';
        item.style.borderLeftColor = '#38BDF8';

        if (autoScroll && !list._userScrolling) {
          item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        item.style.background = 'transparent';
        item.style.borderLeftColor = 'transparent';
      }
    });
  }

  _exportPDF() {
    const videoTitle = document.title || 'Legendas';
    const cues = this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Erro: Popup bloqueado. Permita popups no navegador para gerar o PDF.');
      return;
    }

    let html = `
            <html>
            <head>
                <title>${videoTitle} - LinguaFlow Script</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
                    h1 { color: #0ea5e9; text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; font-size: 20px; }
                    .cue-item { border-bottom: 1px solid #f1f5f9; padding: 10px 0; page-break-inside: avoid; display:flex; gap: 15px; }
                    .time { font-family: monospace; color: #94a3b8; font-size: 13px; min-width: 60px; }
                    .text-content { flex: 1; }
                    .orig { font-size: 16px; font-weight: 600; color: #0f172a; }
                    .trans { font-size: 15px; color: #475569; margin-top: 4px; }
                    @media print {
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; }
                    }
                </style>
            </head>
            <body>
                <h1>🎬 ${videoTitle}</h1>
                <p style="text-align:center; color:#64748b; margin-bottom: 30px; font-size: 12px">Script exportado via LinguaFlow</p>
        `;

    cues.forEach((c) => {
      const time = this._formatTime(c.start);
      const orig = (c.text || '').replace(/\n/g, '<br>');
      const trans = (c.translatedText || '').replace(/\n/g, '<br>');

      html += `<div class="cue-item">
                        <div class="time">${time}</div>
                        <div class="text-content">
                            <div class="orig">${orig}</div>
                            ${trans ? `<div class="trans">${trans}</div>` : ''}
                        </div>
                     </div>`;
    });

    html += `</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 500);
  }

  _exportCSV() {
    const videoTitle = document.title || 'Legendas';
    const cues = this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues;
    let csv = 'Timestamp;Original;Translation\n';

    cues.forEach((c) => {
      const time = this._formatTime(c.start);
      const orig = (c.text || '').replace(/"/g, '""');
      const trans = (c.translatedText || '').replace(/"/g, '""');
      csv += `${time};"${orig}";"${trans}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${videoTitle.replace(/[^a-z0-9]/gi, '_')}_LinguaFlow.csv`;
    link.click();
  }

  _exportAnki() {
    const videoTitle = document.title || 'Legendas';
    const cues = this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues;
    let content = '';

    cues.forEach((c) => {
      const orig = (c.text || '').replace(/\n/g, '<br>');
      const trans = (c.translatedText || '').replace(/\n/g, '<br>');
      const time = this._formatTime(c.start);
      // Formato Anki: Front [tab] Back [tab] Tag
      content += `${orig}<br><small style="color:gray">${time}</small>\t${trans}\tLinguaFlow_${this.platform}\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${videoTitle.replace(/[^a-z0-9]/gi, '_')}_Anki.txt`;
    link.click();
  }

  destroy() {
    if (this._disposed) return;
    this._disposed = true;
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
    if (this._loopInterval) clearInterval(this._loopInterval);
    if (this._watchdogInterval) clearInterval(this._watchdogInterval);
    if (this._videoWaitInterval) clearInterval(this._videoWaitInterval);
    this._stopSyncLoop();
    this.domCapture?.stop?.();
    this.wordPopup?.destroy?.();
    this.shadowContainer?.host?.remove();
    document.getElementById('lf-yt-btn')?.remove();
    document.getElementById('lf-subtitle-panel')?.remove();
  }
}
