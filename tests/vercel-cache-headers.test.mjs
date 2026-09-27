// Módulos ES do site são importados sem versão na URL (../../../utils/db.js).
// Cache "immutable" neles prende usuários em código antigo após cada deploy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
const rules = config.headers.map((h) => ({
  source: h.source,
  cache: h.headers.find((x) => x.key === 'Cache-Control')?.value || null,
}));

test('código (js, css, utils) revalida a cada deploy; só ícones são imutáveis', () => {
  for (const { source, cache } of rules) {
    if (!cache || !cache.includes('immutable')) continue;
    assert.doesNotMatch(source, /utils|js|css/, `regra imutável cobre código: ${source}`);
  }
  const code = rules.find((r) => /utils/.test(r.source) && r.cache);
  assert.equal(code.cache, 'public, max-age=0, must-revalidate');
  assert.match(code.source, /js/);
  assert.match(code.source, /css/);
});
