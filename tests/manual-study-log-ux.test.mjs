import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const home = await readFile(new URL('../dashboard/js/ui/homeView.js', import.meta.url), 'utf8');
const db = await readFile(new URL('../utils/db.js', import.meta.url), 'utf8');

assert.match(home, /id="manual-study-form"[^>]*novalidate/, 'registro manual deve usar um formulário sem recarregar a página');
assert.match(home, /id="manual-study-minutes"[^>]*type="number"/, 'registro manual deve permitir informar minutos');
assert.match(home, /min="1" max="720" step="1"/, 'campo de minutos deve respeitar o limite do RPC');
assert.match(home, /Informe um número inteiro entre 1 e 720 minutos/, 'campo inválido deve explicar como corrigir');
assert.match(home, /selectedMinutes = valid \? value : null/, 'valor digitado deve ser validado antes do envio');
assert.match(home, /minutes: selectedMinutes/, 'registro deve persistir a duração personalizada');
assert.match(home, /language: sourceLang/, 'registro deve preservar o idioma-alvo atual');
assert.match(home, /returnFocus\?\.focus\?\.\(\)/, 'fechar o modal deve devolver o foco ao botão de origem');
assert.match(db, /safeMinutes = Math\.max\(1, Math\.min\(720, Math\.round\(Number\(minutes\) \|\| 0\)\)\)/, 'persistência deve manter o limite server-side do cliente');

console.log('manual-study-log-ux: ok');
