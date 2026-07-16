import assert from 'node:assert/strict';
import { db } from '../utils/db.js';

const original = {
  isProxyMode: db.isProxyMode,
  fetch: db._fetch,
  proxy: db._proxy,
  cacheGeneration: db._cacheGeneration,
  authGeneration: db._userStatsAuthGeneration,
  activeRead: db._userStatsRead,
};

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

try {
  db.isProxyMode = false;
  db._cacheGeneration = 0;
  db._userStatsAuthGeneration = 0;
  db._userStatsRead = null;

  const first = deferred();
  let fetchCalls = 0;
  db._fetch = async endpoint => {
    fetchCalls += 1;
    assert.equal(endpoint, 'user_stats?select=*&limit=1');
    return first.promise;
  };

  const coldStartShell = db.getUserStats();
  const coldStartHome = db.getUserStats();
  assert.equal(fetchCalls, 1, 'duas leituras concorrentes devem usar uma chamada REST');
  first.resolve([{ id: 'stats-1', streak: 7 }]);
  assert.deepEqual(await Promise.all([coldStartShell, coldStartHome]), [
    { id: 'stats-1', streak: 7 },
    { id: 'stats-1', streak: 7 },
  ]);

  db._fetch = async () => {
    fetchCalls += 1;
    return [{ id: 'stats-1', streak: 8 }];
  };
  assert.equal((await db.getUserStats()).streak, 8);
  assert.equal(fetchCalls, 2, 'valor resolvido não deve virar cache persistente');

  const stale = deferred();
  const fresh = deferred();
  const reads = [stale, fresh];
  db._fetch = async () => {
    fetchCalls += 1;
    return reads.shift().promise;
  };
  const beforeWrite = db.getUserStats();
  db._invalidateReadCache();
  const afterWrite = db.getUserStats();
  assert.equal(fetchCalls, 4, 'invalidação deve impedir coalescência com leitura antiga');
  stale.resolve([{ streak: 8 }]);
  fresh.resolve([{ streak: 9 }]);
  assert.equal((await beforeWrite).streak, 8);
  assert.equal((await afterWrite).streak, 9);

  db.isProxyMode = true;
  db._userStatsRead = null;
  const proxied = deferred();
  let proxyCalls = 0;
  db._proxy = async (method, args) => {
    proxyCalls += 1;
    assert.equal(method, 'getUserStats');
    assert.deepEqual(args, []);
    return proxied.promise;
  };
  const proxyA = db.getUserStats();
  const proxyB = db.getUserStats();
  assert.equal(proxyCalls, 1, 'modo proxy também deve enviar uma única mensagem ao worker');
  proxied.resolve({ id: 'stats-proxy', streak: 3 });
  await Promise.all([proxyA, proxyB]);

  db._userStatsRead = null;
  db._proxy = async () => {
    proxyCalls += 1;
    throw new Error('worker indisponível');
  };
  await assert.rejects(db.getUserStats(), /worker indisponível/);
  await assert.rejects(db.getUserStats(), /worker indisponível/);
  assert.equal(proxyCalls, 3, 'falha deve liberar a coalescência para retry posterior');

  console.log('✓ user_stats: cold start 2→1, sem cache persistente e seguro após invalidação/proxy');
} finally {
  db.isProxyMode = original.isProxyMode;
  db._fetch = original.fetch;
  db._proxy = original.proxy;
  db._cacheGeneration = original.cacheGeneration;
  db._userStatsAuthGeneration = original.authGeneration;
  db._userStatsRead = original.activeRead;
}
