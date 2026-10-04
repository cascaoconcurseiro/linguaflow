// Issue #443 — imagem por palavra nos cursos de vocabulário.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { IMAGES, IMAGE_SOURCE } from '../supabase/content/images.mjs';
import { buildImagesSql } from '../scripts/generate-course-images.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const MIGRATIONS = 'supabase/migrations';
const migrationFiles = readdirSync(new URL(`../${MIGRATIONS}`, import.meta.url)).sort();
const SCHEMA = migrationFiles.find((f) => f.endsWith('_course_unit_images_schema.sql'));
const DATA = migrationFiles.find((f) => f.endsWith('_course_unit_images_1.sql'));

test('#443: cada imagem aponta para uma palavra publicada', () => {
  const published = new Map();
  const re = /\('(unit-[a-z0-9-]+)', '[^']+', \d+, '(\w+)'/g;
  for (const f of migrationFiles.filter((f) => f.includes('course_content'))) {
    for (const m of read(`${MIGRATIONS}/${f}`).matchAll(re)) published.set(m[1], m[2]);
  }
  for (const [id, cp] of Object.entries(IMAGES)) {
    assert.equal(published.get(id), 'word', `${id} precisa ser uma unidade 'word' publicada`);
    assert.match(cp, /^[0-9a-f]{4,5}(_[0-9a-f]{4,5})*$/, `${id}: code point inválido`);
  }
});

test('#443: fonte fixada, gratuita e com licença', () => {
  assert.match(IMAGE_SOURCE.base, /^https:\/\/cdn\.jsdelivr\.net\/gh\/googlefonts\/noto-emoji@v\d+\.\d+\/svg\/emoji_u$/);
  assert.equal(IMAGE_SOURCE.license, 'Apache-2.0');
});

test('#443: schema append-only com colunas opcionais e só https', () => {
  assert.ok(SCHEMA, 'migration de schema das imagens');
  const sql = read(`${MIGRATIONS}/${SCHEMA}`);
  for (const col of ['image_url', 'image_credit', 'image_license']) {
    assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS ${col} text`));
  }
  assert.match(sql, /image_url IS NULL OR image_url ~ '\^https:\/\/'/);
  assert.doesNotMatch(sql, /DROP (TABLE|COLUMN)|TRUNCATE|DELETE FROM/i);
});

test('#443: migration de dados é exatamente a saída do gerador', () => {
  assert.ok(DATA, 'migration de dados das imagens');
  assert.equal(read(`${MIGRATIONS}/${DATA}`), buildImagesSql());
  assert.equal((buildImagesSql().match(/^UPDATE /gm) || []).length, Object.keys(IMAGES).length);
  assert.match(buildImagesSql(), /AND kind = 'word';/);
});

test('#443: repositório pede as colunas e o player mostra a imagem com acessibilidade', () => {
  const repo = read('utils/db/courses-repo.js');
  assert.match(repo, /UNIT_FIELDS = '[^']*image_url,image_credit,image_license'/);
  const view = read('dashboard/js/ui/coursePracticeView.js');
  assert.match(view, /id="course-image"/);
  assert.match(view, /width="96" height="96"/, 'tamanho fixo evita layout shift');
  assert.match(view, /alt = `Ilustração: \$\{/);
  assert.match(view, /addEventListener\('error'/, 'imagem que falha some, sem ícone quebrado');
  assert.match(view, /course-image-credit/);
});
