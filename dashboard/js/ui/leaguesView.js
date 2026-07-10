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
      color: #3c3c3c;
      margin: 0 0 8px 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .league-subtitle {
      font-size: 14px;
      color: #777;
      margin: 0;
    }
    .leaderboard {
      list-style: none;
      padding: 0;
      margin: 0;
      border: 1px solid #e5e5e5;
      border-radius: 12px;
      overflow: hidden;
    }
    .leaderboard-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #e5e5e5;
      transition: background 0.2s;
    }
    .leaderboard-item:last-child {
      border-bottom: none;
    }
    .leaderboard-item.is-user {
      background: #f0f7ff;
      font-weight: bold;
    }
    .leaderboard-item:hover {
      background: #f9f9f9;
    }
    .leaderboard-item.is-user:hover {
      background: #e6f0fa;
    }
    .rank-number {
      width: 40px;
      font-size: 16px;
      color: #999;
      font-weight: bold;
      text-align: center;
    }
    .rank-number.top-3 {
      color: #ffc800;
    }
    .rank-number.top-1 {
      font-size: 20px;
    }
    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #eee;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      margin-right: 16px;
      color: #555;
    }
    .is-user .user-avatar {
      background: #1cb0f6;
      color: white;
    }
    .user-name {
      flex: 1;
      font-size: 16px;
      color: #4b4b4b;
    }
    .user-xp {
      font-size: 16px;
      color: #777;
      font-weight: 600;
    }
    .promotion-zone {
      padding: 8px;
      background: #e8f5e9;
      color: #2e7d32;
      font-size: 12px;
      text-align: center;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .demotion-zone {
      padding: 8px;
      background: #ffebee;
      color: #c62828;
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
        background: #eee;
        color: #555;
        font-weight: bold;
        cursor: pointer;
        transition: 0.2s;
        font-family: inherit;
    }
    .btn-league:hover {
        background: #ddd;
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
          <div style="font-size:13px; color:#777; font-weight:bold;">⏰ A semana vira automaticamente toda segunda-feira</div>
          <div id="league-countdown" style="font-size:13px; color:#999;"></div>
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
      cdEl.textContent = `Faltam ${d}d ${h}h — top 5 com XP sobem; inativos descem.`;
  }

  // Scroll to user item
  setTimeout(() => {
    const userEl = container.querySelector('.is-user');
    if (userEl) {
        userEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);
}
