// tests/ignored-words.test.mjs — Issue #368: "Ignorar" no card da palavra.
// Tabela própria (não conta como conhecida), RLS e menor privilégio, acesso
// pelo db, exclusão da aba Palavras e cor neutra na legenda.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20260929231638_ignored_words.sql');
const dbSource = read('utils/db.js');
const sw = read('background/service-worker.js');

test('migration: tabela própria, RLS por usuário e sem UPDATE', () => {
  assert.match(migration, /create table if not exists public\.ignored_words/);
  assert.match(migration, /unique \(user_id, word, lang\)/);
  assert.match(migration, /references auth\.users\(id\) on delete cascade/);
  assert.match(migration, /alter table public\.ignored_words enable row level security/);
  assert.match(migration, /revoke all on table public\.ignored_words from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, delete on table public\.ignored_words to authenticated/);
  assert.doesNotMatch(migration, /grant[^;]*update[^;]*ignored_words[^;]*authenticated/i);
  assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id\)\s*with check \(\(select auth\.uid\(\)\) = user_id\)/);
  const sql = migration.replace(/--.*$/gm, '');
  assert.doesNotMatch(sql, /known_words/, 'não altera a tabela de conhecidas');
});

test('db: ignorar sem UPDATE (ignore-duplicates), desfazer e listar; proxy liberado', () => {
  assert.match(dbSource, /async ignoreWord\(word, lang\)[\s\S]*?ignored_words\?on_conflict=user_id,word,lang[\s\S]*?resolution=ignore-duplicates/);
  assert.match(dbSource, /async unignoreWord\(word, lang\)[\s\S]*?method: 'DELETE'/);
  assert.match(dbSource, /async getAllIgnoredWords\(\)[\s\S]*?ignored_words\?select=word,lang/);
  for (const method of ['ignoreWord', 'unignoreWord', 'getAllIgnoredWords']) {
    assert.match(sw, new RegExp(`'${method}'`), `${method} precisa passar pelo proxy do service worker`);
  }
});

test('aba Palavras: ignoradas saem do vocabulário (forma ou lema)', async () => {
  const { extractVideoVocabulary } = await import('../content/subtitles/video-vocabulary.js');
  const cues = [{ text: 'Yeah the camera is filming. Yeah, Sebastian films a lot.' }];
  const vocab = extractVideoVocabulary(cues, { ignored: new Set(['yeah', 'film']) });
  assert.equal(vocab.has('yeah'), false);
  assert.equal(vocab.has('film'), false, 'ignorar a base some com filming/films');
  assert.equal(vocab.has('camera'), true);
});

test('legenda: palavra ignorada fica sem cor de status', async () => {
  globalThis.chrome ??= { runtime: { getURL: (p) => p, sendMessage() {}, onMessage: { addListener() {} } }, storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener() {}, removeListener() {} } } };
  const { SubtitleEngine } = await import('../content/subtitle-engine.js');
  const engine = Object.create(SubtitleEngine.prototype);
  Object.assign(engine, { knownWords: new Set(), savedWords: new Map([['yeah', 'learning']]), ignoredWords: new Set(['yeah']) });
  assert.equal(engine._wordClass('Yeah'), '');
  engine.ignoredWords = new Set();
  assert.equal(engine._wordClass('Yeah'), 'lf-learning');
});

test('card: Ignorar grava, avisa a legenda e vira "Deixar de ignorar"; falha é recuperável', async () => {
  const { db } = await import('../utils/db.js');
  const { WordPopup } = await import('../content/word-popup.js');
  const btn = { disabled: false, textContent: '', attrs: { 'aria-pressed': 'false' }, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; } };
  const popup = Object.create(WordPopup.prototype);
  Object.assign(popup, { word: 'Yeah', engine: { sourceLang: 'en' }, _q: () => btn });
  const events = [];
  globalThis.window = { dispatchEvent: (e) => events.push(e) };
  globalThis.CustomEvent ??= class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  const calls = [];
  const saved = { ignoreWord: db.ignoreWord, unignoreWord: db.unignoreWord };
  db.ignoreWord = async (...a) => { calls.push(['ignore', ...a]); };
  db.unignoreWord = async (...a) => { calls.push(['unignore', ...a]); };
  try {
    await popup._toggleIgnored();
    assert.deepEqual(calls[0], ['ignore', 'yeah', 'en']);
    assert.equal(events[0].type, 'LF_WORD_IGNORED');
    assert.deepEqual(events[0].detail, { word: 'yeah', ignored: true });
    assert.equal(btn.attrs['aria-pressed'], 'true');
    assert.equal(btn.textContent, '↺ Deixar de ignorar');
    await popup._toggleIgnored();
    assert.deepEqual(calls[1], ['unignore', 'yeah', 'en']);
    assert.equal(btn.attrs['aria-pressed'], 'false');
    db.ignoreWord = async () => { throw new Error('offline'); };
    await popup._toggleIgnored();
    assert.equal(btn.disabled, false, 'botão volta a ser clicável');
    assert.match(btn.textContent, /tentar de novo/);
    assert.equal(btn.attrs['aria-pressed'], 'false');
  } finally {
    Object.assign(db, saved);
  }
});
