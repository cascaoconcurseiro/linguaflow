import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  toAnthropicRequest, fromAnthropicResponse, anthropicSseToOpenAi,
} from '../supabase/functions/deepseek-chat/anthropic.ts';

const opts = { model: 'claude-haiku-5-5', maxTokens: 300, temperature: 1.4, stream: false };

// system sai das mensagens; papéis consecutivos são unidos; temperatura limitada a 1
const req = toAnthropicRequest([
  { role: 'system', content: 'A' }, { role: 'system', content: 'B' },
  { role: 'user', content: 'oi' }, { role: 'user', content: 'tudo bem?' },
  { role: 'assistant', content: 'olá' },
], opts);
assert.equal(req.system, 'A\n\nB');
assert.deepEqual(req.messages.map((m) => m.role), ['user', 'assistant']);
assert.equal(req.messages[0].content, 'oi\n\ntudo bem?');
assert.equal(req.temperature, 1);
assert.equal(req.max_tokens, 300);

// conversa que começa pelo assistente ganha um turno de usuário inicial
const lead = toAnthropicRequest([{ role: 'assistant', content: 'x' }], opts);
assert.equal(lead.messages[0].role, 'user');
assert.equal(toAnthropicRequest([{ role: 'user', content: 'x' }], opts).system, undefined);

// resposta sem streaming no formato OpenAI
const out = fromAnthropicResponse({
  id: 'msg_1', model: 'claude-haiku-5-5', stop_reason: 'end_turn',
  content: [{ type: 'text', text: 'Olá' }, { type: 'text', text: ' mundo' }],
  usage: { input_tokens: 5, output_tokens: 2 },
}, 'fallback');
assert.equal(out.choices[0].message.content, 'Olá mundo');
assert.equal(out.usage.completion_tokens, 2);

// SSE Anthropic -> SSE OpenAI, inclusive com evento partido entre pedaços
const sse = [
  'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Su"}}\n\n',
  'event: ping\ndata: {"type":"ping"}\n\n',
  'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"perou"}}\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n',
].join('');
const enc = new TextEncoder();
const bytes = enc.encode(sse);
const upstream = new ReadableStream({
  start(c) { c.enqueue(bytes.slice(0, 40)); c.enqueue(bytes.slice(40)); c.close(); },
});
const text = await new Response(anthropicSseToOpenAi(upstream)).text();
const deltas = text.split('\n').filter((l) => l.startsWith('data: {')).map((l) => JSON.parse(l.slice(6)).choices[0].delta.content);
assert.deepEqual(deltas, ['Su', 'perou']);
assert.ok(text.includes('data: [DONE]'));

// a função continua DeepSeek por padrão; Claude só com AI_PROVIDER=anthropic
const src = readFileSync(new URL('../supabase/functions/deepseek-chat/index.ts', import.meta.url), 'utf8');
assert.match(src, /AI_PROVIDER"\) === "anthropic"/);
assert.match(src, /model:\s*"deepseek-chat"/);
console.log('anthropic-adapter: ok');
