// content/settings-panel.js
const DB_NAME = 'LinguaFlowFreeDB';

async function readAllSettings() {
  const { db } = await import('../utils/db.js');
  const settings = [
    'targetLang',
    'subtitleMode',
    'bgOpacity',
    'fontSize',
    'fontSizeTrans',
    'autoPause',
    'showOriginal',
    'showTranslation',
    'subtitleBottom',
    'subtitleHorizontal',
    'translationDelay',
    'translationAnticipation',
    'flashDuration',
    'wordColorKnown',
    'wordColorSaved',
    'blurSubtitles',
    'ttsPlaybackRate',
    'fontFamily',
    'colorPalette',
    'popupMode',
    'cefrTargetLevel',
    'cefrColorsEnabled',
    'cefrColorA1',
    'cefrColorA2',
    'cefrColorB1',
    'cefrColorB2',
    'cefrColorC1',
    'cefrColorC2',
  ];
  const obj = {};
  for (const key of settings) {
    const val = await db.getSetting(key);
    if (val !== undefined) obj[key] = val;
  }
  return obj;
}

async function writeSetting(key, value) {
  const { db } = await import('../utils/db.js');
  return db.setSetting(key, value);
}

export class SettingsPanel {
  constructor(engine) {
    this.engine = engine;
    this.isOpen = false;
    this.host = null;
    this.shadow = null;

    this.cfg = {
      targetLang: 'pt',
      sourceLang: 'en',
      subtitleMode: 'native',
      bgOpacity: 0.45,
      fontSize: 31, // tamanho legenda original
      fontSizeTrans: 18, // tamanho legenda tradução (NOVO)
      wordColorKnown: '#86EFAC',
      wordColorSaved: '#93C5FD',
      autoPause: false,
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

  _buildDOM() {
    this.host = document.createElement('div');
    this.host.id = 'lf-settings-host';
    Object.assign(this.host.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '2147483648',
      pointerEvents: 'none',
    });

    this.shadow = this.host.attachShadow({ mode: 'open' });
    this.shadow.innerHTML = this._html();
    document.body.appendChild(this.host);
    this.updateTheme(this.cfg.uiTheme);

    const s = this.shadow;

    // Preenche valores
    s.getElementById('sel-lang').value = this.cfg.targetLang;
    s.getElementById('sel-source-lang').value = this.cfg.sourceLang || 'en';
    s.getElementById('sel-theme').value = this.cfg.uiTheme || 'dark';
    s.getElementById('sel-mode').value = this.cfg.subtitleMode;
    s.getElementById('sel-autopause').value = this.cfg.autoPause ? 'on' : 'off';
    s.getElementById('rng-font').value = this.cfg.fontSize;
    s.getElementById('rng-font-trans').value = this.cfg.fontSizeTrans;
    s.getElementById('rng-bg').value = Math.round(this.cfg.bgOpacity * 100);
    s.getElementById('rng-position').value = this.cfg.subtitleBottom;
    s.getElementById('rng-horizontal').value = this.cfg.subtitleHorizontal;
    s.getElementById('rng-delay').value = this.cfg.translationDelay;
    // No YouTube, slider de antecipação sempre 0
    s.getElementById('rng-anticipation').value = this.cfg.translationAnticipation;
    s.getElementById('rng-flash').value = this.cfg.flashDuration;
    s.getElementById('col-known').value = this.cfg.wordColorKnown;
    s.getElementById('col-saved').value = this.cfg.wordColorSaved;

    s.getElementById('sel-font-family').value = this.cfg.fontFamily;
    s.getElementById('sel-palette').value = this.cfg.colorPalette;
    s.getElementById('sel-tts-speed').value = this.cfg.ttsPlaybackRate;
    const selBlur = s.getElementById('sel-blur');
    if (selBlur) selBlur.value = this.cfg.blurSubtitles ? 'on' : 'off';
    s.getElementById('sel-cefr-level').value = this.cfg.cefrTargetLevel;
    s.getElementById('sel-cefr-colors').value = this.cfg.cefrColorsEnabled ? 'on' : 'off';

    s.getElementById('val-font').textContent = `${this.cfg.fontSize}px`;
    s.getElementById('val-font-trans').textContent = `${this.cfg.fontSizeTrans}px`;
    s.getElementById('val-bg').textContent = `${Math.round(this.cfg.bgOpacity * 100)}%`;
    s.getElementById('val-position').textContent = `${this.cfg.subtitleBottom}px`;
    s.getElementById('val-horizontal').textContent = `${this.cfg.subtitleHorizontal}%`;
    s.getElementById('val-delay').textContent = `${this.cfg.translationDelay}s`;
    // No YouTube, sempre mostra 0s no slider de antecipação
    s.getElementById('val-anticipation').textContent = `${this.cfg.translationAnticipation}s`;
    s.getElementById('val-flash').textContent = `${this.cfg.flashDuration}s`;

    // Handlers
    s.getElementById('btn-close').onclick = () => this.close();
    s.getElementById('overlay').onclick = (e) => {
      if (e.target === s.getElementById('overlay')) this.close();
    };

    s.getElementById('sel-lang').onchange = (e) => this._save('targetLang', e.target.value);
    s.getElementById('sel-source-lang').onchange = (e) => this._save('sourceLang', e.target.value);
    s.getElementById('sel-theme').onchange = (e) => {
        this._save('uiTheme', e.target.value);
        this.updateTheme(e.target.value);
    };
    s.getElementById('sel-mode').onchange = (e) => this._save('subtitleMode', e.target.value);

    s.getElementById('sel-autopause').onchange = (e) => {
      const val = e.target.value === 'on';
      this._save('autoPause', val);
      window.dispatchEvent(new CustomEvent('LF_UPDATE_AUTOPAUSE', { detail: val }));
    };
    const selBlurEl = s.getElementById('sel-blur');
    if (selBlurEl) {
      selBlurEl.onchange = (e) => {
        const val = e.target.value === 'on';
        this._save('blurSubtitles', val);
      };
    }
    s.getElementById('sel-font-family').onchange = (e) => this._save('fontFamily', e.target.value);
    s.getElementById('sel-palette').onchange = (e) => this._save('colorPalette', e.target.value);
    s.getElementById('sel-tts-speed').onchange = (e) =>
      this._save('ttsPlaybackRate', parseFloat(e.target.value));
    s.getElementById('sel-cefr-level').onchange = (e) =>
      this._save('cefrTargetLevel', e.target.value);

    s.getElementById('sel-cefr-colors').onchange = (e) => {
      this._save('cefrColorsEnabled', e.target.value === 'on');
    };

    // Tamanho legenda original
    s.getElementById('rng-font').oninput = (e) => {
      const v = Number(e.target.value);
      s.getElementById('val-font').textContent = `${v}px`;
      this._save('fontSize', v);
      // Aplica em tempo real
      const host = document.getElementById('linguaflow-subtitle-host');
      if (host) host.style.setProperty('--lf-font-size', `${v}px`);
    };

    // Tamanho legenda tradução (NOVO)
    s.getElementById('rng-font-trans').oninput = (e) => {
      const v = Number(e.target.value);
      s.getElementById('val-font-trans').textContent = `${v}px`;
      this._save('fontSizeTrans', v);
      // Aplica em tempo real
      const host = document.getElementById('linguaflow-subtitle-host');
      if (host) host.style.setProperty('--lf-font-size-trans', `${v}px`);
    };

    s.getElementById('rng-bg').oninput = (e) => {
      const v = e.target.value;
      s.getElementById('val-bg').textContent = `${v}%`;
      this._save('bgOpacity', v / 100);
      const host = document.getElementById('linguaflow-subtitle-host');
      if (host) host.style.setProperty('--lf-bg-opacity', v / 100);
    };

    s.getElementById('rng-position').oninput = (e) => {
      const v = Number(e.target.value);
      s.getElementById('val-position').textContent = `${v}px`;
      this._save('subtitleBottom', v);
      window.dispatchEvent(new CustomEvent('LF_UPDATE_POSITION', { detail: v }));
    };

    s.getElementById('rng-horizontal').oninput = (e) => {
      const v = Number(e.target.value);
      s.getElementById('val-horizontal').textContent = `${v}%`;
      this._save('subtitleHorizontal', v);
      window.dispatchEvent(new CustomEvent('LF_UPDATE_HORIZONTAL', { detail: v }));
    };

    s.getElementById('rng-delay').oninput = (e) => {
      const v = Number(e.target.value);
      s.getElementById('val-delay').textContent = `${v}s`;
      this._save('translationDelay', v);
      window.dispatchEvent(new CustomEvent('LF_UPDATE_DELAY', { detail: v }));
    };

    s.getElementById('rng-anticipation').oninput = (e) => {
      const v = Number(e.target.value);
      s.getElementById('val-anticipation').textContent = `${v}s`;
      this._save('translationAnticipation', v);
      window.dispatchEvent(new CustomEvent('LF_UPDATE_ANTICIPATION', { detail: v }));
    };

    // Tempo do flash de tradução (NOVO)
    s.getElementById('rng-flash').oninput = (e) => {
      const v = Number(e.target.value);
      s.getElementById('val-flash').textContent = `${v}s`;
      this._save('flashDuration', v);
      window.dispatchEvent(new CustomEvent('LF_UPDATE_FLASH_DURATION', { detail: v }));
    };

    s.getElementById('col-known').onchange = (e) => this._save('wordColorKnown', e.target.value);
    s.getElementById('col-saved').onchange = (e) => this._save('wordColorSaved', e.target.value);

    s.getElementById('btn-save-settings').onclick = async () => {
      const btn = s.getElementById('btn-save-settings');
      btn.textContent = '✅ Salvo!';
      btn.style.background = '#059669';
      for (const [key, value] of Object.entries(this.cfg)) {
        await writeSetting(key, value);
      }
      window.dispatchEvent(new CustomEvent('LF_SETTINGS_CHANGED'));
      setTimeout(() => {
        btn.textContent = '💾 Salvar';
        btn.style.background = '#10B981';
      }, 2000);
    };

    s.getElementById('btn-export-data').onclick = () => {
      window.open(chrome.runtime.getURL('dashboard/dashboard.html'), '_blank');
    };
  }

  _html() {
    return `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
            @import url('https://fonts.cdnfonts.com/css/opendyslexic');
            * { box-sizing: border-box; }
            .overlay {
                display: none; position: fixed; inset: 0;
                background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
                pointer-events: auto; justify-content: flex-end; z-index: 2147483647;
            }
            .panel.theme-light {
                background: #ffffff;
                border-left: 2px solid #d1d5db;
                color: #3c3c3c;
            }
            .panel.theme-light .panel-header { background: #ffffff; border-bottom-color: #d1d5db; }
            .panel.theme-light .panel-title { color: #3c3c3c; }
            .panel.theme-light .close-btn { color: #777777; }
            .panel.theme-light .close-btn:hover { background: #f7f7f7; color: #4b4b4b; border-color: #d1d5db; }
            .panel.theme-light .section-title { color: #777777; }
            .panel.theme-light .card { background: #ffffff; border-color: #d1d5db; }
            .panel.theme-light .card:hover { border-color: #9ca3af; }
            .panel.theme-light .group label { color: #3c3c3c; }
            .panel.theme-light .group small { color: #777777; }
            .panel.theme-light select { background: #f7f7f7; border-color: #d1d5db; color: #3c3c3c; }
            .panel.theme-light select:hover { background: #e5e5e5; }
            .panel.theme-light select:focus { background: #ffffff; }
            .panel.theme-light input[type=range] { background: #d1d5db; }
            .panel.theme-light .shortcut-item { background: #ffffff; border-color: #d1d5db; color: #777777; }
            .panel.theme-light kbd { background: #ffffff; border-color: #d1d5db; color: #3c3c3c; }
            .panel.theme-light .preview-box { background: #f7f7f7; border-color: #d1d5db; }
            .panel.theme-light .preview-orig { color: #3c3c3c; }
            .panel.theme-light .footer-btns { background: #ffffff; border-top-color: #d1d5db; }
            .panel.theme-light .btn-secondary { background: #ffffff; border-color: #d1d5db; }
            .panel.theme-light .btn-secondary:hover { background: #f7f7f7; border-color: #9ca3af; }
            .panel.theme-light .color-row { background: #f7f7f7; border-color: #d1d5db; }
            .panel.theme-light input[type=color] { border-color: #d1d5db; }
            .panel.theme-light .color-label { color: #3c3c3c; }

            .panel.theme-dark {
                background: #0f172a; /* Escuro */
                border-left: 2px solid #1e293b;
                color: #f8fafc;
            }
            .panel.theme-dark .panel-header { background: #0f172a; border-bottom-color: #1e293b; }
            .panel.theme-dark .panel-title { color: #f8fafc; }
            .panel.theme-dark .close-btn { color: #94a3b8; }
            .panel.theme-dark .close-btn:hover { background: #1e293b; color: #f8fafc; border-color: #334155; }
            .panel.theme-dark .section-title { color: #94a3b8; }
            .panel.theme-dark .card { background: #0f172a; border-color: #1e293b; }
            .panel.theme-dark .card:hover { border-color: #334155; }
            .panel.theme-dark .group label { color: #f8fafc; }
            .panel.theme-dark .group small { color: #94a3b8; }
            .panel.theme-dark select { background: #1e293b; border-color: #334155; color: #f8fafc; }
            .panel.theme-dark select:hover { background: #334155; }
            .panel.theme-dark select:focus { background: #0f172a; }
            .panel.theme-dark input[type=range] { background: #1e293b; }
            .panel.theme-dark .shortcut-item { background: #0f172a; border-color: #1e293b; color: #94a3b8; }
            .panel.theme-dark kbd { background: #1e293b; border-color: #334155; color: #f8fafc; }
            .panel.theme-dark .preview-box { background: #1e293b; border-color: #334155; }
            .panel.theme-dark .preview-orig { color: #f8fafc; }
            .panel.theme-dark .footer-btns { background: #0f172a; border-top-color: #1e293b; }
            .panel.theme-dark .btn-secondary { background: #1e293b; border-color: #334155; }
            .panel.theme-dark .btn-secondary:hover { background: #334155; border-color: #475569; }
            .panel.theme-dark .color-row { background: #1e293b; border-color: #334155; }
            .panel.theme-dark input[type=color] { border-color: #334155; }
            .panel.theme-dark .color-label { color: #f8fafc; }

            .panel {
                width: 360px; height: 100%;
                font-family: 'Nunito', sans-serif;
                box-shadow: -10px 0 30px rgba(0,0,0,0.5);
                display: flex; flex-direction: column;
                animation: slideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.2);
            }
            @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
            
            .panel-header {
                display: flex; align-items: center; justify-content: space-between;
                padding: 14px 16px; border-bottom: 2px solid;
                flex-shrink: 0;
            }
            .panel-title { 
                margin: 0; font-size: 18px; font-weight: 800; 
                display: flex; align-items: center; gap: 10px;
            }
            .panel-title svg { width: 22px; height: 22px; color: #58cc02; }
            .close-btn {
                background: transparent; border: 2px solid transparent;
                cursor: pointer; border-radius: 12px;
                width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
                transition: all 0.2s;
            }
            .close-btn:hover { border-bottom-width: 4px; transform: translateY(-2px); }
            .close-btn:active { border-bottom-width: 2px; transform: translateY(0); }
            .close-btn svg { width: 24px; height: 24px; }
            
            .panel-body { flex: 1; overflow-y: auto; padding: 16px; }
            .panel-body::-webkit-scrollbar { width: 8px; }
            .panel-body::-webkit-scrollbar-track { background: transparent; }
            .panel-body::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 8px; }
            .panel-body::-webkit-scrollbar-thumb:hover { background: #334155; }
            
            .section { margin-bottom: 20px; }
            .section-title {
                display: flex; align-items: center; gap: 8px;
                font-size: 12px; font-weight: 800;
                text-transform: uppercase; letter-spacing: 1.5px;
                margin: 0 0 10px 0;
            }
            .section-title svg { width: 16px; height: 16px; stroke-width: 2.5; }
            
            .card {
                border: 2px solid;
                border-bottom-width: 4px;
                border-radius: 12px;
                padding: 14px;
                margin-bottom: 10px;
                transition: border-color 0.2s;
            }
            
            .group { margin-bottom: 14px; }
            .group:last-child { margin-bottom: 0; }
            .group label { font-size: 13px; font-weight: 800; display: block; margin-bottom: 6px; }
            .group small { display: block; font-size: 12px; margin-top: 6px; line-height: 1.4; font-weight: 700; }
            
            select {
                width: 100%; padding: 10px 14px;
                border: 2px solid; border-bottom-width: 4px;
                border-radius: 10px; font-family: 'Nunito', sans-serif;
                font-size: 13px; font-weight: 700; cursor: pointer; outline: none; appearance: none;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%2394a3b8' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
                background-repeat: no-repeat; background-position: right 12px center; background-size: 20px;
                transition: all 0.2s;
            }
            select:active { border-bottom-width: 2px; transform: translateY(2px); margin-bottom: 2px; }
            
            .slider-row { display: flex; align-items: center; gap: 16px; margin-top: 12px; }
            input[type=range] {
                flex: 1; height: 10px; border-radius: 5px; outline: none;
                border: none; cursor: pointer;
                -webkit-appearance: none;
            }
            input[type=range]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 24px; height: 24px; border-radius: 50%; background: #1cb0f6;
                cursor: pointer;
                border: 4px solid #0f172a;
                box-shadow: 0 2px 5px rgba(0,0,0,0.5);
                transition: transform 0.1s;
            }
            .panel.theme-light input[type=range]::-webkit-slider-thumb { border-color: #ffffff; }
            input[type=range]::-webkit-slider-thumb:active { transform: scale(1.15); }
            
            .slider-val { font-size: 13px; color: #1cb0f6; font-weight: 800; min-width: 46px; text-align: center; background: rgba(28, 176, 246, 0.1); padding: 4px 8px; border-radius: 8px; border: 2px solid transparent; }
            
            .color-row { display: flex; gap: 12px; align-items: center; margin-bottom: 8px; padding: 10px 12px; border-radius: 10px; border: 2px solid; border-bottom-width: 4px; }
            .color-row:last-child { margin-bottom: 0; }
            input[type=color] {
                width: 36px; height: 36px; border: 2px solid; border-bottom-width: 4px;
                border-radius: 50%; cursor: pointer; background: none; padding: 0;
                overflow: hidden; transition: transform 0.1s;
            }
            input[type=color]:active { transform: translateY(2px); border-bottom-width: 2px; }
            input[type=color]::-webkit-color-swatch-wrapper { padding: 0; }
            input[type=color]::-webkit-color-swatch { border: none; border-radius: 50%; }
            .color-label { font-size: 13px; font-weight: 800; }
            
            .shortcuts-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
            .shortcut-item {
                display: flex; justify-content: space-between; align-items: center;
                padding: 10px 12px; border-radius: 10px;
                border: 2px solid; border-bottom-width: 4px;
                font-size: 13px; font-weight: 700;
            }
            kbd {
                border: 2px solid; border-bottom-width: 4px;
                padding: 6px 12px; border-radius: 10px;
                font-family: 'Nunito', monospace; font-weight: 900; font-size: 14px;
            }
            
            .preview-box {
                border-radius: 12px; padding: 16px;
                margin-top: 14px; text-align: center; border: 2px solid; border-bottom-width: 4px;
            }
            .preview-orig  { font-weight: 900; font-size: 14px; }
            .preview-trans { color: #1cb0f6; font-weight: 800; font-size: 12px; margin-top: 6px; }
            
            .footer-btns {
                padding: 12px 16px; border-top: 2px solid;
                display: flex; gap: 10px; flex-shrink: 0;
            }
            .btn {
                flex: 1; padding: 11px 8px; border-radius: 12px; border: 2px solid transparent; border-bottom-width: 4px;
                font-weight: 800; font-size: 13px; font-family: 'Nunito', sans-serif;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 6px;
            }
            .btn svg { width: 16px; height: 16px; stroke-width: 2.5; flex-shrink: 0; }
            .btn-primary {
                background: #58cc02; color: #ffffff; border-color: #58a700;
            }
            .btn-primary:hover { filter: brightness(1.05); }
            .btn-primary:active { transform: translateY(2px); border-bottom-width: 2px; margin-bottom: 2px; }
            
            .btn-secondary {
                color: #1cb0f6;
            }
            .btn-secondary:hover { background: #334155; border-color: #475569; }
            .btn-secondary:active { transform: translateY(2px); border-bottom-width: 2px; margin-bottom: 2px; }
        </style>

        <div class="overlay" id="overlay">
            <div class="panel">
                <div class="panel-header">
                    <h2 class="panel-title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/></svg>
                        LinguaFlow
                    </h2>
                    <button class="close-btn" id="btn-close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div class="panel-body">

                    <!-- IDIOMAS -->
                    <div class="section">
                        <div class="section-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
                            Idiomas
                        </div>
                        <div class="card">
                            <div class="group">
                                <label>Idioma da Tradução (para)</label>
                                <select id="sel-lang">
                                    <option value="pt">Português BR</option>
                                    <option value="es">Español</option>
                                    <option value="fr">Français</option>
                                    <option value="de">Deutsch</option>
                                    <option value="en">English</option>
                                </select>
                            </div>
                            <div class="group">
                                <label>Idioma do Vídeo (original)</label>
                                <select id="sel-source-lang">
                                    <option value="en">English 🇬🇧</option>
                                    <option value="es">Español 🇪🇸</option>
                                    <option value="fr">Français 🇫🇷</option>
                                    <option value="de">Deutsch 🇩🇪</option>
                                    <option value="ja">日本語 🇯🇵</option>
                                    <option value="ko">한국어 🇰🇷</option>
                                    <option value="pt">Português 🇧🇷</option>
                                </select>
                                <small>Idioma falado no vídeo — usado para buscar a legenda original correta.</small>
                            </div>
                        </div>
                    </div>

                    <!-- ESTÉTICA E ACESSIBILIDADE PREMIUM -->
                    <div class="section">
                        <div class="section-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="6.5"/></svg>
                            Aparência e Acessibilidade
                        </div>
                        <div class="card">
                            <div class="group">
                                <label>Tipografia das Legendas</label>
                                <select id="sel-font-family">
                                    <option value="Inter">Inter (Moderna/Padrão)</option>
                                    <option value="Merriweather">Merriweather (Clássica)</option>
                                    <option value="OpenDyslexic">OpenDyslexic (Acessibilidade)</option>
                                </select>
                            </div>
                            <div class="group" style="display:none;">
                                <label>Paleta de Cores Semântica</label>
                                <select id="sel-palette">
                                    <option value="Vibrant">Vibrante (Cores Vivas)</option>
                                    <option value="Pastel">Pastel (Suave)</option>
                                    <option value="Colorblind">Acessibilidade (Daltônicos)</option>
                                </select>
                                <small>Define as cores para palavras conhecidas e em aprendizado.</small>
                            </div>
                        </div>
                    </div>

                    <!-- EXIBIÇÃO DE LEGENDAS -->
                    <div class="section">
                        <div class="section-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
                            Exibição de Legendas
                        </div>
                        
                        <div class="card">
                            <div class="group">
                                <label>Tema da Interface</label>
                                <select id="sel-theme">
                                    <option value="light">Modo Claro</option>
                                    <option value="dark">Modo Escuro</option>
                                </select>
                            </div>
                            <div class="group">
                                <label>Modo de Exibição</label>
                                <select id="sel-mode">
                                    <option value="bilingual">Bilíngue (Original + Tradução)</option>
                                    <option value="blur">Bilíngue (Tradução Oculta/Borrada)</option>
                                    <option value="native">Apenas Original</option>
                                    <option value="translated">Apenas Tradução</option>
                                </select>
                            </div>

                            <div class="group">
                                <label>Tamanho: Idioma Original</label>
                                <div class="slider-row">
                                    <input type="range" id="rng-font" min="14" max="72" step="1" value="31">
                                    <span class="slider-val" id="val-font">31px</span>
                                </div>
                            </div>

                            <div class="group">
                                <label>Tamanho: Tradução</label>
                                <div class="slider-row">
                                    <input type="range" id="rng-font-trans" min="10" max="56" step="1" value="18">
                                    <span class="slider-val" id="val-font-trans">18px</span>
                                </div>
                            </div>
                            
                            <div class="group" style="margin-top:20px;">
                                <label>Opacidade do Fundo</label>
                                <div class="slider-row">
                                    <input type="range" id="rng-bg" min="0" max="100" value="45">
                                    <span class="slider-val" id="val-bg">45%</span>
                                </div>
                            </div>

                            <div class="group">
                                <label>Posição Vertical</label>
                                <div class="slider-row">
                                    <input type="range" id="rng-position" min="20" max="400" value="84">
                                    <span class="slider-val" id="val-position">84px</span>
                                </div>
                            </div>

                            <div class="group">
                                <label>Alinhamento Horizontal</label>
                                <div class="slider-row">
                                    <input type="range" id="rng-horizontal" min="0" max="100" value="45">
                                    <span class="slider-val" id="val-horizontal">45%</span>
                                </div>
                            </div>

                            <div class="preview-box" id="preview-box">
                                <div class="preview-orig" id="preview-orig" style="font-size:31px;">Hello world</div>
                                <div class="preview-trans" id="preview-trans" style="font-size:18px;">Olá mundo</div>
                            </div>
                        </div>
                    </div>

                    <!-- REPRODUÇÃO & COMPORTAMENTO -->
                    <div class="section">
                        <div class="section-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            Reprodução e Comportamento
                        </div>
                        <div class="card">
                            <div class="group">
                                <label>Pausa Automática</label>
                                <select id="sel-autopause">
                                    <option value="on">Ativada (Pausa após cada fala)</option>
                                    <option value="off">Desativada</option>
                                </select>
                            </div>
                            <div class="group">
                                <label>Sincronia das Legendas (Offset)</label>
                                <div class="slider-row">
                                    <input type="range" id="rng-anticipation" min="-2" max="2" step="0.1" value="0">
                                    <span class="slider-val" id="val-anticipation">0s</span>
                                </div>
                                <small>Corrige legendas fora de sincronia.</small>
                            </div>
                            <div class="group">
                                <label>Atrasar Tradução</label>
                                <div class="slider-row">
                                    <input type="range" id="rng-delay" min="0" max="5" step="0.1" value="0">
                                    <span class="slider-val" id="val-delay">0s</span>
                                </div>
                                <small>Força você a tentar entender o áudio antes da legenda traduzida aparecer.</small>
                            </div>
                            <div class="group">
                                <label>Tempo do botão "Traduzir"</label>
                                <div class="slider-row">
                                    <input type="range" id="rng-flash" min="1" max="15" step="0.5" value="4">
                                    <span class="slider-val" id="val-flash">4s</span>
                                </div>
                                <small>Duração da tradução na tela quando requisitada manualmente.</small>
                            </div>
                            <div class="group">
                                <label>Velocidade de Pronúncia TTS</label>
                                <select id="sel-tts-speed">
                                    <option value="1.0">1.0x (Normal)</option>
                                    <option value="0.75">0.75x (Lenta)</option>
                                    <option value="0.5">0.5x (Muito Lenta)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- AVANÇADO / CEFR -->
                    <div class="section">
                        <div class="section-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            Imersão & Destaques (CEFR)
                        </div>
                        <div class="card">
                            <div class="group">
                                <label>Destaque Automático de Nível</label>
                                <select id="sel-cefr-level">
                                    <option value="none">Desativado</option>
                                    <option value="all">Todos os Níveis (A1-C2)</option>
                                    <option value="A1">A1 (Iniciante)</option>
                                    <option value="A2">A2 (Básico)</option>
                                    <option value="B1">B1 (Intermediário)</option>
                                    <option value="B2">B2 (Independente)</option>
                                    <option value="C1">C1 (Avançado)</option>
                                    <option value="C2">C2 (Fluente)</option>
                                </select>
                                <small>Destaca na legenda palavras do nível escolhido.</small>
                            </div>
                            <div class="group">
                                <label>Mostrar Cores do Nível CEFR</label>
                                <select id="sel-cefr-colors">
                                    <option value="on">Ativado</option>
                                    <option value="off">Desativado</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- VOCABULÁRIO -->
                    <div class="section">
                        <div class="section-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                            Seu Vocabulário
                        </div>
                        <div class="card">
                            <div class="color-row">
                                <input type="color" id="col-known" value="#86EFAC">
                                <span class="color-label">Palavras que você já sabe</span>
                            </div>
                            <div class="color-row">
                                <input type="color" id="col-saved" value="#93C5FD">
                                <span class="color-label">Palavras que está aprendendo</span>
                            </div>
                        </div>
                    </div>

                    <!-- ATALHOS -->
                    <div class="section">
                        <div class="section-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><line x1="6" y1="8" x2="6.01" y2="8"/><line x1="10" y1="8" x2="10.01" y2="8"/><line x1="14" y1="8" x2="14.01" y2="8"/><line x1="18" y1="8" x2="18.01" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="6" y1="16" x2="18" y2="16"/></svg>
                            Atalhos do Teclado
                        </div>
                        <div class="card" style="padding: 12px;">
                            <div class="shortcuts-grid">
                                <div class="shortcut-item"><span>Fala Anterior</span><kbd>A</kbd></div>
                                <div class="shortcut-item"><span>Repetir Fala</span><kbd>S</kbd></div>
                                <div class="shortcut-item"><span>Próxima Fala</span><kbd>D</kbd></div>
                                <div class="shortcut-item"><span>Auto-Pausa</span><kbd>Q</kbd></div>
                                <div class="shortcut-item"><span>Revisão Rápida</span><kbd>R</kbd></div>
                                <div class="shortcut-item"><span>Painel Lateral</span><kbd>L</kbd></div>
                                <div class="shortcut-item"><span>Configurações</span><kbd>O</kbd></div>
                            </div>
                        </div>
                    </div>

                </div>

                <div class="footer-btns">
                    <button id="btn-save-settings" class="btn btn-primary">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Salvar
                    </button>
                    <button id="btn-export-data" class="btn btn-secondary">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                        Dashboard
                    </button>
                </div>
            </div>
        </div>`;
  }

  _attachListeners() {
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key.toLowerCase() === 'o') this.toggle();
    });
    window.addEventListener('LF_TOGGLE_SETTINGS', () => this.toggle());

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
    });
  }

  toggle() {
    if (!this.shadow) return;
    this.isOpen ? this.close() : this.open();
  }
  open() {
    if (!this.shadow) return;
    this.isOpen = true;
    this.shadow.getElementById('overlay').style.display = 'flex';
  }
  close() {
    if (!this.shadow) return;
    this.isOpen = false;
    this.shadow.getElementById('overlay').style.display = 'none';
  }

  async _save(key, value) {
    this.cfg[key] = value;
    await writeSetting(key, value);
    this._applyToEngine();
  }

  _applyToEngine() {
    if (!this.engine) return;

    this.engine.displayMode = this.cfg.subtitleMode;
    this.engine.targetLang = this.cfg.targetLang;
    this.engine.sourceLang = this.cfg.sourceLang || 'en';
    this.engine.translationDelay = this.cfg.translationDelay;
    // No YouTube, antecipação deve ser sempre 0 para sincronização perfeita
    this.engine.translationAnticipation = this.cfg.translationAnticipation;
    this.engine.autoPause = this.cfg.autoPause;
    this.engine.flashDuration = this.cfg.flashDuration;

    this.engine.cefrColorsEnabled = this.cfg.cefrColorsEnabled;

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
