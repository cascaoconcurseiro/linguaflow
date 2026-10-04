import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SubtitleEngine } from '../content/subtitle-engine.js';
import { MaxPlayerUI } from '../content/max-player-ui.js';
import { readEngineSource } from './helpers/engine-source.mjs';

test('Player Controls: MaxPlayerUI inicializa com o estado real do SubtitleEngine (isActivated)', () => {
  const fakeEngineActive = { isActivated: true };
  const uiActive = new MaxPlayerUI(fakeEngineActive);
  assert.equal(uiActive.visible, true, 'MaxPlayerUI deve iniciar visível se engine está ativado');

  const fakeEngineInactive = { isActivated: false };
  const uiInactive = new MaxPlayerUI(fakeEngineInactive);
  assert.equal(uiInactive.visible, false, 'MaxPlayerUI deve iniciar oculto se engine está desativado');
});

test('Player Controls: toggleSubtitles sincroniza tanto YouTube quanto MaxPlayerUI', () => {
  const engine = Object.create(SubtitleEngine.prototype);
  engine.isActivated = false;
  engine.platform = 'max';

  let ytTogglePressed = null;
  let maxTogglePressed = null;
  let maxUiSyncedWith = null;

  const mockHost = { style: {} };
  const mockYtToggle = {
    setAttribute(name, val) { if (name === 'aria-pressed') ytTogglePressed = val; },
    classList: { toggle: () => {} },
    title: '',
  };
  const mockMaxToggle = {
    setAttribute(name, val) { if (name === 'aria-pressed') maxTogglePressed = val; },
    classList: { toggle: () => {} },
    title: '',
  };

  globalThis.document = {
    getElementById(id) {
      if (id === 'linguaflow-subtitle-host') return mockHost;
      if (id === 'lf-yt-toggle-wrapper') return mockYtToggle;
      if (id === 'lf-yt-switch') return { classList: { toggle: () => {} } };
      if (id === 'lf-native-hide') return { disabled: false };
      return null;
    },
    querySelector(sel) {
      if (sel === '#lf-max-controls [data-action="toggle"]' || sel === '#lf-max-controls button[data-action="toggle"]') {
        return mockMaxToggle;
      }
      return null;
    },
    querySelectorAll() { return []; },
  };

  globalThis.window = {
    __lfMaxPlayerUI: {
      syncActiveState(val) {
        maxUiSyncedWith = val;
      },
    },
  };

  // Testa ativação
  engine.toggleSubtitles(true);
  assert.equal(engine.isActivated, true);
  assert.equal(mockHost.style.visibility, 'visible');
  assert.equal(ytTogglePressed, 'true', 'YouTube toggle deve ter aria-pressed=true');
  assert.equal(maxTogglePressed, 'true', 'Max toggle deve ter aria-pressed=true');
  assert.equal(maxUiSyncedWith, true, 'MaxPlayerUI deve ter recebido syncActiveState(true)');

  // Testa desativação
  engine.toggleSubtitles(false);
  assert.equal(engine.isActivated, false);
  assert.equal(mockHost.style.visibility, 'hidden');
  assert.equal(ytTogglePressed, 'false', 'YouTube toggle deve ter aria-pressed=false');
  assert.equal(maxTogglePressed, 'false', 'Max toggle deve ter aria-pressed=false');
  assert.equal(maxUiSyncedWith, false, 'MaxPlayerUI deve ter recebido syncActiveState(false)');
});

test('Player Controls: auto-engatilhamento das legendas nativas ao iniciar reprodução quando isActivated=true', () => {
  const engine = Object.create(SubtitleEngine.prototype);
  engine.isActivated = true;
  engine.platform = 'youtube';

  let ccClicked = false;
  let hboAutoEnableCalled = false;

  const mockYtCcBtn = {
    getAttribute(attr) {
      if (attr === 'aria-pressed') return 'false'; // YouTube iniciou com CC desligado
      return null;
    },
    click() {
      ccClicked = true;
    },
  };

  globalThis.document = {
    querySelector(sel) {
      if (sel === '.ytp-subtitles-button') return mockYtCcBtn;
      return null;
    },
  };

  engine._autoEnableHBOSubtitles = () => {
    hboAutoEnableCalled = true;
  };

  assert.equal(typeof engine._ensureNativeSubtitlesActive, 'function', 'engine deve ter _ensureNativeSubtitlesActive');
  engine._ensureNativeSubtitlesActive();
  assert.equal(ccClicked, true, 'Deve acionar clique no botão CC do YouTube se isActivated=true e CC nativo está desligado');

  // Na plataforma Max
  engine.platform = 'max';
  engine._ensureNativeSubtitlesActive();
  assert.equal(hboAutoEnableCalled, true, 'Deve acionar _autoEnableHBOSubtitles na Max se isActivated=true');
});

test('Player Controls: _onUrlChange preserva isActivated e reseta _hboAutoEnableTried', async () => {
  const code = await readEngineSource();
  assert.doesNotMatch(
    code,
    /this\.toggleSubtitles\(false\);[\s\S]*?\/\/ Inicia sempre DESLIGADO/,
    '_onUrlChange não deve mais forçar desligamento arbitrário com toggleSubtitles(false)',
  );
  assert.match(
    code,
    /_hboAutoEnableTried\s*=\s*false/,
    '_onUrlChange deve resetar _hboAutoEnableTried para que novos episódios auto-ativem legendas',
  );
});

test('Player Controls: velocidade salva é reaplicada quando o YouTube carrega a mídia', () => {
  const previous = { document: globalThis.document, localStorage: globalThis.localStorage, chrome: globalThis.chrome };
  try {
    const listeners = {};
    let adds = 0;
    const video = {
      playbackRate: 1,
      addEventListener(name, fn) { adds++; (listeners[name] ||= []).push(fn); },
    };
    const speedBtn = { textContent: '', title: '', setAttribute() {}, classList: { toggle() {} } };
    globalThis.document = { querySelectorAll: () => [speedBtn] };
    globalThis.localStorage = { getItem: () => '0.75', setItem() {} };
    globalThis.chrome = { storage: { local: { set() {} } } };

    const engine = Object.create(SubtitleEngine.prototype);
    engine.videoElement = video;
    engine._bindVideoPlaybackRate();
    engine._bindVideoPlaybackRate();
    assert.equal(video.playbackRate, 0.75);
    assert.equal(adds, 2, 'ratechange e loadedmetadata registrados uma vez por vídeo');

    // Carregar a mídia redefine playbackRate para o padrão sem disparar ratechange.
    video.playbackRate = 1;
    speedBtn.textContent = '0.75×';
    for (const fn of listeners.loadedmetadata) fn();
    assert.equal(video.playbackRate, 0.75);
    assert.equal(speedBtn.textContent, '0.75×');

    video.playbackRate = 1.5;
    for (const fn of listeners.ratechange) fn();
    assert.equal(speedBtn.textContent, '1.5×');
  } finally {
    Object.assign(globalThis, previous);
  }
});

// #438: com o LinguaFlow desligado o CC nativo do YouTube fica desligado,
// a menos que o próprio usuário o ligue com um clique real nesta página.
function mockYouTubeCc(pressed) {
  const btn = {
    pressed,
    clicks: 0,
    getAttribute(attr) { return attr === 'aria-pressed' ? String(this.pressed) : null; },
    click() { this.clicks++; this.pressed = !this.pressed; },
  };
  globalThis.document = { querySelector: (sel) => (sel === '.ytp-subtitles-button' ? btn : null) };
  return btn;
}

test('#438: desligado, o CC memorizado pelo YouTube é desligado ao carregar/play', () => {
  const engine = Object.create(SubtitleEngine.prototype);
  engine.isActivated = false;
  engine.platform = 'youtube';
  const btn = mockYouTubeCc(true);
  engine._syncNativeCCButton();
  assert.equal(btn.pressed, false, 'CC nativo deve desligar com o LinguaFlow desligado');
  engine._syncNativeCCButton();
  assert.equal(btn.clicks, 1, 'não alterna o CC de novo quando já está desligado');
});

test('#438: clique real do usuário no CC com o LinguaFlow desligado é respeitado', () => {
  const engine = Object.create(SubtitleEngine.prototype);
  engine.isActivated = false;
  engine.platform = 'youtube';
  const btn = mockYouTubeCc(true);
  engine._onNativeCaptionToggle({ active: true, trusted: true });
  engine._syncNativeCCButton();
  assert.equal(btn.pressed, true, 'usuário ligou o CC na mão: não desligar');
  engine._onNativeCaptionToggle({ active: true, trusted: false });
  engine._userWantsNativeCC = false;
  engine._onNativeCaptionToggle({ active: true, trusted: false });
  assert.equal(engine._userWantsNativeCC, false, 'clique feito por código não conta como escolha do usuário');
});

test('#438: ligado, o CC nativo continua sendo ligado', () => {
  const engine = Object.create(SubtitleEngine.prototype);
  engine.isActivated = true;
  engine.platform = 'youtube';
  const btn = mockYouTubeCc(false);
  engine._syncNativeCCButton();
  assert.equal(btn.pressed, true);
});

test('#438: a ponte envia isTrusted do clique no CC e a validação aceita só booleano', async () => {
  const hook = await readFile(new URL('../content/youtube-hook.js', import.meta.url), 'utf8');
  assert.match(hook, /LF_YT_SUB_TOGGLE', active: !isActive, trusted: e\.isTrusted/);
  const bridge = await readFile(new URL('../content/subtitles/bridge-security.js', import.meta.url), 'utf8');
  assert.match(bridge, /data\.trusted === undefined \|\| typeof data\.trusted === 'boolean'/);
});
