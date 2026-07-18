import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const popup = read('content/word-popup.js');
const db = read('utils/db.js');
const study = read('dashboard/js/ui/studyView.js');

assert.match(popup, /this\.contextExplanation = ''/,
  'cada abertura começa sem reutilizar explicação de outra palavra');
assert.match(popup, /this\.contextExplanation = cleanContextExplanation\(response\.explanation\)/,
  'resposta já gerada é convertida em texto seguro para persistência');
assert.match(popup, /explanation: this\.contextExplanation \|\| ''/,
  'salvamento reutiliza a explicação existente sem nova chamada de IA');
assert.match(db, /if \(wordData\.explanation !== undefined\) payload\.explanation = wordData\.explanation/,
  'campo atravessa o cliente e chega à linha words do usuário');
assert.match(study, /id="iso-context-explanation"/,
  'área Significado nesta frase possui destino para a explicação');
assert.match(study, /wordData\.explanation/,
  'verso lê somente a explicação persistida no card');
assert.doesNotMatch(study, /generate.*explanation/i,
  'a exibição não gera outra explicação nem consome tokens');

console.log('7 contratos de reutilização da explicação contextual passaram ✅');
