// LinguaFlow Pro — Word Popup v5 (unified storage, bilingual examples, full grammar)

import { db } from '../utils/db.js';
import { getFalseFriendsMap, getCommonIdiomsSet, getCommonChunksSet } from './popup/popup-linguistics.js';
import { isValidIpa, cleanIpa } from '../utils/ipa-validator.js';
import { LookupMethods } from './word-popup/lookup.js';
import { SaveMethods } from './word-popup/save.js';
import { AiContextMethods } from './word-popup/ai-context.js';
import { PositioningMethods } from './word-popup/positioning.js';
import { FirstRecallMethods } from './word-popup/first-recall.js';
import { installMethods } from '../utils/install-methods.js';
import { lookupHintText, recordLookup } from './subtitles/lookup-memory.js';

export class WordPopup {
  constructor(engine, platform) {
    this.engine = engine;
    this.platform = platform;
    this.popup = null;
    this.word = '';
    this.context = '';
    this.contextExplanation = '';
    this.cache = {};
    this._contextRequestId = 0;
    this._contextSession = null;
    this._activeSourceKey = '';
    this._previousFocus = null;
    this._keydownHandler = null;

    this.freqList = null;
  }

  async init() {
    this._build();
    this._initData();
    // O primeiro clique aguarda estes bancos (_expandTermInContext) antes de
    // abrir o popup; carregá-los agora tira essa espera do clique.
    this._getPhrasalVerbsDB();

    try {
      const res = await fetch(chrome.runtime.getURL('utils/frequency-en.json'));
      this.freqList = await res.json();
    } catch (e) {
      console.warn('[WordPopup] Freq list disabled/missing', e);
    }
    try {
      const res = await fetch(chrome.runtime.getURL('utils/cefr-wordlist.json'));
      this.cefrList = await res.json();
    } catch (e) {
      /* sem CEFR wordlist — ok */
    }
  }

  _initData() {
    this._falseFriends = getFalseFriendsMap();
    this._idiomSet = getCommonIdiomsSet();
    this._chunkSet = getCommonChunksSet();
  }
  destroy() {
    this._clearLoginWait();
    this._posObserver?.disconnect();
    this._maxPositionObserver?.disconnect();
    this._maxPositionMutationObserver?.disconnect();
    this._maxPositionAbort?.abort();
    cancelAnimationFrame(this._positionFrame || 0);
    if (this._keydownHandler) document.removeEventListener('keydown', this._keydownHandler, true);
    if (this._mousedownHandler) document.removeEventListener('mousedown', this._mousedownHandler);
    this.popup?.remove();
  }

  _build() {
    document.getElementById('lfp')?.remove();
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#000');
      return result
        ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
        : '255,255,255';
    };
    const cA1 = this.engine?.cefrColors?.A1 || '#4ade80';
    const cA2 = this.engine?.cefrColors?.A2 || '#38bdf8';
    const cB1 = this.engine?.cefrColors?.B1 || '#22d3ee';
    const cB2 = this.engine?.cefrColors?.B2 || '#fbbf24';
    const cC1 = this.engine?.cefrColors?.C1 || '#fb923c';
    const cC2 = this.engine?.cefrColors?.C2 || '#a78bfa';
    const rA1 = hexToRgb(cA1),
      rA2 = hexToRgb(cA2),
      rB1 = hexToRgb(cB1),
      rB2 = hexToRgb(cB2),
      rC1 = hexToRgb(cC1),
      rC2 = hexToRgb(cC2);

    if (!document.getElementById('lfp-k')) {
      const s = document.createElement('style');
      s.id = 'lfp-k';
      s.textContent = `@keyframes lfpIn{from{opacity:0;transform:translateY(10px) scale(0.93)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes lfpSpin{to{transform:rotate(360deg)}}.lfp-spin{width:18px;height:18px;border:2px solid rgba(255,255,255,.1);border-top-color:#a78bfa;border-radius:50%;animation:lfpSpin .6s linear infinite;display:inline-block;vertical-align:middle;margin-right:8px}#lfp *{box-sizing:border-box;margin:0;padding:0}#lfp button,#lfp select,#lfp input{font-family:'Outfit','Segoe UI',sans-serif}.lfp-chip{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:3px 10px;font-size:11px;color:#94a3b8;cursor:pointer;transition:all .12s;display:inline-block}.lfp-chip:hover{color:#7dd3fc;border-color:rgba(125,209,252,.35)}.lfp-chip.red{background:rgba(248,113,113,.06);border-color:rgba(248,113,113,.15);color:#f87171}.lfp-panels::-webkit-scrollbar{width:3px}.lfp-panels::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}.lfp-ph{background:rgba(244,114,182,.06);border:1px solid rgba(244,114,182,.15);border-radius:9px;padding:9px 12px;margin-bottom:7px}.lfp-ex{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px 13px;margin-bottom:8px}.ai-res{white-space:pre-wrap;word-break:break-word}.lfp-btn-bounce{transition:transform 0.12s cubic-bezier(0.175,0.885,0.32,1.275)}.lfp-btn-bounce:active{transform:scale(0.96)}#fsave:hover:not(:disabled){filter:brightness(1.06)}#fsave:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 #46a302 !important}
/* CEFR badges */
.lfp-badge{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:2px 8px;border-radius:20px;line-height:1.6}
.lfp-a1{background:rgba(${rA1},.12);color:${cA1};border:1px solid rgba(${rA1},.25)}
.lfp-a2{background:rgba(${rA2},.12);color:${cA2};border:1px solid rgba(${rA2},.25)}
.lfp-b1{background:rgba(${rB1},.12);color:${cB1};border:1px solid rgba(${rB1},.25)}
.lfp-b2{background:rgba(${rB2},.12);color:${cB2};border:1px solid rgba(${rB2},.25)}
.lfp-c1{background:rgba(${rC1},.12);color:${cC1};border:1px solid rgba(${rC1},.25)}
.lfp-c2{background:rgba(${rC2},.12);color:${cC2};border:1px solid rgba(${rC2},.25)}
/* Expression type badges */
.lfp-type-phrasal{background:rgba(244,114,182,.1);color:#f472b6;border:1px solid rgba(244,114,182,.25)}
.lfp-type-idiom{background:rgba(251,146,60,.1);color:#fb923c;border:1px solid rgba(251,146,60,.25)}
.lfp-type-chunk{background:rgba(139,92,246,.1);color:#a78bfa;border:1px solid rgba(139,92,246,.25)}
.lfp-type-collocation{background:rgba(56,189,248,.1);color:#7dd3fc;border:1px solid rgba(56,189,248,.2)}
.lfp-type-slang{background:rgba(248,113,113,.1);color:#f87171;border:1px solid rgba(248,113,113,.25)}
.lfp-type-reduction{background:rgba(52,211,153,.1);color:#34d399;border:1px solid rgba(52,211,153,.25)}
.lfp-type-formal{background:rgba(99,102,241,.1);color:#818cf8;border:1px solid rgba(99,102,241,.25)}
.lfp-type-word{background:rgba(255,255,255,.05);color:#94a3b8;border:1px solid rgba(255,255,255,.1)}
/* False friend alert */
.lfp-ff{background:rgba(251,146,60,.1);border:1px solid rgba(251,146,60,.3);border-radius:10px;padding:9px 12px;margin-bottom:10px}
.lfp-use-card{background:rgba(139,92,246,.06);border:1px solid rgba(139,92,246,.18);border-radius:10px;padding:10px 13px;margin-bottom:10px;font-family:inherit}
.lfp-use-card.blue{background:rgba(125,209,252,.04);border-color:rgba(125,209,252,.18)}
.lfp-use-card.green{background:rgba(74,222,128,.06);border-color:rgba(74,222,128,.18)}
.lfp-use-card.amber{background:rgba(251,191,36,.06);border-color:rgba(251,191,36,.18)}
.lfp-use-title{font-size:10px;color:#a78bfa;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px;display:flex;align-items:center;gap:5px}
.lfp-use-card.blue .lfp-use-title{color:#7dd3fc}
.lfp-use-card.green .lfp-use-title{color:#4ade80}
.lfp-use-card.amber .lfp-use-title{color:#fbbf24}
.lfp-use-text{font-size:12px;color:#e2e8f0;line-height:1.7}
.lfp-use-muted{font-size:11px;color:#94a3b8;line-height:1.55}
.lfp-mini-chip{display:inline-block;margin:2px 4px 2px 0;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);color:#cbd5e1;font-size:11px;font-weight:700}
#lfp :focus-visible{outline:3px solid #7dd3fc;outline-offset:2px}
@media (prefers-reduced-motion:reduce){#lfp,#lfp *,#lfp *::before,#lfp *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
/* Deck modal */
#lfp-deck-modal{position:absolute;inset:0;background:rgba(8,12,24,.92);backdrop-filter:blur(10px);border-radius:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:10;padding:24px}
#lfp-deck-modal input{width:100%;padding:10px 14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:10px;color:#f8fafc;font-size:14px;outline:none;font-family:inherit}
#lfp-deck-modal input:focus{border-color:#38bdf8}
`;
      document.head.appendChild(s);
    }
    this.popup = document.createElement('div');
    this.popup.id = 'lfp';
    this.popup.setAttribute('role', 'dialog');
    this.popup.setAttribute('aria-modal', 'true');
    this.popup.setAttribute('aria-labelledby', 'fw');
    this.popup.setAttribute('tabindex', '-1');
    Object.assign(this.popup.style, {
      position: 'absolute',
      zIndex: '2147483647',
      background: 'rgba(13, 17, 28, 0.96)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      border: '1px solid rgba(255, 255, 255, 0.14)',
      borderRadius: '24px',
      width: '400px',
      maxWidth: '95vw',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      fontFamily: "'Outfit', 'Inter', system-ui, -apple-system, sans-serif",
      color: '#F8FAFC',
      display: 'none',
      overflow: 'hidden',
      transition: 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      opacity: '0',
      transform: 'translateY(10px) scale(0.95)',
    });
    this.popup.innerHTML = `
<div style="padding:16px 18px 0;display:flex;align-items:flex-start;justify-content:space-between;">
  <div style="flex:1;min-width:0;">
    <div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;">
      <span id="fw" style="font-size:28px;font-weight:800;color:#f8fafc;letter-spacing:-.03em;line-height:1;"></span>
      <span id="fcefr" class="lfp-badge" style="display:none;"></span>
      <span id="fcefr-prog" style="display:none;font-size:10px;color:#94a3b8;font-family:monospace;align-self:center;"></span>
    </div>
    <div id="fipa-wrap" style="display:none;margin-top:10px;">
      <div style="font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:3px;">Pronúncia (IPA)</div>
      <span id="fipa" style="display:block;font-size:25px;line-height:1.25;color:#f8fafc;font-family:'Lucida Sans Unicode','DejaVu Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;letter-spacing:0;"></span>
    </div>
    <div style="display:flex;align-items:center;gap:5px;margin-top:6px;flex-wrap:wrap;">
      <span id="fexprtype" class="lfp-badge" style="display:none;"></span>
      <span id="fpos" class="lfp-badge" style="display:none;background:rgba(125,209,252,.1);color:#7dd3fc;border:1px solid rgba(125,209,252,.2)"></span>
      <span id="ffreq" style="display:none;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:20px;"></span>
    </div>
    <div id="flookup-hint" role="status" style="display:none;margin-top:8px;font-size:11px;line-height:1.5;color:#facc15;background:rgba(250,204,21,.1);border:1px solid rgba(250,204,21,.3);border-radius:8px;padding:5px 9px;"></div>
  </div>
  <div style="display:flex;gap:6px;flex-shrink:0;margin-top:2px;">
    <button id="ftts" type="button" title="Ouvir pronúncia" aria-label="Ouvir pronúncia da palavra" style="min-width:44px;min-height:44px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:9px;color:#7dd3fc;cursor:pointer;padding:6px 9px;font-size:16px;line-height:1;transition:all .15s;">🔊</button>
    <button id="fx" type="button" aria-label="Fechar popup" style="min-width:44px;min-height:44px;background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:4px 7px;border-radius:6px;line-height:1;">✕</button>
  </div>
</div>
<div role="tablist" aria-label="Fontes da palavra" style="display:flex;border-bottom:1px solid rgba(255,255,255,.07);margin-top:12px;padding:0 4px;">
  ${['Tradução', 'Dicionários', 'Pronúncia'].map((l, i) => `<button class="ftab" type="button" role="tab" id="lfp-tab-${i}" aria-controls="lfp-panel-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? '0' : '-1'}" data-i="${i}" style="flex:1;padding:9px 2px;font-size:11px;font-weight:700;color:${i === 0 ? '#7dd3fc' : '#94a3b8'};background:none;border:none;border-bottom:2px solid ${i === 0 ? '#7dd3fc' : 'transparent'};cursor:pointer;letter-spacing:.03em;white-space:nowrap;transition:all .15s;">${l}</button>`).join('')}
</div>
<div class="lfp-panels" style="padding:14px 18px 18px;max-height:400px;overflow-y:auto;">

  <div class="fp" id="lfp-panel-0" role="tabpanel" aria-labelledby="lfp-tab-0" data-p="0">
    <div id="ft" style="font-size:26px;font-weight:800;color:#4ade80;margin-bottom:5px;line-height:1.2;">…</div>
    <section id="fsenses" aria-labelledby="fsenses-title" style="display:none;margin-bottom:12px;"><h3 id="fsenses-title" style="font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:.09em;text-transform:uppercase;margin-bottom:5px;">Outras traduções</h3><dl id="fsenses-list" style="font-size:12px;line-height:1.6;color:#e2e8f0;"></dl></section>
    <div id="fff-card" style="display:none;" class="lfp-ff"><div style="font-size:10px;color:#fb923c;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px;">⚠️ Falso Cognato — Armadilha!</div><div id="fff-text" style="font-size:12px;color:#fcd34d;line-height:1.6;"></div></div>
    <div id="fctx" style="display:none;background:rgba(139,92,246,.06);border:1px solid rgba(139,92,246,.18);border-radius:10px;padding:10px 13px;margin-bottom:12px;"><div style="font-size:10px;color:#a78bfa;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px;display:flex;align-items:center;gap:5px;"><span>💡</span><span>Contexto nesta frase</span></div><div id="fctxt" style="font-size:12px;color:#e2e8f0;line-height:1.7;"></div></div>
    <div id="fc" style="display:none;background:rgba(125,209,252,.04);border-left:3px solid rgba(125,209,252,.3);padding:8px 12px;border-radius:0 8px 8px 0;font-size:12px;color:#cbd5e1;line-height:1.6;margin-bottom:12px;"></div>
    <section id="fvid" aria-labelledby="fvid-title" style="display:none;margin-bottom:12px;"><h3 id="fvid-title" style="font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:.09em;text-transform:uppercase;margin-bottom:6px;">Neste vídeo</h3><ul id="fvid-list" style="list-style:none;display:flex;flex-direction:column;gap:6px;"></ul></section>
    <div id="fsyn" style="display:none;margin-bottom:10px;"><div style="font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:.09em;text-transform:uppercase;margin-bottom:5px;">Sinônimos</div><div id="fsyns" style="display:flex;flex-wrap:wrap;gap:5px;"></div></div>
    <div id="fant" style="display:none;margin-bottom:12px;"><div style="font-size:10px;color:#94a3b8;font-weight:700;letter-spacing:.09em;text-transform:uppercase;margin-bottom:5px;">Antônimos</div><div id="fants" style="display:flex;flex-wrap:wrap;gap:5px;"></div></div>
    <div style="height:1px;background:rgba(255,255,255,.06);margin-bottom:12px;"></div>

    <button id="fsave" class="lfp-btn-bounce" style="display:block;width:100%;padding:11px;background:#58cc02;box-shadow:0 3px 0 #46a302;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer;transition:transform .1s, filter .15s, background .15s;margin-bottom:8px;letter-spacing:.01em;">+ Salvar nos Flashcards</button>
    <button id="fknown" class="lfp-btn-bounce" style="display:block;width:100%;padding:9px;background:rgba(134,239,172,.08);color:#86efac;border:1px solid rgba(134,239,172,.25);border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;margin-bottom:8px;">✓ Já sei esta palavra</button>
    <button id="fignore" type="button" aria-pressed="false" title="Nomes, interjeições e ruído da legenda: sem cor e fora da aba Palavras, sem contar como conhecida" style="display:block;width:100%;min-height:36px;padding:7px;background:none;color:#94a3b8;border:1px dashed rgba(148,163,184,.35);border-radius:11px;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:8px;">⊘ Ignorar esta palavra</button>
    <button id="faisent" class="lfp-btn-bounce" style="display:none;width:100%;padding:9px;background:rgba(251,191,36,.08);color:#fbbf24;border:1px solid rgba(251,191,36,.22);border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;margin-bottom:10px;">🔍 Analisar Frase Completa</button>
    <div id="fair-container" style="display:none;position:relative;">
      <div id="fair" class="ai-res" style="background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);border-radius:12px;padding:12px;font-size:12px;color:#c4b5fd;line-height:1.7;"></div>
      <button id="fcopy-ai" style="position:absolute;top:8px;right:8px;background:rgba(255,255,255,.1);border:none;border-radius:6px;color:#fff;padding:4px 8px;font-size:10px;cursor:pointer;opacity:0.6;">📋 Copiar</button>
    </div>
  </div>

  <div class="fp" id="lfp-panel-1" role="tabpanel" aria-labelledby="lfp-tab-1" data-p="1" style="display:none;padding-top:8px;">
    <div style="font-size:13px;color:#94a3b8;line-height:1.8;margin-bottom:14px;text-align:center;">Traduções em contexto real de textos bilíngues — ideal para ver uso nativo.</div>
    <div id="frev" style="display:none;margin-bottom:14px;max-height:280px;overflow-y:auto;"></div>
    <button id="frevbtn" class="lfp-btn-bounce" style="display:block;width:100%;padding:11px;background:linear-gradient(135deg,#0c4a6e,#0369a1);color:#7dd3fc;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px;">🔄 Reverso Context — Exemplos Reais</button>
    <button id="fl1" style="display:block;width:100%;padding:10px;background:rgba(74,222,128,.08);color:#4ade80;border:1px solid rgba(74,222,128,.25);border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px;">🔗 Linguee — EN ↔ PT</button>
    <button id="fl2" style="display:block;width:100%;padding:9px;background:rgba(74,222,128,.05);color:#4ade80;border:1px solid rgba(74,222,128,.15);border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px;">🇬🇧 Linguee — EN definitions</button>
    <button id="fl3" style="display:block;width:100%;padding:9px;background:rgba(74,222,128,.03);color:#4ade80;border:1px solid rgba(74,222,128,.1);border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;">🌐 Google Translate</button>
  </div>

  <div class="fp" id="lfp-panel-2" role="tabpanel" aria-labelledby="lfp-tab-2" data-p="2" style="display:none;text-align:center;padding-top:8px;">
    <div style="font-size:13px;color:#94a3b8;line-height:1.8;margin-bottom:14px;">Ouça como nativos pronunciam em vídeos reais do YouTube.</div>
    <button id="fy1" class="lfp-btn-bounce" style="display:block;width:100%;padding:12px;background:linear-gradient(135deg,#7c1010,#b91c1c);color:#f87171;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px;">🎬 YouGlish — Qualquer sotaque</button>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
      <button id="fy2" style="padding:10px;background:rgba(248,113,113,.07);color:#f87171;border:1px solid rgba(248,113,113,.2);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">🇺🇸 American</button>
      <button id="fy3" style="padding:10px;background:rgba(248,113,113,.07);color:#f87171;border:1px solid rgba(248,113,113,.2);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">🇬🇧 British</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <button id="fy4" style="padding:10px;background:rgba(248,113,113,.04);color:#f87171;border:1px solid rgba(248,113,113,.12);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">🇦🇺 Australian</button>
      <button id="fy5" style="padding:10px;background:rgba(248,113,113,.04);color:#f87171;border:1px solid rgba(248,113,113,.12);border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">🎓 Academic</button>
    </div>
  </div>

</div>`;
    document.body.appendChild(this.popup);
    window.__lfpopup = this;
    this._bind();

    // Em vez de ResizeObserver e scroll/resize events que podem causar
    // loops infinitos ou ajustes bruscos (especialmente no mobile),
    // usamos um requestAnimationFrame loop leve enquanto o popup estiver visível.
  }

  _q(s) {
    return this.popup.querySelector(s);
  }

  _bind() {
    const q = (s) => this._q(s);
    q('#fx').onclick = (e) => {
      e.stopPropagation();
      this.hide(true);
    };

    // Impede que cliques dentro do popup vazem para o YouTube/Netflix
    this.popup.addEventListener('click', (e) => e.stopPropagation());
    this.popup.addEventListener('mousedown', (e) => e.stopPropagation());

    if (!this._mousedownAttached) {
      this._mousedownHandler = (e) => {
        if (
          this.popup &&
          this.popup.style.display !== 'none' &&
          !this.popup.contains(e.target) &&
          !e.target.closest?.('.lf-word')
        ) {
          this.hide(true);
        }
      };
      document.addEventListener('mousedown', this._mousedownHandler);

      this._mousedownAttached = true;
    }
    const activateTab = (tab, focus = false) => {
      const i = parseInt(tab.dataset.i, 10);
      this.popup.querySelectorAll('.ftab').forEach((item, j) => {
        const selected = j === i;
        item.style.color = selected ? '#7dd3fc' : '#94a3b8';
        item.style.borderBottomColor = selected ? '#7dd3fc' : 'transparent';
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      this.popup.querySelectorAll('.fp').forEach((panel, j) => {
        panel.style.display = j === i ? '' : 'none';
      });
      if (focus) tab.focus();
    };

    // Tabs: setas seguem o padrao WAI-ARIA; Home/End saltam para as pontas.
    this.popup.querySelectorAll('.ftab').forEach((tab) => {
      tab.onclick = () => activateTab(tab);
      tab.onkeydown = (event) => {
        const tabs = [...this.popup.querySelectorAll('.ftab')];
        const current = tabs.indexOf(tab);
        let next = null;
        if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next === null) return;
        event.preventDefault();
        activateTab(tabs[next], true);
      };
    });

    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler, true);
      this._keydownHandler = null;
    }
    this._keydownHandler = (event) => {
      if (!this.popup || this.popup.style.display === 'none') return;
      const recall = this.popup.querySelector('#lfp-recall');
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (recall) {
          recall.remove();
          q('#fx')?.focus({ preventScroll: true });
        } else {
          this.hide(true);
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const scope = recall || this.popup;
      const focusable = [...scope.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
        .filter((element) => element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        scope.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', this._keydownHandler, true);
    q('#ftts').onclick = async () => {
      const BASE = chrome.runtime.getURL('utils/');
      try {
        const { tts } = await import(BASE + 'tts.js');
        // Velocidade configurável (1.0, 0.75 ou 0.5)
        const rate = this.engine?.ttsPlaybackRate ?? 1.0;
        tts.preferredRate = rate; // Expõe para uso interno no tts.js
        await tts.play(this.word, 'en-US', this._currentAudioUrl || null, rate);
      } catch (e) {
        console.error('[WordPopup] Erro ao reproduzir áudio:', e);
      }
    };
    q('#fsave').onclick = () => this._save();
    // A5 do backlog: PRIMEIRO caminho de aquisição de known_words a partir do
    // vídeo (a tabela tinha 0 linhas; LF_WORD_KNOWN era um listener sem
    // emissor). Destrava o degrau verde da legenda e o score do episódio.
    q('#fknown').onclick = async () => {
      const btn = q('#fknown');
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = '⏳ Marcando…';
      try {
        const BASE = chrome.runtime.getURL('utils/');
        const { db } = await import(BASE + 'db.js');
        await db.markAsKnown(this.word, this.engine?.sourceLang || 'en');
        window.dispatchEvent(new CustomEvent('LF_WORD_KNOWN', { detail: { word: this.word } }));
        btn.textContent = '✓ Marcada como conhecida';
        btn.style.background = 'rgba(134,239,172,.2)';
      } catch (e) {
        console.warn('[WordPopup] markAsKnown falhou:', e);
        btn.textContent = '✓ Já sei esta palavra';
        btn.disabled = false;
      }
    };
    q('#fignore').onclick = () => this._toggleIgnored();
    q('#faisent').onclick = () => this._aiSentence();
    if (q('#fgenchunks')) q('#fgenchunks').onclick = () => this._generateChunks();
    if (q('#frevbtn')) q('#frevbtn').onclick = () => this._loadReverso();
    q('#fcopy-ai').onclick = () => {
      const text = q('#fair').textContent;
      navigator.clipboard.writeText(text);
      const btn = q('#fcopy-ai');
      btn.textContent = '✅ Copiado!';
      setTimeout(() => (btn.textContent = '📋 Copiar'), 2000);
    };
    // Linguee
    q('#fl1').onclick = () =>
      window.open(
        `https://www.linguee.com/english-portuguese/search?source=auto&query=${encodeURIComponent(this.word)}`,
        '_blank',
      );
    q('#fl2').onclick = () =>
      window.open(
        `https://www.linguee.com/english-portuguese/search?source=english&query=${encodeURIComponent(this.word)}`,
        '_blank',
      );
    q('#fl3').onclick = () =>
      window.open(
        `https://translate.google.com/?sl=${this.engine?.sourceLang || 'en'}&tl=${this.engine?.targetLang || 'pt'}&text=${encodeURIComponent(this.word)}`,
        '_blank',
      );
    // YouGlish
    q('#fy1').onclick = () =>
      window.open(
        `https://youglish.com/pronounce/${encodeURIComponent(this.word)}/english`,
        '_blank',
      );
    q('#fy2').onclick = () =>
      window.open(
        `https://youglish.com/pronounce/${encodeURIComponent(this.word)}/english/us`,
        '_blank',
      );
    q('#fy3').onclick = () =>
      window.open(
        `https://youglish.com/pronounce/${encodeURIComponent(this.word)}/english/uk`,
        '_blank',
      );
    q('#fy4').onclick = () =>
      window.open(
        `https://youglish.com/pronounce/${encodeURIComponent(this.word)}/english/aus`,
        '_blank',
      );
    q('#fy5').onclick = () =>
      window.open(
        `https://youglish.com/pronounce/${encodeURIComponent(this.word)}/english/academic`,
        '_blank',
      );
  }

  // Opção "avisar consulta repetida" (#488): só para palavra que o aluno ainda não salvou nem marcou.
  async _showLookupHint(word, requestId) {
    const hint = this.popup?.querySelector('#flookup-hint');
    if (!hint) return;
    hint.style.display = 'none';
    hint.textContent = '';
    if (!this.engine?.smartLookupHint) return;
    const key = String(word || '').toLowerCase();
    if (this.engine.savedWords?.has?.(key) || this.engine.knownWords?.has?.(key)) return;
    const text = lookupHintText(await recordLookup(key));
    if (!text || requestId !== this._contextRequestId) return;
    hint.textContent = text;
    hint.style.display = 'block';
  }

  async showForWord(word, context, rect, cue) {
    const wasHiding = this._isHiding;
    if (this._hideTimeout) {
      clearTimeout(this._hideTimeout);
      this._hideTimeout = null;
    }

    if (!word) return;
    if (this.popup?.style.display === 'none') {
      this._previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    this._isHiding = false;
    const contextRequestId = ++this._contextRequestId;
    const cleanedWord = word.replace(/[.,!?()"]+/g, '').trim();
    const rawContext = context || '';
    const sourceKey = `${cleanedWord}\u0000${rawContext}`;
    if (
      this._activeSourceKey === sourceKey
      && !wasHiding
      && this.popup.style.display !== 'none'
    ) {
      this._anchorRect = rect || null;
      this.currentCue = cue;
      return;
    }
    const expandedWord = await this._expandTermInContext(cleanedWord, rawContext);
    if (contextRequestId !== this._contextRequestId) return;
    this._activeSourceKey = sourceKey;
    this.word = expandedWord;
    // A TELA pode truncar; o CARD não (§3.2 da auditoria): antes, o snippet
    // "±5 palavras com ..." era salvo como context_sentence e contaminava a
    // frente do card, o builder, o ditado e o TTS. saveContext guarda a frase
    // completa que contém o termo; this.context segue truncado só pra exibir.
    this.saveContext = this._sentenceContaining(this.word, rawContext);
    this.context = this._truncateContext(this.word, rawContext);
    this.currentCue = cue; // Armazena a cue completa com contexto expandido
    this._anchorRect = rect || null;
    this._chunksBuilt = false;
    this._contextExplained = false;
    this.contextExplanation = '';
    this._contextSession = {
      id: contextRequestId,
      word: this.word,
      context: this.context,
      saveContext: this.saveContext,
      translation: '',
      explanation: '',
      contextResolved: false,
      recallStarted: false,
      save: null,
    };

    // Na Max, legenda e popup vivem no mesmo overlay fixo. Em outros players,
    // mantemos o comportamento local existente.
    const player = this._findPlayerContainer();
    const targetParent = this.platform === 'max'
      ? (document.fullscreenElement || document.body)
      : (player || document.body);

    if (this.popup.parentElement !== targetParent) {
      targetParent.appendChild(this.popup);
    }
    // Reset tabs
    this.popup.querySelectorAll('.ftab').forEach((t, i) => {
      t.style.color = i === 0 ? '#7dd3fc' : '#94a3b8';
      t.style.borderBottomColor = i === 0 ? '#7dd3fc' : 'transparent';
      t.setAttribute('aria-selected', String(i === 0));
      t.tabIndex = i === 0 ? 0 : -1;
    });
    this.popup.querySelectorAll('.fp').forEach((p, i) => (p.style.display = i === 0 ? '' : 'none'));
    const q = (s) => this.popup.querySelector(s);
    q('#fw').textContent = this.word;
    q('#fipa').textContent = '';
    q('#fpos').style.display = 'none';
    q('#ffreq').style.display = 'none';
    q('#fcefr').style.display = 'none';
    q('#fcefr-prog').style.display = 'none';
    q('#fexprtype').style.display = 'none';
    q('#fff-card').style.display = 'none';
    this._showLookupHint(this.word, contextRequestId);

    // — CEFR badge —
    const cefr = this._lookupCEFR(this.word);
    if (cefr) {
      const el = q('#fcefr');
      el.textContent = this._cefrLabel(cefr);
      el.className = `lfp-badge lfp-${cefr.toLowerCase()}`;
      el.style.display = 'inline-block';
      this.activeLevel = cefr;

      // Progresso CEFR
      (async () => {
        const progEl = q('#fcefr-prog');
        const cefrList = this.engine?.cefrList || this.cefrList;
        if (progEl && cefrList) {
          const allLevel = Object.values(cefrList).filter((v) => v === cefr).length;
          const knownAtLevel =
            [...(this.engine.savedWords?.keys() || [])].filter(
              (w) => cefrList[w] === cefr,
            ).length +
            [...(this.engine.knownWords || [])].filter((w) => cefrList[w] === cefr)
              .length;
          if (allLevel > 0) {
            progEl.textContent = `${knownAtLevel} de ${allLevel} aprendidas`;
            progEl.style.display = 'inline';
          }
        }
      })();
    } else {
      this.activeLevel = null;
    }

    // — Expression type badge (async, loads phrasal verbs db) —
    (async () => {
      const phrasalDB = await this._getPhrasalVerbsDB();
      if (contextRequestId !== this._contextRequestId) return;
      const exprInfo = this._detectExprType(this.word, phrasalDB);
      this._exprType = exprInfo;
      const el = q('#fexprtype');
      if (el) {
        el.textContent = exprInfo.label;
        el.className = `lfp-badge ${exprInfo.cls}`;
        el.style.display = 'inline-block';
      }
    })();

    // — Falso cognato alert —
    const ff = this._detectFalseFriend(this.word);
    if (ff) {
      q('#fff-text').textContent = ff;
      q('#fff-card').style.display = '';
    }

    if (this.freqList) {
      const cleanWord = this.word.toLowerCase().replace(/[^a-z0-9]/gi, '');
      const rank = this.freqList[cleanWord];
      if (rank) {
        const ffreq = q('#ffreq');
        ffreq.style.display = 'inline-block';
        if (rank <= 1000) {
          ffreq.textContent = `🔥 Top ${rank}`;
          ffreq.style.background = 'rgba(239, 68, 68, 0.1)';
          ffreq.style.color = '#f87171';
        } else if (rank <= 5000) {
          ffreq.textContent = `📊 Top ${rank}`;
          ffreq.style.background = 'rgba(245, 158, 11, 0.1)';
          ffreq.style.color = '#fcd34d';
        } else {
          ffreq.textContent = `✨ Rara (>5k)`;
          ffreq.style.background = 'rgba(167, 139, 250, 0.1)';
          ffreq.style.color = '#c4b5fd';
        }
      }
    }

    q('#ft').textContent = '…';
    q('#fc').style.display = 'none';
    q('#fsenses').style.display = 'none';
    this._renderVideoExamples(cue);
    q('#fctx').style.display = 'none';
    q('#fsyn').style.display = 'none';
    q('#fant').style.display = 'none';
    q('#fair-container').style.display = 'none';
    if (context) {
      const safeContext = this._escapeAttr(context);
      const safeTerm = this._escapeAttr(this.word);
      const level = this.engine?.cefrList?.[this.word.toLowerCase()];
      const colors = {
        A1: '#60a5fa',
        A2: '#4ade80',
        B1: '#facc15',
        B2: '#fb923c',
        C1: '#f87171',
        C2: '#c084fc',
      };
      const highlightColor = level && colors[level] ? colors[level] : '#7dd3fc';
      q('#fc').innerHTML = safeContext.replace(
        new RegExp(`\\b(${this._escapeRegExp(safeTerm)})\\b`, 'gi'),
        `<b style="color:${highlightColor}">$1</b>`,
      );
      q('#fc').style.display = '';
    }
    // Buttons state — palavra já salva DESABILITA o botão (§3.3): re-salvar
    // faz upsert e sobrescreve context_sentence/video_url/bounds da captura
    // original em silêncio. Enquanto não existir "adicionar novo contexto",
    // a proteção honesta é não oferecer o clique.
    q('#fsave').disabled = false; // popup é reaproveitado entre palavras
    {
      const knownBtn = q('#fknown');
      const alreadyKnown = this.engine?.knownWords?.has?.(this.word.toLowerCase());
      knownBtn.disabled = !!alreadyKnown;
      knownBtn.textContent = alreadyKnown ? '✓ Marcada como conhecida' : '✓ Já sei esta palavra';
      knownBtn.style.background = alreadyKnown ? 'rgba(134,239,172,.2)' : 'rgba(134,239,172,.08)';
    }
    this._renderIgnoreButton(!!this.engine?.ignoredWords?.has?.(this.word.toLowerCase()));
    (async () => {
      const wordAtCheck = this.word; // §3.8: clique rápido A→B não pode rotular B com a resposta de A
      const BASE = chrome.runtime.getURL('utils/');
      const { db } = await import(BASE + 'db.js');
      const lang = this.engine?.sourceLang || 'en';
      const saved = await db.getWord(wordAtCheck, lang);
      if (this.word !== wordAtCheck) return;
      q('#fsave').textContent = saved ? '✅ Já salvo nos Flashcards' : '+ Salvar nos Flashcards';
      q('#fsave').disabled = !!saved;
      q('#fsave').title = saved ? 'Já está no seu Cofre — re-salvar sobrescreveria a cena original' : '';
      q('#fsave').style.background = saved ? '#16a34a' : '#58cc02';
      q('#fsave').style.boxShadow = saved ? '0 3px 0 #15803d' : '0 3px 0 #46a302';
    })();

    this.popup.style.display = 'block';
    this._startPosLoop(); // Inicia o loop rAF para posicionamento

    // A análise contextual é independente do dicionário. Dispare-a assim que
    // o popup estiver visível para que tradução/definição e IA carreguem em
    // paralelo; _render() verá _contextExplained=true e não duplicará o pedido.
    if (this.context && !this._contextExplained) {
      this._explainContext(this.word, this.context);
    }

    // Trigger animation
    requestAnimationFrame(() => {
      this.popup.style.opacity = '1';
      this.popup.style.transform = this.platform === 'max' ? 'none' : 'translateY(0) scale(1)';
      this.popup.querySelector('.ftab[aria-selected="true"]')?.focus({ preventScroll: true });
    });

    this._loadData(this.word);

    // Se o vídeo estava tocando, pausamos e marcamos que fomos nós
    if (this.engine?.videoElement && !this.engine.videoElement.paused) {
      this.engine.videoElement.pause();
      this._wasPlayingBefore = true;
    }
    // Tradução do contexto em segundo plano
    // A explicação contextual agora é disparada apenas se o usuário clicar em "IA" ou após o dicionário carregar
  }

  async _loadData(word) {
    // Inicia um estado de carregamento base na cache (ou objeto vazio)
    this.cache[word] = {
      translation: '...',
      phonetic: '',
      partOfSpeech: '',
      definition: 'Carregando dicionário...',
    };
    if (this.word === word) this._render(this.cache[word]);

    const entry = this.cache[word];
    // Busca tradução e dicionário em paralelo, mas atualiza a tela assim que cada um chegar
    this._translate(word)
      .then((tr) => {
        // A tradução contextual da IA (stream ou cache) pode chegar antes da
        // tradução isolada; não a sobrescreva com o sentido fora da frase.
        if (this.cache[word] && !this.cache[word].contextual) this.cache[word].translation = tr || '—';
        if (this.word === word) this._render(this.cache[word]);
      })
      .catch(() => {
        if (this.cache[word] && this.cache[word].translation === '...') {
          this.cache[word].translation = '—';
        }
        if (this.word === word) this._render(this.cache[word]);
      });

    this._senses(word).then((senses) => {
      if (this.cache[word] !== entry) return;
      entry.senses = senses;
      if (this.word !== word) return;
      this._renderSenses(senses);
      // A forma base (filming → film) encontra mais falas do vídeo.
      if (senses.some((s) => s.base)) this._renderVideoExamples(this._videoExampleCue);
    });

    this._dict(word)
      .then((dict) => {
        if (this.cache[word] === entry) {
          Object.assign(entry, dict || {});
          const rawDictPhon = dict?.phonetic || '';
          this.cache[word].phonetic = isValidIpa(rawDictPhon) ? cleanIpa(rawDictPhon) : '';
          if (!dict?.definition) entry.definition = 'Definição indisponível no momento.';
        }
        if (this.word === word) this._render(this.cache[word]);
      })
      .catch(() => {
        if (this.cache[word] === entry) {
          if (!entry.definition || entry.definition === 'Carregando dicionário...') {
            entry.definition = 'Definição indisponível no momento.';
          }
        }
        if (this.word === word) this._render(this.cache[word]);
      });
  }

  _render(d) {
    const q = (s) => this._q(s);
    q('#ft').textContent = d.translation || '—';
    d.phonetic = isValidIpa(d.phonetic) ? cleanIpa(d.phonetic) : '';
    const ipaWrap = q('#fipa-wrap');
    if (d.phonetic) {
      q('#fipa').textContent = d.phonetic;
      ipaWrap.style.display = 'block';
    } else {
      q('#fipa').textContent = '';
      ipaWrap.style.display = 'none';
    }
    if (d.partOfSpeech) {
      q('#fpos').textContent = this._posLabel(d.partOfSpeech);
      q('#fpos').style.display = 'inline-block';
    }
    // Update expression type badge if AI enriched the data
    if (d.register) {
      const el = q('#fexprtype');
      if (
        el &&
        (d.register === 'slang' ||
          d.register === 'informal' ||
          d.register === 'formal' ||
          d.register === 'technical')
      ) {
        const map = {
          slang: ['🔥 Gíria', 'lfp-type-slang'],
          informal: ['💬 Informal', 'lfp-type-collocation'],
          formal: ['🎩 Formal', 'lfp-type-formal'],
          technical: ['⚙️ Técnico', 'lfp-c1'],
        };
        const [label, cls] = map[d.register] || [];
        if (label && el.textContent === '📖 Palavra') {
          el.textContent = label;
          el.className = `lfp-badge ${cls}`;
          this._exprType = { type: d.register, label, cls };
        }
      }
    }
    if (d.synonyms?.length) {
      const syns = q('#fsyns');
      syns.innerHTML = d.synonyms
        .slice(0, 6)
        .map(
          (s) =>
            `<button type="button" class="lfp-chip" data-word="${this._escapeAttr(s)}" aria-label="Consultar sinônimo ${this._escapeAttr(s)}">${this._escapeAttr(s)}</button>`,
        )
        .join('');
      syns.querySelectorAll('.lfp-chip[data-word]').forEach((chip) => {
        chip.addEventListener('click', () =>
          window.__lfpopup?.showForWord(chip.dataset.word, '', null),
        );
      });
      q('#fsyn').style.display = '';
    }
    if (d.antonyms?.length) {
      const ants = q('#fants');
      ants.innerHTML = d.antonyms
        .slice(0, 4)
        .map(
          (s) =>
            `<button type="button" class="lfp-chip red" data-word="${this._escapeAttr(s)}" aria-label="Consultar antônimo ${this._escapeAttr(s)}">${this._escapeAttr(s)}</button>`,
        )
        .join('');
      ants.querySelectorAll('.lfp-chip[data-word]').forEach((chip) => {
        chip.addEventListener('click', () =>
          window.__lfpopup?.showForWord(chip.dataset.word, '', null),
        );
      });
      q('#fant').style.display = '';
    }

    // Store audioUrl for TTS button
    this._currentAudioUrl = d.audioUrl || null;

    // Auto-carrega contexto
    if (this.context && !this._contextExplained) {
      this._explainContext(this.word, this.context);
    } else if (!this.context) {
      this._generateContext(this.word);
    }
  }

  hide(resumeVideo = false) {
    this._clearLoginWait();
    if (!this.popup || this.popup.style.display === 'none') return;

    this._isHiding = true;
    this.popup.style.opacity = '0';
    this.popup.style.transform = this.platform === 'max' ? 'none' : 'translateY(10px) scale(0.95)';

    if (resumeVideo && this.engine?.videoElement) {
      const vid = this.engine.videoElement;
      const shouldResume =
        this._wasPlayingBefore ||
        this.engine._wasPausedByHover ||
        (this.engine.autoPause && this.engine._lastAutoPausedEndTime > 0);

      if (shouldResume) {
        if (this.engine) {
          this.engine._pauseCooldown = true;
          setTimeout(() => (this.engine._pauseCooldown = false), 500);
        }
        // Não precisa mais de timeout tão longo porque o pointer-events já foi removido
        setTimeout(() => {
          if (vid.paused) {
            vid.play().catch(() => {});
          }
        }, 50);
      }

      this._wasPlayingBefore = false;
      if (this.engine) {
        this.engine._wasPausedByHover = false;
        this.engine._lastAutoPausedEndTime = -1;
      }
    }

    this.popup.style.pointerEvents = 'none'; // Impede hover acidental durante fade-out
    if (this._hideTimeout) clearTimeout(this._hideTimeout);
    this._hideTimeout = setTimeout(() => {
      this.popup.style.display = 'none';
      this.popup.style.pointerEvents = 'auto'; // Restaura para o próximo uso
      this._posLoopRunning = false;
      this._hideTimeout = null;
      if (this._previousFocus?.isConnected) this._previousFocus.focus({ preventScroll: true });
      this._previousFocus = null;
    }, 200);
  }
  // O hide original com animação está na linha ~734

}

installMethods(WordPopup, [LookupMethods, SaveMethods, AiContextMethods, PositioningMethods, FirstRecallMethods]);
