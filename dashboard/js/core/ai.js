// dashboard/js/core/ai.js — cliente de IA do dashboard.
// Na extensão: passa pelo service worker (action 'ai_chat'), que respeita BYOK.
// Na web (Vercel): chama a Edge Function segura direto com o token de sessão.

import { db as lfDb } from '../../../utils/db.js';
import { buildStoryVarietyNote, buildLevelNote, levelSpecFor, recentStorySnippets } from '../../../utils/story-variety.js';

const EDGE_URL = 'https://qnutoswrufznztoznlql.supabase.co/functions/v1/deepseek-chat';
const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;

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

export async function assessPronunciationAudio(audioBlob, expectedText) {
  if (!(audioBlob instanceof Blob) || audioBlob.size === 0) throw new Error('Gravação vazia.');
  if (audioBlob.size > 1_500_000) throw new Error('Gravação grande demais. Tente uma frase mais curta.');
  const token = await lfDb._getToken();
  if (!token) throw new Error('Faça login para avaliar sua fala.');

  // MediaRecorder varia por plataforma (desktop costuma gerar WebM/Opus;
  // celulares podem gerar MP4/AAC). O provedor multimodal é mais previsível
  // com WAV PCM mono, então normalizamos localmente antes do envio.
  let preparedBlob = audioBlob;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      const context = new AudioContextClass();
      try {
        const decoded = await context.decodeAudioData(await audioBlob.arrayBuffer());
        const samples = new Float32Array(decoded.length);
        for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
          const source = decoded.getChannelData(channel);
          for (let i = 0; i < source.length; i += 1) samples[i] += source[i] / decoded.numberOfChannels;
        }
        const wav = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(wav);
        const write = (offset, text) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
        write(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); write(8, 'WAVE');
        write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
        view.setUint16(22, 1, true); view.setUint32(24, decoded.sampleRate, true);
        view.setUint32(28, decoded.sampleRate * 2, true); view.setUint16(32, 2, true);
        view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples.length * 2, true);
        samples.forEach((sample, index) => {
          const clamped = Math.max(-1, Math.min(1, sample));
          view.setInt16(44 + index * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
        });
        preparedBlob = new Blob([wav], { type: 'audio/wav' });
      } finally {
        await context.close().catch(() => {});
      }
    }
  } catch (error) {
    console.warn('[Voice] Não foi possível normalizar para WAV; mantendo formato original.', error?.name || 'Error');
  }

  const audioBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível preparar a gravação.'));
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.readAsDataURL(preparedBlob);
  });
  const mime = String(preparedBlob.type || '').toLowerCase();
  const format = mime.includes('ogg') ? 'ogg'
    : mime.includes('mp4') ? 'm4a'
      : mime.includes('mpeg') ? 'mp3'
        : mime.includes('wav') ? 'wav'
          : 'webm';

  const response = await fetch(EDGE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'assess_pronunciation',
      consent: true,
      expected_text: String(expectedText || '').slice(0, 500),
      audio_base64: audioBase64,
      audio_format: format,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível avaliar a gravação.');
  if (!Number.isFinite(data.score)) throw new Error('A avaliação retornou um formato inválido.');
  return data;
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

function levelNote(level) {
  if (!level) return 'Nível do aluno desconhecido: assuma A2/B1 e evite termos técnicos sem explicar.';
  const styles = {
    A1: 'Use frases curtíssimas, vocabulário mínimo e muitos exemplos traduzidos. Zero jargão.',
    A2: 'Frases curtas, exemplos do dia a dia, sempre com tradução. Jargão só se explicado com analogia.',
    B1: 'Pode usar termos simples (ex: "passado", "verbo"), sempre amarrados a um exemplo prático.',
    B2: 'Explique nuances e registro (formal/informal). Exemplos sem tradução quando forem óbvios.',
    C1: 'Foque em nuance, colocações e naturalidade. Compare alternativas que um nativo usaria.',
    C2: 'Trate como quase-nativo: registro, ironia, variações regionais, sutilezas de uso.',
  };
  return `O aluno tem nível CEFR ${level}. ${styles[level] || ''}`;
}

export function grammarTutorPersona(sentence, word, level) {
  return `Você é um poliglota brasileiro que ensina FLUÊNCIA, não gramática. Você conversa como um amigo que já passou pelo mesmo caminho — zero gramatiquês.
A frase que o aluno está estudando: "${sentence}" (palavra-foco: "${word}").
${levelNote(level)}

REGRAS (obrigatórias):
- Responda SÓ o que foi perguntado. Nada além. NUNCA explique sem pergunta.
- MÁXIMO ~80 palavras. Uma ideia por resposta.
- Foco em USO REAL: o que a frase quer dizer de verdade, quando um nativo usaria, como soa. Nomes técnicos de gramática (ex: "present perfect") só se forem ESSENCIAIS pra dúvida — e aí explique em meia linha o que significam na prática.
- Sempre ancore na frase do aluno, com 1 exemplo do dia a dia se ajudar.
- Português brasileiro informal e acolhedor.
- Formato: HTML simples (<b>, <p>). NUNCA markdown, NUNCA listas longas.`;
}

export function grammarInitialQuestion(sentence, word) {
  return `Me explica essa frase: "${sentence}". O que ela quer dizer de verdade, e qual é a estrutura mais importante nela (se "${word}" fizer parte disso, foque nela)? Bem curto e didático.`;
}

// Fonética BR + traduções da frase e da palavra em UMA chamada só (economiza rate-limit).
export async function enrichCard(word, sentence) {
  const system = `Você é um professor de inglês para brasileiros. Responda APENAS com JSON válido, sem nenhum texto extra.
REGRAS para os campos "*_phon" (Fonética Brasileira = inglês escrito como um brasileiro leria):
- NUNCA traduza palavras dentro da fonética (ex: "should" -> "xud", nunca "deve").
- NUNCA use símbolos IPA (ə, ʃ, θ...). Só letras comuns do português.
- Marque a sílaba tônica com acento (ex: "I think you should call her" -> "Ai fínk iú xud cól rrâr").`;
  const user = `Palavra-foco: "${word}"
Frase: "${sentence}"
Retorne exatamente este JSON:
{
  "sentence_phon": "fonética brasileira da frase inteira",
  "sentence_pt": "tradução natural da frase para português brasileiro",
  "word_phon": "fonética brasileira só da palavra-foco",
  "word_pt": "tradução da palavra-foco NESTE contexto"
}`;

  const content = await aiChat(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { temperature: 0.3, max_tokens: 500 }
  );
  const clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

// Geração de história na web (na extensão o service worker tem 'ai_generate_story').
// Mesmo prompt e mesma resposta { story, level } do service worker.
// onChunk opcional: o texto vai aparecendo enquanto a IA escreve (streaming).
export async function generateStoryWeb(genre, onChunk, userWords = []) {
  const cefr = (await getCefrLevel()) || 'B1';
  // REENCONTRO ESPAÇADO EM CONTEXTO (Marco 3 do motor pedagógico): a história
  // é gerada COM as palavras que o aluno está aprendendo/errando — rever a
  // palavra num contexto NOVO é o que consolida (nenhum concorrente faz bem).
  const reencounter = (userWords || []).slice(0, 8);
  const reencounterNote = reencounter.length
    ? `\nIMPORTANTE: incorpore NATURALMENTE ${Math.min(6, Math.max(4, reencounter.length))} destas palavras/expressões que o aluno está estudando (sem forçar, sem destacar, sem listar): ${reencounter.join(', ')}.`
    : '';
  // Bug 17/07 (dono): prompt byte-idêntico gerava sempre a mesma história.
  // Protagonista/cenário/trama sorteados + "não repita" das histórias
  // recentes do mesmo gênero (mesmo padrão que o quiz já usava).
  const recent = recentStorySnippets(await lfDb.getStories(15).catch(() => []), genre);
  const varietyNote = buildStoryVarietyNote(recent);
  // W5.1 (queixa do dono): tamanho/estruturas/tokens escalam com o nível —
  // antes era "200 a 300 palavras" idêntico para A1 e C2.
  const levelNote = buildLevelNote(cefr);
  const spec = levelSpecFor(cefr);
  const prompt = `Você é um gerador de histórias curtas para estudantes de inglês.
Nível do Estudante: CEFR ${cefr}.
Tema/Gênero da História: ${genre}.
${reencounterNote}
${varietyNote}
${levelNote}
A história deve conter vocabulário útil e natural, com frases bem construídas.
Não traduza a história. Apenas escreva a história em inglês, usando quebras de linha normais para parágrafos.
NÃO use formatação markdown, NÃO coloque um título, apenas o texto da história.`;

  const story = await aiChatStream(
    [{ role: 'user', content: prompt }],
    { temperature: 0.8, max_tokens: spec.maxTokens },
    onChunk
  );
  return { story, level: cefr, requestedWords: reencounter };
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
  const clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(clean);
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
  const clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(clean);
  const mnemonic = typeof parsed.mnemonic === 'string' ? parsed.mnemonic.trim().slice(0, 400) : '';
  if (!mnemonic) throw new Error('IA não retornou um mnemônico válido.');
  return mnemonic;
}

// Geração de chunks na web (na extensão o service worker já tem essa rotina).
export async function generateChunksWeb(word) {
  const system = `Você é um professor de inglês para brasileiros focando no aprendizado por 'chunks' (blocos léxicos).
Seu objetivo é criar 3 frases curtas e muito úteis do dia a dia contendo a palavra ou expressão fornecida.

Para cada frase (chunk), você deve fornecer:
1. "eng": A frase em inglês.
2. "pt": A tradução natural para português brasileiro.
3. "phon": A pronúncia da frase inteira usando EXCLUSIVAMENTE 'Fonética Brasileira' (Inglês escrito como se fala em português).
REGRAS CRÍTICAS PARA "phon":
- NUNCA traduza nenhuma palavra para o português no meio da pronúncia (ex: NUNCA use "deve" para "should", use "xud").
- NUNCA use símbolos do Alfabeto Fonético Internacional (AFI/IPA) como ə, ʌ, ɔ, ʃ, θ. Use apenas letras comuns do alfabeto português.
- Exemplo: "I think you should call her" -> "Ai fink iú xud cól râr".
- Dê bastante ênfase (acentuação) na sílaba tônica.

Responda ÚNICA E EXCLUSIVAMENTE com um objeto JSON válido contendo uma chave "chunks" que guarda o array com os 3 objetos. Nada de texto antes ou depois.`;

  const content = await aiChat(
    [{ role: 'system', content: system }, { role: 'user', content: `Gere os 3 chunks para a palavra/expressão: "${word}"` }],
    { temperature: 0.7, max_tokens: 1000 }
  );
  const clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
    const firstKey = Object.keys(parsed)[0];
    if (Array.isArray(parsed[firstKey])) return parsed[firstKey];
    return [];
  } catch {
    return [];
  }
}
