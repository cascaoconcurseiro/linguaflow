import { lemma } from '../../../utils/lemma.js';

const ONBOARDING_KEY = 'onboarding_v1';
const ONBOARDING_LEVELS = new Set(['beginner', 'intermediate', 'advanced']);

function parseOnboarding(value) {
    if (typeof value !== 'string') return null;
    try {
        const parsed = JSON.parse(value);
        const dailyGoal = Number(parsed?.dailyGoal);
        if (parsed?.version !== 1 || !ONBOARDING_LEVELS.has(parsed.level)
            || !Number.isInteger(dailyGoal) || dailyGoal < 1 || dailyGoal > 200) return null;
        return {
            version: 1,
            completed: parsed.completed === true,
            level: parsed.level,
            dailyGoal,
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
        };
    } catch {
        return null;
    }
}

function renderHomeLoadError(container, app) {
    container.innerHTML = `
        <section class="onboarding-shell" aria-labelledby="home-load-error-title">
            <div class="onboarding-card" role="alert">
                <p class="onboarding-kicker">CONEXÃO</p>
                <h2 id="home-load-error-title">Não foi possível carregar seus dados</h2>
                <p>Seus cards não foram apagados. Verifique a conexão e tente novamente.</p>
                <button type="button" class="btn-action btn-study" id="btn-retry-home">Tentar novamente</button>
            </div>
        </section>`;
    container.querySelector('#btn-retry-home')?.addEventListener('click', () => renderHome(container, app));
}

function renderOnboarding(container, app, initial = {}) {
    let step = 1;
    let level = initial.level || null;
    let dailyGoal = initial.dailyGoal || null;

    const levels = [
        ['beginner', 'Começando', 'Ainda formo frases curtas.'],
        ['intermediate', 'Intermediário', 'Entendo a ideia geral de textos e vídeos.'],
        ['advanced', 'Avançado', 'Quero ganhar precisão e vocabulário.'],
    ];
    const goals = [10, 20, 40];

    const draw = () => {
        const content = step === 1 ? `
            <p class="onboarding-kicker">PASSO 1 DE 3</p>
            <h2 id="onboarding-title">Como você se sente no inglês?</h2>
            <p>Isso personaliza o seu ponto de partida; você pode ajustar depois.</p>
            <div class="onboarding-options" role="radiogroup" aria-label="Nível atual de inglês">
                ${levels.map(([value, title, description]) => `<button type="button" class="onboarding-option ${level === value ? 'selected' : ''}" role="radio" aria-checked="${level === value}" data-level="${value}"><strong>${title}</strong><span>${description}</span></button>`).join('')}
            </div>` : step === 2 ? `
            <p class="onboarding-kicker">PASSO 2 DE 3</p>
            <h2 id="onboarding-title">Qual é sua meta diária?</h2>
            <p>Ela passa a ser sua missão diária de revisões. Comece leve: consistência vence intensidade.</p>
            <div class="onboarding-options" role="radiogroup" aria-label="Meta diária de revisões">
                ${goals.map(goal => `<button type="button" class="onboarding-option ${dailyGoal === goal ? 'selected' : ''}" role="radio" aria-checked="${dailyGoal === goal}" data-goal="${goal}"><strong>${goal} revisões</strong><span>${goal === 10 ? 'Cerca de 5 minutos' : goal === 20 ? 'Cerca de 10 minutos' : 'Cerca de 20 minutos'}</span></button>`).join('')}
            </div>` : `
            <p class="onboarding-kicker">PASSO 3 DE 3</p>
            <h2 id="onboarding-title">Seu plano está pronto</h2>
            <p><strong>${dailyGoal} revisões por dia</strong>, no ritmo ${levels.find(item => item[0] === level)?.[1].toLowerCase() || 'escolhido'}.</p>
            <p>Comece por uma história curta e salve a primeira palavra que quiser praticar. Ela aparecerá nos seus flashcards.</p>`;
        container.innerHTML = `
            <section class="onboarding-shell" aria-labelledby="onboarding-title">
                <div class="onboarding-card">
                    ${content}
                    <p class="onboarding-status" id="onboarding-status" role="status" aria-live="polite"></p>
                    <div class="onboarding-actions">
                        ${step > 1 ? '<button type="button" class="onboarding-back" id="btn-onboarding-back">Voltar</button>' : ''}
                        ${step < 3 ? `<button type="button" class="btn-action btn-study" id="btn-onboarding-next" ${step === 1 && !level || step === 2 && !dailyGoal ? 'disabled' : ''}>Continuar</button>` : '<button type="button" class="btn-action btn-study" id="btn-onboarding-finish">Começar pela história</button>'}
                    </div>
                </div>
            </section>`;

        container.querySelectorAll('[data-level]').forEach(button => button.addEventListener('click', () => {
            level = button.dataset.level;
            draw();
        }));
        container.querySelectorAll('[data-goal]').forEach(button => button.addEventListener('click', () => {
            dailyGoal = Number(button.dataset.goal);
            draw();
        }));
        container.querySelector('#btn-onboarding-back')?.addEventListener('click', () => { step -= 1; draw(); });
        container.querySelector('#btn-onboarding-next')?.addEventListener('click', () => { step += 1; draw(); });
        container.querySelector('#btn-onboarding-finish')?.addEventListener('click', async (event) => {
            const button = event.currentTarget;
            const status = container.querySelector('#onboarding-status');
            button.disabled = true;
            status.textContent = 'Salvando seu plano…';
            const record = JSON.stringify({ version: 1, completed: true, level, dailyGoal, updatedAt: new Date().toISOString() });
            try {
                const saved = await app.db.setSetting(ONBOARDING_KEY, record);
                if (!saved) throw new Error('Configuração não confirmada');
                app.navigate?.('stories');
            } catch (error) {
                console.warn('[Onboarding] Não foi possível salvar:', error);
                status.textContent = 'Não foi possível salvar seu plano. Tente novamente.';
                button.disabled = false;
            }
        });
    };
    draw();
}

export async function renderHome(container, app) {
    injectStyles();

    // Stats via db unificado (Supabase) exposto em app.db
    const db = app?.db;
    container.setAttribute('aria-busy', 'true');
    container.innerHTML = '<p class="home-loading" role="status">Carregando seu painel…</p>';
    if (!db) {
        container.removeAttribute('aria-busy');
        renderHomeLoadError(container, app);
        return;
    }
    const [statsResult, userStatsResult, onboardingResult] = await Promise.allSettled([
        db.getStats(), db.getUserStats(), db.getSetting(ONBOARDING_KEY),
    ]);
    container.removeAttribute('aria-busy');
    if (statsResult.status !== 'fulfilled') {
        renderHomeLoadError(container, app);
        return;
    }
    const stats = statsResult.value;
    const userStats = userStatsResult.status === 'fulfilled' ? userStatsResult.value : null;
    if (onboardingResult.status !== 'fulfilled') {
        // Sem confirmação do estado persistido, não assumimos que seja uma conta vazia.
        renderHomeLoadError(container, app);
        return;
    }
    const onboarding = parseOnboarding(onboardingResult.value);
    if (!onboarding?.completed) {
        renderOnboarding(container, app, onboarding || {});
        return;
    }

    const safeStats = stats || { totalWords: 0, dueCards: 0, byStatus: {}, sessions: [] };
    // FONTE ÚNICA: user_stats (Postgres). O localStorage paralelo foi removido —
    // eram duas verdades de XP/streak que divergiam (achado da auditoria).
    const xpToday = userStats?.xp_today ?? 0;
    const streak = userStats?.streak ?? 0;

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

    // A meta escolhida no onboarding é a missão principal. Em retorno após
    // ausência, reduzimos apenas essa primeira missão para evitar fricção.
    const revTarget = isReturning ? Math.min(onboarding.dailyGoal, 5) : onboarding.dailyGoal;
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

function injectStyles() {
    if (document.getElementById('gamified-home-styles')) return;
    const style = document.createElement('style');
    style.id = 'gamified-home-styles';
    style.textContent = `
        .home-loading { padding: 32px; color: var(--color-text-light); font-weight: 700; }
        .onboarding-shell { min-height: calc(100vh - 150px); display: grid; place-items: center; padding: 24px; }
        .onboarding-card { width: min(100%, 620px); background: var(--color-surface); border: 2px solid var(--color-border); border-radius: 24px; padding: clamp(24px, 6vw, 48px); box-shadow: 0 8px 24px rgba(0,0,0,.08); }
        .onboarding-card h2 { color: var(--color-text); font-size: clamp(26px, 5vw, 34px); margin: 0 0 12px; }
        .onboarding-card p { color: var(--color-text-light); font-size: 16px; line-height: 1.55; }
        .onboarding-kicker { color: var(--color-primary) !important; font-size: 12px !important; font-weight: 900; letter-spacing: .08em; margin: 0 0 10px; }
        .onboarding-options { display: grid; gap: 12px; margin: 26px 0; }
        .onboarding-option { appearance: none; width: 100%; text-align: left; background: var(--color-bg-alt); border: 2px solid var(--color-border); border-radius: 14px; color: var(--color-text); cursor: pointer; font: inherit; padding: 16px; }
        .onboarding-option strong, .onboarding-option span { display: block; }
        .onboarding-option span { color: var(--color-text-light); font-size: 14px; margin-top: 4px; }
        .onboarding-option.selected { border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 22%, transparent); }
        .onboarding-option:focus-visible, .onboarding-actions button:focus-visible { outline: 3px solid #1cb0f6; outline-offset: 3px; }
        .onboarding-actions { display: flex; align-items: center; gap: 12px; justify-content: flex-end; margin-top: 28px; }
        .onboarding-actions .btn-action { flex: 0 1 auto; min-height: 52px; padding: 12px 20px; }
        .onboarding-back { background: transparent; border: 0; color: var(--color-text-light); cursor: pointer; font: inherit; font-weight: 800; padding: 12px; }
        .onboarding-status { min-height: 1.5em; color: #d9534f !important; font-weight: 700; }
        @media (max-width: 480px) { .onboarding-shell { padding: 16px; } .onboarding-actions { align-items: stretch; flex-direction: column-reverse; } .onboarding-actions .btn-action { width: 100%; } }
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
