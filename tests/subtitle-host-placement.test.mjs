import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SubtitleEngine } from '../content/subtitle-engine.js';
import { readEngineSource } from './helpers/engine-source.mjs';

function fakeHost(parent) {
  const style = {};
  return {
    parentElement: parent,
    style: {
      visibility: 'hidden',
      opacity: '0',
      setProperty: (name, value, priority) => { style[name] = { value, priority }; },
    },
    applied: style,
  };
}

function engineWith({ platform, player, bottom = 100, horizontal = 50 }) {
  const engine = Object.create(SubtitleEngine.prototype);
  engine.platform = platform;
  engine._currentBottom = bottom;
  engine._currentHorizontal = horizontal;
  engine._findPlayerContainer = () => player;
  return engine;
}

test('YouTube: legenda criada no body entra no player quando ele aparece', () => {
  const previous = globalThis.document;
  const body = {};
  globalThis.document = { body, getElementById: () => null };
  try {
    const moved = [];
    const player = { appendChild: (el) => { moved.push(el); el.parentElement = player; } };
    const host = fakeHost(body);
    const engine = engineWith({ platform: 'youtube', player });

    assert.equal(engine._moveHostIntoPlayer(host), true);
    assert.deepEqual(moved, [host]);
    assert.equal(host.applied.position.value, 'absolute', 'relativo ao player, não à janela');
    assert.equal(host.applied.bottom.value, '100px');
    assert.equal(host.applied.left.value, '50%');
    assert.equal(host.applied.transform.value, 'translateX(-50%)');
    assert.equal(host.style.visibility, 'hidden', 'não reativa a legenda se o LF estava desligado');
    assert.equal(host.style.opacity, '0');

    assert.equal(engine._moveHostIntoPlayer(host), false, 'já está no player: não mexe de novo');
  } finally {
    globalThis.document = previous;
  }
});

test('usa a posição salva pelo usuário', () => {
  const previous = globalThis.document;
  const body = {};
  globalThis.document = { body };
  try {
    const player = { appendChild() {} };
    const host = fakeHost(body);
    engineWith({ platform: 'youtube', player, bottom: 180, horizontal: 30 })._moveHostIntoPlayer(host);
    assert.equal(host.applied.bottom.value, '180px');
    assert.equal(host.applied.left.value, '30%');
    assert.equal(host.applied.transform.value, 'translateX(-30%)');
  } finally {
    globalThis.document = previous;
  }
});

test('sem player ainda, ou na Max, a legenda continua no body', () => {
  const previous = globalThis.document;
  const body = {};
  globalThis.document = { body };
  try {
    const host = fakeHost(body);
    assert.equal(engineWith({ platform: 'youtube', player: null })._moveHostIntoPlayer(host), false);
    assert.equal(engineWith({ platform: 'max', player: { appendChild() { throw new Error('não deve mover'); } } })._moveHostIntoPlayer(host), false);
    assert.equal(host.parentElement, body);
  } finally {
    globalThis.document = previous;
  }
});

test('contrato: reposicionamento e espera do vídeo tentam mover a legenda também no YouTube', async () => {
  const code = await readEngineSource();
  assert.match(code, /async _repositionSubtitle\(\) \{[\s\S]*?this\._moveHostIntoPlayer\(host\)/);
  assert.match(code, /this\.platform !== 'max'\) \{\s*setTimeout\(\(\) => \{\s*if \(!this\._disposed\) this\._moveHostIntoPlayer\(\);\s*\}, 1500\)/);
  assert.doesNotMatch(code, /if \(this\.platform !== 'youtube'\) \{\s*const host = document\.getElementById\('linguaflow-subtitle-host'\);/, 'o reposicionamento não pode excluir o YouTube');
});
