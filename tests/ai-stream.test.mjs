import assert from 'node:assert/strict';
import { createQuickContextCache, parseQuickContext } from '../utils/ai-stream.js';

// parseQuickContext
assert.deepEqual(parseQuickContext('TRADUÇÃO: superou\nEXPLICAÇÃO: Aqui significa superar.'),
  { translation: 'superou', explanation: 'Aqui significa superar.' });
assert.deepEqual(parseQuickContext('**Tradução:** "nojento"\n**Explicação:** Algo repugnante.'),
  { translation: 'nojento', explanation: 'Algo repugnante.' }, 'tolera markdown, acento e aspas');
assert.equal(parseQuickContext('TRADUCAO: superou', { partial: true }).translation, '',
  'linha de tradução sem quebra ainda está sendo escrita');
assert.equal(parseQuickContext('TRADUCAO: superou').translation, 'superou', 'no fim do stream aceita a linha sem quebra');
assert.deepEqual(parseQuickContext('{"translation": "x"'), { translation: '', explanation: '' }, 'JSON incompleto não quebra');
assert.deepEqual(parseQuickContext('```json\n{"translation":"a","explanation":"b"}\n```'), { translation: 'a', explanation: 'b' });
assert.deepEqual(parseQuickContext('texto solto'), { translation: '', explanation: '' });

// createQuickContextCache: persiste, expira e limita
const backing = {};
const storage = {
  get: async (key) => ({ [key]: backing[key] }),
  set: async (obj) => Object.assign(backing, JSON.parse(JSON.stringify(obj))),
};
let clock = 1000;
const cache = createQuickContextCache(storage, { max: 2, ttlMs: 500, now: () => clock });
assert.equal(await cache.get('Got', 'She got over it.'), null);
await cache.set('Got', 'She got over it.', { translation: 'superou', explanation: 'e' });
assert.deepEqual(await cache.get(' got ', 'she got over it.'), { translation: 'superou', explanation: 'e' },
  'chave ignora caixa e espaços');

const reopened = createQuickContextCache(storage, { max: 2, ttlMs: 500, now: () => clock });
assert.deepEqual(await reopened.get('got', 'She got over it.'), { translation: 'superou', explanation: 'e' },
  'sobrevive ao reinício do service worker');

clock += 1;
await cache.set('a', 's', { translation: 'A' });
clock += 1;
await cache.set('b', 's', { translation: 'B' });
assert.equal(await cache.get('got', 'She got over it.'), null, 'remove a entrada mais antiga acima do limite');
assert.equal((await cache.get('b', 's')).translation, 'B');
clock += 1000;
assert.equal(await cache.get('b', 's'), null, 'expira após o TTL');

const broken = createQuickContextCache({ get: async () => { throw new Error('x'); }, set: async () => { throw new Error('y'); } });
assert.equal(await broken.get('a', 'b'), null, 'falha de storage vira cache vazio');
await broken.set('a', 'b', { translation: 't' });

console.log('ai-stream: parser do contexto rápido e cache persistente verificados.');
