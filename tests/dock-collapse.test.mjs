import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  DOCK_COLLAPSED_KEY,
  applyDockCollapsed,
  DOCK_COLLAPSE_BUTTON_HTML,
  dockCollapseCss,
  loadDockCollapsed,
  saveDockCollapsed,
} from '../content/subtitles/dock-collapse.js';
import { subtitleScaleForWidth } from '../content/subtitles/dock-layout.js';
import { readEngineSource } from './helpers/engine-source.mjs';

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
  const [max, manifest] = await Promise.all(
    ['../content/max-player-ui.js', '../manifest.json'].map((f) => readFile(new URL(f, import.meta.url), 'utf8')),
  );
  const engine = await readEngineSource();
  assert.match(max, /DOCK_COLLAPSE_BUTTON_HTML/);
  assert.match(max, /action === 'collapse'/);
  assert.match(engine, /DOCK_COLLAPSE_BUTTON_HTML/);
  assert.match(engine, /action === 'collapse'/);
  assert.match(manifest, /content\/subtitles\/dock-collapse\.js/);
});

test('botão de recolher tem ícone próprio (barra + seta), não o ‹ › da legenda', () => {
  assert.match(DOCK_COLLAPSE_BUTTON_HTML, /<svg[^>]*lf-dock-chevron/);
  assert.doesNotMatch(DOCK_COLLAPSE_BUTTON_HTML, /[‹›⌄]/);
});

test('loop, shadowing e painel ativos ficam amarelos nos dois docks', async () => {
  const [yt, max] = await Promise.all(
    ['../content/subtitles/youtube-dock-styles.js', '../content/max-player-ui.js'].map((f) => readFile(new URL(f, import.meta.url), 'utf8')),
  );
  for (const css of [yt, max]) {
    assert.match(css, /data-action="shadow"\]\[aria-pressed="true"\]/);
    assert.match(css, /data-action="panel"\]\.is-active/);
    assert.match(css, /250,\s*204,\s*21/);
    assert.doesNotMatch(css, /168,\s*85,\s*247/);
  }
});

test('legenda encolhe com o player, sem ampliar nem passar do piso', () => {
  assert.equal(subtitleScaleForWidth(1920), 1);
  assert.equal(subtitleScaleForWidth(900), 1);
  assert.equal(subtitleScaleForWidth(450), 0.55);
  assert.equal(subtitleScaleForWidth(675), 0.75);
  assert.equal(subtitleScaleForWidth(100), 0.55);
  assert.equal(subtitleScaleForWidth(0), 1);
  assert.equal(subtitleScaleForWidth(undefined), 1);
});

test('legenda aplica --lf-sub-scale como multiplicador sem tocar --lf-font-size', async () => {
  const [display, template] = await Promise.all(
    ['../content/subtitles/engine/caption-display.js', '../content/subtitles/subtitle-shadow-template.js'].map((f) => readFile(new URL(f, import.meta.url), 'utf8')),
  );
  assert.match(display, /setProperty\('--lf-sub-scale'/);
  assert.doesNotMatch(display, /setProperty\('--lf-font-size'/);
  assert.match(template, /var\(--lf-font-size, 31px\) \* var\(--lf-sub-scale, 1\)/);
});
