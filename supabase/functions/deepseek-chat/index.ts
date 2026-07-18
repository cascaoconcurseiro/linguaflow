// deepseek-chat — proxy seguro de IA do LinguaFlow (Fase 2)
// Chave DeepSeek vive APENAS em Supabase Secrets (DEEPSEEK_API_KEY).
// Fluxo: valida usuário real via JWT -> rate-limit por user_id -> encaminha.
import { createClient } from "jsr:@supabase/supabase-js@2";

const RATE_LIMIT_PER_MIN = 20;
const MAX_TOKENS_CAP = 2048;
const MAX_AUDIO_BASE64 = 2_000_000;
const AUDIO_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";
const ENDPOINT = "deepseek-chat";

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
  };
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
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

    // 2. Rate-limit por usuário (protege a chave compartilhada)
    const windowStart = new Date(Date.now() - 60_000).toISOString();
    const { count, error: countErr } = await admin
      .from("api_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("endpoint", ENDPOINT)
      .gte("created_at", windowStart);

    if (!countErr && (count ?? 0) >= RATE_LIMIT_PER_MIN) {
      return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde um minuto e tente de novo." }), {
        status: 429, headers: cors,
      });
    }

    await admin.from("api_usage_log").insert({ user_id: userId, endpoint: ENDPOINT });

    // 3. Sanitiza o body: modelo fixo e teto de tokens — cliente não dita custo
    const body = await req.json();
    const wantStream = body.stream === true;

    // Áudio é uma rota explícita e consentida. Não passa pelo DeepSeek porque
    // deepseek-chat aceita apenas texto. A gravação permanece somente na
    // memória desta requisição e é encaminhada ao Nemotron multimodal.
    if (body.action === "assess_pronunciation") {
      const expected = typeof body.expected_text === "string" ? body.expected_text.trim().slice(0, 500) : "";
      const audio = typeof body.audio_base64 === "string" ? body.audio_base64 : "";
      const allowedFormats = new Set(["webm", "ogg", "wav", "mp3", "m4a"]);
      const format = allowedFormats.has(body.audio_format) ? body.audio_format : "webm";
      if (body.consent !== true || !expected || !audio || audio.length > MAX_AUDIO_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(audio)) {
        return new Response(JSON.stringify({ error: "Gravação, frase ou consentimento inválido." }), { status: 400, headers: cors });
      }
      const openRouterKey = Deno.env.get("OPENROUTER_API_KEY") || Deno.env.get("OPENROUTER LINGUA");
      if (!openRouterKey) {
        return new Response(JSON.stringify({ error: "Avaliação de voz não configurada no servidor." }), { status: 503, headers: cors });
      }
      const prompt = `Compare a pronúncia do aluno com a frase esperada: "${expected}". Avalie inteligibilidade, palavras omitidas/trocadas e ritmo. Não penalize sotaque brasileiro se estiver inteligível. Responda SOMENTE JSON válido: {"score":0-100,"transcript":"o que ouviu","feedback":"uma frase curta em português","missed_words":["palavras problemáticas"]}`;
      const audioResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://linguaflow-web-tau.vercel.app",
          "X-Title": "LinguaFlow",
        },
        body: JSON.stringify({
          model: AUDIO_MODEL,
          messages: [{ role: "user", content: [
            { type: "text", text: prompt },
            { type: "input_audio", input_audio: { data: audio, format } },
          ] }],
          temperature: 0.1,
          max_tokens: 350,
          stream: false,
          reasoning: { effort: "minimal", exclude: true },
        }),
      });
      const providerData = await audioResponse.json().catch(() => null);
      if (!audioResponse.ok) {
        return new Response(JSON.stringify({ error: "O provedor não conseguiu analisar a gravação." }), { status: 502, headers: cors });
      }
      const content = providerData?.choices?.[0]?.message?.content || "";
      const jsonMatch = String(content).replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
      try {
        const assessment = JSON.parse(jsonMatch?.[0] || "");
        const score = Math.min(100, Math.max(0, Number(assessment.score)));
        if (!Number.isFinite(score)) throw new Error("score inválido");
        return new Response(JSON.stringify({
          score: Math.round(score),
          transcript: String(assessment.transcript || "").slice(0, 500),
          feedback: String(assessment.feedback || "").slice(0, 500),
          missed_words: Array.isArray(assessment.missed_words) ? assessment.missed_words.map(String).slice(0, 12) : [],
        }), { status: 200, headers: cors });
      } catch {
        return new Response(JSON.stringify({ error: "A avaliação retornou um formato inválido. Tente novamente." }), { status: 502, headers: cors });
      }
    }
    const payload = {
      model: "deepseek-chat",
      messages: body.messages,
      temperature: typeof body.temperature === "number" ? Math.min(Math.max(body.temperature, 0), 1.5) : 0.7,
      max_tokens: Math.min(Number(body.max_tokens) || 800, MAX_TOKENS_CAP),
      stream: wantStream,
    };
    if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
      return new Response(JSON.stringify({ error: "Body inválido: messages obrigatório." }), {
        status: 400, headers: cors,
      });
    }

    // 4. Encaminha ao DeepSeek com a chave do servidor.
    //    Ordem: env (Edge Function Secrets) -> Vault via RPC restrita à service role.
    let DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_API_KEY) {
      const { data: vaultKey } = await admin.rpc("get_deepseek_key");
      DEEPSEEK_API_KEY = vaultKey || undefined;
    }
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || Deno.env.get("OPENROUTER LINGUA");
    if (!DEEPSEEK_API_KEY && !OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "Nenhum provedor de IA está configurado no servidor." }), {
        status: 500, headers: cors,
      });
    }

    const callProvider = (url: string, key: string, model: string) => fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(url.includes("openrouter")
          ? { "HTTP-Referer": "https://linguaflow-web-tau.vercel.app", "X-Title": "LinguaFlow" }
          : {}),
      },
      body: JSON.stringify({
        ...payload,
        model,
        ...(url.includes("openrouter") ? { reasoning: { effort: "minimal", exclude: true } } : {}),
      }),
    });

    let response: Response | null = null;
    let primaryError = "";
    const fallbackModel = Deno.env.get("OPENROUTER_MODEL") || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";
    const inputSize = JSON.stringify(payload.messages).length;
    // Pedidos extensos gastam primeiro o tier gratuito; pedidos normais
    // preservam DeepSeek como principal por qualidade. Em ambos os caminhos,
    // o outro provedor assume se o primeiro falhar.
    const preferEconomy = payload.max_tokens >= 1200 || inputSize >= 12_000;

    if (preferEconomy && OPENROUTER_API_KEY) {
      try {
        response = await callProvider("https://openrouter.ai/api/v1/chat/completions", OPENROUTER_API_KEY, fallbackModel);
      } catch (e) {
        primaryError = (e as Error).message;
      }
      if ((!response || !response.ok) && DEEPSEEK_API_KEY) {
        try { response = await callProvider("https://api.deepseek.com/chat/completions", DEEPSEEK_API_KEY, "deepseek-chat"); }
        catch (e) { primaryError = (e as Error).message; }
      }
    } else if (DEEPSEEK_API_KEY) {
      try {
        response = await callProvider("https://api.deepseek.com/chat/completions", DEEPSEEK_API_KEY, "deepseek-chat");
      } catch (e) {
        primaryError = (e as Error).message;
      }
    }

    // FALLBACK (pedido do dono, 18/07): DeepSeek fora do ar / sem créditos /
    // 5xx => OpenRouter com modelo gratuito compatível (OpenAI-style). A
    // chave vive APENAS em Edge Function Secrets (OPENROUTER_API_KEY) —
    // nunca no cliente, nunca no repositório. OPENROUTER_MODEL permite
    // trocar o modelo sem redeploy.
    if (!response || !response.ok) {
      if (OPENROUTER_API_KEY) {
        // Default verificado no catálogo VIVO em 18/07/2026: os frees famosos
        // (deepseek/llama/gemini) saíram do tier gratuito. tencent/hy3:free é
        // o único chat generalista grande restante (295B MoE, 21B ativos =
        // rápido; 262k de contexto). Para velocidade extrema, trocar via
        // secret OPENROUTER_MODEL para nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
        // (3B ativos), ciente do risco de vazar raciocínio nos JSONs.
        try {
          const fallback = await callProvider("https://openrouter.ai/api/v1/chat/completions", OPENROUTER_API_KEY, fallbackModel);
          if (fallback.ok) response = fallback;
          else if (!response) response = fallback; // devolve o erro do fallback a falta de melhor
        } catch { /* mantém o resultado primário */ }
      }
    }

    if (!response) {
      return new Response(JSON.stringify({ error: `IA indisponível no momento (${primaryError || "falha de rede"}). Tente de novo em instantes.` }), {
        status: 502, headers: cors,
      });
    }

    // STREAMING: repassa o SSE do DeepSeek direto pro cliente sem buffering —
    // a resposta aparece na tela enquanto é gerada (espera percebida ~1s).
    if (wantStream && response.ok && response.body) {
      return new Response(response.body, {
        status: 200,
        headers: {
          ...cors,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), { status: response.status, headers: cors });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: cors,
    });
  }
});
