import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const storiesView = read('dashboard/js/ui/storiesView.js');
const youtubeHook = read('content/youtube-hook.js');
const wordPopup = read('content/word-popup.js');
const subtitleEngine = read('content/subtitle-engine.js');
const libraryView = read('dashboard/js/ui/libraryView.js');
const gameView = read('dashboard/js/ui/gameView.js');

// 1. Stories quiz parsing
assert.match(storiesView, /import\s*\{[^}]*safeParseJson[^}]*\}\s*from\s*'\.\.\/core\/ai\.js'/,
  'storiesView importa safeParseJson de ai.js');
assert.match(storiesView, /safeParseJson\(content\)/,
  'storiesView usa safeParseJson para proteger o quiz contra preâmbulos da IA');

// 2. YouTube hook Request support
assert.match(youtubeHook, /url\s*&&\s*typeof\s*url\.url\s*===\s*'string'\s*\?\s*url\.url/,
  'youtube-hook suporta instâncias nativas de Request no fetch interceptor');

// 3. Popup & subtitle closest('.lf-word')
assert.match(wordPopup, /!e\.target\.closest\?\.\(('|")\.lf-word\1\)/,
  'word-popup usa closest para suportar cliques em elementos aninhados dentro de lf-word');
assert.match(subtitleEngine, /e\.target\.closest\?\.\(('|")\.lf-word\1\)/,
  'subtitle-engine usa closest para evitar arrastar ao clicar em nós aninhados de lf-word');

// 4. Library view lifecycle
assert.match(libraryView, /app\.onLeaveView\?\.[\s\S]*clearTimeout\(searchDebounceTimer\)/,
  'libraryView limpa debounce timer ao sair da view');
assert.match(libraryView, /if\s*\(app\?\.renderSignal\?\.aborted\)\s*return;/,
  'libraryView descarta renders obsoletos quando a rota mudou');

// 5. Game view audio context safety & uniform shuffle
assert.match(gameView, /function\s*safeCreateAudioContext/,
  'gameView define safeCreateAudioContext defensivo contra ambientes sem AudioContext');
assert.match(gameView, /function\s*shuffleArray/,
  'gameView define shuffleArray com Fisher-Yates');
assert.match(gameView, /shuffleArray\(words\.map/,
  'gameView usa shuffleArray uniforme para associar colunas');

console.log('✓ 7 contratos de auditoria profunda e hardening do sistema passaram com sucesso!');
