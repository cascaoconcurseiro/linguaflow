import assert from 'node:assert/strict';
import { db } from '../utils/db.js';
import { addLocalDays, localDateKey } from '../utils/local-day.js';

const today = localDateKey();
const yesterday = localDateKey(addLocalDays(-1));
const originalGetSessions = db.getSessions;

db.getSessions = async () => [
  { date: today, seconds: 120, source: 'extension', language: 'en' },
  { date: today, seconds: 60, source: 'manual_listening', language: 'en' },
  { date: yesterday, seconds: 600, source: 'video', language: 'en' },
  { date: today, seconds: 900, source: 'extension', language: 'es' },
  { date: today, seconds: 900, source: 'review', language: 'en' },
  { date: today, seconds: 900, source: 'reader', language: 'en' },
  { date: today, seconds: 900, source: 'pwa', language: 'en' },
];

try {
  const stats = await db.getStudyStats('en');
  assert.equal(stats.listening.todaySeconds, 180,
    'extension + manual_listening em inglês entram no listening de hoje');
  assert.equal(stats.listening.totalSeconds, 780,
    'total soma somente listening em inglês, incluindo o dia anterior');
  assert.equal(stats.cards.todaySeconds, 900,
    'review continua separado de listening');
  assert.equal(stats.reading.todaySeconds, 900,
    'reader continua separado de listening');
  assert.equal(stats.summary.totalSecondsToday, 1980,
    'resumo inclui somente habilidades do idioma solicitado');
} finally {
  db.getSessions = originalGetSessions;
}

console.log('Filtro de listening por fonte, dia e idioma passou.');
