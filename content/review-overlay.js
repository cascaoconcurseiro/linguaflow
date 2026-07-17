/**
 * LinguaFlow Review Overlay — Revisão rápida durante vídeos
 * Mostra 1 flashcard por vez como overlay sem interromper o vídeo.
 * Teclas: 1=Errei, 2=Difícil, 3=Bom, 4=Fácil, Esc=Fechar
 */

export class ReviewOverlay {
  constructor() {
    this.host = null;
    this.cards = [];
    this.index = 0;
    this.visible = false;
    this._db = null;
    this._tts = null;
    this._createOperationId = null;
    this._answerBusy = false;
    this._pendingReview = null;
    this._loadError = false;
  }

  async init() {
    // Carrega dependências via proxy
    try {
      const [dbMod, ttsMod] = await Promise.all([
        import(chrome.runtime.getURL('utils/db.js')),
        import(chrome.runtime.getURL('utils/tts.js')),
      ]);
      this._db = dbMod.db;
      this._createOperationId = dbMod.createOperationId;
      this._tts = ttsMod.tts;
    } catch (e) {
      console.warn('[ReviewOverlay] Dependências indisponíveis:', e.message);
      return;
    }

    this._buildDOM();
    this._loadCards();
  }

  _buildDOM() {
    if (document.getElementById('lf-review-overlay')) return;

    this.host = document.createElement('div');
    this.host.id = 'lf-review-overlay';
    this.host.innerHTML = `
      <style>
        #lf-review-overlay {
          position: fixed; bottom: 100px; right: 20px; z-index: 2147483645;
          background: linear-gradient(145deg, #0f172a, #1e293b);
          border: 2px solid rgba(56,189,248,0.3);
          border-radius: 18px; padding: 24px;
          font-family: 'Inter', system-ui, sans-serif;
          color: #e2e8f0; width: 300px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.7);
          display: none; pointer-events: all;
          animation: lfSlideUp 0.3s ease-out;
        }
        @keyframes lfSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        #lf-review-overlay .lf-ro-word {
          font-size: 28px; font-weight: 900; color: #38bdf8;
          text-align: center; margin-bottom: 8px;
        }
        #lf-review-overlay .lf-ro-hint {
          font-size: 12px; color: #64748b; text-align: center; margin-bottom: 16px;
        }
        #lf-review-overlay .lf-ro-actions {
          display: flex; gap: 6px; justify-content: center;
        }
        #lf-review-overlay .lf-ro-btn {
          flex: 1; padding: 10px 6px; border: none; border-radius: 10px;
          font-size: 11px; font-weight: 700; cursor: pointer;
          font-family: inherit; transition: all 0.15s;
        }
        #lf-review-overlay .lf-ro-btn.again { background: #ef4444; color: white; }
        #lf-review-overlay .lf-ro-btn.hard { background: #f59e0b; color: white; }
        #lf-review-overlay .lf-ro-btn.good { background: #10b981; color: white; }
        #lf-review-overlay .lf-ro-btn.easy { background: #06b6d4; color: white; }
        #lf-review-overlay .lf-ro-btn:hover { filter: brightness(1.2); transform: translateY(-1px); }
        #lf-review-overlay .lf-ro-btn:disabled { cursor: wait; filter: grayscale(.25); opacity: .6; transform: none; }
        #lf-review-overlay .lf-ro-close {
          position: absolute; top: 8px; right: 12px;
          background: none; border: none; color: #64748b; cursor: pointer;
          font-size: 16px;
        }
        #lf-review-overlay .lf-ro-translation {
          font-size: 18px; font-weight: 700; color: #4ade80;
          text-align: center; margin-top: 6px; display: none;
        }
        #lf-review-overlay .lf-ro-empty {
          text-align: center; color: #64748b; font-size: 13px; padding: 10px;
        }
      </style>
      <button type="button" class="lf-ro-close" id="lf-ro-close" aria-label="Fechar revisão rápida">✕</button>
      <div class="lf-ro-word" id="lf-ro-word"></div>
      <div class="lf-ro-translation" id="lf-ro-translation"></div>
      <div class="lf-ro-hint" id="lf-ro-hint" role="status" aria-live="polite" aria-atomic="true">Pressione Espaço para revelar</div>
      <div class="lf-ro-actions" id="lf-ro-actions" style="display:none">
        <button type="button" class="lf-ro-btn again" data-q="1">1 Errei</button>
        <button type="button" class="lf-ro-btn hard" data-q="2">2 Difícil</button>
        <button type="button" class="lf-ro-btn good" data-q="3">3 Bom</button>
        <button type="button" class="lf-ro-btn easy" data-q="4">4 Fácil</button>
      </div>
    `;
    document.body.appendChild(this.host);

    // Handlers
    document.getElementById('lf-ro-close').addEventListener('click', () => this.hide());
    this.host.querySelectorAll('.lf-ro-btn').forEach((btn) => {
      btn.addEventListener('click', () => this._answer(parseInt(btn.dataset.q)));
    });

    // Keyboard
    this._keyHandler = (e) => {
      if (!this.visible || this._answerBusy) return;
      if (e.target.closest('input, textarea')) return;

      const actionsVisible = document.getElementById('lf-ro-actions').style.display !== 'none';
      if (!actionsVisible && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        e.stopPropagation();
        this._reveal();
        return;
      }
      if (actionsVisible && ['1', '2', '3', '4'].includes(e.key)) {
        // Sem isto, o player do YouTube consome 1-4 e salta o vídeo para
        // 10/20/30/40% em vez de registrar a nota (§4e.2 da auditoria).
        e.preventDefault();
        e.stopPropagation();
        this._answer(Number(e.key));
        return;
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.hide();
      }
    };
    // capture:true — o subtitle-engine registra o próprio keydown ANTES deste
    // overlay; na fase de bubble ele rodaria primeiro e o Espaço daria
    // play/pause no vídeo junto com o revelar (§4e.3). Captura vence a ordem.
    document.addEventListener('keydown', this._keyHandler, true);
  }

  async _loadCards() {
    if (!this._db) return;
    this._loadError = false;
    try {
      const due = await this._db.getCardsDue(10, true);
      if (!Array.isArray(due)) throw new Error('Fila de revisão indisponível');
      this.cards = due.filter((c) => c.wordData);
    } catch (e) {
      this.cards = [];
      this._loadError = true;
      console.warn('[ReviewOverlay] Erro ao carregar revisões:', e);
    }
  }

  show() {
    if (!this.host) return;
    this.index = 0;
    this.visible = true;
    this._render();
    this.host.style.display = 'block';
  }

  hide() {
    this.visible = false;
    if (this.host) this.host.style.display = 'none';
  }

  toggle() {
    if (this.visible) this.hide();
    else {
      this._loadCards().then(() => this.show());
    }
  }

  _render() {
    this._answerBusy = false;
    this._pendingReview = null;
    if (this.host) this.host.setAttribute('aria-busy', 'false');
    if (this._loadError) {
      document.getElementById('lf-ro-word').textContent = '⚠️';
      document.getElementById('lf-ro-hint').textContent = 'Não foi possível carregar as revisões. Feche e tente novamente.';
      document.getElementById('lf-ro-translation').style.display = 'none';
      document.getElementById('lf-ro-actions').style.display = 'none';
      return;
    }
    if (!this.cards.length || this.index >= this.cards.length) {
      document.getElementById('lf-ro-word').textContent = '🎉';
      document.getElementById('lf-ro-hint').textContent = 'Sem revisões pendentes!';
      document.getElementById('lf-ro-translation').style.display = 'none';
      document.getElementById('lf-ro-actions').style.display = 'none';
      return;
    }

    const card = this.cards[this.index];
    const word = card.wordData;
    this._currentCard = card;

    document.getElementById('lf-ro-word').textContent = word.word;
    document.getElementById('lf-ro-hint').textContent = 'Pressione Espaço para revelar';
    document.getElementById('lf-ro-translation').style.display = 'none';
    document.getElementById('lf-ro-translation').textContent = word.translation || '';
    document.getElementById('lf-ro-actions').style.display = 'none';

    if (this._tts) this._tts.play(word.word, 'en-US');
  }

  _reveal() {
    document.getElementById('lf-ro-translation').style.display = 'block';
    document.getElementById('lf-ro-hint').textContent = '1-Errei  2-Difícil  3-Bom  4-Fácil';
    document.getElementById('lf-ro-actions').style.display = 'flex';
  }

  async _answer(quality) {
    if (this._answerBusy || !this._currentCard) return;
    const card = this._currentCard;
    const operation = this._pendingReview || {
      cardId: card.id,
      quality,
      operationId: this._createOperationId(),
    };
    this._pendingReview = operation;
    this._answerBusy = true;
    this.host.setAttribute('aria-busy', 'true');
    this.host.querySelectorAll('.lf-ro-btn').forEach(btn => { btn.disabled = true; });
    document.getElementById('lf-ro-hint').textContent = 'Salvando avaliação…';
    try {
      const result = await this._db.logReview(card.id, operation.quality, null, null, operation.operationId);
      if (!result?.persisted) throw new Error('A gravação não foi confirmada');
      if (result?.outcome === 'ineligible') {
        this._pendingReview = null;
        const reasonMessages = {
          not_due: 'Este card ainda não venceu e continua aqui.',
          new_daily_limit: 'Limite de cards novos de hoje atingido; o card continua aqui.',
          suspended: 'Este card está suspenso e não foi alterado.',
          stale_card_state: 'O card mudou em outro lugar. Reabra a revisão rápida.',
        };
        document.getElementById('lf-ro-hint').textContent = reasonMessages[result.eligibilityReason]
          || 'Esta avaliação não era elegível; o card continua aqui.';
        if (result.eligibilityReason === 'stale_card_state') {
          await this._loadCards();
          this.index = 0;
          this._render();
        } else if (['not_due', 'new_daily_limit', 'suspended'].includes(result.eligibilityReason)) {
          this.cards.splice(this.index, 1);
          this._render();
          if (!this.cards.length) {
            document.getElementById('lf-ro-hint').textContent =
              'Nada elegível nesta fila. A prática livre continua disponível no app, sem alterar o placar.';
          }
        }
        return;
      }
      this._pendingReview = null;
      this.index++;
      if (this.index >= this.cards.length) {
        document.getElementById('lf-ro-word').textContent = '✅';
        document.getElementById('lf-ro-hint').textContent = result.idempotent
          ? 'A avaliação já estava salva. Revisões concluídas!'
          : 'Avaliação salva. Revisões concluídas!';
        document.getElementById('lf-ro-translation').style.display = 'none';
        document.getElementById('lf-ro-actions').style.display = 'none';
        setTimeout(() => this.hide(), 2000);
      } else {
        this._render();
      }
    } catch (e) {
      console.warn('[ReviewOverlay] Erro ao logar review:', e);
      // 4xx/falha funcional confirma que nada foi aceito; uma nova escolha
      // pode receber outro id. Offline/timeout/auth preservam o id porque a
      // resposta pode ter se perdido depois do commit.
      if (!e?.retryable && e?.kind !== 'auth') this._pendingReview = null;
      const message = e?.kind === 'offline'
        ? 'Sem conexão. A avaliação não foi salva; este card continua aqui.'
        : e?.kind === 'auth'
          ? 'Sua sessão expirou. Entre novamente para salvar esta avaliação.'
          : e?.retryable
            ? 'Ainda não foi possível confirmar. Tente novamente; a avaliação não será duplicada.'
            : 'Não foi possível salvar. Este card continua aqui; tente novamente.';
      document.getElementById('lf-ro-hint').textContent = message;
    } finally {
      if (this._currentCard === card) {
        this._answerBusy = false;
        this.host.setAttribute('aria-busy', 'false');
        this.host.querySelectorAll('.lf-ro-btn').forEach(btn => { btn.disabled = false; });
      }
    }
  }

  destroy() {
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler, true);
    if (this.host) this.host.remove();
  }
}
