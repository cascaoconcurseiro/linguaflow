// content/subtitles/shortcuts-help.js — Painel de atalhos do player (Issue #432)
// Fonte única da lista de atalhos mostrada ao aluno; o teste de contrato garante que cada tecla
// listada aqui existe em player-hotkeys.js.

export const SHORTCUT_GROUPS = [
  {
    title: 'Navegar nas falas',
    items: [
      ['A', 'Frase anterior'],
      ['D', 'Próxima frase'],
      ['S', 'Repetir a frase (shadowing)'],
      ['B', 'Laço A–B: 1º toque marca o início, 2º marca o fim e repete, 3º desfaz'],
    ],
  },
  {
    title: 'Estudar',
    items: [
      ['F', 'Escolher palavra da legenda pelo teclado (← → navegam, Enter abre o card, Esc volta)'],
      ['P', 'Abrir ou fechar o roteiro'],
      ['Q', 'Pausar depois de cada fala'],
      ['V', 'Escuta primeiro: esconde a legenda original'],
      ['M', 'Modo shadowing: frase atual em destaque, com a anterior e a próxima em volta'],
      ['R', 'Revisão rápida'],
    ],
  },
  {
    title: 'Ajustar',
    items: [
      ['[', 'Falar mais devagar (−0,05×)'],
      [']', 'Falar mais rápido (+0,05×)'],
      ['Z', 'Legenda 0,1 s mais tarde'],
      ['X', 'Legenda 0,1 s mais cedo'],
      ['O', 'Configurações'],
      ['C', 'Ligar ou desligar o LinguaFlow'],
      ['Espaço', 'Reproduzir ou pausar'],
      ['Shift + ?', 'Mostrar esta lista'],
    ],
  },
];

export const HELP_ID = 'lf-shortcuts-help';

/** Abre o painel de atalhos. Devolve { close } ou null se já estiver aberto. */
export function showShortcutsHelp({ onClose } = {}) {
  if (document.getElementById(HELP_ID)) return null;
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const overlay = document.createElement('div');
  overlay.id = HELP_ID;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', `${HELP_ID}-title`);
  const groups = SHORTCUT_GROUPS.map((group) => `
    <section>
      <h3>${group.title}</h3>
      <dl>${group.items.map(([key, text]) => `<div><dt><kbd>${key}</kbd></dt><dd>${text}</dd></div>`).join('')}</dl>
    </section>`).join('');
  overlay.innerHTML = `
    <style>
      #${HELP_ID}{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;background:rgba(2,6,23,.62);
        font:400 14px/1.45 system-ui,-apple-system,sans-serif;opacity:0;transition:opacity .16s ease;}
      #${HELP_ID}.is-in{opacity:1;}
      #${HELP_ID} .lf-help-card{width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;box-sizing:border-box;color-scheme:dark;
        background:#0f172a;color:#e2e8f0;border:1px solid rgba(125,211,252,.35);border-radius:12px;padding:20px 22px;box-shadow:0 18px 48px rgba(0,0,0,.55);}
      #${HELP_ID} h2{margin:0 0 4px;font-size:18px;color:#f8fafc;}
      #${HELP_ID} p.lf-help-sub{margin:0 0 14px;color:#94a3b8;}
      #${HELP_ID} h3{margin:12px 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7dd3fc;}
      #${HELP_ID} dl{margin:0;}
      #${HELP_ID} dl>div{display:grid;grid-template-columns:72px 1fr;gap:10px;align-items:baseline;padding:3px 0;}
      #${HELP_ID} dt{margin:0;}
      #${HELP_ID} dd{margin:0;}
      #${HELP_ID} kbd{display:inline-block;min-width:26px;text-align:center;padding:2px 8px;border-radius:6px;background:#1e293b;
        border:1px solid #334155;font:600 13px ui-monospace,monospace;color:#f8fafc;}
      #${HELP_ID} button{margin-top:14px;appearance:none;border:0;border-radius:8px;padding:9px 18px;cursor:pointer;
        font:600 14px system-ui;background:#0369a1;color:#fff;}
      #${HELP_ID} button:focus-visible{outline:2px solid #7dd3fc;outline-offset:2px;}
      @media (prefers-reduced-motion:reduce){#${HELP_ID}{transition:none;}}
    </style>
    <div class="lf-help-card">
      <h2 id="${HELP_ID}-title">Atalhos do LinguaFlow</h2>
      <p class="lf-help-sub">Funcionam enquanto o LinguaFlow está ligado, exceto C. Não valem enquanto você digita.</p>
      ${groups}
      <button type="button" data-help-close>Fechar</button>
    </div>`;
  document.body.appendChild(overlay);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
    previous?.focus?.();
    onClose?.();
  };
  const onKey = (event) => {
    if (event.key === 'Escape' || event.key === '?' || event.key.toLowerCase() === 'h') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      // Mantém o foco dentro do diálogo (só há um botão).
      event.preventDefault();
      overlay.querySelector('[data-help-close]').focus({ preventScroll: true });
    }
  };
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay || event.target.closest('[data-help-close]')) close();
  });
  requestAnimationFrame(() => overlay.classList.add('is-in'));
  overlay.querySelector('[data-help-close]').focus({ preventScroll: true });
  overlay.querySelector('.lf-help-card').scrollTop = 0;
  return { close };
}
