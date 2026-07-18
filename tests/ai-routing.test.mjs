import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'supabase/functions/deepseek-chat/index.ts'), 'utf8');

assert.match(source, /const preferEconomy = payload\.max_tokens >= 1200 \|\| inputSize >= 12_000/,
  'pedidos caros possuem um limiar explícito e auditável');
assert.ok(source.indexOf('if (preferEconomy && OPENROUTER_API_KEY)') < source.indexOf('} else if (DEEPSEEK_API_KEY)'),
  'pedidos caros tentam OpenRouter antes do DeepSeek');
assert.match(source, /if \(\(!response \|\| !response\.ok\) && DEEPSEEK_API_KEY\)/,
  'DeepSeek assume quando o caminho econômico falha');
assert.match(source, /body\.action === "assess_pronunciation"/,
  'avaliação de voz usa uma rota explícita');
assert.match(source, /body\.consent !== true/,
  'servidor também exige consentimento para áudio');
assert.match(source, /audio\.length > MAX_AUDIO_BASE64/,
  'servidor limita o tamanho da gravação');
assert.match(source, /const MAX_AUDIO_ATTEMPTS = 2/,
  'áudio gratuito possui uma repetição curta para falhas transitórias');
assert.match(source, /attempt <= MAX_AUDIO_ATTEMPTS/,
  'falha transitória do modelo gratuito aciona nova tentativa limitada');

console.log('8 contratos de roteamento de IA passaram — tudo verde ✅');
