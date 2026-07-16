import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync(new URL('../dashboard/js/ui/homeView.js', import.meta.url), 'utf8');

assert.match(home, /estimativa inicial/);
assert.match(home, /Prefiro estimar com um teste curto/);
assert.match(home, /Com que carga você quer começar/);
assert.match(home, /GOAL_TO_NEW_PER_DAY = \{ 10: 5, 20: 10, 40: 20 \}/);
assert.match(home, /Leve[\s\S]*Regular[\s\S]*Intensa/);
assert.match(home, /revisões\/dia · até/);
assert.match(home, /const confirmed = await Promise\.all\(writes\)/);
assert.match(home, /confirmed\.some\(saved => !saved\)/);
assert.ok(home.indexOf('await Promise.all(writes)') < home.indexOf("setSetting(ONBOARDING_KEY, record)"), 'preferências são confirmadas antes de concluir onboarding');
assert.doesNotMatch(home, /setSetting\('new_per_day'[^\n]+\.catch\(\(\) => \{\}\)/);

console.log('✓ P1-C: onboarding honesto e persistência confirmada');
