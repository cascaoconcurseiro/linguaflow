import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const study = read('dashboard/js/ui/studyView.js');
const settings = read('dashboard/js/ui/settingsView.js');

assert.doesNotMatch(study, /MediaRecorder|getUserMedia|SpeechRecognition|pronunciationLab/,
  'Estudo não mantém recursos de captura de áudio');
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

console.log('✓ ciclo de vida: captura removida, render obsoleto e listeners globais protegidos');
