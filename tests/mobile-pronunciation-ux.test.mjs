import assert from 'node:assert/strict';
import fs from 'node:fs';

const study = fs.readFileSync(new URL('../dashboard/js/ui/studyView.js', import.meta.url), 'utf8');

assert.match(study, /function finishEchoRecording\(/, 'finalização manual deve ser separada do descarte');
assert.match(study, /recorder\.requestData\(\)/, 'mobile deve solicitar o último chunk antes de parar');
assert.match(study, /Finalizando gravação/, 'botão deve responder imediatamente ao toque');
assert.match(study, /dataset\.echo === '1'\) \{ finishEchoRecording/, 'toque em parar deve finalizar, não descartar');
assert.match(study, /youglishLoadTimer/, 'widget precisa de watchdog quando o iframe não responde');
assert.match(study, /isMobileVoiceDevice\(\).*fallback\.classList\.remove\('hidden'\)/s, 'mobile sempre deve ter saída funcional para o YouGlish');
assert.match(study, /Abrir no YouGlish/, 'fallback precisa explicar que abre a experiência oficial');

console.log('UX móvel de voz e YouGlish: 7 contratos passaram ✅');
