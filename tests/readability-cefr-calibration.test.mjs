import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { measureStoryLevel } from '../dashboard/js/core/readability.js';
import { LEVEL_SPECS } from '../utils/story-variety.js';

const cefrMap = JSON.parse(readFileSync(new URL('../utils/cefr-wordlist.json', import.meta.url), 'utf8'));

test('readability: ignora nomes próprios e não penaliza o nível com falsos B2', () => {
  const textWithNames = `Maya and Lucas walked to the cafe in the morning. Clara and Daniel said hello to Leo. They all smiled, drank tea, and sat together at a nice table.`;
  const result = measureStoryLevel(textWithNames, cefrMap);
  assert.ok(result.level === 'A1' || result.level === 'A2', `Nível deve ser elementar/básico, obtido: ${result.level}`);
});

test('readability: lematiza formas regulares (-ed, -ing, plurais) para suas bandas base', () => {
  const storyA2 = `Maya walked into the coffee shop. It was cold outside, but inside was warm.
Good morning! the barista said with a smile. What would you like today?
Hello, Maya answered. Can I have a hot tea and a croissant, please?
Sure. That is five dollars, he said.
Maya opened her bag and took out her wallet. She paid the money and sat at a small table near the window.
While she waited, she looked at the people on the street. Everyone was walking fast because of the rain.
Soon, the barista brought her tea. Enjoy your breakfast, he said kindly.
Thank you very much, Maya said. She felt happy and relaxed.`;

  const measured = measureStoryLevel(storyA2, cefrMap);
  assert.equal(measured.level, 'A2', 'História clássica de cafeteria em passado simples deve ser medida como A2');
  assert.ok(measured.coverage >= 0.85, 'Cobertura deve ser de pelo menos 85% até A2');
});

test('readability: texto curto (<20 tokens conhecidos) retorna level null', () => {
  const shortText = 'Hello there friend.';
  const result = measureStoryLevel(shortText, cefrMap);
  assert.equal(result.level, null);
});

test('storiesView: o badge de nível exibe exatamente o nível solicitado sem texto de divergência', () => {
  const storiesCode = readFileSync(new URL('../dashboard/js/ui/storiesView.js', import.meta.url), 'utf8');
  assert.doesNotMatch(storiesCode, /pedido \$\{requested\} · medido/,
    'Nunca deve exibir discrepância conflitante "pedido X · medido Y" no selo da história');
  assert.match(storiesCode, /const displayLevel = requested \|\| measured\.level \|\| 'B1';/,
    'Selo principal prioriza o nível exato solicitado pelo aluno');
  assert.match(storiesCode, /storyLevelBadge\.textContent = displayLevel;/,
    'Selo recebe diretamente o nível selecionado');
});

test('storiesView: catálogo de temas contém opções confortáveis e cotidianas', () => {
  const storiesCode = readFileSync(new URL('../dashboard/js/ui/storiesView.js', import.meta.url), 'utf8');
  const requiredThemes = [
    'Cafeteria & Restaurante',
    'Amizades & Convivência',
    'Família & Casa',
    'Animais & Pets',
    'Compras & Cidade',
    'Saúde & Bem-Estar',
  ];
  for (const theme of requiredThemes) {
    assert.match(storiesCode, new RegExp(`value="${theme}"`), `Tema "${theme}" deve estar presente no seletor`);
  }
});

test('story-variety: calibração de A2 proíbe estruturas avançadas que distorcem o nível', () => {
  assert.match(LEVEL_SPECS.A2.structures, /proibido|nada de/i);
  assert.match(LEVEL_SPECS.A1.structures, /proibido/i);
});
