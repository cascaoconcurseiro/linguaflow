import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  DOCK_COLLAPSED_KEY,
  applyDockCollapsed,
  dockCollapseCss,
  loadDockCollapsed,
  saveDockCollapsed,
} from '../content/subtitles/dock-collapse.js';

function fakeDock() {
  const classes = new Set();
  const attrs = {};
  const button = { title: '', setAttribute: (k, v) => { attrs[k] = v; } };
  return {
    attrs,
    button,
    classes,
    classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) },
    querySelector: (sel) => (sel === 'button[data-action="collapse"]' ? button : null),
  };
}

test('recolher marca a classe e anuncia o estado no botão', () => {
  const dock = fakeDock();
  applyDockCollapsed(dock, true);
  assert.ok(dock.classes.has('lf-collapsed'));
  assert.equal(dock.attrs['aria-expanded'], 'false');
  assert.equal(dock.attrs['aria-label'], 'Expandir controles');
  applyDockCollapsed(dock, false);
  assert.ok(!dock.classes.has('lf-collapsed'));
  assert.equal(dock.attrs['aria-expanded'], 'true');
  assert.equal(dock.button.title, 'Recolher controles');
});

test('CSS recolhido deixa só LF + botão de expandir e respeita reduced-motion', () => {
  for (const orientation of ['vertical', 'horizontal']) {
    const css = dockCollapseCss('#dock', orientation);
    assert.match(css, /#dock\.lf-collapsed>:not\(\.lf-dock-toggle\):not\(\.lf-dock-collapse\)\{display:none/);
    assert.match(css, /prefers-reduced-motion:reduce/);
    assert.match(css, /transform:rotate/);
  }
});

test('persistência: salva, lê e nunca quebra sem storage', async () => {
  const previous = globalThis.chrome;
  try {
    globalThis.chrome = undefined;
    assert.equal(await loadDockCollapsed(), false);
    await saveDockCollapsed(true); // não lança

    const store = {};
    globalThis.chrome = {
      storage: { local: { get: async (k) => ({ [k]: store[k] }), set: async (o) => Object.assign(store, o) } },
    };
    assert.equal(await loadDockCollapsed(), false);
    await saveDockCollapsed(true);
    assert.equal(store[DOCK_COLLAPSED_KEY], true);
    assert.equal(await loadDockCollapsed(), true);

    globalThis.chrome = { storage: { local: { get: async () => { throw new Error('x'); }, set: async () => { throw new Error('x'); } } } };
    assert.equal(await loadDockCollapsed(), false);
    await saveDockCollapsed(true);
  } finally {
    globalThis.chrome = previous;
  }
});

test('contrato: os dois docks usam o botão e o manifest expõe o módulo', async () => {
  const [max, engine, manifest] = await Promise.all(
    ['../content/max-player-ui.js', '../content/subtitle-engine.js', '../manifest.json'].map((f) =>
      readFile(new URL(f, import.meta.url), 'utf8'),
    ),
  );
  assert.match(max, /DOCK_COLLAPSE_BUTTON_HTML/);
  assert.match(max, /action === 'collapse'/);
  assert.match(engine, /DOCK_COLLAPSE_BUTTON_HTML/);
  assert.match(engine, /action === 'collapse'/);
  assert.match(manifest, /content\/subtitles\/dock-collapse\.js/);
});
