import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readEngineSource } from './helpers/engine-source.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const bytes = (path) => readFile(new URL(`../${path}`, import.meta.url));

// Largura e altura vêm do cabeçalho IHDR do PNG (bytes 16–23), sem depender de biblioteca de imagem.
async function pngSize(path) {
  const buf = await bytes(path);
  assert.equal(buf.subarray(1, 4).toString(), 'PNG', `${path} não é PNG`);
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

test('ícones: todos os tamanhos existem com as dimensões certas (identidade nova, sem o papagaio)', async () => {
  const expected = {
    'icon16.png': 16, 'icon32.png': 32, 'icon48.png': 48, 'icon128.png': 128, 'icon_full.png': 256,
    'dashboard/icons/icon16.png': 16, 'dashboard/icons/icon48.png': 48, 'dashboard/icons/icon128.png': 128,
    'dashboard/icons/icon192.png': 192, 'dashboard/icons/icon512.png': 512,
  };
  for (const [path, size] of Object.entries(expected)) assert.deepEqual(await pngSize(path), [size, size], path);
  // O papagaio verde tinha ~65 KB (icon_full) e ~144 KB (icon512): a marca nova é vetorial simples e bem menor.
  assert.ok((await bytes('icon_full.png')).length < 20_000, 'icon_full.png ainda parece o logo antigo');
  assert.ok((await bytes('dashboard/icons/icon512.png')).length < 30_000, 'icon512.png ainda parece o logo antigo');
});

test('marca: SVG usa o azul e o papel do site; PWA e extensão usam as mesmas cores', async () => {
  const svg = await read('assets/logo.svg');
  assert.match(svg, /#2052c4/);
  assert.match(svg, /#fcfbf8/);
  const pwa = JSON.parse(await read('dashboard/manifest.webmanifest'));
  assert.equal(pwa.theme_color, '#2052c4');
  assert.equal(pwa.background_color, '#fcfbf8');
  assert.doesNotMatch(await read('dashboard/manifest.webmanifest'), /58cc02/i, 'verde da identidade antiga');
  assert.match(await read('dashboard/dashboard.html'), /<meta name="theme-color" content="#2052c4">/);
  const ext = JSON.parse(await read('manifest.json'));
  for (const size of ['16', '48', '128']) assert.equal(ext.icons[size], `icon${size}.png`);
  assert.equal(ext.action.default_icon['16'], 'icon16.png');
});

test('o foguinho de "streak mantido" na tela do vídeo não existe mais', async () => {
  const engine = await readEngineSource();
  assert.doesNotMatch(engine, /lf-streak-hud|streak mantido|_checkStreakNotification/);
});

test('popup: resumo do dia com números vivos, sem o listening parado', async () => {
  const html = await read('popup/popup.html');
  assert.match(html, /Revisões hoje/);
  assert.match(html, /Palavras salvas hoje/);
  assert.doesNotMatch(html, /Listening (hoje|total)/);
  assert.doesNotMatch(html, /Pressione <strong>O<\/strong> em um vídeo para capturar/, 'a tecla O abre as configurações, não captura frase');
  assert.match(html, /ligue o botão <strong>LF<\/strong>/);
  const js = await read('popup/popup.js');
  assert.match(js, /'—'/, 'quando a leitura falha o popup mostra traço, não zero inventado');
  const db = await read('utils/db.js');
  assert.match(db, /async getWordsSavedToday\(\)/);
  assert.match(await read('background/service-worker.js'), /'getWordsSavedToday'/);
});
