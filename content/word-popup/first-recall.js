// content/word-popup/first-recall.js — Primeira lembrança: pergunta de recordação mostrada na primeira vez que a palavra aparece.
export class FirstRecallMethods {
  // A1 (W1): microetapa de primeira recuperacao. Frase com o termo oculto +
  // 3 sentidos (1 correto + 2 distratores do proprio cofre). Sem cronometro,
  // Pular sempre visivel, video nunca e retomado no meio. O resultado vai
  // para uma fila local (QUEUE_FIRST_RECALL) que o service worker drena
  // quando o card existir no banco — mesmo padrao local-first do save.
  _maybeShowFirstRecall(contextSession, fallbackTranslation) {
    if (!contextSession?.save || contextSession.recallStarted) return;
    if (contextSession.context && !contextSession.contextResolved) return;
    contextSession.recallStarted = true;
    this._showFirstRecall(contextSession.translation || fallbackTranslation);
  }

  async _showFirstRecall(translation) {
    try {
      const correct = String(translation || '').trim();
      if (!correct || correct === '...') return;
      const savedWord = this.word;
      const BASE = chrome.runtime.getURL('utils/');
      const { db } = await import(BASE + 'db.js');
      const words = await db.getAllWords().catch(() => []);
      if (this.word !== savedWord) return; // usuario ja clicou outra palavra

      const pool = (words || [])
        .map((w) => String(w.translation || '').trim())
        .filter((t) => t && t !== '...' && t.toLowerCase() !== correct.toLowerCase());
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const distractors = [...new Set(pool)].slice(0, 2);
      if (distractors.length < 2) return; // cofre pequeno: pula em silencio

      const options = [correct, ...distractors];
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }

      const sentence = this.saveContext || this.context || '';
      const esc = (v) => this._escapeAttr(v);
      let cloze = esc(sentence);
      try {
        const re = new RegExp('\\b(' + this._escapeRegExp(esc(savedWord)) + ')\\b', 'gi');
        cloze = cloze.replace(re, '<span style="border-bottom:2px dashed #7dd3fc;color:transparent;text-shadow:0 0 14px rgba(125,211,252,.9);">$1</span>');
      } catch { /* sem cloze, mostra a frase */ }

      this.popup.querySelector('#lfp-recall')?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'lfp-recall';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'lfp-recall-title');
      overlay.setAttribute('tabindex', '-1');
      overlay.style.cssText = 'position:absolute;inset:0;z-index:60;background:#0b1220;border-radius:inherit;display:flex;flex-direction:column;gap:10px;padding:18px;overflow:auto;';
      overlay.innerHTML = `
        <div id="lfp-recall-title" style="font-size:12px;font-weight:800;letter-spacing:.06em;color:#7dd3fc;">SALVA! E O SENTIDO, FICOU?</div>
        <div style="font-size:15px;line-height:1.55;color:#e2e8f0;">${cloze || esc(savedWord)}</div>
        <div style="font-size:12px;color:#94a3b8;">O que <b style="color:#7dd3fc;">${esc(savedWord)}</b> significa aqui?</div>
        <div id="lfp-recall-opts" style="display:flex;flex-direction:column;gap:8px;">
          ${options.map((opt) => `<button type="button" data-opt="${esc(opt)}" style="text-align:left;padding:10px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.3);background:rgba(148,163,184,.08);color:#e2e8f0;font-size:13px;font-weight:700;cursor:pointer;">${esc(opt)}</button>`).join('')}
        </div>
        <button type="button" id="lfp-recall-skip" style="margin-top:auto;align-self:center;background:none;border:none;color:#94a3b8;font-size:12px;cursor:pointer;text-decoration:underline;">Pular</button>`;
      this.popup.appendChild(overlay);
      overlay.querySelector('[data-opt]')?.focus({ preventScroll: true });

      const finish = (quality) => {
        try {
          chrome.runtime.sendMessage({
            type: 'QUEUE_FIRST_RECALL',
            payload: { word: savedWord, lang: this.engine?.sourceLang || 'en', quality },
          });
        } catch { /* fila e melhor-esforco; o save ja esta garantido */ }
      };

      overlay.querySelector('#lfp-recall-skip').onclick = () => {
        overlay.remove();
        this.popup.querySelector('#fx')?.focus({ preventScroll: true });
      };
      overlay.querySelectorAll('[data-opt]').forEach((btn) => {
        btn.onclick = () => {
          const isCorrect = btn.dataset.opt.toLowerCase() === correct.toLowerCase();
          overlay.querySelectorAll('[data-opt]').forEach((b) => {
            b.disabled = true;
            if (b.dataset.opt.toLowerCase() === correct.toLowerCase()) {
              b.style.background = 'rgba(134,239,172,.18)';
              b.style.borderColor = '#86efac';
            }
          });
          if (!isCorrect) { btn.style.background = 'rgba(248,113,113,.18)'; btn.style.borderColor = '#f87171'; }
          finish(isCorrect ? 3 : 1);
          setTimeout(() => { overlay.remove(); this.hide(true); }, 1100);
        };
      });
    } catch (e) {
      console.warn('[WordPopup] first recall indisponivel:', e);
    }
  }
}
