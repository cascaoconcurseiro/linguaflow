// content/subtitles/engine/playback.js — Controles de reprodução: navegar entre falas, loops A-B e por fala, shadowing, foco por palavra e velocidade.
import { setupPlayerHotkeys } from '../player-hotkeys.js';
import { shadowContext, shadowProgress, writeShadowPref } from '../shadow-mode.js';
import { showShortcutsHelp } from '../shortcuts-help.js';

export class PlaybackMethods {
  _setupKeyboardShortcuts() {
    setupPlayerHotkeys(this, this._lifecycleController?.signal);
  }

  // ── Navegação por Legenda ───────────────────────────────────────────────

  repeatSubtitle() {
    const v = this.videoElement;
    if (!v) return;

    let cue = this._currentCue || (this.cues && this.cues[this.currentCueIndex]);
    if (!cue && this.cues && this.cues.length > 0) {
      const t = v.currentTime;
      let idx = this._binarySearchCue(this.cues, t);
      if (idx === -1) {
        for (let i = this.cues.length - 1; i >= 0; i--) {
          if (this.cues[i].end <= t || this.cues[i].start <= t) {
            idx = i;
            break;
          }
        }
      }
      if (idx !== -1) cue = this.cues[idx];
    }

    if (cue && v) {
      this._lastAutoPausedEndTime = -1;
      v.currentTime = cue.start;
      v.play()?.catch?.(() => {});
      console.debug('[LinguaFlow] 🔄 Repetindo legenda:', cue.text);
    }
  }

  prevSubtitle() {
    if (!this.cues || this.cues.length === 0) return;
    const v = this.videoElement;
    if (!v) return;

    this._lastAutoPausedEndTime = -1;
    // Se estivermos no meio de uma frase, volta pro início dela.
    // Se estivermos no início, volta pra anterior.
    const t = v.currentTime;
    let idx = this._binarySearchCue(this.cues, t);

    if (idx === -1) {
      // Se não há legenda agora, procura a última que terminou antes de agora
      for (let i = this.cues.length - 1; i >= 0; i--) {
        if (this.cues[i].end < t) {
          idx = i;
          break;
        }
      }
    } else {
      // Se o tempo atual já passou de 1s do início da legenda, apenas repete ela
      if (t - this.cues[idx].start > 1) {
        this.repeatSubtitle();
        return;
      }
      idx = Math.max(0, idx - 1);
    }

    if (idx !== -1) {
      v.currentTime = this.cues[idx].start;
      v.play()?.catch?.(() => {});
    }
  }

  nextSubtitle() {
    if (!this.cues || this.cues.length === 0) return;
    const v = this.videoElement;
    if (!v) return;

    this._lastAutoPausedEndTime = -1;
    const t = v.currentTime;
    let idx = this._binarySearchCue(this.cues, t);

    if (idx === -1) {
      // Procura a próxima que começa após agora
      for (let i = 0; i < this.cues.length; i++) {
        if (this.cues[i].start > t) {
          idx = i;
          break;
        }
      }
    } else {
      idx = Math.min(this.cues.length - 1, idx + 1);
    }

    if (idx !== -1) {
      v.currentTime = this.cues[idx].start;
      v.play()?.catch?.(() => {});
    }
  }

  // Fase 5 da auditoria (§4b.6/§4h.3): stubs vazios removidos
  // (_injectDeckSelector/_injectFloatingButton/_injectNavigationControls/_createNavButton)

  gotoPreviousCue() {
    if (!this.videoElement || this.cues.length === 0) return;

    const currentTime = this.videoElement.currentTime;

    let targetIdx = -1;

    // Se estamos no início de uma frase (primeiros 500ms), volta para a anterior
    if (this.currentCueIndex >= 0) {
      const currentCue = this.cues[this.currentCueIndex];
      if (currentTime - currentCue.start < 0.5 && this.currentCueIndex > 0) {
        targetIdx = this.currentCueIndex - 1;
      } else {
        // Senão, volta para o início da frase atual
        this.videoElement.currentTime = currentCue.start;
        return;
      }
    } else {
      // Procura a frase anterior
      for (let i = this.cues.length - 1; i >= 0; i--) {
        if (this.cues[i].end < currentTime) {
          targetIdx = i;
          break;
        }
      }
    }

    if (targetIdx >= 0) {
      this.videoElement.currentTime = this.cues[targetIdx].start;
      console.debug('[LinguaFlow] Voltou para frase anterior');
    }
  }

  gotoNextCue() {
    if (!this.videoElement || this.cues.length === 0) return;

    const currentTime = this.videoElement.currentTime;

    let targetIdx = -1;

    // Procura a próxima frase
    for (let i = 0; i < this.cues.length; i++) {
      if (this.cues[i].start > currentTime) {
        targetIdx = i;
        break;
      }
    }

    if (targetIdx >= 0) {
      this.videoElement.currentTime = this.cues[targetIdx].start;
      console.debug('[LinguaFlow] Pulou para próxima frase');
    }
  }

  // ── Atalhos de estudo do player (#432) ─────────────────────────────────────

  // Ajuste fino da sincronia: positivo = a legenda aparece mais cedo (mesma regra do controle
  // deslizante das configurações: o tempo de busca da fala é mídia + antecipação).
  nudgeSync(delta) {
    const current = Number(this.translationAnticipation) || 0;
    const next = Math.round(Math.min(2, Math.max(-2, current + delta)) * 10) / 10;
    if (next === current) {
      this._showNotification('⏱️ Sincronia no limite (±2 s)');
      return current;
    }
    this.translationAnticipation = next;
    window.dispatchEvent(new CustomEvent('LF_UPDATE_ANTICIPATION', { detail: next }));
    import('../../../utils/db.js')
      .then(({ db }) => db?.setSetting?.('translationAnticipation', next)?.catch?.(() => {}))
      .catch(() => {});
    const label = `${next > 0 ? '+' : ''}${next.toFixed(1).replace('.', ',')} s`;
    this._showNotification(`⏱️ Sincronia ${label} · legenda ${delta > 0 ? 'mais cedo' : 'mais tarde'}`);
    return next;
  }

  // Laço A–B: 1º toque marca o início, 2º marca o fim e repete, 3º desfaz.
  toggleAbLoop() {
    if (!this.videoElement) return false;
    const now = Number(this.videoElement.currentTime);
    if (!Number.isFinite(now)) return false;
    const fmt = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

    if (this._abPoint == null && !this.isLooping) {
      this._abPoint = now;
      this._showNotification(`🅰️ Início em ${fmt(now)} · aperte B de novo para marcar o fim`);
      return 'a';
    }
    if (this._abPoint != null) {
      const start = this._abPoint;
      if (now - start < 0.5) {
        this._showNotification('O fim precisa ficar pelo menos 0,5 s depois do início');
        return 'invalid';
      }
      this._abPoint = null;
      const started = this._startPreciseLoopByCue({ start, end: now });
      if (started) this._showNotification(`🔁 Laço ${fmt(start)}–${fmt(now)} · B desfaz`);
      return started ? 'loop' : false;
    }
    this._stopLoop();
    this._showNotification('▶️ Laço desativado');
    return 'off';
  }

  // Escuta primeiro: esconde a legenda original até passar o mouse (mesmo modo das configurações).
  toggleListenFirst() {
    this.blurSubtitles = !this.blurSubtitles;
    window.dispatchEvent(new CustomEvent('LF_UPDATE_BLUR', { detail: this.blurSubtitles }));
    import('../../../utils/db.js')
      .then(({ db }) => db?.setSetting?.('blurSubtitles', this.blurSubtitles)?.catch?.(() => {}))
      .catch(() => {});
    if (this._lastOrig) this.renderDual(this._lastOrig, this._lastTrans || '');
    this._showNotification(this.blurSubtitles ? '🎧 Escuta primeiro: legenda escondida' : '👁️ Legenda original visível');
    return this.blurSubtitles;
  }

  /** Modo shadowing (#456): liga/desliga a visão anterior · atual · próxima no lugar da legenda. */
  toggleShadowMode() {
    this.shadowMode = !this.shadowMode;
    writeShadowPref(globalThis.localStorage, this.shadowMode);
    for (const btn of document.querySelectorAll?.('button[data-action="shadow"]') || []) {
      btn.setAttribute('aria-pressed', String(this.shadowMode));
    }
    if (this._lastOrig) this.renderDual(this._lastOrig, this._lastTrans || '');
    else this._renderShadowContext('');
    this._showNotification(this.shadowMode ? '🎙️ Shadowing: frase atual, anterior e próxima' : 'Shadowing desligado');
    return this.shadowMode;
  }

  _shadowCueIndex() {
    const list = this.xhrCues?.length ? this.xhrCues : this.cues;
    if (!list?.length) return { list: [], index: -1 };
    let index = this._currentCue ? list.indexOf(this._currentCue) : -1;
    if (index < 0) index = this._binarySearchCue(list, Number(this.videoElement?.currentTime) || 0);
    return { list, index };
  }

  _renderShadowContext(orig) {
    const wrap = this.shadowContainer?.getElementById?.('lf-wrap');
    if (!wrap) return;
    if (!this.shadowMode || !orig) {
      wrap.removeAttribute('data-shadow');
      this._stopShadowProgress();
      return;
    }
    const { list, index } = this._shadowCueIndex();
    const ctx = shadowContext(list, index);
    const prevEl = this.shadowContainer.getElementById('lf-shadow-prev');
    const nextEl = this.shadowContainer.getElementById('lf-shadow-next');
    if (prevEl) prevEl.textContent = ctx.prev;
    if (nextEl) nextEl.textContent = ctx.next;
    if (wrap.getAttribute('data-shadow') !== 'on' || this._shadowRolledFor !== orig) {
      // Reinicia a entrada curta só quando a fala muda (não a cada redesenho da tradução).
      wrap.classList.remove('lf-shadow-roll');
      void wrap.offsetWidth;
      wrap.classList.add('lf-shadow-roll');
      this._shadowRolledFor = orig;
    }
    wrap.setAttribute('data-shadow', 'on');
    this._startShadowProgress();
  }

  _startShadowProgress() {
    if (this._shadowRaf != null || typeof requestAnimationFrame !== 'function') return;
    let last = -1;
    const tick = () => {
      this._shadowRaf = null;
      const wrap = this.shadowContainer?.getElementById?.('lf-wrap');
      if (!this.shadowMode || !wrap || wrap.getAttribute('data-shadow') !== 'on') return;
      const video = this.videoElement;
      if (video && !video.paused) {
        const { list, index } = this._shadowCueIndex();
        const p = shadowProgress(this._currentCue || list[index], video.currentTime);
        if (Math.abs(p - last) >= 0.004) {
          last = p;
          wrap.style.setProperty('--lf-shadow-p', p.toFixed(3));
        }
      }
      this._shadowRaf = requestAnimationFrame(tick);
    };
    this._shadowRaf = requestAnimationFrame(tick);
  }

  _stopShadowProgress() {
    if (this._shadowRaf != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._shadowRaf);
    this._shadowRaf = null;
  }

  showShortcuts() {
    return showShortcutsHelp();
  }

  // Navegação pelas palavras da legenda só com o teclado (acessibilidade).
  _subtitleWordEls() {
    return [...(this.shadowContainer?.querySelectorAll?.('#lf-orig .lf-word') || [])];
  }

  isWordNavActive() {
    const active = this.shadowContainer?.activeElement;
    return Boolean(active?.classList?.contains('lf-word'));
  }

  focusSubtitleWords() {
    const words = this._subtitleWordEls();
    if (!words.length) {
      this._showNotification('Nenhuma palavra na legenda agora');
      return false;
    }
    if (this.videoElement && !this.videoElement.paused) {
      this.videoElement.pause();
      this._wordNavPaused = true;
    }
    words[0].focus();
    this._showNotification('← → escolhem a palavra · Enter abre o card · Esc volta');
    return true;
  }

  moveWordFocus(step) {
    const words = this._subtitleWordEls();
    if (!words.length) return false;
    const active = this.shadowContainer?.activeElement;
    const index = Math.max(0, words.indexOf(active));
    const next = words[Math.min(words.length - 1, Math.max(0, index + step))];
    next.focus();
    return true;
  }

  activateFocusedWord() {
    const active = this.shadowContainer?.activeElement;
    if (!active?.classList?.contains('lf-word')) return false;
    active.click();
    return true;
  }

  leaveWordFocus() {
    this.shadowContainer?.activeElement?.blur?.();
    if (this._wordNavPaused && this.videoElement?.paused) this.videoElement.play?.()?.catch?.(() => {});
    this._wordNavPaused = false;
  }

  toggleLoop() {
    if (!this.videoElement) return false;

    if (this.isLooping) {
      this._stopLoop();
      console.debug('[LinguaFlow] Loop DESATIVADO');
      this._showNotification('▶️ Loop Desativado');
      return false;
    }

    const activeCues = this.xhrCues?.length ? this.xhrCues : this.cues;
    const currentCue = this._currentCue || activeCues?.[this.currentCueIndex];
    const start = Number(currentCue?.start);
    const end = Number(currentCue?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      this._showNotification('Aguarde uma frase para ativar o loop');
      return false;
    }

    const res = this._startPreciseLoopByCue(currentCue);
    if (res) {
      this._showNotification('🔁 Loop da frase ativado');
    }
    return res;
  }

  _startPreciseLoopByCue(cue) {
    if (!cue) return false;
    const start = Number(cue.start);
    let end = Number(cue.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;

    // Aumentar precisão de corte: evitar que o vídeo invada a fala seguinte
    const cues = this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues;
    let cueIdx = -1;
    if (cues && cues.length > 0) {
      cueIdx = cues.indexOf(cue);
      if (cueIdx === -1) {
        cueIdx = cues.findIndex((c) => Math.abs(c.start - start) < 0.05 && c.text === cue.text);
      }
    }
    const nextCue = (cues && cueIdx >= 0 && cueIdx < cues.length - 1) ? cues[cueIdx + 1] : null;

    // Se houver legenda subsequente colada, cortar 0.08s antes da próxima fala para não vazar sílabas
    if (nextCue && Number.isFinite(nextCue.start) && nextCue.start <= end + 0.15) {
      end = Math.max(start + 0.2, Math.min(end, nextCue.start - 0.08));
    }

    this._stopLoop();

    this.isLooping = true;
    this.loopStartTime = start;
    this.loopEndTime = end;

    if (this.videoElement) {
      this.videoElement.currentTime = this.loopStartTime;
      this.videoElement.play().catch(() => {});
    }

    // Monitoramento de alta precisão (por frame via requestVideoFrameCallback / requestAnimationFrame)
    const checkFrame = () => {
      if (!this.isLooping || !this.videoElement) return;
      const cur = this.videoElement.currentTime;
      const rate = this.videoElement.playbackRate || 1;
      // Margem preditiva de buffer de decode de áudio proporcional à velocidade
      const leadBuffer = Math.min(0.06, 0.03 * rate);

      if (cur >= this.loopEndTime - leadBuffer || cur < this.loopStartTime - 1.5) {
        this.videoElement.currentTime = this.loopStartTime;
      }

      if (this.isLooping && this.videoElement) {
        if ('requestVideoFrameCallback' in this.videoElement) {
          this._loopRvfcId = this.videoElement.requestVideoFrameCallback(checkFrame);
        } else if (typeof requestAnimationFrame === 'function') {
          this._loopRafId = requestAnimationFrame(checkFrame);
        }
      }
    };

    if (this.videoElement) {
      if ('requestVideoFrameCallback' in this.videoElement) {
        this._loopRvfcId = this.videoElement.requestVideoFrameCallback(checkFrame);
      } else if (typeof requestAnimationFrame === 'function') {
        this._loopRafId = requestAnimationFrame(checkFrame);
      }

      if (typeof this.videoElement.addEventListener === 'function') {
        this._loopTimeUpdateHandler = () => {
          if (!this.isLooping || !this.videoElement) return;
          const cur = this.videoElement.currentTime;
          const rate = this.videoElement.playbackRate || 1;
          const leadBuffer = Math.min(0.06, 0.03 * rate);
          if (cur >= this.loopEndTime - leadBuffer) {
            this.videoElement.currentTime = this.loopStartTime;
          }
        };
        this.videoElement.addEventListener('timeupdate', this._loopTimeUpdateHandler);
      }
    }

    // Fallback timer rápido (25ms) caso o vídeo pause ou o RAF fique em background
    this._loopInterval = setInterval(() => {
      if (this.isLooping && this.videoElement) {
        const cur = this.videoElement.currentTime;
        const rate = this.videoElement.playbackRate || 1;
        const leadBuffer = Math.min(0.06, 0.03 * rate);
        if (cur >= this.loopEndTime - leadBuffer) {
          this.videoElement.currentTime = this.loopStartTime;
          if (this.videoElement.paused) this.videoElement.play().catch(() => {});
        }
      }
    }, 25);

    console.debug(
      `[LinguaFlow] Loop ATIVADO: ${this.loopStartTime.toFixed(2)}s - ${this.loopEndTime.toFixed(2)}s`,
    );
    this._syncLoopButtons();
    return true;
  }

  _stopLoop() {
    this._abPoint = null;
    this.isLooping = false;
    this.loopStartTime = null;
    this.loopEndTime = null;

    if (this._loopInterval) {
      clearInterval(this._loopInterval);
      this._loopInterval = null;
    }
    if (this._loopRafId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this._loopRafId);
      this._loopRafId = null;
    }
    if (this._loopRvfcId && this.videoElement && 'cancelVideoFrameCallback' in this.videoElement) {
      this.videoElement.cancelVideoFrameCallback(this._loopRvfcId);
      this._loopRvfcId = null;
    }
    if (this._loopTimeUpdateHandler && this.videoElement && typeof this.videoElement.removeEventListener === 'function') {
      this.videoElement.removeEventListener('timeupdate', this._loopTimeUpdateHandler);
      this._loopTimeUpdateHandler = null;
    }

    this._syncLoopButtons();
  }

  _toggleCueLoop(idx, btn) {
    const cues = this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues;
    const cue = cues?.[idx];
    if (!cue) return;
    this._toggleCueLoopByCue(cue);
  }

  _toggleCueLoopByCue(cue) {
    if (!cue) return;
    const start = Number(cue.start);
    const end = Number(cue.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;

    if (this.isLooping && Math.abs(this.loopStartTime - start) < 0.05) {
      this._stopLoop();
      this._showNotification('▶️ Loop Desativado');
    } else {
      this._startPreciseLoopByCue(cue);
      this._showNotification('🔁 Loop Ativado');
    }
  }

  _readPlaybackRate() {
    try {
      const saved = Number(globalThis.localStorage?.getItem('lf_video_playback_rate'));
      return Number.isFinite(saved) && saved >= 0.25 && saved <= 4 ? saved : 1;
    } catch {
      return 1;
    }
  }

  _bindVideoPlaybackRate() {
    const video = this.videoElement;
    this._setPlaybackRate(this._readPlaybackRate(), { persist: false });
    if (!video || this._rateBoundVideo === video) return;
    this._rateBoundVideo = video;
    video.addEventListener('ratechange', () => {
      const r = Number(video.playbackRate);
      if (Number.isFinite(r) && r > 0) this._updateSpeedButtons(r);
    });
    // Loading media resets playbackRate to defaultPlaybackRate without a ratechange.
    video.addEventListener('loadedmetadata', () => {
      if (this.videoElement !== video) return;
      this._setPlaybackRate(this._readPlaybackRate(), { persist: false });
    });
  }

  _setPlaybackRate(rate, { persist = true } = {}) {
    const normalized = Number(rate);
    if (!Number.isFinite(normalized) || normalized < 0.25 || normalized > 4) return 1;
    if (this.videoElement && Math.abs(this.videoElement.playbackRate - normalized) > 0.001) {
      this.videoElement.playbackRate = normalized;
    }
    this.ttsPlaybackRate = normalized;
    if (persist) {
      try {
        globalThis.localStorage?.setItem('lf_video_playback_rate', String(normalized));
      } catch {}
      try {
        chrome.storage?.local?.set?.({ ttsPlaybackRate: normalized });
      } catch {}
    }
    this._updateSpeedButtons(normalized);
    return normalized;
  }

  /** Atalhos [ e ] (#454): passo fino dentro da mesma faixa do ajuste do popover (0,5×–1,5×). */
  nudgePlaybackRate(delta) {
    const current = Number(this.videoElement?.playbackRate) || 1;
    const next = Math.round(Math.min(1.5, Math.max(0.5, current + delta)) * 100) / 100;
    if (Math.abs(next - current) < 0.001) {
      this._showNotification?.(`⚡ Velocidade no limite (${current}×)`);
      return current;
    }
    this._setPlaybackRate(next);
    this._showNotification?.(`⚡ Velocidade ${next}×`);
    return next;
  }

  _updateSpeedButtons(rate) {
    const label = `${rate}×`;
    const buttons = typeof document !== 'undefined' && typeof document.querySelectorAll === 'function'
      ? document.querySelectorAll('button[data-action="speed"]')
      : [];
    for (const btn of buttons) {
      btn.textContent = label;
      btn.title = `Velocidade da fala e vídeo: ${label}. Clique para ajustar ou falar mais lento`;
      btn.setAttribute?.('aria-label', `Velocidade da fala e vídeo: ${label}. Clique para ajustar`);
      btn.classList?.toggle?.('is-altered', rate !== 1);
    }
  }

  _toggleSpeedMenu(anchorBtn) {
    if (!anchorBtn) return;
    const existing = document.getElementById('lf-speed-popover');
    if (existing) {
      if (typeof existing._lfCleanup === 'function') existing._lfCleanup();
      else existing.remove();
      return;
    }

    const currentRate = Number(this.videoElement?.playbackRate) || this._readPlaybackRate() || 1;
    const popover = document.createElement('div');
    popover.id = 'lf-speed-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Ajuste de Velocidade da Fala e Vídeo');

    const presets = [
      { rate: 0.5, label: '0.5×', desc: 'Muito lenta' },
      { rate: 0.75, label: '0.75×', desc: 'Lenta' },
      { rate: 0.85, label: '0.85×', desc: 'Pausada' },
      { rate: 1.0, label: '1.0×', desc: 'Normal' },
      { rate: 1.25, label: '1.25×', desc: 'Rápida' },
    ];

    const presetsHtml = presets.map((p) => {
      const isSelected = Math.abs(currentRate - p.rate) < 0.03;
      return `<button type="button" class="lf-speed-chip ${isSelected ? 'is-selected' : ''}" data-rate="${p.rate}">
        <span>${p.label}</span>
        <span class="lf-speed-chip-desc">${p.desc}</span>
      </button>`;
    }).join('');

    popover.innerHTML = `
      <div class="lf-speed-head">
        <span class="lf-speed-title">⚡ Velocidade da Fala</span>
        <span class="lf-speed-val" id="lf-speed-display-val">${currentRate.toFixed(2).replace(/\\.?0+$/, '')}×</span>
      </div>
      <div class="lf-speed-presets">
        ${presetsHtml}
      </div>
      <div class="lf-speed-slider-wrap">
        <button type="button" class="lf-speed-step-btn" data-step="-0.05" title="Diminuir velocidade (−0.05)" aria-label="Diminuir velocidade">−</button>
        <input type="range" id="lf-speed-range" min="0.5" max="1.5" step="0.05" value="${currentRate}" aria-label="Ajuste fino de velocidade">
        <button type="button" class="lf-speed-step-btn" data-step="0.05" title="Aumentar velocidade (+0.05)" aria-label="Aumentar velocidade">+</button>
      </div>
      <div class="lf-speed-hint">Ajusta o diálogo do vídeo e a fala das palavras (TTS)</div>
    `;

    const rect = anchorBtn.getBoundingClientRect();
    const bottomPos = Math.max(12, window.innerHeight - rect.top + 10);
    const rightPos = Math.max(10, window.innerWidth - rect.right - 10);
    popover.style.bottom = `${bottomPos}px`;
    popover.style.right = `${rightPos}px`;

    popover.addEventListener('click', (e) => {
      e.stopPropagation();
      const chip = e.target.closest('button[data-rate]');
      if (chip) {
        const rate = parseFloat(chip.dataset.rate);
        this._setPlaybackRate(rate);
        popover.querySelectorAll('.lf-speed-chip').forEach((c) => c.classList.toggle('is-selected', c === chip));
        const slider = popover.querySelector('#lf-speed-range');
        if (slider) slider.value = rate;
        const valDisp = popover.querySelector('#lf-speed-display-val');
        if (valDisp) valDisp.textContent = `${rate}×`;
        return;
      }
      const stepBtn = e.target.closest('button[data-step]');
      if (stepBtn) {
        const step = parseFloat(stepBtn.dataset.step);
        const cur = Number(this.videoElement?.playbackRate) || 1;
        const next = Math.round(Math.min(1.5, Math.max(0.5, cur + step)) * 100) / 100;
        this._setPlaybackRate(next);
        const slider = popover.querySelector('#lf-speed-range');
        if (slider) slider.value = next;
        const valDisp = popover.querySelector('#lf-speed-display-val');
        if (valDisp) valDisp.textContent = `${next}×`;
        popover.querySelectorAll('.lf-speed-chip').forEach((c) => {
          c.classList.toggle('is-selected', Math.abs(parseFloat(c.dataset.rate) - next) < 0.03);
        });
      }
    });

    const rangeInput = popover.querySelector('#lf-speed-range');
    rangeInput?.addEventListener('input', (e) => {
      e.stopPropagation();
      const val = parseFloat(e.target.value);
      this._setPlaybackRate(val);
      const valDisp = popover.querySelector('#lf-speed-display-val');
      if (valDisp) valDisp.textContent = `${val.toFixed(2).replace(/\\.?0+$/, '')}×`;
      popover.querySelectorAll('.lf-speed-chip').forEach((c) => {
        c.classList.toggle('is-selected', Math.abs(parseFloat(c.dataset.rate) - val) < 0.03);
      });
    });

    popover.addEventListener('mousedown', (e) => e.stopPropagation());

    const cleanup = () => {
      popover.remove();
      document.removeEventListener('click', closeHandler);
      document.removeEventListener('keydown', keyHandler);
      delete popover._lfCleanup;
    };
    popover._lfCleanup = cleanup;

    const closeHandler = (e) => {
      if (!popover.contains(e.target) && !anchorBtn.contains(e.target)) {
        cleanup();
      }
    };
    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        cleanup();
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closeHandler);
      document.addEventListener('keydown', keyHandler);
    }, 10);

    const targetRoot = document.fullscreenElement || document.getElementById('movie_player') || document.body;
    targetRoot.appendChild(popover);
  }
}
