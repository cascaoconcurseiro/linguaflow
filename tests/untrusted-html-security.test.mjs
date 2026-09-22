import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [study, db, vercel, library, stories, wordPopup, youtubeHook, settingsPanel, pwaWorker, subtitleEngine] = await Promise.all([
  readFile(new URL('../dashboard/js/ui/studyView.js', import.meta.url), 'utf8'),
  readFile(new URL('../utils/db.js', import.meta.url), 'utf8'),
  readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/libraryView.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/storiesView.js', import.meta.url), 'utf8'),
  readFile(new URL('../content/word-popup.js', import.meta.url), 'utf8'),
  readFile(new URL('../content/youtube-hook.js', import.meta.url), 'utf8'),
  readFile(new URL('../content/settings-panel.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/sw.js', import.meta.url), 'utf8'),
  readFile(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8'),
]);

assert.match(study, /function renderHighlightedText\(/,
  'Estudo deve centralizar destaque de texto não confiável com escape');
assert.doesNotMatch(study, /<div style="font-size:26px;">\$\{context\}<\/div>/,
  'context_sentence não pode entrar cru em innerHTML');
assert.doesNotMatch(study, /liveBubble\.innerHTML\s*=\s*full/,
  'stream da IA não pode ser tratado como HTML confiável');
assert.doesNotMatch(study, /div\.innerHTML\s*=\s*htmlOrText/,
  'bolha da IA deve renderizar texto, não HTML arbitrário');
assert.match(library, /<strong>\$\{escapeHtml\(w\.word\)\}<\/strong>/,
  'backfill do Cofre deve escapar a palavra persistida');
assert.match(library, /Editar: \$\{escapeHtml\(w\.word\)\}/,
  'editor do Cofre deve escapar a palavra persistida');
assert.match(library, /value="\$\{escapeHtml\(w\.translation \|\| ''\)\}"/,
  'editor do Cofre deve escapar tradução em atributo');
assert.match(library, />\$\{escapeHtml\(w\.context_sentence \|\| ''\)\}<\/textarea>/,
  'editor do Cofre deve escapar frase dentro do textarea');
assert.match(stories, /found\.map\(w => `<strong>\$\{escapeHTML\(w\)\}<\/strong>`\)/,
  'reencontro em histórias deve escapar termos persistidos');
const saveSentence = db.slice(db.indexOf('async saveSentence(data)'), db.indexOf('async getAllSentences()'));
assert.match(saveSentence, /const payload = \{/,
  'saveSentence deve construir um payload conhecido');
assert.doesNotMatch(saveSentence, /body:\s*data/,
  'saveSentence não pode encaminhar propriedades arbitrárias ao PostgREST');

const config = JSON.parse(vercel);
const headers = config.headers?.flatMap(entry => entry.headers || []) || [];
const csp = headers.find(header => header.key.toLowerCase() === 'content-security-policy');
assert.ok(csp, 'PWA deve enviar Content-Security-Policy como defesa adicional');
const scriptPolicy = csp.value.match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1] || '';
assert.doesNotMatch(scriptPolicy, /'unsafe-inline'/,
  'CSP não deve liberar handlers ou scripts inline');
for (const requiredOrigin of ['https://cdn.jsdelivr.net', 'https://youglish.com']) {
  assert.match(scriptPolicy, new RegExp(requiredOrigin.replaceAll('.', '\\.')),
    `CSP deve preservar o recurso externo usado em produção: ${requiredOrigin}`);
}

assert.match(wordPopup, /const err = this\._escapeAttr\(response\?\.error/,
  'popup deve escapar mensagem de erro da IA antes de injetar no DOM');
assert.match(wordPopup, /const eng = this\._escapeAttr\(c\.eng\)/,
  'chunks gerados ou salvos devem escapar inglês antes do innerHTML');
assert.match(wordPopup, /const pt = this\._escapeAttr\(c\.pt\)/,
  'chunks gerados ou salvos devem escapar tradução antes do innerHTML');
assert.match(wordPopup, /const phon = this\._escapeAttr\(c\.phon\)/,
  'chunks gerados ou salvos devem escapar fonética antes do innerHTML');
assert.match(wordPopup, /let formatted = this\._escapeAttr\(text\)/,
  '_formatAI deve sanitizar o texto antes de converter markdown em HTML');
assert.match(wordPopup, /const safeWord = this\._escapeAttr\(r\.word\)/,
  'decomposição de frase deve escapar termos antes de injetar no DOM');
assert.match(wordPopup, /const safeSentenceTranslation = this\._escapeAttr\(/,
  'tradução externa da frase deve ser escapada antes do innerHTML');
assert.doesNotMatch(wordPopup, /\$\{sentenceTranslation \|\| 'tradução indisponível'\}/,
  'tradução externa da frase não pode entrar crua no innerHTML');
assert.match(wordPopup, /const safeGeneratedSentence = this\._escapeAttr\(response\.sentence\)/,
  'frase gerada pela IA deve ser escapada antes do innerHTML');
assert.match(wordPopup, /const safeGeneratedTranslation = this\._escapeAttr\(response\.translation \|\| ''\)/,
  'tradução gerada pela IA deve ser escapada antes do innerHTML');
assert.doesNotMatch(wordPopup, /"\$\{response\.sentence\}"/,
  'frase gerada pela IA não pode entrar crua no innerHTML');

assert.match(pwaWorker, /function safeNotificationTarget\(rawTarget, origin\)/,
  'service worker deve centralizar a validação do destino de push');
assert.match(pwaWorker, /new URL\(rawTarget \|\| target, origin\)/,
  'clique de push deve normalizar o destino contra a origem da PWA');
assert.match(pwaWorker, /requestedTarget\.origin === origin/,
  'clique de push deve aceitar somente destinos do mesmo origin');
assert.match(pwaWorker, /let target = '\/study'/,
  'clique de push deve usar /study como fallback seguro');
assert.doesNotMatch(pwaWorker, /const target = event\.notification\.data\?\.url/,
  'clique de push não pode navegar diretamente para URL fornecida no payload');

const safeTargetSource = pwaWorker.match(
  /function safeNotificationTarget\(rawTarget, origin\) \{[\s\S]*?\n\}/,
)?.[0];
assert.ok(safeTargetSource, 'helper de destino seguro deve ser testável');
const safeNotificationTarget = Function(
  `"use strict"; ${safeTargetSource}; return safeNotificationTarget;`,
)();
const productionOrigin = 'https://linguaflow-web-tau.vercel.app';
assert.equal(safeNotificationTarget('/study?from=push#card', productionOrigin), '/study?from=push#card');
assert.equal(
  safeNotificationTarget(`${productionOrigin}/home?from=push`, productionOrigin),
  '/home?from=push',
);
for (const unsafeTarget of [
  'https://evil.example/phishing',
  '//evil.example/phishing',
  'javascript:alert(1)',
  'data:text/html,phishing',
  'http://[invalid',
]) {
  assert.equal(
    safeNotificationTarget(unsafeTarget, productionOrigin),
    '/study',
    `destino externo ou inválido deve cair no fallback: ${unsafeTarget}`,
  );
}

assert.match(youtubeHook, /if \(e\.origin !== window\.location\.origin \|\| e\.source !== window\) return;/,
  'hook do YouTube deve validar origem e janela no listener de mensagens');

assert.match(settingsPanel, /role="dialog" aria-modal="true"/,
  'painel de configuracoes deve expor semantica de dialogo');
assert.match(settingsPanel, /aria-label="Fechar painel de configurações"/,
  'botao de fechar configuracoes deve ter nome acessivel');
assert.match(settingsPanel, /if \(this\.isOpen && e\.key === 'Escape'\)/,
  'painel de configuracoes deve fechar com Escape');
assert.match(settingsPanel, /this\.isOpen && e\.key === 'Tab'/,
  'painel de configuracoes deve conter Tab e Shift+Tab no dialogo');
assert.match(subtitleEngine, /cue\.translatedText \? escapeHTML\(cue\.translatedText\)/,
  'tradução do painel lateral deve ser escapada antes de entrar no HTML');
assert.match(subtitleEngine, /const safeVideoTitle = escapeHTML\(videoTitle\)/,
  'exportação PDF deve escapar o título do vídeo');
assert.match(subtitleEngine, /const orig = escapeHTML\(c\.text \|\| ''\)\.replace\(\/\\n\/g, '<br>'\)/,
  'exportações HTML devem escapar a legenda antes de criar quebras de linha');
assert.match(subtitleEngine, /\^\[=\+\\-@\]/,
  'CSV deve neutralizar fórmulas iniciadas por caracteres ativos');
assert.match(subtitleEngine, /_translateAllSidebarCues\(cues\)/,
  'painel lateral deve antecipar a tradução da lista completa');
assert.match(subtitleEngine, /translator\.translateBatch/,
  'antecipação deve usar uma fila de tradução com concorrência limitada');

console.log('Conteúdo persistido e respostas da IA permanecem texto não executável.');
