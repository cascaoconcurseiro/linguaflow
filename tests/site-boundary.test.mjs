import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isLinguaFlowHost, isLinguaFlowPage, isLinguaFlowUrl } from '../utils/site-boundary.js';

assert.equal(isLinguaFlowHost('linguaflow-web-tau.vercel.app'), true);
assert.equal(isLinguaFlowHost('LINGUAFLOW.VERCEL.APP'), true);
assert.equal(isLinguaFlowHost('linguaflow-abc-wesleys-projects.vercel.app'), true);
assert.equal(isLinguaFlowHost('example.vercel.app'), false);
assert.equal(isLinguaFlowHost('evil-linguaflow-web-tau.vercel.app'), false);
assert.equal(isLinguaFlowUrl('https://linguaflow-web-tau.vercel.app/study'), true);
assert.equal(isLinguaFlowUrl('not a url'), false);

const appDocument = {
  title: 'LinguaFlow V2',
  querySelector(selector) {
    return selector === '#app-root' || selector.includes('js/core/app.js') ? {} : null;
  },
};
assert.equal(isLinguaFlowPage({ hostname: 'localhost' }, appDocument), true);
assert.equal(isLinguaFlowPage({ hostname: 'localhost' }, { ...appDocument, title: 'Outro app' }), false);

const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
const readerRegistration = manifest.content_scripts.find((entry) => entry.js?.includes('content/web-reader.js'));
assert.ok(readerRegistration.exclude_matches.includes('*://linguaflow-web-tau.vercel.app/*'));
assert.ok(readerRegistration.exclude_matches.includes('*://linguaflow.vercel.app/*'));

const readerSource = await readFile(new URL('../content/web-reader.js', import.meta.url), 'utf8');
assert.match(readerSource, /isLinguaFlowPage\(window\.location, document\)/);
assert.match(readerSource, /window\.addEventListener\('pagehide', dispose/);

console.log('14 testes de isolamento de domínio passaram — tudo verde ✅');
