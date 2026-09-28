// dashboard/js/ui/activityHeatmap.js — mapa de calor anual (segunda a domingo),
// navegável por teclado. Usado em Progresso e na Análise dos Cursos.

const BUCKETS = ['Sem estudo', 'Até 15 min', '15–30 min', '30–60 min', '60+ min'];

export function heatLevel(seconds) {
  if (!(seconds > 0)) return 0;
  if (seconds < 900) return 1;
  if (seconds < 1800) return 2;
  if (seconds < 3600) return 3;
  return 4;
}

export function yearGrid(heatmap, year = new Date().getUTCFullYear()) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  const offset = (start.getUTCDay() + 6) % 7; // semana começa na segunda
  const days = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    days.push({ key, seconds: Number(heatmap?.[key] || 0) });
  }
  return { offset, days };
}

export function renderHeatmap(heatmap, { today = new Date().toISOString().slice(0, 10), formatDate, formatDuration }) {
  const { offset, days } = yearGrid(heatmap);
  const counts = BUCKETS.map(() => 0);
  days.filter((d) => d.key <= today).forEach((d) => { counts[heatLevel(d.seconds)] += 1; });
  const studied = days.filter((d) => d.seconds > 0);
  return `
    <p class="course-hub-subtitle">${studied.length} ${studied.length === 1 ? 'dia' : 'dias'} de estudo · ${formatDuration(studied.reduce((n, d) => n + d.seconds, 0))}</p>
    <p class="course-hub-subtitle" id="heat-help">Setas mudam o dia; Home/End vão para o início/fim da semana.</p>
    <div class="course-heatmap" role="grid" aria-label="Atividade no ano" aria-describedby="heat-help" style="--heat-offset:${offset}" data-offset="${offset}">
      ${days.map((d, i) => `<button type="button" role="gridcell" class="course-heat-cell lvl-${heatLevel(d.seconds)}" tabindex="${d.key === today ? 0 : -1}"
        data-index="${i}" aria-label="${formatDate(d.key)}: ${d.seconds ? formatDuration(d.seconds) : 'sem estudo'}" ${d.key > today ? 'disabled' : ''}></button>`).join('')}
    </div>
    <ul class="course-heat-legend">${BUCKETS.map((label, i) => `<li><span class="course-heat-cell lvl-${i}" aria-hidden="true"></span>${label}: ${counts[i]} ${counts[i] === 1 ? 'dia' : 'dias'}</li>`).join('')}</ul>`;
}

export function bindHeatmap(root) {
  const grid = root.querySelector('.course-heatmap');
  if (!grid) return;
  const cells = [...grid.querySelectorAll('.course-heat-cell[data-index]')];
  const offset = Number(grid.dataset.offset || 0);
  grid.addEventListener('keydown', (e) => {
    const i = Number(e.target.dataset.index);
    if (Number.isNaN(i)) return;
    const weekday = (i + offset) % 7;
    const moves = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1, Home: -weekday, End: 6 - weekday };
    if (moves[e.key] == null) return;
    e.preventDefault();
    const target = cells[Math.max(0, Math.min(cells.length - 1, i + moves[e.key]))];
    if (!target || target.disabled) return;
    e.target.tabIndex = -1;
    target.tabIndex = 0;
    target.focus();
  });
}
