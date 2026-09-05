import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../background/service-worker.js', import.meta.url), 'utf8');
const start = source.indexOf('async function explainQuickContext(');
const end = source.indexOf('\n// ============================================================================', start);
const functionSource = source.slice(start, end);

async function run(apiKey, response) {
  let calls = 0;
  let request;
  const context = vm.createContext({
    getApiConfig: async () => ({ apiKey, apiUrl: 'https://example.invalid', model: 'deepseek-chat' }),
    fetchWithRetry: async (_url, options) => { calls += 1; request = JSON.parse(options.body); return response; },
    AbortController, setTimeout, clearTimeout,
    console: { error() {}, warn() {} },
  });
  vm.runInContext(functionSource, context);
  return { result: context.explainQuickContext('got', 'She finally got over her fear of flying.'), calls: () => calls, request: () => request };
}

const missing = await run('', null);
await assert.rejects(missing.result, /Sessão expirada/);
assert.equal(missing.calls(), 0, 'sem sessão não envia requisição');
const unauthorized = await run('test-session', { ok: false, status: 401 });
await assert.rejects(unauthorized.result, /401/);
const unavailable = await run('test-session', { ok: false, status: 502 });
await assert.rejects(unavailable.result, /502/);
const success = await run('test-session', {
  ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ translation: 'superou', pronunciation_pt: 'gót ôu-ver', explanation: 'Aqui, got over significa superar o medo, não pegar algo.' }) } }] }),
});
const result = await success.result;
assert.equal(result.translation, 'superou');
assert.equal(result.explanation, 'Aqui, got over significa superar o medo, não pegar algo.');
assert.equal(result.pronunciation_pt, 'gót ôu-ver');
const messages = success.request().messages;
assert.match(messages[0].content, /Português Brasileiro/);
assert.match(messages[0].content, /Não faça análise gramatical/);
assert.match(messages[0].content, /até 80 palavras/);
assert.match(messages[0].content, /apenas uma palavra do bloco/);
assert.match(messages[0].content, /Não invente expressões/);
assert.match(messages[1].content, /Termo selecionado: "got"/);
assert.match(messages[1].content, /She finally got over her fear of flying/);
assert.match(messages[1].content, /"got over" significa "superou"/);
assert.match(messages[1].content, /"pronunciation_pt"/);
assert.doesNotMatch(messages[1].content, /uma frase curta explicando/);
assert.equal(success.request().model, 'deepseek-chat');
assert.ok(success.request().max_tokens <= 320, 'popup limita geração para evitar respostas lentas fora do contrato');
const pronunciationOnly = await run('test-session', {
  ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ pronunciation_pt: 'gúd' }) } }] }),
});
assert.equal((await pronunciationOnly.result).pronunciation_pt, 'gúd');
console.log('Contexto rápido: sessão ausente, 401, 502 e resposta válida verificados.');
