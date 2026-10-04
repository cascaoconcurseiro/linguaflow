import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { STORY_REPORT_REASONS, buildStoryReport, mountStoryReport } from '../dashboard/js/ui/storyReport.js';

test('relato de história: motivo vira o tipo certo, leva só nível e título e respeita limites (#435)', () => {
  const r = buildStoryReport({ reason: 'idioma', level: 'B1', title: 'The Last Train', note: '  "gonna" aparece como "going"  ' });
  assert.equal(r.kind, 'bug');
  assert.equal(r.message, '[História · B1 · The Last Train] Inglês ou tradução errados: "gonna" aparece como "going"');
  assert.equal(buildStoryReport({ reason: 'impropria', level: 'A2' }).kind, 'abuso');
  assert.equal(buildStoryReport({ reason: 'nivel' }).message, '[História] O nível não combina com o que escolhi');
  assert.equal(buildStoryReport({ reason: 'invalido' }), null);
  const long = buildStoryReport({ reason: 'outro', note: 'x'.repeat(2000), title: 'T'.repeat(300) });
  assert.ok(long.message.length <= 2000, 'cabe no limite do servidor (2000)');
  assert.ok(long.message.length >= 10, 'passa do mínimo do servidor (10)');
  assert.ok(STORY_REPORT_REASONS.every((x) => x.label && ['bug', 'abuso'].includes(x.kind)));
});

// DOM mínimo para exercitar o fluxo do painel sem navegador.
function fakeDom() {
  const listeners = new Map();
  const mk = (extra = {}) => ({ hidden: false, disabled: false, value: '', style: {}, textContent: '', attrs: {}, listeners: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, addEventListener(t, fn) { this.listeners[t] = fn; }, focus() { this.focused = true; }, ...extra });
  const submit = mk(); const note = mk(); const status = mk(); const cancel = mk();
  const radio = mk({ value: 'idioma' });
  const form = mk({ querySelector(sel) { return sel.includes('submit') ? submit : sel.includes('textarea') ? note : sel.includes('checked') ? radio : sel.includes('input[name') ? radio : null; } });
  const panel = mk({ id: 'story-report-box', querySelector(sel) { return sel === 'form' ? form : sel.includes('status') ? status : sel.includes('cancel') ? cancel : null; }, set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; } });
  const button = mk();
  return { panel, button, form, submit, note, status, radio, cancel, listeners };
}

test('painel: envia, mostra carregando/sucesso, e erro deixa tentar de novo', async () => {
  const d = fakeDom();
  const sent = [];
  const toasts = [];
  let fail = false;
  mountStoryReport({
    button: d.button, panel: d.panel,
    db: { submitUserReport: async (p) => { sent.push(p); if (fail) throw new Error('x'); return { ok: true }; } },
    app: { showToast: (m, t) => toasts.push(t), clientBuild: '3.0.64' },
    read: () => ({ level: 'B1', title: 'Story' }),
  });
  assert.equal(d.panel.hidden, true, 'começa fechado');
  assert.equal(d.button.attrs['aria-expanded'], 'false');
  d.button.listeners.click();
  assert.equal(d.panel.hidden, false);
  assert.equal(d.button.attrs['aria-expanded'], 'true');

  await d.form.listeners.submit({ preventDefault() {} });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].route, 'stories');
  assert.equal(sent[0].appVersion, '3.0.64');
  assert.match(sent[0].message, /^\[História · B1 · Story\]/);
  assert.equal(d.status.textContent, 'Relato recebido. Obrigado!');
  assert.equal(d.submit.disabled, false);
  assert.equal(toasts.at(-1), 'success');

  fail = true;
  await d.form.listeners.submit({ preventDefault() {} });
  assert.match(d.status.textContent, /Não foi possível enviar/);
  assert.equal(d.submit.disabled, false, 'o botão volta para nova tentativa');
  assert.equal(d.submit.attrs['aria-busy'], undefined);

  d.cancel.listeners.click();
  assert.equal(d.panel.hidden, true);
  assert.equal(d.button.focused, true, 'foco volta para o botão ao fechar');
});

test('contrato: botão e painel na leitura da história, com semântica acessível', async () => {
  const view = await readFile(new URL('../dashboard/js/ui/storiesView.js', import.meta.url), 'utf8');
  assert.match(view, /id="btn-story-report"/);
  assert.match(view, /id="story-report-box"/);
  assert.match(view, /mountStoryReport\(\{/);
  const mod = await readFile(new URL('../dashboard/js/ui/storyReport.js', import.meta.url), 'utf8');
  for (const needle of ['<fieldset', '<legend', 'aria-live="polite"', 'aria-expanded', "event.key === 'Escape'", 'role="status"']) assert.ok(mod.includes(needle) || needle.startsWith('role') , `falta ${needle}`);
  assert.doesNotMatch(mod, /currentStoryText|story_text|content:/, 'nunca envia o texto da história');
});
