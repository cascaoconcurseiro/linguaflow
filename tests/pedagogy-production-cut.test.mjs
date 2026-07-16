import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const study = read('dashboard/js/ui/studyView.js');
const game = read('dashboard/js/ui/gameView.js');
const stories = read('dashboard/js/ui/storiesView.js');
const leagues = read('dashboard/js/ui/leaguesView.js');
const db = read('utils/db.js');

const weakStart = study.indexOf('if (weakOnly)');
const weakEnd = study.indexOf('} else {', weakStart);
const weakBranch = study.slice(weakStart, weakEnd);
assert.match(weakBranch, /getCardsDue\(200, true\)/,
  'reforço graduado usa apenas a fila vencida');
assert.doesNotMatch(weakBranch, /getAllCards|getAllWords|ignora due_date/,
  'reforço não busca cards futuros nem antecipa respostas');
assert.match(study, /Não foi possível carregar sua revisão/);
assert.match(study, /id="study-load-retry"/);
assert.match(study, /renderStudy\(container, app, params\)/,
  'falha de banco oferece retry com os mesmos parâmetros');
assert.doesNotMatch(study, /você será fluente/i);

const practiceStart = game.indexOf('async function getPracticeWords');
const practiceEnd = game.indexOf('\n}', practiceStart) + 2;
const practice = game.slice(practiceStart, practiceEnd);
assert.match(practice, /getAllCards\(\)/);
assert.match(practice, /new Date\(card\.due_date\)\.getTime\(\) <= now/);
assert.doesNotMatch(practice, /getCardsDue\(|500/,
  'prática exclui todo vencido sem truncar o backlog');

assert.doesNotMatch(stories, /recordEvent\(/,
  'história e quiz gerados no cliente não concedem XP competitivo');
assert.match(stories, /Prática de compreensão — sem alterar XP, ofensiva ou liga/);
assert.match(stories, /Familiaridade indisponível/);
assert.match(stories, /available: false/);
assert.doesNotMatch(stories, /storyDoneAwarded|storyQuizScored/,
  'flags locais não fingem idempotência de recompensa');

const logSessionStart = db.indexOf('async logSession');
const logSessionEnd = db.indexOf('async getSessions', logSessionStart);
const logSession = db.slice(logSessionStart, logSessionEnd);
assert.doesNotMatch(logSession, /recordEvent|video_session|XP por IMERSÃO/,
  'tempo de vídeo não vira placar a partir de duração declarada pelo cliente');

assert.doesNotMatch(leagues, /Zona de Rebaixamento|promoção ou rebaixamento/,
  'Liga não anuncia regra de rebaixamento diferente do backend');
assert.match(leagues, /os cinco primeiros com atividade avançam de liga/);

console.log('✓ corte pedagógico de produção preserva SRS e placar verificável');
