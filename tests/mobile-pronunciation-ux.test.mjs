import assert from 'node:assert/strict';
import { readStudySourceSync } from './helpers/study-source.mjs';

const study = readStudySourceSync();

assert.doesNotMatch(study, /MediaRecorder|getUserMedia|finishEchoRecording|shadowing-mic/, 'mobile não captura áudio do aluno');
assert.match(study, /youglishLoadTimer/, 'widget precisa de watchdog quando o iframe não responde');
assert.match(study, /isMobileVoiceDevice\(\).*fallback\.classList\.remove\('hidden'\)/s, 'mobile sempre deve ter saída funcional para o YouGlish');
assert.match(study, /Abrir no YouGlish/, 'fallback precisa explicar que abre a experiência oficial');

console.log('UX móvel sem gravação e com YouGlish: 4 contratos passaram ✅');
