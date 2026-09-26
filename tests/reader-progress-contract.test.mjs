import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const dbSource = `${read('utils/db.js')}\n${read('utils/db/reader-stories-repo.js')}`;
const swSource = read('background/service-worker.js');
const readerSource = read('dashboard/js/ui/readerView.js');

// 1. Contrato com db.js e Supabase
assert.match(dbSource, /reader_texts\?select=[^'"`]*last_read_position[^'"`]*reading_percentage[^'"`]*is_completed/,
  'db.js deve selecionar last_read_position, reading_percentage e is_completed em getReaderTexts');

assert.match(dbSource, /async updateReaderProgress\(textId, \{/,
  'db.js deve definir o método updateReaderProgress');

// 2. Allowlist de proxy no service-worker
assert.match(swSource, /'updateReaderProgress'/,
  'service-worker deve incluir updateReaderProgress na allowlist de métodos proxy de DB');

// 3. UI do Reader (readerView.js)
assert.match(readerSource, /updateReaderProgress/,
  'readerView.js deve chamar updateReaderProgress para persistir progresso');

assert.match(readerSource, /rd-mark-completed|btn-reader-complete/,
  'readerView.js deve disponibilizar controle para marcar o texto como lido/concluído');

assert.match(readerSource, /reading_percentage|last_read_position/,
  'readerView.js deve exibir ou restaurar progresso salvo na estante e na leitura');

console.log('✓ Contratos de persistência do progresso do Reader validados com sucesso');
