// content/settings-panel.js
const DB_NAME = 'LinguaFlowFreeDB';

async function readAllSettings() {
    const { db } = await import('../utils/db.js');
    const settings = ['targetLang', 'subtitleMode', 'bgOpacity', 'fontSize', 'fontSizeTrans', 'autoPause', 'showOriginal', 'showTranslation', 'subtitleBottom', 'subtitleHorizontal', 'translationDelay', 'translationAnticipation', 'flashDuration', 'wordColorKnown', 'wordColorSaved'];
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
        this.host   = null;
        this.shadow = null;

        this.cfg = {
            targetLang:              'pt',
            subtitleMode:            'bilingual',
            bgOpacity:               0.45,
            fontSize:                31,       // tamanho legenda original
            fontSizeTrans:           18,       // tamanho legenda tradução (NOVO)
            wordColorKnown:          '#86EFAC',
            wordColorSaved:          '#93C5FD',
            autoPause:               false,
            showOriginal:            true,
            showTranslation:         true,
            subtitleBottom:          84,
            subtitleHorizontal:      45,
            translationDelay:        0,
            translationAnticipation: 0,
            flashDuration:           4,        // segundos do flash de tradução (NOVO)
        };

        this._init();
    }

    async _init() {
        const saved = await readAllSettings();
        this.cfg = { ...this.cfg, ...saved };
        this._buildDOM();
        this._attachListeners();
        this._applyToEngine();
        if (!document.getElementById('linguaflow-subtitle-host')) {
            setTimeout(() => this._applyToEngine(), 1000);
            setTimeout(() => this._applyToEngine(), 3000);
        }
    }

    _buildDOM() {
        this.host = document.createElement('div');
        this.host.id = 'lf-settings-host';
        Object.assign(this.host.style, {
            position: 'fixed', top: '0', left: '0',
            width: '100%', height: '100%',
            zIndex: '2147483648', pointerEvents: 'none',
        });

        this.shadow = this.host.attachShadow({ mode: 'open' });
        this.shadow.innerHTML = this._html();
        document.body.appendChild(this.host);

        const s = this.shadow;

        // Preenche valores
        s.getElementById('sel-lang').value          = this.cfg.targetLang;
        s.getElementById('sel-mode').value          = this.cfg.subtitleMode;
        s.getElementById('sel-autopause').value     = this.cfg.autoPause ? 'on' : 'off';
        s.getElementById('rng-font').value          = this.cfg.fontSize;
        s.getElementById('rng-font-trans').value    = this.cfg.fontSizeTrans;
        s.getElementById('rng-bg').value            = Math.round(this.cfg.bgOpacity * 100);
        s.getElementById('rng-position').value      = this.cfg.subtitleBottom;
        s.getElementById('rng-horizontal').value    = this.cfg.subtitleHorizontal;
        s.getElementById('rng-delay').value         = this.cfg.translationDelay;
        // No YouTube, slider de antecipação sempre 0
        s.getElementById('rng-anticipation').value  = this.cfg.translationAnticipation;
        s.getElementById('rng-flash').value         = this.cfg.flashDuration;
        s.getElementById('col-known').value         = this.cfg.wordColorKnown;
        s.getElementById('col-saved').value         = this.cfg.wordColorSaved;

        s.getElementById('val-font').textContent        = `${this.cfg.fontSize}px`;
        s.getElementById('val-font-trans').textContent  = `${this.cfg.fontSizeTrans}px`;
        s.getElementById('val-bg').textContent          = `${Math.round(this.cfg.bgOpacity * 100)}%`;
        s.getElementById('val-position').textContent    = `${this.cfg.subtitleBottom}px`;
        s.getElementById('val-horizontal').textContent  = `${this.cfg.subtitleHorizontal}%`;
        s.getElementById('val-delay').textContent       = `${this.cfg.translationDelay}s`;
        // No YouTube, sempre mostra 0s no slider de antecipação
        s.getElementById('val-anticipation').textContent = `${this.cfg.translationAnticipation}s`;
        s.getElementById('val-flash').textContent       = `${this.cfg.flashDuration}s`;

        // Handlers
        s.getElementById('btn-close').onclick  = () => this.close();
        s.getElementById('overlay').onclick    = e => { if (e.target === s.getElementById('overlay')) this.close(); };

        s.getElementById('sel-lang').onchange = e => this._save('targetLang', e.target.value);
        s.getElementById('sel-mode').onchange = e => this._save('subtitleMode', e.target.value);

        s.getElementById('sel-autopause').onchange = e => {
            const val = e.target.value === 'on';
            this._save('autoPause', val);
            window.dispatchEvent(new CustomEvent('LF_UPDATE_AUTOPAUSE', { detail: val }));
        };

        // Tamanho legenda original
        s.getElementById('rng-font').oninput = e => {
            const v = Number(e.target.value);
            s.getElementById('val-font').textContent = `${v}px`;
            this._save('fontSize', v);
            // Aplica em tempo real
            const host = document.getElementById('linguaflow-subtitle-host');
            if (host) host.style.setProperty('--lf-font-size', `${v}px`);
        };

        // Tamanho legenda tradução (NOVO)
        s.getElementById('rng-font-trans').oninput = e => {
            const v = Number(e.target.value);
            s.getElementById('val-font-trans').textContent = `${v}px`;
            this._save('fontSizeTrans', v);
            // Aplica em tempo real
            const host = document.getElementById('linguaflow-subtitle-host');
            if (host) host.style.setProperty('--lf-font-size-trans', `${v}px`);
        };

        s.getElementById('rng-bg').oninput = e => {
            const v = e.target.value;
            s.getElementById('val-bg').textContent = `${v}%`;
            this._save('bgOpacity', v / 100);
            const host = document.getElementById('linguaflow-subtitle-host');
            if (host) host.style.setProperty('--lf-bg-opacity', v / 100);
        };

        s.getElementById('rng-position').oninput = e => {
            const v = Number(e.target.value);
            s.getElementById('val-position').textContent = `${v}px`;
            this._save('subtitleBottom', v);
            window.dispatchEvent(new CustomEvent('LF_UPDATE_POSITION', { detail: v }));
        };

        s.getElementById('rng-horizontal').oninput = e => {
            const v = Number(e.target.value);
            s.getElementById('val-horizontal').textContent = `${v}%`;
            this._save('subtitleHorizontal', v);
            window.dispatchEvent(new CustomEvent('LF_UPDATE_HORIZONTAL', { detail: v }));
        };

        s.getElementById('rng-delay').oninput = e => {
            const v = Number(e.target.value);
            s.getElementById('val-delay').textContent = `${v}s`;
            this._save('translationDelay', v);
            window.dispatchEvent(new CustomEvent('LF_UPDATE_DELAY', { detail: v }));
        };

        s.getElementById('rng-anticipation').oninput = e => {
            const v = Number(e.target.value);
            s.getElementById('val-anticipation').textContent = `${v}s`;
            this._save('translationAnticipation', v);
            window.dispatchEvent(new CustomEvent('LF_UPDATE_ANTICIPATION', { detail: v }));
        };

        // Tempo do flash de tradução (NOVO)
        s.getElementById('rng-flash').oninput = e => {
            const v = Number(e.target.value);
            s.getElementById('val-flash').textContent = `${v}s`;
            this._save('flashDuration', v);
            window.dispatchEvent(new CustomEvent('LF_UPDATE_FLASH_DURATION', { detail: v }));
        };

        s.getElementById('col-known').onchange = e => this._save('wordColorKnown', e.target.value);
        s.getElementById('col-saved').onchange = e => this._save('wordColorSaved', e.target.value);

        s.getElementById('btn-save-settings').onclick = async () => {
            const btn = s.getElementById('btn-save-settings');
            btn.textContent = '✅ Salvo!';
            btn.style.background = '#059669';
            for (const [key, value] of Object.entries(this.cfg)) {
                await writeSetting(key, value);
            }
            setTimeout(() => {
                btn.textContent = '💾 Salvar Configurações';
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
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            * { box-sizing: border-box; }
            .overlay {
                display: none; position: absolute; inset: 0;
                background: rgba(0,0,0,0.55); backdrop-filter: blur(3px);
                pointer-events: auto; justify-content: flex-end;
            }
            .panel {
                width: 420px; height: 100%; background: #0A1628;
                color: #F1F5F9; font-family: 'Inter', sans-serif;
                box-shadow: -20px 0 60px rgba(0,0,0,0.6);
                padding: 0; display: flex; flex-direction: column;
                animation: slideIn 0.3s cubic-bezier(0.16,1,0.3,1);
            }
            @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
            .panel-header {
                display: flex; align-items: center; justify-content: space-between;
                padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.08);
                background: linear-gradient(135deg, #0F172A, #0A1628);
                flex-shrink: 0;
            }
            .panel-title { margin: 0; font-size: 18px; font-weight: 700; }
            .panel-title span { color: #38BDF8; }
            .close-btn {
                background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
                color: #94A3B8; font-size: 16px; cursor: pointer; border-radius: 8px;
                width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
                transition: 0.2s;
            }
            .close-btn:hover { background: rgba(255,255,255,0.12); color: #FFF; }
            .panel-body { flex: 1; overflow-y: auto; padding: 20px 24px; }
            .panel-body::-webkit-scrollbar { width: 4px; }
            .panel-body::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
            .section { margin-bottom: 24px; }
            .section-title {
                font-size: 10px; font-weight: 700; color: #38BDF8;
                text-transform: uppercase; letter-spacing: 1.5px;
                margin: 0 0 12px 0; padding-bottom: 8px;
                border-bottom: 1px solid rgba(56,189,248,0.15);
            }
            .group { margin-bottom: 14px; }
            .group label { display: block; font-size: 12px; font-weight: 600; color: #94A3B8; margin-bottom: 6px; }
            .group small { display: block; font-size: 11px; color: #475569; margin-top: 4px; line-height: 1.4; }
            select {
                width: 100%; padding: 9px 12px;
                background: #1E293B; border: 1px solid rgba(255,255,255,0.1);
                color: #F1F5F9; border-radius: 8px; font-family: 'Inter', sans-serif;
                font-size: 13px; cursor: pointer; outline: none; appearance: none;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%2394A3B8' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
                background-repeat: no-repeat; background-position: right 8px center; background-size: 20px;
            }
            select:focus { border-color: #38BDF8; }
            .slider-row { display: flex; align-items: center; gap: 10px; }
            input[type=range] {
                flex: 1; height: 4px; border-radius: 4px; outline: none;
                background: #1E293B; border: none; cursor: pointer; accent-color: #38BDF8;
            }
            .slider-val { font-size: 12px; color: #38BDF8; font-weight: 700; min-width: 44px; text-align: right; }
            .color-row { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; }
            input[type=color] {
                width: 36px; height: 36px; border: 2px solid rgba(255,255,255,0.1);
                border-radius: 8px; cursor: pointer; background: none; padding: 0;
            }
            .color-label { font-size: 13px; color: #CBD5E1; }
            .shortcuts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
            .shortcut-item {
                display: flex; justify-content: space-between; align-items: center;
                background: #1E293B; padding: 8px 10px; border-radius: 6px;
                font-size: 12px; color: #94A3B8;
            }
            kbd {
                background: #0F172A; border: 1px solid #334155;
                padding: 2px 7px; border-radius: 4px;
                font-family: monospace; color: #38BDF8; font-weight: 700; font-size: 12px;
            }
            .version-tag {
                padding: 12px 24px; border-top: 1px solid rgba(255,255,255,0.07);
                text-align: center; font-size: 11px; color: #334155; flex-shrink: 0;
            }
            .footer-btns {
                padding: 12px 24px; border-top: 1px solid rgba(255,255,255,0.07);
                display: flex; gap: 8px; flex-shrink: 0;
            }
            .preview-box {
                background: rgba(0,0,0,0.4); border-radius: 8px; padding: 10px 14px;
                margin-top: 8px; text-align: center; border: 1px solid rgba(255,255,255,0.06);
            }
            .preview-orig  { color: #FFF; font-weight: 800; }
            .preview-trans { color: #38BDF8; font-weight: 600; margin-top: 3px; }
        </style>

        <div class="overlay" id="overlay">
            <div class="panel">
                <div class="panel-header">
                    <h2 class="panel-title">⚡ <span>LinguaFlow</span> — Configurações</h2>
                    <button class="close-btn" id="btn-close">✕</button>
                </div>

                <div class="panel-body">

                    <!-- IDIOMAS -->
                    <div class="section">
                        <p class="section-title">🌐 Idiomas</p>
                        <div class="group">
                            <label>Idioma da Tradução</label>
                            <select id="sel-lang">
                                <option value="pt">Português BR 🇧🇷</option>
                                <option value="es">Español 🇪🇸</option>
                                <option value="fr">Français 🇫🇷</option>
                                <option value="de">Deutsch 🇩🇪</option>
                                <option value="en">English 🇺🇸</option>
                            </select>
                        </div>
                    </div>

                    <!-- LEGENDAS -->
                    <div class="section">
                        <p class="section-title">📺 Exibição das Legendas</p>

                        <div class="group">
                            <label>Modo de Legenda</label>
                            <select id="sel-mode">
                                <option value="bilingual">Bilíngue — Original + Tradução ✅</option>
                                <option value="blur">Bilíngue — Tradução Borrada 🔍</option>
                                <option value="native">Apenas Original (sem tradução)</option>
                                <option value="translated">Apenas Tradução (PT)</option>
                            </select>
                        </div>

                        <div class="group">
                            <label>🔤 Tamanho da Legenda Original</label>
                            <div class="slider-row">
                                <input type="range" id="rng-font" min="14" max="72" step="1" value="31">
                                <span class="slider-val" id="val-font">31px</span>
                            </div>
                        </div>

                        <div class="group">
                            <label>🔤 Tamanho da Legenda Tradução</label>
                            <div class="slider-row">
                                <input type="range" id="rng-font-trans" min="10" max="56" step="1" value="18">
                                <span class="slider-val" id="val-font-trans">18px</span>
                            </div>
                            <small>Ajuste independente do tamanho da tradução em azul</small>
                        </div>

                        <!-- Preview em tempo real -->
                        <div class="preview-box" id="preview-box">
                            <div class="preview-orig" id="preview-orig" style="font-size:31px;">Hello world</div>
                            <div class="preview-trans" id="preview-trans" style="font-size:18px;">Olá mundo</div>
                        </div>

                        <div class="group" style="margin-top:14px;">
                            <label>Opacidade do Fundo da Tradução</label>
                            <div class="slider-row">
                                <input type="range" id="rng-bg" min="0" max="100" value="45">
                                <span class="slider-val" id="val-bg">45%</span>
                            </div>
                        </div>

                        <div class="group">
                            <label>Posição Vertical da Legenda</label>
                            <div class="slider-row">
                                <input type="range" id="rng-position" min="20" max="400" value="84">
                                <span class="slider-val" id="val-position">84px</span>
                            </div>
                        </div>

                        <div class="group">
                            <label>Posição Horizontal da Legenda</label>
                            <div class="slider-row">
                                <input type="range" id="rng-horizontal" min="0" max="100" value="45">
                                <span class="slider-val" id="val-horizontal">45%</span>
                            </div>
                            <small>0% = Esquerda | 50% = Centro | 100% = Direita</small>
                        </div>
                    </div>

                    <!-- REPRODUÇÃO -->
                    <div class="section">
                        <p class="section-title">▶️ Reprodução</p>
                        <div class="group">
                            <label>Pausa Automática</label>
                            <select id="sel-autopause">
                                <option value="on">Ligada — Pausa após cada fala</option>
                                <option value="off">Desligada</option>
                            </select>
                        </div>
                    </div>

                    <!-- TRADUÇÃO -->
                    <div class="section">
                        <p class="section-title">⏱️ Velocidade da Tradução</p>

                        <div class="group">
                            <label>⏱️ Sincronia das Legendas (Offset)</label>
                            <div class="slider-row">
                                <input type="range" id="rng-anticipation" min="-2" max="2" step="0.1" value="0">
                                <span class="slider-val" id="val-anticipation">0s</span>
                            </div>
                            <small>-2s = Atrasar Legendas | 0s = Padrão | +2s = Antecipar Legendas</small>
                        </div>

                        <div class="group">
                            <label>Delay da Tradução (Linha Azul)</label>
                            <div class="slider-row">
                                <input type="range" id="rng-delay" min="0" max="5" step="0.1" value="0">
                                <span class="slider-val" id="val-delay">0s</span>
                            </div>
                            <small>Apenas atrasa a exibição da tradução (bom para testar a si mesmo).</small>
                        </div>

                        <div class="group">
                            <label>⏳ Tempo do Flash de Tradução (botão 🌐)</label>
                            <div class="slider-row">
                                <input type="range" id="rng-flash" min="1" max="15" step="0.5" value="4">
                                <span class="slider-val" id="val-flash">4s</span>
                            </div>
                            <small>Quanto tempo a tradução fica visível ao clicar em "🌐 Traduzir".<br>1s = Rápido | 4s = Padrão | 10s+ = Longo</small>
                        </div>
                    </div>

                    <!-- VOCABULÁRIO -->
                    <div class="section">
                        <p class="section-title">🎨 Cores do Vocabulário</p>
                        <div class="color-row">
                            <input type="color" id="col-known" value="#86EFAC">
                            <span class="color-label">Palavras que você já sabe</span>
                        </div>
                        <div class="color-row">
                            <input type="color" id="col-saved" value="#93C5FD">
                            <span class="color-label">Palavras que está aprendendo</span>
                        </div>
                    </div>

                    <!-- ATALHOS -->
                    <div class="section">
                        <p class="section-title">⌨️ Atalhos do Teclado</p>
                        <div class="shortcuts-grid">
                            <div class="shortcut-item"><span>Fala Anterior</span><kbd>A</kbd></div>
                            <div class="shortcut-item"><span>Repetir Fala</span><kbd>S</kbd></div>
                            <div class="shortcut-item"><span>Próxima Fala</span><kbd>D</kbd></div>
                            <div class="shortcut-item"><span>Auto-Pausa</span><kbd>Q</kbd></div>
                            <div class="shortcut-item"><span>Salvar Frase</span><kbd>R</kbd></div>
                            <div class="shortcut-item"><span>Play/Pausa</span><kbd>Space</kbd></div>
                            <div class="shortcut-item"><span>Configurações</span><kbd>O</kbd></div>
                            <div class="shortcut-item"><span>Painel Legendas</span><kbd>L</kbd></div>
                        </div>
                    </div>

                </div>

                <div class="version-tag">LinguaFlow Free — v1.0 · 100% offline · Privado</div>

                <div class="footer-btns">
                    <button id="btn-save-settings" style="flex:1;background:#10B981;color:white;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;font-family:inherit;">
                        💾 Salvar Configurações
                    </button>
                    <button id="btn-export-data" style="flex:1;background:#3B82F6;color:white;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;font-family:inherit;">
                        📊 Dashboard
                    </button>
                </div>
            </div>
        </div>`;
    }

    _attachListeners() {
        document.addEventListener('keydown', e => {
            if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
            if (e.key.toLowerCase() === 'o') this.toggle();
        });
        window.addEventListener('LF_TOGGLE_SETTINGS', () => this.toggle());

        // Atualiza preview em tempo real quando sliders de fonte mudam
        const s = this.shadow;
        s.getElementById('rng-font').addEventListener('input', e => {
            const v = e.target.value;
            s.getElementById('preview-orig').style.fontSize = `${v}px`;
        });
        s.getElementById('rng-font-trans').addEventListener('input', e => {
            const v = e.target.value;
            s.getElementById('preview-trans').style.fontSize = `${v}px`;
        });

        // Escuta evento de flash duration do engine
        window.addEventListener('LF_UPDATE_FLASH_DURATION', e => {
            if (this.engine) this.engine.flashDuration = e.detail;
        });
    }

    toggle() { this.isOpen ? this.close() : this.open(); }
    open()   { this.isOpen = true;  this.shadow.getElementById('overlay').style.display = 'flex'; }
    close()  { this.isOpen = false; this.shadow.getElementById('overlay').style.display = 'none'; }

    async _save(key, value) {
        this.cfg[key] = value;
        await writeSetting(key, value);
        this._applyToEngine();
    }

    _applyToEngine() {
        if (!this.engine) return;

        this.engine.displayMode              = this.cfg.subtitleMode;
        this.engine.targetLang               = this.cfg.targetLang;
        this.engine.translationDelay         = this.cfg.translationDelay;
        // No YouTube, antecipação deve ser sempre 0 para sincronização perfeita
        this.engine.translationAnticipation  = this.cfg.translationAnticipation;
        this.engine.autoPause                = this.cfg.autoPause;
        this.engine.flashDuration            = this.cfg.flashDuration;

        const host = document.getElementById('linguaflow-subtitle-host');
        if (host) {
            host.style.setProperty('--lf-font-size',       `${this.cfg.fontSize}px`);
            host.style.setProperty('--lf-font-size-trans', `${this.cfg.fontSizeTrans}px`);
            host.style.setProperty('--lf-bg-opacity',      this.cfg.bgOpacity);
            host.style.setProperty('--lf-color-known',     this.cfg.wordColorKnown);
            host.style.setProperty('--lf-color-saved',     this.cfg.wordColorSaved);
            host.style.bottom    = `${this.cfg.subtitleBottom}px`;
            host.style.left      = `${this.cfg.subtitleHorizontal}%`;
            host.style.transform = `translateX(-${this.cfg.subtitleHorizontal}%)`;
        } else {
            setTimeout(() => this._applyToEngine(), 1000);
        }
    }
}
