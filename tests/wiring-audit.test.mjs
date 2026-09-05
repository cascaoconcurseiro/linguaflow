import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const output = execFileSync(process.execPath, ['scripts/wiring-audit.js'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
});

for (const falsePositive of [
  'utils/phrasal-verbs.js',
  '#movie_player',
  '#btn-fluency-retry',
  '#btn-clear-library-filters',
  '#study-styles',
  '#x ',
  'LF_HBO_SUB',
  'LF_SUBTITLE_HOOK',
  'LF_PLAYER_STATE',
  'LF_YT_SUB_TOGGLE',
  '#lf-btn-loop',
  '#lf-btn-panel',
  '#lf-save-btn',
  '#lf-hbo-switch',
]) {
  assert.ok(!output.includes(falsePositive), `auditoria não deve reportar falso positivo: ${falsePositive}`);
}

console.log('Auditoria de fiação distingue integrações dinâmicas e DOM externo.');
