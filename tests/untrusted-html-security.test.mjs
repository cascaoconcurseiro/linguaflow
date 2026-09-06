import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [study, game, db, vercel, library, stories] = await Promise.all([
  readFile(new URL('../dashboard/js/ui/studyView.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/gameView.js', import.meta.url), 'utf8'),
  readFile(new URL('../utils/db.js', import.meta.url), 'utf8'),
  readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/libraryView.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard/js/ui/storiesView.js', import.meta.url), 'utf8'),
]);

assert.match(study, /function renderHighlightedText\(/,
  'Estudo deve centralizar destaque de texto não confiável com escape');
assert.doesNotMatch(study, /<div style="font-size:26px;">\$\{context\}<\/div>/,
  'context_sentence não pode entrar cru em innerHTML');
assert.doesNotMatch(study, /liveBubble\.innerHTML\s*=\s*full/,
  'stream da IA não pode ser tratado como HTML confiável');
assert.doesNotMatch(study, /div\.innerHTML\s*=\s*htmlOrText/,
  'bolha da IA deve renderizar texto, não HTML arbitrário');
assert.doesNotMatch(game, /\$\{a\.t\}<\/button>/,
  'tokens persistidos do jogo não podem entrar crus em innerHTML');
assert.match(library, /<strong>\$\{escapeHtml\(w\.word\)\}<\/strong>/,
  'backfill do Cofre deve escapar a palavra persistida');
assert.match(library, /✏️ \$\{escapeHtml\(w\.word\)\}/,
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

console.log('Conteúdo persistido e respostas da IA permanecem texto não executável.');
