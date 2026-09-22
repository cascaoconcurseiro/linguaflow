import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

console.log('🧪 Iniciando testes de Controle Multimodal de Horas de Estudo...');

// 1. Contrato da Migration SQL
const migrationPath = 'supabase/migrations/20260921160000_multimodal_study_and_language_tracking.sql';
assert(existsSync(migrationPath), `Migration ${migrationPath} deve existir`);

const migration = readFileSync(migrationPath, 'utf8');

// Coluna language em public.sessions
assert.match(migration, /alter\s+table\s+public\.sessions\s+add\s+column\s+if\s+not\s+exists\s+language\s+text\s+not\s+null\s+default\s+'en'/i, 'Deve adicionar coluna language com default en em sessions');

// Coluna response_time_ms em public.review_log
assert.match(migration, /alter\s+table\s+public\.review_log\s+add\s+column\s+if\s+not\s+exists\s+response_time_ms\s+integer/i, 'Deve adicionar coluna response_time_ms em review_log');

// Atualização de constraint de sessions
assert.match(migration, /sessions_user_date_source_lang_key|unique\s*\(user_id,\s*date,\s*source,\s*language\)/i, 'Deve conter chave de unicidade combinando user_id, date, source e language');

// RPC log_study_time com suporte a p_language
assert.match(migration, /create\s+or\s+replace\s+function\s+public\.log_study_time\s*\([\s\S]*p_language\s+text\s+default\s+'en'/i, 'log_study_time deve receber p_language com default en');
assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.log_study_time[\s\S]*from\s+public,\s*anon/i, 'log_study_time deve revogar anon/public');
assert.match(migration, /grant\s+execute\s+on\s+function\s+public\.log_study_time[\s\S]*to\s+authenticated/i, 'log_study_time deve conceder execute a authenticated');

// RPC log_manual_study
assert.match(migration, /create\s+or\s+replace\s+function\s+public\.log_manual_study\s*\(/i, 'Deve criar função log_manual_study');
assert.match(migration, /p_skill\s+text[\s\S]*p_minutes\s+integer/i, 'log_manual_study deve receber p_skill e p_minutes');
assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.log_manual_study[\s\S]*from\s+public,\s*anon/i, 'log_manual_study deve revogar anon/public');
assert.match(migration, /grant\s+execute\s+on\s+function\s+public\.log_manual_study[\s\S]*to\s+authenticated/i, 'log_manual_study deve conceder execute a authenticated');

// 2. Contrato de utils/db.js
const dbContent = readFileSync('utils/db.js', 'utf8');

// Método getStudyStats e formatStudyTime
assert.match(dbContent, /getStudyStats\s*\(/, 'utils/db.js deve implementar getStudyStats');
assert.match(dbContent, /formatStudyTime\s*\(/, 'utils/db.js deve implementar formatStudyTime');
assert.match(dbContent, /logManualStudy\s*\(/, 'utils/db.js deve implementar logManualStudy');
assert.match(dbContent, /logSession\s*\([\s\S]*language/, 'logSession em utils/db.js deve aceitar language');
assert.match(dbContent, /src === 'video' \|\| src === 'extension' \|\| src === 'manual_listening'/,
  'getStudyStats deve contabilizar imersão automática da extensão como listening');

// 3. Contrato do Popup
const popupHtml = readFileSync('popup/popup.html', 'utf8');
assert.match(popupHtml, /id="listening-today"/, 'popup.html deve conter #listening-today');
assert.match(popupHtml, /id="listening-total"/, 'popup.html deve conter #listening-total');
assert.match(popupHtml, /id="study-lang-badge"/, 'popup.html deve conter #study-lang-badge');

const popupJs = readFileSync('popup/popup.js', 'utf8');
assert.match(popupJs, /getStudyStats/, 'popup.js deve chamar getStudyStats');

// 4. Contrato do Subtitle Engine
const engineContent = readFileSync('content/subtitle-engine.js', 'utf8');
assert.match(engineContent, /db\.logSession\s*\(\s*10\s*,\s*this\.platform\s*,\s*this\.sourceLang/i, 'subtitle-engine deve passar this.sourceLang no logSession');

// 5. Contrato do Dashboard (Cards Críticos e Cronômetro de Card)
const homeViewContent = readFileSync('dashboard/js/ui/homeView.js', 'utf8');
assert.match(homeViewContent, /home-critical-cards|criticalCards/, 'homeView deve mapear e renderizar cards críticos');

const studyViewContent = readFileSync('dashboard/js/ui/studyView.js', 'utf8');
assert.match(studyViewContent, /card-live-timer/, 'studyView deve conter o cronômetro do card #card-live-timer');
assert.match(studyViewContent, /startCardTimer/, 'studyView deve iniciar startCardTimer()');

// 6. Contrato de Cache Busting (PWA / Service Worker v3.0.51)
const swContent = readFileSync('dashboard/sw.js', 'utf8');
assert.match(swContent, /linguaflow-v3\.0\.51/, 'sw.js deve usar a versão de cache 3.0.51');

const dashboardHtml = readFileSync('dashboard/dashboard.html', 'utf8');
assert.match(dashboardHtml, /app\.js\?v=3\.0\.51/, 'dashboard.html deve importar app.js?v=3.0.51');

console.log('✅ Todos os testes de contrato passaram com sucesso!');
