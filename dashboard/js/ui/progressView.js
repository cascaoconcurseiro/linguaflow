const PROGRESS_DESTINATIONS = [
  {
    route: 'fluency-check',
    eyebrow: 'USO REAL',
    title: 'Check de comunicação',
    description: 'Veja como o LinguaFlow vai observar escuta, fala espontânea, escrita e interação sem confundir atividade com fluência.',
    action: 'Conhecer o check',
    emphasis: 'primary',
  },
  {
    route: 'stats',
    eyebrow: 'SUA MEMÓRIA',
    title: 'Retenção e carga de revisão',
    description: 'Veja constância, retenção recente e o que está programado para os próximos dias.',
    action: 'Ver estatísticas',
    emphasis: 'secondary',
  },
  {
    route: 'leagues',
    eyebrow: 'OPCIONAL',
    title: 'Atividade competitiva',
    description: 'Veja o placar semanal opcional. XP mostra atividade no app e não mede domínio do idioma.',
    action: 'Ver liga',
    emphasis: 'optional',
  },
];

export function renderProgress(container, app) {
  container.innerHTML = `
    <main class="product-hub" aria-labelledby="progress-title">
      <header class="product-hub-header">
        <p class="product-kicker">PROGRESSO</p>
        <h1 id="progress-title">Sua aprendizagem, não apenas seus cliques</h1>
        <p>Evidências de comunicação e memória aparecem antes da competição. Cada medida explica o que realmente representa.</p>
      </header>
      <section class="product-hub-grid" aria-label="Áreas de progresso">
        ${PROGRESS_DESTINATIONS.map(item => `
          <article class="product-destination-card product-destination-card-${item.emphasis}">
            <p class="product-kicker">${item.eyebrow}</p>
            <h2>${item.title}</h2>
            <p>${item.description}</p>
            <button class="btn ${item.emphasis === 'primary' ? 'btn-primary' : 'btn-secondary'}" type="button" data-progress-route="${item.route}">${item.action}</button>
          </article>`).join('')}
      </section>
    </main>`;

  container.querySelectorAll('[data-progress-route]').forEach(button => {
    button.addEventListener('click', () => app.navigate?.(button.dataset.progressRoute));
  });
}
