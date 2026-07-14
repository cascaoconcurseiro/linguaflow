import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'lf-video-'));
copyFileSync(join(root, 'dashboard/js/core/videoContext.js'), join(tmp, 'videoContext.mjs'));
const { getVideoContext } = await import(pathToFileURL(join(tmp, 'videoContext.mjs')).href);

const legacy = getVideoContext('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m2s');
assert.equal(legacy.start, 62, 'URL legada mantém o timestamp');
assert.equal(legacy.end, null, 'URL legada não inventa fim');

const clip = getVideoContext('https://youtu.be/dQw4w9WgXcQ?t=2', { startMs: 1250, endMs: 3875 });
assert.equal(clip.start, 1.25, 'metadado canônico supera URL');
assert.equal(clip.end, 3.875, 'fim válido é preservado');
assert.equal(new URL(clip.externalUrl).searchParams.get('t'), '1s', 'link externo abre no início canônico da frase');

const postgrestClip = getVideoContext('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=99s', {
  video_start_ms: '10250',
  video_end_ms: 13400,
});
assert.equal(postgrestClip.start, 10.25, 'campos snake_case retornados pelo PostgREST são reconhecidos');
assert.equal(postgrestClip.end, 13.4, 'fim snake_case mantém o trecho exato da legenda');
assert.equal(new URL(postgrestClip.externalUrl).searchParams.get('t'), '10s', 'timestamp do clique não supera o início salvo');

const invalidEnd = getVideoContext('https://youtu.be/dQw4w9WgXcQ', { startMs: 5000, endMs: 3000 });
assert.equal(invalidEnd.end, null, 'fim antes do início é descartado');
assert.equal(getVideoContext('javascript:alert(1)'), null, 'URL perigosa não vira player');

console.log('10 verificações de contexto de vídeo passaram — tudo verde ✅');
