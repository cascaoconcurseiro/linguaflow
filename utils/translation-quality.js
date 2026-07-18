function words(text) {
  return String(text || '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[a-z]+(?:'[a-z]+)?/g) || [];
}

// Uma tradução pode conter palavras iguais por acaso (nomes e cognatos), mas
// copiar duas palavras inglesas consecutivas do original é um forte sinal de
// tradução híbrida. O detector é conservador para não invalidar "Nova York".
export function hasSourcePhraseLeak(sourceText, translatedText) {
  const source = words(sourceText);
  const translated = words(translatedText);
  if (source.length < 2 || translated.length < 2) return false;

  const translatedPairs = new Set();
  for (let i = 0; i < translated.length - 1; i += 1) {
    translatedPairs.add(`${translated[i]} ${translated[i + 1]}`);
  }
  for (let i = 0; i < source.length - 1; i += 1) {
    if (translatedPairs.has(`${source[i]} ${source[i + 1]}`)) return true;
  }
  return false;
}
