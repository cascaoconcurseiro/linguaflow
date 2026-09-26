import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Segurança e Resiliência: Eliminação completa do proxy de terceiros allorigins.win', async (t) => {
  const [ttsSrc, translatorSrc, dashboardHtml, vercelJson, manifestJson] = await Promise.all([
    readFile(new URL('../utils/tts.js', import.meta.url), 'utf8'),
    readFile(new URL('../utils/translator.js', import.meta.url), 'utf8'),
    readFile(new URL('../dashboard/dashboard.html', import.meta.url), 'utf8'),
    readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
    readFile(new URL('../manifest.json', import.meta.url), 'utf8'),
  ]);

  await t.test('utils/tts.js não utiliza api.allorigins.win', () => {
    assert.doesNotMatch(ttsSrc, /api\.allorigins\.win/);
  });

  await t.test('utils/translator.js não utiliza api.allorigins.win', () => {
    assert.doesNotMatch(translatorSrc, /api\.allorigins\.win/);
  });

  await t.test('dashboard.html CSP não expõe api.allorigins.win', () => {
    assert.doesNotMatch(dashboardHtml, /api\.allorigins\.win/);
  });

  await t.test('vercel.json CSP não expõe api.allorigins.win', () => {
    assert.doesNotMatch(vercelJson, /api\.allorigins\.win/);
  });

  await t.test('manifest.json não concede permissão nem CSP a api.allorigins.win', () => {
    assert.doesNotMatch(manifestJson, /api\.allorigins\.win/);
  });
});

test('Performance de Mídia no YouTube: throttling no MutationObserver de legendas', async (t) => {
  const engineSrc = await readFile(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8');

  await t.test('subtitle-engine usa debounce/throttle ou requestAnimationFrame para _syncYouTubeNativeCaptions', () => {
    assert.match(engineSrc, /requestAnimationFrame[\s\S]*?_syncYouTubeNativeCaptions/);
  });
});

test('Otimização de Expressões Léxicas: constante pré-calculada MAX_EXPRESSION_WORDS', async (t) => {
  const [exprDbMod, engineSrc] = await Promise.all([
    import('../utils/expressions-db.js'),
    readFile(new URL('../content/subtitle-engine.js', import.meta.url), 'utf8'),
  ]);

  await t.test('utils/expressions-db.js exporta MAX_EXPRESSION_WORDS como número positivo', () => {
    assert.equal(typeof exprDbMod.MAX_EXPRESSION_WORDS, 'number');
    assert.equal(exprDbMod.MAX_EXPRESSION_WORDS >= 3, true);
  });

  await t.test('subtitle-engine.js importa e utiliza MAX_EXPRESSION_WORDS sem recálculo dinâmico', () => {
    assert.match(engineSrc, /MAX_EXPRESSION_WORDS/);
    assert.doesNotMatch(engineSrc, /\.\.\.Array\.from\(expressionsDB/);
  });
});

test('Limpeza de Dead DOM em studyView.js e exports mortos em ai.js', async (t) => {
  const [studyViewSrc, aiMod] = await Promise.all([
    readFile(new URL('../dashboard/js/ui/studyView.js', import.meta.url), 'utf8'),
    import('../dashboard/js/core/ai.js'),
  ]);

  await t.test('studyView.js não referencia seletores mortos de chunks e notas', () => {
    assert.doesNotMatch(studyViewSrc, /chunks-container/);
    assert.doesNotMatch(studyViewSrc, /study-context-meaning/);
    assert.doesNotMatch(studyViewSrc, /study-usage-note/);
    assert.doesNotMatch(studyViewSrc, /iso-mnemonic-btn/);
    assert.doesNotMatch(studyViewSrc, /iso-mnemonic-text/);
  });

  await t.test('dashboard/js/core/ai.js não exporta personas órfãs de gramática', () => {
    assert.equal('grammarTutorPersona' in aiMod, false);
    assert.equal('grammarInitialQuestion' in aiMod, false);
  });
});
