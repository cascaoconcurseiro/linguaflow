// Código-fonte do banco (utils/db.js) para testes que verificam o texto do código.
//
// O banco foi dividido em módulos por assunto (utils/db/*.js: admin, words, cards, srs, study, account, learning
// e as constantes). Os testes de contrato continuam valendo para o banco como um todo, então leem o arquivo
// principal e os módulos juntos. Os repositórios (reader-stories, gamification, courses, stats) já eram arquivos
// próprios e ficam fora daqui; quem precisa deles os lê à parte.
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

export const DB_FILES = [
  'utils/db.js',
  'utils/db/shared.js',
  'utils/db/srs-constants.js',
  'utils/db/admin.js',
  'utils/db/words.js',
  'utils/db/cards.js',
  'utils/db/srs.js',
  'utils/db/study.js',
  'utils/db/account.js',
  'utils/db/learning.js',
];

const url = (file) => new URL(`../../${file}`, import.meta.url);

export async function readDbSource() {
  return (await Promise.all(DB_FILES.map((file) => readFile(url(file), 'utf8')))).join('\n');
}

export function readDbSourceSync() {
  return DB_FILES.map((file) => readFileSync(url(file), 'utf8')).join('\n');
}
