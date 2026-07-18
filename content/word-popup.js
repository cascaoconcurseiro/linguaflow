// LinguaFlow Pro — Word Popup v5 (unified storage, bilingual examples, full grammar)

import { computeMaxPopupLayout } from './max-player-ui.js';

export class WordPopup {
  constructor(engine, platform) {
    this.engine = engine;
    this.platform = platform;
    this.popup = null;
    this.word = '';
    this.context = '';
    this.cache = {};

    this._gramBuilt = false;
    this._exBuilt = false;
    this.freqList = null;
  }

  async init() {
    this._build();
    this._initData();

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
    // Falsos cognatos mais perigosos para brasileiros
    this._falseFriends = {
      actually:
        '"actually" = na verdade / de fato (NÃO "atualmente" → use "currently" ou "nowadays")',
      pretend: '"pretend" = fingir / simular (NÃO "pretender" → use "intend" ou "plan to")',
      eventually:
        '"eventually" = eventualmente no sentido de "no fim" / "com o tempo" (NÃO "eventualmente" = sometimes → use "occasionally")',
      library: '"library" = biblioteca (NÃO "livraria" → use "bookstore")',
      college: '"college" = faculdade / universidade (NÃO "colégio" = high school)',
      fabric: '"fabric" = tecido / pano (NÃO "fábrica" → use "factory")',
      parents: '"parents" = pais (pai e mãe) (NÃO "parentes" = relatives)',
      push: '"push" = empurrar (NÃO "puxar" = pull)',
      exit: '"exit" = saída (NÃO "êxito" = success)',
      novel: '"novel" = romance (livro) (NÃO "novela" = soap opera = "soap opera")',
      sensible: '"sensible" = sensato / prudente (NÃO "sensível" = sensitive)',
      polite: '"polite" = educado / cortês (NÃO "político" = politician)',
      large: '"large" = grande (NÃO "largo" = wide)',
      assist: '"assist" = ajudar / auxiliar (NÃO "assistir" a um filme → "watch")',
      contest: '"contest" = competição (NÃO "contestar" = dispute/challenge)',
      editor: '"editor" = revisor/redator (NÃO "editor" de livros = publisher)',
      engineer: '"engineer" = engenheiro (NÃO "maquinista" = train driver)',
      eventually: '"eventually" = no fim das contas (NÃO às vezes = sometimes)',
      exquisite: '"exquisite" = refinado/primoroso (NÃO "esquisito" = weird/strange)',
      genial: '"genial" = simpático/cordial (NÃO "genial" = brilliant → "genius")',
      infamous: '"infamous" = notório/famigerado (NÃO apenas "famoso" = famous)',
      legend: '"legend" = lenda (NÃO "legenda" de vídeo = subtitle/caption)',
      mundane: '"mundane" = entediante/comum (NÃO "mundano" = worldly)',
      realize:
        '"realize" = perceber/tomar consciência (NÃO "realizar" uma tarefa = carry out/accomplish)',
      resume: '"resume" = retomar (NÃO "resumo" = summary)',
      sympathetic: '"sympathetic" = solidário/compreensivo (NÃO "simpático" = nice/friendly)',
      taxes: '"taxes" = impostos (NÃO "táxis" = taxis)',
      travesty: '"travesty" = paródia/distorção grotesca (NÃO "travesti" = transgender person)',
      vacant: '"vacant" = vago/desocupado (NÃO "vacante" formal → use "empty")',
      versatile:
        '"versatile" = versátil/multifuncional (NÃO "versátil" geralmente mais positivo em inglês)',
    };

    // Expressões/idiomas comuns para detecção por lookup
    this._idiomSet = new Set([
      'piece of cake',
      'break a leg',
      'hit the nail on the head',
      'under the weather',
      'bite the bullet',
      'beat around the bush',
      'get out of hand',
      'spill the beans',
      'kick the bucket',
      'let the cat out of the bag',
      'hit the sack',
      'cost an arm and a leg',
      'once in a blue moon',
      'the ball is in your court',
      "pull someone's leg",
      'hang in there',
      'cut corners',
      'get cold feet',
      "it's not rocket science",
      'back to the drawing board',
      'bite off more than you can chew',
      'burn bridges',
      'catch someone red-handed',
      "don't judge a book by its cover",
    ]);

    // Chunks / fixed phrases
    this._chunkSet = new Set([
      'as well as',
      'as long as',
      'as soon as',
      'due to',
      'in order to',
      'in spite of',
      'on the other hand',
      'at the same time',
      'in addition to',
      'as a result',
      'by the way',
      'in fact',
      'for example',
      'such as',
      'in terms of',
      'according to',
      'on the contrary',
      'in other words',
      'first of all',
      'last but not least',
      'as a matter of fact',
      'to be honest',
      'you know what',
      'kind of',
      'sort of',
      'a lot of',
      'all of a sudden',
      'at least',
      'at most',
      'by the way',
      'come on',
      'figure out',
      'find out',
      'give up',
      'go ahead',
      'go on',
      'look forward to',
      'make sense',
      'no wonder',
      'of course',
      'right away',
      'take care',
      'take part',
      'turn out',
      'used to',
      'what if',
    ]);
  }

  // Detecta o tipo linguístico da expressão clicada
  _detectExprType(word, phrasalVerbsDB) {
    const w = word.toLowerCase().trim();
    const tokens = w.split(/\s+/);
    const isMulti = tokens.length > 1;

    if (this._idiomSet?.has(w)) return { type: 'idiom', label: '🌀 Idiom', cls: 'lfp-type-idiom' };
    if (this._chunkSet?.has(w)) return { type: 'chunk', label: '🧩 Chunk', cls: 'lfp-type-chunk' };

    if (isMulti && phrasalVerbsDB) {
      const verb = tokens[0];
      const entries = phrasalVerbsDB[verb] || [];
      if (entries.some((e) => e.phrase?.toLowerCase() === w)) {
        return { type: 'phrasal', label: '🔗 Phrasal Verb', cls: 'lfp-type-phrasal' };
      }
      // Multi-word que não é idiom nem chunk nem phrasal → colocação
      return { type: 'collocation', label: '🤝 Colocação', cls: 'lfp-type-collocation' };
    }

    // Palavras simples: verificar registro pelo dicionário depois — placeholder
    return { type: 'word', label: '📖 Palavra', cls: 'lfp-type-word' };
  }

  _detectFalseFriend(word) {
    return this._falseFriends?.[word.toLowerCase()] || null;
  }

  _lookupCEFR(word) {
    if (!this.cefrList) return null;
    return this.cefrList[word.toLowerCase()] || null;
  }
  _escapeAttr(value) {
    return String(value ?? '').replace(
      /[&<>"']/g,
      (ch) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[ch],
    );
  }
  _escapeRegExp(value) {
    return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Frase completa que contém o termo — SEM janela de palavras, SEM "..." —
  // é o que vai para words.context_sentence (§3.2). Multi-frase vira a frase
  // alvo; sem pontuação, devolve o contexto inteiro como veio.
  _sentenceContaining(word, fullContext) {
    if (!fullContext) return '';
    const sentences = fullContext.match(/[^.!?]+[.!?]*/g) || [fullContext];
    const target = sentences.find((s) => s.toLowerCase().includes(word.toLowerCase()));
    return (target || fullContext).trim();
  }

  _truncateContext(word, fullContext) {
    if (!fullContext) return '';
    // if it's already short, keep it
    if (fullContext.length < 60) return fullContext;
    
    // Find sentences using punctuation boundaries
    const sentences = fullContext.match(/[^.!?]+[.!?]*/g) || [fullContext];
    
    // Find the sentence containing the word
    let targetSentence = sentences.find(s => s.toLowerCase().includes(word.toLowerCase()));
    
    if (!targetSentence) targetSentence = fullContext;
    
    targetSentence = targetSentence.trim();
    
    // If even the target sentence is too long, truncate by words
    if (targetSentence.length > 80) {
      const words = targetSentence.split(/\s+/);
      const wordIdx = words.findIndex(w => w.toLowerCase().includes(word.toLowerCase()));
      if (wordIdx !== -1) {
        const start = Math.max(0, wordIdx - 5);
        const end = Math.min(words.length, wordIdx + 6);
        let snippet = words.slice(start, end).join(' ');
        if (start > 0) snippet = '... ' + snippet;
        if (end < words.length) snippet = snippet + ' ...';
        return snippet;
      }
    }
    
    return targetSentence;
  }
  async _expandTermInContext(word, context) {
    const cleanWord = String(word || '')
      .toLowerCase()
      .replace(/[.,!?()"]/g, '')
      .trim();
    if (!cleanWord || cleanWord.includes(' ') || !context) return word;

    const tokens = String(context).match(/[a-zA-Z']+/g) || [];
    const lower = tokens.map((t) => t.toLowerCase());
    const positions = lower.map((t, i) => (t === cleanWord ? i : -1)).filter((i) => i >= 0);
    if (!positions.length) return word;

    let phrasalDB = null;
    try {
      const BASE = chrome.runtime.getURL('utils/');
      const m = await import(BASE + 'phrasal-verbs.js');
      phrasalDB = m.phrasalVerbsDB;
    } catch {}

    const isKnownExpression = (phrase) => {
      if (this._idiomSet?.has(phrase) || this._chunkSet?.has(phrase)) return true;
      if (!phrasalDB) return false;
      const first = phrase.split(/\s+/)[0];
      return (phrasalDB[first] || []).some((e) => e.phrase?.toLowerCase() === phrase);
    };

    let best = '';
    for (const pos of positions) {
      for (let start = Math.max(0, pos - 4); start <= pos; start++) {
        for (let end = pos; end < Math.min(lower.length, pos + 5); end++) {
          const phrase = lower.slice(start, end + 1).join(' ');
          if (phrase.split(' ').length < 2) continue;
          if (isKnownExpression(phrase) && phrase.length > best.length) best = phrase;
        }
      }
    }

    return best || word;
  }
  destroy() {
    this._posObserver?.disconnect();
    this._maxPositionObserver?.disconnect();
    this._maxPositionMutationObserver?.disconnect();
    this._maxPositionAbort?.abort();
    cancelAnimationFrame(this._positionFrame || 0);
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
      s.textContent = `@keyframes lfpIn{from{opacity:0;transform:translateY(10px) scale(0.93)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes lfpSpin{to{transform:rotate(360deg)}}.lfp-spin{width:18px;height:18px;border:2px solid rgba(255,255,255,.1);border-top-color:#a78bfa;border-radius:50%;animation:lfpSpin .6s linear infinite;display:inline-block;vertical-align:middle;margin-right:8px}#lfp *{box-sizing:border-box;margin:0;padding:0}#lfp button,#lfp select,#lfp input{font-family:'Outfit','Segoe UI',sans-serif}.lfp-chip{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:3px 10px;font-size:11px;color:#94a3b8;cursor:pointer;transition:all .12s;display:inline-block}.lfp-chip:hover{color:#7dd3fc;border-color:rgba(125,209,252,.35)}.lfp-chip.red{background:rgba(248,113,113,.06);border-color:rgba(248,113,113,.15);color:#f87171}.lfp-panels::-webkit-scrollbar{width:3px}.lfp-panels::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}.lfp-ph{background:rgba(244,114,182,.06);border:1px solid rgba(244,114,182,.15);border-radius:9px;padding:9px 12px;margin-bottom:7px}.lfp-ex{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px 13px;margin-bottom:8px}.ai-res{white-space:pre-wrap;word-break:break-word}.lfp-btn-bounce{transition:transform 0.2s cubic-bezier(0.175,0.885,0.32,1.275)}.lfp-btn-bounce:active{transform:scale(0.95)}
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
/* Deck modal */
#lfp-deck-modal{position:absolute;inset:0;background:rgba(8,12,24,.92);backdrop-filter:blur(10px);border-radius:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:10;padding:24px}
#lfp-deck-modal input{width:100%;padding:10px 14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:10px;color:#f8fafc;font-size:14px;outline:none;font-family:inherit}
#lfp-deck-modal input:focus{border-color:#38bdf8}
`;
      document.head.appendChild(s);
    }
    this.popup = document.createElement('div');
    this.popup.id = 'lfp';
    Object.assign(this.popup.style, {
      position: 'absolute',
      zIndex: '2147483647',
      background: 'rgba(13, 17, 28, 0.85)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
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
    <div style="display:flex;align-items:center;gap:5px;margin-top:5px;flex-wrap:wrap;">
      <span id="fipa" style="font-size:12px;color:#64748b;font-family:monospace;"></span>
      <span id="fprpt" style="display:none;font-size:18px;color:#fbbf24;font-weight:700;font-family:monospace;background:rgba(251,191,36,0.15);padding:4px 8px;border-radius:6px;border:1px solid rgba(251,191,36,0.3);"></span>
    </div>
    <div style="display:flex;align-items:center;gap:5px;margin-top:6px;flex-wrap:wrap;">
      <span id="fexprtype" class="lfp-badge" style="display:none;"></span>
      <span id="fpos" class="lfp-badge" style="display:none;background:rgba(125,209,252,.1);color:#7dd3fc;border:1px solid rgba(125,209,252,.2)"></span>
      <span id="ffreq" style="display:none;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:20px;"></span>
    </div>
  </div>
  <div style="display:flex;gap:6px;flex-shrink:0;margin-top:2px;">
    <button id="ftts" title="🔊 Ouvir" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:9px;color:#7dd3fc;cursor:pointer;padding:6px 9px;font-size:16px;line-height:1;transition:all .15s;">🔊</button>
    <button id="fx" style="background:none;border:none;color:#475569;font-size:18px;cursor:pointer;padding:4px 7px;border-radius:6px;line-height:1;">✕</button>
  </div>
</div>
<div style="display:flex;border-bottom:1px solid rgba(255,255,255,.07);margin-top:12px;padding:0 4px;">
  ${['Tradução', 'Linguee', 'YouGlish'].map((l, i) => `<button class="ftab" data-i="${i}" style="flex:1;padding:9px 2px;font-size:11px;font-weight:700;color:${i === 0 ? '#7dd3fc' : '#475569'};background:none;border:none;border-bottom:2px solid ${i === 0 ? '#7dd3fc' : 'transparent'};cursor:pointer;letter-spacing:.03em;white-space:nowrap;transition:all .15s;">${l}</button>`).join('')}
</div>
<div class="lfp-panels" style="padding:14px 18px 18px;max-height:400px;overflow-y:auto;">

  <div class="fp" data-p="0">
    <div id="ft" style="font-size:26px;font-weight:800;color:#4ade80;margin-bottom:5px;line-height:1.2;">…</div>
    <div id="fd" style="font-size:13px;color:#94a3b8;line-height:1.6;font-style:italic;margin-bottom:10px;"></div>
    <div id="fff-card" style="display:none;" class="lfp-ff"><div style="font-size:10px;color:#fb923c;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px;">⚠️ Falso Cognato — Armadilha!</div><div id="fff-text" style="font-size:12px;color:#fcd34d;line-height:1.6;"></div></div>
    <div id="fctx" style="display:none;background:rgba(139,92,246,.06);border:1px solid rgba(139,92,246,.18);border-radius:10px;padding:10px 13px;margin-bottom:12px;"><div style="font-size:10px;color:#a78bfa;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px;display:flex;align-items:center;gap:5px;"><span>💡</span><span>Contexto nesta frase</span></div><div id="fctxt" style="font-size:12px;color:#e2e8f0;line-height:1.7;"></div></div>
    <div id="fc" style="display:none;background:rgba(125,209,252,.04);border-left:3px solid rgba(125,209,252,.3);padding:8px 12px;border-radius:0 8px 8px 0;font-size:12px;color:#cbd5e1;line-height:1.6;margin-bottom:12px;"></div>
    <div id="fsyn" style="display:none;margin-bottom:10px;"><div style="font-size:10px;color:#475569;font-weight:700;letter-spacing:.09em;text-transform:uppercase;margin-bottom:5px;">Sinônimos</div><div id="fsyns" style="display:flex;flex-wrap:wrap;gap:5px;"></div></div>
    <div id="fant" style="display:none;margin-bottom:12px;"><div style="font-size:10px;color:#475569;font-weight:700;letter-spacing:.09em;text-transform:uppercase;margin-bottom:5px;">Antônimos</div><div id="fants" style="display:flex;flex-wrap:wrap;gap:5px;"></div></div>
    <div style="height:1px;background:rgba(255,255,255,.06);margin-bottom:12px;"></div>

    <button id="fsave" class="lfp-btn-bounce" style="display:block;width:100%;padding:11px;background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer;transition:all .15s;margin-bottom:8px;letter-spacing:.01em;">+ Salvar nos Flashcards</button>
    <button id="fknown" class="lfp-btn-bounce" style="display:block;width:100%;padding:9px;background:rgba(134,239,172,.08);color:#86efac;border:1px solid rgba(134,239,172,.25);border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;margin-bottom:8px;">✓ Já sei esta palavra</button>
    <button id="faisent" class="lfp-btn-bounce" style="display:none;width:100%;padding:9px;background:rgba(251,191,36,.08);color:#fbbf24;border:1px solid rgba(251,191,36,.22);border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;margin-bottom:10px;">🔍 Analisar Frase Completa</button>
    <div id="fair-container" style="display:none;position:relative;">
      <div id="fair" class="ai-res" style="background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);border-radius:12px;padding:12px;font-size:12px;color:#c4b5fd;line-height:1.7;"></div>
      <button id="fcopy-ai" style="position:absolute;top:8px;right:8px;background:rgba(255,255,255,.1);border:none;border-radius:6px;color:#fff;padding:4px 8px;font-size:10px;cursor:pointer;opacity:0.6;">📋 Copiar</button>
    </div>
  </div>

  <div class="fp" data-p="1" style="display:none;padding-top:8px;">
    <div style="font-size:13px;color:#64748b;line-height:1.8;margin-bottom:14px;text-align:center;">Traduções em contexto real de textos bilíngues — ideal para ver uso nativo.</div>
    <div id="frev" style="display:none;margin-bottom:14px;max-height:280px;overflow-y:auto;"></div>
    <button id="frevbtn" class="lfp-btn-bounce" style="display:block;width:100%;padding:11px;background:linear-gradient(135deg,#0c4a6e,#0369a1);color:#7dd3fc;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px;">🔄 Reverso Context — Exemplos Reais</button>
    <button id="fl1" style="display:block;width:100%;padding:10px;background:rgba(74,222,128,.08);color:#4ade80;border:1px solid rgba(74,222,128,.25);border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px;">🔗 Linguee — EN ↔ PT</button>
    <button id="fl2" style="display:block;width:100%;padding:9px;background:rgba(74,222,128,.05);color:#4ade80;border:1px solid rgba(74,222,128,.15);border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px;">🇬🇧 Linguee — EN definitions</button>
    <button id="fl3" style="display:block;width:100%;padding:9px;background:rgba(74,222,128,.03);color:#4ade80;border:1px solid rgba(74,222,128,.1);border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;">🌐 Google Translate</button>
  </div>

  <div class="fp" data-p="2" style="display:none;text-align:center;padding-top:8px;">
    <div style="font-size:13px;color:#64748b;line-height:1.8;margin-bottom:14px;">Ouça como nativos pronunciam em vídeos reais do YouTube.</div>
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
      document.addEventListener('mousedown', (e) => {
        if (
          this.popup &&
          this.popup.style.display !== 'none' &&
          !this.popup.contains(e.target) &&
          !e.target.classList?.contains('lf-word')
        ) {
          this.hide(true);
        }
      });

      this._mousedownAttached = true;
    }
    // Tabs
    this.popup.querySelectorAll('.ftab').forEach((t) => {
      t.onclick = () => {
        const i = parseInt(t.dataset.i);
        this.popup.querySelectorAll('.ftab').forEach((x, j) => {
          x.style.color = j === i ? '#7dd3fc' : '#475569';
          x.style.borderBottomColor = j === i ? '#7dd3fc' : 'transparent';
        });
        this.popup
          .querySelectorAll('.fp')
          .forEach((p, j) => (p.style.display = j === i ? '' : 'none'));
      };
    });
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

  async showForWord(word, context, rect, cue) {
    if (this._hideTimeout) {
      clearTimeout(this._hideTimeout);
      this._hideTimeout = null;
    }

    if (!word) return;
    this._isHiding = false;
    const cleanedWord = word.replace(/[.,!?()"]+/g, '').trim();
    const rawContext = context || '';
    this.word = await this._expandTermInContext(cleanedWord, rawContext);
    // A TELA pode truncar; o CARD não (§3.2 da auditoria): antes, o snippet
    // "±5 palavras com ..." era salvo como context_sentence e contaminava a
    // frente do card, o builder, o ditado e o TTS. saveContext guarda a frase
    // completa que contém o termo; this.context segue truncado só pra exibir.
    this.saveContext = this._sentenceContaining(this.word, rawContext);
    this.context = this._truncateContext(this.word, rawContext);
    this.currentCue = cue; // Armazena a cue completa com contexto expandido
    this._anchorRect = rect || null;
    this._chunksBuilt = false;
    this._exBuilt = false;
    this._contextExplained = false;

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
      t.style.color = i === 0 ? '#7dd3fc' : '#475569';
      t.style.borderBottomColor = i === 0 ? '#7dd3fc' : 'transparent';
    });
    this.popup.querySelectorAll('.fp').forEach((p, i) => (p.style.display = i === 0 ? '' : 'none'));
    const q = (s) => this.popup.querySelector(s);
    q('#fw').textContent = this.word;
    q('#fipa').textContent = '';
    q('#fprpt').style.display = 'none';
    q('#fpos').style.display = 'none';
    q('#ffreq').style.display = 'none';
    q('#fcefr').style.display = 'none';
    q('#fexprtype').style.display = 'none';
    q('#fff-card').style.display = 'none';

    // — CEFR badge —
    const cefr = this._lookupCEFR(this.word);
    if (cefr) {
      const el = q('#fcefr');
      el.textContent = cefr;
      el.className = `lfp-badge lfp-${cefr.toLowerCase()}`;
      el.style.display = 'inline-block';
      this.activeLevel = cefr;

      // Progresso CEFR
      (async () => {
        const progEl = q('#fcefr-prog');
        if (progEl && this.engine?.cefrList) {
          const allLevel = Object.values(this.engine.cefrList).filter((v) => v === cefr).length;
          const knownAtLevel =
            [...(this.engine.savedWords?.keys() || [])].filter(
              (w) => this.engine.cefrList[w] === cefr,
            ).length +
            [...(this.engine.knownWords || [])].filter((w) => this.engine.cefrList[w] === cefr)
              .length;
          if (allLevel > 0) {
            progEl.textContent = `${knownAtLevel}/${allLevel} ${cefr}`;
            progEl.style.display = 'inline';
          }
        }
      })();
    } else {
      this.activeLevel = null;
    }

    // — Expression type badge (async, loads phrasal verbs db) —
    (async () => {
      const BASE = chrome.runtime.getURL('utils/');
      let phrasalDB = null;
      try {
        const m = await import(BASE + 'phrasal-verbs.js');
        phrasalDB = m.phrasalVerbsDB;
      } catch {}
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
    q('#fd').textContent = '';
    q('#fc').style.display = 'none';
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
      q('#fsave').style.background = saved
        ? 'linear-gradient(135deg,#15803d,#16a34a)'
        : 'linear-gradient(135deg,#1d4ed8,#2563eb)';
    })();

    this.popup.style.display = 'block';
    this._startPosLoop(); // Inicia o loop rAF para posicionamento

    // Trigger animation
    requestAnimationFrame(() => {
      this.popup.style.opacity = '1';
      this.popup.style.transform = this.platform === 'max' ? 'none' : 'translateY(0) scale(1)';
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
    if (this.cache[word]) {
      if (this.word === word) this._render(this.cache[word]);
      return;
    }

    // Inicia um estado de carregamento base na cache (ou objeto vazio)
    this.cache[word] = {
      translation: '...',
      phonetic: '',
      pronunciation_pt: '...',
      partOfSpeech: '',
      definition: 'Carregando dicionário...',
    };
    if (this.word === word) this._render(this.cache[word]);

    // Busca tradução e dicionário em paralelo, mas atualiza a tela assim que cada um chegar
    this._translate(word).then((tr) => {
      if (this.cache[word]) this.cache[word].translation = tr;
      if (this.word === word) this._render(this.cache[word]);
    });

    this._dict(word).then((dict) => {
      if (this.cache[word]) {
        this.cache[word] = { ...this.cache[word], ...dict };
        this.cache[word].phonetic = dict.phonetic || '';
        this.cache[word].pronunciation_pt = this._convertIPAtoPT(dict.phonetic);
      }
      if (this.word === word) this._render(this.cache[word]);
    });
  }

  _render(d) {
    const q = (s) => this._q(s);
    q('#ft').textContent = d.translation || '—';
    if (d.phonetic) {
      q('#fipa').textContent = d.phonetic;
    }
    const elPt = q('#fprpt');
    if (d.pronunciation_pt) {
      elPt.textContent = '🇧🇷 ' + d.pronunciation_pt;
      elPt.style.display = 'inline';
    } else {
      elPt.style.display = 'none';
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
        }
      }
    }
    if (d.definition) q('#fd').textContent = d.definition;
    if (d.synonyms?.length) {
      const syns = q('#fsyns');
      syns.innerHTML = d.synonyms
        .slice(0, 6)
        .map(
          (s) =>
            `<span class="lfp-chip" data-word="${this._escapeAttr(s)}">${this._escapeAttr(s)}</span>`,
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
            `<span class="lfp-chip red" data-word="${this._escapeAttr(s)}">${this._escapeAttr(s)}</span>`,
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

  async _buildGrammar() {
    this._gramBuilt = true;
    const q = (s) => this._q(s);
    const d = this.cache[this.word] || {};

    // Carrega DB de phrasal verbs
    const BASE = chrome.runtime.getURL('utils/');
    const { phrasalVerbsDB } = await import(BASE + 'phrasal-verbs.js');

    // Usa o tipo já detectado (pode ter sido enriquecido pela IA)
    const exprInfo = this._exprType || this._detectExprType(this.word, phrasalVerbsDB);
    const isExpr =
      this.word.includes(' ') ||
      ['phrasal', 'idiom', 'chunk', 'collocation'].includes(exprInfo.type);
    const lowerWord = this.word.toLowerCase();
    const firstToken = lowerWord.split(/\s+/)[0];
    const exactPhrasal = (phrasalVerbsDB[firstToken] || []).filter(
      (e) => e.phrase?.toLowerCase() === lowerWord,
    );
    const phs =
      exprInfo.type === 'phrasal' ? exactPhrasal : !isExpr ? phrasalVerbsDB[lowerWord] || [] : [];

    const typeDescriptions = {
      phrasal: {
        title: 'Phrasal verb',
        desc: 'Leia como uma ideia só. Traduzir palavra por palavra costuma enganar.',
      },
      idiom: {
        title: 'Expressão idiomática',
        desc: 'O sentido vem do conjunto, não das palavras separadas.',
      },
      chunk: {
        title: 'Chunk',
        desc: 'Bloco pronto que nativos usam sem montar palavra por palavra.',
      },
      collocation: {
        title: 'Combinação natural',
        desc: 'Palavras que soam certas juntas. Guarde o par completo.',
      },
      slang: {
        title: 'Gíria',
        desc: 'Uso informal. Bom para entender fala real, cuidado em contexto formal.',
      },
      formal: {
        title: 'Registro formal',
        desc: 'Mais comum em escrita, trabalho ou fala cuidadosa.',
      },
      word: {
        title: 'Palavra',
        desc: 'Aqui vale olhar o sentido no contexto antes de memorizar a tradução.',
      },
    };
    const tinfo = typeDescriptions[exprInfo.type] || typeDescriptions.word;
    const safeWord = this._escapeAttr(this.word);
    const safeTranslation = this._escapeAttr(d.translation || '');
    const safeDefinition = this._escapeAttr(d.definition || '');
    const safeContext = this._escapeAttr(this.context || '');
    const contextLine = safeContext
      ? safeContext.replace(
          new RegExp(`\\b(${this._escapeRegExp(safeWord)})\\b`, 'gi'),
          '<b style="color:#7dd3fc">$1</b>',
        )
      : 'Sem frase de contexto para comparar.';
    const chunkChips = this._usageChunks(exprInfo, phs)
      .map((item) => `<span class="lfp-mini-chip">${this._escapeAttr(item)}</span>`)
      .join('');
    const simpleUse = this._simpleUsageLine(exprInfo, safeWord, safeTranslation);

    let h = '';
    h += `<div class="lfp-use-card">
      <div class="lfp-use-title"><span>💡</span><span>O que olhar aqui</span></div>
      <div class="lfp-use-text">${tinfo.title}: ${tinfo.desc}</div>
    </div>`;

    h += `<div class="lfp-use-card blue">
      <div class="lfp-use-title"><span>🎬</span><span>Nesta frase</span></div>
      <div class="lfp-use-text">${contextLine}</div>
      ${safeTranslation ? `<div class="lfp-use-muted" style="margin-top:6px;">Tradução-base: <b style="color:#4ade80">${safeTranslation}</b></div>` : ''}
    </div>`;

    if (safeDefinition) {
      h += `<div class="lfp-use-card green">
        <div class="lfp-use-title"><span>📌</span><span>Sentido simples</span></div>
        <div class="lfp-use-text">${safeDefinition}</div>
      </div>`;
    }

    if (phs.length) {
      h += `<div class="lfp-use-card amber">
        <div class="lfp-use-title"><span>🔗</span><span>Use como bloco</span></div>
        ${phs
          .map(
            (p) => `<div style="margin-bottom:8px;">
          <div class="lfp-use-text"><b style="color:#fbbf24">${this._escapeAttr(p.phrase)}</b> = ${this._escapeAttr(p.meaning || '')}</div>
          ${p.example ? `<div class="lfp-use-muted">"${this._escapeAttr(p.example)}"</div>` : ''}
        </div>`,
          )
          .join('')}
      </div>`;
    }

    h += `<div class="lfp-use-card">
      <div class="lfp-use-title"><span>🧩</span><span>Blocos para lembrar</span></div>
      <div class="lfp-use-text">${chunkChips || simpleUse}</div>
    </div>`;

    q('#fchunks-container').innerHTML = h;
  }

  _usageChunks(exprInfo, phs) {
    if (phs?.length) return phs.slice(0, 3).map((p) => p.phrase);
    const w = this.word;
    if (exprInfo.type === 'phrasal' || w.includes(' ')) return [w];
    const pos = (this.cache[this.word]?.partOfSpeech || '').toLowerCase();
    if (pos === 'verb') return [`to ${w}`, `${w} it`, `${w} with`];
    if (pos === 'noun') return [`a ${w}`, `the ${w}`, `${w} of`];
    if (pos === 'adjective') return [`be ${w}`, `feel ${w}`, `${w} thing`];
    return [w];
  }

  _simpleUsageLine(exprInfo, word, translation) {
    if (exprInfo.type !== 'word') {
      return `Memorize <b style="color:#7dd3fc">${word}</b> como uma peça só. O sentido real vem do bloco.`;
    }
    return `Use <b style="color:#7dd3fc">${word}</b>${translation ? ` como "${translation}"` : ''}, mas confirme pelo contexto da frase.`;
  }

  async _buildExamples() {
    this._exBuilt = true;
    const q = (s) => this._q(s);
    const d = this.cache[this.word] || {};
    const exs = [];
    if (d.example) exs.push({ en: d.example, src: 'Dicionário Oxford' });
    // Fetch more
    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(this.word)}`,
      );
      if (res.ok) {
        const arr = await res.json();
        arr[0]?.meanings?.forEach((m) =>
          m.definitions?.forEach((def) => {
            if (def.example && exs.length < 8) exs.push({ en: def.example, src: m.partOfSpeech });
          }),
        );
      }
    } catch {}
    if (!exs.length) {
      q('#fexb').innerHTML =
        '<div style="color:#475569;font-size:13px;text-align:center;padding:16px 0;">Nenhum exemplo no dicionário.<br>Use "Explicar melhor" na aba Uso Real para ver o sentido no contexto.</div>';
      return;
    }
    // Translate all examples
    const hl = (t, w) =>
      t.replace(new RegExp(`\\b(${w})\\b`, 'gi'), '<b style="color:#7dd3fc">$1</b>');
    q('#fexb').innerHTML =
      '<div style="color:#475569;font-size:12px;text-align:center;padding:8px;">Traduzindo exemplos…</div>';

    // Tradução sequencial para não sobrecarregar o canal de mensagens
    const translated = [];
    for (const e of exs) {
      const tr = await this._translate(e.en);
      translated.push(tr);
    }

    q('#fexb').innerHTML = exs
      .map(
        (e, i) => `
      <div class="lfp-ex">
        <div style="margin-bottom:5px;">${hl(e.en, this.word)}</div>
        <div style="font-size:12px;color:#7dd3fc;font-style:italic;line-height:1.5;">→ ${translated[i] || '…'}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
          <div style="font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:.07em;">${e.src}</div>
          <button class="lfp-shadow-btn" data-text="${e.en.replace(/"/g, '&quot;')}" style="background:rgba(56,189,248,0.1); border:none; border-radius:6px; color:#38bdf8; padding:3px 8px; font-size:11px; cursor:pointer; font-weight:700;">🎧 Shadowing</button>
        </div>
      </div>`,
      )
      .join('');

    // Bind shadowing buttons
    q('#fexb')
      .querySelectorAll('.lfp-shadow-btn')
      .forEach((btn) => {
        btn.onclick = async () => {
          const text = btn.dataset.text;
          const BASE = chrome.runtime.getURL('utils/');
          const { tts } = await import(BASE + 'tts.js');

          btn.textContent = '🔊 Ouvindo...';
          await tts.play(text, 'en-US');

          btn.textContent = '🎙️ Sua vez!';
          btn.style.background = 'rgba(74,222,128,0.1)';
          btn.style.color = '#4ade80';

          setTimeout(() => {
            btn.textContent = '🎧 Shadowing';
            btn.style.background = 'rgba(56,189,248,0.1)';
            btn.style.color = '#38bdf8';
          }, 3000);
        };
      });
  }

  // Os métodos _ai, _aiSentence e _aiGrammar foram movidos para o final do arquivo para melhor organização.

  async _getVideoUrlWithTimestamp() {
    const BASE = chrome.runtime.getURL('utils/');
    const { videoUtils } = await import(BASE + 'video-utils.js');
    return videoUtils.getVideoUrlWithTimestamp();
  }

  async _save() {
    const q = (s) => this._q(s);
    const btn = q('#fsave');

    // Check if already saving (prevent double-click)
    if (btn.disabled) return;

    const originalText = btn.textContent;
    btn.textContent = '⏳ Salvando...';
    btn.disabled = true;

    const d = this.cache[this.word] || {};
    const BASE = chrome.runtime.getURL('utils/');

    try {
      const { db } = await import(BASE + 'db.js');
      const { videoUtils } = await import(BASE + 'video-utils.js');
      const lang = this.engine?.sourceLang || 'en';

      // Leitura local: não faz refresh/rede no clique. Se o token precisar ser
      // renovado, o service worker fará isso ao sincronizar a fila.
      const localSession = await db._readSession();
      if (!localSession?.access_token) {
        btn.textContent = '🔒 Faça login no Dashboard';
        btn.style.background = 'linear-gradient(135deg,#b45309,#d97706)';
        setTimeout(() => {
          btn.textContent = '+ Salvar nos Flashcards';
          btn.style.background = 'linear-gradient(135deg,#1d4ed8,#2563eb)';
          btn.disabled = false;
        }, 3000);
        return;
      }

      // Upsert no servidor resolve duplicidade. Tradução/classificação faltante
      // é enriquecida depois e não bloqueia a intenção de salvar.
      const translation = d.translation || '';

      // SALVA JÁ — nada de esperar a IA gerar chunks (era a "demora ao salvar").
      // O backfill do service worker roda em background depois do saveWord e
      // completa chunks/frases sozinho.
      if (!d.phonetic && this.generatedChunks && this.generatedChunks.length > 0) {
        d.phonetic = this.generatedChunks[0].phon;
      }

      // Capture o trecho antes de qualquer await: enquanto o dicionário/DB
      // responde, o vídeo pode avançar para outra fala.
      const videoClip = videoUtils.getVideoClip
        ? videoUtils.getVideoClip(this.currentCue)
        : { video_url: await this._getVideoUrlWithTimestamp(), video_start_ms: null, video_end_ms: null };

      const payload = {
        word: this.word,
        lang: this.engine?.sourceLang || 'en',
        translation: translation,
        phonetic: d.phonetic || '',
        pronunciation_pt: d.pronunciation_pt || this._convertIPAtoPT(d.phonetic || '') || '',
        definition: d.definition || '',
        // saveContext = frase completa (sem "..."); this.context é a versão
        // truncada de exibição e fica só como último fallback (§3.2).
        context_sentence: this.saveContext || this.context || '',
        video_url: videoClip.video_url,
        video_start_ms: videoClip.video_start_ms,
        video_end_ms: videoClip.video_end_ms,
        video_title: document.title,
        platform: this.platform || 'youtube',
        level: this.activeLevel || '',
        synonyms: (d.synonyms || []).join(','),
        antonyms: (d.antonyms || []).join(','),
        snapshot: null,
        chunks: this.generatedChunks || null,
      };

      const result = await chrome.runtime.sendMessage({ type: 'QUEUE_WORD_SAVE', payload });

      if (!result?.ok || !result?.queued) {
        throw new Error(result?.error || 'Não foi possível guardar o salvamento localmente.');
      }
      console.debug('[WordPopup] ✅ Palavra guardada; sincronização em segundo plano:', result.queueId);

      // §3.3: o botão NÃO volta a "+ Salvar" depois de 2s — esse reset
      // convidava um segundo clique que sobrescrevia a captura original.
      // Fica verde, desabilitado e explicado; showForWord reavalia o estado
      // na próxima palavra/abertura.
      btn.textContent = '✅ Salvo nos Flashcards';
      btn.style.background = 'linear-gradient(135deg,#15803d,#16a34a)';
      btn.title = 'Já está no seu Cofre — re-salvar sobrescreveria a cena original';
      btn.disabled = true;

      // Mostra toast de confirmação
      this._showSaveToast();

      // A1 do backlog (W1): salvar NAO encerra o fluxo — 15s de primeira
      // recuperacao criam a primeira evidencia e evitam o cemiterio de cards.
      this._showFirstRecall(translation);

      // O player atualiza instantaneamente. Dashboard/cofre só recebem o
      // broadcast quando o servidor confirmar a sincronização.
      window.dispatchEvent(
        new CustomEvent('LF_WORD_SAVED', {
          detail: { word: this.word, queued: true },
        }),
      );

      console.debug('[WordPopup] 📢 Estado local atualizado');
    } catch (e) {
      console.error('[WordPopup] ❌ Erro ao salvar:', e);
      btn.textContent = '❌ Erro';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);
    }
  }

  _showSaveToast() {
    let toast = document.getElementById('lf-save-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'lf-save-toast';
      toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: rgba(16, 185, 129, 0.95);
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 600;
        z-index: 2147483647;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        animation: slideInRight 0.3s ease-out;
      `;
      document.body.appendChild(toast);

      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideOutRight {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(100px); }
        }
      `;
      document.head.appendChild(style);
    }

    toast.textContent = `✅ "${this.word}" salvo no dashboard!`;
    toast.style.display = 'block';
    toast.style.animation = 'slideInRight 0.3s ease-out';

    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => (toast.style.display = 'none'), 300);
    }, 3000);
  }

  _translate(t) {
    return new Promise((res) => {
      chrome.runtime.sendMessage(
        {
          action: 'translate',
          text: t,
          from: this.engine?.sourceLang || 'en',
          to: this.engine?.targetLang || 'pt',
        },
        (r) => {
          if (chrome.runtime.lastError) {
            res(null);
            return;
          }
          res(r?.translation || null);
        },
      );
    });
  }
  _dict(w) {
    return new Promise((res) => {
      chrome.runtime.sendMessage({ action: 'dictionary', word: w }, (r) => {
        if (chrome.runtime.lastError || !r?.ok) {
          res({});
          return;
        }
        res(r.data || {});
      });
    });
  }
  _convertIPAtoPT(ipa) {
    if (!ipa) return '';
    let s = ipa.replace(/[\/\[\]ˈˌː.]/g, '').toLowerCase();
    const map = {
      aɪ: 'ái',
      eɪ: 'êi',
      ɔɪ: 'ói',
      aʊ: 'áu',
      oʊ: 'ôu',
      əʊ: 'ôu',
      æ: 'é',
      ɑ: 'á',
      ɒ: 'ó',
      ɔ: 'ó',
      e: 'é',
      ɛ: 'é',
      ɜ: 'âr',
      ɪ: 'i',
      i: 'í',
      ʌ: 'ã',
      ʊ: 'u',
      u: 'ú',
      ə: 'â',
      ʧ: 'tch',
      dʒ: 'dj',
      ʃ: 'ch',
      ʒ: 'j',
      θ: 'f',
      ð: 'd',
      ŋ: 'ng',
      j: 'i',
      w: 'u',
      ɹ: 'r',
      r: 'r',
    };
    // Passada ÚNICA com regex alternado (§3.1 da auditoria): a versão antiga
    // aplicava o mapa em cascata sobre a mesma string, então a SAÍDA de uma
    // regra virava ENTRADA da seguinte — ɪ→'i' e depois i→'í' faziam todo som
    // curto virar longo: "sit" saía "sít" (lê-se como "seat"). Exatamente a
    // distinção ship/sheep, a mais difícil para brasileiros, destruída em
    // toda palavra. Dígrafos vêm primeiro no alternado para vencer o match.
    const keys = Object.keys(map).sort((a, b) => b.length - a.length);
    const pattern = new RegExp(keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    s = s.replace(pattern, (m) => map[m]);
    s = s.replace(/([bcdfghjklmnpqrstvwxyz])\1+/g, '$1');
    return s;
  }

  async _explainContext(word, sentence) {
    const q = (s) => this._q(s);
    const el = q('#fctxt');
    const container = q('#fctx');

    this._contextExplained = true;
    container.style.display = '';

    el.innerHTML =
      '<span style="color:#94a3b8;font-size:12px;">Analisando estrutura e acionando Professor (IA)...</span>';

    try {
      const sentenceTranslation = await this._translate(sentence);
      const BASE = chrome.runtime.getURL('utils/');
      const { phrasalVerbsDB } = await import(BASE + 'phrasal-verbs.js');
      const exprInfo = this._detectExprType(word, phrasalVerbsDB);

      const typeDescriptions = {
        phrasal: {
          title: 'Phrasal verb',
          desc: 'Leia como uma ideia só. Traduzir palavra por palavra costuma enganar.',
          icon: '🔗',
        },
        idiom: {
          title: 'Expressão idiomática',
          desc: 'O sentido vem do conjunto, não das palavras separadas.',
          icon: '🎭',
        },
        chunk: {
          title: 'Chunk',
          desc: 'Bloco pronto que nativos usam sem montar palavra por palavra.',
          icon: '🧩',
        },
        collocation: {
          title: 'Combinação natural',
          desc: 'Palavras que soam certas juntas. Guarde o par completo.',
          icon: '🤝',
        },
        slang: { title: 'Gíria', desc: 'Uso informal. Bom para entender fala real.', icon: '🔥' },
        formal: {
          title: 'Registro formal',
          desc: 'Mais comum em escrita, trabalho ou fala cuidadosa.',
          icon: '🎩',
        },
      };

      const tinfo = typeDescriptions[exprInfo.type];
      let nativeHtml = '';

      if (tinfo) {
        nativeHtml = `
              <div style="background:rgba(251,191,36,0.1); border-left:3px solid #fbbf24; padding:8px; border-radius:4px; margin-bottom:8px;">
                <b style="color:#fbbf24; font-size:13px;">${tinfo.icon} ${tinfo.title}</b><br>
                <span style="color:#cbd5e1; font-size:12px;">${tinfo.desc}</span>
              </div>
            `;
      }

      // Puxa a IA direto (sem botão)
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: 'ai_quick_context',
            word: word,
            sentence: sentence,
          },
          (r) => {
            if (chrome.runtime.lastError) resolve(null);
            else resolve(r);
          },
        );
      });

      if (response?.explanation) {
        const aiExplanation = response.explanation.replace(/\n/g, '<br>');
        el.innerHTML = nativeHtml + aiExplanation;
      } else {
        // Fallback caso a IA falhe
        el.innerHTML =
          nativeHtml +
          `
              <b style="color:#7dd3fc">Frase traduzida:</b> <span style="color:#94a3b8">${sentenceTranslation || 'tradução indisponível'}</span><br>
              <span style="color:#f87171;font-size:12px;display:block;margin-top:8px;">Falha ao obter professor IA. Limite atingido ou offline.</span>
            `;
      }
    } catch (e) {
      console.error('[WordPopup] Erro geral no contexto:', e);
      el.innerHTML = `<span style="color:#f87171;font-size:12px;">Erro interno ao carregar contexto.</span>`;
    }
  }

  async _generateContext(word) {
    const q = (s) => this._q(s);
    const el = q('#fctxt');
    const container = q('#fctx');

    this._contextExplained = true;
    container.style.display = '';

    el.innerHTML =
      '<span style="color:#94a3b8;font-size:12px;">Gerando frase natural com IA (sem contexto na origem)...</span>';

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: 'ai_generate_sentence',
            word: word,
          },
          (r) => {
            if (chrome.runtime.lastError) resolve(null);
            else resolve(r);
          },
        );
      });

      if (response?.sentence) {
        // Save back so the user can save it in flashcards
        this.context = response.sentence;
        this.saveContext = response.sentence; // frase da IA é completa por construção
        
        el.innerHTML = `
          <div style="background:rgba(56,189,248,0.1); border-left:3px solid #38bdf8; padding:8px; border-radius:4px; margin-bottom:8px;">
            <b style="color:#38bdf8; font-size:13px;">🤖 Exemplo Gerado (IA)</b><br>
            <span style="color:#cbd5e1; font-size:12px;">Como você salvou a palavra isolada, geramos um contexto real para você estudar:</span>
          </div>
          <b style="color:#e2e8f0; font-size: 15px;">"${response.sentence}"</b><br>
          <span style="color:#94a3b8; font-size:13px; display:block; margin-top:4px;">${response.translation || ''}</span>
        `;
      } else {
        el.innerHTML =
          '<span style="color:#f87171;font-size:12px;">Falha ao gerar exemplo. Limite da IA atingido ou sem login.</span>';
      }
    } catch (e) {
      console.error('[WordPopup] Erro ao gerar contexto:', e);
      el.innerHTML = `<span style="color:#f87171;font-size:12px;">Erro interno ao gerar contexto.</span>`;
    }
  }

  _loadReverso() {
    const wordEncoded = encodeURIComponent(this.word);
    const url = `https://context.reverso.net/translation/english-portuguese/${wordEncoded}`;
    window.open(url, '_blank');
  }

  _phrasals(word) {
    // Agora carregado dinamicamente no _buildGrammar para manter o arquivo principal leve.
    return [];
  }

  _posLabel(pos) {
    const map = {
      noun: 'substantivo',
      verb: 'verbo',
      adjective: 'adjetivo',
      adverb: 'advérbio',
      preposition: 'preposição',
      conjunction: 'conjunção',
      pronoun: 'pronome',
      interjection: 'interjeição',
      article: 'artigo',
      determiner: 'determinante',
      exclamation: 'exclamação',
    };
    return map[pos?.toLowerCase()] || pos || '';
  }



  _posDetail(pos, w) {
    const m = {
      noun: `<b style="color:#7dd3fc">Substantivo</b> — Pessoa, lugar, coisa ou ideia.<br>• Artigo: <span style="color:#7dd3fc">a/an/the ${w}</span><br>• Plural: <span style="color:#7dd3fc">${w}s</span> • Possessivo: <span style="color:#7dd3fc">${w}'s</span>`,
      verb: `<b style="color:#4ade80">Verbo</b> — Ação ou estado.<br>• Base: <span style="color:#4ade80">${w}</span> • 3ª pessoa: <span style="color:#4ade80">${w}s</span><br>• Gerúndio: <span style="color:#4ade80">${w}ing</span> • Passado: <span style="color:#4ade80">${w}ed</span><br>• Passiva: <span style="color:#4ade80">be/was ${w}ed</span>`,
      adjective: `<b style="color:#fbbf24">Adjetivo</b> — Descreve substantivos.<br>• Antes do noun: <span style="color:#fbbf24">${w} + noun</span><br>• Após linking verb: <span style="color:#fbbf24">be/seem/look + ${w}</span><br>• Comparativo: <span style="color:#fbbf24">more ${w}</span> • Superlativo: <span style="color:#fbbf24">most ${w}</span>`,
      adverb: `<b style="color:#f472b6">Advérbio</b> — Modifica verbos, adjetivos ou advérbios.<br>• Geralmente termina em <b>-ly</b><br>• Ex: very, quite, rather, too + <span style="color:#f472b6">${w}</span>`,
      preposition: `<b style="color:#a78bfa">Preposição</b> — Relação entre elementos.<br>• Lugar: in, on, at, under, over<br>• Tempo: at, on, in, before, after<br>• Movimento: to, from, into, through`,
    };
    return (
      m[pos?.toLowerCase()] ||
      `<span style="color:#64748b">Clique "Analisar com IA" para análise detalhada da classe gramatical desta palavra.</span>`
    );
  }

  _patterns(pos, w) {
    const m = {
      verb: `• <b>S + ${w} + O</b> (transitivo)<br>• <b>S + ${w} + to-inf.</b> (ex: want to ${w})<br>• <b>S + ${w} + -ing</b> (ex: enjoy ${w}ing)<br>• <b>S + ${w} + that clause</b>`,
      noun: `• <b>the/a/an + ${w}</b><br>• <b>adj + ${w}</b> (ex: big/small ${w})<br>• <b>${w} + of + sth</b><br>• <b>compound: ${w}+noun</b>`,
      adjective: `• <b>${w} + noun</b> (atributivo)<br>• <b>be/seem/look/feel/sound + ${w}</b><br>• <b>too + ${w} / ${w} + enough</b><br>• <b>very/quite/rather/extremely + ${w}</b>`,
    };
    return (
      m[pos?.toLowerCase()] ||
      `<span style="color:#64748b">Use "Analisar com IA" para ver padrões específicos desta palavra.</span>`
    );
  }

  _findPlayerContainer() {
    const selectors = {
      youtube: ['#movie_player', '.html5-video-player', '#ytd-player'],
      netflix: ['.watch-video', '.NFPlayer', '#netflix-player'],
      max: [
        '[data-testid="player-container"]',
        '[class*="PlayerContainer"]',
        '#hbo-max-player-container',
      ],
      disney: ['.btm-media-clients', '#disney-player-container'],
      prime: ['.rendererContainer', '#dv-web-player'],
    };
    const platformSelectors = selectors[this.platform] || [];
    for (const sel of platformSelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetHeight > 100) {
        const pos = window.getComputedStyle(el).position;
        if (pos === 'static') el.style.position = 'relative';
        return el;
      }
    }
    const video = document.querySelector('video');
    if (video) {
      let parent = video.parentElement;
      let attempts = 0;
      while (parent && attempts < 8) {
        const rect = parent.getBoundingClientRect();
        const style = window.getComputedStyle(parent);
        if (rect.width > 400 && rect.height > 300 && style.display !== 'contents') {
          if (style.position === 'static') parent.style.position = 'relative';
          return parent;
        }
        parent = parent.parentElement;
        attempts++;
      }
    }
    return null;
  }

  _startPosLoop() {
    if (this._posLoopRunning) return;
    this._posLoopRunning = true;

    if (this.platform === 'max') {
      const schedule = () => {
        if (!this.popup || this.popup.style.display === 'none' || this._positionFrame) return;
        this._positionFrame = requestAnimationFrame(() => {
          this._positionFrame = 0;
          this._position();
        });
      };
      if (!this._maxPositionAbort) {
        this._maxPositionAbort = new AbortController();
        const signal = this._maxPositionAbort.signal;
        window.addEventListener('resize', schedule, { signal });
        document.addEventListener('fullscreenchange', () => {
          const root = document.fullscreenElement || document.body;
          if (this.popup.parentElement !== root) root.appendChild(this.popup);
          schedule();
        }, { signal });
        this._maxPositionObserver = new ResizeObserver(schedule);
        this._maxPositionObserver.observe(this.popup);
        const subtitleHost = document.getElementById('linguaflow-subtitle-host');
        if (subtitleHost) this._maxPositionObserver.observe(subtitleHost);
        this._maxPositionMutationObserver = new MutationObserver(schedule);
        if (subtitleHost) {
          this._maxPositionMutationObserver.observe(subtitleHost, {
            attributes: true,
            attributeFilter: ['style'],
          });
        }
      }
      schedule();
      return;
    }
    
    const loop = () => {
      if (!this.popup || this.popup.style.display === 'none') {
        this._posLoopRunning = false;
        return;
      }
      this._position();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  _position() {
    this.popup.style.display = 'block';

    const subtitleHost = document.getElementById('linguaflow-subtitle-host');

    const pw = 340;

    const maxSubtitleRect = this.platform === 'max' && subtitleHost
      ? subtitleHost.getBoundingClientRect()
      : null;
    if (maxSubtitleRect && maxSubtitleRect.width > 0 && maxSubtitleRect.height > 0) {
      const root = document.fullscreenElement || document.body;
      if (this.popup.parentElement !== root) root.appendChild(this.popup);
      const layout = computeMaxPopupLayout({
        viewportWidth: window.innerWidth,
        subtitleTop: maxSubtitleRect.top,
        popupWidth: pw,
        popupHeight: this.popup.scrollHeight || this.popup.offsetHeight,
        anchorRect: this._anchorRect,
      });
      const signature = `${layout.left}:${layout.top}:${layout.maxHeight}`;
      if (this._lastMaxLayout !== signature) {
        this._lastMaxLayout = signature;
        Object.assign(this.popup.style, {
          position: 'fixed',
          top: `${layout.top}px`,
          left: `${layout.left}px`,
          right: 'auto',
          bottom: 'auto',
          transform: 'none',
          width: `${pw}px`,
          maxWidth: 'calc(100vw - 20px)',
          height: 'auto',
          maxHeight: `${layout.maxHeight}px`,
          borderRadius: '16px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
          overflowY: 'auto',
        });
      }
      return;
    }

    const player = this.engine?._findPlayerContainer?.();
    
    if (player && this.popup.parentElement === player) {
      // Relative to player
      const playerW = player.offsetWidth || player.clientWidth;
      const playerH = player.offsetHeight || player.clientHeight;

      const centerX = playerW / 2;
      let localLeft = centerX - pw / 2;
      localLeft = Math.max(10, Math.min(localLeft, playerW - pw - 10));

      let ceilingLocal = playerH;
      if (subtitleHost && subtitleHost.offsetParent) {
        // Obter posição relativa ao player subtraindo os tops
        const playerRect = player.getBoundingClientRect();
        const subRect = subtitleHost.getBoundingClientRect();
        ceilingLocal = subRect.top - playerRect.top;
      }

      let localTop = ceilingLocal - this.popup.offsetHeight - 16;
      if (localTop < 10) localTop = 10;

      const newTop = `${localTop}px`;
      const newLeft = `${localLeft}px`;

      if (this._lastTop !== newTop || this._lastLeft !== newLeft) {
        this._lastTop = newTop;
        this._lastLeft = newLeft;
        Object.assign(this.popup.style, {
          position: 'absolute',
          top: newTop,
          left: newLeft,
          right: 'auto',
          bottom: 'auto',
          transform: 'none',
          width: `${pw}px`,
          maxWidth: '90%',
          height: 'auto',
          maxHeight: '80%',
          borderRadius: '16px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
          overflowY: 'auto',
        });
      }
    } else {
      // Fallback relative to viewport
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const centerX = viewportW / 2;
      let leftViewport = centerX - pw / 2;
      leftViewport = Math.max(10, Math.min(leftViewport, viewportW - pw - 10));

      let ceilingViewport = viewportH;
      if (subtitleHost && subtitleHost.offsetParent) {
        ceilingViewport = subtitleHost.getBoundingClientRect().top;
      }

      let topViewport = ceilingViewport - this.popup.offsetHeight - 16;
      if (topViewport < 10) topViewport = 10;

      const newTop = `${topViewport}px`;
      const newLeft = `${leftViewport}px`;

      if (this._lastTop !== newTop || this._lastLeft !== newLeft) {
        this._lastTop = newTop;
        this._lastLeft = newLeft;
        Object.assign(this.popup.style, {
          position: 'fixed',
          top: newTop,
          left: newLeft,
          right: 'auto',
          bottom: 'auto',
          transform: 'none',
          width: `${pw}px`,
          maxWidth: '90vw',
          height: 'auto',
          maxHeight: '80vh',
          borderRadius: '16px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
          overflowY: 'auto',
        });
      }
    }
    // Garante o keyframe de animação popup
    if (!document.getElementById('lfp-pop-k')) {
      const s = document.createElement('style');
      s.id = 'lfp-pop-k';
      s.textContent =
        '@keyframes lfpPopIn{from{transform:translateY(10px) scale(0.95);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}';
      document.head.appendChild(s);
    }
  }

  // A1 (W1): microetapa de primeira recuperacao. Frase com o termo oculto +
  // 3 sentidos (1 correto + 2 distratores do proprio cofre). Sem cronometro,
  // Pular sempre visivel, video nunca e retomado no meio. O resultado vai
  // para uma fila local (QUEUE_FIRST_RECALL) que o service worker drena
  // quando o card existir no banco — mesmo padrao local-first do save.
  async _showFirstRecall(translation) {
    try {
      const correct = String(translation || '').trim();
      if (!correct || correct === '...') return;
      const savedWord = this.word;
      const BASE = chrome.runtime.getURL('utils/');
      const { db } = await import(BASE + 'db.js');
      const words = await db.getAllWords().catch(() => []);
      if (this.word !== savedWord) return; // usuario ja clicou outra palavra

      const pool = (words || [])
        .map((w) => String(w.translation || '').trim())
        .filter((t) => t && t !== '...' && t.toLowerCase() !== correct.toLowerCase());
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const distractors = [...new Set(pool)].slice(0, 2);
      if (distractors.length < 2) return; // cofre pequeno: pula em silencio

      const options = [correct, ...distractors];
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }

      const sentence = this.saveContext || this.context || '';
      const esc = (v) => this._escapeAttr(v);
      let cloze = esc(sentence);
      try {
        const re = new RegExp('\\b(' + this._escapeRegExp(esc(savedWord)) + ')\\b', 'gi');
        cloze = cloze.replace(re, '<span style="border-bottom:2px dashed #7dd3fc;color:transparent;text-shadow:0 0 14px rgba(125,211,252,.9);">$1</span>');
      } catch { /* sem cloze, mostra a frase */ }

      this.popup.querySelector('#lfp-recall')?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'lfp-recall';
      overlay.style.cssText = 'position:absolute;inset:0;z-index:60;background:#0b1220;border-radius:inherit;display:flex;flex-direction:column;gap:10px;padding:18px;overflow:auto;';
      overlay.innerHTML = `
        <div style="font-size:12px;font-weight:800;letter-spacing:.06em;color:#7dd3fc;">SALVA! E O SENTIDO, FICOU?</div>
        <div style="font-size:15px;line-height:1.55;color:#e2e8f0;">${cloze || esc(savedWord)}</div>
        <div style="font-size:12px;color:#94a3b8;">O que <b style="color:#7dd3fc;">${esc(savedWord)}</b> significa aqui?</div>
        <div id="lfp-recall-opts" style="display:flex;flex-direction:column;gap:8px;">
          ${options.map((opt) => `<button type="button" data-opt="${esc(opt)}" style="text-align:left;padding:10px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.3);background:rgba(148,163,184,.08);color:#e2e8f0;font-size:13px;font-weight:700;cursor:pointer;">${esc(opt)}</button>`).join('')}
        </div>
        <button type="button" id="lfp-recall-skip" style="margin-top:auto;align-self:center;background:none;border:none;color:#64748b;font-size:12px;cursor:pointer;text-decoration:underline;">Pular</button>`;
      this.popup.appendChild(overlay);

      const finish = (quality) => {
        try {
          chrome.runtime.sendMessage({
            type: 'QUEUE_FIRST_RECALL',
            payload: { word: savedWord, lang: this.engine?.sourceLang || 'en', quality },
          });
        } catch { /* fila e melhor-esforco; o save ja esta garantido */ }
      };

      overlay.querySelector('#lfp-recall-skip').onclick = () => overlay.remove();
      overlay.querySelectorAll('[data-opt]').forEach((btn) => {
        btn.onclick = () => {
          const isCorrect = btn.dataset.opt.toLowerCase() === correct.toLowerCase();
          overlay.querySelectorAll('[data-opt]').forEach((b) => {
            b.disabled = true;
            if (b.dataset.opt.toLowerCase() === correct.toLowerCase()) {
              b.style.background = 'rgba(134,239,172,.18)';
              b.style.borderColor = '#86efac';
            }
          });
          if (!isCorrect) { btn.style.background = 'rgba(248,113,113,.18)'; btn.style.borderColor = '#f87171'; }
          finish(isCorrect ? 3 : 1);
          setTimeout(() => { overlay.remove(); this.hide(true); }, 1100);
        };
      });
    } catch (e) {
      console.warn('[WordPopup] first recall indisponivel:', e);
    }
  }

  hide(resumeVideo = false) {
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
    }, 200);
  }
  async _aiSentence() {
    const q = (s) => this._q(s);
    const btn = q('#faisent');
    const resEl = q('#fair');
    if (!this.context) return alert('Frase de contexto não encontrada.');
    if (btn.disabled) return;
    btn.innerHTML =
      '<span class="lfp-spin" style="border-top-color:#fbbf24"></span> Analisando frase…';
    btn.disabled = true;
    q('#fair-container').style.display = 'block';
    resEl.innerHTML =
      '<div style="padding:10px;text-align:center;"><span class="lfp-spin" style="border-top-color:#fbbf24"></span> Desconstruindo a frase com IA...</div>';
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'ai_explain_sentence',
            sentence: this.context,
            fullContext: this.currentCue?.fullContext || null, // Passa o diálogo ao redor
          },
          (res) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(res);
            }
          },
        );
      });

      if (response?.analysis) {
        resEl.innerHTML = this._formatAI(response.analysis);
      } else {
        resEl.innerHTML = `<div style="color:#f87171;padding:10px;">⚠️ <b>Erro na Análise</b><br>${response?.error || 'A IA não conseguiu processar esta frase.'}</div>`;
      }
    } catch (e) {
      console.error('[LinguaFlow] Erro ao analisar frase:', e);
      resEl.innerHTML =
        '<div style="color:#f87171;padding:10px;">⚠️ Falha na comunicação com o Service Worker.</div>';
    } finally {
      btn.textContent = '🔍 Analisar Frase Completa';
      btn.disabled = false;
    }

    q('#fcopy-ai').onclick = () => {
      const text = resEl.textContent;
      navigator.clipboard.writeText(text);
      const copyBtn = q('#fcopy-ai');
      copyBtn.textContent = '✅ Copiado';
      setTimeout(() => (copyBtn.textContent = '📋 Copiar'), 2000);
    };
  }

  async _loadSavedChunks() {
    const q = (s) => this._q(s);
    const container = q('#fchunks-container');
    const btn = q('#fgenchunks');
    try {
      const BASE = chrome.runtime.getURL('utils/');
      const { db } = await import(BASE + 'db.js');
      const saved = await db.getWord(this.word, this.engine?.sourceLang || 'en');
      if (saved?.chunks?.length) {
        this._chunksBuilt = true;
        this.generatedChunks = saved.chunks;
        let html = '';
        saved.chunks.forEach((c) => {
          html += `<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px;margin-bottom:10px;">
            <div style="font-size:14px;color:#e2e8f0;font-weight:700;margin-bottom:4px;">${c.eng}</div>
            <div style="font-size:12px;color:#94a3b8;font-style:italic;margin-bottom:8px;">${c.pt}</div>
            <div style="font-size:13px;color:#fbbf24;font-family:monospace;font-weight:600;background:rgba(251,191,36,.1);padding:4px 8px;border-radius:6px;display:inline-block;border:1px solid rgba(251,191,36,.3);">${c.phon}</div>
          </div>`;
        });
        if (container) container.innerHTML = html;
        if (btn) btn.textContent = '🔄 Regenerar Chunks';
      } else if (container) {
        container.innerHTML =
          '<div style="text-align:center;color:#475569;font-size:13px;padding:16px;">Clique "Gerar" para criar chunks de treino com IA.</div>';
        if (btn) {
          btn.style.display = 'block';
          btn.disabled = false;
        }
      }
    } catch (e) {
      if (container) {
        container.innerHTML =
          '<div style="text-align:center;color:#475569;font-size:13px;padding:16px;">Clique "Gerar" para criar chunks de treino com IA.</div>';
      }
    }
  }

  async _generateChunks() {
    const q = (s) => this._q(s);
    const btn = q('#fgenchunks');
    const resEl = q('#fchunks-container');
    if (btn?.disabled) return;

    if (btn) {
      btn.innerHTML = '<span class="lfp-spin"></span> Gerando Chunks…';
      btn.disabled = true;
    }
    if (resEl) {
      resEl.innerHTML =
        '<div style="text-align:center;color:#a78bfa;padding:20px;"><span class="lfp-spin"></span> Professor (IA) está montando os chunks...</div>';
    }

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'ai_generate_chunks',
            word: this.word,
          },
          (r) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(r);
          },
        );
      });

      if (response?.chunks) {
        this._chunksBuilt = true;
        this.generatedChunks = response.chunks;

        let html = '';
        response.chunks.forEach((c) => {
          html += `
            <div style="background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08); border-radius:10px; padding:12px; margin-bottom:10px;">
                <div style="font-size:14px; color:#e2e8f0; font-weight:700; margin-bottom:4px;">${c.eng}</div>
                <div style="font-size:12px; color:#94a3b8; font-style:italic; margin-bottom:8px;">${c.pt}</div>
                <div style="font-size:13px; color:#fbbf24; font-family:monospace; font-weight:600; background:rgba(251,191,36,.1); padding:4px 8px; border-radius:6px; display:inline-block; border:1px solid rgba(251,191,36,.3);">${c.phon}</div>
            </div>`;
        });

        if (resEl) resEl.innerHTML = html;
        if (btn) btn.style.display = 'none';
      } else {
        const errorMsg = response?.error || 'A IA não conseguiu gerar os chunks.';
        if (resEl) {
          resEl.innerHTML = `<div style="color:#f87171;padding:10px;text-align:center;">⚠️ <b>Erro</b><br>${errorMsg}</div>`;
        }
      }
    } catch (e) {
      console.error('[LinguaFlow] Erro ao gerar chunks:', e);
      if (resEl) {
        resEl.innerHTML = `<div style="color:#f87171;padding:10px;text-align:center;">⚠️ Falha na comunicação: ${e.message}</div>`;
      }
    } finally {
      if (btn) {
        btn.textContent = '✦ Gerar Chunks (Professor IA)';
        btn.disabled = false;
      }
    }
  }

  _formatUseRealAI(text) {
    const raw = String(text || '').trim();
    const sections = [
      ['Nesta frase', 'blue'],
      ['Bloco importante', ''],
      ['Não confunda com', 'amber'],
      ['Use assim', 'green'],
    ];
    const escape = (value) => this._escapeAttr(value).replace(/\n/g, '<br>');
    let html = '';

    sections.forEach(([title, tone]) => {
      const re = new RegExp(`\\*\\*${title}:?\\*\\*([\\s\\S]*?)(?=\\n\\s*\\*\\*|$)`, 'i');
      const match = raw.match(re);
      if (!match?.[1]?.trim()) return;
      html += `<div class="lfp-use-card ${tone}">
        <div class="lfp-use-title"><span>${title === 'Nesta frase' ? '🎬' : title === 'Bloco importante' ? '🧩' : title === 'Não confunda com' ? '⚠️' : '✅'}</span><span>${title}</span></div>
        <div class="lfp-use-text">${escape(match[1].trim().replace(/^:/, '').trim())}</div>
      </div>`;
    });

    if (html) return html;
    return `<div class="lfp-use-card"><div class="lfp-use-text">${escape(raw)}</div></div>`;
  }

  _formatAI(text) {
    if (!text) return '';
    let formatted = text
      // Mapeamento dos novos tópicos para um design mais "Duolingo" (cores suaves, ícones arredondados, bordas de 2px)
      .replace(
        /\*\*(.*?A ideia aqui.*?)\*\*(.*?)(?=\n\n\*\*|\n\n$|$)/gis,
        (match, title, content) => {
          return `<div style="margin-top:12px;margin-bottom:12px;padding:12px 14px;background:rgba(56,189,248,0.1);border:2px solid rgba(56,189,248,0.3);border-radius:16px;">
              <b style="color:#38bdf8;display:flex;align-items:center;gap:6px;font-size:14px;"><span style="font-size:18px;">💡</span> ${title.replace(/:/g, '').trim()}</b>
              <div style="color:#e0f2fe;margin-top:6px;line-height:1.6;font-size:13px;">${content.trim().replace(/\n/g, '<br>')}</div>
          </div>`;
        }
      )
      .replace(
        /\*\*(.*?O truque.*?)\*\*(.*?)(?=\n\n\*\*|\n\n$|$)/gis,
        (match, title, content) => {
          return `<div style="margin-bottom:12px;padding:12px 14px;background:rgba(250,204,21,0.08);border:2px solid rgba(250,204,21,0.3);border-radius:16px;">
              <b style="color:#facc15;display:flex;align-items:center;gap:6px;font-size:14px;"><span style="font-size:18px;">✨</span> ${title.replace(/:/g, '').trim()}</b>
              <div style="color:#fef08a;margin-top:6px;line-height:1.6;font-size:13px;">${content.trim().replace(/\n/g, '<br>')}</div>
          </div>`;
        }
      )
      .replace(
        /\*\*(.*?Pronúncia da vida real.*?)\*\*(.*?)(?=\n\n\*\*|\n\n$|$)/gis,
        (match, title, content) => {
          return `<div style="margin-bottom:12px;padding:12px 14px;background:rgba(244,114,182,0.08);border:2px solid rgba(244,114,182,0.3);border-radius:16px;">
              <b style="color:#f472b6;display:flex;align-items:center;gap:6px;font-size:14px;"><span style="font-size:18px;">🗣️</span> ${title.replace(/:/g, '').trim()}</b>
              <div style="color:#fbcfe8;margin-top:6px;line-height:1.6;font-size:14px;font-weight:600;font-family:'Outfit',sans-serif;letter-spacing:0.5px;">${content.trim().replace(/\n/g, '<br>')}</div>
          </div>`;
        }
      )
      .replace(
        /\*\*(.*?Exemplos rápidos.*?)\*\*(.*?)(?=\n\n\*\*|\n\n$|$)/gis,
        (match, title, content) => {
          return `<div style="margin-bottom:12px;padding:12px 14px;background:rgba(167,139,250,0.08);border:2px solid rgba(167,139,250,0.3);border-radius:16px;">
              <b style="color:#a78bfa;display:flex;align-items:center;gap:6px;font-size:14px;"><span style="font-size:18px;">💬</span> ${title.replace(/:/g, '').trim()}</b>
              <div style="color:#e9d5ff;margin-top:6px;line-height:1.6;font-size:13px;">${content.trim().replace(/\n/g, '<br>')}</div>
          </div>`;
        }
      )
      // Cabeçalhos antigos mantidos para compatibilidade com respostas já formatadas no histórico.
      .replace(
        /\*\*(.*?Nível Sugerido.*?)\*\*/gi,
        '<b style="color:#fde047;display:block;margin-bottom:8px">⭐ $1</b>',
      )
      .replace(
        /\*\*(.*?na prática.*?)\*\*/gi,
        '<b style="color:#7dd3fc;display:block;margin-top:12px">🎯 $1</b>',
      )
      .replace(
        /\*\*(.*?Como e onde usar.*?)\*\*/gi,
        '<b style="color:#86efac;display:block;margin-top:12px">🎭 $1</b>',
      )
      .replace(
        /\*\*(.*?Colocações Comuns.*?)\*\*/gi,
        '<b style="color:#fb923c;display:block;margin-top:12px">🧩 $1</b>',
      )
      .replace(
        /\*\*(.*?Exemplos Reais.*?)\*\*/gi,
        '<b style="color:#d8b4fe;display:block;margin-top:12px">📝 $1</b>',
      )
      .replace(
        /\*\*(.*?O Molde.*?)\*\*/gi,
        '<div style="margin-top:16px;margin-bottom:8px;padding:6px 12px;background:rgba(110,231,183,0.1);border-left:3px solid #6ee7b7;border-radius:4px;color:#6ee7b7;font-weight:bold;font-size:13px;">🧬 $1</div>',
      )
      .replace(
        /\*\*(.*?Como a Engrenagem Funciona.*?)\*\*/gi,
        '<div style="margin-top:16px;margin-bottom:8px;padding:6px 12px;background:rgba(147,197,253,0.1);border-left:3px solid #93c5fd;border-radius:4px;color:#93c5fd;font-weight:bold;font-size:13px;">⚙️ $1</div>',
      )
      .replace(
        /\*\*(.*?Mão na Massa.*?)\*\*/gi,
        '<div style="margin-top:16px;margin-bottom:8px;padding:6px 12px;background:rgba(251,146,60,0.1);border-left:3px solid #fb923c;border-radius:4px;color:#fb923c;font-weight:bold;font-size:13px;">🛠️ $1</div>',
      )
      .replace(
        /\*\*(.*?Pronúncia de Rua.*?)\*\*/gi,
        '<div style="margin-top:16px;margin-bottom:8px;padding:6px 12px;background:rgba(249,168,212,0.1);border-left:3px solid #f9a8d4;border-radius:4px;color:#f9a8d4;font-weight:bold;font-size:13px;">🗣️ $1</div>',
      )
      .replace(
        /\*\*(.*?Nível Nativo.*?)\*\*/gi,
        '<div style="margin-top:16px;margin-bottom:8px;padding:6px 12px;background:rgba(250,204,21,0.1);border-left:3px solid #facc15;border-radius:4px;color:#facc15;font-weight:bold;font-size:13px;">🔥 $1</div>',
      )
      .replace(
        /##\s*1\.\s*Pronúncia oficial/gi,
        '<div style="margin-top:16px;margin-bottom:8px;padding:6px 12px;background:rgba(147,197,253,0.1);border-left:3px solid #93c5fd;border-radius:4px;color:#93c5fd;font-weight:bold;font-size:13px;">🗣️ 1. Pronúncia Oficial</div>',
      )
      .replace(
        /##\s*2\.\s*Como um brasileiro costuma aprender/gi,
        '<div style="margin-top:16px;margin-bottom:8px;padding:6px 12px;background:rgba(251,146,60,0.1);border-left:3px solid #fb923c;border-radius:4px;color:#fb923c;font-weight:bold;font-size:13px;">🇧🇷 2. Como costuma ser ensinado</div>',
      )
      .replace(
        /##\s*3\.\s*Como realmente soa para um brasileiro/gi,
        '<div style="margin-top:16px;margin-bottom:8px;padding:6px 12px;background:rgba(249,168,212,0.1);border-left:3px solid #f9a8d4;border-radius:4px;color:#f9a8d4;font-weight:bold;font-size:13px;">🔥 3. Como realmente soa</div>',
      )
      .replace(
        /\*\*(.*?Associação Mental.*?)\*\*(.*?)(?=\n\n|\*$|$)/gis,
        (match, title, content) => {
          return `<div style="margin-top:16px;padding:10px;background:rgba(167,139,250,0.1);border-left:3px solid #a78bfa;border-radius:4px;">
              <b style="color:#c084fc">🧠 ${title.replace(/:/g, '').trim()}</b><br><span style="color:#e2e8f0">${content.replace(/\n/g, '<br>')}</span>
          </div>`;
        }
      )
      // Negrito normal
      .replace(/\*\*(.*?)\*\*/g, '<b style="color:#7dd3fc">$1</b>')
      // Itálico
      .replace(/\*(.*?)\*/g, '<i style="color:#94a3b8">$1</i>')
      // Quebras de linha normais
      .replace(/\n/g, '<br>');

    // Limpar brs colados aos banners e blocos
    formatted = formatted.replace(/<br>\s*<div/g, '<div').replace(/<\/div>\s*<br>/g, '</div>');
    return formatted;

  }
  // O hide original com animação está na linha ~734

  async _renderBasicGrammarFallback(resEl, errorMsg) {
    try {
      const sentence = this.context || this.word;
      const words = sentence.split(/[\s,.;!?'"()]+/).filter((w) => w.trim().length > 0);

      let html = '<div>';
      html += `<div class="lfp-use-card amber">
            <div class="lfp-use-title"><span>⚠️</span><span>IA indisponível</span></div>
            <div class="lfp-use-text">Não consegui gerar uma explicação contextual agora.${errorMsg ? `<br><br><b>Detalhe:</b> ${errorMsg}` : ''}</div>
            <div class="lfp-use-muted" style="margin-top:6px;">Você ainda pode usar a tradução, a frase do vídeo e os exemplos para entender o uso.</div>
        </div>`;
      html +=
        '<div class="lfp-use-card blue"><div class="lfp-use-title"><span>🔎</span><span>Palavras da frase</span></div>';

      const { translator } = await import(chrome.runtime.getURL('utils/translator.js'));
      const sourceLang = this.engine?.sourceLang || 'auto';

      // Função auxiliar para buscar a classe gramatical (apenas inglês por enquanto, grátis)
      const fetchPOS = async (word) => {
        if (sourceLang !== 'en' && sourceLang !== 'auto') return '';
        try {
          const res = await fetch(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
          );
          if (!res.ok) return '';
          const data = await res.json();
          if (data && data[0] && data[0].meanings && data[0].meanings[0]) {
            const pos = data[0].meanings[0].partOfSpeech;
            // Traduzir termos comuns
            const map = {
              noun: 'Substantivo',
              verb: 'Verbo',
              adjective: 'Adjetivo',
              adverb: 'Advérbio',
              pronoun: 'Pronome',
              preposition: 'Preposição',
              conjunction: 'Conjunção',
              interjection: 'Interjeição',
            };
            return map[pos] || pos;
          }
        } catch (e) {}
        return '';
      };

      // Traduz e busca classe gramatical em paralelo
      const tasks = words.map(async (w) => {
        const [trans, pos] = await Promise.all([
          translator.translate(w, sourceLang, 'pt'),
          fetchPOS(w),
        ]);
        return { word: w, translation: trans?.translation || '...', pos: pos };
      });

      const results = await Promise.all(tasks);

      for (let r of results) {
        const posTag = r.pos
          ? `<br><span style="font-size:10px;color:#a78bfa;font-weight:normal;background:rgba(167,139,250,0.15);padding:1px 4px;border-radius:3px;">${r.pos}</span>`
          : '';
        html += `<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05)">
                <div style="font-weight:700;color:#7dd3fc;">${r.word}${posTag}</div>
                <div style="color:#e2e8f0;text-align:right;">${r.translation}</div>
             </div>`;
      }
      html += '</div></div>';
      resEl.innerHTML = html;
      resEl.className = 'ai-res';
    } catch (e) {
      resEl.innerHTML = `<div class="lfp-use-card amber"><div class="lfp-use-title"><span>⚠️</span><span>IA indisponível</span></div><div class="lfp-use-text">Não consegui gerar a explicação agora.<br><br><b>Detalhe técnico:</b> ${e.message}</div></div>`;
    }
  }
}
