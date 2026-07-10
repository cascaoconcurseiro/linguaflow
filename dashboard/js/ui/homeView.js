import { lemma } from '../../../utils/lemma.js';

export async function renderHome(container, app) {
    injectStyles();

    // Stats via db unificado (Supabase) exposto em app.db
    const db = app?.db;
    const stats = db ? await db.getStats().catch(() => null) : null;
    const userStats = db ? await db.getUserStats().catch(() => null) : null;

    const safeStats = stats || { totalWords: 0, dueCards: 0, byStatus: {}, sessions: [] };
    const xpToday = userStats?.xp_today ?? parseInt(localStorage.getItem('lf_xp_today') || '0');
    const streak = userStats?.streak ?? parseInt(localStorage.getItem('lf_streak') || '0');

    // MODO EMPTY STATE (Onboarding)
    if (safeStats.totalWords === 0) {
        container.innerHTML = `
            <div class="gamified-home" style="justify-content: center; align-items: center; min-height: calc(100vh - 100px);">
                <div class="onboarding-card" style="background: var(--color-surface); border-radius: 24px; padding: 48px 32px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); text-align: center; max-width: 600px; width: 100%; border: 2px solid var(--color-border);">
                    <div style="font-size: 80px; margin-bottom: 24px; animation: wave 2s infinite; display: inline-block; transform-origin: 70% 70%;">👋</div>
                    <h2 style="font-size: 32px; color: var(--color-text); margin: 0 0 16px 0; font-weight: 900;">Bem-vindo ao LinguaFlow!</h2>
                    <p style="font-size: 18px; color: var(--color-text-light); font-weight: 700; margin: 0 auto 32px; line-height: 1.5;">Seu vocabulário está zerado. Para começar a aprender e ganhar XP, siga estes 3 passos simples usando a nossa Extensão:</p>
                    
                    <div style="display: flex; flex-direction: column; gap: 16px; text-align: left; background: var(--color-bg-alt); border: 2px solid var(--color-border); border-radius: 24px; padding: 24px;">
                        <div style="display: flex; gap: 16px; align-items: center;">
                            <div style="background: #58cc02; box-shadow: 0 4px 0 #58a700; color: white; width: 36px; height: 36px; min-width: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px;">1</div>
                            <div style="font-weight: bold; color: var(--color-text); font-size: 16px;">Acesse qualquer site em inglês no Google Chrome</div>
                        </div>
                        <div style="display: flex; gap: 16px; align-items: center;">
                            <div style="background: #ce82ff; box-shadow: 0 4px 0 #a561cf; color: white; width: 36px; height: 36px; min-width: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px;">2</div>
                            <div style="font-weight: bold; color: var(--color-text); font-size: 16px;">Dê dois cliques em uma palavra desconhecida</div>
                        </div>
                        <div style="display: flex; gap: 16px; align-items: center;">
                            <div style="background: #ffc800; box-shadow: 0 4px 0 #e5b400; color: white; width: 36px; height: 36px; min-width: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px;">3</div>
                            <div style="font-weight: bold; color: var(--color-text); font-size: 16px;">Leia a tradução e clique no botão Salvar!</div>
                        </div>
                    </div>
                </div>
                <style>
                    @keyframes wave {
                        0% { transform: rotate(0deg); }
                        10% { transform: rotate(14deg); }
                        20% { transform: rotate(-8deg); }
                        30% { transform: rotate(14deg); }
                        40% { transform: rotate(-4deg); }
                        50% { transform: rotate(10deg); }
                        60% { transform: rotate(0deg); }
                        100% { transform: rotate(0deg); }
                    }
                </style>
            </div>
        `;
        return;
    }

    // Missões diárias calculadas de dados REAIS (não mais localStorage estático)
    const todayISO = new Date().toISOString().slice(0, 10);
    let reviewsToday = 0;
    let wordsToday = 0;
    let retention30 = null;   // % de acertos (não-"Errei") nos últimos 30 dias
    let dueTomorrow = 0;      // carga de amanhã
    let dueWeek = 0;          // carga dos próximos 7 dias
    let knownFamilies = 0;  // famílias de palavras conhecidas (métrica LingQ)
    try {
        const [logToday, log30, allWords, allCards, knownWords] = await Promise.all([
            db ? db.getReviewLog(1) : [],
            db ? db.getReviewLog(30) : [],
            db ? db.getAllWords() : [],
            db ? db.getAllCards() : [],
            db ? db.getAllKnownWords().catch(() => []) : []
        ]);
        reviewsToday = (logToday || []).filter(r => r.date === todayISO).length;
        wordsToday = (allWords || []).filter(w => (w.added_at || '').slice(0, 10) === todayISO).length;

        // Conhecidas = marcadas no Leitor + cards maduros, agrupadas por família
        const matureByWordId = {};
        (allCards || []).forEach(c => { matureByWordId[c.word_id] = c.status === 'mature'; });
        const fams = new Set();
        (knownWords || []).forEach(k => { const l = lemma(k.word); if (l) fams.add(l); });
        (allWords || []).forEach(w => { if (matureByWordId[w.id]) { const l = lemma(w.word); if (l) fams.add(l); } });
        knownFamilies = fams.size;

        if (log30 && log30.length >= 5) {
            const hits = log30.filter(r => r.quality >= 2).length;
            retention30 = Math.round((hits / log30.length) * 100);
        }

        const startTomorrow = new Date(); startTomorrow.setDate(startTomorrow.getDate() + 1); startTomorrow.setHours(0, 0, 0, 0);
        const endTomorrow = new Date(startTomorrow); endTomorrow.setDate(endTomorrow.getDate() + 1);
        const endWeek = new Date(startTomorrow); endWeek.setDate(endWeek.getDate() + 7);
        (allCards || []).forEach(c => {
            if (c.suspended) return;
            const due = new Date(c.due_date);
            if (due >= startTomorrow && due < endTomorrow) dueTomorrow++;
            if (due >= startTomorrow && due < endWeek) dueWeek++;
        });
    } catch (e) { console.warn('[Home] Erro ao calcular missões:', e); }

    // Pool de missões: 3 sorteadas por dia (seed = data — todo dia muda,
    // mas fica estável ao longo do mesmo dia)
    const QUEST_POOL = [
        { id: 'xp50', text: "Ganhar 50 XP", target: 50, value: () => xpToday },
        { id: 'xp80', text: "Ganhar 80 XP", target: 80, value: () => xpToday },
        { id: 'rev10', text: "Revisar 10 cartas", target: 10, value: () => reviewsToday },
        { id: 'rev20', text: "Revisar 20 cartas", target: 20, value: () => reviewsToday },
        { id: 'new3', text: "Aprender 3 novas palavras", target: 3, value: () => wordsToday },
        { id: 'new5', text: "Aprender 5 novas palavras", target: 5, value: () => wordsToday },
        { id: 'new8', text: "Caçar 8 palavras novas", target: 8, value: () => wordsToday },
    ];
    let seed = todayISO.split('-').reduce((a, n) => a + Number(n), 0);
    const seededRand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const pool = [...QUEST_POOL].sort(() => seededRand() - 0.5);
    // Garante variedade: uma missão de cada tipo (xp/revisão/palavras novas)
    const picked = [
        pool.find(q => q.id.startsWith('xp')),
        pool.find(q => q.id.startsWith('rev')),
        pool.find(q => q.id.startsWith('new')),
    ].filter(Boolean);
    const quests = picked.map(q => {
        const current = Math.min(q.value(), q.target);
        return { ...q, current, done: current >= q.target };
    });

    container.innerHTML = `
        <div class="gamified-home">
            <div class="dashboard-main">
                <div class="dashboard-header">
                    <h2>Seu Resumo</h2>
                    <p>Continue construindo seu hábito diário!</p>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon" style="color:var(--color-primary)">📚</div>
                        <div class="stat-value">${safeStats.dueCards || 0}</div>
                        <div class="stat-label">Para Revisar</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon" style="color:var(--color-secondary)">⭐</div>
                        <div class="stat-value">${safeStats.byStatus?.mature || 0}</div>
                        <div class="stat-label">Palavras Maduras</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon" style="color:#ffc800">⚡</div>
                        <div class="stat-value">${xpToday}</div>
                        <div class="stat-label">XP Hoje</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon" style="color:#ff9600">🔥</div>
                        <div class="stat-value" id="stat-streak">${streak}</div>
                        <div class="stat-label">Dias de Ofensiva</div>
                    </div>
                </div>

                ${streak > 0 && reviewsToday === 0 ? `
                <div style="display:flex; gap:12px; align-items:center; margin-bottom:16px; background:rgba(255,150,0,0.1); border:2px solid #ff9600; border-radius:var(--radius-md); padding:14px 18px;">
                    <span style="font-size:28px;">🔥</span>
                    <div style="flex:1;">
                        <div style="font-weight:900; color:var(--color-text);">Sua ofensiva de ${streak} ${streak === 1 ? 'dia' : 'dias'} está em risco!</div>
                        <div style="font-size:13px; color:var(--color-text-light);">Revise 1 card hoje pra não perder o fogo.</div>
                    </div>
                    <button class="btn btn-primary" id="btn-save-streak" style="padding:10px 18px; font-size:13px;">Salvar ofensiva</button>
                </div>` : ''}
                <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px; background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-md); padding:14px 18px; align-items:center;">
                    <div style="font-weight:800; color:var(--color-text); font-size:14px;">📈 Memória:</div>
                    <div style="font-size:14px; color:var(--color-text-light);">Palavras conhecidas: <strong style="color:var(--color-primary);">${knownFamilies}</strong></div>
                    <div style="font-size:14px; color:var(--color-text-light);">Retenção 30d: <strong style="color:${retention30 === null ? 'var(--color-text-light)' : retention30 >= 85 ? 'var(--color-primary)' : retention30 >= 70 ? '#ffc800' : 'var(--color-danger)'};">${retention30 === null ? '—' : retention30 + '%'}</strong></div>
                    <div style="font-size:14px; color:var(--color-text-light);">Amanhã: <strong style="color:var(--color-text);">${dueTomorrow} ${dueTomorrow === 1 ? 'card' : 'cards'}</strong></div>
                    <div style="font-size:14px; color:var(--color-text-light);">Próximos 7 dias: <strong style="color:var(--color-text);">${dueWeek}</strong></div>
                    <div style="font-size:14px; color:var(--color-text-light);" title="Protege sua ofensiva se você pular 1 dia. Ganhe 1 a cada 7 dias de ofensiva.">🧊 Freezes: <strong style="color:var(--color-secondary);">${userStats?.streak_freezes ?? 1}</strong></div>
                </div>

                <div class="action-buttons">
                    <button class="btn-action btn-study" id="btn-study-now">
                        <span class="btn-icon">🧠</span>
                        ESTUDAR AGORA
                    </button>
                    <button class="btn-action btn-game" id="btn-play-match">
                        <span class="btn-icon">🎮</span>
                        JOGAR MATCH
                    </button>
                </div>

                <div class="heatmap-section">
                    <div class="heatmap-header">
                        <h3>Suas Contribuições (30 Dias)</h3>
                    </div>
                    <div class="heatmap-grid" id="heatmap-grid">
                        <!-- Rendered by JS -->
                    </div>
                </div>
            </div>

            <div class="sidebar">
                <div class="quests-card">
                    <h3>Missões Diárias</h3>
                    <div class="quests-list">
                        ${quests.map(q => `
                            <div class="quest-item ${q.done ? 'quest-done' : ''}">
                                <div class="quest-icon">🎯</div>
                                <div class="quest-details">
                                    <div class="quest-text">${q.text}</div>
                                    <div class="quest-progress">
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: ${(q.current / q.target) * 100}%"></div>
                                        </div>
                                        <span class="progress-text">${q.current} / ${q.target}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Events
    document.getElementById('btn-save-streak')?.addEventListener('click', () => {
        if (app && app.navigate) app.navigate('study');
    });
    document.getElementById('btn-study-now')?.addEventListener('click', () => {
        if (app && app.navigate) app.navigate('study');
    });

    document.getElementById('btn-play-match')?.addEventListener('click', () => {
        if (app && app.navigate) app.navigate('game');
    });

    const heatmapGrid = container.querySelector('#heatmap-grid');
    if (heatmapGrid && safeStats.sessions) {
        let cellsHTML = '';
        const todayDate = new Date();
        const thirtyDaysAgo = new Date(todayDate.getTime() - 29 * 24 * 60 * 60 * 1000);
        
        for (let i = 0; i < 30; i++) {
            const d = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
            const dateStr = d.toISOString().split('T')[0];
            const session = safeStats.sessions.find(s => s.date === dateStr);
            let level = 0;
            if (session) {
                if (session.seconds > 600) level = 4;
                else if (session.seconds > 300) level = 3;
                else if (session.seconds > 60) level = 2;
                else level = 1;
            }
            // Add a special effect for today
            const isToday = i === 29;
            if (isToday && level === 0 && xpToday > 0) level = 1; // Fallback if session didn't save yet but has XP
            
            cellsHTML += `<div class="heatmap-cell" data-level="${level}" title="${dateStr}"></div>`;
        }
        heatmapGrid.innerHTML = cellsHTML;
    }
}

function injectStyles() {
    if (document.getElementById('gamified-home-styles')) return;
    const style = document.createElement('style');
    style.id = 'gamified-home-styles';
    style.textContent = `
        .gamified-home {
            display: flex;
            flex-direction: column;
            gap: 24px;
            padding: 24px;
            max-width: 1200px;
            margin: 0 auto;
            font-family: 'Nunito', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: var(--color-bg);
            min-height: 100vh;
        }

        @media (min-width: 768px) {
            .gamified-home {
                flex-direction: row;
                align-items: flex-start;
            }
        }

        .dashboard-main {
            flex: 1;
            background: var(--color-surface);
            border: 2px solid var(--color-border);
            border-radius: 24px;
            padding: 32px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.08);
            display: flex;
            flex-direction: column;
            gap: 32px;
        }

        .dashboard-header h2 {
            color: var(--color-text);
            font-size: 28px;
            margin: 0 0 8px 0;
        }

        .dashboard-header p {
            color: var(--color-text-light);
            font-size: 16px;
            margin: 0;
            font-weight: bold;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
        }

        .stat-card {
            background: var(--color-bg-alt);
            border: 2px solid var(--color-border);
            border-radius: 16px;
            padding: 24px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .stat-icon {
            font-size: 32px;
            margin-bottom: 8px;
        }

        .stat-value {
            font-size: 32px;
            font-weight: 900;
            color: var(--color-text);
            margin-bottom: 4px;
        }

        .stat-label {
            font-size: 14px;
            font-weight: bold;
            color: var(--color-text-light);
        }

        .action-buttons {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        @media (min-width: 600px) {
            .action-buttons {
                flex-direction: row;
            }
        }

        .btn-action {
            flex: 1;
            padding: 20px;
            border-radius: 16px;
            font-size: 18px;
            font-weight: 800;
            font-family: inherit;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            border: none;
            color: white;
            transition: transform 0.1s, box-shadow 0.1s;
        }

        .btn-study {
            background: #58cc02;
            box-shadow: 0 6px 0 #58a700;
        }

        .btn-study:hover {
            background: #61df02;
        }

        .btn-study:active {
            transform: translateY(6px);
            box-shadow: 0 0 0 #58a700;
        }

        .btn-game {
            background: #ce82ff;
            box-shadow: 0 6px 0 #a561cf;
        }

        .btn-game:hover {
            background: #d694ff;
        }

        .btn-game:active {
            transform: translateY(6px);
            box-shadow: 0 0 0 #a561cf;
        }

        .btn-icon {
            font-size: 24px;
        }

        .sidebar {
            width: 100%;
        }

        @media (min-width: 768px) {
            .sidebar {
                width: 350px;
                flex-shrink: 0;
            }
        }

        .quests-card {
            background: var(--color-surface);
            border-radius: 24px;
            border: 2px solid var(--color-border);
            padding: 24px;
        }

        .quests-card h3 {
            margin: 0 0 20px 0;
            color: var(--color-text);
            font-size: 20px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .quests-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .quest-item {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .quest-icon {
            font-size: 32px;
        }

        .quest-details {
            flex: 1;
        }

        .quest-text {
            font-weight: bold;
            color: var(--color-text);
            margin-bottom: 8px;
            font-size: 15px;
        }

        .quest-progress {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .progress-bar {
            flex: 1;
            height: 12px;
            background: var(--color-border);
            border-radius: 6px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: #ffc800;
            border-radius: 6px;
            transition: width 0.3s ease;
        }

        .progress-text {
            font-size: 14px;
            font-weight: bold;
            color: var(--color-text-light);
        }

        .heatmap-section {
            background: var(--color-bg-alt);
            border: 2px solid var(--color-border);
            border-radius: 16px;
            padding: 24px;
            margin-top: 16px;
        }

        .heatmap-header h3 {
            margin: 0 0 16px 0;
            color: var(--color-text);
            font-size: 18px;
        }

        .heatmap-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .heatmap-cell {
            width: 18px;
            height: 18px;
            border-radius: 4px;
            background: var(--color-border);
            transition: transform 0.1s;
        }

        .heatmap-cell:hover {
            transform: scale(1.2);
        }

        .heatmap-cell[data-level="1"] { background: #9be9a8; }
        .heatmap-cell[data-level="2"] { background: #40c463; }
        .heatmap-cell[data-level="3"] { background: #30a14e; }
        .heatmap-cell[data-level="4"] { background: #216e39; }
    `;
    document.head.appendChild(style);
}
