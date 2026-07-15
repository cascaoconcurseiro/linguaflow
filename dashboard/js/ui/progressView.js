const PROGRESS_DESTINATIONS = [
  {
    route: 'stats',
    eyebrow: 'SUA MEMÓRIA',
    title: 'Retenção e carga de revisão',
    description: 'Veja constância, retenção recente e o que está programado para os próximos dias.',
    action: 'Ver estatísticas',
  },
  {
    route: 'leagues',
    eyebrow: 'OPCIONAL',
    title: 'Liga',
    description: 'Acompanhe atividades qualificadas sem confundir repetição livre com aprendizagem.',
    action: 'Ver liga',
  },
];

export function renderProgress(container, app) {
  container.innerHTML = `
    <main class="product-hub" aria-labelledby="progress-title">
      <header class="product-hub-header">
        <p class="product-kicker">PROGRESSO</p>
        <h1 id="progress-title">Sua aprendizagem, não apenas seus cliques</h1>
        <p>Retenção e revisões aparecem primeiro. Competição e detalhes técnicos continuam disponíveis, mas não governam o plano diário.</p>
      </header>
      <section class="product-hub-grid product-hub-grid-two" aria-label="Áreas de progresso">
        ${PROGRESS_DESTINATIONS.map(item => `
          <article class="product-destination-card">
            <p class="product-kicker">${item.eyebrow}</p>
            <h2>${item.title}</h2>
            <p>${item.description}</p>
            <button class="btn btn-secondary" type="button" data-progress-route="${item.route}">${item.action}</button>
          </article>`).join('')}
      </section>
    </main>`;

  container.querySelectorAll('[data-progress-route]').forEach(button => {
    button.addEventListener('click', () => app.navigate?.(button.dataset.progressRoute));
  });
}
