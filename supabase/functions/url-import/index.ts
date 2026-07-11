// url-import — proxy seguro de importação de URL pro Leitor (Onda 3.1)
// Por que existir: o navegador não consegue fazer fetch cross-origin de
// qualquer site (CORS) — o servidor busca por fora (sem restrição de CORS)
// e devolve só o texto já extraído, nunca o HTML bruto do site de terceiros.
// Autenticação + rate-limit seguem o mesmo padrão do deepseek-chat.
import { createClient } from "jsr:@supabase/supabase-js@2";

const RATE_LIMIT_PER_MIN = 6;
const ENDPOINT = "url-import";
const MAX_HTML_BYTES = 3 * 1024 * 1024; // 3MB de HTML bruto no máximo
const MAX_TEXT_CHARS = 60000;
const MAX_REDIRECTS = 5;

function corsHeadersFor(origin: string | null) {
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

// Proteção contra SSRF — auditoria 2026-07-12 encontrou que a versão
// anterior só olhava a STRING do hostname (bloqueava "127.0.0.1" literal,
// nunca resolvia DNS). Um atacante registrando um domínio próprio com
// registro A apontando pra 169.254.169.254 (metadados de nuvem) ou
// 10.0.0.0/8 passava batido: `new URL()` não resolve DNS, e o `fetch()`
// seguinte resolvia e conectava livremente. Agora resolvemos A/AAAA nós
// mesmos e validamos TODOS os IPs retornados antes de deixar o fetch()
// prosseguir — em cada hop de redirect, não só no primeiro.
// Risco residual conhecido e aceito: como o Deno `fetch()` não expõe uma
// forma de fixar a conexão no IP já resolvido/validado (sem reimplementar
// o cliente HTTP na mão), existe uma janela estreita de DNS rebinding
// (DNS com TTL baixíssimo trocando de resposta entre a nossa checagem e o
// fetch real). Mitigação parcial: TTL do request é curto (uma checagem +
// um fetch, não um processo de longa duração), o que reduz bastante a
// janela de exploração comparado a um serviço que cacheia por muito tempo.
function isBlockedIPv4(a: number, b: number): boolean {
  if (a === 127 || a === 10 || a === 0) return true; // loopback, RFC1918, "this network"
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 169 && b === 254) return true; // link-local (inclui metadados de nuvem)
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT, às vezes roteado internamente
  return false;
}

function parseIPv4(h: string): [number, number, number, number] | null {
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number) as [number, number, number, number];
  if (parts.some((p) => p > 255)) return null;
  return parts;
}

// Expande um endereço IPv6 (com suporte a "::") pra 8 grupos de 16 bits.
function expandIPv6(raw: string): number[] | null {
  let h = raw.split("%")[0]; // remove zone id (ex: fe80::1%eth0)
  if (h.includes(".")) {
    // Forma IPv4-mapped/compatible (ex: ::ffff:1.2.3.4): converte o sufixo
    // IPv4 em dois grupos hex antes de expandir.
    const lastColon = h.lastIndexOf(":");
    const v4 = parseIPv4(h.slice(lastColon + 1));
    if (!v4) return null;
    const g1 = ((v4[0] << 8) | v4[1]).toString(16);
    const g2 = ((v4[2] << 8) | v4[3]).toString(16);
    h = h.slice(0, lastColon + 1) + g1 + ":" + g2;
  }
  const halves = h.split("::");
  if (halves.length > 2) return null;
  const parseGroup = (s: string) => (s === "" ? [] : s.split(":").map((g) => parseInt(g, 16)));
  const head = parseGroup(halves[0]);
  const tail = halves.length === 2 ? parseGroup(halves[1]) : [];
  if (head.some((n) => Number.isNaN(n)) || tail.some((n) => Number.isNaN(n))) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  return [...head, ...Array(missing).fill(0), ...tail];
}

function isBlockedIPv6(groups: number[]): boolean {
  if (groups.length !== 8) return true; // malformado — bloqueia por segurança
  if (groups.every((g) => g === 0)) return true; // :: (unspecified)
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true; // ::1
  const first = groups[0];
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if (groups[0] === 0 && groups[1] === 0 && groups[2] === 0 && groups[3] === 0 && groups[4] === 0 && groups[5] === 0xffff) {
    // ::ffff:a.b.c.d (IPv4-mapped) — valida o IPv4 embutido
    const a = (groups[6] >> 8) & 0xff, b = groups[6] & 0xff;
    return isBlockedIPv4(a, b);
  }
  return false;
}

function isBlockedIpLiteral(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const v4 = parseIPv4(h);
  if (v4) return isBlockedIPv4(v4[0], v4[1]);
  if (h.includes(":")) {
    const v6 = expandIPv6(h);
    return v6 ? isBlockedIPv6(v6) : true; // não deu pra parsear -> bloqueia
  }
  return false;
}

// Resolve o hostname (se não for já um IP literal) e valida TODOS os
// endereços retornados — é aqui que o SSRF via DNS malicioso é barrado.
async function isBlockedHost(hostname: string): Promise<boolean> {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (isBlockedIpLiteral(h)) return true;
  if (parseIPv4(h) || h.includes(":")) return false; // já é IP literal, já validado acima

  const addresses: string[] = [];
  const lookups = await Promise.allSettled([
    Deno.resolveDns(h, "A"),
    Deno.resolveDns(h, "AAAA"),
  ]);
  for (const r of lookups) if (r.status === "fulfilled") addresses.push(...r.value);
  if (addresses.length === 0) return true; // não resolveu nada -> não segue

  return addresses.some((addr) => isBlockedIpLiteral(addr));
}

async function safeParseUrl(raw: string): Promise<URL | null> {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (await isBlockedHost(url.hostname)) return null;
  return url;
}

async function fetchWithGuardedRedirects(rawUrl: string): Promise<Response> {
  let current = await safeParseUrl(rawUrl);
  if (!current) throw new Error("URL inválida ou aponta pra rede interna.");
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await fetch(current.toString(), {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LinguaFlowBot/1.0)" },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      const next = await safeParseUrl(new URL(location, current).toString());
      if (!next) throw new Error("Redirecionamento pra um endereço bloqueado.");
      current = next;
      continue;
    }
    return res;
  }
  throw new Error("Redirecionamentos demais — não segui a importação.");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function extractText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim().slice(0, 200) : "";

  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<(nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, " ");

  // Heurística simples de "modo leitura": prioriza <article>/<main> se existir.
  const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    || cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const body = articleMatch ? articleMatch[1] : cleaned;

  const withBreaks = body
    .replace(/<\/(p|div|br|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const text = decodeEntities(withBreaks)
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();

  return { title, text: text.slice(0, MAX_TEXT_CHARS) };
}

function concatUint8(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

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
      return new Response(JSON.stringify({ error: "Muitas importações por minuto. Aguarde um pouco." }), {
        status: 429, headers: cors,
      });
    }
    await admin.from("api_usage_log").insert({ user_id: userId, endpoint: ENDPOINT });

    const body = await req.json().catch(() => ({}));
    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
    if (!rawUrl || rawUrl.length > 2048) {
      return new Response(JSON.stringify({ error: "URL inválida." }), { status: 400, headers: cors });
    }

    let res: Response;
    try {
      res = await fetchWithGuardedRedirects(rawUrl);
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message || "Não foi possível acessar essa URL." }), {
        status: 400, headers: cors,
      });
    }
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `O site respondeu com erro ${res.status}.` }), {
        status: 400, headers: cors,
      });
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return new Response(JSON.stringify({ error: "Só páginas HTML/texto são suportadas (não é possível importar PDF/imagem)." }), {
        status: 400, headers: cors,
      });
    }

    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          received += value.byteLength;
          if (received > MAX_HTML_BYTES) { await reader.cancel(); break; }
          chunks.push(value);
        }
      }
    }
    const html = new TextDecoder("utf-8").decode(concatUint8(chunks));
    const { title, text } = extractText(html);

    if (!text || text.length < 50) {
      return new Response(JSON.stringify({ error: "Não consegui extrair texto legível dessa página." }), {
        status: 400, headers: cors,
      });
    }

    return new Response(JSON.stringify({ title, text }), { status: 200, headers: cors });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message || "Erro ao importar a URL." }), {
      status: 500, headers: cors,
    });
  }
});
