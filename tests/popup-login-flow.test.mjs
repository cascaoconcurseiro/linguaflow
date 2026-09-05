import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { WordPopup } from '../content/word-popup.js';
import { db } from '../utils/db.js';

let listener, click, resumed = 0, sent;
const status = { textContent: '' };
const button = { addEventListener: (_, handler) => { click = handler; } };
const el = { style: {}, setAttribute() {}, querySelector: selector => selector === 'button' ? button : status };
db._readSession = async () => null;
globalThis.chrome = {
    storage: { onChanged: { addListener: fn => { listener = fn; }, removeListener: () => { listener = null; } } },
    runtime: { sendMessage: async message => { sent = message.type; return { ok: true }; } },
};
const popup = new WordPopup();
Object.assign(popup, { _q: () => el, _contextSession: {}, popup: { style: {} } });
await popup._explainContext('apple', 'An apple.');
assert.match(el.innerHTML, /Entrar para usar a IA/);
await click();
assert.equal(sent, 'OPEN_EXTENSION_LOGIN');
assert.match(status.textContent, /Depois de entrar/);
popup._explainContext = async (word, sentence) => {
  assert.equal(word, 'apple'); assert.equal(sentence, 'An apple.'); resumed += 1;
};
await listener({ unrelated: { newValue: 'x' } }, 'local');
assert.equal(resumed, 0);
await listener({ lf_supabase_session: { newValue: 'session' } }, 'local');
assert.equal(resumed, 1);
assert.equal(listener, null);
popup._showContextLogin('apple', 'An apple.', true);
assert.match(el.innerHTML, /Entrar novamente/);
popup._contextSession = {};
await listener({ lf_supabase_session: { newValue: 'session' } }, 'local');
assert.equal(resumed, 1, 'não retoma palavra antiga');
assert.equal(listener, null);
popup._showContextLogin('apple', 'An apple.');
popup._clearLoginWait();
assert.equal(listener, null, 'remove observador ao cancelar');
console.log('Login do popup: bloqueio sem sessão, botão, retomada única e cancelamento passaram.');

const worker = readFileSync(new URL('../background/service-worker.js', import.meta.url), 'utf8');
const branch = worker.slice(worker.indexOf("  if (request.type === 'OPEN_EXTENSION_LOGIN')"), worker.indexOf("  if (request.type === 'OPEN_DASHBOARD')"));
for (const existing of [false, true]) {
  let created = 0, focused = 0;
  const url = 'chrome-extension://test/popup/popup.html?login=1';
  let resolve;
  const response = new Promise(done => { resolve = done; });
  vm.runInNewContext(`(function(request, sendResponse) { ${branch} })({type: 'OPEN_EXTENSION_LOGIN'}, sendResponse)`, {
    sendResponse: resolve,
    chrome: {
      runtime: { getURL: path => { assert.equal(path, 'popup/popup.html?login=1'); return url; } },
      tabs: {
        query: async () => existing ? [{ id: 7, windowId: 9, url }] : [],
        update: async id => { assert.equal(id, 7); focused += 1; },
        create: async tab => { assert.equal(tab.url, url); created += 1; },
      },
      windows: { update: async id => assert.equal(id, 9) },
    },
  });
  assert.equal((await response).ok, true);
  assert.equal(created, existing ? 0 : 1);
  assert.equal(focused, existing ? 1 : 0);
}
console.log('Login abre somente a página da extensão e reutiliza a guia existente.');
