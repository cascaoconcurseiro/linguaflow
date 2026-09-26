// content/popup/popup-linguistics.js

/**
 * Normaliza e limpa explicações textuais de IA e dicionário.
 * @param {string} value
 * @returns {string}
 */
export function cleanContextExplanation(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, 4000);
}

/**
 * Falsos cognatos mais perigosos para brasileiros.
 */
export const FALSE_FRIENDS = {
  actually: '"actually" = na verdade / de fato (NÃO "atualmente" → use "currently" ou "nowadays")',
  pretend: '"pretend" = fingir / simular (NÃO "pretender" → use "intend" ou "plan to")',
  eventually: '"eventually" = eventualmente no sentido de "no fim" / "com o tempo" (NÃO "eventualmente" = sometimes → use "occasionally")',
  library: '"library" = biblioteca (NÃO "livraria" → use "bookstore")',
  college: '"college" = faculdade / universidade (NÃO "colégio" = high school)',
  fabric: '"fabric" = tecido / pano (NÃO "fábrica" → use "factory")',
  parents: '"parents" = pais (pai e mãe) (NÃO "parentes" = relatives)',
  push: '"push" = empurrar (NÃO "puxar" = pull)',
  exit: '"exit" = saída (NÃO "êxito" = success)',
  novel: '"novel" = romance (livro) (NÃO "novela" = soap opera = "soap opera")',
  sensible: '"sensible" = sensato / prudente (NÃO "sensível" = sensitive)',
  polite: '"polite" = educado / cortês (NÃO "político" = politician)',
  large: '"large" = grande (NÃO "largo" = wide)',
  assist: '"assist" = ajudar / auxiliar (NÃO "assistir" a um filme → "watch")',
  contest: '"contest" = competição (NÃO "contestar" = dispute/challenge)',
  editor: '"editor" = revisor/redator (NÃO "editor" de livros = publisher)',
  engineer: '"engineer" = engenheiro (NÃO "maquinista" = train driver)',
  exquisite: '"exquisite" = refinado/primoroso (NÃO "esquisito" = weird/strange)',
  genial: '"genial" = simpático/cordial (NÃO "genial" = brilliant → "genius")',
  infamous: '"infamous" = notório/famigerado (NÃO apenas "famoso" = famous)',
  legend: '"legend" = lenda (NÃO "legenda" de vídeo = subtitle/caption)',
  mundane: '"mundane" = entediante/comum (NÃO "mundano" = worldly)',
  realize: '"realize" = perceber/tomar consciência (NÃO "realizar" uma tarefa = carry out/accomplish)',
  resume: '"resume" = retomar (NÃO "resumo" = summary)',
  sympathetic: '"sympathetic" = solidário/compreensivo (NÃO "simpático" = nice/friendly)',
  taxes: '"taxes" = impostos (NÃO "táxis" = taxis)',
  travesty: '"travesty" = paródia/distorção grotesca (NÃO "travesti" = transgender person)',
  vacant: '"vacant" = vago/desocupado (NÃO "vacante" formal → use "empty")',
  versatile: '"versatile" = versátil/multifuncional (NÃO "versátil" geralmente mais positivo em inglês)',
};

/**
 * Expressões idiomáticas comuns para detecção por lookup.
 */
export const COMMON_IDIOMS = new Set([
  'piece of cake',
  'break a leg',
  'hit the nail on the head',
  'under the weather',
  'bite the bullet',
  'beat around the bush',
  'get out of hand',
  'spill the beans',
  'kick the bucket',
  'let the cat out of the bag',
  'hit the sack',
  'cost an arm and a leg',
  'once in a blue moon',
  'the ball is in your court',
  "pull someone's leg",
  'hang in there',
  'cut corners',
  'get cold feet',
  "it's not rocket science",
  'back to the drawing board',
  'bite off more than you can chew',
  'burn bridges',
  'catch someone red-handed',
  "don't judge a book by its cover",
]);

/**
 * Chunks e frases fixas comuns.
 */
export const COMMON_CHUNKS = new Set([
  'as well as',
  'as long as',
  'as soon as',
  'due to',
  'in order to',
  'in spite of',
  'on the other hand',
  'at the same time',
  'in addition to',
  'as a result',
  'by the way',
  'in fact',
  'for example',
  'such as',
  'in terms of',
  'according to',
  'on the contrary',
  'in other words',
  'first of all',
  'last but not least',
  'as a matter of fact',
  'to be honest',
  'you know what',
  'kind of',
  'sort of',
  'a lot of',
  'all of a sudden',
  'at least',
  'at most',
  'come on',
  'figure out',
  'find out',
  'give up',
  'go ahead',
  'go on',
  'look forward to',
  'make sense',
  'no wonder',
  'of course',
  'right away',
  'take care',
  'take part',
  'turn out',
  'used to',
  'what if',
]);

/**
 * Retorna uma cópia do mapa de falsos cognatos.
 */
export function getFalseFriendsMap() {
  return { ...FALSE_FRIENDS };
}

/**
 * Retorna uma cópia do conjunto de expressões idiomáticas comuns.
 */
export function getCommonIdiomsSet() {
  return new Set(COMMON_IDIOMS);
}

/**
 * Retorna uma cópia do conjunto de chunks comuns.
 */
export function getCommonChunksSet() {
  return new Set(COMMON_CHUNKS);
}

/**
 * Detecta se uma palavra é um falso amigo conhecido.
 * @param {string} word
 * @param {object} falseFriendsMap
 * @returns {string|null}
 */
export function detectFalseFriend(word, falseFriendsMap = FALSE_FRIENDS) {
  if (!word || typeof word !== 'string') return null;
  return falseFriendsMap?.[word.toLowerCase().trim()] || null;
}

/**
 * Detecta o tipo linguístico da expressão clicada (suporta flexões e lematização).
 * @param {string} word
 * @param {object} options
 * @returns {{ type: string, label: string, cls: string }}
 */
export function detectExprType(word, {
  idiomSet = COMMON_IDIOMS,
  chunkSet = COMMON_CHUNKS,
  expressionsDB = null,
  matchExpressionCandidate = null,
  getBaseVerbCandidates = null,
  phrasalVerbsDB = null,
  slangsDB = null,
} = {}) {
  const w = String(word || '').toLowerCase().trim();
  const tokens = w.split(/\s+/);
  const isMulti = tokens.length > 1;

  // 1. Expressões idiomáticas e Chunks cadastrados
  if (idiomSet?.has(w)) return { type: 'idiom', label: '🌀 Idiom', cls: 'lfp-type-idiom' };
  if (chunkSet?.has(w)) return { type: 'chunk', label: '🧩 Chunk', cls: 'lfp-type-chunk' };

  // 2. Phrasal Verbs (com lematização, formas flexionadas e partículas separáveis)
  if (isMulti) {
    if (expressionsDB?.has(w)) {
      return { type: 'phrasal', label: '🔗 Phrasal Verb', cls: 'lfp-type-phrasal' };
    }
    if (matchExpressionCandidate && matchExpressionCandidate(tokens)) {
      return { type: 'phrasal', label: '🔗 Phrasal Verb', cls: 'lfp-type-phrasal' };
    }

    if (phrasalVerbsDB) {
      const verbCandidates = getBaseVerbCandidates ? getBaseVerbCandidates(tokens[0]) : [tokens[0]];
      for (const base of verbCandidates) {
        const entries = phrasalVerbsDB[base] || [];
        const canonical = [base, ...tokens.slice(1)].join(' ');
        if (entries.some((e) => {
          const ep = e.phrase?.toLowerCase();
          return ep === w || ep === canonical;
        })) {
          return { type: 'phrasal', label: '🔗 Phrasal Verb', cls: 'lfp-type-phrasal' };
        }
      }
    }
  }

  // 3. Gírias (tanto palavras únicas quanto expressões/gírias compostas ou flexionadas)
  if (slangsDB?.has(w)) {
    return { type: 'slang', label: '🔥 Gíria', cls: 'lfp-type-slang' };
  }
  if (getBaseVerbCandidates) {
    const candidates = getBaseVerbCandidates(tokens[0]);
    for (const base of candidates) {
      if (tokens.length === 1 && slangsDB?.has(base)) {
        return { type: 'slang', label: '🔥 Gíria', cls: 'lfp-type-slang' };
      }
      if (tokens.length > 1) {
        const basePhrase = [base, ...tokens.slice(1)].join(' ');
        if (slangsDB?.has(basePhrase)) {
          return { type: 'slang', label: '🔥 Gíria', cls: 'lfp-type-slang' };
        }
      }
    }
  }

  // 4. Multi-word que não é idiom nem chunk nem phrasal nem gíria → colocação
  if (isMulti) {
    return { type: 'collocation', label: '🤝 Colocação', cls: 'lfp-type-collocation' };
  }

  // 5. Palavras simples: verificar registro pelo dicionário depois — placeholder
  return { type: 'word', label: '📖 Palavra', cls: 'lfp-type-word' };
}

/**
 * Mapeia classes gramaticais em inglês para termos em português.
 * @param {string} pos
 * @returns {string}
 */
export function getPosLabel(pos) {
  const map = {
    noun: 'substantivo',
    verb: 'verbo',
    adjective: 'adjetivo',
    adverb: 'advérbio',
    preposition: 'preposição',
    conjunction: 'conjunção',
    pronoun: 'pronome',
    interjection: 'interjeição',
    article: 'artigo',
    determiner: 'determinante',
    exclamation: 'exclamação',
  };
  return map[pos?.toLowerCase()] || pos || '';
}

/**
 * Retorna a explicação detalhada em HTML da classe gramatical.
 * @param {string} pos
 * @param {string} w
 * @returns {string}
 */
export function getPosDetail(pos, w) {
  const m = {
    noun: `<b style="color:#7dd3fc">Substantivo</b> — Pessoa, lugar, coisa ou ideia.<br>• Artigo: <span style="color:#7dd3fc">a/an/the ${w}</span><br>• Plural: <span style="color:#7dd3fc">${w}s</span> • Possessivo: <span style="color:#7dd3fc">${w}'s</span>`,
    verb: `<b style="color:#4ade80">Verbo</b> — Ação ou estado.<br>• Base: <span style="color:#4ade80">${w}</span> • 3ª pessoa: <span style="color:#4ade80">${w}s</span><br>• Gerúndio: <span style="color:#4ade80">${w}ing</span> • Passado: <span style="color:#4ade80">${w}ed</span><br>• Passiva: <span style="color:#4ade80">be/was ${w}ed</span>`,
    adjective: `<b style="color:#fbbf24">Adjetivo</b> — Descreve substantivos.<br>• Antes do noun: <span style="color:#fbbf24">${w} + noun</span><br>• Após linking verb: <span style="color:#fbbf24">be/seem/look + ${w}</span><br>• Comparativo: <span style="color:#fbbf24">more ${w}</span> • Superlativo: <span style="color:#fbbf24">most ${w}</span>`,
    adverb: `<b style="color:#f472b6">Advérbio</b> — Modifica verbos, adjetivos ou advérbios.<br>• Geralmente termina em <b>-ly</b><br>• Ex: very, quite, rather, too + <span style="color:#f472b6">${w}</span>`,
    preposition: `<b style="color:#a78bfa">Preposição</b> — Relação entre elementos.<br>• Lugar: in, on, at, under, over<br>• Tempo: at, on, in, before, after<br>• Movimento: to, from, into, through`,
  };
  return (
    m[pos?.toLowerCase()] ||
    `<span style="color:#94a3b8">Clique "Analisar com IA" para análise detalhada da classe gramatical desta palavra.</span>`
  );
}

/**
 * Retorna padrões sintáticos comuns da classe gramatical.
 * @param {string} pos
 * @param {string} w
 * @returns {string}
 */
export function getPosPatterns(pos, w) {
  const m = {
    verb: `• <b>S + ${w} + O</b> (transitivo)<br>• <b>S + ${w} + to-inf.</b> (ex: want to ${w})<br>• <b>S + ${w} + -ing</b> (ex: enjoy ${w}ing)<br>• <b>S + ${w} + that clause</b>`,
    noun: `• <b>the/a/an + ${w}</b><br>• <b>adj + ${w}</b> (ex: big/small ${w})<br>• <b>${w} + of + sth</b><br>• <b>compound: ${w}+noun</b>`,
    adjective: `• <b>${w} + noun</b> (atributivo)<br>• <b>be/seem/look/feel/sound + ${w}</b><br>• <b>too + ${w} / ${w} + enough</b><br>• <b>very/quite/rather/extremely + ${w}</b>`,
  };
  return (
    m[pos?.toLowerCase()] ||
    `<span style="color:#94a3b8">Use "Analisar com IA" para ver padrões específicos desta palavra.</span>`
  );
}
