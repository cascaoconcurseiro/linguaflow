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

// 6. Contrato do Popup de Vídeos no Clique das Palavras da História
assert.match(
  stories,
  /id="lf-story-word-modal"[^>]*role="dialog"/,
  'modal de palavra deve existir e ter role dialog'
);
assert.match(
  stories,
  /id="lf-tab-youglish"[^>]*>YouGlish \(vídeos\)</,
  'popup de histórias deve conter a aba YouGlish para ouvir vídeos reais'
);
assert.match(
  stories,
  /id="lf-panel-youglish"/,
  'popup de histórias deve conter painel do YouGlish com vídeos reais'
);
assert.match(
  stories,
  /https:\/\/youglish\.com\/pronounce\//,
  'popup de histórias deve conter rotas com pronúncias nativas no YouGlish'
);
assert.match(
  stories,
  /id="lf-btn-known-word"/,
  'popup de histórias deve conter botão "Já sei esta palavra"'
);
assert.match(
  stories,
  /FALSE_FRIENDS/,
  'deve conter mapeamento de falsos cognatos perigosos'
);
assert.match(
  stories,
  /formatStoryAsBook\(normalized\)/,
  'renderStoryText deve utilizar formatStoryAsBook para segmentar parágrafos'
);

// 7. Teste funcional da função formatStoryAsBook com texto contínuo sem quebras duplas
import { formatStoryAsBook, FALSE_FRIENDS } from '../dashboard/js/ui/storiesView.js';

const sampleOneBlock = `Amara stands in front of the neighborhood gym. The air stinks like old socks and sweat. She holds her gym bag tight. Today is her first day at this new place. "Hi," a woman says. "I'm Rosa. Are you here for the class?" "Yes," Amara says. "But I'm a little shy." "Don't worry," Rosa says. "Everyone is friendly here. We're all learning." Rosa shows her the room. There are ten people. A man drops his water bottle. It makes a big mess. "Sorry," he says. "I'm always messing up." "No problem," Rosa says. "We can clean it later."`;
const paragraphs = formatStoryAsBook(sampleOneBlock);
assert(paragraphs.length >= 5, `Texto contínuo deve ser dividido em parágrafos de livro (obtido: ${paragraphs.length})`);
assert.equal(FALSE_FRIENDS.actually !== undefined, true, 'actually deve estar em FALSE_FRIENDS');
assert.equal(FALSE_FRIENDS.contest !== undefined, true, 'contest deve estar em FALSE_FRIENDS');

console.log('✓ Formatação de livro, tradução no hover e Popup de Vídeos com YouGlish verificados com sucesso!');
