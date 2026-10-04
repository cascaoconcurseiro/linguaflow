// content/subtitles/engine/caption-display.js — A legenda na tela: host/Shadow DOM, posicionamento, renderização dual, palavras clicáveis e marcas de expressão.
import { subtitleShadowHtml } from '../subtitle-shadow-template.js';
import { SHADOW_CSS } from '../shadow-mode.js';
import { DEFAULT_EXPRESSION_MARKS, EXPRESSION_KINDS, EXPRESSION_KIND_LABELS, expressionKindCss } from '../expression-marks.js';
import { annotateCaptionSegment } from '../../../utils/speech-cadence.js';
import { segmentSubtitle } from '../transcript-render.js';
import { MAX_EXPRESSION_WORDS } from '../../../utils/expressions-db.js';
import { createHoverTip } from '../hover-tip.js';
import { cueNewWordStats, hasNewWords, isFullyUnderstood } from '../smart-captions.js';

export class CaptionDisplayMethods {
  // ── UI de Legendas (Shadow DOM) ──────────────────────────────────────────
  async _injectSubtitleUI(force = false) {
    // Captions, video discovery and SPA navigation can request the mount at once.
    // Share the in-flight mount so one caller cannot remove another's shadow root.
    if (this._subtitleUiPending) await this._subtitleUiPending;
    if (!force && this.shadowContainer?.host === document.getElementById('linguaflow-subtitle-host')) return;
    const pending = this._createSubtitleUI();
    this._subtitleUiPending = pending;
    try {
      await pending;
    } finally {
      if (this._subtitleUiPending === pending) this._subtitleUiPending = null;
    }
  }

  async _createSubtitleUI() {
    // Remove instâncias anteriores (hot-reload)
    document.getElementById('linguaflow-subtitle-host')?.remove();

    const host = document.createElement('div');
    host.id = 'linguaflow-subtitle-host';

    // O shell visual não pode depender de banco ou da montagem tardia do player.
    // Começamos no body com defaults seguros e reposicionamos depois, quando o
    // container real existir. Isso tira I/O e retries do caminho crítico.
    host.style.cssText = `
      position: fixed !important;
      bottom: 100px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      z-index: 2147483640 !important;
      width: 94% !important;
      max-width: 900px !important;
      text-align: center !important;
      pointer-events: none;
      padding: 0 !important;
      display: flex !important;
      justify-content: center !important;
    `;
    document.body.appendChild(host);

    // Carrega posição salva ou usa padrão
    // YouTube: linha do tempo fica em ~48-60px, então usamos 100px para ficar acima
    // HBO/Max: calculado dinamicamente baseado na barra de controles real
    let bottomPos = this.platform === 'youtube' ? 100 : null; // null = auto para HBO
    let horizontalPos = 50;
    let userSavedBottom = false;
    const settingsPromise = import('../../../utils/db.js')
      .then(async ({ db }) => ({
        savedBottom: await db.getSetting('subtitleBottom'),
        savedHorizontal: await db.getSetting('subtitleHorizontal'),
      }))
      .catch(() => ({}));

    if (bottomPos === null) bottomPos = 100; // fallback temporário, será recalculado

    // Salva em memoria para o ResizeObserver nao sobrescrever
    this._currentBottom = bottomPos;
    this._currentHorizontal = horizontalPos;

    // Usa o player imediatamente quando ele já existe; caso contrário, o shell
    // fica no body e _waitForVideo() faz o reposicionamento assim que possível.
    let playerContainer = this._findPlayerContainer();

    settingsPromise.then(({ savedBottom, savedHorizontal }) => {
      if (!host.isConnected) return;
      if (savedBottom !== undefined && savedBottom !== null) {
        bottomPos = savedBottom;
        userSavedBottom = true;
        this._currentBottom = savedBottom;
      }
      if (savedHorizontal !== undefined && savedHorizontal !== null) {
        horizontalPos = savedHorizontal;
        this._currentHorizontal = savedHorizontal;
      }
      host.style.bottom = `${this.platform === 'max' && !userSavedBottom ? 120 : bottomPos}px`;
      host.style.left = `${horizontalPos}%`;
      host.style.transform = `translateX(-${horizontalPos}%)`;
    });

    if (this.platform === 'max') {
      const effectiveBottom = userSavedBottom ? bottomPos : 120;
      this._currentBottom = effectiveBottom;
      host.style.cssText = `
                position: fixed !important;
                bottom: ${effectiveBottom}px !important;
                left: ${horizontalPos}% !important;
                transform: translateX(-${horizontalPos}%) !important;
                z-index: 2147483640 !important;
                width: 94% !important;
                max-width: 900px !important;
                text-align: center !important;
                pointer-events: none;
                padding: 0 !important;
            `;
      const targetRoot = document.fullscreenElement || document.body;
      if (host.parentElement !== targetRoot) targetRoot.appendChild(host);
      console.debug(`[LinguaFlow] HBO: legenda fixed bottom=${effectiveBottom}px`);
    } else if (playerContainer) {
      // YouTube e outros: absoluto dentro do player
      host.style.cssText = `
                position: absolute !important;
                bottom: ${bottomPos}px !important;
                left: ${horizontalPos}% !important;
                transform: translateX(-${horizontalPos}%) !important;
                z-index: 2147483640 !important;
                width: 94% !important;
                max-width: 900px !important;
                text-align: center !important;
                pointer-events: none;
                padding: 0 !important;
                display: flex !important;
                justify-content: center !important;
            `;
      playerContainer.appendChild(host);
      console.debug(
        `[LinguaFlow] Legenda posicionada: ${horizontalPos}% horizontal, ${bottomPos}px vertical`,
      );
    } else {
      // Fallback: posição fixa
      host.style.cssText = `
                position: fixed !important;
                bottom: ${bottomPos}px !important;
                left: ${horizontalPos}% !important;
                transform: translateX(-${horizontalPos}%) !important;
                z-index: 2147483640 !important;
                width: 94% !important;
                max-width: 900px !important;
                text-align: center !important;
                pointer-events: none;
                padding: 0 !important;
                display: flex !important;
                justify-content: center !important;
            `;
      if (host.parentElement !== document.body) document.body.appendChild(host);
      console.debug(
        `[LinguaFlow] Legenda posicionada (fallback): ${horizontalPos}% horizontal, ${bottomPos}px vertical`,
      );
    }

    // Aplica o estado de ativação atual após a injeção para evitar que o cssText resetado mostre a legenda
    this.toggleSubtitles(this.isActivated);

    this.shadowContainer = host.attachShadow({ mode: 'open' });
    this.shadowContainer.innerHTML = subtitleShadowHtml({ shadowCss: SHADOW_CSS, expressionCss: expressionKindCss('') });

    // Aplica as cores carregadas
    this._updateSubtitleColors();
    this._applyExpressionMarks();

    // Auto-pause video on hover (Language Reactor feature) e Arrastar Legenda
    const wrap = this.shadowContainer.getElementById('lf-wrap');

    // §4d.5: o estado do drag vive na INSTÂNCIA, não em closures. Os listeners
    // de janela abaixo são presos uma única vez (_dragEventsAttached) e, na
    // versão antiga, fechavam sobre isDragging/startY/host da PRIMEIRA
    // injeção — a segunda injeção (via _waitForVideo) criava um wrap novo cujo
    // mousedown setava um closure novo que o mousemove da janela nunca lia.
    // Resultado: arrastar a legenda nunca funcionava no YouTube/Max.
    this._drag = { active: false, startY: 0, startBottom: 0, wrap };

    wrap.addEventListener('mousedown', (e) => {
      if (e.target.closest?.('.lf-word')) return;
      const liveHost = document.getElementById('linguaflow-subtitle-host');
      if (!liveHost) return;
      this._drag.active = true;
      this._drag.startY = e.clientY;
      this._drag.startBottom = parseFloat(window.getComputedStyle(liveHost).bottom) || 0;
      this._drag.wrap = wrap;
      wrap.style.cursor = 'grabbing';
      e.preventDefault();
    });

    // Listeners de janela protegidos contra duplicação
    if (!this._dragEventsAttached) {
      window.addEventListener('mousemove', (e) => {
        if (!this._drag?.active) return;
        const liveHost = document.getElementById('linguaflow-subtitle-host');
        if (!liveHost) return;
        const deltaY = this._drag.startY - e.clientY;
        const newBottom = Math.max(0, this._drag.startBottom + deltaY);
        liveHost.style.bottom = `${newBottom}px`;
        this._currentBottom = newBottom;
      }, { signal: this._lifecycleController.signal });

      window.addEventListener('mouseup', () => {
        if (this._drag?.active) {
          this._drag.active = false;
          if (this._drag.wrap) this._drag.wrap.style.cursor = 'default';
        }
      }, { signal: this._lifecycleController.signal });
      this._dragEventsAttached = true;
    }

    wrap.addEventListener('mouseenter', () => {
      if (!this._drag?.active) wrap.style.cursor = 'grab';
      if (this._pauseCooldown) return; // Ignora se acabou de dar play
      if (this.videoElement && !this.videoElement.paused) {
        this.videoElement.pause();
        this._wasPausedByHover = true;
      }
    });
    wrap.addEventListener('mouseleave', () => {
      wrap.style.cursor = 'default';
      // Se o popup estiver aberto, deixamos o fechamento do popup cuidar do play
      const popupOpen =
        this.wordPopup && this.wordPopup.popup && this.wordPopup.popup.style.display !== 'none';
      if (!popupOpen && this.videoElement && this.videoElement.paused) {
        const hoverPause = this._wasPausedByHover;
        const autoPauseOn = this.autoPause && this._lastAutoPausedEndTime > 0;
        if (hoverPause || autoPauseOn) {
          this.videoElement.play().catch(() => {});
          this._wasPausedByHover = false;
          this._lastAutoPausedEndTime = -1;

          this._pauseCooldown = true;
          setTimeout(() => (this._pauseCooldown = false), 500);
        }
      }
    });

    // Botão de tradução rápida
    const translateBtn = this.shadowContainer.getElementById('lf-translate-btn');
    if (translateBtn) {
      translateBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const transDiv = this.shadowContainer.getElementById('lf-trans');
        if (!transDiv) return;

        // Usa _currentCue (funciona para YouTube e HBO)
        const cue = this._currentCue || this.cues[this.currentCueIndex];
        const text = cue?.translatedText;

        if (text) {
          this._showTranslationFlash(text);
        } else if (cue?.text) {
          const navigation = this._navigationSnapshot();
          // Traduz agora
          translateBtn.setAttribute('aria-busy', 'true');
          translateBtn.disabled = true;
          try {
            const { translator } = await import('../../../utils/translator.js');
            if (!this._isNavigationCurrent(navigation)) return;
            const result = await translator.translate(cue.text, 'auto', this.targetLang);
            if (!this._isNavigationCurrent(navigation) || this._currentCue !== cue) return;
            cue.translatedText = result.translation;
            this._showTranslationFlash(result.translation);
          } catch {}
          if (this._isNavigationCurrent(navigation) && translateBtn.isConnected) {
            translateBtn.removeAttribute('aria-busy');
            translateBtn.disabled = false;
          }
        }
      });
    }

  }

  // ── ResizeObserver para ajustar legenda quando player muda ───────────────
  _setupResizeObserver() {
    const checkAndObserve = () => {
      const playerContainer = this._findPlayerContainer();
      const subtitleHost = document.getElementById('linguaflow-subtitle-host');

      if (playerContainer && subtitleHost) {
        if (this.resizeObserver) this.resizeObserver.disconnect();
        this.resizeObserver = new ResizeObserver(() => {
          // Debounce: durante o carregamento da página o player dispara vários
          // resizes intermediários (anúncios, layout shift) e reposicionar a
          // cada um deles fazia a fonte da legenda oscilar de tamanho.
          clearTimeout(this._repositionDebounce);
          this._repositionDebounce = this._setManagedTimeout(() => {
            console.debug('[LinguaFlow] Player redimensionado, ajustando legenda...');
            this._repositionSubtitle();
          }, 150);
        });

        this.resizeObserver.observe(playerContainer);
        console.debug('[LinguaFlow] ResizeObserver ativado para legenda');
      } else {
        // Tenta novamente após 2 segundos
        this._setManagedTimeout(checkAndObserve, 2000);
      }
    };

    checkAndObserve();

    // Listener para fullscreen
    document.addEventListener('fullscreenchange', () => {
      this._setManagedTimeout(() => {
        this._repositionSubtitle();
      }, 100);
    }, { signal: this._lifecycleController.signal });

    // Listener para resize da janela
    window.addEventListener('resize', () => {
      clearTimeout(this._repositionDebounce);
      this._repositionDebounce = this._setManagedTimeout(() => this._repositionSubtitle(), 150);
    }, { signal: this._lifecycleController.signal });
  }

  // A legenda nasce no body quando o player ainda não existe (posição fixa na
  // janela, ~100px da borda do navegador). Quando o player aparece ela precisa
  // entrar nele; senão fica fora do lugar até o usuário recarregar a página.
  // Só troca propriedades de posição: visibility/opacity do liga/desliga ficam.
  _moveHostIntoPlayer(host = document.getElementById('linguaflow-subtitle-host')) {
    if (this.platform === 'max' || !host || host.parentElement !== document.body) return false;
    const player = this._findPlayerContainer();
    if (!player) return false;
    const bottom = this._currentBottom ?? 100;
    const horizontal = this._currentHorizontal ?? 50;
    const set = (name, value) => host.style.setProperty(name, value, 'important');
    set('position', 'absolute');
    set('bottom', `${bottom}px`);
    set('left', `${horizontal}%`);
    set('transform', `translateX(-${horizontal}%)`);
    set('width', '94%');
    player.appendChild(host);
    console.debug('[LinguaFlow] Legenda reposicionada dentro do player');
    return true;
  }

  async _repositionSubtitle() {
    const host = document.getElementById('linguaflow-subtitle-host');
    if (!host) return;
    this._moveHostIntoPlayer(host);

    if (this.platform === 'max') {
      const targetRoot = document.fullscreenElement || document.body;
      if (host.parentElement !== targetRoot) {
        targetRoot.appendChild(host);
      }
    }

    // O tamanho da fonte é do painel de configurações (--lf-font-size). Escrever
    // aqui um valor proporcional à largura do player sobrescrevia o valor do
    // usuário a cada resize e a legenda mudava de tamanho sozinha.

    if (this._currentHorizontal !== undefined) {
      host.style.left = `${this._currentHorizontal}%`;
      host.style.transform = `translateX(-${this._currentHorizontal}%)`;
    }

    // HBO/Max: recalcula bottom baseado na barra de controles real
    if (this.platform === 'max' && this._currentBottom === undefined) {
      const selectors = [
        '[data-testid="control_footer"]',
        '[class*="ControlsFooter"]',
        '[class*="PlayerControls"]',
        '[class*="controls-footer"]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.height > 0) {
            host.style.bottom = `${rect.height + 20}px`;
            return;
          }
        }
      }
    }

    if (this._currentBottom !== undefined) {
      host.style.bottom = `${this._currentBottom}px`;
    }
  }

  // ── Motor de Renderização de Elite (onSubtitle) ──────────────────────────
  onSubtitle(cue) {
    if (!cue) return;
    // Desligado: nada de índice, painel nem tradução (#420). Ao ligar, a fala atual reaparece.
    if (this.isActivated === false) {
      this._currentCue = null;
      return;
    }
    if (cue === this._currentCue) return;
    this._lastProcessedText = cue.text;
    this._currentCue = cue;
    this.currentSubtitleTimestamp = cue.start;

    // --- NOVO: Contexto Expandido (Melhor que o Lingosive) ---
    const cues = this.xhrCues && this.xhrCues.length ? this.xhrCues : this.cues;
    let idx = cues ? cues.indexOf(cue) : -1;
    if (idx === -1 && cues) {
      idx = cues.findIndex((c) => Math.abs(c.start - cue.start) < 0.1 && c.text === cue.text);
    }
    this.currentCueIndex = idx;
    this._updateSubtitlePanelHighlight();

    const prevText = idx > 0 ? cues[idx - 1].text : '';
    const nextText = idx >= 0 && idx < cues.length - 1 ? cues[idx + 1].text : '';

    cue.fullContext = {
      prev: prevText,
      current: cue.text,
      next: nextText,
    };

    if (!cue._speechCadence) {
      cue._speechCadence = annotateCaptionSegment(cue);
    }

    // 2. Tradução Dinâmica: Se não tiver, busca ou usa placeholder
    const trans = cue.translatedText || (cue.isTranslating ? '...' : '');

    // 3. Exibição Instantânea
    if (this.shadowContainer) {
      this.renderDual(cue.text, trans);
    } else {
      console.warn('[LinguaFlow] ⚠️ shadowContainer não pronto em onSubtitle. Tentando injetar...');
      const navigation = this._navigationSnapshot();
      this._injectSubtitleUI().then(() => {
        if (!this._isNavigationCurrent(navigation) || this._currentCue !== cue) return;
        this.renderDual(cue.text, trans);
      });
    }

    // 4. Se a tradução chegou depois, atualiza
    if (!cue.translatedText && !cue.isTranslating) {
      const navigation = this._navigationSnapshot();
      cue.isTranslating = true;
      chrome.runtime.sendMessage(
        {
          action: 'translate',
          text: cue.text,
          from: this.sourceLang,
          to: this.targetLang,
        },
        (res) => {
          if (!this._isNavigationCurrent(navigation) || !this.cues.includes(cue)) return;
          cue.isTranslating = false;
          if (res?.translation) {
            cue.translatedText = res.translation;
            cue._transLang = this.targetLang;
            if (this._currentCue === cue) {
              this.renderDual(cue.text, res.translation);
            }
          }
        },
      );
    }
  }

  renderDual(orig, trans) {
    if (!this.shadowContainer) {
      console.warn('[LinguaFlow] renderDual failed: shadowContainer not ready');
      return;
    }
    orig = this._cleanSubtitleText ? this._cleanSubtitleText(orig) : (orig || '');
    trans = this._cleanSubtitleText ? this._cleanSubtitleText(trans) : (trans || '');
    if (orig) this._setCaptionNotice('');
    const wrap = this.shadowContainer.getElementById('lf-wrap');
    const origDiv = this.shadowContainer.getElementById('lf-orig');
    const transDiv = this.shadowContainer.getElementById('lf-trans');
    if (!wrap || !origDiv || !transDiv) return;

    // Verifica se há legenda válida (texto não vazio após trim)
    const hasValidSubtitle = orig && orig.trim().length > 0;

    // Bloqueia renderização se o motor não estiver ativado ou não houver legenda
    if (!hasValidSubtitle || !this.isActivated) {
      origDiv.style.display = 'none';
      transDiv.style.display = 'none';
      if (wrap) wrap.style.display = 'none';
      return;
    }

    // (O _lastOrig e a visibilidade do transDiv serão atualizados na lógica do modo de exibição mais abaixo)

    // Atalho F (#448): a tradução chega depois e redesenha a mesma fala; sem
    // isso a palavra escolhida pelo teclado era destruída e o foco sumia.
    const active = this.shadowContainer.activeElement;
    const focusedWordIndex = active && origDiv.contains(active)
      ? [...origDiv.querySelectorAll('.lf-word')].indexOf(active)
      : -1;

    origDiv.innerHTML = '';
    // Força recriação do nó clicável para garantir que ele pertença ao Shadow Root atual
    origDiv.appendChild(this._makeClickable(orig));
    if (focusedWordIndex >= 0) {
      const words = origDiv.querySelectorAll('.lf-word');
      (words[focusedWordIndex] || words[words.length - 1])?.focus();
    }

    // Modo Hardcore: blur na linha original até o usuário passar o mouse
    const origRow = this.shadowContainer.querySelector('.lf-orig-row');
    if (origRow) {
      if (this.blurSubtitles) origRow.classList.add('lf-blur');
      else origRow.classList.remove('lf-blur');
    }

    // Corrige encoding de caracteres especiais
    const decodedTrans = this._fixEncoding(trans);

    // Log para debug de encoding (apenas se houver caracteres suspeitos)
    if (trans && (trans.includes('◆') || trans.includes('Ã'))) {
      console.warn('[LinguaFlow] ⚠️ Encoding issue detectado:');
      console.warn('  Original:', trans);
      console.warn('  Corrigido:', decodedTrans);
    }

    const transSpan = this.shadowContainer.getElementById('lf-trans-txt');
    if (transSpan) transSpan.textContent = decodedTrans;
    else {
      const s = transDiv.querySelector('#lf-trans-txt');
      if (s) s.textContent = decodedTrans;
    }

    // Aplica o modo de exibição e visibilidade real baseada em conteúdo
    // Shadowing (#456): tradução escondida; o botão de traduzir continua mostrando sob demanda.
    const mode = this.displayMode || 'native';
    const shownMode = this.shadowMode ? 'native' : mode;
    if (wrap) wrap.setAttribute('data-subtitle-mode', shownMode);

    const hasTrans = decodedTrans && decodedTrans.trim().length > 0;

    // Opção "esconder tradução do que já sei": nos modos com tradução fixa, a fala
    // em que todas as palavras são conhecidas fica só com o original (o botão
    // de traduzir continua disponível). Desligada, nada muda.
    const smartHidden = Boolean(this.smartHideKnownTranslation) &&
      (shownMode === 'bilingual' || shownMode === 'blur') &&
      isFullyUnderstood(this._cueNewWordStats(orig));
    this._smartTranslationHidden = smartHidden;

    // Lógica de visibilidade baseada no modo
    if (smartHidden) {
      origDiv.style.display = 'block';
      const hasActiveFlash = transDiv.classList.contains('lf-trans-flash');
      transDiv.style.display = hasActiveFlash && hasTrans ? 'block' : 'none';
    } else if (shownMode === 'translated') {
      origDiv.style.display = 'none';
      if (transDiv && hasTrans) transDiv.style.display = 'block';
    } else if (shownMode === 'bilingual' || shownMode === 'blur') {
      origDiv.style.display = 'block';
      if (transDiv && hasTrans) transDiv.style.display = 'block';
    } else {
      // mode === 'native'
      origDiv.style.display = 'block';
      const isNewOriginal = orig !== this._lastOrig;

      // Um flash manual só pertence à legenda que estava ativa quando foi solicitado.
      if (isNewOriginal && transDiv.classList.contains('lf-trans-flash')) {
        transDiv.classList.remove('lf-trans-flash');
        if (this._flashTimeout) {
          clearTimeout(this._flashTimeout);
          this._flashTimeout = null;
        }
      }

      // Respostas assíncronas de tradução também passam por renderDual. O modo
      // nativo deve continuar ocultando-as, exceto durante o flash manual ativo.
      const hasActiveFlash = transDiv.classList.contains('lf-trans-flash');
      transDiv.style.display = hasActiveFlash && hasTrans ? 'block' : 'none';
    }

    this._lastOrig = orig;
    this._lastTrans = decodedTrans;
    this._renderShadowContext(orig);

    // Esconde o container principal se não houver nada para mostrar
    if (wrap) {
      const isOrigVisible = origDiv.style.display !== 'none';
      const isTransVisible = transDiv && transDiv.style.display !== 'none';
      wrap.style.display = (isOrigVisible || isTransVisible) ? 'inline-flex' : 'none';
    }


    // Mostra botão de tradução rápida apenas quando tradução está oculta e engine ligado
    const translateBtn = this.shadowContainer.getElementById('lf-translate-btn');
    if (translateBtn) {
      const hasActiveFlash = transDiv.classList.contains('lf-trans-flash');
      const showBtn = orig && (mode === 'native' || smartHidden) && this.isActivated && !hasActiveFlash;
      translateBtn.style.display = showBtn ? 'block' : 'none';
    }

    if (mode === 'blur') wrap.classList.add('mode-blur');
    else wrap.classList.remove('mode-blur');
  }

  // Palavras novas da fala para o aluno, pelos mesmos conjuntos que pintam a legenda.
  _cueNewWordStats(text) {
    return cueNewWordStats(text, {
      knownWords: this.knownWords,
      savedWords: this.savedWords,
      ignoredWords: this.ignoredWords,
    });
  }

  _cueHasNewWords(cue) {
    return hasNewWords(this._cueNewWordStats(cue?.text));
  }

  _makeClickable(text, disableHoverPause = false) {
    const frag = document.createDocumentFragment();
    for (const segment of segmentSubtitle(text, this._getMaxExpressionWords())) {
      if (!segment.isWord) {
        frag.appendChild(document.createTextNode(segment.text));
        continue;
      }
      const span = this._createWordSpan(segment.text, !!segment.expression, disableHoverPause);
      if (segment.expression) this._decorateExpressionSpan(span, segment);
      frag.appendChild(span);
    }
    return frag;
  }

  // Tipo, dica "soa como" e significado curto no próprio trecho: o estilo por
  // tipo vem do CSS e o significado aparece no title (dica do navegador).
  _decorateExpressionSpan(span, segment) {
    span.dataset.expression = segment.expression;
    span.dataset.kind = segment.kind || 'phrasal';
    if (segment.hint) span.dataset.hint = segment.hint;
    const label = EXPRESSION_KIND_LABELS[span.dataset.kind];
    if (label) span.title = segment.meaning ? `${label}: ${segment.meaning}` : label;
  }

  _applyExpressionMarks() {
    const marks = this.expressionMarks || DEFAULT_EXPRESSION_MARKS;
    const targets = [
      this.shadowContainer?.getElementById?.('lf-wrap'),
      typeof document !== 'undefined' ? document.getElementById('lf-subtitle-panel') : null,
    ].filter(Boolean);
    for (const target of targets) {
      for (const kind of EXPRESSION_KINDS) {
        const hidden = marks[kind === 'contraction' ? 'reduction' : kind] === false;
        target.classList?.toggle?.(`lf-hide-${kind}`, hidden);
      }
    }
  }

  _getMaxExpressionWords() {
    return MAX_EXPRESSION_WORDS;
  }

  // #369: dica leve do hover — só a palavra (tradução e classes, do cache do
  // service worker, as mesmas do card); a legenda traduzida não entra.
  _showHoverTip(span, text) {
    const word = String(text || '').replace(/[.,!?()"]+/g, '').trim();
    if (!word) return;
    this._hoverTip ??= createHoverTip();
    const popup = this.wordPopup;
    this._hoverTip.show(span.getBoundingClientRect(), { word }, (update) => {
      popup?._translate?.(word).then((translation) => translation && update({ translation })).catch(() => {});
      popup?._senses?.(word).then((senses) => senses?.length && update({ senses })).catch(() => {});
    });
  }

  _createWordSpan(text, isExpression, disableHoverPause = false) {
    const span = document.createElement('span');
    span.textContent = text;

    // Se for expressão, adiciona uma classe especial para destaque visual (underline sutil)
    const baseClass = isExpression ? 'lf-word lf-expression' : 'lf-word';
    let cefrClass = '';
    const wordStatus =
      this.savedWords.get(text.toLowerCase()) ||
      (this.knownWords.has(text.toLowerCase()) ? 'known' : null) ||
      (this.ignoredWords?.has(text.toLowerCase()) ? 'ignored' : null);

    // Aplica a cor CEFR apenas se a palavra for nova (não salva e não conhecida)
    if (this.cefrColorsEnabled && !wordStatus && this.cefrList) {
      const level = this.cefrList[text.toLowerCase()];
      if (level && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level)) {
        if (this.cefrTargetLevel === 'all' || this.cefrTargetLevel === level) {
          cefrClass = ' lf-cefr-' + level;
        }
      }
    }
    span.className = baseClass + cefrClass + ' ' + this._wordClass(text);
    // Acessível por teclado (tecla F foca as palavras; Enter abre o card) e por leitor de tela.
    span.setAttribute('role', 'button');
    span.tabIndex = -1;

    let hoverTimeout = null;
    const clearHoverIntent = () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
    };

    span.addEventListener('pointerenter', (e) => {
      // Se for touch, o touchstart ou o click resolvem, não pausa por pointerenter de touch pra não conflitar
      if (e.pointerType === 'touch') return;
      // Debounce de Elite: Só pausa se o usuário realmente quiser interagir (150ms)
      clearHoverIntent();
      hoverTimeout = setTimeout(() => {
        hoverTimeout = null;
        if (!span.isConnected) return;
        if (!disableHoverPause && this.videoElement && !this.videoElement.paused) {
          this.videoElement.pause();
          this._wasPausedByHover = true;
        }

        // #369: com o card aberto, o hover troca a palavra do card (como antes);
        // fechado, mostra só a dica leve — sem IA. O clique abre o card.
        const cardOpen = this.wordPopup?.popup && this.wordPopup.popup.style.display !== 'none';
        if (cardOpen) {
          this.wordPopup.showForWord(text, this.lastText, span.getBoundingClientRect(), this._currentCue);
        } else {
          this._showHoverTip(span, text);
        }
      }, 150);
    });

    span.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'touch') return;
      clearHoverIntent();
      this._hoverTip?.hide();

      // NÃO retoma o vídeo aqui. O vídeo só retoma se o usuário clicar fora do popup ou no X.
      // Isso evita que o vídeo volte a tocar enquanto o usuário move o mouse para o popup.
      const isPopupOpen =
        this.wordPopup && this.wordPopup.popup && this.wordPopup.popup.style.display !== 'none';
      if (this.wordPopup && !isPopupOpen) {
        this.wordPopup.hide();
      }
    });

    const onClickOrTouch = (e) => {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault(); // Evita eventos duplicados no mobile
      clearHoverIntent();
      this._hoverTip?.hide();
      if (!disableHoverPause && this.videoElement && !this.videoElement.paused) {
        this.videoElement.pause();
        this._wasPausedByHover = true;
      }
      if (this.wordPopup) {
        const rect = span.getBoundingClientRect();
        this.wordPopup.showForWord(text, this.lastText, rect, this._currentCue);
      }
    };

    span.addEventListener('click', onClickOrTouch);
    span.addEventListener('touchstart', onClickOrTouch, { passive: false });

    return span;
  }

  _wordClass(word) {
    // Normaliza contracoes: i'm -> i'm, don't -> don't (apostrofo simples)
    const w = word
      .toLowerCase()
      .replace(/\u2019/g, "'")
      .replace(/&#39;/g, "'");
    if (this.ignoredWords?.has(w)) return '';
    if (this.knownWords.has(w)) return 'lf-known';
    // Tenta lookup com a contracao inteira e tambem com a forma base (antes do apostrofo)
    const status = this.savedWords.get(w) || this.savedWords.get(w.split("'")[0]);
    if (status === 'mature') return 'lf-mature';
    if (status === 'review') return 'lf-review';
    if (status === 'learning') return 'lf-learning';
    if (status === 'new') return 'lf-saved';
    return 'lf-new';
  }

  _showAutoPauseIndicator() {
    const container = this._findPlayerContainer() || document.body;

    const indicator = document.createElement('div');
    indicator.style.cssText = `
            position: ${container === document.body ? 'fixed' : 'absolute'};
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(16, 185, 129, 0.95);
            color: white;
            padding: 16px 32px;
            border-radius: 12px;
            font-family: 'Inter', sans-serif;
            font-size: 16px;
            font-weight: 600;
            z-index: 2147483640;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            animation: fadeInOut 1.5s ease-in-out;
        `;
    indicator.textContent = '⏸️ Pausa Automática';

    const style = document.createElement('style');
    style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            }
        `;
    document.head.appendChild(style);
    container.appendChild(indicator);

    setTimeout(() => {
      indicator.remove();
      style.remove();
    }, 1500);
  }

  // ── Renderização ─────────────────────────────────────────────────────────
  _showTranslationFlash(text) {
    const transDiv = this.shadowContainer?.getElementById('lf-trans');
    const btn = this.shadowContainer?.getElementById('lf-translate-btn');
    if (!transDiv) return;

    // Cancela flash anterior
    if (this._flashTimeout) {
      clearTimeout(this._flashTimeout);
      this._flashTimeout = null;
    }

    const transSpan = this.shadowContainer?.getElementById('lf-trans-txt');
    if (transSpan) transSpan.textContent = this._fixEncoding(text);
    transDiv.style.display = 'block';
    transDiv.classList.add('lf-trans-flash');
    if (btn) btn.style.display = 'none';

    // Some após o tempo configurado (flashDuration)
    this._flashTimeout = setTimeout(
      () => {
        transDiv.classList.remove('lf-trans-flash');
        if (this.displayMode === 'native' || this._smartTranslationHidden) {
          transDiv.style.display = 'none';
          if (btn) btn.style.display = 'block';
        }
        this._flashTimeout = null;
      },
      (this.flashDuration || 4) * 1000,
    );
  }

  _updateSubtitleColors() {
    if (this.shadowContainer) {
      if (this.cefrColors) {
        const inner = this.shadowContainer.querySelector('#lf-wrap');
        if (inner) {
          inner.style.setProperty('--cefr-a1', this.cefrColors.A1 || '#4ade80');
          inner.style.setProperty('--cefr-a2', this.cefrColors.A2 || '#38bdf8');
          inner.style.setProperty('--cefr-b1', this.cefrColors.B1 || '#22d3ee');
          inner.style.setProperty('--cefr-b2', this.cefrColors.B2 || '#fbbf24');
          inner.style.setProperty('--cefr-c1', this.cefrColors.C1 || '#fb923c');
          inner.style.setProperty('--cefr-c2', this.cefrColors.C2 || '#a78bfa');
        }
      }

      const words = this.shadowContainer.querySelectorAll('.lf-word');
      words.forEach((el) => {
        const w = el.dataset.word?.toLowerCase();
        if (!w) return;

        el.classList.remove(
          'lf-new',
          'lf-learning',
          'lf-review',
          'lf-mature',
          'lf-known',
          'lf-saved',
        );
        if (this.ignoredWords?.has(w)) {
          // #368: ignorada fica neutra, sem status nem cor CEFR
          [...el.classList].filter((c) => c.startsWith('lf-cefr-')).forEach((c) => el.classList.remove(c));
        } else if (this.knownWords.has(w)) {
          el.classList.add('lf-known');
        } else if (this.savedWords.has(w)) {
          const status = this.savedWords.get(w);
          const classMap = {
            new: 'lf-saved',
            learning: 'lf-learning',
            review: 'lf-review',
            mature: 'lf-mature',
          };
          el.classList.add(classMap[status] || 'lf-saved');
        } else {
          el.classList.add('lf-new');
        }
      });
    }
  }
}
