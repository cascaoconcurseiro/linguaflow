// Código-fonte do popup de palavra para testes que verificam o texto do código.
//
// O popup foi dividido em módulos por assunto (content/word-popup/*.js). Os testes de contrato continuam
// valendo para o popup como um todo, então leem o arquivo principal e os módulos juntos.
import { readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const root = new URL('../../content/', import.meta.url);
const partsDir = new URL('word-popup/', root);

const partFiles = () => readdirSync(partsDir).filter((f) => f.endsWith('.js')).sort();

export async function readPopupSource() {
  const parts = await Promise.all(partFiles().map((f) => readFile(new URL(f, partsDir), 'utf8')));
  return [await readFile(new URL('word-popup.js', root), 'utf8'), ...parts].join('\n');
}

export function readPopupSourceSync() {
  const parts = partFiles().map((f) => readFileSync(new URL(f, partsDir), 'utf8'));
  return [readFileSync(new URL('word-popup.js', root), 'utf8'), ...parts].join('\n');
}
