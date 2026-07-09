/**
 * LinguaFlow Web Reader — Modo Leitura para qualquer site
 * Ativado por duplo-clique em palavra ou seleção de texto.
 * Exibe popup de tradução + salvar nos flashcards sem sair da página.
 */

(async function WebReader() {
  // Não ativar em sites de vídeo (já têm o subtitle engine)
  const hostname = window.location.hostname;
  const videoSites = [
    'youtube.com',
    'netflix.com',
    'hbomax.com',
    'max.com',
    'hbo.com',
    'disneyplus.com',
    'primevideo.com',
    'amazon.com',
  ];
  if (videoSites.some((s) => hostname.includes(s))) return;

  // Evita dupla injeção
  if (window.__LF_READER_LOADED__) return;
  window.__LF_READER_LOADED__ = true;

  console.debug('[LinguaFlow Reader] Modo Leitura ativado em:', hostname);

  // ── Dependências ──────────────────────────────────────────────────────────
  let db,
    tts,
    offlineDict,
    popupEl = null,
    currentWord = '',
    currentContext = '';

  try {
    const [dbMod, ttsMod, dictMod] = await Promise.all([
      import(chrome.runtime.getURL('utils/db.js')),
      import(chrome.runtime.getURL('utils/tts.js')),
      import(chrome.runtime.getURL('utils/offline-dict.js')),
    ]);
    db = dbMod.db;
    tts = ttsMod.tts;
    offlineDict = dictMod.offlineDict;
  } catch (e) {
    console.warn('[LinguaFlow Reader] Falha ao carregar dependências:', e.message);
    return;
  }

  // ── Cache de tradução ─────────────────────────────────────────────────────
  const translateCache = new Map();
  const TRANSLATE_CACHE_MAX = 500;

  async function quickTranslate(word) {
    const key = word.toLowerCase();
    if (translateCache.has(key)) return translateCache.get(key);

    // 1. Offline dict
    const entry = await offlineDict.lookup(word);
    if (entry) {
      translateCache.set(key, entry.def);
      if (translateCache.size > TRANSLATE_CACHE_MAX) translateCache.clear();
      return entry.def;
    }

    // 2. Google Translate
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(word)}`;
      const res = await fetch(url);
      const data = await res.json();
      const translation = data?.[0]?.map((s) => s[0]).join('') || '';
      if (translation) {
        translateCache.set(key, translation);
        if (translateCache.size > TRANSLATE_CACHE_MAX) translateCache.clear();
        return translation;
      }
    } catch (e) {
      /* fallthrough */
    }

    return null;
  }

  // ── Popup UI ──────────────────────────────────────────────────────────────
  function buildPopup() {
    if (popupEl) return;
    popupEl = document.createElement('div');
    popupEl.id = 'lf-reader-popup';
    popupEl.innerHTML = `
      <style>
        #lf-reader-popup {
          position: fixed; z-index: 2147483646;
          background: #0f172a; color: #e2e8f0;
          border: 1px solid rgba(56,189,248,0.3);
          border-radius: 14px; padding: 16px 20px;
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 14px; max-width: 340px; min-width: 220px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.7);
          display: none; pointer-events: all;
        }
        #lf-reader-popup .lf-r-word {
          font-size: 22px; font-weight: 800; color: #38bdf8; margin-bottom: 6px;
        }
        #lf-reader-popup .lf-r-translation {
          font-size: 18px; font-weight: 700; color: #4ade80; margin-bottom: 10px;
        }
        #lf-reader-popup .lf-r-actions {
          display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;
        }
        #lf-reader-popup .lf-r-btn {
          padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05); color: #94a3b8;
          cursor: pointer; font-size: 12px; font-weight: 700;
          transition: all 0.15s; font-family: inherit;
          white-space: nowrap;
        }
        #lf-reader-popup .lf-r-btn:hover {
          background: rgba(56,189,248,0.15); color: #38bdf8; border-color: rgba(56,189,248,0.3);
        }
        #lf-reader-popup .lf-r-btn.primary {
          background: linear-gradient(135deg, #1e40af, #3b82f6); color: white;
          border-color: transparent; box-shadow: 0 2px 10px rgba(59,130,246,0.3);
        }
        #lf-reader-popup .lf-r-close {
          position: absolute; top: 8px; right: 12px;
          background: none; border: none; color: #64748b; cursor: pointer;
          font-size: 18px; line-height: 1;
        }
        #lf-reader-popup .lf-r-loading {
          color: #64748b; font-style: italic; font-size: 13px;
        }
      </style>
      <button class="lf-r-close" id="lf-r-close">✕</button>
      <div class="lf-r-word" id="lf-r-word"></div>
      <div class="lf-r-translation" id="lf-r-translation"></div>
      <div class="lf-r-actions">
        <button class="lf-r-btn" id="lf-r-speak">🔊 Ouvir</button>
        <button class="lf-r-btn primary" id="lf-r-save">💾 Salvar</button>
        <button class="lf-r-btn" id="lf-r-dashboard">📚 Dashboard</button>
      </div>
    `;
    document.body.appendChild(popupEl);

    document.getElementById('lf-r-close').addEventListener('click', hidePopup);
    document
      .getElementById('lf-r-speak')
      .addEventListener('click', () => tts.play(currentWord, 'en-US'));
    document.getElementById('lf-r-save').addEventListener('click', saveWord);
    document.getElementById('lf-r-dashboard').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
    });
  }

  function showPopup(x, y, word, translation) {
    buildPopup();
    currentWord = word;
    document.getElementById('lf-r-word').textContent = word;
    const transEl = document.getElementById('lf-r-translation');
    const saveBtn = document.getElementById('lf-r-save');

    if (translation) {
      transEl.textContent = translation;
      transEl.classList.remove('lf-r-loading');
      saveBtn.style.display = '';
    } else {
      transEl.textContent = 'Traduzindo...';
      transEl.classList.add('lf-r-loading');
      saveBtn.style.display = 'none';
    }

    // Posiciona perto da palavra, evitando bordas
    const vw = window.innerWidth,
      vh = window.innerHeight;
    let px = Math.min(x + 10, vw - 360);
    let py = Math.min(y + 24, vh - 200);
    px = Math.max(10, px);
    py = Math.max(10, py);

    popupEl.style.left = px + 'px';
    popupEl.style.top = py + 'px';
    popupEl.style.display = 'block';
  }

  function hidePopup() {
    if (popupEl) popupEl.style.display = 'none';
  }

  async function saveWord() {
    if (!currentWord) return;
    const btn = document.getElementById('lf-r-save');
    btn.textContent = '⏳ Salvando...';
    btn.disabled = true;
    try {
      const translation = await quickTranslate(currentWord);
      await db.saveWord({
        word: currentWord,
        translation: translation || '',
        lang: 'en',
        context_sentence: currentContext || '',
        added_at: Date.now(),
      });
      btn.textContent = '✅ Salvo!';
      btn.style.background = '#10b981';
      setTimeout(() => {
        btn.textContent = '💾 Salvar';
        btn.style.background = '';
        btn.disabled = false;
      }, 1500);

      // Notifica outras abas
      chrome.runtime.sendMessage({ type: 'WORD_SAVED' }).catch(() => {});
    } catch (e) {
      btn.textContent = '❌ Erro';
      btn.disabled = false;
    }
  }

  // ── Interação com Texto ───────────────────────────────────────────────────
  async function handleWordClick(e) {
    // Ignora inputs, textareas, contenteditable
    if (e.target.closest('input, textarea, [contenteditable="true"], #lf-reader-popup')) return;

    const selection = window.getSelection();
    let word = '';

    if (selection.toString().trim()) {
      // Usuário selecionou texto manualmente
      word = selection.toString().trim().split(/\s+/)[0]; // primeira palavra
      currentContext = selection.toString().trim();
    } else if (e.target.nodeType === Node.TEXT_NODE || e.target.tagName === 'SPAN') {
      // Duplo-clique em palavra
      word = getWordAtPoint(e.clientX, e.clientY);
      // Pega contexto (+/- 60 chars ao redor)
      const node = e.target;
      const text = node.textContent || '';
      const idx = text.indexOf(word);
      if (idx >= 0) {
        currentContext = text.substring(
          Math.max(0, idx - 40),
          Math.min(text.length, idx + word.length + 40),
        );
      }
    }

    word = word.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ'’-]/g, '').trim();
    if (!word || word.length < 2 || word.length > 40) return;

    showPopup(e.clientX, e.clientY, word, null);

    // Tradução assíncrona
    const translation = await quickTranslate(word);
    const transEl = document.getElementById('lf-r-translation');
    const saveBtn = document.getElementById('lf-r-save');
    if (transEl && popupEl.style.display !== 'none') {
      transEl.textContent = translation || '(sem tradução)';
      transEl.classList.remove('lf-r-loading');
      if (saveBtn) saveBtn.style.display = '';
    }
  }

  function getWordAtPoint(x, y) {
    // Usa caretRangeFromPoint para capturar palavra exata
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(x, y);
      if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
        const text = range.startContainer.textContent;
        const offset = range.startOffset;

        // Expande para esquerda até espaço/pontuação
        let start = offset;
        while (start > 0 && /[\wÀ-ÖØ-öø'’-]/.test(text[start - 1])) start--;

        // Expande para direita
        let end = offset;
        while (end < text.length && /[\wÀ-ÖØ-öø'’-]/.test(text[end])) end++;

        return text.substring(start, end).trim();
      }
    }
    return '';
  }

  // ── Event Listeners ───────────────────────────────────────────────────────
  document.addEventListener('dblclick', handleWordClick);
  document.addEventListener('mouseup', (e) => {
    // Se houve seleção de texto com o mouse, mostra popup após 300ms
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 1 && sel.toString().trim().length < 200) {
      setTimeout(() => handleWordClick(e), 300);
    }
  });

  // Fecha popup ao clicar fora
  document.addEventListener('click', (e) => {
    if (popupEl && popupEl.style.display !== 'none' && !popupEl.contains(e.target)) {
      hidePopup();
    }
  });

  // Tecla Escape fecha popup
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hidePopup();
  });

  console.debug('[LinguaFlow Reader] ✅ Pronto — duplo-clique em qualquer palavra para traduzir.');
})();
