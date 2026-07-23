import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const reader = readFileSync('dashboard/js/ui/readerView.js', 'utf8');
const stories = readFileSync('dashboard/js/ui/storiesView.js', 'utf8');
const db = readFileSync('utils/db.js', 'utf8');
const app = readFileSync('dashboard/js/core/app.js', 'utf8');
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

// O cache legado do Leitor deve ser importado uma única vez por usuário.
assert.match(reader, /READER_MIGRATION_KEY/);
assert.match(reader, /getCurrentUserId\(\)/);
assert.match(reader, /migrateReaderText/);
assert.doesNotMatch(reader, /local\.map\(\(text\) => lfDb\.saveReaderText/);
assert.match(db, /async migrateReaderText\(text\)/);
assert.match(db, /resolution=ignore-duplicates,return=representation/);

// Uma história só entra no espelho local depois de receber o UUID do banco.
assert.match(stories, /const saved = await db\.saveStory/);
assert.match(stories, /id: saved\.id/);
assert.doesNotMatch(stories, /id: Date\.now\(\)\.toString\(\)/);
assert.match(stories, /await saveStoryLocal\(/);
assert.match(db, /const UUID_PATTERN/);
assert.match(db, /if \(!UUID_PATTERN\.test\(String\(id\)\)\) return false/);

// Falha de leitura remota não pode parecer uma biblioteca vazia válida.
assert.match(db, /async getStories[\s\S]*if \(!rows\) throw/);

// Dados de histórias nunca entram no DOM como HTML não confiável.
assert.match(stories, /escapeHTML\(story\.title\)/);
assert.match(stories, /escapeHTML\(story\.level\)/);

// Superfície mínima: sem permissões, hosts, stubs ou assets comprovadamente mortos.
assert.ok(!manifest.permissions.includes('scripting'));
assert.ok(!manifest.host_permissions.some((host) => host.includes('api.deepseek.com')));
assert.ok(!manifest.content_security_policy.extension_pages.includes('api.deepseek.com'));
assert.ok(!manifest.web_accessible_resources.some((entry) => entry.resources.includes('assets/*')));
assert.doesNotMatch(db, /async exportDatabase\(/);
assert.doesNotMatch(db, /async importDatabase\(/);
assert.equal(existsSync('assets/cefr.json'), false);

// Os contratos de sincronização fazem parte obrigatória da liberação.
assert.match(packageJson.scripts['test:release'], /sync-source-of-truth\.test\.mjs/);
assert.match(packageJson.scripts['test:release'], /professional-hardening\.test\.mjs/);

// Telemetria precisa identificar a release real que produziu o erro. Uma
// data fixa tornava impossível correlacionar regressões com o deploy.
assert.match(app, /reportClientError\(source, name, this\.currentRoute, CLIENT_BUILD\)/);
assert.match(db, /async reportClientError\(source, errorName, route = '', appVersion = ''\)/);
assert.doesNotMatch(db, /app_version:\s*'dashboard-2026-07-10'/);
assert.match(db, /app_version:\s*safe\(appVersion\)/);

console.log('21 contratos de endurecimento profissional passaram ✅');
