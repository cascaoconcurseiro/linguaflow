import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { db } from '../utils/db.js';
import {
  installYouglishReadyHandler,
  renderStudyChunkCard,
} from '../dashboard/js/core/studySafety.js';

// Auth: uma renovação de token sem resposta precisa ser abortada e liberar o
// bootstrap, preservando a sessão local em vez de deslogar por falha de rede.
const originalFetch = globalThis.fetch;
const originalTimeout = AbortSignal.timeout;
const originalReadSession = db._readSession;
let receivedSignal = null;
try {
  db._readSession = async () => ({
    access_token: 'still-usable-token',
    refresh_token: 'refresh-token',
    expires_at: Date.now() - 1,
  });
  AbortSignal.timeout = () => {
    const controller = new AbortController();
    queueMicrotask(() => controller.abort(new DOMException('timeout', 'TimeoutError')));
    return controller.signal;
  };
  globalThis.fetch = (_url, options) => {
    receivedSignal = options.signal;
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    });
  };

  const started = Date.now();
  assert.equal(await db.checkSession(), true);
  assert.ok(receivedSignal?.aborted, 'refresh usa um AbortSignal que realmente encerra a espera');
  assert.ok(Date.now() - started < 250, 'checkSession libera o bootstrap após o timeout');
} finally {
  db._readSession = originalReadSession;
  AbortSignal.timeout = originalTimeout;
  globalThis.fetch = originalFetch;
}

// YouGlish: sair durante o carregamento apaga o callback; reentrar precisa
// reinstalá-lo e usar a palavra mais recente, mesmo reaproveitando o script.
const youglishWindow = {};
let queuedWord = 'first';
const fetched = [];
installYouglishReadyHandler(youglishWindow, () => queuedWord, word => fetched.push(word));
delete youglishWindow.onYouglishAPIReady;
queuedWord = 'second';
const rebound = installYouglishReadyHandler(youglishWindow, () => queuedWord, word => fetched.push(word));
assert.equal(typeof rebound, 'function');
rebound();
assert.deepEqual(fetched, ['second']);

// Chunks: conteúdo vindo de IA/banco é tratado como texto tanto no corpo
// quanto nos atributos usados pelos botões de áudio.
const malicious = '"><img src=x onerror="globalThis.pwned=1">&';
const chunkHtml = renderStudyChunkCard({
  eng: malicious,
  phon: '<svg onload=alert(1)>',
  pt: "' autofocus onfocus=alert(1)",
}, 0);
assert.doesNotMatch(chunkHtml, /<img|<svg/i);
assert.doesNotMatch(chunkHtml, /data-text=""><img/i);
assert.match(chunkHtml, /&quot;&gt;&lt;img/);
assert.match(chunkHtml, /&lt;svg onload=alert\(1\)&gt;/);
assert.match(chunkHtml, /&#039; autofocus onfocus=alert\(1\)/);

// Service worker: executa os handlers reais num ambiente mínimo. A troca de
// versão assume controle sem reload e navegação offline recupera o app shell.
const swSource = await readFile(new URL('../dashboard/sw.js', import.meta.url), 'utf8');
const handlers = new Map();
const cacheEntries = new Map();
let claimed = 0;
let skipped = 0;
const cache = {
  add: async (url) => cacheEntries.set(url, new Response(`cached:${url}`)),
  put: async (request, response) => cacheEntries.set(typeof request === 'string' ? request : request.url, response),
};
const caches = {
  open: async () => cache,
  keys: async () => ['linguaflow-old'],
  delete: async () => true,
  match: async (request) => cacheEntries.get(typeof request === 'string' ? request : request.url),
};
const self = {
  location: { origin: 'https://linguaflow.test' },
  addEventListener: (type, listener) => handlers.set(type, listener),
  skipWaiting: async () => { skipped += 1; },
  clients: {
    claim: async () => { claimed += 1; },
    matchAll: async () => [],
    openWindow: async () => {},
  },
  registration: { showNotification: async () => {} },
};
vm.runInNewContext(swSource, {
  self,
  caches,
  URL,
  Promise,
  fetch: async () => { throw new TypeError('offline'); },
});

let lifecyclePromise;
handlers.get('install')({ waitUntil: promise => { lifecyclePromise = promise; } });
await lifecyclePromise;
handlers.get('activate')({ waitUntil: promise => { lifecyclePromise = promise; } });
await lifecyclePromise;
assert.equal(skipped, 1);
assert.equal(claimed, 1);

let responsePromise;
handlers.get('fetch')({
  request: {
    method: 'GET',
    url: 'https://linguaflow.test/study',
    mode: 'navigate',
    destination: 'document',
  },
  respondWith: promise => { responsePromise = promise; },
});
assert.equal(await (await responsePromise).text(), 'cached:/');

console.log('Comportamentos P0 de auth, service worker, YouGlish e chunks passaram.');

