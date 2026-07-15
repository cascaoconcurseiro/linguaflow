import { lemma } from '../../../utils/lemma.js';
import { addLocalDays, daysBetweenLocalKeys, localDateKey } from '../../../utils/local-day.js';
import { runPlacementTest } from './settingsView.js';
import { generateWeeklyDiagnosis, getCefrLevel } from '../core/ai.js';
import { computeAchievements, newlyUnlocked } from '../core/achievements.js';
import { bindViewStateAction, renderViewState } from './viewState.js';

function organizeHomeSections(container) {
    const main = container.querySelector('.dashboard-main');
    const sidebar = container.querySelector('.sidebar');
    if (!main || !sidebar) return;

    const section = (id, title, description) => {
        const el = document.createElement('section');
        el.id = id;
        el.className = 'home-flow-section';
        el.setAttribute('aria-labelledby', `${id}-title`);
        if (title) el.insertAdjacentHTML('beforeend', `<header class="home-section-heading"><h2 id="${id}-title">${title}</h2>${description ? `<p>${description}</p>` : ''}</header>`);
        return el;
    };
    const append = (target, selector) => {
        const node = container.querySelector(selector);
        if (node) target.appendChild(node);
    };

    const today = section('home-today', '', '');
    append(today, '.dashboard-header');
    append(today, '#home-primary-plan');

    const next = section('home-next', 'Depois', 'Continue em contexto real ou faça uma prática curta.');
    append(next, '#home-secondary-actions');

    const more = document.createElement('details');
    more.id = 'home-more';
    more.className = 'home-more';
    more.innerHTML = '<summary>Ver metas, memória e conquistas</summary><div class="home-more-body"></div>';
    const moreBody = more.querySelector('.home-more-body');
    append(moreBody, '#home-today-plan');
    append(moreBody, '.quests-card');
    append(moreBody, '.stats-grid');
    append(moreBody, '#home-memory-insight');
    append(moreBody, '.achievements-section');
    append(moreBody, '.heatmap-section');

    main.replaceChildren(today, next, more);
    sidebar.remove();
}

// Onda 9 (auditoria de bugs): weakWords[].word vem direto de words.word (o
// próprio texto salvo pelo usuário, sem sanitização — pode ter vindo de
// legenda/página capturada) e era interpolado sem escape num innerHTML.
// Palavra contendo `<`/`>`/`&` quebrava o layout do card "Plano de hoje".
function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char]));
}

// Onda 9 (auditoria de bugs): renderHome() é async com várias esperas de
// rede antes de "commitar" — app.js chama renderHome() de novo sempre que
// chega WORD_SAVED/REFRESH_DASHBOARD da extensão enquanto Início é a aba
// ativa, sem esperar a chamada anterior terminar. Duas chamadas sobrepostas
// não têm ordem garantida: se a mais antiga terminar DEPOIS e falhar,
// sobrescrevia um painel que já tinha carregado certo com a tela de erro; e
// o toast de conquista podia disparar em dobro. Cada chamada carimba sua
// própria geração e só "comita" (innerHTML final / toast de conquista) se
// ainda for a mais recente — senão, uma chamada mais nova já assumiu.
let _homeRenderGen = 0;

// Fiação REAL do onboarding (nada decorativo): a escolha rápida vira um CEFR
// de partida, o teste de 3 fases refina, e a meta grava a cota de cartas
// novas/dia na MESMA chave que a fila de estudo lê.
const LEVEL_TO_CEFR = { beginner: 'A1', intermediate: 'B1', advanced: 'B2' };
const GOAL_TO_NEW_PER_DAY = { 10: 5, 20: 10, 40: 20 };

const ONBOARDING_KEY = 'onboarding_v1';
const ONBOARDING_LEVELS = new Set(['beginner', 'intermediate', 'advanced']);

export function chooseTodayAction(state = {}) {
    const totalWords = Math.max(0, Number(state.totalWords) || 0);
    const dueCards = Math.max(0, Number(state.dueCards) || 0);
    const dueLearning = Math.min(dueCards, Math.max(0, Number(state.dueLearning) || 0));
    const dueReview = Math.max(0, dueCards - dueLearning);
    const reviewsToday = Math.max(0, Number(state.reviewsToday) || 0);
    const daysAway = Math.max(0, Number(state.daysAway) || 0);
    const dueTomorrow = Math.max(0, Number(state.dueTomorrow) || 0);
    const retention30 = state.retention30 === null || state.retention30 === undefined
        ? null : Number(state.retention30);
    if (totalWords === 0) return { kind:'first-context', route:'learn', label:'Encontrar uma frase', title:'Aprenda sua primeira frase real', reason:'Escolha um conteúdo, encontre uma frase útil e transforme esse momento em memória.', meta:'Vídeos, histórias ou textos — você escolhe a fonte.' };
    if (dueCards > 0 && daysAway >= 2) return { kind:'return-review', route:'study', label:'Retomar revisões', title:'Vamos retomar de onde você parou', reason:'Sua memória precisa de atenção, sem pressa e sem tentar recuperar dias perdidos.', meta:`${dueReview} ${dueReview === 1 ? 'revisão' : 'revisões'}${dueLearning ? ` · ${dueLearning} em aprendizado` : ''}` };
    if (dueLearning > 0 && dueReview === 0) return { kind:'learning', route:'study', label:'Continuar aprendizado', title:'Continue o que começou', reason:'Estas frases voltaram agora para reforçar a primeira memória.', meta:`${dueLearning} ${dueLearning === 1 ? 'frase em aprendizado' : 'frases em aprendizado'}` };
    if (dueReview > 0) return { kind:'review', route:'study', label:'Revisar agora', title:'Proteja o que você já aprendeu', reason:retention30 !== null && Number.isFinite(retention30) && retention30 < 70 ? 'Hoje vale consolidar o que já existe antes de adicionar frases novas.' : dueReview >= 15 ? 'A fila está maior; faça uma sessão confortável e retome depois.' : 'Estas frases chegaram ao momento certo de serem lembradas.', meta:`${dueReview} ${dueReview === 1 ? 'revisão' : 'revisões'}${dueLearning ? ` · ${dueLearning} em aprendizado` : ''}` };
    if (reviewsToday > 0) return { kind:'completed', route:'learn', label:'Continuar em imersão', title:'Plano de memória concluído', reason:`Você fez ${reviewsToday} ${reviewsToday === 1 ? 'revisão' : 'revisões'} hoje. As próximas frases voltarão no momento certo.`, meta:dueTomorrow ? `Amanhã: ${dueTomorrow} ${dueTomorrow === 1 ? 'revisão' : 'revisões'}` : 'Nada mais é obrigatório hoje.' };
    if (daysAway >= 2) return { kind:'return-clear', route:'learn', label:'Continuar em imersão', title:'Você voltou na hora certa', reason:'Não há revisões vencidas. Escolha um conteúdo e descubra uma nova frase.', meta:dueTomorrow ? `Amanhã: ${dueTomorrow} ${dueTomorrow === 1 ? 'revisão' : 'revisões'}` : 'Sua memória está em dia.' };
    return { kind:'clear', route:'learn', label:'Continuar em imersão', title:'Sua memória está em dia', reason:'Você pode continuar aprendendo com conteúdo real ou encerrar por hoje.', meta:dueTomorrow ? `Amanhã: ${dueTomorrow} ${dueTomorrow === 1 ? 'revisão' : 'revisões'}` : 'Nada mais é obrigatório hoje.' };
}

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
    container.setAttribute('aria-busy', 'false');
    container.innerHTML = renderViewState({ kind: 'error', title: 'Não foi possível preparar seu plano de hoje', message: 'Suas frases salvas continuam seguras. Verifique a conexão e tente novamente.', actionLabel: 'Tentar novamente', actionId: 'btn-retry-home' });
    bindViewStateAction(container, 'btn-retry-home', () => renderHome(container, app));
}

function renderOnboarding(container, app, initial = {}) {
    let step = 1;
    let level = initial.level || null;
    let dailyGoal = initial.dailyGoal || null;
    let placementCefr = null; // CEFR medido pelo teste de 3 fases (já persistido)

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
            </div>
            <button type="button" class="onboarding-back" id="btn-onboarding-placement" style="margin-top:12px;">🎯 Prefiro medir com o teste de nivelamento (3 fases, ~4 min)</button>` : step === 2 ? `
            <p class="onboarding-kicker">PASSO 2 DE 3</p>
            <h2 id="onboarding-title">Qual é sua meta diária?</h2>
            <p>Ela passa a ser sua missão diária de revisões. Comece leve: consistência vence intensidade.</p>
            <div class="onboarding-options" role="radiogroup" aria-label="Meta diária de revisões">
                ${goals.map(goal => `<button type="button" class="onboarding-option ${dailyGoal === goal ? 'selected' : ''}" role="radio" aria-checked="${dailyGoal === goal}" data-goal="${goal}"><strong>${goal} revisões</strong><span>${goal === 10 ? 'Cerca de 5 minutos' : goal === 20 ? 'Cerca de 10 minutos' : 'Cerca de 20 minutos'}</span></button>`).join('')}
            </div>` : `
            <p class="onboarding-kicker">PASSO 3 DE 3</p>
            <h2 id="onboarding-title">Seu plano está pronto</h2>
            <p><strong>${dailyGoal} revisões por dia</strong>, no ritmo ${levels.find(item => item[0] === level)?.[1].toLowerCase() || 'escolhido'}.</p>
            <p>Comece por uma história curta e adicione a primeira expressão que quiser praticar. Ela aparecerá no Cofre e no seu plano de revisão.</p>`;
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
        // Teste de 3 fases: mede de verdade e já grava o CEFR real
        container.querySelector('#btn-onboarding-placement')?.addEventListener('click', () => {
            runPlacementTest(app, (cefr) => {
                level = cefr === 'A1' || cefr === 'A2' ? 'beginner' : cefr === 'B1' ? 'intermediate' : 'advanced';
                placementCefr = cefr; // o teste já gravou lf_cefr_level; não sobrescrever
                step = 2;
                draw();
            });
        });
        container.querySelector('#btn-onboarding-finish')?.addEventListener('click', async (event) => {
            const button = event.currentTarget;
            const status = container.querySelector('#onboarding-status');
            button.disabled = true;
            status.textContent = 'Salvando seu plano…';
            const record = JSON.stringify({ version: 1, completed: true, level, dailyGoal, updatedAt: new Date().toISOString() });
            try {
                const saved = await app.db.setSetting(ONBOARDING_KEY, record);
                if (!saved) throw new Error('Configuração não confirmada');
                // Fiação real: CEFR (se o teste não gravou) + cota de novas/dia
                if (!placementCefr && LEVEL_TO_CEFR[level]) {
                    app.db.setSetting('lf_cefr_level', LEVEL_TO_CEFR[level]).catch(() => {});
                    app.db.setSetting('cefrTargetLevel', LEVEL_TO_CEFR[level]).catch(() => {});
                }
                const newPerDay = GOAL_TO_NEW_PER_DAY[dailyGoal];
                if (newPerDay) app.db.setSetting('new_per_day', String(newPerDay)).catch(() => {});
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
    const myGen = ++_homeRenderGen; // Onda 9 (auditoria de bugs): ver comentário acima
    injectStyles();

    // Stats via db unificado (Supabase) exposto em app.db
    const db = app?.db;
    container.setAttribute('aria-busy', 'true');
    container.setAttribute('aria-busy', 'true');
    container.innerHTML = renderViewState({ kind: 'loading', title: 'Preparando seu plano de hoje…', message: 'Organizando as revisões que mais ajudam sua memória agora.' });
    if (!db) {
        container.removeAttribute('aria-busy');
        if (myGen === _homeRenderGen) renderHomeLoadError(container, app);
        return;
    }
    const [statsResult, onboardingResult] = await Promise.allSettled([
        db.getStats(), db.getSetting(ONBOARDING_KEY),
    ]);
    if (myGen !== _homeRenderGen) return; // uma chamada mais nova já assumiu a tela
    container.removeAttribute('aria-busy');
    if (statsResult.status !== 'fulfilled') {
        renderHomeLoadError(container, app);
        return;
    }
    const stats = statsResult.value;
    // getStats já consulta user_stats para streak/XP. Reusar evita uma chamada
    // REST duplicada no primeiro carregamento do painel.
    const userStats = stats?.userStats || null;
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
    const todayISO = localDateKey();
    let reviewsToday = 0;
    let wordsToday = 0;
    let retention30 = null;   // % de acertos (não-"Errei") nos últimos 30 dias
    let dueTomorrow = 0;      // carga de amanhã
    let dueWeek = 0;          // carga dos próximos 7 dias
    let knownFamilies = 0;    // famílias de palavras conhecidas (métrica LingQ)
    let forecast = [];        // cards vencendo por dia, próximos 7 dias
    let avgReviews7 = 0;      // média de revisões/dia (7 dias) — calibra as missões
    let avgWords7 = 0;
    let weakWords = [];       // palavras com 3+ lapsos/leech — o "professor" de olho
    let weakCategory = null;   // categoria mais fraca da semana (missão de foco)
    let weakCatReviewsToday = 0;
    let storiesCount = 0;      // Onda 8: usado nas conquistas ("1ª história" etc.)
    try {
        // Onda 7 (perf): getStats() (wave 1, acima) já buscou 30 dias de
        // review_log inteiro (stats.reviewLog) — pedir de novo aqui era uma
        // 2ª ida à rede idêntica, e getReviewLog(1) era um SUBCONJUNTO do
        // mesmo período (hoje já está dentro dos 30 dias), outra chamada
        // 100% redundante. Achado da auditoria de performance do painel:
        // "Início" fazia 5 buscas na 2ª leva, 2 delas repetindo dados que a
        // 1ª leva já tinha. Agora reaproveita — zero rede a mais aqui.
        const [allWords, allCards, knownWords, stories] = await Promise.all([
            db ? db.getAllWords() : [],
            db ? db.getAllCards() : [],
            db ? db.getAllKnownWords().catch(() => []) : [],
            db ? db.getStories(50).catch(() => []) : []
        ]);
        const log30 = stats.reviewLog || [];
        const activityDate = (row) => row?.ts ? localDateKey(row.ts) : row?.date;
        const logToday = log30.filter(r => activityDate(r) === todayISO);
        reviewsToday = logToday.length;
        wordsToday = (allWords || []).filter(w => w.added_at && localDateKey(w.added_at) === todayISO).length;
        storiesCount = (stories || []).length;

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
        const sevenAgo = localDateKey(addLocalDays(-6));
        const last7 = (log30 || []).filter(r => activityDate(r) >= sevenAgo);
        avgReviews7 = last7.length / 7;
        avgWords7 = (allWords || []).filter(w => w.added_at && localDateKey(w.added_at) >= sevenAgo).length / 7;

        // Forecast: quantos cards vencem em cada um dos próximos 7 dias
        const tomorrow = localDateKey(addLocalDays(1));
        forecast = Array(7).fill(0);
        (allCards || []).forEach(c => {
            if (c.suspended || !c.due_date) return;
            const dayIdx = daysBetweenLocalKeys(tomorrow, localDateKey(c.due_date));
            if (dayIdx >= 0 && dayIdx < 7) forecast[dayIdx]++;
        });
        dueTomorrow = forecast[0];
        dueWeek = forecast.reduce((a, b) => a + b, 0);

        // Palavras fracas: o insumo do "plano do professor" (leeches em formação)
        const wordById = {};
        (allWords || []).forEach(w => { wordById[w.id] = w; });
        weakWords = (allCards || [])
            .filter(c => !c.suspended && ((c.lapses || 0) >= 3 || c.is_leech))
            .sort((a, b) => (b.lapses || 0) - (a.lapses || 0))
            .slice(0, 3)
            .map(c => ({ word: wordById[c.word_id]?.word || '?', lapses: c.lapses || 0 }));

        // FRAQUEZA DA SEMANA (Onda 1.2): categoria com pior retenção nos 30d.
        // O diagnóstico do linguista, transformado em missão acionável.
        const catByCardId = {};
        (allCards || []).forEach(c => { catByCardId[c.id] = wordById[c.word_id]?.category || 'word'; });
        const catAgg = {};
        (log30 || []).forEach(r => {
            const cat = catByCardId[r.card_id] || 'word';
            (catAgg[cat] = catAgg[cat] || { total: 0, hits: 0 }).total++;
            if (r.quality >= 2) catAgg[cat].hits++;
        });
        const catCandidates = Object.entries(catAgg)
            .filter(([, s]) => s.total >= 5)
            .map(([cat, s]) => ({ cat, retention: Math.round((s.hits / s.total) * 100) }))
            .filter(c => c.retention < 80)
            .sort((a, b) => a.retention - b.retention);
        if (catCandidates.length) {
            weakCategory = catCandidates[0];
            weakCatReviewsToday = (logToday || [])
                .filter(r => activityDate(r) === todayISO && (catByCardId[r.card_id] || 'word') === weakCategory.cat)
                .length;
        }
    } catch (e) { console.warn('[Home] Erro ao calcular missões:', e); }

    // Onda 8 (Gerente + Eng. SRS): conquistas — puramente derivadas de dados
    // que já existem (streak, palavras salvas, palavras maduras, histórias).
    // "Vistos" persiste em settings pra celebrar cada marco só uma vez.
    const achievements = computeAchievements({
        streak,
        wordsCount: safeStats.totalWords || 0,
        matureCount: safeStats.byStatus?.mature || 0,
        storiesCount,
    });

    // Onda 9 (auditoria de bugs): era 'phrasal_verb' aqui, mas a categoria real
    // salva em words.category é 'phrasal' (mesma unificação de service-worker.js).
    const CAT_LABEL = { phrasal: 'phrasal verbs', idiom: 'expressões (idioms)', slang: 'gírias', word: 'vocabulário' };

    // ── PLANO DO PROFESSOR (dados 100% do banco, zero enfeite) ──────────────
    const dueLearningNow = safeStats.dueLearning || 0;
    const dueReviewNow = Math.max(0, (safeStats.dueCards || 0) - dueLearningNow);
    let professorTip;
    if (retention30 !== null && retention30 < 70) {
        professorTip = `Sua retenção está em ${retention30}% — hoje o foco é REVISAR o que já existe, não adicionar palavras novas. Qualidade antes de volume.`;
    } else if (dueReviewNow >= 15) {
        professorTip = 'A fila cresceu: divida em 2 sessões curtas (agora e à noite). Sessões curtas fixam melhor que uma maratona.';
    } else if (weakWords.length > 0) {
        professorTip = `Atenção especial a "${escapeHtml(weakWords[0].word)}" (${weakWords[0].lapses} erros): antes de responder, leia a frase EM VOZ ALTA — produção fixa mais que reconhecimento.`;
    } else if ((safeStats.dueCards || 0) === 0 && dueTomorrow === 0) {
        professorTip = 'Tudo em dia! Gere uma história no seu nível, leia com áudio e salve 3 palavras que não conhecia.';
    } else {
        professorTip = 'Ritmo saudável. Faça a sessão de hoje e feche com uma história curta — rever a palavra EM CONTEXTO é o que gradua a memória.';
    }

    // ── Missões ADAPTATIVAS ──────────────────────────────────────────────────
    // Alvo = ritmo real do aluno (média 7d) + ~20% de desafio, com piso e teto.
    // Quem sumiu ganha uma missão de RETORNO leve em vez de meta alta.
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
    const lastStudy = userStats?.last_study_date || null;
    const daysAway = lastStudy ? Math.max(0, daysBetweenLocalKeys(lastStudy, todayISO)) : 0;
    const isReturning = daysAway >= 2; // sumiu 2+ dias

    // A meta escolhida no onboarding é a missão principal. Em retorno após
    // ausência, reduzimos apenas essa primeira missão para evitar fricção.
    const revTarget = isReturning ? Math.min(onboarding.dailyGoal, 5) : onboarding.dailyGoal;
    // Missões medem recuperação real. Capturar conteúdo e ganhar XP não são
    // objetivos pedagógicos: podem acontecer sem que o aluno recupere nada.
    const coreQuests = [
        isReturning
            ? { id: 'comeback', text: `De volta! Revise ${revTarget} cartas pra reacender o fogo 🔥`, target: revTarget, current: Math.min(reviewsToday, revTarget) }
            : { id: 'rev', text: `Revisar ${revTarget} cartas`, target: revTarget, current: Math.min(reviewsToday, revTarget) },
    ].map(q => ({ ...q, done: q.current >= q.target }));

    // Missão de FOCO (Onda 1.2): só aparece quando há uma fraqueza real.
    // Alvo pequeno (3) — é sobre atenção à categoria, não volume.
    const focusQuest = weakCategory ? (() => {
        const target = 3;
        const current = Math.min(weakCatReviewsToday, target);
        return {
            id: 'focus', focus: true,
            text: `🎯 Foco da semana: revise ${target} de ${CAT_LABEL[weakCategory.cat] || weakCategory.cat} (sua retenção aí está em ${weakCategory.retention}%)`,
            target, current, done: current >= target,
        };
    })() : null;

    const quests = focusQuest ? [...coreQuests, focusQuest] : coreQuests;

    const allQuestsDone = coreQuests.every(q => q.done);

    const todayAction = chooseTodayAction({
        totalWords: safeStats.totalWords,
        dueCards: safeStats.dueCards,
        dueLearning: dueLearningNow,
        reviewsToday,
        daysAway,
        dueTomorrow,
        retention30,
    });

    if (myGen !== _homeRenderGen) return; // uma chamada mais nova já assumiu a tela (Onda 9)
    container.innerHTML = `
        <div class="gamified-home">
            <div class="dashboard-main">
                <div class="dashboard-header">
                    <h2>Hoje</h2>
                    <p>Uma próxima ação clara, escolhida pelo estado real da sua memória.</p>
                </div>

                <section id="home-primary-plan" class="home-primary-plan" data-plan-kind="${todayAction.kind}" aria-labelledby="home-primary-title">
                    <p class="product-kicker">PRÓXIMO PASSO</p>
                    <h1 id="home-primary-title">${todayAction.title}</h1>
                    <p class="home-primary-reason">${todayAction.reason}</p>
                    <p class="home-primary-meta">${todayAction.meta}</p>
                    <button class="btn-action btn-study" id="btn-study-now" type="button">${todayAction.label}</button>
                </section>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon" style="color:var(--color-primary)">📚</div>
                        <div class="stat-value">${safeStats.dueCards || 0}</div>
                        <div class="stat-label">Revisões de hoje</div>
                        ${dueLearningNow > 0 ? `<div style="font-size:11px; color:var(--color-text-light); margin-top:2px;" title="Frases começando voltam em minutos dentro desta sessão">💭 ${dueLearningNow} começando</div>` : ''}
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon" style="color:var(--color-secondary)">⭐</div>
                        <div class="stat-value">${safeStats.byStatus?.mature || 0}</div>
                        <div class="stat-label">Memória estável</div>
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
                <div id="home-return-banner" style="display:flex; gap:12px; align-items:center; margin-bottom:16px; background:rgba(28,176,246,0.1); border:2px solid var(--color-secondary); border-radius:var(--radius-md); padding:14px 18px;">
                    <span style="font-size:28px;">👋</span>
                    <div style="flex:1;">
                        <div style="font-weight:900; color:var(--color-text);">Sentimos sua falta! Você ficou ${daysAway} dias fora.</div>
                        <div style="font-size:13px; color:var(--color-text-light);">Seu plano de hoje é leve: só ${revTarget} revisões para voltar ao ritmo.</div>
                    </div>
                    <button class="btn btn-primary" id="btn-comeback" style="padding:10px 18px; font-size:13px;">Voltar agora</button>
                </div>` : ''}
                ${streak > 0 && reviewsToday === 0 && !isReturning ? `
                <div id="home-streak-banner" style="display:flex; gap:12px; align-items:center; margin-bottom:16px; background:rgba(255,150,0,0.1); border:2px solid #ff9600; border-radius:var(--radius-md); padding:14px 18px;">
                    <span style="font-size:28px;">🔥</span>
                    <div style="flex:1;">
                        <div style="font-weight:900; color:var(--color-text);">Sua ofensiva de ${streak} ${streak === 1 ? 'dia' : 'dias'} está em risco!</div>
                        <div style="font-size:13px; color:var(--color-text-light);">Conclua 1 revisão hoje para manter a ofensiva.</div>
                    </div>
                    <button class="btn btn-primary" id="btn-save-streak" style="padding:10px 18px; font-size:13px;">Salvar ofensiva</button>
                </div>` : ''}
                <div id="home-today-plan" style="display:flex; gap:10px; margin-bottom:16px; background:linear-gradient(135deg, rgba(88,204,2,0.08), rgba(28,176,246,0.08)); border:2px solid var(--color-primary); border-radius:var(--radius-md); padding:16px 18px; align-items:flex-start;">
                    <span style="font-size:26px;">🧑‍🏫</span>
                    <div style="flex:1;">
                        <div style="font-weight:900; color:var(--color-text); font-size:14px; margin-bottom:4px;">Plano de hoje
                            <span style="font-weight:700; color:var(--color-text-light); font-size:12px;">— ${dueReviewNow} ${dueReviewNow === 1 ? 'revisão' : 'revisões'}${dueLearningNow ? ` · ${dueLearningNow} começando` : ''}${weakWords.length ? ` · ${weakWords.length} ${weakWords.length === 1 ? 'termo para reforçar' : 'termos para reforçar'}` : ''}</span>
                        </div>
                        <div style="font-size:13px; color:var(--color-text); line-height:1.5;">${professorTip}</div>
                        ${weakWords.length ? `<div style="font-size:12px; color:var(--color-text-light); margin-top:6px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <span>🔎 No radar: ${weakWords.map(w => `<strong>${escapeHtml(w.word)}</strong> (${w.lapses}x)`).join(' · ')}</span>
                            <button id="btn-study-weak" class="btn btn-secondary" style="padding:4px 12px; font-size:11px;" title="Praticar apenas os termos que precisam de atenção">Reforçar estes termos</button>
                        </div>` : ''}
                        <details id="diagnosis-details" style="margin-top:10px;">
                            <summary style="cursor:pointer; font-size:13px; font-weight:800; color:var(--color-secondary); list-style:none;">🔬 Diagnóstico semanal do linguista <span style="font-weight:600; color:var(--color-text-light);">(clique pra abrir)</span></summary>
                            <div id="diagnosis-body" style="margin-top:10px; font-size:13px; color:var(--color-text); line-height:1.55;">Carregando…</div>
                        </details>
                    </div>
                </div>
                <div id="home-memory-insight" style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px; background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-md); padding:14px 18px; align-items:center;">
                    <div style="font-weight:800; color:var(--color-text); font-size:14px;">📈 Memória:</div>
                    <div style="font-size:14px; color:var(--color-text-light);">Itens familiares: <strong style="color:var(--color-primary);">${knownFamilies}</strong></div>
                    <div style="font-size:14px; color:var(--color-text-light);">Retenção 30d: <strong style="color:${retention30 === null ? 'var(--color-text-light)' : retention30 >= 85 ? 'var(--color-primary)' : retention30 >= 70 ? '#ffc800' : 'var(--color-danger)'};">${retention30 === null ? '—' : retention30 + '%'}</strong></div>
                    <div style="font-size:14px; color:var(--color-text-light);">Amanhã: <strong style="color:var(--color-text);">${dueTomorrow} ${dueTomorrow === 1 ? 'revisão' : 'revisões'}</strong></div>
                    <div style="font-size:14px; color:var(--color-text-light);">Próximos 7 dias: <strong style="color:var(--color-text);">${dueWeek}</strong></div>
                    <div style="font-size:14px; color:var(--color-text-light);" title="Protege sua ofensiva se você pular 1 dia. Ganhe 1 a cada 7 dias de ofensiva.">🧊 Freezes: <strong style="color:var(--color-secondary);">${userStats?.streak_freezes ?? 1}</strong></div>
                    <div style="flex-basis:100%; display:flex; align-items:flex-end; gap:4px; height:42px; margin-top:4px;" title="Previsão de revisões (estilo Anki): quantos cards vencem em cada um dos próximos 7 dias">
                        ${forecast.map((n, i) => {
                            const max = Math.max(...forecast, 1);
                            const h = Math.max(4, Math.round((n / max) * 34));
                            const d = addLocalDays(i + 1);
                            const label = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][d.getDay()];
                            return `<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:2px;">
                                <div style="font-size:9px; color:var(--color-text-light); font-weight:700;">${n || ''}</div>
                                <div style="width:100%; max-width:26px; height:${h}px; background:${n ? 'var(--color-secondary)' : 'var(--color-border)'}; border-radius:3px;"></div>
                                <div style="font-size:9px; color:var(--color-text-light);">${label}</div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>

                <div id="home-secondary-actions" class="action-buttons home-secondary-actions">
                    <button class="btn-action btn-study" id="btn-open-learning">
                        EXPLORAR CONTEÚDO
                    </button>
                    <button class="btn-action btn-game" id="btn-play-match">
                        PRÁTICA LIVRE · SEM PLACAR
                    </button>
                </div>

                <div class="achievements-section">
                    <h3 style="margin:0 0 12px 0; font-size:16px; color:var(--color-text);">🏆 Conquistas</h3>
                    <div class="achievements-grid">
                        ${achievements.map(a => `
                            <div class="achv-badge ${a.unlocked ? 'unlocked' : 'locked'}" title="${a.label}${a.unlocked ? '' : ' (ainda não desbloqueada)'}">
                                <div class="achv-icon">${a.icon}</div>
                                <div class="achv-label">${a.label}</div>
                            </div>
                        `).join('')}
                    </div>
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
                        <h3>Missões de hoje <span style="font-size:11px; font-weight:700; color:var(--color-text-light);">(no seu ritmo${isReturning ? ' — modo retorno' : ''})</span></h3>
                    <div class="quests-list">
                        ${quests.map(q => `
                            <div class="quest-item ${q.done ? 'quest-done' : ''}" ${q.focus ? 'style="background:rgba(255,150,0,0.08); border-radius:10px; padding:8px; margin:-8px -8px 0;"' : ''}>
                                <div class="quest-icon">${q.done ? '✅' : (q.focus ? '🔬' : '🎯')}</div>
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
                    ${allQuestsDone ? `
                    <div style="text-align:center; margin-top:16px; font-weight:800; color:var(--color-primary); font-size:14px;">Missão de memória concluída por hoje.</div>
                    ` : ''}

                    <details class="competitive-details">
                        <summary>Como funciona o placar</summary>
                        <div class="competitive-details-body">
                        <p>O placar registra apenas atividades qualificadas de aprendizagem. Prática livre continua disponível, mas não altera XP, ofensiva ou liga.</p>
                        </div>
                    </details>
                </div>
            </div>
        </div>
    `;

    organizeHomeSections(container);

    // ── Diagnóstico do linguista: cache semanal + geração sob demanda ───────
    // (1x/semana no automático; botão regenera. Gate de 10 revisões: sem dados
    // suficientes um diagnóstico seria invenção — e aqui nada é decorativo.)
    const diagDetails = document.getElementById('diagnosis-details');
    if (diagDetails) {
        let diagLoaded = false;
        const renderDiagnosis = (d, generatedAt) => `
            <div style="background:var(--color-surface); border:2px solid var(--color-border); border-radius:12px; padding:14px;">
                <div style="font-weight:800; margin-bottom:8px;">${d.resumo}</div>
                ${(d.forcas || []).length ? `<div style="margin-bottom:6px;"><strong style="color:var(--color-primary);">✔ Forças:</strong> ${(d.forcas || []).join(' · ')}</div>` : ''}
                ${(d.fraquezas || []).length ? `<div style="margin-bottom:6px;"><strong style="color:#ff9600;">⚠ A trabalhar:</strong> ${(d.fraquezas || []).join(' · ')}</div>` : ''}
                <div style="margin-bottom:6px;"><strong>📋 Plano da semana:</strong><ol style="margin:4px 0 0 18px; padding:0;">${(d.plano_semana || []).map(p => `<li style="margin-bottom:2px;">${p}</li>`).join('')}</ol></div>
                ${d.dica_tecnica ? `<div><strong>🧪 Técnica:</strong> ${d.dica_tecnica}</div>` : ''}
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                    <span style="font-size:11px; color:var(--color-text-light);">Gerado em ${new Date(generatedAt).toLocaleDateString()}</span>
                    <button id="btn-rediagnose" style="background:none; border:none; color:var(--color-secondary); font-weight:700; font-size:12px; cursor:pointer;">↻ Atualizar agora</button>
                </div>
            </div>`;

        const loadDiagnosis = async (force = false) => {
            const body = document.getElementById('diagnosis-body');
            if (!body) return;
            body.textContent = 'Analisando seus dados…';
            try {
                const cachedRaw = force ? null : await db.getSetting('lf_weekly_diagnosis').catch(() => null);
                let cached = null;
                try { cached = cachedRaw ? JSON.parse(cachedRaw) : null; } catch { cached = null; }
                const isFresh = cached?.generatedAt && (Date.now() - new Date(cached.generatedAt).getTime()) < 6.5 * 86400000;
                if (cached?.diagnosis && isFresh) {
                    body.innerHTML = renderDiagnosis(cached.diagnosis, cached.generatedAt);
                } else {
                    const data = await db.getDiagnosisData(30);
                    if ((data?.totalReviews || 0) < 10) {
                        body.innerHTML = `<em style="color:var(--color-text-light);">Ainda faltam dados: você tem ${data?.totalReviews || 0} revisões nos últimos 30 dias — a partir de 10, o linguista consegue apontar padrões reais (não invenção).</em>`;
                        return;
                    }
                    const cefr = await getCefrLevel().catch(() => null);
                    const diagnosis = await generateWeeklyDiagnosis(data, cefr);
                    const generatedAt = new Date().toISOString();
                    db.setSetting('lf_weekly_diagnosis', JSON.stringify({ diagnosis, generatedAt })).catch(() => {});
                    body.innerHTML = renderDiagnosis(diagnosis, generatedAt);
                }
                document.getElementById('btn-rediagnose')?.addEventListener('click', () => loadDiagnosis(true));
            } catch (e) {
                console.warn('[Diagnóstico] Falhou:', e);
                body.innerHTML = '<em style="color:var(--color-danger);">Não consegui gerar o diagnóstico agora (IA indisponível?). Tente de novo em instantes.</em>';
            }
        };
        diagDetails.addEventListener('toggle', () => {
            if (diagDetails.open && !diagLoaded) { diagLoaded = true; loadDiagnosis(false); }
        });
    }

    // Events
    document.getElementById('btn-save-streak')?.addEventListener('click', () => {
        if (app && app.navigate) app.navigate('study');
    });
    document.getElementById('btn-comeback')?.addEventListener('click', () => {
        if (app && app.navigate) app.navigate('study');
    });
    document.getElementById('btn-study-now')?.addEventListener('click', () => {
        if (app && app.navigate) app.navigate(todayAction.route);
    });
    document.getElementById('btn-open-learning')?.addEventListener('click', () => app?.navigate?.('learn'));

    // Onda 9: modo de estudo customizado (paridade Anki) — revisar só as
    // palavras fracas/leech, ignorando a cota diária normal.
    document.getElementById('btn-study-weak')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (app && app.navigate) app.navigate('study', { weakOnly: true });
    });

    document.getElementById('btn-play-match')?.addEventListener('click', () => {
        if (app && app.navigate) app.navigate('game');
    });

    const heatmapGrid = container.querySelector('#heatmap-grid');
    if (heatmapGrid && safeStats.sessions) {
        let cellsHTML = '';
        const thirtyDaysAgo = addLocalDays(-29);
        
        for (let i = 0; i < 30; i++) {
            const dateStr = localDateKey(addLocalDays(i, thirtyDaysAgo));
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

    // Onda 8: celebra conquistas novas (1x cada) — não bloqueia o render,
    // roda depois com a tela já pintada. "Vistos" fica em settings (k/v que
    // já existe), sem tabela/migration nova.
    if (db) {
        (async () => {
            try {
                const seenRaw = await db.getSetting('lf_achievements_seen');
                if (myGen !== _homeRenderGen) return; // (Onda 9) chamada superada — não duplica o toast
                let seenIds = [];
                try { seenIds = seenRaw ? JSON.parse(seenRaw) : []; } catch { seenIds = []; }
                const fresh = newlyUnlocked(achievements, seenIds);
                if (fresh.length) {
                    fresh.forEach((a, i) => {
                        setTimeout(() => app.showToast?.(`🏆 Conquista desbloqueada: ${a.icon} ${a.label}!`, 'info'), i * 600);
                    });
                    const updated = [...new Set([...seenIds, ...fresh.map(a => a.id)])];
                    await db.setSetting('lf_achievements_seen', JSON.stringify(updated));
                }
            } catch (e) { console.warn('[Home] Erro ao processar conquistas:', e); }
        })();
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
            padding: clamp(12px, 4vw, 24px);
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
            padding: clamp(16px, 5vw, 32px);
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

        /* Conquistas (Onda 8): grade de badges — desbloqueadas em cor cheia
           com leve "pop" de fundo, bloqueadas em cinza/opacidade reduzida
           (o aluno vê o que existe pra alcançar, não só o que já tem). */
        .achievements-section { margin-bottom: 24px; }
        .achievements-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
            gap: 10px;
        }
        .achv-badge {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 4px;
            padding: 10px 6px;
            border-radius: var(--radius-md);
            border: 2px solid var(--color-border);
            background: var(--color-bg-alt);
            transition: transform 0.15s;
        }
        .achv-badge.unlocked {
            border-color: var(--color-warning);
            background: rgba(255, 200, 0, 0.1);
        }
        .achv-badge.unlocked:hover { transform: translateY(-2px); }
        .achv-badge.locked { opacity: 0.4; filter: grayscale(1); }
        .achv-icon { font-size: 24px; }
        .achv-label {
            font-size: 10px;
            font-weight: 700;
            color: var(--color-text-light);
            line-height: 1.3;
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
