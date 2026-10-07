// Evolução por nível distingue conquistas, material atual e dispensa pelo ponto de partida.
import { escapeHTML } from '../../../../utils/html.js';

export function levelStatus(level) {
  if (level.completion || level.is_completed) return 'Base concluída';
  if (!level.total) return 'Em breve';
  if (level.skipped) return 'Dispensado pelo nível escolhido';
  return level.completed > 0 || level.started_at ? 'Em andamento' : 'Não iniciado';
}

export function levelCompletionText(level) {
  const record = level.completion;
  if (!record) return '';
  const date = record.completed_at || record.recorded_at;
  if (!date) return '';
  const formatted = new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${record.completed_at ? 'Base concluída em' : 'Conclusão reconhecida em'} ${formatted} · ${record.total} ${record.total === 1 ? 'aula' : 'aulas'} na base daquela data`;
}

export function renderLevelHistory(container, { path, navigate, refresh }) {
  if (!path?.levels) {
    container.innerHTML = '<p role="status" class="course-hub-subtitle">Não foi possível carregar sua evolução por nível.</p><button type="button" class="course-link" data-retry-levels>Tentar novamente</button>';
    container.querySelector('[data-retry-levels]').addEventListener('click', async (event) => {
      event.target.disabled = true;
      try { await refresh?.(); } finally { event.target.disabled = false; }
    });
    return;
  }
  container.innerHTML = `<h2 class="course-section-title">Sua evolução por nível</h2>
    <p class="course-hub-subtitle">Seu estudo atual e as bases já concluídas. As revisões continuam ao avançar.</p>
    <ol class="course-level-history">${path.levels.map(level => `<li>
      <div><strong>${escapeHTML(level.level)} · ${escapeHTML(levelStatus(level))}</strong>
        <p class="course-card-stats">${level.completed} de ${level.total} aulas da base atual</p>
        ${levelCompletionText(level) ? `<p class="course-card-stats">${escapeHTML(levelCompletionText(level))}</p>` : ''}
        ${level.new_lessons > 0 ? `<p class="course-card-stats">${level.new_lessons} ${level.new_lessons === 1 ? 'aula acrescentada' : 'aulas acrescentadas'} desde sua conclusão</p>` : ''}
      </div><button type="button" class="course-btn-continue" data-history-level="${escapeHTML(level.level)}" aria-label="Ver aulas do nível ${escapeHTML(level.level)}">Ver aulas</button>
    </li>`).join('')}</ol>`;
  container.querySelectorAll('[data-history-level]').forEach(button => button.addEventListener('click', () => navigate('level', { level: button.dataset.historyLevel })));
}
