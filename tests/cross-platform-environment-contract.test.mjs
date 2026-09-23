import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// 1. Verificar desacoplamento de ambiente nos arquivos críticos do Dashboard
const filesToCheck = [
  { path: '../dashboard/js/core/tts.js', identifier: 'isExtension' },
  { path: '../dashboard/js/core/ai.js', identifier: 'isExtension' },
  { path: '../dashboard/js/ui/settingsView.js', identifier: 'isExtensionCtx' },
  { path: '../dashboard/js/ui/studyView.js', identifier: 'isExtension' },
  { path: '../dashboard/js/ui/libraryView.js', identifier: 'isExtension' },
  { path: '../dashboard/js/ui/readerView.js', identifier: 'isExtension' },
  { path: '../dashboard/js/ui/storiesView.js', identifier: 'isExtension' },
];

for (const { path, identifier } of filesToCheck) {
  const content = await readFile(new URL(path, import.meta.url), 'utf8');
  assert.ok(
    content.includes("location.protocol === 'chrome-extension:'"),
    `${path} deve restringir ${identifier} checando se location.protocol === 'chrome-extension:'`
  );
  assert.ok(
    !content.includes(`const ${identifier} = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;`),
    `${path} não deve usar a checagem antiga e frágil de ${identifier}`
  );
}

// 2. Verificar o registro de Service Worker do PWA em app.js
const appJs = await readFile(new URL('../dashboard/js/core/app.js', import.meta.url), 'utf8');
assert.ok(
  appJs.includes("location.protocol !== 'chrome-extension:'"),
  'dashboard/js/core/app.js deve registrar o service worker no PWA checando o protocolo e não a presença de chrome.runtime.id'
);

// 3. Verificar StoriesView e medição de nível
const storiesJs = await readFile(new URL('../dashboard/js/ui/storiesView.js', import.meta.url), 'utf8');
assert.ok(
  !storiesJs.includes("const isExt = typeof chrome !== 'undefined' && !!chrome.runtime?.id;"),
  'dashboard/js/ui/storiesView.js não deve re-declarar isExt frágil dentro de measureAndShowLevel'
);

// 4. Verificar Leitor (Reader View): formatação de livro e esteira de tradução
const readerJs = await readFile(new URL('../dashboard/js/ui/readerView.js', import.meta.url), 'utf8');

// Parágrafos de livro
assert.ok(
  readerJs.includes('reader-paragraph'),
  'dashboard/js/ui/readerView.js deve estruturar o texto em parágrafos reader-paragraph'
);
assert.ok(
  readerJs.includes('reader-container'),
  'dashboard/js/ui/readerView.js deve aplicar o container de leitura reader-container'
);
assert.ok(
  readerJs.includes("font-family: 'Newsreader'"),
  'dashboard/js/ui/readerView.js deve utilizar tipografia clássica e confortável de livro'
);

// Tooltip no hover
assert.ok(
  readerJs.includes('rd-word-tooltip'),
  'dashboard/js/ui/readerView.js deve conter o tooltip de preview de tradução no hover'
);
assert.ok(
  readerJs.includes('mouseover'),
  'dashboard/js/ui/readerView.js deve escutar mouseover nas palavras'
);

// Esteira de 4 camadas de tradução
assert.ok(
  readerJs.includes('vaultTranslations.has(cleanLower)'),
  'translateText no Leitor deve checar o cofre local antes da rede'
);
assert.ok(
  readerJs.includes("translator._fetchMyMemory"),
  'translateText no Leitor deve conter fallback para MyMemory'
);
assert.ok(
  readerJs.includes("tokenLemma !== cleanLower"),
  'translateText no Leitor deve conter fallback morfológico por lema'
);

console.log('Contratos de ambiente Web vs Extensão e Leitor validados com sucesso ✅');

const homeJs = await readFile(new URL('../dashboard/js/ui/homeView.js', import.meta.url), 'utf8');
assert.ok(!homeJs.includes('estimateLevelFromHistory'), 'Home não transforma memória em nível CEFR');
