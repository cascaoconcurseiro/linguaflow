import { db as lfDb, createOperationId } from '../../../utils/db.js';
import { playNaturalAudio, stopAudio, downloadAudio } from '../core/tts.js';
import { aiChat, aiChatStream, getCefrLevel, grammarTutorPersona, grammarInitialQuestion, enrichCard, generateChunksWeb, generateMnemonic } from '../core/ai.js';
import { attachVideoContext, renderVideoContext, getVideoContext } from '../core/videoContext.js';
import { buildSessionQueue, isWeakCard, prioritizeDueLearning } from '../core/sessionQueue.js';
import { loadVideo, playClip, replayClip, pausePlayer, setClipLoop, isClipPlaying, hidePlayer } from '../core/ytPlayer.js';
import { fetchTatoebaSentences } from '../core/tatoeba.js';

const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;

let dueQueue = [];
let pendingLearning = []; // cards em learning steps que voltam DENTRO da sessão
let currentCard = null;
let consecutiveCorrect = 0;
let sessionCards = 0;
let sessionXp = 0;
let sessionStart = Date.now();
let sessionCardIds = new Set();
let chatHistory = [];
let chatBusy = false;
let lastReview = null; // { prevCard, card, grade, isCorrect } para o undo
let reverseEnabled = false; // cartões reversos PT→EN (setting lf_reverse_cards)
let variedEnabled = true;   // exercícios variados: montar frase/ditado (lf_varied_exercises, ON por padrão)
let audioAutoFront = true;  // lf_audio_auto_front — agora respeitado de verdade
let audioAutoBack = true;   // lf_audio_auto_back
let ygWidget = null;
let ygQueuedWord = null;
let waitTimer = null;       // countdown da tela "aguardando learning steps"
let gradeBusy = false;      // impede duas avaliações concorrentes do mesmo card
const pendingReviewOperations = new Map(); // retry conserva id, nota e estado calculado
let cardMutationPromise = null; // sobrevive à troca de rota; evita refetch durante escrita
let studyViewGeneration = 0;
let studyViewActive = false;
const studyTimers = new Set();
const feedbackAudioContexts = new Set();
const cardPresentationIds = new WeakMap();
let nextCardPresentationId = 0;
let audioUiToken = 0;

const TOPIC_LABELS = { word: 'Palavras', phrasal: 'Phrasal Verbs', slang: 'Gírias', idiom: 'Expressões' };

function scheduleStudyTask(callback, delay = 0) {
  const generation = studyViewGeneration;
  const timer = setTimeout(() => {
    studyTimers.delete(timer);
    if (studyViewActive && generation === studyViewGeneration) callback();
  }, delay);
  studyTimers.add(timer);
  return timer;
}

export async function renderStudy(container, app, params = {}) {
  const viewGeneration = ++studyViewGeneration;
  studyViewActive = true;
  app.onLeaveView?.(() => {
    if (viewGeneration !== studyViewGeneration) return;
    studyViewActive = false;
    stopAudio();
    audioUiToken += 1;
    pauseYouglish();
    hidePlayer();
    setClipLoop(false);
    if (waitTimer) { clearInterval(waitTimer); waitTimer = null; }
    studyTimers.forEach(clearTimeout);
    studyTimers.clear();
    feedbackAudioContexts.forEach(ctx => { try { ctx.close(); } catch { /* já fechado */ } });
    feedbackAudioContexts.clear();
    if (window.currentKeydownHandler) {
      document.removeEventListener('keydown', window.currentKeydownHandler);
      window.currentKeydownHandler = null;
    }
    delete window.onYouglishAPIReady;
    ygQueuedWord = null;
    ygWidget = null;
    currentCard = null;
    chatHistory = [];
    chatBusy = false;
    exerciseApp = null;
    studyContainer = null;
  });
  injectStyles();
  consecutiveCorrect = 0;
  sessionCards = 0;
  sessionXp = 0;
  sessionStart = Date.now();
  lastReview = null;
  gradeBusy = !!cardMutationPromise;
  exerciseApp = app;
  studyContainer = container;
  ygWidget = null; // container será recriado
  hidePlayer(); // qualquer vídeo de uma sessão anterior não deve tocar ao fundo
  const topicFilter = params?.category || null; // Onda 2.2: "Revisar por tópico" vindo do Cofre
  const weakOnly = !!params?.weakOnly; // Onda 9: "Modo de estudo customizado" — revisar só palavras fracas/leech

  app.showToast('Carregando frases...', 'info');
  pendingLearning = [];
  let loadedQueue = [];
  if (waitTimer) { clearInterval(waitTimer); waitTimer = null; }
  // Se o usuário saiu e voltou enquanto uma nota/bury era persistida, aguarda a
  // escrita antes de buscar a fila. Sem isso, o refetch pode ressuscitar o card
  // com o estado anterior e permitir uma segunda avaliação concorrente.
  const pendingMutation = cardMutationPromise;
  if (pendingMutation) await pendingMutation.catch(() => null);
  if (!studyViewActive || viewGeneration !== studyViewGeneration) return;
  gradeBusy = false;
  try {
    const [reverseRaw, variedRaw, audioFrontRaw, audioBackRaw, srs] = await Promise.all([
      lfDb.getSetting('lf_reverse_cards').catch(() => null),
      lfDb.getSetting('lf_varied_exercises').catch(() => null),
      lfDb.getSetting('lf_audio_auto_front').catch(() => null),
      lfDb.getSetting('lf_audio_auto_back').catch(() => null),
      lfDb.getSRSSettings().catch(() => null),
    ]);
    reverseEnabled = reverseRaw === true || reverseRaw === 'true';
    variedEnabled = variedRaw === null || variedRaw === true || variedRaw === 'true';
    audioAutoFront = audioFrontRaw === null || audioFrontRaw === true || audioFrontRaw === 'true';
    audioAutoBack = audioBackRaw === null || audioBackRaw === true || audioBackRaw === 'true';

    if (weakOnly) {
      // Onda 9 (paridade "Custom Study" do Anki): remediação de palavras
      // fracas/leech IGNORA a cota diária de propósito — é prática extra,
      // não a fila normal — e ignora due_date (revisa mesmo sem estar
      // vencido ainda, porque o objetivo é atacar a fraqueza agora).
      const [allCards, allWords] = await Promise.all([lfDb.getAllCards(), lfDb.getAllWords()]);
      const wordById = {};
      (allWords || []).forEach(w => { wordById[w.id] = w; });
      const weakPool = (allCards || [])
        .filter(c => !c.suspended && isWeakCard(c) && wordById[c.word_id])
        .map(c => ({ ...c, wordData: wordById[c.word_id] }));
      loadedQueue = buildSessionQueue(weakPool, {});
    } else {
      const [counts, cards, diag] = await Promise.all([
        lfDb.getTodayCounts().catch(() => ({ reviewsToday: 0, newIntroducedToday: 0 })),
        lfDb.getCardsDue(200, true),
        lfDb.getDiagnosisData(30).catch(() => null),
      ]);
      // LIMITES DIÁRIOS REAIS (paridade Anki): "novas cartas/dia" corta os cards
      // novos além da cota; "revisões máx/dia" limita o tamanho da sessão.
      const newAllowed = Math.max(0, (srs?.newPerDay ?? 20) - counts.newIntroducedToday);
      const revAllowed = Math.max(0, (srs?.maxRevPerDay ?? 200) - counts.reviewsToday);
      let newSeen = 0;
      let reviewSeen = 0;
      // Onda 2.2: "Revisar por tópico" — filtra o pool ANTES da cota diária, que
      // continua sendo o mesmo orçamento global (é a mesma sessão de estudo,
      // só restrita a uma categoria).
      const topicPool = topicFilter
        ? (cards || []).filter(c => (c.wordData?.category || c.category) === topicFilter)
        : (cards || []);
      const limited = topicPool.filter(c => {
        if (c.suspended) return false;
        if (c.status === 'new') {
          newSeen++;
          return newSeen <= newAllowed;
        }
        // A cota de revisões não pode esconder cards novos. Learning também é
        // revisão em curso: ele deve continuar na sessão que o introduziu.
        if (c.status === 'learning') return true;
        reviewSeen++;
        return reviewSeen <= revAllowed;
      });
      // INTERLEAVING (Marco 2 + Onda 1.3): learning primeiro; fracas espaçadas;
      // novas espalhadas; e a categoria mais fraca do diagnóstico vem à frente.
      let priorityCategory = null;
      if (diag && diag.retentionByCategory) {
        const worst = Object.entries(diag.retentionByCategory)
          .filter(([, v]) => v.reviews >= 5 && v.retention !== null && v.retention < 80)
          .sort((a, b) => a[1].retention - b[1].retention)[0];
        if (worst) priorityCategory = worst[0];
      }
      loadedQueue = buildSessionQueue(limited, { priorityCategory });
    }
  } catch (e) {
    console.error('DB Error:', e);
    loadedQueue = [];
  }

  // A navegação pode ter mudado enquanto as consultas iniciais estavam em voo.
  // Uma view antiga nunca deve redesenhar ou reativar recursos ao terminar.
  if (!studyViewActive || viewGeneration !== studyViewGeneration) return;
  dueQueue = loadedQueue;
  sessionCardIds = new Set(dueQueue.map(card => card.id));
  publishFocusProgress(app);

  if (dueQueue.length === 0) {
    const topicLabel = topicFilter ? (TOPIC_LABELS[topicFilter] || topicFilter) : null;
    const emptyTitle = weakOnly ? 'Nenhuma palavra fraca agora 🎉' : (topicLabel ? `Nada de "${topicLabel}" pra revisar agora 🎉` : 'Tudo feito por hoje! 🎉');
    const emptyMsg = weakOnly ? 'Você não tem cards com 3+ erros ou marcados como leech no momento. Ótimo sinal!' : (topicLabel ? `Todos os cards de ${topicLabel} já estão em dia.` : 'Você revisou todas as suas frases pendentes.');
    container.innerHTML = `
      <div class="study-layout" style="display: flex; height: 100%; width: 100%; justify-content: center; align-items: center; background-color: var(--color-bg-alt);">
        <div class="study-main" style="text-align:center; padding: 60px; background: var(--color-surface); border-radius: var(--radius-lg); box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 2px solid var(--color-border);">
          <h2 style="color:var(--color-primary); font-size: 32px; margin-bottom:16px;">${emptyTitle}</h2>
          <p style="color:var(--color-text-light); font-size: 18px;">${emptyMsg}</p>
          ${(topicLabel || weakOnly) ? `<button class="btn btn-secondary" id="study-all-btn" style="margin-top:20px; padding: 14px 28px; font-size: 16px;">Estudar tudo</button>` : ''}
          <button class="btn btn-primary" id="back-home-btn" style="margin-top:12px; padding: 16px 32px; font-size: 18px;">Voltar ao Início</button>
        </div>
      </div>
    `;
    scheduleStudyTask(() => {
      document.getElementById('back-home-btn')?.addEventListener('click', () => app.navigate('home'));
      document.getElementById('study-all-btn')?.addEventListener('click', () => app.navigate('study'));
    }, 0);
    return;
  }

  container.innerHTML = `
    <div class="study-layout" role="main" aria-label="Sessão de estudo">
      <!-- Main Study Area -->
      <div class="study-main" tabindex="-1">
        <div id="study-status" class="sr-only" role="status" aria-live="polite"></div>

        <div class="media-container">
          <div class="audio-wave-placeholder" id="audio-wave">
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <button class="btn-play-audio" id="play-audio-btn" aria-label="Ouvir a frase">▶</button>
            <span id="audio-status" class="sr-only" role="status" aria-live="polite"></span>
          </div>
        </div>

        <div class="sentence-container">
          <div class="sentence-text" id="pump-sentence">Carregando...</div>
          <div id="pump-phonetics" style="font-size: 18px; color: var(--color-secondary); font-style: italic; margin-top: 12px;" class="hidden"></div>
          <div id="pump-translation" style="font-size: 20px; font-weight: 700; color: var(--color-text); margin-top: 12px; padding-top: 12px; border-top: 2px dashed var(--color-border);" class="hidden"></div>

          <button id="reveal-btn" class="btn btn-primary reveal-btn">Revelar (Espaço)</button>
        </div>

        <!-- Anki Grading Buttons -->
        <div class="grading-buttons hidden" id="grading-area">
          <div class="grading-row">
            <button class="grade-btn btn-danger" data-grade="1" aria-label="Errei; agendar novamente"><span aria-hidden="true">Errei</span><br><span id="grade-ivl-1" style="font-size:12px;opacity:0.8">…</span></button>
            <button class="grade-btn btn-warning" data-grade="2" aria-label="Difícil; agendar com intervalo curto"><span aria-hidden="true">Difícil</span><br><span id="grade-ivl-2" style="font-size:12px;opacity:0.8">…</span></button>
            <button class="grade-btn btn-secondary" data-grade="3" aria-label="Bom; agendar no intervalo recomendado"><span aria-hidden="true">Bom</span><br><span id="grade-ivl-3" style="font-size:12px;opacity:0.8">…</span></button>
            <button class="grade-btn btn-primary" data-grade="4" aria-label="Fácil; agendar com intervalo longo"><span aria-hidden="true">Fácil</span><br><span id="grade-ivl-4" style="font-size:12px;opacity:0.8">…</span></button>
          </div>
        </div>

        <!-- Shadowing Engine Overlay -->
        <div id="shadowing-overlay" class="hidden" style="margin-top: 24px; padding: 16px; background: rgba(88, 204, 2, 0.1); border: 2px dashed var(--color-primary); border-radius: var(--radius-md); text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; animation: pulse 2s infinite;">
          <div style="font-size: 24px; margin-bottom: 8px;">⏳</div>
          <div style="font-size: 18px; font-weight: 800; color: var(--color-primary);">Sua vez... Fale em voz alta!</div>
          <div style="width: 100%; background: var(--color-border); height: 6px; border-radius: 3px; margin-top: 12px; overflow: hidden;">
            <div id="shadowing-progress" style="width: 0%; height: 100%; background: var(--color-primary); transition: width 3s linear;"></div>
          </div>
        </div>

        <!-- Tudo que ajuda a aprofundar continua disponível, mas não compete
             com recordar e avaliar. A gaveta só aparece após a resposta. -->
        <aside class="study-explore" aria-label="Recursos adicionais do card">
        <details id="study-resources" class="study-resources hidden">
          <summary><span>Explorar esta frase</span><span aria-hidden="true">⌄</span></summary>
          <div class="study-resources-content">
        ${(topicFilter || weakOnly) ? `
        <div class="study-session-context">
          <span>${topicFilter ? `🧭 Tópico: <strong>${TOPIC_LABELS[topicFilter] || topicFilter}</strong>` : '🔎 Prática de palavras fracas'}</span>
          <button id="clear-topic-filter-btn">Voltar à revisão completa</button>
        </div>` : ''}
        <div class="study-card-actions">
          <button id="btn-undo" style="display:none">↩️ Desfazer última (Z)</button>
          <button id="improve-btn" class="hidden">✨ Gerar uma frase melhor</button>
          <button id="bury-btn" title="Adia este card para amanhã sem afetar o agendamento">💤 Deixar pra amanhã</button>
        </div>

        <details id="tutor-details" class="study-tutor">
          <summary class="sidebar-title">🎓 Perguntar ao tutor <span>(abrir)</span></summary>
          <div id="grammar-chat">
            <div id="grammar-messages" role="log" aria-live="polite">
              <div class="chat-bubble-ai chat-placeholder">Só respondo quando você perguntar. 😉 Manda sua dúvida sobre a frase.</div>
            </div>
            <form id="grammar-form">
              <input id="grammar-input" type="text" placeholder="Revele o card primeiro…" aria-label="Pergunte sua dúvida sobre a frase" autocomplete="off" maxlength="140" disabled />
              <button type="submit" id="grammar-send" aria-label="Enviar pergunta" disabled>➤</button>
            </form>
          </div>
        </details>

        <section id="video-resource-section" class="explore-section hidden" aria-labelledby="video-resource-title">
          <h3 id="video-resource-title" class="sidebar-title">Trecho original 🎬</h3>
          <div id="saved-video-context" class="study-video-context"></div>
          <div id="study-yt-mount" class="hidden" aria-label="Trecho do vídeo salvo"></div>
        </section>

        <div id="isolated-word-box" class="hidden" style="margin-bottom: 28px; padding: 24px; background: var(--color-surface); border: 2px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-align:center;">
          <div style="font-size: 28px; font-weight: 900; color: var(--color-primary); margin-bottom: 8px;" id="iso-word"></div>
          <div style="font-size: 18px; color: var(--color-text); font-weight: 700; margin-bottom: 8px;" id="iso-trans"></div>
          <div style="font-size: 14px; color: var(--color-secondary); font-style: italic; background: rgba(28, 176, 246, 0.1); padding: 4px 12px; border-radius: 16px; display: inline-block;" id="iso-phonetics"></div>
          <div id="iso-mnemonic-box" style="margin-top:14px; text-align:left;">
            <button id="iso-mnemonic-btn" style="background:none; border:none; color:var(--color-secondary); font-family:var(--font-main); font-weight:800; font-size:13px; cursor:pointer; text-decoration:underline;">💡 Me dá um truque pra lembrar</button>
            <div id="iso-mnemonic-text" class="hidden" style="margin-top:8px; font-size:13px; color:var(--color-text); background:rgba(255,200,0,0.12); border:1px solid var(--color-warning); border-radius:8px; padding:10px 12px; line-height:1.5;"></div>
          </div>
        </div>

        <h3 class="sidebar-title">Nativos falando 📺</h3>
        <div id="youglish-box" class="hidden">
          <button id="yg-load-btn" class="btn btn-secondary" style="width:100%; padding:10px; font-size:13px;">▶ Ver nativos falando esta palavra</button>
          <div id="yg-widget-embed"></div>
          <a id="youglish-fallback" href="#" target="_blank" rel="noopener" class="hidden" style="color: var(--color-secondary); font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; margin-top: 8px;">📺 Abrir no YouGlish</a>
        </div>

        <h3 class="sidebar-title" style="margin-top:32px;">Frases reais (Tatoeba) 📚</h3>
        <div id="tatoeba-box">
          <button id="tatoeba-load-btn" class="btn btn-secondary" style="width:100%; padding:10px; font-size:13px;">🔎 Ver exemplos de falantes reais</button>
          <div id="tatoeba-list" class="hidden"></div>
        </div>

        <h3 class="sidebar-title" style="margin-top:32px;">Frases úteis (Chunks) ✨</h3>
        <div class="chunks-list" id="chunks-container"></div>
          </div>
        </details>
        </aside>
      </div>
    </div>
  `;

  document.getElementById('play-audio-btn').addEventListener('click', playCurrentAudio);
  document.getElementById('reveal-btn').addEventListener('click', revealCard);
  document.getElementById('improve-btn').addEventListener('click', () => improveSentence(app));
  document.getElementById('clear-topic-filter-btn')?.addEventListener('click', () => app.navigate('study'));
  // Progressive disclosure é igual em qualquer tamanho de tela: recursos
  // auxiliares começam invisíveis e recolhidos até a resposta ser revelada.
  document.getElementById('study-resources').open = false;

  document.getElementById('grammar-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('grammar-input');
    const text = (input.value || '').trim();
    if (!text || chatBusy) return;
    input.value = '';
    sendGrammarQuestion(text);
  });

  document.querySelectorAll('.grade-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const grade = parseInt(e.currentTarget.dataset.grade);
      handleGrade(grade, app);
    });
  });

  document.getElementById('btn-undo')?.addEventListener('click', () => handleUndo(app));
  document.getElementById('bury-btn')?.addEventListener('click', () => buryCard(app));

  if (window.currentKeydownHandler) {
    document.removeEventListener('keydown', window.currentKeydownHandler);
  }
  window.currentKeydownHandler = handleKeydown;
  document.addEventListener('keydown', window.currentKeydownHandler);

  loadNextCard(app);
}

function handleKeydown(e) {
  const revealBtn = document.getElementById('reveal-btn');
  const gradingArea = document.getElementById('grading-area');

  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  if (e.code === 'Space') {
    e.preventDefault();
    if (revealBtn && !revealBtn.classList.contains('hidden') && !revealBtn.disabled) {
      revealBtn.click();
    } else if (gradingArea && !gradingArea.classList.contains('hidden')) {
      playCurrentAudio();
    }
  }

  if (gradingArea && !gradingArea.classList.contains('hidden')) {
    if (e.code === 'Digit1') document.querySelector('[data-grade="1"]:not(.hidden):not(:disabled)')?.click();
    if (e.code === 'Digit2') document.querySelector('[data-grade="2"]:not(.hidden):not(:disabled)')?.click();
    if (e.code === 'Digit3') document.querySelector('[data-grade="3"]:not(.hidden):not(:disabled)')?.click();
    if (e.code === 'Digit4') document.querySelector('[data-grade="4"]:not(.hidden):not(:disabled)')?.click();
  }

  // Ctrl+Z / tecla Z: desfazer última revisão (Anki-style)
  if ((e.code === 'KeyZ') && !e.shiftKey) {
    document.getElementById('btn-undo')?.click();
  }
}

// ── Normalização de chunks ───────────────────────────────────────────────────
// Aceita os formatos antigos ({eng|ingles|english, pt|portugues, phon|fonetica})
// e as entradas especiais novas: is_context (a frase do card) e is_word (a palavra).
function normChunk(c) {
  return {
    eng: c.eng || c.ingles || c.english || '',
    pt: c.pt || c.portugues || c.portuguese || '',
    phon: c.phon || c.fonetica || c.phonetics || '',
    is_context: !!c.is_context,
    is_word: !!c.is_word,
  };
}

function parseChunks(card) {
  const raw = (card.wordData && card.wordData.ai_chunks) || card.ai_chunks;
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr.map(normChunk).filter(c => c.eng) : [];
  } catch {
    return [];
  }
}

async function persistChunks(card, chunks, context, { updateRuntime = true } = {}) {
  if (!card.wordData) return;
  const aiChunks = JSON.stringify(chunks);
  const wordPayload = { ...card.wordData, ai_chunks: aiChunks };
  if (context) {
    wordPayload.context_sentence = context;
  }
  if (updateRuntime) {
    card.wordData.ai_chunks = aiChunks;
    card.ai_chunks = aiChunks;
    if (context) {
      card.wordData.context_sentence = context;
      card.context = context;
    }
  }
  await lfDb.saveWord(wordPayload).catch(console.error);
}

async function generateChunksForWord(word) {
  if (isExtension) {
    const res = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action: 'ai_generate_chunks', word }, (r) => resolve(r));
      } catch {
        resolve(null);
      }
    });
    if (res && Array.isArray(res.chunks)) return res.chunks.map(normChunk).filter(c => c.eng);
    return [];
  }
  try {
    const chunks = await generateChunksWeb(word);
    return chunks.map(normChunk).filter(c => c.eng);
  } catch (e) {
    console.warn('[Study] Falha ao gerar chunks na web:', e);
    return [];
  }
}

function looksBroken(context, word) {
  if (!context) return true;
  const c = context.trim();
  if (c.toLowerCase() === word.toLowerCase()) return true;
  return c.split(/\s+/).length < 3;
}

// ── Fila de sessão (paridade Anki) ───────────────────────────────────────────
// Cards em learning steps (intervalo em minutos) NÃO somem da sessão: voltam
// pra fila quando vencem. A sessão só termina de verdade quando não há mais
// nada vencido. Nunca antecipamos automaticamente um step: encurtar 10 min
// para alguns segundos destrói justamente o espaçamento que ele representa.

function promoteDuePending() {
  const now = Date.now();
  const ready = pendingLearning.filter(p => p.dueAt <= now);
  if (ready.length === 0) return;
  pendingLearning = pendingLearning.filter(p => p.dueAt > now);
  ready.sort((a, b) => a.dueAt - b.dueAt);
  dueQueue = prioritizeDueLearning(dueQueue, ready.map(p => p.card));
}

function publishFocusProgress(app) {
  const remainingIds = new Set([
    ...dueQueue.map(card => card.id),
    ...pendingLearning.map(entry => entry.card.id),
  ].filter(id => sessionCardIds.has(id)));
  const total = sessionCardIds.size;
  const remaining = remainingIds.size;
  const completed = Math.max(0, total - remaining);
  app.updateFocusStatus?.({
    total,
    completed,
    remaining,
  });
}

function renderSessionComplete(app) {
  if (window.currentKeydownHandler) {
    document.removeEventListener('keydown', window.currentKeydownHandler);
  }
  hidePlayer(); // a sessão acabou — nenhum vídeo deve continuar tocando ao fundo
  const sessionTime = Math.round((Date.now() - sessionStart) / 60000);
  const laterCount = pendingLearning.length;
  // BUG antigo: escrevia em #app-view, que não existe → caía no <body> e
  // destruía o app inteiro. Usa o container real da view de estudo.
  const rootContainer = studyContainer || document.getElementById('app-view') || document.body;
  rootContainer.innerHTML = `
    <div style="display:flex; height:100%; align-items:center; justify-content:center; background:var(--color-bg-alt);">
      <div style="text-align:center; padding:60px; background:var(--color-surface); border-radius:var(--radius-lg); border:2px solid var(--color-border); box-shadow:0 10px 40px rgba(0,0,0,0.08); max-width:500px;">
        <div style="font-size:64px; margin-bottom:16px;">🎉</div>
        <h2 style="color:var(--color-primary); font-size:32px; margin-bottom:8px;">Sessão Concluída!</h2>
        <p style="color:var(--color-text-light); margin-bottom:32px;">Continue assim e você será fluente!</p>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:${laterCount ? '16px' : '32px'};">
          <div style="background:var(--color-bg-alt); border-radius:var(--radius-md); padding:16px;">
            <div style="font-size:28px; font-weight:900; color:var(--color-text);">${sessionCards}</div>
            <div style="font-size:13px; color:var(--color-text-light);">Cartas</div>
          </div>
          <div style="background:rgba(88,204,2,0.1); border-radius:var(--radius-md); padding:16px;">
            <div style="font-size:28px; font-weight:900; color:var(--color-primary);" id="session-xp">+${sessionXp} XP</div>
            <div style="font-size:13px; color:var(--color-text-light);">XP confirmado</div>
          </div>
          <div style="background:rgba(28,176,246,0.1); border-radius:var(--radius-md); padding:16px;">
            <div style="font-size:28px; font-weight:900; color:var(--color-secondary);">${sessionTime}min</div>
            <div style="font-size:13px; color:var(--color-text-light);">Tempo</div>
          </div>
        </div>
        ${laterCount ? `<p style="font-size:13px; color:var(--color-text-light); margin-bottom:24px;">💤 ${laterCount} ${laterCount === 1 ? 'card em aprendizado volta' : 'cards em aprendizado voltam'} mais tarde — o agendamento continua valendo.</p>` : ''}
        <button id="session-done-btn" class="btn btn-primary" style="padding:16px 48px; font-size:18px;">Continuar →</button>
      </div>
    </div>
  `;
  scheduleStudyTask(() => {
    document.getElementById('session-done-btn')?.addEventListener('click', () => {
      if (window.currentKeydownHandler) document.removeEventListener('keydown', window.currentKeydownHandler);
      app.navigate('home');
    });
  }, 0);
}

// Tela de espera: há cards em learning voltando no futuro. Countdown real;
// quando zera, o card entra sozinho sem antecipar o step.
function renderWaitingScreen(app, nextAt) {
  const rootContainer = studyContainer || document.body;
  rootContainer.innerHTML = `
    <div style="display:flex; height:100%; align-items:center; justify-content:center; background:var(--color-bg-alt);">
      <div style="text-align:center; padding:60px; background:var(--color-surface); border-radius:var(--radius-lg); border:2px solid var(--color-border); max-width:500px;">
        <div style="font-size:56px; margin-bottom:16px;">⏳</div>
        <h2 style="color:var(--color-text); font-size:26px; margin-bottom:8px;">Cards em aprendizado</h2>
        <p style="color:var(--color-text-light); margin-bottom:8px;">${pendingLearning.length} ${pendingLearning.length === 1 ? 'card volta' : 'cards voltam'} em</p>
        <div id="wait-countdown" style="font-size:40px; font-weight:900; color:var(--color-primary); margin-bottom:24px;">--:--</div>
        <button id="wait-end-btn" class="btn btn-primary" style="padding:12px 24px;">Encerrar por hoje</button>
      </div>
    </div>
  `;
  const tick = () => {
    const ms = Math.max(0, nextAt - Date.now());
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    const el = document.getElementById('wait-countdown');
    if (el) el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (ms <= 0) {
      clearInterval(waitTimer); waitTimer = null;
      loadNextCard(app);
    }
  };
  waitTimer = setInterval(tick, 1000);
  tick();
  scheduleStudyTask(() => {
    document.getElementById('wait-end-btn')?.addEventListener('click', () => {
      if (waitTimer) { clearInterval(waitTimer); waitTimer = null; }
      renderSessionComplete(app);
    });
  }, 0);
}

// ── Fluxo do card ────────────────────────────────────────────────────────────
async function loadNextCard(app) {
  stopAudio();
  audioUiToken += 1;
  pauseYouglish();
  if (waitTimer) { clearInterval(waitTimer); waitTimer = null; }

  promoteDuePending();
  publishFocusProgress(app);

  if (dueQueue.length === 0) {
    if (pendingLearning.length > 0) {
      const nextAt = Math.min(...pendingLearning.map(p => p.dueAt));
      renderWaitingScreen(app, nextAt);
      return;
    } else {
      renderSessionComplete(app);
      return;
    }
  }

  currentCard = dueQueue[0];
  const card = currentCard;
  delete card._exerciseFinished;
  cardPresentationIds.set(card, ++nextCardPresentationId);
  chatHistory = [];

  // Reset UI
  const revealBtn = document.getElementById('reveal-btn');
  revealBtn.classList.remove('hidden');
  revealBtn.disabled = true;
  revealBtn.textContent = 'Revelar (Espaço)';

  document.getElementById('grading-area').classList.add('hidden');
  document.querySelectorAll('.grade-btn').forEach(btn => {
    btn.classList.remove('hidden');
    btn.disabled = false;
  });
  document.querySelector('.study-layout')?.classList.remove('is-revealed');
  const resources = document.getElementById('study-resources');
  resources?.classList.add('hidden');
  if (resources) resources.open = false;
  const tutorDetails = document.getElementById('tutor-details');
  if (tutorDetails) tutorDetails.open = false;
  const wave = document.getElementById('audio-wave');
  wave?.classList.remove('is-playing');
  const audioButton = document.getElementById('play-audio-btn');
  audioButton?.removeAttribute('aria-busy');
  const audioStatus = document.getElementById('audio-status');
  if (audioStatus) audioStatus.textContent = '';
  document.getElementById('pump-phonetics').classList.add('hidden');
  document.getElementById('pump-translation').classList.add('hidden');
  document.getElementById('isolated-word-box').classList.add('hidden');
  document.getElementById('saved-video-context').replaceChildren();
  document.getElementById('video-resource-section')?.classList.add('hidden');
  document.getElementById('study-yt-mount').classList.add('hidden');
  hidePlayer(); // troca de card: o vídeo do card anterior não deve tocar ao fundo
  document.getElementById('youglish-box').classList.add('hidden');
  document.getElementById('tatoeba-list').classList.add('hidden');
  document.getElementById('tatoeba-list').innerHTML = '';
  document.getElementById('tatoeba-load-btn').classList.remove('hidden');
  document.getElementById('tatoeba-load-btn').disabled = false;
  document.getElementById('tatoeba-load-btn').textContent = '🔎 Ver exemplos de falantes reais';
  document.getElementById('improve-btn').classList.add('hidden');
  document.getElementById('shadowing-overlay').classList.add('hidden');
  document.getElementById('shadowing-progress').style.width = '0%';
  document.getElementById('shadowing-progress').style.transition = 'none';
  document.getElementById('chunks-container').innerHTML = '';
  resetChat();

  const wordData = card.wordData || {};
  const word = wordData.word || card.word || 'Erro';

  let context = wordData.context_sentence || card.context || '';
  let chunks = parseChunks(card);

  // NÃO-BLOQUEANTE: o card aparece IMEDIATAMENTE com o que tem (era a demora
  // que restava — esperar a IA gerar chunks antes de mostrar). A geração roda
  // em segundo plano e atualiza a frente se o usuário ainda estiver no card.
  if (chunks.filter(c => !c.is_context && !c.is_word).length === 0 || looksBroken(context, word)) {
    generateChunksForWord(word).then(async (generated) => {
      if (currentCard !== card || generated.length === 0) return;

      const specials = (card._chunks || []).filter(c => c.is_context || c.is_word);
      let newChunks = [...specials, ...generated];
      let newContext = card._ctx;
      if (looksBroken(newContext, word)) {
        newContext = generated[0].eng;
        newChunks = newChunks.filter(c => !c.is_context);
        newChunks.unshift({ ...generated[0], is_context: true });
      }
      // O prompt exibido é imutável até a avaliação. O enriquecimento é salvo
      // para o próximo encontro com o card, mas não troca texto, chunks nem
      // dispara um segundo autoplay no meio da recordação atual.
      persistChunks(card, newChunks, newContext, { updateRuntime: false }).catch(() => {});
    }).catch(() => {});
  }

  if (!context) context = word;
  card._ctx = context;
  card._chunks = chunks;

  // Sorteio do tipo de exercício — só pra cards já graduados (card novo
  // aprende primeiro no modo clássico, produção vem depois, como no Anki/Duolingo)
  card._mode = 'classic';
  card._reverse = false;
  const graduated = card.status === 'review' || card.status === 'mature';
  if (graduated) {
    const wordCount = context.split(/\s+/).length;
    const canBuild = variedEnabled && wordCount >= 3 && wordCount <= 12;
    const canDictate = variedEnabled && wordCount >= 2 && wordCount <= 12;
    // PALAVRA FRACA → exercício de PRODUÇÃO (decisão do linguista: produzir
    // fixa mais que reconhecer — é o tratamento certo pra leech em formação).
    if (isWeakCard(card) && (canBuild || canDictate)) {
      card._mode = canBuild ? 'builder' : 'dictation';
    } else {
      const roll = Math.random();
      if (reverseEnabled && roll < 0.3) {
        card._mode = 'reverse';
        card._reverse = true;
      } else if (canBuild && roll < 0.55) {
        card._mode = 'builder';
      } else if (canDictate && roll < 0.75) {
        card._mode = 'dictation';
      }
    }
  }

  renderFront(card, word, context);
  const liveStatus = document.getElementById('study-status');
  if (liveStatus) {
    liveStatus.textContent = 'Novo card. Revele a resposta quando estiver pronto.';
  }
  // Reverso: o áudio EN entrega a resposta. Builder: entrega a ORDEM das palavras.
  // Ditado: o próprio renderFront toca (é o exercício).
  // lf_audio_auto_front agora é uma config REAL (antes o checkbox era enfeite).
  if (card._mode === 'classic' && audioAutoFront) playCurrentAudio();

  // Rótulos REAIS dos botões de nota: o intervalo que o FSRS vai aplicar de
  // verdade — os rótulos fixos antigos ("Bom = 3 dias") mentiam pro aluno.
  updateGradeLabels(card);
}

function formatInterval(ivl) {
  if (ivl == null || isNaN(ivl)) return '—';
  if (ivl < 1) return `${Math.max(1, Math.round(ivl * 1440))} min`;
  if (ivl < 30) return `${Math.round(ivl)} ${Math.round(ivl) === 1 ? 'dia' : 'dias'}`;
  if (ivl < 365) return `${(ivl / 30.4).toFixed(1).replace('.0', '')} mes.`;
  return `${(ivl / 365).toFixed(1).replace('.0', '')} ano${ivl >= 730 ? 's' : ''}`;
}

async function updateGradeLabels(card) {
  const { wordData, _chunks, ...clean } = card;
  const category = wordData?.category || null; // Onda 9: perfil de SRS por categoria
  try {
    const previews = await Promise.all([1, 2, 3, 4].map(g =>
      lfDb.predictNextState(clean, g, category).catch(() => null)
    ));
    if (currentCard !== card) return; // usuário já avançou
    // O estado calculado aqui é o que será persistido no clique. Assim o
    // intervalo visível e o salvo são o mesmo valor, sem um segundo sorteio.
    card._gradePreviews = previews;
    previews.forEach((state, i) => {
      const el = document.getElementById(`grade-ivl-${i + 1}`);
      if (el) el.textContent = formatInterval(state?.interval);
    });
  } catch { /* rótulos ficam em "…" — melhor que mentir */ }
}

function renderFront(card, word, context) {
  const sentenceEl = document.getElementById('pump-sentence');

  // Cartão reverso: frente em PORTUGUÊS, o aluno lembra o inglês
  if (card._reverse) {
    const ctxEntry = (card._chunks || []).find(c => c.is_context && c.pt);
    const pt = (ctxEntry && ctxEntry.pt) || (card.wordData && card.wordData.translation) || '';
    sentenceEl.innerHTML = `
      <div style="font-size:14px; font-weight:800; color:var(--color-secondary); margin-bottom:12px; text-transform:uppercase; letter-spacing:0.5px;">🇧🇷 → 🇺🇸 Como se diz em inglês?</div>
      <div>${pt || word}</div>`;
    document.getElementById('reveal-btn').disabled = false;
    return;
  }

  if (card._mode === 'builder') { renderBuilder(card, context); return; }
  if (card._mode === 'dictation') { renderDictation(card, context); return; }

  // Frente do card: frase com a palavra oculta. NADA de fonética ou tradução
  // aqui — qualquer pista revelaria a resposta (bug antigo).
  let clozeHtml;
  try {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    if (context.toLowerCase().includes(word.toLowerCase()) && context.toLowerCase() !== word.toLowerCase()) {
      clozeHtml = context.replace(regex, '<span class="cloze-blur">$1</span>');
    } else {
      clozeHtml = `<span class="cloze-blur">${word}</span>`;
    }
  } catch {
    clozeHtml = `<span class="cloze-blur">${word}</span>`;
  }
  sentenceEl.innerHTML = clozeHtml;

  const revealBtn = document.getElementById('reveal-btn');
  revealBtn.disabled = false;

}

// ── Exercícios ativos (montar frase / ditado) ────────────────────────────────
// Verificação objetiva sem avanço automático: erro confirma "Errei"; acerto
// devolve Difícil/Bom/Fácil para a autoavaliação do aluno. FSRS/undo continuam.

let exerciseApp = null; // referência do app pro auto-grade
let studyContainer = null; // container real da view (tela final escrevia no body)

function normalizeAnswer(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9' ]/g, '').replace(/\s+/g, ' ').trim();
}

function exerciseFinish(correct, context) {
  if (!currentCard || currentCard._exerciseFinished) return;
  currentCard._exerciseFinished = true;
  const sentenceEl = document.getElementById('pump-sentence');
  const feedback = correct
    ? `<div style="color:var(--color-primary); font-weight:900; font-size:22px; margin-bottom:12px;">✅ Perfeito!</div>`
    : `<div style="color:var(--color-danger); font-weight:900; font-size:22px; margin-bottom:12px;">A resposta era:</div>`;
  const nextInstruction = correct
    ? 'Como foi? Escolha Difícil, Bom ou Fácil para continuar.'
    : 'Confirme Errei para continuar.';
  sentenceEl.innerHTML = `${feedback}<div style="font-size:26px;">${context}</div><div class="exercise-grade-prompt">${nextInstruction}</div>`;
  const status = document.getElementById('study-status');
  if (status) status.textContent = correct
    ? 'Resposta correta. Escolha Difícil, Bom ou Fácil para continuar.'
    : 'Resposta incorreta. Avalie sua lembrança para continuar.';
  // Reutiliza o mesmo verso e a mesma avaliação FSRS dos cards clássicos. A
  // sessão nunca avança por timeout: a decisão continua nas mãos do aluno.
  revealCard();
  document.querySelectorAll('.grade-btn').forEach(btn => {
    const grade = Number(btn.dataset.grade);
    btn.classList.toggle('hidden', correct ? grade === 1 : grade !== 1);
  });
  scheduleStudyTask(() => document.querySelector('.grade-btn:not(.hidden):not(:disabled)')?.focus({ preventScroll: true }));
  if (correct) playCurrentAudio();
}

// Montar frase (word bank estilo Duolingo): tradução PT + chips EN embaralhados
function renderBuilder(card, context) {
  const sentenceEl = document.getElementById('pump-sentence');
  document.getElementById('reveal-btn').classList.add('hidden');

  const ctxEntry = (card._chunks || []).find(c => c.is_context && c.pt);
  const pt = (ctxEntry && ctxEntry.pt) || '';
  const tokens = context.replace(/[.!?,;:]+$/, '').split(/\s+/);
  const shuffled = [...tokens].sort(() => 0.5 - Math.random());

  sentenceEl.innerHTML = `
    <div style="font-size:14px; font-weight:800; color:var(--color-secondary); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">🧩 Monte a frase em inglês</div>
    ${pt ? `<div style="font-size:18px; color:var(--color-text-light); margin-bottom:16px;">"${pt}"</div>` : ''}
    <div id="ex-answer" role="status" aria-live="polite" aria-label="Sua resposta" style="min-height:52px; border-bottom:2px solid var(--color-border); margin-bottom:16px; display:flex; flex-wrap:wrap; gap:8px; justify-content:center; padding:8px;"></div>
    <div id="ex-bank" style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:16px;">
      ${shuffled.map((t, i) => `<button class="ex-chip" data-i="${i}" data-t="${t}">${t}</button>`).join('')}
    </div>
    <button id="ex-check" class="btn btn-primary" style="padding:12px 32px; font-size:15px;" disabled>Verificar</button>
  `;

  const answer = [];
  const answerEl = document.getElementById('ex-answer');
  const checkBtn = document.getElementById('ex-check');
  let wasComplete = false;

  function redraw() {
    answerEl.innerHTML = answer.map((a, idx) => `<button class="ex-chip ex-chip-used" data-idx="${idx}">${a.t}</button>`).join('');
    checkBtn.disabled = answer.length !== tokens.length;
    const complete = answer.length === tokens.length;
    if (complete && !wasComplete) checkBtn.focus({ preventScroll: true });
    wasComplete = complete;
  }

  document.getElementById('ex-bank').addEventListener('click', (e) => {
    const chip = e.target.closest('.ex-chip');
    if (!chip || chip.disabled) return;
    answer.push({ t: chip.dataset.t, bankBtn: chip });
    chip.disabled = true;
    chip.style.visibility = 'hidden';
    redraw();
  });

  answerEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.ex-chip-used');
    if (!chip) return;
    const [removed] = answer.splice(Number(chip.dataset.idx), 1);
    removed.bankBtn.disabled = false;
    removed.bankBtn.style.visibility = 'visible';
    redraw();
  });

  checkBtn.addEventListener('click', () => {
    const got = normalizeAnswer(answer.map(a => a.t).join(' '));
    const want = normalizeAnswer(tokens.join(' '));
    exerciseFinish(got === want, context);
  });
}

// Ditado (escute e escreva): áudio toca sozinho, usuário digita a frase
function renderDictation(card, context) {
  const sentenceEl = document.getElementById('pump-sentence');
  document.getElementById('reveal-btn').classList.add('hidden');

  sentenceEl.innerHTML = `
    <div style="font-size:14px; font-weight:800; color:var(--color-secondary); margin-bottom:16px; text-transform:uppercase; letter-spacing:0.5px;">🎧 Escute e escreva em inglês</div>
    <button id="ex-replay" class="btn btn-secondary" style="padding:10px 24px; font-size:14px; margin-bottom:16px;">🔊 Ouvir de novo</button>
    <label for="ex-input" class="sr-only">Digite a frase que você ouviu em inglês</label>
    <input id="ex-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Digite o que você ouviu…"
      style="width:100%; max-width:560px; padding:14px; font-size:18px; border:2px solid var(--color-border); border-radius:var(--radius-md); font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text); text-align:center;">
    <button id="ex-check" class="btn btn-primary" style="padding:12px 32px; font-size:15px; margin-top:16px;">Verificar</button>
  `;

  const play = () => playNaturalAudio(context, { lang: localStorage.getItem('lf_tts_lang') || 'en-US' });
  play();
  document.getElementById('ex-replay').addEventListener('click', play);

  const input = document.getElementById('ex-input');
  scheduleStudyTask(() => input.focus(), 100);
  const check = () => exerciseFinish(normalizeAnswer(input.value) === normalizeAnswer(context), context);
  document.getElementById('ex-check').addEventListener('click', check);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
}

async function improveSentence(app) {
  const card = currentCard;
  if (!card) return;
  const wordData = card.wordData || {};
  const word = wordData.word || card.word || '';

  const btn = document.getElementById('improve-btn');
  btn.disabled = true;
  btn.textContent = '✨ Gerando frase nova...';

  const generated = await generateChunksForWord(word);
  if (currentCard !== card) return;

  btn.disabled = false;
  btn.textContent = '✨ Frase estranha? Gerar uma melhor com IA';

  if (generated.length === 0) {
    app.showToast('Não consegui gerar uma frase agora. Tente de novo.', 'error');
    return;
  }

  const context = generated[0].eng;
  let chunks = (card._chunks || []).filter(c => !c.is_context && !c.is_word);
  chunks = [{ ...generated[0], is_context: true }, ...generated.slice(1), ...chunks];
  card._ctx = context;
  card._chunks = chunks;
  await persistChunks(card, chunks, context);

  btn.classList.add('hidden');
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  document.getElementById('pump-sentence').innerHTML = context.replace(
    new RegExp(`(${escapedWord})`, 'gi'),
    '<span class="cloze-revealed">$1</span>',
  );
  const ctxEntry = chunks.find(c => c.is_context) || generated[0];
  const wordEntry = chunks.find(c => c.is_word || c.eng?.toLowerCase() === word.toLowerCase());
  renderReveal(word, context, ctxEntry, wordEntry, wordData, card, { renderVideo: false });
  renderChunksList(chunks, context);
  // O trecho salvo pertence à frase anterior; escondê-lo evita ensinar uma
  // associação áudio/texto incorreta depois da substituição por IA.
  document.getElementById('video-resource-section')?.classList.add('hidden');
  hidePlayer();
  playCurrentAudio();
}

function playCurrentAudio() {
  if (!currentCard) return;
  const card = currentCard;
  const token = ++audioUiToken;
  const wordData = card.wordData || {};
  const textToPlay = card._ctx || wordData.context_sentence || wordData.word || card.word;

  const wave = document.getElementById('audio-wave');
  wave?.classList.add('is-playing');
  const button = document.getElementById('play-audio-btn');
  button?.setAttribute('aria-busy', 'true');
  const audioStatus = document.getElementById('audio-status');
  if (audioStatus) audioStatus.textContent = 'Reproduzindo a frase.';

  const playback = playNaturalAudio(textToPlay, { lang: localStorage.getItem('lf_tts_lang') || 'en-US' }, () => {
    if (token !== audioUiToken || currentCard !== card) return;
    const revealBtn = document.getElementById('reveal-btn');
    if (revealBtn && !revealBtn.classList.contains('hidden')) {
      const shadowingEl = document.getElementById('shadowing-overlay');
      const progressEl = document.getElementById('shadowing-progress');
      if (shadowingEl) {
        shadowingEl.classList.remove('hidden');
        void progressEl.offsetWidth;
        progressEl.style.transition = 'width 3s linear';
        progressEl.style.width = '100%';
        scheduleStudyTask(() => {
          if (token !== audioUiToken || currentCard !== card) return;
          shadowingEl.classList.add('hidden');
          progressEl.style.transition = 'none';
          progressEl.style.width = '0%';
        }, 3000);
      }
    }
  });
  Promise.resolve(playback)
    .then(completed => {
      if (token === audioUiToken && currentCard === card && audioStatus) {
        audioStatus.textContent = completed === false ? 'Não foi possível reproduzir o áudio.' : 'Áudio concluído.';
      }
    })
    .catch(() => {
      if (token === audioUiToken && currentCard === card && audioStatus) audioStatus.textContent = 'Não foi possível reproduzir o áudio.';
    })
    .finally(() => {
      if (token !== audioUiToken || currentCard !== card) return;
      wave?.classList.remove('is-playing');
      button?.removeAttribute('aria-busy');
    });
}

// ── Revelação (verso do card) ────────────────────────────────────────────────
async function revealCard() {
  const card = currentCard;
  if (!card) return;
  const wordData = card.wordData || {};
  const word = wordData.word || card.word || 'Erro';
  const context = card._ctx || word;
  let chunks = card._chunks || [];

  // 1. Revela a palavra na frase
  if (card._reverse) {
    // Reverso: a resposta é a frase em inglês inteira — mostra e toca o áudio agora
    const sentenceEl = document.getElementById('pump-sentence');
    try {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      sentenceEl.innerHTML = context.toLowerCase() !== word.toLowerCase()
        ? context.replace(regex, '<span class="cloze-revealed">$1</span>')
        : `<span class="cloze-revealed">${word}</span>`;
    } catch {
      sentenceEl.innerHTML = `<span class="cloze-revealed">${word}</span>`;
    }
    if (audioAutoBack) playCurrentAudio(); // lf_audio_auto_back: config real
  }
  document.querySelectorAll('.cloze-blur').forEach(el => {
    el.classList.remove('cloze-blur');
    el.classList.add('cloze-revealed');
  });

  document.getElementById('reveal-btn').classList.add('hidden');
  document.getElementById('improve-btn').classList.toggle('hidden', !looksBroken(context, word));
  document.getElementById('grading-area').classList.remove('hidden');
  document.querySelector('.study-layout')?.classList.add('is-revealed');
  document.getElementById('study-resources')?.classList.remove('hidden');
  scheduleStudyTask(() => document.querySelector('.grade-btn:not(.hidden):not(:disabled)')?.focus({ preventScroll: true }));

  // 2. Fonética e tradução DA FRASE DO CARD (não de outra frase — bug antigo)
  let ctxEntry = chunks.find(c => c.is_context && c.eng.toLowerCase() === context.toLowerCase())
    || chunks.find(c => !c.is_word && c.eng.toLowerCase() === context.toLowerCase());
  let wordEntry = chunks.find(c => c.is_word)
    || chunks.find(c => c.eng.toLowerCase() === word.toLowerCase());

  renderReveal(word, context, ctxEntry, wordEntry, wordData, card);
  renderChunksList(chunks, context);
  updateYouglish(word);
  updateTatoeba(word);
  startGrammarChat(card, word, context);

  // 3. Se faltar fonética/tradução da frase ou da palavra, gera UMA vez e persiste
  if (!ctxEntry || !wordEntry) {
    const phonEl = document.getElementById('pump-phonetics');
    phonEl.textContent = '🗣️ Gerando pronúncia...';
    phonEl.classList.remove('hidden');

    try {
      const data = await enrichCard(word, context);
      if (currentCard !== card || !data) return;

      if (!ctxEntry && data.sentence_phon) {
        ctxEntry = { eng: context, pt: data.sentence_pt || '', phon: data.sentence_phon, is_context: true, is_word: false };
        chunks = [ctxEntry, ...chunks.filter(c => !c.is_context)];
      }
      if (!wordEntry && data.word_phon) {
        wordEntry = { eng: word, pt: data.word_pt || '', phon: data.word_phon, is_context: false, is_word: true };
        chunks = [...chunks, wordEntry];
      }
      card._chunks = chunks;
      await persistChunks(card, chunks, null);
      if (currentCard !== card) return;

      // Atualiza apenas os dados textuais. Recriar controles de vídeo aqui
      // perderia o estado play/pause e deixaria o callback do iframe anterior
      // apontando para botões já removidos.
      renderReveal(word, context, ctxEntry, wordEntry, wordData, card, { renderVideo: false });
      renderChunksList(chunks, context);
    } catch (e) {
      if (currentCard === card) phonEl.classList.add('hidden');
      console.warn('[Study] Enriquecimento falhou:', e);
    }
  }
}

function renderReveal(word, context, ctxEntry, wordEntry, wordData, card, { renderVideo = true } = {}) {
  const presentationId = cardPresentationIds.get(card);
  const isCurrentPresentation = () => studyViewActive
    && currentCard === card
    && cardPresentationIds.get(card) === presentationId;
  const phonEl = document.getElementById('pump-phonetics');
  if (ctxEntry && ctxEntry.phon) {
    phonEl.textContent = `🗣️ ${ctxEntry.phon}`;
    phonEl.classList.remove('hidden');
  } else {
    phonEl.classList.add('hidden');
  }

  const transEl = document.getElementById('pump-translation');
  const sentencePt = (ctxEntry && ctxEntry.pt) || '';
  const fallbackPt = wordData.translation || card.translation || '';
  if (sentencePt || fallbackPt) {
    transEl.textContent = sentencePt || fallbackPt;
    transEl.classList.remove('hidden');
  }

  const isoBox = document.getElementById('isolated-word-box');
  document.getElementById('iso-word').textContent = word;
  document.getElementById('iso-trans').textContent = (wordEntry && wordEntry.pt) || wordData.translation || card.translation || '';
  const isoPhon = document.getElementById('iso-phonetics');
  if (wordEntry && wordEntry.phon) {
    isoPhon.textContent = `🗣️ Como falam: ${wordEntry.phon}`;
    isoPhon.style.display = 'inline-block';
  } else {
    isoPhon.style.display = 'none';
  }
  isoBox.classList.remove('hidden');

  // Onda 3.3: mnemônico por IA — gerado uma vez e salvo no card
  // (words.mnemonic), pra não custar uma chamada de IA toda vez que o
  // aluno reabre a mesma palavra.
  const mnemonicBtn = document.getElementById('iso-mnemonic-btn');
  const mnemonicText = document.getElementById('iso-mnemonic-text');
  mnemonicText.classList.add('hidden');
  mnemonicText.textContent = '';
  if (wordData.mnemonic) {
    mnemonicText.textContent = `💡 ${wordData.mnemonic}`;
    mnemonicText.classList.remove('hidden');
    mnemonicBtn.textContent = '💡 Gerar outro truque';
  } else {
    mnemonicBtn.textContent = '💡 Me dá um truque pra lembrar';
  }
  mnemonicBtn.onclick = async () => {
    mnemonicBtn.disabled = true;
    mnemonicBtn.textContent = 'Gerando…';
    try {
      const translation = (wordEntry && wordEntry.pt) || wordData.translation || card.translation || '';
      const mnemonic = await generateMnemonic(word, translation, context);
      mnemonicText.textContent = `💡 ${mnemonic}`;
      mnemonicText.classList.remove('hidden');
      mnemonicBtn.textContent = '💡 Gerar outro truque';
      if (wordData.id) {
        wordData.mnemonic = mnemonic;
        lfDb.updateWord(wordData.id, { mnemonic }).catch(() => {});
      }
    } catch (e) {
      console.warn('[Study] Mnemônico falhou:', e);
      exerciseApp?.showToast?.('Não consegui gerar um truque agora. Tente de novo.', 'error');
      mnemonicBtn.textContent = '💡 Me dá um truque pra lembrar';
    } finally {
      mnemonicBtn.disabled = false;
    }
  };

  if (!renderVideo) return;

  // Onda 2.5: player YouTube único e reutilizável — trocar de card troca só
  // o vídeo carregado (cueVideoById), nunca recria o iframe do zero.
  const videoContainer = document.getElementById('saved-video-context');
  const ytMount = document.getElementById('study-yt-mount');
  const vctx = getVideoContext(wordData.video_url, wordData);
  if (vctx && vctx.videoId) {
    document.getElementById('video-resource-section')?.classList.remove('hidden');
    const hasExactBounds = Number.isFinite(vctx.end) && vctx.end > vctx.start;
    const phraseWords = String(context || '').trim().split(/\s+/).filter(Boolean).length;
    const estimatedDuration = Math.min(14, Math.max(2.5, phraseWords / 2.4 + 0.8));
    // Cards antigos salvaram o momento do clique (geralmente perto do fim da
    // legenda), não os bounds da cue. Para eles reconstruímos uma janela curta
    // para trás e a marcamos como aproximada. Cards novos usam start/end exatos.
    const clipStart = hasExactBounds ? vctx.start : Math.max(0, vctx.start - estimatedDuration);
    const clipEnd = hasExactBounds ? vctx.end : Math.max(clipStart + 2.5, vctx.start + 0.35);
    const clipDuration = Math.max(1, Math.ceil(clipEnd - clipStart));
    const title = escapeHtml(wordData.video_title || 'vídeo de origem');
    const platform = escapeHtml(wordData.platform || 'YouTube');
    videoContainer.innerHTML = `
      <section class="video-context" aria-label="Contexto do vídeo">
        <span class="video-context-label">🎬 Salvo de ${platform}</span>
        <span class="video-context-title" title="${title}">${title}</span>
        <div class="video-context-actions">
          <button type="button" class="video-context-embed clip-control" id="play-saved-clip" aria-pressed="false">▶ Ouvir em loop (${clipDuration} s)</button>
          <button type="button" class="video-context-embed clip-control hidden" id="replay-saved-clip">↻ Do início</button>
          <a href="${escapeHtml(vctx.externalUrl)}" target="_blank" rel="noopener noreferrer">Abrir no YouTube ↗</a>
        </div>
        <div class="clip-status" id="saved-clip-status" role="status">${hasExactBounds ? 'Trecho exato salvo pela extensão · repetição contínua' : 'Card antigo: trecho reconstruído aproximadamente · repetição contínua'}</div>
      </section>`;
    ytMount.classList.add('hidden');
    let clipLoaded = false;
    const replayButton = document.getElementById('replay-saved-clip');
    const status = document.getElementById('saved-clip-status');
    document.getElementById('play-saved-clip')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      if (clipLoaded) {
        if (isClipPlaying()) {
          pausePlayer();
          button.textContent = '▶ Continuar trecho';
          button.setAttribute('aria-pressed', 'false');
          if (status) status.textContent = 'Pausado no trecho';
        } else {
          playClip();
          button.textContent = '⏸ Pausar';
          button.setAttribute('aria-pressed', 'true');
          if (status) status.textContent = 'Repetindo somente esta frase';
        }
        return;
      }
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'Carregando trecho…';
      if (status) status.textContent = 'Preparando o trecho no ponto salvo…';
      setClipLoop(true);
      const ok = await loadVideo(ytMount, vctx.videoId, { start: clipStart, end: clipEnd });
      if (!ok || !isCurrentPresentation()) {
        if (isCurrentPresentation()) ytMount.classList.add('hidden');
        if (isCurrentPresentation() && status) status.textContent = 'Não foi possível carregar este vídeo. Use “Abrir no YouTube”.';
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.setAttribute('aria-pressed', 'false');
        button.textContent = 'Tentar novamente';
        return;
      }
      ytMount.classList.remove('hidden');
      replayClip();
      clipLoaded = true;
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.setAttribute('aria-pressed', 'true');
      button.textContent = '⏸ Pausar';
      replayButton?.classList.remove('hidden');
      if (status) status.textContent = hasExactBounds
        ? 'Repetindo somente esta frase'
        : 'Repetindo trecho aproximado deste card antigo';
    });
    replayButton?.addEventListener('click', () => {
      if (!clipLoaded) return;
      replayClip();
      const playButton = document.getElementById('play-saved-clip');
      if (playButton) {
        playButton.textContent = '⏸ Pausar';
        playButton.setAttribute('aria-pressed', 'true');
      }
      if (status) status.textContent = 'Reiniciado no começo da frase';
    });
  } else if (vctx && vctx.externalUrl) {
    document.getElementById('video-resource-section')?.classList.remove('hidden');
    // Não é YouTube (ou sem videoId extraível): sem player, só o link no
    // ponto salvo — degradação graciosa, DRM/bloqueio de embed não quebra nada.
    videoContainer.innerHTML = renderVideoContext(wordData, 'study-video-context');
    attachVideoContext(videoContainer);
    ytMount.classList.add('hidden');
    hidePlayer();
  } else {
    videoContainer.innerHTML = '';
    ytMount.classList.add('hidden');
    hidePlayer();
  }
}

// ── Chunks (frases úteis) ────────────────────────────────────────────────────
function renderChunksList(chunks, context) {
  const container = document.getElementById('chunks-container');
  const visible = chunks.filter(c => !c.is_word);
  // A frase do card sempre primeiro
  visible.sort((a, b) => (b.is_context ? 1 : 0) - (a.is_context ? 1 : 0));

  if (visible.length === 0) {
    container.innerHTML = `<div class="chunk-card" style="opacity:1;"><div class="chunk-en">${context}</div></div>`;
    return;
  }

  container.innerHTML = visible.map((c, i) => renderChunkCard(c, i)).join('');
  attachChunkAudioListeners();
}

function renderChunkCard(c, i) {
  const safeEng = c.eng.replace(/"/g, '&quot;');
  const label = c.is_context ? '<div style="font-size:11px; font-weight:800; color:var(--color-primary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">📌 A frase do card</div>' : '';
  return `
    <div class="chunk-card" style="animation: slideIn 0.3s ease forwards; animation-delay: ${i * 0.1}s; opacity:0;">
      ${label}
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="flex:1;">
          <div class="chunk-en">${c.eng}</div>
          <div class="chunk-br">${c.phon || ''}</div>
          <div class="chunk-pt">${c.pt || ''}</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; flex-shrink:0; margin-left:8px;">
          <button class="chunk-action-btn chunk-audio-btn" data-text="${safeEng}" aria-label="Ouvir: ${safeEng}" title="Ouvir">🔊</button>
          <button class="chunk-action-btn chunk-save-btn" data-text="${safeEng}" aria-label="Salvar áudio de: ${safeEng}" title="Salvar áudio (MP3)">⬇️</button>
        </div>
      </div>
    </div>
  `;
}

function attachChunkAudioListeners() {
  const lang = localStorage.getItem('lf_tts_lang') || 'en-US';
  document.querySelectorAll('.chunk-audio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.text;
      if (text) playNaturalAudio(text, { lang });
    });
  });
  document.querySelectorAll('.chunk-save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.text;
      if (!text) return;
      const original = btn.textContent;
      btn.textContent = '⏳';
      btn.disabled = true;
      try {
        await downloadAudio(text, { lang });
      } catch (e) {
        console.warn('[Study] Download de áudio falhou:', e);
      }
      btn.textContent = original;
      btn.disabled = false;
    });
  });
}

// ── Tutor de gramática (chat) ────────────────────────────────────────────────
function resetChat() {
  chatHistory = [];
  chatBusy = false;
  const messagesEl = document.getElementById('grammar-messages');
  if (messagesEl) {
    messagesEl.innerHTML = '<div class="chat-bubble-ai chat-placeholder">Revele o card e eu te explico a frase — depois pergunte o que quiser. 😉</div>';
  }
  const input = document.getElementById('grammar-input');
  const send = document.getElementById('grammar-send');
  if (input) input.disabled = true;
  if (send) send.disabled = true;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function appendChatBubble(role, htmlOrText) {
  const messagesEl = document.getElementById('grammar-messages');
  if (!messagesEl) return null;
  messagesEl.querySelector('.chat-placeholder')?.remove();
  const div = document.createElement('div');
  div.className = role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai';
  if (role === 'user') {
    div.textContent = htmlOrText;
  } else {
    // Resposta da nossa IA (persona restringe a HTML simples)
    div.innerHTML = htmlOrText;
  }
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function showTyping() {
  const messagesEl = document.getElementById('grammar-messages');
  if (!messagesEl) return null;
  const div = document.createElement('div');
  div.className = 'chat-bubble-ai chat-typing';
  div.textContent = 'digitando...';
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

async function startGrammarChat(card, word, sentence) {
  // SOB DEMANDA: o tutor NÃO explica nada sozinho — só responde quando o
  // aluno pergunta (pedido do dono + economia real de tokens: antes, TODA
  // revelação de card gastava uma chamada de IA que ninguém pediu).
  const input = document.getElementById('grammar-input');
  const send = document.getElementById('grammar-send');
  chatBusy = false;

  const level = await getCefrLevel().catch(() => null);
  chatHistory = [{ role: 'system', content: grammarTutorPersona(sentence, word, level) }];

  if (input) {
    input.disabled = false;
    input.placeholder = 'Ficou com dúvida? Pergunte aqui…';
  }
  if (send) send.disabled = false;
}

async function sendGrammarQuestion(text) {
  const card = currentCard;
  if (!card || chatHistory.length === 0) return;
  text = text.slice(0, 140); // pergunta curta = resposta focada e barata
  const input = document.getElementById('grammar-input');
  const send = document.getElementById('grammar-send');

  appendChatBubble('user', text);
  chatHistory.push({ role: 'user', content: text });
  chatBusy = true;
  if (send) send.disabled = true;
  const typing = showTyping();

  try {
    let liveBubble = null;
    const answer = await aiChatStream(chatHistory, { temperature: 0.6, max_tokens: 320 }, (_delta, full) => {
      if (currentCard !== card) return;
      if (!liveBubble) { typing?.remove(); liveBubble = appendChatBubble('ai', ''); }
      if (liveBubble) {
        liveBubble.innerHTML = full;
        liveBubble.parentElement.scrollTop = liveBubble.parentElement.scrollHeight;
      }
    });
    if (currentCard !== card) return;
    chatHistory.push({ role: 'assistant', content: answer });
    typing?.remove();
    if (!liveBubble) appendChatBubble('ai', answer);
  } catch (e) {
    if (currentCard !== card) return;
    chatHistory.pop(); // não deixa a pergunta órfã no histórico
    typing?.remove();
    appendChatBubble('ai', `<span style="color:var(--color-danger); font-weight:700;">${escapeHtml(e.message || 'Falha ao falar com o tutor.')}</span>`);
  } finally {
    if (currentCard === card) {
      chatBusy = false;
      if (send) send.disabled = false;
      input?.focus();
    }
  }
}

// ── Tatoeba: frases reais de falantes, sob demanda (Onda 3.5) ───────────────
function updateTatoeba(word) {
  const loadBtn = document.getElementById('tatoeba-load-btn');
  const list = document.getElementById('tatoeba-list');
  if (!loadBtn || !list) return;
  loadBtn.classList.remove('hidden');
  loadBtn.disabled = false;
  loadBtn.textContent = '🔎 Ver exemplos de falantes reais';
  list.classList.add('hidden');
  list.innerHTML = '';

  loadBtn.onclick = async () => {
    loadBtn.disabled = true;
    loadBtn.textContent = 'Buscando…';
    try {
      const sentences = await fetchTatoebaSentences(word);
      if (sentences.length === 0) {
        list.innerHTML = '<p style="font-size:12px; color:var(--color-text-light);">Nenhum exemplo encontrado pra essa palavra.</p>';
      } else {
        list.innerHTML = sentences.map(s => `
          <div style="padding:10px 12px; background:var(--color-bg-alt); border-radius:8px; margin-bottom:8px; font-size:13px;">
            <div style="color:var(--color-text); font-weight:600;">${escapeHtml(s.text)}</div>
            ${s.translation ? `<div style="color:var(--color-text-light); margin-top:4px;">${escapeHtml(s.translation)}</div>` : ''}
          </div>`).join('');
      }
      list.classList.remove('hidden');
      loadBtn.classList.add('hidden');
    } catch (e) {
      console.warn('[Study] Tatoeba falhou:', e);
      list.innerHTML = '<p style="font-size:12px; color:var(--color-text-light);">Não consegui buscar exemplos agora.</p>';
      list.classList.remove('hidden');
      loadBtn.classList.add('hidden');
    }
  };
}

// ── YouGlish embutido ────────────────────────────────────────────────────────
// Lazy por design: o widget do YouGlish dá autoplay e é pesado — só carrega
// quando o usuário CLICA. Ao trocar de card, o vídeo é pausado (bug antigo:
// continuava tocando no card seguinte).
function updateYouglish(word) {
  const box = document.getElementById('youglish-box');
  const fallback = document.getElementById('youglish-fallback');
  const loadBtn = document.getElementById('yg-load-btn');
  if (!box) return;
  box.classList.remove('hidden');
  fallback.href = `https://youglish.com/pronounce/${encodeURIComponent(word)}/english`;
  fallback.textContent = `📺 Ver "${word}" no YouGlish`;

  // Extensão (MV3): scripts remotos são proibidos pelo CSP → só o link.
  if (isExtension) {
    if (loadBtn) loadBtn.classList.add('hidden');
    fallback.classList.remove('hidden');
    return;
  }

  // Widget escondido até o clique; botão volta a aparecer a cada card novo
  document.getElementById('yg-widget-embed')?.classList.add('hidden');
  if (loadBtn) {
    loadBtn.classList.remove('hidden');
    loadBtn.textContent = `▶ Ver nativos falando "${word}"`;
    loadBtn.onclick = () => {
      loadBtn.classList.add('hidden');
      document.getElementById('yg-widget-embed')?.classList.remove('hidden');
      loadYouglishAnd(word);
    };
  }
}

function loadYouglishAnd(word) {
  if (window.YG && window.YG.Widget) {
    ygFetch(word);
    return;
  }
  ygQueuedWord = word;
  if (document.getElementById('yg-script')) return;

  window.onYouglishAPIReady = () => {
    if (ygQueuedWord) ygFetch(ygQueuedWord);
  };
  const s = document.createElement('script');
  s.id = 'yg-script';
  s.async = true;
  s.src = 'https://youglish.com/public/emb/widget.js';
  s.charset = 'utf-8';
  s.onerror = () => document.getElementById('youglish-fallback')?.classList.remove('hidden');
  document.head.appendChild(s);
}

// Pausa o vídeo do YouGlish (chamado ao trocar de card / sair da sessão)
function pauseYouglish() {
  try { ygWidget?.pause?.(); } catch { /* widget pode não estar pronto */ }
}

function ygFetch(word) {
  try {
    if (!ygWidget || !document.getElementById('yg-widget-embed')?.hasChildNodes()) {
      const box = document.getElementById('yg-widget-embed');
      ygWidget = new window.YG.Widget('yg-widget-embed', {
        width: Math.min(box?.clientWidth || 316, 360),
        components: 88, // legenda + controle de velocidade + navegação
        events: {
          onError: () => document.getElementById('youglish-fallback')?.classList.remove('hidden'),
        },
      });
    }
    ygWidget.fetch(word, 'english');
  } catch (e) {
    console.warn('[Study] YouGlish widget falhou:', e);
    document.getElementById('youglish-fallback')?.classList.remove('hidden');
  }
}

// ── Grading / feedback ───────────────────────────────────────────────────────
function playFeedbackSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    feedbackAudioContexts.add(ctx);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'correct') {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.setValueAtTime(200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
    osc.onended = () => {
      feedbackAudioContexts.delete(ctx);
      ctx.close().catch(() => {});
    };
  } catch (e) {}
}

function showXPAnimation(text, isPositive = true) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `
    position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
    font-size:28px; font-weight:900; color:${isPositive ? 'var(--color-primary)' : 'var(--color-danger)'};
    pointer-events:none; z-index:9999; text-shadow:0 2px 8px rgba(0,0,0,0.2);
    animation: xpFloat 1.2s ease forwards;
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

async function handleGrade(grade, app) {
  if (gradeBusy || !currentCard) return;
  const operationGeneration = studyViewGeneration;
  const gradedCard = currentCard;
  gradeBusy = true;
  document.querySelectorAll('.grade-btn').forEach(btn => { btn.disabled = true; });
  const buryBtn = document.getElementById('bury-btn');
  if (buryBtn) buryBtn.disabled = true;
  stopAudio();

  const operation = pendingReviewOperations.get(gradedCard.id) || {
    operationId: createOperationId(),
    grade,
    plannedState: gradedCard._gradePreviews?.[grade - 1] || null,
  };
  pendingReviewOperations.set(gradedCard.id, operation);
  const isCorrect = operation.grade >= 2;
  const liveStatus = document.getElementById('study-status');
  if (liveStatus) liveStatus.textContent = 'Salvando avaliação.';
  try {
    // A fila e os contadores só mudam depois da confirmação atômica. Assim a
    // falha de rede não consome o card nem exige um rollback local incompleto.
    const mutationPromise = lfDb.logReview(
      gradedCard.id,
      operation.grade,
      gradedCard.wordData?.category || null,
      operation.plannedState,
      operation.operationId,
    );
    cardMutationPromise = mutationPromise;
    const res = await mutationPromise;
    if (!studyViewActive || operationGeneration !== studyViewGeneration || currentCard !== gradedCard) return;
    if (!res?.persisted) throw new Error('A gravação da revisão não foi confirmada');
    pendingReviewOperations.delete(gradedCard.id);
    if (liveStatus) liveStatus.textContent = res.idempotent
      ? 'A avaliação já estava salva. Próximo card.'
      : 'Avaliação salva. Próximo card.';

    if (dueQueue[0] === gradedCard) dueQueue.shift();
    else dueQueue = dueQueue.filter(card => card.id !== gradedCard.id);
    sessionCards++;
    playFeedbackSound(isCorrect ? 'correct' : 'wrong');

    if (isCorrect) {
      // XP real vem SÓ do backend (trigger no review_log). Nada de contador
      // paralelo em localStorage — era uma segunda fonte de verdade divergente.
      consecutiveCorrect++;
      if (consecutiveCorrect === 5) app.showToast('🔥 5 em sequência! Continue!', 'info');
      if (consecutiveCorrect === 10) app.showToast('🚀 Você está em chamas! 10 seguidos!', 'info');
    } else {
      consecutiveCorrect = 0;
      showXPAnimation('Próxima vez! 💪', false);
    }

    lastReview = {
      prevCard: res?.prevCard || null,
      card: gradedCard,
      reviewLogId: res?.reviewLogId || null,
      grade: operation.grade,
      isCorrect,
    };
    updateUndoButton();
    if (res?.xpAwarded) {
      sessionXp += res.xpAwarded;
      showXPAnimation(`+${res.xpAwarded} XP`);
    }
    // REENTRADA NA SESSÃO: card em learning volta quando o step vencer.
    if (res?.card && res.card.status === 'learning' && res.nextDue) {
      pendingLearning = pendingLearning.filter(p => p.card.id !== gradedCard.id);
      pendingLearning.push({
        card: { ...res.card, wordData: gradedCard.wordData },
        dueAt: res.nextDue,
      });
    }
    loadNextCard(app);
  } catch (e) {
    console.error('Failed to log review:', e);
    if (!e?.retryable && e?.kind !== 'auth') pendingReviewOperations.delete(gradedCard.id);
    if (studyViewActive && operationGeneration === studyViewGeneration) {
      const message = e?.kind === 'offline'
        ? 'Sem conexão. A avaliação não foi salva; este card continua aqui.'
        : e?.kind === 'auth'
          ? 'Sua sessão expirou. Entre novamente para salvar esta avaliação.'
          : e?.retryable
            ? 'Ainda não confirmamos a avaliação. Tente novamente; ela não será duplicada.'
            : 'Não foi possível salvar a avaliação. O card continua aqui.';
      if (liveStatus) liveStatus.textContent = message;
      app.showToast(message, 'error');
    }
  } finally {
    if (cardMutationPromise) cardMutationPromise = null;
    if (operationGeneration === studyViewGeneration) {
      gradeBusy = false;
      document.querySelectorAll('.grade-btn').forEach(btn => { btn.disabled = false; });
      const currentBuryBtn = document.getElementById('bury-btn');
      if (currentBuryBtn) currentBuryBtn.disabled = false;
    }
  }
}

async function handleUndo(app) {
  // Auditoria 2026-07-12: handleGrade só atualiza `lastReview` DEPOIS que o
  // logReview termina de salvar (await logPromise), mas o botão/atalho de
  // Undo não checava isso — apertar Z logo após avaliar (o uso mais natural
  // do atalho) desfazia a revisão ANTERIOR (lastReview ainda apontava pro
  // card N-1) em vez da que acabou de ser dada. gradeBusy fica true durante
  // toda essa janela, então é a mesma trava que já protege handleGrade.
  if (gradeBusy) return;
  if (!lastReview || !lastReview.prevCard) return;
  const { prevCard, card, reviewLogId, isCorrect } = lastReview;
  lastReview = null;
  updateUndoButton();

  try {
    const undone = await lfDb.undoReview(prevCard, reviewLogId);
    sessionXp = Math.max(0, sessionXp - (undone?.xpReverted || 0));
  } catch (e) {
    console.error('Falha ao desfazer:', e);
    app.showToast('Não foi possível desfazer.', 'error');
    return;
  }

  // Reverte o progresso da sessão e recoloca o card no topo da fila.
  // Se o card tinha sido reagendado como learning, sai da fila de espera.
  sessionCards = Math.max(0, sessionCards - 1);
  if (isCorrect) {
    consecutiveCorrect = Math.max(0, consecutiveCorrect - 1);
  }
  pendingLearning = pendingLearning.filter(p => p.card.id !== card.id);
  dueQueue.unshift(card);
  app.showToast('Revisão desfeita ↩️', 'info');
  loadNextCard(app);
}

function updateUndoButton() {
  const btn = document.getElementById('btn-undo');
  if (btn) btn.style.display = (lastReview && lastReview.prevCard) ? 'inline-flex' : 'none';
}

// Enterrar (bury do Anki): adia pra amanhã sem contar como revisão
async function buryCard(app) {
  if (gradeBusy) return;
  const card = currentCard;
  if (!card) return;
  const operationGeneration = studyViewGeneration;
  gradeBusy = true;
  const buryBtn = document.getElementById('bury-btn');
  if (buryBtn) buryBtn.disabled = true;
  document.querySelectorAll('.grade-btn').forEach(btn => { btn.disabled = true; });
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  try {
    // Remove props de runtime (_ctx/_chunks/_reverse não são colunas do banco)
    const { wordData, _ctx, _chunks, _reverse, _mode, _gradePreviews, _exerciseFinished, ...clean } = card;
    const mutationPromise = lfDb.updateCard({ ...clean, due_date: tomorrow.toISOString() });
    cardMutationPromise = mutationPromise;
    await mutationPromise;
    if (!studyViewActive || operationGeneration !== studyViewGeneration || currentCard !== card) return;
    if (dueQueue[0] === card) dueQueue.shift();
    else dueQueue = dueQueue.filter(queued => queued.id !== card.id);
    app.showToast('Card adiado pra amanhã 💤', 'info');
    loadNextCard(app);
  } catch (e) {
    console.error('Falha ao enterrar:', e);
    if (studyViewActive && operationGeneration === studyViewGeneration) {
      app.showToast('Erro ao adiar o card. Ele continua na fila.', 'error');
    }
  } finally {
    if (cardMutationPromise) cardMutationPromise = null;
    if (operationGeneration === studyViewGeneration) {
      gradeBusy = false;
      const currentBuryBtn = document.getElementById('bury-btn');
      if (currentBuryBtn) currentBuryBtn.disabled = false;
      document.querySelectorAll('.grade-btn').forEach(btn => { btn.disabled = false; });
    }
  }
}

function injectStyles() {
  if (document.getElementById('study-styles-v2')) return;
  document.getElementById('study-styles')?.remove();
  const style = document.createElement('style');
  style.id = 'study-styles-v2';
  style.innerHTML = `
    .study-layout { display:block; min-height:100%; width:100%; background-color:var(--color-bg-alt); }
    .study-main { width:100%; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; padding:32px 24px 48px; position:relative; }

    .media-container { width:100%; max-width:720px; min-height:88px; background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-lg); display:flex; align-items:center; justify-content:center; margin-bottom:28px; }

    .audio-wave-placeholder { display: flex; align-items: center; gap: 8px; opacity: 0.5; transition: opacity 0.3s; }
    .audio-wave-placeholder.is-playing { opacity:1; }
    .wave-bar { width:8px; height:30px; background:var(--color-secondary); border-radius:4px; animation:wave 1s infinite alternate; animation-play-state:paused; }
    .audio-wave-placeholder.is-playing .wave-bar { animation-play-state:running; }
    .wave-bar:nth-child(2) { animation-delay: 0.2s; height: 50px; }
    .wave-bar:nth-child(3) { animation-delay: 0.4s; height: 20px; }
    .wave-bar:nth-child(4) { animation-delay: 0.6s; height: 40px; }
    .wave-bar:nth-child(5) { animation-delay: 0.8s; height: 30px; }
    @keyframes wave { 0% { transform: scaleY(0.5); } 100% { transform: scaleY(1.2); } }

    .btn-play-audio { background: var(--color-secondary); color: white; border: none; border-bottom: 4px solid var(--color-secondary-shadow); width: 44px; height: 44px; border-radius: 22px; font-size: 18px; cursor: pointer; margin-left: 16px; display:flex; align-items:center; justify-content:center;}
    .btn-play-audio:active { transform: translateY(4px); border-bottom-width: 0; }

    .sentence-container { text-align:center; max-width:720px; width:100%; margin-bottom:24px; }
    .sentence-text { font-size: 32px; font-weight: 800; color: var(--color-text); line-height: 1.5; margin-bottom: 32px; }

    .cloze-blur { background: var(--color-border); color: transparent; padding: 0 16px; border-radius: var(--radius-md); user-select: none; transition: all 0.3s; display: inline-block; min-width: 60px;}
    .cloze-revealed { background: rgba(88, 204, 2, 0.15); color: var(--color-primary); }

    .ex-chip { background: var(--color-surface); border: 2px solid var(--color-border); border-bottom-width: 4px; border-radius: 12px; padding: 10px 16px; font-family: var(--font-main); font-weight: 800; font-size: 16px; color: var(--color-text); cursor: pointer; transition: transform 0.1s; }
    .ex-chip:hover { border-color: var(--color-secondary); }
    .ex-chip:active { transform: translateY(2px); }
    .ex-chip-used { background: rgba(28,176,246,0.12); border-color: var(--color-secondary); }

    .reveal-btn { font-size: 20px; padding: 16px 40px; width:100%; max-width: 320px; margin: 0 auto; display: block; box-shadow: 0 4px 0 var(--color-primary-shadow);}
    .reveal-btn:disabled { opacity: 0.6; cursor: default; }

    .grading-buttons { margin-top:16px; width:100%; max-width:720px; }
    .grading-row { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; width:100%; }
    .grade-btn { flex: 1; font-family: var(--font-main); font-weight: 800; font-size: 18px; padding: 16px 8px; border-radius: var(--radius-md); border: none; cursor: pointer; color: white; display: flex; flex-direction: column; align-items: center; gap: 6px; transition: transform 0.1s, box-shadow 0.1s; }
    .grade-btn:active { transform: translateY(4px); box-shadow: 0 0 0 transparent !important; }
    button:focus-visible, input:focus-visible, summary:focus-visible { outline: 3px solid var(--color-secondary); outline-offset: 3px; }
    .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }

    .btn-danger { background: #ff4b4b; box-shadow: 0 4px 0 #cc3c3c; }
    .btn-warning { background: #ff9600; box-shadow: 0 4px 0 #cc7800; }
    .btn-secondary { background: var(--color-secondary); box-shadow: 0 4px 0 var(--color-secondary-shadow); }

    .study-explore { width:min(100%, 720px); margin-top:20px; }
    .study-resources { width:100%; border:2px solid var(--color-border); border-radius:var(--radius-lg); background:var(--color-surface); overflow:hidden; }
    .study-resources > summary { min-height:52px; padding:0 18px; cursor:pointer; list-style:none; display:flex; align-items:center; justify-content:space-between; color:var(--color-text); font-weight:900; }
    .study-resources > summary::-webkit-details-marker { display:none; }
    .study-resources > summary > span:last-child { color:var(--color-text-light); transition:transform .15s ease; }
    .study-resources[open] > summary > span:last-child { transform:rotate(180deg); }
    .study-resources-content { padding:4px 20px 24px; border-top:1px solid var(--color-border); }
    .study-session-context { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:16px 0; padding:10px 12px; border-radius:10px; background:var(--color-bg-alt); color:var(--color-text-light); font-size:13px; }
    .study-session-context button, .study-card-actions button { min-height:44px; border:0; background:transparent; color:var(--color-secondary); font:inherit; font-weight:800; cursor:pointer; }
    .study-card-actions { display:flex; justify-content:flex-end; flex-wrap:wrap; gap:8px; margin:10px 0; }
    .study-tutor { width:100%; box-sizing:border-box; margin:16px auto 24px; text-align:left; border:2px solid var(--color-border); border-radius:var(--radius-md); background:var(--color-surface); padding:12px 16px; }
    .study-tutor summary { cursor:pointer; list-style:none; display:flex; align-items:center; gap:8px; }
    .study-tutor summary::-webkit-details-marker { display:none; }
    .study-tutor summary span { font-size:12px; color:var(--color-text-light); font-weight:600; }
    .sidebar-title { font-size: 22px; font-weight: 900; margin-bottom: 24px; color: var(--color-text); display:flex; align-items:center; gap:8px;}
    .chunks-list { display: flex; flex-direction: column; gap: 16px; }

    .chunk-card { background: var(--color-surface); border: 2px solid var(--color-border); border-radius: var(--radius-lg); padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); position: relative; overflow: hidden;}
    .chunk-card::before { content:''; position:absolute; left:0; top:0; bottom:0; width:6px; background:var(--color-primary);}
    .chunk-en { font-weight: 900; font-size: 18px; color: var(--color-text); margin-bottom: 6px; }
    .chunk-br { font-size: 15px; color: var(--color-secondary); font-weight: 800; margin-bottom: 8px; }
    .chunk-pt { font-size: 14px; color: var(--color-text-light); font-style: italic; background: var(--color-bg-alt); display: inline-block; padding: 4px 10px; border-radius: 12px;}

    .chunk-action-btn { background: var(--color-secondary); color: white; border: none; border-radius: 50%; width: 36px; height: 36px; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .chunk-action-btn { min-width:44px; min-height:44px; }
    .chunk-action-btn:disabled { opacity: 0.5; cursor: default; }
    .chunk-save-btn { background: var(--color-primary); }

    #grammar-chat { background: var(--color-surface); border: 2px solid var(--color-border); border-radius: var(--radius-lg); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    #grammar-messages { padding: 16px; max-height: 340px; min-height: 80px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; font-size: 14px; line-height: 1.55; }
    .chat-bubble-ai { background: var(--color-bg-alt); border-radius: 12px 12px 12px 4px; padding: 10px 12px; color: var(--color-text); }
    .chat-bubble-ai p { margin: 0 0 8px 0; }
    .chat-bubble-ai p:last-child { margin-bottom: 0; }
    .chat-bubble-ai ul { margin: 4px 0; padding-left: 18px; }
    .chat-bubble-user { background: rgba(28, 176, 246, 0.15); align-self: flex-end; border-radius: 12px 12px 4px 12px; padding: 10px 12px; color: var(--color-text); max-width: 85%; }
    .chat-typing { font-style: italic; color: var(--color-text-light); }
    #grammar-form { display: flex; border-top: 2px solid var(--color-border); }
    #grammar-input { flex: 1; border: none; padding: 12px; background: transparent; color: var(--color-text); font-family: var(--font-main); font-size: 14px; outline: none; }
    #grammar-input:disabled { opacity: 0.6; }
    #grammar-send { background: var(--color-primary); color: #fff; border: none; width: 44px; cursor: pointer; font-size: 16px; }
    #grammar-send:disabled { opacity: 0.5; cursor: default; }

    #youglish-box { background: var(--color-surface); border: 2px solid var(--color-border); border-radius: var(--radius-lg); padding: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    #tatoeba-box { background: var(--color-surface); border: 2px solid var(--color-border); border-radius: var(--radius-lg); padding: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    #yg-widget-embed { width: 100%; min-height: 0; }
    #yg-widget-embed iframe { max-width: 100%; border-radius: var(--radius-md); }
    .study-video-context { width:min(100%, 620px); margin:18px auto 0; text-align:left; }
    #saved-video-context:empty { display:none; }
    .video-context { max-width: 560px; }
    .video-context-label { color: var(--color-text-light); font-size: 12px; font-weight: 800; }
    .video-context-title { display: block; color: var(--color-text); font-size: 13px; margin: 3px 0 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .video-context-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .video-context-actions a, .video-context-embed { color: var(--color-secondary); background: transparent; border: 0; cursor: pointer; font: inherit; font-size: 13px; font-weight: 800; padding: 0; text-decoration: underline; }
    .video-context-actions .clip-control { min-height:40px; padding:8px 12px; border:2px solid var(--color-secondary); border-radius:10px; text-decoration:none; background:rgba(28,176,246,.10); }
    .video-context-actions .clip-control:disabled { opacity:.65; cursor:wait; }
    .clip-status { margin-top:8px; color:var(--color-text-light); font-size:12px; line-height:1.4; }
    .video-context-frame { margin-top: 12px; aspect-ratio: 16 / 9; background: #000; border-radius: 12px; overflow: hidden; }
    .video-context-frame iframe { width: 100%; height: 100%; border: 0; }
    #study-yt-mount { width:min(100%, 620px); margin:12px auto 0; aspect-ratio: 16 / 9; background: #000; border-radius:var(--radius-md); overflow:hidden; }
    #study-yt-mount iframe { width: 100%; height: 100%; border: 0; }
    .exercise-grade-prompt { margin-top:14px; color:var(--color-text-light); font-size:15px; font-weight:700; }
    #bury-btn, #btn-undo, .clip-control, .ex-chip { min-height:44px; }

    @media (prefers-reduced-motion: reduce) {
      .wave-bar, #shadowing-overlay { animation:none !important; }
      * { scroll-behavior:auto !important; }
    }

    @media (max-width: 768px) {
      /* O #app-root é a única área que rola no celular. Antes havia três
         scroll containers concorrentes e o card parecia metade fixo. */
      .study-layout { min-height:100dvh; }
      .study-main { min-height:calc(100dvh - var(--topbar-height)); padding:18px 14px 28px; justify-content:flex-start; }
      .study-layout.is-revealed .study-main { padding-bottom:calc(92px + env(safe-area-inset-bottom)); }
      .study-resources-content { padding:4px 14px calc(20px + env(safe-area-inset-bottom)); }
      .grading-buttons { position:fixed; z-index:20; left:0; right:0; bottom:0; margin:0; padding:10px 12px calc(10px + env(safe-area-inset-bottom)); background:var(--color-surface); border-top:2px solid var(--color-border); box-shadow:0 -8px 24px rgba(0,0,0,.10); }
      .grading-row { grid-template-columns:repeat(4,minmax(0,1fr)); gap:5px; max-width:680px; margin:0 auto; }
      .grade-btn { min-width:0; min-height:58px; padding:7px 2px; font-size:13px; gap:2px; }
      .grade-btn span:last-child { font-size:10px !important; }
      .study-tutor { margin-top:18px; }
      .study-video-context { margin-top:16px; }
      .sentence-text { font-size: 26px; }
    }
    @media (max-width: 380px) {
      .study-main { padding:16px 10px 24px; }
      .study-layout.is-revealed .study-main { padding-bottom:calc(88px + env(safe-area-inset-bottom)); }
      .media-container { height: 76px; margin-bottom: 20px; }
      .sentence-text { font-size: 22px; margin-bottom: 22px; }
      .grading-buttons { padding-left:6px; padding-right:6px; }
      .grade-btn { font-size:12px; min-height:56px; }
    }

    @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

    @keyframes xpFloat {
      0% { opacity:1; transform:translate(-50%,-50%) scale(1); }
      50% { opacity:1; transform:translate(-50%,-80%) scale(1.2); }
      100% { opacity:0; transform:translate(-50%,-120%) scale(0.8); }
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(88, 204, 2, 0.2);
      border-left-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
}
