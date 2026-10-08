// #533/#540: navegação por módulos de conteúdo; abre o mesmo preparo/player de sempre.
// Na página do nível o módulo atual abre sozinho e os concluídos ficam recolhidos.
import { escapeHTML } from '../../../../utils/html.js';
import { startLesson, lessonProgress } from './courseUi.js';

const ROLE_LABEL = { base: 'Base do nível', extra: 'Prática extra', optional: 'Opcional por objetivo' };
const ROLE_TABS = [['base', 'Base do nível'], ['extra', 'Prática extra'], ['optional', 'Opcional'], ['', 'Todos']];
const STAGE_LABEL = { introduction: 'Introdução', practice: 'Prática', application: 'Aplicação', consolidation: 'Consolidação' };

// Tipo da aula para o aluno (chip), derivado do prefixo do ID da aula: gramática e
// vocabulário são tipos dentro da mesma trilha, não seções separadas.
const KIND_BY_PREFIX = [
  ['Gramática', ['pedagogy', 'grammar', 'tenses', 'modals', 'prepositions', 'sequence']],
  ['Vocabulário', ['1000-words', 'collocations', 'idioms', 'themes', 'numbers', 'essential-verbs', 'phrasal']],
  ['Situações', ['routine', 'shopping', 'health', 'street', 'survival', 'social', 'subtext', 'travel', 'work', 'interview', 'negotiation', 'register']],
  ['Leitura e fala', ['stories', 'paragraphs', 'connected', 'debate', 'spoken-reductions']],
  ['Frases essenciais', ['first-sentences']],
];

export function lessonRole(lesson) { return lesson.lesson_role || (lesson.is_core === false ? 'extra' : 'base'); }
export function lessonRoleLabel(lesson) { return ROLE_LABEL[lessonRole(lesson)] || 'Conteúdo'; }
export function lessonKind(lesson) {
  const id = String(lesson?.id || '').replace(/^lesson-/, '');
  const found = KIND_BY_PREFIX.find(([, prefixes]) => prefixes.some(prefix => id === prefix || id.startsWith(`${prefix}-`)));
  return found ? found[0] : 'Aula';
}
export function matchesCurriculumFilter(course, level = '', role = '') {
  return (course.lessons || []).some(l => (!level || (l.level || course.level) === level) && (!role || lessonRole(l) === role));
}

// Qual módulo abre: o da próxima aula recomendada; sem ela, o primeiro com aula pendente.
export function pickCurrentModule(groups, nextLessonId) {
  const entries = [...groups];
  const withNext = entries.find(([, list]) => list.some(({ lesson }) => lesson.id === nextLessonId));
  if (withNext) return withNext[0];
  const pending = entries.find(([, list]) => list.some(({ course, lesson }) => !lessonProgress(lesson, course).done));
  return pending ? pending[0] : null;
}

const STATE_ICON = { done: '✓', next: '▶', progress: '◐', todo: '' };

function statusOf(lesson, course, path) {
  const progress = lessonProgress(lesson, course);
  if (progress.done) return { key: 'done', label: 'Concluída', progress };
  if (lesson.id === path?.next?.lesson_id) return { key: 'next', label: 'Próxima recomendada', progress };
  if (progress.percent > 0) return { key: 'progress', label: 'Em andamento', progress };
  return { key: 'todo', label: 'A fazer', progress };
}

function lessonRow({ course, lesson }, { path, fixedLevel }) {
  const status = statusOf(lesson, course, path);
  const stage = STAGE_LABEL[lesson.lesson_stage];
  const role = lessonRole(lesson);
  const answered = status.progress.done ? lesson.unit_count : Math.min(lesson.unit_count, Number(lesson.my_best_answered || 0));
  const buttonText = status.key === 'done' ? 'Revisar aula' : status.key === 'next' ? 'Fazer próxima aula' : 'Praticar aula';
  const buttonClass = status.key === 'next' ? 'course-btn-primary-lg' : 'course-btn-continue';
  return `<li class="course-lesson-row is-${status.key}">
    <span class="course-lesson-icon is-${status.key}" aria-hidden="true">${STATE_ICON[status.key]}</span>
    <div class="course-lesson-main">
      <strong>${escapeHTML(lesson.title)}</strong>
      <span class="course-lesson-chips">
        <span class="course-chip course-chip-kind">${escapeHTML(lessonKind(lesson))}</span>
        ${stage ? `<span class="course-chip">${escapeHTML(stage)}</span>` : ''}
        ${role !== 'base' ? `<span class="course-chip">${escapeHTML(lessonRoleLabel(lesson))}</span>` : ''}
        <span class="course-card-stats">${escapeHTML(course.title)}</span>
      </span>
      <span class="course-lesson-status is-${status.key}">${status.label}</span>
      ${fixedLevel && status.key === 'progress' ? `<span class="course-card-stats">${status.progress.percent}% · ${answered} de ${lesson.unit_count} itens</span>` : ''}
      ${status.key === 'next' && lesson.prerequisite_titles?.length ? `<span class="course-card-stats">Antes: ${escapeHTML(lesson.prerequisite_titles.join(' · '))}</span>` : ''}
    </div>
    <button class="${buttonClass}" type="button" data-curriculum-lesson="${escapeHTML(lesson.id)}" aria-label="${buttonText}: ${escapeHTML(lesson.title)}">${buttonText}</button>
  </li>`;
}

export function renderCurriculum(container, { catalog, app, level = 'A1', path, onLevelChange, fixedLevel = false }) {
  const items = catalog.flatMap(course => course.lessons.map(lesson => ({ course, lesson })));
  let chosen = level;
  let role = 'base';
  container.innerHTML = `<div class="course-section-head"><h2 class="course-section-title">${fixedLevel ? 'Aulas e módulos' : 'Conteúdos por nível'}</h2></div>
    ${fixedLevel ? '' : '<p class="course-hub-subtitle">Siga a base na trilha. Prática extra e opcionais ficam disponíveis sem bloquear seu avanço.</p>'}
    <div class="course-filter-row">
      ${fixedLevel ? '' : `<label>Nível <select data-curriculum-level aria-label="Nível dos conteúdos">${['A1', 'A2', 'B1', 'B2', 'C1'].map(l => `<option ${l === chosen ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`}
      ${fixedLevel ? `<div class="course-subnav course-subnav--pills" role="tablist" aria-label="Tipo de conteúdo">${ROLE_TABS.map(([value, label]) => `<button type="button" role="tab" class="course-tab-btn ${value === role ? 'active' : ''}" aria-selected="${value === role}" data-role-tab="${value}">${label}</button>`).join('')}</div>` : `<label>Conteúdo <select data-curriculum-role aria-label="Tipo de conteúdo"><option value="base">Base do nível</option><option value="extra">Prática extra</option><option value="optional">Opcional por objetivo</option><option value="">Todos os conteúdos</option></select></label>`}
    </div><p class="course-card-stats" data-curriculum-status role="status" aria-live="polite"></p><div id="course-curriculum-modules" data-curriculum-modules role="region" aria-label="Módulos de conteúdo"></div>`;
  const region = container.querySelector('[data-curriculum-modules]');
  function paint() {
    const filtered = items.filter(({ course, lesson }) => (lesson.level || course.level) === chosen && (!role || lessonRole(lesson) === role));
    container.querySelector('[data-curriculum-status]').textContent = filtered.length
      ? `Nível ${chosen} · ${filtered.length} ${filtered.length === 1 ? 'aula' : 'aulas'} · ${role ? ROLE_LABEL[role] : 'Todos os conteúdos'}`
      : 'Nenhuma aula desta categoria neste nível.';
    const groups = new Map();
    for (const item of filtered.sort((a, b) => (a.lesson.module_order || 99) - (b.lesson.module_order || 99) || (a.lesson.curriculum_order || 0) - (b.lesson.curriculum_order || 0))) {
      const title = item.lesson.module_title || item.course.title;
      if (!groups.has(title)) groups.set(title, []);
      groups.get(title).push(item);
    }
    const current = fixedLevel ? pickCurrentModule(groups, path?.next?.lesson_id) : null;
    region.innerHTML = groups.size ? [...groups].map(([title, list], index) => {
      const doneCount = list.filter(({ course, lesson }) => lessonProgress(lesson, course).done).length;
      const complete = doneCount === list.length;
      const badge = title === current ? '<span class="course-chip is-current">Módulo atual</span>' : complete ? '<span class="course-chip is-done">Módulo concluído</span>' : '';
      return `<details class="course-curriculum-module${complete ? ' is-complete' : ''}"${title === current ? ' open' : ''}>
      <summary>${fixedLevel ? `<span class="course-module-num" aria-hidden="true">${complete ? '✓' : index + 1}</span>` : ''}<span class="course-module-title"><strong>${escapeHTML(title)}</strong>${badge}</span><span class="course-module-meta"><span class="course-card-stats">${doneCount} de ${list.length} ${list.length === 1 ? "aula concluída" : "aulas concluídas"}</span>${fixedLevel ? `<span class="course-module-bar" aria-hidden="true"><span style="width:${Math.round((doneCount / Math.max(1, list.length)) * 100)}%"></span></span>` : ''}</span></summary>
      ${list[0]?.lesson.learning_objective ? `<p class="course-hub-subtitle">Objetivo: ${escapeHTML(list[0].lesson.learning_objective)}</p>` : ''}
      <ol class="course-curriculum-lessons">${list.map(entry => lessonRow(entry, { path, fixedLevel })).join('')}</ol></details>`;
    }).join('') : '<p class="course-hub-subtitle">Nenhuma aula desta categoria neste nível.</p>';
    region.querySelectorAll('[data-curriculum-lesson]').forEach(b => b.addEventListener('click', () => {
      const item = items.find(x => x.lesson.id === b.dataset.curriculumLesson);
      if (item) startLesson(app, item.course, item.lesson, fixedLevel ? chosen : null);
    }));
  }
  const select = container.querySelector('[data-curriculum-level]');
  function setLevel(value) {
    if (!['A1', 'A2', 'B1', 'B2', 'C1'].includes(value)) return;
    chosen = value; if (select) select.value = value; paint(); onLevelChange?.(value);
  }
  select?.addEventListener('change', e => setLevel(e.target.value));
  container.querySelector('[data-curriculum-role]')?.addEventListener('change', e => { role = e.target.value; paint(); });
  container.querySelectorAll('[data-role-tab]').forEach(tab => tab.addEventListener('click', () => {
    role = tab.dataset.roleTab; paint();
    container.querySelectorAll('[data-role-tab]').forEach(other => {
      const on = other === tab;
      other.classList.toggle('active', on); other.setAttribute('aria-selected', String(on));
    });
  }));
  paint();
  return { setLevel };
}
