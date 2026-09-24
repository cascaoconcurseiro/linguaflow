import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SubtitleEngine } from '../content/subtitle-engine.js';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url)));
const popup = readFileSync(new URL('../content/word-popup.js', import.meta.url), 'utf8');

function listFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = prefix ? path.join(prefix, entry.name) : entry.name;
    return entry.isDirectory()
      ? listFiles(path.join(directory, entry.name), relative)
      : [relative.replace(/\\/g, '/')];
  });
}

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
  const root = fileURLToPath(new URL('../', import.meta.url));
  const packageScript = fileURLToPath(new URL('../scripts/package-extension.mjs', import.meta.url));
  execFileSync(process.execPath, [packageScript], { cwd: root });
  const archive = path.join(root, 'dist', `linguaflow-extension-v${manifest.version}.zip`);
  let files;
  if (process.platform === 'win32') {
    const extractionDir = mkdtempSync(path.join(os.tmpdir(), 'linguaflow-extension-'));
    try {
      execFileSync('powershell.exe', [
        '-NoProfile',
        '-Command',
        'Expand-Archive -LiteralPath $env:LINGUAFLOW_ARCHIVE -DestinationPath $env:LINGUAFLOW_EXTRACTION -Force',
      ], {
        cwd: root,
        env: {
          ...process.env,
          LINGUAFLOW_ARCHIVE: archive,
          LINGUAFLOW_EXTRACTION: extractionDir,
        },
      });
      files = listFiles(extractionDir).join('\n');
    } finally {
      rmSync(extractionDir, { recursive: true, force: true });
    }
  } else {
    files = execFileSync('unzip', ['-Z1', archive], { cwd: root, encoding: 'utf8' });
  }
  assert.match(files, /^utils\/story-variety\.js$/m);
  assert.match(files, /^utils\/context-chunks\.js$/m);
  assert.ok(!manifest.web_accessible_resources.some(({ resources }) => resources.includes('utils/story-variety.js')));
});
