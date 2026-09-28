// Trava contra ReferenceError em produção: toda variável usada no painel e em
// utils precisa estar declarada ou importada (ex.: a Análise de Cursos quebrou
// por "delta is not defined"). "chrome"/"browser" são globais da extensão.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

test('painel e utils não usam variáveis não declaradas', () => {
  const result = spawnSync(process.execPath, [
    'node_modules/@biomejs/biome/bin/biome', 'lint',
    '--config-path=config/biome-undeclared', '--max-diagnostics=50',
    'dashboard/js', 'utils',
  ], { cwd: root, encoding: 'utf8' });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0, output);
});
