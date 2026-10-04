// content/subtitles/engine/transcript-tab.js — Aba de transcrição do painel: lista de falas, explicação de linha por IA e tradução da barra lateral.
import { CAPTION_WAIT_MS, highlightMatches, segmentSubtitle, transcriptState } from '../transcript-render.js';
import { escapeHTML } from '../../../utils/html.js';
import { buildLineExplainMessages, createLineExplanationCache, isAuthError, lineExplanationKey, parseLineExplanation, parsePartialLineExplanation } from '../line-explainer.js';
import { detectExpressions } from '../../../utils/expression-detector.js';
import { streamAiRequest } from '../../../utils/ai-stream.js';

export class TranscriptTabMethods {

  _rebuildSubtitleList(container, filter = '') {
    const cues = this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues;
    if (!container) container = document.getElementById('lf-subtitle-list');
    if (!container) {
      if (cues?.length) this._translateAllSidebarCues(cues);
      return;
    }

    const previousScrollTop = typeof container.scrollTop === 'number' ? container.scrollTop : 0;
    container.innerHTML = '';
    container._lastActiveIndex = undefined;
    const status = container.parentElement?.querySelector?.('#lf-panel-search-status');

    if (!cues || cues.length === 0) {
      const state = transcriptState({ cueCount: 0, pendingSince: this._captionsPendingSince });
      if (state === 'loading') {
        container.setAttribute?.('aria-busy', 'true');
        container.innerHTML = Array.from({ length: 6 }, () =>
          '<div class="lf-skeleton-row" aria-hidden="true"><div class="lf-skeleton-bar"></div><div class="lf-skeleton-bar short"></div></div>',
        ).join('');
        if (status) status.textContent = 'Carregando as legendas do vídeo…';
        clearTimeout(this._transcriptWaitTimer);
        const remaining = Math.max(0, CAPTION_WAIT_MS - (Date.now() - this._captionsPendingSince));
        this._transcriptWaitTimer = setTimeout(() => this._rebuildSubtitleList(), remaining + 50);
        return;
      }
      container.removeAttribute?.('aria-busy');
      container.innerHTML =
        '<div style="padding:40px 20px;text-align:center;color:#64748B;font-size:14px;">A faixa de legendas do idioma estudado não está disponível aqui. Confira as legendas originais no player.</div>';
      if (status) status.textContent = 'Legenda indisponível neste vídeo.';
      return;
    }
    container.removeAttribute?.('aria-busy');

    const showTrans = document.getElementById('lf-show-translation')?.checked ?? true;
    if (showTrans) this._translateAllSidebarCues(cues);

    const normalizedFilter = String(filter || '').trim();
    const needle = normalizedFilter.toLowerCase();
    let visibleCount = 0;
    cues.forEach((cue, idx) => {
      const cleanText = this._cleanSubtitleText ? this._cleanSubtitleText(cue.text) : (cue.text || '');
      if (!cleanText) return;
      const cleanTrans = cue.translatedText && this._cleanSubtitleText ? this._cleanSubtitleText(cue.translatedText) : (cue.translatedText || '');

      const matchesFilter =
        !needle ||
        cleanText.toLowerCase().includes(needle) ||
        (cleanTrans && cleanTrans.toLowerCase().includes(needle));

      if (!matchesFilter) return;
      visibleCount += 1;

      const startTime = cue.start;
      const time = this._formatTime(startTime);

      // Sem role no item: a frase é lida como texto e as ações são botões
      // irmãos (tocar / repetir), nunca aninhados.
      const item = document.createElement('div');
      item.className = 'lf-subtitle-item';
      item.dataset.index = idx;
      item.style.cssText = `
                padding: 12px 16px;
                cursor: pointer;
                position: relative;
                display: flex;
                flex-direction: column;
                gap: 4px;
            `;

      item.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
                    <button type="button" class="lf-time lf-sub-time lf-play-cue" aria-label="Tocar a partir de ${time}">${time}</button>
                    <p class="lf-sub-text" style="flex:1;font-size:15px;line-height:1.4;font-weight:700;"></p>
                    <div class="lf-cue-actions">
                        <button type="button" class="lf-explain-cue" aria-expanded="false" aria-controls="lf-explain-${idx}" aria-label="Explicar a fala em ${time}">Explicar</button>
                        <button type="button" class="lf-loop-cue" title="Repetir frase" aria-label="Repetir frase em ${time}" style="background:transparent;border:none;color:inherit;cursor:pointer;font-size:14px;padding:0 2px;">🔁</button>
                    </div>
                </div>
                <p class="lf-translation-text lf-trans-text" style="margin:0;font-size:13px;padding-left:48px;font-weight:600;display:${showTrans ? 'block' : 'none'};">
                    ${cleanTrans ? highlightMatches(cleanTrans, normalizedFilter) : '<span style="opacity:0.6;font-style:italic;">traduzindo...</span>'}
                </p>
                <div class="lf-line-explain" id="lf-explain-${idx}" aria-live="polite" hidden></div>
            `;

      const textEl = item.querySelector?.('.lf-sub-text');
      if (textEl) this._renderTranscriptText(textEl, cleanText, normalizedFilter);

      const playCue = () => {
        if (this.videoElement) {
          this.videoElement.currentTime = startTime;
          this.videoElement.play();
        }
      };
      item.onclick = (e) => {
        if (e.target.closest?.('.lf-line-explain')) return;
        const explainBtn = e.target.closest?.('.lf-explain-cue');
        if (explainBtn) {
          this._explainLine(idx, cue, item, explainBtn);
          return;
        }
        if (e.target.closest?.('.lf-loop-cue')) {
          this._toggleCueLoop(idx, e.target);
          return;
        }
        const word = e.target.closest?.('.lf-word');
        if (word) {
          e.stopPropagation();
          this._openTranscriptWord(word, cleanText, cue);
          return;
        }
        playCue();
      };
      container.appendChild(item);
    });

    if (status) {
      status.textContent = normalizedFilter
        ? `${visibleCount} ${visibleCount === 1 ? 'ocorrência encontrada' : 'ocorrências encontradas'}`
        : `${visibleCount} ${visibleCount === 1 ? 'trecho disponível' : 'trechos disponíveis'}`;
    }
    if (normalizedFilter && visibleCount === 0) {
      container.innerHTML = `<div style="padding:32px 20px;text-align:center;color:#64748B;font-size:14px;">Nenhuma fala com "${escapeHTML(normalizedFilter)}".</div>`;
    }

    this._updateSubtitlePanelHighlight();
    this._syncLoopButtons();
    if (previousScrollTop > 0 && !container._userScrolling) {
      container.scrollTop = previousScrollTop;
    }
  }

  // "Explicar esta fala": IA com a fala + vizinhas, pela mesma rota do tutor
  // (respeita chave própria ou proxy). Resultado fica em cache local por
  // vídeo + início da fala + idioma; segundo clique recolhe.
  async _explainLine(idx, cue, item, button) {
    const region = item.querySelector?.('.lf-line-explain');
    if (!region) return;
    if (button.getAttribute('aria-expanded') === 'true' && !region.dataset.error) {
      button.setAttribute('aria-expanded', 'false');
      region.hidden = true;
      return;
    }
    button.setAttribute('aria-expanded', 'true');
    region.hidden = false;
    delete region.dataset.error;

    const cues = this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues;
    const clean = (c) => (c ? (this._cleanSubtitleText ? this._cleanSubtitleText(c.text) : c.text || '') : '');
    const line = clean(cue);
    const key = lineExplanationKey({
      videoId: new URLSearchParams(window.location.search).get('v') || window.location.pathname,
      start: cue.start,
      targetLang: this.targetLang,
    });
    this._lineExplainCache ||= createLineExplanationCache({
      get: (k) => chrome.storage.local.get(k),
      set: (value) => chrome.storage.local.set(value),
    });

    const cached = await this._lineExplainCache.get(key);
    if (cached) {
      this._renderLineExplanation(region, cached);
      return;
    }

    region.setAttribute('aria-busy', 'true');
    region.innerHTML = '<p class="lf-line-explain-status">Explicando a fala com o contexto…</p><div class="lf-skeleton-bar" aria-hidden="true"></div><div class="lf-skeleton-bar short" aria-hidden="true"></div>';
    button.disabled = true;
    const messages = buildLineExplainMessages({
      previous: clean(cues[idx - 1]),
      line,
      next: clean(cues[idx + 1]),
      expressions: detectExpressions(line),
      targetLang: this.targetLang,
    });
    // Streaming: tradução e sentido aparecem enquanto a IA escreve (o JSON
    // parcial é lido campo a campo); fechar a explicação cancela o pedido.
    const response = await streamAiRequest(
      { action: 'ai_chat', messages, options: { temperature: 0.3, max_tokens: 600 } },
      {
        isStale: () => !region.isConnected || region.hidden,
        onPartial: (partial) => {
          const draft = parsePartialLineExplanation(partial.text);
          if (!draft.translation && !draft.meaning) return;
          this._renderLineExplanation(region, draft, { streaming: true });
        },
      },
    );
    button.disabled = false;
    region.removeAttribute('aria-busy');
    if (!region.isConnected || region.hidden) return;

    const parsed = parseLineExplanation(response?.content);
    if (parsed) {
      await this._lineExplainCache.set(key, parsed);
      this._renderLineExplanation(region, parsed);
      return;
    }
    region.dataset.error = '1';
    if (isAuthError(response?.error)) {
      region.innerHTML = '<p class="lf-line-explain-error">Entre na sua conta do LinguaFlow (ou configure sua chave de IA) para usar a explicação.</p>';
      return;
    }
    region.innerHTML = '<p class="lf-line-explain-error">Não foi possível explicar esta fala agora.</p><button type="button" class="lf-line-explain-retry">Tentar de novo</button>';
    const retry = region.querySelector('.lf-line-explain-retry');
    if (retry) {
      retry.onclick = (event) => {
        event.stopPropagation();
        this._explainLine(idx, cue, item, button);
      };
    }
  }

  _renderLineExplanation(region, data, { streaming = false } = {}) {
    delete region.dataset.error;
    const items = (data.expressions || [])
      .map((e) => `<li><strong>${escapeHTML(e.text)}</strong>: ${escapeHTML(e.meaning)}</li>`)
      .join('');
    region.innerHTML = `
      ${data.translation ? `<p><span class="lf-line-explain-label">Tradução natural</span> ${escapeHTML(data.translation)}</p>` : ''}
      ${data.meaning ? `<p><span class="lf-line-explain-label">Sentido</span> ${escapeHTML(data.meaning)}</p>` : ''}
      ${items ? `<ul>${items}</ul>` : ''}
      <p class="lf-line-explain-note">${streaming ? 'Escrevendo…' : 'Explicação gerada por IA; confira no contexto do vídeo.'}</p>
    `;
  }

  // Na busca, a frase vira texto com as ocorrências marcadas; sem busca, cada
  // palavra/expressão é clicável (popup de palavra) com a cor do seu status.
  _renderTranscriptText(el, text, filter) {
    if (filter) {
      el.innerHTML = highlightMatches(text, filter);
      return;
    }
    const frag = document.createDocumentFragment();
    for (const segment of segmentSubtitle(text, this._getMaxExpressionWords())) {
      if (!segment.isWord) {
        frag.appendChild(document.createTextNode(segment.text));
        continue;
      }
      const span = document.createElement('span');
      span.textContent = segment.text;
      span.className = segment.expression
        ? 'lf-word lf-expression'
        : `lf-word ${this._wordClass(segment.text)}`;
      if (segment.expression) this._decorateExpressionSpan(span, segment);
      frag.appendChild(span);
    }
    el.appendChild(frag);
  }

  _openTranscriptWord(wordEl, sentence, cue) {
    if (!this.wordPopup) return;
    this.wordPopup.showForWord(wordEl.textContent, sentence, wordEl.getBoundingClientRect(), cue);
  }

  _translateAllSidebarCues(cues) {
    const targetLang = this.targetLang;
    const sourceLang = this.sourceLang || 'auto';
    const pending = cues.filter((cue) => cue?.text && (!cue.translatedText || cue._transLang !== targetLang));
    if (!pending.length) return Promise.resolve([]);
    const navigation = this._navigationSnapshot();
    const key = `${navigation.epoch}:${targetLang}:${pending.length}:${pending[0]?.start}:${pending[pending.length - 1]?.end}`;
    if (this._sidebarTranslationPromise && this._sidebarTranslationKey === key) {
      return this._sidebarTranslationPromise;
    }

    this._sidebarTranslationKey = key;
    const applyResult = (result, index) => {
      if (!this._isNavigationCurrent(navigation) || this.targetLang !== targetLang) return;
      const cue = pending[index];
      if (!cue || !cues.includes(cue) || !result?.translation) return;
      const cleanTrans = this._cleanSubtitleText ? this._cleanSubtitleText(result.translation) : result.translation;
      cue.translatedText = cleanTrans;
      cue._transLang = targetLang;
      const cueIndex = cues.indexOf(cue);
      const item = document.querySelector(`.lf-subtitle-item[data-index="${cueIndex}"] .lf-translation-text`);
      if (item) item.textContent = cleanTrans;
      if (this._currentCue === cue && this.shadowContainer) {
        this.renderDual(cue.text, cleanTrans);
      }
    };

    this._sidebarTranslationPromise = import('../../../utils/translator.js')
      .then(({ translator }) => translator.translateBatch(
        pending.map((cue) => cue.text),
        sourceLang,
        targetLang,
        Math.min(12, Math.max(4, Number(this.translationSpeed) || 8)),
        applyResult,
      ))
      .then((results) => {
        results.forEach(applyResult);
        return results;
      })
      .catch((error) => {
        if (this._isNavigationCurrent(navigation)) {
          console.warn('[LinguaFlow] Falha ao antecipar traduções da barra lateral:', error);
        }
        return [];
      })
      .finally(() => {
        if (this._sidebarTranslationKey === key) {
          this._sidebarTranslationPromise = null;
          this._sidebarTranslationKey = '';
        }
      });
    return this._sidebarTranslationPromise;
  }
}
