import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// DOM mínimo e observável: o teste executa renderHome real, mas não depende de
// jsdom nem de navegador. Cada troca de HTML vira uma amostra do que o usuário
// veria durante o cold start.
class ObservedContainer {
  constructor() {
    this.frames = [];
    this.attributes = new Map();
    this.attributeEvents = [];
    this._html = '';
  }

  set innerHTML(value) {
    this._html = String(value);
    this.frames.push(this._html);
  }

  get innerHTML() {
    return this._html;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    this.attributeEvents.push(`set:${name}:${value}`);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    this.attributeEvents.push(`remove:${name}`);
  }

  querySelector() { return null; }
  querySelectorAll() { return []; }
}

const styleSentinel = {};
globalThis.document = {
  getElementById(id) {
    return id === 'gamified-home-styles' ? styleSentinel : null;
  },
};

const { renderHome } = await import('../dashboard/js/ui/homeView.js');
const appSource = readFileSync(new URL('../dashboard/js/core/app.js', import.meta.url), 'utf8');

assert.doesNotMatch(
  appSource,
  /\/\/ Update global stats[\s\S]{0,160}updateGlobalStats\(\)/,
  'bootstrap não deve repetir user_stats/cards antes do snapshot da Home',
);
assert.match(appSource, /scheduleDashboardRefresh\(\)[\s\S]*}, 150\);/,
  'mensagens próximas devem ser consolidadas antes de rerenderizar');
assert.match(appSource, /applyGlobalStats\(stats = \{\}\)/,
  'shell deve aceitar os dados já carregados pela Home');
const { db: database } = await import('../utils/db.js');

function completedOnboarding() {
  return JSON.stringify({
    version: 1,
    completed: true,
    level: 'intermediate',
    dailyGoal: 20,
    updatedAt: '2026-07-16T12:00:00.000Z',
  });
}

function statsFixture() {
  return {
    totalWords: 12,
    dueCards: 4,
    dueLearning: 0,
    byStatus: { mature: 3 },
    sessions: [],
    reviewLog: [],
    userStats: {
      xp_today: 15,
      streak: 2,
      streak_freezes: 1,
      last_study_date: null,
    },
  };
}

function makeDb(overrides = {}) {
  const calls = [];
  const mark = (name, value) => {
    calls.push(name);
    return Promise.resolve(value);
  };
  const db = {
    calls,
    getStats: () => mark('getStats', statsFixture()),
    getUserStats: () => mark('getUserStats', statsFixture().userStats),
    getSetting: (key) => mark(`getSetting:${key}`,
      key === 'onboarding_v1' ? completedOnboarding() : '[]'),
    getAllWords: () => mark('getAllWords', []),
    getAllCards: () => mark('getAllCards', []),
    getAllKnownWords: () => mark('getAllKnownWords', []),
    getStories: () => mark('getStories', []),
    setSetting: () => mark('setSetting', true),
    ...overrides,
  };
  return db;
}

const count = (text, pattern) => [...text.matchAll(pattern)].length;

// Integração shell + Home: ambos pedem user_stats quase ao mesmo tempo no
// bootstrap. O contrato do repositório é compartilhar a leitura em voo — duas
// chamadas públicas, uma única chamada REST, sem cachear valor já resolvido.
{
  const originalFetch = database._fetch;
  const originalRead = database._userStatsRead;
  let releaseFetch;
  let restReads = 0;
  try {
    database._userStatsRead = null;
    database._fetch = async path => {
      assert.equal(path, 'user_stats?select=*&limit=1');
      restReads += 1;
      return new Promise(resolve => { releaseFetch = resolve; });
    };

    const shellRead = database.getUserStats();
    const homeRead = database.getUserStats();
    assert.equal(restReads, 1,
      'shell e Home compartilham a mesma leitura REST em voo');
    releaseFetch([{ streak: 4, xp_today: 20 }]);
    assert.deepEqual(await Promise.all([shellRead, homeRead]), [
      { streak: 4, xp_today: 20 },
      { streak: 4, xp_today: 20 },
    ]);
    assert.equal(database._userStatsRead, null,
      'single-flight não mantém user_stats obsoleto após concluir');
  } finally {
    database._fetch = originalFetch;
    database._userStatsRead = originalRead;
  }
}

// Caminho nominal: uma única fonte agregada abre o Home. O próprio Home não
// pode fazer uma segunda leitura direta de user_stats; getStats já a contém.
{
  const db = makeDb();
  const container = new ObservedContainer();
  const applied = [];
  await renderHome(container, {
    db,
    navigate() {},
    showToast() {},
    applyGlobalStats(stats) { applied.push(stats); },
  });
  await Promise.resolve(); // deixa o pós-render de conquistas concluir

  assert.equal(db.calls.filter(call => call === 'getStats').length, 1,
    'cold start consulta o agregado principal uma única vez');
  assert.equal(db.calls.filter(call => call === 'getUserStats').length, 0,
    'Home reutiliza stats.userStats em vez de reler user_stats');
  assert.deepEqual(db.calls.slice(0, 2), ['getStats', 'getSetting:onboarding_v1'],
    'estado principal e onboarding são as primeiras leituras');

  assert.equal(container.frames.length, 2,
    'cold start possui somente estado de carregamento e commit final');
  assert.match(container.frames[0], /Preparando seu plano de hoje/);
  assert.doesNotMatch(container.frames[0], /id="btn-study-now"/,
    'estado de carregamento não mostra CTA prematuro');
  assert.equal(count(container.frames[1], /id="btn-study-now"/g), 1,
    'commit final contém um único CTA primário');
  assert.equal(count(container.frames.join('\n'), />Revisar agora<\/button>/g), 1,
    'o usuário nunca vê duas cópias de Revisar agora');
  assert.deepEqual(container.attributeEvents.slice(0, 2), [
    'set:aria-busy:true',
    'remove:aria-busy',
  ]);
  assert.equal(applied.length, 1, 'Home alimenta o shell com o snapshot já carregado');
  assert.equal(applied[0].dueCards, 4);
}

// Refresh silencioso: conteúdo/CTA corrente permanece enquanto a rede trabalha.
{
  const db = makeDb();
  const container = new ObservedContainer();
  container._html = '<div class="gamified-home"><button id="btn-study-now">Revisar agora</button></div>';
  const refresh = renderHome(container, { db, navigate() {}, showToast() {}, applyGlobalStats() {} });

  assert.equal(container.frames.length, 0,
    'refresh não substitui imediatamente a Home por um loader');
  assert.match(container.innerHTML, /id="btn-study-now"/,
    'CTA anterior continua visível durante a leitura');
  await refresh;
  assert.equal(container.frames.length, 1, 'refresh faz somente o commit atualizado');
  assert.doesNotMatch(container.frames[0], /Preparando seu plano de hoje/);
  assert.equal(count(container.frames[0], /id="btn-study-now"/g), 1);
}

// Corrida realista: uma atualização chega enquanto a primeira leitura ainda
// está em voo. A geração mais nova é a única autorizada a commitar o CTA.
{
  let releaseFirst;
  let statsCalls = 0;
  const firstStats = new Promise(resolve => { releaseFirst = resolve; });
  const db = makeDb({
    getStats() {
      db.calls.push('getStats');
      statsCalls += 1;
      return statsCalls === 1 ? firstStats : Promise.resolve(statsFixture());
    },
  });
  const container = new ObservedContainer();

  const staleRender = renderHome(container, { db, navigate() {}, showToast() {} });
  const currentRender = renderHome(container, { db, navigate() {}, showToast() {} });
  await currentRender;
  releaseFirst(statsFixture());
  await staleRender;

  const committedFrames = container.frames.filter(frame => /id="btn-study-now"/.test(frame));
  assert.equal(committedFrames.length, 1,
    'resposta antiga não repinta nem duplica o CTA da geração atual');
  assert.equal(count(committedFrames[0], />Revisar agora<\/button>/g), 1);
  assert.equal(container.frames.at(-1), committedFrames[0],
    'a resposta atrasada não substitui a tela mais recente');
}

console.log('Gate comportamental de cold start/Home passou.');
