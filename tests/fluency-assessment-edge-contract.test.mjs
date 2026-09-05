import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const source = readFileSync(
  join(root, 'supabase', 'functions', 'fluency-assessment', 'index.ts'),
  'utf8',
);
const config = readFileSync(join(root, 'supabase', 'config.toml'), 'utf8');

assert.match(source, /MAX_BODY_BYTES/);
assert.match(source, /readJsonBody\(req,\s*MAX_BODY_BYTES\)/);
assert.match(source, /admin\.auth\.getUser\(token\)/);
assert.match(source, /admin\.rpc\("consume_api_quota"/);
assert.match(source, /p_endpoint:\s*ENDPOINT/);
assert.match(source, /get_fluency_submission_for_assessment/);
assert.match(source, /payload\.user_id\s*!==\s*user\.id/);
assert.match(source, /commit_fluency_assessment/);
assert.match(source, /AbortSignal\.(?:any|timeout)/);
assert.match(source, /response_format:\s*\{\s*type:\s*"json_object"/);
assert.match(source, /taskCompletion\s*>=\s*2/);
assert.match(source, /criticalScores\.some\(\(score\)\s*=>\s*score\s*===\s*0\)/);
assert.match(source, /median\(numericScores\)\s*>=\s*2/);
assert.match(source, /observed_level:\s*meetsLevel\s*\?\s*payload\.target_level\s*:\s*null/);
assert.match(source, /action === "human_evaluate"/);
assert.match(source, /app_metadata/);
assert.match(source, /fluency_assessor/);
assert.match(source, /p_authority:\s*"human"/);
assert.match(source, /p_authority:\s*"server"/);
assert.match(source, /status\s*===\s*"evaluated"/);
assert.match(source, /provider_unavailable/);
assert.match(source, /https:\/\/api\.deepseek\.com\/chat\/completions/);
assert.match(source, /model:\s*"deepseek-chat"/);
assert.match(source, /"Cache-Control":\s*"private, no-store"/);
assert.doesNotMatch(source, /audio_base64|transient_evidence|audio_assessment|MAX_AUDIO_BASE64|AUDIO_FORMATS/);
assert.doesNotMatch(source, /openrouter|nemotron|OPENROUTER/i);
assert.doesNotMatch(source, /mark.*failed|status:\s*"failed"/i);
assert.doesNotMatch(source, /answer_key[\s\S]{0,300}JSON\.stringify\(\{[\s\S]{0,100}answer_key/i);
assert.doesNotMatch(source, /error:\s*\(error as Error\)\.message/);
for (const line of source.split(/\r?\n/).filter((value) => /console\.(?:log|error)/.test(value))) {
  assert.doesNotMatch(line, /(?:response|answer_key|material)/i);
}
assert.match(source, /method_not_allowed/);
assert.match(config, /\[functions\.fluency-assessment\][\s\S]*verify_jwt\s*=\s*true/);

console.log('Contrato da Edge Function de avaliação autoritativa passou.');
