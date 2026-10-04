// Trava contra ReferenceError em produção: toda variável usada no painel, na extensão e em
// utils precisa estar declarada ou importada (ex.: a Análise de Cursos quebrou
// por "delta is not defined"). "chrome"/"browser" são globais da extensão.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const biomeBin = 'node_modules/@biomejs/biome/bin/biome';

// O Biome precisa realmente executar. Em alguns ambientes o binário nativo falha em silêncio
// (sem saída e com status 0): sem esta checagem o teste ficava verde sem verificar nada.
function biomeAvailable() {
  const probe = spawnSync(process.execPath, [biomeBin, '--version'], { cwd: root, encoding: 'utf8' });
  return /\d+\.\d+\.\d+/.test(`${probe.stdout}${probe.stderr}`);
}

test('painel e utils não usam variáveis não declaradas', (t) => {
  if (!biomeAvailable()) {
    t.skip('Biome indisponível neste ambiente; esta verificação roda no CI');
    return;
  }
  const result = spawnSync(process.execPath, [
    biomeBin, 'lint',
    '--config-path=config/biome-undeclared', '--max-diagnostics=50',
    'dashboard/js', 'utils', 'content', 'background', 'popup',
  ], { cwd: root, encoding: 'utf8' });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 0, output);
  assert.ok(output.trim().length > 0, 'o Biome não imprimiu nada: ele não executou de verdade e nada foi verificado');
});
