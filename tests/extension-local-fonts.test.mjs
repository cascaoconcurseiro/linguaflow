import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { SettingsPanel } from '../content/settings-panel.js';
import { subtitleShadowHtml } from '../content/subtitles/subtitle-shadow-template.js';

test('settings and accessible captions use packaged fonts without remote stylesheets', () => {
  const panel = Object.create(SettingsPanel.prototype);
  panel.cfg = {};
  const settings = panel._html();
  const captions = subtitleShadowHtml({ shadowCss: '', expressionCss: '' });
  assert.doesNotMatch(settings, /@import\s+url\(['"]?https?:/);
  for (const name of ['DM Sans', 'Libre Caslon Text', 'OpenDyslexic']) {
    assert.ok(settings.includes(`font-family: '${name}'`));
  }
  assert.match(captions, /@font-face\s*\{\s*font-family: 'OpenDyslexic'/);
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url)));
  const resources = manifest.web_accessible_resources.find(({ resources }) => resources.includes('content/settings-panel/markup.js'));
  for (const file of ['DMSans.ttf', 'LibreCaslonText.ttf', 'OpenDyslexic-Regular.woff2', 'OpenDyslexic-Bold.woff2']) {
    assert.ok(resources.resources.includes(`assets/fonts/${file}`));
    assert.ok(readFileSync(new URL(`../assets/fonts/${file}`, import.meta.url)).length > 1000);
  }
});
