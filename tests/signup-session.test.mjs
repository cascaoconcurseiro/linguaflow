import assert from 'node:assert/strict';
import { db } from '../utils/db.js';

const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};
globalThis.window = { localStorage };
const user = { id: 'signup-user', email: 'signup@example.com' };
const token = { access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 3600, user };

for (const body of [token, { user, session: token }]) {
  values.clear();
  const generation = db._cacheGeneration;
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith('/auth/v1/signup'));
    assert.deepEqual(JSON.parse(options.body), { email: user.email, password: ' password ' });
    return { ok: true, json: async () => body };
  };
  const before = Date.now();
  const result = await db.signUp(user.email, ' password ');
  assert.equal(result.ok, true);
  assert.equal(result.session?.access_token, token.access_token, 'cadastro deve retornar a sessão REST para a tela de login');
  const saved = await db._readSession();
  assert.equal(saved.refresh_token, token.refresh_token);
  assert.deepEqual(saved.user, user);
  assert.ok(saved.expires_at >= before + 3600000);
  assert.ok(await db.checkSession(), 'sessão deve sobreviver à leitura do storage');
  assert.equal(db._cacheGeneration, generation + 1);
}

values.clear();
globalThis.fetch = async () => ({ ok: true, json: async () => user });
const pending = await db.signUp(user.email, ' password ');
assert.equal(pending.ok, true);
assert.ok(!pending.session?.access_token, 'resposta sem token não pode autenticar');
assert.equal(await db._readSession(), null);
console.log('✓ Cadastro: sessão REST, compatibilidade, persistência e ausência de token');
