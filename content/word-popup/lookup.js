// content/word-popup/lookup.js — Dados do popup: expressão, CEFR, falsos cognatos, tradução, dicionário, sentidos e trechos de uso.
import { detectExprType, detectFalseFriend, getPosDetail, getPosLabel, getPosPatterns } from '../popup/popup-linguistics.js';

export class LookupMethods {
  async _getPhrasalVerbsDB() {
    if (this._phrasalVerbsDB && this._expressionsDB && this._slangsDB) return this._phrasalVerbsDB;
    if (this._phrasalPromise) return this._phrasalPromise;
    const BASE = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
      ? chrome.runtime.getURL('utils/')
      : '../utils/';
    this._phrasalPromise = (async () => {
      try {
        const [
          { phrasalVerbsDB },
          { expressionsDB, matchExpressionCandidate, getBaseVerbCandidates },
          { slangsDB, slangMatchesContext },
          { expressionKind, detectExpressions },
          { REDUCTIONS },
        ] = await Promise.all([
          import(BASE + 'phrasal-verbs.js'),
          import(BASE + 'expressions-db.js'),
          import(BASE + 'slangs-db.js'),
          import(BASE + 'expression-detector.js'),
          import(BASE + 'speech-cadence.js'),
        ]);
        this._phrasalVerbsDB = phrasalVerbsDB || null;
        this._expressionsDB = expressionsDB || null;
        this._matchExpressionCandidate = matchExpressionCandidate || null;
        this._getBaseVerbCandidates = getBaseVerbCandidates || null;
        this._slangsDB = slangsDB || null;
        this._slangMatchesContext = slangMatchesContext || null;
        this._expressionKind = expressionKind || null;
        this._detectExpressions = detectExpressions || null;
        this._reductions = REDUCTIONS || null;
        return this._phrasalVerbsDB;
      } catch {
        this._phrasalVerbsDB = null;
        return null;
      }
    })();
    return this._phrasalPromise;
  }

  // Detecta o tipo linguístico da expressão clicada (suporta flexões e lematização)
  _detectExprType(word, phrasalVerbsDB) {
    return detectExprType(word, {
      idiomSet: this._idiomSet,
      chunkSet: this._chunkSet,
      expressionsDB: this._expressionsDB,
      matchExpressionCandidate: this._matchExpressionCandidate,
      getBaseVerbCandidates: this._getBaseVerbCandidates,
      phrasalVerbsDB: phrasalVerbsDB || this._phrasalVerbsDB,
      slangsDB: this._slangsDB,
      context: this.saveContext || this.context || '',
      slangMatchesContext: this._slangMatchesContext,
      expressionKind: this._expressionKind,
      detectExpressions: this._detectExpressions,
      reductions: this._reductions,
    });
  }

  _detectFalseFriend(word) {
    return detectFalseFriend(word, this._falseFriends);
  }

  _lookupCEFR(word) {
    const cleanWord = word.toLowerCase();
    return this.engine?.cefrList?.[cleanWord] || this.cefrList?.[cleanWord] || null;
  }
  _cefrLabel(level) {
    const names = {
      A1: 'Iniciante',
      A2: 'Básico',
      B1: 'Intermediário',
      B2: 'Intermediário alto',
      C1: 'Avançado',
      C2: 'Proficiência',
    };
    return names[level] ? `CEFR ${level} · ${names[level]}` : '';
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

    await this._getPhrasalVerbsDB();
    const phrasalDB = this._phrasalVerbsDB;
    const expressionsDB = this._expressionsDB;
    const slangsDB = this._slangsDB;
    const matchExpressionCandidate = this._matchExpressionCandidate;

    const isKnownExpression = (phrase) => {
      if (this._idiomSet?.has(phrase) || this._chunkSet?.has(phrase)) return true;
      if (expressionsDB?.has(phrase)) return true;
      if (slangsDB?.has(phrase)) return true;
      if (matchExpressionCandidate && matchExpressionCandidate(phrase.split(/\s+/))) return true;
      if (!phrasalDB) return false;
      const tokens = phrase.split(/\s+/);
      const first = tokens[0];
      const baseCandidates = this._getBaseVerbCandidates ? this._getBaseVerbCandidates(first) : [first];
      for (const b of baseCandidates) {
        if ((phrasalDB[b] || []).some((e) => {
          const ep = e.phrase?.toLowerCase();
          return ep === phrase || (tokens.length >= 2 && ep === [b, ...tokens.slice(1)].join(' '));
        })) return true;
      }
      return false;
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

  _translate(t) {
    return new Promise((res) => {
      let settled = false;
      const tid = setTimeout(() => {
        if (!settled) {
          settled = true;
          res(null);
        }
      }, 5000);
      try {
        chrome.runtime.sendMessage(
          {
            action: 'translate',
            text: t,
            from: this.engine?.sourceLang || 'en',
            to: this.engine?.targetLang || 'pt',
          },
          (r) => {
            if (settled) return;
            settled = true;
            clearTimeout(tid);
            if (chrome.runtime.lastError) {
              res(null);
              return;
            }
            res(r?.translation || null);
          },
        );
      } catch {
        if (!settled) {
          settled = true;
          clearTimeout(tid);
          res(null);
        }
      }
    });
  }
  _dict(w) {
    return new Promise((res) => {
      let settled = false;
      const tid = setTimeout(() => {
        if (!settled) {
          settled = true;
          res({});
        }
      }, 3000);
      try {
        chrome.runtime.sendMessage({ action: 'dictionary', word: w }, (r) => {
          if (settled) return;
          settled = true;
          clearTimeout(tid);
          if (chrome.runtime.lastError || !r?.ok) {
            res({});
            return;
          }
          res(r.data || {});
        });
      } catch {
        if (!settled) {
          settled = true;
          clearTimeout(tid);
          res({});
        }
      }
    });
  }

  // Traduções por classe gramatical (#366). Falha silenciosa: sem lista, o
  // card fica só com a tradução principal.
  _senses(word) {
    return new Promise((res) => {
      const tid = setTimeout(() => res([]), 4500);
      try {
        chrome.runtime.sendMessage(
          { action: 'wordSenses', word, from: this.engine?.sourceLang || 'en', to: this.engine?.targetLang || 'pt' },
          (r) => {
            clearTimeout(tid);
            res(chrome.runtime.lastError || !Array.isArray(r?.senses) ? [] : r.senses);
          },
        );
      } catch {
        clearTimeout(tid);
        res([]);
      }
    });
  }

  _renderSenses(senses) {
    const section = this._q('#fsenses');
    const list = this._q('#fsenses-list');
    if (!section || !list) return;
    if (!Array.isArray(senses) || !senses.length) {
      section.style.display = 'none';
      return;
    }
    const esc = (s) => this._escapeAttr(s);
    const word = String(this.word || '').toLowerCase();
    list.innerHTML = senses.map((s) => {
      const base = s.base && s.base.toLowerCase() !== word ? ` <span style="color:#94a3b8;font-weight:400;">(${esc(s.base)})</span>` : '';
      return `<div style="display:flex;gap:6px;"><dt style="color:#7dd3fc;font-weight:700;flex-shrink:0;">${esc(s.label)}${base}</dt><dd style="margin:0;">${s.terms.map(esc).join(', ')}</dd></div>`;
    }).join('');
    section.style.display = '';
  }

  _loadReverso() {
    const wordEncoded = encodeURIComponent(this.word);
    const url = `https://context.reverso.net/translation/english-portuguese/${wordEncoded}`;
    window.open(url, '_blank');
  }

  _posLabel(pos) {
    return getPosLabel(pos);
  }

  _posDetail(pos, w) {
    return getPosDetail(pos, w);
  }

  _patterns(pos, w) {
    return getPosPatterns(pos, w);
  }

  _usageChunks(exprInfo, phs) {
    if (phs?.length) return phs.slice(0, 3).map((p) => p.phrase);
    const w = this.word;
    if (exprInfo.type === 'phrasal' || exprInfo.type === 'slang' || w.includes(' ')) return [w];
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
}
