// dashboard/js/ui/coursePrepareModal.js
// Diálogo antes da prática: escolha do apoio visual (fácil / médio / difícil).

import { escapeHTML } from '../../../utils/html.js';
import { soundEngine } from '../core/soundFx.js';

const MODES = [
  { id: 'easy', label: 'Fácil', text: 'A frase aparece nos campos enquanto você ouve e digita.' },
  { id: 'medium', label: 'Médio', text: 'Só a primeira letra de cada palavra aparece como pista.' },
  { id: 'hard', label: 'Difícil', text: 'Só o áudio, sem nenhuma pista escrita.' },
];

export function openCoursePrepareModal({ lesson, course, onStart }) {
  document.getElementById('course-prepare-modal-root')?.remove();

  let selected = 'medium';
  const previousFocus = document.activeElement;

  const root = document.createElement('div');
  root.id = 'course-prepare-modal-root';
  root.className = 'course-pause-backdrop';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'prepare-modal-title');
  root.innerHTML = `
    <div class="course-pause-card" style="max-width:580px;text-align:left;align-items:stretch;gap:20px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <div>
          <span class="course-level-pill ${escapeHTML(String(course.level || '').toLowerCase())}">Nível ${escapeHTML(course.level || '')}</span>
          <h2 id="prepare-modal-title" class="course-hero-title" style="margin-top:8px;">${escapeHTML(lesson.title)}</h2>
          <p class="course-hub-subtitle">${escapeHTML(course.title)} · Lição ${Number(lesson.chapter_number) || 1} · ${Number(lesson.unit_count) || 0} frases</p>
        </div>
        <button type="button" class="course-player-btn-icon" data-action="close" aria-label="Fechar">✕</button>
      </div>
      <fieldset style="border:0;padding:0;margin:0;">
        <legend style="font-size:13px;font-weight:700;color:var(--course-text-muted);margin-bottom:12px;">Quanto de pista você quer?</legend>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
          ${MODES.map((mode) => `
            <label class="course-difficulty-card ${mode.id === selected ? 'active' : ''}">
              <input type="radio" name="course-difficulty" value="${mode.id}" ${mode.id === selected ? 'checked' : ''} class="visually-hidden" />
              <strong>${mode.label}</strong>
              <span style="font-size:12px;color:var(--course-text-muted);line-height:1.3;">${mode.text}</span>
            </label>`).join('')}
        </div>
      </fieldset>
      <div style="display:flex;gap:12px;justify-content:flex-end;flex-wrap:wrap;">
        <button type="button" class="course-player-btn-back" data-action="close" style="min-height:48px;padding:0 20px;">Cancelar</button>
        <button type="button" class="course-btn-primary-lg" data-action="start" style="flex:1;">Começar</button>
      </div>
    </div>
    <style>
      .course-difficulty-card { background: var(--course-surface); border: 2px solid var(--course-border); border-radius: 12px;
        padding: 14px 12px; display: flex; flex-direction: column; gap: 6px; cursor: pointer; color: var(--course-text);
        transition: border-color 140ms ease, background-color 140ms ease; }
      .course-difficulty-card:hover, .course-difficulty-card.active { border-color: var(--course-accent); }
      .course-difficulty-card.active { background: var(--course-accent-subtle); }
      .course-difficulty-card:has(input:focus-visible) { outline: 2px solid var(--course-border-focus); outline-offset: 2px; }
      @media (prefers-reduced-motion: reduce) { .course-difficulty-card { transition: none; } }
    </style>`;
  document.body.appendChild(root);

  const onKeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    // Mantém o foco dentro do diálogo.
    const focusables = [...root.querySelectorAll('button, input:checked')];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKeydown);

  function close() {
    document.removeEventListener('keydown', onKeydown);
    root.remove();
    previousFocus?.focus?.();
  }

  root.querySelectorAll('input[name="course-difficulty"]').forEach((input) => {
    input.addEventListener('change', () => {
      selected = input.value;
      root.querySelectorAll('.course-difficulty-card').forEach((card) => {
        card.classList.toggle('active', card.querySelector('input').checked);
      });
    });
  });

  root.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') close();
    if (action === 'start') {
      soundEngine.init(); // AudioContext precisa nascer de um gesto do usuário
      close();
      onStart?.(selected);
    }
  });

  root.querySelector('[data-action="start"]').focus();
}
