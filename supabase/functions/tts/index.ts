// tts — proxy autenticado de áudio (Google Translate TTS)
// O navegador não consegue fazer fetch() do translate_tts (CORS); este proxy
// busca o MP3 no servidor e devolve com CORS correto, permitindo ao cliente
// tocar, cachear em IndexedDB e baixar o arquivo.
// Mesmo padrão de segurança do deepseek-chat: JWT real + rate-limit por usuário.
import { createClient } from "jsr:@supabase/supabase-js@2";

const RATE_LIMIT_PER_MIN = 60;
const ENDPOINT = "tts";
const MAX_TEXT_LEN = 300;
const MAX_BODY_BYTES = 4_096;
const UPSTREAM_TIMEOUT_MS = 12_000;

function corsHeadersFor(origin: string | null, contentType = "application/json") {
  const allowed = !!origin && (
    origin.startsWith("chrome-extension://") ||
    /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app$/.test(origin) ||
    origin === "http://localhost:3000" ||
    origin === "http://localhost:5173"
  );
  return {
    "Access-Control-Allow-Origin": allowed ? origin! : "null",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": contentType,
  };
}

async function readJsonBody(req: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("payload_too_large");
  const reader = req.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > maxBytes) { await reader.cancel(); throw new Error("payload_too_large"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_json");
    return parsed as Record<string, unknown>;
  }
  catch { throw new Error("invalid_json"); }
}

async function consumeQuota(admin: any, userId: string, cors: Record<string, string>): Promise<Response | null> {
  const { data: quotaAllowed, error: quotaError } = await admin.rpc("consume_api_quota", {
    p_user_id: userId, p_endpoint: ENDPOINT, p_limit: RATE_LIMIT_PER_MIN, p_window_seconds: 60,
  });
  if (quotaError) {
    console.error("[tts] quota_unavailable", { code: quotaError.code || "db_error" });
    return new Response(JSON.stringify({ error: "Serviço temporariamente indisponível." }), { status: 503, headers: cors });
  }
  if (quotaAllowed !== true) {
    return new Response(JSON.stringify({ error: "Muitas requisições de áudio. Aguarde um minuto." }), { status: 429, headers: cors });
  }
  return null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const cors = corsHeadersFor(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Não autenticado. Faça login no LinguaFlow." }), {
        status: 401, headers: cors,
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida ou expirada. Faça login novamente." }), {
        status: 401, headers: cors,
      });
    }
    const userId = userData.user.id;

    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req, MAX_BODY_BYTES);
    } catch (error) {
      const tooLarge = (error as Error).message === "payload_too_large";
      return new Response(JSON.stringify({ error: tooLarge ? "Pedido grande demais." : "Pedido inválido." }), {
        status: tooLarge ? 413 : 400, headers: cors,
      });
    }
    const text = String(body.text || "").trim().slice(0, MAX_TEXT_LEN);
    const langRaw = String(body.lang || "");
    const lang = /^[a-zA-Z]{2}(-[a-zA-Z]{2})?$/.test(langRaw) ? langRaw : "en-US";
    if (!text) {
      return new Response(JSON.stringify({ error: "Body inválido: text obrigatório." }), {
        status: 400, headers: cors,
      });
    }
    const quotaResponse = await consumeQuota(admin, userId, cors);
    if (quotaResponse) return quotaResponse;

    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${encodeURIComponent(lang)}&client=gtx`;
    const upstream = await fetch(ttsUrl, {
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)]),
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: "Não foi possível gerar o áudio agora." }), {
        status: 502, headers: cors,
      });
    }

    const audio = await upstream.arrayBuffer();
    return new Response(audio, {
      status: 200,
      headers: {
        ...corsHeadersFor(origin, "audio/mpeg"),
        "Cache-Control": "private, max-age=604800",
      },
    });
  } catch (error) {
    console.error("[tts] unexpected_error", { name: (error as Error)?.name || "Error" });
    return new Response(JSON.stringify({ error: "Não foi possível gerar o áudio agora." }), {
      status: 500, headers: cors,
    });
  }
});
