// tests/word-popup-layout.test.mjs — Issues #381 e #383: layout do card da
// palavra. Modelo anterior na tag git popup-card-v1.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const src = readFileSync(new URL('../content/word-popup.js', import.meta.url), 'utf8');
const html = src.slice(src.indexOf('this.popup.innerHTML = `'), src.indexOf('document.body.appendChild(this.popup);'));
const at = (id) => html.indexOf(`id="${id}"`);

test('definição em inglês não aparece no card', () => {
  assert.doesNotMatch(src, /id="fd"/);
  assert.doesNotMatch(src, /q\('#fd'\)/);
});

test('#383 sem abas: uma coluna só', () => {
  assert.doesNotMatch(html, /role="tablist"|role="tab"|role="tabpanel"|class="ftab"/);
  assert.doesNotMatch(src, /querySelectorAll\('\.ftab'\)/);
});

test('#383 ordem: tradução, contexto, frase, outras traduções, neste vídeo, mais fontes', () => {
  const order = ['ft', 'fctx', 'fc', 'fsenses', 'fvid', 'fmore'].map(at);
  assert.ok(order.every((i) => i > 0), `todos os blocos existem: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test('#383 rodapé fixo com as três ações, fora da área que rola', () => {
  const scrollEnd = html.indexOf('id="fbody"');
  const footer = html.indexOf('id="factions"');
  assert.ok(scrollEnd > 0 && footer > scrollEnd, 'rodapé vem depois do corpo rolável');
  assert.match(html, /id="factions" role="group" aria-label="Ações da palavra"/);
  for (const id of ['fsave', 'fknown', 'fignore']) assert.ok(at(id) > footer, `${id} fica no rodapé`);
});

test('#383 cabeçalho compacto: IPA junto da palavra, sem título nem progresso', () => {
  assert.doesNotMatch(html, />Pronúncia \(IPA\)</, 'sem título visível; fica só como dica (title)');
  assert.doesNotMatch(src, /fcefr-prog|aprendidas`/);
  assert.ok(at('fipa-wrap') > at('fw') && at('fipa-wrap') < at('fcefr'), 'IPA na linha da palavra');
  assert.match(src, /exprInfo\.cls === 'lfp-type-word' \? 'none' : 'inline-block'/, '"📖 Palavra" só some quando é palavra comum');
});

test('#383 mais fontes: Reverso inline, Linguee, Google e YouGlish com sotaques', () => {
  for (const id of ['frevbtn', 'frev', 'fl1', 'fl3', 'fy1', 'fy2', 'fy3', 'fy4']) assert.ok(at(id) > at('fmore'), id);
  assert.match(html, /id="fy2"[^>]*aria-label="YouGlish com sotaque americano"/);
});

test('#383 outras traduções não repetem a tradução principal', async () => {
  globalThis.chrome ??= { runtime: { getURL: (p) => p, sendMessage() {}, onMessage: { addListener() {} } }, storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener() {}, removeListener() {} } } };
  const { WordPopup } = await import('../content/word-popup.js');
  const els = {};
  const el = (id) => (els[id] ??= { innerHTML: '', textContent: '', style: { display: 'none' } });
  const popup = Object.create(WordPopup.prototype);
  Object.assign(popup, { word: 'too', _q: (s) => el(s.replace('#', '')) });
  el('ft').textContent = 'também';
  popup._renderSenses([{ label: 'advérbio', terms: ['também', 'demasiado', 'muito'] }]);
  assert.doesNotMatch(el('fsenses-list').innerHTML, /também/);
  assert.match(el('fsenses-list').innerHTML, /demasiado, muito/);
  popup._renderSenses([{ label: 'advérbio', terms: ['também'] }]);
  assert.equal(el('fsenses').style.display, 'none', 'classe sem nada além da principal some');
});
