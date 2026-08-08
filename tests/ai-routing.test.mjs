import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'supabase/functions/deepseek-chat/index.ts'), 'utf8');

// Professor textual: DeepSeek must be the only provider.
assert.match(source, /const PRIMARY_MODEL = "deepseek-v4-flash"/,
  'Professor usa DeepSeek V4 Flash como modelo explícito');
assert.match(source, /fetch\("https:\/\/api\.deepseek\.com\/chat\/completions"/,
  'Professor envia a rota textual diretamente para a DeepSeek');
assert.match(source, /const DEEPSEEK_API_KEY = Deno\.env\.get\("DEEPSEEK_API_KEY"\)/,
  'Professor usa somente a chave DeepSeek do servidor');
assert.doesNotMatch(source, /preferEconomy/,
  'Professor não possui roteamento econômico para outro provedor');
assert.doesNotMatch(source, /if \(preferEconomy && OPENROUTER_API_KEY\)/,
  'Professor não prioriza OpenRouter');
assert.doesNotMatch(source, /fallbackModel/,
  'Professor não possui modelo textual de fallback');
assert.doesNotMatch(source, /callProvider\(/,
  'Professor não usa um dispatcher genérico entre provedores');

// OpenRouter is allowed only on the explicitly separated pronunciation route.
assert.match(source, /body\.action === "assess_pronunciation"/,
  'avaliação de voz usa uma rota explícita');
assert.match(source, /body\.consent !== true/,
  'servidor também exige consentimento para áudio');
assert.match(source, /audio\.length > MAX_AUDIO_BASE64/,
  'servidor limita o tamanho da gravação');
assert.match(source, /const MAX_AUDIO_ATTEMPTS = 2/,
  'áudio possui uma repetição curta para falhas transitórias');
assert.match(source, /attempt <= MAX_AUDIO_ATTEMPTS/,
  'falha transitória do modelo de áudio aciona nova tentativa limitada');
assert.match(source, /OPENROUTER_AUDIO_MODELS/,
  'modelos de áudio podem ser ampliados por secret sem novo deploy');
assert.match(source, /available: false,[\s\S]*fallback: "playback"[\s\S]*status: 200/,
  'indisponibilidade do provedor de áudio não vira erro HTTP no treino de fala');

console.log('13 contratos de roteamento de IA passaram — tudo verde ✅');
