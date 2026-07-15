import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  computeMaxOverlayLayout,
  computeMaxPopupLayout,
  isMaxHost,
} from '../content/max-player-ui.js';

assert.equal(isMaxHost('play.max.com'), true);
assert.equal(isMaxHost('www.hbomax.com'), true);
assert.equal(isMaxHost('example.com'), false);

const desktop = computeMaxOverlayLayout({
  viewportHeight: 720,
  controlsRect: { top: 620, width: 1280, height: 100 },
  progressRect: { top: 608, width: 1100, height: 8 },
  videoRect: { bottom: 720 },
});
assert.ok(desktop.dockBottom > 100, 'dock fica acima da timeline');
assert.ok(desktop.subtitleBottom >= desktop.dockBottom + 54, 'legenda fica acima do dock');

const hiddenControls = computeMaxOverlayLayout({
  viewportHeight: 720,
  controlsRect: { top: 0, width: 0, height: 0 },
  videoRect: { bottom: 720 },
});
assert.ok(hiddenControls.dockBottom >= 64, 'fallback mantém dock fora da borda inferior');
assert.ok(hiddenControls.subtitleBottom > hiddenControls.dockBottom);

const compact = computeMaxOverlayLayout({
  viewportHeight: 480,
  controlsRect: { top: 410, width: 854, height: 70 },
  progressRect: { top: 402, width: 760, height: 6 },
  videoRect: { bottom: 480 },
});
assert.ok(compact.subtitleBottom < 480 * 0.5, 'safe-area não ocupa metade da tela compacta');

const popup = computeMaxPopupLayout({
  viewportWidth: 1280,
  subtitleTop: 510,
  popupWidth: 340,
  popupHeight: 360,
  anchorRect: { left: 900, width: 80 },
});
assert.ok(popup.left > 640, 'popup acompanha a palavra clicada');
assert.ok(popup.top + Math.min(360, popup.maxHeight) <= 510 - 16, 'popup não invade a legenda');

const tallPopup = computeMaxPopupLayout({
  viewportWidth: 390,
  subtitleTop: 280,
  popupWidth: 340,
  popupHeight: 700,
  anchorRect: { left: 350, width: 30 },
});
assert.equal(tallPopup.left, 40, 'popup é limitado à viewport móvel');
assert.equal(tallPopup.maxHeight, 252, 'popup alto usa scroll no espaço acima da legenda');
assert.ok(tallPopup.top + tallPopup.maxHeight <= 264);

const uiSource = await readFile(new URL('../content/max-player-ui.js', import.meta.url), 'utf8');
for (const action of ['toggle', 'previous', 'repeat', 'next', 'panel', 'settings']) {
  assert.match(uiSource, new RegExp(`data-action=["']${action}["']`));
}
assert.match(uiSource, /MutationObserver/);
assert.match(uiSource, /fullscreenchange/);
assert.match(uiSource, /toggleSubtitles\(this\.visible\)/);
assert.match(uiSource, /toggleSubtitlePanel\(\)/);

const popupSource = await readFile(new URL('../content/word-popup.js', import.meta.url), 'utf8');
assert.match(popupSource, /this\._anchorRect = rect \|\| null/);
assert.match(popupSource, /document\.fullscreenElement \|\| document\.body/);
assert.match(popupSource, /computeMaxPopupLayout/);
assert.match(popupSource, /ResizeObserver/);

console.log('Max/HBO player UI contracts passed.');
