import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'supabase/functions/deepseek-chat/index.ts'), 'utf8');
const dashboardAi = readFileSync(join(root, 'dashboard/js/core/ai.js'), 'utf8');
const popup = readFileSync(join(root, 'content/word-popup.js'), 'utf8');
const worker = readFileSync(join(root, 'background/service-worker.js'), 'utf8');
const popupContext = popup.slice(
  popup.indexOf('  async _explainContext('),
  popup.indexOf('  async _generateContext('),
);

assert.match(source, /https:\/\/api\.deepseek\.com\/chat\/completions/,
  'texto usa o endpoint oficial do DeepSeek');
assert.match(source, /model:\s*"deepseek-chat"/,
  'texto usa exclusivamente o modelo deepseek-chat');
assert.doesNotMatch(source, /openrouter|nemotron|OPENROUTER/i,
  'nenhum fallback, secret ou modelo alternativo permanece no proxy');
assert.doesNotMatch(source, /assess_pronunciation|audio_base64|MAX_AUDIO_BASE64|consent/i,
  'proxy de IA não possui rota nem payload de gravação');
assert.doesNotMatch(dashboardAi, /assessPronunciationAudio|audio_base64|MediaRecorder|getUserMedia/,
  'cliente de IA não captura, prepara ou envia gravações');
assert.match(source, /"Cache-Control":\s*"private, no-store"/,
  'respostas pessoais de IA não podem entrar em cache compartilhado');
assert.match(source, /admin\.auth\.getUser\(token\)[\s\S]*consumeQuota\(admin, userId/,
  'cada chamada resolve o usuário autenticado antes de consumir sua cota');
assert.match(popup, /Sessão expirada na extensão\. Abra o Dashboard do LinguaFlow e entre novamente\./,
  'popup distingue sessão expirada de indisponibilidade da IA');
assert.doesNotMatch(worker, /pronunciation_pt|ai_phonetic_pt|transliteração PT-BR/,
  'worker não gera nem devolve pronúncia abrasileirada');
assert.doesNotMatch(popup, /pronunciation_pt|_convertIPAtoPT|fprpt/,
  'popup não carrega, gera ou renderiza pronúncia abrasileirada');
assert.match(popupContext, /await db\._readSession\(\)/,
  'popup verifica presença da sessão no armazenamento local sem uma ida extra ao worker');
assert.doesNotMatch(popupContext, /db\.checkSession\(\)/,
  'popup não duplica resolução e possível refresh da sessão antes da chamada de IA');
assert.match(popupContext, /const sentenceTranslationPromise = this\._translate\(sentence\)[\s\S]*const responsePromise = new Promise/,
  'tradução auxiliar e IA começam em paralelo');
assert.match(popupContext, /Promise\.all\(\[phrasalPromise, responsePromise\]\)/,
  'IA espera somente o recurso local necessário para montar a resposta');
assert.match(popupContext, /const sentenceTranslation = await sentenceTranslationPromise[\s\S]*Falha ao obter professor IA/,
  'tradução auxiliar só bloqueia o fallback quando a IA falha');
const popupDisplayIndex = popup.indexOf('this.popup.style.display = \'block\';');
const earlyContextIndex = popup.indexOf('this._explainContext(this.word, this.context);', popupDisplayIndex);
const dictionaryIndex = popup.indexOf('this._loadData(this.word);', popupDisplayIndex);
assert.ok(earlyContextIndex > popupDisplayIndex && earlyContextIndex < dictionaryIndex,
  'análise contextual começa depois de exibir o popup e antes da carga do dicionário');
assert.doesNotMatch(source, /\.(?:from|insert|upsert)\(/,
  'proxy não persiste prompts ou respostas em armazenamento compartilhado');

console.log('10 contratos de roteamento DeepSeek-only passaram — tudo verde ✅');
