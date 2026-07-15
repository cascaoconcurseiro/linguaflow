const LEARN_DESTINATIONS = [
  {
    route: 'stories',
    eyebrow: 'LER E OUVIR',
    title: 'Histórias no seu nível',
    description: 'Continue uma história ou crie um contexto novo para as frases que está aprendendo.',
    action: 'Abrir histórias',
  },
  {
    route: 'reader',
    eyebrow: 'LER CONTEÚDO REAL',
    title: 'Leitor',
    description: 'Importe um texto, descubra vocabulário no contexto e guarde somente o que vale revisar.',
    action: 'Abrir leitor',
  },
  {
    route: 'game',
    eyebrow: 'PRATICAR UMA FRAQUEZA',
    title: 'Prática',
    description: 'Treine escuta, associação ou ordem de frase sem transformar repetição livre em domínio.',
    action: 'Escolher prática',
  },
];

export function renderLearn(container, app) {
  container.innerHTML = `
    <main class="product-hub" aria-labelledby="learn-title">
      <header class="product-hub-header">
        <p class="product-kicker">APRENDER COM CONTEXTO REAL</p>
        <h1 id="learn-title">O que você quer entender hoje?</h1>
        <p>Vídeos, histórias e textos alimentam o mesmo ciclo: descobrir uma frase, entendê-la e revê-la no momento certo.</p>
      </header>
      <section class="source-callout" aria-labelledby="video-source-title">
        <div>
          <p class="product-kicker">SEU DIFERENCIAL</p>
          <h2 id="video-source-title">Aprender com YouTube e Max</h2>
          <p>Abra o vídeo normalmente e use o painel do LinguaFlow para capturar a frase no instante em que ela é falada.</p>
        </div>
        <span class="source-callout-status">Captura pelo painel da extensão</span>
      </section>
      <section class="product-hub-grid" aria-label="Fontes e práticas">
        ${LEARN_DESTINATIONS.map(item => `
          <article class="product-destination-card">
            <p class="product-kicker">${item.eyebrow}</p>
            <h2>${item.title}</h2>
            <p>${item.description}</p>
            <button class="btn btn-secondary" type="button" data-learn-route="${item.route}">${item.action}</button>
          </article>`).join('')}
      </section>
    </main>`;

  container.querySelectorAll('[data-learn-route]').forEach(button => {
    button.addEventListener('click', () => app.navigate?.(button.dataset.learnRoute));
  });
}
