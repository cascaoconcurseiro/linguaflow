import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildLevelNote, resolveStoryLevel, storyLengthSpec } from '../utils/story-variety.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [study, editorial, home, stories, ai, worker, db, migration] = await Promise.all([
  read('dashboard/js/ui/studyView.js'),
  read('dashboard/css/editorial.css'),
  read('dashboard/js/ui/homeView.js'),
  read('dashboard/js/ui/storiesView.js'),
  read('dashboard/js/core/ai.js'),
  read('background/service-worker.js'),
  read('utils/db.js'),
  read('supabase/migrations/20260923175407_story_generation_contract.sql'),
]);

assert.match(editorial, /--study-grading-dock-height/,
  'a altura real da barra de avaliação reserva espaço no conteúdo');
assert.match(study, /ResizeObserver/,
  'a barra de avaliação é medida em vez de depender de um número mágico');
assert.match(editorial, /scroll-padding-bottom:\s*calc\(var\(--study-grading-dock-height/,
  'o scroll nunca termina atrás da barra fixa');

for (const id of ['video-resource-section', 'native-examples-title', 'youglish-box']) {
  assert.match(study, new RegExp(`id="${id}"`), `Entender melhor inclui ${id}`);
}

assert.match(home, /id="btn-primary-stories"/,
  'Home oferece Histórias no primeiro bloco visível');
assert.match(editorial, /home-primary-plan \.home-primary-visual \{ display:grid; \}/,
  'tema editorial não oculta o atalho principal de Histórias');
assert.match(home, /navigate\?\.\('stories'\)/,
  'atalho abre a rota real de Histórias');

for (const id of ['story-level', 'story-duration', 'story-goal']) {
  assert.match(stories, new RegExp(`id="${id}"`), `criação de histórias inclui ${id}`);
}
assert.match(stories, /generateStory\(genre,[\s\S]*generationOptions/,
  'a escolha do usuário chega ao gerador');
assert.match(ai, /options\?\.level/,
  'geração web prioriza o nível solicitado');
assert.match(worker, /request\.options/,
  'geração na extensão recebe o mesmo contrato');
assert.match(db, /requested_level:[\s\S]*target_minutes:[\s\S]*learning_goal:/,
  'Supabase persiste o contrato pedagógico da história');

for (const column of ['requested_level', 'target_minutes', 'learning_goal', 'difficulty_mode', 'validation_status', 'prompt_version']) {
  assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`), `migration inclui ${column}`);
}
assert.match(migration, /stories_target_minutes_check/);
assert.doesNotMatch(migration, /DISABLE ROW LEVEL SECURITY|DROP POLICY|USING \(true\)/i,
  'migration não enfraquece o isolamento owner-only existente');

assert.equal(resolveStoryLevel('B1', 'A2', 'challenge'), 'A2', 'nível explícito tem prioridade');
assert.equal(resolveStoryLevel('B1', 'auto', 'easier'), 'A2', 'modo mais fácil reduz uma banda');
assert.equal(resolveStoryLevel('A1', 'auto', 'easier'), 'A1', 'modo mais fácil respeita o piso');
assert.equal(resolveStoryLevel('B1', 'auto', 'challenge'), 'B2', 'desafio sobe somente uma banda');
assert.deepEqual(storyLengthSpec('A2', 3), { minutes: 3, minWords: 200, maxWords: 280 });
assert.match(buildLevelNote('A2', { targetMinutes: 3, learningGoal: 'comfortable' }), /3 minutos \(200 a 280 palavras\)/);

console.log('Contratos de estudo profundo e histórias passaram.');
