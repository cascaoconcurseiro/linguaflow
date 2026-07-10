import { lemma } from '../../../utils/lemma.js';
import { runPlacementTest } from './settingsView.js';

export async function renderHome(container, app) {
    injectStyles();

    // Stats via db unificado (Supabase) exposto em app.db
    const db = app?.db;
    const stats = db ? await db.getStats().catch(() => null) : null;
    const userStats = db ? await db.getUserStats().catch(() => null) : null;

    const safeStats = stats || { totalWords: 0, dueCards: 0, byStatus: {}, sessions: [] };
    // FONTE ÚNICA: user_stats (Postgres). O localStorage paralelo foi removido —
    // eram duas verdades de XP/streak que divergiam (achado da auditoria).
    const xpToday = userStats?.xp_today ?? 0;
    const streak = userStats?.streak ?? 0;

    // ── ONBOARDING DE PRIMEIRO ACESSO (P1 da auditoria) ─────────────────────
    // Novo usuário sai do wizard com: nível CEFR definido (teste ou escolha),
    // meta diária REAL (grava new_per_day, a mesma chave que a fila de estudo
    // lê) e uma primeira ação útil. Roda uma vez (lf_onboarding_done).
    const onboardingDone = db ? await db.getSetting('lf_onboarding_done').catch(() => null) : null;
    if (safeStats.totalWords === 0 && !onboardingDone && db) {
        renderOnboarding(container, app, db);
        return;
    }

    // MODO EMPTY STATE (fez onboarding mas ainda não salvou palavras)
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
    let knownFamilies = 0;    // famílias de palavras conhecidas (métrica LingQ)
    let forecast = [];        // cards vencendo por dia, próximos 7 dias
    let avgReviews7 = 0;      // média de revisões/dia (7 dias) — calibra as missões
    let avgWords7 = 0;
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

        // Ritmo dos últimos 7 dias: é o que torna as missões ADAPTATIVAS
        const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const last7 = (log30 || []).filter(r => r.date >= sevenAgo);
        avgReviews7 = last7.length / 7;
        avgWords7 = (allWords || []).filter(w => (w.added_at || '').slice(0, 10) >= sevenAgo).length / 7;

        // Forecast: quantos cards vencem em cada um dos próximos 7 dias
        const startTomorrow = new Date(); startTomorrow.setDate(startTomorrow.getDate() + 1); startTomorrow.setHours(0, 0, 0, 0);
        forecast = Array(7).fill(0);
        (allCards || []).forEach(c => {
            if (c.suspended) return;
            const due = new Date(c.due_date);
            const dayIdx = Math.floor((due - startTomorrow) / 86400000);
            if (dayIdx >= 0 && dayIdx < 7) forecast[dayIdx]++;
        });
        dueTomorrow = forecast[0];
        dueWeek = forecast.reduce((a, b) => a + b, 0);
    } catch (e) { console.warn('[Home] Erro ao calcular missões:', e); }

    // ── Missões ADAPTATIVAS ──────────────────────────────────────────────────
    // Alvo = ritmo real do aluno (média 7d) + ~20% de desafio, com piso e teto.
    // Quem sumiu ganha uma missão de RETORNO leve em vez de meta alta.
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
    const lastStudy = userStats?.last_study_date || null;
    const daysAway = lastStudy ? Math.floor((Date.now() - new Date(lastStudy + 'T00:00:00Z').getTime()) / 86400000) : 0;
    const isReturning = daysAway >= 2; // sumiu 2+ dias

    const revTarget = isReturning ? 5 : clamp(avgReviews7 * 1.2, 5, 50);
    const xpTarget = isReturning ? 30 : clamp((avgReviews7 * 1.2 * 10) / 10, 3, 20) * 10;
    const newTarget = isReturning ? 2 : clamp(avgWords7 * 1.2, 2, 10);

    const quests = [
        isReturning
            ? { id: 'comeback', text: `De volta! Revise ${revTarget} cartas pra reacender o fogo 🔥`, target: revTarget, current: Math.min(reviewsToday, revTarget) }
            : { id: 'rev', text: `Revisar ${revTarget} cartas`, target: revTarget, current: Math.min(reviewsToday, revTarget) },
        { id: 'xp', text: `Ganhar ${xpTarget} XP`, target: xpTarget, current: Math.min(xpToday, xpTarget) },
        { id: 'new', text: `Aprender ${newTarget} novas palavras`, target: newTarget, current: Math.min(wordsToday, newTarget) },
    ].map(q => ({ ...q, done: q.current >= q.target }));

    // Recompensa REAL por fechar as 3 missões: +30 XP via Learning Engine
    // (RPC com cap 1x/dia no banco — não dá pra farmar).
    const allQuestsDone = quests.every(q => q.done);
    const countersToday = userStats?.counters_date === todayISO ? (userStats?.daily_counters || {}) : {};
    const questRewardClaimed = (countersToday.quests_complete || 0) > 0;

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

                ${isReturning ? `
                <div style="display:flex; gap:12px; align-items:center; margin-bottom:16px; background:rgba(28,176,246,0.1); border:2px solid var(--color-secondary); border-radius:var(--radius-md); padding:14px 18px;">
                    <span style="font-size:28px;">👋</span>
                    <div style="flex:1;">
                        <div style="font-weight:900; color:var(--color-text);">Sentimos sua falta! Você ficou ${daysAway} dias fora.</div>
                        <div style="font-size:13px; color:var(--color-text-light);">Sua missão de hoje é leve: só ${revTarget} cartas pra voltar ao ritmo. O primeiro estudo do dia dá bônus de XP.</div>
                    </div>
                    <button class="btn btn-primary" id="btn-comeback" style="padding:10px 18px; font-size:13px;">Voltar agora</button>
                </div>` : ''}
                ${streak > 0 && reviewsToday === 0 && !isReturning ? `
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
                    <div style="flex-basis:100%; display:flex; align-items:flex-end; gap:4px; height:42px; margin-top:4px;" title="Previsão de revisões (estilo Anki): quantos cards vencem em cada um dos próximos 7 dias">
                        ${forecast.map((n, i) => {
                            const max = Math.max(...forecast, 1);
                            const h = Math.max(4, Math.round((n / max) * 34));
                            const d = new Date(Date.now() + (i + 1) * 86400000);
                            const label = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][d.getDay()];
                            return `<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:2px;">
                                <div style="font-size:9px; color:var(--color-text-light); font-weight:700;">${n || ''}</div>
                                <div style="width:100%; max-width:26px; height:${h}px; background:${n ? 'var(--color-secondary)' : 'var(--color-border)'}; border-radius:3px;"></div>
                                <div style="font-size:9px; color:var(--color-text-light);">${label}</div>
                            </div>`;
                        }).join('')}
                    </div>
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
                    <h3>Missões Diárias <span style="font-size:11px; font-weight:700; color:var(--color-text-light);">(no seu ritmo${isReturning ? ' — modo retorno' : ''})</span></h3>
                    <div class="quests-list">
                        ${quests.map(q => `
                            <div class="quest-item ${q.done ? 'quest-done' : ''}">
                                <div class="quest-icon">${q.done ? '✅' : '🎯'}</div>
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
                    ${allQuestsDone && !questRewardClaimed ? `
                    <button id="btn-claim-quests" class="btn btn-primary" style="width:100%; margin-top:16px; padding:14px; font-size:15px;">🎁 Resgatar recompensa: +30 XP</button>
                    ` : ''}
                    ${allQuestsDone && questRewardClaimed ? `
                    <div style="text-align:center; margin-top:16px; font-weight:800; color:var(--color-primary); font-size:14px;">🏅 Missões do dia completas — recompensa resgatada!</div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    // Events
    document.getElementById('btn-save-streak')?.addEventListener('click', () => {
        if (app && app.navigate) app.navigate('study');
    });
    document.getElementById('btn-comeback')?.addEventListener('click', () => {
        if (app && app.navigate) app.navigate('study');
    });
    document.getElementById('btn-claim-quests')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = 'Resgatando...';
        try {
            const res = await db.recordEvent('quests_complete');
            if (res && res.xp_awarded > 0) {
                app.showToast?.(`🎁 +${res.xp_awarded} XP pela dedicação de hoje!`, 'success');
            } else {
                app.showToast?.('Recompensa de hoje já foi resgatada. 😉', 'info');
            }
        } catch (err) {
            console.error('[Home] Falha ao resgatar:', err);
            app.showToast?.('Erro ao resgatar. Tente de novo.', 'error');
            btn.disabled = false;
            btn.textContent = '🎁 Resgatar recompensa: +30 XP';
            return;
        }
        renderHome(container, app); // re-render com XP/estado novos
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

// ── Wizard de onboarding (3 passos) ─────────────────────────────────────────
function renderOnboarding(container, app, db) {
    const state = { level: null, goal: null };
    const LEVELS = [
        ['A1', 'Iniciante'], ['A2', 'Básico'], ['B1', 'Intermediário'],
        ['B2', 'Fluente Base'], ['C1', 'Avançado'],
    ];
    const GOALS = [
        { id: 'leve', label: '🌱 Leve', desc: '5 palavras novas/dia · ~10 min', newPerDay: 5 },
        { id: 'normal', label: '🎯 Normal', desc: '10 palavras novas/dia · ~20 min', newPerDay: 10 },
        { id: 'intenso', label: '🔥 Intenso', desc: '20 palavras novas/dia · ~40 min', newPerDay: 20 },
    ];

    function shell(step, inner) {
        container.innerHTML = `
        <div class="gamified-home" style="justify-content:center; align-items:center; min-height:calc(100vh - 100px);">
            <div style="background:var(--color-surface); border-radius:24px; padding:40px 32px; box-shadow:0 8px 24px rgba(0,0,0,0.08); text-align:center; max-width:620px; width:100%; border:2px solid var(--color-border);">
                <div style="display:flex; justify-content:center; gap:8px; margin-bottom:24px;" aria-label="Passo ${step} de 3">
                    ${[1, 2, 3].map(i => `<div style="width:${i === step ? 28 : 10}px; height:10px; border-radius:5px; background:${i <= step ? 'var(--color-primary)' : 'var(--color-border)'}; transition:all 0.3s;"></div>`).join('')}
                </div>
                ${inner}
            </div>
        </div>`;
    }

    function step1() {
        shell(1, `
            <div style="font-size:64px; margin-bottom:16px;">👋</div>
            <h2 style="font-size:28px; color:var(--color-text); margin:0 0 8px 0; font-weight:900;">Bem-vindo ao LinguaFlow!</h2>
            <p style="font-size:16px; color:var(--color-text-light); font-weight:700; margin:0 0 24px;">Primeiro: qual é o seu nível de inglês? Isso calibra a IA, as histórias e as legendas.</p>
            <button id="ob-test" class="btn btn-primary" style="width:100%; padding:16px; font-size:16px; margin-bottom:16px;">🎯 Descobrir meu nível (teste de 3 fases, ~4 min)</button>
            <p style="font-size:13px; color:var(--color-text-light); margin-bottom:12px;">Ou, se você já sabe:</p>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${LEVELS.map(([lv, name]) => `<button class="ob-level btn" data-level="${lv}" style="flex:1; min-width:90px; padding:12px 8px; background:var(--color-bg-alt); color:var(--color-text); border:2px solid var(--color-border); font-weight:800;">${lv}<br><span style="font-size:11px; font-weight:600; color:var(--color-text-light);">${name}</span></button>`).join('')}
            </div>`);
        document.getElementById('ob-test').addEventListener('click', () => {
            runPlacementTest(app, (level) => { state.level = level; step2(); });
        });
        container.querySelectorAll('.ob-level').forEach(btn => btn.addEventListener('click', async () => {
            state.level = btn.dataset.level;
            await db.setSetting('lf_cefr_level', state.level).catch(() => {});
            db.setSetting('cefrTargetLevel', state.level).catch(() => {});
            step2();
        }));
    }

    function step2() {
        shell(2, `
            <div style="font-size:64px; margin-bottom:16px;">${state.level ? '🎓' : '🎯'}</div>
            <h2 style="font-size:28px; color:var(--color-text); margin:0 0 8px 0; font-weight:900;">${state.level ? `Nível ${state.level} definido!` : 'Quase lá!'}</h2>
            <p style="font-size:16px; color:var(--color-text-light); font-weight:700; margin:0 0 24px;">Qual ritmo você quer manter? (Isso define de verdade quantas cartas novas entram por dia — dá pra mudar nas Configurações.)</p>
            <div style="display:flex; flex-direction:column; gap:12px;">
                ${GOALS.map(g => `
                <button class="ob-goal btn" data-goal="${g.id}" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; background:var(--color-bg-alt); color:var(--color-text); border:2px solid var(--color-border); font-weight:800; font-size:16px;">
                    <span>${g.label}</span><span style="font-size:13px; font-weight:600; color:var(--color-text-light);">${g.desc}</span>
                </button>`).join('')}
            </div>`);
        container.querySelectorAll('.ob-goal').forEach(btn => btn.addEventListener('click', async () => {
            const goal = GOALS.find(g => g.id === btn.dataset.goal);
            state.goal = goal;
            // Meta REAL: mesma chave que a fila de estudo respeita (new_per_day)
            await db.setSetting('new_per_day', String(goal.newPerDay)).catch(() => {});
            step3();
        }));
    }

    function step3() {
        shell(3, `
            <div style="font-size:64px; margin-bottom:16px;">🚀</div>
            <h2 style="font-size:28px; color:var(--color-text); margin:0 0 8px 0; font-weight:900;">Tudo pronto!</h2>
            <p style="font-size:16px; color:var(--color-text-light); font-weight:700; margin:0 0 24px;">Escolha sua primeira ação — cada palavra que você salvar vira um card inteligente que o sistema agenda pra você nunca esquecer.</p>
            <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:20px;">
                <button id="ob-story" class="btn btn-primary" style="padding:16px; font-size:16px;">📚 Gerar minha primeira história (no meu nível)</button>
                <button id="ob-reader" class="btn btn-secondary" style="padding:16px; font-size:16px;">📖 Experimentar o Leitor (colar um texto)</button>
            </div>
            <div style="text-align:left; background:var(--color-bg-alt); border:2px solid var(--color-border); border-radius:16px; padding:16px 20px; margin-bottom:20px;">
                <div style="font-weight:900; color:var(--color-text); margin-bottom:8px;">🎬 E nos vídeos (YouTube, Netflix…):</div>
                <div style="font-size:14px; color:var(--color-text-light); font-weight:600; line-height:1.6;">Instale a extensão LinguaFlow no Chrome → dê play num vídeo em inglês → clique em qualquer palavra da legenda pra salvar. É o jeito mais poderoso de aprender aqui.</div>
            </div>
            <button id="ob-done" style="background:none; border:none; color:var(--color-text-light); font-family:var(--font-main); font-weight:700; font-size:13px; cursor:pointer;">Pular por agora →</button>`);
        const finish = async (dest) => {
            await db.setSetting('lf_onboarding_done', 'true').catch(() => {});
            if (dest) app.navigate(dest); else renderHome(container, app);
        };
        document.getElementById('ob-story').addEventListener('click', () => finish('stories'));
        document.getElementById('ob-reader').addEventListener('click', () => finish('reader'));
        document.getElementById('ob-done').addEventListener('click', () => finish(null));
    }

    step1();
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
