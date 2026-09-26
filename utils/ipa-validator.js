// utils/ipa-validator.js — Validação estrita de IPA (International Phonetic Alphabet)
// Elimina terminantemente pronúncia abrasileirada, respellings em português e aproximações ortográficas.

// Acentos e caracteres do português que NUNCA existem em transcrições IPA do inglês americano:
const PORTUGUESE_ACCENTS = /[áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/;

// Tokens característicos de respelling / pronúncia abrasileirada informal:
const ABRASILEIRADO_TOKENS = /\b(uí|fót|óv|répin|rrépin|bât|dén|dídnt|dídânt|kent|ôuver|uót|répennd|stil|révent|góten|tchá|tchu|dja|dju)\b/i;

// Dígrafos típicos do português ausentes do IPA:
const ABRASILEIRADO_DIGRAPHS = /\brr|rr\b|rr|nh|lh/i;

// Conjunto estrito de caracteres permitidos no IPA em inglês:
// Inclui vogais, consoantes IPA, marcadores suprassegmentais (ˈ, ˌ, ː) e separadores fonéticos.
const IPA_ALLOWED_CHARS = /^[a-zɡθðʃʒŋɹɾʔɫʍæɛɪɔʊʌəɜɝɚɑɒiuoˈˌːˑ̩̃˞̚͜͡ \t,.\-?!'/[\]()]+$/i;

// Símbolos fonéticos distintivos do IPA (vogais fonéticas, consoantes não-latinas, acento primário/secundário):
const DISTINCTIVE_IPA_SYMBOLS = /[ˈˌθðʃʒŋɹɾʔɫʍæɛɪɔʊʌəɜɝɚɑɒː̩˞]/;

/**
 * Extrai o miolo fonético removendo delimitadores /.../ ou [...] e rótulos opcionais.
 * @param {string} text
 * @returns {string}
 */
export function extractIpaBody(text) {
  if (typeof text !== 'string') return '';
  let str = text.trim();
  // Remove prefixos acidentais como "Pronúncia (IPA):" ou "IPA:"
  str = str.replace(/^(?:pronúncia\s*\(?ipa\)?|ipa)\s*:\s*/i, '').trim();

  // Remove barras ou colchetes externos
  if ((str.startsWith('/') && str.endsWith('/')) || (str.startsWith('[') && str.endsWith(']'))) {
    if (str.length >= 2) {
      str = str.slice(1, -1).trim();
    }
  }
  // Remove ponto final acidental de pontuação ortográfica no fim da frase fonética
  if (str.endsWith('.') && !str.endsWith('..') && !str.includes('. ')) {
    str = str.replace(/\.+$/, '').trim();
  }
  return str;
}

/**
 * Validador rigoroso de transcrição no Alfabeto Fonético Internacional (IPA).
 * Retorna true se e somente se o texto for uma transcrição IPA autêntica.
 * Rejeita qualquer aproximação abrasileirada, respelling ou vazamento de texto comum.
 *
 * @param {any} text
 * @returns {boolean}
 */
export function isValidIpa(text) {
  if (typeof text !== 'string') return false;
  const raw = text.trim();
  if (!raw || raw.length === 0) return false;

  // 1. Proibição absoluta: diacríticos e letras acentuadas da ortografia portuguesa
  if (PORTUGUESE_ACCENTS.test(raw)) return false;

  // 2. Proibição absoluta: termos abrasileirados conhecidos
  if (ABRASILEIRADO_TOKENS.test(raw)) return false;

  // 3. Proibição de dígrafos ortográficos não-IPA
  if (ABRASILEIRADO_DIGRAPHS.test(raw)) return false;

  const body = extractIpaBody(raw);
  if (!body || body.length === 0) return false;

  // 4. Verificação de caracteres válidos
  if (!IPA_ALLOWED_CHARS.test(body)) return false;

  const hadDelimiters = (raw.startsWith('/') && raw.endsWith('/')) || (raw.startsWith('[') && raw.endsWith(']'));
  const hasDistinctiveIpa = DISTINCTIVE_IPA_SYMBOLS.test(body);

  // 5. Frases com mais de uma palavra ou expressões com mais de 4 caracteres
  // precisam obrigatoriamente conter símbolos fonéticos autênticos do IPA
  const isMultiWord = body.includes(' ');
  if (isMultiWord || body.length > 4) {
    if (!hasDistinctiveIpa) return false;
  } else {
    // Para palavras curtas isoladas (ex: /bed/), precisa de delimitadores ou de símbolo IPA
    if (!hadDelimiters && !hasDistinctiveIpa) return false;
  }

  return true;
}

/**
 * Normaliza e limpa uma transcrição IPA garantindo delimitação padrão /.../.
 * Se a transcrição for inválida ou abrasileirada, retorna string vazia "".
 *
 * @param {any} text
 * @returns {string}
 */
export function cleanIpa(text) {
  if (!isValidIpa(text)) return '';
  const body = extractIpaBody(text);
  if (!body) return '';
  return `/${body}/`;
}
