import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SubtitleEngine } from '../content/subtitle-engine.js';
import { MaxPlayerUI } from '../content/max-player-ui.js';

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
  const code = await readFile(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8');
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

process.exit(0);
