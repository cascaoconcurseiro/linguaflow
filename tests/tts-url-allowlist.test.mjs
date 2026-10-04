import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { isAllowedTtsUrl } from '../background/tts-url.js';

test('aceita as URLs de TTS que a extensão e o dashboard usam hoje', () => {
  const text = encodeURIComponent('hello world, it’s nice');
  assert.equal(isAllowedTtsUrl(`https://translate.google.com/translate_tts?ie=UTF-8&q=${text}&tl=en&client=gtx`), true);
  assert.equal(isAllowedTtsUrl(`https://translate.google.com/translate_tts?ie=UTF-8&q=${text}&tl=en&client=dict-chrome-ex`), true);
});

test('recusa outros hosts, caminhos, protocolos, credenciais, portas e valores que não são URL', () => {
  const recusadas = [
    'https://evil.example/translate_tts?q=x',
    'https://translate.google.com.evil.example/translate_tts?q=x',
    'https://translate.google.com/other',
    'https://translate.google.com/translate_tts/extra',
    'http://translate.google.com/translate_tts?q=x',
    'https://user:pass@translate.google.com/translate_tts?q=x',
    'https://translate.google.com:8443/translate_tts?q=x',
    'https://qnutoswrufznztoznlql.supabase.co/rest/v1/words',
    'http://169.254.169.254/latest/meta-data/',
    'file:///etc/passwd',
    'javascript:alert(1)',
    '/translate_tts?q=x',
    '',
    undefined,
    null,
    {},
  ];
  for (const value of recusadas) assert.equal(isAllowedTtsUrl(value), false, String(value));
});

test('contrato: o service worker valida a URL antes de buscar o áudio', async () => {
  const code = await readFile(new URL('../background/service-worker.js', import.meta.url), 'utf8');
  assert.match(code, /request\.type === 'FETCH_TTS'\) \{[\s\S]*?if \(!isAllowedTtsUrl\(request\.url\)\)[\s\S]*?url_not_allowed[\s\S]*?fetch\(request\.url\)/);
});
