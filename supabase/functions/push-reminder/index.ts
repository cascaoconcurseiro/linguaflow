// Edge Function push-reminder — envia o lembrete diário de Web Push.
// Autenticação: header x-cron-key comparado com o segredo do Vault (o pg_cron
// injeta o valor na hora do disparo; nada de JWT porque a chamada é do banco).
// Segurança: VAPID e cron key só via RPC get_push_secrets (service_role).
// Comportamento: no máx. 1 notificação/20h por assinatura; assinaturas mortas
// (404/410 no push service) são removidas — falha elegante, sem lixo.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: secrets, error: secErr } = await admin.rpc('get_push_secrets');
  if (secErr || !secrets?.lf_push_cron_key || !secrets?.lf_vapid_private) {
    console.error('push-reminder: segredos indisponíveis', secErr);
    return new Response('secrets unavailable', { status: 500 });
  }

  if (req.headers.get('x-cron-key') !== secrets.lf_push_cron_key) {
    return new Response('forbidden', { status: 403 });
  }

  webpush.setVapidDetails(
    'mailto:wesley.lima@caxias.ifrs.edu.br',
    secrets.lf_vapid_public,
    secrets.lf_vapid_private,
  );

  const { data: candidates, error: candErr } = await admin.rpc('get_push_candidates');
  if (candErr) {
    console.error('push-reminder: get_push_candidates falhou', candErr);
    return new Response('candidates query failed', { status: 500 });
  }

  let sent = 0, removed = 0, skipped = 0;

  for (const c of candidates ?? []) {
    const due = Number(c.due_count || 0);
    const atRisk = Boolean(c.at_risk);
    if (due < 1 && !atRisk) { skipped++; continue; }

    // Mensagem por prioridade: ofensiva em risco > cards vencidos
    const payload = JSON.stringify(atRisk
      ? {
          title: `🔥 Sua ofensiva de ${c.streak} ${c.streak === 1 ? 'dia' : 'dias'} está em risco!`,
          body: due > 0
            ? `${due} ${due === 1 ? 'card espera' : 'cards esperam'} por você. 5 minutinhos salvam o fogo!`
            : 'Uma revisão rápida hoje mantém o fogo aceso. Bora?',
          url: '/study',
        }
      : {
          title: 'LinguaFlow 📚',
          body: `Você tem ${due} ${due === 1 ? 'card pronto' : 'cards prontos'} pra revisar. Sua memória agradece!`,
          url: '/study',
        });

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, last_notified_at')
      .eq('user_id', c.user_id);

    for (const sub of subs ?? []) {
      if (sub.last_notified_at &&
          Date.now() - new Date(sub.last_notified_at).getTime() < 20 * 60 * 60 * 1000) {
        skipped++;
        continue;
      }
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        await admin.from('push_subscriptions')
          .update({ last_notified_at: new Date().toISOString() })
          .eq('id', sub.id);
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Assinatura morta (usuário revogou/limpou o navegador): remove
          await admin.from('push_subscriptions').delete().eq('id', sub.id);
          removed++;
        } else {
          console.error('push-reminder: envio falhou', status, e);
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent, removed, skipped }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
