// Um 401 com refresh_token válido (relógio local atrasado, JWT encurtado no
// servidor) renova a sessão e repete a chamada uma vez, sem deslogar.
// Só desloga quando o próprio refresh é rejeitado.
import assert from 'node:assert/strict';
import { db } from '../utils/db.js';

const values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
};
globalThis.window = { localStorage, dispatchEvent: () => {} };
globalThis.CustomEvent = class { constructor(type) { this.type = type; } };
db.clearFluencyCheckDraft = async () => {};

const user = { id: 'u-401', email: 'u401@example.com' };
const seed = () => {
  values.clear();
  // Localmente o token parece válido por mais 1h: nenhum refresh preventivo.
  values.set('lf_supabase_session', JSON.stringify({ session: {
    access_token: 'stale-access', refresh_token: 'good-refresh', expires_at: Date.now() + 3600000, user,
  } }));
};

// 1. Refresh aceito: a chamada é repetida com o token novo e o usuário continua logado.
seed();
let calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url, auth: options.headers?.Authorization });
  if (url.includes('/auth/v1/token?grant_type=refresh_token')) {
    assert.deepEqual(JSON.parse(options.body), { refresh_token: 'good-refresh' });
    return { ok: true, json: async () => ({ access_token: 'fresh-access', refresh_token: 'next-refresh', expires_in: 3600, user }) };
  }
  if (options.headers?.Authorization === 'Bearer stale-access') {
    return { ok: false, status: 401, text: async () => '{"message":"JWT expired"}' };
  }
  return { ok: true, status: 200, text: async () => '[{"id":"w1"}]' };
};
const rows = await db._fetch('words?select=id', { throwOnReadError: true });
assert.deepEqual(rows, [{ id: 'w1' }]);
assert.equal(calls.filter(c => c.url.includes('/rest/v1/')).length, 2, 'repete a chamada exatamente uma vez');
assert.equal(calls.at(-1).auth, 'Bearer fresh-access');
const kept = JSON.parse(values.get('lf_supabase_session')).session;
assert.equal(kept.access_token, 'fresh-access', 'sessão renovada continua salva');
assert.equal(kept.refresh_token, 'next-refresh');

// 2. Refresh rejeitado: aí sim desloga.
seed();
calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url });
  if (url.includes('grant_type=refresh_token')) return { ok: false, status: 400, json: async () => ({ error_description: 'Invalid Refresh Token' }) };
  return { ok: false, status: 401, text: async () => '{"message":"JWT expired"}' };
};
await assert.rejects(db._fetch('words?select=id', { throwOnReadError: true }), (error) => error.status === 401 || error.kind === 'auth');
assert.equal(values.has('lf_supabase_session'), false, 'refresh rejeitado desloga');
assert.equal(calls.filter(c => c.url.includes('/rest/v1/')).length, 1, 'sem token novo não repete');

// 3. 401 persistente mesmo com token novo: não entra em laço.
seed();
calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url, contentType: options.headers?.['Content-Type'], body: options.body });
  if (url.includes('grant_type=refresh_token')) return { ok: true, json: async () => ({ access_token: 'fresh-2', refresh_token: 'r2', expires_in: 3600, user }) };
  return { ok: false, status: 401, text: async () => '{}' };
};
await assert.rejects(db._fetch('rpc/record_card_review', { method: 'POST', body: { p_card_id: 'c' } }));
assert.equal(calls.filter(c => c.url.includes('/rest/v1/')).length, 2, 'no máximo uma repetição');
assert.equal(calls.filter(c => c.url.includes('grant_type=refresh_token')).length, 1);
const writes = calls.filter(c => c.url.includes('/rest/v1/'));
assert.ok(writes.every(c => c.contentType === 'application/json' && c.body === '{"p_card_id":"c"}'), 'repetição de escrita mantém corpo e Content-Type');

console.log('✓ 401: renova e repete uma vez; desloga só com refresh rejeitado; sem laço');
