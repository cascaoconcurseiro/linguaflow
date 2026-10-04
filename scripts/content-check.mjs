// Verificador editorial dos cursos (Issue #428): valida TODOS os lotes de conteúdo sem escrever nada
// e confere se o SQL gerado ainda é igual ao que foi publicado em supabase/migrations/.
//
//   node scripts/content-check.mjs            valida todos os lotes e compara com as migrations
//   node scripts/content-check.mjs <lote>     valida um lote e lista as palavras que faltam no léxico
//
// Quem edita conteúdo não precisa conhecer SQL: o erro diz qual unidade falhou e o que falta.
// A lista de "palavras fora do léxico" já vem no formato do LEXICON; só falta preencher classe,
// IPA e glosa (IPA precisa de revisão humana).

import { readdirSync, readFileSync } from 'node:fs';
import { generate, generateBatch } from './generate-course-seed.mjs';

const BATCH_DIR = new URL('../supabase/content/batches/', import.meta.url);
const MIGRATIONS_DIR = new URL('../supabase/migrations/', import.meta.url);

export function batchNames() {
  return readdirSync(BATCH_DIR).filter((f) => f.endsWith('.mjs')).map((f) => f.replace(/\.mjs$/, '')).sort();
}

export function missingWords(errors) {
  const found = new Set();
  for (const line of errors) {
    const match = line.match(/"([^"]+)" fora do léxico/);
    if (match) found.add(match[1].toLowerCase());
  }
  return [...found].sort();
}

export function lexiconStub(words) {
  return words.map((w) => `  ${/^[a-z]+$/.test(w) ? w : JSON.stringify(w)}: ['', '/…/', ''],`).join('\n');
}

function publishedSql(name) {
  const suffix = name === 'v1' ? '_course_content.sql' : `_course_content_${name.replace(/-/g, '_')}.sql`;
  const alt = `_course_content_${name}.sql`;
  const file = readdirSync(MIGRATIONS_DIR).find((f) => f.endsWith(suffix) || f.endsWith(alt));
  return file ? { file, sql: readFileSync(new URL(file, MIGRATIONS_DIR), 'utf8').replace(/\r\n/g, '\n') } : null;
}

export async function checkAll({ compare = true } = {}) {
  const results = [];
  for (const name of ['v1', ...batchNames()]) {
    const result = name === 'v1' ? await generate() : await generateBatch(name);
    const published = compare ? publishedSql(name) : null;
    results.push({
      name,
      errors: result.errors,
      migration: published?.file || null,
      drift: published ? published.sql.trim() !== result.sql.trim() : null,
    });
  }
  return results;
}

if (process.argv[1]?.endsWith('content-check.mjs')) {
  const [only] = process.argv.slice(2);
  if (only) {
    const result = await generateBatch(only);
    if (result.errors.length) {
      console.error(result.errors.join('\n'));
      const words = missingWords(result.errors);
      if (words.length) console.error(`\nPalavras fora do léxico (${words.length}). Acrescente ao LEXICON do lote:\n${lexiconStub(words)}`);
      process.exit(1);
    }
    console.log(`ok: lote ${only} válido`);
  } else {
    const results = await checkAll();
    let failed = 0;
    for (const r of results) {
      const status = r.errors.length ? `ERRO (${r.errors.length})` : r.drift ? 'ok, mas difere da migration publicada' : 'ok';
      console.log(`${r.name.padEnd(18)} ${status}`);
      if (r.errors.length) { failed++; console.error(r.errors.slice(0, 5).map((e) => `  - ${e}`).join('\n')); }
    }
    process.exit(failed ? 1 : 0);
  }
}
