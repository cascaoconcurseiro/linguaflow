// dashboard/js/ui/homeView.js — Tela Início: próximo passo do dia, palavras difíceis, horas de estudo, conquistas e avisos.
import { lemma } from '../../../utils/lemma.js';
import { addLocalDays, daysBetweenLocalKeys, localDateKey } from '../../../utils/local-day.js';
import { runPlacementTest } from './settingsView.js';
import { computeAchievements, newlyUnlocked } from '../core/achievements.js';
import { bindViewStateAction, escapeHtml, renderViewState } from './viewState.js';
import { isFluencyCheckDue } from '../core/fluencyCheck.js';
import { isWeakCard } from '../core/sessionQueue.js';
import { videoWordStats } from '../core/videoWordStats.js';
import { countBucket, observe } from '../../../utils/observability.js';
import { loadCourseStripModel, renderCourseStrip } from './courses/courseHomeStrip.js';

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
    append(today, '.home-data-warning');
    append(today, '#home-primary-plan');
    append(today, '#home-vault-banner');
    append(today, '#home-return-banner');
    append(today, '#home-streak-banner');
    append(today, '.stats-grid');
    append(today, '#home-struggling-words');

    const more = document.createElement('details');
    more.id = 'home-more';
    more.className = 'home-more';
    more.open = false;
    more.innerHTML = '<summary>Métricas detalhadas, memória e conquistas</summary><div class="home-more-body"></div>';
    const moreBody = more.querySelector('.home-more-body');
    append(moreBody, '#home-memory-insight');
    append(moreBody, '#home-study-hours-card');
    append(moreBody, '.quests-card');
    append(moreBody, '.achievements-section');
    append(moreBody, '.heatmap-section');

    main.replaceChildren(today, more);
    sidebar.remove();
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

import { FIRST_STEPS_KEY, buildFirstSteps, parseFirstSteps, renderFirstSteps } from './firstSteps.js';
import { HOME_VIEW_CSS } from './homeViewStyles.js';
import { TODAY_PLAN_CSS, renderTodayPlan } from './todayPlanView.js';
import { buildTodayPlan } from '../core/todayPlan.js';
import { releaseHeldWords } from '../core/intakeRelease.js';

// Chave de reversão do Plano de hoje (#495): 'off' devolve o Início ao bloco antigo, sem deploy.
export const TODAY_PLAN_KEY = 'lf_today_plan';

const ONBOARDING_KEY = 'onboarding_v1';
const ONBOARDING_LEVELS = new Set(['beginner', 'intermediate', 'advanced']);

export async function loadFluencyHomeState(db) {
    if (!db) return { fluencyDue: false, fluencyResumeAvailable: false };
    if (typeof db.getFluencyCheckStatus === 'function') {
        const status = await db.getFluencyCheckStatus();
        return {
            fluencyDue: status?.fluencyDue === true,
            fluencyResumeAvailable: status?.fluencyResumeAvailable === true,
        };
    }

    const [latest, draft] = await Promise.all([
        typeof db.getLatestLearningTaskAttempt === 'function'
            ? db.getLatestLearningTaskAttempt()
            : null,
        typeof db.getFluencyCheckDraft === 'function'
            ? db.getFluencyCheckDraft().catch(() => null)
            : null,
    ]);
    return {
        fluencyDue: isFluencyCheckDue(latest?.occurred_at || null),
        fluencyResumeAvailable: !!draft && draft.completed !== true,
    };
}

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
    if (totalWords === 0) return { kind:'first-context', route:'stories', label:'Criar uma história', title:'Aprenda sua primeira frase real', reason:'Crie ou leia uma história no seu nível para encontrar frases úteis e transformá-las em memória.', meta:'Leitura guiada com áudio e contexto.' };
    if (dueCards > 0 && daysAway >= 2) return { kind:'return-review', route:'study', label:'Retomar revisões', title:'Vamos retomar de onde você parou', reason:'Sua memória precisa de atenção, sem pressa e sem tentar recuperar dias perdidos.', meta:`${dueReview} ${dueReview === 1 ? 'revisão' : 'revisões'}${dueLearning ? ` · ${dueLearning} em aprendizado` : ''}` };
    if (dueLearning > 0 && dueReview === 0) return { kind:'learning', route:'study', label:'Continuar aprendizado', title:'Continue o que começou', reason:'Estas frases voltaram agora para reforçar a primeira memória.', meta:`${dueLearning} ${dueLearning === 1 ? 'frase em aprendizado' : 'frases em aprendizado'}` };
    if (dueReview > 0) return { kind:'review', route:'study', label:'Revisar agora', title:'Proteja o que você já aprendeu', reason:retention30 !== null && Number.isFinite(retention30) && retention30 < 70 ? 'Hoje vale consolidar o que já existe antes de adicionar frases novas.' : dueReview >= 15 ? 'A fila está maior; faça uma sessão confortável e retome depois.' : 'Estas frases chegaram ao momento certo de serem lembradas.', meta:`${dueReview} ${dueReview === 1 ? 'revisão' : 'revisões'}${dueLearning ? ` · ${dueLearning} em aprendizado` : ''}` };
    if (state.fluencyResumeAvailable === true) return { kind:'fluency-resume', route:'fluency-check', label:'Continuar check', title:'Seu check está esperando por você', reason:'As etapas já concluídas foram preservadas. Continue de onde parou sem repetir o que já fez.', meta:'Evidência comunicativa · não altera revisão, XP ou liga' };
    if (state.fluencyDue === true) return { kind:'fluency-check', route:'fluency-check', label:'Fazer check de comunicação', title:'Teste o inglês fora dos seus cartões', reason:'Uma tarefa curta e inédita observa o que você consegue compreender e produzir sem ensaio.', meta:'Cerca de 8 minutos · não altera revisão, XP ou liga' };
    if (reviewsToday > 0) return { kind:'completed', route:'stories', label:'Ler histórias', title:'Plano de memória concluído', reason:`Você fez ${reviewsToday} ${reviewsToday === 1 ? 'revisão' : 'revisões'} hoje. As próximas frases voltarão no momento certo.`, meta:dueTomorrow ? `Amanhã: ${dueTomorrow} ${dueTomorrow === 1 ? 'revisão' : 'revisões'}` : 'Nada mais é obrigatório hoje.' };
    if (daysAway >= 2) return { kind:'return-clear', route:'stories', label:'Ler histórias', title:'Você voltou na hora certa', reason:'Não há revisões vencidas. Escolha uma história e descubra novas frases.', meta:dueTomorrow ? `Amanhã: ${dueTomorrow} ${dueTomorrow === 1 ? 'revisão' : 'revisões'}` : 'Sua memória está em dia.' };
    return { kind:'clear', route:'stories', label:'Ler histórias', title:'Sua memória está em dia', reason:'Você pode continuar lendo histórias com contexto real ou encerrar por hoje.', meta:dueTomorrow ? `Amanhã: ${dueTomorrow} ${dueTomorrow === 1 ? 'revisão' : 'revisões'}` : 'Nada mais é obrigatório hoje.' };
}

// Issue #336: mesmo critério da sessão de reforço (isWeakCard), para que o
// botão "Reforçar" abra exatamente as palavras listadas. Dificuldade FSRS
// sozinha não entra: é parâmetro interno do agendador, não sinal para o aluno.
export function selectStrugglingCards(cards, wordById, now = new Date()) {
    const weak = (cards || []).filter(c => !c.suspended && isWeakCard(c));
    const nowMs = now.getTime();
    const dueCount = weak.filter(c => c.due_date && new Date(c.due_date).getTime() <= nowMs).length;
    const items = [...weak]
        .sort((a, b) => Number(b.lapses || 0) - Number(a.lapses || 0))
        .slice(0, 5)
        .map(c => {
            const w = wordById?.[c.word_id] || {};
            return {
                id: c.id,
                word: w.word || 'Expressão',
                translation: w.translation || '',
                lapses: Number(c.lapses || 0),
                isLeech: Boolean(c.is_leech),
            };
        });
    return { items, total: weak.length, dueCount };
}

// Um alerta por vez: empilhar retorno, ofensiva e cofre competia com o
// "Próximo passo". Retorno e ofensiva levam à revisão; o cofre é manutenção.
export function pickHomeBanner({ returning = false, streakAtRisk = false, vault = false } = {}) {
    if (returning) return 'return';
    if (streakAtRisk) return 'streak';
    if (vault) return 'vault';
    return null;
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
            <h2 id="onboarding-title">Qual ponto de partida parece mais próximo?</h2>
            <p>É apenas uma estimativa inicial para ajustar textos e explicações. Você pode mudar depois.</p>
            <div class="onboarding-options" role="radiogroup" aria-label="Nível atual de inglês">
                ${levels.map(([value, title, description]) => `<button type="button" class="onboarding-option ${level === value ? 'selected' : ''}" role="radio" aria-checked="${level === value}" data-level="${value}"><strong>${title}</strong><span>${description}</span></button>`).join('')}
            </div>
            <button type="button" class="onboarding-back" id="btn-onboarding-placement" style="margin-top:12px;">Prefiro estimar com um teste curto (~4 min)</button>` : step === 2 ? `
            <p class="onboarding-kicker">PASSO 2 DE 3</p>
            <h2 id="onboarding-title">Com que carga você quer começar?</h2>
            <p>Comece leve. Expressões novas geram revisões futuras, e você pode ajustar isso depois.</p>
            <div class="onboarding-options" role="radiogroup" aria-label="Meta diária de revisões">
                ${goals.map(goal => `<button type="button" class="onboarding-option ${dailyGoal === goal ? 'selected' : ''}" role="radio" aria-checked="${dailyGoal === goal}" data-goal="${goal}"><strong>${goal === 10 ? 'Leve' : goal === 20 ? 'Regular' : 'Intensa'}</strong><span>${goal} revisões/dia · até ${GOAL_TO_NEW_PER_DAY[goal]} expressões novas</span></button>`).join('')}
            </div>` : `
            <p class="onboarding-kicker">PASSO 3 DE 3</p>
            <h2 id="onboarding-title">Seu plano está pronto</h2>
            <p><strong>${dailyGoal} revisões por dia</strong> e até <strong>${GOAL_TO_NEW_PER_DAY[dailyGoal]} expressões novas</strong>, no ponto de partida ${levels.find(item => item[0] === level)?.[1].toLowerCase() || 'escolhido'}.</p>
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
                // Salva preferências reais primeiro. O onboarding só é marcado
                // como concluído depois que todas forem confirmadas.
                const writes = [];
                if (!placementCefr && LEVEL_TO_CEFR[level]) {
                    writes.push(app.db.setSetting('lf_cefr_level', LEVEL_TO_CEFR[level]));
                    writes.push(app.db.setSetting('cefrTargetLevel', LEVEL_TO_CEFR[level]));
                }
                const newPerDay = GOAL_TO_NEW_PER_DAY[dailyGoal];
                if (newPerDay) writes.push(app.db.setSetting('new_per_day', String(newPerDay)));
                const confirmed = await Promise.all(writes);
                if (confirmed.some(saved => !saved)) throw new Error('Preferência não confirmada');
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
    const myGen = ++_homeRenderGen; // Onda 9 (auditoria de bugs): ver comentário acima
    injectStyles();

    // Stats via db unificado (Supabase) exposto em app.db
    const db = app?.db;
    container.setAttribute('aria-busy', 'true');
    container.innerHTML = renderViewState({ kind: 'loading', title: 'Preparando seu plano de hoje…', message: 'Organizando as revisões que mais ajudam sua memória agora.' });
    if (!db) {
        container.removeAttribute('aria-busy');
        if (myGen === _homeRenderGen) renderHomeLoadError(container, app);
        return;
    }
    const knownWordsPromise = typeof db?.getAllKnownWords === 'function'
      ? db.getAllKnownWords().catch(() => [])
      : Promise.resolve([]);
    const storiesPromise = typeof db?.getStories === 'function'
      ? db.getStories(50).catch(() => [])
      : Promise.resolve([]);
    const coursePromise = loadCourseStripModel(db);
    const vaultCapPromise = typeof db?.getSetting === 'function'
      ? db.getSetting('lf_vault_cap').catch(() => null)
      : Promise.resolve(null);

    // O freio de entrada segura palavras novas; elas voltam aqui quando a fila baixa.
    // Roda com o plano ligado ou não: desligar só o plano nunca pode deixar palavras presas.
    const releasePromise = releaseHeldWords(db);
    const [statsResult, onboardingResult, fluencyStateResult, todayPlanSettingResult] = await Promise.allSettled([
        db.getStats(), db.getSetting(ONBOARDING_KEY), loadFluencyHomeState(db),
        typeof db?.getSetting === 'function' ? db.getSetting(TODAY_PLAN_KEY) : Promise.resolve(null),
    ]);
    if (myGen !== _homeRenderGen || app?.renderSignal?.aborted) return;
    container.removeAttribute('aria-busy');
    if (statsResult.status !== 'fulfilled') {
        renderHomeLoadError(container, app);
        return;
    }
    const stats = statsResult.value;
    // getStats já consulta user_stats para streak/XP. Reusar evita uma chamada
    // REST duplicada no primeiro carregamento do painel.
    const userStats = stats?.userStats || null;
    const onboarding = onboardingResult.status === 'fulfilled'
        ? parseOnboarding(onboardingResult.value) : null;
    const dailyGoal = onboarding?.dailyGoal ?? 20;

    const safeStats = stats || { totalWords: 0, dueCards: 0, byStatus: {}, sessions: [] };
    const fluencyState = fluencyStateResult.status === 'fulfilled'
        ? fluencyStateResult.value
        : { fluencyDue: false, fluencyResumeAvailable: false };
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
    let weakCategory = null;   // categoria mais fraca da semana (missão de foco)
    let weakCatReviewsToday = 0;
    let storiesCount = 0;
    let vaultCap = 0, vaultActive = 0, vaultWaiting = [], vaultRetireCandidate = null, vaultWordById = {};      // Onda 8: usado nas conquistas ("1ª história" etc.)
    let supplementaryDataAvailable = true;
    let videoWords = { total: 0, stable: 0 };
    let sourceLang = 'en';
    let studyStats = null;
    let struggling = { items: [], total: 0, dueCount: 0 };
    let currentFlag = 'EN';
    try {
        // Onda 7 (perf): getStats() (wave 1, acima) já buscou 30 dias de
        // review_log inteiro (stats.reviewLog) — pedir de novo aqui era uma
        // 2ª ida à rede idêntica, e getReviewLog(1) era um SUBCONJUNTO do
        // mesmo período (hoje já está dentro dos 30 dias), outra chamada
        // 100% redundante. Achado da auditoria de performance do painel:
        // "Início" fazia 5 buscas na 2ª leva, 2 delas repetindo dados que a
        // 1ª leva já tinha. Agora reaproveita — zero rede a mais aqui.
        const [allWords, allCards, knownWords, stories, capRaw, sourceLangVal, studyStatsVal] = await Promise.all([
            db ? db.getAllWords() : [],
            db ? db.getAllCards() : [],
            knownWordsPromise,
            storiesPromise,
            vaultCapPromise,
            db?.getSetting ? db.getSetting('sourceLang').catch(() => 'en') : 'en',
            db?.getStudyStats ? db.getStudyStats('en').catch(() => null) : null,
        ]);
        sourceLang = sourceLangVal || 'en';
        studyStats = studyStatsVal;
        if (sourceLang !== 'en' && db?.getStudyStats) {
            studyStats = await db.getStudyStats(sourceLang).catch(() => null);
        }
        currentFlag = sourceLang.toUpperCase();
        const log30 = stats.reviewLog || [];
        const activityDate = (row) => row?.ts ? localDateKey(row.ts) : row?.date;
        const logToday = log30.filter(r => activityDate(r) === todayISO);
        reviewsToday = logToday.length;
        wordsToday = (allWords || []).filter(w => w.added_at && localDateKey(w.added_at) === todayISO).length;
        storiesCount = (stories || []).length;

        // A7: estado do teto do cofre para o banner
        try {
          vaultCap = capRaw === null || capRaw === undefined || capRaw === '' ? 300 : Math.max(0, Number(capRaw) || 0);
          const tagsByWordId = {};
          (allWords || []).forEach(w => { tagsByWordId[w.id] = Array.isArray(w.tags) ? w.tags : []; });
          vaultActive = (allCards || []).filter(c => !c.suspended).length;
          vaultWaiting = (allCards || []).filter(c => c.suspended && (tagsByWordId[c.word_id] || []).includes('lf:espera'));
          vaultRetireCandidate = (allCards || [])
            .filter(c => !c.suspended && (c.status === 'mature' || c.status === 'review') && (c.stability || 0) > 0)
            .sort((a, b) => (b.stability || 0) - (a.stability || 0))[0] || null;
          vaultWordById = {};
          (allWords || []).forEach(w => { vaultWordById[w.id] = w; });
        } catch { /* banner do cofre e opcional */ }

        // A6: nivel medido pelo estudo real — fire-and-forget, 1x/dia
        // Card recall never changes a global CEFR level.

        // Conhecidas = marcadas no Leitor + cards maduros, agrupadas por família
        const matureByWordId = {};
        (allCards || []).forEach(c => { matureByWordId[c.word_id] = c.status === 'mature'; });
        const fams = new Set();
        (knownWords || []).forEach(k => { const l = lemma(k.word); if (l) fams.add(l); });
        (allWords || []).forEach(w => { if (matureByWordId[w.id]) { const l = lemma(w.word); if (l) fams.add(l); } });
        knownFamilies = fams.size;
        videoWords = videoWordStats(allWords, allCards);

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

        const wordById = {};
        (allWords || []).forEach(w => { wordById[w.id] = w; });

        struggling = selectStrugglingCards(allCards, wordById);

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
    } catch (e) {
        supplementaryDataAvailable = false;
        console.warn('[Home] Dados complementares indisponíveis:', e);
    }

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

    const dueLearningNow = safeStats.dueLearning || 0;

    // ── Missões ADAPTATIVAS ──────────────────────────────────────────────────
    // Alvo = ritmo real do aluno (média 7d) + ~20% de desafio, com piso e teto.
    // Quem sumiu ganha uma missão de RETORNO leve em vez de meta alta.
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
    const lastStudy = userStats?.last_study_date || null;
    const daysAway = lastStudy ? Math.max(0, daysBetweenLocalKeys(lastStudy, todayISO)) : 0;
    const isReturning = daysAway >= 2; // sumiu 2+ dias

    // Preserva metas anteriores; primeiro acesso usa a meta padrão sem guia.
    const revTarget = isReturning ? Math.min(dailyGoal, 5) : dailyGoal;
    // Missões medem recuperação real. Capturar conteúdo e ganhar XP não são
    // objetivos pedagógicos: podem acontecer sem que o aluno recupere nada.
    const coreQuests = [
        isReturning
            ? { id: 'comeback', text: `De volta. Revise ${revTarget} cartas para retomar o ritmo.`, target: revTarget, current: Math.min(reviewsToday, revTarget) }
            : { id: 'rev', text: `Revisar ${revTarget} cartas`, target: revTarget, current: Math.min(reviewsToday, revTarget) },
    ].map(q => ({ ...q, done: q.current >= q.target }));

    // Missão de FOCO (Onda 1.2): só aparece quando há uma fraqueza real.
    // Alvo pequeno (3) — é sobre atenção à categoria, não volume.
    const focusQuest = weakCategory ? (() => {
        const target = 3;
        const current = Math.min(weakCatReviewsToday, target);
        return {
            id: 'focus', focus: true,
            text: `Foco da semana: revise ${target} de ${CAT_LABEL[weakCategory.cat] || weakCategory.cat} (retenção atual: ${weakCategory.retention}%)`,
            target, current, done: current >= target,
        };
    })() : null;

    const quests = focusQuest ? [...coreQuests, focusQuest] : coreQuests;

    const allQuestsDone = coreQuests.every(q => q.done);

    const courseModel = await coursePromise;
    const courseStrip = renderCourseStrip(courseModel);
    const releaseResult = await releasePromise;
    if (myGen !== _homeRenderGen || app?.renderSignal?.aborted) return;
    const todayAction = chooseTodayAction({
        totalWords: safeStats.totalWords,
        dueCards: safeStats.dueCards,
        dueLearning: dueLearningNow,
        reviewsToday,
        daysAway,
        dueTomorrow,
        retention30,
        ...fluencyState,
    });

    // Quem ainda não salvou nenhuma palavra vê o caminho da promessa (vídeo → palavra), não um plano vazio (#427).
    let firstSteps = null;
    if (todayAction.kind === 'first-context') {
        const stored = await db?.getSetting?.(FIRST_STEPS_KEY).catch(() => null);
        firstSteps = buildFirstSteps(parseFirstSteps(stored));
    }

    // Plano de hoje (#495): fila única curso + cards. 'off' volta ao bloco anterior.
    const todayPlanOn = String(todayPlanSettingResult?.value ?? '').toLowerCase() !== 'off';
    let planHtml = '';
    if (todayPlanOn && todayAction.kind !== 'first-context') {
        const plan = buildTodayPlan({
            dueCards: safeStats.dueCards,
            dueLearning: dueLearningNow,
            courseReviewsDue: courseModel?.reviewsDue,
            courseState: courseModel?.kind,
            courseTodaySeconds: courseModel?.todaySeconds,
            lesson: courseModel?.kind === 'continue'
                ? { courseId: courseModel.courseId, lessonId: courseModel.lessonId, title: courseModel.lessonTitle, chapter: courseModel.chapter }
                : courseModel?.kind === 'start' ? { courseId: courseModel.courseId, title: courseModel.courseTitle } : null,
            heldCount: releaseResult?.held,
        });
        if (plan.state === 'done' && reviewsToday > 0) db?.logUsageEvent?.('today_plan_done')?.catch?.(() => {});
        planHtml = renderTodayPlan(plan, { reviewsToday });
    }

    const activeBanner = pickHomeBanner({
        returning: isReturning,
        streakAtRisk: streak > 0 && reviewsToday === 0,
        vault: vaultCap > 0 && (vaultWaiting.length > 0 || vaultActive >= vaultCap),
    });

    const todayLabel = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'short', day: '2-digit', month: 'short',
    }).format(new Date()).replace(/\./g, '');

    if (myGen !== _homeRenderGen || app?.renderSignal?.aborted) return;
    container.innerHTML = `
        <div class="gamified-home">
            <div class="dashboard-main">
                    <div class="dashboard-header">
                    <div class="dashboard-header-row">
                        <div>
                            <h2>Hoje</h2>
                            <p>Uma próxima ação clara, escolhida pelo estado real da sua memória.</p>
                        </div>
                        <span class="home-date-label" aria-label="Data de hoje">${todayLabel}</span>
                    </div>
                </div>

                ${supplementaryDataAvailable ? '' : `
                <div class="home-data-warning" role="status">
                    <strong>Alguns detalhes não foram carregados.</strong>
                    <span>A fila principal está disponível, mas previsão, fraquezas e atividade recente podem estar incompletas. Nenhum zero exibido nessas áreas deve ser interpretado como dado confirmado.</span>
                    <button type="button" id="btn-home-details-retry">Tentar novamente</button>
                </div>`}

                ${firstSteps ? renderFirstSteps(firstSteps) : planHtml || `<section id="home-primary-plan" class="home-primary-plan" data-plan-kind="${todayAction.kind}" aria-labelledby="home-primary-title">
                    <div class="home-primary-copy">
                        <p class="product-kicker">PRÓXIMO PASSO</p>
                        <h1 id="home-primary-title">${todayAction.title}</h1>
                        <p class="home-primary-reason">${todayAction.reason}</p>
                        <p class="home-primary-meta">${todayAction.meta}</p>
                        <button class="btn-action btn-study" id="btn-study-now" type="button">${todayAction.label}<span aria-hidden="true">→</span></button>
                    </div>
                    <div class="home-primary-visual">
                        ${courseStrip}
                        <button type="button" id="btn-primary-stories" class="home-story-shortcut${courseStrip ? ' is-compact' : ''}">
                            <span class="home-story-shortcut-kicker">LEITURA GUIADA</span>
                            <strong>Criar uma história</strong>
                            <span>Escolha nível, duração e objetivo</span>
                        </button>
                    </div>
                </section>`}
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-symbol" aria-hidden="true">▤</span>
                        <div class="stat-value">${safeStats.dueCards || 0}</div>
                        <div class="stat-label">Cartões para hoje</div>
                        ${dueLearningNow > 0 ? `<div class="stat-note" title="Frases começando voltam em minutos dentro desta sessão">${dueLearningNow} começando</div>` : ''}
                    </div>
                    <div class="stat-card">
                        <span class="stat-symbol" aria-hidden="true">⌂</span>
                        <div class="stat-value">${safeStats.byStatus?.mature || 0}</div>
                        <div class="stat-label">Memória estável</div>
                    </div>
                    <div class="stat-card">
                        <span class="stat-symbol" aria-hidden="true">↗</span>
                        <div class="stat-value">${xpToday}</div>
                        <div class="stat-label">XP Hoje</div>
                    </div>
                    <div class="stat-card">
                        <span class="stat-symbol" aria-hidden="true">◔</span>
                        <div class="stat-value" id="stat-streak">${streak}</div>
                        <div class="stat-label">Ofensiva de revisões</div>
                    </div>
                </div>

                <div id="home-study-hours-card" class="home-study-hours-card">
                    <div class="study-hours-header">
                        <div class="study-hours-title-wrap">
                            <span class="study-hours-language">${currentFlag}</span>
                            <div>
                                <h3 class="study-hours-title">Horas de Estudo (${sourceLang.toUpperCase()})</h3>
                                <span class="study-hours-subtitle">Total acumulado: <strong>${studyStats ? `${studyStats.summary.totalHours}h` : 'indisponível'}</strong></span>
                            </div>
                        </div>
                        <button type="button" class="btn btn-secondary" id="btn-open-log-study" style="padding: 10px 16px; font-size: 13px; font-weight: 800;">
                            + Registrar Estudo
                        </button>
                    </div>

                    ${!studyStats ? '<p role="status">Não foi possível carregar as horas. Atualize a página para tentar novamente.</p>' : ''}
                    ${studyStats?.unclassified?.totalSeconds > 0 ? `<p class="study-hours-subtitle">Histórico preservado sem idioma confirmado: ${studyStats.unclassified.totalFormatted}. Não incluído no total deste idioma.</p>` : ''}
                    <div class="study-skills-grid" ${studyStats ? '' : 'hidden'}>
                        <div class="study-skill-pill">
                            <div class="skill-info">
                                <span class="skill-name">Listening</span>
                                <strong class="skill-time">${studyStats?.listening?.totalFormatted || '0h'} <span style="font-size:11px; font-weight:600; color:var(--color-text-light);">(${studyStats?.listening?.todayFormatted || '0m'} hoje)</span></strong>
                            </div>
                        </div>
                        <div class="study-skill-pill">
                            <div class="skill-info">
                                <span class="skill-name">Flashcards</span>
                                <strong class="skill-time">${studyStats?.cards?.totalFormatted || '0m'} <span style="font-size:11px; font-weight:600; color:var(--color-text-light);">(${studyStats?.cards?.todayFormatted || '0m'} hoje)</span></strong>
                            </div>
                        </div>
                        <div class="study-skill-pill">
                            <div class="skill-info">
                                <span class="skill-name">Leitura</span>
                                <strong class="skill-time">${studyStats?.reading?.totalFormatted || '0m'}</strong>
                            </div>
                        </div>
                        <div class="study-skill-pill">
                            <div class="skill-info">
                                <span class="skill-name">Speaking</span>
                                <strong class="skill-time">${studyStats?.speaking?.totalFormatted || '0m'}</strong>
                            </div>
                        </div><div class="study-skill-pill"><div class="skill-info"><span class="skill-name">Escrita</span><strong class="skill-time">${studyStats?.writing?.totalFormatted || '0m'}</strong></div></div>
                    </div>
                </div>

                ${struggling.total > 0 ? `
                <section id="home-struggling-words" class="home-critical-cards-card" aria-labelledby="home-struggling-title">
                    <div class="critical-cards-header">
                        <h3 id="home-struggling-title" class="critical-cards-title">Palavras que não estão fixando</h3>
                        <span class="critical-cards-subtitle">Esquecidas 2 vezes ou mais. Uma sessão curta só com elas ajuda a fixar.</span>
                    </div>
                    <ul class="critical-cards-list">
                        ${struggling.items.map(c => `
                            <li class="critical-card-item">
                                <div class="critical-card-main">
                                    <strong class="critical-card-word" lang="${escapeHtml(sourceLang)}">${escapeHtml(c.word)}</strong>
                                    <span class="critical-card-trans">${escapeHtml(c.translation)}</span>
                                </div>
                                <div class="critical-card-tags">
                                    <span class="badge-lapse">${c.lapses} ${c.lapses === 1 ? 'esquecimento' : 'esquecimentos'}</span>
                                    ${c.isLeech ? '<span class="badge-leech" title="Atingiu o limite de esquecimentos definido nas configurações">Sinalizada</span>' : ''}
                                </div>
                                <div class="critical-card-actions">
                                    <button type="button" class="critical-card-action" data-weak-open="${escapeHtml(c.word)}" aria-label="Ver ${escapeHtml(c.word)} no Cofre">Ver no Cofre</button>
                                    <button type="button" class="critical-card-action" data-weak-pause="${escapeHtml(String(c.id))}" data-weak-word="${escapeHtml(c.word)}" aria-label="Pausar revisões de ${escapeHtml(c.word)}">Pausar</button>
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                    <div class="critical-cards-footer">
                        ${struggling.total > struggling.items.length ? `<span class="critical-cards-subtitle">Mostrando ${struggling.items.length} de ${struggling.total}.</span>` : ''}
                        ${struggling.dueCount > 0
                            ? `<button type="button" class="btn btn-secondary" id="btn-reinforce-weak">Reforçar ${struggling.dueCount} ${struggling.dueCount === 1 ? 'vencida' : 'vencidas'} agora</button>`
                            : '<span class="critical-cards-subtitle">Nenhuma vencida agora. Elas voltam na revisão programada.</span>'}
                    </div>
                </section>` : ''}

                ${activeBanner === 'vault' ? `
                <div id="home-vault-banner" class="home-alert-banner home-alert-vault">
                            <div class="home-alert-content">
                        <div class="home-alert-title">Cofre ${vaultActive >= vaultCap ? 'cheio' : 'quase cheio'} (${vaultActive}/${vaultCap})${vaultWaiting.length ? ` · ${vaultWaiting.length} ${vaultWaiting.length === 1 ? 'frase esperando vaga' : 'frases esperando vaga'}` : ''}</div>
                        <div class="home-alert-desc">Aposentar uma expressão dominada abre espaço — ela sai da fila e continua no seu histórico.</div>
                    </div>
                    ${vaultRetireCandidate ? `<button class="btn btn-primary" id="btn-open-slot" style="padding:10px 18px; font-size:13px;">Abrir vaga</button>` : ''}
                </div>` : ''}
                ${activeBanner === 'return' ? `
                <div id="home-return-banner" class="home-alert-banner home-alert-return">
                    <div class="home-alert-content">
                        <div class="home-alert-title">Sentimos sua falta! Você ficou ${daysAway} dias fora.</div>
                        <div class="home-alert-desc">Seu plano de hoje é leve: só ${revTarget} revisões para voltar ao ritmo.</div>
                    </div>
                    <button class="btn btn-primary" id="btn-comeback" style="padding:10px 18px; font-size:13px;">Voltar agora</button>
                </div>` : ''}
                ${activeBanner === 'streak' ? `
                <div id="home-streak-banner" class="home-alert-banner home-alert-streak">
                    <div class="home-alert-content">
                        <div class="home-alert-title">Sua ofensiva de revisões de ${streak} ${streak === 1 ? 'dia' : 'dias'} está em risco!</div>
                        <div class="home-alert-desc">Conclua 1 revisão hoje para manter a ofensiva.</div>
                    </div>
                    <button class="btn btn-primary" id="btn-save-streak" style="padding:10px 18px; font-size:13px;">Salvar ofensiva</button>
                </div>` : ''}
                <div id="home-memory-insight" class="home-memory-insight-card">
                    <div class="memory-insight-badges">
                        <div class="memory-badge"><strong>Memória</strong></div>
                        ${videoWords.total > 0 ? `<div class="memory-badge" title="Palavras salvas ao assistir vídeos e quantas já estão em memória estável">De vídeos: <strong>${videoWords.total}</strong> · ${videoWords.stable} fixadas</div>` : ''}
                        <div class="memory-badge">Itens familiares: <strong style="color:var(--color-primary);">${knownFamilies}</strong></div>
                        <div class="memory-badge">Retenção 30d: <strong style="color:${retention30 === null ? 'var(--color-text-light)' : retention30 >= 85 ? 'var(--color-primary)' : retention30 >= 70 ? '#ffc800' : 'var(--color-danger)'};">${retention30 === null ? '—' : retention30 + '%'}</strong></div>
                        <div class="memory-badge">Amanhã: <strong>${dueTomorrow} ${dueTomorrow === 1 ? 'revisão' : 'revisões'}</strong></div>
                        <div class="memory-badge">Próximos 7 dias: <strong>${dueWeek}</strong></div>
                        <div class="memory-badge" title="Protege sua ofensiva se você pular 1 dia. Ganhe 1 a cada 7 dias de ofensiva.">Proteções de ofensiva: <strong style="color:var(--color-secondary);">${userStats?.streak_freezes ?? 1}</strong></div>
                    </div>
                    <div class="memory-forecast-bars" title="Previsão de revisões (estilo Anki): quantos cards vencem em cada um dos próximos 7 dias">
                        ${forecast.map((n, i) => {
                            const max = Math.max(...forecast, 1);
                            const h = Math.max(4, Math.round((n / max) * 34));
                            const d = addLocalDays(i + 1);
                            const label = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][d.getDay()];
                            return `<div class="forecast-bar-col">
                                <div class="forecast-bar-val">${n || ''}</div>
                                <div class="forecast-bar-fill" style="height:${h}px; background:${n ? 'var(--color-secondary)' : 'var(--color-border)'};"></div>
                                <div class="forecast-bar-lbl">${label}</div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>



                <div class="achievements-section">
                    <h3 style="margin:0 0 12px 0; font-size:16px; color:var(--color-text);">Conquistas</h3>
                    <div class="achievements-grid">
                        ${achievements.map(a => `
                            <div class="achv-badge ${a.unlocked ? 'unlocked' : 'locked'}" title="${a.label}${a.unlocked ? '' : ' (ainda não desbloqueada)'}">
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
                                <div class="quest-mark" aria-hidden="true"></div>
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

    // Events
    document.getElementById('btn-save-streak')?.addEventListener('click', () => {
        if (app && app.navigate) app.navigate('study');
    });
    // A7: aposentar a mais dominada e ativar a mais antiga da fila de espera
    document.getElementById('btn-open-slot')?.addEventListener('click', async () => {
        const retire = vaultRetireCandidate;
        if (!retire) return;
        const retireWord = vaultWordById[retire.word_id];
        const label = retireWord?.word || 'a expressão mais estável';
        if (!confirm(`Aposentar "${label}"? Você a domina — ela sai da fila de revisão e continua no seu histórico (dá pra reativar no Cofre).`)) return;
        try {
            await db.setCardSuspended(retire.id, true);
            if (retireWord) {
                const tags = Array.isArray(retireWord.tags) ? retireWord.tags : [];
                if (!tags.includes('lf:aposentada')) await db.addTagsToWord(retireWord.id, [...tags, 'lf:aposentada']).catch(() => {});
            }
            const next = [...vaultWaiting].sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0))[0];
            if (next) {
                await db.setCardSuspended(next.id, false);
                const nw = vaultWordById[next.word_id];
                if (nw) await db.addTagsToWord(nw.id, (Array.isArray(nw.tags) ? nw.tags : []).filter(t => t !== 'lf:espera')).catch(() => {});
                app.showToast(`"${label}" aposentada · "${nw?.word || 'próxima da fila'}" entrou na revisão.`, 'success');
            } else {
                app.showToast(`"${label}" aposentada. Uma vaga aberta no cofre.`, 'success');
            }
            app.navigate('home');
        } catch (e) {
            app.showToast('Não foi possível abrir a vaga agora.', 'error');
        }
    });
        document.getElementById('btn-comeback')?.addEventListener('click', () => {
        if (app && app.navigate) app.navigate('study');
    });
    document.getElementById('home-primary-plan')?.addEventListener('click', (e) => {
        const btn = e.target?.closest?.('[data-plan-step]');
        if (!btn) return;
        let params = null;
        try { params = btn.dataset.planParams ? JSON.parse(btn.dataset.planParams) : null; } catch { /* parâmetros inválidos: abre a rota sem eles */ }
        db?.logUsageEvent?.('today_plan_step')?.catch?.(() => {});
        app?.navigate?.(btn.dataset.planRoute, params || undefined);
    });
    document.getElementById('btn-study-now')?.addEventListener('click', () => {
        if (app && app.navigate) app.navigate(todayAction.route);
    });
    document.getElementById('btn-reinforce-weak')?.addEventListener('click', () => {
        observe('home.weak_words.reinforce_click', { due: countBucket(struggling.dueCount), total: countBucket(struggling.total) });
        db?.logUsageEvent?.('weak_reinforce')?.catch?.(() => {});
        app?.navigate?.('study', { weakOnly: true });
    });
    const strugglingSection = document.getElementById('home-struggling-words');
    strugglingSection?.addEventListener('click', async (event) => {
        const openBtn = event.target.closest('[data-weak-open]');
        if (openBtn) {
            observe('home.weak_words.open_vault', {});
            db?.logUsageEvent?.('weak_open_vault')?.catch?.(() => {});
            app?.navigate?.('library', { search: openBtn.dataset.weakOpen });
            return;
        }
        const pauseBtn = event.target.closest('[data-weak-pause]');
        if (!pauseBtn || pauseBtn.disabled) return;
        const word = pauseBtn.dataset.weakWord || 'esta expressão';
        if (!confirm(`Pausar as revisões de "${word}"? Ela sai da fila e continua no Cofre, onde você pode reativar quando quiser.`)) return;
        pauseBtn.disabled = true;
        pauseBtn.textContent = 'Pausando…';
        try {
            await db.setCardSuspended(pauseBtn.dataset.weakPause, true);
            observe('home.weak_words.pause', { outcome: 'ok' });
            db?.logUsageEvent?.('weak_pause')?.catch?.(() => {});
            app.showToast(`"${word}" pausada. Reative quando quiser no Cofre.`, 'success');
            renderHome(container, app);
        } catch (e) {
            observe('home.weak_words.pause', { outcome: 'error' });
            pauseBtn.disabled = false;
            pauseBtn.textContent = 'Pausar';
            app.showToast('Não foi possível pausar agora. Tente de novo.', 'error');
        }
    });
    document.getElementById('btn-home-details-retry')?.addEventListener('click', () => {
        renderHome(container, app);
    });
    document.getElementById('home-first-steps')?.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-first-step]');
        if (!button || button.disabled) return;
        button.disabled = true;
        const current = parseFirstSteps(await db?.getSetting?.(FIRST_STEPS_KEY).catch(() => null));
        const saved = await db?.setSetting?.(FIRST_STEPS_KEY, JSON.stringify({ ...current, [button.dataset.firstStep]: true }));
        if (saved === false) {
            button.disabled = false;
            app?.showToast?.('Não foi possível salvar este passo agora. Tente de novo.', 'error');
            return;
        }
        renderHome(container, app);
    });
    document.getElementById('btn-primary-stories')?.addEventListener('click', () => app?.navigate?.('stories'));
    document.getElementById('btn-home-course-continue')?.addEventListener('click', (e) => {
        const { courseId, lessonId, courseTab } = e.currentTarget.dataset;
        app?.navigate?.('courses', courseTab ? { tab: courseTab } : { tab: 'course', courseId, openLessonId: lessonId || null });
    });
    document.getElementById('home-primary-plan')?.addEventListener('click', (e) => {
        const link = e.target?.closest?.('.home-course-count');
        if (!link) return;
        e.preventDefault();
        app?.navigate?.('courses', { tab: link.dataset.courseTab });
    });
    document.getElementById('btn-home-course-retry')?.addEventListener('click', () => renderHome(container, app));

    document.getElementById('btn-open-log-study')?.addEventListener('click', () => {
        showLogStudyModal(db, app, sourceLang, () => {
            renderHome(container, app);
        });
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
                if (myGen !== _homeRenderGen || app?.renderSignal?.aborted) return;
                let seenIds = [];
                try { seenIds = seenRaw ? JSON.parse(seenRaw) : []; } catch { seenIds = []; }
                const fresh = newlyUnlocked(achievements, seenIds);
                if (fresh.length) {
                    fresh.forEach((a, i) => {
                        setTimeout(() => app.showToast?.(`Conquista desbloqueada: ${a.label}.`, 'info'), i * 600);
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
    style.textContent = HOME_VIEW_CSS + TODAY_PLAN_CSS;
    document.head.appendChild(style);
}

function showLogStudyModal(db, app, sourceLang = 'en', onSaved) {
    const existing = document.getElementById('log-study-modal-overlay');
    if (existing) existing.remove();

    const previousFocus = document.activeElement;
    let selectedSkill = 'reading';
    let selectedMinutes = 30;

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'log-study-modal-overlay';
    modalOverlay.className = 'modal-overlay';
    modalOverlay.innerHTML = `
        <div class="modal-content" style="max-height:calc(100dvh - 32px);overflow-y:auto;" role="dialog" aria-modal="true" aria-labelledby="modal-study-title">
            <div class="modal-header">
                <h3 class="modal-title" id="modal-study-title">Registrar tempo de estudo</h3>
                <button type="button" id="btn-close-modal" aria-label="Fechar registro de estudo" style="background:none; border:none; font-size:20px; cursor:pointer; color:var(--color-text-light);">✕</button>
            </div>

            <p style="font-size:13px; color:var(--color-text-light); margin:0;">Adicione estudo externo ou apenas os minutos que o contador não registrou. O valor será somado ao total.</p>

            <div>
                <label style="font-size:12px; font-weight:800; color:var(--color-text); display:block; margin-bottom:8px;">Habilidade:</label>
                <div class="skill-options-grid">
                    <button type="button" class="btn-skill-option active" data-skill="reading">
                        <span>Leitura</span>
                    </button>
                    <button type="button" class="btn-skill-option" data-skill="speaking">
                        <span>Conversação</span>
                    </button>
                    <button type="button" class="btn-skill-option" data-skill="listening">
                        <span>Listening</span>
                    </button>
                    <button type="button" class="btn-skill-option" data-skill="writing">
                        <span>Escrita</span>
                    </button>
                </div>
            </div>

            <div>
                <label style="font-size:12px; font-weight:800; color:var(--color-text); display:block; margin-bottom:8px;">Duração:</label>
                <div class="duration-chips">
                    <button type="button" class="btn-duration-chip" data-min="15">15m</button>
                    <button type="button" class="btn-duration-chip active" data-min="30">30m</button>
                    <button type="button" class="btn-duration-chip" data-min="45">45m</button>
                    <button type="button" class="btn-duration-chip" data-min="60">1h</button>
                </div>
                <label for="manual-study-minutes" style="display:block;margin-top:14px;">Minutos personalizados</label>
                <input id="manual-study-minutes" type="number" inputmode="numeric" min="1" max="720" step="1" value="30" required style="width:100%;padding:12px;margin-top:6px;" aria-describedby="manual-study-error">
                <p id="manual-study-error" role="alert" style="color:var(--color-danger);margin-top:8px;"></p>
            </div>

            <button type="button" class="btn btn-primary" id="btn-save-manual-study" style="padding:14px; font-size:15px; font-weight:800; margin-top:6px;">
                Salvar estudo
            </button>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    modalOverlay.querySelectorAll('.btn-skill-option').forEach(btn => {
        btn.addEventListener('click', () => {
            modalOverlay.querySelectorAll('.btn-skill-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedSkill = btn.dataset.skill;
        });
    });

    modalOverlay.querySelectorAll('.btn-duration-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            modalOverlay.querySelectorAll('.btn-duration-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedMinutes = Number(btn.dataset.min);
            modalOverlay.querySelector('#manual-study-minutes').value = selectedMinutes;
        });
    });

    modalOverlay.querySelector('#manual-study-minutes').addEventListener('input', () => {
        modalOverlay.querySelectorAll('.btn-duration-chip').forEach(b => b.classList.toggle('active', Number(b.dataset.min) === Number(modalOverlay.querySelector('#manual-study-minutes').value)));
    });
    const close = () => {
        document.removeEventListener('keydown', onKeyDown);
        modalOverlay.remove();
        if (previousFocus?.isConnected) previousFocus.focus();
    };
    const onKeyDown = (e) => {
        if (e.key === 'Escape') close();
        if (e.key === 'Tab') {
            const controls = [...modalOverlay.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
            const first = controls[0], last = controls[controls.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    };
    document.addEventListener('keydown', onKeyDown);
    modalOverlay.querySelector('#btn-close-modal').focus();
    modalOverlay.querySelector('#btn-close-modal').addEventListener('click', close);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) close();
    });

    modalOverlay.querySelector('#btn-save-manual-study').addEventListener('click', async () => {
        const btn = modalOverlay.querySelector('#btn-save-manual-study');
        if (btn.disabled) return;
        const input = modalOverlay.querySelector('#manual-study-minutes');
        selectedMinutes = Number(input.value);
        if (!Number.isInteger(selectedMinutes) || selectedMinutes < 1 || selectedMinutes > 720) {
            modalOverlay.querySelector('#manual-study-error').textContent = 'Informe de 1 a 720 minutos inteiros.';
            input.focus();
            return;
        }
        modalOverlay.querySelector('#manual-study-error').textContent = '';
        btn.disabled = true;
        btn.textContent = 'Salvando…';
        try {
            if (!db?.logManualStudy) throw new Error('Registro indisponível');
            {
                await db.logManualStudy({
                    skill: selectedSkill,
                    minutes: selectedMinutes,
                    language: sourceLang,
                });
            }
            app?.showToast?.(`+${selectedMinutes}m de ${selectedSkill} registrados!`, 'success');
            close();
            if (onSaved) onSaved();
        } catch (e) {
            btn.disabled = false;
            btn.textContent = 'Salvar estudo';
            modalOverlay.querySelector('#manual-study-error').textContent = 'Erro ao salvar estudo. Tente novamente.';
            app?.showToast?.('Erro ao salvar estudo. Tente novamente.', 'error');
        }
    });
}
