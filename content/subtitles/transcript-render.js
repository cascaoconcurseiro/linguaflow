// content/subtitles/transcript-render.js — Funções puras de texto da legenda:
// segmentação em palavras/expressões (tela e roteiro), destaque de busca e
// estado de carregamento do roteiro.
import { escapeHTML } from '../../utils/html.js';
import { MAX_EXPRESSION_WORDS } from '../../utils/expressions-db.js';
import { detectExpressions } from '../../utils/expression-detector.js';

const TOKEN_PATTERN = /[a-zA-ZÀ-ɏ']+|[^a-zA-ZÀ-ɏ']+/g;
const WORD_CHAR = /[a-zA-ZÀ-ɏ]/;

function normalizeApostrophes(text) {
  return String(text || '')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/[‘’]/g, "'");
}

function plainSegments(chunk) {
  return Array.from(chunk.matchAll(TOKEN_PATTERN), (m) => ({
    text: m[0],
    isWord: WORD_CHAR.test(m[0]),
    expression: null,
  }));
}

// Divide a fala em segmentos { text, isWord, expression, kind, hint, meaning }. Expressões
// detectadas (phrasal verb idiomático ou gíria) viram um único segmento com o
// maior bloco possível: clicar em "put" dentro de "put up with" abre "put up with".
export function segmentSubtitle(text, maxExpressionWords = MAX_EXPRESSION_WORDS) {
  const source = normalizeApostrophes(text);
  const segments = [];
  let cursor = 0;
  for (const span of detectExpressions(source, { maxWords: maxExpressionWords })) {
    segments.push(...plainSegments(source.slice(cursor, span.index)));
    segments.push({
      text: span.text,
      isWord: true,
      expression: span.canonical,
      kind: span.type,
      hint: span.hint || null,
      meaning: span.meaning || null,
    });
    cursor = span.index + span.length;
  }
  segments.push(...plainSegments(source.slice(cursor)));
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

// HTML escapado com cada forma (palavra inteira, sem diferenciar caixa) em
// <mark>. Formas com várias palavras aceitam qualquer espaço entre elas.
export function highlightTerms(text, forms, markAttrs = 'class="lf-term-hit"') {
  const source = String(text || '');
  const patterns = [...new Set((forms || []).map((f) => String(f || '').trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
  if (!patterns.length) return escapeHTML(source);
  const regex = new RegExp(`(?<![\\p{L}'])(?:${patterns.join('|')})(?![\\p{L}'])`, 'giu');
  let html = '';
  let cursor = 0;
  for (const match of source.matchAll(regex)) {
    html += escapeHTML(source.slice(cursor, match.index));
    html += `<mark ${markAttrs}>${escapeHTML(match[0])}</mark>`;
    cursor = match.index + match[0].length;
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
