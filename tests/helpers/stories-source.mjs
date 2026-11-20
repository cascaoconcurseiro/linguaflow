// Código-fonte da tela Histórias (dashboard/js/ui/storiesView.js) para testes que verificam o texto do código.
//
// A tela foi dividida: o arquivo principal guarda a tela e os módulos autocontidos (formato do texto,
// tradução e geração) moraram em stories/*.js. Os testes de contrato valem para a tela como um todo,
// então leem o arquivo principal e os módulos juntos. Quiz, relatório e estilos já eram arquivos próprios.
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

export const STORIES_FILES = [
  'dashboard/js/ui/storiesView.js',
  'dashboard/js/ui/stories/storyFormat.js',
  'dashboard/js/ui/stories/storyTranslation.js',
  'dashboard/js/ui/stories/storyGeneration.js',
];

const url = (file) => new URL(`../../${file}`, import.meta.url);

export async function readStoriesSource() {
  return (await Promise.all(STORIES_FILES.map((file) => readFile(url(file), 'utf8')))).join('\n');
}

export function readStoriesSourceSync() {
  return STORIES_FILES.map((file) => readFileSync(url(file), 'utf8')).join('\n');
}
