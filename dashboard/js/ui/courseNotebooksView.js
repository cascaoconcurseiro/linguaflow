// dashboard/js/ui/courseNotebooksView.js
// Cadernos do domínio de Cursos: erros pendentes, revisões vencidas e
// vocabulário salvo. Praticar um erro ou revisão abre a lição de origem (a
// RPC grava o resultado por lição inteira).

import { db } from '../../../utils/db.js';
import { escapeHTML } from '../../../utils/html.js';
import { playNaturalAudio } from '../core/tts.js';

function renderLoading(container, label) {
  container.innerHTML = `<p class="course-hub-subtitle" role="status" aria-busy="true">${escapeHTML(label)}</p>`;
}

function renderLoadError(container, retry) {
  container.innerHTML = `
    <div class="course-empty-state" role="alert">
      <h2 class="course-empty-title">Não foi possível carregar</h2>
      <p class="course-empty-subtitle">Verifique a conexão e tente de novo.</p>
      <button class="course-btn-primary-lg" type="button" data-action="retry">Tentar de novo</button>
    </div>`;
  container.querySelector('[data-action="retry"]').addEventListener('click', retry);
}

function renderEmpty(container, title, text) {
  container.innerHTML = `
    <div class="course-empty-state">
      <h2 class="course-empty-title">${escapeHTML(title)}</h2>
      <p class="course-empty-subtitle">${escapeHTML(text)}</p>
    </div>`;
}

function lessonMeta(unit) {
  const lessonTitle = unit?.course_lessons?.title || '';
  const courseTitle = unit?.course_lessons?.course_catalog?.title || '';
  return [courseTitle, lessonTitle].filter(Boolean).join(' · ');
}

export async function renderMistakesNotebook(container, app, startLesson) {
  renderLoading(container, 'Carregando seus erros…');
  let rows;
  try {
    rows = await db.courses.listMistakes();
  } catch (err) {
    console.warn('[CourseNotebooks] mistakes_load_failed', err?.kind || err?.message);
    renderLoadError(container, () => renderMistakesNotebook(container, app, startLesson));
    return;
  }
  if (!rows?.length) {
    renderEmpty(container, 'Nenhum erro pendente', 'Quando você errar uma frase numa lição, ela aparece aqui com o que você digitou e a forma certa. Acertar de primeira depois resolve o erro.');
    return;
  }

  container.innerHTML = `
    <p class="course-hub-subtitle">${rows.length} ${rows.length === 1 ? 'frase' : 'frases'} para reforçar. Refaça a lição e acerte de primeira, sem ver a resposta, para resolver.</p>
    <ul class="course-notebook-list" style="list-style:none;padding:0;">
      ${rows.map((row) => `
        <li class="course-notebook-item" style="align-items:flex-start;">
          <div class="course-notebook-item-info" style="flex:1;">
            <span class="course-card-stats">${escapeHTML(lessonMeta(row.course_units))} · errou ${row.mistake_count}x</span>
            <div class="course-mistake-diff">
              <p style="margin:4px 0;"><span aria-hidden="true">✕</span> <span class="visually-hidden">Você digitou:</span> <span class="course-mistake-wrong" lang="en">${escapeHTML(row.wrong_text_submitted)}</span></p>
              <p style="margin:4px 0;"><span aria-hidden="true">✓</span> <span class="visually-hidden">Correto:</span> <span class="course-mistake-correct" lang="en">${escapeHTML(row.course_units?.text || '')}</span></p>
              <p class="course-card-stats" style="margin:0;">${escapeHTML(row.course_units?.translation_pt || '')}</p>
            </div>
          </div>
          <button class="course-player-btn-back" type="button" data-lesson="${escapeHTML(row.course_units?.lesson_id || '')}">Refazer lição</button>
        </li>`).join('')}
    </ul>`;

  container.querySelectorAll('[data-lesson]').forEach((btn) => {
    btn.addEventListener('click', () => startLesson(btn.dataset.lesson));
  });
}

export async function renderReviewsNotebook(container, app, startLesson) {
  renderLoading(container, 'Carregando revisões…');
  let rows;
  try {
    rows = await db.courses.listDueReviews();
  } catch (err) {
    console.warn('[CourseNotebooks] reviews_load_failed', err?.kind || err?.message);
    renderLoadError(container, () => renderReviewsNotebook(container, app, startLesson));
    return;
  }
  if (!rows?.length) {
    renderEmpty(container, 'Nenhuma revisão para hoje', 'Cada frase praticada volta para revisão em 1, 3, 7 e 15 dias conforme você acerta. Errar ou ver a resposta traz a frase de volta no dia seguinte.');
    return;
  }

  const byLesson = new Map();
  for (const row of rows) {
    const lessonId = row.course_units?.lesson_id;
    if (lessonId) byLesson.set(lessonId, (byLesson.get(lessonId) || 0) + 1);
  }

  container.innerHTML = `
    <p class="course-hub-subtitle">${rows.length} ${rows.length === 1 ? 'frase vencida' : 'frases vencidas'} para revisar.</p>
    <ul class="course-notebook-list" style="list-style:none;padding:0;">
      ${[...byLesson.entries()].map(([lessonId, count]) => `
        <li class="course-notebook-item">
          <div class="course-notebook-item-info">
            <strong>${count} ${count === 1 ? 'frase' : 'frases'} desta lição</strong>
          </div>
          <button class="course-btn-continue" type="button" data-lesson="${escapeHTML(lessonId)}">Revisar lição</button>
        </li>`).join('')}
    </ul>`;

  container.querySelectorAll('[data-lesson]').forEach((btn) => {
    btn.addEventListener('click', () => startLesson(btn.dataset.lesson));
  });
}

export async function renderVocabularyNotebook(container, app) {
  renderLoading(container, 'Carregando vocabulário…');
  let rows;
  try {
    rows = await db.courses.listVocabulary();
  } catch (err) {
    console.warn('[CourseNotebooks] vocabulary_load_failed', err?.kind || err?.message);
    renderLoadError(container, () => renderVocabularyNotebook(container, app));
    return;
  }
  if (!rows?.length) {
    renderEmpty(container, 'Nenhuma frase salva', 'Durante a prática, abra "Ver resposta" e use "Salvar no vocabulário" para guardar frases e gírias aqui.');
    return;
  }

  container.innerHTML = `
    <ul class="course-notebook-list" style="list-style:none;padding:0;">
      ${rows.map((row) => `
        <li class="course-notebook-item" data-unit="${escapeHTML(row.unit_id)}">
          <div class="course-notebook-item-info" style="flex:1;">
            <p class="course-notebook-sentence" lang="en" style="margin:0;font-weight:600;">${escapeHTML(row.course_units?.text || '')}</p>
            ${row.course_units?.ipa ? `<span class="course-breakdown-ipa">${escapeHTML(row.course_units.ipa)}</span>` : ''}
            <p class="course-notebook-trans" style="margin:2px 0;">${escapeHTML(row.course_units?.translation_pt || '')}</p>
            ${row.course_units?.explanation_note ? `<p class="course-card-stats" style="margin:0;">${escapeHTML(row.course_units.explanation_note)}</p>` : ''}
          </div>
          <div style="display:flex;gap:6px;">
            <button class="course-player-btn-icon" type="button" data-action="speak" aria-label="Ouvir a frase">🔊</button>
            <button class="course-player-btn-icon" type="button" data-action="remove" aria-label="Remover do vocabulário">✕</button>
          </div>
        </li>`).join('')}
    </ul>`;

  container.querySelectorAll('.course-notebook-item').forEach((item) => {
    const unitId = item.dataset.unit;
    const row = rows.find((r) => r.unit_id === unitId);
    item.querySelector('[data-action="speak"]').addEventListener('click', () => {
      playNaturalAudio(row?.course_units?.text || '', { lang: 'en-US' }).catch(() => {
        app.showToast?.('Não foi possível tocar o áudio agora.', 'error');
      });
    });
    const removeBtn = item.querySelector('[data-action="remove"]');
    removeBtn.addEventListener('click', async () => {
      removeBtn.disabled = true;
      try {
        await db.courses.removeVocabulary(unitId);
        item.remove();
        app.showToast?.('Frase removida do vocabulário.', 'success');
        if (!container.querySelector('.course-notebook-item')) renderVocabularyNotebook(container, app);
      } catch (err) {
        removeBtn.disabled = false;
        console.warn('[CourseNotebooks] vocabulary_remove_failed', err?.kind || err?.message);
        app.showToast?.('Não foi possível remover agora. Tente de novo.', 'error');
      }
    });
  });
}
