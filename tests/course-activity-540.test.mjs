import assert from 'node:assert/strict';
import { CoursesRepository } from '../utils/db/courses-repo.js';

const calls = [];
const repo = new CoursesRepository({ _fetch: async (endpoint, opts) => { calls.push({ endpoint, opts }); return calls.length === 1 ? [{ id: 'x' }] : []; } });
const since = '2026-10-07T03:00:00.000Z';

assert.equal(await repo.hasPracticeSince(since), true);
assert.match(calls[0].endpoint, /^course_practice_sessions\?answered_questions=gt\.0&started_at=gte\.2026-10-07T03%3A00%3A00\.000Z&select=id&limit=1$/);
assert.equal(calls[0].opts.throwOnReadError, true);
assert.equal(await repo.hasPracticeSince(since), false);
await assert.rejects(() => repo.hasPracticeSince('lixo'), /data inválida/);
console.log('course-activity-540 ok');
