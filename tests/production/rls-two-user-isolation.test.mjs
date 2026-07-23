import assert from 'node:assert/strict';

const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'E2E_USER_A_EMAIL',
  'E2E_USER_A_PASSWORD',
  'E2E_USER_B_EMAIL',
  'E2E_USER_B_PASSWORD',
];

function readConfig() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
  assert.deepEqual(
    missing,
    [],
    `Configuração E2E ausente: ${missing.join(', ')}`,
  );

  const config = Object.fromEntries(
    REQUIRED_ENV.map((name) => [name, process.env[name].trim()]),
  );
  assert.match(config.SUPABASE_URL, /^https:\/\/[a-z0-9]+\.supabase\.co$/);
  assert.notEqual(config.E2E_USER_A_EMAIL, config.E2E_USER_B_EMAIL);
  return config;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function signIn(config, email, password) {
  const response = await fetch(
    `${config.SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        apikey: config.SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  const body = await parseResponse(response);
  assert.equal(response.ok, true, `Falha ao autenticar usuário E2E (${response.status})`);
  assert.ok(body?.access_token, 'Login E2E não retornou access_token');
  assert.match(body?.user?.id || '', /^[0-9a-f-]{36}$/i);
  return { token: body.access_token, userId: body.user.id };
}

async function rest(config, session, path, options = {}) {
  const response = await fetch(`${config.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...options.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
  return { response, body: await parseResponse(response) };
}

const config = readConfig();
const [userA, userB] = await Promise.all([
  signIn(config, config.E2E_USER_A_EMAIL, config.E2E_USER_A_PASSWORD),
  signIn(config, config.E2E_USER_B_EMAIL, config.E2E_USER_B_PASSWORD),
]);

assert.notEqual(userA.userId, userB.userId, 'As credenciais E2E apontam para o mesmo usuário');

const marker = `lf-rls-${Date.now()}-${crypto.randomUUID()}`;
let createdId = null;
let testFailure = null;

try {
  const created = await rest(config, userA, 'words?select=id,user_id,word', {
    method: 'POST',
    body: JSON.stringify({ word: marker, lang: 'en', translation: 'isolamento' }),
  });
  assert.equal(created.response.status, 201, `Usuário A não conseguiu criar palavra (${created.response.status})`);
  assert.equal(created.body?.length, 1);
  assert.equal(created.body[0].user_id, userA.userId);
  createdId = created.body[0].id;

  const ownRead = await rest(config, userA, `words?id=eq.${createdId}&select=id,user_id,word`);
  assert.equal(ownRead.response.ok, true);
  assert.equal(ownRead.body?.length, 1, 'Usuário A não lê o próprio dado');

  const foreignRead = await rest(config, userB, `words?id=eq.${createdId}&select=id`);
  assert.equal(foreignRead.response.ok, true);
  assert.deepEqual(foreignRead.body, [], 'RLS permitiu que B lesse dado de A');

  const foreignUpdate = await rest(config, userB, `words?id=eq.${createdId}&select=id`, {
    method: 'PATCH',
    body: JSON.stringify({ translation: 'alterado por outro usuário' }),
  });
  assert.equal(foreignUpdate.response.ok, true);
  assert.deepEqual(foreignUpdate.body, [], 'RLS permitiu que B alterasse dado de A');

  const foreignDelete = await rest(config, userB, `words?id=eq.${createdId}&select=id`, {
    method: 'DELETE',
  });
  assert.equal(foreignDelete.response.ok, true);
  assert.deepEqual(foreignDelete.body, [], 'RLS permitiu que B apagasse dado de A');

  const stillOwned = await rest(config, userA, `words?id=eq.${createdId}&select=id,translation`);
  assert.equal(stillOwned.body?.length, 1, 'Dado de A desapareceu após tentativa de B');
  assert.equal(stillOwned.body[0].translation, 'isolamento');

  const impersonation = await rest(config, userB, 'words?select=id', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userA.userId,
      word: `${marker}-impersonation`,
      lang: 'en',
    }),
  });
  assert.equal(
    impersonation.response.ok,
    false,
    'RLS permitiu que B inserisse um dado em nome de A',
  );

  console.log('PASS: isolamento RLS autenticado entre dois usuários');
} catch (error) {
  testFailure = error;
} finally {
  if (createdId) {
    const cleanup = await rest(config, userA, 'rpc/delete_word_safely', {
      method: 'POST',
      body: JSON.stringify({ p_word_id: createdId }),
    });
    if (!cleanup.response.ok && !testFailure) {
      testFailure = new Error(`Falha ao limpar dado temporário do teste (${cleanup.response.status})`);
    }
  }
}

if (testFailure) throw testFailure;
