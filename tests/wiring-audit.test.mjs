import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixture = mkdtempSync(path.join(tmpdir(), 'lf-wiring-555-'));
try {
  mkdirSync(path.join(fixture, '.claude/worktrees/other/dashboard'), { recursive: true });
  writeFileSync(path.join(fixture, '.claude/worktrees/other/dashboard/foreign.js'), 'export const foreignCheckoutSentinel = 1;');
  writeFileSync(path.join(fixture, 'product.js'), 'export const productOrphanSentinel = 1;');
  const result = execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/wiring-audit.js', import.meta.url))], { cwd: fixture, encoding: 'utf8' });
  assert.ok(!result.includes('foreign.js'), 'checkout de outra sessão não é código deste produto');
  assert.ok(result.includes('product.js'), 'a exclusão não oculta módulos órfãos do produto');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

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
  'dashboard/js/core/fluencyTaskCatalog.js',
]) {
  assert.ok(!output.includes(falsePositive), `auditoria não deve reportar falso positivo: ${falsePositive}`);
}

assert.ok(
  !output.includes('utils/schema.js'),
  'auditoria não deve tratar utilitário usado por testes como módulo órfão',
);

console.log('Auditoria de fiação distingue integrações dinâmicas e DOM externo.');
