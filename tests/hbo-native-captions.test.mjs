import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { isOffLabel, languageLabels, pickSubtitleOption } from '../content/subtitles/hbo-native-captions.js';
import { readEngineSource } from './helpers/engine-source.mjs';

test('reconhece rótulos de legenda desligada em pt e en', () => {
  for (const label of ['Off', 'Desativado', 'Desligada', 'Nenhuma', 'None', 'Sem legendas']) {
    assert.equal(isOffLabel(label), true, label);
  }
  assert.equal(isOffLabel('English'), false);
});

test('nomes do idioma incluem código e nomes em en/pt', () => {
  const labels = languageLabels('en-US');
  assert.ok(labels.includes('en') && labels.includes('english') && labels.includes('inglês'));
});

test('escolhe a legenda no idioma de origem e ignora Off', () => {
  const items = [
    { text: 'Off', checked: true },
    { text: 'Português (Brasil)', checked: false },
    { text: 'English [CC]', checked: false },
  ];
  assert.deepEqual(pickSubtitleOption(items, 'en'), { index: 2 });
});

test('sem idioma correspondente, usa a primeira legenda que não seja Off', () => {
  const items = [{ text: 'Desativado' }, { text: 'Español' }, { text: 'Français' }];
  assert.deepEqual(pickSubtitleOption(items, 'en'), { index: 1 });
});

test('não toca em itens de áudio nem quando só há áudio', () => {
  const items = [
    { text: 'English', isAudio: true },
    { text: 'Áudio Original', checked: false },
  ];
  assert.deepEqual(pickSubtitleOption(items, 'en'), { index: -1 });
});

test('legenda já ligada: não clica em nada', () => {
  const items = [{ text: 'Off' }, { text: 'English', checked: true }];
  assert.deepEqual(pickSubtitleOption(items, 'en'), { index: -1, alreadyOn: true });
});

test('contrato: engine tenta ligar a legenda nativa sempre que o LF liga, sem F5', async () => {
  const code = await readEngineSource();
  const method = code.match(/_autoEnableHBOSubtitles\(\) \{[\s\S]*?\n  \}\n/)[0];
  assert.match(method, /!this\.isActivated/, 'só age com o LF ligado');
  assert.match(method, /retry\(/, 'tenta de novo até as falas chegarem');
  assert.doesNotMatch(method, /setTimeout\(tryEnable, 5000\)/, 'sem espera fixa de 5s');
  assert.match(code, /if \(isVisible\) this\._autoEnableHBOSubtitles\(\)/, 'religar o LF dispara a tentativa');
});
