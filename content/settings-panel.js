// content/settings-panel.js — Painel de configurações da extensão no player (Shadow DOM): aparência da legenda, sincronia, idiomas e gravação das preferências.
import { readAllSettings, writeSetting } from './settings-panel/storage.js';
import { MarkupMethods } from './settings-panel/markup.js';
import { installMethods } from '../utils/install-methods.js';

export class SettingsPanel {
  constructor(engine) {
    this.engine = engine;
    this.isOpen = false;
    this.host = null;
    this.shadow = null;
    this._abort = new AbortController();
    this._saveTimers = new Map();
    this._pendingSaves = new Map();
    this._writeQueue = Promise.resolve();

    this.cfg = {
      targetLang: 'pt',
      sourceLang: 'en',
      subtitleMode: 'native',
      bgOpacity: 0.45,
      fontSize: 35, // tamanho legenda original
      fontSizeTrans: 18, // tamanho legenda tradução (NOVO)
      wordColorKnown: '#86EFAC',
      wordColorSaved: '#93C5FD',
      autoPause: false,
      smartAutoPause: false,
      smartHideKnownTranslation: false,
      smartLookupHint: false,
      showOriginal: true,
      showTranslation: true,
      subtitleBottom: 84,
      subtitleHorizontal: 45,
      translationDelay: 0,
      translationAnticipation: 0,
      flashDuration: 4, // segundos do flash de tradução (NOVO)
      uiTheme: 'dark',
      blurSubtitles: false,
      ttsPlaybackRate: 1.0,
      fontFamily: 'Inter',
      colorPalette: 'Vibrant',
      popupMode: 'floating',
      cefrTargetLevel: 'none',
      cefrColorsEnabled: true,
      startMode: 'session',
      markPhrasal: true,
      markSlang: true,
      markReduction: true,
      markSoundsLike: true,
      markMarkers: false,
      cefrColorA1: '#4ade80', // Verde Claro
      cefrColorA2: '#22d3ee', // Ciano
      cefrColorB1: '#facc15', // Amarelo
      cefrColorB2: '#fb923c', // Laranja
      cefrColorC1: '#f472b6', // Rosa
      cefrColorC2: '#c084fc', // Roxo
    };

    this._init();
  }

  async _init() {
    try {
      const saved = await readAllSettings();
      this.cfg = { ...this.cfg, ...saved };
    } catch (e) {
      console.debug('[SettingsPanel] Could not read settings, using defaults:', e.message);
    }
    this._buildDOM(); // FIX: Agora o painel é construído
    this._attachListeners();
    this._applyToEngine();
    if (!document.getElementById('linguaflow-subtitle-host')) {
      setTimeout(() => this._applyToEngine(), 1000);
      setTimeout(() => this._applyToEngine(), 3000);
    }
  }

  updateTheme(theme) {
    if (this.shadow) {
      const panel = this.shadow.querySelector('.panel');
      if (panel) {
        if (theme === 'dark') {
          panel.classList.add('theme-dark');
          panel.classList.remove('theme-light');
        } else {
          panel.classList.add('theme-light');
          panel.classList.remove('theme-dark');
        }
      }
    }
    const event = new CustomEvent('lf_theme_changed', { detail: { theme } });
    document.dispatchEvent(event);
  }

  _attachListeners() {
    document.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Tab') {
        const dialog = this.shadow?.querySelector('[role="dialog"]');
        const focusable = dialog ? [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
          .filter((element) => element.offsetParent !== null) : [];
        if (focusable.length) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && this.shadow.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && this.shadow.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
        return;
      }
      if (this.isOpen && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
        return;
      }
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    }, { signal: this._abort.signal });
    window.addEventListener('LF_TOGGLE_SETTINGS', () => this.toggle(), { signal: this._abort.signal });

    // Atualiza preview em tempo real quando sliders de fonte mudam
    const s = this.shadow;
    s.getElementById('rng-font').addEventListener('input', (e) => {
      const v = e.target.value;
      s.getElementById('preview-orig').style.fontSize = `${v}px`;
    });
    s.getElementById('rng-font-trans').addEventListener('input', (e) => {
      const v = e.target.value;
      s.getElementById('preview-trans').style.fontSize = `${v}px`;
    });

    // Escuta evento de flash duration do engine
    window.addEventListener('LF_UPDATE_FLASH_DURATION', (e) => {
      if (this.engine) this.engine.flashDuration = e.detail;
    }, { signal: this._abort.signal });
  }

  // Remove os listeners globais e o painel (#466).
  destroy() {
    this.flushPendingSaves();
    this._abort.abort();
    this.host?.remove();
  }

  toggle() {
    if (!this.shadow) return;
    this.isOpen ? this.close() : this.open();
  }
  open() {
    if (!this.shadow) return;
    this._previousFocus = document.activeElement;
    this.isOpen = true;
    this.shadow.getElementById('overlay').style.display = 'flex';
    const closeBtn = this.shadow.getElementById('btn-close');
    if (closeBtn && typeof closeBtn.focus === 'function') closeBtn.focus();
  }
  close() {
    if (!this.shadow) return;
    this.flushPendingSaves();
    this.isOpen = false;
    this.shadow.getElementById('overlay').style.display = 'none';
    if (this._previousFocus && typeof this._previousFocus.focus === 'function' && this._previousFocus.isConnected) {
      this._previousFocus.focus({ preventScroll: true });
    }
    this._previousFocus = null;
  }

  // Slider: efeito ao vivo na hora; gravação agrupada (400 ms sem novo movimento)
  // e enviada em ordem, para não gerar dezenas de POSTs nem salvar um valor
  // intermediário quando as respostas chegam fora de ordem (#471).
  _saveLive(key, value) {
    this.cfg[key] = value;
    this._applyToEngine();
    this._pendingSaves.set(key, value);
    clearTimeout(this._saveTimers.get(key));
    this._saveTimers.set(key, setTimeout(() => this._flushSave(key), 400));
  }

  _flushSave(key) {
    clearTimeout(this._saveTimers.get(key));
    this._saveTimers.delete(key);
    if (!this._pendingSaves.has(key)) return this._writeQueue;
    const value = this._pendingSaves.get(key);
    this._pendingSaves.delete(key);
    this._writeQueue = this._writeQueue.then(() => this._writeSetting(key, value));
    return this._writeQueue;
  }

  flushPendingSaves() {
    for (const key of [...this._pendingSaves.keys()]) this._flushSave(key);
    return this._writeQueue;
  }

  _writeSetting(key, value) {
    return writeSetting(key, value);
  }

  async _save(key, value) {
    this.cfg[key] = value;
    await writeSetting(key, value);
    this._applyToEngine();
  }

  // Opções da legenda inteligente (#488): salva e, ao ligar, conta no funil de uso para saber se alguém usa.
  async _saveSmart(key, value, usageEvent) {
    await this._save(key, value);
    if (value) this.engine?._trackUsage?.(usageEvent);
  }

  _applyToEngine() {
    if (!this.engine) return;

    const displayModeChanged = this.engine.displayMode !== this.cfg.subtitleMode;
    this.engine.displayMode = this.cfg.subtitleMode;
    this.engine.targetLang = this.cfg.targetLang;
    this.engine.sourceLang = this.cfg.sourceLang || 'en';
    window.postMessage({ type: 'LF_SET_SOURCE_LANG', sourceLang: this.engine.sourceLang }, window.location.origin);
    this.engine.translationDelay = this.cfg.translationDelay;
    // No YouTube, antecipação deve ser sempre 0 para sincronização perfeita
    this.engine.translationAnticipation = this.cfg.translationAnticipation;
    this.engine.autoPause = this.cfg.autoPause;
    this.engine.smartAutoPause = this.cfg.smartAutoPause === true;
    this.engine.smartHideKnownTranslation = this.cfg.smartHideKnownTranslation === true;
    this.engine.smartLookupHint = this.cfg.smartLookupHint === true;
    this.engine.startMode = this.cfg.startMode;
    this.engine.flashDuration = this.cfg.flashDuration;

    this.engine.cefrColorsEnabled = this.cfg.cefrColorsEnabled;
    this.engine.expressionMarks = {
      phrasal: this.cfg.markPhrasal !== false,
      slang: this.cfg.markSlang !== false,
      reduction: this.cfg.markReduction !== false,
      sounds_like: this.cfg.markSoundsLike !== false,
      marker: this.cfg.markMarkers === true,
    };
    this.engine._applyExpressionMarks?.();

    // Passar cores do CEFR para a engine
    this.engine.cefrColors = {
      A1: this.cfg.cefrColorA1,
      A2: this.cfg.cefrColorA2,
      B1: this.cfg.cefrColorB1,
      B2: this.cfg.cefrColorB2,
      C1: this.cfg.cefrColorC1,
      C2: this.cfg.cefrColorC2,
    };
    this.engine.blurSubtitles = this.cfg.blurSubtitles;
    this.engine.ttsPlaybackRate = this.cfg.ttsPlaybackRate;
    this.engine.popupMode = this.cfg.popupMode;

    if (displayModeChanged && this.engine._lastOrig) {
      this.engine.renderDual(this.engine._lastOrig, this.engine._lastTrans || '');
    }

    const host = document.getElementById('linguaflow-subtitle-host');
    if (host) {
      host.style.setProperty('--lf-font-size', `${this.cfg.fontSize}px`);
      host.style.setProperty('--lf-font-size-trans', `${this.cfg.fontSizeTrans}px`);
      host.style.setProperty('--lf-bg-opacity', this.cfg.bgOpacity);
      host.style.setProperty('--lf-font-family', this.cfg.fontFamily);

      // Applica Cores Baseadas na Paleta
      let colKnown = this.cfg.wordColorKnown;
      let colSaved = this.cfg.wordColorSaved;

      if (this.cfg.colorPalette === 'Pastel') {
        colKnown = '#bbf7d0'; // Verde Pastel
        colSaved = '#bae6fd'; // Azul Pastel
      } else if (this.cfg.colorPalette === 'Colorblind') {
        colKnown = '#60a5fa'; // Azul (para daltônicos verem que já sabem)
        colSaved = '#fb923c'; // Laranja (foco/estudando)
      }

      host.style.setProperty('--lf-color-known', colKnown);
      host.style.setProperty('--lf-color-saved', colSaved);
      host.style.bottom = `${this.cfg.subtitleBottom}px`;
      host.style.left = `${this.cfg.subtitleHorizontal}%`;
      host.style.transform = `translateX(-${this.cfg.subtitleHorizontal}%)`;
    } else {
      setTimeout(() => this._applyToEngine(), 1000);
    }
  }
}

installMethods(SettingsPanel, [MarkupMethods]);
