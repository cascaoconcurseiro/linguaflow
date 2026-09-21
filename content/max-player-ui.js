const MAX_HOSTS = ['max.com', 'hbomax.com', 'hbo.com'];
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function isMaxHost(hostname = '') {
  return MAX_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

export function nextPlaybackRate(currentRate) {
  const normalized = Number(currentRate);
  if (!Number.isFinite(normalized)) return 1;
  return PLAYBACK_RATES.find((rate) => rate > normalized + 0.001) || PLAYBACK_RATES[0];
}

export function computeMaxDockPlacement({
  viewportWidth,
  panelWidth = 0,
  edgeGap = 20,
  dockWidth = 52,
}) {
  if (!panelWidth) return { left: 'auto', right: edgeGap, hidden: false };
  const availableWidth = viewportWidth - panelWidth;
  if (availableWidth < dockWidth + edgeGap * 2) {
    return { left: 'auto', right: edgeGap, hidden: true };
  }
  return { left: 'auto', right: Math.round(panelWidth + edgeGap), hidden: false };
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
  // A Max usa uma composição própria e previsível: 137px mantém a legenda
  // acima da timeline sem variar quando os controles nativos aparecem/somem.
  const subtitleBottom = 137;

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
    this.visible = typeof engine?.isActivated === 'boolean' ? engine.isActivated : true;
    this.playbackRate = this._readPlaybackRate();
    this.video = null;
    this.rateChangeHandler = null;
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
    if (this.video && this.rateChangeHandler) {
      this.video.removeEventListener('ratechange', this.rateChangeHandler);
    }
    this.dock?.remove();
  }

  _readPlaybackRate() {
    try {
      const saved = Number(globalThis.localStorage?.getItem('lf_video_playback_rate'));
      return PLAYBACK_RATES.includes(saved) ? saved : 1;
    } catch {
      return 1;
    }
  }

  _updateSpeedButton() {
    const button = this.dock?.querySelector('button[data-action="speed"]');
    if (!button) return;
    const label = `${this.playbackRate}×`;
    button.textContent = label;
    button.title = `Velocidade do vídeo: ${label}`;
    button.setAttribute('aria-label', `Velocidade do vídeo: ${label}. Clique para alterar`);
    button.classList.toggle('is-altered', this.playbackRate !== 1);
  }

  _syncLoopButton() {
    const button = this.dock?.querySelector('button[data-action="loop"]');
    if (!button) return;
    const active = this.engine.isLooping === true;
    button.setAttribute('aria-pressed', String(active));
    button.title = active ? 'Desativar loop da frase' : 'Ativar loop da frase';
    button.setAttribute('aria-label', button.title);
  }

  syncActiveState(active) {
    this.visible = Boolean(active);
    const button = this.dock?.querySelector('button[data-action="toggle"]');
    if (button) {
      button.setAttribute('aria-pressed', String(this.visible));
      button.title = this.visible ? 'Ocultar legendas LinguaFlow (C)' : 'Ativar legendas LinguaFlow (C)';
    }
  }

  _setPlaybackRate(rate, { persist = true } = {}) {
    const normalized = Number(rate);
    if (!Number.isFinite(normalized) || normalized < 0.25 || normalized > 4) return this.playbackRate;
    this.playbackRate = normalized;
    if (this.video && Math.abs(this.video.playbackRate - normalized) > 0.001) {
      this.video.playbackRate = normalized;
    }
    if (persist) {
      try {
        globalThis.localStorage?.setItem('lf_video_playback_rate', String(normalized));
      } catch {
        // A reprodução continua funcionando mesmo quando a Max bloqueia storage.
      }
    }
    this._updateSpeedButton();
    return this.playbackRate;
  }

  _bindVideo(video) {
    if (this.video === video) return;
    if (this.video && this.rateChangeHandler) {
      this.video.removeEventListener('ratechange', this.rateChangeHandler);
    }
    this.video = video;
    this.rateChangeHandler = () => {
      const rate = Number(video.playbackRate);
      if (Number.isFinite(rate) && rate > 0) this._setPlaybackRate(rate);
    };
    video.addEventListener('ratechange', this.rateChangeHandler);
    this._setPlaybackRate(this.playbackRate, { persist: false });
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
    if (isMaxHost(window.location.hostname)) {
      const subtitleHost = document.getElementById('linguaflow-subtitle-host');
      if (subtitleHost && subtitleHost.parentElement !== root) root.appendChild(subtitleHost);
    }
  }

  _ensureDock() {
    this.dock = document.getElementById('lf-max-controls');
    if (this.dock) return;

    const dock = document.createElement('div');
    dock.id = 'lf-max-controls';
    dock.setAttribute('role', 'toolbar');
    dock.setAttribute('aria-label', 'Controles LinguaFlow');
    dock.innerHTML = `
      <button type="button" data-action="toggle" class="lf-dock-toggle" aria-pressed="${this.visible}" title="Ativar ou ocultar legendas LinguaFlow (C)">
        <span class="lf-toggle-text">LF</span>
        <span class="lf-switch-track" aria-hidden="true"><span class="lf-switch-thumb"></span></span>
      </button>
      <span class="lf-max-separator" aria-hidden="true"></span>
      <button type="button" data-action="previous" title="Legenda anterior (A)" aria-label="Legenda anterior">‹</button>
      <button type="button" data-action="loop" aria-pressed="false" title="Ativar loop da frase" aria-label="Ativar loop da frase">↻</button>
      <button type="button" data-action="next" title="Próxima legenda (D)" aria-label="Próxima legenda">›</button>
      <button type="button" data-action="speed" title="Velocidade do vídeo: 1×" aria-label="Velocidade do vídeo: 1×. Clique para alterar">1×</button>
      <span class="lf-max-separator" aria-hidden="true"></span>
      <button type="button" data-action="panel" title="Painel de legendas (L)" aria-label="Painel de legendas">▤</button>
      <button type="button" data-action="settings" title="Configurações LinguaFlow (O)" aria-label="Configurações LinguaFlow">⚙</button>
    `;

    const style = document.createElement('style');
    style.id = 'lf-max-controls-style';
    style.textContent = `
      #lf-max-controls{position:fixed;right:20px;top:50%;transform:translateY(-50%);z-index:2147483642;
        display:flex;flex-direction:column;align-items:center;gap:4px;width:52px;padding:7px 4px;border-radius:999px;
        background:rgba(8,12,22,.78);border:1px solid rgba(255,255,255,.16);
        box-shadow:0 8px 30px rgba(0,0,0,.42);backdrop-filter:blur(14px) saturate(150%);
        pointer-events:auto;transition:opacity .16s ease,transform .16s ease;}
      #lf-max-controls button{appearance:none;width:44px;height:44px;border:0;border-radius:50%;
        display:grid;place-items:center;background:transparent;color:#f8fafc;font:700 17px/1 system-ui;
        cursor:pointer;transition:background .15s ease,color .15s ease,transform .15s ease,box-shadow .15s ease;}
      #lf-max-controls button:hover,#lf-max-controls button:focus-visible{background:rgba(56,189,248,.2);
        color:#7dd3fc;outline:2px solid #7dd3fc;outline-offset:1px;transform:scale(1.04);}
      #lf-max-controls button[data-action="toggle"]{height:46px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:11px;letter-spacing:.03em;color:#7dd3fc;}
      #lf-max-controls button[data-action="toggle"][aria-pressed="false"]{color:#94a3b8;}
      #lf-max-controls .lf-switch-track{width:26px;height:12px;background:#334155;border-radius:999px;position:relative;transition:background .2s ease;}
      #lf-max-controls button[data-action="toggle"][aria-pressed="true"] .lf-switch-track{background:#0284c7;}
      #lf-max-controls .lf-switch-thumb{position:absolute;top:2px;left:2px;width:8px;height:8px;border-radius:50%;background:#cbd5e1;transition:transform .2s ease,background .2s ease;}
      #lf-max-controls button[data-action="toggle"][aria-pressed="true"] .lf-switch-thumb{transform:translateX(14px);background:#38bdf8;box-shadow:0 0 6px #38bdf8;}
      #lf-max-controls button[data-action="loop"][aria-pressed="true"]{background:rgba(56,189,248,.28);
        color:#7dd3fc;box-shadow:0 0 10px rgba(56,189,248,.35), inset 0 0 0 1px rgba(125,211,252,.45);}
      #lf-max-controls button[data-action="speed"]{font-size:11px;letter-spacing:-.02em;}
      #lf-max-controls button[data-action="speed"].is-altered{color:#facc15;background:rgba(250,204,21,.15);box-shadow:inset 0 0 0 1px rgba(250,204,21,.35);}
      #lf-max-controls button[data-action="panel"].is-active{background:rgba(168,85,247,.25);color:#c084fc;box-shadow:0 0 10px rgba(168,85,247,.35), inset 0 0 0 1px rgba(168,85,247,.5);}
      #lf-max-controls button[data-action="previous"]:active,#lf-max-controls button[data-action="next"]:active{background:rgba(56,189,248,.3);color:#38bdf8;transform:scale(0.92);}
      #lf-max-controls .lf-max-separator{width:20px;height:1px;background:rgba(255,255,255,.14);margin:2px 0;}
      @media (max-width:640px),(max-height:540px){
        #lf-max-controls{right:8px;gap:2px;padding:5px 2px;width:38px;}
        #lf-max-controls button{width:32px;height:32px;font-size:13px;}
        #lf-max-controls button[data-action="toggle"]{height:34px;font-size:9px;gap:2px;}
        #lf-max-controls .lf-switch-track{width:20px;height:10px;}
        #lf-max-controls .lf-switch-thumb{width:6px;height:6px;top:2px;left:2px;}
        #lf-max-controls button[data-action="toggle"][aria-pressed="true"] .lf-switch-thumb{transform:translateX(10px);}
      }
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
      else if (action === 'loop') {
        const active = this.engine.toggleLoop() === true;
        button.setAttribute('aria-pressed', String(active));
        button.title = active ? 'Desativar loop da frase' : 'Ativar loop da frase';
        button.setAttribute('aria-label', button.title);
      }
      else if (action === 'next') this.engine.nextSubtitle();
      else if (action === 'speed') this._setPlaybackRate(nextPlaybackRate(this.playbackRate));
      else if (action === 'panel') {
        this.engine.toggleSubtitlePanel();
        const panel = document.getElementById('lf-subtitle-panel');
        const isOpen = panel && panel.style.display !== 'none';
        button.classList.toggle('is-active', !!isOpen);
      }
      else if (action === 'settings') window.dispatchEvent(new CustomEvent('LF_TOGGLE_SETTINGS'));
    });
    dock.addEventListener('mousedown', (event) => event.stopPropagation());

    this.dock = dock;
    this._updateSpeedButton();
    this._syncLoopButton();
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
    this._bindVideo(video);
    this._syncLoopButton();

    const controls = firstVisible(CONTROL_SELECTORS);
    const progress = firstVisible(PROGRESS_SELECTORS);
    const panel = document.getElementById('lf-subtitle-panel');
    const panelRect = panel?.getBoundingClientRect();
    const panelWidth = panelRect?.width > 0 ? panelRect.width : 0;
    const placement = computeMaxDockPlacement({
      viewportWidth: window.innerWidth,
      panelWidth,
    });
    const layout = computeMaxOverlayLayout({
      viewportHeight: window.innerHeight,
      controlsRect: controls?.rect,
      progressRect: progress?.rect,
      videoRect: video.getBoundingClientRect(),
    });
    const signature = `${layout.dockBottom}:${layout.subtitleBottom}:${placement.right}:${placement.hidden}:${this._overlayRoot() === document.body}`;
    const expectedDisplay = placement.hidden ? 'none' : 'flex';
    if (signature === this.lastLayout && this.dock.style.display === expectedDisplay) return;
    this.lastLayout = signature;

    this.dock.style.display = expectedDisplay;
    const isOverlayContainer = this._overlayRoot() !== document.body;
    this.dock.style.setProperty('position', isOverlayContainer ? 'absolute' : 'fixed', 'important');
    this.dock.style.removeProperty('bottom');
    this.dock.style.setProperty('right', `${placement.right}px`, 'important');
    this.dock.style.setProperty('top', '50%', 'important');
    this.dock.style.setProperty('left', placement.left, 'important');
    this.dock.style.setProperty('transform', 'translateY(-50%)', 'important');

    if (isMaxHost(window.location.hostname)) {
      subtitleHost.style.setProperty('position', 'fixed', 'important');
      subtitleHost.style.setProperty('bottom', `${layout.subtitleBottom}px`, 'important');
      subtitleHost.style.setProperty('left', '50%', 'important');
      subtitleHost.style.setProperty('transform', 'translateX(-50%)', 'important');
      subtitleHost.style.setProperty('z-index', '2147483641', 'important');
    }
  }
}
