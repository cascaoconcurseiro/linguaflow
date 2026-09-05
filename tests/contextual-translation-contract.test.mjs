import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const popup = read('content/word-popup.js');
const worker = read('background/service-worker.js');
const webReader = read('content/web-reader.js');
const reader = read('dashboard/js/ui/readerView.js');
const stories = read('dashboard/js/ui/storiesView.js');
const study = read('dashboard/js/ui/studyView.js');

assert.match(worker, /"translation": "tradução curta da palavra\/expressão NESTA frase"/,
  'a IA rápida separa a tradução contextual curta da explicação didática');
assert.match(worker, /sendResponse\(\{\s*explanation: result\?\.explanation[\s\S]*?translation: result\?\.translation/,
  'o contrato da extensão devolve a tradução contextual estruturada');
assert.match(worker, /const processedVersions = new Set\(\)[\s\S]*?while \(true\)[\s\S]*?processedVersions\.add/,
  'uma versão contextual enfileirada durante a sincronização é drenada no mesmo ciclo');

assert.match(popup, /contextSession\.translation = contextualTranslation/,
  'o popup mantém a tradução contextual vinculada à sessão correta');
assert.match(popup, /if \(response\?\.translation \|\| response\?\.pronunciation_pt \|\| response\?\.explanation\)/,
  'uma tradução contextual válida não depende de a IA também preencher a explicação');
assert.match(popup, /translation = contextSession\?\.translation \|\| d\.translation \|\| ''/,
  'o primeiro payload prioriza o sentido contextual');
assert.match(popup, /translation: contextSession\.translation \|\| currentPayload\.translation \|\| ''/,
  'a resposta tardia substitui a tradução isolada na fila persistida');
assert.match(popup, /_maybeShowFirstRecall\(contextSession, translation\)/,
  'a primeira recuperação usa o significado contextual quando ele já existe');
assert.match(popup, /catch \(e\) \{[\s\S]*?contextSession\.contextResolved = true;[\s\S]*?_maybeShowFirstRecall/,
  'falha excepcional libera a recuperação com o fallback isolado');

assert.match(webReader, /action: 'ai_quick_context',[\s\S]*sentence: contextAtStart/,
  'o Web Reader solicita o sentido da palavra dentro da frase capturada');

assert.match(reader, /import \{ enrichCard \} from '\.\.\/core\/ai\.js'/,
  'o Leitor do dashboard usa o mesmo enriquecimento contextual do Estudo');
assert.match(reader, /enrichCard\(wordAtRequest, contextAtRequest\)/,
  'o popup do Leitor resolve a palavra dentro da frase antes de salvar');

assert.match(stories, /import \{ generateStoryWeb, aiChat, enrichCard \}/,
  'Histórias compartilha o resolvedor contextual do dashboard');
assert.match(stories, /enrichCard\(cleanWord, currentSelectedSentence\)/,
  'a palavra selecionada na história é traduzida dentro da frase atual');

assert.match(study, /wordData\.translation = data\.word_pt/,
  'o Estudo promove o sentido contextual para a tradução canônica de cards antigos');
assert.match(study, /wordEntry\?\.pt[\s\S]*?lfDb\.updateWord\(wordData\.id, \{ translation: wordEntry\.pt \}\)/,
  'chunks contextuais já existentes também reparam a tradução canônica antiga');

console.log('15 contratos de tradução contextual passaram ✅');
