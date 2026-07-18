// push-reminder — chamado exclusivamente pelo pg_cron.
// Segredos: lf_vapid_public, lf_vapid_private, lf_push_cron_key (Vault) e
// LF_VAPID_SUBJECT (secret da Edge Function, ex. mailto:suporte@dominio.com).
import webpush from "npm:web-push@3.6.7";
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

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: secretData, error: secretError } = await admin.rpc("get_push_secrets");
  const secrets = secretData || {};
  if (secretError || !equalConstantTime(req.headers.get("x-cron-key") || "", secrets.lf_push_cron_key || "")) {
    return json({ error: "unauthorized" }, 401);
  }

  // Subject padrão do dono; o secret LF_VAPID_SUBJECT (se existir) sobrescreve
  const subject = Deno.env.get("LF_VAPID_SUBJECT") || "https://linguaflow-web-tau.vercel.app";
  if (!subject.startsWith("mailto:") && !subject.startsWith("https://")) {
    return json({ error: "vapid_subject_not_configured" }, 503);
  }
  if (!secrets.lf_vapid_public || !secrets.lf_vapid_private) return json({ error: "vapid_keys_not_configured" }, 503);
  webpush.setVapidDetails(subject, secrets.lf_vapid_public, secrets.lf_vapid_private);

  const { data: candidates, error: candidateError } = await admin.rpc("get_push_candidates");
  if (candidateError) return json({ error: "candidate_query_failed" }, 500);

  let sent = 0, removed = 0, failed = 0;
  for (const candidate of candidates || []) {
    if (!candidate.due_count && !candidate.at_risk) continue;
    const { data: subscriptions } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, last_notified_at")
      .eq("user_id", candidate.user_id);
    const body = candidate.at_risk
      ? "Sua ofensiva está em risco — uma revisão hoje já ajuda a mantê-la."
      : `Você tem ${candidate.due_count} ${candidate.due_count === 1 ? "revisão pendente" : "revisões pendentes"}.`;
    for (const subscription of subscriptions || []) {
      // Throttle POR assinatura (20h): usuário com 2 devices não leva dobrado
      if (subscription.last_notified_at &&
          Date.now() - new Date(subscription.last_notified_at).getTime() < 20 * 60 * 60 * 1000) {
        continue;
      }
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({
          title: candidate.at_risk ? "Não deixe sua ofensiva esfriar" : "Hora de revisar no LinguaFlow",
          body, tag: "linguaflow-daily-reminder", url: "/study",
        }), { TTL: 60 * 60 });
        await admin.from("push_subscriptions").update({ last_notified_at: new Date().toISOString() }).eq("id", subscription.id);
        sent++;
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", subscription.id);
          removed++;
        } else {
          console.error("push_send_failed", { statusCode, subscriptionId: subscription.id });
          failed++;
        }
      }
    }
  }
  return json({ ok: true, sent, removed, failed });
});
