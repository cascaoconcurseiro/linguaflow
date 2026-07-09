// tts — proxy autenticado de áudio (Google Translate TTS)
// O navegador não consegue fazer fetch() do translate_tts (CORS); este proxy
// busca o MP3 no servidor e devolve com CORS correto, permitindo ao cliente
// tocar, cachear em IndexedDB e baixar o arquivo.
// Mesmo padrão de segurança do deepseek-chat: JWT real + rate-limit por usuário.
import { createClient } from "jsr:@supabase/supabase-js@2";

const RATE_LIMIT_PER_MIN = 60;
const ENDPOINT = "tts";
const MAX_TEXT_LEN = 300;

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

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const cors = corsHeadersFor(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
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

    const windowStart = new Date(Date.now() - 60_000).toISOString();
    const { count, error: countErr } = await admin
      .from("api_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("endpoint", ENDPOINT)
      .gte("created_at", windowStart);

    if (!countErr && (count ?? 0) >= RATE_LIMIT_PER_MIN) {
      return new Response(JSON.stringify({ error: "Muitas requisições de áudio. Aguarde um minuto." }), {
        status: 429, headers: cors,
      });
    }

    await admin.from("api_usage_log").insert({ user_id: userId, endpoint: ENDPOINT });

    const body = await req.json().catch(() => ({}));
    const text = String(body.text || "").trim().slice(0, MAX_TEXT_LEN);
    const langRaw = String(body.lang || "");
    const lang = /^[a-zA-Z]{2}(-[a-zA-Z]{2})?$/.test(langRaw) ? langRaw : "en-US";
    if (!text) {
      return new Response(JSON.stringify({ error: "Body inválido: text obrigatório." }), {
        status: 400, headers: cors,
      });
    }

    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${encodeURIComponent(lang)}&client=gtx`;
    const upstream = await fetch(ttsUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: `Falha ao obter o áudio (${upstream.status}).` }), {
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
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: cors,
    });
  }
});
