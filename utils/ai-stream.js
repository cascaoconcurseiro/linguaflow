// utils/ai-stream.js — streaming de IA entre service worker e content scripts.
// O deepseek-chat devolve SSE (formato OpenAI) quando recebe stream: true. O
// service worker lê o stream e repassa pedaços por uma porta
// (chrome.runtime.connect), porque sendMessage só entrega uma resposta final.

export const AI_STREAM_PORT = 'lf_ai_stream';

// Lê um Response SSE e chama onText(textoAcumulado) a cada pedaço de conteúdo.
export async function readSseText(response, onText) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buf = '';
  const consume = (line) => {
    const t = line.trim();
    if (!t.startsWith('data:')) return;
    const data = t.slice(5).trim();
    if (!data || data === '[DONE]') return;
    try {
      const delta = JSON.parse(data).choices?.[0]?.delta?.content;
      if (delta) {
        full += delta;
        onText?.(full);
      }
    } catch { /* linha parcial ou keep-alive */ }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    lines.forEach(consume);
  }
  if (buf) consume(buf);
  return full;
}

function cleanField(value) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .trim()
    .replace(/^["“'`]+|["”'`]+$/g, '')
    .trim();
}

// Formato do contexto rápido: "TRADUÇÃO: ...\nEXPLICAÇÃO: ...". Aceita o JSON
// antigo ({translation, explanation}) para não quebrar se o modelo insistir.
// Com partial=true, a tradução só é devolvida depois que a linha fechou —
// evita mostrar "sup" antes de "superou" no título do popup.
export function parseQuickContext(text, { partial = false } = {}) {
  const raw = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      return { translation: cleanField(parsed?.translation), explanation: cleanField(parsed?.explanation) };
    } catch {
      return { translation: '', explanation: '' };
    }
  }
  const translationMatch = partial
    ? raw.match(/TRADU[CÇ][AÃ]O\s*\**\s*:\s*([^\n]*)\n/i)
    : raw.match(/TRADU[CÇ][AÃ]O\s*\**\s*:\s*([^\n]*)/i);
  const explanationMatch = raw.match(/EXPLICA[CÇ][AÃ]O\s*\**\s*:\s*([\s\S]*)/i);
  return {
    translation: cleanField(translationMatch?.[1]),
    explanation: cleanField(explanationMatch?.[1]),
  };
}

// Cache persistente do contexto rápido. O Map em memória do service worker
// morria a cada ~30 s de inatividade; chrome.storage.local sobrevive.
export function createQuickContextCache(storage, { key = 'lf_quick_ctx_v1', max = 300, ttlMs = 30 * 86400000, now = () => Date.now() } = {}) {
  let memory = null;
  let writeChain = Promise.resolve();

  const cacheKey = (word, sentence) =>
    `${String(word || '').toLowerCase().trim()}:::${String(sentence || '').toLowerCase().trim()}`;

  async function load() {
    if (memory) return memory;
    try {
      const stored = await storage.get(key);
      memory = stored?.[key] && typeof stored[key] === 'object' ? stored[key] : {};
    } catch {
      memory = {};
    }
    return memory;
  }

  return {
    async get(word, sentence) {
      const entries = await load();
      const hit = entries[cacheKey(word, sentence)];
      if (!hit || now() - (hit.ts || 0) > ttlMs) return null;
      return { translation: hit.t || null, explanation: hit.e || null };
    },
    set(word, sentence, value) {
      writeChain = writeChain.then(async () => {
        const entries = await load();
        entries[cacheKey(word, sentence)] = { t: value.translation || '', e: value.explanation || '', ts: now() };
        const keys = Object.keys(entries);
        if (keys.length > max) {
          keys.sort((a, b) => (entries[a].ts || 0) - (entries[b].ts || 0));
          for (const old of keys.slice(0, keys.length - max)) delete entries[old];
        }
        await storage.set({ [key]: entries });
      }).catch(() => { /* cache é opcional */ });
      return writeChain;
    },
  };
}

// Cliente (content script): abre uma porta por pedido. onPartial recebe cada
// atualização; isStale() true (usuário trocou de palavra) desconecta a porta,
// o que aborta a chamada no service worker. Resolve com a mensagem final
// ({type:'done', ...} ou {error}) ou null quando a extensão não responde.
export function streamAiRequest(request, { onPartial, isStale } = {}) {
  return new Promise((resolve) => {
    let port;
    try {
      port = chrome.runtime.connect({ name: AI_STREAM_PORT });
    } catch {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      try { port.disconnect(); } catch { /* já desconectada */ }
      resolve(value);
    };
    port.onMessage.addListener((msg) => {
      if (isStale?.()) return finish(null);
      if (msg?.type === 'partial') onPartial?.(msg);
      else if (msg?.type === 'done') finish(msg);
      else if (msg?.type === 'error') finish({ error: msg.error || 'Falha na IA.' });
    });
    port.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      finish(null);
    });
    try {
      port.postMessage(request);
    } catch {
      finish(null);
    }
  });
}
