import assert from 'node:assert/strict';
import { renderHome } from '../dashboard/js/ui/homeView.js';

globalThis.document = { getElementById: id => id === 'gamified-home-styles' ? {} : null };
const record = JSON.stringify({ version: 1, completed: true, level: 'beginner', dailyGoal: 40 });
for (const setting of [null, '{broken', record, record.replace('true', 'false'), new Error('offline')]) {
    const container = { innerHTML: '', setAttribute() {}, removeAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
    const db = {
        async getStats() { return { totalWords: 0, dueCards: 0, sessions: [], byStatus: {} }; },
        async getSetting(key) { if (key !== 'onboarding_v1') return null; if (setting instanceof Error) throw setting; return setting; },
        async getAllWords() { return []; }, async getAllCards() { return []; },
        async getAllKnownWords() { return []; }, async getStories() { return []; },
    };
    await renderHome(container, { db });
    assert.match(container.innerHTML, /class="gamified-home"/, `entrada direta: ${setting}`);
    assert.doesNotMatch(container.innerHTML, /PASSO 1 DE 3|NaN|undefined/);
    assert.match(container.innerHTML, typeof setting === 'string' && setting.startsWith('{"version"') ? /Revisar 40 cartas/ : /Revisar 20 cartas/);
}

for (const phase of ['stats', 'details']) {
    const controller = new AbortController();
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const container = { innerHTML: '', setAttribute() {}, removeAttribute() {}, querySelector() { return null; } };
    const db = {
        async getStats() { if (phase === 'stats') await pending; return { totalWords: 0 }; },
        async getSetting() { return record; },
        async getAllWords() { if (phase === 'details') await pending; return []; },
        async getAllCards() { return []; }, async getAllKnownWords() { return []; }, async getStories() { return []; },
    };
    const rendering = renderHome(container, { db, renderSignal: controller.signal });
    await new Promise(resolve => setImmediate(resolve));
    controller.abort();
    container.innerHTML = 'Outra página';
    release();
    await rendering;
    assert.equal(container.innerHTML, 'Outra página', `resposta obsoleta durante ${phase}`);
}
console.log('✓ entrada direta, preferências opcionais e navegação durante carregamento');
