const MAX_HOSTS = ['max.com', 'hbomax.com', 'hbo.com'];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function isMaxHost(hostname = '') {
  return MAX_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

export function computeMaxOverlayLayout({
  viewportHeight,
  controlsRect = null,
  progressRect = null,
  videoRect = null,
  dockHeight = 42,
  gap = 12,
}) {
  const visibleTops = [progressRect, controlsRect]
    .filter((rect) => rect && rect.width > 0 && rect.height > 0)
    .map((rect) => rect.top)
    .filter((top) => Number.isFinite(top) && top > viewportHeight * 0.45);

  const playerBottom = videoRect?.bottom > 0 ? Math.min(videoRect.bottom, viewportHeight) : viewportHeight;
  const timelineTop = visibleTops.length ? Math.min(...visibleTops) : playerBottom - 72;
  const occupiedBottom = clamp(viewportHeight - timelineTop, 56, viewportHeight * 0.34);
  const dockBottom = Math.round(occupiedBottom + 8);
  const subtitleBottom = Math.round(dockBottom + dockHeight + gap);

  return { dockBottom, subtitleBottom, timelineTop };
}

export function computeMaxPopupLayout({
  viewportWidth,
  subtitleTop,
  popupWidth = 340,
  popupHeight,
  anchorRect = null,
  safeTop = 12,
  gap = 16,
}) {
  const maxHeight = Math.max(0, Math.floor(subtitleTop - safeTop - gap));
  const renderedHeight = Math.min(Math.max(0, popupHeight), maxHeight);
  const anchorCenter = anchorRect?.width > 0
    ? anchorRect.left + anchorRect.width / 2
    : viewportWidth / 2;
  const left = clamp(anchorCenter - popupWidth / 2, 10, Math.max(10, viewportWidth - popupWidth - 10));
  const top = Math.max(safeTop, Math.floor(subtitleTop - gap - renderedHeight));
  return { left, top, maxHeight };
}

const CONTROL_SELECTORS = [
  '[data-testid="control_footer"]',
  '[data-testid*="controls"]',
  '[class*="ControlsFooter"]',
  '[class*="PlayerControls"]',
  '[class*="controls-footer"]',
];

const PROGRESS_SELECTORS = [
  '[role="slider"][aria-label*="progress" i]',
  '[role="slider"][aria-label*="seek" i]',
  '[data-testid*="progress"]',
  '[class*="ProgressBar"]',
  '[class*="Scrubber"]',
];

function firstVisible(selectors) {
  let best = null;
  for (const selector of selectors) {
    for (const element of document.querySelectorAll(selector)) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && (!best || rect.top > best.rect.top)) {
        best = { element, rect };
      }
    }
  }
  return best;
}

export class MaxPlayerUI {
  constructor(engine) {
    this.engine = engine;
    this.dock = null;
    this.frame = 0;
    this.lastLayout = '';
    this.visible = true;
    this.abortController = new AbortController();
  }

  init() {
    if (!isMaxHost(window.location.hostname)) return;
    this._ensureDock();
    const signal = this.abortController.signal;
    window.addEventListener('resize', () => this.schedule(), { signal });
    document.addEventListener('fullscreenchange', () => this.schedule(true), { signal });
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(document.documentElement, { childList: true, subtree: true });
    this.schedule(true);
  }

  destroy() {
    this.abortController.abort();
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
    clearTimeout(this.retryTimer);
    this.dock?.remove();
  }

  schedule(remount = false) {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (remount) this._mountInOverlayRoot();
      this._layout();
    });
  }

  _overlayRoot() {
    return document.fullscreenElement || document.body;
  }

  _mountInOverlayRoot() {
    const root = this._overlayRoot();
    if (this.dock && this.dock.parentElement !== root) root.appendChild(this.dock);
    const subtitleHost = document.getElementById('linguaflow-subtitle-host');
    if (subtitleHost && subtitleHost.parentElement !== root) root.appendChild(subtitleHost);
  }

  _ensureDock() {
    this.dock = document.getElementById('lf-max-controls');
    if (this.dock) return;

    const dock = document.createElement('div');
    dock.id = 'lf-max-controls';
    dock.setAttribute('role', 'toolbar');
    dock.setAttribute('aria-label', 'Controles LinguaFlow');
    dock.innerHTML = `
      <button type="button" data-action="toggle" aria-pressed="true" title="Ativar ou ocultar legendas LinguaFlow (C)">LF</button>
      <span class="lf-max-separator" aria-hidden="true"></span>
      <button type="button" data-action="previous" title="Legenda anterior (A)" aria-label="Legenda anterior">‹</button>
      <button type="button" data-action="repeat" title="Repetir frase (S)" aria-label="Repetir frase">↻</button>
      <button type="button" data-action="next" title="Próxima legenda (D)" aria-label="Próxima legenda">›</button>
      <span class="lf-max-separator" aria-hidden="true"></span>
      <button type="button" data-action="panel" title="Painel de legendas (L)" aria-label="Painel de legendas">▤</button>
      <button type="button" data-action="settings" title="Configurações LinguaFlow (O)" aria-label="Configurações LinguaFlow">⚙</button>
    `;

    const style = document.createElement('style');
    style.id = 'lf-max-controls-style';
    style.textContent = `
      #lf-max-controls{position:fixed;left:50%;transform:translateX(-50%);z-index:2147483642;
        display:flex;align-items:center;gap:4px;height:42px;padding:4px 7px;border-radius:999px;
        background:rgba(8,12,22,.78);border:1px solid rgba(255,255,255,.16);
        box-shadow:0 8px 30px rgba(0,0,0,.42);backdrop-filter:blur(14px) saturate(150%);
        pointer-events:auto;transition:opacity .16s ease,transform .16s ease;}
      #lf-max-controls button{appearance:none;width:34px;height:34px;border:0;border-radius:50%;
        display:grid;place-items:center;background:transparent;color:#f8fafc;font:700 17px/1 system-ui;
        cursor:pointer;transition:background .15s ease,color .15s ease,transform .15s ease;}
      #lf-max-controls button:hover,#lf-max-controls button:focus-visible{background:rgba(56,189,248,.2);
        color:#7dd3fc;outline:2px solid transparent;transform:scale(1.06);}
      #lf-max-controls button[data-action="toggle"]{font-size:11px;letter-spacing:.03em;color:#7dd3fc;}
      #lf-max-controls button[data-action="toggle"][aria-pressed="false"]{color:#94a3b8;}
      #lf-max-controls .lf-max-separator{width:1px;height:20px;background:rgba(255,255,255,.14);margin:0 2px;}
      @media (max-width:640px){#lf-max-controls{gap:1px;padding-inline:4px}#lf-max-controls button{width:31px;height:31px}}
      @media (prefers-reduced-motion:reduce){#lf-max-controls,#lf-max-controls button{transition:none}}
    `;
    if (!document.getElementById(style.id)) document.head.appendChild(style);

    dock.addEventListener('click', (event) => {
      event.stopPropagation();
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'toggle') {
        this.visible = !this.visible;
        button.setAttribute('aria-pressed', String(this.visible));
        this.engine.toggleSubtitles(this.visible);
      } else if (action === 'previous') this.engine.prevSubtitle();
      else if (action === 'repeat') this.engine.repeatSubtitle();
      else if (action === 'next') this.engine.nextSubtitle();
      else if (action === 'panel') this.engine.toggleSubtitlePanel();
      else if (action === 'settings') window.dispatchEvent(new CustomEvent('LF_TOGGLE_SETTINGS'));
    });
    dock.addEventListener('mousedown', (event) => event.stopPropagation());

    this.dock = dock;
    this._mountInOverlayRoot();
  }

  _layout() {
    this._ensureDock();
    this._mountInOverlayRoot();
    const video = document.querySelector('video');
    const subtitleHost = document.getElementById('linguaflow-subtitle-host');
    if (!video || !subtitleHost) {
      this.dock.style.display = 'none';
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.schedule(true), 500);
      return;
    }
    clearTimeout(this.retryTimer);

    const controls = firstVisible(CONTROL_SELECTORS);
    const progress = firstVisible(PROGRESS_SELECTORS);
    const layout = computeMaxOverlayLayout({
      viewportHeight: window.innerHeight,
      controlsRect: controls?.rect,
      progressRect: progress?.rect,
      videoRect: video.getBoundingClientRect(),
    });
    const signature = `${layout.dockBottom}:${layout.subtitleBottom}:${this._overlayRoot() === document.body}`;
    if (signature === this.lastLayout && this.dock.style.display !== 'none') return;
    this.lastLayout = signature;

    this.dock.style.display = 'flex';
    this.dock.style.setProperty('bottom', `${layout.dockBottom}px`, 'important');
    subtitleHost.style.setProperty('position', 'fixed', 'important');
    subtitleHost.style.setProperty('bottom', `${layout.subtitleBottom}px`, 'important');
    subtitleHost.style.setProperty('left', '50%', 'important');
    subtitleHost.style.setProperty('transform', 'translateX(-50%)', 'important');
    subtitleHost.style.setProperty('z-index', '2147483641', 'important');
  }
}
