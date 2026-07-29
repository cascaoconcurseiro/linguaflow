import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  chooseTodayAction,
  loadFluencyHomeState,
} from '../dashboard/js/ui/homeView.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const view = read('dashboard/js/ui/fluencyCheckView.js');
const css = read('dashboard/css/globals.css');

assert.equal(
  chooseTodayAction({ totalWords: 0, fluencyDue: true }).route,
  'learn',
  'primeiro contexto vem antes do check',
);
assert.equal(
  chooseTodayAction({ totalWords: 5, dueCards: 2, fluencyDue: true }).route,
  'study',
  'memória vencida vem antes do check',
);
assert.equal(
  chooseTodayAction({ totalWords: 5, fluencyResumeAvailable: true }).kind,
  'fluency-resume',
);
assert.equal(
  chooseTodayAction({ totalWords: 5, fluencyDue: true }).kind,
  'fluency-check',
);

const injectedStatus = await loadFluencyHomeState({
  getFluencyCheckStatus: async () => ({ fluencyDue: false, fluencyResumeAvailable: true }),
});
assert.deepEqual(injectedStatus, { fluencyDue: false, fluencyResumeAvailable: true });

const fallbackStatus = await loadFluencyHomeState({
  getLatestLearningTaskAttempt: async () => ({ occurred_at: '2026-07-01T10:00:00Z' }),
});
assert.equal(fallbackStatus.fluencyDue, true);
assert.equal(fallbackStatus.fluencyResumeAvailable, false);

assert.match(view, /const FLUENCY_STEPS = Object\.freeze\(\[/);
for (const skill of ['listening', 'speaking_spontaneous', 'writing', 'interaction']) {
  assert.match(view, new RegExp(`skill: '${skill}'`));
}
assert.match(view, /data-fluency-screen="introduction"/);
assert.match(view, /data-fluency-screen="task"/);
assert.match(view, /data-fluency-screen="review"/);
assert.match(view, /data-fluency-screen="result"/);
assert.match(view, /<fieldset/);
assert.match(view, /<legend/);
assert.match(view, /<label for="fluency-writing"/);
assert.match(view, /<label for="fluency-interaction-/);
assert.match(view, /role="progressbar"/);
assert.match(view, /aria-current="step"/);
assert.match(view, /tabindex="-1"/);
assert.match(view, /class="fluency-validation" role="alert" tabindex="-1"/);
assert.match(view, /\.focus\(\)/);
assert.match(view, /navigator\.mediaDevices\.getUserMedia/);
assert.match(view, /stream\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
assert.match(view, /app\.onLeaveView/);
assert.match(view, /if \(submitting\) return/);
assert.match(view, /if \(recordingRequestPending\) return/);
assert.match(view, /function normalizeAnswers\(/);
assert.match(view, /recordLearningTaskAttempt/);
assert.match(view, /evaluation_authority:\s*'client'/);
assert.match(view, /authoritative:\s*false/);
assert.doesNotMatch(view, /autoplay/i);
assert.doesNotMatch(view, /Você é [AB][12]/i);
assert.match(view, /Fala espontânea: ainda sem evidência/);

assert.match(css, /\.fluency-check-page/);
assert.match(css, /\.fluency-task-actions/);
assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.fluency-task-actions/);

console.log('Jornada UX do Check de Fluência passou.');
