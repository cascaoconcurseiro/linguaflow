/**
 * ============================================================================
 * LinguaFlow — Motor de Entrada e Tokenizador de Palavras
 * Arquivo: dashboard/js/core/inputEngine.js
 * Responsabilidade: Divisão em slots de palavras, cálculo de largura 'ch',
 * normalização de caracteres, contrações e suporte a Dead Keys / ABNT2.
 * ============================================================================
 */

/**
 * Calcula a largura do slot de input em unidades de caractere (ch).
 * Mantém uma margem de segurança de 0.9ch para o cursor de inserção.
 *
 * @param {string} word - A palavra alvo.
 * @returns {number} Largura em ch (mínimo de 3.5ch).
 */
export function calculateWidthCh(word) {
  if (!word || typeof word !== 'string') return 3.5;
  const len = word.length;
  const calculated = Math.max(3.5, len + 0.9);
  return Number(calculated.toFixed(1));
}

/**
 * Normaliza uma palavra para comparação fonética e ortográfica:
 * - Converte apóstrofos tipográficos (‘, ’, ´, `) para o apóstrofo ASCII padrão (')
 * - Remove pontuação marginal acidental digitada dentro do slot (. , ! ? ; : " ( ))
 * - Converte para caixa baixa (case-insensitive)
 *
 * @param {string} word - Palavra digitada ou esperada.
 * @returns {string} Palavra limpa e normalizada.
 */
export function normalizeWord(word) {
  if (!word || typeof word !== 'string') return '';

  return word
    .trim()
    // Padroniza qualquer variante de apóstrofo para ASCII '
    .replace(/[’‘´`]/g, "'")
    // Remove pontuação externa marginal que o usuário possa ter digitado por hábito
    .replace(/^[.,!?;:"'()]*(.*?)[.,!?;:"'()]*$/, '$1')
    .toLowerCase();
}

/**
 * Tokeniza uma frase completa em slots independentes de exercício.
 * Isola a pontuação gramatical externa fora dos campos de digitação.
 *
 * @param {string} sentence - Frase em inglês a ser praticada.
 * @returns {Array<Object>} Lista de tokens preparados para renderização no player.
 */
export function tokenizeSentence(sentence) {
  if (!sentence || typeof sentence !== 'string') return [];

  // Divide por espaços em branco contínuos
  const rawWords = sentence.trim().split(/\s+/);

  return rawWords.map((rawWord, index) => {
    // Separa pontuação final (.,!?;:) da palavra base
    const trailingPunctMatch = rawWord.match(/([.,!?;:]+)$/);
    const punctuationAfter = trailingPunctMatch ? trailingPunctMatch[1] : '';

    // Separa pontuação inicial se houver (ex: aspas ou travessão)
    const leadingPunctMatch = rawWord.match(/^([¿¡"'(]+)/);
    const punctuationBefore = leadingPunctMatch ? leadingPunctMatch[1] : '';

    // A palavra alvo central (preservando contrações como I'm, don't, gotta)
    let targetWord = rawWord;
    if (punctuationAfter) {
      targetWord = targetWord.slice(0, -punctuationAfter.length);
    }
    if (punctuationBefore) {
      targetWord = targetWord.slice(punctuationBefore.length);
    }

    const clean = normalizeWord(targetWord);
    const width = calculateWidthCh(targetWord);

    return {
      index,
      rawWord,
      targetWord,
      cleanWord: clean,
      punctuationBefore,
      punctuationAfter,
      charWidth: width
    };
  });
}

/**
 * Sanitiza e divide um texto colado (Ctrl+V) em palavras individuais.
 *
 * @param {string} text - Texto bruto colado.
 * @returns {Array<string>} Lista de palavras limpas.
 */
export function parsePastedText(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .trim()
    .split(/\s+/)
    .map(w => w.replace(/^[.,!?;:"'()]*(.*?)[.,!?;:"'()]*$/, '$1'))
    .filter(Boolean);
}

/**
 * Avalia a tentativa de digitação de uma frase contra os tokens esperados.
 *
 * @param {Array<Object>} tokens - Tokens gerados por tokenizeSentence.
 * @param {Array<string>} userInputs - Textos digitados pelo usuário em cada slot.
 * @param {Array<Object>} [variants=[]] - Variantes aceitas ({ slot: number, text: string }).
 * @returns {{ isCorrect: boolean, errorIndices: Array<number>, correctIndices: Array<number> }}
 */
export function evaluateSentenceAttempt(tokens, userInputs, variants = []) {
  const errorIndices = [];
  const correctIndices = [];

  tokens.forEach((token, idx) => {
    const input = normalizeWord(userInputs[idx] || '');
    const expected = token.cleanWord;

    // Checa variante específica para este slot (ex: "I am" para "I'm")
    const isVariantMatch = variants.some(v => v.slot === idx && normalizeWord(v.text) === input);

    if (input === expected || isVariantMatch) {
      correctIndices.push(idx);
    } else {
      errorIndices.push(idx);
    }
  });

  return {
    isCorrect: errorIndices.length === 0 && userInputs.length >= tokens.length,
    errorIndices,
    correctIndices
  };
}

/**
 * Gerenciador de eventos de teclado de baixo nível para navegação entre slots.
 * Suporta teclas mortas (Dead Keys / ABNT2) via event.isComposing.
 *
 * @param {KeyboardEvent} event - Evento original do navegador.
 * @param {number} currentIndex - Índice do slot atualmente em foco.
 * @param {number} totalSlots - Quantidade total de slots da frase.
 * @param {Object} actions - Callbacks de navegação { focusSlot, submit, playKeySound }.
 */
export function handleSlotKeydown(event, currentIndex, totalSlots, actions = {}) {
  // Ignora teclas enquanto o IME / Dead Key estiver compondo caractere (ex: apóstrofo ou acento)
  if (event.isComposing || event.keyCode === 229) {
    return;
  }

  const { focusSlot, submit, playKeySound } = actions;
  const inputEl = event.target;

  // 1. Barra de Espaço: Avança para o próximo campo ou submete se for o último
  if (event.key === ' ' || event.code === 'Space') {
    event.preventDefault();
    if (currentIndex < totalSlots - 1) {
      if (typeof focusSlot === 'function') focusSlot(currentIndex + 1);
    } else {
      if (typeof submit === 'function') submit();
    }
    return;
  }

  // 2. Tecla Enter: Submete a frase diretamente
  if (event.key === 'Enter') {
    event.preventDefault();
    if (typeof submit === 'function') submit();
    return;
  }

  // 3. Backspace em campo vazio: Recua para o campo anterior
  if (event.key === 'Backspace' && inputEl.value === '') {
    event.preventDefault();
    if (currentIndex > 0 && typeof focusSlot === 'function') {
      focusSlot(currentIndex - 1, true); // true = move cursor para o fim
    }
    return;
  }

  // 4. Seta para Esquerda no início do campo
  if (event.key === 'ArrowLeft' && inputEl.selectionStart === 0) {
    if (currentIndex > 0 && typeof focusSlot === 'function') {
      event.preventDefault();
      focusSlot(currentIndex - 1, true);
    }
    return;
  }

  // 5. Seta para Direita no final do campo
  if (event.key === 'ArrowRight' && inputEl.selectionEnd === inputEl.value.length) {
    if (currentIndex < totalSlots - 1 && typeof focusSlot === 'function') {
      event.preventDefault();
      focusSlot(currentIndex + 1, false);
    }
    return;
  }

  // 6. Feedback mecânico de tecla para caracteres imprimíveis normais
  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (typeof playKeySound === 'function') {
      playKeySound();
    }
  }
}
