export async function renderLeagues(container, app) {
  // 1. Setup Data
  const leagues = ['Bronze', 'Prata', 'Ouro', 'Safira', 'Rubi', 'Diamante'];
  let currentLeagueIndex = parseInt(localStorage.getItem('lf_league_index')) || 0;
  let userWeeklyXp = parseInt(localStorage.getItem('lf_xp_week')) || parseInt(localStorage.getItem('lf_xp_today')) || 0;
  
  if (currentLeagueIndex >= leagues.length) currentLeagueIndex = leagues.length - 1;
  const currentLeague = leagues[currentLeagueIndex];

  // 2. Generate Bots
  let bots = [];
  try {
    bots = JSON.parse(localStorage.getItem('lf_league_bots'));
  } catch(e) {}
  
  if (!bots || bots.length < 20) {
    bots = [];
    const firstNames = [
        'Ana', 'João', 'Maria', 'Pedro', 'Lucas', 'Julia', 'Carlos', 'Mariana', 
        'Paulo', 'Fernanda', 'Rafael', 'Amanda', 'Diego', 'Beatriz', 'Luiz', 
        'Camila', 'Bruno', 'Letícia', 'Thiago', 'Laura', 'Alex', 'Sam', 'Chris'
    ];
    for (let i = 0; i < 20; i++) {
        // Bots have XP around the user's XP, some higher, some lower
        let botXp = Math.max(0, userWeeklyXp + Math.floor((Math.random() - 0.5) * 500));
        bots.push({
            id: `bot_${i}`,
            name: firstNames[Math.floor(Math.random() * firstNames.length)],
            xp: botXp,
            isUser: false
        });
    }
    localStorage.setItem('lf_league_bots', JSON.stringify(bots));
  } else {
      // Simulate some bot progress over time
      if (Math.random() > 0.5) {
          bots.forEach(bot => {
              if (Math.random() > 0.3) bot.xp += Math.floor(Math.random() * 50);
          });
          localStorage.setItem('lf_league_bots', JSON.stringify(bots));
      }
  }

  const userEntry = { id: 'user', name: 'Você', xp: userWeeklyXp, isUser: true };
  const allEntries = [...bots, userEntry].sort((a, b) => b.xp - a.xp);

  const userRank = allEntries.findIndex(e => e.id === 'user') + 1;
  
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
      background: #fff;
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

      <div class="league-nav">
          <button class="btn-league" id="btnSimulateEnd">Simular Fim da Semana</button>
      </div>
    </div>
  `;

  // 4. Attach Events
  const btnSimulateEnd = container.querySelector('#btnSimulateEnd');
  if (btnSimulateEnd) {
      btnSimulateEnd.addEventListener('click', () => {
          if (userRank <= 5) {
              if (currentLeagueIndex < leagues.length - 1) {
                  localStorage.setItem('lf_league_index', currentLeagueIndex + 1);
                  app.showToast?.(`Parabéns! Você foi promovido para a Liga ${leagues[currentLeagueIndex + 1]}!`, 'success');
              } else {
                  app.showToast?.('Incrível! Você se manteve no topo da Liga Diamante!', 'success');
              }
          } else if (userRank >= allEntries.length - 4) { // Bottom 5
              if (currentLeagueIndex > 0) {
                  localStorage.setItem('lf_league_index', currentLeagueIndex - 1);
                  app.showToast?.(`Poxa! Você caiu para a Liga ${leagues[currentLeagueIndex - 1]}.`, 'error');
              } else {
                   app.showToast?.('Você continua na Liga Bronze. Tente estudar mais na próxima semana!', 'info');
              }
          } else {
              app.showToast?.(`Você permaneceu na Liga ${currentLeague}.`, 'info');
          }
          
          // Reset week XP and bots
          localStorage.setItem('lf_xp_week', '0');
          localStorage.removeItem('lf_league_bots');
          
          // Re-render
          setTimeout(() => renderLeagues(container, app), 1500);
      });
  }

  // Scroll to user item
  setTimeout(() => {
    const userEl = container.querySelector('.is-user');
    if (userEl) {
        userEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);
}
