// content/subtitles/transcript-render.js — Funções puras de texto da legenda:
// segmentação em palavras/expressões (tela e roteiro), destaque de busca e
// estado de carregamento do roteiro.
import { escapeHTML } from '../../utils/html.js';
import { expressionsDB, matchExpressionCandidate, MAX_EXPRESSION_WORDS } from '../../utils/expressions-db.js';

const WORD_CHAR = /[a-zA-ZÀ-ɏ]/;

function normalizeApostrophes(text) {
  return String(text || '')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/[‘’]/g, "'");
}

const cleanWord = (token) => token.toLowerCase().replace(/^'+|'+$/g, '');

// Divide a fala em segmentos { text, isWord, expression }. Cada expressão
// conhecida vira um único segmento com o maior bloco possível: clicar em
// "put" dentro de "put up with" abre "put up with", não "put".
export function segmentSubtitle(text, maxExpressionWords = MAX_EXPRESSION_WORDS) {
  const tokens = Array.from(
    normalizeApostrophes(text).matchAll(/[a-zA-ZÀ-ɏ']+|[^a-zA-ZÀ-ɏ']+/g),
    (m) => m[0],
  );
  const segments = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!WORD_CHAR.test(token)) {
      segments.push({ text: token, isWord: false });
      continue;
    }

    let expression = null;
    let matchEnd = i;
    const seenWords = [];
    for (let j = i; j < tokens.length && seenWords.length < maxExpressionWords; j++) {
      if (!WORD_CHAR.test(tokens[j])) continue;
      seenWords.push(cleanWord(tokens[j]));
      if (seenWords.length < 2) continue;
      const match = matchExpressionCandidate(seenWords);
      const candidate = seenWords.join(' ');
      if (match) {
        expression = match.canonical || match.matched;
        matchEnd = j;
      } else if (expressionsDB.has(candidate)) {
        expression = candidate;
        matchEnd = j;
      }
    }

    if (expression) {
      segments.push({ text: tokens.slice(i, matchEnd + 1).join(''), isWord: true, expression });
      i = matchEnd;
    } else {
      segments.push({ text: token, isWord: true, expression: null });
    }
  }
  return segments;
}

// HTML escapado com as ocorrências da busca em <mark> (sem diferenciar caixa).
export function highlightMatches(text, filter) {
  const source = String(text || '');
  const needle = String(filter || '').trim();
  if (!needle) return escapeHTML(source);
  const lower = source.toLowerCase();
  const target = needle.toLowerCase();
  let html = '';
  let cursor = 0;
  let found = lower.indexOf(target, cursor);
  while (found !== -1) {
    html += escapeHTML(source.slice(cursor, found));
    html += `<mark class="lf-search-hit">${escapeHTML(source.slice(found, found + needle.length))}</mark>`;
    cursor = found + needle.length;
    found = lower.indexOf(target, cursor);
  }
  return html + escapeHTML(source.slice(cursor));
}

export const CAPTION_WAIT_MS = 10000;

// 'ready' com falas; 'loading' enquanto a legenda ainda pode chegar;
// 'unavailable' depois do prazo sem nenhuma fala.
export function transcriptState({ cueCount, pendingSince, now = Date.now() }) {
  if (cueCount > 0) return 'ready';
  if (Number.isFinite(pendingSince) && now - pendingSince < CAPTION_WAIT_MS) return 'loading';
  return 'unavailable';
}
