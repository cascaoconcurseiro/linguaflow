// email-reengagement — chamado exclusivamente pelo pg_cron (Onda 3.4).
// Espelha push-reminder: segredo de cron em constant-time, candidatos via
// RPC restrita a service_role, throttle embutido na query (7 dias).
// Provedor: Resend (API HTTP simples, sem SDK) — precisa de
// lf_resend_api_key no Vault; sem ela, responde 503 sem quebrar o cron.
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});

function equalConstantTime(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function escapeHtml(s: string) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c] || c));
}

function emailBody(candidate: { username?: string; streak: number; at_risk: boolean; xp_week: number; due_count: number }) {
  const name = escapeHtml(candidate.username || "Estudante");
  const headline = candidate.at_risk
    ? `Sua ofensiva de ${candidate.streak} ${candidate.streak === 1 ? "dia" : "dias"} está prestes a esfriar 🔥`
    : `Seu resumo da semana no LinguaFlow 📊`;
  const body = candidate.at_risk
    ? `Uma revisão rápida hoje já mantém sua ofensiva viva.`
    : `Você tem ${candidate.due_count} ${candidate.due_count === 1 ? "revisão pendente" : "revisões pendentes"} e ganhou ${candidate.xp_week} XP essa semana.`;
  const html = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
    <h2 style="color:#1a1a1a;">Olá, ${name}!</h2>
    <p style="font-size:16px;color:#333;">${headline}</p>
    <p style="font-size:14px;color:#555;">${body}</p>
    <a href="https://linguaflow.vercel.app/study" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#58cc02;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Estudar agora</a>
    <p style="font-size:11px;color:#999;margin-top:24px;">Você recebeu isso porque ativou lembretes por e-mail nas Configurações do LinguaFlow. Pode desativar quando quiser.</p>
  </div>`;
  return { subject: headline, html };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: secretData, error: secretError } = await admin.rpc("get_email_secrets");
  const secrets = secretData || {};
  if (secretError || !equalConstantTime(req.headers.get("x-cron-key") || "", secrets.lf_email_cron_key || "")) {
    return json({ error: "unauthorized" }, 401);
  }

  const resendKey = Deno.env.get("RESEND_API_KEY") || secrets.lf_resend_api_key;
  if (!resendKey) {
    // Degrada graciosamente: o cron continua rodando sem erro fatal até o
    // dono configurar o provedor — nada quebra, só não envia nada ainda.
    return json({ error: "email_provider_not_configured", sent: 0 }, 503);
  }
  const from = secrets.lf_email_from || "LinguaFlow <onboarding@resend.dev>";

  const { data: candidates, error: candidateError } = await admin.rpc("get_email_candidates");
  if (candidateError) return json({ error: "candidate_query_failed" }, 500);

  let sent = 0, failed = 0;
  for (const candidate of candidates || []) {
    if (!candidate.due_count && !candidate.at_risk) continue; // nada relevante pra contar essa semana
    const { subject, html } = emailBody(candidate);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: candidate.email, subject, html }),
      });
      if (!res.ok) throw new Error(`resend_status_${res.status}`);
      await admin.from("user_stats").update({ email_last_sent_at: new Date().toISOString() }).eq("user_id", candidate.user_id);
      sent++;
    } catch (error) {
      console.error("email_send_failed", { userId: candidate.user_id, error: String(error) });
      failed++;
    }
  }
  return json({ ok: true, sent, failed });
});
