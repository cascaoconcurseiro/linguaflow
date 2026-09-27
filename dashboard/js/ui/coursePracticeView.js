// dashboard/js/ui/coursePracticeView.js
// Player de prática de curso (modo foco): ouvir a frase e digitá-la palavra
// por palavra. Conteúdo vem de course_units; o resultado é gravado pela RPC
// rpc_commit_course_session (idempotente por client_session_id).

import { db } from '../../../utils/db.js';
import { escapeHTML } from '../../../utils/html.js';
import { soundEngine } from '../core/soundFx.js';
import { handleSlotKeydown, parsePastedText } from '../core/inputEngine.js';
import { createPracticeSession, comboMultiplier } from '../core/coursePracticeSession.js';
import { playNaturalAudio, preloadNaturalAudio, stopAudio } from '../core/tts.js';

export const PENDING_COMMIT_KEY = 'lf_course_pending_commit';
const IDLE_AFTER_MS = 30_000;
const HEARTBEAT_SECONDS = 10;
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const DIFFICULTY_LABEL = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' };
const ROLE_CLASS = {
  subject: 'subject',
  predicate_verb: 'verb',
  predicate_adj: 'verb',
  direct_object: 'object',
  discourse_marker: 'slang',
  adverbial: 'slang',
};
const ROLE_LABEL = {
  subject: 'Sujeito',
  predicate_verb: 'Verbo',
  predicate_adj: 'Predicado',
  direct_object: 'Objeto',
  discourse_marker: 'Expressão',
  adverbial: 'Adjunto',
};

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

// Reenvia um resultado que ficou pendente (queda de rede, aba recarregada).
// A RPC é idempotente por client_session_id, então reenviar é seguro.
export async function flushPendingCourseCommit() {
  const pending = readPendingCommit();
  if (!pending) return null;
  const result = await db.courses.commitSession(pending);
  writePendingCommit(null);
  return result;
}

export async function renderCoursePractice(container, app, params = {}) {
  const lessonId = String(params.lessonId || '');
  const difficulty = DIFFICULTIES.has(params.difficulty) ? params.difficulty : 'medium';

  let disposed = false;
  let timer = null;
  const cleanups = [];
  app.onLeaveView?.(() => {
    disposed = true;
    clearInterval(timer);
    stopAudio();
    cleanups.forEach((fn) => fn());
  });

  renderLoading();

  let lesson;
  try {
    lesson = await db.courses.getLesson(lessonId);
  } catch (err) {
    if (disposed) return;
    renderError('Não foi possível carregar a lição. Verifique a conexão e tente de novo.', err);
    return;
  }
  if (disposed) return;
  if (!lesson || lesson.units.length === 0) {
    renderError('Esta lição não existe ou ainda não tem frases publicadas.');
    return;
  }

  const session = createPracticeSession(lesson.units);
  const startedAt = new Date().toISOString();
  const clientSessionId = crypto.randomUUID();
  let activeSeconds = 0;
  let unsentSeconds = 0;
  let lastActivity = Date.now();
  let paused = false;
  let breakdownOpen = false;
  let audioPlaying = false;
  let heartbeatWarned = false;

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

  // Um único listener por render, removido ao sair da rota (antes, cada tela
  // empilhava um novo e os atalhos disparavam N vezes).
  const onActivity = () => { lastActivity = Date.now(); };
  const onKeydown = (e) => handleGlobalKey(e);
  container.addEventListener('keydown', onKeydown);
  container.addEventListener('pointerdown', onActivity);
  cleanups.push(() => {
    container.removeEventListener('keydown', onKeydown);
    container.removeEventListener('pointerdown', onActivity);
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  function renderLoading() {
    container.innerHTML = `
      <div class="course-player-shell" aria-busy="true">
        <header class="course-player-topbar">
          <div class="course-player-progress-bar-wrap"><div class="course-player-progress-bar" style="width:0%"></div></div>
        </header>
        <main class="course-player-body">
          <p class="course-pause-text" role="status">Carregando a lição…</p>
        </main>
      </div>`;
  }

  function renderError(message, err) {
    if (err) console.warn('[CoursePractice] lesson_load_failed', err?.kind || err?.message);
    container.innerHTML = `
      <div class="course-player-shell" style="align-items:center;justify-content:center;padding:24px;">
        <div class="course-pause-card" role="alert">
          <h2 class="course-pause-title">Não deu para abrir a prática</h2>
          <p class="course-pause-text">${escapeHTML(message)}</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
            ${err ? '<button class="course-btn-primary-lg" type="button" data-action="retry-load">Tentar de novo</button>' : ''}
            <button class="course-player-btn-back" type="button" data-action="back">Voltar aos Cursos</button>
          </div>
        </div>
      </div>`;
    container.querySelector('[data-action="retry-load"]')?.addEventListener('click', () => {
      renderCoursePractice(container, app, params);
    });
    container.querySelector('[data-action="back"]')?.addEventListener('click', () => app.navigate('courses'));
  }

  function renderShell() {
    const course = lesson.course_catalog || {};
    container.innerHTML = `
      <div class="course-player-shell">
        <header class="course-player-topbar">
          <div class="course-player-progress-bar-wrap" role="progressbar" aria-label="Progresso da lição" aria-valuemin="0" aria-valuemax="${session.total}" aria-valuenow="0">
            <div class="course-player-progress-bar" id="course-progress" style="width:0%"></div>
          </div>
          <button class="course-player-btn-back" type="button" data-action="exit">
            <span aria-hidden="true">✕</span><span>Sair</span>
          </button>
          <span class="course-player-question-indicator" id="course-question" aria-live="polite"></span>
          <div class="course-player-topbar-actions">
            <button class="course-player-btn-icon" type="button" data-action="pause" aria-label="Pausar (Esc)">⏸</button>
          </div>
        </header>

        <section class="course-player-hud" aria-label="Estatísticas da sessão">
          <div class="course-hud-pill"><span aria-hidden="true">⏱</span><span id="course-timer">00:00</span></div>
          <div class="course-hud-pill"><span>Pontos:</span><strong id="course-score">0</strong></div>
          <div class="course-hud-pill combo" id="course-combo-pill"><span>Combo:</span><strong id="course-combo">1.0x</strong></div>
          <div class="course-hud-pill"><span>Modo:</span><strong>${DIFFICULTY_LABEL[difficulty]}</strong></div>
        </section>

        <main class="course-player-body">
          <p class="course-hub-subtitle" style="margin:0;">${escapeHTML(course.title || '')} · ${escapeHTML(lesson.title)}</p>
          <button class="course-audio-replay-btn" type="button" data-action="replay" aria-label="Ouvir a frase de novo (Ctrl + .)">
            <span aria-hidden="true">🔊</span>
          </button>
          <div class="course-sentence-wrap" id="sentence-slots" role="group" aria-label="Digite a frase que você ouviu, uma palavra por campo"></div>
          <p id="course-feedback" class="course-pause-text" role="status" aria-live="polite" style="min-height:1.5em;margin:0;"></p>
          <section class="course-breakdown-panel" id="course-breakdown" aria-label="Análise da frase" hidden></section>
        </main>

        <footer class="course-player-bottombar">
          <div class="course-shortcuts-guide">
            <span><kbd class="course-key-badge">Espaço</kbd> Próxima palavra</span>
            <span><kbd class="course-key-badge">Enter</kbd> Conferir</span>
            <span><kbd class="course-key-badge">Ctrl + .</kbd> Ouvir de novo</span>
            <span><kbd class="course-key-badge">Ctrl + ;</kbd> Ver resposta</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="course-player-btn-back" type="button" data-action="reveal">Ver resposta</button>
            <button class="course-btn-submit-phrase" type="button" data-action="submit">
              <span>Conferir</span><span aria-hidden="true">↵</span>
            </button>
          </div>
        </footer>

        <div class="course-pause-backdrop" id="course-pause" role="dialog" aria-modal="true" aria-labelledby="pause-title" hidden>
          <div class="course-pause-card">
            <h2 id="pause-title" class="course-pause-title">Pausa</h2>
            <p class="course-pause-text">O cronômetro está parado. O que você já digitou continua aqui.</p>
            <button class="course-btn-resume" type="button" data-action="resume">Continuar</button>
          </div>
        </div>
      </div>`;

    container.querySelector('.course-player-shell').addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      onActivity();
      const action = target.dataset.action;
      if (action === 'exit') exitPractice();
      else if (action === 'pause') setPaused(true);
      else if (action === 'resume') setPaused(false);
      else if (action === 'replay') playAudio();
      else if (action === 'submit') submitPhrase();
      else if (action === 'reveal') toggleBreakdown();
      else if (action === 'save-vocab') saveVocabulary(target);
      else if (action === 'save-note') saveNote(target);
    });
  }

  function showUnit() {
    breakdownOpen = false;
    const panel = container.querySelector('#course-breakdown');
    panel.hidden = true;
    panel.innerHTML = '';
    setFeedback('');

    const progress = Math.round((session.index / session.total) * 100);
    container.querySelector('#course-progress').style.width = `${progress}%`;
    container.querySelector('.course-player-progress-bar-wrap').setAttribute('aria-valuenow', String(session.index));
    container.querySelector('#course-question').textContent = `Frase ${session.index + 1} de ${session.total}`;

    const slots = container.querySelector('#sentence-slots');
    slots.innerHTML = session.tokens.map((token, idx) => {
      let placeholder = '';
      if (difficulty === 'easy') placeholder = token.targetWord;
      else if (difficulty === 'medium') placeholder = `${token.targetWord[0]}…`;
      return `
        <div class="course-word-unit">
          ${token.punctuationBefore ? `<span class="course-punctuation-mark" aria-hidden="true">${escapeHTML(token.punctuationBefore)}</span>` : ''}
          <input class="course-word-input" type="text" data-slot-index="${idx}"
            style="width:calc(${token.charWidth}ch + 24px);" placeholder="${escapeHTML(placeholder)}"
            autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
            aria-label="Palavra ${idx + 1} de ${session.tokens.length}" />
          ${token.punctuationAfter ? `<span class="course-punctuation-mark" aria-hidden="true">${escapeHTML(token.punctuationAfter)}</span>` : ''}
        </div>`;
    }).join('');

    const inputs = [...slots.querySelectorAll('.course-word-input')];
    inputs.forEach((input, idx) => {
      input.addEventListener('keydown', (e) => {
        onActivity();
        if (paused) { e.preventDefault(); return; }
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
      input.addEventListener('input', () => input.classList.remove('is-wrong'));
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const words = parsePastedText(e.clipboardData?.getData('text') || '');
        words.forEach((w, offset) => { if (inputs[idx + offset]) inputs[idx + offset].value = w; });
        inputs[Math.min(inputs.length - 1, idx + Math.max(0, words.length - 1))]?.focus();
      });
    });

    inputs[0]?.focus();
    playAudio();
    const next = lesson.units[session.index + 1];
    if (next) preloadNaturalAudio(next.text, { lang: 'en-US' });
  }

  function updateHud() {
    container.querySelector('#course-score').textContent = String(session.score);
    container.querySelector('#course-combo').textContent = `${comboMultiplier(session.streak).toFixed(1)}x`;
    container.querySelector('#course-combo-pill').classList.toggle('pop', session.streak > 0);
  }

  function setFeedback(text) {
    const el = container.querySelector('#course-feedback');
    if (el) el.textContent = text;
  }

  // ── Ações ─────────────────────────────────────────────────────────────────

  function playAudio() {
    const unit = session.unit;
    if (!unit || audioPlaying) return;
    soundEngine.init();
    const btn = container.querySelector('[data-action="replay"]');
    audioPlaying = true;
    btn?.classList.add('playing');
    btn?.setAttribute('aria-disabled', 'true');
    const done = () => {
      audioPlaying = false;
      btn?.classList.remove('playing');
      btn?.removeAttribute('aria-disabled');
    };
    const failed = () => {
      done();
      setFeedback('Não foi possível tocar o áudio. Tente de novo em instantes.');
    };
    playNaturalAudio(unit.text, { lang: 'en-US', rate: difficulty === 'easy' ? 0.9 : 1 }, done)
      .then((played) => { if (played === false && audioPlaying) done(); })
      .catch(failed);
  }

  function submitPhrase() {
    if (paused || session.finished || !session.unit) return;
    const inputs = [...container.querySelectorAll('.course-word-input')];
    if (inputs.some((i) => i.readOnly)) return; // frase já resolvida, aguardando transição
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

    soundEngine.playChord(session.streak > 0 && session.streak % 5 === 0 ? 'milestone' : 'word');
    inputs.forEach((i) => { i.classList.remove('is-wrong'); i.classList.add('is-correct'); i.readOnly = true; });
    setFeedback(result.clean ? `Certo! +${result.gained}` : `Certo. +${result.gained}`);
    updateHud();
    stopAudio();
    audioPlaying = false;

    setTimeout(() => {
      if (disposed) return;
      if (session.next()) showUnit();
      else finish();
    }, 450);
  }

  function toggleBreakdown() {
    if (paused || session.finished) return;
    const panel = container.querySelector('#course-breakdown');
    breakdownOpen = !breakdownOpen;
    if (!breakdownOpen) {
      panel.hidden = true;
      return;
    }
    if (session.useHint()) updateHud();
    const unit = session.unit;
    const groups = Array.isArray(unit.syntax_groups) ? unit.syntax_groups : [];
    const words = Array.isArray(unit.annotations) ? unit.annotations : [];
    panel.innerHTML = `
      <p class="course-breakdown-translation" lang="en">${escapeHTML(unit.text)}</p>
      <p style="margin:0;">${escapeHTML(unit.translation_pt)}</p>
      ${unit.ipa ? `<span class="course-breakdown-ipa">${escapeHTML(unit.ipa)}</span>` : ''}
      ${unit.explanation_note ? `<p style="font-size:13px;color:var(--course-text-muted);margin:0;">${escapeHTML(unit.explanation_note)}</p>` : ''}
      ${groups.length ? `<div class="course-syntax-chips">${groups.map((g) => `
        <span class="course-syntax-chip ${ROLE_CLASS[g.role] || 'slang'}">
          ${escapeHTML(g.surface)} <small>· ${escapeHTML(ROLE_LABEL[g.role] || g.role || '')}</small>
        </span>`).join('')}</div>` : ''}
      ${words.length ? `<ul style="margin:0;padding-left:18px;font-size:13px;">${words.map((w) => `
        <li><strong lang="en">${escapeHTML(w.surface)}</strong> ${w.ipa ? `<span class="course-breakdown-ipa">${escapeHTML(w.ipa)}</span>` : ''} — ${escapeHTML(w.gloss || '')}</li>`).join('')}</ul>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
        <button type="button" class="course-player-btn-back" data-action="save-vocab">★ Salvar no vocabulário</button>
        <label style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:200px;font-size:12px;">
          <span>Nota pessoal</span>
          <input type="text" id="course-note-input" maxlength="2000" class="course-word-input" style="width:100%;text-align:left;" />
        </label>
        <button type="button" class="course-player-btn-back" data-action="save-note">Salvar nota</button>
      </div>`;
    panel.hidden = false;
    setFeedback('Resposta revelada: esta frase não conta como acerto de primeira.');
  }

  async function saveVocabulary(btn) {
    const unit = session.unit;
    if (!unit || btn.disabled) return;
    btn.disabled = true;
    try {
      await db.courses.saveVocabulary(unit.id);
      btn.textContent = '★ Salvo';
      app.showToast?.('Frase salva no vocabulário do curso.', 'success');
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

  function setPaused(value) {
    if (session.finished) return;
    paused = value;
    const overlay = container.querySelector('#course-pause');
    overlay.hidden = !paused;
    container.querySelectorAll('.course-word-input:not(.is-correct)').forEach((i) => { i.readOnly = paused; });
    if (paused) {
      stopAudio();
      audioPlaying = false;
      overlay.querySelector('[data-action="resume"]')?.focus();
    } else {
      lastActivity = Date.now();
      container.querySelector('.course-word-input:not(.is-correct)')?.focus();
    }
  }

  function exitPractice() {
    if (!session.finished && session.index > 0
      && !confirm('Sair da prática? O resultado desta lição não será salvo.')) return;
    app.navigate('courses');
  }

  function handleGlobalKey(e) {
    onActivity();
    if (e.key === 'Escape') {
      e.preventDefault();
      setPaused(!paused);
      return;
    }
    if (paused || !e.ctrlKey) return;
    // e.code (tecla física) cobre US e ABNT2; e.key cobre teclados virtuais e
    // IMEs que entregam code vazio.
    if (e.code === 'Period' || e.key === '.') {
      e.preventDefault();
      playAudio();
    } else if (e.code === 'Semicolon' || e.code === 'Slash' || e.key === ';') {
      e.preventDefault();
      toggleBreakdown();
    }
  }

  // ── Conclusão ─────────────────────────────────────────────────────────────

  function finish() {
    clearInterval(timer);
    stopAudio();
    soundEngine.playChord('complete');
    if (unsentSeconds > 0) {
      db.logSession(unsentSeconds, 'pwa').catch(() => {});
      unsentSeconds = 0;
    }
    const summary = session.summary();
    const payload = {
      clientSessionId,
      lessonId: lesson.id,
      difficulty,
      startedAt,
      activeTimeSeconds: activeSeconds,
      score: session.score,
      highestCombo: session.highestCombo,
      results: session.buildResults(),
    };
    writePendingCommit(payload);

    container.innerHTML = `
      <div class="course-player-shell" style="align-items:center;justify-content:center;padding:24px;">
        <div class="course-pause-card" style="max-width:520px;">
          <h2 class="course-pause-title">Lição concluída</h2>
          <p class="course-pause-text">${escapeHTML(lesson.title)}</p>
          <dl style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;width:100%;margin:8px 0;">
            <div class="course-hud-pill" style="flex-direction:column;padding:12px 8px;"><dt style="font-size:11px;">PONTOS</dt><dd style="margin:0;font-size:18px;font-weight:700;">${session.score}</dd></div>
            <div class="course-hud-pill" style="flex-direction:column;padding:12px 8px;"><dt style="font-size:11px;">DE PRIMEIRA</dt><dd style="margin:0;font-size:18px;font-weight:700;">${summary.accuracy}%</dd></div>
            <div class="course-hud-pill" style="flex-direction:column;padding:12px 8px;"><dt style="font-size:11px;">TEMPO ATIVO</dt><dd style="margin:0;font-size:18px;font-weight:700;">${formatTime(activeSeconds)}</dd></div>
          </dl>
          <p id="course-commit-status" class="course-pause-text" role="status" aria-live="polite">Salvando seu progresso…</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
            <button class="course-player-btn-back" type="button" id="btn-retry-commit" hidden>Tentar salvar de novo</button>
            <button class="course-btn-primary-lg" type="button" id="btn-finish-lesson">Voltar aos Cursos</button>
          </div>
        </div>
      </div>`;

    const status = container.querySelector('#course-commit-status');
    const retry = container.querySelector('#btn-retry-commit');
    const commit = async () => {
      retry.hidden = true;
      status.textContent = 'Salvando seu progresso…';
      try {
        const res = await db.courses.commitSession(payload);
        writePendingCommit(null);
        const mistakesNote = summary.mistakes > 0 ? ' As frases com erro foram para o Caderno de Erros.' : '';
        status.textContent = `Progresso salvo: ${Number(res?.percent_completed ?? 0).toFixed(0)}% do curso.${mistakesNote}`;
      } catch (err) {
        console.warn('[CoursePractice] commit_failed', err?.kind || err?.message);
        status.textContent = 'Não foi possível salvar agora. O resultado ficou guardado neste navegador e será reenviado.';
        retry.hidden = false;
      }
    };
    retry.addEventListener('click', commit);
    const back = container.querySelector('#btn-finish-lesson');
    back.addEventListener('click', () => app.navigate('courses'));
    back.focus();
    commit();
  }
}
