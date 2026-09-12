import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

test('Auditoria Fix #1: classifyWordStatic e refineSavedWord no service-worker.js', () => {
  const swCode = readFileSync(path.join(root, 'background/service-worker.js'), 'utf-8');
  assert.match(swCode, /import\s*{\s*slangsDB\s*}\s*from\s*'\.\.\/utils\/slangs-db\.js'/);
  assert.match(swCode, /import\s*{\s*phrasalVerbsDB\s*}\s*from\s*'\.\.\/utils\/phrasal-verbs\.js'/);
  assert.match(swCode, /slangsDB\.has\(w\)/);
  assert.match(swCode, /const\s+isSpecialized\s*=\s*\['slang',\s*'phrasal',\s*'idiom'\]\.includes\(currentCategory\)/);
  assert.match(swCode, /if\s*\(isSpecialized\s*&&\s*category\s*===\s*'word'\)\s*return;/);
});

test('Auditoria Fix #2: _onUrlChange chama _stopLoop e remove duplicidade de _videoWaitInterval', () => {
  const seCode = readFileSync(path.join(root, 'content/subtitle-engine.js'), 'utf-8');
  const onUrlChangeMatch = seCode.match(/async\s+_onUrlChange\([^{]*\{([\s\S]*?)(?=\n\s*async|\n\s*renderDual|\n\s*toggleSubtitles)/);
  assert.ok(onUrlChangeMatch, '_onUrlChange deve existir no subtitle-engine');
  const onUrlChangeBody = onUrlChangeMatch[1];
  assert.match(onUrlChangeBody, /this\._stopLoop\(\);/, '_onUrlChange deve invocar _stopLoop() para limpar RVFC, RAF e timeupdate');
  const waitIntervalMatches = onUrlChangeBody.match(/if\s*\(this\._videoWaitInterval\)/g) || [];
  assert.equal(waitIntervalMatches.length, 1, '_videoWaitInterval deve ser verificado e limpo apenas uma vez');
});

test('Auditoria Fix #3: _build em word-popup.js limpa _keydownHandler anterior', () => {
  const wpCode = readFileSync(path.join(root, 'content/word-popup.js'), 'utf-8');
  assert.match(wpCode, /if\s*\(this\._keydownHandler\)\s*\{\s*document\.removeEventListener\('keydown',\s*this\._keydownHandler,\s*true\);/);
});

test('Auditoria Fix #4: Painel de legendas usa AbortController nos listeners de window', () => {
  const seCode = readFileSync(path.join(root, 'content/subtitle-engine.js'), 'utf-8');
  assert.match(seCode, /panelAbort\.abort\(\)/, 'closePanel deve abortar os ouvintes de window');
  assert.match(seCode, /window\.addEventListener\('pointerup'[\s\S]*?signal:\s*panelAbort\.signal/, 'pointerup deve receber o signal do panelAbort');
  assert.match(seCode, /window\.addEventListener\('pointermove'[\s\S]*?signal:\s*panelAbort\.signal/, 'pointermove deve receber o signal do panelAbort');
});

test('Auditoria Fix #5: currentSourceLang declarada no topo de youtube-hook.js', () => {
  const yhCode = readFileSync(path.join(root, 'content/youtube-hook.js'), 'utf-8');
  const preloadIdx = yhCode.indexOf('const preloadFullSubtitleTrack');
  const declIdx = yhCode.indexOf("let currentSourceLang = 'en';");
  assert.ok(declIdx >= 0, 'currentSourceLang deve estar declarada');
  assert.ok(declIdx < preloadIdx, 'currentSourceLang deve ser declarada ANTES de preloadFullSubtitleTrack');
});
