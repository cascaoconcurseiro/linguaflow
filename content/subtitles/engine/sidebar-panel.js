// content/subtitles/engine/sidebar-panel.js — Painel lateral: criação, abertura, tema, destaque da fala atual e rolagem.
import { subtitlePanelCss } from '../subtitle-panel-styles.js';
import { expressionKindCss } from '../expression-marks.js';
import { findActiveCueIndex } from '../active-cue.js';

export class SidebarPanelMethods {
  _createSubtitlePanel() {
    const existing = document.getElementById('lf-subtitle-panel-wrapper');
    if (existing) return;

    const panelTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this._wordsDeckLoaded = false;

    const wrapper = document.createElement('div');
    wrapper.id = 'lf-subtitle-panel-wrapper';
    wrapper.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 2147483640;
            display: flex;
            justify-content: flex-end;
            pointer-events: none;
        `;

    // Painel não-modal: o vídeo continua visível e interativo enquanto o
    // roteiro acompanha a fala (sem escurecer nem desfocar a página).
    const panel = document.createElement('div');
    panel.id = 'lf-subtitle-panel';
    panel.className = this.uiTheme === 'dark' ? 'theme-dark' : 'theme-light';
    panel.setAttribute('role', 'complementary');
    panel.setAttribute('aria-labelledby', 'lf-panel-heading');
    panel.style.cssText = `
            width: 420px;
            height: 100%;
            display: flex;
            flex-direction: column;
            position: relative;
            z-index: 2;
            pointer-events: auto;
            transform: translateX(100%);
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        `;

    // Injeta estilos de palavras no painel (fora do shadow dom)
    const panelStyle = document.createElement('style');
    panelStyle.textContent = subtitlePanelCss({ expressionCss: expressionKindCss('#lf-subtitle-panel ') });
    panel.appendChild(panelStyle);

    wrapper.appendChild(panel);
    document.body.appendChild(wrapper);

    // Animação de entrada
    requestAnimationFrame(() => {
      panel.style.transform = 'translateX(0)';
    });

    const panelAbort = new AbortController();
    const closePanel = () => {
      if (panelAbort.signal.aborted) return;
      panelAbort.abort();
      panel.style.transform = 'translateX(100%)';
      setTimeout(() => {
        wrapper.remove();
        if (panelTrigger && document.contains(panelTrigger)) panelTrigger.focus({ preventScroll: true });
      }, 300);
    };

    const header = document.createElement('div');
    header.className = 'lf-panel-header';
    header.style.cssText =
      'padding:20px 24px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';
    header.innerHTML = `
            <div class="lf-panel-title" style="display:flex;align-items:center;gap:0;font-family:'Libre Caslon Text',Georgia,serif;font-size:24px;font-weight:400;letter-spacing:-0.035em;">
              <span id="lf-panel-heading">Roteiro do vídeo</span>
            </div>
            <button id="lf-close-panel" class="lf-close-btn" aria-label="Fechar roteiro do vídeo" style="background:transparent;border:none;width:40px;height:40px;border-radius:8px;cursor:pointer;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;transition:0.2s;">✕</button>
        `;

    const closeBtn = header.querySelector('#lf-close-panel');
    closeBtn.onclick = closePanel;

    // ── Abas Legenda / Palavras ───────────────────────────────────────────
    const tabs = document.createElement('div');
    tabs.className = 'lf-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Conteúdo do roteiro');
    tabs.style.cssText =
      'display:flex;flex-shrink:0;';
    tabs.innerHTML = `
            <button id="lf-tab-subtitles" class="lf-tab-btn active" role="tab" aria-selected="true" aria-controls="lf-pane-subtitles" data-tab="subtitles" style="flex:1;padding:14px;background:transparent;border:none;border-bottom:2px solid #a6beff;color:#a6beff;font-size:14px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;transition:all 0.14s;text-transform:uppercase;">Legenda</button>
            <button id="lf-tab-words" class="lf-tab-btn" role="tab" aria-selected="false" aria-controls="lf-pane-words" data-tab="words" style="flex:1;padding:14px;background:transparent;border:none;border-bottom:2px solid transparent;font-size:14px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;transition:all 0.14s;text-transform:uppercase;">Palavras</button>
        `;

    // ── Painel Subtitles ──────────────────────────────────────────────────
    const subtitlePane = document.createElement('div');
    subtitlePane.id = 'lf-pane-subtitles';
    subtitlePane.setAttribute('role', 'tabpanel');
    subtitlePane.setAttribute('aria-labelledby', 'lf-tab-subtitles');
    subtitlePane.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';

    const toolbar = document.createElement('div');
    toolbar.className = 'lf-toolbar';
    toolbar.style.cssText =
      'padding:12px 16px;display:flex;flex-direction:column;gap:10px;flex-shrink:0;';
    toolbar.innerHTML = `
            <div style="display:flex;gap:8px;align-items:center;">
                <div style="position:relative;flex:1;">
                    <input id="lf-panel-search" class="lf-search-input" type="search" aria-label="Buscar no roteiro do vídeo" placeholder="Buscar no roteiro..." style="width:100%;border-radius:8px;padding:8px 12px 8px 32px;font-size:12px;outline:none;transition:border-color 0.2s;">
                    <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#64748B;font-size:14px;">🔍</span>
                </div>
                <button id="lf-follow-btn" title="Seguir vídeo" aria-label="Seguir trecho atual do vídeo" style="background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.3);color:#38BDF8;width:40px;height:40px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:0.2s;">↗</button>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div style="display:flex;gap:12px;">
                    <label class="lf-checkbox-label" style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;">
                        <input type="checkbox" id="lf-show-translation" checked style="cursor:pointer;accent-color:#38BDF8;">
                        <span>Tradução</span>
                    </label>
                    <label class="lf-checkbox-label" style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;">
                        <input type="checkbox" id="lf-autoscroll-panel" checked style="cursor:pointer;accent-color:#38BDF8;">
                        <span>Acompanhar vídeo</span>
                    </label>
                </div>
                <div style="display:flex;gap:6px;">
                    <button id="lf-export-pdf" aria-label="Exportar roteiro em PDF" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#CBD5E1;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:10px;font-weight:600;text-transform:uppercase;">PDF</button>
                    <button id="lf-export-csv" aria-label="Exportar roteiro em CSV" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#CBD5E1;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:10px;font-weight:600;text-transform:uppercase;">CSV</button>
                    <button id="lf-export-anki" aria-label="Exportar roteiro para Anki" style="background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.3);color:#38BDF8;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:10px;font-weight:600;text-transform:uppercase;">Anki</button>
                </div>
            </div>
            <div id="lf-panel-search-status" role="status" aria-live="polite" style="font-size:11px;color:#94A3B8;min-height:16px;"></div>
        `;

    // Evento de busca
    const searchInput = toolbar.querySelector('#lf-panel-search');
    let searchTimer = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => this._filterSubtitleList(e.target.value), 140);
    });
    panelAbort.signal.addEventListener('abort', () => clearTimeout(searchTimer), { once: true });

    const list = document.createElement('div');
    list.id = 'lf-subtitle-list';
    list.style.cssText =
      'flex:1;overflow-y:auto;padding:10px;scrollbar-width:thin;scrollbar-color:#334155 transparent;';
    list._userScrolling = false;
    list._isProgrammaticScroll = false;
    let _scrollTimer = null;

    const markUserScroll = () => {
      if (list._isProgrammaticScroll) return;
      list._userScrolling = true;
      clearTimeout(_scrollTimer);
      _scrollTimer = setTimeout(() => {
        list._userScrolling = false;
      }, 3500);
    };

    // Detectar rolagem manual genuína do usuário sem falsos positivos causados por layout ou scrollTo
    list.addEventListener('wheel', markUserScroll, { passive: true });
    list.addEventListener('touchmove', markUserScroll, { passive: true });
    let isDraggingScrollbar = false;
    list.addEventListener('pointerdown', (e) => {
      if (e.offsetX >= list.clientWidth) {
        isDraggingScrollbar = true;
        markUserScroll();
      }
    }, { passive: true });
    window.addEventListener('pointerup', () => {
      if (isDraggingScrollbar) {
        isDraggingScrollbar = false;
        markUserScroll();
      }
    }, { passive: true, signal: panelAbort.signal });
    window.addEventListener('pointermove', () => {
      if (isDraggingScrollbar) {
        markUserScroll();
      }
    }, { passive: true, signal: panelAbort.signal });
    list.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Space'].includes(e.code)) {
        markUserScroll();
      }
    }, { passive: true });

    subtitlePane.appendChild(toolbar);
    subtitlePane.appendChild(list);
    // Depois de anexar: o status "N trechos" fica na toolbar irmã da lista.
    this._rebuildSubtitleList(list);

    // ── Painel Words (Frequência, Phrasal Verbs e Gírias) ─────────────────
    const wordsPane = document.createElement('div');
    wordsPane.id = 'lf-pane-words';
    wordsPane.setAttribute('role', 'tabpanel');
    wordsPane.setAttribute('aria-labelledby', 'lf-tab-words');
    wordsPane.setAttribute('hidden', '');
    wordsPane.style.cssText = 'flex:1;display:none;flex-direction:column;overflow:hidden;position:relative;';

    const wordsScroll = document.createElement('div');
    wordsScroll.id = 'lf-words-scroll';
    wordsScroll.style.cssText =
      'flex:1;overflow-y:auto;padding:14px;scrollbar-width:thin;scrollbar-color:#334155 transparent;';

    const sentenceExplorer = document.createElement('div');
    sentenceExplorer.id = 'lf-sentence-explorer';
    sentenceExplorer.style.cssText =
      'flex:1;display:none;flex-direction:column;overflow:hidden;';

    wordsPane.appendChild(wordsScroll);
    wordsPane.appendChild(sentenceExplorer);
    this._rebuildWordsList(wordsScroll);
    this._applyExpressionMarks();

    // ── Monta painel ──────────────────────────────────────────────────────
    panel.appendChild(header);
    panel.appendChild(tabs);
    panel.appendChild(subtitlePane);
    panel.appendChild(wordsPane);

    // ── Lógica das abas ───────────────────────────────────────────────────
    const tabSubtitles = document.getElementById('lf-tab-subtitles');
    const tabWords = document.getElementById('lf-tab-words');
    const switchTab = (active) => {
      if (active === 'subtitles') {
        subtitlePane.style.display = 'flex';
        wordsPane.style.display = 'none';
        tabSubtitles.style.borderBottomColor = '#a6beff';
        tabSubtitles.style.color = '#a6beff';
        tabWords.style.borderBottomColor = 'transparent';
        tabWords.style.color = '#b0bac9';
        tabSubtitles.classList.add('active');
        tabWords.classList.remove('active');
        tabSubtitles.setAttribute('aria-selected', 'true');
        tabWords.setAttribute('aria-selected', 'false');
        subtitlePane.removeAttribute('hidden');
        wordsPane.setAttribute('hidden', '');
        list._userScrolling = false;
        this._updateSubtitlePanelHighlight(true);
      } else {
        subtitlePane.style.display = 'none';
        wordsPane.style.display = 'flex';
        tabWords.style.borderBottomColor = '#a6beff';
        tabWords.style.color = '#a6beff';
        tabSubtitles.style.borderBottomColor = 'transparent';
        tabSubtitles.style.color = '#b0bac9';
        tabWords.classList.add('active');
        tabSubtitles.classList.remove('active');
        tabWords.setAttribute('aria-selected', 'true');
        tabSubtitles.setAttribute('aria-selected', 'false');
        wordsPane.removeAttribute('hidden');
        subtitlePane.setAttribute('hidden', '');
        if (sentenceExplorer.style.display !== 'flex') {
          wordsScroll.style.display = 'block';
        }
        this._rebuildWordsList();
      }
    };
    tabSubtitles.addEventListener('click', () => switchTab('subtitles'));
    tabWords.addEventListener('click', () => switchTab('words'));
    tabs.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const target = event.key === 'Home'
        ? tabSubtitles
        : event.key === 'End'
          ? tabWords
          : event.key === 'ArrowLeft'
            ? (event.target === tabWords ? tabSubtitles : tabWords)
            : (event.target === tabSubtitles ? tabWords : tabSubtitles);
      target.focus();
      switchTab(target.dataset.tab);
    });
    switchTab('subtitles');

    // ── Eventos do Painel (Fiação Final) ──────────────────────────────────
    document.getElementById('lf-close-panel').onclick = closePanel;

    document.getElementById('lf-show-translation').onchange = (e) => {
      this._rebuildSubtitleList(list, document.getElementById('lf-panel-search').value);
    };

    const autoScrollToggle = document.getElementById('lf-autoscroll-panel');
    if (autoScrollToggle) {
      autoScrollToggle.onchange = () => {
        if (autoScrollToggle.checked) {
          list._userScrolling = false;
          this._updateSubtitlePanelHighlight(true);
        }
      };
    }

    document.getElementById('lf-export-pdf').onclick = () => this._exportPDF();
    document.getElementById('lf-export-csv').onclick = () => this._exportCSV();
    document.getElementById('lf-export-anki').onclick = () => this._exportAnki();

    document.getElementById('lf-follow-btn').onclick = () => {
      list._userScrolling = false;
      const cb = document.getElementById('lf-autoscroll-panel');
      if (cb) cb.checked = true;
      this._updateSubtitlePanelHighlight(true);
    };

    // Não-modal: Esc só fecha com o foco no painel; fora dele, Esc continua
    // sendo do player (ex.: sair da tela cheia).
    const closeWithEscape = (event) => {
      if (event.key === 'Escape' && panel.contains(document.activeElement)) closePanel();
    };
    document.addEventListener('keydown', closeWithEscape, { signal: panelAbort.signal });
    closeBtn.focus({ preventScroll: true });

    // Highlight Inicial e Loop de Sincronia
    this._updateSubtitlePanelHighlight(true);
    setTimeout(() => {
      list._userScrolling = false;
      this._updateSubtitlePanelHighlight(true);
    }, 320);

    const panelSync = setInterval(() => {
      if (!document.getElementById('lf-subtitle-panel')) {
        clearInterval(panelSync);
        return;
      }
      this._updateSubtitlePanelHighlight();
    }, 500);
  }

  toggleSubtitlePanel() {
    const wrapper = document.getElementById('lf-subtitle-panel-wrapper');
    const panelBtns = document.querySelectorAll('button[data-action="panel"], #lf-yt-panel-btn');
    if (wrapper) {
      panelBtns.forEach((b) => b.classList.remove('is-active'));
      const overlay = wrapper.querySelector('div');
      const panel = wrapper.querySelector('#lf-subtitle-panel');
      if (overlay && panel) {
        overlay.style.opacity = '0';
        panel.style.transform = 'translateX(100%)';
        setTimeout(() => wrapper.remove(), 300);
      } else {
        wrapper.remove();
      }

      return;
    }

    panelBtns.forEach((b) => b.classList.add('is-active'));
    this._createSubtitlePanel();
  }

  _applyThemeToPanel() {
    const panel = document.getElementById('lf-subtitle-panel');
    if (panel) {
      if (this.uiTheme === 'dark') {
        panel.classList.add('theme-dark');
        panel.classList.remove('theme-light');
      } else {
        panel.classList.add('theme-light');
        panel.classList.remove('theme-dark');
      }
    }
  }

  _debouncedRebuildPanels() {
    clearTimeout(this._rebuildPanelsTimer);
    this._rebuildPanelsTimer = setTimeout(() => {
      const activeTab = document.querySelector('.lf-tab-btn.active')?.dataset?.tab || 'subtitles';
      if (activeTab === 'subtitles') {
        this._rebuildSubtitleList();
      } else if (activeTab === 'words') {
        this._rebuildWordsList();
      }
    }, 250);
  }

  _updateSubtitlePanelHighlight(forceInstant = false) {
    if (typeof document === 'undefined') return;
    const list = document.getElementById('lf-subtitle-list');
    if (!list) return;

    const autoScroll = document.getElementById('lf-autoscroll-panel')?.checked ?? true;
    const cues = this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues;

    if (this.videoElement && cues && cues.length > 0) {
      const liveIdx = findActiveCueIndex(cues, this.videoElement.currentTime);
      if (liveIdx >= 0) {
        this.currentCueIndex = liveIdx;
      } else if (this.currentCueIndex < 0) {
        const t = this.videoElement.currentTime;
        let lastPassedIdx = -1;
        for (let i = cues.length - 1; i >= 0; i--) {
          if (cues[i].start <= t) {
            lastPassedIdx = i;
            break;
          }
        }
        this.currentCueIndex = lastPassedIdx >= 0 ? lastPassedIdx : 0;
      }
    }

    // Chamado a cada 500 ms e a cada fala: só mexe no DOM quando a fala ativa
    // muda. O visual de .active/.is-looping vem do CSS do painel.
    if (!forceInstant && list._lastActiveIndex === this.currentCueIndex) return;
    list._lastActiveIndex = this.currentCueIndex;

    const items = list.querySelectorAll('.lf-subtitle-item') || [];
    let activeItem = null;
    items.forEach((item) => {
      const isActive = parseInt(item.dataset.index, 10) === this.currentCueIndex;
      if (isActive) activeItem = item;
      if (!!item.classList?.contains?.('active') === isActive) return;
      if (isActive) {
        item.classList?.add?.('active');
        item.setAttribute?.('aria-current', 'true');
      } else {
        item.classList?.remove?.('active');
        item.removeAttribute?.('aria-current');
      }
    });

    if (activeItem && autoScroll && (!list._userScrolling || forceInstant)) {
      this._scrollSubtitleItemIntoView(list, activeItem, forceInstant);
    }
  }

  _scrollSubtitleItemIntoView(list, item, instant = false) {
    if (!list || !item) return;
    const itemOffset = item.offsetTop - list.offsetTop;
    const targetScrollTop = itemOffset - (list.clientHeight / 2) + (item.clientHeight / 2);

    if (instant) {
      list._isProgrammaticScroll = true;
      list.scrollTop = Math.max(0, targetScrollTop);
      clearTimeout(list._progScrollTimer);
      list._progScrollTimer = setTimeout(() => {
        list._isProgrammaticScroll = false;
      }, 100);
      return;
    }

    if (Math.abs(list.scrollTop - targetScrollTop) > 15) {
      list._isProgrammaticScroll = true;
      if (typeof list.scrollTo === 'function') {
        list.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        });
      } else {
        list.scrollTop = Math.max(0, targetScrollTop);
      }
      clearTimeout(list._progScrollTimer);
      list._progScrollTimer = setTimeout(() => {
        list._isProgrammaticScroll = false;
      }, 500);
    }
  }

  _filterSubtitleList(text) {
    const list = document.getElementById('lf-subtitle-list');
    if (list) this._rebuildSubtitleList(list, text);
  }
}
