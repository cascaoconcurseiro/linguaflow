// Gera a migration de imagens das palavras a partir de supabase/content/images.mjs (#443).
// Uso: node scripts/generate-course-images.mjs <arquivo-de-saida.sql>
// Migrations publicadas são imutáveis: imagens novas vão num lote novo.

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { IMAGES, IMAGE_SOURCE } from '../supabase/content/images.mjs';

const q = (v) => `'${String(v).replace(/'/g, "''")}'`;

export function buildImagesSql() {
  const lines = [
    '-- Gerado por scripts/generate-course-images.mjs a partir de supabase/content/images.mjs. Não editar à mão.',
    `-- Ilustrações: ${IMAGE_SOURCE.credit}, ${IMAGE_SOURCE.license}. Só palavras que a imagem mostra sem ambiguidade.`,
    '',
  ];
  for (const [unitId, codepoints] of Object.entries(IMAGES)) {
    lines.push(`UPDATE public.course_units SET image_url = ${q(`${IMAGE_SOURCE.base}${codepoints}.svg`)}, `
      + `image_credit = ${q(IMAGE_SOURCE.credit)}, image_license = ${q(IMAGE_SOURCE.license)} `
      + `WHERE id = ${q(unitId)} AND kind = 'word';`);
  }
  return `${lines.join('\n')}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2];
  if (!out) {
    console.error('Uso: node scripts/generate-course-images.mjs <arquivo-de-saida.sql>');
    process.exit(1);
  }
  writeFileSync(out, buildImagesSql());
  console.log(`${Object.keys(IMAGES).length} imagens → ${out}`);
}
