import { db as lfDb } from '../../../utils/db.js';
import { playNaturalAudio, stopAudio, downloadAudio } from '../core/tts.js';
import { aiChat, getCefrLevel, grammarTutorPersona, grammarInitialQuestion, enrichCard, generateChunksWeb } from '../core/ai.js';

const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;

let dueQueue = [];
let currentCard = null;
let consecutiveCorrect = 0;
let sessionCards = 0;
let sessionStart = Date.now();
let chatHistory = [];
let chatBusy = false;
let lastReview = null; // { prevCard, card, grade, isCorrect } para o undo
let reverseEnabled = false; // cartões reversos PT→EN (setting lf_reverse_cards)
let variedEnabled = true;   // exercícios variados: montar frase/ditado (lf_varied_exercises, ON por padrão)
let ygWidget = null;
let ygQueuedWord = null;

export async function renderStudy(container, app) {
  injectStyles();
  consecutiveCorrect = 0;
  sessionCards = 0;
  sessionStart = Date.now();
  lastReview = null;
  exerciseApp = app;
  ygWidget = null; // container será recriado

  app.showToast('Carregando frases...', 'info');
  try {
    reverseEnabled = !!(await lfDb.getSetting('lf_reverse_cards').catch(() => null));
    const variedRaw = await lfDb.getSetting('lf_varied_exercises').catch(() => null);
    variedEnabled = variedRaw === null || variedRaw === true || variedRaw === 'true';
    dueQueue = await lfDb.getCardsDue(50, true);
    // Cards suspensos (manual ou por leech) ficam fora da fila, como no Anki
    dueQueue = dueQueue.filter(c => !c.suspended);
  } catch (e) {
    console.error('DB Error:', e);
    dueQueue = [];
  }

  if (dueQueue.length === 0) {
    container.innerHTML = `
      <div class="study-layout" style="display: flex; height: 100%; width: 100%; justify-content: center; align-items: center; background-color: var(--color-bg-alt);">
        <div class="study-main" style="text-align:center; padding: 60px; background: var(--color-surface); border-radius: var(--radius-lg); box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 2px solid var(--color-border);">
          <h2 style="color:var(--color-primary); font-size: 32px; margin-bottom:16px;">Tudo feito por hoje! 🎉</h2>
          <p style="color:var(--color-text-light); font-size: 18px;">Você revisou todas as suas frases pendentes.</p>
          <button class="btn btn-primary" id="back-home-btn" style="margin-top:32px; padding: 16px 32px; font-size: 18px;">Voltar ao Início</button>
        </div>
      </div>
    `;
    setTimeout(() => {
      document.getElementById('back-home-btn')?.addEventListener('click', () => app.navigate('home'));
    }, 0);
    return;
  }

  container.innerHTML = `
    <div class="study-layout">
      <!-- Main Study Area -->
      <div class="study-main">

        <div class="media-container">
          <div class="audio-wave-placeholder" id="audio-wave">
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <button class="btn-play-audio" id="play-audio-btn" aria-label="Ouvir a frase">▶</button>
          </div>
        </div>

        <div class="sentence-container">
          <div class="sentence-text" id="pump-sentence">Carregando...</div>
          <div id="pump-phonetics" style="font-size: 18px; color: var(--color-secondary); font-style: italic; margin-top: 12px;" class="hidden"></div>
          <div id="pump-translation" style="font-size: 20px; font-weight: 700; color: var(--color-text); margin-top: 12px; padding-top: 12px; border-top: 2px dashed var(--color-border);" class="hidden"></div>

          <button id="reveal-btn" class="btn btn-primary reveal-btn">Revelar (Espaço)</button>
          <button id="improve-btn" class="hidden" style="margin-top:12px; background:none; border:none; color:var(--color-secondary); font-family:var(--font-main); font-weight:700; font-size:14px; cursor:pointer; text-decoration:underline;">✨ Frase estranha? Gerar uma melhor com IA</button>
          <button id="bury-btn" style="margin-top:12px; background:none; border:none; color:var(--color-text-light); font-family:var(--font-main); font-weight:700; font-size:13px; cursor:pointer;" title="Adia este card para amanhã sem afetar o agendamento">💤 Deixar pra amanhã</button>
        </div>

        <!-- Anki Grading Buttons -->
        <div class="grading-buttons hidden" id="grading-area">
          <div class="grading-row">
            <button class="grade-btn btn-danger" data-grade="1">Errei<br><span style="font-size:12px;opacity:0.8">&lt; 1 min</span></button>
            <button class="grade-btn btn-warning" data-grade="2">Difícil<br><span style="font-size:12px;opacity:0.8">1 dia</span></button>
            <button class="grade-btn btn-secondary" data-grade="3">Bom<br><span style="font-size:12px;opacity:0.8">3 dias</span></button>
            <button class="grade-btn btn-primary" data-grade="4">Fácil<br><span style="font-size:12px;opacity:0.8">7 dias</span></button>
          </div>
          <button id="btn-undo" style="display:none; margin-top:14px; background:none; border:none; color:var(--color-text-light); font-family:var(--font-main); font-weight:700; font-size:13px; cursor:pointer; align-items:center; gap:6px;">↩️ Desfazer última (Z)</button>
        </div>

        <!-- Shadowing Engine Overlay -->
        <div id="shadowing-overlay" class="hidden" style="margin-top: 24px; padding: 16px; background: rgba(88, 204, 2, 0.1); border: 2px dashed var(--color-primary); border-radius: var(--radius-md); text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; animation: pulse 2s infinite;">
          <div style="font-size: 24px; margin-bottom: 8px;">⏳</div>
          <div style="font-size: 18px; font-weight: 800; color: var(--color-primary);">Sua vez... Fale em voz alta!</div>
          <div style="width: 100%; background: var(--color-border); height: 6px; border-radius: 3px; margin-top: 12px; overflow: hidden;">
            <div id="shadowing-progress" style="width: 0%; height: 100%; background: var(--color-primary); transition: width 3s linear;"></div>
          </div>
        </div>

      </div>

      <!-- Right Panel: Sidebar -->
      <div class="study-sidebar">
        <div id="isolated-word-box" class="hidden" style="margin-bottom: 28px; padding: 24px; background: var(--color-surface); border: 2px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-align:center;">
          <div style="font-size: 28px; font-weight: 900; color: var(--color-primary); margin-bottom: 8px;" id="iso-word"></div>
          <div style="font-size: 18px; color: var(--color-text); font-weight: 700; margin-bottom: 8px;" id="iso-trans"></div>
          <div style="font-size: 14px; color: var(--color-secondary); font-style: italic; background: rgba(28, 176, 246, 0.1); padding: 4px 12px; border-radius: 16px; display: inline-block;" id="iso-phonetics"></div>
        </div>

        <h3 class="sidebar-title">Frases úteis (Chunks) ✨</h3>
        <div class="chunks-list" id="chunks-container"></div>

        <h3 class="sidebar-title" style="margin-top:32px;">Pergunte ao tutor 🎓</h3>
        <div id="grammar-chat">
          <div id="grammar-messages" role="log" aria-live="polite">
            <div class="chat-bubble-ai chat-placeholder">Revele o card e eu te explico a frase — depois pergunte o que quiser. 😉</div>
          </div>
          <form id="grammar-form">
            <input id="grammar-input" type="text" placeholder="Sua dúvida sobre a frase..." aria-label="Pergunte sua dúvida sobre a frase" autocomplete="off" maxlength="300" disabled />
            <button type="submit" id="grammar-send" aria-label="Enviar pergunta" disabled>➤</button>
          </form>
        </div>

        <h3 class="sidebar-title" style="margin-top:32px;">Nativos falando 📺</h3>
        <div id="youglish-box" class="hidden">
          <div id="yg-widget-embed"></div>
          <a id="youglish-fallback" href="#" target="_blank" rel="noopener" class="hidden" style="color: var(--color-secondary); font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; margin-top: 8px;">📺 Abrir no YouGlish</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('play-audio-btn').addEventListener('click', playCurrentAudio);
  document.getElementById('reveal-btn').addEventListener('click', revealCard);
  document.getElementById('improve-btn').addEventListener('click', () => improveSentence(app));

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
    if (e.code === 'Digit1') document.querySelector('[data-grade="1"]')?.click();
    if (e.code === 'Digit2') document.querySelector('[data-grade="2"]')?.click();
    if (e.code === 'Digit3') document.querySelector('[data-grade="3"]')?.click();
    if (e.code === 'Digit4') document.querySelector('[data-grade="4"]')?.click();
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

async function persistChunks(card, chunks, context) {
  if (!card.wordData) return;
  card.wordData.ai_chunks = JSON.stringify(chunks);
  card.ai_chunks = card.wordData.ai_chunks;
  if (context) {
    card.wordData.context_sentence = context;
    card.context = context;
  }
  await lfDb.saveWord(card.wordData).catch(console.error);
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

// ── Fluxo do card ────────────────────────────────────────────────────────────
async function loadNextCard(app) {
  stopAudio();

  if (dueQueue.length === 0) {
    if (window.currentKeydownHandler) {
      document.removeEventListener('keydown', window.currentKeydownHandler);
    }

    const sessionTime = Math.round((Date.now() - sessionStart) / 60000);
    const rootContainer = document.getElementById('app-view') || document.body;
    rootContainer.innerHTML = `
      <div style="display:flex; height:100%; align-items:center; justify-content:center; background:var(--color-bg-alt);">
        <div style="text-align:center; padding:60px; background:var(--color-surface); border-radius:var(--radius-lg); border:2px solid var(--color-border); box-shadow:0 10px 40px rgba(0,0,0,0.08); max-width:500px;">
          <div style="font-size:64px; margin-bottom:16px;">🎉</div>
          <h2 style="color:var(--color-primary); font-size:32px; margin-bottom:8px;">Sessão Concluída!</h2>
          <p style="color:var(--color-text-light); margin-bottom:32px;">Continue assim e você será fluente!</p>
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:32px;">
            <div style="background:var(--color-bg-alt); border-radius:var(--radius-md); padding:16px;">
              <div style="font-size:28px; font-weight:900; color:var(--color-text);">${sessionCards}</div>
              <div style="font-size:13px; color:var(--color-text-light);">Cartas</div>
            </div>
            <div style="background:rgba(88,204,2,0.1); border-radius:var(--radius-md); padding:16px;">
              <div style="font-size:28px; font-weight:900; color:var(--color-primary);">+${sessionCards * 10} XP</div>
              <div style="font-size:13px; color:var(--color-text-light);">XP Ganho</div>
            </div>
            <div style="background:rgba(28,176,246,0.1); border-radius:var(--radius-md); padding:16px;">
              <div style="font-size:28px; font-weight:900; color:var(--color-secondary);">${sessionTime}min</div>
              <div style="font-size:13px; color:var(--color-text-light);">Tempo</div>
            </div>
          </div>
          <button id="session-done-btn" class="btn btn-primary" style="padding:16px 48px; font-size:18px;">Continuar →</button>
        </div>
      </div>
    `;
    setTimeout(() => {
      document.getElementById('session-done-btn')?.addEventListener('click', () => {
        if (window.currentKeydownHandler) document.removeEventListener('keydown', window.currentKeydownHandler);
        app.navigate('home');
      });
    }, 0);
    return;
  }

  currentCard = dueQueue[0];
  const card = currentCard;
  chatHistory = [];

  // Reset UI
  const revealBtn = document.getElementById('reveal-btn');
  revealBtn.classList.remove('hidden');
  revealBtn.disabled = true;
  revealBtn.textContent = 'Revelar (Espaço)';

  document.getElementById('grading-area').classList.add('hidden');
  document.getElementById('pump-phonetics').classList.add('hidden');
  document.getElementById('pump-translation').classList.add('hidden');
  document.getElementById('isolated-word-box').classList.add('hidden');
  document.getElementById('youglish-box').classList.add('hidden');
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

  // Sem contexto real ou sem chunks: gera com IA ANTES de mostrar o card,
  // para que a frente já seja a frase com a lacuna (recall de verdade).
  if (chunks.filter(c => !c.is_context && !c.is_word).length === 0 || looksBroken(context, word)) {
    const sentenceEl = document.getElementById('pump-sentence');
    sentenceEl.innerHTML = `<div class="loading-spinner" style="margin: 0 auto;"></div><div style="font-size:18px; margin-top:16px;">Preparando o card com IA...</div>`;

    const generated = await generateChunksForWord(word);
    if (currentCard !== card) return; // usuário navegou enquanto gerava

    if (generated.length > 0) {
      const specials = chunks.filter(c => c.is_context || c.is_word);
      chunks = [...specials, ...generated];
      if (looksBroken(context, word)) {
        // Chunks são frases naturais: usa a primeira como contexto do card
        context = generated[0].eng;
        // Fonética/tradução da entrada gerada já valem para o novo contexto
        chunks = chunks.filter(c => !c.is_context);
        chunks.unshift({ ...generated[0], is_context: true });
      }
      await persistChunks(card, chunks, context);
    }
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

  renderFront(card, word, context);
  // Reverso: o áudio EN entrega a resposta. Builder: entrega a ORDEM das palavras.
  // Ditado: o próprio renderFront toca (é o exercício).
  if (card._mode === 'classic') playCurrentAudio();
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

  if (looksBroken(context, word)) {
    document.getElementById('improve-btn').classList.remove('hidden');
  }
}

// ── Exercícios ativos (montar frase / ditado) ────────────────────────────────
// Verificação objetiva: acerto agenda como "Bom" (3), erro como "Errei" (1) —
// mesma filosofia do Duolingo, e o FSRS/undo continuam valendo.

let exerciseApp = null; // referência do app pro auto-grade

function normalizeAnswer(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9' ]/g, '').replace(/\s+/g, ' ').trim();
}

function exerciseFinish(correct, context) {
  const sentenceEl = document.getElementById('pump-sentence');
  const feedback = correct
    ? `<div style="color:var(--color-primary); font-weight:900; font-size:22px; margin-bottom:12px;">✅ Perfeito!</div>`
    : `<div style="color:var(--color-danger); font-weight:900; font-size:22px; margin-bottom:12px;">A resposta era:</div>`;
  sentenceEl.innerHTML = `${feedback}<div style="font-size:26px;">${context}</div>`;
  if (correct) playCurrentAudio();
  setTimeout(() => {
    if (exerciseApp) handleGrade(correct ? 3 : 1, exerciseApp);
  }, correct ? 1400 : 2600);
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
    <div id="ex-answer" style="min-height:52px; border-bottom:2px solid var(--color-border); margin-bottom:16px; display:flex; flex-wrap:wrap; gap:8px; justify-content:center; padding:8px;"></div>
    <div id="ex-bank" style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-bottom:16px;">
      ${shuffled.map((t, i) => `<button class="ex-chip" data-i="${i}" data-t="${t}">${t}</button>`).join('')}
    </div>
    <button id="ex-check" class="btn btn-primary" style="padding:12px 32px; font-size:15px;" disabled>Verificar</button>
  `;

  const answer = [];
  const answerEl = document.getElementById('ex-answer');
  const checkBtn = document.getElementById('ex-check');

  function redraw() {
    answerEl.innerHTML = answer.map((a, idx) => `<button class="ex-chip ex-chip-used" data-idx="${idx}">${a.t}</button>`).join('');
    checkBtn.disabled = answer.length !== tokens.length;
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
    <input id="ex-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Digite o que você ouviu…"
      style="width:100%; max-width:560px; padding:14px; font-size:18px; border:2px solid var(--color-border); border-radius:var(--radius-md); font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text); text-align:center;">
    <button id="ex-check" class="btn btn-primary" style="padding:12px 32px; font-size:15px; margin-top:16px;">Verificar</button>
  `;

  const play = () => playNaturalAudio(context, { lang: localStorage.getItem('lf_tts_lang') || 'en-US' });
  play();
  document.getElementById('ex-replay').addEventListener('click', play);

  const input = document.getElementById('ex-input');
  setTimeout(() => input.focus(), 100);
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
  renderFront(card, word, context);
  playCurrentAudio();
}

function playCurrentAudio() {
  if (!currentCard) return;
  const wordData = currentCard.wordData || {};
  const textToPlay = currentCard._ctx || wordData.context_sentence || wordData.word || currentCard.word;

  const wave = document.getElementById('audio-wave');
  if (wave) wave.style.opacity = '1';

  playNaturalAudio(textToPlay, { lang: localStorage.getItem('lf_tts_lang') || 'en-US' }, () => {
    if (wave) wave.style.opacity = '0.5';

    const revealBtn = document.getElementById('reveal-btn');
    if (revealBtn && !revealBtn.classList.contains('hidden')) {
      const shadowingEl = document.getElementById('shadowing-overlay');
      const progressEl = document.getElementById('shadowing-progress');
      if (shadowingEl) {
        shadowingEl.classList.remove('hidden');
        void progressEl.offsetWidth;
        progressEl.style.transition = 'width 3s linear';
        progressEl.style.width = '100%';
        setTimeout(() => {
          shadowingEl.classList.add('hidden');
          progressEl.style.transition = 'none';
          progressEl.style.width = '0%';
        }, 3000);
      }
    }
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
    playCurrentAudio();
  }
  document.querySelectorAll('.cloze-blur').forEach(el => {
    el.classList.remove('cloze-blur');
    el.classList.add('cloze-revealed');
  });

  document.getElementById('reveal-btn').classList.add('hidden');
  document.getElementById('improve-btn').classList.add('hidden');
  document.getElementById('grading-area').classList.remove('hidden');

  // 2. Fonética e tradução DA FRASE DO CARD (não de outra frase — bug antigo)
  let ctxEntry = chunks.find(c => c.is_context && c.eng.toLowerCase() === context.toLowerCase())
    || chunks.find(c => !c.is_word && c.eng.toLowerCase() === context.toLowerCase());
  let wordEntry = chunks.find(c => c.is_word)
    || chunks.find(c => c.eng.toLowerCase() === word.toLowerCase());

  renderReveal(word, context, ctxEntry, wordEntry, wordData, card);
  renderChunksList(chunks, context);
  updateYouglish(word);
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

      renderReveal(word, context, ctxEntry, wordEntry, wordData, card);
      renderChunksList(chunks, context);
    } catch (e) {
      if (currentCard === card) phonEl.classList.add('hidden');
      console.warn('[Study] Enriquecimento falhou:', e);
    }
  }
}

function renderReveal(word, context, ctxEntry, wordEntry, wordData, card) {
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
  const input = document.getElementById('grammar-input');
  const send = document.getElementById('grammar-send');
  const typing = showTyping();
  chatBusy = true;

  try {
    const level = await getCefrLevel();
    const system = grammarTutorPersona(sentence, word, level);
    const question = grammarInitialQuestion(sentence, word);
    const answer = await aiChat(
      [{ role: 'system', content: system }, { role: 'user', content: question }],
      { temperature: 0.5, max_tokens: 600 }
    );
    if (currentCard !== card) return;

    chatHistory = [
      { role: 'system', content: system },
      { role: 'user', content: question },
      { role: 'assistant', content: answer },
    ];
    typing?.remove();
    appendChatBubble('ai', answer);
    if (input) { input.disabled = false; input.placeholder = 'Sua dúvida sobre a frase...'; }
    if (send) send.disabled = false;
  } catch (e) {
    if (currentCard !== card) return;
    typing?.remove();
    appendChatBubble('ai', `<span style="color:var(--color-danger); font-weight:700;">${escapeHtml(e.message || 'Falha ao falar com o tutor.')}</span>`);
  } finally {
    if (currentCard === card) chatBusy = false;
  }
}

async function sendGrammarQuestion(text) {
  const card = currentCard;
  if (!card || chatHistory.length === 0) return;
  const input = document.getElementById('grammar-input');
  const send = document.getElementById('grammar-send');

  appendChatBubble('user', text);
  chatHistory.push({ role: 'user', content: text });
  chatBusy = true;
  if (send) send.disabled = true;
  const typing = showTyping();

  try {
    const answer = await aiChat(chatHistory, { temperature: 0.6, max_tokens: 600 });
    if (currentCard !== card) return;
    chatHistory.push({ role: 'assistant', content: answer });
    typing?.remove();
    appendChatBubble('ai', answer);
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

// ── YouGlish embutido ────────────────────────────────────────────────────────
function updateYouglish(word) {
  const box = document.getElementById('youglish-box');
  const fallback = document.getElementById('youglish-fallback');
  if (!box) return;
  box.classList.remove('hidden');
  fallback.href = `https://youglish.com/pronounce/${encodeURIComponent(word)}/english`;
  fallback.textContent = `📺 Ver "${word}" no YouGlish`;

  // Extensão (MV3): scripts remotos são proibidos pelo CSP → só o link.
  if (isExtension) {
    fallback.classList.remove('hidden');
    return;
  }

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
  const isCorrect = grade >= 2;
  playFeedbackSound(isCorrect ? 'correct' : 'wrong');
  stopAudio();

  if (isCorrect) {
    // XP real é creditado pelo trigger do Supabase quando logReview roda.
    const xp = parseInt(localStorage.getItem('lf_xp_today') || '0') + 10;
    localStorage.setItem('lf_xp_today', xp);

    consecutiveCorrect++;
    showXPAnimation('+10 XP');
    if (consecutiveCorrect === 5) app.showToast('🔥 5 em sequência! Continue!', 'info');
    if (consecutiveCorrect === 10) app.showToast('🚀 Você está em chamas! 10 seguidos!', 'info');
  } else {
    consecutiveCorrect = 0;
    showXPAnimation('Próxima vez! 💪', false);
  }

  sessionCards++;
  const gradedCard = currentCard;
  try {
    const res = await lfDb.logReview(currentCard.id, grade);
    // Guarda o necessário pra desfazer: estado anterior do card + card da fila
    lastReview = { prevCard: res?.prevCard || null, card: gradedCard, grade, isCorrect };
    updateUndoButton();
  } catch (e) {
    console.error('Failed to log review:', e);
    app.showToast('Erro ao salvar a revisão. Verifique sua conexão.', 'error');
  }
  dueQueue.shift();
  loadNextCard(app);
}

async function handleUndo(app) {
  if (!lastReview || !lastReview.prevCard) return;
  const { prevCard, card, isCorrect } = lastReview;
  lastReview = null;
  updateUndoButton();

  try {
    await lfDb.undoReview(prevCard);
  } catch (e) {
    console.error('Falha ao desfazer:', e);
    app.showToast('Não foi possível desfazer.', 'error');
    return;
  }

  // Reverte o progresso da sessão e recoloca o card no topo da fila
  sessionCards = Math.max(0, sessionCards - 1);
  if (isCorrect) {
    consecutiveCorrect = Math.max(0, consecutiveCorrect - 1);
    const xp = Math.max(0, parseInt(localStorage.getItem('lf_xp_today') || '0') - 10);
    localStorage.setItem('lf_xp_today', xp);
  }
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
  const card = currentCard;
  if (!card) return;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  try {
    // Remove props de runtime (_ctx/_chunks/_reverse não são colunas do banco)
    const { wordData, _ctx, _chunks, _reverse, ...clean } = card;
    await lfDb.updateCard({ ...clean, due_date: tomorrow.toISOString() });
  } catch (e) {
    console.error('Falha ao enterrar:', e);
    app.showToast('Erro ao adiar o card.', 'error');
    return;
  }
  app.showToast('Card adiado pra amanhã 💤', 'info');
  dueQueue.shift();
  loadNextCard(app);
}

function injectStyles() {
  if (document.getElementById('study-styles-v2')) return;
  document.getElementById('study-styles')?.remove();
  const style = document.createElement('style');
  style.id = 'study-styles-v2';
  style.innerHTML = `
    .study-layout { display: flex; height: 100%; width: 100%; background-color: var(--color-bg-alt); }
    .study-main { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 40px; position: relative; overflow-y: auto;}

    .media-container { width: 100%; max-width: 800px; height: 100px; background: var(--color-surface); border: 2px solid var(--color-border); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; margin-bottom: 32px; }

    .audio-wave-placeholder { display: flex; align-items: center; gap: 8px; opacity: 0.5; transition: opacity 0.3s; }
    .wave-bar { width: 8px; height: 30px; background: var(--color-secondary); border-radius: 4px; animation: wave 1s infinite alternate; }
    .wave-bar:nth-child(2) { animation-delay: 0.2s; height: 50px; }
    .wave-bar:nth-child(3) { animation-delay: 0.4s; height: 20px; }
    .wave-bar:nth-child(4) { animation-delay: 0.6s; height: 40px; }
    .wave-bar:nth-child(5) { animation-delay: 0.8s; height: 30px; }
    @keyframes wave { 0% { transform: scaleY(0.5); } 100% { transform: scaleY(1.2); } }

    .btn-play-audio { background: var(--color-secondary); color: white; border: none; border-bottom: 4px solid var(--color-secondary-shadow); width: 44px; height: 44px; border-radius: 22px; font-size: 18px; cursor: pointer; margin-left: 16px; display:flex; align-items:center; justify-content:center;}
    .btn-play-audio:active { transform: translateY(4px); border-bottom-width: 0; }

    .sentence-container { text-align: center; max-width: 800px; width: 100%; margin-bottom: 32px;}
    .sentence-text { font-size: 32px; font-weight: 800; color: var(--color-text); line-height: 1.5; margin-bottom: 32px; }

    .cloze-blur { background: var(--color-border); color: transparent; padding: 0 16px; border-radius: var(--radius-md); user-select: none; transition: all 0.3s; display: inline-block; min-width: 60px;}
    .cloze-revealed { background: rgba(88, 204, 2, 0.15); color: var(--color-primary); }

    .ex-chip { background: var(--color-surface); border: 2px solid var(--color-border); border-bottom-width: 4px; border-radius: 12px; padding: 10px 16px; font-family: var(--font-main); font-weight: 800; font-size: 16px; color: var(--color-text); cursor: pointer; transition: transform 0.1s; }
    .ex-chip:hover { border-color: var(--color-secondary); }
    .ex-chip:active { transform: translateY(2px); }
    .ex-chip-used { background: rgba(28,176,246,0.12); border-color: var(--color-secondary); }

    .reveal-btn { font-size: 20px; padding: 16px 40px; width:100%; max-width: 320px; margin: 0 auto; display: block; box-shadow: 0 4px 0 var(--color-primary-shadow);}
    .reveal-btn:disabled { opacity: 0.6; cursor: default; }

    .grading-buttons { margin-top: 16px; width: 100%; max-width: 600px;}
    .grading-row { display: flex; gap: 16px; width: 100%;}
    .grade-btn { flex: 1; font-family: var(--font-main); font-weight: 800; font-size: 18px; padding: 16px 8px; border-radius: var(--radius-md); border: none; cursor: pointer; color: white; display: flex; flex-direction: column; align-items: center; gap: 6px; transition: transform 0.1s, box-shadow 0.1s; }
    .grade-btn:active { transform: translateY(4px); box-shadow: 0 0 0 transparent !important; }

    .btn-danger { background: #ff4b4b; box-shadow: 0 4px 0 #cc3c3c; }
    .btn-warning { background: #ff9600; box-shadow: 0 4px 0 #cc7800; }
    .btn-secondary { background: var(--color-secondary); box-shadow: 0 4px 0 var(--color-secondary-shadow); }

    .study-sidebar { width: 380px; background: var(--color-surface); border-left: 2px solid var(--color-border); padding: 32px; overflow-y: auto; }
    .sidebar-title { font-size: 22px; font-weight: 900; margin-bottom: 24px; color: var(--color-text); display:flex; align-items:center; gap:8px;}
    .chunks-list { display: flex; flex-direction: column; gap: 16px; }

    .chunk-card { background: var(--color-surface); border: 2px solid var(--color-border); border-radius: var(--radius-lg); padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); position: relative; overflow: hidden;}
    .chunk-card::before { content:''; position:absolute; left:0; top:0; bottom:0; width:6px; background:var(--color-primary);}
    .chunk-en { font-weight: 900; font-size: 18px; color: var(--color-text); margin-bottom: 6px; }
    .chunk-br { font-size: 15px; color: var(--color-secondary); font-weight: 800; margin-bottom: 8px; }
    .chunk-pt { font-size: 14px; color: var(--color-text-light); font-style: italic; background: var(--color-bg-alt); display: inline-block; padding: 4px 10px; border-radius: 12px;}

    .chunk-action-btn { background: var(--color-secondary); color: white; border: none; border-radius: 50%; width: 36px; height: 36px; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
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
    #yg-widget-embed { width: 100%; min-height: 0; }
    #yg-widget-embed iframe { max-width: 100%; border-radius: var(--radius-md); }

    @media (max-width: 768px) {
      .study-layout { flex-direction: column; }
      .study-sidebar { width: 100%; border-left: none; border-top: 2px solid var(--color-border); }
      .grading-row { flex-wrap: wrap; }
      .grade-btn { flex: 1 1 40%; }
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
