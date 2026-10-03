// Primeiros passos da tela Hoje (#427): para quem ainda não salvou nenhuma palavra, o caminho
// é o mesmo da promessa do produto — entender o que você assiste e salvar a primeira palavra.
// Os dois primeiros passos acontecem fora do site (extensão e player), então são marcados pelo
// aluno; o terceiro some sozinho assim que a primeira palavra existe (a tela passa a mostrar o plano).

export const FIRST_STEPS_KEY = 'first_steps_v1';
export const EXTENSION_DOWNLOAD_URL = 'https://github.com/cascaoconcurseiro/linguaflow/releases/latest';

export function parseFirstSteps(value) {
  if (typeof value !== 'string') return { installed: false, enabled: false };
  try {
    const parsed = JSON.parse(value);
    return { installed: parsed?.installed === true, enabled: parsed?.enabled === true };
  } catch {
    return { installed: false, enabled: false };
  }
}

export function buildFirstSteps({ installed = false, enabled = false } = {}) {
  const steps = [
    {
      id: 'installed',
      title: 'Instale a extensão no Chrome',
      hint: 'Ela coloca o LinguaFlow dentro do YouTube, HBO Max, Netflix, Disney+ e Prime Video.',
      done: installed === true,
    },
    {
      id: 'enabled',
      title: 'Abra um vídeo em inglês e ligue o botão LF',
      hint: 'No YouTube ele fica na barra do player; nos outros, na lateral. Atalho: tecla C.',
      done: enabled === true,
    },
    {
      id: 'saved',
      title: 'Clique numa palavra da legenda e salve',
      hint: 'A frase do vídeo vai junto. Amanhã ela volta na hora certa para você lembrar.',
      done: false,
    },
  ];
  const current = steps.findIndex((step) => !step.done);
  return steps.map((step, index) => ({ ...step, current: index === current }));
}

const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function renderFirstSteps(steps) {
  const items = steps.map((step, index) => {
    const actions = [];
    if (step.current && step.id === 'installed') {
      actions.push(`<a class="first-step-btn first-step-btn-primary" href="${EXTENSION_DOWNLOAD_URL}" target="_blank" rel="noopener noreferrer">Baixar a extensão</a>`);
    }
    if (step.current && (step.id === 'installed' || step.id === 'enabled')) {
      actions.push(`<button type="button" class="first-step-btn" data-first-step="${step.id}">${step.id === 'installed' ? 'Já instalei' : 'Já liguei'}</button>`);
    }
    return `<li class="first-step${step.done ? ' is-done' : ''}${step.current ? ' is-current' : ''}"${step.current ? ' aria-current="step"' : ''}>
      <span class="first-step-index" aria-hidden="true">${step.done ? '✓' : index + 1}</span>
      <div class="first-step-body">
        <h3>${esc(step.title)}<span class="visually-hidden">${step.done ? ' — concluído' : ''}</span></h3>
        <p>${esc(step.hint)}</p>
        ${actions.length ? `<div class="first-step-actions">${actions.join('')}</div>` : ''}
      </div>
    </li>`;
  }).join('');
  return `<section id="home-first-steps" class="home-first-steps" aria-labelledby="first-steps-title">
    <p class="product-kicker">COMECE AQUI</p>
    <h1 id="first-steps-title">Entenda o que você assiste em inglês e não esqueça mais as palavras</h1>
    <p class="home-primary-reason">Três passos até a sua primeira palavra salva. Leva uns 5 minutos.</p>
    <ol class="first-steps-list">${items}</ol>
    <button type="button" class="first-step-link" id="btn-primary-stories">Prefiro começar lendo uma história →</button>
  </section>`;
}
