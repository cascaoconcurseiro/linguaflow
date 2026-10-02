// Cadernos: revisão espaçada, erros, vocabulário e notas. Tudo gratuito.

import { db } from '../../../../utils/db.js';
import { escapeHTML } from '../../../../utils/html.js';
import { playNaturalAudio } from '../../core/tts.js';
import { formatDate, formatDateTime, renderLoading, renderLoadError, renderEmpty, startNotebookPractice } from './courseUi.js';

const PRACTICE_BATCH = 20;

function origin(unit) {
  const lesson = unit?.course_lessons;
  return [lesson?.course_catalog?.title, lesson?.title].filter(Boolean).join(' · ');
}

async function load(panel, label, fetcher, retry) {
  renderLoading(panel, label);
  try {
    return await fetcher();
  } catch (err) {
    console.warn('[CourseNotebooks] load_failed', err?.kind || err?.message);
    renderLoadError(panel, retry);
    return null;
  }
}

export async function renderReviewNotebook(panel, { app }) {
  const rows = await load(panel, 'Carregando revisões…', () => db.courses.listReviews(), () => renderReviewNotebook(panel, { app }));
  if (!rows) return;
  if (!rows.length) {
    renderEmpty(panel, 'Nenhuma frase em revisão ainda', 'Cada frase praticada entra na revisão espaçada: volta em 1, 3, 7 e 15 dias conforme você acerta de primeira. Erro ou dica traz a frase de volta no dia seguinte.');
    return;
  }
  const now = Date.now();
  const due = rows.filter((r) => new Date(r.due_date).getTime() <= now);
  const upcoming = rows.filter((r) => new Date(r.due_date).getTime() > now);
  const byDay = new Map();
  for (const r of upcoming) {
    const day = r.due_date.slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + 1);
  }

  panel.innerHTML = `
    <section class="course-panel">
      <h2 class="course-section-title">Para hoje</h2>
      ${due.length
        ? `<p><strong>${due.length}</strong> ${due.length === 1 ? 'frase vencida' : 'frases vencidas'}.</p>
           <button class="course-btn-primary-lg" type="button" data-practice>Revisar ${Math.min(due.length, PRACTICE_BATCH)} agora</button>
           ${due.length > PRACTICE_BATCH ? `<p class="course-hub-subtitle">Revisões em blocos de ${PRACTICE_BATCH}.</p>` : ''}`
        : '<p class="course-hub-subtitle">Nada vence hoje. Bom trabalho.</p>'}
    </section>
    <section class="course-panel">
      <h2 class="course-section-title">Próximas revisões</h2>
      ${byDay.size ? `<ul class="course-schedule">${[...byDay.entries()].slice(0, 14).map(([day, n]) => `<li><span>${formatDate(day)}</span><strong>${n}</strong></li>`).join('')}</ul>` : '<p class="course-hub-subtitle">Sem revisões agendadas.</p>'}
    </section>
    <section>
      <h2 class="course-section-title">Frases em revisão (${rows.length})</h2>
      <ul class="course-notebook-list">${rows.slice(0, 100).map((r) => `
        <li class="course-notebook-item">
          <div class="course-notebook-item-info">
            <p class="course-notebook-sentence" lang="en">${escapeHTML(r.course_units?.text || '')}</p>
            <p class="course-notebook-trans">${escapeHTML(r.course_units?.translation_pt || '')}</p>
            <span class="course-card-stats">${escapeHTML(origin(r.course_units))} · revisão ${formatDate(r.due_date)} · intervalo ${r.interval_days} ${r.interval_days === 1 ? 'dia' : 'dias'}</span>
          </div>
        </li>`).join('')}</ul>
      ${rows.length > 100 ? `<p class="course-hub-subtitle" role="status">Mostrando as 100 primeiras de ${rows.length} frases em revisão.</p>` : ''}
    </section>`;
  panel.querySelector('[data-practice]')?.addEventListener('click', () => {
    startNotebookPractice(app, 'review', due.slice(0, PRACTICE_BATCH).map((r) => r.unit_id), 'Revisão');
  });
}

export async function renderMistakesNotebook(panel, ctx) {
  const { app, state } = ctx;
  const f = state.mistakes || (state.mistakes = { tab: 'pending' });
  const rows = await load(panel, 'Carregando seus erros…', () => db.courses.listMistakes({ includeResolved: true }), () => renderMistakesNotebook(panel, ctx));
  if (!rows) return;
  if (!rows.length) {
    renderEmpty(panel, 'Nenhum erro registrado', 'Quando você enviar uma frase com erro, ela aparece aqui com o que você digitou e a forma certa. O histórico fica guardado mesmo depois que você acerta.');
    return;
  }
  const pending = rows.filter((r) => !r.is_resolved);
  const list = f.tab === 'pending' ? pending : rows.filter((r) => r.is_resolved);

  panel.innerHTML = `
    <div class="course-filter-row">
      <div class="course-subnav course-subnav--pills" role="tablist" aria-label="Situação">
        <button type="button" role="tab" class="course-tab-btn ${f.tab === 'pending' ? 'active' : ''}" aria-selected="${f.tab === 'pending'}" data-tab="pending">Pendentes <span class="course-tab-badge">${pending.length}</span></button>
        <button type="button" role="tab" class="course-tab-btn ${f.tab === 'resolved' ? 'active' : ''}" aria-selected="${f.tab === 'resolved'}" data-tab="resolved">Resolvidos <span class="course-tab-badge">${rows.length - pending.length}</span></button>
      </div>
      ${pending.length ? `<button class="course-btn-primary-lg" type="button" data-practice-all>Treinar ${Math.min(pending.length, PRACTICE_BATCH)} erros</button>` : ''}
    </div>
    <p class="course-hub-subtitle">Acerte de primeira, sem dica, para resolver um erro.</p>
    ${list.length ? `<ul class="course-notebook-list">${list.map((r) => `
      <li class="course-notebook-item">
        <div class="course-notebook-item-info">
          <span class="course-card-stats">${escapeHTML(origin(r.course_units))} · errou ${r.mistake_count}x · ${formatDateTime(r.last_practiced_at)}</span>
          <div class="course-mistake-diff">
            <p><span aria-hidden="true">✕</span> <span class="visually-hidden">Você digitou:</span> <span class="course-mistake-wrong" lang="en">${escapeHTML(r.wrong_text_submitted)}</span></p>
            <p><span aria-hidden="true">✓</span> <span class="visually-hidden">Correto:</span> <span class="course-mistake-correct" lang="en">${escapeHTML(r.course_units?.text || '')}</span></p>
            <p class="course-card-stats">${escapeHTML(r.course_units?.translation_pt || '')}</p>
          </div>
        </div>
        <button class="course-player-btn-back" type="button" data-practice-one="${escapeHTML(r.unit_id)}">Treinar esta frase</button>
      </li>`).join('')}</ul>` : `<p class="course-hub-subtitle">${f.tab === 'pending' ? 'Nenhum erro pendente.' : 'Nenhum erro resolvido ainda.'}</p>`}`;

  panel.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { f.tab = b.dataset.tab; renderMistakesNotebook(panel, ctx); }));
  panel.querySelector('[data-practice-all]')?.addEventListener('click', () => {
    startNotebookPractice(app, 'mistakes', pending.slice(0, PRACTICE_BATCH).map((r) => r.unit_id), 'Caderno de erros');
  });
  panel.querySelectorAll('[data-practice-one]').forEach((b) => b.addEventListener('click', () => {
    startNotebookPractice(app, 'mistakes', [b.dataset.practiceOne], 'Caderno de erros');
  }));
}

export async function renderVocabularyNotebook(panel, ctx) {
  const { app, state } = ctx;
  const f = state.vocab || (state.vocab = { course: '' });
  const rows = await load(panel, 'Carregando vocabulário…', () => db.courses.listVocabulary(), () => renderVocabularyNotebook(panel, ctx));
  if (!rows) return;
  if (!rows.length) {
    renderEmpty(panel, 'Nenhuma frase salva', 'Durante a prática, abra "Mostrar resposta" e use "Salvar no vocabulário" para guardar frases e gírias aqui.');
    return;
  }
  const courses = [...new Map(rows.map((r) => [r.course_units?.course_lessons?.course_id, r.course_units?.course_lessons?.course_catalog?.title])).entries()].filter(([id]) => id);
  const list = rows.filter((r) => !f.course || r.course_units?.course_lessons?.course_id === f.course);

  panel.innerHTML = `
    <div class="course-filter-row">
      <label><span class="visually-hidden">Curso</span>
        <select id="vocab-course"><option value="">Todos os cursos (${rows.length})</option>
          ${courses.map(([id, t]) => `<option value="${escapeHTML(id)}" ${f.course === id ? 'selected' : ''}>${escapeHTML(t)}</option>`).join('')}</select></label>
      <button class="course-btn-primary-lg" type="button" data-practice-vocab>Praticar ${Math.min(list.length, PRACTICE_BATCH)} em contexto</button>
    </div>
    <ul class="course-notebook-list">${list.map((r) => `
      <li class="course-notebook-item" data-unit="${escapeHTML(r.unit_id)}">
        <div class="course-notebook-item-info">
          <p class="course-notebook-sentence" lang="en">${escapeHTML(r.course_units?.text || '')}</p>
          ${r.course_units?.ipa ? `<span class="course-breakdown-ipa">${escapeHTML(r.course_units.ipa)}</span>` : ''}
          <p class="course-notebook-trans">${escapeHTML(r.course_units?.translation_pt || '')}</p>
          ${r.course_units?.explanation_note ? `<p class="course-card-stats">${escapeHTML(r.course_units.explanation_note)}</p>` : ''}
          <span class="course-card-stats">${escapeHTML(origin(r.course_units))}</span>
        </div>
        <div class="course-item-actions">
          <button class="course-player-btn-icon" type="button" data-action="speak" aria-label="Ouvir a frase">🔊</button>
          <button class="course-player-btn-icon" type="button" data-action="remove" aria-label="Remover do vocabulário">✕</button>
        </div>
      </li>`).join('')}</ul>`;

  panel.querySelector('#vocab-course').addEventListener('change', (e) => { f.course = e.target.value; renderVocabularyNotebook(panel, ctx); });
  panel.querySelector('[data-practice-vocab]').addEventListener('click', () => {
    startNotebookPractice(app, 'review', list.slice(0, PRACTICE_BATCH).map((r) => r.unit_id), 'Vocabulário');
  });
  panel.querySelectorAll('.course-notebook-item').forEach((item) => {
    const row = rows.find((r) => r.unit_id === item.dataset.unit);
    item.querySelector('[data-action="speak"]').addEventListener('click', () => {
      playNaturalAudio(row?.course_units?.text || '', { lang: 'en-US' }).catch(() => app.showToast?.('Não foi possível tocar o áudio agora.', 'error'));
    });
    const removeBtn = item.querySelector('[data-action="remove"]');
    removeBtn.addEventListener('click', async () => {
      removeBtn.disabled = true;
      try {
        await db.courses.removeVocabulary(row.unit_id);
        app.showToast?.('Frase removida do vocabulário.', 'success');
        renderVocabularyNotebook(panel, ctx);
      } catch (err) {
        removeBtn.disabled = false;
        console.warn('[CourseNotebooks] vocabulary_remove_failed', err?.kind || err?.message);
        app.showToast?.('Não foi possível remover agora. Tente de novo.', 'error');
      }
    });
  });
}

export async function renderNotesNotebook(panel, ctx) {
  const { app } = ctx;
  const rows = await load(panel, 'Carregando notas…', () => db.courses.listNotes(), () => renderNotesNotebook(panel, ctx));
  if (!rows) return;
  if (!rows.length) {
    renderEmpty(panel, 'Nenhuma nota ainda', 'Durante a prática, abra "Mostrar resposta" e escreva uma nota pessoal: ela fica ligada à frase de origem. Exemplo de nota: “usar would para pedidos educados”.',
      { label: 'Ir para Meus cursos', onClick: () => ctx.navigate('my-courses') });
    return;
  }
  panel.innerHTML = `
    <div class="course-filter-row">
      <p class="course-hub-subtitle">${rows.length} ${rows.length === 1 ? 'nota' : 'notas'}</p>
      <button class="course-btn-primary-lg" type="button" data-practice-notes>Praticar frases anotadas</button>
    </div>
    <ul class="course-notebook-list">${rows.map((r) => `
      <li class="course-notebook-item course-note-item" data-unit="${escapeHTML(r.unit_id)}">
        <div class="course-notebook-item-info">
          <p class="course-notebook-sentence" lang="en">${escapeHTML(r.course_units?.text || '')}</p>
          <p class="course-notebook-trans">${escapeHTML(r.course_units?.translation_pt || '')}</p>
          <label class="course-note-field"><span>Nota · ${formatDateTime(r.updated_at)}</span>
            <textarea maxlength="2000" rows="2">${escapeHTML(r.note_content)}</textarea></label>
          <span class="course-card-stats">${escapeHTML(origin(r.course_units))}</span>
        </div>
        <div class="course-item-actions">
          <button class="course-player-btn-back" type="button" data-action="save">Salvar</button>
          <button class="course-player-btn-icon" type="button" data-action="delete" aria-label="Apagar nota">✕</button>
        </div>
      </li>`).join('')}</ul>`;

  panel.querySelector('[data-practice-notes]').addEventListener('click', () => {
    startNotebookPractice(app, 'review', rows.slice(0, PRACTICE_BATCH).map((r) => r.unit_id), 'Notas');
  });
  panel.querySelectorAll('.course-note-item').forEach((item) => {
    const unitId = item.dataset.unit;
    item.querySelector('[data-action="save"]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const content = item.querySelector('textarea').value.trim();
      if (!content) { item.querySelector('textarea').focus(); return; }
      btn.disabled = true;
      try {
        await db.courses.saveNote(unitId, content);
        app.showToast?.('Nota atualizada.', 'success');
      } catch (err) {
        console.warn('[CourseNotebooks] note_save_failed', err?.kind || err?.message);
        app.showToast?.('Não foi possível salvar a nota.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
    item.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (!confirm('Apagar esta nota?')) return;
      btn.disabled = true;
      try {
        await db.courses.deleteNote(unitId);
        app.showToast?.('Nota apagada.', 'success');
        renderNotesNotebook(panel, ctx);
      } catch (err) {
        btn.disabled = false;
        console.warn('[CourseNotebooks] note_delete_failed', err?.kind || err?.message);
        app.showToast?.('Não foi possível apagar a nota.', 'error');
      }
    });
  });
}
