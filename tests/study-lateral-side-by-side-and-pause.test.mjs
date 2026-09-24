import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [study, editorial] = await Promise.all([
  read('dashboard/js/ui/studyView.js'),
  read('dashboard/css/editorial.css'),
]);

// 1. Verificação do pause do vídeo ao fechar Ouvir em outros contextos
assert.match(study, /close-study-resources[\s\S]*?pauseYouglish\(\)/,
  'clicar em Fechar deve pausar o YouGlish imediatamente');

assert.match(study, /id="study-resources"[\s\S]*?addEventListener\('toggle'[\s\S]*?pauseYouglish\(\)/,
  'recolher a gaveta no evento toggle deve pausar o YouGlish');

assert.match(study, /function pauseYouglish\(\)[\s\S]*?ygWidget\?\.pause\?\.[\s\S]*?postMessage[\s\S]*?pauseVideo/,
  'pauseYouglish deve acionar a API do widget e enviar postMessage de pausa para iframes do YouTube');

// 2. Verificação de layout lado a lado para Trecho original e Ouvir em outros contextos
assert.match(editorial, /\.study-explore\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*row;/,
  'o container de aprofundamento deve posicionar os recursos lado a lado em telas desktop');

assert.match(editorial, /#video-resource-section:not\(\.hidden\)\s*\+\s*\.study-explore-row\s*\{[^}]*border-left:/,
  'deve haver uma divisória visual limpa entre Trecho original e Ouvir em outros contextos quando ambos estiverem visíveis');

assert.match(editorial, /@media\s*\(max-width:\s*(?:1000|1100)px\)[\s\S]*?\.study-explore\s*\{[^}]*flex-direction:\s*column/,
  'em telas menores deve empilhar verticalmente de forma responsiva');

console.log('Contratos de layout lado a lado e pausa de áudio/vídeo passaram com sucesso.');
