import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';

// Mirroring pure logic to verify unit contracts in Node
const WIN_EPOCH = 11644473600;
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';

const VOICE_MAP = {
  'en-US': 'en-US-JennyNeural',
  'en-GB': 'en-GB-SoniaNeural',
  'en': 'en-US-JennyNeural',
  'pt-BR': 'pt-BR-FranciscaNeural',
  'pt-PT': 'pt-PT-RaquelNeural',
  'pt': 'pt-BR-FranciscaNeural',
  'es-ES': 'es-ES-ElviraNeural',
  'es-MX': 'es-MX-DaliaNeural',
  'es': 'es-ES-ElviraNeural',
  'fr-FR': 'fr-FR-DeniseNeural',
  'fr': 'fr-FR-DeniseNeural',
  'de-DE': 'de-DE-KatjaNeural',
  'de': 'de-DE-KatjaNeural',
  'it-IT': 'it-IT-ElsaNeural',
  'it': 'it-IT-ElsaNeural',
  'ja-JP': 'ja-JP-NanamiNeural',
  'ja': 'ja-JP-NanamiNeural',
  'ko-KR': 'ko-KR-SunHiNeural',
  'ko': 'ko-KR-SunHiNeural',
  'zh-CN': 'zh-CN-XiaoxiaoNeural',
  'zh': 'zh-CN-XiaoxiaoNeural',
  'ru-RU': 'ru-RU-SvetlanaNeural',
  'ru': 'ru-RU-SvetlanaNeural',
};

function getVoiceForLang(lang) {
  if (!lang) return 'en-US-JennyNeural';
  return VOICE_MAP[lang] || VOICE_MAP[lang.split('-')[0]] || 'en-US-JennyNeural';
}

function escapeSsml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function generateSecMsGec() {
  let ticks = Math.floor(Date.now() / 1000);
  ticks += WIN_EPOCH;
  ticks -= ticks % 300;
  const ticksBig = BigInt(ticks) * 10000000n;
  const strToHash = ticksBig.toString() + TRUSTED_CLIENT_TOKEN;
  const msgUint8 = new TextEncoder().encode(strToHash);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function generateMuid() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

test('Edge TTS: Sec-MS-GEC e MUID possuem formato hexadecimal válido', async () => {
  const secMsGec = await generateSecMsGec();
  assert.equal(typeof secMsGec, 'string');
  assert.equal(secMsGec.length, 64, 'Sec-MS-GEC deve ser um hash SHA-256 em hex de 64 caracteres');
  assert.match(secMsGec, /^[0-9A-F]{64}$/, 'Sec-MS-GEC deve ser hex em maiúsculas');

  const muid = generateMuid();
  assert.equal(typeof muid, 'string');
  assert.equal(muid.length, 32, 'MUID deve ter 32 caracteres hexadecimais');
  assert.match(muid, /^[0-9A-F]{32}$/, 'MUID deve ser hex em maiúsculas');
});

test('Edge TTS: Mapeamento de vozes neurais cobre idiomas principais e fallback', () => {
  assert.equal(getVoiceForLang('en-US'), 'en-US-JennyNeural');
  assert.equal(getVoiceForLang('en-GB'), 'en-GB-SoniaNeural');
  assert.equal(getVoiceForLang('en'), 'en-US-JennyNeural');
  assert.equal(getVoiceForLang('pt-BR'), 'pt-BR-FranciscaNeural');
  assert.equal(getVoiceForLang('pt-PT'), 'pt-PT-RaquelNeural');
  assert.equal(getVoiceForLang('pt'), 'pt-BR-FranciscaNeural');
  assert.equal(getVoiceForLang('es-ES'), 'es-ES-ElviraNeural');
  assert.equal(getVoiceForLang('fr-FR'), 'fr-FR-DeniseNeural');
  assert.equal(getVoiceForLang('de-DE'), 'de-DE-KatjaNeural');
  assert.equal(getVoiceForLang('it-IT'), 'it-IT-ElsaNeural');
  assert.equal(getVoiceForLang('ja-JP'), 'ja-JP-NanamiNeural');
  assert.equal(getVoiceForLang('unknown-XX'), 'en-US-JennyNeural', 'Fallback seguro para idioma desconhecido');
  assert.equal(getVoiceForLang(null), 'en-US-JennyNeural', 'Fallback seguro para nulo');
});

test('Edge TTS: Escape de SSML protege caracteres especiais', () => {
  const raw = 'Tom & Jerry said: <Hello> "world" and \'welcome\'!';
  const escaped = escapeSsml(raw);
  assert.equal(
    escaped,
    'Tom &amp; Jerry said: &lt;Hello&gt; &quot;world&quot; and &apos;welcome&apos;!'
  );
  assert.doesNotMatch(escaped, /[<>"']/);
});

test('Edge TTS: Contrato arquitetural da Edge Function Supabase', () => {
  const fnIndex = readFileSync(join(process.cwd(), 'supabase/functions/tts/index.ts'), 'utf8');
  const fnModule = readFileSync(join(process.cwd(), 'supabase/functions/tts/edge_tts.ts'), 'utf8');

  assert.ok(fnIndex.includes('synthesizeEdgeTTS'), 'index.ts importa synthesizeEdgeTTS');
  assert.ok(fnIndex.includes('await synthesizeEdgeTTS(text, lang'), 'index.ts executa synthesizeEdgeTTS com timeout');
  assert.ok(fnIndex.includes('translate_tts'), 'index.ts possui fallback explícito para translate_tts');
  assert.ok(fnIndex.includes('X-TTS-Engine'), 'index.ts expõe cabeçalho de rastreabilidade X-TTS-Engine');
  assert.ok(fnModule.includes('speech.platform.bing.com'), 'edge_tts.ts aponta para o endpoint da Microsoft');
  assert.ok(fnModule.includes('TRUSTED_CLIENT_TOKEN'), 'edge_tts.ts possui token confiável');
  assert.ok(fnModule.includes('audio-24khz-48kbitrate-mono-mp3'), 'edge_tts.ts configura formato MP3 de alta qualidade');
});

test('Edge TTS: Contrato do cliente de áudio (dashboard/js/core/tts.js)', () => {
  const clientTts = readFileSync(join(process.cwd(), 'dashboard/js/core/tts.js'), 'utf8');
  assert.ok(clientTts.includes("kokoroEnabled() ? 'kk' : 'msn'"), 'Chave de cache usa prefixo msn (neural verificado) — ms| antigo pode conter Google');
  assert.ok(!clientTts.includes("? 'kk' : 'ms'"), 'Prefixo ms| contaminado não é mais lido');
  assert.ok(clientTts.includes("headers.get('x-tts-engine')"), 'Cliente lê o motor que respondeu');
  assert.ok(/engine === 'edge-tts'/.test(clientTts), 'Só persiste como neural quando o motor é edge-tts');
  assert.ok(clientTts.includes('await idbGet(`g|${lang}|${text}`)'), 'Preserva compatibilidade com cache legado offline');
  assert.ok(clientTts.includes('TTS_PROXY_URL'), 'Chama o proxy autenticado com fallback');
});

test('Edge TTS: runtime Deno — Buffer importado e motor exposto via CORS', () => {
  const fnIndex = readFileSync(join(process.cwd(), 'supabase/functions/tts/index.ts'), 'utf8');
  const fnModule = readFileSync(join(process.cwd(), 'supabase/functions/tts/edge_tts.ts'), 'utf8');
  // No Edge Runtime, Buffer não é global no código do usuário: sem import, cada
  // frame binário lança ReferenceError e a síntese cai em timeout -> Google.
  assert.match(fnModule, /import \{ Buffer \} from "node:buffer";/);
  assert.match(fnIndex, /"Access-Control-Expose-Headers": "X-TTS-Engine"/);
  assert.match(fnIndex, /console\.warn\("\[tts\] edge_tts_fallback"/, 'Fallback para Google é logado com evento estável');
});
