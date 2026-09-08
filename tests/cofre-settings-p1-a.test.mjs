import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { escapeHtml } from '../dashboard/js/ui/viewState.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const library = read('dashboard/js/ui/libraryView.js');
const settings = read('dashboard/js/ui/settingsView.js');

assert.equal(escapeHtml('<img src=x onerror=alert(1)> & "x"'), '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;x&quot;');
assert.match(library, /escapeHtml\(w\.word\)/);
assert.match(library, /escapeHtml\(w\.translation\)/);
assert.match(library, /escapeHtml\(w\.context_sentence\)/);
assert.match(library, /<article class="word-card/);
assert.ok(library.indexOf('class="word-context"') < library.indexOf('class="word-main"'), 'frase de contexto vem antes do termo');
assert.match(library, /renderStatus\(card\)/);
assert.doesNotMatch(library, /renderStatus\(w\.reps\)/);
for (const label of ['Revisar hoje', 'Nova', 'Começando', 'Consolidando', 'Memória estável', 'Revisões pausadas']) assert.match(library, new RegExp(label));
assert.match(library, /aria-pressed=/);
assert.match(library, /Pausar revisões/);
assert.match(library, /Retomar revisões/);
assert.match(library, /btn-empty-library-learn/);
assert.doesNotMatch(library, /opacity:0\.55/);
assert.match(library, /renderVideoContext/);
assert.match(library, /attachVideoContext/);

assert.match(settings, /try\s*\{[\s\S]*lfDb\.getSettings/);
assert.match(settings, /btn-settings-retry/);
assert.match(settings, /Nenhum valor padrão será salvo por cima/);
assert.match(settings, /id="srs-new-per-day"[^>]+max="20"/);
assert.match(settings, /srsNewPerDay \?\? 5/);
assert.match(settings, /srsMaxRev,\s*srsVaultCap,\s*srsReverseRaw,\s*srsVariedRaw,\s*audioFrontRaw,\s*audioBackRaw/,
  'o teto do Cofre ocupa sua posição sem deslocar os checkboxes seguintes');
assert.match(settings, /Number\.isFinite\(parsedNewPerDay\) \? parsedNewPerDay : 5/,
  'zero cards novos por dia deve ser preservado como configuração válida');
assert.doesNotMatch(settings, /Number\(srsNewPerDay \?\? 5\) \|\| 5/,
  'a tela não pode converter zero cards novos em cinco');
assert.match(settings, /Seu nível aproximado/);
assert.match(settings, /não substitui uma avaliação CEFR completa/);
assert.match(settings, /Salvar configurações/);
for (const id of [
  'srs-new-per-day', 'srs-max-rev', 'srs-vault-cap', 'retention-slider',
  'srs-learning-steps', 'srs-relearning-steps', 'srs-grad-interval',
  'srs-max-interval', 'srs-int-mod', 'srs-leech-thresh', 'srs-leech-action',
  'srscat-select', 'srscat-retention', 'srscat-steps', 'srscat-grad',
]) {
  assert.match(settings, new RegExp(`<label for="${id}"`), `${id} deve ter label acessível`);
}
assert.match(settings, /id="tts-lang-selector" role="group" aria-labelledby="tts-lang-label"/);
assert.match(settings, /id="tts-speed-selector" role="group" aria-labelledby="tts-speed-label"/);
assert.match(settings, /<label for="pl-writing"/,
  'produção escrita do nivelamento deve ter label associado');
assert.match(settings, /id="pl-writing"[^>]*aria-describedby="pl-writing-prompt pl-writing-count"/,
  'textarea deve anunciar o enunciado e a contagem mínima');
assert.match(settings, /id="pl-writing-count"[^>]*role="status"[^>]*aria-live="polite"/,
  'contagem dinâmica da produção deve ser anunciada sem interromper');
assert.match(settings, /class="cefr-btn[^>]*aria-pressed="\$\{cefr === '[A-C][12]' \? 'true' : 'false'\}"/,
  'cada opção CEFR deve expor seu estado selecionado');
assert.match(settings, /class="tts-opt-btn"[^>]*aria-pressed="\$\{ttsLang === 'en-US' \? 'true' : 'false'\}"/,
  'sotaque deve expor a seleção inicial');
assert.match(settings, /class="tts-speed-btn"[^>]*aria-pressed="\$\{ttsSpeed === 'normal' \? 'true' : 'false'\}"/,
  'velocidade deve expor a seleção inicial');
assert.match(settings, /b\.setAttribute\('aria-pressed', String\(b === btn\)\)/,
  'seletores exclusivos devem sincronizar aria-pressed a cada clique');
for (const id of ['srscat-status', 'kokoro-progress-text', 'push-status', 'email-status']) {
  assert.match(settings, new RegExp(`id="${id}"[^>]*role="status"[^>]*aria-live="polite"`), `${id} deve anunciar atualizações`);
}
assert.match(settings, /validatedInputs[\s\S]+checkValidity\(\)[\s\S]+reportValidity\(\)/,
  'configurações SRS devem validar limites antes de persistir');
assert.match(settings, /Number\.isFinite\(value\) && value > 0/,
  'learning steps devem rejeitar valores não finitos e não positivos');
assert.match(settings, /Number\.isFinite\(Number\(token\)\) && Number\(token\) > 0/,
  'overrides por categoria devem validar todos os passos');
assert.match(settings, /setAttribute\('role', 'dialog'\)[\s\S]+setAttribute\('aria-modal', 'true'\)[\s\S]+setAttribute\('aria-labelledby', 'pl-dialog-title'\)/,
  'placement deve ser um diálogo nomeado e modal');
assert.match(settings, /event\.key === 'Escape'[\s\S]+closeAll\(\)/,
  'placement deve fechar com Escape');
assert.match(settings, /const closeAll[\s\S]+returnFocusTo\?\.focus\(\)/,
  'placement deve restaurar foco ao fechar');
assert.match(settings, /escapeHtml\(writingResult\.feedback\)/,
  'feedback da IA no placement deve ser escapado');

console.log('✓ P1-A: Cofre escaneável e Configurações seguras');
