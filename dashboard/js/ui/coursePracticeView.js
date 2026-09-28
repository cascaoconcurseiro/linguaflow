// dashboard/js/ui/coursePracticeView.js
// Player de prática (modo foco): ouvir a frase e digitá-la palavra por palavra.
// Serve a lição de um curso ou a prática avulsa de revisões/erros. Resultado
// gravado por rpc_course_commit_practice (idempotente por client_session_id);
// sair no meio grava a sessão como incompleta.

import { db } from '../../../utils/db.js';
import { escapeHTML } from '../../../utils/html.js';
import { soundEngine } from '../core/soundFx.js';
import { handleSlotKeydown, parsePastedText } from '../core/inputEngine.js';
import { createPracticeSession } from '../core/coursePracticeSession.js';
import { loadPrefs, savePrefs, stepPref, PREF_LIMITS } from '../core/coursePrefs.js';
import { playNaturalAudio, preloadNaturalAudio, stopAudio } from '../core/tts.js';

export const PENDING_COMMIT_KEY = 'lf_course_pending_commit';
const IDLE_AFTER_MS = 30_000;
const HEARTBEAT_SECONDS = 10;
const READING_GAP_MS = 600;
const HARD_SLOT_CH = 7;
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const DIFFICULTY_LABEL = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' };
const INSTRUCTION = {
  easy: 'Copie a frase em inglês com precisão enquanto ouve.',
  medium: 'Ouça e escreva. Só a primeira letra de cada palavra aparece.',
  hard: 'Ouça e escreva o que ouviu.',
};
// Unidades de vocabulário: a pista é o significado (ditado de uma palavra solta
// sem contexto seria ambíguo).
const WORD_KINDS = new Set(['word', 'verb_forms']);
const KIND_INSTRUCTION = {
  word: { easy: 'Copie a palavra enquanto ouve.', medium: 'Ouça e escreva a palavra.', hard: 'Ouça e escreva a palavra.' },
  verb_forms: { easy: 'Copie as três formas do verbo.', medium: 'Escreva base, passado e particípio.', hard: 'Escreva base, passado e particípio.' },
};
const COMBO_RULE = 'Acertar sem envio errado e sem dica soma combo. Dica, ver resposta ou pular quebram o combo; repetir o áudio não.';
export const ROLE_LABEL = {
  subject: 'Sujeito',
  predicate_verb: 'Verbo',
  predicate_adj: 'Predicado',
  direct_object: 'Objeto',
  discourse_marker: 'Expressão',
  adverbial: 'Adjunto',
};
const ROLE_CLASS = {
  subject: 'subject', predicate_verb: 'verb', predicate_adj: 'verb',
  direct_object: 'object', discourse_marker: 'slang', adverbial: 'slang',
};
const POS_LABEL = {
  noun: 'substantivo', verb: 'verbo', 'auxiliary verb': 'verbo auxiliar', adjective: 'adjetivo',
  adverb: 'advérbio', pronoun: 'pronome', determiner: 'determinante', preposition: 'preposição',
  conjunction: 'conjunção', interjection: 'interjeição', numeral: 'numeral', particle: 'partícula',
  'proper noun': 'nome próprio',
};

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatSpeed(value) {
  return `${Number(value).toString().replace('.', ',')}x`;
}

export function readPendingCommit() {
  try { return JSON.parse(sessionStorage.getItem(PENDING_COMMIT_KEY) || 'null'); } catch { return null; }
}

function writePendingCommit(payload) {
  try {
    if (payload) sessionStorage.setItem(PENDING_COMMIT_KEY, JSON.stringify(payload));
    else sessionStorage.removeItem(PENDING_COMMIT_KEY);
  } catch { /* storage indisponível: o retry manual continua na tela */ }
}

// Reenvia um resultado pendente (queda de rede, aba recarregada). A RPC é
// idempotente por client_session_id, então reenviar é seguro.
export async function flushPendingCourseCommit() {
  const pending = readPendingCommit();
  if (!pending) return null;
  const result = await db.courses.commitSession(pending);
  writePendingCommit(null);
  return result;
}

// Pistas do modo médio: iniciais separadas por ";" (ex.: "W; i; t; c; c").
export function initialsHint(tokens) {
  return tokens.map((t) => t.targetWord[0]).join('; ');
}

export async function renderCoursePractice(container, app, params = {}) {
  const kind = ['review', 'mistakes'].includes(params.kind) ? params.kind : 'lesson';
  const difficulty = DIFFICULTIES.has(params.difficulty) ? params.difficulty : 'medium';
  const backTarget = kind === 'lesson'
    ? { route: 'courses', params: { tab: 'course', courseId: params.courseId } }
    : { route: 'courses', params: { tab: kind === 'review' ? 'review' : 'mistakes' } };

  let disposed = false;
  let timer = null;
  let session = null;
  let committedOnExit = false;
  const cleanups = [];
  app.onLeaveView?.(() => {
    disposed = true;
    clearInterval(timer);
    stopAudio();
    commitIncomplete();
    cleanups.forEach((fn) => fn());
  });

  renderLoading();

  let title = '';
  let courseTitle = '';
  let units = [];
  let lessonId = null;
  try {
    if (kind === 'lesson') {
      const lesson = await db.courses.getLesson(String(params.lessonId || ''));
      if (lesson) {
        lessonId = lesson.id;
        title = `${lesson.chapter_number}. ${lesson.title}`;
        courseTitle = lesson.course_catalog?.title || '';
        units = lesson.units;
      }
    } else {
      units = await db.courses.getUnits(params.unitIds || []);
      title = kind === 'review' ? 'Revisão' : 'Caderno de erros';
      courseTitle = `${units.length} ${units.length === 1 ? 'frase' : 'frases'}`;
    }
  } catch (err) {
    if (disposed) return;
    renderError('Não foi possível carregar as frases. Verifique a conexão e tente de novo.', err);
    return;
  }
  if (disposed) return;
  if (units.length === 0) {
    renderError(kind === 'lesson'
      ? 'Esta lição não existe ou ainda não tem frases publicadas.'
      : 'Não há frases para praticar agora.');
    return;
  }

  session = createPracticeSession(units);
  const startedAt = new Date().toISOString();
  const clientSessionId = crypto.randomUUID();
  let prefs = loadPrefs();
  soundEngine.enabled = prefs.sfx;
  let activeSeconds = 0;
  let unsentSeconds = 0;
  let lastActivity = Date.now();
  let paused = false;
  let audioToken = 0;
  let audioPlaying = false;
  let heartbeatWarned = false;
  let advancing = false;
  let focusedSlot = 0;

  renderShell();
  showUnit();

  timer = setInterval(() => {
    if (paused || disposed || session.finished) return;
    if (Date.now() - lastActivity > IDLE_AFTER_MS) return; // tempo ocioso não conta
    activeSeconds += 1;
    unsentSeconds += 1;
    const el = container.querySelector('#course-timer');
    if (el) el.textContent = formatTime(activeSeconds);
    if (unsentSeconds >= HEARTBEAT_SECONDS) {
      unsentSeconds = 0;
      db.logSession(HEARTBEAT_SECONDS, 'pwa').catch((err) => {
        if (!heartbeatWarned) console.warn('[CoursePractice] study_time_heartbeat_failed', err?.kind || err?.message);
        heartbeatWarned = true;
      });
    }
  }, 1000);

  // Um único listener global por render, removido ao sair da rota.
  const onActivity = () => { lastActivity = Date.now(); };
  const onKeydown = (e) => handleGlobalKey(e);
  const onBeforeUnload = (e) => {
    if (session && !session.finished && session.resolvedCount > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  container.addEventListener('keydown', onKeydown);
  container.addEventListener('pointerdown', onActivity);
  window.addEventListener('beforeunload', onBeforeUnload);
  cleanups.push(() => {
    container.removeEventListener('keydown', onKeydown);
    container.removeEventListener('pointerdown', onActivity);
    window.removeEventListener('beforeunload', onBeforeUnload);
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  function renderLoading() {
    container.innerHTML = `
      <div class="course-player-shell" aria-busy="true">
        <main class="course-player-body"><p class="course-pause-text" role="status">Carregando as frases…</p></main>
      </div>`;
  }

  function renderError(message, err) {
    if (err) console.warn('[CoursePractice] load_failed', err?.kind || err?.message);
    container.innerHTML = `
      <div class="course-player-shell" style="align-items:center;justify-content:center;padding:24px;">
        <div class="course-pause-card" role="alert">
          <h2 class="course-pause-title">Não deu para abrir a prática</h2>
          <p class="course-pause-text">${escapeHTML(message)}</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
            ${err ? '<button class="course-btn-primary-lg" type="button" data-action="retry-load">Tentar de novo</button>' : ''}
            <button class="course-player-btn-back" type="button" data-action="back">Voltar</button>
          </div>
        </div>
      </div>`;
    container.querySelector('[data-action="retry-load"]')?.addEventListener('click', () => renderCoursePractice(container, app, params));
    container.querySelector('[data-action="back"]')?.addEventListener('click', () => app.navigate(backTarget.route, backTarget.params));
  }

  function renderShell() {
    container.innerHTML = `
      <div class="course-player-shell ${prefs.reduceMotion ? 'course-reduce-motion' : ''}">
        <header class="course-player-topbar">
          <button class="course-player-btn-back" type="button" data-action="exit">
            <span aria-hidden="true">←</span><span>${kind === 'lesson' ? 'Capítulos' : 'Voltar'}</span>
          </button>
          <div class="course-player-title">
            <span>${escapeHTML(title)}</span>
            <span class="course-player-question-indicator" id="course-question" aria-live="polite"></span>
          </div>
          <div class="course-player-topbar-actions">
            <button class="course-player-btn-icon" type="button" data-action="theme" aria-label="Alternar tema claro/escuro">◐</button>
            <button class="course-player-btn-icon" type="button" data-action="settings" aria-label="Configurações da prática" aria-haspopup="dialog">⚙</button>
            <button class="course-player-btn-icon" type="button" data-action="pause" aria-label="Pausar (Esc)">⏸</button>
          </div>
        </header>
        <div class="course-player-progress-bar-wrap" role="progressbar" aria-label="Progresso" aria-valuemin="0" aria-valuemax="${session.total}" aria-valuenow="0">
          <div class="course-player-progress-bar" id="course-progress" style="width:0%"></div>
        </div>

        <section class="course-player-hud" aria-label="Sessão">
          <div class="course-hud-group">
            <div class="course-pop-anchor">
              <button class="course-hud-pill" type="button" data-action="pop-speed" aria-haspopup="true" aria-expanded="false" id="course-speed-pill">Velocidade ${formatSpeed(prefs.speed)}</button>
              <div class="course-popover" id="course-pop-speed" role="group" aria-label="Velocidade" hidden></div>
            </div>
            <div class="course-pop-anchor">
              <button class="course-hud-pill" type="button" data-action="pop-readings" aria-haspopup="true" aria-expanded="false" id="course-readings-pill">Leituras ${prefs.readings}x</button>
              <div class="course-popover" id="course-pop-readings" role="group" aria-label="Leituras" hidden></div>
            </div>
          </div>
          <div class="course-hud-group">
            <div class="course-hud-pill"><span>Tempo de prática</span><strong id="course-timer">00:00</strong></div>
            <div class="course-hud-pill"><span>Pontos</span><strong id="course-score">0</strong></div>
            <div class="course-hud-pill combo" id="course-combo-pill" title="${escapeHTML(COMBO_RULE)}"><span>Combo</span><strong id="course-combo">0</strong></div>
          </div>
        </section>

        <main class="course-player-body">
          <p class="course-hub-subtitle" style="margin:0;">${escapeHTML(courseTitle)} · ${DIFFICULTY_LABEL[difficulty]}</p>
          <h2 class="course-player-prompt" id="course-prompt" lang="en"></h2>
          <p class="course-player-cue" id="course-cue" hidden></p>
          <p class="course-player-instruction" id="course-instruction">${INSTRUCTION[difficulty]}</p>
          <div class="course-sentence-wrap" id="sentence-slots" role="group" aria-label="Escreva a frase, uma palavra por campo"></div>
          <p class="course-player-helper">Espaço: próxima palavra, ou conferir quando tudo estiver preenchido · A pontuação é opcional</p>
          <p id="course-feedback" class="course-pause-text" role="status" aria-live="polite"></p>
          <section class="course-breakdown-panel" id="course-breakdown" aria-label="Estrutura, pronúncia e significado" hidden></section>
        </main>

        <footer class="course-player-bottombar">
          <div class="course-action-bar">
            <button class="course-action" type="button" data-action="previous" aria-label="Frase anterior">‹</button>
            <button class="course-action" type="button" data-action="replay"><kbd class="course-key-badge">Ctrl</kbd><kbd class="course-key-badge">'</kbd> Repetir áudio</button>
            <button class="course-action" type="button" data-action="hint" title="${escapeHTML(COMBO_RULE)}"><kbd class="course-key-badge">Ctrl</kbd><kbd class="course-key-badge">Shift</kbd><kbd class="course-key-badge">;</kbd> Dica desta palavra</button>
            <button class="course-action course-action--primary" type="button" data-action="submit"><kbd class="course-key-badge">Enter</kbd> Conferir</button>
            <button class="course-action" type="button" data-action="reveal" title="${escapeHTML(COMBO_RULE)}"><kbd class="course-key-badge">Ctrl</kbd><kbd class="course-key-badge">;</kbd> Mostrar resposta</button>
            <button class="course-action" type="button" data-action="skip" aria-label="Pular esta frase e ir para a próxima">›</button>
          </div>
        </footer>

        <div class="course-pause-backdrop" id="course-pause" role="dialog" aria-modal="true" aria-labelledby="pause-title" hidden>
          <div class="course-pause-card">
            <h2 id="pause-title" class="course-pause-title">Pausa</h2>
            <p class="course-pause-text">O cronômetro está parado. O que você já digitou continua aqui.</p>
            <button class="course-btn-resume" type="button" data-action="resume">Continuar</button>
          </div>
        </div>

        <div class="course-pause-backdrop" id="course-settings" role="dialog" aria-modal="true" aria-labelledby="settings-title" hidden>
          <div class="course-pause-card course-settings-card"></div>
        </div>
      </div>`;

    container.querySelector('.course-player-shell').addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      onActivity();
      const action = target.dataset.action;
      const handlers = {
        exit: exitPractice,
        theme: toggleTheme,
        settings: () => openSettings(),
        'close-settings': closeSettings,
        pause: () => setPaused(true),
        resume: () => setPaused(false),
        replay: () => playAudio({ readings: 1 }),
        submit: submitPhrase,
        reveal: toggleBreakdown,
        hint: () => hintWord(focusedSlot),
        skip: skipPhrase,
        previous: goPrevious,
        'back-to-current': goCurrent,
        'pop-speed': () => togglePopover('speed'),
        'pop-readings': () => togglePopover('readings'),
        'step-speed-down': () => changePref('speed', -1),
        'step-speed-up': () => changePref('speed', +1),
        'step-readings-down': () => changePref('readings', -1),
        'step-readings-up': () => changePref('readings', +1),
        'save-vocab': () => saveVocabulary(target),
        'save-note': () => saveNote(target),
      };
      handlers[action]?.();
    });
    container.querySelector('#course-settings').addEventListener('change', (e) => {
      const name = e.target.dataset.pref;
      if (name === 'theme') applyTheme(e.target.value);
      else if (name) setPrefs({ ...prefs, [name]: e.target.checked });
    });
  }

  function showUnit() {
    const unit = session.unit;
    const reviewing = session.isReviewingPrevious;
    closeBreakdown();
    setFeedback(reviewing ? 'Frase já respondida (só consulta).' : '');
    advancing = false;

    const shown = Math.min(session.index + 1, session.total);
    container.querySelector('#course-question').textContent = `${shown} / ${session.total}`;
    container.querySelector('#course-progress').style.width = `${Math.round((session.resolvedCount / session.total) * 100)}%`;
    container.querySelector('.course-player-progress-bar-wrap').setAttribute('aria-valuenow', String(session.resolvedCount));

    const isWord = WORD_KINDS.has(unit.kind);
    const cue = container.querySelector('#course-cue');
    cue.hidden = !(isWord && difficulty !== 'easy' && !reviewing);
    cue.textContent = cue.hidden ? '' : `Significado: ${unit.translation_pt}`;
    container.querySelector('#course-instruction').textContent = (KIND_INSTRUCTION[unit.kind] || INSTRUCTION)[difficulty] || INSTRUCTION[difficulty];

    const prompt = container.querySelector('#course-prompt');
    if (reviewing || difficulty === 'easy') prompt.textContent = unit.text;
    else if (difficulty === 'medium') prompt.textContent = initialsHint(session.tokens);
    else prompt.textContent = '';
    prompt.hidden = !prompt.textContent;

    const slots = container.querySelector('#sentence-slots');
    slots.innerHTML = session.tokens.map((token, idx) => {
      const width = difficulty === 'hard' && !reviewing ? HARD_SLOT_CH : token.charWidth;
      const placeholder = difficulty === 'medium' && !reviewing ? `${token.targetWord[0]}` : '';
      const value = reviewing ? token.targetWord : '';
      return `
        <span class="course-word-unit">
          ${token.punctuationBefore ? `<span class="course-punctuation-mark" aria-hidden="true">${escapeHTML(token.punctuationBefore)}</span>` : ''}
          <input class="course-word-input course-word-input--line ${reviewing ? 'is-correct' : ''}" type="text" data-slot-index="${idx}"
            style="width:calc(${width}ch + 12px);" placeholder="${escapeHTML(placeholder)}" value="${escapeHTML(value)}"
            ${reviewing ? 'readonly' : ''} autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
            aria-label="Palavra ${idx + 1} de ${session.tokens.length}${token.punctuationAfter ? `, seguida de ${escapeHTML(token.punctuationAfter)} (opcional)` : ''}" />
          ${token.punctuationAfter ? `<span class="course-punctuation-mark" aria-hidden="true">${escapeHTML(token.punctuationAfter)}</span>` : ''}
        </span>`;
    }).join('') + (reviewing ? '<button class="course-action course-action--primary" type="button" data-action="back-to-current">Voltar à frase atual</button>' : '');

    const inputs = [...slots.querySelectorAll('.course-word-input')];
    inputs.forEach((input, idx) => {
      input.addEventListener('focus', () => { focusedSlot = idx; });
      if (reviewing) return;
      input.addEventListener('keydown', (e) => {
        onActivity();
        if (paused) { e.preventDefault(); return; }
        if (e.ctrlKey || e.metaKey) return; // atalhos globais
        handleSlotKeydown(e, idx, inputs.length, {
          focusSlot: (target, toEnd) => {
            const el = inputs[target];
            if (!el) return;
            el.focus();
            if (toEnd) el.selectionStart = el.selectionEnd = el.value.length;
          },
          submit: submitPhrase,
          playKeySound: () => soundEngine.playKey(),
        });
      });
      input.addEventListener('input', () => {
        input.classList.remove('is-wrong', 'is-hinted');
        // Difícil: o campo cresce com o texto, sem entregar o tamanho da resposta.
        if (difficulty === 'hard') input.style.width = `calc(${Math.max(HARD_SLOT_CH, input.value.length + 1)}ch + 12px)`;
      });
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const words = parsePastedText(e.clipboardData?.getData('text') || '');
        words.forEach((w, offset) => { if (inputs[idx + offset]) inputs[idx + offset].value = w; });
        inputs[Math.min(inputs.length - 1, idx + Math.max(0, words.length - 1))]?.focus();
      });
    });

    if (reviewing) {
      toggleBreakdown(true);
      container.querySelector('[data-action="back-to-current"]')?.focus();
    } else {
      focusedSlot = 0;
      inputs[0]?.focus();
      if (prefs.audio) playAudio({ readings: prefs.readings });
      const next = units[session.index + 1];
      if (next) preloadNaturalAudio(next.text, { lang: 'en-US' });
    }
    updateActionStates();
  }

  function updateActionStates() {
    const reviewing = session.isReviewingPrevious;
    const set = (action, disabled) => {
      const el = container.querySelector(`[data-action="${action}"]`);
      if (el) el.disabled = disabled;
    };
    set('previous', session.index === 0);
    set('hint', reviewing || session.currentDone);
    set('submit', reviewing || session.currentDone);
    set('skip', reviewing || session.currentDone);
  }

  function updateHud() {
    container.querySelector('#course-score').textContent = String(session.score);
    container.querySelector('#course-combo').textContent = String(session.streak);
    container.querySelector('#course-combo-pill').classList.toggle('pop', session.streak > 0);
  }

  function setFeedback(text) {
    const el = container.querySelector('#course-feedback');
    if (el) el.textContent = text;
  }

  // ── Áudio ─────────────────────────────────────────────────────────────────

  async function playAudio({ readings = 1 } = {}) {
    const unit = session.unit;
    if (!unit || paused) return;
    soundEngine.init();
    stopAudio();
    const token = ++audioToken;
    const btn = container.querySelector('[data-action="replay"]');
    audioPlaying = true;
    btn?.classList.add('playing');
    try {
      for (let i = 0; i < readings; i++) {
        if (token !== audioToken || disposed || paused) break;
        const played = await playNaturalAudio(unit.text, { lang: 'en-US', rate: prefs.speed });
        if (played === false) break;
        if (i < readings - 1) await new Promise((r) => setTimeout(r, READING_GAP_MS));
      }
    } catch (err) {
      if (token === audioToken) setFeedback('Não foi possível tocar o áudio. Tente de novo em instantes.');
      console.warn('[CoursePractice] audio_failed', err?.message);
    } finally {
      if (token === audioToken) {
        audioPlaying = false;
        btn?.classList.remove('playing');
      }
    }
  }

  function stopReading() {
    audioToken += 1;
    audioPlaying = false;
    stopAudio();
  }

  // ── Ações ─────────────────────────────────────────────────────────────────

  function currentInputs() {
    return [...container.querySelectorAll('#sentence-slots .course-word-input')];
  }

  function submitPhrase() {
    if (paused || advancing || session.finished || session.isReviewingPrevious || session.currentDone) return;
    const inputs = currentInputs();
    const result = session.submit(inputs.map((i) => i.value));

    if (!result.isCorrect) {
      soundEngine.playChord('error');
      result.correctIndices.forEach((i) => { inputs[i].classList.remove('is-wrong'); inputs[i].classList.add('is-correct'); });
      result.errorIndices.forEach((i) => {
        const el = inputs[i];
        el.classList.remove('is-correct', 'is-wrong');
        void el.offsetWidth; // reinicia a animação de erro em tentativas seguidas
        el.classList.add('is-wrong');
      });
      const n = result.errorIndices.length;
      setFeedback(n === 1 ? '1 palavra não confere. As certas foram mantidas.' : `${n} palavras não conferem. As certas foram mantidas.`);
      updateHud();
      const first = inputs[result.errorIndices[0]];
      first?.focus();
      first?.select();
      return;
    }

    advancing = true;
    soundEngine.playChord(session.streak > 0 && session.streak % 5 === 0 ? 'milestone' : 'word');
    inputs.forEach((i) => { i.classList.remove('is-wrong', 'is-hinted'); i.classList.add('is-correct'); i.readOnly = true; });
    const done = session.unit;
    const example = done?.example_en ? ` · Exemplo: ${done.example_en} (${done.example_pt || ''})` : '';
    setFeedback(`${result.clean ? `Certo! +${result.gained}` : `Certo. +${result.gained}`}${example}`);
    updateHud();
    updateActionStates();
    stopReading();
    setTimeout(advance, session.unit?.example_en ? 1600 : 500);
  }

  function advance() {
    if (disposed) return;
    const more = session.next();
    if (more && !session.finished) showUnit();
    else if (session.finished) finish();
    else showUnit();
  }

  function hintWord(slot) {
    if (paused || session.isReviewingPrevious || session.currentDone) return;
    const inputs = currentInputs();
    const input = inputs[slot] || inputs[0];
    const word = session.hintWord(Number(input?.dataset.slotIndex ?? 0));
    if (!word || !input) return;
    input.value = '';
    input.placeholder = word;
    input.classList.remove('is-wrong');
    input.classList.add('is-hinted');
    if (difficulty === 'hard') input.style.width = `calc(${Math.max(HARD_SLOT_CH, word.length + 1)}ch + 12px)`;
    input.focus();
    updateHud();
    setFeedback('Dica usada: esta frase não soma combo.');
  }

  function skipPhrase() {
    if (paused || advancing || session.isReviewingPrevious || session.currentDone) return;
    session.skip(currentInputs().map((i) => i.value));
    updateHud();
    stopReading();
    advance();
  }

  function goPrevious() {
    if (paused || advancing || !session.previous()) return;
    stopReading();
    showUnit();
  }

  function goCurrent() {
    session.resume();
    showUnit();
  }

  function closeBreakdown() {
    const panel = container.querySelector('#course-breakdown');
    panel.hidden = true;
    panel.innerHTML = '';
  }

  async function toggleBreakdown(forceOpen = false) {
    if (paused) return;
    const panel = container.querySelector('#course-breakdown');
    if (!panel.hidden && !forceOpen) {
      closeBreakdown();
      return;
    }
    if (!session.isReviewingPrevious && !session.currentDone && session.reveal()) {
      updateHud();
      setFeedback('Resposta revelada: esta frase não soma combo.');
    }
    const unit = session.unit;
    const groups = Array.isArray(unit.syntax_groups) ? unit.syntax_groups : [];
    const words = Array.isArray(unit.annotations) ? unit.annotations : [];
    const wordsFor = (group) => words.filter((w) => group.surface.toLowerCase().split(/\s+/)
      .map((s) => s.replace(/^[^a-z]+|[^a-z']+$/g, '')).includes(w.surface.toLowerCase()));
    const rendered = new Set();
    panel.innerHTML = `
      <p class="course-breakdown-translation" lang="en">${escapeHTML(unit.text)}</p>
      <p style="margin:0;">${escapeHTML(unit.translation_pt)}</p>
      ${unit.ipa ? `<span class="course-breakdown-ipa">${escapeHTML(unit.ipa)}</span>` : ''}
      ${unit.explanation_note ? `<p class="course-breakdown-note">${escapeHTML(unit.explanation_note)}</p>` : ''}
      ${unit.example_en ? `<p class="course-breakdown-note"><strong lang="en">${escapeHTML(unit.example_en)}</strong> — ${escapeHTML(unit.example_pt || '')}</p>` : ''}
      <div class="course-structure" aria-label="Estrutura da frase">
        ${groups.map((g) => {
          const ws = wordsFor(g).filter((w) => !rendered.has(w) && rendered.add(w));
          return `<div class="course-structure-group ${ROLE_CLASS[g.role] || 'slang'}">
            <span class="course-structure-role">${escapeHTML(ROLE_LABEL[g.role] || g.role || '')}</span>
            <div class="course-structure-words">${ws.map((w) => `
              <span class="course-structure-word">
                ${w.ipa ? `<span class="course-breakdown-ipa">${escapeHTML(w.ipa)}</span>` : ''}
                <strong lang="en">${escapeHTML(w.surface)}</strong>
                <small>${escapeHTML(POS_LABEL[w.pos] || w.pos || '')}${w.gloss ? ` · ${escapeHTML(w.gloss)}` : ''}</small>
              </span>`).join('') || `<strong lang="en">${escapeHTML(g.surface)}</strong>`}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="course-breakdown-actions">
        <button type="button" class="course-player-btn-back" data-action="save-vocab">★ Salvar no vocabulário</button>
        <label class="course-note-field">
          <span>Nota pessoal</span>
          <textarea id="course-note-input" maxlength="2000" rows="2"></textarea>
        </label>
        <button type="button" class="course-player-btn-back" data-action="save-note">Salvar nota</button>
      </div>`;
    panel.hidden = false;
    db.courses.getNote(unit.id).then((note) => {
      const field = container.querySelector('#course-note-input');
      if (field && !field.value && note) field.value = note;
    }).catch(() => {});
  }

  async function saveVocabulary(btn) {
    const unit = session.unit;
    if (!unit || btn.disabled) return;
    btn.disabled = true;
    try {
      await db.courses.saveVocabulary(unit.id);
      btn.textContent = '★ Salvo';
      app.showToast?.('Frase salva no vocabulário.', 'success');
    } catch (err) {
      btn.disabled = false;
      console.warn('[CoursePractice] save_vocabulary_failed', err?.kind || err?.message);
      app.showToast?.('Não foi possível salvar agora. Tente de novo.', 'error');
    }
  }

  async function saveNote(btn) {
    const unit = session.unit;
    const input = container.querySelector('#course-note-input');
    const content = input?.value.trim();
    if (!unit || !content || btn.disabled) {
      input?.focus();
      return;
    }
    btn.disabled = true;
    try {
      await db.courses.saveNote(unit.id, content);
      app.showToast?.('Nota salva.', 'success');
    } catch (err) {
      console.warn('[CoursePractice] save_note_failed', err?.kind || err?.message);
      app.showToast?.('Não foi possível salvar a nota. Tente de novo.', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  // ── Preferências ──────────────────────────────────────────────────────────

  function setPrefs(next) {
    prefs = savePrefs(next);
    soundEngine.enabled = prefs.sfx;
    container.querySelector('.course-player-shell')?.classList.toggle('course-reduce-motion', prefs.reduceMotion);
    container.querySelector('#course-speed-pill').textContent = `Velocidade ${formatSpeed(prefs.speed)}`;
    container.querySelector('#course-readings-pill').textContent = `Leituras ${prefs.readings}x`;
    renderPopovers();
    if (!container.querySelector('#course-settings').hidden) renderSettings();
  }

  function changePref(name, direction) {
    setPrefs(stepPref(prefs, name, direction));
  }

  function stepper(name, label, value, downLabel, upLabel) {
    const { min, max } = PREF_LIMITS[name];
    return `
      <div class="course-stepper" role="group" aria-label="${label}">
        <button type="button" class="course-player-btn-icon" data-action="step-${name}-down" aria-label="${downLabel}" ${prefs[name] <= min ? 'disabled' : ''}>−</button>
        <span role="spinbutton" aria-label="${label}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${prefs[name]}">${value}</span>
        <button type="button" class="course-player-btn-icon" data-action="step-${name}-up" aria-label="${upLabel}" ${prefs[name] >= max ? 'disabled' : ''}>+</button>
      </div>`;
  }

  function renderPopovers() {
    container.querySelector('#course-pop-speed').innerHTML = stepper('speed', 'Velocidade', formatSpeed(prefs.speed), 'Mais devagar', 'Mais rápido');
    container.querySelector('#course-pop-readings').innerHTML = stepper('readings', 'Leituras', `${prefs.readings}x`, 'Menos leituras', 'Mais leituras');
  }

  function togglePopover(name) {
    ['speed', 'readings'].forEach((other) => {
      const pop = container.querySelector(`#course-pop-${other}`);
      const pill = container.querySelector(`#course-${other}-pill`);
      const open = other === name ? pop.hidden : false;
      if (open) renderPopovers();
      pop.hidden = !open;
      pill.setAttribute('aria-expanded', String(open));
    });
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    if (typeof app.setTheme === 'function') app.setTheme(theme);
    else if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
  }

  function toggleTheme() {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  }

  function renderSettings() {
    const card = container.querySelector('.course-settings-card');
    card.innerHTML = `
      <h2 id="settings-title" class="course-pause-title">Configurações</h2>
      <label class="course-setting-row">
        <span>Aparência</span>
        <select data-pref="theme">
          <option value="light" ${currentTheme() === 'light' ? 'selected' : ''}>Claro</option>
          <option value="dark" ${currentTheme() === 'dark' ? 'selected' : ''}>Escuro</option>
        </select>
      </label>
      <label class="course-setting-row"><span>Áudio da frase</span><input type="checkbox" role="switch" data-pref="audio" ${prefs.audio ? 'checked' : ''} /></label>
      <label class="course-setting-row"><span>Sons de digitação e feedback</span><input type="checkbox" role="switch" data-pref="sfx" ${prefs.sfx ? 'checked' : ''} /></label>
      <label class="course-setting-row"><span>Reduzir movimento</span><input type="checkbox" role="switch" data-pref="reduceMotion" ${prefs.reduceMotion ? 'checked' : ''} /></label>
      <div class="course-setting-row"><span>Leituras</span>${stepper('readings', 'Leituras', prefs.readings, 'Menos leituras', 'Mais leituras')}</div>
      <div class="course-setting-row"><span>Velocidade</span>${stepper('speed', 'Velocidade', formatSpeed(prefs.speed), 'Mais devagar', 'Mais rápido')}</div>
      <p class="course-hub-subtitle" style="margin:0;">Salvo neste navegador.</p>
      <button type="button" class="course-btn-resume" data-action="close-settings">Fechar</button>`;
  }

  function openSettings() {
    renderSettings();
    const dialog = container.querySelector('#course-settings');
    dialog.hidden = false;
    paused = true;
    dialog.querySelector('select')?.focus();
  }

  function closeSettings() {
    container.querySelector('#course-settings').hidden = true;
    paused = false;
    lastActivity = Date.now();
    container.querySelector('#sentence-slots .course-word-input:not([readonly])')?.focus();
  }

  function setPaused(value) {
    if (session.finished) return;
    paused = value;
    const overlay = container.querySelector('#course-pause');
    overlay.hidden = !paused;
    container.querySelectorAll('#sentence-slots .course-word-input:not(.is-correct)').forEach((i) => { i.readOnly = paused; });
    if (paused) {
      stopReading();
      overlay.querySelector('[data-action="resume"]')?.focus();
    } else {
      lastActivity = Date.now();
      container.querySelector('#sentence-slots .course-word-input:not([readonly])')?.focus();
    }
  }

  function exitPractice() {
    if (!session.finished && session.resolvedCount > 0
      && !confirm('Sair da prática? O que você já respondeu fica salvo como sessão incompleta.')) return;
    app.navigate(backTarget.route, backTarget.params);
  }

  function handleGlobalKey(e) {
    onActivity();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!container.querySelector('#course-settings').hidden) closeSettings();
      else setPaused(!paused);
      return;
    }
    if (paused || !(e.ctrlKey || e.metaKey)) return;
    // e.code (tecla física) cobre US e ABNT2; e.key cobre teclados virtuais.
    const isSemicolon = e.code === 'Semicolon' || e.code === 'Slash' || e.key === ';' || e.key === ':';
    if (e.code === 'Quote' || e.code === 'Backquote' || e.key === "'" || e.key === '"' || e.code === 'Period' || e.key === '.') {
      e.preventDefault();
      playAudio({ readings: 1 });
    } else if (isSemicolon && e.shiftKey) {
      e.preventDefault();
      hintWord(focusedSlot);
    } else if (isSemicolon) {
      e.preventDefault();
      toggleBreakdown();
    }
  }

  // ── Conclusão e sessão incompleta ─────────────────────────────────────────

  function buildPayload(completed) {
    return {
      clientSessionId,
      kind,
      lessonId,
      difficulty,
      startedAt,
      activeTimeSeconds: activeSeconds,
      score: session.score,
      highestCombo: session.highestCombo,
      results: session.buildResults({ onlyAnswered: !completed }),
      completed,
    };
  }

  function flushHeartbeat() {
    if (unsentSeconds > 0) {
      db.logSession(unsentSeconds, 'pwa').catch(() => {});
      unsentSeconds = 0;
    }
  }

  // Saiu no meio: grava o que foi respondido (tempo ativo entra na análise).
  function commitIncomplete() {
    if (!session || session.finished || committedOnExit || session.resolvedCount === 0) return;
    committedOnExit = true;
    flushHeartbeat();
    const payload = buildPayload(false);
    writePendingCommit(payload);
    db.courses.commitPractice(payload)
      .then(() => writePendingCommit(null))
      .catch((err) => console.warn('[CoursePractice] incomplete_commit_failed', err?.kind || err?.message));
  }

  function finish() {
    clearInterval(timer);
    stopReading();
    soundEngine.playChord('complete');
    flushHeartbeat();
    const summary = session.summary();
    const payload = buildPayload(true);
    writePendingCommit(payload);
    const nextLessonId = params.nextLessonId || null;

    container.innerHTML = `
      <div class="course-player-shell" style="align-items:center;justify-content:center;padding:24px;">
        <div class="course-pause-card" style="max-width:560px;">
          <h2 class="course-pause-title">${kind === 'lesson' ? 'Capítulo concluído' : 'Prática concluída'}</h2>
          <p class="course-pause-text">${escapeHTML(title)}</p>
          <dl class="course-summary-grid">
            <div class="course-hud-pill"><dt>Pontos</dt><dd>${session.score}</dd></div>
            <div class="course-hud-pill"><dt>De primeira</dt><dd>${summary.accuracy}%</dd></div>
            <div class="course-hud-pill"><dt>Melhor combo</dt><dd>${session.highestCombo}</dd></div>
            <div class="course-hud-pill"><dt>Tempo ativo</dt><dd>${formatTime(activeSeconds)}</dd></div>
          </dl>
          <p id="course-commit-status" class="course-pause-text" role="status" aria-live="polite">Salvando seu progresso…</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
            <button class="course-player-btn-back" type="button" id="btn-retry-commit" hidden>Tentar salvar de novo</button>
            <button class="course-player-btn-back" type="button" id="btn-practice-again">Praticar de novo</button>
            ${nextLessonId ? '<button class="course-btn-primary-lg" type="button" id="btn-next-lesson">Próximo capítulo</button>' : ''}
            <button class="${nextLessonId ? 'course-player-btn-back' : 'course-btn-primary-lg'}" type="button" id="btn-finish-lesson">${kind === 'lesson' ? 'Voltar ao curso' : 'Voltar'}</button>
          </div>
        </div>
      </div>`;

    const status = container.querySelector('#course-commit-status');
    const retry = container.querySelector('#btn-retry-commit');
    const commit = async () => {
      retry.hidden = true;
      status.textContent = 'Salvando seu progresso…';
      try {
        const res = await db.courses.commitPractice(payload);
        writePendingCommit(null);
        const mistakesNote = summary.mistakes > 0 || summary.hints > 0 ? ' Frases com erro ou dica voltam amanhã na revisão.' : '';
        status.textContent = kind === 'lesson'
          ? `Progresso salvo: ${Number(res?.percent_completed ?? 0).toFixed(0)}% do curso.${mistakesNote}`
          : `Revisão salva.${mistakesNote}`;
      } catch (err) {
        console.warn('[CoursePractice] commit_failed', err?.kind || err?.message);
        status.textContent = 'Não foi possível salvar agora. O resultado ficou guardado neste navegador e será reenviado.';
        retry.hidden = false;
      }
    };
    retry.addEventListener('click', commit);
    container.querySelector('#btn-practice-again').addEventListener('click', () => app.navigate('course-practice', { ...params }));
    container.querySelector('#btn-next-lesson')?.addEventListener('click', () => app.navigate('courses', { tab: 'course', courseId: params.courseId, openLessonId: nextLessonId }));
    const back = container.querySelector('#btn-finish-lesson');
    back.addEventListener('click', () => app.navigate(backTarget.route, backTarget.params));
    back.focus();
    commit();
  }
}
