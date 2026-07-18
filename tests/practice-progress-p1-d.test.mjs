import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const game = read('dashboard/js/ui/gameView.js');
const stats = read('dashboard/js/ui/statsView.js');
const progress = read('dashboard/js/ui/progressView.js');
const css = read('dashboard/css/globals.css');
const ai = read('dashboard/js/core/ai.js');
const dbSource = read('utils/db.js');

assert.match(game, /Reconhecimento/);
assert.match(game, /Escuta/);
assert.match(game, /Reconstrução de frase/);
assert.match(game, /resultado fica nesta rodada e não altera agendamento, XP, ofensiva ou liga/);
assert.doesNotMatch(game, /acertos em sequência aumentam o XP/);
assert.match(game, /async function getPracticeWords/);
assert.match(game, /dueWordIds\.has\(String\(word\.id\)\)/);
assert.doesNotMatch(game, /let cards = await lfDb\.getCardsDue/);
assert.doesNotMatch(stats + ai + dbSource + read('dashboard/js/ui/homeView.js'),
  /Diagnóstico semanal do linguista|generateWeeklyDiagnosis|getDiagnosisData|lf_weekly_diagnosis|home-today-plan/,
  'análise semanal textual e seu cache devem permanecer removidos');

const retentionIndex = stats.indexOf("'Lembradas nas revisões · pelas suas notas'");
const activityIndex = stats.indexOf("'Minutos de estudo hoje'");
assert.ok(retentionIndex >= 0 && retentionIndex < activityIndex, 'retenção aparece antes de métricas de atividade');
assert.match(stats, /Tempo e volume mostram atividade — não comprovam domínio do idioma/);
assert.match(stats, /histórico de atividade \(\$\{summary\.totalMinutes\} min em 60 dias\)/);
const subtitleEngine = read('content/subtitle-engine.js');
assert.match(subtitleEngine, /this\.isActivated[\s\S]*document\.visibilityState === 'visible'[\s\S]*hasActiveSubtitle/,
  'vídeo passivo ou aba em segundo plano não pode inflar tempo de estudo');
assert.match(stats, /Expressões na revisão/);
assert.doesNotMatch(stats, /Expressões na memória/);
assert.match(stats, /<details class="stats-activity-details">/);
assert.ok(stats.indexOf('Previsão de revisões') < stats.indexOf('Ver histórico de atividade'), 'agenda aparece antes dos detalhes de atividade');

assert.match(progress, /product-destination-card-\$\{item\.emphasis\}/);
assert.match(css, /\.product-destination-card-primary/);
assert.match(css, /\.product-destination-card-optional/);
assert.match(progress, /Atividade competitiva/);
assert.doesNotMatch(progress, /atividades qualificadas/);
const leagues = read('dashboard/js/ui/leaguesView.js');
assert.match(leagues, /Liga opcional:/);
assert.match(leagues, /Prática livre não pontua/);
assert.doesNotMatch(leagues, /inativos descem/);
assert.match(progress, /item\.emphasis === 'primary' \? 'btn-primary' : 'btn-secondary'/);

console.log('✓ P1-D: prática, memória e competição têm papéis distintos');
