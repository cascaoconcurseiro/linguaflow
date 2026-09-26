// tests/modular-database-facade-contract.test.mjs — Validação de contrato e retrocompatibilidade da Facade do DatabaseService
import assert from 'node:assert/strict';
import test from 'node:test';
import { db } from '../utils/db.js';
import { ReaderStoriesRepository } from '../utils/db/reader-stories-repo.js';
import { GamificationRepository } from '../utils/db/gamification-repo.js';

test('ReaderStoriesRepository: delega para proxy quando em isProxyMode', async () => {
  const proxyCalls = [];
  const fakeDb = {
    isProxyMode: true,
    _proxy: async (method, args) => {
      proxyCalls.push({ method, args });
      return { proxied: true, method };
    },
    _fetch: async () => {
      throw new Error('Não deveria chamar _fetch em proxy mode');
    },
  };

  const repo = new ReaderStoriesRepository(fakeDb);

  await repo.saveStory({ title: 'Test Story', content: 'Story content' });
  await repo.getStories(10);
  await repo.deleteStory('00000000-0000-4000-8000-000000000001');
  await repo.updateStoryArchive('00000000-0000-4000-8000-000000000001', false);
  await repo.getReaderTexts();
  await repo.saveReaderText({ id: 'rt-1', title: 'Article' });
  await repo.migrateReaderText({ id: 'rt-2', title: 'Migrated' });
  await repo.deleteReaderText('rt-1');
  await repo.updateReaderProgress('rt-1', { lastReadPosition: 120, readingPercentage: 45, isCompleted: false });

  assert.equal(proxyCalls.length, 9, 'Deve delegar todas as 9 operações para o proxy');
  assert.equal(proxyCalls[0].method, 'saveStory');
  assert.equal(proxyCalls[1].method, 'getStories');
  assert.equal(proxyCalls[2].method, 'deleteStory');
  assert.equal(proxyCalls[3].method, 'updateStoryArchive');
  assert.equal(proxyCalls[4].method, 'getReaderTexts');
  assert.equal(proxyCalls[5].method, 'saveReaderText');
  assert.equal(proxyCalls[6].method, 'migrateReaderText');
  assert.equal(proxyCalls[7].method, 'deleteReaderText');
  assert.equal(proxyCalls[8].method, 'updateReaderProgress');
});

test('GamificationRepository: delega para proxy quando em isProxyMode', async () => {
  const proxyCalls = [];
  const fakeDb = {
    isProxyMode: true,
    _proxy: async (method, args) => {
      proxyCalls.push({ method, args });
      return { proxied: true, method };
    },
    _fetch: async () => {
      throw new Error('Não deveria chamar _fetch em proxy mode');
    },
  };

  const repo = new GamificationRepository(fakeDb);

  await repo.getUserStats();
  await repo.reportClientError('dashboard', 'TypeError', '/stories', '3.0.58');
  await repo.getLeaderboard(2, 10);
  await repo.ensureUserStats();
  await repo.maybeLeagueRollover();
  await repo.getPushPublicKey();
  await repo.savePushSubscription({ endpoint: 'https://push.example.com', keys: { p256dh: 'key', auth: 'auth' } });
  await repo.deletePushSubscription('https://push.example.com');
  await repo.setEmailOptIn(true);
  await repo.saveAchievement('first_story');
  await repo.getUserAchievements();

  assert.equal(proxyCalls.length, 11, 'Deve delegar todas as 11 operações de gamificação para o proxy');
  assert.equal(proxyCalls[0].method, 'getUserStats');
  assert.equal(proxyCalls[1].method, 'reportClientError');
  assert.equal(proxyCalls[2].method, 'getLeaderboard');
  assert.equal(proxyCalls[3].method, 'ensureUserStats');
  assert.equal(proxyCalls[4].method, 'maybeLeagueRollover');
  assert.equal(proxyCalls[5].method, 'getPushPublicKey');
  assert.equal(proxyCalls[6].method, 'savePushSubscription');
  assert.equal(proxyCalls[7].method, 'deletePushSubscription');
  assert.equal(proxyCalls[8].method, 'setEmailOptIn');
  assert.equal(proxyCalls[9].method, 'saveAchievement');
  assert.equal(proxyCalls[10].method, 'getUserAchievements');
});

test('Database Facade: mantém a mesma interface pública delegando aos repositórios', async () => {
  // Salva métodos e estados originais
  const originalReaderRepo = db._readerStoriesRepo;
  const originalGamificationRepo = db._gamificationRepo;

  let readerCalls = 0;
  let gamificationCalls = 0;

  db._readerStoriesRepo = {
    saveStory: async () => { readerCalls++; return { ok: true }; },
    getStories: async () => { readerCalls++; return []; },
    _fetchStories: async () => { readerCalls++; return []; },
    deleteStory: async () => { readerCalls++; return true; },
    updateStoryArchive: async () => { readerCalls++; return { ok: true }; },
    getReaderTexts: async () => { readerCalls++; return []; },
    saveReaderText: async () => { readerCalls++; return {}; },
    migrateReaderText: async () => { readerCalls++; return {}; },
    deleteReaderText: async () => { readerCalls++; return true; },
    updateReaderProgress: async () => { readerCalls++; return { ok: true }; },
    invalidateCache: () => {},
  };

  db._gamificationRepo = {
    getUserStats: async () => { gamificationCalls++; return {}; },
    reportClientError: async () => { gamificationCalls++; },
    getLeaderboard: async () => { gamificationCalls++; return []; },
    ensureUserStats: async () => { gamificationCalls++; return { ok: true }; },
    maybeLeagueRollover: async () => { gamificationCalls++; return { ran: false }; },
    getPushPublicKey: async () => { gamificationCalls++; return 'public-key'; },
    savePushSubscription: async () => { gamificationCalls++; return { ok: true }; },
    deletePushSubscription: async () => { gamificationCalls++; return { ok: true }; },
    setEmailOptIn: async () => { gamificationCalls++; return { ok: true }; },
    saveAchievement: async () => { gamificationCalls++; return true; },
    getUserAchievements: async () => { gamificationCalls++; return []; },
    resetSessionState: () => {},
  };

  try {
    await db.saveStory({ title: 'T' });
    await db.getStories(50);
    await db._fetchStories(50);
    await db.deleteStory('00000000-0000-4000-8000-000000000001');
    await db.updateStoryArchive('00000000-0000-4000-8000-000000000001', true);
    await db.getReaderTexts();
    await db.saveReaderText({ id: '1' });
    await db.migrateReaderText({ id: '2' });
    await db.deleteReaderText('1');
    await db.updateReaderProgress('1', { readingPercentage: 100 });

    assert.equal(readerCalls, 10, 'Todas as 10 chamadas de leitor/histórias delegaram para o repo');

    await db.getUserStats();
    await db.reportClientError('ui', 'Error');
    await db.getLeaderboard(0, 10);
    await db.ensureUserStats();
    await db.maybeLeagueRollover();
    await db.getPushPublicKey();
    await db.savePushSubscription({});
    await db.deletePushSubscription('endpoint');
    await db.setEmailOptIn(false);
    await db.saveAchievement('id');
    await db.getUserAchievements();

    assert.equal(gamificationCalls, 11, 'Todas as 11 chamadas de gamificação delegaram para o repo');
  } finally {
    db._readerStoriesRepo = originalReaderRepo;
    db._gamificationRepo = originalGamificationRepo;
  }
});
