// tests/word-popup-layout.test.mjs — Issue #381: card sem definição em
// inglês e abas nomeadas pelo conteúdo (não por um site).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const src = readFileSync(new URL('../content/word-popup.js', import.meta.url), 'utf8');

test('definição em inglês não aparece no card', () => {
  assert.doesNotMatch(src, /id="fd"/);
  assert.doesNotMatch(src, /q\('#fd'\)/);
});

test('abas: Tradução, Dicionários (Reverso/Linguee/Google) e Pronúncia (YouGlish)', () => {
  assert.match(src, /\['Tradução', 'Dicionários', 'Pronúncia'\]\.map/);
});
