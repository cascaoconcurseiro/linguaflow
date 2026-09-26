// background/ai-generator.js
import {
  buildStoryVarietyNote,
  buildLevelNote,
  levelSpecFor,
  recentStorySnippets,
  resolveStoryLevel,
} from '../utils/story-variety.js';

let isBackfilling = false;

/**
 * Palavras do aluno pro REENCONTRO na história:
 * fracas primeiro (3+ lapsos/leech), depois em aprendizado recente. Máx 8.
 * @param {object} db
 * @returns {Promise<string[]>}
 */
export async function getReencounterWordsSW(db) {
  try {
    const [cards, words] = await Promise.all([db.getAllCards(), db.getAllWords()]);
    const wordById = {};
    words.forEach((w) => { wordById[w.id] = w; });
    const nameOf = (c) => wordById[c.word_id]?.word;
    const weak = cards
      .filter((c) => !c.suspended && ((c.lapses || 0) >= 3 || c.is_leech))
      .sort((a, b) => (b.lapses || 0) - (a.lapses || 0))
      .map(nameOf)
      .filter(Boolean);
    const inProgress = cards
      .filter((c) => !c.suspended && (c.status === 'learning' || c.status === 'review'))
      .sort((a, b) => new Date(b.last_review || 0) - new Date(a.last_review || 0))
      .map(nameOf)
      .filter(Boolean);
    return [...new Set([...weak, ...inProgress])].slice(0, 8);
  } catch {
    return [];
  }
}

/**
 * Cria uma única frase curta e natural em inglês com tradução em português.
 * @param {string} word
 * @param {{ getApiConfig: Function, fetchWithRetry: Function }} context
 * @returns {Promise<{ sentence: string, translation: string } | null>}
 */
export async function generateSentenceWithAI(word, { getApiConfig, fetchWithRetry }) {
  try {
    if (!word) return null;
    const systemPrompt = `Você é um professor de inglês nativo criando material didático.
Crie UMA única frase curta e natural em inglês usando a palavra/expressão: "${word}".
A frase deve ser de nível iniciante/intermediário e fácil de entender o contexto.
Logo na linha de baixo, forneça a tradução exata em português brasileiro.
Retorne EXATAMENTE neste formato (e nada mais):
Frase: [frase em inglês]
Tradução: [tradução em português]`;

    const config = await getApiConfig();
    if (!config?.apiKey) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetchWithRetry(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.7,
        max_tokens: 150,
      }),
    });

    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    const text = (data.choices?.[0]?.message?.content || '').trim();
    if (!text) return null;

    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l);
    let sentence = '';
    let translation = '';

    for (const line of lines) {
      if (line.toLowerCase().startsWith('frase:')) {
        sentence = line.replace(/^(frase:|\*\*frase:\*\*|frase:)\s*/i, '').trim();
      } else if (line.toLowerCase().startsWith('tradução:')) {
        translation = line.replace(/^(tradução:|\*\*tradução:\*\*|tradução:)\s*/i, '').trim();
      }
    }

    if (sentence) {
      return { sentence, translation };
    }
    return null;
  } catch (err) {
    console.error('Erro na IA:', err);
    return { sentence: 'Error generating sentence.', translation: 'Erro ao gerar frase.' };
  }
}

/**
 * Gera uma história envolvente alinhada ao nível CEFR e com palavras de reencontro.
 * @param {string} genre
 * @param {object} options
 * @param {{ db: object, getApiConfig: Function, fetchWithRetry: Function }} context
 * @returns {Promise<object>}
 */
export async function generateStoryWithAI(genre, options = {}, { db, getApiConfig, fetchWithRetry }) {
  try {
    const learnerLevel = (await db.getSetting('lf_cefr_level')) || 'B1';
    const cefr = resolveStoryLevel(learnerLevel, options?.level, options?.difficultyMode);
    const targetMinutes = [3, 5, 10].includes(Number(options?.targetMinutes)) ? Number(options.targetMinutes) : 5;
    const learningGoal = ['comfortable', 'vocabulary', 'challenge'].includes(options?.learningGoal)
      ? options.learningGoal
      : 'comfortable';
    const config = await getApiConfig();
    if (!config?.apiKey) {
      throw new Error('Faça login no LinguaFlow para gerar histórias.');
    }

    const reencounter = await getReencounterWordsSW(db);
    const reencounterNote = reencounter.length
      ? `\nIMPORTANTE: incorpore NATURALMENTE ${Math.min(6, Math.max(4, reencounter.length))} destas palavras/expressões que o aluno está estudando (sem forçar, sem destacar, sem listar): ${reencounter.join(', ')}.`
      : '';

    // Bug 17/07: prompt byte-idêntico gerava sempre a mesma história.
    const recent = recentStorySnippets(await db.getStories(15).catch(() => []), genre);
    const varietyNote = buildStoryVarietyNote(recent);
    const levelNote = buildLevelNote(cefr, { targetMinutes, learningGoal });
    const spec = levelSpecFor(cefr);

    const prompt = `Você é um gerador de histórias envolventes em inglês para estudantes.
Nível do Estudante: CEFR ${cefr}.
Tema/Gênero da História: ${genre}.
${reencounterNote}
${varietyNote}
${levelNote}
DIRETRIZES FUNDAMENTAIS DE FORMATO:
- O texto DEVE ser rico em DIÁLOGOS REAIS entre os personagens (cerca de 60% a 70% da história em conversas diretas que uma pessoa pode usar no mundo real em viagens, trabalho, compras e dia a dia).
- Use aspas inglesas ("...") para as falas e intercale as falas com reações, sentimentos e ações dos personagens.
- O vocabulário e a gramática devem estar RIGOROSAMENTE alinhados ao nível CEFR ${cefr} especificado. Se o nível for A1 ou A2, garanta linguagem simples, direta e acessível, sem palavras difíceis ou tempos verbais complexos fora da banda.
- Não traduza a história. Apenas escreva a história em inglês, diagramada como um livro: separe CADA parágrafo e CADA turno de fala de personagem OBRIGATORIAMENTE com duas quebras de linha (\n\n). NUNCA junte falas de dois personagens no mesmo parágrafo.
- NÃO use formatação markdown, NÃO coloque um título, apenas o texto da história.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetchWithRetry(config.apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: spec.maxTokens,
      }),
    });

    clearTimeout(timeoutId);
    if (!response.ok) throw new Error('API Error');
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    return {
      story: text.trim(),
      level: cefr,
      requestedWords: reencounter,
      targetMinutes,
      learningGoal,
      promptVersion: 'story-v2',
    };
  } catch (err) {
    console.error('Erro ao gerar história:', err);
    throw err;
  }
}

/**
 * Gera 3 variações inéditas da frase com o mesmo padrão gramatical.
 * @param {string} word
 * @param {string} sentence
 * @param {{ getApiConfig: Function }} context
 * @returns {Promise<string>}
 */
export async function generateAIVariation(word, sentence, { getApiConfig }) {
  const config = await getApiConfig();
  const prompt = `Você é um professor de inglês inovador.
A frase que estou estudando contém a palavra "${word}": "${sentence}".
Sua tarefa é gerar APENAS 3 frases INÉDITAS usando o mesmo padrão gramatical e a palavra "${word}".
As frases devem ser coloquiais, modernas e úteis (nada de frases de livro de escola).

Regras de Saída:
Não dê explicações. Responda APENAS com a lista numerada, sendo a frase em inglês e a tradução.
1. [Frase 1 em inglês] - [Tradução 1]
2. [Frase 2 em inglês] - [Tradução 2]
3. [Frase 3 em inglês] - [Tradução 3]`;

  const payload = {
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: 300,
    model: config.model,
  };

  const res = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error('API AI falhou ao gerar variações');
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Preenche em background frases e chunks de vocabulário faltantes no cofre.
 * @param {{ db: object, getApiConfig: Function, generateChunksWithAI: Function, notifyDashboards: Function }} context
 */
export async function backfillMissingSentences({ db, getApiConfig, generateChunksWithAI, notifyDashboards }) {
  if (isBackfilling) return;
  isBackfilling = true;
  try {
    const config = await getApiConfig();
    if (!config?.apiKey) {
      isBackfilling = false;
      return;
    }

    const words = await db.getAllWords();
    const missing = words.filter(
      (w) =>
        w.category !== 'sentence' &&
        (!w.context_sentence || w.context_sentence === w.word || w.context_sentence.trim() === '' || !w.ai_chunks),
    );

    if (missing.length === 0) {
      isBackfilling = false;
      return;
    }
    console.debug(`[LinguaFlow] Iniciando geração automática de frases para ${missing.length} palavras no cofre...`);

    for (const w of missing) {
      try {
        await new Promise((r) => setTimeout(r, 6000)); // Espera 6s para respeitar limites da API (Rate Limit)
        const chunks = await generateChunksWithAI(w.word, w.context_sentence || '');
        if (chunks && chunks.length > 0) {
          const hasGoodVideoContext =
            w.context_sentence && w.context_sentence !== w.word && w.context_sentence.split(' ').length > 2;
          if (!hasGoodVideoContext) {
            w.context_sentence = chunks[0].eng || chunks[0].ingles || chunks[0].english;
          }
          w.ai_chunks = JSON.stringify(chunks);
          await db.saveWord(w);
          console.debug(`[LinguaFlow] Auto-generated chunks for: ${w.word}`);
          notifyDashboards(w.word);
        }
      } catch (e) {
        console.warn(`[LinguaFlow] Failed to auto-generate for ${w.word}:`, e);
      }
    }
    console.debug('[LinguaFlow] Geração automática de frases concluída!');
  } catch (e) {
    console.error('[LinguaFlow] Backfill error:', e);
  } finally {
    isBackfilling = false;
  }
}
