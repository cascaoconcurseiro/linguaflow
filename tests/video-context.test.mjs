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

const invalidEnd = getVideoContext('https://youtu.be/dQw4w9WgXcQ', { startMs: 5000, endMs: 3000 });
assert.equal(invalidEnd.end, null, 'fim antes do início é descartado');
assert.equal(getVideoContext('javascript:alert(1)'), null, 'URL perigosa não vira player');

console.log('4 testes de contexto de vídeo passaram — tudo verde ✅');
