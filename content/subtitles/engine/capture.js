// content/subtitles/engine/capture.js — Obtenção das legendas: YouTube (XHR/VTT), DOM da plataforma, loop de sincronização, correção de encoding e legendas nativas.
import { parseVTT } from '../vtt-parser.js';
import { attachTranslationsByTime, captionLines, groupCaptionEvents } from '../../../utils/caption-grouping.js';
import { closeDomCue, crossedCueEnd, findActiveCueIndex, recordDomCue } from '../active-cue.js';
import { normalizeSubtitleCasing } from '../../../utils/caption-casing.js';
import { CAPTION_CONFLICT_NOTICE, hasLanguageReactor } from '../caption-conflict.js';
import { MAX_CC_BUTTON_SELECTOR, pickSubtitleOption, readMenuItems } from '../hbo-native-captions.js';

export class CaptureMethods {

  // Fase 5 (§4d.10): _renderVideoWordPrep removida — 80 linhas cujo container
  // #lf-video-words nunca existiu em lugar nenhum do DOM.

  // Removido _formatTime duplicado e assíncrono (usando a versão síncrona no fim do arquivo)

  // ── VTT Parser (HBO Max) — delegado para parseVTT ────────────────────────
  _parseVTT(vttStr) {
    return parseVTT(vttStr, this._cleanSubtitleText ? (text) => this._cleanSubtitleText(text) : null);
  }

  async _fetchYoutubeSubtitles(navigation = this._navigationSnapshot()) {
    if (!this._isNavigationCurrent(navigation)) return;
    if (this.cues.length > 0) return;
    if (!globalThis.chrome?.runtime?.id || !globalThis.chrome?.storage?.local?.get) return;

    try {
      const { lastYoutubeSubtitleUrls } = await chrome.storage.local.get('lastYoutubeSubtitleUrls');
      if (!this._isNavigationCurrent(navigation)) return;
      const urls = lastYoutubeSubtitleUrls ?? [];

      const videoId = new URL(navigation.url).searchParams.get('v');
      if (!videoId) return;

      // Filtra URLs que pertencem ao vídeo atual
      let matchingUrls = urls
        .filter((r) => {
          try {
            return new URL(r).searchParams.get('v') === videoId;
          } catch {
            return false;
          }
        })
        .reverse();

      if (matchingUrls.length === 0) {
        console.debug('[LinguaFlow] Nenhuma URL de legenda encontrada para o vídeo', videoId);
        return;
      }

      // Prioriza URLs no idioma original do vídeo (sourceLang) para evitar pegar
      // traduções automáticas (ex: legenda PT quando o vídeo é em inglês)
      const srcLang = this.sourceLang || 'en';
      const preferredUrls = matchingUrls.filter((r) => {
        try {
          const u = new URL(r);
          const lang = u.searchParams.get('lang') || u.searchParams.get('tlang') || '';
          // Unknown and translated tracks are not evidence of the target language.
          return !u.searchParams.has('tlang') && lang.toLowerCase().split('-')[0] === srcLang.toLowerCase().split('-')[0];
        } catch {
          return false;
        }
      });

      // Sanitiza URLs para nunca solicitar com tlang (tradução automática)
      const sanitizeUrl = (r) => {
        try {
          const u = new URL(r);
          u.searchParams.delete('tlang');
          u.searchParams.delete('t');
          u.searchParams.delete('range');
          u.searchParams.delete('spv');
          u.searchParams.set('fmt', 'json3');
          return u.toString();
        } catch {
          return r;
        }
      };

      // Never fetch a cached track from a different language or a translated URL.
      const urlsToTry = Array.from(new Set(preferredUrls.slice(0, 1).map(sanitizeUrl)));
      console.debug(`[LinguaFlow] Legendas: ${urlsToTry.length} candidatas (lang=${srcLang})`);

      for (const url of urlsToTry) {
        if (!this._isNavigationCurrent(navigation)) return;
        const attemptKey = `${navigation.epoch}:${url}`;
        if (this._ytCachedAttemptKey === attemptKey) return;
        this._ytCachedAttemptKey = attemptKey;
        console.debug('[LinguaFlow] Tentando faixa original armazenada');
        const response = await fetch(new URL(url).toString(), { signal: navigation.signal });
        if (!this._isNavigationCurrent(navigation)) return;
        if (!response.ok) {
          console.warn('[LinguaFlow] caption_cached_track_unavailable', { status: Number(response.status) || 0 });
          continue;
        }

        const text = await response.text();
        if (!this._isNavigationCurrent(navigation)) return;
        let data = null;

        if (text.startsWith('{')) {
          try {
            data = JSON.parse(text);
          } catch {}
        }

        if (data && data.events) {
          const cues = this._processYtSub(data);
          if (cues && cues.length > 0) {
            if (!this._isNavigationCurrent(navigation)) return;
            this.cues = cues;
            this._ytFullCueVideoId = videoId;
            this._syncYouTubeNativeCaptions();
            this.xhrCues = cues;
            this.usingXhr = true;
            this._rebuildSubtitleList();
            this._rebuildWordsList();
            console.debug(
              '[LinguaFlow] Legendas carregadas com sucesso (' + cues.length + ' frases)',
            );
            return;
          }
        }
      }
    } catch (e) {
      if (e?.name === 'AbortError' || !this._isNavigationCurrent(navigation)) return;
      if (!globalThis.chrome?.runtime?.id || /Extension context invalidated/i.test(e?.message || '')) return;
      console.error('[LinguaFlow] Erro ao recuperar legendas:', e);
    }
  }

  // ── processYtSub — cópia EXATA do V5 ──────────────────────────────────────
  // lines: faixa traduzida fica linha a linha para ser distribuída pelos
  // trechos originais (#364), que podem juntar linhas em pontos diferentes.
  _processYtSub(data, { lines = false } = {}) {
    const round = (seconds) => Number.isFinite(seconds) ? Math.round(seconds * 100) / 100 : null;
    const raw = (lines ? captionLines : groupCaptionEvents)(data?.events).map((cue) => ({
      ...cue,
      text: this._cleanSubtitleText(cue.text),
    })).filter((cue) => cue.text && cue.end > cue.start);
    const result = raw
      .map((e) => {
        const a = round(e.start),
          g = round(e.end - e.start),
          m = round(e.end);
        if (a == null || g == null || m == null) return null;
        return {
          startTime: a,
          duration: g,
          finishTime: m,
          id: `subtitle_${a}_${m}`,
          sentence: this._cleanSubtitleText(e.text),
          start: a,
          end: m,
          text: this._cleanSubtitleText(e.text),
        };
      })
      .filter((e) => e != null);
    console.debug('[LinguaFlow] Final cues:', result.length);
    return result;
  }

  // ── Aguarda elemento <video> ─────────────────────────────────────────────
  _waitForVideo() {
    // Cancela busca anterior se houver
    if (this._videoWaitInterval) clearInterval(this._videoWaitInterval);

    this._videoWaitInterval = setInterval(() => {
      const vid = document.querySelector('video');
      if (!vid) return;

      this.videoElement = vid;
      clearInterval(this._videoWaitInterval);
      this._videoWaitInterval = null;

      if (this.platform === 'youtube' || this.platform === 'max') {
        // INJEÇÃO CRÍTICA: Cria o DOM das legendas antes de iniciar o loop
        this._injectSubtitleUI()
          .then(() => {
            console.debug('[LinguaFlow] ✅ UI das legendas injetada com sucesso.');
            this._startSyncLoop();
          })
          .catch((e) => {
            console.error('[LinguaFlow] ❌ Erro ao injetar UI das legendas:', e);
          });
      }

      // Injeta botões e controles
      this._injectYouTubeControls();
      this._syncNativeCCButton();
      setTimeout(() => this._syncNativeCCButton(), 800);
      // YouTube reuses the same <video> across SPA navigations; stacked play
      // listeners clicked CC several times per play and could switch it off.
      if (this._boundVideoElement !== vid) {
        this._boundVideoElement = vid;
        vid.addEventListener('play', () => {
          this._injectYouTubeControls();
          this._syncNativeCCButton();
          this._wasPausedByHover = false;
        });
        vid.addEventListener('seeking', () => {
          this.lastText = '';
          this._lastFoundIdx = -1; // Reset do índice otimizado
          this._lastAutoPausedEndTime = -1;
        });
      }

      // Se a legenda nasceu no body (player ainda não existia), leva para dentro
      // do player agora que o vídeo está pronto. Vale também para o YouTube.
      if (this.platform !== 'max') {
        setTimeout(() => {
          if (!this._disposed) this._moveHostIntoPlayer();
        }, 1500);
      }
    }, 250);
  }

  // ── Captura ──────────────────────────────────────────────────────────────
  startCapture() {
    if (this.platform === 'youtube') {
      // A injeção do hook agora é feita pelo injector.js
      this._fetchYoutubeSubtitles(); // Tenta carregar do cache imediatamente
    }
    // V5: Inicia o sync loop para todas as plataformas (exceto YouTube/Max que usam o novo motor)
    if (this.platform !== 'youtube' && this.platform !== 'max') {
      this._ready = true;
      this._syncLoop = (now, metadata) => {
        const v = this.videoElement || document.querySelector('video');
        const t =
          (metadata ? metadata.mediaTime : v ? v.currentTime : 0) +
          (this.translationAnticipation || 0);
        // Loop legado unificado com o motor de elite
        const cuesToSearch = this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues;
        const idx = findActiveCueIndex(cuesToSearch, t);
        const cue = idx !== -1 ? cuesToSearch[idx] : null;

        if (cue && cue !== this._currentCue) {
          this.lastText = cue.text;
          this.onSubtitle(cue);
        } else if (!cue && (this.lastText !== '' || this._currentCue)) {
          this._currentCue = null;
          this.lastText = '';
          this.renderDual('', '');
        }

        if (this._ready) {
          if (v && v.requestVideoFrameCallback) {
            this._syncTimer = v.requestVideoFrameCallback(this._syncLoop);
          } else {
            this._syncTimer = requestAnimationFrame(this._syncLoop);
          }
        }
      };

      const v = this.videoElement || document.querySelector('video');
      if (v && v.requestVideoFrameCallback) {
        this._syncTimer = v.requestVideoFrameCallback(this._syncLoop);
      } else {
        this._syncTimer = requestAnimationFrame(this._syncLoop);
      }
      console.debug('[LinguaFlow] Sync loop legado iniciado com precisão de frame');
    } else {
      console.debug('[LinguaFlow] Utilizando novo motor de sincronização');
    }
  }

  // A injeção do youtube-hook.js agora é feita pelo injector.js em document_start

  async _processYouTubeRawSubtitles(url, raw, navigation = this._navigationSnapshot()) {
    if (!this._isNavigationCurrent(navigation)) return;
    let currentVideoId;
    try {
      const cueVideoId = new URL(url).searchParams.get('v');
      currentVideoId = new URL(navigation.url).searchParams.get('v');
      if (cueVideoId && currentVideoId && cueVideoId !== currentVideoId) return;
    } catch { return; }
    if (!raw || raw.length < 10) return;

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return;
    }

    const requestedLanguage = parsedUrl.searchParams.get('lang');
    if (!requestedLanguage || requestedLanguage.toLowerCase().split('-')[0] !== String(this.sourceLang || 'en').toLowerCase().split('-')[0]) return;
    const hasTlang = parsedUrl.searchParams.has('tlang');
    if (hasTlang) {
      // Se já possuímos legendas no idioma original, NÃO sobrescrevemos e nem precisamos buscar de novo; apenas enriquecemos com a tradução
      if (this.cues && this.cues.length > 0) {
        let transCues = [];
        try {
          if (raw.startsWith('{')) transCues = this._processYtSub(JSON.parse(raw), { lines: true });
          else if (raw.includes('WEBVTT') || raw.includes('-->')) transCues = this._parseVTT(raw);
        } catch {}
        if (Array.isArray(transCues) && transCues.length > 0) {
          attachTranslationsByTime(this.cues, transCues);
        }
        return;
      }

      // One bounded original-track request per navigation; translated segments
      // may arrive many times and 403/429 responses must not trigger retries.
      const originKey = `${navigation.epoch}:${currentVideoId}:${requestedLanguage}`;
      if (this._ytOriginRequestKey === originKey) return;
      this._ytOriginRequestKey = originKey;
      try {
        const origUrl = new URL(url);
        for (const key of ['tlang', 't', 'range', 'spv']) origUrl.searchParams.delete(key);
        origUrl.searchParams.set('fmt', 'json3');
        const origResponse = await fetch(origUrl.toString(), { signal: navigation.signal });
        if (!this._isNavigationCurrent(navigation)) return;
        if (origResponse.ok) {
          const origText = await origResponse.text();
          if (!this._isNavigationCurrent(navigation)) return;
          if (origText && origText.length > 10) {
            let origCues = [];
            if (origText.startsWith('{')) {
              try { origCues = this._processYtSub(JSON.parse(origText)); } catch {}
            } else if (origText.includes('WEBVTT') || origText.includes('-->')) {
              origCues = this._parseVTT(origText);
            }

            if (Array.isArray(origCues) && origCues.length > 0 && this._isNavigationCurrent(navigation)) {
              let transCues = [];
              try {
                if (raw.startsWith('{')) transCues = this._processYtSub(JSON.parse(raw), { lines: true });
                else if (raw.includes('WEBVTT') || raw.includes('-->')) transCues = this._parseVTT(raw);
              } catch {}

              if (Array.isArray(transCues) && transCues.length > 0) {
                attachTranslationsByTime(origCues, transCues);
              }

              this.cues = origCues;
              this._ytFullCueVideoId = currentVideoId;
              this._syncYouTubeNativeCaptions();
              this.xhrCues = origCues;
              this.usingXhr = true;
              this._rebuildSubtitleList();
              this._rebuildWordsList();

              chrome?.storage?.local?.get?.('lastYoutubeSubtitleUrls', (res) => {
                let urls = res?.lastYoutubeSubtitleUrls || [];
                const cleanUrl = origUrl.toString();
                if (!urls.includes(cleanUrl)) {
                  urls.push(cleanUrl);
                  if (urls.length > 10) urls.shift();
                  chrome?.storage?.local?.set?.({ lastYoutubeSubtitleUrls: urls });
                }
              });

              return;
            }
          }
        }
      } catch (e) {
        if (e?.name === 'AbortError' || !this._isNavigationCurrent(navigation)) return;
        console.warn('[LinguaFlow] Falha ao recuperar legenda original a partir do tlang:', e);
      }
      return;
    }

    let cues = [];
    if (raw.startsWith('{')) {
      try {
        cues = this._processYtSub(JSON.parse(raw));
      } catch (e) {}
    } else if (raw.includes('WEBVTT')) {
      cues = this._parseVTT(raw);
    } else if (raw.includes('-->')) {
      cues = this._parseVTT(raw); // VTT/SRT unificado
    }

    if (cues.length > 0 && this._isNavigationCurrent(navigation)) {
      const existing = this.cues || [];
      const incomingIsSegment = ['t', 'range', 'spv'].some((param) => parsedUrl.searchParams.has(param));
      if (existing.length > 0) {
        const shouldMerge = incomingIsSegment;
        if (shouldMerge) {
          const merged = new Map(existing.map((cue) => [Math.round(cue.start * 100), cue]));
          cues.forEach((cue) => {
            const key = Math.round(cue.start * 100);
            const previous = merged.get(key);
            if (previous?.translatedText && !cue.translatedText) {
              cue.translatedText = previous.translatedText;
              cue._transLang = previous._transLang;
            }
            if (!previous || cue.text.length >= previous.text.length || cue.end - cue.start > previous.end - previous.start) merged.set(key, cue);
          });
          cues = [...merged.values()].sort((a, b) => a.start - b.start);
          if (incomingIsSegment) {
            const previousCues = cues;
            cues = groupCaptionEvents(previousCues.map((item) => ({
              tStartMs: Math.round(item.start * 1000),
              dDurationMs: Math.round((item.end - item.start) * 1000),
              segs: [{ utf8: item.text }],
            }))).map((item) => {
              const prior = previousCues.find((cue) => cue.start === item.start && cue.text === item.text);
              return {
                ...item, id: `subtitle_${item.start}_${item.end}`,
                sentence: item.text, startTime: item.start,
                duration: item.end - item.start, finishTime: item.end,
                ...(prior?.translatedText ? { translatedText:prior.translatedText, _transLang:prior._transLang } : {}),
              };
            });
          }
        } else {
          const prevMap = new Map(existing.map((cue) => [Math.round(cue.start * 100), cue]));
          cues.forEach((cue) => {
            const key = Math.round(cue.start * 100);
            const previous = prevMap.get(key);
            if (previous?.translatedText && !cue.translatedText) {
              cue.translatedText = previous.translatedText;
              cue._transLang = previous._transLang;
            }
          });
        }
      }
      this.cues = cues;
      if (!incomingIsSegment) this._ytFullCueVideoId = currentVideoId;
      this._syncYouTubeNativeCaptions();
      this.xhrCues = cues; // Unifica para garantir que o sync loop e sidebar vejam o mesmo
      this.usingXhr = true;
      this._rebuildSubtitleList(); // Atualiza painel lateral IMEDIATAMENTE
      this._rebuildWordsList();
      // this.toggleSubtitles(); // Removido: Não forçar ativação automática

      // Persistência para F5 — armazena apenas URL limpa (sem tlang)
      const cleanUrl = parsedUrl.searchParams.has('tlang')
        ? (() => { const u = new URL(url); u.searchParams.delete('tlang'); return u.toString(); })()
        : url;

      chrome?.storage?.local?.get?.('lastYoutubeSubtitleUrls', (res) => {
        let urls = res?.lastYoutubeSubtitleUrls || [];
        if (!urls.includes(cleanUrl)) {
          urls.push(cleanUrl);
          if (urls.length > 10) urls.shift();
          chrome?.storage?.local?.set?.({ lastYoutubeSubtitleUrls: urls });
        }
      });

    }
  }

  // ── Atualização via DOM (Netflix/etc) ─────────────────────────────────────
  async _onDomSubtitleUpdate(text, timeSec) {
    const navigation = this._navigationSnapshot();
    const subtitleEpoch = ++this._domSubtitleEpoch;
    if (!this._isNavigationCurrent(navigation)) return;
    if (!text) {
      closeDomCue(this.cues, timeSec);
      this.renderDual('', '');
      return;
    }

    if (this.isActivated === false) return;
    const cue = recordDomCue(this.cues, text, timeSec);
    this._currentCue = cue;
    if (cue.translatedText) {
      this.renderDual(text, cue.translatedText);
      return;
    }

    // Mostra original imediatamente
    this.renderDual(text, '');

    // Traduz INSTANTANEAMENTE com detecção automática de idioma
    try {
      const { translator } = await import('../../../utils/translator.js');
      if (!this._isNavigationCurrent(navigation) || subtitleEpoch !== this._domSubtitleEpoch) return;
      const result = await translator.translate(text, 'auto', this.targetLang);
      if (!this._isNavigationCurrent(navigation)
        || subtitleEpoch !== this._domSubtitleEpoch
        || !this.cues.includes(cue)) return;
      cue.translatedText = result.translation;
      this.renderDual(text, result.translation);

      // Log de performance (apenas em dev)
      if (result.source !== 'memory_cache') {
        console.debug(
          `[LinguaFlow] Tradução: ${result.source} (${result.cached ? 'cached' : 'new'})`,
        );
      }
    } catch (e) {
      if (!this._isNavigationCurrent(navigation) || subtitleEpoch !== this._domSubtitleEpoch) return;
      console.error('[LinguaFlow] Erro na tradução:', e);
      this.renderDual(text, '');
    }
  }

  // ── Sync Loop (YouTube + HBO, RAF/rVFC) ───────────────────────────────────────
  _startSyncLoop() {
    this._stopSyncLoop();

    let lastSyncPulse = Date.now();
    let lastVideoTime = -1;
    let playbackTime = Number.NaN;

    const loop = (now, metadata) => {
      try {
        const v = this.videoElement || document.querySelector('video');
        if (!v) {
          this._continueLoop(loop, v);
          return;
        }

        lastSyncPulse = Date.now();
        lastVideoTime = v.currentTime;

        // SINCRONIA ROBUSTA
        let t = v.currentTime;
        const previousTime = playbackTime;
        playbackTime = t;

        // Verificação de Popup: Se estiver aberto e não estiver fechando, pausa o vídeo e mantém a legenda
        const isPopupOpen =
          this.wordPopup &&
          this.wordPopup.popup &&
          this.wordPopup.popup.style.display !== 'none' &&
          !this.wordPopup._isHiding;
        if (isPopupOpen) {
          if (!v.paused) v.pause();
          this._continueLoop(loop, v);
          return;
        }

        const cuesToSearch = this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues;

        // Netflix / DOM Fallback
        if (this.platform === 'netflix' && this.isActivated) {
          const netflixContainer = document.querySelector('.player-timedtext');
          if (netflixContainer) {
            netflixContainer.style.opacity = '0'; // Oculta nativo
            const text = netflixContainer.innerText.trim();
            if (text && text !== this.lastText) {
              this.lastText = text;
              this._onDomSubtitleUpdate(text, t);
            } else if (!text && this.lastText) {
              this.lastText = '';
              closeDomCue(this.cues, t);
              this.renderDual('', '');
            }
          }
        } else if (cuesToSearch && cuesToSearch.length > 0) {
          // Otimização: Se o vídeo está pausado, não precisamos filtrar cues repetidamente
          if (v.paused && this.lastText !== '') {
            this._continueLoop(loop, v);
            return;
          }

          // Sincronia com Legenda Nativa (YouTube)
          if (this.platform === 'youtube') this._syncYouTubeNativeCaptions();

          // Auto-Pause (Shadowing Mode): avaliada na fala exibida ANTES de trocar
          // de cue, para pausar mesmo quando a próxima já começou ou o frame
          // pulou a janela de tolerância. Só pausa uma vez por fim de cue.
          const shownCue = this._currentCue;
          if (
            this.autoPause &&
            !v.paused &&
            shownCue &&
            this._lastAutoPausedEndTime !== shownCue.end &&
            crossedCueEnd(shownCue, previousTime, t)
          ) {
            v.pause();
            this._showAutoPauseIndicator();
            this._lastAutoPausedEndTime = shownCue.end;
            this._continueLoop(loop, v);
            return;
          }

          const activeIdx = findActiveCueIndex(cuesToSearch, t);
          const cue = activeIdx >= 0 ? cuesToSearch[activeIdx] : null;

          if (cue && cue !== this._currentCue) {
            this._lastAutoPausedEndTime = -1;
            this.lastText = cue.text;
            this.onSubtitle(cue);
          } else if (!cue && (this.lastText !== '' || this._currentCue)) {
            // #361: o seek zera lastText; sem checar _currentCue, pular para um
            // trecho sem fala deixava a legenda anterior presa na tela.
            this._lastAutoPausedEndTime = -1;
            this.lastText = '';
            this._currentCue = null;
            this.renderDual('', '');
          }
        }

        this._continueLoop(loop, v);
      } catch (err) {
        if (
          !chrome?.runtime?.id ||
          !chrome?.runtime?.sendMessage ||
          (err.message && (
            err.message.includes('Extension context invalidated') ||
            err.message.includes("reading 'sendMessage'") ||
            err.message.includes("reading 'local'")
          ))
        ) {
          console.warn(
            '[LinguaFlow] Contexto da extensão invalidado (atualização). Loop abortado de forma limpa.',
          );
          this._stopSyncLoop();
          return; // Aborta sem encher o log de erros
        }
        console.error('[LinguaFlow] Erro crítico no sync loop:', err);
        // Tenta continuar o loop após um pequeno respiro para não travar a aba se for erro contínuo
        setTimeout(() => this._continueLoop(loop, this.videoElement), 100);
      }
    };

    // Watchdog Timer: Se o loop morrer (e a página estiver visível e o vídeo carregado), reinicia
    this._watchdogInterval = setInterval(() => {
      if (document.hidden) {
        // Em background, rVFC/RAF são pausados nativamente pelo navegador para poupar bateria
        return;
      }
      const v = this.videoElement || document.querySelector('video');
      // Só reinicia se o vídeo não estiver pausado, se já tiver dados carregados (readyState >= 3)
      // e se o último pulso de sincronia ocorreu há mais de 2500ms.
      if (v && !v.paused && v.readyState >= 3 && Date.now() - lastSyncPulse > 2500) {
        // Verifica se o vídeo realmente avançou no tempo (evita falsos positivos em "buffering fantasma" do YT)
        if (v.currentTime !== lastVideoTime) {
          console.warn(
            '[LinguaFlow] Watchdog: Sync loop congelado detectado (vídeo avançou). Reiniciando...',
          );
          this._startSyncLoop();
        } else {
          // Vídeo não avançou, loop parou naturalmente por falta de novos quadros.
          // Atualizamos o pulso para não re-verificar imediatamente.
          lastSyncPulse = Date.now();
        }
      }
    }, 3000);

    this._continueLoop(loop, this.videoElement || document.querySelector('video'));
  }

  _cleanSubtitleText(text) {
    if (!text) return '';
    const cleaned = text
      .replace(/\[.*?\]/g, '') // Remove [Music], [Laughter]
      .replace(/\(.*?\)/g, '') // Remove (shouting), (music)
      .replace(/\*.*?\*/g, '') // Remove *music*, *applause*
      .replace(/[♪♫♬♩]/g, '') // Remove notas musicais
      // §4j.1/§4l.2: entidades HTML decodificadas AQUI, na fonte da cue —
      // antes só a legenda na tela era consertada (_makeClickable) e o card
      // recebia "don&#39;t" cru em context_sentence, contaminando frente,
      // builder, ditado e TTS. Numéricas (dec/hex) + as nomeadas comuns.
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&raquo;/g, '»')
      .replace(/&laquo;/g, '«')
      .replace(/&amp;/g, '&')
      // Remove pontas de flechas, marcadores de orador e chevrons (>>, >>>, <<, >, », etc.)
      .replace(/[»«›‹▶►◄◀➔→➤]/g, ' ')
      .replace(/[><]{2,}/g, ' ')
      .replace(/(?:^|\s)[><]+(?:\s|$)/g, ' ')
      .replace(/^[><]+\s*/, '')
      .replace(/\s*[><]+$/, '')
      .replace(/\s+/g, ' ') // Unifica espaços
      .trim();

    return normalizeSubtitleCasing(cleaned);
  }

  _continueLoop(loop, v) {
    if (v && v.requestVideoFrameCallback) {
      this.syncInterval = v.requestVideoFrameCallback(loop);
    } else {
      this.syncInterval = requestAnimationFrame(loop);
    }
  }

  _stopSyncLoop() {
    const v = this.videoElement || document.querySelector('video');
    if (this._watchdogInterval) {
      clearInterval(this._watchdogInterval);
      this._watchdogInterval = null;
    }
    if (this.syncInterval) {
      if (v && v.cancelVideoFrameCallback) {
        try {
          v.cancelVideoFrameCallback(this.syncInterval);
        } catch (e) {}
      } else {
        cancelAnimationFrame(this.syncInterval);
      }
      this.syncInterval = null;
    }
    if (this._syncTimer) {
      if (v && v.cancelVideoFrameCallback) {
        try {
          v.cancelVideoFrameCallback(this._syncTimer);
        } catch (e) {}
      } else {
        cancelAnimationFrame(this._syncTimer);
      }
      this._syncTimer = null;
    }
  }

  _fixEncoding(text) {
    if (!text) return text;

    try {
      // Remove losangos/diamonds que aparecem no lugar de caracteres especiais
      let fixed = text.replace(/[◆�]/g, '');

      // Tenta decodificar UTF-8 mal interpretado (double encoding)
      // Verifica se há sequências de bytes mal interpretadas
      if (fixed.includes('Ã') || fixed.includes('â€')) {
        fixed = fixed
          // Minúsculas com acentos
          .replace(/Ã¹/g, 'ù')
          .replace(/Ã¨/g, 'è')
          .replace(/Ã¬/g, 'ì')
          .replace(/Ã²/g, 'ò')
          // Maiúsculas com acentos
          .replace(/Ã�/g, 'Á')
          .replace(/Ã�/g, 'Í')
          .replace(/Ã"/g, 'Ó')
          .replace(/Ãš/g, 'Ú')
          .replace(/Ã‚/g, 'Â')
          .replace(/ÃŠ/g, 'Ê')
          .replace(/Ã"/g, 'Ô')
          .replace(/Ã€/g, 'À')
          // Pontuação
          .replace(/â€™/g, "'")
          .replace(/â€œ/g, '"')
          .replace(/â€�/g, '"')
          .replace(/â€"/g, '—')
          .replace(/â€"/g, '–')
          .replace(/â€¦/g, '…');
      }

      // Tenta usar TextDecoder como fallback para casos extremos
      // Se ainda houver caracteres estranhos, tenta decodificar como Latin-1 e re-encodar como UTF-8
      if (/[\x80-\xFF]/.test(fixed) && !/[À-ÿ]/.test(fixed)) {
        try {
          const bytes = new Uint8Array([...fixed].map((c) => c.charCodeAt(0)));
          const decoder = new TextDecoder('utf-8', { fatal: false });
          fixed = decoder.decode(bytes);
        } catch (decodeError) {
          console.warn('[LinguaFlow] TextDecoder fallback falhou:', decodeError);
        }
      }

      // Remove qualquer caractere de substituição Unicode (�) que sobrou
      fixed = fixed.replace(/�/g, '');

      return fixed;
    } catch (e) {
      console.error('[LinguaFlow] Erro ao corrigir encoding:', e);
      // Fallback: pelo menos remove os losangos e caracteres de substituição
      return text.replace(/[◆�]/g, '');
    }
  }

  // ── Busca otimizada de Cue (O(1) no caso comum, O(log N) no pior caso) ──
  _binarySearchCue(list, time) {
    if (!list || list.length === 0) return -1;

    // 1. Otimização de Cache (Caso comum: vídeo rolando pra frente)
    const lastIdx = this._lastFoundIdx || 0;
    if (lastIdx >= 0 && lastIdx < list.length) {
      const current = list[lastIdx];
      if (time >= current.start && time <= current.end) return lastIdx;

      if (lastIdx + 1 < list.length) {
        const next = list[lastIdx + 1];
        if (time >= next.start && time <= next.end) {
          this._lastFoundIdx = lastIdx + 1;
          return lastIdx + 1;
        }
      }
    }

    // 2. Busca Binária de Elite (O(log N)) para saltos (seek)
    let low = 0;
    let high = list.length - 1;
    while (low <= high) {
      let mid = (low + high) >>> 1;
      const c = list[mid];
      if (time >= c.start && time <= c.end) {
        this._lastFoundIdx = mid;
        return mid;
      }
      if (time < c.start) high = mid - 1;
      else low = mid + 1;
    }
    return -1;
  }

  _syncYouTubeNativeCaptions() {
    if (this.platform !== 'youtube') return;
    const nativeWindow = document.querySelector('.ytp-caption-window-container');
    if (this._hiddenYouTubeCaptions && this._hiddenYouTubeCaptions !== nativeWindow) {
      this._hiddenYouTubeCaptions.style.display = '';
      this._hiddenYouTubeCaptions = null;
    }
    if (!nativeWindow) return;
    if (this.isActivated && this.cues?.length) {
      if (nativeWindow.style.display !== 'none') {
        nativeWindow.style.display = 'none';
        this._hiddenYouTubeCaptions = nativeWindow;
      }
    } else if (this._hiddenYouTubeCaptions === nativeWindow) {
      nativeWindow.style.display = '';
      this._hiddenYouTubeCaptions = null;
    }
    if (this.isActivated && this.cues?.length && !this._captionConflictNoticed && hasLanguageReactor(document)) {
      this._captionConflictNoticed = true;
      this._setCaptionNotice(CAPTION_CONFLICT_NOTICE);
    }
  }

  // ── Esconde legenda nativa do HBO Max — método Pro V5 ───────────────────
  _hideHBONativeSubtitles() {
    let s = document.getElementById('lf-native-hide');
    if (!s) {
      s = document.createElement('style');
      s.id = 'lf-native-hide';
      document.head.appendChild(s);
    }
    s.textContent =
      '[data-testid="caption_renderer_overlay"],[class*="SubtitleText"],[class*="subtitle-text"],.track-text-container{opacity:0!important;pointer-events:none!important;}';
    console.debug('[LinguaFlow] HBO Max: legenda nativa escondida via CSS (Pro V5)');
  }

  // ── Liga a legenda nativa da Max quando ela está desligada ────────────────
  // A Max só baixa o VTT com a legenda do player ligada. Roda sempre que o LF
  // é ligado (início, F5 não necessário, vídeo em andamento) e tenta de novo
  // até as falas chegarem. Se o usuário desligar o LF no meio, para.
  _autoEnableHBOSubtitles() {
    if (!this.isActivated || this._disposed) return;
    if (this.xhrCues && this.xhrCues.length > 0) return;
    if (this._hboAutoEnableTried) return; // já há uma rodada em andamento neste vídeo
    this._hboAutoEnableTried = true;

    const MAX_ATTEMPTS = 12;
    let attempts = 0;
    const finish = () => {
      clearTimeout(this._hboAutoEnableTimer);
      this._hboAutoEnableTimer = null;
    };
    const retry = (delay) => {
      this._hboAutoEnableTimer = setTimeout(tryEnable, delay);
    };
    const tryEnable = () => {
      if (this._disposed || !this.isActivated) {
        finish();
        this._hboAutoEnableTried = false;
        return;
      }
      if (this.xhrCues && this.xhrCues.length > 0) return finish();
      if (++attempts > MAX_ATTEMPTS) {
        console.debug('[LinguaFlow] HBO Max: não foi possível ligar a legenda nativa');
        finish();
        this._hboAutoEnableTried = false; // permite nova tentativa ao religar o LF
        return;
      }

      const ccBtn = document.querySelector(MAX_CC_BUTTON_SELECTOR);
      if (!ccBtn) return retry(1000); // player ainda montando

      try {
        ccBtn.click();
        setTimeout(() => {
          const items = readMenuItems(document);
          const pick = pickSubtitleOption(items, this.sourceLang);
          if (pick.index >= 0) {
            console.debug('[LinguaFlow] HBO Max: ligando legenda nativa');
            items[pick.index].node.click();
          }
          // Fecha o menu sem alterar a escolha
          setTimeout(() => {
            if (document.querySelector('[role="menuitemradio"], [role="radio"]')) ccBtn.click();
          }, 150);
          retry(2500); // espera o VTT chegar; se não vier, tenta de novo
        }, 300);
      } catch {
        retry(1500);
      }
    };
    retry(300);
  }

  // Ponto único chamado quando o player fica pronto e a cada play (#438).
  _syncNativeCCButton() {
    if (this.isActivated) this._ensureNativeSubtitlesActive();
    else this._ensureNativeSubtitlesOff();
  }

  // Desligado: o CC que o YouTube memorizou (ligado pelo LinguaFlow) não deve
  // ficar ligado. Respeita o usuário que ligou o CC com um clique real.
  _ensureNativeSubtitlesOff() {
    if (this.isActivated || this.platform !== 'youtube' || this._userWantsNativeCC) return;
    const ytSubBtn = document.querySelector('.ytp-subtitles-button');
    if (ytSubBtn?.getAttribute('aria-pressed') === 'true') ytSubBtn.click();
  }

  // Cliques feitos por código (.click()) chegam com isTrusted=false e não
  // contam como escolha do usuário.
  _onNativeCaptionToggle({ active, trusted } = {}) {
    if (trusted === true) this._userWantsNativeCC = !!active;
  }

  _ensureNativeSubtitlesActive() {
    if (!this.isActivated) return;

    if (this.platform === 'youtube') {
      const ytSubBtn = document.querySelector('.ytp-subtitles-button');
      if (ytSubBtn) {
        const isYtSubActive = ytSubBtn.getAttribute('aria-pressed') === 'true';
        if (!isYtSubActive) {
          ytSubBtn.click();
          console.debug('[LinguaFlow] Sincronização: CC nativo do YouTube engatilhado com sucesso');
        }
      }
    } else if (this.platform === 'max') {
      this._autoEnableHBOSubtitles();
    }
  }
}
