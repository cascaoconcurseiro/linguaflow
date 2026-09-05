// deepseek-chat — proxy seguro de IA do LinguaFlow (Fase 2)
// Chave DeepSeek vive APENAS em Supabase Secrets (DEEPSEEK_API_KEY).
// Fluxo: valida usuário real via JWT -> rate-limit por user_id -> encaminha.
import { createClient } from "jsr:@supabase/supabase-js@2";

const RATE_LIMIT_PER_MIN = 20;
const MAX_TOKENS_CAP = 2048;
const MAX_BODY_BYTES = 100_000;
const MAX_MESSAGES = 24;
const MAX_TEXT_INPUT_CHARS = 40_000;
const ENDPOINT = "deepseek-chat";
const UPSTREAM_BUDGET_MS = 45_000;

function corsHeadersFor(origin: string | null) {
  // Extensão (fetches de extensão com host_permissions ignoram CORS, mas
  // cobrimos o caso), site na Vercel e dev local. Nunca '*'.
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
    "Content-Type": "application/json",
    "Cache-Control": "private, no-store",
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
    if (received > maxBytes) {
      await reader.cancel();
      throw new Error("payload_too_large");
    }
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
    p_user_id: userId,
    p_endpoint: ENDPOINT,
    p_limit: RATE_LIMIT_PER_MIN,
    p_window_seconds: 60,
  });
  if (quotaError) {
    console.error("[deepseek-chat] quota_unavailable", { code: quotaError.code || "db_error" });
    return new Response(JSON.stringify({ error: "Serviço temporariamente indisponível." }), {
      status: 503, headers: cors,
    });
  }
  if (quotaAllowed !== true) {
    return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde um minuto e tente de novo." }), {
      status: 429, headers: cors,
    });
  }
  return null;
}

function validTextMessages(value: unknown): value is Array<{ role: string; content: string }> {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return false;
  let total = 0;
  for (const message of value) {
    if (!message || typeof message !== "object") return false;
    const role = (message as { role?: unknown }).role;
    const content = (message as { content?: unknown }).content;
    if (!new Set(["system", "user", "assistant"]).has(String(role)) || typeof content !== "string") return false;
    total += content.length;
    if (total > MAX_TEXT_INPUT_CHARS) return false;
  }
  return true;
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: cors });
  }

  try {
    // 1. Validação REAL do usuário (não basta o header existir: a anon key
    //    pública também é um JWT válido — precisa resolver pra um usuário)
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

    // 2. Sanitiza o body antes de consumir a quota.
    let body: Record<string, any>;
    try {
      body = await readJsonBody(req, MAX_BODY_BYTES);
    } catch (error) {
      const tooLarge = (error as Error).message === "payload_too_large";
      return new Response(JSON.stringify({ error: tooLarge ? "Pedido grande demais." : "Pedido inválido." }), {
        status: tooLarge ? 413 : 400, headers: cors,
      });
    }
    const wantStream = body.stream === true;

    if (!validTextMessages(body.messages)) {
      return new Response(JSON.stringify({ error: "Pedido de IA inválido.", code: "messages_invalid" }), {
        status: 400, headers: cors,
      });
    }
    const quotaResponse = await consumeQuota(admin, userId, cors);
    if (quotaResponse) return quotaResponse;
    const payload = {
      model: "deepseek-chat",
      messages: body.messages,
      temperature: typeof body.temperature === "number" ? Math.min(Math.max(body.temperature, 0), 1.5) : 0.7,
      max_tokens: Math.min(Number(body.max_tokens) || 800, MAX_TOKENS_CAP),
      stream: wantStream,
    };
    // 4. Encaminha exclusivamente ao DeepSeek com a chave do servidor.
    //    Ordem da chave: env (Edge Function Secrets) -> Vault via RPC restrita à service role.
    let DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_API_KEY) {
      const { data: vaultKey } = await admin.rpc("get_deepseek_key");
      DEEPSEEK_API_KEY = vaultKey || undefined;
    }
    if (!DEEPSEEK_API_KEY) {
      return new Response(JSON.stringify({ error: "DeepSeek não está configurado no servidor." }), {
        status: 500, headers: cors,
      });
    }
    const deepSeekKey = DEEPSEEK_API_KEY;

    let response: Response | null = null;
    let primaryError = "";
    try {
      response = await fetch("https://api.deepseek.com/chat/completions", {
        signal: AbortSignal.any([req.signal, AbortSignal.timeout(UPSTREAM_BUDGET_MS)]),
        method: "POST",
        headers: {
          "Authorization": `Bearer ${deepSeekKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          model: "deepseek-chat",
        }),
      });
    } catch (e) {
      primaryError = (e as Error).message;
    }

    if (!response) {
      return new Response(JSON.stringify({ error: `IA indisponível no momento (${primaryError || "falha de rede"}). Tente de novo em instantes.` }), {
        status: 502, headers: cors,
      });
    }

    // STREAMING: repassa o SSE do DeepSeek direto pro cliente sem buffering —
    // a resposta aparece na tela enquanto é gerada (espera percebida ~1s).
    if (!response.ok) {
      console.error("[deepseek-chat] provider_unavailable", { status: response.status });
      return new Response(JSON.stringify({ error: "IA temporariamente indisponível. Tente novamente em instantes." }), {
        status: 502, headers: cors,
      });
    }

    if (wantStream && response.body) {
      return new Response(response.body, {
        status: 200,
        headers: {
          ...cors,
          "Content-Type": "text/event-stream",
            "Cache-Control": "private, no-store",
        },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), { status: 200, headers: cors });
  } catch (error) {
    console.error("[deepseek-chat] unexpected_error", { name: (error as Error)?.name || "Error" });
    return new Response(JSON.stringify({ error: "Não foi possível concluir o pedido agora." }), {
      status: 500, headers: cors,
    });
  }
});
