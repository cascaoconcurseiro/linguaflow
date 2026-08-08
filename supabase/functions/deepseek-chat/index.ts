import { createClient } from "jsr:@supabase/supabase-js@2";

const RATE_LIMIT_PER_MIN = 20;
const MAX_TOKENS_CAP = 2048;
const MAX_AUDIO_BASE64 = 2_000_000;
const MAX_BODY_BYTES = 2_700_000;
const MAX_MESSAGES = 24;
const MAX_TEXT_INPUT_CHARS = 40_000;
const DEFAULT_AUDIO_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";
const MAX_AUDIO_ATTEMPTS = 2;
const QUOTA_ENDPOINT = "deepseek-chat";
const PRIMARY_MODEL = "deepseek-v4-flash";
const UPSTREAM_BUDGET_MS = 45_000;

function corsHeadersFor(origin: string | null) {
  const allowed = !!origin && (origin.startsWith("chrome-extension://") || /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app$/.test(origin) || origin === "http://localhost:3000" || origin === "http://localhost:5173");
  return { "Access-Control-Allow-Origin": allowed ? origin! : "null", "Vary": "Origin", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
}

async function readJsonBody(req: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("payload_too_large");
  const reader = req.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = []; let received = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; if (!value) continue; received += value.byteLength; if (received > maxBytes) { await reader.cancel(); throw new Error("payload_too_large"); } chunks.push(value); }
  const bytes = new Uint8Array(received); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes)); if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_json"); return parsed as Record<string, unknown>; } catch { throw new Error("invalid_json"); }
}

async function consumeQuota(admin: any, userId: string, cors: Record<string, string>): Promise<Response | null> {
  const { data: quotaAllowed, error: quotaError } = await admin.rpc("consume_api_quota", { p_user_id: userId, p_endpoint: QUOTA_ENDPOINT, p_limit: RATE_LIMIT_PER_MIN, p_window_seconds: 60 });
  if (quotaError) { console.error("[deepseek-chat] quota_unavailable", { code: quotaError.code || "db_error" }); return new Response(JSON.stringify({ error: "Serviço temporariamente indisponível." }), { status: 503, headers: cors }); }
  if (quotaAllowed !== true) return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde um minuto e tente de novo." }), { status: 429, headers: cors });
  return null;
}

function validTextMessages(value: unknown): value is Array<{ role: string; content: string }> {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return false; let total = 0;
  for (const message of value) { if (!message || typeof message !== "object") return false; const role = (message as { role?: unknown }).role; const content = (message as { content?: unknown }).content; if (!new Set(["system", "user", "assistant"]).has(String(role)) || typeof content !== "string") return false; total += content.length; if (total > MAX_TEXT_INPUT_CHARS) return false; }
  return true;
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") || ""; const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return new Response(JSON.stringify({ error: "Não autenticado. Faça login no LinguaFlow." }), { status: 401, headers: cors });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Sessão inválida ou expirada. Faça login novamente." }), { status: 401, headers: cors });
    const userId = userData.user.id;
    let body: Record<string, any>;
    try { body = await readJsonBody(req, MAX_BODY_BYTES); } catch (error) { const tooLarge = (error as Error).message === "payload_too_large"; return new Response(JSON.stringify({ error: tooLarge ? "Pedido grande demais." : "Pedido inválido." }), { status: tooLarge ? 413 : 400, headers: cors }); }
    const wantStream = body.stream === true;

    // A rota de áudio é deliberadamente separada: ela usa OpenRouter apenas para avaliação multimodal.
    if (body.action === "assess_pronunciation") {
      const expected = typeof body.expected_text === "string" ? body.expected_text.trim().slice(0, 500) : "";
      const audio = typeof body.audio_base64 === "string" ? body.audio_base64 : "";
      const allowedFormats = new Set(["webm", "ogg", "wav", "mp3", "m4a"]);
      const format = allowedFormats.has(body.audio_format) ? body.audio_format : "webm";
      if (body.consent !== true || !expected || !audio || audio.length > MAX_AUDIO_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(audio)) return new Response(JSON.stringify({ error: "Gravação, frase ou consentimento inválido." }), { status: 400, headers: cors });
      const quotaResponse = await consumeQuota(admin, userId, cors); if (quotaResponse) return quotaResponse;
      const openRouterKey = Deno.env.get("OPENROUTER_API_KEY") || Deno.env.get("OPENROUTER LINGUA");
      if (!openRouterKey) return new Response(JSON.stringify({ error: "Avaliação de voz não configurada no servidor." }), { status: 503, headers: cors });
      const prompt = `Compare a pronúncia do aluno com a frase esperada: "${expected}". Avalie inteligibilidade, palavras omitidas/trocadas e ritmo. Não penalize sotaque brasileiro se estiver inteligível. Responda SOMENTE JSON válido: {"score":0-100,"transcript":"o que ouviu","feedback":"uma frase curta em português","missed_words":["palavras problemáticas"]}`;
      const audioModels = (Deno.env.get("OPENROUTER_AUDIO_MODELS") || DEFAULT_AUDIO_MODEL).split(",").map((model) => model.trim()).filter(Boolean).slice(0, 3);
      let audioResponse: Response | null = null; let providerData: any = null; const providerErrors: Array<{ model: string; attempt: number; status: number; message: string }> = []; const audioDeadline = Date.now() + UPSTREAM_BUDGET_MS;
      for (let attempt = 1; attempt <= MAX_AUDIO_ATTEMPTS; attempt += 1) { for (const model of audioModels) { const remainingMs = audioDeadline - Date.now(); if (remainingMs <= 0) break; if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, 350)); try { audioResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", { signal: AbortSignal.any([req.signal, AbortSignal.timeout(Math.min(20_000, remainingMs))]), method: "POST", headers: { "Authorization": `Bearer ${openRouterKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://linguaflow-web-tau.vercel.app", "X-Title": "LinguaFlow" }, body: JSON.stringify({ model, messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "input_audio", input_audio: { data: audio, format } }] }], temperature: 0.1, max_tokens: 350, stream: false }) }); providerData = await audioResponse.json().catch(() => null); } catch (error) { providerErrors.push({ model, attempt, status: 0, message: (error as Error)?.name || "network_error" }); continue; } if (audioResponse.ok) break; providerErrors.push({ model, attempt, status: audioResponse.status, message: String(providerData?.error?.message || "resposta sem detalhe").slice(0, 300) }); } if (audioResponse?.ok) break; }
      if (!audioResponse?.ok) { console.error("[voice-assessment] OpenRouter failures", providerErrors); return new Response(JSON.stringify({ available: false, fallback: "playback", feedback: "A avaliação automática está temporariamente indisponível. Ouça sua gravação e compare com o modelo." }), { status: 200, headers: cors }); }
      const content = providerData?.choices?.[0]?.message?.content || ""; const jsonMatch = String(content).replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
      try { const assessment = JSON.parse(jsonMatch?.[0] || ""); const score = Math.min(100, Math.max(0, Number(assessment.score))); if (!Number.isFinite(score)) throw new Error("score inválido"); return new Response(JSON.stringify({ score: Math.round(score), transcript: String(assessment.transcript || "").slice(0, 500), feedback: String(assessment.feedback || "").slice(0, 500), missed_words: Array.isArray(assessment.missed_words) ? assessment.missed_words.map(String).slice(0, 12) : [] }), { status: 200, headers: cors }); } catch { return new Response(JSON.stringify({ error: "A avaliação retornou um formato inválido. Tente novamente." }), { status: 502, headers: cors }); }
    }

    // Professor textual: DeepSeek é o ÚNICO provedor. Não existe fallback OpenRouter.
    if (!validTextMessages(body.messages)) return new Response(JSON.stringify({ error: "Pedido de IA inválido.", code: "messages_invalid" }), { status: 400, headers: cors });
    const quotaResponse = await consumeQuota(admin, userId, cors); if (quotaResponse) return quotaResponse;
    const payload = { model: PRIMARY_MODEL, messages: body.messages, temperature: typeof body.temperature === "number" ? Math.min(Math.max(body.temperature, 0), 1.5) : 0.7, max_tokens: Math.min(Number(body.max_tokens) || 800, MAX_TOKENS_CAP), stream: wantStream };
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_API_KEY) return new Response(JSON.stringify({ error: "DEEPSEEK_API_KEY não configurada no servidor.", code: "deepseek_key_missing" }), { status: 503, headers: cors });

    let response: Response;
    try {
      response = await fetch("https://api.deepseek.com/chat/completions", { signal: AbortSignal.any([req.signal, AbortSignal.timeout(UPSTREAM_BUDGET_MS)]), method: "POST", headers: { "Authorization": `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } catch (error) {
      console.error("[deepseek-chat] network_error", { name: (error as Error)?.name || "Error" });
      return new Response(JSON.stringify({ error: "Não foi possível conectar à DeepSeek agora.", code: "deepseek_network_error" }), { status: 502, headers: cors });
    }

    if (!response.ok) {
      const providerBody = await response.clone().json().catch(() => null);
      const status = response.status;
      const detail = String(providerBody?.error?.message || `HTTP ${status}`).slice(0, 300);
      console.error("[deepseek-chat] provider_error", { status, detail });
      const friendly = status === 401 ? "A chave da DeepSeek é inválida ou não foi aceita." : status === 402 ? "A conta da DeepSeek está sem saldo." : status === 429 ? "O limite de requisições da DeepSeek foi atingido. Tente novamente em instantes." : status === 503 ? "A DeepSeek está temporariamente sobrecarregada." : "A DeepSeek está temporariamente indisponível.";
      return new Response(JSON.stringify({ error: friendly, code: "deepseek_provider_error", provider_status: status, detail }), { status: 502, headers: cors });
    }

    if (wantStream && response.body) return new Response(response.body, { status: 200, headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
    const data = await response.json();
    return new Response(JSON.stringify(data), { status: 200, headers: cors });
  } catch (error) {
    console.error("[deepseek-chat] unexpected_error", { name: (error as Error)?.name || "Error" });
    return new Response(JSON.stringify({ error: "Não foi possível concluir o pedido agora.", code: "unexpected_error" }), { status: 500, headers: cors });
  }
});