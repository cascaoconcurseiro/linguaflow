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

assert.match(study, /id="video-resource-toggle"[\s\S]*?addEventListener\('toggle'[\s\S]*?pausePlayer\(\)/,
  'fechar o acordeom de Trecho original deve pausar o player imediatamente');

// 2. Verificação de layout vertical compacto para Trecho original e Ouvir em outros contextos
assert.match(editorial, /\.study-explore\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/,
  'o container de aprofundamento deve posicionar os recursos em coluna vertical liberando espaço para o card');

assert.match(editorial, /#video-resource-section:not\(\.hidden\)\s*\+\s*\.study-explore-row\s*\{[^}]*border-top:/,
  'deve haver uma divisória visual limpa entre Trecho original e Ouvir em outros contextos quando ambos estiverem visíveis');

assert.match(editorial, /\.study-explore\s*\{[^}]*max-height:\s*calc\([^}]*--study-grading-dock-height/,
  'o container de aprofundamento deve limitar a altura para não ultrapassar a barra de avaliação');

console.log('Contratos de layout vertical compacto e pausa de áudio/vídeo passaram com sucesso.');
