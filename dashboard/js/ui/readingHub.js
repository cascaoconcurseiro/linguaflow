export function renderReadingHeader(active) {
  return `<header class="reading-hub-header">
    <p class="product-kicker">LEITURA CONTEXTUAL</p>
    <h1>Ler com contexto</h1>
    <p>Escolha uma história guiada ou traga um texto real. Nos dois casos, você pode ouvir, entender termos e salvar somente o que vale revisar.</p>
    <nav class="reading-hub-nav" aria-label="Escolher fonte de leitura">
      <button type="button" data-reading-route="stories" aria-current="${active === 'stories' ? 'page' : 'false'}">Histórias guiadas</button>
      <button type="button" data-reading-route="reader" aria-current="${active === 'reader' ? 'page' : 'false'}">Meus textos</button>
    </nav>
  </header>`;
}

export function bindReadingHeader(container, app) {
  container.querySelectorAll('[data-reading-route]').forEach(button => {
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-current') === 'page') return;
      app.navigate(button.dataset.readingRoute);
    });
  });
}
