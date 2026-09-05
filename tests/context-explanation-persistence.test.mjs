import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const popup = read('content/word-popup.js');
const db = read('utils/db.js');
const study = read('dashboard/js/ui/studyView.js');
const worker = read('background/service-worker.js');
const webReader = read('content/web-reader.js');

assert.match(popup, /this\.contextExplanation = ''/,
  'cada abertura começa sem reutilizar explicação de outra palavra');
assert.match(popup, /const explanation = cleanContextExplanation\(response\.explanation\)[\s\S]*?this\.contextExplanation = explanation/,
  'resposta já gerada é convertida em texto seguro para persistência');
assert.match(popup, /explanation: this\.contextExplanation \|\| ''/,
  'salvamento reutiliza a explicação existente sem nova chamada de IA');
assert.match(popup, /contextSession\.save = \{[\s\S]*?payload,[\s\S]*?promise:/,
  'a sessão da palavra conserva o payload completo enquanto a primeira gravação está na fila');
assert.match(popup, /async _syncLateSaveEnrichment\(contextSession\)/,
  'enriquecimentos que terminam depois do clique possuem sincronização própria');
assert.match(popup, /await contextSession\.save\.promise/,
  'a atualização tardia espera a intenção inicial entrar na fila para não inverter versões');
assert.match(popup, /queuedSave\.syncPromise[\s\S]*?\? queuedSave\.syncPromise\.catch\(\(\) => \{\}\)[\s\S]*?: Promise\.resolve\(\)/,
  'uma tentativa tardia que falhou não envenena as próximas tentativas da sessão');
assert.match(popup, /if \(!result\?\.ok \|\| !result\?\.queued\)[\s\S]*?this\._syncLateSaveEnrichment\(contextSession\)\.catch/,
  'a confirmação do save reconcilia IA que terminou durante a montagem do payload');
assert.match(popup, /context_sentence: this\.saveContext \|\| this\.context \|\| ''/,
  'uma frase gerada depois do clique também atualiza o contexto persistido');
assert.match(popup, /this\._syncLateSaveEnrichment\(contextSession\)\.catch/,
  'a resposta tardia dispara atualização sem bloquear o popup');
assert.match(popup, /if \(this\._contextSession !== contextSession\) return/,
  'resposta antiga não repinta o popup de outra palavra');
assert.match(worker, /queuedAt: Math\.max\(Date\.now\(\), Number\(queue\[id\]\?\.queuedAt \|\| 0\) \+ 1\)/,
  'cada versão da mesma palavra recebe marcador estritamente crescente');
assert.match(db, /if \(wordData\.explanation !== undefined\) payload\.explanation = wordData\.explanation/,
  'campo atravessa o cliente e chega à linha words do usuário');
assert.match(study, /id="pump-translation"[\s\S]*?<details id="iso-context-details" class="context-explanation-card hidden">[\s\S]*?<summary id="iso-context-summary">[\s\S]*?Por que significa isso nesta frase\?[\s\S]*?role="region" aria-labelledby="iso-context-summary"/,
  'a explicação fica recolhida no verso principal e associada ao seu rótulo acessível');
assert.match(study, /contextDetails\.open = false/,
  'cada card começa com a explicação recolhida');
assert.match(study, /contextDetails\.classList\.toggle\('hidden', !savedExplanation\)/,
  'o controle só aparece após revelar quando existe explicação persistida');
assert.match(study, /contextDetails\.classList\.add\('hidden'\)[\s\S]*?contextExplanation\.textContent = ''/,
  'a troca de card limpa e oculta a explicação anterior');
assert.match(study, /e\.target\.closest\('button, a, summary, input, textarea, select, \[contenteditable="true"\]'\)/,
  'atalhos globais preservam Space e Enter nos controles interativos');
assert.match(study, /wordData\.explanation/,
  'verso lê somente a explicação persistida no card');
assert.doesNotMatch(study, /generate.*explanation/i,
  'a exibição não gera outra explicação nem consome tokens');
assert.match(webReader, /currentExplanation = ''/,
  'o Web Reader mantém a explicação ligada à seleção atual');
assert.match(webReader, /explanation: currentExplanation \|\| ''/,
  'o Web Reader salva a explicação recebida na chamada contextual já realizada');

console.log('19 contratos de reutilização da explicação contextual passaram ✅');
