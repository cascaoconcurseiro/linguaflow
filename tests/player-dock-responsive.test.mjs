import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  computeDockResponsiveClass,
  applyDockResponsiveClass,
} from '../content/subtitle-engine.js';

// 1. Testes de cálculo de classe responsiva por largura
assert.equal(computeDockResponsiveClass(1920), 'lf-size-normal', '1920px deve ser normal');
assert.equal(computeDockResponsiveClass(1280), 'lf-size-normal', '1280px deve ser normal');
assert.equal(computeDockResponsiveClass(854), 'lf-size-normal', '854px deve ser normal');
assert.equal(computeDockResponsiveClass(820), 'lf-size-normal', '820px deve ser o limiar normal');

assert.equal(computeDockResponsiveClass(819), 'lf-size-compact', '819px deve ser compacto');
assert.equal(computeDockResponsiveClass(720), 'lf-size-compact', '720px deve ser compacto');
assert.equal(computeDockResponsiveClass(620), 'lf-size-compact', '620px deve ser o limiar compacto');

assert.equal(computeDockResponsiveClass(619), 'lf-size-mini', '619px deve ser mini');
assert.equal(computeDockResponsiveClass(520), 'lf-size-mini', '520px deve ser mini');
assert.equal(computeDockResponsiveClass(480), 'lf-size-mini', '480px deve ser o limiar mini');

assert.equal(computeDockResponsiveClass(479), 'lf-size-tiny', '479px deve ser tiny');
assert.equal(computeDockResponsiveClass(360), 'lf-size-tiny', '360px deve ser tiny');
assert.equal(computeDockResponsiveClass(280), 'lf-size-tiny', '280px deve ser tiny');

// Edge cases
assert.equal(computeDockResponsiveClass(Number.NaN), 'lf-size-normal', 'NaN retorna normal');
assert.equal(computeDockResponsiveClass(null), 'lf-size-normal', 'null retorna normal');
assert.equal(computeDockResponsiveClass(undefined), 'lf-size-normal', 'undefined retorna normal');

// 2. Testes de aplicação de classes no elemento DOM simulado
class MockClassList {
  constructor() {
    this._classes = new Set();
  }
  toggle(cls, force) {
    if (force) this._classes.add(cls);
    else this._classes.delete(cls);
    return this._classes.has(cls);
  }
  contains(cls) {
    return this._classes.has(cls);
  }
}

const mockDock = { classList: new MockClassList() };

applyDockResponsiveClass(mockDock, 1000);
assert.equal(mockDock.classList.contains('lf-size-compact'), false);
assert.equal(mockDock.classList.contains('lf-size-mini'), false);
assert.equal(mockDock.classList.contains('lf-size-tiny'), false);

applyDockResponsiveClass(mockDock, 700);
assert.equal(mockDock.classList.contains('lf-size-compact'), true);
assert.equal(mockDock.classList.contains('lf-size-mini'), false);
assert.equal(mockDock.classList.contains('lf-size-tiny'), false);

applyDockResponsiveClass(mockDock, 550);
assert.equal(mockDock.classList.contains('lf-size-compact'), false);
assert.equal(mockDock.classList.contains('lf-size-mini'), true);
assert.equal(mockDock.classList.contains('lf-size-tiny'), false);

applyDockResponsiveClass(mockDock, 400);
assert.equal(mockDock.classList.contains('lf-size-compact'), false);
assert.equal(mockDock.classList.contains('lf-size-mini'), false);
assert.equal(mockDock.classList.contains('lf-size-tiny'), true);

// 3. Validação do código fonte e regras CSS em subtitle-engine.js
const subEngineSource = await readFile(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8');

assert.match(subEngineSource, /#lf-yt-horizontal-dock\.lf-size-compact/);
assert.match(subEngineSource, /#lf-yt-horizontal-dock\.lf-size-mini/);
assert.match(subEngineSource, /#lf-yt-horizontal-dock\.lf-size-tiny/);
assert.match(subEngineSource, /\.ytp-small-mode #lf-yt-horizontal-dock/);
assert.match(subEngineSource, /@media \(max-width:\s*820px\)/);
assert.match(subEngineSource, /@media \(max-width:\s*620px\)/);
assert.match(subEngineSource, /@media \(max-width:\s*480px\)/);
assert.match(subEngineSource, /ResizeObserver/);
assert.match(subEngineSource, /_dockResizeObserver/);

// 4. Validação das regras responsivas em max-player-ui.js
const maxUiSource = await readFile(new URL('../content/max-player-ui.js', import.meta.url), 'utf8');
assert.match(maxUiSource, /@media \(max-width:640px\),\(max-height:540px\)/);
assert.match(maxUiSource, /#lf-max-controls button\[data-action="toggle"\]/);

console.log('Todos os testes de responsividade do player e dock passaram com sucesso!');
