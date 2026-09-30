import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../content/word-popup.js', import.meta.url), 'utf8');

assert.match(source, /setAttribute\('role', 'dialog'\)/, 'popup deve expor semantica de dialogo');
assert.match(source, /setAttribute\('aria-labelledby', 'fw'\)/, 'dialogo deve ter nome pela palavra');
assert.match(source, /this\._previousFocus = document\.activeElement/, 'abertura deve guardar o foco anterior');
assert.match(source, /this\._previousFocus\?\.isConnected[\s\S]*?\.focus\(\{ preventScroll: true \}\)/, 'fechamento deve devolver o foco');
assert.match(source, /event\.key === 'Escape'[\s\S]*?this\.hide\(true\)/, 'Escape deve fechar o popup');
assert.match(source, /event\.key !== 'Tab'[\s\S]*?focusable/, 'dialogo deve conter a navegacao por Tab');

// #383: sem abas (modelo antigo na tag popup-card-v1). Seções nomeadas e
// ações agrupadas substituem o tablist.
assert.match(source, /id="factions" role="group" aria-label="Ações da palavra"/, 'ações devem formar grupo nomeado');
assert.match(source, /<section id="fmore" aria-labelledby="fmore-title">|<section id="fmore" aria-labelledby="fmore-title" /, 'mais fontes deve ser seção nomeada');
assert.match(source, /id="frevbtn" type="button" class="lfp-chip" aria-label="Carregar exemplos reais do Reverso Context"/, 'links de fontes precisam de nome acessível');
assert.match(source, /this\.popup\.focus\(\{ preventScroll: true \}\)/, 'abertura deve levar o foco ao diálogo');

assert.match(source, /<button type="button" class="lfp-chip"[^>]*aria-label="Consultar sinônimo/, 'sinonimos devem ser botoes nomeados');
assert.match(source, /<button type="button" class="lfp-chip red"[^>]*aria-label="Consultar antônimo/, 'antonimos devem ser botoes nomeados');
assert.doesNotMatch(source, /<span class="lfp-chip" data-word=/, 'chips clicaveis nao devem usar span');

assert.match(source, /@media \(prefers-reduced-motion:reduce\)/, 'popup deve respeitar movimento reduzido');
assert.match(source, /#lfp :focus-visible\{outline:3px solid #7dd3fc/, 'controles devem ter foco visivel');
assert.doesNotMatch(source, /#475569|#64748b/, 'texto secundario nao deve usar tons abaixo de AA no fundo do popup');

assert.match(source, /overlay\.setAttribute\('role', 'dialog'\)/, 'recall deve expor dialogo');
assert.match(source, /overlay\.setAttribute\('aria-labelledby', 'lfp-recall-title'\)/, 'recall deve ter nome acessivel');
assert.match(source, /overlay\.querySelector\('\[data-opt\]'\)\?\.focus/, 'recall deve receber foco ao abrir');

console.log('word-popup-accessibility: ok');
