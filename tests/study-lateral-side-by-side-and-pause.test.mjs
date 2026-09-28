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

// O aprofundamento fica abaixo do card, dentro da coluna que rola (como no
// player de Cursos). Quem garante que nada fica sob a barra de avaliação é o
// padding/scroll-padding da coluna, não uma altura própria.
assert.doesNotMatch(editorial, /\.study-explore\s*\{[^}]*grid-column:\s*2/,
  'o aprofundamento não deve voltar a ser uma coluna lateral');
assert.match(editorial, /\.study-main\s*\{[^}]*scroll-padding-bottom:\s*calc\(var\(--study-grading-dock-height/,
  'a coluna do card deve reservar espaço para a barra de avaliação');

// 3. Verso organizado como o painel do player de Cursos
assert.match(study, /class="study-breakdown"[\s\S]*?id="pump-translation"[\s\S]*?id="pump-phonetics"[\s\S]*?id="pump-word-answer"[\s\S]*?id="iso-context-details"[\s\S]*?<\/section>/,
  'o verso deve agrupar tradução, pronúncia, palavra e explicação nesta ordem em um único painel');
assert.match(editorial, /\.study-layout:not\(\.is-revealed\) \.study-breakdown \{ display:none; \}/,
  'o painel do verso não pode aparecer antes de revelar');

// 4. Camadas do verso por atalho (P/X/V/O), uma por vez, fechadas a cada card
assert.match(study, /STUDY_LAYER_KEYS = \{ KeyP: 'word', KeyX: 'why', KeyV: 'clip', KeyO: 'more' \}/,
  'atalhos P/X/V/O devem abrir palavra, explicação, trecho e outros contextos');
assert.match(study, /classList\.remove\('is-revealed'\);\s*setStudyLayer\(''\)/,
  'trocar de card deve fechar a camada aberta (e pausar vídeo/YouGlish pelos toggles)');
assert.match(study, /data-study-layer="word" aria-pressed="false"/,
  'botões de camada devem expor estado pressionado para tecnologia assistiva');
assert.match(editorial, /\.study-layout:not\(\[data-layer="word"\]\) #pump-word-answer/,
  'o bloco da palavra só aparece com a camada Palavra ativa');
assert.match(editorial, /\.study-layout:not\(\[data-layer="clip"\]\):not\(\[data-layer="more"\]\) \.study-explore \{ display:none; \}/,
  'trecho e outros contextos só aparecem com a camada correspondente');

console.log('Contratos de layout vertical compacto e pausa de áudio/vídeo passaram com sucesso.');
