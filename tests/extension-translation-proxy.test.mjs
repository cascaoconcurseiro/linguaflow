import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { shouldProxyTranslationThroughExtension } from '../utils/translator.js';

const runtime = { id: 'extension-id', sendMessage() {} };
assert.equal(shouldProxyTranslationThroughExtension({ protocol: 'https:' }, runtime), true);
assert.equal(shouldProxyTranslationThroughExtension({ protocol: 'http:' }, runtime), true);
assert.equal(shouldProxyTranslationThroughExtension({ protocol: 'chrome-extension:' }, runtime), false,
  'service worker e páginas da extensão devem usar fetch com host_permissions, sem recursão');
assert.equal(shouldProxyTranslationThroughExtension({ protocol: 'https:' }, null), false,
  'PWA sem chrome.runtime deve continuar usando o transporte web');
assert.equal(shouldProxyTranslationThroughExtension({ protocol: 'https:', hostname: 'linguaflow.vercel.app' }, runtime), false,
  'Dashboard no Vercel deve usar transporte web direto para não falhar por falta de autorização externa');
assert.equal(shouldProxyTranslationThroughExtension({ protocol: 'http:', hostname: 'localhost' }, runtime), false,
  'Dashboard no localhost deve usar transporte web direto');

const [translatorSource, workerSource] = await Promise.all([
  readFile(new URL('../utils/translator.js', import.meta.url), 'utf8'),
  readFile(new URL('../background/service-worker.js', import.meta.url), 'utf8'),
]);
assert.ok(
  translatorSource.indexOf('if (shouldProxyTranslationThroughExtension())')
    < translatorSource.indexOf('this._fetchGoogleTranslate(text, fromLang, toLang)'),
  'content script deve usar o proxy antes de tentar fetch sujeito ao CORS da página',
);
assert.match(translatorSource, /chrome\.runtime\.sendMessage\(\{[\s\S]*action: 'translate'/);
assert.match(translatorSource, /source: 'extension_proxy_error'/,
  'falha do proxy não deve cair no fetch direto bloqueado por CORS');
assert.match(workerSource, /if \(request\.action === 'translate'\)[\s\S]*sender\?\.id !== chrome\.runtime\.id/);
assert.match(workerSource, /text\.length > 5000/);

console.log('Tradução da extensão usa o service worker e evita CORS da página.');
