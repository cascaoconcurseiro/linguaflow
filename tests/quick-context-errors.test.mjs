import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createQuickContextCache, parseQuickContext, readSseText } from '../utils/ai-stream.js';

const source = readFileSync(new URL('../background/service-worker.js', import.meta.url), 'utf8');
const start = source.indexOf('async function explainQuickContext(');
const end = source.indexOf('\n// ============================================================================', start);
const functionSource = source.slice(start, end);

async function run(apiKey, response, onPartial) {
  let calls = 0;
  let request;
  const context = vm.createContext({
    getApiConfig: async () => ({ apiKey, apiUrl: 'https://example.invalid', model: 'deepseek-chat' }),
    fetchWithRetry: async (_url, options) => { calls += 1; request = JSON.parse(options.body); return response; },
    quickContextCache: createQuickContextCache({ get: async () => ({}), set: async () => {} }),
    parseQuickContext, readSseText,
    AbortController, setTimeout, clearTimeout, TextDecoder,
    console: { error() {}, warn() {} },
  });
  vm.runInContext(functionSource, context);
  return { result: context.explainQuickContext('got', 'She finally got over her fear of flying.', { onPartial }), calls: () => calls, request: () => request };
}

const missing = await run('', null);
await assert.rejects(missing.result, /Sessão expirada/);
assert.equal(missing.calls(), 0, 'sem sessão não envia requisição');
const unauthorized = await run('test-session', { ok: false, status: 401 });
await assert.rejects(unauthorized.result, /401/);
const unavailable = await run('test-session', { ok: false, status: 502 });
await assert.rejects(unavailable.result, /502/);
const success = await run('test-session', {
  ok: true, json: async () => ({ choices: [{ message: { content: 'TRADUÇÃO: superou\nEXPLICAÇÃO: Aqui, got over significa superar o medo, não pegar algo.' } }] }),
});
const result = await success.result;
assert.equal(result.translation, 'superou');
assert.equal(result.explanation, 'Aqui, got over significa superar o medo, não pegar algo.');
const messages = success.request().messages;
assert.match(messages[0].content, /Português Brasileiro/);
assert.match(messages[0].content, /Não faça análise gramatical/);
assert.match(messages[0].content, /até 80 palavras/);
assert.match(messages[0].content, /apenas uma palavra do bloco/);
assert.match(messages[0].content, /Não invente expressões/);
// #366: "it's not September yet" virou "provavelmente clima de volta às aulas ou Halloween".
assert.match(messages[0].content, /Não suponha assunto, motivo, lugar, data ou evento que a frase não diz/);
assert.match(source, /createQuickContextCache\(chrome\.storage\.local, \{ key: 'lf_quick_ctx_v2' \}\)/, 'respostas antigas com especulação saem do cache');
assert.match(messages[1].content, /Termo selecionado: "got"/);
assert.match(messages[1].content, /She finally got over her fear of flying/);
assert.match(messages[1].content, /"got over" significa "superou"/);
assert.doesNotMatch(messages[1].content, /pronunciation_pt|transliteração|Fonética Brasileira/);
assert.doesNotMatch(messages[1].content, /uma frase curta explicando/);
assert.equal(success.request().model, 'deepseek-chat');
assert.equal(success.request().stream, true, 'contexto rápido pede streaming ao proxy');
assert.match(messages[1].content, /TRADUÇÃO:[\s\S]*EXPLICAÇÃO:/, 'formato em linhas permite mostrar a tradução antes da explicação terminar');

// Resposta SSE: a tradução é entregue parcialmente antes do fim do stream.
const sse = [
  'data: {"choices":[{"delta":{"content":"TRADUÇÃO: sup"}}]}\n',
  'data: {"choices":[{"delta":{"content":"erou\\nEXPLICA"}}]}\n',
  'data: {"choices":[{"delta":{"content":"ÇÃO: Superar o medo."}}]}\n',
  'data: [DONE]\n',
];
const partials = [];
const streamed = await run('test-session', {
  ok: true,
  headers: { get: () => 'text/event-stream' },
  body: new ReadableStream({ start(c) { for (const chunk of sse) c.enqueue(new TextEncoder().encode(chunk)); c.close(); } }),
}, (p) => partials.push(p));
const streamedResult = await streamed.result;
assert.equal(streamedResult.translation, 'superou');
assert.equal(streamedResult.explanation, 'Superar o medo.');
assert.equal(partials[0].translation, '', 'tradução incompleta ("sup") não é exibida');
assert.ok(partials.some((p) => p.translation === 'superou' && !p.explanation.includes('medo')),
  'a tradução chega antes da explicação terminar');

// JSON antigo continua aceito.
const legacy = await run('test-session', {
  ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ translation: 'superou', explanation: 'x' }) } }] }),
});
assert.equal((await legacy.result).translation, 'superou');
assert.ok(success.request().max_tokens <= 320, 'popup limita geração para evitar respostas lentas fora do contrato');
console.log('Contexto rápido: sessão ausente, 401, 502, resposta em linhas, SSE parcial e JSON legado verificados.');
