// content/word-popup/positioning.js — Posicionamento do popup sobre o player e acompanhamento da posição.
import { computeMaxPopupLayout } from '../max-player-ui.js';

export class PositioningMethods {
  _findPlayerContainer() {
    const selectors = {
      youtube: ['#movie_player', '.html5-video-player', '#ytd-player'],
      netflix: ['.watch-video', '.NFPlayer', '#netflix-player'],
      max: [
        '[data-testid="player-container"]',
        '[class*="PlayerContainer"]',
        '#hbo-max-player-container',
      ],
      disney: ['.btm-media-clients', '#disney-player-container'],
      prime: ['.rendererContainer', '#dv-web-player'],
    };
    const platformSelectors = selectors[this.platform] || [];
    for (const sel of platformSelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetHeight > 100) {
        const pos = window.getComputedStyle(el).position;
        if (pos === 'static') el.style.position = 'relative';
        return el;
      }
    }
    const video = document.querySelector('video');
    if (video) {
      let parent = video.parentElement;
      let attempts = 0;
      while (parent && attempts < 8) {
        const rect = parent.getBoundingClientRect();
        const style = window.getComputedStyle(parent);
        if (rect.width > 400 && rect.height > 300 && style.display !== 'contents') {
          if (style.position === 'static') parent.style.position = 'relative';
          return parent;
        }
        parent = parent.parentElement;
        attempts++;
      }
    }
    return null;
  }

  _startPosLoop() {
    if (this._posLoopRunning) return;
    this._posLoopRunning = true;

    if (this.platform === 'max') {
      const schedule = () => {
        if (!this.popup || this.popup.style.display === 'none' || this._positionFrame) return;
        this._positionFrame = requestAnimationFrame(() => {
          this._positionFrame = 0;
          this._position();
        });
      };
      if (!this._maxPositionAbort) {
        this._maxPositionAbort = new AbortController();
        const signal = this._maxPositionAbort.signal;
        window.addEventListener('resize', schedule, { signal });
        document.addEventListener('fullscreenchange', () => {
          const root = document.fullscreenElement || document.body;
          if (this.popup.parentElement !== root) root.appendChild(this.popup);
          schedule();
        }, { signal });
        this._maxPositionObserver = new ResizeObserver(schedule);
        this._maxPositionObserver.observe(this.popup);
        const subtitleHost = document.getElementById('linguaflow-subtitle-host');
        if (subtitleHost) this._maxPositionObserver.observe(subtitleHost);
        this._maxPositionMutationObserver = new MutationObserver(schedule);
        if (subtitleHost) {
          this._maxPositionMutationObserver.observe(subtitleHost, {
            attributes: true,
            attributeFilter: ['style'],
          });
        }
      }
      schedule();
      return;
    }
    
    const loop = () => {
      if (!this.popup || this.popup.style.display === 'none') {
        this._posLoopRunning = false;
        return;
      }
      this._position();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  _position() {
    this.popup.style.display = 'block';

    const subtitleHost = document.getElementById('linguaflow-subtitle-host');

    const pw = 340;

    const maxSubtitleRect = this.platform === 'max' && subtitleHost
      ? subtitleHost.getBoundingClientRect()
      : null;
    if (maxSubtitleRect && maxSubtitleRect.width > 0 && maxSubtitleRect.height > 0) {
      const root = document.fullscreenElement || document.body;
      if (this.popup.parentElement !== root) root.appendChild(this.popup);
      const layout = computeMaxPopupLayout({
        viewportWidth: window.innerWidth,
        subtitleTop: maxSubtitleRect.top,
        popupWidth: pw,
        popupHeight: this.popup.scrollHeight || this.popup.offsetHeight,
        anchorRect: this._anchorRect,
      });
      const signature = `${layout.left}:${layout.top}:${layout.maxHeight}`;
      if (this._lastMaxLayout !== signature) {
        this._lastMaxLayout = signature;
        Object.assign(this.popup.style, {
          position: 'fixed',
          top: `${layout.top}px`,
          left: `${layout.left}px`,
          right: 'auto',
          bottom: 'auto',
          transform: 'none',
          width: `${pw}px`,
          maxWidth: 'calc(100vw - 20px)',
          height: 'auto',
          maxHeight: `${layout.maxHeight}px`,
          borderRadius: '16px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
          overflowY: 'auto',
        });
      }
      return;
    }

    const player = this.engine?._findPlayerContainer?.();
    
    if (player && this.popup.parentElement === player) {
      // Relative to player
      const playerW = player.offsetWidth || player.clientWidth;
      const playerH = player.offsetHeight || player.clientHeight;

      const centerX = playerW / 2;
      let localLeft = centerX - pw / 2;
      localLeft = Math.max(10, Math.min(localLeft, playerW - pw - 10));

      let ceilingLocal = playerH;
      if (subtitleHost && subtitleHost.offsetParent) {
        // Obter posição relativa ao player subtraindo os tops
        const playerRect = player.getBoundingClientRect();
        const subRect = subtitleHost.getBoundingClientRect();
        ceilingLocal = subRect.top - playerRect.top;
      }

      let localTop = ceilingLocal - this.popup.offsetHeight - 16;
      if (localTop < 10) localTop = 10;

      const newTop = `${localTop}px`;
      const newLeft = `${localLeft}px`;

      if (this._lastTop !== newTop || this._lastLeft !== newLeft) {
        this._lastTop = newTop;
        this._lastLeft = newLeft;
        Object.assign(this.popup.style, {
          position: 'absolute',
          top: newTop,
          left: newLeft,
          right: 'auto',
          bottom: 'auto',
          transform: 'none',
          width: `${pw}px`,
          maxWidth: '90%',
          height: 'auto',
          maxHeight: '80%',
          borderRadius: '16px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
          overflowY: 'auto',
        });
      }
    } else {
      // Fallback relative to viewport
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const centerX = viewportW / 2;
      let leftViewport = centerX - pw / 2;
      leftViewport = Math.max(10, Math.min(leftViewport, viewportW - pw - 10));

      let ceilingViewport = viewportH;
      if (subtitleHost && subtitleHost.offsetParent) {
        ceilingViewport = subtitleHost.getBoundingClientRect().top;
      }

      let topViewport = ceilingViewport - this.popup.offsetHeight - 16;
      if (topViewport < 10) topViewport = 10;

      const newTop = `${topViewport}px`;
      const newLeft = `${leftViewport}px`;

      if (this._lastTop !== newTop || this._lastLeft !== newLeft) {
        this._lastTop = newTop;
        this._lastLeft = newLeft;
        Object.assign(this.popup.style, {
          position: 'fixed',
          top: newTop,
          left: newLeft,
          right: 'auto',
          bottom: 'auto',
          transform: 'none',
          width: `${pw}px`,
          maxWidth: '90vw',
          height: 'auto',
          maxHeight: '80vh',
          borderRadius: '16px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
          overflowY: 'auto',
        });
      }
    }
    // Garante o keyframe de animação popup
    if (!document.getElementById('lfp-pop-k')) {
      const s = document.createElement('style');
      s.id = 'lfp-pop-k';
      s.textContent =
        '@keyframes lfpPopIn{from{transform:translateY(10px) scale(0.95);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}';
      document.head.appendChild(s);
    }
  }
}
