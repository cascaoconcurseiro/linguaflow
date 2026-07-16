#!/usr/bin/env node

import assert from 'node:assert/strict';
import { db } from '../utils/db.js';

const originalFetch = db._fetch;
const originalProxyMode = db.isProxyMode;

function rows(from, count, prefix) {
  return Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${from + index}` }));
}

try {
  db.isProxyMode = false;

  // Mais de 1.000 cards: todas as páginas entram na mesma coleção, na ordem
  // definida pela query, sem depender do limite padrão do PostgREST.
  const cardRows = rows(0, 2050, 'card');
  const cardRequests = [];
  db._cardsCache = null;
  db._fetch = async (endpoint) => {
    cardRequests.push(endpoint);
    const url = new URL(`https://example.test/${endpoint}`);
    const limit = Number(url.searchParams.get('limit'));
    const offset = Number(url.searchParams.get('offset'));
    return cardRows.slice(offset, offset + limit);
  };

  const cards = await db.getAllCards();
  assert.equal(cards.length, 2050);
  assert.equal(cards[0].id, 'card-0');
  assert.equal(cards.at(-1).id, 'card-2049');
  assert.deepEqual(cardRequests, [
    'cards?select=*&order=id.asc&limit=1000&offset=0',
    'cards?select=*&order=id.asc&limit=1000&offset=1000',
    'cards?select=*&order=id.asc&limit=1000&offset=2000',
  ]);

  // O filtro temporal original é preservado e a ordenação composta impede
  // que timestamps iguais saltem entre páginas.
  const reviewRows = rows(0, 1005, 'review');
  const reviewRequests = [];
  db._fetch = async (endpoint) => {
    reviewRequests.push(endpoint);
    const url = new URL(`https://example.test/${endpoint}`);
    const limit = Number(url.searchParams.get('limit'));
    const offset = Number(url.searchParams.get('offset'));
    return reviewRows.slice(offset, offset + limit);
  };

  const reviews = await db.getReviewLog(30);
  assert.equal(reviews.length, 1005);
  assert.equal(reviewRequests.length, 2);
  assert.match(reviewRequests[0], /^review_log\?ts=gte\.[^&]+&order=ts\.asc,id\.asc&limit=1000&offset=0$/);
  assert.match(reviewRequests[1], /&limit=1000&offset=1000$/);

  // Duplicatas vindas do servidor não podem desaparecer silenciosamente.
  let duplicatePage = 0;
  db._fetch = async () => {
    duplicatePage += 1;
    if (duplicatePage === 1) return [{ id: 'same' }, { id: 'first' }];
    return [{ id: 'same' }];
  };
  const duplicates = await db._fetchAllPages('items?active=eq.true', { pageSize: 2, maxPages: 3 });
  assert.deepEqual(duplicates.map((item) => item.id), ['same', 'first', 'same']);

  // Uma falha intermediária rejeita a leitura completa; a primeira página
  // nunca é devolvida como se fosse o conjunto integral.
  let failingPage = 0;
  db._fetch = async () => {
    failingPage += 1;
    if (failingPage === 1) return rows(0, 1000, 'partial');
    throw new Error('network failed on page 2');
  };
  await assert.rejects(
    db.getReviewLog(30),
    /network failed on page 2/
  );

  // `_fetch` representa falhas de GET como null. O helper converte esse caso
  // em erro explícito, em vez de esconder a perda com `|| []`.
  let nullPage = 0;
  db._fetch = async () => {
    nullPage += 1;
    return nullPage === 1 ? rows(0, 2, 'partial') : null;
  };
  await assert.rejects(
    db._fetchAllPages('items', { pageSize: 2, maxPages: 3 }),
    /Leitura paginada incompleta na página 2/
  );

  // Se um servidor ignorar offset e continuar enviando páginas cheias, o
  // limite encerra a operação com erro, sem loop infinito nem resultado falso.
  db._fetch = async () => rows(0, 2, 'loop');
  await assert.rejects(
    db._fetchAllPages('items?', { pageSize: 2, maxPages: 2 }),
    /excedeu o limite de 2 páginas/
  );
} finally {
  db._fetch = originalFetch;
  db.isProxyMode = originalProxyMode;
  db._cardsCache = null;
}

console.log('DB pagination integrity tests passed.');
