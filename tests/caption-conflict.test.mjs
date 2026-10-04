import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hasLanguageReactor, CAPTION_CONFLICT_NOTICE } from '../content/subtitles/caption-conflict.js';
import { readEngineSourceSync } from './helpers/engine-source.mjs';

const docWith = (match) => ({ querySelector: (sel) => (match && sel.includes('lln-') ? {} : null) });

test('detecta Language Reactor pelos nós lln-*', () => {
  assert.equal(hasLanguageReactor(docWith(true)), true);
  assert.equal(hasLanguageReactor(docWith(false)), false);
  assert.equal(hasLanguageReactor(null), false);
  assert.equal(hasLanguageReactor({ querySelector() { throw new Error('x'); } }), false);
});

test('aviso nomeia a outra extensão e é em português', () => {
  assert.match(CAPTION_CONFLICT_NOTICE, /Language Reactor/);
});

test('motor avisa uma única vez e só com a legenda ativa', () => {
  const engine = readEngineSourceSync();
  const manifest = readFileSync(new URL('../manifest.json', import.meta.url), 'utf8');
  assert.match(engine, /from '(?:\.\/subtitles|\.\.)\/caption-conflict\.js'/);
  assert.match(engine, /_captionConflictNoticed/);
  assert.match(manifest, /content\/subtitles\/caption-conflict\.js/);
});
