import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

let releasePermission;
let recognitionStarts = 0;
let stoppedTracks = 0;

globalThis.localStorage = { getItem: () => 'en-US' };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
  mediaDevices: {
    getUserMedia: () => new Promise((resolve) => { releasePermission = resolve; }),
  },
} });
globalThis.window = {
  SpeechRecognition: class {
    start() {
      recognitionStarts += 1;
      this.onerror?.({ error: 'test-complete' });
    }
    stop() {}
    abort() {}
  },
};

const { pronunciationLab } = await import(`../utils/pronunciation.js?lifecycle=${Date.now()}`);
const lateAssessment = pronunciationLab.assess('hello', () => {});
pronunciationLab.stop();
releasePermission({
  getTracks: () => [{ stop: () => { stoppedTracks += 1; } }],
});
await lateAssessment;

assert.equal(stoppedTracks, 1, 'stream tardio ainda deve ser encerrado');
assert.equal(recognitionStarts, 0, 'stop durante a permissão deve impedir início tardio do reconhecimento');

const recognitionInstances = [];
const staleFeedback = [];
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
  mediaDevices: {
    getUserMedia: async () => ({
      getTracks: () => [{ stop() {} }],
    }),
  },
} });
globalThis.window.SpeechRecognition = class {
  constructor() {
    recognitionInstances.push(this);
  }
  start() {
    this.onstart?.();
  }
  stop() {}
  abort() {}
};

const { pronunciationLab: callbackSafeLab } = await import(`../utils/pronunciation.js?callbacks=${Date.now()}`);
const firstAssessment = callbackSafeLab.assess('hello', (feedback) => staleFeedback.push(feedback));
await new Promise((resolve) => setTimeout(resolve, 0));
const staleOnError = recognitionInstances[0]?.onerror;
callbackSafeLab.stop();
staleOnError?.({ error: 'aborted' });
await firstAssessment;

assert.deepEqual(
  staleFeedback,
  [{ status: 'recording' }],
  'eventos enfileirados de uma tentativa cancelada não podem emitir feedback obsoleto',
);

const study = read('dashboard/js/ui/studyView.js');
const settings = read('dashboard/js/ui/settingsView.js');

assert.match(
  study,
  /async function startEchoMode[\s\S]{0,500}await navigator\.mediaDevices\.getUserMedia[\s\S]{0,500}requestGeneration !== voiceRequestGeneration[\s\S]{0,180}stream\.getTracks\(\)\.forEach/,
  'MediaRecorder tardio deve descartar o stream quando a tela ou o card mudaram',
);
const echoModeSource = study.slice(
  study.indexOf('async function startEchoMode'),
  study.indexOf('let shadowingPinned'),
);
const recorderConstructor = echoModeSource.indexOf('new MediaRecorder(stream)');
const recorderStart = echoModeSource.indexOf('echoRec.start()', recorderConstructor);
const recorderFailureCatch = echoModeSource.indexOf('} catch {', recorderStart);
assert.ok(
  recorderConstructor >= 0 && recorderStart > recorderConstructor && recorderFailureCatch > recorderStart,
  'construtor e start do MediaRecorder devem compartilhar um bloco protegido',
);
const recorderFailureCleanup = echoModeSource.slice(recorderFailureCatch, recorderFailureCatch + 1_100);
assert.match(
  recorderFailureCleanup,
  /stream\.getTracks\(\)\.forEach/,
  'falha no construtor ou start do MediaRecorder deve sempre encerrar o stream',
);
assert.match(
  recorderFailureCleanup,
  /shadowingBusy\s*=\s*false[\s\S]{0,500}micBtn\.disabled\s*=\s*false/,
  'falha ao iniciar MediaRecorder deve liberar o estado e o botão',
);
assert.match(
  study,
  /adaptiveProfiles\s*=\s*await lfDb\.getAdaptiveProfiles[\s\S]{0,220}if \(!studyViewActive \|\| viewGeneration !== studyViewGeneration\) return;/,
  'render antigo deve parar imediatamente depois de getAdaptiveProfiles',
);
assert.match(
  study,
  /document\.addEventListener\('click',[\s\S]{0,220}signal:\s*app\.renderSignal/,
  'listener global de clique da sessão deve morrer com a renderização',
);
assert.match(
  study,
  /document\.addEventListener\('keydown',[\s\S]{0,180}signal:\s*app\.renderSignal/,
  'listener global de teclado da sessão deve morrer com a renderização',
);
assert.match(
  settings,
  /window\.addEventListener\('lf_kokoro_progress',\s*onKokoroProgress,\s*\{\s*signal:\s*app\.renderSignal\s*\}\)/,
  'progresso do Kokoro não deve acumular listeners entre entradas',
);

console.log('✓ ciclo de vida: permissão tardia, render obsoleto e listeners globais protegidos');
