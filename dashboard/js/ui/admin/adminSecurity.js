// dashboard/js/ui/admin/adminSecurity.js
// Aba "Segurança": checagens ao vivo do banco, relatórios de acesso e a lista do que só pode ser
// ligado nos painéis da Vercel/Supabase (o app não consegue configurar firewall nem Auth por conta própria).
import {
  adminErrorMessage, escapeHtml, fmtDateTime, fmtNumber, mountAsync, setBusy,
} from './adminShared.js';

const LEVEL = { ok: ['OK', 'ok'], warn: ['Atenção', 'warn'], fail: ['Falha', 'danger'] };

// Medidas fora do alcance do banco. "plano" deixa claro o que é gratuito e o que exige plano pago.
const MANUAL_MEASURES = [
  {
    where: 'Vercel → Firewall',
    title: 'Desafio (challenge) para tráfego de fora do Brasil',
    how: 'Custom rule: País diferente de BR → ação Challenge. Não use "Deny": brasileiros no exterior, viagens e a extensão seriam bloqueados, e uma VPN contorna o bloqueio.',
    plan: 'Gratuito (Hobby)',
  },
  {
    where: 'Vercel → Firewall',
    title: 'Limite de requisições por IP',
    how: 'Rate limit rule (ex.: 120 requisições/minuto por IP na raiz do site). Protege só o site; a API do Supabase não passa pela Vercel.',
    plan: 'Gratuito (Hobby, com limites)',
  },
  {
    where: 'Vercel → Firewall',
    title: 'Attack Challenge Mode',
    how: 'Ligue durante um ataque; desligue depois. Exige verificação para todos os visitantes.',
    plan: 'Gratuito',
  },
  {
    where: 'Supabase → Authentication → Attack Protection',
    title: 'CAPTCHA no cadastro e no login (Cloudflare Turnstile)',
    how: 'Ative e informe a chave do Turnstile (gratuito). Exige ajuste no formulário de login para enviar o token.',
    plan: 'Gratuito (Turnstile) — requer mudança no app',
  },
  {
    where: 'Supabase → Authentication → Rate Limits',
    title: 'Limites de e-mails, OTP e tentativas por IP',
    how: 'Reduza os padrões de envio de e-mail e verificações por hora.',
    plan: 'Gratuito',
  },
  {
    where: 'Supabase → Authentication → Sign In / Providers',
    title: 'Confirmação de e-mail obrigatória e senha forte',
    how: 'Mantenha "Confirm email" ligado e exija comprimento mínimo de 10+ caracteres.',
    plan: 'Gratuito',
  },
  {
    where: 'Supabase → Authentication → Password security',
    title: 'Bloqueio de senhas vazadas (HaveIBeenPwned)',
    how: 'Ative "Prevent use of leaked passwords".',
    plan: 'Exige plano Pro (pago)',
  },
  {
    where: 'Conta do administrador',
    title: 'Verificação em duas etapas no e-mail e no GitHub/Vercel/Supabase',
    how: 'Ative 2FA nas contas que controlam deploy e banco; é a proteção mais importante contra tomada de conta.',
    plan: 'Gratuito',
  },
];

function checkRow(check) {
  const [label, tone] = LEVEL[check.level] || ['—', 'info'];
  return `<tr><td><span class="adm-badge" data-tone="${tone}" style="margin-left:0">${label}</span></td>
    <td><strong>${escapeHtml(check.title)}</strong></td><td class="adm-note">${escapeHtml(check.detail)}</td></tr>`;
}

async function mountHygiene(box, ctx) {
  try {
    const info = await ctx.db.adminSessionHygiene(30);
    box.innerHTML = `<p style="margin-bottom:8px">${fmtNumber(info.total)} sessão(ões) no total; <strong>${fmtNumber(info.stale)}</strong> parada(s) há ${fmtNumber(info.days)}+ dias.</p>
      ${ctx.canWrite ? `<button type="button" class="adm-btn" id="adm-prune-btn" ${info.stale ? '' : 'disabled'}>Encerrar agora as ${fmtNumber(info.stale)} sessão(ões) inativa(s)</button>` : ''}`;
    box.querySelector('#adm-prune-btn')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      setBusy(button, true, 'Encerrando…');
      try {
        const result = await ctx.db.adminPruneStaleSessions(30);
        ctx.app.showToast(`${fmtNumber(result.sessions_ended)} sessão(ões) encerrada(s).`, 'success');
        mountHygiene(box, ctx);
      } catch (error) {
        setBusy(button, false);
        ctx.app.showToast(adminErrorMessage(error), 'error');
      }
    });
  } catch (error) {
    box.innerHTML = `<p class="adm-inline-error" role="alert">${escapeHtml(adminErrorMessage(error))}</p>`;
  }
}

export function renderSecurity(el, ctx) {
  return mountAsync(el, {
    errorTitle: 'Não foi possível carregar a central de segurança',
    onSessionError: () => ctx.app.navigate('settings'),
    load: () => ctx.db.adminSecurityOverview(),
    render: (data) => {
      const checks = data.checks || [];
      const problems = checks.filter((check) => check.level !== 'ok').length;
      const sessions = data.sessions || {};
      el.innerHTML = `
        <section class="adm-section" aria-labelledby="adm-sec-checks">
          <header><h2 id="adm-sec-checks">Postura de segurança</h2>
            <p>${problems ? `${problems} ponto(s) pedem atenção.` : 'Tudo certo nas checagens automáticas.'} Atualizado em ${fmtDateTime(data.generated_at)}.</p></header>
          <div class="adm-table-wrap"><table class="adm-table">
            <caption class="adm-sr">Checagens de segurança</caption>
            <thead><tr><th scope="col">Nível</th><th scope="col">Checagem</th><th scope="col">Detalhe</th></tr></thead>
            <tbody>${checks.map(checkRow).join('')}</tbody></table></div>
        </section>

        <section class="adm-section" aria-labelledby="adm-sec-access">
          <header><h2 id="adm-sec-access">Acessos</h2>
            <p>Endereços IP são dado pessoal (LGPD): use só para investigar abuso.</p></header>
          <dl class="adm-kpis">
            <div class="adm-kpi"><dt>Sessões ativas</dt><dd>${fmtNumber(sessions.active)}</dd></div>
            <div class="adm-kpi"><dt>Novas (24 h)</dt><dd>${fmtNumber(sessions.new_24h)}</dd></div>
            <div class="adm-kpi"><dt>IPs distintos (30 dias)</dt><dd>${fmtNumber(sessions.ips_30d)}</dd></div>
          </dl>
          <h3 style="font-size:15px; margin:18px 0 6px">IPs usados por 3 ou mais contas (30 dias)</h3>
          ${(data.ip_clusters || []).length ? `<div class="adm-table-wrap"><table class="adm-table">
            <caption class="adm-sr">IPs com várias contas</caption>
            <thead><tr><th scope="col">IP</th><th scope="col" class="adm-r">Contas</th><th scope="col" class="adm-r">Sessões</th><th scope="col">Último acesso</th></tr></thead>
            <tbody>${data.ip_clusters.map((row) => `<tr><td>${escapeHtml(row.ip)}</td><td class="adm-r adm-num">${fmtNumber(row.accounts)}</td>
              <td class="adm-r adm-num">${fmtNumber(row.sessions)}</td><td>${fmtDateTime(row.last_seen)}</td></tr>`).join('')}</tbody></table></div>
            <p class="adm-note" style="margin-top:6px">Pode ser uma casa ou escola. Se as contas forem novas e fizerem muitas chamadas, suspenda-as na aba Usuários.</p>`
    : '<p class="adm-note">Nenhum IP nessa situação.</p>'}
          <h3 style="font-size:15px; margin:18px 0 6px">Logins recentes</h3>
          <div class="adm-table-wrap"><table class="adm-table">
            <caption class="adm-sr">Sessões recentes</caption>
            <thead><tr><th scope="col">Quando</th><th scope="col">Conta</th><th scope="col">IP</th><th scope="col">Navegador</th></tr></thead>
            <tbody>${(data.recent_sessions || []).map((row) => `<tr><td style="white-space:nowrap">${fmtDateTime(row.created_at)}</td>
              <td>${escapeHtml(row.email || '—')}</td><td>${escapeHtml(row.ip || '—')}</td><td class="adm-note">${escapeHtml(row.user_agent || '—')}</td></tr>`).join('')}</tbody></table></div>
        </section>

        <section class="adm-section" aria-labelledby="adm-sec-hygiene">
          <header><h2 id="adm-sec-hygiene">Higiene de sessões</h2>
            <p>Sessões sem renovação há 30+ dias são encerradas todo dia às 04:17 (UTC). Quem ficou parado só entra de novo.</p></header>
          <div id="adm-hygiene-box" aria-live="polite"><p class="adm-note">Carregando…</p></div>
        </section>

        <div class="adm-split adm-section">
          <section aria-labelledby="adm-sec-heavy">
            <header class="adm-sec-h" style="margin-bottom:10px"><h2 id="adm-sec-heavy" style="font-size:17px">Maiores consumidores (24 h)</h2></header>
            ${(data.heavy_users || []).length ? `<ul class="adm-bars">${data.heavy_users.map((row) => `<li><span>${escapeHtml(row.email || '—')}</span><span></span><span class="adm-num">${fmtNumber(row.calls)}</span></li>`).join('')}</ul>`
    : '<p class="adm-note">Sem chamadas registradas.</p>'}
          </section>
          <section aria-labelledby="adm-sec-actions">
            <header class="adm-sec-h" style="margin-bottom:10px"><h2 id="adm-sec-actions" style="font-size:17px">Ações administrativas (7 dias)</h2></header>
            ${(data.admin_actions_7d || []).length ? `<ul class="adm-bars">${data.admin_actions_7d.map((row) => `<li><span>${escapeHtml(row.action)}</span><span></span><span class="adm-num">${fmtNumber(row.count)}</span></li>`).join('')}</ul>`
    : '<p class="adm-note">Nenhuma ação registrada.</p>'}
          </section>
        </div>

        <section class="adm-section" aria-labelledby="adm-sec-manual">
          <header><h2 id="adm-sec-manual">Medidas que dependem dos painéis Vercel e Supabase</h2>
            <p>O app não consegue ligar estas proteções sozinho. Marque conforme for configurando.</p></header>
          <div class="adm-table-wrap"><table class="adm-table">
            <caption class="adm-sr">Medidas manuais de segurança</caption>
            <thead><tr><th scope="col">Onde</th><th scope="col">Medida</th><th scope="col">Como</th><th scope="col">Custo</th></tr></thead>
            <tbody>${MANUAL_MEASURES.map((item) => `<tr><td style="white-space:nowrap">${escapeHtml(item.where)}</td>
              <td><strong>${escapeHtml(item.title)}</strong></td><td class="adm-note">${escapeHtml(item.how)}</td>
              <td>${escapeHtml(item.plan)}</td></tr>`).join('')}</tbody></table></div>
        </section>`;
      mountHygiene(el.querySelector('#adm-hygiene-box'), ctx);
    },
  });
}
