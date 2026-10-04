import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canSendUnitToVault, runSendToVault, sendUnitToVault, unitToWordPayload } from '../dashboard/js/core/courseVault.js';

const sentence = { kind: 'sentence', text: 'I would like a table for two.', translation_pt: 'Eu gostaria de uma mesa para dois.', ipa: '/aɪ/', explanation_note: 'would like = querer, educado' };

test('mapeia a unidade do curso para o formato que saveWord já aceita (#434)', () => {
  const p = unitToWordPayload(sentence, { courseTitle: 'Viagem sem Aperto' });
  assert.equal(p.word, 'I would like a table for two.');
  assert.equal(p.context_sentence, 'I would like a table for two.');
  assert.equal(p.translation, 'Eu gostaria de uma mesa para dois.');
  assert.equal(p.category, 'idiom', 'frase inteira fica visível no Cofre (category sentence é escondida)');
  assert.equal(p.platform, 'curso');
  assert.deepEqual(p.tags, ['curso', 'Viagem sem Aperto']);
  const word = unitToWordPayload({ kind: 'word', text: 'ticket', translation_pt: 'ingresso', example_en: 'I need a ticket.' });
  assert.equal(word.category, 'word');
  assert.equal(word.context_sentence, 'I need a ticket.');
  assert.equal(unitToWordPayload({ kind: 'phrasal', text: 'give up' }).category, 'phrasal');
});

test('só envia o que cabe em um cartão: parágrafos, histórias e textos longos ficam de fora', () => {
  assert.equal(canSendUnitToVault(sentence), true);
  assert.equal(canSendUnitToVault({ kind: 'paragraph', text: 'Short paragraph.' }), false);
  assert.equal(canSendUnitToVault({ kind: 'story', text: 'Once upon a time.' }), false);
  assert.equal(canSendUnitToVault({ kind: 'sentence', text: 'word '.repeat(30) }), false);
  assert.equal(canSendUnitToVault({ kind: 'sentence', text: '' }), false);
  assert.equal(canSendUnitToVault(null), false);
});

test('nunca sobrescreve palavra existente: já no Cofre → "exists" sem chamar saveWord', async () => {
  let saved = 0;
  const db = { getWord: async () => ({ id: 'w1' }), saveWord: async () => { saved++; return { ok: true }; } };
  assert.deepEqual(await sendUnitToVault(sentence, { db }), { status: 'exists' });
  assert.equal(saved, 0);
});

test('envia, respeita o teto do Cofre (waiting) e propaga falha para o botão se recuperar', async () => {
  const mk = (result) => ({ getWord: async () => null, saveWord: async () => result });
  assert.deepEqual(await sendUnitToVault(sentence, { db: mk({ ok: true, isNew: true }) }), { status: 'saved' });
  assert.deepEqual(await sendUnitToVault(sentence, { db: mk({ ok: true, waitingForSlot: true }) }), { status: 'waiting' });
  await assert.rejects(sendUnitToVault(sentence, { db: mk({ ok: false }) }), /save_word_failed/);
  assert.deepEqual(await sendUnitToVault({ kind: 'paragraph', text: 'x y' }, { db: mk({ ok: true }) }), { status: 'unsupported' });
});

test('botão: carregando → sucesso (desabilitado); erro devolve o texto e reabilita; toast certo', async () => {
  const mkButton = () => ({ disabled: false, textContent: '＋ Cofre', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } });
  const toasts = [];
  const app = { showToast: (m, t) => toasts.push([t, m]) };

  const ok = mkButton();
  await runSendToVault(ok, sentence, { db: { getWord: async () => null, saveWord: async () => ({ ok: true }) }, app });
  assert.equal(ok.textContent, '✓ No Cofre');
  assert.equal(ok.disabled, true);
  assert.equal(ok.attrs['aria-busy'], undefined);
  assert.equal(toasts.at(-1)[0], 'success');

  const fail = mkButton();
  await runSendToVault(fail, sentence, { db: { getWord: async () => { throw new Error('rede'); }, saveWord: async () => ({ ok: true }) }, app });
  assert.equal(fail.textContent, '＋ Cofre');
  assert.equal(fail.disabled, false, 'depois do erro o aluno pode tentar de novo');
  assert.equal(toasts.at(-1)[0], 'error');

  const dup = mkButton();
  await runSendToVault(dup, sentence, { db: { getWord: async () => ({ id: 1 }), saveWord: async () => ({ ok: true }) }, app });
  assert.equal(dup.textContent, '✓ Já está no Cofre');
  const full = mkButton();
  await runSendToVault(full, sentence, { db: { getWord: async () => null, saveWord: async () => ({ ok: true, waitingForSlot: true }) }, app });
  assert.equal(toasts.at(-1)[0], 'info');
});

test('contrato: botão no player e no caderno de vocabulário; o curso continua independente (sem escrita nova)', async () => {
  const player = await readFile(new URL('../dashboard/js/ui/coursePracticeView.js', import.meta.url), 'utf8');
  const notebooks = await readFile(new URL('../dashboard/js/ui/courses/courseNotebooks.js', import.meta.url), 'utf8');
  const repo = await readFile(new URL('../utils/db/courses-repo.js', import.meta.url), 'utf8');
  assert.match(player, /data-action="send-vault"/);
  assert.match(player, /'send-vault': \(\) => runSendToVault/);
  assert.match(notebooks, /data-action="vault"/);
  assert.match(repo, /course_units\(kind,text,translation_pt,ipa,explanation_note,example_en/);
  const vault = await readFile(new URL('../dashboard/js/core/courseVault.js', import.meta.url), 'utf8');
  assert.doesNotMatch(vault, /_fetch|rpc\//, 'sem escrita nova: só db.saveWord e db.getWord');
});
