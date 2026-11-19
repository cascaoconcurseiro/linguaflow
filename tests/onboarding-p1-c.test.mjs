// P1-C (revisado na auditoria #559): o Início entra direto, sem onboarding em etapas.
// O fluxo de 3 passos ficou inalcançável depois da #498 (o nível é escolhido em
// Configurações; ver tests/e2e/settings-level.spec.mjs) e foi removido. A entrada
// direta com qualquer registro salvo é exercitada em tests/home-direct-entry.test.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync(new URL('../dashboard/js/ui/homeView.js', import.meta.url), 'utf8');

assert.doesNotMatch(home, /function renderOnboarding/, 'o Início não mantém um onboarding inalcançável');
assert.doesNotMatch(home, /Prefiro estimar com um teste curto|btn-onboarding-placement|runPlacementTest/, 'o Início não oferece teste de nível (#498)');
assert.match(home, /ONBOARDING_KEY/, 'o registro antigo de onboarding continua lido para preservar a meta diária de quem já o concluiu');

console.log('✓ P1-C: Início com entrada direta, sem onboarding inalcançável');
