// dashboard/js/ui/coursePrepareModal.js
// Diálogo antes da prática: modo (fácil / médio / difícil) e configurações.

import { escapeHTML } from '../../../utils/html.js';
import { soundEngine } from '../core/soundFx.js';
import { loadPrefs, savePrefs, stepPref, PREF_LIMITS } from '../core/coursePrefs.js';
import { unitCount } from './courses/courseUi.js';

export const MODES = [
  { id: 'easy', label: 'Fácil', text: 'A frase completa aparece: ouça e copie.' },
  { id: 'medium', label: 'Médio', text: 'Ouça em inglês; só a primeira letra de cada palavra aparece.' },
  { id: 'hard', label: 'Difícil', text: 'Ouça em inglês sem letras nem pista do tamanho das palavras.' },
];
const MODE_KEY = 'lf_course_last_mode';

function lastMode() {
  try { return MODES.some((m) => m.id === localStorage.getItem(MODE_KEY)) ? localStorage.getItem(MODE_KEY) : 'medium'; } catch { return 'medium'; }
}

export function openCoursePrepareModal({ lesson, course, onStart }) {
  document.getElementById('course-prepare-modal-root')?.remove();

  let selected = lastMode();
  let prefs = loadPrefs();
  const previousFocus = document.activeElement;
  const meta = [
    course.title,
    lesson.chapter_number ? `Capítulo ${Number(lesson.chapter_number)}` : null,
    unitCount(course, Number(lesson.unit_count) || 0),
  ].filter(Boolean).join(' · ');

  const root = document.createElement('div');
  root.id = 'course-prepare-modal-root';
  root.className = 'course-pause-backdrop';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'prepare-modal-title');
  document.body.appendChild(root);

  function settingsHtml() {
    const step = (name, label, value) => `
      <div class="course-setting-row"><span>${label}</span>
        <div class="course-stepper" role="group" aria-label="${label}">
          <button type="button" class="course-player-btn-icon" data-step="${name}:-1" aria-label="Diminuir ${label.toLowerCase()}" ${prefs[name] <= PREF_LIMITS[name].min ? 'disabled' : ''}>−</button>
          <span role="spinbutton" aria-label="${label}" aria-valuemin="${PREF_LIMITS[name].min}" aria-valuemax="${PREF_LIMITS[name].max}" aria-valuenow="${prefs[name]}">${value}</span>
          <button type="button" class="course-player-btn-icon" data-step="${name}:1" aria-label="Aumentar ${label.toLowerCase()}" ${prefs[name] >= PREF_LIMITS[name].max ? 'disabled' : ''}>+</button>
        </div></div>`;
    return `
      <label class="course-setting-row"><span>Áudio da frase</span><input type="checkbox" role="switch" data-pref="audio" ${prefs.audio ? 'checked' : ''} /></label>
      <label class="course-setting-row"><span>Sons de digitação e feedback</span><input type="checkbox" role="switch" data-pref="sfx" ${prefs.sfx ? 'checked' : ''} /></label>
      <label class="course-setting-row"><span>Reduzir movimento</span><input type="checkbox" role="switch" data-pref="reduceMotion" ${prefs.reduceMotion ? 'checked' : ''} /></label>
      ${step('readings', 'Leituras', `${prefs.readings}x`)}
      ${step('speed', 'Velocidade', `${String(prefs.speed).replace('.', ',')}x`)}
      <p class="course-hub-subtitle" style="margin:0;">Salvo neste navegador.</p>`;
  }

  root.innerHTML = `
    <div class="course-pause-card course-prepare-card">
      <div class="course-prepare-head">
        <div>
          ${(lesson.level || course.level) ? `<span class="course-level-pill ${escapeHTML(String(lesson.level || course.level).toLowerCase())}">${escapeHTML(lesson.level || course.level)}</span>` : ''}
          <h2 id="prepare-modal-title" class="course-hero-title">${escapeHTML(lesson.title)}</h2>
          <p class="course-hub-subtitle">${escapeHTML(meta)}</p>
          ${lesson.description ? `<p class="course-hub-subtitle">${escapeHTML(lesson.description)}</p>` : ''}
        </div>
        <button type="button" class="course-player-btn-icon" data-action="close" aria-label="Fechar">✕</button>
      </div>
      <fieldset class="course-mode-fieldset">
        <legend>Dificuldade</legend>
        <div class="course-mode-grid">
          ${MODES.map((mode) => `
            <label class="course-difficulty-card ${mode.id === selected ? 'active' : ''}">
              <input type="radio" name="course-difficulty" value="${mode.id}" ${mode.id === selected ? 'checked' : ''} class="visually-hidden" />
              <strong>${mode.label}</strong>
            </label>`).join('')}
        </div>
        <p class="course-hub-subtitle" id="course-mode-text" aria-live="polite">${MODES.find((m) => m.id === selected).text}</p>
      </fieldset>
      <details class="course-prepare-settings">
        <summary>Configurações</summary>
        <div id="course-prepare-settings-body">${settingsHtml()}</div>
      </details>
      <div class="course-prepare-footer">
        <button type="button" class="course-player-btn-back" data-action="close">Cancelar</button>
        <button type="button" class="course-btn-primary-lg" data-action="start">Começar prática</button>
      </div>
    </div>`;

  const onKeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = [...root.querySelectorAll('button:not([disabled]), input:checked, input[type=checkbox], summary')];
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

  root.addEventListener('change', (e) => {
    if (e.target.name === 'course-difficulty') {
      selected = e.target.value;
      root.querySelectorAll('.course-difficulty-card').forEach((card) => {
        card.classList.toggle('active', card.querySelector('input').checked);
      });
      root.querySelector('#course-mode-text').textContent = MODES.find((m) => m.id === selected).text;
    } else if (e.target.dataset.pref) {
      prefs = savePrefs({ ...prefs, [e.target.dataset.pref]: e.target.checked });
    }
  });

  root.addEventListener('click', (e) => {
    const stepBtn = e.target.closest('[data-step]');
    if (stepBtn) {
      const [name, dir] = stepBtn.dataset.step.split(':');
      prefs = savePrefs(stepPref(prefs, name, Number(dir)));
      root.querySelector('#course-prepare-settings-body').innerHTML = settingsHtml();
      root.querySelector(`[data-step="${stepBtn.dataset.step}"]`)?.focus();
      return;
    }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') close();
    if (action === 'start') {
      soundEngine.init(); // AudioContext precisa nascer de um gesto do usuário
      try { localStorage.setItem(MODE_KEY, selected); } catch { /* opcional */ }
      close();
      onStart?.(selected);
    }
  });

  root.querySelector('[data-action="start"]').focus();
}
