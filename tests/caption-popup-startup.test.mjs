import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { SubtitleEngine } from '../content/subtitle-engine.js';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url)));
const popup = readFileSync(new URL('../content/word-popup.js', import.meta.url), 'utf8');

test('every static popup dependency is exposed on the same video sites as the popup', () => {
  const popupAccess = manifest.web_accessible_resources.find(({ resources }) => resources.includes('content/word-popup.js'));
  assert.ok(popupAccess);
  for (const [, relative] of popup.matchAll(/\bimport\s+(?:[^'";]+\s+from\s+)?['"](\.\.[^'"]+|\.[^'"]+)['"]/g)) {
    const path = new URL(relative, 'file:///content/word-popup.js').pathname.slice(1);
    assert.ok(manifest.web_accessible_resources.some(({ resources, matches }) =>
      resources.includes(path) && popupAccess.matches.every(match => matches.includes(match))),
    `Popup dependency not available on video sites: ${path}`);
  }
});

test('concurrent first subtitle and video mounts share one shadow root', async () => {
  const previousDocument = globalThis.document;
  let host = null;
  globalThis.document = { getElementById: () => host };
  const instance = Object.create(SubtitleEngine.prototype);
  let mounts = 0;
  instance._createSubtitleUI = async () => {
    mounts++;
    await new Promise(resolve => setTimeout(resolve, 0));
    host = {};
    instance.shadowContainer = { host };
  };
  try {
    await Promise.all([instance._injectSubtitleUI(), instance._injectSubtitleUI(), instance._injectSubtitleUI()]);
    assert.equal(mounts, 1);
    await instance._injectSubtitleUI(true);
    assert.equal(mounts, 2, 'navigation requests a fresh mount');
  } finally {
    globalThis.document = previousDocument;
  }
});

test('release ZIP includes private service worker imports without exposing them to video pages', () => {
  const root = new URL('../', import.meta.url);
  execFileSync(process.execPath, [new URL('../scripts/package-extension.mjs', import.meta.url).pathname], { cwd: root });
  const files = execFileSync('unzip', ['-Z1', `dist/linguaflow-extension-v${manifest.version}.zip`], { cwd: root, encoding: 'utf8' });
  assert.match(files, /^utils\/story-variety\.js$/m);
  assert.match(files, /^utils\/context-chunks\.js$/m);
  assert.ok(!manifest.web_accessible_resources.some(({ resources }) => resources.includes('utils/story-variety.js')));
});
