import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { MAP_FILE, buildInventory, describeFile, renderMap, sizeClass } from '../scripts/generate-project-map.mjs';

test('descrição vem do comentário de cabeçalho, sem repetir o caminho do arquivo', () => {
  assert.equal(describeFile('utils/a.js', '// utils/a.js — Faz a coisa A\nexport {}'), 'Faz a coisa A');
  assert.equal(describeFile('utils/a.js', '// Só a descrição\nexport {}'), 'Só a descrição');
  assert.equal(describeFile('utils/a.js', '/**\n * LinguaFlow - Motor de A\n */\nexport {}'), 'LinguaFlow - Motor de A');
  assert.equal(describeFile('x/b.css', '/* Estilos de B */\n:root{}'), 'Estilos de B');
  assert.equal(describeFile('x/c.sql', '-- Cria a tabela C\ncreate table c();'), 'Cria a tabela C');
  assert.equal(describeFile('x/d.html', '<!doctype html>\n<!-- Página D -->\n<html></html>'), 'Página D');
  assert.equal(describeFile('scripts/e.mjs', '#!/usr/bin/env node\n// Script E\n'), 'Script E');
  assert.equal(describeFile('.github/workflows/f.yml', 'name: Fluxo F\non: push\n'), 'Fluxo F');
});

test('arquivo sem propósito explícito é sinalizado, em vez de aceito em silêncio', () => {
  assert.match(describeFile('utils/g.js', "import x from './x.js';\n"), /sem descrição/);
  assert.match(describeFile('utils/h.js', '// utils/h.js\nexport {}'), /sem descrição/, 'só o caminho não explica nada');
  assert.match(describeFile('utils/i.js', ''), /sem descrição/);
});

test('formatos sem comentário usam a descrição fixa; barras verticais são escapadas', () => {
  assert.match(describeFile('manifest.json', '{}'), /Manifest MV3/);
  assert.equal(describeFile('utils/j.js', '// a | b\n'), 'a \\| b');
});

test('classes de porte', () => {
  assert.equal(sizeClass(10), 'P');
  assert.equal(sizeClass(150), 'P');
  assert.equal(sizeClass(151), 'M');
  assert.equal(sizeClass(500), 'M');
  assert.equal(sizeClass(1000), 'G');
  assert.equal(sizeClass(1001), 'GG ⚠');
});

test('o mapa do projeto está atualizado e todo arquivo de código tem descrição', () => {
  const { markdown, missing, unclassified } = buildInventory();
  assert.deepEqual(missing, [], `arquivos sem descrição de propósito: ${missing.join(', ')}`);
  assert.deepEqual(unclassified, [], `arquivos que nenhuma seção do mapa cobre: ${unclassified.join(', ')}`);
  const current = readFileSync(MAP_FILE, 'utf8');
  assert.equal(renderMap(current, markdown), current, 'docs/MAPA_DO_PROJETO.md está desatualizado. Rode: npm run map');
});

test('o mapa aponta para a documentação e a documentação aponta para o mapa', () => {
  for (const doc of ['docs/INDICE.md', 'docs/README.md', 'docs/COMECE_AQUI.md']) {
    assert.match(readFileSync(doc, 'utf8'), /MAPA_DO_PROJETO\.md/, `${doc} deve linkar o mapa`);
  }
  const map = readFileSync(MAP_FILE, 'utf8');
  for (const link of ['ARQUITETURA.md', 'INDICE.md', '../AGENTS.md', '../SECURITY.md']) {
    assert.ok(map.includes(link), `o mapa deve linkar ${link}`);
  }
});
