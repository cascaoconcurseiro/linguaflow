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
  }

  async init() {
    // Carrega dependências via proxy
    try {
      const [dbMod, ttsMod] = await Promise.all([
        import(chrome.runtime.getURL('utils/db.js')),
        import(chrome.runtime.getURL('utils/tts.js')),
      ]);
      this._db = dbMod.db;
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
      <button class="lf-ro-close" id="lf-ro-close">✕</button>
      <div class="lf-ro-word" id="lf-ro-word"></div>
      <div class="lf-ro-translation" id="lf-ro-translation"></div>
      <div class="lf-ro-hint" id="lf-ro-hint">Pressione Espaço para revelar</div>
      <div class="lf-ro-actions" id="lf-ro-actions" style="display:none">
        <button class="lf-ro-btn again" data-q="1">1 Errei</button>
        <button class="lf-ro-btn hard" data-q="2">2 Difícil</button>
        <button class="lf-ro-btn good" data-q="3">3 Bom</button>
        <button class="lf-ro-btn easy" data-q="4">4 Fácil</button>
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
      if (!this.visible) return;
      if (e.target.closest('input, textarea')) return;

      const actionsVisible = document.getElementById('lf-ro-actions').style.display !== 'none';
      if (!actionsVisible && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        this._reveal();
        return;
      }
      if (actionsVisible) {
        if (e.key === '1') this._answer(1);
        else if (e.key === '2') this._answer(2);
        else if (e.key === '3') this._answer(3);
        else if (e.key === '4') this._answer(4);
      }
      if (e.key === 'Escape') this.hide();
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  async _loadCards() {
    if (!this._db) return;
    try {
      const due = await this._db.getCardsDue(10, true);
      this.cards = due.filter((c) => c.wordData);
    } catch (e) {
      this.cards = [];
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
    if (!this._currentCard) return;
    try {
      await this._db.logReview(this._currentCard.id, quality);
    } catch (e) {
      console.warn('[ReviewOverlay] Erro ao logar review:', e);
    }

    this.index++;
    if (this.index >= this.cards.length) {
      document.getElementById('lf-ro-word').textContent = '✅';
      document.getElementById('lf-ro-hint').textContent = 'Revisões concluídas!';
      document.getElementById('lf-ro-translation').style.display = 'none';
      document.getElementById('lf-ro-actions').style.display = 'none';
      setTimeout(() => this.hide(), 2000);
    } else {
      this._render();
    }
  }

  destroy() {
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    if (this.host) this.host.remove();
  }
}
