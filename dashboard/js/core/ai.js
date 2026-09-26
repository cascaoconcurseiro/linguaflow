// dashboard/js/core/ai.js — cliente de IA do dashboard.
// Na extensão: passa pelo service worker (action 'ai_chat').
// Na web (Vercel): chama a Edge Function segura direto com o token de sessão.

import { db as lfDb } from '../../../utils/db.js';
import { buildStoryVarietyNote, buildLevelNote, levelSpecFor, recentStorySnippets, resolveStoryLevel } from '../../../utils/story-variety.js';
import { isValidIpa, cleanIpa } from '../../../utils/ipa-validator.js';

const EDGE_URL = 'https://qnutoswrufznztoznlql.supabase.co/functions/v1/deepseek-chat';
const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id && (typeof location === 'undefined' || location.protocol === 'chrome-extension:');

let _cefrCache;
let _cefrCacheTs = 0;

export async function getCefrLevel() {
  // BUG antigo: cacheava pra sempre — mudar o nível (Configurações/teste de
  // nivelamento) não afetava as histórias até recarregar a página. TTL 30s.
  if (_cefrCache !== undefined && Date.now() - _cefrCacheTs < 30000) return _cefrCache;
  try {
    _cefrCache = (await lfDb.getSetting('lf_cefr_level')) || null;
  } catch {
    _cefrCache = null;
  }
  _cefrCacheTs = Date.now();
  return _cefrCache;
}

export async function aiChat(messages, options = {}) {
  if (isExtension) {
    const res = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action: 'ai_chat', messages, options }, (r) => resolve(r));
      } catch {
        resolve(null);
      }
    });
    if (res && res.content) return res.content;
    // Service worker antigo (sem 'ai_chat') ou erro: tenta a Edge Function direto
  }

  const token = await lfDb._getToken();
  if (!token) throw new Error('Faça login para usar a IA.');

  const response = await fetch(EDGE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: options.temperature ?? 0.6,
      max_tokens: options.max_tokens ?? 800,
    }),
  });

  if (!response.ok) {
    let msg = 'IA indisponível no momento. Tente de novo em instantes.';
    try {
      const err = await response.json();
      if (err && err.error) msg = err.error;
    } catch { /* mantém msg genérica */ }
    throw new Error(msg);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('A IA não retornou resposta.');
  return content;
}

// Streaming: o texto aparece ENQUANTO a IA gera (espera percebida ~1s).
// onChunk(delta, fullSoFar) é chamado a cada pedaço. Na extensão (sem stream
// via sendMessage) cai no aiChat normal e entrega tudo de uma vez no final.
export async function aiChatStream(messages, options = {}, onChunk) {
  if (isExtension) {
    const content = await aiChat(messages, options);
    if (onChunk) onChunk(content, content);
    return content;
  }

  const token = await lfDb._getToken();
  if (!token) throw new Error('Faça login para usar a IA.');

  const response = await fetch(EDGE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: options.temperature ?? 0.6,
      max_tokens: options.max_tokens ?? 800,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    // Fallback: modo normal (erro vira mensagem legível lá dentro)
    const content = await aiChat(messages, options);
    if (onChunk) onChunk(content, content);
    return content;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop(); // linha possivelmente incompleta fica pro próximo chunk
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const data = t.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const delta = JSON.parse(data).choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          if (onChunk) onChunk(delta, full);
        }
      } catch { /* chunk parcial — ignora */ }
    }
  }

  if (!full) throw new Error('A IA não retornou resposta.');
  return full;
}

export function safeParseJson(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {}

  const firstBrace = clean.indexOf('{');
  const firstBracket = clean.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = clean.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = clean.lastIndexOf(']');
  }

  if (startIdx !== -1 && endIdx > startIdx) {
    try {
      const extracted = clean.slice(startIdx, endIdx + 1);
      return JSON.parse(extracted);
    } catch {}
  }

  return null;
}

// IPA + traduções da frase e da palavra com Cache Léxico Canônico (FinOps & Latência).
export async function enrichCard(word, sentence) {
  const normWord = String(word || '').trim();
  const normSentence = String(sentence || '').trim();

  // 1. Consulta o cache canônico no Supabase / memória local
  try {
    const cached = await lfDb.getCanonicalLexicon(normWord);
    if (cached) {
      const normSentLower = normSentence.toLowerCase();
      // Se não há frase ou a frase é a própria palavra, retorna os dados canônicos da palavra
      if (!normSentence || normSentLower === normWord.toLowerCase()) {
        const safeCachedWordPhon = isValidIpa(cached.word_phon) ? cleanIpa(cached.word_phon) : '';
        return {
          sentence_phon: '',
          sentence_pt: '',
          word_phon: safeCachedWordPhon,
          word_pt: cached.word_pt || '',
          _cached: true,
        };
      }

      // Se há frase, busca se esse contexto exato já foi enriquecido anteriormente
      const matchingContext = Array.isArray(cached.contexts)
        ? cached.contexts.find((ctx) => String(ctx?.sentence || '').trim().toLowerCase() === normSentLower)
        : null;

      if (matchingContext) {
        const safeSentPhon = isValidIpa(matchingContext.sentence_phon) ? cleanIpa(matchingContext.sentence_phon) : '';
        const safeWordPhon = isValidIpa(cached.word_phon) ? cleanIpa(cached.word_phon) : '';
        return {
          sentence_phon: safeSentPhon,
          sentence_pt: matchingContext.sentence_pt || '',
          word_phon: safeWordPhon,
          word_pt: matchingContext.word_pt || cached.word_pt || '',
          _cached: true,
        };
      }
    }
  } catch (err) {
    console.warn('[AI] Erro ao consultar cache canônico, prosseguindo com IA:', err);
  }

  // 2. Cache miss: chama o modelo de IA com regras estritas de IPA
  const system = `Você é um linguista e professor de inglês para brasileiros. Responda APENAS com JSON válido, sem texto extra.
REGRAS OBRIGATÓRIAS para os campos "*_phon" (IPA):
- Use EXCLUSIVAMENTE o Alfabeto Fonético Internacional (AFI/IPA) no padrão do inglês americano (General American), sempre entre barras /.../.
- PROIBIÇÃO TOTAL: NUNCA gere pronúncia abrasileirada, respelling fonético ou aproximações ortográficas em português (JAMAIS escreva coisas como "Uí", "fót", "répin", "bât", "dén", "dídnt", "kent", etc.).
- Preserve fonemas autênticos do inglês: /θ/, /ð/, /æ/, /ɪ/, /ə/, /ŋ/, acento primário ˈ e secundário ˌ.
- Connected speech: transcreva linking e reduções via símbolos IPA formais (ex: /wi ˈθɔt əv ˈræpɪŋ ɪt, bət ðɛn ˈdɪdənt/).
- Se não souber a transcrição exata no padrão IPA, deixe o campo como string vazia "".
REGRAS para os campos "*_pt":
- Traduza a frase INTEIRA para português brasileiro natural, pelo sentido e contexto.
- NÃO deixe palavras ou expressões em inglês dentro da tradução, nem empréstimos como "fist bump". Traduza a intenção.
- Preserve nomes próprios, mas nunca produza uma mistura de português e inglês.`;

  const user = `Palavra-foco: "${normWord}"
Frase: "${normSentence}"
Retorne exatamente este JSON:
{
  "sentence_phon": "/transcrição IPA estrita da frase inteira/",
  "sentence_pt": "tradução natural da frase para português brasileiro",
  "word_phon": "/transcrição IPA estrita só da palavra-foco/",
  "word_pt": "tradução da palavra-foco NESTE contexto"
}`;

  const content = await aiChat(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { temperature: 0.1, max_tokens: 500 }
  );
  let parsed = safeParseJson(content);

  // Se retornou fonética inválida/abrasileirada, rejeita e regenera uma vez com reforço de IPA
  const rawSentPhon = parsed?.sentence_phon;
  const rawWdPhon = parsed?.word_phon;
  const sentInvalid = rawSentPhon && !isValidIpa(rawSentPhon);
  const wordInvalid = rawWdPhon && !isValidIpa(rawWdPhon);

  if (sentInvalid || wordInvalid) {
    try {
      const retryContent = await aiChat(
        [
          { role: 'system', content: system },
          { role: 'user', content: user },
          { role: 'assistant', content },
          {
            role: 'user',
            content: 'ERRO: A resposta anterior utilizou aproximação fonética/abrasileirada inválida. É PROIBIDO usar ortografia do português. Forneça EXCLUSIVAMENTE o Alfabeto Fonético Internacional (IPA) entre barras /.../ para os campos "*_phon" ou deixe-os vazios "".',
          },
        ],
        { temperature: 0.1, max_tokens: 500 }
      );
      const retryParsed = safeParseJson(retryContent);
      if (retryParsed) {
        parsed = { ...parsed, ...retryParsed };
      }
    } catch (e) {
      console.warn('[AI] Falha na regeneração de IPA:', e);
    }
  }

  if (parsed) {
    parsed.sentence_phon = isValidIpa(parsed.sentence_phon) ? cleanIpa(parsed.sentence_phon) : '';
    parsed.word_phon = isValidIpa(parsed.word_phon) ? cleanIpa(parsed.word_phon) : '';
  }

  // 3. Persiste assincronamente no cache canônico para os próximos acessos
  if (parsed && (parsed.word_phon || parsed.sentence_pt || parsed.word_pt)) {
    lfDb.saveCanonicalLexicon({
      word: normWord,
      word_phon: parsed.word_phon || null,
      word_pt: parsed.word_pt || null,
      context: normSentence ? {
        sentence: normSentence,
        sentence_phon: parsed.sentence_phon || '',
        sentence_pt: parsed.sentence_pt || '',
        word_pt: parsed.word_pt || '',
      } : null,
    }).catch((err) => console.warn('[AI] Falha ao persistir no cache canônico:', err));
  }

  return parsed;
}

// Geração de história na web (na extensão o service worker tem 'ai_generate_story').
// Mesmo prompt e mesma resposta { story, level } do service worker.
// onChunk opcional: o texto vai aparecendo enquanto a IA escreve (streaming).
export async function generateStoryWeb(genre, onChunk, userWords = [], options = {}) {
  const learnerLevel = (await getCefrLevel()) || 'B1';
  const cefr = resolveStoryLevel(learnerLevel, options?.level, options?.difficultyMode);
  const targetMinutes = [3, 5, 10].includes(Number(options?.targetMinutes)) ? Number(options.targetMinutes) : 5;
  const learningGoal = ['comfortable', 'vocabulary', 'challenge'].includes(options?.learningGoal)
    ? options.learningGoal : 'comfortable';
  const reencounter = (userWords || []).slice(0, 8);

  // OTIMIZAÇÃO DE CUSTOS E TOKENS: se o aluno não tem termos específicos de reencontro
  // e não forçou a criação de uma história do zero (forceNew !== true), verifica se
  // já existe uma história salva com o mesmo gênero e nível no acervo local/banco.
  if (!options?.forceNew && reencounter.length === 0) {
    try {
      const savedStories = await lfDb.getStories(30).catch(() => []);
      const reusable = savedStories.find(s => s.genre === genre
        && (s.requested_level === cefr || (!s.requested_level && s.level === cefr))
        && (!s.target_minutes || Number(s.target_minutes) === targetMinutes)
        && (!s.learning_goal || s.learning_goal === learningGoal));
      if (reusable && (reusable.content || reusable.story)) {
        const text = reusable.content || reusable.story;
        if (onChunk) onChunk(text, text);
        return { story: text, level: cefr, requestedWords: [], reused: true, targetMinutes, learningGoal };
      }
    } catch { /* se falhar o reuso, segue pro streaming normal */ }
  }

  const reencounterNote = reencounter.length
    ? `\nIMPORTANTE: incorpore NATURALMENTE ${Math.min(6, Math.max(4, reencounter.length))} destas palavras/expressões que o aluno está estudando (sem forçar, sem destacar, sem listar): ${reencounter.join(', ')}.`
    : '';
  const recent = recentStorySnippets(await lfDb.getStories(15).catch(() => []), genre);
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

  const story = await aiChatStream(
    [{ role: 'user', content: prompt }],
    { temperature: 0.8, max_tokens: spec.maxTokens },
    onChunk
  );
  return { story, level: cefr, requestedWords: reencounter, targetMinutes, learningGoal, promptVersion: 'story-v2' };
}

// Onda 3.2 — Fase 4 do nivelamento: corrige a mini-produção escrita como um
// examinador Cambridge corrigiria (rubric de gramática/vocabulário/coesão),
// devolvendo um ajuste pequeno (-1/0/+1 banda) — nunca decide o nível sozinha,
// só confirma ou nuança o resultado objetivo do vocabulário/cloze/listening.
export async function gradeWriting(text, prompt, estimatedLevel) {
  const system = `Você é um examinador certificado de proficiência em inglês (padrão Cambridge/CEFR), avaliando um aluno brasileiro cujo nível estimado por outras provas é ${estimatedLevel}.
Avalie o texto pelos critérios: gramática, vocabulário, coesão/coerência e adequação à tarefa pedida.
Responda APENAS com JSON válido:
{
  "adjust": -1 | 0 | 1,
  "feedback": "até 2 frases em português, diretas, sem elogio vazio — aponte o principal erro ou acerto"
}
"adjust" = -1 se o texto está CLARAMENTE abaixo do nível estimado (muitos erros básicos pro nível); 0 se compatível; +1 APENAS se claramente acima (raro). Nunca ajuste mais de 1 banda.`;
  const user = `Tarefa pedida: ${prompt}\n\nTexto do aluno:\n${text}`;
  const content = await aiChat(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { temperature: 0.3, max_tokens: 300 }
  );
  const parsed = safeParseJson(content) || {};
  const adjust = [-1, 0, 1].includes(parsed.adjust) ? parsed.adjust : 0;
  const feedback = typeof parsed.feedback === 'string' ? parsed.feedback.slice(0, 400) : '';
  return { adjust, feedback };
}

// Onda 3.3 (Linguista) — mnemônico estilo Memrise: uma associação memorável
// e curta pra fixar a palavra (som parecido em português, imagem mental,
// trocadilho). Gerado uma vez e salvo no card (words.mnemonic) — não é
// regerado a cada abertura do card.
export async function generateMnemonic(word, translation, sentence) {
  const system = `Você é especialista em técnicas de memorização de vocabulário (mnemônicos), no estilo do Memrise.
Crie UM mnemônico curto e memorável em português pra ajudar um brasileiro a lembrar da palavra em inglês.
Use um destes recursos, o que funcionar melhor pra essa palavra específica: som parecido com uma palavra/expressão em português, uma imagem mental vívida e um pouco exagerada, ou uma história-relâmpago de 1 frase ligando a palavra ao significado.
Responda APENAS com JSON válido: {"mnemonic": "1-2 frases em português, direto, sem introdução tipo 'aqui está'"}`;
  const user = `Palavra: "${word}"\nTradução: "${translation}"${sentence ? `\nFrase de exemplo: "${sentence}"` : ''}`;
  const content = await aiChat(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { temperature: 0.8, max_tokens: 200 }
  );
  const parsed = safeParseJson(content) || {};
  const mnemonic = typeof parsed.mnemonic === 'string' ? parsed.mnemonic.trim().slice(0, 400) : '';
  if (!mnemonic) throw new Error('IA não retornou um mnemônico válido.');
  return mnemonic;
}

// Geração de chunks na web (na extensão o service worker já tem essa rotina).
export async function generateChunksWeb(word, context = '') {
  const system = `Você é um linguista e professor de inglês para brasileiros focando no aprendizado por 'chunks' (blocos léxicos).
Seu objetivo é identificar a unidade que vale aprender na ocorrência real e só depois sugerir no máximo 2 variações úteis.

Quando houver uma frase de origem, ela é a autoridade. Não substitua a ocorrência por uma frase genérica e não escolha um sentido que não esteja sustentado por ela.

Para cada frase (chunk), você deve fornecer:
1. "eng": A frase em inglês.
2. "pt": A tradução natural para português brasileiro.
3. "phon": A transcrição IPA da pronúncia natural da frase inteira.
REGRAS OBRIGATÓRIAS E CRÍTICAS PARA "phon":
- Use EXCLUSIVAMENTE símbolos do Alfabeto Fonético Internacional (AFI/IPA) no padrão do inglês americano (General American), sempre entre barras /.../.
- PROIBIÇÃO TOTAL: NUNCA gere pronúncia abrasileirada, respelling fonético ou aproximações ortográficas em português (JAMAIS escreva coisas como "Uí", "fót", "répin", "bât", "dén", "dídnt", "kent", etc.).
- Preserve fonemas autênticos do inglês: /θ/, /ð/, /æ/, /ɪ/, /ə/, /ŋ/, acento primário ˈ e secundário ˌ.
- Connected speech: transcreva linking e reduções via notação IPA formal (ex: /wi ˈθɔt əv ˈræpɪŋ ɪt, bət ðɛn ˈdɪdənt/).
- Se não souber a transcrição exata no padrão IPA, deixe o campo "phon" como string vazia "".

O primeiro objeto deve ser a frase de origem, com "is_context": true.
O segundo deve ser a unidade lexical principal, com "is_learning_unit": true.
Os próximos objetos, se houver, são variações curtas e naturais, nunca desconectadas do sentido encontrado.

Responda ÚNICA E EXCLUSIVAMENTE com um objeto JSON válido contendo uma chave "chunks". Nada de texto antes ou depois.
Exemplo de formato esperado:
{
  "chunks": [
    { "eng": "I can't get over what happened.", "pt": "Eu não consigo superar o que aconteceu.", "phon": "/aɪ kænt ɡɛt ˈoʊvər wʌt ˈhæpənd/", "is_context": true },
    { "eng": "get over", "pt": "superar / deixar para trás", "phon": "/ɡɛt ˈoʊvər/", "is_learning_unit": true },
    { "eng": "I still haven't gotten over it.", "pt": "Eu ainda não consegui superar isso.", "phon": "/aɪ stɪl ˈhævənt ˈɡɑːtn̩ ˈoʊvər ɪt/" }
  ]
}`;

  const user = context
    ? `Palavra ou expressão selecionada: "${word}"\nFrase de origem do vídeo: "${context}"\nIdentifique a unidade lexical que deve ser aprendida nesta ocorrência.`
    : `Palavra ou expressão: "${word}"\nNão há frase de origem disponível. Gere uma ocorrência curta e deixe claro o sentido da unidade.`;

  const content = await aiChat(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { temperature: 0.7, max_tokens: 1000 }
  );
  let parsed = safeParseJson(content);
  let list = [];
  if (Array.isArray(parsed)) list = parsed;
  else if (parsed && typeof parsed === 'object') {
    const firstKey = Object.keys(parsed)[0];
    if (Array.isArray(parsed[firstKey])) list = parsed[firstKey];
  }

  // Se qualquer chunk retornou fonética abrasileirada/inválida, tenta uma regeneração corretiva
  const hasInvalidPhon = list.some((c) => c && c.phon && !isValidIpa(c.phon));
  if (hasInvalidPhon) {
    try {
      const retryContent = await aiChat(
        [
          { role: 'system', content: system },
          { role: 'user', content: user },
          { role: 'assistant', content },
          {
            role: 'user',
            content: 'ERRO: A resposta anterior continha aproximação fonética/abrasileirada inválida no campo "phon". É PROIBIDO usar ortografia do português. Forneça estritamente símbolos do Alfabeto Fonético Internacional (IPA) entre barras /.../ ou deixe o campo vazio "".',
          },
        ],
        { temperature: 0.1, max_tokens: 1000 }
      );
      const retryParsed = safeParseJson(retryContent);
      if (Array.isArray(retryParsed)) list = retryParsed;
      else if (retryParsed && typeof retryParsed === 'object') {
        const k = Object.keys(retryParsed)[0];
        if (Array.isArray(retryParsed[k])) list = retryParsed[k];
      }
    } catch (e) {
      console.warn('[AI] Falha na regeneração de chunks IPA:', e);
    }
  }

  return list.map((chunk) => {
    if (!chunk || typeof chunk !== 'object') return chunk;
    const validPhon = isValidIpa(chunk.phon) ? cleanIpa(chunk.phon) : '';
    return { ...chunk, phon: validPhon };
  });
}
