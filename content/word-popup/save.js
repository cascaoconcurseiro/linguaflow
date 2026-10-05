// content/word-popup/save.js — Salvar a palavra (card + contexto), enriquecimento tardio, aviso de salvo e ignorar palavra.
import { cleanIpa, isValidIpa } from '../../utils/ipa-validator.js';
import { mergeContextualChunks } from '../../utils/context-chunks.js';
import { db } from '../../utils/db.js';

export class SaveMethods {
  async _save() {
    const q = (s) => this._q(s);
    const btn = q('#fsave');

    // Check if already saving (prevent double-click)
    if (btn.disabled) return;

    const originalText = btn.textContent;
    btn.textContent = '⏳ Salvando...';
    btn.disabled = true;

    const wordAtSave = this.word;
    const saveContextAtSave = this.saveContext;
    const contextAtSave = this.context;
    const currentCueAtSave = this.currentCue;
    const exprTypeAtSave = this._exprType;
    const activeLevelAtSave = this.activeLevel;
    const contextExplanationAtSave = this.contextExplanation;
    const contextSession = this._contextSession;
    const d = this.cache[wordAtSave] || {};
    const BASE = chrome.runtime.getURL('utils/');

    try {
      const { db } = await import(BASE + 'db.js');
      const { videoUtils } = await import(BASE + 'video-utils.js');
      const lang = this.engine?.sourceLang || 'en';

      // Leitura local: não faz refresh/rede no clique. Se o token precisar ser
      // renovado, o service worker fará isso ao sincronizar a fila.
      const localSession = await db._readSession();
      if (!localSession?.access_token) {
        btn.textContent = '🔒 Faça login no Dashboard';
        btn.style.background = '#d97706';
        btn.style.boxShadow = '0 3px 0 #b45309';
        setTimeout(() => {
          btn.textContent = '+ Salvar nos Flashcards';
          btn.style.background = '#58cc02';
          btn.style.boxShadow = '0 3px 0 #46a302';
          btn.disabled = false;
        }, 3000);
        return;
      }

      // Upsert no servidor resolve duplicidade. Tradução/classificação faltante
      // é enriquecida depois e não bloqueia a intenção de salvar.
      const translation = contextSession?.translation || d.translation || '';

      // SALVA JÁ — nada de esperar a IA gerar chunks (era a "demora ao salvar").
      // O backfill do service worker roda em background depois do saveWord e
      // completa chunks/frases sozinho.
      if (!d.phonetic && this.generatedChunks && this.generatedChunks.length > 0) {
        const candidatePhon = this.generatedChunks[0].phon;
        if (isValidIpa(candidatePhon)) {
          d.phonetic = cleanIpa(candidatePhon);
        }
      }

      // Capture o trecho antes de qualquer await: enquanto o dicionário/DB
      // responde, o vídeo pode avançar para outra fala.
      const videoClip = videoUtils.getVideoClip
        ? videoUtils.getVideoClip(currentCueAtSave)
        : { video_url: await this._getVideoUrlWithTimestamp(), video_start_ms: null, video_end_ms: null };

      // O card nasce com a ocorrência real e a unidade que o aluno deve
      // guardar. A explicação/tradução pode chegar depois, mas não voltamos a
      // criar três frases genéricas desconectadas do vídeo.
      const contextualChunks = mergeContextualChunks(this.generatedChunks, {
        context: saveContextAtSave || contextAtSave,
        learningUnit: wordAtSave,
        learningTranslation: translation,
        learningPhonetic: d.phonetic || '',
      });

      // Capture tags
      const tags = [];
      if (exprTypeAtSave?.label) tags.push(exprTypeAtSave.label);
      if (d.partOfSpeech) tags.push(this._posLabel(d.partOfSpeech));
      if (this.freqList) {
        const cleanWord = wordAtSave.toLowerCase().replace(/[^a-z0-9]/gi, '');
        const rank = this.freqList[cleanWord];
        if (rank) {
          tags.push(rank <= 1000 ? `🔥 Top ${rank}` : rank <= 5000 ? `📊 Top ${rank}` : `✨ Rara (>5k)`);
        }
      }

      const payload = {
        word: wordAtSave,
        lang: this.engine?.sourceLang || 'en',
        translation: translation,
        phonetic: d.phonetic || '',
        definition: d.definition || '',
        // Reutiliza o professor contextual que já rodou no popup. Nenhuma
        // chamada extra é feita no estudo; o texto segue junto com o card.
        explanation: contextExplanationAtSave || '',
        // saveContext = frase completa (sem "..."); this.context é a versão
        // truncada de exibição e fica só como último fallback (§3.2).
        context_sentence: saveContextAtSave || contextAtSave || '',
        video_url: videoClip.video_url,
        video_start_ms: videoClip.video_start_ms,
        video_end_ms: videoClip.video_end_ms,
        video_title: document.title,
        platform: this.platform || 'youtube',
        level: activeLevelAtSave || '',
        category: (['word', 'phrasal', 'idiom', 'slang'].includes(exprTypeAtSave?.type)
          ? exprTypeAtSave.type
          : (exprTypeAtSave?.type === 'chunk' || exprTypeAtSave?.type === 'collocation' ? 'idiom' : 'word')),
        tags: tags.length ? tags : null,
        synonyms: (d.synonyms || []).join(','),
        antonyms: (d.antonyms || []).join(','),
        snapshot: null,
        chunks: contextualChunks.length ? contextualChunks : null,
      };

      const savePromise = chrome.runtime.sendMessage({ type: 'QUEUE_WORD_SAVE', payload });
      if (contextSession?.word === wordAtSave) {
        contextSession.save = {
          payload,
          promise: savePromise,
          syncPromise: null,
        };
      }
      const result = await savePromise;

      if (!result?.ok || !result?.queued) {
        throw new Error(result?.error || 'Não foi possível guardar o salvamento localmente.');
      }
      this._syncLateSaveEnrichment(contextSession).catch((error) => {
        console.warn('[WordPopup] Enriquecimento do save aguardará nova sincronização:', error);
      });
      console.debug('[WordPopup] ✅ Palavra guardada; sincronização em segundo plano:', result.queueId);

      // §3.3: o botão NÃO volta a "+ Salvar" depois de 2s — esse reset
      // convidava um segundo clique que sobrescrevia a captura original.
      // Fica verde, desabilitado e explicado; showForWord reavalia o estado
      // na próxima palavra/abertura.
      if (this.word === wordAtSave) {
        btn.textContent = '✅ Salvo nos Flashcards';
        btn.style.background = '#16a34a';
        btn.style.boxShadow = '0 3px 0 #15803d';
        btn.title = 'Já está no seu Cofre — re-salvar sobrescreveria a cena original';
        btn.disabled = true;
      }

      // Mostra toast de confirmação
      this._showSaveToast();

      // A1 do backlog (W1): salvar NAO encerra o fluxo — 15s de primeira
      // recuperacao criam a primeira evidencia e evitam o cemiterio de cards.
      this._maybeShowFirstRecall(contextSession, translation);

      // O player atualiza instantaneamente. Dashboard/cofre só recebem o
      // broadcast quando o servidor confirmar a sincronização.
      window.dispatchEvent(
        new CustomEvent('LF_WORD_SAVED', {
          detail: { word: wordAtSave, queued: true },
        }),
      );

      console.debug('[WordPopup] 📢 Estado local atualizado');
    } catch (e) {
      console.error('[WordPopup] ❌ Erro ao salvar:', e);
      if (this.word === wordAtSave) {
        btn.textContent = '❌ Erro';
        setTimeout(() => {
          if (this.word === wordAtSave) {
            btn.textContent = originalText;
            btn.disabled = false;
          }
        }, 2000);
      }
    }
  }

  async _syncLateSaveEnrichment(contextSession) {
    if (!contextSession?.save) return;
    const queuedSave = contextSession.save;
    const previousSync = queuedSave.syncPromise
      ? queuedSave.syncPromise.catch(() => {})
      : Promise.resolve();

    queuedSave.syncPromise = previousSync.then(async () => {
      const initialResult = await contextSession.save.promise;
      if (!initialResult?.ok || !initialResult?.queued) return;

      const currentPayload = contextSession.save.payload;
      const nextPayload = {
        ...currentPayload,
        translation: contextSession.translation || currentPayload.translation || '',
        context_sentence: contextSession.saveContext || contextSession.context || '',
        explanation: contextSession.explanation || '',
        chunks: mergeContextualChunks(currentPayload.chunks, {
          context: contextSession.saveContext || contextSession.context,
          learningUnit: contextSession.word,
          learningTranslation: contextSession.translation || currentPayload.translation || '',
          learningPhonetic: currentPayload.phonetic || '',
        }),
      };
      if (
        nextPayload.translation === currentPayload.translation
        &&
        nextPayload.context_sentence === currentPayload.context_sentence
        && nextPayload.explanation === currentPayload.explanation
        && JSON.stringify(nextPayload.chunks) === JSON.stringify(currentPayload.chunks)
      ) return;

      const result = await chrome.runtime.sendMessage({
        type: 'QUEUE_WORD_SAVE',
        payload: nextPayload,
      });
      if (!result?.ok || !result?.queued) {
        throw new Error(result?.error || 'Não foi possível atualizar o contexto salvo.');
      }
      contextSession.save.payload = nextPayload;
    });

    return queuedSave.syncPromise;
  }

  // Aviso curto na página do vídeo. `text`/`tone` permitem avisar que a palavra ficou em espera (#495).
  _showSaveToast(text = null, tone = 'ok') {
    let toast = document.getElementById('lf-save-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'lf-save-toast';
      toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: rgba(16, 185, 129, 0.95);
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 600;
        z-index: 2147483647;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        animation: slideInRight 0.3s ease-out;
      `;
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);

      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) { #lf-save-toast { animation: none !important; } }
        @keyframes slideOutRight {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(100px); }
        }
      `;
      document.head.appendChild(style);
    }

    toast.textContent = text || `✅ "${this.word}" salvo no dashboard!`;
    toast.style.background = tone === 'wait' ? 'rgba(146, 90, 12, 0.96)' : 'rgba(16, 185, 129, 0.95)';
    toast.style.display = 'block';
    toast.style.animation = 'slideInRight 0.3s ease-out';

    clearTimeout(this._saveToastTimer);
    this._saveToastTimer = setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => (toast.style.display = 'none'), 300);
    }, tone === 'wait' ? 7000 : 3000);
  }

  // O freio de entrada segurou a palavra: ela não se perdeu, só espera a fila de revisões baixar.
  showHeldNotice(word) {
    this._showSaveToast(`⏳ "${String(word).slice(0, 40)}" ficou em espera: você tem muitas revisões vencidas. Ela entra na fila quando isso baixar.`, 'wait');
  }

  // Os métodos _ai, _aiSentence e _aiGrammar foram movidos para o final do arquivo para melhor organização.

  async _getVideoUrlWithTimestamp() {
    const BASE = chrome.runtime.getURL('utils/');
    const { videoUtils } = await import(BASE + 'video-utils.js');
    return videoUtils.getVideoUrlWithTimestamp();
  }
  // #368: "Ignorar" é reversível no próprio card ("Deixar de ignorar").
  _renderIgnoreButton(ignored) {
    const btn = this._q('#fignore');
    if (!btn) return;
    btn.disabled = false;
    btn.setAttribute('aria-pressed', String(ignored));
    btn.textContent = ignored ? '↺ Deixar de ignorar' : '⊘ Ignorar esta palavra';
  }

  async _toggleIgnored() {
    const btn = this._q('#fignore');
    if (!btn || btn.disabled) return;
    const word = String(this.word || '').toLowerCase();
    const lang = this.engine?.sourceLang || 'en';
    const ignore = btn.getAttribute('aria-pressed') !== 'true';
    btn.disabled = true;
    btn.textContent = ignore ? '⏳ Ignorando…' : '⏳ Desfazendo…';
    try {
      if (ignore) await db.ignoreWord(word, lang);
      else await db.unignoreWord(word, lang);
      window.dispatchEvent(new CustomEvent('LF_WORD_IGNORED', { detail: { word, ignored: ignore } }));
      this._renderIgnoreButton(ignore);
    } catch (e) {
      console.warn('[WordPopup] ignorar falhou:', e?.message);
      this._renderIgnoreButton(!ignore);
      btn.textContent = ignore ? '⚠ Não foi possível ignorar — tentar de novo' : '⚠ Não foi possível desfazer — tentar de novo';
    }
  }
}
