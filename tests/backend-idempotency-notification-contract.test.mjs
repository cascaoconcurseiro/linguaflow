import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20260909100000_notification_claims_and_adaptive_idempotency.sql');
const push = read('supabase/functions/push-reminder/index.ts');
const email = read('supabase/functions/email-reengagement/index.ts');

assert.match(migration, /if v_existing\.card_id is distinct from p_card_id[\s\S]*raise exception 'idempotency_conflict'/i);
assert.match(migration, /notification_claim_token uuid[\s\S]*notification_claimed_at timestamptz/i);
assert.match(migration, /email_claim_token uuid[\s\S]*email_claimed_at timestamptz/i);
assert.match(migration, /notification_claimed_at < clock_timestamp\(\) - interval '15 minutes'/i);
assert.match(migration, /email_claimed_at < clock_timestamp\(\) - interval '15 minutes'/i);

for (const signature of [
  'claim_push_subscription\\(uuid, uuid\\)',
  'finish_push_subscription_claim\\(uuid, uuid, boolean\\)',
  'claim_email_candidate\\(uuid, uuid\\)',
  'finish_email_candidate_claim\\(uuid, uuid, boolean\\)',
]) {
  assert.match(migration, new RegExp(`revoke all on function public\\.${signature}[\\s\\S]*service_role`, 'i'));
  assert.match(migration, new RegExp(`grant execute on function public\\.${signature} to service_role`, 'i'));
}

assert.ok(
  push.indexOf('admin.rpc("claim_push_subscription"') < push.indexOf('webpush.sendNotification'),
  'Push deve reservar atomicamente antes do efeito externo',
);
assert.match(push, /finish_push_subscription_claim[\s\S]*p_delivered: true/i);
assert.match(push, /finish_push_subscription_claim[\s\S]*p_delivered: false/i);

assert.ok(
  email.indexOf('admin.rpc("claim_email_candidate"') < email.indexOf('fetch("https:\/\/api.resend.com\/emails"'),
  'E-mail deve reservar atomicamente antes do efeito externo',
);
assert.match(email, /"Idempotency-Key": `linguaflow-reengagement-\$\{claim\.delivery_key\}`/);
assert.match(email, /finish_email_candidate_claim[\s\S]*p_delivered: true/i);
assert.match(email, /finish_email_candidate_claim[\s\S]*p_delivered: false/i);

console.log('Contratos de idempotência adaptativa e claims de notificação passaram.');
