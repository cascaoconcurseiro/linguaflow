import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8');
const renderStart = source.indexOf('  renderDual(orig, trans) {');
const renderEnd = source.indexOf('\n  _makeClickable(', renderStart);

assert.ok(renderStart >= 0 && renderEnd > renderStart, 'renderDual deve existir');

const renderDual = source.slice(renderStart, renderEnd);
const nativeStart = renderDual.indexOf("// mode === 'native'");
const nativeEnd = renderDual.indexOf('\n    this._lastOrig = orig;', nativeStart);

assert.ok(nativeStart >= 0 && nativeEnd > nativeStart, 'ramo do modo nativo deve existir');

const nativeBranch = renderDual.slice(nativeStart, nativeEnd);

assert.match(
  renderDual,
  /const mode = this\.displayMode \|\| 'native';/,
  'o fallback de exibição deve respeitar o padrão Apenas Original',
);
assert.doesNotMatch(
  nativeBranch,
  /if \(orig !== this\._lastOrig && transDiv\)/,
  'o modo nativo não pode condicionar a ocultação da tradução à mudança do texto',
);
assert.match(
  nativeBranch,
  /transDiv\.style\.display = hasActiveFlash && hasTrans \? 'block' : 'none';/,
  'o modo nativo deve ocultar a tradução em toda renderização normal',
);

const settingsSource = await readFile(
  new URL('../content/settings-panel.js', import.meta.url),
  'utf8',
);

assert.match(
  settingsSource,
  /if \(displayModeChanged && this\.engine\._lastOrig\) \{\s*this\.engine\.renderDual\(this\.engine\._lastOrig, this\.engine\._lastTrans \|\| ''\);/,
  'alterar o modo no painel deve atualizar imediatamente a legenda visível',
);

assert.doesNotMatch(
  source,
  /id="lf-show-translation"[^>]*this\.displayMode === 'bilingual'/,
  'o checkbox do painel lateral não deve herdar o modo da legenda sobre o vídeo',
);
assert.match(
  source,
  /id="lf-show-translation" checked/,
  'a tradução do painel lateral deve começar marcada',
);

console.log('subtitle-display-mode.test.mjs: OK');
