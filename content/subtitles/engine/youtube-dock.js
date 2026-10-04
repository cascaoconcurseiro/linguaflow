// content/subtitles/engine/youtube-dock.js — Dock de botões do LinguaFlow na barra de controles do YouTube e sincronização do estado dos botões de loop.
import { applyDockResponsiveClass } from '../dock-layout.js';
import { YOUTUBE_DOCK_CSS } from '../youtube-dock-styles.js';
import { DOCK_COLLAPSE_BUTTON_HTML, applyDockCollapsed, dockCollapseCss, loadDockCollapsed, saveDockCollapsed } from '../dock-collapse.js';

export class YouTubeDockMethods {
  // ── Injeção dos Botões na Barra do YouTube (Dock Horizontal) ───────────────
  _injectYouTubeControls() {
    if (this.platform !== 'youtube') return;

    const tryInject = () => {
      const rightCtrl = document.querySelector('.ytp-right-controls');
      if (!rightCtrl) return false;

      const existing = document.getElementById('lf-yt-horizontal-dock');
      if (existing) {
        if (rightCtrl.contains(existing)) {
          const playerEl = rightCtrl.closest('.html5-video-player') || document.getElementById('movie_player') || rightCtrl.parentElement;
          const width = playerEl?.getBoundingClientRect?.()?.width || window.innerWidth;
          applyDockResponsiveClass(existing, width);
          return true;
        }
        existing.remove();
      }

      // Injeta CSS para a dock horizontal e botões (apenas uma vez)
      if (!document.getElementById('lf-yt-styles')) {
        const style = document.createElement('style');
        style.id = 'lf-yt-styles';
        style.textContent = YOUTUBE_DOCK_CSS + dockCollapseCss('#lf-yt-horizontal-dock', 'horizontal');
        document.head.appendChild(style);
      }

      // Wrapper do Switch: inicializa respeitando o estado real de ativação
      const isSubVisible = this.isActivated;

      const dock = document.createElement('div');
      dock.id = 'lf-yt-horizontal-dock';
      dock.className = isSubVisible ? 'lf-yt-dock' : 'lf-yt-dock lf-off';
      dock.setAttribute('role', 'toolbar');
      dock.setAttribute('aria-label', 'Controles LinguaFlow');
      dock.innerHTML = `
        <button type="button" id="lf-yt-toggle-wrapper" data-action="toggle" class="lf-dock-toggle${isSubVisible ? ' active' : ''}" aria-pressed="${isSubVisible}" title="${isSubVisible ? 'Desativar LinguaFlow (C)' : 'Ativar LinguaFlow (C)'}">
          <span class="lf-toggle-text">LF</span>
          <span class="lf-switch-track${isSubVisible ? ' active' : ''}" id="lf-yt-switch" aria-hidden="true"><span class="lf-switch-thumb"></span></span>
        </button>
        ${DOCK_COLLAPSE_BUTTON_HTML}
        <span class="lf-dock-sep" aria-hidden="true"></span>
        <button type="button" data-action="previous" class="lf-dock-btn" title="Legenda anterior (A)" aria-label="Legenda anterior">‹</button>
        <button type="button" data-action="loop" class="lf-dock-btn" aria-pressed="false" title="Ativar loop da frase" aria-label="Ativar loop da frase">↻</button>
        <button type="button" data-action="next" class="lf-dock-btn" title="Próxima legenda (D)" aria-label="Próxima legenda">›</button>
        <button type="button" data-action="shadow" class="lf-dock-btn" aria-pressed="${Boolean(this.shadowMode)}" title="Modo shadowing (M)" aria-label="Modo shadowing">◐</button>
        <button type="button" data-action="speed" class="lf-dock-btn" title="Velocidade da fala e vídeo: 1×. Clique para ajustar ou falar mais lento" aria-label="Velocidade da fala e vídeo: 1×. Clique para ajustar">1×</button>
        <span class="lf-dock-sep" aria-hidden="true"></span>
        <button type="button" data-action="panel" id="lf-yt-panel-btn" class="lf-dock-btn" title="Painel de legendas (P)" aria-label="Painel de legendas">▤</button>
        <button type="button" data-action="settings" id="lf-yt-btn" class="lf-dock-btn" title="Configurações LinguaFlow (O)" aria-label="Configurações LinguaFlow">⚙</button>
      `;

      dock.addEventListener('click', (e) => {
        e.stopPropagation();
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        if (action === 'toggle') {
          this.userToggleSubtitles(!this.isActivated);
        } else if (action === 'collapse') {
          this._dockCollapsed = !this._dockCollapsed;
          applyDockCollapsed(dock, this._dockCollapsed);
          saveDockCollapsed(this._dockCollapsed);
        } else if (action === 'previous') {
          this.gotoPreviousCue();
        } else if (action === 'loop') {
          this.toggleLoop();
        } else if (action === 'next') {
          this.gotoNextCue();
        } else if (action === 'shadow') {
          this.toggleShadowMode();
        } else if (action === 'speed') {
          this._toggleSpeedMenu(btn);
        } else if (action === 'panel') {
          this.toggleSubtitlePanel();
        } else if (action === 'settings') {
          window.dispatchEvent(new CustomEvent('LF_TOGGLE_SETTINGS'));
        }
      });
      dock.addEventListener('mousedown', (e) => e.stopPropagation());

      rightCtrl.insertBefore(dock, rightCtrl.firstChild);
      applyDockCollapsed(dock, this._dockCollapsed);
      loadDockCollapsed().then((collapsed) => {
        if (this._dockCollapsed === collapsed) return;
        this._dockCollapsed = collapsed;
        applyDockCollapsed(dock, collapsed);
      });

      const playerContainer = rightCtrl.closest('.html5-video-player') ||
        document.getElementById('movie_player') ||
        document.querySelector('.html5-video-player') ||
        this.videoElement?.parentElement ||
        rightCtrl.parentElement;

      const updateResponsive = () => {
        if (!dock.isConnected) return;
        const rect = playerContainer?.getBoundingClientRect?.();
        const width = rect && rect.width > 0 ? rect.width : window.innerWidth;
        applyDockResponsiveClass(dock, width);
      };

      if (this._dockResizeObserver) {
        try { this._dockResizeObserver.disconnect(); } catch (_) {}
        this._dockResizeObserver = null;
      }
      if (playerContainer && typeof ResizeObserver !== 'undefined') {
        this._dockResizeObserver = new ResizeObserver(() => updateResponsive());
        this._dockResizeObserver.observe(playerContainer);
      }
      updateResponsive();

      this._bindVideoPlaybackRate();

      this.toggleSubtitles(isSubVisible);
      return true;
    };

    // Tenta imediatamente
    if (tryInject()) return;

    // Tenta por no máximo 30 segundos (20 tentativas de 1.5s)
    let attempts = 0;
    const iv = this._setManagedInterval(() => {
      attempts++;
      if (tryInject() || attempts > 20) clearInterval(iv);
    }, 1500);
  }

  _syncLoopButtons() {
    const isLoop = this.isLooping === true;
    const doc = typeof document !== 'undefined' ? document : null;
    if (!doc || typeof doc.querySelectorAll !== 'function') return;

    // 1. Botões da dock flutuante / player
    const dockButtons = doc.querySelectorAll('button[data-action="loop"]') || [];
    for (const btn of dockButtons) {
      btn.setAttribute?.('aria-pressed', String(isLoop));
      btn.classList?.toggle?.('is-active', isLoop);
      btn.title = isLoop ? 'Desativar loop da frase' : 'Ativar loop da frase';
      btn.setAttribute?.('aria-label', btn.title);
      if (btn.style) {
        if (isLoop) {
          btn.style.background = '#0284c7';
          btn.style.color = '#ffffff';
          btn.style.borderColor = '#38bdf8';
          btn.style.boxShadow = '0 0 12px rgba(56, 189, 248, 0.8)';
        } else {
          btn.style.background = '';
          btn.style.color = '';
          btn.style.borderColor = '';
          btn.style.boxShadow = '';
        }
      }
    }

    // 2. Botões nas legendas da barra lateral (.lf-loop-cue) e card da frase (.lf-subtitle-item)
    const cueButtons = doc.querySelectorAll('.lf-loop-cue') || [];
    for (const btn of cueButtons) {
      const parentItem = btn.closest?.('.lf-subtitle-item');
      const idx = parentItem ? parseInt(parentItem.dataset.index, 10) : -1;
      const cues = this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues;
      const cue = cues?.[idx];
      const isThisCueActive = isLoop && cue && Math.abs(cue.start - this.loopStartTime) < 0.1;

      btn.setAttribute?.('aria-pressed', String(isThisCueActive));
      btn.classList?.toggle?.('is-active', isThisCueActive);
      if (btn.style) {
        if (isThisCueActive) {
          btn.style.background = '#0284c7';
          btn.style.color = '#ffffff';
          btn.style.borderRadius = '6px';
          btn.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.85)';
          btn.style.padding = '2px 6px';
        } else {
          btn.style.background = 'transparent';
          btn.style.color = 'inherit';
          btn.style.borderRadius = '';
          btn.style.boxShadow = 'none';
          btn.style.padding = '0 2px';
        }
      }
      btn.title = isThisCueActive ? 'Desativar loop desta frase' : 'Repetir frase em loop';

      // Destacar visualmente o card da frase inteira
      if (parentItem) {
        parentItem.classList?.toggle?.('is-looping', isThisCueActive);
        if (parentItem.style) {
          if (isThisCueActive) {
            parentItem.style.background = 'rgba(2, 132, 199, 0.28)';
            parentItem.style.borderLeft = '4px solid #38bdf8';
            parentItem.style.boxShadow = 'inset 0 0 16px rgba(56, 189, 248, 0.25), 0 4px 12px rgba(0,0,0,0.35)';
          } else if (parentItem.classList?.contains?.('active')) {
            parentItem.style.background = 'rgba(56, 189, 248, 0.15)';
            parentItem.style.borderLeft = '3px solid #38BDF8';
            parentItem.style.boxShadow = '';
          } else {
            parentItem.style.background = '';
            parentItem.style.borderLeft = '';
            parentItem.style.boxShadow = '';
          }
        }
      }
    }

    // 3. Botões no explorador de frases (.lf-se-loop-btn) e card (.lf-sentence-card)
    const seButtons = doc.querySelectorAll('.lf-se-loop-btn') || [];
    for (const btn of seButtons) {
      const cueStart = parseFloat(btn.dataset.cueStart);
      const isThisCueActive = isLoop && !isNaN(cueStart) && Math.abs(cueStart - this.loopStartTime) < 0.1;
      const card = btn.closest?.('.lf-sentence-card');

      btn.setAttribute?.('aria-pressed', String(isThisCueActive));
      btn.classList?.toggle?.('is-active', isThisCueActive);
      if (btn.style) {
        if (isThisCueActive) {
          btn.style.background = '#0284c7';
          btn.style.color = '#ffffff';
          btn.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.85)';
        } else {
          btn.style.background = 'rgba(255,255,255,0.06)';
          btn.style.color = '#94A3B8';
          btn.style.boxShadow = 'none';
        }
      }
      btn.title = isThisCueActive ? 'Desativar loop' : 'Repetir em loop';

      if (card) {
        card.classList?.toggle?.('is-looping', isThisCueActive);
        if (card.style) {
          if (isThisCueActive) {
            card.style.borderColor = '#38bdf8';
            card.style.background = 'rgba(2, 132, 199, 0.2)';
            card.style.boxShadow = '0 0 14px rgba(56, 189, 248, 0.25)';
          } else {
            card.style.borderColor = 'rgba(255,255,255,0.07)';
            card.style.background = 'rgba(255,255,255,0.03)';
            card.style.boxShadow = 'none';
          }
        }
      }
    }
  }
}
