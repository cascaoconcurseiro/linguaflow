import assert from 'node:assert/strict';
import { hasSourcePhraseLeak } from '../utils/translation-quality.js';

assert.equal(
  hasSourcePhraseLeak("Aww! Come here. I'll fist-bump you.", 'Awn! Vem cá. Vou dar um fist bump em você.'),
  true,
  'detecta expressão inglesa copiada para dentro da tradução'
);
assert.equal(
  hasSourcePhraseLeak("Aww! Come here. I'll fist-bump you.", 'Awn! Vem cá. Vou bater aqui com você.'),
  false,
  'aceita tradução integral e natural em português'
);
assert.equal(
  hasSourcePhraseLeak('I live in New York.', 'Eu moro em Nova York.'),
  false,
  'não confunde palavras isoladas ou nomes traduzidos com vazamento'
);
assert.equal(hasSourcePhraseLeak('', 'Tradução'), false, 'entrada vazia é segura');

console.log('4 contratos de qualidade de tradução passaram ✅');
