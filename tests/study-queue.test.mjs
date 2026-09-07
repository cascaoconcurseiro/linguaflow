import assert from 'node:assert/strict';
import { db } from '../utils/db.js';

const originalProxyMode = db.isProxyMode;
const originalFetch = db._fetch;

try {
  db.isProxyMode = false;
  const queries = [];
  db._fetch = async endpoint => {
    queries.push(endpoint);
    if (endpoint.includes('status=eq.learning')) return [{ id: 'learning', words: { category: 'idiom' } }];
    if (endpoint.includes('status=in.(review,mature)')) return [{ id: 'review', words: { category: 'idiom' } }];
    if (endpoint.includes('status=eq.new')) return [{ id: 'new', words: { category: 'idiom' } }];
    throw new Error(`Consulta inesperada: ${endpoint}`);
  };

  const cards = await db.getStudyCards({ newLimit: 10, reviewLimit: 1000, topic: 'idiom' });
  assert.deepEqual(cards.map(card => card.id), ['learning', 'review', 'new']);
  assert.ok(cards.every(card => card.wordData?.category === 'idiom' && !('words' in card)));
  assert.equal(queries.length, 3);
  assert.ok(queries.some(query => query.includes('status=eq.learning') && query.includes('limit=1000')));
  assert.ok(queries.some(query => query.includes('status=in.(review,mature)') && query.includes('limit=1000')));
  assert.ok(queries.every(query => query.includes('words!inner(') && query.includes('words.category=eq.idiom')));

  queries.length = 0;
  await db.getStudyCards({ newLimit: 0, reviewLimit: 0 });
  assert.equal(queries.length, 1, 'learning vencido continua sendo consultado mesmo sem cotas disponíveis');
  assert.ok(queries[0].includes('status=eq.learning'));
} finally {
  db.isProxyMode = originalProxyMode;
  db._fetch = originalFetch;
}

console.log('Study queue contracts passed.');
