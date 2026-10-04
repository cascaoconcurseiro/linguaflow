// content/word-popup/ai-context.js — IA no popup: explicar o contexto, gerar frase e trechos, exemplos do vídeo e aviso de login.
import { db } from '../../utils/db.js';
import { streamAiRequest } from '../../utils/ai-stream.js';
import { cleanContextExplanation } from '../popup/popup-linguistics.js';
import { cleanIpa, isValidIpa } from '../../utils/ipa-validator.js';
import { findWordInVideo } from '../subtitles/video-vocabulary.js';

export class AiContextMethods {
  _showContextLogin(word, sentence, expired = false) {
    this._clearLoginWait();
    const contextSession = this._contextSession;
    const el = this._q('#fctxt');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = `<strong>${expired ? 'Sua sessão expirou' : 'Seu professor de inglês'}</strong>
      <p>${expired ? 'Entre novamente para continuar usando o professor.' : 'Entre na sua conta para receber uma explicação desta palavra na frase.'}</p>
      <button type="button" style="min-height:44px;padding:8px 16px;border:1px solid #7dd3fc;border-radius:8px;background:#1e3a8a;color:#fff;font:inherit;cursor:pointer;">${expired ? 'Entrar novamente' : 'Entrar para usar a IA'}</button>
      <p role="status"></p>`;
    const status = el.querySelector('[role="status"]');
    const button = el.querySelector('button');
    button.addEventListener('click', async () => {
      button.disabled = true;
      status.textContent = 'Abrindo o login da extensão…';
      try {
        const result = await chrome.runtime.sendMessage({ type: 'OPEN_EXTENSION_LOGIN' });
        if (!result?.ok) throw new Error('open_failed');
        status.textContent = 'Depois de entrar, volte ao vídeo. A explicação continuará se esta palavra ainda estiver aberta.';
      } catch {
        status.textContent = 'Não foi possível abrir o login. Tente novamente.';
      } finally {
        button.disabled = false;
      }
    });
    this._loginListener = async (changes, area) => {
      if (area !== 'local' || !changes.lf_supabase_session?.newValue) return;
      if (this._contextSession !== contextSession || this._isHiding || this.popup?.style.display === 'none') {
        this._clearLoginWait();
        return;
      }
      this._clearLoginWait();
      await this._explainContext(word, sentence);
    };
    chrome.storage.onChanged.addListener(this._loginListener);
  }

  _clearLoginWait() {
    if (this._loginListener) chrome.storage.onChanged.removeListener(this._loginListener);
    this._loginListener = null;
  }

  async _explainContext(word, sentence) {
    this._clearLoginWait();
    const q = (s) => this._q(s);
    const el = q('#fctxt');
    const container = q('#fctx');
    const contextSession = this._contextSession;

    this._contextExplained = true;
    container.style.display = '';

    el.innerHTML =
      '<span style="color:#94a3b8;font-size:12px;">Analisando estrutura e acionando Professor (IA)...</span>';

    try {
      const connected = Boolean(await db._readSession());
      if (this._contextSession !== contextSession) return;
      if (!connected) {
        this._showContextLogin(word, sentence);
        return;
      }
      const sentenceTranslationPromise = this._translate(sentence);
      const typeDescriptions = {
        phrasal: {
          title: 'Phrasal verb',
          desc: 'Leia como uma ideia só. Traduzir palavra por palavra costuma enganar.',
          icon: '🔗',
        },
        idiom: {
          title: 'Expressão idiomática',
          desc: 'O sentido vem do conjunto, não das palavras separadas.',
          icon: '🎭',
        },
        chunk: {
          title: 'Chunk',
          desc: 'Bloco pronto que nativos usam sem montar palavra por palavra.',
          icon: '🧩',
        },
        collocation: {
          title: 'Combinação natural',
          desc: 'Palavras que soam certas juntas. Guarde o par completo.',
          icon: '🤝',
        },
        slang: { title: 'Gíria', desc: 'Uso informal. Bom para entender fala real.', icon: '🔥' },
        formal: {
          title: 'Registro formal',
          desc: 'Mais comum em escrita, trabalho ou fala cuidadosa.',
          icon: '🎩',
        },
      };

      const nativeHtmlFor = (phrasalVerbsDB) => {
        const tinfo = typeDescriptions[this._detectExprType(word, phrasalVerbsDB).type];
        if (!tinfo) return '';
        return `
              <div style="background:rgba(251,191,36,0.1); border-left:3px solid #fbbf24; padding:8px; border-radius:4px; margin-bottom:8px;">
                <b style="color:#fbbf24; font-size:13px;">${tinfo.icon} ${tinfo.title}</b><br>
                <span style="color:#cbd5e1; font-size:12px;">${tinfo.desc}</span>
              </div>
            `;
      };
      let nativeHtml = '';
      const nativeHtmlPromise = this._getPhrasalVerbsDB().then((phrasalVerbsDB) => {
        nativeHtml = nativeHtmlFor(phrasalVerbsDB);
        return nativeHtml;
      });

      // Streaming: a tradução contextual entra no título assim que a primeira
      // linha fecha e a explicação vai aparecendo enquanto a IA escreve.
      // Trocar de palavra cancela o pedido (a porta aborta a IA), exceto se a
      // palavra já foi salva: aí o resultado ainda enriquece o card em segundo plano.
      let partialTranslation = '';
      const response = await streamAiRequest(
        { action: 'ai_quick_context', word, sentence },
        {
          isStale: () => this._contextSession !== contextSession && !contextSession?.save,
          onPartial: (partial) => {
            if (this._contextSession !== contextSession) return;
            const translation = String(partial.translation || '').trim();
            if (translation && translation !== partialTranslation && this.cache[word]) {
              partialTranslation = translation;
              this.cache[word].translation = translation;
              this.cache[word].contextual = true;
              q('#ft').textContent = translation;
            }
            if (partial.explanation) {
              el.innerHTML = nativeHtml
                + this._escapeAttr(cleanContextExplanation(partial.explanation)).replace(/\n/g, '<br>');
            }
          },
        },
      );
      nativeHtml = await nativeHtmlPromise;

      if (response?.translation || response?.explanation) {
        const explanation = cleanContextExplanation(response.explanation);
        const contextualTranslation = String(response.translation || '').trim();
        if (contextSession) {
          contextSession.translation = contextualTranslation;
          contextSession.explanation = explanation;
          contextSession.contextResolved = true;
          this._syncLateSaveEnrichment(contextSession).catch((error) => {
            console.warn('[WordPopup] Contexto tardio aguardará nova sincronização:', error);
          });
          this._maybeShowFirstRecall(contextSession, this.cache[word]?.translation || '');
        }
        if (this._contextSession !== contextSession) return;
        if (contextualTranslation && this.cache[word]) {
          this.cache[word].translation = contextualTranslation;
          this.cache[word].contextual = true;
        }
        if (this.cache[word] && contextualTranslation) {
          this._render(this.cache[word]);
        }
        this.contextExplanation = explanation;
        const aiExplanation = this._escapeAttr(explanation).replace(/\n/g, '<br>');
        el.innerHTML = nativeHtml + aiExplanation;
      } else {
        const sentenceTranslation = await sentenceTranslationPromise;
        if (contextSession) {
          contextSession.contextResolved = true;
          this._maybeShowFirstRecall(contextSession, this.cache[word]?.translation || '');
        }
        if (this._contextSession !== contextSession) return;
        const authExpired = /(?:sess[aã]o expirada|fa[cç]a login|unauthorized|\b401\b)/i
          .test(String(response?.error || ''));
        if (authExpired) {
          this._showContextLogin(word, sentence, true);
          return;
        }
        const failureMessage = authExpired
          ? 'Sessão expirada na extensão. Abra o Dashboard do LinguaFlow e entre novamente.'
          : 'Falha ao obter professor IA. Tente novamente em instantes.';
        // Fallback caso a IA falhe
        const safeSentenceTranslation = this._escapeAttr(
          sentenceTranslation || 'tradução indisponível',
        );
        el.innerHTML =
          nativeHtml +
          `
              <b style="color:#7dd3fc">Frase traduzida:</b> <span style="color:#94a3b8">${safeSentenceTranslation}</span><br>
              <span style="color:#f87171;font-size:12px;display:block;margin-top:8px;">${failureMessage}</span>
            `;
      }
    } catch (e) {
      if (contextSession) {
        contextSession.contextResolved = true;
        this._maybeShowFirstRecall(contextSession, this.cache[word]?.translation || '');
      }
      if (this._contextSession !== contextSession) return;
      console.error('[WordPopup] Erro geral no contexto:', e);
      el.innerHTML = `<span style="color:#f87171;font-size:12px;">Erro interno ao carregar contexto.</span>`;
    }
  }

  async _generateContext(word) {
    const q = (s) => this._q(s);
    const el = q('#fctxt');
    const container = q('#fctx');
    const contextSession = this._contextSession;

    this._contextExplained = true;
    container.style.display = '';

    el.innerHTML =
      '<span style="color:#94a3b8;font-size:12px;">Gerando frase natural com IA (sem contexto na origem)...</span>';

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: 'ai_generate_sentence',
            word: word,
          },
          (r) => {
            if (chrome.runtime.lastError) resolve(null);
            else resolve(r);
          },
        );
      });

      if (response?.sentence) {
        if (contextSession) {
          contextSession.context = response.sentence;
          contextSession.saveContext = response.sentence;
          contextSession.contextResolved = true;
          this._syncLateSaveEnrichment(contextSession).catch((error) => {
            console.warn('[WordPopup] Frase tardia aguardará nova sincronização:', error);
          });
          this._maybeShowFirstRecall(contextSession, this.cache[word]?.translation || '');
        }
        if (this._contextSession !== contextSession) return;
        // Save back so the user can save it in flashcards
        this.context = response.sentence;
        this.saveContext = response.sentence; // frase da IA é completa por construção
        
        const safeGeneratedSentence = this._escapeAttr(response.sentence);
        const safeGeneratedTranslation = this._escapeAttr(response.translation || '');
        el.innerHTML = `
          <div style="background:rgba(56,189,248,0.1); border-left:3px solid #38bdf8; padding:8px; border-radius:4px; margin-bottom:8px;">
            <b style="color:#38bdf8; font-size:13px;">🤖 Exemplo Gerado (IA)</b><br>
            <span style="color:#cbd5e1; font-size:12px;">Como você salvou a palavra isolada, geramos um contexto real para você estudar:</span>
          </div>
          <b style="color:#e2e8f0; font-size: 15px;">"${safeGeneratedSentence}"</b><br>
          <span style="color:#94a3b8; font-size:13px; display:block; margin-top:4px;">${safeGeneratedTranslation}</span>
        `;
      } else {
        if (this._contextSession !== contextSession) return;
        el.innerHTML =
          '<span style="color:#f87171;font-size:12px;">Falha ao gerar exemplo. Limite da IA atingido ou sem login.</span>';
      }
    } catch (e) {
      if (contextSession) {
        contextSession.contextResolved = true;
        this._maybeShowFirstRecall(contextSession, this.cache[word]?.translation || '');
      }
      if (this._contextSession !== contextSession) return;
      console.error('[WordPopup] Erro ao gerar contexto:', e);
      el.innerHTML = `<span style="color:#f87171;font-size:12px;">Erro interno ao gerar contexto.</span>`;
    }
  }
  async _aiSentence() {
    const q = (s) => this._q(s);
    const btn = q('#faisent');
    const resEl = q('#fair');
    if (!this.context) return alert('Frase de contexto não encontrada.');
    if (btn.disabled) return;
    btn.innerHTML =
      '<span class="lfp-spin" style="border-top-color:#fbbf24"></span> Analisando frase…';
    btn.disabled = true;
    q('#fair-container').style.display = 'block';
    resEl.innerHTML =
      '<div style="padding:10px;text-align:center;"><span class="lfp-spin" style="border-top-color:#fbbf24"></span> Desconstruindo a frase com IA...</div>';
    try {
      // Streaming: a análise aparece enquanto a IA escreve. Trocar de frase
      // desconecta a porta e cancela o pedido.
      const sentenceAtStart = this.context;
      const response = await streamAiRequest(
        {
          action: 'ai_explain_sentence',
          sentence: sentenceAtStart,
          fullContext: this.currentCue?.fullContext || null, // Passa o diálogo ao redor
        },
        {
          isStale: () => this.context !== sentenceAtStart,
          onPartial: (partial) => {
            if (partial.text) resEl.innerHTML = this._formatAI(partial.text);
          },
        },
      );
      if (this.context !== sentenceAtStart) return;
      if (!response) throw new Error('ai_stream_unavailable');

      if (response?.analysis) {
        resEl.innerHTML = this._formatAI(response.analysis);
      } else {
        const err = this._escapeAttr(response?.error || 'A IA não conseguiu processar esta frase.');
        resEl.innerHTML = `<div style="color:#f87171;padding:10px;">⚠️ <b>Erro na Análise</b><br>${err}</div>`;
      }
    } catch (e) {
      console.error('[LinguaFlow] Erro ao analisar frase:', e);
      resEl.innerHTML =
        '<div style="color:#f87171;padding:10px;">⚠️ Falha na comunicação com o Service Worker.</div>';
    } finally {
      btn.textContent = '🔍 Analisar Frase Completa';
      btn.disabled = false;
    }

    q('#fcopy-ai').onclick = () => {
      const text = resEl.textContent;
      navigator.clipboard.writeText(text);
      const copyBtn = q('#fcopy-ai');
      copyBtn.textContent = '✅ Copiado';
      setTimeout(() => (copyBtn.textContent = '📋 Copiar'), 2000);
    };
  }

  async _generateChunks() {
    const q = (s) => this._q(s);
    const btn = q('#fgenchunks');
    const resEl = q('#fchunks-container');
    if (btn?.disabled) return;

    if (btn) {
      btn.innerHTML = '<span class="lfp-spin"></span> Gerando Chunks…';
      btn.disabled = true;
    }
    if (resEl) {
      resEl.innerHTML =
        '<div style="text-align:center;color:#a78bfa;padding:20px;"><span class="lfp-spin"></span> Professor (IA) está montando os chunks...</div>';
    }

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'ai_generate_chunks',
            word: this.word,
            context: this.saveContext || this.context || '',
          },
          (r) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(r);
          },
        );
      });

      if (response?.chunks) {
        this._chunksBuilt = true;
        this.generatedChunks = response.chunks;

        let html = '';
        response.chunks.forEach((c) => {
          const eng = this._escapeAttr(c.eng);
          const pt = this._escapeAttr(c.pt);
          const rawPhon = isValidIpa(c.phon) ? cleanIpa(c.phon) : '';
          const phon = this._escapeAttr(rawPhon);
          const phonHtml = phon
            ? `<div style="font-size:13px; color:#fbbf24; font-family:'Lucida Sans Unicode','DejaVu Sans',system-ui,-apple-system,sans-serif; font-weight:600; background:rgba(251,191,36,.1); padding:4px 8px; border-radius:6px; display:inline-block; border:1px solid rgba(251,191,36,.3);">${phon}</div>`
            : '';
          html += `
            <div style="background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08); border-radius:10px; padding:12px; margin-bottom:10px;">
                <div style="font-size:14px; color:#e2e8f0; font-weight:700; margin-bottom:4px;">${eng}</div>
                <div style="font-size:12px; color:#94a3b8; font-style:italic; margin-bottom:8px;">${pt}</div>
                ${phonHtml}
            </div>`;
        });

        if (resEl) resEl.innerHTML = html;
        if (btn) btn.style.display = 'none';
      } else {
        const errorMsg = this._escapeAttr(response?.error || 'A IA não conseguiu gerar os chunks.');
        if (resEl) {
          resEl.innerHTML = `<div style="color:#f87171;padding:10px;text-align:center;">⚠️ <b>Erro</b><br>${errorMsg}</div>`;
        }
      }
    } catch (e) {
      console.error('[LinguaFlow] Erro ao gerar chunks:', e);
      if (resEl) {
        const msg = this._escapeAttr(e.message);
        resEl.innerHTML = `<div style="color:#f87171;padding:10px;text-align:center;">⚠️ Falha na comunicação: ${msg}</div>`;
      }
    } finally {
      if (btn) {
        btn.textContent = '✦ Gerar Chunks (Professor IA)';
        btn.disabled = false;
      }
    }
  }

  _formatAI(text) {
    if (!text) return '';
    let formatted = this._escapeAttr(text)
      // Mapeamento dos novos tópicos para um design mais "Duolingo" (cores suaves, ícones arredondados, bordas de 2px)
      .replace(
        /\*\*(.*?A ideia aqui.*?)\*\*(.*?)(?=\n\n\*\*|\n\n$|$)/gis,
        (match, title, content) => {
          return `<div style="margin-top:12px;margin-bottom:12px;padding:12px 14px;background:rgba(56,189,248,0.1);border:2px solid rgba(56,189,248,0.3);border-radius:16px;">
              <b style="color:#38bdf8;display:flex;align-items:center;gap:6px;font-size:14px;"><span style="font-size:18px;">💡</span> ${title.replace(/:/g, '').trim()}</b>
              <div style="color:#e0f2fe;margin-top:6px;line-height:1.6;font-size:13px;">${content.trim().replace(/\n/g, '<br>')}</div>
          </div>`;
        }
      )
      .replace(
        /\*\*(.*?O truque.*?)\*\*(.*?)(?=\n\n\*\*|\n\n$|$)/gis,
        (match, title, content) => {
          return `<div style="margin-bottom:12px;padding:12px 14px;background:rgba(250,204,21,0.08);border:2px solid rgba(250,204,21,0.3);border-radius:16px;">
              <b style="color:#facc15;display:flex;align-items:center;gap:6px;font-size:14px;"><span style="font-size:18px;">✨</span> ${title.replace(/:/g, '').trim()}</b>
              <div style="color:#fef08a;margin-top:6px;line-height:1.6;font-size:13px;">${content.trim().replace(/\n/g, '<br>')}</div>
          </div>`;
        }
      )
      .replace(
        /\*\*(.*?Pronúncia da vida real.*?)\*\*(.*?)(?=\n\n\*\*|\n\n$|$)/gis,
        (match, title, content) => {
          return `<div style="margin-bottom:12px;padding:12px 14px;background:rgba(244,114,182,0.08);border:2px solid rgba(244,114,182,0.3);border-radius:16px;">
              <b style="color:#f472b6;display:flex;align-items:center;gap:6px;font-size:14px;"><span style="font-size:18px;">🗣️</span> ${title.replace(/:/g, '').trim()}</b>
              <div style="color:#fbcfe8;margin-top:6px;line-height:1.6;font-size:14px;font-weight:600;font-family:'Outfit',sans-serif;letter-spacing:0.5px;">${content.trim().replace(/\n/g, '<br>')}</div>
          </div>`;
        }
      )
      .replace(
        /\*\*(.*?Exemplos rápidos.*?)\*\*(.*?)(?=\n\n\*\*|\n\n$|$)/gis,
        (match, title, content) => {
          return `<div style="margin-bottom:12px;padding:12px 14px;background:rgba(167,139,250,0.08);border:2px solid rgba(167,139,250,0.3);border-radius:16px;">
              <b style="color:#a78bfa;display:flex;align-items:center;gap:6px;font-size:14px;"><span style="font-size:18px;">💬</span> ${title.replace(/:/g, '').trim()}</b>
              <div style="color:#e9d5ff;margin-top:6px;line-height:1.6;font-size:13px;">${content.trim().replace(/\n/g, '<br>')}</div>
          </div>`;
        }
      )
      // Cabeçalhos antigos mantidos para compatibilidade com respostas já formatadas no histórico.
      .replace(
        /\*\*(.*?Nível Sugerido.*?)\*\*/gi,
        '<b style="color:#fde047;display:block;margin-bottom:8px">⭐ $1</b>',
      )
      .replace(
        /\*\*(.*?na prática.*?)\*\*/gi,
        '<b style="color:#7dd3fc;display:block;margin-top:12px">🎯 $1</b>',
      )
      .replace(
        /\*\*(.*?Como e onde usar.*?)\*\*/gi,
        '<b style="color:#86efac;display:block;margin-top:12px">🎭 $1</b>',
      )
      .replace(
        /\*\*(.*?Colocações Comuns.*?)\*\*/gi,
        '<b style="color:#fb923c;display:block;margin-top:12px">🧩 $1</b>',
      )
      .replace(
        /\*\*(.*?Exemplos Reais.*?)\*\*/gi,
        '<b style="color:#d8b4fe;display:block;margin-top:12px">📝 $1</b>',
      )
      .replace(
        /\*\*(.*?O Molde.*?)\*\*/gi,
        '<div style="margin-top:16px;margin-bottom:8px;padding:6px 12px;background:rgba(110,231,183,0.1);border-left:3px solid #6ee7b7;border-radius:4px;color:#6ee7b7;font-weight:bold;font-size:13px;">🧬 $1</div>',
      )
      .replace(
        /\*\*(.*?Como a Engrenagem Funciona.*?)\*\*/gi,
        '<div style="margin-top:16px;margin-bottom:8px;padding:6px 12px;background:rgba(147,197,253,0.1);border-left:3px solid #93c5fd;border-radius:4px;color:#93c5fd;font-weight:bold;font-size:13px;">⚙️ $1</div>',
      )
      .replace(
        /\*\*(.*?Mão na Massa.*?)\*\*/gi,
        '<div style="margin-top:16px;margin-bottom:8px;padding:6px 12px;background:rgba(251,146,60,0.1);border-left:3px solid #fb923c;border-radius:4px;color:#fb923c;font-weight:bold;font-size:13px;">🛠️ $1</div>',
      )
      .replace(
        /\*\*(.*?Pronúncia de Rua.*?)\*\*/gi,
        '<div style="margin-top:16px;margin-bottom:8px;padding:6px 12px;background:rgba(249,168,212,0.1);border-left:3px solid #f9a8d4;border-radius:4px;color:#f9a8d4;font-weight:bold;font-size:13px;">🗣️ $1</div>',
      )
      .replace(
        /\*\*(.*?Nível Nativo.*?)\*\*/gi,
        '<div style="margin-top:16px;margin-bottom:8px;padding:6px 12px;background:rgba(250,204,21,0.1);border-left:3px solid #facc15;border-radius:4px;color:#facc15;font-weight:bold;font-size:13px;">🔥 $1</div>',
      )
      .replace(
        /##\s*1\.\s*Pronúncia oficial/gi,
        '<div style="margin-top:16px;margin-bottom:8px;padding:6px 12px;background:rgba(147,197,253,0.1);border-left:3px solid #93c5fd;border-radius:4px;color:#93c5fd;font-weight:bold;font-size:13px;">🗣️ 1. Pronúncia Oficial</div>',
      )
      .replace(
        /##\s*2\.\s*Como um brasileiro costuma aprender/gi,
        '<div style="margin-top:16px;margin-bottom:8px;padding:6px 12px;background:rgba(251,146,60,0.1);border-left:3px solid #fb923c;border-radius:4px;color:#fb923c;font-weight:bold;font-size:13px;">🇧🇷 2. Como costuma ser ensinado</div>',
      )
      .replace(
        /##\s*3\.\s*Como realmente soa para um brasileiro/gi,
        '<div style="margin-top:16px;margin-bottom:8px;padding:6px 12px;background:rgba(249,168,212,0.1);border-left:3px solid #f9a8d4;border-radius:4px;color:#f9a8d4;font-weight:bold;font-size:13px;">🔥 3. Como realmente soa</div>',
      )
      .replace(
        /\*\*(.*?Associação Mental.*?)\*\*(.*?)(?=\n\n|\*$|$)/gis,
        (match, title, content) => {
          return `<div style="margin-top:16px;padding:10px;background:rgba(167,139,250,0.1);border-left:3px solid #a78bfa;border-radius:4px;">
              <b style="color:#c084fc">🧠 ${title.replace(/:/g, '').trim()}</b><br><span style="color:#e2e8f0">${content.replace(/\n/g, '<br>')}</span>
          </div>`;
        }
      )
      // Negrito normal
      .replace(/\*\*(.*?)\*\*/g, '<b style="color:#7dd3fc">$1</b>')
      // Itálico
      .replace(/\*(.*?)\*/g, '<i style="color:#94a3b8">$1</i>')
      // Quebras de linha normais
      .replace(/\n/g, '<br>');

    // Limpar brs colados aos banners e blocos
    formatted = formatted.replace(/<br>\s*<div/g, '<div').replace(/<\/div>\s*<br>/g, '</div>');
    return formatted;

  }

  // Outras falas do vídeo com a mesma palavra (#366): mesmo falante e assunto.
  _renderVideoExamples(cue) {
    const section = this._q('#fvid');
    const list = this._q('#fvid-list');
    if (!section || !list) return;
    this._videoExampleCue = cue;
    const cues = this.engine?.xhrCues?.length ? this.engine.xhrCues : this.engine?.cues;
    const base = this.cache?.[this.word]?.senses?.find((s) => s.base)?.base || '';
    const { total, items } = findWordInVideo(cues, this.word, { excludeStart: cue?.start ?? null, base });
    if (!total) {
      section.style.display = 'none';
      list.innerHTML = '';
      return;
    }
    const esc = (s) => this._escapeAttr(s);
    this._q('#fvid-title').textContent = total === 1 ? 'Neste vídeo · mais 1 vez' : `Neste vídeo · mais ${total} vezes`;
    list.innerHTML = items.map((item, i) => {
      const text = esc(item.text).replace(
        new RegExp(`\\b(${this._escapeRegExp(esc(item.form))})\\b`, 'i'),
        '<b style="color:#7dd3fc">$1</b>',
      );
      const translated = item.translatedText
        ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px;">${esc(item.translatedText)}</div>`
        : '';
      return `<li class="lfp-ex" style="margin:0;display:flex;gap:8px;align-items:flex-start;"><button type="button" class="lfp-vid-play" data-i="${i}" aria-label="Ouvir no vídeo a fala em ${Math.floor(item.start / 60)}:${String(Math.floor(item.start % 60)).padStart(2, '0')}" style="min-width:32px;min-height:32px;flex-shrink:0;background:rgba(125,209,252,.08);border:1px solid rgba(125,209,252,.25);border-radius:8px;color:#7dd3fc;cursor:pointer;font-size:12px;">▶</button><div style="font-size:12px;color:#e2e8f0;line-height:1.5;">${text}${translated}</div></li>`;
    }).join('');
    list.querySelectorAll('.lfp-vid-play').forEach((btn) => {
      btn.addEventListener('click', () => this._playVideoExample(items[Number(btn.dataset.i)]));
    });
    section.style.display = '';
  }

  _playVideoExample(item) {
    const video = this.engine?.videoElement;
    if (!item || !video) return;
    this._wasPlayingBefore = false;
    this.hide(false);
    video.currentTime = Math.max(0, item.start - 0.1);
    video.play().catch(() => {});
  }
}
