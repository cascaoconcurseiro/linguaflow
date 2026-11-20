// stripHtmlTags: texto de fora (Wikcionário, Reverso) vira texto puro sem deixar tags para trás.
// O regex simples /<[^>]+>/g deixa `<script` quando a entrada vem aninhada (CodeQL js/incomplete-multi-character-sanitization).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripHtmlTags } from '../utils/html.js';

test('remove tags comuns e mantém o texto', () => {
  assert.equal(stripHtmlTags('a <b>bold</b> <i>word</i>'), 'a bold word');
  assert.equal(stripHtmlTags('<span class="x">hello</span>'), 'hello');
  assert.equal(stripHtmlTags('<!-- c -->ok'), 'ok');
});

test('entrada aninhada não deixa uma tag ativa para trás', () => {
  for (const evil of ['<<b>script>alert(1)</b>', '<scr<b>ipt>alert(1)', '<<<b>b>script>x', '<img src=x onerror=alert(1)//']) {
    const out = stripHtmlTags(evil);
    assert.doesNotMatch(out, /<\s*\/?\s*[a-zA-Z!?]/, `sobrou início de tag em: ${JSON.stringify(out)} (de ${JSON.stringify(evil)})`);
  }
});

test('texto comum com sinais de menor/maior é preservado', () => {
  assert.equal(stripHtmlTags('3 < 5 and 7 > 2'), '3 < 5 and 7 > 2');
  assert.equal(stripHtmlTags('I <3 you'), 'I <3 you');
});

test('entradas vazias ou não-texto não quebram', () => {
  assert.equal(stripHtmlTags(undefined), '');
  assert.equal(stripHtmlTags(null), '');
  assert.equal(stripHtmlTags(42), '42');
});

test('os pontos do service worker que limpam texto de fora usam o ajudante', async () => {
  const { readFileSync } = await import('node:fs');
  const dict = readFileSync(new URL('../background/dictionary.js', import.meta.url), 'utf8');
  const sw = readFileSync(new URL('../background/service-worker.js', import.meta.url), 'utf8');
  assert.match(dict, /stripHtmlTags\(rawDef\)/);
  assert.doesNotMatch(dict, /replace\(\/<\[\^>\]\+>\/g/, 'o dicionário não usa mais o regex frágil');
  assert.match(sw, /stripHtmlTags\(item\.s_text\)/);
  assert.match(sw, /stripHtmlTags\(item\.t_text\)/);
  assert.doesNotMatch(sw, /replace\(\/<\[\^>\]\+>\/g/, 'o service worker não usa mais o regex frágil');
});
