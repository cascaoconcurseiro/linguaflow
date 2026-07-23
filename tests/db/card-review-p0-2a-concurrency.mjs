#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';

const [psql, port, database, host, user] = process.argv.slice(2);
if (!psql || !port || !database || !host || !user) {
  throw new Error('uso: node card-review-p0-2a-concurrency.mjs <psql> <porta> <banco> <host-ou-socket> <usuario>');
}

const base = ['-X', '-v', 'ON_ERROR_STOP=1', '-h', host, '-p', port, '-U', user, '-w', '-d', database];
const run = (sql) => {
  const result = spawnSync(psql, [...base, '-Atqc', sql], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `psql exit ${result.status}`);
  return result.stdout.trim();
};

run(`
  INSERT INTO auth.users(id) VALUES ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa');
  INSERT INTO public.words(id,user_id,word) VALUES (
    'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa','race');
  INSERT INTO public.cards(id,user_id,word_id,status,reps,due_date) VALUES (
    'cccccccc-1111-4111-8111-cccccccccccc','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb','review',0,now()-interval '1 day');
`);

const state = `jsonb_build_object(
  'id','cccccccc-1111-4111-8111-cccccccccccc','status','review','interval',1,
  'ease_factor',2.5,'step_index',0,'reps',1,'lapses',0,'difficulty',5,
  'stability',1,'pre_lapse_interval',0,'due_date',now()+interval '1 day','is_leech',false)`;

const calls = Array.from({ length: 20 }, (_, index) => new Promise((resolve, reject) => {
  const suffix = String(index + 1).padStart(12, '0');
  const sql = `
    SELECT set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',false);
    SELECT public.record_card_review(
      'cccccccc-1111-4111-8111-cccccccccccc'::uuid,2::smallint,${state},
      'dddddddd-1111-4111-8111-${suffix}'::uuid)->>'outcome';`;
  const child = spawn(psql, [...base, '-Atqc', sql], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('error', reject);
  child.on('close', code => {
    if (code !== 0) reject(new Error(stderr || `psql exit ${code}`));
    else resolve(stdout.trim().split(/\r?\n/).at(-1));
  });
}));

const outcomes = await Promise.all(calls);
if (outcomes.filter(value => value === 'accepted').length !== 1
    || outcomes.filter(value => value === 'ineligible').length !== 19) {
  throw new Error(`outcomes concorrentes inesperados: ${JSON.stringify(outcomes)}`);
}

const proof = run(`
  SELECT concat_ws('|',
    (SELECT count(*) FROM public.learning_events WHERE user_id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'),
    (SELECT count(*) FROM public.review_log WHERE user_id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'),
    (SELECT count(*) FROM public.xp_ledger WHERE user_id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'),
    (SELECT reps FROM public.cards WHERE id='cccccccc-1111-4111-8111-cccccccccccc'),
    (SELECT xp_total FROM public.user_stats WHERE user_id='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'));
`);

if (proof !== '20|1|1|1|10') throw new Error(`prova concorrente divergiu: ${proof}`);
console.log('CARD REVIEW P0.2A CONCURRENCY OK: 20|1|1|1|10');
