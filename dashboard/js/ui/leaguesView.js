import { db as lfDb } from '../../../utils/db.js';

export async function renderLeagues(container, app) {
  // 1. Setup Data
  const leagues = ['Bronze', 'Prata', 'Ouro', 'Safira', 'Rubi', 'Diamante'];

  // Rollover REAL: o pg_cron roda toda segunda 00:05 UTC; esta chamada lazy é
  // a rede de segurança (idempotente no banco). Fim do "Simular Fim da Semana".
  const rollover = await lfDb.maybeLeagueRollover().catch(() => null);
  if (rollover?.ran) {
    app.showToast?.('🏆 Nova semana de liga começou! Placar semanal zerado.', 'info');
  }

  // Ensure user has a profile
  let userStats = await lfDb.getUserStats();
  if (!userStats) {
      await lfDb.ensureUserStats(); // Will create the profile if missing via backend
      userStats = await lfDb.getUserStats();
  }

  let currentLeagueIndex = userStats ? (userStats.league_index || 0) : 0;
  if (currentLeagueIndex >= leagues.length) currentLeagueIndex = leagues.length - 1;
  const currentLeague = leagues[currentLeagueIndex];

  // 2. Fetch Leaderboard from Supabase
  const realUsers = await lfDb.getLeaderboard(currentLeagueIndex, 20);
  
  // Map real users to leaderboard format
  const allEntries = realUsers.map(u => ({
      id: u.user_id,
      name: u.username || 'Estudante',
      xp: u.xp_week || 0,
      isUser: userStats && u.user_id === userStats.user_id
  }));

  // Só usuários REAIS — os "bots fantasmas" antigos eram dados falsos que
  // minavam a confiança no app. Liga pequena é honesta; ela cresce com a base.

  allEntries.sort((a, b) => b.xp - a.xp);

  let userRank = allEntries.findIndex(e => e.isUser) + 1;
  if (userRank === 0) userRank = allEntries.length; // Fallback if user somehow not in top 20
  
  // 3. Render CSS
  if (!document.getElementById('league-styles')) {
    const style = document.createElement('style');
    style.id = 'league-styles';
    style.textContent = `
    .league-container {
      font-family: 'Inter', sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background: var(--color-surface);
      border-radius: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .league-header {
      text-align: center;
      margin-bottom: 24px;
    }
    .league-title {
      font-size: 24px;
      font-weight: 800;
      color: var(--color-text);
      margin: 0 0 8px 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .league-subtitle {
      font-size: 14px;
      color: var(--color-text-light);
      margin: 0;
    }
    .league-context {
      margin: 12px 0 0; padding: 10px 12px; border-radius: 10px;
      background: var(--color-bg-alt); color: var(--color-text-light);
      font-size: 12px; line-height: 1.45; text-align: left;
    }
    .leaderboard {
      list-style: none;
      padding: 0;
      margin: 0;
      border: 1px solid var(--color-border);
      border-radius: 12px;
      overflow: hidden;
    }
    .leaderboard-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-border);
      transition: background 0.2s;
    }
    .leaderboard-item:last-child {
      border-bottom: none;
    }
    .leaderboard-item.is-user {
      background: rgba(28, 176, 246, 0.1);
      font-weight: bold;
    }
    .leaderboard-item:hover {
      background: var(--color-bg-alt);
    }
    .leaderboard-item.is-user:hover {
      background: rgba(28, 176, 246, 0.18);
    }
    .rank-number {
      width: 40px;
      font-size: 16px;
      color: var(--color-text-light);
      font-weight: bold;
      text-align: center;
    }
    .rank-number.top-3 {
      color: var(--color-warning);
    }
    .rank-number.top-1 {
      font-size: 20px;
    }
    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--color-bg-alt);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      margin-right: 16px;
      color: var(--color-text);
      border: 2px solid var(--color-border);
    }
    .is-user .user-avatar {
      background: var(--color-secondary);
      color: white;
      border-color: var(--color-secondary-shadow);
    }
    .user-name {
      flex: 1;
      font-size: 16px;
      color: var(--color-text);
    }
    .user-xp {
      font-size: 16px;
      color: var(--color-text-light);
      font-weight: 600;
    }
    .promotion-zone {
      padding: 8px;
      background: rgba(88, 204, 2, 0.12);
      color: var(--color-primary);
      font-size: 12px;
      text-align: center;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .demotion-zone {
      padding: 8px;
      background: rgba(255, 75, 75, 0.12);
      color: var(--color-danger);
      font-size: 12px;
      text-align: center;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .league-nav {
        display: flex;
        justify-content: center;
        margin-top: 20px;
    }
    .btn-league {
        padding: 10px 20px;
        border-radius: 8px;
        border: none;
        background: var(--color-bg-alt);
        color: var(--color-text);
        font-weight: bold;
        cursor: pointer;
        transition: 0.2s;
        font-family: inherit;
    }
    .btn-league:hover {
        background: var(--color-border);
    }
    `;
    document.head.appendChild(style);
  }

  // Render HTML
  container.innerHTML = `
    <div class="league-container">
      <div class="league-header">
        <h2 class="league-title">🏆 Liga ${currentLeague}</h2>
        <p class="league-subtitle">Top 5 avançam para a próxima liga</p>
        <p class="league-context"><strong>Liga opcional:</strong> XP registra diferentes atividades no app e não mede domínio. Prática livre não pontua nem altera sua revisão.</p>
      </div>
      
      <div class="leaderboard">
        <div class="promotion-zone">Zona de Promoção</div>
        ${allEntries.map((entry, index) => {
          let rankHtml = index + 1;
          let rankClasses = 'rank-number';
          if (index === 0) { rankHtml = '🥇'; rankClasses += ' top-1 top-3'; }
          else if (index === 1) { rankHtml = '🥈'; rankClasses += ' top-3'; }
          else if (index === 2) { rankHtml = '🥉'; rankClasses += ' top-3'; }

          const initial = entry.name.charAt(0).toUpperCase();

          let borderHtml = '';
          if (index === 4) { // After 5th place
            borderHtml = '</div><div class="leaderboard" style="border-top:none; border-bottom:none; border-radius:0;">';
          }
          if (index === allEntries.length - 6) { // Before bottom 5
             borderHtml = '</div><div class="demotion-zone">Zona de Rebaixamento</div><div class="leaderboard" style="border:none; border-radius:0;">';
          }

          return `
            <div class="leaderboard-item ${entry.isUser ? 'is-user' : ''}" id="rank-${index}">
              <div class="${rankClasses}">${rankHtml}</div>
              <div class="user-avatar">${initial}</div>
              <div class="user-name">${entry.name}</div>
              <div class="user-xp">${entry.xp} XP</div>
            </div>
            ${borderHtml}
          `;
        }).join('')}
      </div>

      <div class="league-nav" style="flex-direction:column; align-items:center; gap:6px;">
          <div style="font-size:13px; color:var(--color-text-light); font-weight:bold;">⏰ A semana vira automaticamente toda segunda-feira</div>
          <div id="league-countdown" style="font-size:13px; color:var(--color-text-light);"></div>
      </div>
    </div>
  `;

  // 4. Countdown real até o fim da semana (segunda 00:00 UTC)
  const cdEl = container.querySelector('#league-countdown');
  if (cdEl) {
      const now = new Date();
      const daysToMonday = (8 - now.getUTCDay()) % 7 || 7;
      const nextMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToMonday));
      const msLeft = nextMonday.getTime() - now.getTime();
      const d = Math.floor(msLeft / 86400000);
      const h = Math.floor((msLeft % 86400000) / 3600000);
      cdEl.textContent = `Faltam ${d}d ${h}h — a colocação semanal define promoção ou rebaixamento.`;
  }

  // Scroll to user item
  setTimeout(() => {
    const userEl = container.querySelector('.is-user');
    if (userEl) {
        userEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);
}
