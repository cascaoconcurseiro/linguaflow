// Código-fonte do motor de legendas para testes que verificam o texto do código.
//
// O motor foi dividido em módulos (dados, CSS, templates e métodos por assunto em engine/). Os testes de contrato continuam
// valendo para o motor como um todo, então leem o arquivo principal e as partes extraídas dele.
// Ao extrair mais um trecho do motor para um módulo próprio, acrescente-o em ENGINE_FILES.
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

export const ENGINE_FILES = [
  'content/subtitle-engine.js',
  'content/subtitles/word-frequency.js',
  'content/subtitles/expression-marks.js',
  'content/subtitles/subtitle-shadow-template.js',
  'content/subtitles/subtitle-panel-styles.js',
  'content/subtitles/engine/capture.js',
  'content/subtitles/engine/caption-display.js',
  'content/subtitles/engine/playback.js',
  'content/subtitles/engine/youtube-dock.js',
  'content/subtitles/engine/sidebar-panel.js',
  'content/subtitles/engine/transcript-tab.js',
  'content/subtitles/engine/words-tab.js',
  'content/subtitles/engine/export.js',
  'content/subtitles/engine/max-sync.js',
];

const url = (file) => new URL(`../../${file}`, import.meta.url);

export async function readEngineSource() {
  const parts = await Promise.all(ENGINE_FILES.map((file) => readFile(url(file), 'utf8')));
  return parts.join('\n');
}

export function readEngineSourceSync() {
  return ENGINE_FILES.map((file) => readFileSync(url(file), 'utf8')).join('\n');
}
