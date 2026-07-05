// Dashboard v2 — LinguaFlow (Paridade Total com Anki)
// Este arquivo contém TODA a lógica: SRS, Decks, Stats, Export/Import Anki, Editor de Notas
import { db as lfDb } from '../utils/db.js';
import { escapeHTML as escapeAttr } from '../utils/html.js';
import { offlineDict } from '../utils/offline-dict.js';
import { pronunciationLab } from '../utils/pronunciation.js';
import { tts } from '../utils/tts.js';

// ============================================================================
// ESTADOS GLOBAIS
// ============================================================================
let studyCards = [];
let currentIndex = 0;
let revealStep = 0;
let isBlindMode = false;
let immersionPlayerInterval = null;
let quizTimerInterval = null;

// Estatísticas da sessão de estudo atual
let sessionTotal = 0;
let sessionDone = 0;
let sessionCorrect = 0;
let sessionStart = null;

// Estados da biblioteca
let libSelectedIds = new Set();
let libSelectMode = false;
let libActiveStatus = '';
let libActiveDeck = '';
let libActiveTag = '';
let libSortMode = 'date-desc';

// ============================================================================
// TOAST — feedback não-bloqueante
// ============================================================================
function showToast(msg, type = 'info', duration = 3000) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Tela de Login (cobre o dashboard inteiro) ─────────────────────────────
function showLoginScreen(supabaseAuth) {
  // Esconde o layout do dashboard
  const layout = document.querySelector('.app-layout');
  if (layout) layout.style.display = 'none';

  const screen = document.createElement('div');
  screen.id = 'lf-login-screen';
  screen.style.cssText =
    'position:fixed;inset:0;z-index:9999;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:20px;';
  screen.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:32px;width:100%;max-width:380px;text-align:center">
      <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:24px">
        <div style="width:48px;height:48px;background:var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#09090b;margin-bottom:8px">LF</div>
        <h1 style="font-size:18px;font-weight:600;color:var(--text)">LinguaFlow</h1>
        <p style="font-size:12px;color:var(--subtle)">Anki Inteligente</p>
      </div>
      <p id="lf-login-msg" style="font-size:12px;color:var(--muted);margin-bottom:16px">Faça login para sincronizar seus estudos.</p>
      <input id="lf-login-email" type="email" placeholder="Email" style="width:100%;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:14px;font-family:inherit;margin-bottom:8px;outline:none">
      <input id="lf-login-pass" type="password" placeholder="Senha" style="width:100%;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:14px;font-family:inherit;margin-bottom:16px;outline:none">
      <div id="lf-login-error" style="display:none;font-size:12px;color:var(--red);margin-bottom:12px;padding:8px;background:var(--red-bg);border-radius:4px"></div>
      <button id="lf-login-btn" style="width:100%;padding:10px;background:var(--accent);color:#09090b;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:8px">Entrar</button>
      <button id="lf-register-btn" style="width:100%;padding:10px;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:6px;font-size:13px;cursor:pointer;font-family:inherit">Criar Conta</button>
    </div>`;
  document.body.appendChild(screen);

  const errEl = document.getElementById('lf-login-error');
  const msgEl = document.getElementById('lf-login-msg');
  const showErr = (m) => {
    errEl.textContent = m;
    errEl.style.display = 'block';
  };

  document.getElementById('lf-login-btn').onclick = async () => {
    const email = document.getElementById('lf-login-email').value;
    const pass = document.getElementById('lf-login-pass').value;
    if (!email || !pass) {
      showErr('Preencha email e senha');
      return;
    }
    try {
      await supabaseAuth.login(email, pass);
      location.reload();
    } catch (e) {
      showErr(e.message);
    }
  };

  document.getElementById('lf-register-btn').onclick = async () => {
    const email = document.getElementById('lf-login-email').value;
    const pass = document.getElementById('lf-login-pass').value;
    if (!email || !pass || pass.length < 6) {
      showErr('Senha deve ter no mínimo 6 caracteres');
      return;
    }
    try {
      await supabaseAuth.register(email, pass);
      msgEl.textContent = '✅ Conta criada! Agora clique em Entrar.';
      msgEl.style.color = 'var(--green)';
    } catch (e) {
      showErr(e.message);
    }
  };
}

// ============================================================================
// INTERFACE PÚBLICA
// ============================================================================
window.dashboard = {
  currentDeckFilter: null,
  _quizWords: [],
  _quizIndex: 0,
  _quizScore: 0,
  _quizPoints: 0,
  _currentQuizMode: 'choice',

  switchTab: (tab) => switchTab(tab),
  loadStudy,
  loadDecks,
  loadStats,
  initQuiz,
  loadListening,
  studyDeck: (id) => {
    window.dashboard.currentDeckFilter = id;
    switchTab('study');
  },
  deleteDeck: async (id) => {
    if (confirm('Excluir este deck? As palavras serão movidas para o Padrão.')) {
      await lfDb.deleteDeck(id);
      loadHomeDecks();
      showToast('Deck excluído com sucesso', 'success');
    }
  },
  refreshDashboard: () => {
    updateHeader();
    const active = document.querySelector('.content-section.active');
    if (active) switchTab(active.id.replace('-section', ''));
  },
  initQuiz,
  answerQuiz: (isCorrect, isTimeout = false) => {
    if (quizTimerInterval) clearInterval(quizTimerInterval);
    const d = window.dashboard;
    const fill = document.getElementById('quiz-timer-fill');
    const timeLeft = fill ? parseFloat(fill.style.width) : 0;
    if (isCorrect) {
      d._quizScore++;
      const pts = Math.round(100 + timeLeft * 2);
      d._quizPoints += pts;
      document.getElementById('quiz-score').textContent = `⚡ ${d._quizPoints}`;
    }
    const feedback = document.getElementById('quiz-feedback');
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.background = isCorrect ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
      feedback.style.color = isCorrect ? '#10b981' : '#ef4444';
      if (isTimeout) feedback.textContent = '⏰ Tempo Esgotado!';
      else
        feedback.textContent = isCorrect
          ? `✨ Correto! +${Math.round(100 + timeLeft * 2)}`
          : '❌ Incorreto!';
      const nextBtn = document.getElementById('btn-quiz-next');
      if (nextBtn) {
        nextBtn.style.display = 'block';
        nextBtn.onclick = () => {
          d._quizIndex++;
          renderQuizCard();
        };
      }
    }
    if (isCorrect) {
      const word = d._quizWords[d._quizIndex];
      if (word) lfDb.logReview(word.id, 4);
    }
  },
};

window.switchTab = switchTab;

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

// ============================================================================
// HEADER / STATS GLOBAIS
// ============================================================================
async function updateHeader() {
  try {
    const [stats, reviewLog, words] = await Promise.all([
      lfDb.getStats(),
      lfDb.getReviewLog(1),
      lfDb.getAllWords(),
    ]);
    const today = new Date().toISOString().split('T')[0];
    const todayCount = reviewLog.filter((r) => r.date === today).length;

    let totalChunks = 0;
    words.forEach((w) => {
      if (w.chunks && Array.isArray(w.chunks)) totalChunks += w.chunks.length;
    });

    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set('headerDue', stats.dueCards);
    set('headerStreak', stats.streak);
    set('headerWords', stats.totalWords);
    set('nav-due', stats.dueCards);

    const lv = calculateUserLevel(stats);
    set('headerLevel', lv.cefr);

    const goal = (await lfDb.getSetting('newCardsPerDay')) || 20;
    const pct = Math.min(100, Math.round((todayCount / goal) * 100));
    set('goalPercent', pct + '%');
    const bar = document.getElementById('goalBar');
    if (bar) bar.style.width = pct + '%';
  } catch (e) {
    /* silencioso */
  }
}

function calculateUserLevel(stats) {
  const weights = { A1: 1, A2: 1.5, B1: 2, B2: 3, C1: 4, C2: 5 };
  let vocabXP = 0;
  if (stats.byCEFR)
    Object.keys(stats.byCEFR).forEach((lv) => {
      vocabXP += (stats.byCEFR[lv] || 0) * (weights[lv] || 1) * 10;
    });
  const immersionXP = Math.round((stats.totalSecs || 0) / 60); // 1 ponto por min
  const retentionFactor = 0.8 + ((stats.retention || 0) / 100) * 0.4;
  const totalXP = Math.round((vocabXP + immersionXP) * retentionFactor);
  const levels = [
    { id: 'A1', name: 'Iniciante (Beginner)', min: 0, max: 5000 }, // ~500 palavras + imersão
    { id: 'A2', name: 'Básico (Elementary)', min: 5001, max: 15000 }, // ~1500 palavras + imersão
    { id: 'B1', name: 'Intermediário (Intermediate)', min: 15001, max: 40000 }, // ~4000 palavras + imersão
    { id: 'B2', name: 'Intermediário Superior', min: 40001, max: 90000 }, // ~9000 palavras + imersão
    { id: 'C1', name: 'Avançado (Advanced)', min: 90001, max: 150000 }, // ~15000 palavras + imersão
    { id: 'C2', name: 'Fluente (Proficient)', min: 150001, max: 10000000 },
  ];
  const currentIndex = levels.findIndex((l) => totalXP >= l.min && totalXP <= l.max);
  const current = levels[currentIndex] || levels[0];
  const nextLevel = levels[currentIndex + 1] || null;
  const progress = Math.min(
    100,
    Math.round(((totalXP - current.min) / Math.max(1, current.max - current.min)) * 100),
  );
  return {
    cefr: current.id,
    name: current.name,
    xp: totalXP,
    nextMin: current.max,
    nextLevel,
    progress,
    vocabPts: vocabXP,
    immersionPts: immersionXP,
    retention: stats.retention,
  };
}

function formatInterval(interval) {
  if (interval < 0.0007) return '<1m';
  if (interval < 0.04) return `${Math.round(interval * 1440)}m`;
  if (interval < 1) return `${Math.round(interval * 24)}h`;
  if (interval < 1.1) return '1d';
  if (interval < 30) return `${Math.round(interval)}d`;
  if (interval < 365) return `${Math.round(interval / 30)}mo`;
  return `${(interval / 365).toFixed(1)}y`;
}

// ============================================================================
// STUDY MODE (SRS — Estilo Anki)
// ============================================================================
async function loadStudy() {
  const content = document.getElementById('studyContent');
  if (!content) return;
  content.innerHTML =
    '<div style="text-align:center;padding:60px;color:#64748b;font-size:15px">Carregando sessão...</div>';

  try {
    const newLimit = Number((await lfDb.getSetting('newCardsPerDay')) || 20);
    const revLimit = Number((await lfDb.getSetting('reviewsPerDay')) || 100);

    let allDue = await lfDb.getCardsDue(2000);

    // Filtra suspensos e sem dados
    allDue = allDue.filter((c) => !c.suspended && c.wordData);

    if (window.dashboard.currentDeckFilter) {
      allDue = allDue.filter((c) => c.wordData.deck_id === window.dashboard.currentDeckFilter);
    }

    const newCards = allDue.filter((c) => c.status === 'new').slice(0, newLimit);
    const reviewCards = allDue.filter((c) => c.status !== 'new').slice(0, revLimit);

    studyCards = [...newCards, ...reviewCards].sort((a, b) => {
      const p = { learning: 0, new: 1, review: 2, mature: 3 };
      return (p[a.status] || 3) - (p[b.status] || 3);
    });

    currentIndex = 0;
    revealStep = 0;
    sessionTotal = studyCards.length;
    sessionDone = 0;
    sessionCorrect = 0;
    sessionStart = Date.now();

    if (studyCards.length === 0) {
      content.innerHTML = `
                <div style="text-align:center;padding:80px 40px">
                    <div style="font-size:72px;margin-bottom:20px">🎉</div>
                    <h2 style="color:white;font-size:28px;font-weight:800;margin-bottom:12px">Sessão Completa!</h2>
                    <p style="color:#64748b;font-size:16px;margin-bottom:28px">Todos os cards do dia foram revisados. Ótimo trabalho!</p>
                    ${
                      window.dashboard.currentDeckFilter
                        ? `<button class="btn btn-ghost" id="study-all-decks-btn">Ver Todos os Decks</button>`
                        : ''
                    }
                </div>`;
      document.getElementById('study-all-decks-btn')?.addEventListener('click', () => {
        window.dashboard.currentDeckFilter = null;
        loadStudy();
      });
      updateSessionUI();
      return;
    }

    updateSessionUI();
    await showCard();
  } catch (e) {
    content.innerHTML = `<div style="color:#ef4444;padding:40px">Erro: ${e.message}</div>`;
  }
}

function updateSessionUI() {
  const bar = document.getElementById('session-progress');
  const stats = document.getElementById('session-stats');
  const acc = document.getElementById('session-accuracy');

  const pct = sessionTotal > 0 ? Math.round((sessionDone / sessionTotal) * 100) : 0;
  if (bar) bar.style.width = pct + '%';
  if (stats) stats.textContent = `${sessionDone}/${sessionTotal} cards`;
  if (acc) {
    if (sessionDone > 0) {
      const rate = Math.round((sessionCorrect / sessionDone) * 100);
      acc.textContent = `${rate}% ✓`;
      acc.style.color = rate >= 80 ? '#4ade80' : rate >= 60 ? '#fbbf24' : '#f87171';
    } else {
      acc.textContent = '—';
    }
  }
}

async function showCard() {
  const content = document.getElementById('studyContent');
  if (!content) return;

  if (currentIndex >= studyCards.length) {
    loadStudy();
    return;
  }

  const card = studyCards[currentIndex];
  const word = card.wordData;
  if (!word) {
    currentIndex++;
    await showCard();
    return;
  }

  // Guard: garante que cada card tem sua própria tradução
  const translation = word.translation || '';
  const sentence = word.context_sentence || (word.chunks && word.chunks[0]?.eng) || '';

  // Badge de tipo de card
  const badge = document.getElementById('card-type-badge');
  if (badge) {
    const types = {
      new: ['🆕 Novo', 'badge-new'],
      learning: ['📚 Aprendendo', 'badge-learning'],
      review: ['🔄 Revisão', 'badge-review'],
      mature: ['⭐ Maduro', 'badge-mature'],
    };
    const [label, cls] = types[card.status] || types.new;
    badge.className = `card-type-badge ${cls}`;
    badge.textContent = label;
  }

  // --- GERAÇÃO AUTOMÁTICA DE CHUNKS ---
  // Solicita chunks em background no Passo 0 para que estejam prontos no Passo 2
  if (revealStep === 0 && (!word.chunks || word.chunks.length === 0) && !word._chunksRequested) {
    word._chunksRequested = true;
    chrome.runtime.sendMessage({ action: 'ai_generate_chunks', word: word.word }, async (res) => {
      if (res?.chunks && Array.isArray(res.chunks)) {
        word.chunks = res.chunks;
        await lfDb.saveWord(word);
      }
    });
  }

  if (revealStep === 0) {
    // ── PASSO 0: APENAS A PALAVRA ──
    let frontContent;
    if (isBlindMode) {
      frontContent = `<div style="font-size:64px;margin-bottom:16px">👂</div><div class="fc-hint">Ouça e tente identificar a palavra</div>`;
    } else {
      frontContent = `<div class="fc-word">${word.word}</div><div class="fc-hint" style="margin-top:14px">Qual a frase ou significado?</div>`;
    }

    content.innerHTML = `
            <div class="flashcard-scene">
                <div class="flashcard" id="fc-front">
                    <div class="fc-audio-row">
                        <button class="audio-btn" id="fc-play-word">🔊 Palavra</button>
                    </div>
                    ${word.level ? `<div style="position:absolute;top:20px;left:20px"><span class="status-badge" style="background:rgba(56,189,248,0.12);color:#38bdf8">${word.level}</span></div>` : ''}
                    ${frontContent}
                    <div style="margin-top:30px">
                        <button class="btn btn-accent" id="fc-btn-reveal" style="font-size:16px; padding:14px 32px; box-shadow: 0 4px 15px rgba(56,189,248,0.4);">Revelar Frase</button>
                    </div>
                    <div class="fc-hint" style="margin-top:16px">Ou pressione Espaço</div>
                </div>
            </div>`;
  } else if (revealStep === 1) {
    // ── PASSO 1: PALAVRA + FRASE DE CONTEXTO ──
    let sentence = word.context_sentence;
    if (!sentence && word.chunks && word.chunks.length > 0) sentence = word.chunks[0].eng;

    let frontContent;
    if (isBlindMode) {
      frontContent = `<div style="font-size:64px;margin-bottom:16px">👂</div><div class="fc-hint">Ouça e tente identificar a palavra</div>`;
    } else if (sentence) {
      const escaped = word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const clozeRx = new RegExp(`(?<![\\wÀ-ÖØ-öø-ÿ])(${escaped})(?![\\wÀ-ÖØ-öø-ÿ])`, 'gi');
      const cloze = sentence.replace(
        clozeRx,
        `<span style="color:#38bdf8;border-bottom:2px dashed #38bdf8;padding:0 2px">[...]</span>`,
      );
      frontContent = `
                <div class="fc-context" style="font-size:22px;font-style:normal;color:#e2e8f0;margin-bottom:28px">"${cloze}"</div>
                <div class="fc-word" style="font-size:18px;opacity:0.25">${word.word[0]}${'·'.repeat(Math.max(0, word.word.length - 1))}</div>`;
    } else {
      frontContent = `
                <div class="fc-word">${word.word}</div>
                <div class="fc-hint" style="margin-top:14px">Sem frase salva. Qual o significado?</div>`;
    }

    content.innerHTML = `
            <div class="flashcard-scene">
                <div class="flashcard" id="fc-front">
                    <div class="fc-audio-row">
                        <button class="audio-btn" id="fc-play-word">🔊 Palavra</button>
                        ${sentence ? `<button class="audio-btn" id="fc-play-sent">🔊 Frase</button>` : ''}
                        ${sentence ? `<button class="audio-btn" id="fc-mic-btn" title="Avaliar Pronúncia">🎙️ Falar</button>` : ''}
                    </div>
                    <div id="fc-mic-feedback" style="display:none; text-align:center; margin-top:8px; font-size:14px; font-weight:600; padding:8px; border-radius:6px;"></div>
                    ${word.level ? `<div style="position:absolute;top:20px;left:20px"><span class="status-badge" style="background:rgba(56,189,248,0.12);color:#38bdf8">${word.level}</span></div>` : ''}
                    ${frontContent}
                    <div style="margin-top:30px">
                        <button class="btn btn-accent" id="fc-btn-reveal" style="font-size:16px; padding:14px 32px; box-shadow: 0 4px 15px rgba(56,189,248,0.4);">Revelar Resposta</button>
                    </div>
                    <div class="fc-hint" style="margin-top:16px">Ou pressione Espaço</div>
                </div>
            </div>`;
  } else {
    // ── PASSO 2: VERSO COMPLETO ──
    if (word.pronunciation_pt) tts.play(word.pronunciation_pt, 'pt-BR');

    const [intAgain, intHard, intGood, intEasy] = await Promise.all([
      lfDb.predictNextInterval(card, 1),
      lfDb.predictNextInterval(card, 2),
      lfDb.predictNextInterval(card, 3),
      lfDb.predictNextInterval(card, 4),
    ]);

    const tagRow = (
      Array.isArray(word.tags)
        ? word.tags
        : (word.tags || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
    )
      .map((t) => `<span class="tag-chip">${t}</span>`)
      .join('');

    // Usa as variáveis capturadas localmente (não word.xxx diretamente)
    const displayTranslation = translation;
    const displaySentence = sentence;

    content.innerHTML = `
            <div class="flashcard-scene">
                <div class="flashcard" style="cursor:default">
                    <div class="fc-audio-row">
                        <button class="audio-btn" id="fc-play-word-ans">🔊 Inglês</button>
                        ${word.pronunciation_pt ? `<button class="audio-btn" id="fc-play-pt-ans">🇧🇷 BR</button>` : ''}
                        ${sentence ? `<button class="audio-btn" id="fc-play-sent-ans">🔊 Frase</button>` : ''}
                        ${sentence ? `<button class="audio-btn" id="fc-mic-btn-ans" title="Avaliar Pronúncia">🎙️ Falar</button>` : ''}
                        ${sentence ? `<button class="audio-btn" id="fc-ai-var-btn" title="Gerar novas frases">🧠 Variação</button>` : ''}
                        <button class="audio-btn" id="fc-edit-btn">✏️ Editar</button>
                    </div>
                    <div id="fc-ai-var-container" style="display:none; text-align:left; margin-top:8px; font-size:14px; font-weight:500; padding:12px; border-radius:8px; background:rgba(56, 189, 248, 0.1); border:1px solid rgba(56, 189, 248, 0.2); color:#e2e8f0;"></div>
                    <div id="fc-mic-feedback-ans" style="display:none; text-align:center; margin-top:8px; font-size:14px; font-weight:600; padding:8px; border-radius:6px;"></div>
                    ${word.level ? `<div style="position:absolute;top:20px;left:20px"><span class="status-badge" style="background:rgba(56,189,248,0.12);color:#38bdf8">${word.level}</span></div>` : ''}
                    <div class="fc-word">${word.word}</div>
                    ${word.pronunciation_pt ? `<div style="font-size:18px; color:#fbbf24; font-weight:800; font-family:monospace; background:rgba(251,191,36,0.1); padding:6px 14px; border-radius:8px; display:inline-block; border:1px solid rgba(251,191,36,0.35); margin-top:10px;">🇧🇷 ${word.pronunciation_pt}</div>` : word.phonetic ? `<div style="font-size:14px; color:#94a3b8; font-family:monospace; margin-top:8px;">${word.phonetic}</div>` : ''}
                    ${displaySentence ? `<div class="fc-context" style="margin-top:16px;">"${displaySentence}"</div>` : ''}
                    ${displayTranslation ? `<div class="fc-translation" style="color:#22c55e; margin-top:8px;">${displayTranslation}</div>` : ''}
                    ${
                      word.chunks && Array.isArray(word.chunks) && word.chunks.length > 0
                        ? `
                        <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.05); width: 100%; text-align: left; max-width:500px;">
                            <div style="font-size:12px; color:#94a3b8; font-weight:700; margin-bottom:12px; text-transform:uppercase;">🧩 Chunks (IA)</div>
                            <div style="display:flex; flex-direction:column; gap:12px;">
                                ${word.chunks
                                  .map(
                                    (c) => `
                                    <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:12px;">
                                        <div style="font-size:14px; color:#e2e8f0; font-weight:700; margin-bottom:4px;">${c.eng}</div>
                                        <div style="font-size:13px; color:#fbbf24; font-family:monospace; background:rgba(251,191,36,0.1); padding:2px 6px; border-radius:4px; display:inline-block; margin-bottom:6px;">${c.phon}</div>
                                        <div style="font-size:12px; color:#94a3b8; font-style:italic;">${c.pt}</div>
                                    </div>
                                `,
                                  )
                                  .join('')}
                            </div>
                        </div>
                    `
                        : `
                        <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.05); width: 100%; text-align: center;">
                            <button id="fc-gen-chunks-btn" class="btn btn-outline" style="font-size:13px; padding:8px 16px;">✦ Gerar Chunks com IA</button>
                        </div>
                    `
                    }
                    ${tagRow ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:16px;justify-content:center">${tagRow}</div>` : ''}
                    ${word.explanation ? `<div style="font-size:13px;color:#64748b;margin-top:16px;max-width:500px;text-align:center;line-height:1.6">${word.explanation.substring(0, 200)}${word.explanation.length > 200 ? '…' : ''}</div>` : ''}
                </div>
            </div>
            <div class="study-actions">
                <button class="study-btn again" id="btn-again">
                    <span class="study-btn-label">❌ Errei</span>
                    <span class="study-btn-time">${formatInterval(intAgain)}</span>
                </button>
                <button class="study-btn hard" id="btn-hard">
                    <span class="study-btn-label">😓 Difícil</span>
                    <span class="study-btn-time">${formatInterval(intHard)}</span>
                </button>
                <button class="study-btn good" id="btn-good">
                    <span class="study-btn-label">✅ Bom</span>
                    <span class="study-btn-time">${formatInterval(intGood)}</span>
                </button>
                <button class="study-btn easy" id="btn-easy">
                    <span class="study-btn-label">⭐ Fácil</span>
                    <span class="study-btn-time">${formatInterval(intEasy)}</span>
                </button>
            </div>
            <div class="keyboard-hint">
                <span class="key-chip"><kbd>1</kbd> Errei</span>
                <span class="key-chip"><kbd>2</kbd> Difícil</span>
                <span class="key-chip"><kbd>3</kbd> Bom</span>
                <span class="key-chip"><kbd>4</kbd> Fácil</span>
            </div>`;
  }

  if (revealStep < 2) {
    document.getElementById('fc-front')?.addEventListener('click', (e) => {
      if (e.target.closest('.audio-btn') || e.target.closest('.btn')) return;
      revealAnswer();
    });
    document.getElementById('fc-btn-reveal')?.addEventListener('click', (e) => {
      e.stopPropagation();
      revealAnswer();
    });
    document.getElementById('fc-play-word')?.addEventListener('click', (e) => {
      e.stopPropagation();
      tts.play(word.word, 'en-US');
    });

    let sentenceToPlay = word.context_sentence;
    if (!sentenceToPlay && word.chunks && word.chunks.length > 0)
      sentenceToPlay = word.chunks[0].eng;

    document.getElementById('fc-play-sent')?.addEventListener('click', (e) => {
      e.stopPropagation();
      tts.play(sentenceToPlay, 'en-US');
    });

    const fcMicBtn = document.getElementById('fc-mic-btn');
    if (fcMicBtn) {
      fcMicBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (pronunciationLab.isRecording) {
          pronunciationLab.stop();
          return;
        }
        fcMicBtn.style.background = 'rgba(239,68,68,0.2)';
        fcMicBtn.style.color = '#ef4444';
        fcMicBtn.textContent = '⏹️ Ouvindo...';
        await pronunciationLab.assess(sentenceToPlay, (fb) => {
          const fbDiv = document.getElementById('fc-mic-feedback');
          if (fb.status === 'result') {
            fbDiv.style.display = 'block';
            fbDiv.innerHTML = `Pronúncia: ${fb.score}% <br> <div style="margin-top:4px">${fb.htmlFeedback}</div>`;
            fcMicBtn.style.background = '';
            fcMicBtn.style.color = '';
            fcMicBtn.textContent = '🎙️ Falar';
          } else if (fb.error) {
            fbDiv.style.display = 'block';
            fbDiv.innerHTML = `<span style="color:var(--red)">${fb.error}</span>`;
            fcMicBtn.style.background = '';
            fcMicBtn.style.color = '';
            fcMicBtn.textContent = '🎙️ Falar';
          }
        });
      });
    }

    if (revealStep === 0) {
      tts.play(word.word, 'en-US');
    } else if (revealStep === 1) {
      tts.play(sentenceToPlay, 'en-US');
    }
  } else {
    document
      .getElementById('fc-play-word-ans')
      ?.addEventListener('click', () => tts.play(word.word, 'en-US'));
    document
      .getElementById('fc-play-pt-ans')
      ?.addEventListener('click', () => tts.play(word.pronunciation_pt, 'pt-BR'));
    document
      .getElementById('fc-play-sent-ans')
      ?.addEventListener('click', () => tts.play(word.context_sentence, 'en-US'));

    const genChunksBtn = document.getElementById('fc-gen-chunks-btn');
    if (genChunksBtn) {
      genChunksBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        genChunksBtn.textContent = '⏳ Gerando...';
        genChunksBtn.disabled = true;
        chrome.runtime.sendMessage(
          { action: 'ai_generate_chunks', word: word.word },
          async (res) => {
            if (res?.chunks && Array.isArray(res.chunks)) {
              word.chunks = res.chunks;
              await lfDb.saveWord(word);
              await showCard(); // Redraw with chunks
            } else {
              genChunksBtn.textContent = '❌ Erro. Tente novamente';
              genChunksBtn.disabled = false;
            }
          },
        );
      });
    }

    const fcMicBtnAns = document.getElementById('fc-mic-btn-ans');
    if (fcMicBtnAns) {
      fcMicBtnAns.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (pronunciationLab.isRecording) {
          pronunciationLab.stop();
          return;
        }
        fcMicBtnAns.style.background = 'rgba(239,68,68,0.2)';
        fcMicBtnAns.style.color = '#ef4444';
        fcMicBtnAns.textContent = '⏹️ Ouvindo...';
        await pronunciationLab.assess(word.context_sentence, (fb) => {
          const fbDiv = document.getElementById('fc-mic-feedback-ans');
          if (fb.status === 'result') {
            fbDiv.style.display = 'block';
            fbDiv.innerHTML = `Pronúncia: ${fb.score}% <br> <div style="margin-top:4px">${fb.htmlFeedback}</div>`;
            fcMicBtnAns.style.background = '';
            fcMicBtnAns.style.color = '';
            fcMicBtnAns.textContent = '🎙️ Falar';
          } else if (fb.error) {
            fbDiv.style.display = 'block';
            fbDiv.innerHTML = `<span style="color:var(--red)">${fb.error}</span>`;
            fcMicBtnAns.style.background = '';
            fcMicBtnAns.style.color = '';
            fcMicBtnAns.textContent = '🎙️ Falar';
          }
        });
      });
    }

    const fcAiBtn = document.getElementById('fc-ai-var-btn');
    if (fcAiBtn) {
      fcAiBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const container = document.getElementById('fc-ai-var-container');
        if (container.style.display === 'block') {
          container.style.display = 'none';
          return;
        }

        fcAiBtn.textContent = '⏳ Gerando...';
        fcAiBtn.disabled = true;
        container.style.display = 'block';
        container.innerHTML =
          '<div style="text-align:center; padding:10px;">🧠 A Inteligência Artificial está gerando frases exclusivas para você...</div>';

        chrome.runtime.sendMessage(
          {
            action: 'lf_generate_variation',
            word: word.word,
            sentence: word.context_sentence,
          },
          (res) => {
            fcAiBtn.textContent = '🧠 Variação';
            fcAiBtn.disabled = false;
            if (res && res.ok && res.data) {
              const htmlList = res.data
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l)
                .map(
                  (l) =>
                    `<div style="margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px;">${l}</div>`,
                )
                .join('');
              container.innerHTML = `<div style="color:#38bdf8; font-weight:700; margin-bottom:10px;">🌟 Novas Formas de Usar:</div>${htmlList}`;
            } else {
              container.innerHTML =
                '<div style="color:#ef4444;">Erro ao gerar variações. Verifique sua API Key na aba de Configurações.</div>';
            }
          },
        );
      });
    }

    document
      .getElementById('fc-edit-btn')
      ?.addEventListener('click', () => openWordEditor(word.id));
    document.getElementById('btn-again').addEventListener('click', () => answerCard(1));
    document.getElementById('btn-hard').addEventListener('click', () => answerCard(2));
    document.getElementById('btn-good').addEventListener('click', () => answerCard(3));
    document.getElementById('btn-easy').addEventListener('click', () => answerCard(4));
  }
}

let _showCardBusy = false;

async function revealAnswer() {
  if (_showCardBusy) return;
  try {
    _showCardBusy = true;
    revealStep++;
    if (revealStep > 2) revealStep = 2;
    await showCard();
  } catch (e) {
    showToast('Erro ao revelar o cartão: ' + e.message, 'error');
    console.error(e);
  } finally {
    _showCardBusy = false;
  }
}

async function answerCard(quality) {
  const card = studyCards[currentIndex];
  await lfDb.logReview(card.id, quality);
  sessionDone++;
  if (quality >= 3) sessionCorrect++;
  currentIndex++;
  revealStep = 0;
  updateHeader();
  updateSessionUI();
  await showCard();

  // Auto-sync a cada 5 cards ou ao fim da sessão
  if (sessionDone % 5 === 0 || currentIndex >= studyCards.length) {
    try {
      if (window._supabaseAuth?.isLoggedIn()) {
        await window._supabaseAuth.syncUp(lfDb);
      }
    } catch (_) {
      /* offline */
    }
  }
}

// Atalhos de teclado para estudo
document.addEventListener('keydown', (e) => {
  const active = document.querySelector('.content-section.active')?.id;
  if (active !== 'study-section') return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (revealStep < 2 && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    revealAnswer();
  }
  if (revealStep === 2) {
    if (e.key === '1') document.getElementById('btn-again')?.click();
    if (e.key === '2') document.getElementById('btn-hard')?.click();
    if (e.key === '3') document.getElementById('btn-good')?.click();
    if (e.key === '4') document.getElementById('btn-easy')?.click();
  }
});

// ============================================================================
// LIBRARY — Vocabulário com filtros completos
// ============================================================================
async function loadLibrary() {
  await loadLibraryItems();
}

async function loadLibraryItems() {
  const isWords = document.getElementById('lib-tab-words')?.classList.contains('active');
  const isDecks = document.getElementById('lib-tab-decks')?.classList.contains('active');
  const container = document.getElementById('cardsGrid');
  const listContainer = document.getElementById('phrasesList');
  const decksContainer = document.getElementById('library-decks-list');

  if (isDecks) {
    if (container) container.style.display = 'none';
    if (listContainer) listContainer.style.display = 'none';
    if (decksContainer) decksContainer.style.display = 'block';
    await loadDecks();
  } else if (isWords) {
    if (container) container.style.display = 'grid';
    if (listContainer) listContainer.style.display = 'none';
    if (decksContainer) decksContainer.style.display = 'none';
    await loadCards();
  } else {
    if (container) container.style.display = 'none';
    if (listContainer) listContainer.style.display = 'block';
    if (decksContainer) decksContainer.style.display = 'none';
    await loadPhrases();
  }
}

async function loadCards() {
  const grid = document.getElementById('cardsGrid');
  if (!grid) return;
  grid.innerHTML =
    '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#64748b">Carregando...</div>';

  try {
    const [words, allCards, allTags, decks] = await Promise.all([
      lfDb.getAllWords(),
      lfDb.getAllCards(),
      lfDb.getAllTags(),
      lfDb.getAllDecks(),
    ]);

    // Renderiza filtros de tags
    renderTagFilters(allTags);
    // Popula deck filter
    populateDeckFilter(decks);

    // Criar mapa de cards por word_id
    const cardMap = {};
    allCards.forEach((c) => {
      cardMap[c.word_id] = c;
    });

    const search = (document.getElementById('library-search')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('lib-filter-status')?.value || '';
    const deckFilter = document.getElementById('lib-filter-deck')?.value || '';
    const sort = document.getElementById('lib-sort')?.value || 'date-desc';

    let filtered = words.filter((w) => {
      const card = cardMap[w.id];
      const status = card?.status || 'new';
      const suspended = card?.suspended;

      if (statusFilter === 'suspended') return suspended;
      if (statusFilter && statusFilter !== 'suspended') {
        if (suspended) return false;
        if (status !== statusFilter) return false;
      } else {
        if (suspended && statusFilter !== 'suspended') return false;
      }

      if (deckFilter && String(w.deck_id) !== String(deckFilter)) return false;
      if (
        libActiveTag &&
        !(Array.isArray(w.tags) ? w.tags : (w.tags || '').split(',').map((t) => t.trim())).includes(
          libActiveTag,
        )
      )
        return false;

      if (search) {
        return (
          (w.word || '').toLowerCase().includes(search) ||
          (w.translation || '').toLowerCase().includes(search) ||
          (w.tags || '').toLowerCase().includes(search)
        );
      }
      return true;
    });

    // Ordenação
    if (sort === 'alpha') filtered.sort((a, b) => a.word.localeCompare(b.word));
    else if (sort === 'date-asc') filtered.sort((a, b) => a.added_at - b.added_at);
    else if (sort === 'date-desc') filtered.sort((a, b) => b.added_at - a.added_at);
    else if (sort === 'status')
      filtered.sort((a, b) => {
        const p = { new: 0, learning: 1, review: 2, mature: 3 };
        return (p[cardMap[a.id]?.status] || 0) - (p[cardMap[b.id]?.status] || 0);
      });
    else if (sort === 'due')
      filtered.sort((a, b) => (cardMap[a.id]?.due_date || 0) - (cardMap[b.id]?.due_date || 0));

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">📭</div><div class="empty-text">Nenhuma palavra encontrada</div><div class="empty-sub">Ajuste os filtros ou salve palavras assistindo vídeos</div></div>`;
      return;
    }

    grid.className = `cards-grid ${libSelectMode ? 'selecting' : ''}`;
    grid.innerHTML = filtered
      .map((word) => {
        const card = cardMap[word.id];
        const status = card?.suspended ? 'suspended' : card?.status || 'new';
        const isLeech = card?.is_leech;
        const tags = Array.isArray(word.tags)
          ? word.tags
          : (word.tags || '')
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean);
        const isSelected = libSelectedIds.has(String(word.id));

        return `
                <div class="word-card ${isLeech ? 'leech' : ''} ${isSelected ? 'selected' : ''}" data-id="${word.id}">
                    <input type="checkbox" class="wc-check" data-id="${word.id}" ${isSelected ? 'checked' : ''}>
                    <div class="wc-word">${word.word}</div>
                    <div class="wc-translation">${word.translation || '<span style="color:#64748b;font-style:italic">sem tradução</span>'}</div>
                    ${word.context_sentence ? `<div class="wc-context">"${word.context_sentence.substring(0, 80)}${word.context_sentence.length > 80 ? '…' : ''}"</div>` : ''}
                    ${tags.length ? `<div class="wc-tags">${tags.map((t) => `<span class="tag-chip">${t}</span>`).join('')}</div>` : ''}
                    <div class="wc-meta">
                        <span class="status-badge status-${status}">${status.toUpperCase()}</span>
                        <div style="display:flex;gap:6px;align-items:center">
                            ${isLeech ? '<span class="leech-badge">🩸 Leech</span>' : ''}
                            <span style="color:#64748b;font-size:11px">${new Date(word.added_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                    </div>
                </div>`;
      })
      .join('');

    grid.querySelectorAll('.word-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('wc-check')) return;
        if (libSelectMode) {
          toggleSelectById(card.dataset.id);
          return;
        }
        openWordEditor(card.dataset.id);
      });
    });
    grid.querySelectorAll('.wc-check').forEach((checkbox) => {
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSelect(e.currentTarget.dataset.id, e.currentTarget);
      });
    });
  } catch (e) {
    console.error(e);
  }
}

function renderTagFilters(tags) {
  const row = document.getElementById('tags-filter-row');
  if (!row) return;
  if (!tags.length) {
    row.innerHTML = '';
    return;
  }
  row.innerHTML =
    `<span style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;align-self:center">Tags:</span>` +
    tags
      .map(
        (t) =>
          `<button class="filter-chip ${libActiveTag === t ? 'active purple' : ''}" data-tag="${escapeAttr(t)}">${t}</button>`,
      )
      .join('');
  row.querySelectorAll('.filter-chip[data-tag]').forEach((btn) => {
    btn.addEventListener('click', () => setTagFilter(btn.dataset.tag));
  });
}

function setTagFilter(tag) {
  libActiveTag = libActiveTag === tag ? '' : tag;
  loadCards();
}

window.setTagFilter = setTagFilter;

window.toggleSelect = (id, checkbox) => {
  if (checkbox.checked) libSelectedIds.add(String(id));
  else libSelectedIds.delete(String(id));
  updateBulkBar();
  document
    .querySelector(`.word-card[data-id="${id}"]`)
    ?.classList.toggle('selected', checkbox.checked);
};

function toggleSelectById(id) {
  const sid = String(id);
  if (libSelectedIds.has(sid)) libSelectedIds.delete(sid);
  else libSelectedIds.add(sid);
  updateBulkBar();
  loadCards();
}

function updateBulkBar() {
  const bar = document.getElementById('bulk-bar');
  const count = document.getElementById('bulk-count');
  if (!bar) return;
  if (libSelectedIds.size > 0) {
    bar.classList.add('visible');
    if (count) count.textContent = `${libSelectedIds.size} selecionados`;
  } else {
    bar.classList.remove('visible');
  }
}

function populateDeckFilter(decks) {
  const sel = document.getElementById('lib-filter-deck');
  const bulkSel = document.getElementById('bulk-deck-select');
  const importSel = document.getElementById('import-deck-select');
  const exportSel = document.getElementById('export-deck-select');
  const editDeckSel = document.getElementById('edit-deck');

  [sel, bulkSel, importSel, exportSel, editDeckSel].forEach((s) => {
    if (!s) return;
    const isFilter = s === sel;
    const current = s.value;
    s.innerHTML =
      (isFilter ? '<option value="">Todos os decks</option>' : '') +
      decks
        .map(
          (d) =>
            `<option value="${d.id}" ${String(d.id) === current ? 'selected' : ''}>${d.name}</option>`,
        )
        .join('');
  });
}

async function loadPhrases() {
  const list = document.getElementById('phrasesList');
  if (!list) return;
  try {
    const sentences = await lfDb.getAllSentences();
    const search = (document.getElementById('library-search')?.value || '').toLowerCase();
    let filtered = sentences.filter(
      (s) =>
        (s.original || s.phrase_text || '').toLowerCase().includes(search) ||
        (s.translation || s.phrase_translation || '').toLowerCase().includes(search),
    );
    if (!filtered.length) {
      list.innerHTML = `<div class="empty"><div class="empty-icon">💬</div><div class="empty-text">Nenhuma frase encontrada</div><div class="empty-sub">Salve frases enquanto assiste vídeos!</div></div>`;
      return;
    }
    list.innerHTML = filtered
      .map(
        (s) => `
            <div class="phrase-item" data-id="${s.id}" data-text="${(s.original || s.phrase_text || '').replace(/"/g, '&quot;')}">
                <div style="display:flex;justify-content:space-between;align-items:start;gap:12px">
                    <div style="flex:1;cursor:pointer" class="phrase-click-area">
                        <div class="phrase-original">${s.original || s.phrase_text || ''}</div>
                        <div class="phrase-translation">${s.translation || s.phrase_translation || '—'}</div>
                        <div class="phrase-meta">
                            <span style="background:rgba(56,189,248,0.1);color:#38bdf8;padding:2px 8px;border-radius:4px">${s.platform || 'Video'}</span>
                            ${new Date(s.saved_at || s.added_at).toLocaleDateString('pt-BR')}
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;flex-shrink:0">
                        <button class="btn btn-icon btn-ghost play-phrase-btn" title="Ouvir">🔊</button>
                        <button class="btn btn-icon btn-danger delete-phrase-btn" title="Excluir">🗑️</button>
                    </div>
                </div>
            </div>`,
      )
      .join('');

    list.querySelectorAll('.phrase-item').forEach((item) => {
      item
        .querySelector('.phrase-click-area')
        .addEventListener('click', () => openSentenceDetails(item.dataset.id));
      item.querySelector('.play-phrase-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        tts.play(item.dataset.text, 'en-US');
      });
      item.querySelector('.delete-phrase-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Excluir esta frase?')) {
          await lfDb.deleteSentence(item.dataset.id);
          loadPhrases();
          showToast('Frase excluída', 'success');
        }
      });
    });
  } catch (e) {}
}

// ============================================================================
// EDITOR DE NOTAS — modal completo estilo Anki
// ============================================================================
let _currentEditorWordId = null;

async function openWordEditor(id) {
  _currentEditorWordId = id;
  const word = await lfDb.getWordById(id);
  if (!word) return;

  const card = await lfDb.getCardByWordId(id);
  const history = card ? await lfDb.getCardStats(card.id) : [];
  const decks = await lfDb.getAllDecks();

  const modal = document.getElementById('modalWordEditor');
  modal.classList.add('open');

  document.getElementById('editorWordTitle').textContent = word.word;
  document.getElementById('edit-word').value = word.word;
  document.getElementById('edit-translation').value = word.translation || '';
  document.getElementById('edit-context').value = word.context_sentence || '';
  document.getElementById('edit-explanation').value = word.explanation || '';

  // Tags
  renderTagInputChips(
    Array.isArray(word.tags)
      ? word.tags
      : (word.tags || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
  );

  // Deck select
  populateDeckFilter(decks);
  const deckSel = document.getElementById('edit-deck');
  if (deckSel) deckSel.value = word.deck_id || 1;

  // SRS info
  const srsDiv = document.getElementById('card-srs-info');
  if (srsDiv && card) {
    const nextDue = card.due_date ? new Date(card.due_date).toLocaleDateString('pt-BR') : '—';
    const lastReview = card.last_review
      ? new Date(card.last_review).toLocaleDateString('pt-BR')
      : '—';
    srsDiv.innerHTML = `
            <div><span style="color:#64748b;font-size:10px;text-transform:uppercase;font-weight:700;display:block;margin-bottom:3px">Status</span><span class="status-badge status-${card.suspended ? 'suspended' : card.status}">${card.suspended ? 'SUSPENSO' : card.status?.toUpperCase() || 'NOVO'}</span></div>
            <div><span style="color:#64748b;font-size:10px;text-transform:uppercase;font-weight:700;display:block;margin-bottom:3px">Intervalo</span><span style="color:white;font-weight:700">${formatInterval(card.interval || 0)}</span></div>
            <div><span style="color:#64748b;font-size:10px;text-transform:uppercase;font-weight:700;display:block;margin-bottom:3px">Ease Factor</span><span style="color:white;font-weight:700">${((card.ease_factor || 2.5) * 100).toFixed(0)}%</span></div>
            <div><span style="color:#64748b;font-size:10px;text-transform:uppercase;font-weight:700;display:block;margin-bottom:3px">Lapses</span><span style="color:${(card.lapses || 0) >= 5 ? '#f87171' : 'white'};font-weight:700">${card.lapses || 0}</span></div>
            <div><span style="color:#64748b;font-size:10px;text-transform:uppercase;font-weight:700;display:block;margin-bottom:3px">Próxima Revisão</span><span style="color:white;font-weight:700">${nextDue}</span></div>
            <div><span style="color:#64748b;font-size:10px;text-transform:uppercase;font-weight:700;display:block;margin-bottom:3px">Última Revisão</span><span style="color:white;font-weight:700">${lastReview}</span></div>`;
  }

  // Histórico de revisões
  const tbody = document.getElementById('review-history-body');
  if (tbody) {
    if (!history.length) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#64748b;padding:16px">Nenhuma revisão ainda</td></tr>`;
    } else {
      const qualityLabel = { 1: 'Errei', 2: 'Difícil', 3: 'Bom', 4: 'Fácil' };
      tbody.innerHTML = history
        .slice(0, 10)
        .map(
          (r) => `
                <tr>
                    <td>${new Date(r.ts).toLocaleDateString('pt-BR')}</td>
                    <td><span class="quality-dot q${r.quality}"></span> ${qualityLabel[r.quality] || r.quality}</td>
                    <td style="color:#64748b">${r.date}</td>
                </tr>`,
        )
        .join('');
    }
  }

  // Vídeo de origem
  const videoRow = document.getElementById('editor-video-row');
  if (word.video_url && videoRow) {
    videoRow.style.display = 'block';
    document.getElementById('editor-video-link').href = word.video_url;
    document.getElementById('editor-video-title').textContent =
      word.video_title || 'Vídeo Original';
    document.getElementById('editor-video-platform').textContent = word.platform || 'YouTube';
  } else if (videoRow) {
    videoRow.style.display = 'none';
  }

  // Botão suspender
  const suspendBtn = document.getElementById('editor-suspend-btn');
  if (suspendBtn && card) {
    if (card.suspended) {
      suspendBtn.textContent = '▶️ Reativar Card';
      suspendBtn.onclick = async () => {
        await lfDb.suspendCard(id, false);
        modal.classList.remove('open');
        showToast('Card reativado', 'success');
        loadCards();
      };
    } else {
      suspendBtn.textContent = '⏸️ Suspender Card';
      suspendBtn.onclick = async () => {
        await lfDb.suspendCard(id, true);
        modal.classList.remove('open');
        showToast('Card suspenso', 'info');
        loadCards();
      };
    }
  }

  // Se não tem explicação, pedir à IA
  if (!word.explanation) {
    try {
      chrome.runtime.sendMessage(
        { action: 'ai_explain_word', word: word.word, context: word.context_sentence },
        (r) => {
          if (r?.explanation) {
            document.getElementById('edit-explanation').value = r.explanation;
          }
        },
      );
    } catch {}
  }
}

// Tags input funcional
function renderTagInputChips(tags) {
  const wrap = document.getElementById('tag-input-wrap');
  const input = document.getElementById('tag-input-field');
  if (!wrap || !input) return;

  wrap.innerHTML = '';
  tags.forEach((tag) => {
    const chip = document.createElement('span');
    chip.className = 'tag-input-chip';
    const label = document.createTextNode(`${tag} `);
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => removeTag(tag));
    chip.appendChild(label);
    chip.appendChild(removeBtn);
    wrap.appendChild(chip);
  });
  wrap.appendChild(input);
  input.value = '';
}

function removeTag(tag) {
  const chips = document.querySelectorAll('.tag-input-chip');
  chips.forEach((c) => {
    if (c.textContent.trim().startsWith(tag)) c.remove();
  });
}

window.removeTag = removeTag;

function getEditorTags() {
  const chips = document.querySelectorAll('.tag-input-chip');
  return [...chips].map((c) => c.textContent.replace('×', '').trim()).filter(Boolean);
}

// Detalhes da Frase
async function openSentenceDetails(id) {
  const s = await lfDb.getSentenceById(id);
  if (!s) return;
  const modal = document.getElementById('modalSentence');
  const body = document.getElementById('sentenceModalBody');
  if (!modal || !body) return;

  body.innerHTML = `
        <div style="margin-bottom:24px">
            <div style="display:flex;align-items:start;gap:12px;margin-bottom:16px">
                <p style="font-size:22px;font-weight:700;flex:1;line-height:1.5">${s.original || s.phrase_text}</p>
                <button class="audio-btn" id="play-sent-modal">🔊</button>
            </div>
            <p style="font-size:18px;color:#4ade80;margin-bottom:16px">${s.translation || s.phrase_translation || '—'}</p>
            <div style="background:rgba(56,189,248,0.05);border:1px solid rgba(56,189,248,0.15);border-radius:10px;padding:16px">
                <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;margin-bottom:8px">Análise da IA</div>
                <div id="sent-ai-text" style="color:#e2e8f0;font-size:14px;line-height:1.7">${s.analysis || 'Analisando...'}</div>
            </div>
        </div>
        ${s.video_url ? `<a href="${s.video_url}" target="_blank" class="phrase-item" style="display:flex;gap:12px;align-items:center;text-decoration:none;margin-bottom:0"><span style="font-size:24px">📺</span><div><div style="color:white;font-weight:600">${s.video_title || 'Vídeo Original'}</div><div style="color:#64748b;font-size:12px">${s.platform || 'YouTube'}</div></div></a>` : ''}`;

  modal.classList.add('open');
  document
    .getElementById('play-sent-modal')
    ?.addEventListener('click', () => tts.play(s.original || s.phrase_text, 'en-US'));

  if (!s.analysis) {
    try {
      chrome.runtime.sendMessage(
        { action: 'ai_explain_sentence', sentence: s.original || s.phrase_text },
        (r) => {
          if (r?.analysis) {
            const el = document.getElementById('sent-ai-text');
            if (el) el.textContent = r.analysis;
            s.analysis = r.analysis;
            lfDb.saveSentence(s);
          }
        },
      );
    } catch {}
  }
}

window.openWordDetails = (id) => openWordEditor(id);
window.openSentenceDetails = openSentenceDetails;

// ============================================================================
// DECKS
// ============================================================================
async function loadDecks() {
  const list = document.getElementById('library-decks-list');
  if (!list) return;
  const [decks, words, allCards] = await Promise.all([
    lfDb.getAllDecks(),
    lfDb.getAllWords(),
    lfDb.getAllCards(),
  ]);
  const cardMap = {};
  allCards.forEach((c) => {
    cardMap[c.word_id] = c;
  });
  if (!decks.length) {
    list.innerHTML =
      '<div class="empty"><div class="empty-icon">🗂️</div><div class="empty-text">Nenhum deck criado</div></div>';
    return;
  }
  list.innerHTML = decks
    .map((deck) => {
      const dw = words.filter((w) => w.deck_id === deck.id);
      const matureCount = dw.filter((w) => cardMap[w.id]?.status === 'mature').length;
      const isDefault = deck.id === 1;
      const lvColor = matureCount >= 50 ? '#ffd700' : matureCount >= 20 ? '#c0c0c0' : '#cd7f32';
      const lvLabel = matureCount >= 50 ? 'Ouro' : matureCount >= 20 ? 'Prata' : 'Bronze';
      return `<div class="phrase-item"><div style="display:flex;justify-content:space-between;align-items:center">
            <div><div class="phrase-original">${isDefault ? '📚' : '🎴'} ${deck.name} <span style="background:${lvColor};color:#000;font-size:10px;font-weight:800;padding:2px 6px;border-radius:10px;margin-left:8px">${lvLabel}</span></div>
            <div class="phrase-meta">${dw.length} palavras • ${matureCount} masterizadas</div></div>
            <div style="display:flex;gap:8px">
                <button class="btn btn-primary btn-sm study-deck-btn" data-id="${deck.id}">Estudar</button>
                ${!isDefault ? `<button class="btn btn-danger btn-sm delete-deck-btn" data-id="${deck.id}">🗑️</button>` : ''}
            </div></div></div>`;
    })
    .join('');
  list
    .querySelectorAll('.study-deck-btn')
    .forEach((b) =>
      b.addEventListener('click', () => window.dashboard.studyDeck(parseInt(b.dataset.id))),
    );
  list
    .querySelectorAll('.delete-deck-btn')
    .forEach((b) =>
      b.addEventListener('click', () => window.dashboard.deleteDeck(parseInt(b.dataset.id))),
    );
}

// ============================================================================
// HOME
// ============================================================================
async function loadHome() {
  try {
    const [stats, words, sentences] = await Promise.all([
      lfDb.getStats(),
      lfDb.getAllWords(),
      lfDb.getAllSentences(),
    ]);
    const dueCount = stats.dueCards;

    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set('headerDue', dueCount);
    set('home-streak-val', stats.streak);
    set('home-phrase-count', stats.totalSentences || 0);

    const today = new Date().toISOString().split('T')[0];
    const newTodayWords = words.filter(
      (w) => new Date(w.added_at).toISOString().split('T')[0] === today,
    ).length;
    set('home-goal-val', `${newTodayWords}/20`);

    const studyDesc = document.getElementById('home-study-desc');
    const totalChunks = words.flatMap((w) =>
      w.chunks && Array.isArray(w.chunks) ? w.chunks : [],
    ).length;
    let descHtml = '';
    if (dueCount > 0)
      descHtml += `Você tem <b style="color:#38bdf8">${dueCount} revisões</b> pendentes para hoje! `;
    else descHtml += 'Tudo em dia com flashcards! 🎉 ';

    if (totalChunks > 0)
      descHtml += `<br><span style="color:#fbbf24">Você tem ${totalChunks} chunks aguardando treino.</span>`;

    if (studyDesc) studyDesc.innerHTML = descHtml;

    // IA status
    try {
      const apiKey = await lfDb.getSetting('grok_api_key');
      const iaBadge = document.getElementById('home-ia-status');
      if (iaBadge)
        iaBadge.innerHTML = apiKey
          ? '<div class="mini-stat-val" style="font-size:14px;color:#10b981">● Conectada</div><div class="mini-stat-label">IA Status</div>'
          : '<div class="mini-stat-val" style="font-size:14px;color:#ef4444">● Desconectada</div><div class="mini-stat-label">IA Status</div>';
    } catch {}

    // Frases recentes
    const recentList = document.getElementById('home-recent-phrases');
    if (recentList) {
      const recent = sentences.slice(-5).reverse();
      if (!recent.length) {
        recentList.innerHTML = `
                <div style="background:rgba(56, 189, 248, 0.05); border:1px dashed rgba(56, 189, 248, 0.3); border-radius:12px; padding:24px; text-align:center; margin-top:10px;">
                    <div style="font-size:32px; margin-bottom:12px;">🌱</div>
                    <h3 style="color:white; font-size:16px; margin-bottom:8px;">Seu Cérebro está Pronto</h3>
                    <p style="color:#94a3b8; font-size:13px; line-height:1.5;">Você ainda não garimpou nenhuma frase. Entre em qualquer site no seu idioma alvo, selecione um texto real e use a extensão para dissecá-lo!</p>
                </div>`;
      } else {
        recentList.innerHTML = recent
          .map(
            (s) => `
                    <div class="home-recent-sentence" data-id="${s.id}" style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;transition:background 0.15s;border-radius:8px">
                        <div style="color:white;font-weight:600;font-size:14px;margin-bottom:4px">${(s.original || s.phrase_text || '').substring(0, 60)}${(s.original || s.phrase_text || '').length > 60 ? '…' : ''}</div>
                        <div style="color:#38bdf8;font-size:12px">${(s.translation || s.phrase_translation || '').substring(0, 60)}</div>
                    </div>`,
          )
          .join('');
        recentList.querySelectorAll('.home-recent-sentence').forEach((item) => {
          item.addEventListener('click', () => openSentenceDetails(item.dataset.id));
        });
      }
    }

    // Lógica de Alerta de Segurança (Backup)
    try {
      const warningEl = document.getElementById('home-backup-warning');
      const lastBackupStr = await lfDb.getSetting('last_backup_date');
      if (warningEl) {
        if (!lastBackupStr) {
          warningEl.style.display = 'flex';
        } else {
          const days = (Date.now() - new Date(lastBackupStr).getTime()) / (1000 * 3600 * 24);
          warningEl.style.display = days > 7 ? 'flex' : 'none';
        }
      }
    } catch (e) {
      console.error('Erro ao verificar backup:', e);
    }

    renderHeatmap('home-heatmap');
    loadHomeDecks();
  } catch (e) {
    console.error(e);
  }
}

async function loadHomeDecks() {
  const list = document.getElementById('home-decks-list');
  if (!list) return;
  const searchTerm = (document.getElementById('home-deck-search')?.value || '').toLowerCase();
  const deckStats = await lfDb.getDeckStats();
  const filtered = deckStats.filter((d) => d.name.toLowerCase().includes(searchTerm));
  if (!filtered.length) {
    list.innerHTML = `<div style="padding:30px;text-align:center;color:#64748b">Nenhum deck encontrado</div>`;
    return;
  }
  list.innerHTML = filtered
    .map(
      (d) => `
        <div class="deck-row ${d.id === 1 ? 'default' : ''}">
            <div style="display:flex;align-items:center;gap:12px">
                <span style="font-size:18px">${d.icon || '🗂️'}</span>
                <div>
                    <div style="color:white;font-weight:600;font-size:14px">${d.name}</div>
                    ${d.url ? `<a href="${d.url}" target="_blank" style="color:#64748b;font-size:10px;text-decoration:none">🔗 Ver origem</a>` : ''}
                </div>
            </div>
            <div style="text-align:center;color:#38bdf8;font-weight:800">${d.newCount}</div>
            <div style="text-align:center;color:#4ade80;font-weight:800">${d.dueCount}</div>
            <div style="text-align:center;color:#94a3b8">${d.totalCount}</div>
            <div style="text-align:right">
                <button class="btn btn-primary btn-sm home-study-deck-btn" data-id="${d.id}" ${d.dueCount === 0 && d.newCount === 0 ? 'disabled' : ''}>Estudar</button>
            </div>
        </div>`,
    )
    .join('');
  list
    .querySelectorAll('.home-study-deck-btn')
    .forEach((b) =>
      b.addEventListener('click', () => window.dashboard.studyDeck(parseInt(b.dataset.id))),
    );
}

// ============================================================================
// STATS
// ============================================================================
async function loadStats() {
  try {
    const stats = await lfDb.getStats();
    const reviews = await lfDb.getReviewLog(365);
    const reviewDates = [...new Set(reviews.map((r) => r.date))].sort((a, b) => b.localeCompare(a));

    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set('statStreakVal', stats.streak);
    set('statTotalVal', stats.totalWords);
    set('statRetentVal', stats.retention + '%');
    set('statHoursVal', (stats.totalSecs / 3600).toFixed(1));

    const lv = calculateUserLevel(stats);
    set('current-cefr-big', lv.cefr);
    set('level-name', lv.name);

    let subText = lv.name;
    if (lv.nextLevel) {
      const xpNeeded = lv.nextLevel.min - lv.xp;
      const wordsNeeded = Math.ceil(xpNeeded / 20);

      const daysNeeded = Math.ceil(wordsNeeded / 15);
      const datePrediction = new Date();
      datePrediction.setDate(datePrediction.getDate() + daysNeeded);
      const predictionStr = datePrediction.toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      subText = `Faltam ~${wordsNeeded} palavras para ${lv.nextLevel.id}. Ritmo de 15/dia 🎯 Previsão: ${predictionStr}`;
    } else {
      subText = 'Nível Máximo Atingido!';
    }
    set('level-name-sub', subText);
    set('xp-display', `${lv.xp.toLocaleString()} / ${lv.nextMin.toLocaleString()} XP`);
    set('lvl-vocab-pts', lv.vocabPts.toLocaleString());
    set('lvl-immersion-pts', lv.immersionPts.toLocaleString());
    set('lvl-retention-bonus', lv.retention + '%');
    const xpBar = document.getElementById('xp-bar');
    if (xpBar) xpBar.style.width = lv.progress + '%';

    renderCEFR(stats.byCEFR);
    renderStatusDistribution(stats.byStatus);
    renderHeatmap('stats-heatmap');

    // Render Recent Words
    const feedContainer = document.getElementById('recent-words-feed');
    if (feedContainer) {
      const allWords = await lfDb.getAllWords();
      const recent = allWords.sort((a, b) => b.created_at - a.created_at).slice(0, 5);
      if (recent.length === 0) {
        feedContainer.innerHTML = `<div style="color:var(--text3);font-size:13px;padding:10px;text-align:center">Nenhuma palavra salva ainda. Vá assistir algo!</div>`;
      } else {
        feedContainer.innerHTML = recent
          .map(
            (w) => `
                    <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center">
                        <div>
                            <div style="font-weight:700;color:white;font-size:14px">${w.word}</div>
                            <div style="color:var(--accent);font-size:12px">${w.translation || ''}</div>
                        </div>
                        <button class="btn btn-ghost btn-sm recent-word-edit" data-id="${w.id}" style="padding:4px 8px;font-size:10px">✏️</button>
                    </div>
                `,
          )
          .join('');
        feedContainer.querySelectorAll('.recent-word-edit').forEach((btn) => {
          btn.addEventListener('click', () => openWordEditor(btn.dataset.id));
        });
      }
    }
  } catch (e) {
    console.error(e);
  }
}

function renderStatusDistribution(data) {
  const container = document.getElementById('status-distribution');
  if (!container || !data) return;
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  const statuses = [
    { key: 'new', label: 'Novas', color: '#94a3b8' },
    { key: 'learning', label: 'Aprendendo', color: '#fbbf24' },
    { key: 'review', label: 'Revisão', color: '#38bdf8' },
    { key: 'mature', label: 'Maduras', color: '#4ade80' },
  ];
  container.innerHTML = statuses
    .map((s) => {
      const val = data[s.key] || 0;
      const pct = Math.round((val / total) * 100);
      return `<div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px">
                <span style="color:#94a3b8;font-weight:600">${s.label}</span>
                <span style="color:white;font-weight:800">${val} (${pct}%)</span>
            </div>
            <div style="width:100%;height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:${s.color};border-radius:4px;transition:width 0.8s"></div>
            </div></div>`;
    })
    .join('');
}
function renderCEFR(data) {
  const container = document.getElementById('cefr-chart');
  if (!container || !data) return;
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const max = Math.max(...Object.values(data), 1);

  const size = 180;
  const center = size / 2;
  const radius = size / 2 - 25;

  let polygonPoints = [];
  let labelsHTML = '';

  levels.forEach((lv, i) => {
    const val = data[lv] || 0;
    const h = val / max;
    const angle = (Math.PI * 2 * i) / levels.length - Math.PI / 2;

    const px = center + radius * h * Math.cos(angle);
    const py = center + radius * h * Math.sin(angle);
    polygonPoints.push(`${px},${py}`);

    const lx = center + (radius + 15) * Math.cos(angle);
    const ly = center + (radius + 15) * Math.sin(angle);
    labelsHTML += `<text x="${lx}" y="${ly}" fill="var(--text2)" font-size="12" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${lv}\n(${val})</text>`;
  });

  let gridHTML = '';
  for (let r = 0.2; r <= 1; r += 0.2) {
    let gridPoints = [];
    levels.forEach((_, i) => {
      const angle = (Math.PI * 2 * i) / levels.length - Math.PI / 2;
      gridPoints.push(
        `${center + radius * r * Math.cos(angle)},${center + radius * r * Math.sin(angle)}`,
      );
    });
    gridHTML += `<polygon points="${gridPoints.join(' ')}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
  }

  container.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; width:100%; height:100%">
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                ${gridHTML}
                <polygon points="${polygonPoints.join(' ')}" fill="var(--accent)" fill-opacity="0.3" stroke="var(--accent)" stroke-width="2"/>
                ${labelsHTML}
            </svg>
        </div>
    `;
}

async function renderHeatmap(containerId = 'heatmap-container') {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const stats = await lfDb.getStats();
    const counts = {}; // Armazena "pontos de esforço" por dia

    if (stats.sessions) {
      stats.sessions.forEach((s) => {
        counts[s.date] = (counts[s.date] || 0) + Math.floor(s.seconds / 60); // 1 ponto por minuto de imersão
      });
    }
    if (stats.reviewLog) {
      stats.reviewLog.forEach((l) => {
        counts[l.date] = (counts[l.date] || 0) + 1; // 1 ponto por flashcard revisado
      });
    }

    container.innerHTML = '';
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 364);
    start.setDate(start.getDate() - start.getDay());
    let cur = new Date(start);
    let week = null;
    while (cur <= today) {
      if (cur.getDay() === 0) {
        week = document.createElement('div');
        week.className = 'hm-week';
        container.appendChild(week);
      }
      const key = cur.toISOString().split('T')[0];
      const pts = counts[key] || 0;

      // Lógica de níveis baseada em esforço
      let level = 0;
      if (pts > 0) level = 1;
      if (pts >= 10) level = 2; // 10 min ou 10 cards
      if (pts >= 30) level = 3;
      if (pts >= 60) level = 4;

      const cell = document.createElement('div');
      cell.className = `hm-day${level > 0 ? ' l' + level : ''}`;
      cell.title = `${key}: ${pts} pontos de esforço`;
      week?.appendChild(cell);
      cur.setDate(cur.getDate() + 1);
    }

    // Atualiza o mini-stat da ofensiva na home, se existir
    const streakVal = document.getElementById('home-streak-val');
    if (streakVal) streakVal.textContent = stats.streak;
  } catch (e) {
    console.error('Erro renderHeatmap:', e);
  }
}

// ============================================================================
// LAB — Quiz e Listening
// ============================================================================
async function loadLab() {
  document.getElementById('lab-selection').style.display = 'grid';
  document.getElementById('quiz-area').style.display = 'none';
  document.getElementById('listening-area').style.display = 'none';
}

// ============================================================================
// CHUNKS — Treino
// ============================================================================
let allChunks = [];
let chunkIndex = 0;

async function loadChunks() {
  const grid = document.getElementById('chunksGrid');
  const badge = document.getElementById('chunks-due-badge');
  if (!grid || !badge) return;

  const words = await lfDb.getAllWords();
  allChunks = [];

  words.forEach((w) => {
    let chunks = w.chunks;
    if (typeof chunks === 'string') {
      try {
        chunks = JSON.parse(chunks);
      } catch (e) {
        chunks = null;
      }
    }
    if (chunks && Array.isArray(chunks) && chunks.length > 0) {
      chunks.forEach((c) => allChunks.push({ wordId: w.id, word: w.word, ...c }));
      // Atualizar o banco para o formato correto em background
      if (typeof w.chunks === 'string') {
        w.chunks = chunks;
        lfDb.saveWord(w).catch(console.error);
      }
    }
  });

  badge.textContent = `${allChunks.length} chunks disponíveis`;

  const wordsWithoutChunks = words.filter((w) => !w.chunks || !w.chunks.length);
  const batchBtn = document.getElementById('btn-batch-chunks');
  const batchProgress = document.getElementById('batch-chunks-progress');
  const pdfBtn = document.getElementById('btn-export-pdf');

  if (pdfBtn) {
    pdfBtn.onclick = () => {
      window.print();
    };
  }

  if (wordsWithoutChunks.length === 0) {
    if (batchBtn) {
      batchBtn.textContent = '✅ Todas as palavras já têm chunks';
      batchBtn.disabled = true;
    } else {
      batchBtn.textContent = `✦ Gerar Chunks para ${wordsWithoutChunks.length} palavra${wordsWithoutChunks.length > 1 ? 's' : ''} sem chunks (IA)`;
      batchBtn.onclick = () => _batchGenerateChunks(wordsWithoutChunks, batchBtn, batchProgress);
    }
  }

  if (allChunks.length === 0) {
    grid.innerHTML = `<div class="empty" style="grid-column: 1/-1;">
            <div class="empty-icon">🧩</div>
            <div class="empty-text">Nenhum chunk ainda</div>
            <div class="empty-sub">Clique em "Gerar Chunks" acima ou gere no popup clicando em uma palavra.</div>
        </div>`;
  } else {
    renderChunksGrid();
  }

  document.getElementById('btn-practice-chunks').onclick = () => startChunkPractice();
}

async function _batchGenerateChunks(words, btn, progressEl) {
  btn.disabled = true;
  progressEl.style.display = 'block';
  let done = 0;
  let errors = 0;

  for (const w of words) {
    progressEl.textContent = `Gerando chunks: ${done}/${words.length} palavras... (${errors > 0 ? errors + ' erros' : 'sem erros'})`;
    try {
      const res = await new Promise((resolve) =>
        chrome.runtime.sendMessage({ action: 'ai_generate_chunks', word: w.word }, resolve),
      );
      if (res?.chunks?.length) {
        await lfDb.saveWord({ ...w, chunks: res.chunks });
      }
    } catch (e) {
      errors++;
    }
    done++;
    await new Promise((r) => setTimeout(r, 400)); // evita rate limit
  }

  progressEl.textContent = `✅ Concluído: ${done - errors} gerados, ${errors} falharam.`;
  btn.textContent = '✅ Chunks gerados';
  await loadChunks();
}

function renderChunksGrid() {
  const grid = document.getElementById('chunksGrid');
  grid.innerHTML = '';

  if (allChunks.length === 0) {
    grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding: 60px 20px; color: var(--text3);">
                <div style="font-size:48px; margin-bottom:16px; opacity:0.5;">🧩</div>
                <div style="font-size:18px; font-weight:700; margin-bottom:8px; color:var(--text);">Nenhum Chunk Encontrado</div>
                <div style="font-size:14px;">Você ainda não tem chunks salvos para praticar.</div>
            </div>
        `;
    document.getElementById('btn-practice-chunks').style.display = 'none';
    return;
  } else {
    document.getElementById('btn-practice-chunks').style.display = 'inline-block';
  }

  allChunks.forEach((c) => {
    const div = document.createElement('div');
    div.className = 'lf-card chunk-card';
    div.style.position = 'relative';
    div.style.padding = '20px';
    div.innerHTML = `
            <div style="font-size:16px; font-weight:800; color:#e2e8f0; margin-bottom:6px;">${c.eng}</div>
            <div style="font-size:13px; color:#94a3b8; font-style:italic; margin-bottom:12px;">${c.pt}</div>
            <div style="font-size:14px; color:#fbbf24; font-weight:700; font-family:monospace; background:rgba(251,191,36,0.1); padding:6px 10px; border-radius:8px; display:inline-block; border:1px solid rgba(251,191,36,0.3);">${c.phon}</div>
            <div style="margin-top:12px; font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; border-top:1px solid rgba(255,255,255,0.05); padding-top:10px;">Palavra base: <strong style="color:#7dd3fc">${c.word}</strong></div>
        `;
    grid.appendChild(div);
  });
}

function startChunkPractice() {
  // Basic flashcard UI for chunks
  if (allChunks.length === 0) return;

  // Shuffle chunks
  allChunks.sort(() => Math.random() - 0.5);
  chunkIndex = 0;

  const grid = document.getElementById('chunksGrid');
  grid.innerHTML = `
        <div id="chunk-practice-container" style="grid-column: 1/-1; max-width: 600px; margin: 0 auto; width: 100%;">
            <div style="display:flex; justify-content:space-between; margin-bottom:16px; align-items:center;">
                <button class="btn btn-ghost" id="btn-end-chunk-practice">← Encerrar</button>
                <div style="font-size:14px; color:#94a3b8; font-weight:600;"><span id="chunk-progress-current">1</span> / ${allChunks.length}</div>
            </div>

            <div id="chunk-card" style="background:var(--card-bg); border:1px solid var(--border); border-radius:20px; padding:40px; text-align:center; min-height:300px; display:flex; flex-direction:column; justify-content:center; align-items:center; cursor:pointer; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
                <div id="chunk-front" style="width:100%;">
                    <div style="font-size:24px; font-weight:800; color:#e2e8f0; margin-bottom:12px;" id="chunk-text-eng"></div>
                    <div style="margin-top:30px;">
                        <button class="btn btn-accent" id="chunk-btn-reveal" style="font-size:16px; padding:14px 32px;">Revelar Tradução</button>
                    </div>
                </div>

                <div id="chunk-back" style="display:none; width:100%;">
                    <div style="font-size:24px; font-weight:800; color:#e2e8f0; margin-bottom:12px;" id="chunk-text-eng-back"></div>
                    <div style="height:1px; background:var(--border); margin:20px 0; width:100%;"></div>
                    <div style="font-size:18px; color:#94a3b8; font-style:italic; margin-bottom:20px;" id="chunk-text-pt"></div>
                    <div style="font-size:22px; color:#fbbf24; font-weight:700; font-family:monospace; background:rgba(251,191,36,0.1); padding:12px 20px; border-radius:12px; display:inline-block; border:1px solid rgba(251,191,36,0.3);" id="chunk-text-phon"></div>

                    <div style="display:flex; justify-content:center; gap:12px; margin-top:30px; width:100%;">
                        <button class="btn btn-primary" id="btn-chunk-next" style="width:100%; max-width:200px; font-size:16px;">Próximo</button>
                    </div>
                </div>
            </div>
        </div>
    `;

  document.getElementById('btn-end-chunk-practice').onclick = () => {
    renderChunksGrid();
  };

  showCurrentChunk();
}

function showCurrentChunk() {
  if (chunkIndex >= allChunks.length) {
    showToast('Treino de chunks concluído!', 'success');
    renderChunksGrid();
    return;
  }

  const chunk = allChunks[chunkIndex];
  document.getElementById('chunk-progress-current').textContent = chunkIndex + 1;

  document.getElementById('chunk-front').style.display = 'block';
  document.getElementById('chunk-back').style.display = 'none';

  document.getElementById('chunk-text-eng').textContent = chunk.eng;
  document.getElementById('chunk-text-eng-back').textContent = chunk.eng;
  document.getElementById('chunk-text-pt').textContent = chunk.pt;
  document.getElementById('chunk-text-phon').textContent = chunk.phon;

  const card = document.getElementById('chunk-card');

  // Only bind flip on front
  const flipHandler = () => {
    document.getElementById('chunk-front').style.display = 'none';
    document.getElementById('chunk-back').style.display = 'block';
    card.removeEventListener('click', flipHandler);
    const revealBtn = document.getElementById('chunk-btn-reveal');
    if (revealBtn) revealBtn.removeEventListener('click', flipHandler);
  };

  card.addEventListener('click', flipHandler);
  document.getElementById('chunk-btn-reveal').addEventListener('click', (e) => {
    e.stopPropagation();
    flipHandler();
  });

  document.getElementById('btn-chunk-next').onclick = (e) => {
    e.stopPropagation();
    chunkIndex++;
    showCurrentChunk();
  };
}

async function initQuiz() {
  const container = document.getElementById('quiz-container');
  if (!container) return;
  const words = (await lfDb.getAllWords()).filter((w) => w.word && w.translation);
  if (words.length < 4) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">📚</div><div class="empty-text">Vocabulário insuficiente</div><div class="empty-sub">Você precisa de pelo menos 4 palavras com tradução.</div><button class="btn btn-primary" id="quiz-go-library" style="margin-top:20px">Ir para Biblioteca</button></div>`;
    document
      .getElementById('quiz-go-library')
      ?.addEventListener('click', () => switchTab('library'));
    return;
  }
  container.innerHTML = `
        <div style="background:rgba(15,23,42,0.9);border:2px solid rgba(56,189,248,0.2);border-radius:25px;padding:40px;position:relative">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
                <div id="quiz-mode-badge" style="background:rgba(56,189,248,0.1);color:#38bdf8;padding:5px 15px;border-radius:20px;font-size:12px;font-weight:700">Preparando...</div>
                <div id="quiz-score" style="font-size:18px;font-weight:800;color:#fbbf24">⚡ 0</div>
            </div>
            <div style="width:100%;height:6px;background:rgba(255,255,255,0.05);border-radius:3px;margin-bottom:24px;overflow:hidden">
                <div id="quiz-fill" style="width:0%;height:100%;background:#38bdf8;transition:width 0.3s"></div>
            </div>
            <div style="text-align:center;margin-bottom:32px">
                <div id="quiz-progress" style="font-size:14px;color:#64748b;margin-bottom:10px">1 / 10</div>
                <div id="quiz-word" style="font-size:48px;font-weight:800;color:white;margin-bottom:10px">...</div>
                <div id="quiz-context-hint" style="font-size:14px;color:#94a3b8;font-style:italic"></div>
            </div>
            <div id="quiz-options" style="display:grid;grid-template-columns:1fr 1fr;gap:12px"></div>
            <div id="quiz-writing-container" style="display:none">
                <input type="text" id="quiz-writing-input" class="input-field" style="width:100%;text-align:center;font-size:22px;padding:18px" placeholder="Digite a tradução...">
            </div>
            <div id="quiz-feedback" style="margin-top:24px;padding:18px;border-radius:14px;text-align:center;font-weight:700;font-size:16px;display:none"></div>
            <button id="btn-quiz-next" class="btn btn-primary" style="display:none;width:100%;margin-top:16px">Próxima ➔</button>
            <div style="position:absolute;top:0;left:0;width:100%;height:4px;background:rgba(255,255,255,0.05);border-radius:25px 25px 0 0;overflow:hidden">
                <div id="quiz-timer-fill" style="width:100%;height:100%;background:#fbbf24;transition:width 0.1s linear"></div>
            </div>
            <div style="text-align:center;margin-top:16px">
                <button id="quiz-audio-btn" class="audio-btn" style="display:none;margin:0 auto">🔊 Ouvir novamente</button>
            </div>
        </div>`;
  window.dashboard._quizWords = words.sort(() => Math.random() - 0.5).slice(0, 10);
  window.dashboard._quizIndex = 0;
  window.dashboard._quizScore = 0;
  window.dashboard._quizPoints = 0;
  renderQuizCard();
}

function startQuizTimer() {
  if (quizTimerInterval) clearInterval(quizTimerInterval);
  const fill = document.getElementById('quiz-timer-fill');
  if (!fill) return;
  let t = 100;
  fill.style.width = '100%';
  quizTimerInterval = setInterval(() => {
    t -= 1;
    fill.style.width = t + '%';
    if (t <= 0) {
      clearInterval(quizTimerInterval);
      window.dashboard.answerQuiz(false, true);
    }
  }, 100);
}

async function renderQuizCard() {
  const d = window.dashboard;
  const word = d._quizWords[d._quizIndex];
  if (!word) {
    showQuizResult();
    return;
  }
  const modes = ['choice', 'audio', 'writing'];
  const mode = modes[Math.floor(Math.random() * modes.length)];
  d._currentQuizMode = mode;
  const allWords = await lfDb.getAllWords();
  const options = allWords
    .filter((w) => w.id !== word.id && w.translation)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  options.push(word);
  options.sort(() => Math.random() - 0.5);
  document.getElementById('quiz-word').textContent = mode === 'audio' ? '🎵 ???' : word.word;
  document.getElementById('quiz-progress').textContent =
    `${d._quizIndex + 1} / ${d._quizWords.length}`;
  document.getElementById('quiz-fill').style.width =
    `${((d._quizIndex + 1) / d._quizWords.length) * 100}%`;
  document.getElementById('quiz-mode-badge').textContent =
    mode === 'choice' ? 'Múltipla Escolha' : mode === 'audio' ? 'Audição' : 'Escrita';
  document.getElementById('quiz-context-hint').textContent = word.context_sentence
    ? `"${word.context_sentence.substring(0, 60)}"`
    : '';
  const optContainer = document.getElementById('quiz-options');
  const writingContainer = document.getElementById('quiz-writing-container');
  const audioBtn = document.getElementById('quiz-audio-btn');
  optContainer.style.display = mode === 'writing' ? 'none' : 'grid';
  writingContainer.style.display = mode === 'writing' ? 'block' : 'none';
  audioBtn.style.display = mode === 'audio' ? 'inline-flex' : 'none';
  if (mode !== 'writing') {
    optContainer.innerHTML = options
      .map(
        (opt, i) => `
            <button class="btn" style="background:rgba(255,255,255,0.05);color:white;text-align:left;padding:14px;border:1px solid rgba(255,255,255,0.07);border-radius:10px" data-correct="${opt.id === word.id}">
                <span style="color:#38bdf8;margin-right:8px;font-weight:800">${i + 1}</span> ${opt.translation}
            </button>`,
      )
      .join('');
    optContainer
      .querySelectorAll('button')
      .forEach((btn) =>
        btn.addEventListener('click', () =>
          window.dashboard.answerQuiz(btn.getAttribute('data-correct') === 'true'),
        ),
      );
  }
  if (mode === 'writing') {
    const inp = document.getElementById('quiz-writing-input');
    inp.value = '';
    inp.focus();
    const h = (e) => {
      if (e.key === 'Enter') {
        const ok = inp.value.trim().toLowerCase() === word.translation.toLowerCase();
        inp.removeEventListener('keypress', h);
        window.dashboard.answerQuiz(ok);
      }
    };
    inp.addEventListener('keypress', h);
  }
  if (mode === 'audio') {
    tts.play(word.word, 'en-US');
    audioBtn.onclick = () => tts.play(word.word, 'en-US');
  }
  document.getElementById('quiz-feedback').style.display = 'none';
  document.getElementById('btn-quiz-next').style.display = 'none';
  startQuizTimer();
}

function showQuizResult() {
  const container = document.getElementById('quiz-container');
  const score = window.dashboard._quizScore;
  const total = window.dashboard._quizWords.length;
  const pct = Math.round((score / total) * 100);
  container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;background:rgba(15,23,42,0.9);border:2px solid rgba(56,189,248,0.2);border-radius:25px">
            <div style="font-size:64px;margin-bottom:20px">${pct >= 80 ? '🏆' : pct >= 60 ? '🥈' : '🎯'}</div>
            <h2 style="color:white;margin-bottom:10px">Quiz Finalizado!</h2>
            <div style="font-size:28px;font-weight:800;color:#38bdf8;margin-bottom:8px">Pontos: ${window.dashboard._quizPoints}</div>
            <div style="font-size:16px;color:#94a3b8;margin-bottom:28px">Acertos: ${score} / ${total} (${pct}%)</div>
            <button id="retryQuizBtn" class="btn btn-accent">🔄 Tentar Novamente</button>
        </div>`;
  document.getElementById('retryQuizBtn').addEventListener('click', initQuiz);
}

async function loadListening() {
  const content = document.getElementById('listeningContent');
  if (!content) return;
  try {
    const sentences = await lfDb.getAllSentences();
    if (!sentences.length) {
      content.innerHTML = `<div class="empty"><div class="empty-icon">🎧</div><div class="empty-text">Nenhuma frase salva</div><div class="empty-sub">Salve frases de vídeos para começar a imersão</div></div>`;
      return;
    }
    const sentence = sentences[Math.floor(Math.random() * sentences.length)];
    const text = sentence.original || sentence.phrase_text;
    content.innerHTML = `
            <div class="immersion-card">
                <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:20px">Modo Imersão (Método Natural)</div>
                <div class="immersion-text blurred" id="blur-text">${text}</div>
                <div class="immersion-controls">
                    <button class="imm-btn" id="play-imm">🔊</button>
                    <button class="imm-btn" id="toggle-blur">👁️</button>
                    <button class="imm-btn" id="next-imm">⏭️</button>
                </div>
                <div style="max-width:500px;margin:0 auto">
                    <input type="text" class="input-field" id="writing-input" placeholder="Digite o que você ouviu..." style="width:100%;margin-bottom:10px">
                    <div style="display:flex;gap:8px">
                        <button class="btn btn-primary" id="check-writing" style="flex:1">Verificar</button>
                        <button class="btn btn-ghost" id="show-hint">Dica</button>
                    </div>
                    <div id="writing-feedback" style="margin-top:14px;font-weight:700;display:none"></div>
                </div>
            </div>`;
    const blurEl = document.getElementById('blur-text');
    const inputEl = document.getElementById('writing-input');
    const feedbackEl = document.getElementById('writing-feedback');
    document.getElementById('play-imm').addEventListener('click', () => {
      tts.play(text, 'en-US');
      inputEl.focus();
    });
    document
      .getElementById('toggle-blur')
      .addEventListener('click', () => blurEl.classList.toggle('blurred'));
    document.getElementById('next-imm').addEventListener('click', loadListening);
    document.getElementById('check-writing').addEventListener('click', () => {
      const answer = inputEl.value
        .trim()
        .toLowerCase()
        .replace(/[.,!?;:]/g, '');
      const correct = text
        .trim()
        .toLowerCase()
        .replace(/[.,!?;:]/g, '');
      feedbackEl.style.display = 'block';
      if (answer === correct) {
        feedbackEl.style.color = '#4ade80';
        feedbackEl.textContent = '✨ Perfeito! Você ouviu corretamente.';
        blurEl.classList.remove('blurred');
      } else {
        feedbackEl.style.color = '#ef4444';
        feedbackEl.textContent = '❌ Quase lá... tente ouvir novamente.';
      }
    });
    document.getElementById('show-hint').addEventListener('click', () => {
      inputEl.placeholder = `Dica: ${text
        .split(' ')
        .map((w) => w[0] + '_'.repeat(w.length - 1))
        .join(' ')}`;
    });
    inputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') document.getElementById('check-writing').click();
    });
    tts.play(text, 'en-US');
  } catch {}
}

// ============================================================================
// CONFIGURAÇÕES
// ============================================================================
async function loadConfig() {
  const s = async (k, id, def) => {
    const val = await lfDb.getSetting(k);
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? val : def;
  };
  await s('newCardsPerDay', 'cfg-new-limit', 20);
  await s('cefrTargetLevel', 'cfg-cefr-level', 'none');

  await s('learning_steps', 'cfg-learning-steps', '1 10');
  await s('new_order', 'cfg-new-order', 'newest');
  await s('reviewsPerDay', 'cfg-rev-limit', 100);
  await s('easy_bonus', 'cfg-easy-bonus', 130);
  await s('interval_modifier', 'cfg-int-mod', 100);
  await s('initial_ease', 'cfg-ease-factor', 250);
  await s('graduating_interval', 'cfg-grad-int', 1);
  await s('easy_interval', 'cfg-easy-int', 4);
  await s('max_interval', 'cfg-max-int', 36500);
  await s('lapse_modifier', 'cfg-lapse-mod', 50);
  await s('leech_threshold', 'cfg-leech-threshold', 8);
  await s('leech_action', 'cfg-leech-action', 'tag');
  await s('grok_api_key', 'cfg-grok-key', '');

  const elColors = document.getElementById('cfg-cefr-colors');
  if (elColors) {
    let cefrColors = await lfDb.getSetting('cefrColorsEnabled');
    elColors.value = cefrColors !== false ? 'on' : 'off'; // default true
  }

  // Sincroniza chave para chrome.storage.local (acessível pelo service worker)
  const existingKey = await lfDb.getSetting('grok_api_key');
  if (existingKey) await chrome.storage.local.set({ aiApiKey: existingKey });
}

function _ipaToPhoneticBR(ipa) {
  if (!ipa) return '';
  let s = ipa.replace(/[\/\[\]ˈˌː.]/g, '').toLowerCase();
  const map = {
    aɪ: 'ái',
    eɪ: 'êi',
    ɔɪ: 'ói',
    aʊ: 'áu',
    oʊ: 'ôu',
    əʊ: 'ôu',
    æ: 'é',
    ɑ: 'á',
    ɒ: 'ó',
    ɔ: 'ó',
    ɛ: 'é',
    ɜ: 'âr',
    ɪ: 'i',
    ʌ: 'ã',
    ʊ: 'u',
    ə: 'â',
    ʧ: 'tch',
    dʒ: 'dj',
    ʃ: 'ch',
    ʒ: 'j',
    θ: 'f',
    ð: 'd',
    ŋ: 'ng',
    j: 'i',
    w: 'u',
    ɹ: 'r',
  };
  for (const [k, v] of Object.entries(map)) s = s.split(k).join(v);
  return s.replace(/([bcdfghjklmnpqrstvwxyz])\1+/g, '$1');
}

async function migratePhoneticsBR() {
  const btn = document.getElementById('btn-migrate-phonetics');
  const status = document.getElementById('migrate-phonetics-status');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Migrando...';
  }

  const words = await lfDb.getAllWords();
  const toMigrate = words.filter((w) => !w.pronunciation_pt && w.phonetic);
  let done = 0;

  for (const w of toMigrate) {
    const pt = _ipaToPhoneticBR(w.phonetic);
    if (pt) {
      await lfDb.saveWord({ ...w, pronunciation_pt: pt });
      done++;
    }
  }

  const msg =
    done > 0
      ? `✅ ${done} palavra${done > 1 ? 's' : ''} atualizada${done > 1 ? 's' : ''}`
      : 'Nada para migrar — tudo já atualizado';
  if (status) status.textContent = msg;
  if (btn) {
    btn.textContent = '🇧🇷 Migrar fonética BR para palavras antigas';
    btn.disabled = false;
  }
  showToast(msg, 'success');
}

async function saveAllConfig() {
  const btn = document.getElementById('save-all-config');
  if (!btn) return;
  btn.textContent = '⏳ Salvando...';
  btn.disabled = true;
  const g = (id) => document.getElementById(id)?.value || '';
  const n = (id) => parseInt(g(id)) || 0;
  try {
    await Promise.all([
      lfDb.setSetting('newCardsPerDay', n('cfg-new-limit')),
      lfDb.setSetting('cefrTargetLevel', g('cfg-cefr-level')),

      lfDb.setSetting('cefrColorsEnabled', g('cfg-cefr-colors') === 'on'),

      lfDb.setSetting('learning_steps', g('cfg-learning-steps')),
      lfDb.setSetting('new_order', g('cfg-new-order')),
      lfDb.setSetting('reviewsPerDay', n('cfg-rev-limit')),
      lfDb.setSetting('easy_bonus', n('cfg-easy-bonus')),
      lfDb.setSetting('interval_modifier', n('cfg-int-mod')),
      lfDb.setSetting('initial_ease', n('cfg-ease-factor')),
      lfDb.setSetting('graduating_interval', n('cfg-grad-int')),
      lfDb.setSetting('easy_interval', n('cfg-easy-int')),
      lfDb.setSetting('max_interval', n('cfg-max-int')),
      lfDb.setSetting('lapse_modifier', n('cfg-lapse-mod')),
      lfDb.setSetting('leech_threshold', n('cfg-leech-threshold')),
      lfDb.setSetting('leech_action', g('cfg-leech-action')),
      lfDb.setSetting('grok_api_key', g('cfg-grok-key')),
    ]);
    showToast('Configurações salvas com sucesso!', 'success');
    btn.textContent = '✅ Salvo!';
    btn.style.background = '#10b981';
  } catch (e) {
    btn.textContent = '❌ Erro ao Salvar';
    btn.style.background = '#ef4444';
    showToast('Erro ao salvar configurações', 'error');
  }
  setTimeout(() => {
    btn.textContent = 'Salvar Alterações';
    btn.style.background = '';
    btn.disabled = false;
  }, 2000);
}

async function testAiConnection() {
  const key = document.getElementById('cfg-grok-key')?.value || '';
  const resEl = document.getElementById('test-ai-result');
  const btn = document.getElementById('test-ai-key');
  if (!key) {
    if (resEl) {
      resEl.style.display = 'block';
      resEl.style.background = 'rgba(239,68,68,0.1)';
      resEl.style.color = '#ef4444';
      resEl.textContent = '⚠️ Insira uma chave de API primeiro.';
    }
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Testando...';
  }
  if (resEl) {
    resEl.style.display = 'block';
    resEl.style.background = 'rgba(255,255,255,0.05)';
    resEl.style.color = '#94a3b8';
    resEl.textContent = 'Conectando...';
  }
  await lfDb.setSetting('grok_api_key', key);
  await chrome.storage.local.set({ aiApiKey: key });
  try {
    chrome.runtime.sendMessage(
      { action: 'ai_explain_word', word: 'Hello', context: 'Hello, world!' },
      (response) => {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Testar Conexão';
        }
        if (response?.explanation && !response.explanation.includes('Erro')) {
          if (resEl) {
            resEl.style.background = 'rgba(16,185,129,0.1)';
            resEl.style.color = '#10b981';
            resEl.innerHTML = `✅ <b>Conexão OK!</b><br>"${response.explanation.substring(0, 80)}..."`;
          }
        } else {
          if (resEl) {
            resEl.style.background = 'rgba(239,68,68,0.1)';
            resEl.style.color = '#ef4444';
            resEl.innerHTML = `❌ <b>Falha</b><br>${response?.error || 'Chave inválida ou sem quota'}`;
          }
        }
      },
    );
  } catch (e) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Testar Conexão';
    }
  }
}

// ============================================================================
// EXPORTAÇÃO PARA ANKI (3 formatos)
// ============================================================================
async function exportToAnki() {
  const modal = document.getElementById('modalExport');
  if (!modal) return;
  const decks = await lfDb.getAllDecks();
  const exportDeckSel = document.getElementById('export-deck-select');
  if (exportDeckSel) {
    exportDeckSel.innerHTML =
      `<option value="">Todos os decks</option>` +
      decks.map((d) => `<option value="${d.id}">${d.name}</option>`).join('');
  }
  modal.classList.add('open');
}

async function doExport() {
  const format = document.querySelector('.export-opt.selected')?.dataset.format || 'txt';
  const deckId = document.getElementById('export-deck-select')?.value;
  const template = document.getElementById('export-template')?.value || 'word';
  const btn = document.getElementById('do-export-btn');

  let words = await lfDb.getAllWords();
  if (deckId) words = words.filter((w) => String(w.deck_id) === String(deckId));
  if (!words.length) {
    showToast('Nenhuma palavra para exportar', 'error');
    return;
  }

  if (btn) {
    btn.textContent = '⏳ Gerando...';
    btn.disabled = true;
  }

  try {
    if (format === 'txt') {
      // Formato tab-separado do Anki
      const lines = words.map((w) => {
        let front = w.word,
          back = w.translation || '';
        if (template === 'cloze' && w.context_sentence) {
          front = w.context_sentence.replace(
            new RegExp(
              `(?<![\\wÀ-ÖØ-öø-ÿ])(${w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![\\wÀ-ÖØ-öø-ÿ])`,
              'gi',
            ),
            '{{c1::$1}}',
          );
        } else if (template === 'translation') {
          [front, back] = [back, front];
        }
        const phonetic = w.pronunciation_pt ? `🇧🇷 ${w.pronunciation_pt}` : w.phonetic || '';
        const tags = (
          Array.isArray(w.tags)
            ? w.tags
            : (w.tags || '')
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
        ).join(' ');
        return [front, back, w.context_sentence || '', phonetic, tags, w.level || ''].join('\t');
      });
      const content =
        '#separator:tab\n#html:false\n#notetype:Basic\n#deck:LinguaFlow\n' + lines.join('\n');
      downloadFile(
        content,
        `linguaflow-anki-${new Date().toISOString().split('T')[0]}.txt`,
        'text/plain',
      );
      showToast(`${words.length} cards exportados como .txt`, 'success');
    } else if (format === 'anki-advanced') {
      await exportAnkiTxtAdvanced(words, template);
      showToast(`${words.length} cards exportados no formato avançado do Anki`, 'success');
    } else if (format === 'json') {
      const decks = await lfDb.getAllDecks();
      const logs = (await lfDb.getAllReviewLogs) ? await lfDb.getAllReviewLogs() : [];
      const backup = {
        version: 5,
        exportedAt: new Date().toISOString(),
        data: { words, decks, logs },
      };
      const content = JSON.stringify(backup, null, 2);
      downloadFile(
        content,
        `linguaflow-backup-${new Date().toISOString().split('T')[0]}.json`,
        'application/json',
      );
      showToast(`Backup JSON completo gerado com sucesso!`, 'success');
    } else if (format === 'csv') {
      const rows = [['Word', 'Translation', 'Context', 'Level', 'Tags', 'Explanation', 'Status']];
      words.forEach((w) =>
        rows.push([
          escapeCsv(w.word),
          escapeCsv(w.translation || ''),
          escapeCsv(w.context_sentence || ''),
          w.level || '',
          escapeCsv(w.tags || ''),
          escapeCsv((w.explanation || '').replace(/\n/g, ' ')),
          w.status || 'new',
        ]),
      );
      const content = rows.map((r) => r.join(',')).join('\n');
      downloadFile(
        content,
        `linguaflow-export-${new Date().toISOString().split('T')[0]}.csv`,
        'text/csv;charset=utf-8;',
      );
      showToast(`${words.length} palavras exportadas como .csv`, 'success');
    } else if (format === 'pdf') {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showToast('Erro: Popup bloqueado. Permita popups no navegador para gerar o PDF.', 'error');
        return;
      }

      let html = `
                <html>
                <head>
                    <title>LinguaFlow - Lista de Estudos</title>
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
                        h1 { color: #0ea5e9; text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
                        .word-item { border-bottom: 1px dashed #cbd5e1; padding: 15px 0; page-break-inside: avoid; }
                        .word-header { display: flex; justify-content: space-between; align-items: baseline; }
                        .word { font-size: 18px; font-weight: bold; color: #0f172a; }
                        .translation { font-size: 16px; color: #0284c7; font-weight: 600; }
                        .context { font-style: italic; color: #475569; margin-top: 5px; }
                        .explanation { font-size: 14px; color: #64748b; margin-top: 8px; background: #f8fafc; padding: 10px; border-radius: 6px; }
                        .meta { font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-top: 6px; }
                        @media print {
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; }
                        }
                    </style>
                </head>
                <body>
                    <h1>📚 LinguaFlow - Lista de Estudos</h1>
                    <p style="text-align:center; color:#64748b; margin-bottom: 30px;">Gerado em ${new Date().toLocaleDateString()}</p>
            `;

      words.forEach((w) => {
        html += `<div class="word-item">`;
        html += `<div class="word-header">`;
        html += `  <span class="word">${w.word}</span>`;
        html += `  <span class="translation">${w.translation || ''}</span>`;
        html += `</div>`;
        if (w.pronunciation_pt)
          html += `<div style="font-family:monospace;color:#b45309;font-weight:700;font-size:14px;margin-top:2px">🇧🇷 ${w.pronunciation_pt}</div>`;
        else if (w.phonetic)
          html += `<div style="font-family:monospace;color:#6b7280;font-size:12px;margin-top:2px">${w.phonetic}</div>`;
        if (w.context_sentence) html += `<div class="context">"${w.context_sentence}"</div>`;
        if (w.explanation)
          html += `<div class="explanation">${w.explanation.replace(/\n/g, '<br>')}</div>`;

        const meta = [];
        if (w.tags) meta.push(`Tags: ${w.tags}`);
        if (w.level) meta.push(`Nível: ${w.level}`);
        if (meta.length > 0) html += `<div class="meta">${meta.join(' | ')}</div>`;

        html += `</div>`;
      });

      html += `</body></html>`;
      printWindow.document.write(html);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.print();
      }, 300);

      showToast(`${words.length} palavras preparadas para PDF/Impressão.`, 'success');
    }
    document.getElementById('modalExport').classList.remove('open');
  } catch (e) {
    console.error(e);
    showToast('Erro ao exportar: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.textContent = '⬇️ Baixar Arquivo';
      btn.disabled = false;
    }
  }
}

async function exportAnkiTxtAdvanced(words, template) {
  // Gera um .txt avançado otimizado para importação direta no Anki
  // Inclui tags, contextualizações HTML e explicações da IA.
  const now = Math.floor(Date.now() / 1000);
  const lines = words.map((w, i) => {
    let front = w.word,
      back = w.translation || '';
    if (template === 'cloze' && w.context_sentence) {
      front = w.context_sentence.replace(
        new RegExp(
          `(?<![\\wÀ-ÖØ-öø-ÿ])(${w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![\\wÀ-ÖØ-öø-ÿ])`,
          'gi',
        ),
        `<b style="color:blue">[$1]</b>`,
      );
    } else if (template === 'translation') {
      [front, back] = [back, front];
    }
    const phoneticLine = w.pronunciation_pt
      ? `<div style="color:#b45309;font-family:monospace;font-weight:700;font-size:14px">🇧🇷 ${w.pronunciation_pt}</div>`
      : w.phonetic
        ? `<div style="color:#6b7280;font-size:12px">${w.phonetic}</div>`
        : '';
    const extra = [
      phoneticLine,
      w.context_sentence ? `<i style="color:#475569">"${w.context_sentence}"</i>` : '',
      w.explanation
        ? `<small style="color:#64748b">${w.explanation.substring(0, 200)}</small>`
        : '',
    ]
      .filter(Boolean)
      .join('<br>');
    const tags = (
      Array.isArray(w.tags)
        ? w.tags
        : (w.tags || '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
    ).join(' ');
    return `${front}\t${back}${extra ? '\t' + extra : ''}\t${tags}`;
  });
  const content =
    '#separator:tab\n#html:true\n#notetype:Basic (and reversed card)\n#deck:LinguaFlow\n#tags column:4\n' +
    lines.join('\n');
  downloadFile(content, `linguaflow-${new Date().toISOString().split('T')[0]}.txt`, 'text/plain');
}

function escapeCsv(str) {
  if (!str) return '';
  const s = String(str);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ============================================================================
// IMPORTAÇÃO DO ANKI (.txt tab-separado)
// ============================================================================
let _importData = [];

function resetImportModal() {
  _importData = [];
  document.getElementById('import-preview-wrap').style.display = 'none';
  document.getElementById('import-drop-zone').style.display = 'block';
  document.getElementById('import-file-input').value = '';
}

function parseAnkiTxt(content) {
  const lines = content.split('\n');
  const notes = [];
  let separator = '\t';
  for (const line of lines) {
    if (line.startsWith('#separator:')) {
      if (line.includes('tab')) separator = '\t';
      else if (line.includes(';')) separator = ';';
      else if (line.includes(',')) separator = ',';
    }
    if (line.startsWith('#')) continue;
    if (!line.trim()) continue;
    const parts = line.split(separator);
    if (parts.length >= 2) {
      notes.push({
        front: parts[0]?.trim() || '',
        back: parts[1]?.trim() || '',
        extra: parts[2]?.trim() || '',
        tags: parts[3]?.trim() || '',
      });
    }
  }
  return notes;
}

async function doImport() {
  if (!_importData.length) return;
  const btn = document.getElementById('do-import-btn');
  const deckId = parseInt(document.getElementById('import-deck-select')?.value || '1');
  if (btn) {
    btn.textContent = '⏳ Importando...';
    btn.disabled = true;
  }
  let imported = 0;
  try {
    for (const note of _importData) {
      if (!note.front) continue;
      await lfDb.saveWord({
        word: note.front,
        translation: note.back,
        context_sentence: note.extra || '',
        tags: note.tags || '',
        deck_id: deckId,
        lang: 'en',
        status: 'new',
      });
      imported++;
    }
    showToast(`${imported} notas importadas com sucesso!`, 'success');
    document.getElementById('modalImport').classList.remove('open');
    resetImportModal();
    updateHeader();
    loadCards();
  } catch (e) {
    showToast('Erro ao importar: ' + e.message, 'error');
  } finally {
    if (btn) {
      btn.textContent = `✅ Importar ${_importData.length} notas`;
      btn.disabled = false;
    }
  }
}

// ============================================================================
// NAVEGAÇÃO
// ============================================================================
function switchTab(tab) {
  document.querySelectorAll('.content-section').forEach((s) => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
  const section = document.getElementById(`${tab}-section`);
  const btn = document.querySelector(`.nav-tab[data-tab="${tab}"]`);
  if (section) section.classList.add('active');
  if (btn) btn.classList.add('active');
  window.location.hash = tab;
  setTimeout(async () => {
    if (tab === 'home') await loadHome();
    else if (tab === 'study') await loadStudy();
    else if (tab === 'library') await loadLibrary();
    else if (tab === 'lab') await loadLab();
    else if (tab === 'chunks') await loadChunks();
    else if (tab === 'progresso') await loadStats();
    else if (tab === 'config') await loadConfig();
    else if (tab === 'moonshot-feed') await loadMoonshotFeed();
    else if (tab === 'moonshot-voice') await loadMoonshotVoice();
    else if (tab === 'catalogue') await loadCatalogue();
  }, 10);
}

// ============================================================================
// EXPORTAÇÃO DE CHUNKS
// ============================================================================
function exportChunksCSV() {
  if (!allChunks || allChunks.length === 0) {
    showToast('Nenhum chunk para exportar.', 'error');
    return;
    return;
  }
  const header = 'Inglês,Português,Fonética,Data de Adição\n';
  const rows = allChunks
    .map((c) => {
      const eng = `"${(c.eng || '').replace(/"/g, '""')}"`;
      const pt = `"${(c.pt || '').replace(/"/g, '""')}"`;
      const phon = `"${(c.phon || '').replace(/"/g, '""')}"`;
      const d = new Date(c.created_at || Date.now()).toLocaleDateString();
      return `${eng},${pt},${phon},${d}`;
    })
    .join('\n');

  const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `linguaflow_chunks_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportChunksPDF() {
  if (!allChunks || allChunks.length === 0) {
    showToast('Nenhum chunk para exportar.', 'error');
    return;
    return;
  }

  let html = `
        <html>
        <head>
            <title>Meus Chunks - LinguaFlow</title>
            <style>
                body { font-family: sans-serif; color: #111827; padding: 20px; line-height: 1.5; }
                h1 { border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; }
                .chunk-row { border-bottom: 1px solid #e2e8f0; padding: 15px 0; page-break-inside: avoid; }
                .eng { font-size: 18px; font-weight: bold; color: #0f172a; margin-bottom: 4px; }
                .pt { font-size: 16px; color: #475569; margin-bottom: 4px; }
                .phon { font-size: 14px; color: #d97706; font-style: italic; }
            </style>
        </head>
        <body>
            <h1>Meus Chunks - LinguaFlow</h1>
            <p>Total: ${allChunks.length} chunks salvos.</p>
    `;

  allChunks.forEach((c) => {
    html += `
            <div class="chunk-row">
                <div class="eng">${c.eng}</div>
                <div class="pt">${c.pt}</div>
                ${c.phon ? `<div class="phon">${c.phon}</div>` : ''}
            </div>
        `;
  });

  html += `</body></html>`;

  const printWin = window.open('', '_blank');
  if (printWin) {
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 500);
  } else {
    showToast('Permita pop-ups nesta página para gerar o PDF.', 'error');
    return;
  }
}

// ============================================================================
// INIT
// ============================================================================
async function init() {
  console.debug('🚀 LinguaFlow Dashboard v2 iniciando...');

  // Theme toggle
  const theme = localStorage.getItem('lf-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  const tt = document.getElementById('themeToggle');
  if (tt) { tt.textContent = theme === 'light' ? '🌙' : '☀️'; tt.onclick = () => { const n = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', n); localStorage.setItem('lf-theme', n); tt.textContent = n === 'light' ? '🌙' : '☀️'; }; }

  try {
    await lfDb.initPromise;

    // ── Supabase Auth — login obrigatório ──────────────────────────────────
    try {
      const { supabaseAuth } = await import('./supabase-auth.js');
      const isLoggedIn = await supabaseAuth.init();

      if (!isLoggedIn) {
        showLoginScreen(supabaseAuth);
        return;
      }

      // Sync em background — não bloqueia o dashboard
      document.getElementById('lf-cloud-status').textContent = 'Conectado';
      supabaseAuth.syncUp(lfDb).catch(() => {});
      supabaseAuth.syncDown(lfDb).catch(() => {});
      document.getElementById('lf-cloud-login-btn').textContent = '☁️ Sair';
      document.getElementById('lf-cloud-login-btn').onclick = async () => {
        await supabaseAuth.logout();
        location.reload();
      };
      window._supabaseAuth = supabaseAuth;
    } catch (e) {
      console.debug('[LinguaFlow] Cloud sync não disponível:', e.message);
      document.getElementById('lf-cloud-status').textContent = 'Offline';
    }

    // Navegação
    document.querySelectorAll('.nav-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) switchTab(tab);
      });
    });

    // Export / Import Anki
    document.getElementById('exportAnkiBtn')?.addEventListener('click', exportToAnki);
    document.getElementById('importAnkiBtn')?.addEventListener('click', () => {
      const m = document.getElementById('modalImport');
      if (m) m.classList.add('open');
    });
    // Hidden file input for direct Anki import
    document.getElementById('ankiImportInput')?.addEventListener('change', (e) => {
      if (e.target.files[0]) {
        const m = document.getElementById('modalImport');
        if (m) m.classList.add('open');
        processImportFile(e.target.files[0]);
      }
    });

    // Opções de formato do export
    document.querySelectorAll('.export-opt').forEach((opt) => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.export-opt').forEach((o) => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });
    document.getElementById('do-export-btn')?.addEventListener('click', doExport);

    // Import modal
    const dropZone = document.getElementById('import-drop-zone');
    const fileInput = document.getElementById('import-file-input');
    dropZone?.addEventListener('click', () => fileInput?.click());
    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) processImportFile(file);
    });
    fileInput?.addEventListener('change', (e) => {
      if (e.target.files[0]) processImportFile(e.target.files[0]);
    });
    document.getElementById('do-import-btn')?.addEventListener('click', doImport);

    function processImportFile(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        _importData = parseAnkiTxt(e.target.result);
        if (!_importData.length) {
          showToast('Arquivo sem dados reconhecíveis', 'error');
          return;
        }
        document.getElementById('import-drop-zone').style.display = 'none';
        document.getElementById('import-preview-wrap').style.display = 'block';
        document.getElementById('import-count-label').textContent =
          `${_importData.length} notas encontradas em "${file.name}"`;
        document.getElementById('import-btn-count').textContent = _importData.length;
        const preview = document.getElementById('import-preview');
        preview.innerHTML = _importData
          .slice(0, 8)
          .map(
            (n) => `
                    <div class="import-row">
                        <span style="color:white;font-weight:700;flex:1">${n.front}</span>
                        <span style="color:#38bdf8;flex:1">${n.back}</span>
                        ${n.tags ? `<span class="tag-chip">${n.tags.split(' ').slice(0, 2).join(', ')}</span>` : ''}
                    </div>`,
          )
          .join('');
        if (_importData.length > 8)
          preview.innerHTML += `<div style="text-align:center;color:#64748b;padding:10px;font-size:12px">... e mais ${_importData.length - 8} notas</div>`;
      };
      reader.readAsText(file);
    }

    // Populate import deck select
    const decks = await lfDb.getAllDecks();
    const importSel = document.getElementById('import-deck-select');
    if (importSel)
      importSel.innerHTML = decks.map((d) => `<option value="${d.id}">${d.name}</option>`).join('');

    // Editor de notas — save
    document.getElementById('editor-save-btn')?.addEventListener('click', async () => {
      if (!_currentEditorWordId) return;
      const word = await lfDb.getWordById(_currentEditorWordId);
      if (!word) return;
      word.translation = document.getElementById('edit-translation')?.value || word.translation;
      word.context_sentence = document.getElementById('edit-context')?.value || '';
      word.explanation = document.getElementById('edit-explanation')?.value || '';
      word.deck_id = parseInt(document.getElementById('edit-deck')?.value || 1);
      word.tags = getEditorTags().join(',');
      await lfDb.saveWord(word);
      showToast('Nota salva com sucesso!', 'success');
      document.getElementById('modalWordEditor').classList.remove('open');
      loadCards();
      updateHeader();
    });

    document.getElementById('editor-play-btn')?.addEventListener('click', async () => {
      if (!_currentEditorWordId) return;
      const word = await lfDb.getWordById(_currentEditorWordId);
      if (word) tts.play(word.word, 'en-US');
    });

    document.getElementById('editor-delete-btn')?.addEventListener('click', async () => {
      if (!_currentEditorWordId) return;
      if (!confirm('Excluir esta palavra permanentemente? Esta ação não pode ser desfeita.'))
        return;
      await lfDb.deleteWord(Number(_currentEditorWordId));
      showToast('Palavra excluída', 'success');
      document.getElementById('modalWordEditor').classList.remove('open');
      loadCards();
      updateHeader();
    });

    // Tags input — Enter para adicionar
    document.getElementById('tag-input-field')?.addEventListener('keydown', (e) => {
      const input = e.target;
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const tag = input.value.trim().replace(',', '');
        if (!tag) return;
        const current = getEditorTags();
        if (!current.includes(tag)) {
          renderTagInputChips([...current, tag]);
        } else input.value = '';
      }
    });

    // Backup completo
    document.getElementById('exportFullBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('exportFullBtn');
      const orig = btn.textContent;
      btn.textContent = '⏳ Preparando...';
      try {
        const json = await lfDb.exportDatabase();
        downloadFile(
          json,
          `linguaflow-backup-${new Date().toISOString().split('T')[0]}.json`,
          'application/json',
        );
        await lfDb.setSetting('last_backup_date', new Date().toISOString());
        showToast('Backup salvo com sucesso!', 'success');
        // Hide warning if visible
        const warningEl = document.getElementById('home-backup-warning');
        if (warningEl) warningEl.style.display = 'none';
      } catch (e) {
        showToast('Erro ao fazer backup', 'error');
      }
      btn.textContent = orig;
    });

    document
      .getElementById('importFullBtn')
      ?.addEventListener('click', () => document.getElementById('backupInput')?.click());
    document.getElementById('backupInput')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const btn = document.getElementById('importFullBtn');
      btn.textContent = '⏳ Restaurando...';
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          await lfDb.importDatabase(ev.target.result);
          showToast('Backup restaurado! Recarregando...', 'success');
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          showToast('Erro ao restaurar backup', 'error');
          btn.textContent = '📤 Restaurar Backup';
        }
      };
      reader.readAsText(file);
    });

    // Config
    document.getElementById('save-all-config')?.addEventListener('click', saveAllConfig);
    document.getElementById('toggle-key-visibility')?.addEventListener('click', () => {
      const inp = document.getElementById('cfg-grok-key');
      if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
    });
    document.getElementById('test-ai-key')?.addEventListener('click', testAiConnection);

    // Cloud Sync — ambos os blocos usam o mesmo backup/restore
    const doCloudBackup = async (elId) => {
      const btn = document.getElementById(elId);
      if (!btn) return;
      const orig = btn.textContent;
      btn.textContent = '⏳ Preparando...';
      btn.disabled = true;
      try {
        const json = await lfDb.exportDatabase();
        downloadFile(
          json,
          `linguaflow-backup-${new Date().toISOString().split('T')[0]}.json`,
          'application/json',
        );
        await lfDb.setSetting('last_backup_date', new Date().toISOString());
        showToast('Backup salvo com sucesso!', 'success');
        const warningEl = document.getElementById('home-backup-warning');
        if (warningEl) warningEl.style.display = 'none';
        document.getElementById('cfg-sync-status').style.display = 'block';
        document.getElementById('cfg-sync-status').textContent = '✅ Backup concluído.';
        document.getElementById('sync-status-msg').textContent = '✅ Backup concluído.';
      } catch (e) {
        showToast('Erro ao fazer backup', 'error');
      }
      btn.textContent = orig;
      btn.disabled = false;
    };
    document
      .getElementById('btn-sync-up')
      ?.addEventListener('click', () => doCloudBackup('btn-sync-up'));
    document
      .getElementById('btn-sync-backup')
      ?.addEventListener('click', () => doCloudBackup('btn-sync-backup'));
    document
      .getElementById('btn-sync-down')
      ?.addEventListener('click', () => document.getElementById('backupInput')?.click());
    document
      .getElementById('btn-sync-restore')
      ?.addEventListener('click', () => document.getElementById('backupInput')?.click());

    // Moonshot Voice — Iniciar Conversa
    document.getElementById('moonshot-start-voice')?.addEventListener('click', async () => {
      const log = document.getElementById('moonshot-voice-log');
      const btn = document.getElementById('moonshot-start-voice');
      if (!log || !btn) return;
      log.style.display = 'block';
      log.innerHTML =
        '<div style="color:var(--text2);text-align:center;padding:20px">🎙️ Aguardando permissão do microfone...</div>';
      btn.textContent = '🟡 Conectando...';
      btn.disabled = true;
      try {
        // Verifica se tem API key
        const apiKey = await lfDb.getSetting('grok_api_key');
        if (!apiKey) {
          log.innerHTML =
            '<div style="color:#ef4444;text-align:center;padding:20px">⚠️ Configure sua chave de IA em Configurações primeiro.</div>';
          btn.textContent = '🟢 Iniciar Conversa';
          btn.disabled = false;
          return;
        }
        log.innerHTML =
          '<div style="color:#10b981;text-align:center;padding:20px">🟢 Microfone pronto! Fale algo em inglês...</div>';
        btn.textContent = '🔴 Encerrar';
        btn.disabled = false;
        btn.onclick = () => {
          log.innerHTML =
            '<div style="color:var(--text3);text-align:center;padding:20px">Conversa encerrada.</div>';
          btn.textContent = '🟢 Iniciar Conversa';
          btn.onclick = arguments.callee;
        };
      } catch (e) {
        log.innerHTML = `<div style="color:#ef4444;text-align:center;padding:20px">Erro: ${e.message}</div>`;
        btn.textContent = '🟢 Iniciar Conversa';
        btn.disabled = false;
      }
    });

    // Biblioteca — filtros
    document.getElementById('library-search')?.addEventListener('input', () => loadLibraryItems());
    document.getElementById('lib-filter-status')?.addEventListener('change', () => {
      libActiveStatus = document.getElementById('lib-filter-status').value;
      loadCards();
    });
    document.getElementById('lib-filter-deck')?.addEventListener('change', () => {
      libActiveDeck = document.getElementById('lib-filter-deck').value;
      loadCards();
    });
    document.getElementById('lib-sort')?.addEventListener('change', () => {
      libSortMode = document.getElementById('lib-sort').value;
      loadCards();
    });

    // Biblioteca — tabs
    document.getElementById('lib-tab-words')?.addEventListener('click', () => {
      document.getElementById('lib-tab-words').classList.add('active');
      document.getElementById('lib-tab-phrases').classList.remove('active');
      document.getElementById('lib-tab-decks')?.classList.remove('active');
      loadLibraryItems();
    });
    document.getElementById('lib-tab-phrases')?.addEventListener('click', () => {
      document.getElementById('lib-tab-phrases').classList.add('active');
      document.getElementById('lib-tab-words').classList.remove('active');
      document.getElementById('lib-tab-decks')?.classList.remove('active');
      loadLibraryItems();
    });
    document.getElementById('lib-tab-decks')?.addEventListener('click', () => {
      document.getElementById('lib-tab-decks').classList.add('active');
      document.getElementById('lib-tab-words').classList.remove('active');
      document.getElementById('lib-tab-phrases').classList.remove('active');
      loadLibraryItems();
    });

    // Seleção múltipla
    document.getElementById('toggle-select-mode')?.addEventListener('click', () => {
      libSelectMode = !libSelectMode;
      libSelectedIds.clear();
      const btn = document.getElementById('toggle-select-mode');
      btn.textContent = libSelectMode ? '✖ Cancelar Seleção' : '☑️ Selecionar';
      updateBulkBar();
      loadCards();
    });

    document.getElementById('bulk-cancel')?.addEventListener('click', () => {
      libSelectMode = false;
      libSelectedIds.clear();
      document.getElementById('toggle-select-mode').textContent = '☑️ Selecionar';
      updateBulkBar();
      loadCards();
    });

    document.getElementById('bulk-delete')?.addEventListener('click', async () => {
      if (!libSelectedIds.size) return;
      const count = libSelectedIds.size;
      if (!confirm(`Excluir ${count} palavras permanentemente?`)) return;
      for (const id of libSelectedIds) await lfDb.deleteWord(Number(id));
      libSelectedIds.clear();
      updateBulkBar();
      showToast(`${count} palavras excluídas`, 'success');
      loadCards();
      updateHeader();
    });

    document.getElementById('bulk-move-deck')?.addEventListener('click', async () => {
      if (!libSelectedIds.size) return;
      const deckId = parseInt(document.getElementById('bulk-deck-select').value);
      await lfDb.bulkUpdateDeck([...libSelectedIds], deckId);
      libSelectedIds.clear();
      updateBulkBar();
      showToast('Palavras movidas com sucesso!', 'success');
      loadCards();
    });

    // Busca global
    document.getElementById('globalSearch')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const activeSection = document.querySelector('.content-section.active')?.id;
      if (activeSection === 'library-section') {
        const libSearch = document.getElementById('library-search');
        if (libSearch) {
          libSearch.value = q;
          loadLibraryItems();
        }
      } else if (q.length > 1) {
        switchTab('library');
        setTimeout(() => {
          const ls = document.getElementById('library-search');
          if (ls) {
            ls.value = q;
            loadLibraryItems();
          }
        }, 100);
      }
    });

    // Lab
    document.getElementById('start-quiz-btn')?.addEventListener('click', () => {
      document.getElementById('lab-selection').style.display = 'none';
      document.getElementById('quiz-area').style.display = 'block';
      initQuiz();
    });
    document.getElementById('start-listening-btn')?.addEventListener('click', () => {
      document.getElementById('lab-selection').style.display = 'none';
      document.getElementById('listening-area').style.display = 'block';
      loadListening();
    });
    document.getElementById('back-to-lab-quiz')?.addEventListener('click', () => loadLab());
    document.getElementById('back-to-lab-list')?.addEventListener('click', () => loadLab());

    // Deck na Home
    document.getElementById('home-deck-search')?.addEventListener('input', loadHomeDecks);
    document.getElementById('home-create-deck-btn')?.addEventListener('click', async () => {
      const name = prompt('Nome do novo deck:');
      if (name?.trim()) {
        await lfDb.createDeck(name.trim());
        loadHomeDecks();
        showToast('Deck criado!', 'success');
      }
    });

    // Modo cego
    document.getElementById('toggleBlindMode')?.addEventListener('click', () => {
      isBlindMode = !isBlindMode;
      const btn = document.getElementById('toggleBlindMode');
      if (btn) {
        btn.textContent = `🎧 Cego: ${isBlindMode ? 'ON' : 'OFF'}`;
        btn.style.background = isBlindMode ? 'rgba(56,189,248,0.25)' : 'rgba(255,255,255,0.06)';
      }
      if (document.getElementById('study-section')?.classList.contains('active')) showCard();
    });

    // Home — Começar agora
    document.getElementById('start-study-btn')?.addEventListener('click', () => switchTab('study'));

    // Modal fechamento — click fora
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });

    // Populate bulk deck select
    const bulkSel = document.getElementById('bulk-deck-select');
    if (bulkSel)
      bulkSel.innerHTML = decks.map((d) => `<option value="${d.id}">${d.name}</option>`).join('');

    const dictUpload = document.getElementById('cfg-dict-upload');
    if (dictUpload) {
      dictUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const status = document.getElementById('cfg-dict-status');
        status.style.display = 'block';
        status.style.color = 'var(--text3)';
        status.textContent = 'Lendo arquivo JSON...';

        try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (!Array.isArray(data)) throw new Error('JSON deve ser um array de dicionários.');
          status.textContent = `Processando ${data.length} termos... aguarde (isso pode travar a tela).`;

          // Allow UI to update
          await new Promise((r) => setTimeout(r, 50));

          const result = await offlineDict.addDictionary(data);
          status.style.color = 'var(--green)';
          status.textContent = `✅ Sucesso! ${result.count} termos importados no Dicionário Offline.`;
        } catch (err) {
          status.style.color = 'var(--red)';
          status.textContent = '❌ Erro: ' + err.message;
        }
        e.target.value = ''; // reset
      });
    }

    await updateHeader();

    // Auto-sync: verifica backup na nuvem ao iniciar
    try {
      const lastBackup = await lfDb.getSetting('last_backup_date');
      const lastSyncCheck = await lfDb.getSetting('last_sync_check');
      const now = new Date().toISOString();

      // Verifica a cada 24h no máximo
      if (!lastSyncCheck || Date.now() - new Date(lastSyncCheck).getTime() > 86400000) {
        await lfDb.setSetting('last_sync_check', now);

        // Se nunca fez backup, sugere fazer
        if (!lastBackup) {
          const warningEl = document.getElementById('home-backup-warning');
          if (warningEl) {
            warningEl.style.display = 'flex';
            warningEl.innerHTML = `
              <span style="font-size:24px">☁️</span>
              <div style="flex:1">
                <b style="color:#38bdf8;display:block;margin-bottom:2px;font-size:14px">Nuvem não configurada</b>
                Seus dados estão salvos apenas localmente. Faça backup para não perder seu progresso.
              </div>`;
          }
        }
      }
    } catch (e) {
      /* sync check não é crítico */
    }

    const hash = window.location.hash.replace('#', '');
    if (
      [
        'home',
        'study',
        'library',
        'lab',
        'chunks',
        'progresso',
        'config',
        'moonshot-feed',
        'moonshot-voice',
        'catalogue',
      ].includes(hash)
    )
      switchTab(hash);
    else switchTab('home');
  } catch (e) {
    console.error('Erro na inicialização:', e);
    switchTab('home');
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

// ============================================================================
// MOONSHOT LOGIC (BETA)
// ============================================================================

// --- Dynamic N+1 Feed ---
async function loadMoonshotFeed() {
  const feedArea = document.getElementById('moonshot-feed-content');
  if (!feedArea) return;
  feedArea.style.display = 'block';
  feedArea.innerHTML = `
        <div style="text-align:center; padding:40px 20px;">
            <div style="font-size:48px; margin-bottom:16px;">📰</div>
            <h3 style="color:white; font-size:18px; margin-bottom:12px;">Feed de Leitura N+1</h3>
            <p style="color:var(--text2); font-size:14px; margin-bottom:24px;">Clique no botão acima para gerar um artigo personalizado baseado no seu vocabulário.</p>
            <div style="background:rgba(168,85,247,0.1); border:1px solid rgba(168,85,247,0.2); border-radius:12px; padding:20px; text-align:left; max-width:500px; margin:0 auto;">
                <div style="font-size:12px; color:var(--text3); font-weight:700; text-transform:uppercase; margin-bottom:8px;">Como funciona</div>
                <ul style="color:var(--text2); font-size:13px; line-height:1.8; padding-left:20px;">
                    <li>A IA analisa seu vocabulário atual</li>
                    <li>Gera um texto com palavras que você conhece + algumas novas (N+1)</li>
                    <li>Você lê e clica em palavras desconhecidas para salvá-las</li>
                </ul>
            </div>
        </div>`;
}

async function loadMoonshotVoice() {
  // UI já está no HTML, apenas garante que a seção está visível
  const log = document.getElementById('moonshot-voice-log');
  if (log) log.style.display = 'none';
}

async function loadCatalogue() {
  const container = document.getElementById('catalogue-content');
  if (!container) return;
  try {
    const { CATALOGUE } = await import('./catalogue.js');
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const colors = {
      A1: '#4ade80',
      A2: '#22d3ee',
      B1: '#facc15',
      B2: '#fb923c',
      C1: '#f472b6',
      C2: '#c084fc',
    };

    container.innerHTML = levels
      .map((lv) => {
        const data = CATALOGUE[lv];
        if (!data) return '';
        const channelsHtml = data.channels
          .map(
            (ch) => `
                <a href="${ch.url}" target="_blank" style="text-decoration:none;color:inherit;display:block;padding:12px 16px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;transition:all 0.2s;margin-bottom:8px"
                   onmouseenter="this.style.borderColor='${colors[lv]}';this.style.background='rgba(255,255,255,0.06)'"
                   onmouseleave="this.style.borderColor='';this.style.background='rgba(255,255,255,0.03)'">
                    <div style="font-weight:700;color:white;font-size:14px;margin-bottom:4px">📺 ${ch.title}</div>
                    <div style="font-size:12px;color:var(--text2)">${ch.desc}</div>
                </a>
            `,
          )
          .join('');
        const videosHtml =
          data.videos && data.videos.length
            ? data.videos
                .map(
                  (v) => `
                <a href="${v.url}" target="_blank" style="text-decoration:none;color:inherit;display:block;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:8px;transition:all 0.2s;margin-bottom:6px"
                   onmouseenter="this.style.borderColor='${colors[lv]}'"
                   onmouseleave="this.style.borderColor='rgba(255,255,255,0.05)'">
                    <div style="font-weight:600;color:var(--accent);font-size:13px;margin-bottom:3px">🎬 ${v.title}</div>
                    <div style="font-size:11px;color:var(--text3)">${v.desc}</div>
                </a>
            `,
                )
                .join('')
            : '';
        return `
                <div style="margin-bottom:28px;border-left:3px solid ${colors[lv]};padding-left:16px">
                    <h3 style="color:white;font-size:18px;font-weight:800;margin-bottom:4px">
                        <span style="background:${colors[lv]};color:#000;padding:2px 10px;border-radius:6px;font-size:14px;margin-right:8px">${lv}</span>${data.label}
                    </h3>
                    <p style="color:var(--text3);font-size:13px;margin-bottom:16px">${data.description}</p>
                    <div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px">📺 Canais Recomendados</div>
                    ${channelsHtml}
                    ${videosHtml ? `<div style="font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin:14px 0 10px">🎬 Vídeos em Destaque</div>${videosHtml}` : ''}
                </div>`;
      })
      .join('');
  } catch (e) {
    container.innerHTML = `<div style="color:#ef4444;padding:20px">Erro ao carregar catálogo: ${e.message}</div>`;
  }
}

const moonshotGenerateFeed = document.getElementById('moonshot-generate-feed');
if (moonshotGenerateFeed) {
  moonshotGenerateFeed.addEventListener('click', async () => {
    const feedArea = document.getElementById('moonshot-feed-content');
    feedArea.style.display = 'block';
    moonshotGenerateFeed.textContent = '⏳ Analisando seu vocabulário e gerando...';
    moonshotGenerateFeed.disabled = true;

    const words = await lfDb.getAllWords();
    const knownWords = words
      .filter((w) => w.status !== 'new')
      .map((w) => w.word)
      .slice(0, 30); // Pega uma amostra do que ele sabe

    chrome.runtime.sendMessage(
      {
        action: 'lf_generate_variation',
        word: 'article',
        sentence: `Write a very short, engaging 3-paragraph article in English about Technology or Travel. Use simple words but include 2 or 3 slightly advanced words. The user knows these words: ${knownWords.join(', ')}.`,
      },
      (res) => {
        moonshotGenerateFeed.textContent = '🪄 Gerar Outro Artigo';
        moonshotGenerateFeed.disabled = false;
        if (res && res.data) {
          const text = res.data.replace(/\n/g, '<br>');
          feedArea.innerHTML = `<h3 style="color:var(--accent); margin-bottom:16px;">Sua Leitura do Dia</h3><p>${text}</p><div style="margin-top:20px; font-size:14px; color:var(--text3);">Dica: Selecione qualquer palavra desconhecida para traduzir e salvar!</div>`;
        } else {
          feedArea.innerHTML =
            '<div style="color:#ef4444;">Erro ao gerar texto. Verifique a API Key.</div>';
        }
      },
    );
  });
}

// ============================================================================
// LISTENER DE MENSAGENS DO EXTENSION
// ============================================================================
chrome.runtime.onMessage.addListener((request) => {
  if (['REFRESH_VOCAB', 'WORD_SAVED', 'REFRESH_DASHBOARD'].includes(request.type)) {
    window.dashboard.refreshDashboard();
  }
  return false;
});
