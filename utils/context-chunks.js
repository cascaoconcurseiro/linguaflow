// Estrutura compartilhada para manter o trecho original e a unidade aprendida
// no mesmo card sem misturar isso com exemplos genéricos de IA.
export function mergeContextualChunks(existing, {
  context = '',
  contextTranslation = '',
  contextPhonetic = '',
  learningUnit = '',
  learningTranslation = '',
  learningPhonetic = '',
} = {}) {
  const previous = Array.isArray(existing) ? existing : [];
  const previousContext = previous.find((chunk) => chunk?.is_context) || {};
  const previousUnit = previous.find((chunk) => chunk?.is_learning_unit || chunk?.is_word) || {};
  const contextual = String(context || previousContext.eng || '').trim();
  const unit = String(learningUnit || previousUnit.eng || '').trim();
  const rest = previous.filter((chunk) => (
    chunk && !chunk.is_context && !chunk.is_learning_unit && !chunk.is_word
  ));

  const result = [];
  if (contextual) {
    result.push({
      eng: contextual,
      pt: String(contextTranslation || previousContext.pt || '').trim(),
      phon: String(contextPhonetic || previousContext.phon || '').trim(),
      is_context: true,
    });
  }
  if (unit) {
    result.push({
      eng: unit,
      pt: String(learningTranslation || previousUnit.pt || '').trim(),
      phon: String(learningPhonetic || previousUnit.phon || '').trim(),
      is_learning_unit: true,
    });
  }
  return [...result, ...rest];
}
