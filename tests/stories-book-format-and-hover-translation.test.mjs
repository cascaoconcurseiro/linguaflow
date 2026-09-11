import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldProxyTranslationThroughExtension } from '../utils/translator.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const stories = read('dashboard/js/ui/storiesView.js');
const translatorSrc = read('utils/translator.js');

// 1. Contrato do Proxy de Tradução: Web App nunca tenta proxy via extensão
const fakeRuntime = { id: 'test-ext-id', sendMessage() {} };
assert.equal(
  shouldProxyTranslationThroughExtension({ protocol: 'https:', hostname: 'linguaflow.vercel.app' }, fakeRuntime),
  false,
  'Dashboard no Vercel não deve tentar proxy pela extensão'
);
assert.equal(
  shouldProxyTranslationThroughExtension({ protocol: 'http:', hostname: 'localhost' }, fakeRuntime),
  false,
  'Dashboard em localhost não deve tentar proxy pela extensão'
);
assert.equal(
  shouldProxyTranslationThroughExtension({ protocol: 'https:' }, fakeRuntime),
  true,
  'Content scripts em páginas externas continuam usando proxy'
);

// 2. Contrato de Detecção de Ambiente na StoriesView
assert.match(
  stories,
  /const isExtension = typeof chrome !== 'undefined' && !!chrome\.runtime && !!chrome\.runtime\.id && \(typeof location !== 'undefined' && location\.protocol === 'chrome-extension:'\);/,
  'isExtension deve verificar estritamente o protocolo chrome-extension: para não quebrar no site web'
);

// 3. Contrato de Tradução Resiliente (translateText)
assert.match(
  stories,
  /vaultTranslations\.has\(cleanLower\)/,
  'translateText deve consultar o cache local/cofre primeiro'
);
assert.match(
  stories,
  /translator\.translate\(clean, 'en', 'pt'\)/,
  'translateText deve acionar o translator universal'
);
assert.match(
  stories,
  /translator\._fetchMyMemory\(clean, 'en', 'pt'\)/,
  'translateText deve conter fallback direto MyMemory para ambiente web'
);

// 4. Contrato de Tooltip de Palavras (showWordTooltip)
assert.match(
  stories,
  /let currentTooltipWordEl = null;/,
  'showWordTooltip deve rastrear o elemento ativo para evitar cancelamentos por jitter do mouse'
);
assert.match(
  stories,
  /translateText\(tokenLemma\)/,
  'showWordTooltip deve tentar o lema caso a forma flexionada não retorne tradução'
);
assert.match(
  stories,
  /wordTooltip\.id = 'lf-story-word-tooltip'/,
  'tooltip de palavras deve ter id definido no elemento'
);

// 5. Contrato de Formatação de Livro e Divisão de Parágrafos
assert.match(
  stories,
  /const normalized = raw[\s\S]*?\.replace\(\/\\r\\n\/g, '\\n'\)[\s\S]*?\.trim\(\)/,
  'renderStoryText deve normalizar quebras escapadas e reais'
);
assert.match(
  stories,
  /pEl\.className = 'story-paragraph';/,
  'cada parágrafo deve receber a classe story-paragraph'
);
assert.match(
  stories,
  /\.story-paragraph\s*\{[^}]*margin:\s*0 0 24px 0;/s,
  'parágrafos devem ter espaçamento de livro de 24px'
);
assert.match(
  stories,
  /#story-content\s*\{[^}]*max-width:\s*680px;[^}]*line-height:\s*1\.85;/s,
  'story-content deve possuir largura de coluna de leitura de 680px e entrelinha 1.85'
);
assert.match(
  stories,
  /id="story-reader-container"[^>]*max-width:\s*780px;/s,
  'card da história deve ser centralizado e contido como uma página de livro'
);

console.log('✓ Formatação de livro e tradução no hover das Histórias verificadas com sucesso!');
