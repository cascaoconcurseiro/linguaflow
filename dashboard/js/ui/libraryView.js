import { db as lfDb } from '../../../utils/db.js';
import { generateChunksWeb } from '../core/ai.js';
import { attachVideoContext, renderVideoContext } from '../core/videoContext.js';
import { bindViewStateAction, renderViewState } from './viewState.js';

let allWords = [];
let filteredWords = [];
let cardByWordId = {};
let currentCategory = 'all'; // all, words, phrasal, slang, idioms
let currentLetter = null; // 'A', 'B', etc. or null for all
let currentStatus = 'all'; // all, due, learning, mature, suspended
let searchQuery = '';

const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;

export async function renderLibrary(container, app) {
  injectStyles();
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = renderViewState({ kind: 'loading', title: 'Abrindo seu Cofre…', message: 'Organizando suas frases salvas.' });

  try {
    const [words, cards] = await Promise.all([lfDb.getAllWords(), lfDb.getAllCards()]);
    cardByWordId = {};
    cards.forEach(c => { cardByWordId[c.word_id] = c; });
    // Default to 'words' if category doesn't exist to avoid empty states
    allWords = words.map(w => ({
      ...w,
      category: w.category || _inferCategory(w.word)
    })).filter(w => w.category !== 'sentence');
  } catch (err) {
    console.error("Failed to load library", err);
    container.innerHTML = renderViewState({ kind: 'error', title: 'Não foi possível abrir seu Cofre', message: 'Suas frases continuam seguras. Verifique a conexão e tente novamente.', actionLabel: 'Tentar novamente', actionId: 'btn-library-retry' });
    bindViewStateAction(container, 'btn-library-retry', () => renderLibrary(container, app));
    container.setAttribute('aria-busy', 'false');
    return;
  }

  container.setAttribute('aria-busy', 'false');
  renderUI(container, app);
}

function _inferCategory(word) {
    const lower = (word||'').toLowerCase();
    const parts = lower.split(' ').filter(p => p.trim() !== '');
    if (parts.length > 4) return 'sentence';
    if (parts.length === 1) return 'word';
    const particles = ['up', 'out', 'in', 'off', 'on', 'down', 'away', 'over'];
    if (parts.length === 2 && particles.includes(parts[1])) return 'phrasal';
    if (parts.length > 2) return 'idiom';
    return 'word';
}

function renderUI(container, app) {
  if (app.currentRoute !== 'library') return;

  // Filter logic
  filteredWords = allWords;
  if (currentCategory !== 'all') {
      const catMap = { 'words': 'word', 'phrasal': 'phrasal', 'slang': 'slang', 'idioms': 'idiom' };
      filteredWords = filteredWords.filter(w => w.category === catMap[currentCategory]);
  }
  if (currentLetter) {
      filteredWords = filteredWords.filter(w => (w.word||'').toUpperCase().startsWith(currentLetter));
  }
  if (searchQuery) {
      const query = searchQuery.toLocaleLowerCase('pt-BR');
      filteredWords = filteredWords.filter(w => [w.word, w.translation, w.context_sentence, w.video_title]
        .some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(query)));
  }
  if (currentStatus !== 'all') {
      filteredWords = filteredWords.filter(w => {
        const card = cardByWordId[w.id];
        if (currentStatus === 'suspended') return !!card?.suspended;
        if (!card || card.suspended) return false;
        if (currentStatus === 'due') return card.due_date && new Date(card.due_date).getTime() <= Date.now();
        if (currentStatus === 'learning') return card.status === 'new' || card.status === 'learning';
        if (currentStatus === 'mature') return card.status === 'mature';
        return true;
      });
  }
  filteredWords.sort((a, b) => (a.word||'').localeCompare(b.word||''));

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const missingContext = allWords.filter(w => w.category !== 'sentence' && (!w.context_sentence || w.context_sentence === w.word || w.context_sentence.trim() === '' || !w.ai_chunks));
  let bannerHtml = '';
  if (missingContext.length > 0) {
    bannerHtml = `
      <div id="ai-backfill-banner" style="background: var(--color-primary); color: white; padding: 12px 20px; border-radius: var(--radius-md); margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(88,204,2,0.3);">
        <div style="font-weight: 600; display:flex; align-items:center; gap:8px;">
          <span style="font-size:20px;">✨</span> 
          <span><strong>${missingContext.length} itens antigos</strong> estão sem detalhes de apoio. Complete-os antes da próxima revisão.</span>
        </div>
        <button id="btn-run-backfill" style="background: var(--color-surface); color: var(--color-success-text); border: none; padding: 8px 16px; border-radius: var(--radius-sm); font-weight: 800; cursor: pointer; transition: color var(--motion-fast), background-color var(--motion-fast);">Completar detalhes</button>
      </div>
    `;
  }

  container.innerHTML = `
    ${bannerHtml}
    <div class="library-container">
      <div class="lib-header">
        <div class="lib-title-block">
          <h2>Seu Cofre</h2>
          <p>Frases salvas, expressões-alvo e seus contextos originais.</p>
        </div>
        <div class="lib-stats">
          <div class="stat-number">${filteredWords.length}</div>
          <div class="stat-lbl">Itens</div>
        </div>
      </div>

      <label class="lib-search" for="library-search">
        <span class="sr-only">Buscar no Cofre</span>
        <input id="library-search" type="search" value="${searchQuery.replace(/"/g, '&quot;')}" placeholder="Buscar palavra, tradução, frase ou vídeo" autocomplete="off">
      </label>

      <!-- Category chips: o filtro mais frequente fica sempre visível. -->
      <div class="cat-tabs" aria-label="Filtrar por tipo">
        <button class="cat-tab ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">Tudo</button>
        <button class="cat-tab ${currentCategory === 'words' ? 'active' : ''}" data-cat="words">Palavras</button>
        <button class="cat-tab ${currentCategory === 'phrasal' ? 'active' : ''}" data-cat="phrasal">Phrasal Verbs</button>
        <button class="cat-tab ${currentCategory === 'slang' ? 'active' : ''}" data-cat="slang">Gírias</button>
        <button class="cat-tab ${currentCategory === 'idioms' ? 'active' : ''}" data-cat="idioms">Expressões</button>
        ${currentCategory !== 'all' ? `<button class="btn btn-secondary" id="btn-review-topic" style="margin-left:auto; padding:8px 16px; font-size:13px;" title="Revisar apenas os itens desta categoria">🧠 Revisar este tópico</button>` : ''}
      </div>

      <details class="lib-filters" ${currentLetter || currentStatus !== 'all' ? 'open' : ''}>
        <summary>Mais filtros <span>${currentLetter || currentStatus !== 'all' ? '· ativos' : ''}</span></summary>
        <div class="status-chips" aria-label="Filtrar por estado">
          ${[['all','Todos'],['due','Para hoje'],['learning','Começando'],['mature','Memória estável'],['suspended','Pausados']].map(([value,label]) => `<button class="status-chip ${currentStatus === value ? 'active' : ''}" type="button" data-status="${value}">${label}</button>`).join('')}
        </div>
        <div class="az-grid" aria-label="Filtrar por letra inicial">
          <button class="az-letter ${currentLetter === null ? 'active' : ''}" data-letter="ALL">Todas</button>
          ${alphabet.map(l => `<button class="az-letter ${currentLetter === l ? 'active' : ''}" data-letter="${l}">${l}</button>`).join('')}
        </div>
      </details>

      <!-- Words List -->
      <div class="words-list">
        ${filteredWords.length === 0 ? `
          <div class="empty-state" role="status">
            <strong>${allWords.length ? 'Nenhuma frase corresponde a estes filtros.' : 'Seu Cofre ainda está vazio.'}</strong>
            <span>${allWords.length ? 'Limpe os filtros para voltar à coleção completa.' : 'Adicione uma expressão à revisão a partir de um vídeo para começar.'}</span>
            ${allWords.length ? '<button type="button" class="btn btn-secondary" id="btn-clear-library-filters">Limpar filtros</button>' : ''}
          </div>
        ` : `
          ${filteredWords.map(w => {
            const card = cardByWordId[w.id];
            const suspended = !!(card && card.suspended);
            return `
            <div class="word-card" style="${suspended ? 'opacity:0.55;' : ''}">
              <div class="word-info">
                <div class="word-main">${w.word} ${suspended ? '<span style="font-size:11px; font-weight:800; color:var(--color-warning); border:1px solid var(--color-warning); border-radius:6px; padding:1px 6px; vertical-align:middle;">SUSPENSO</span>' : ''}</div>
                <div class="word-trans">${w.translation}</div>
                ${renderVideoContext(w, `library-video-${w.id}`)}
              </div>
              <div class="word-actions">
                ${renderStatus(w.reps)}
                <details class="word-action-menu">
                  <summary aria-label="Abrir ações para ${w.word}">Ações</summary>
                  <div>
                    <button class="btn-edit-word" data-id="${w.id}">Editar</button>
                    ${card ? `<button class="btn-suspend" data-card-id="${card.id}">${suspended ? 'Reativar no estudo' : 'Suspender do estudo'}</button>` : ''}
                    <button class="btn-delete" data-id="${w.id}">Excluir</button>
                  </div>
                </details>
              </div>
            </div>
          `;}).join('')}
        `}
      </div>
    </div>
  `;

  // Listeners
  document.querySelectorAll('.cat-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
          currentCategory = e.target.dataset.cat;
          renderUI(container, app);
      });
  });
  const searchInput = document.getElementById('library-search');
  searchInput?.addEventListener('input', (event) => {
      searchQuery = event.currentTarget.value.trim();
      renderUI(container, app);
      requestAnimationFrame(() => {
        const next = document.getElementById('library-search');
        next?.focus({ preventScroll: true });
        next?.setSelectionRange(searchQuery.length, searchQuery.length);
      });
  });
  document.querySelectorAll('.status-chip').forEach(btn => btn.addEventListener('click', (event) => {
      currentStatus = event.currentTarget.dataset.status;
      renderUI(container, app);
  }));
  document.getElementById('btn-clear-library-filters')?.addEventListener('click', () => {
      currentCategory = 'all';
      currentLetter = null;
      currentStatus = 'all';
      searchQuery = '';
      renderUI(container, app);
  });

  // Onda 2.2: "Revisar este tópico" manda pro Estudo já filtrado pela
  // categoria selecionada — mesma chave 'category' que o card carrega
  // (word/phrasal/slang/idiom), não o rótulo da aba.
  document.getElementById('btn-review-topic')?.addEventListener('click', () => {
      const catMap = { 'words': 'word', 'phrasal': 'phrasal', 'slang': 'slang', 'idioms': 'idiom' };
      const category = catMap[currentCategory];
      if (category) app.navigate('study', { category });
  });

  document.querySelectorAll('.az-letter').forEach(btn => {
      btn.addEventListener('click', (e) => {
          const l = e.target.dataset.letter;
          currentLetter = l === 'ALL' ? null : l;
          renderUI(container, app);
      });
  });

  document.querySelectorAll('.btn-edit-word').forEach(btn => {
      btn.addEventListener('click', (e) => {
          const id = e.currentTarget.dataset.id;
          const w = allWords.find(x => x.id === id);
          if (w) openWordEditor(w, app, container);
      });
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
          if(confirm('Tem certeza que deseja excluir este item?')) {
              // IDs são UUIDs — o parseInt antigo quebrava a exclusão
              const id = e.currentTarget.dataset.id;
              try {
                await lfDb.deleteWord(id);
              } catch (err) {
                console.error(err);
                const reviewed = /reviewed_word_cannot_be_deleted/.test(err?.message || '');
                app.showToast(
                  reviewed
                    ? 'Este card já tem histórico. Suspenda-o para preservar seu progresso.'
                    : 'Erro ao excluir.',
                  reviewed ? 'info' : 'error'
                );
                return;
              }
              allWords = allWords.filter(w => w.id !== id);
              renderUI(container, app);
              app.showToast('Item excluído.', 'info');
          }
      });
  });

  // Suspender/reativar card (pausa do estudo sem perder o progresso — Anki)
  document.querySelectorAll('.btn-suspend').forEach(btn => {
      btn.addEventListener('click', async (e) => {
          const cardId = e.currentTarget.dataset.cardId;
          const card = Object.values(cardByWordId).find(c => c.id === cardId);
          if (!card) return;
          try {
            await lfDb.setCardSuspended(card.id, !card.suspended);
            card.suspended = !card.suspended;
            renderUI(container, app);
            app.showToast(card.suspended ? 'Card suspenso ⏸️' : 'Card reativado ▶️', 'info');
          } catch (err) {
            console.error(err);
            app.showToast('Erro ao alterar o card.', 'error');
          }
      });
  });

  attachVideoContext(container);

  // Backfill btn logic
  const backfillBtn = document.getElementById('btn-run-backfill');
  if (backfillBtn) {
    backfillBtn.addEventListener('click', async () => {
      backfillBtn.disabled = true;
      backfillBtn.textContent = 'Gerando...';
      const bannerText = document.querySelector('#ai-backfill-banner span:nth-child(2)');
      
      const missing = allWords.filter(w => w.category !== 'sentence' && (!w.context_sentence || w.context_sentence === w.word || w.context_sentence.trim() === '' || !w.ai_chunks));
      let count = 0;
      
      for (const w of missing) {
        bannerText.innerHTML = `Gerando para: <strong>${w.word}</strong> (${count + 1}/${missing.length})... Pode demorar um pouco.`;
        try {
          const res = isExtension
            ? await new Promise(resolve => {
                chrome.runtime.sendMessage({ action: 'ai_generate_chunks', word: w.word }, resolve);
              })
            : { chunks: await generateChunksWeb(w.word).catch(() => []) };
          if (res && res.chunks && res.chunks.length > 0) {
            const hasGoodVideoContext = w.context_sentence && w.context_sentence !== w.word && w.context_sentence.split(' ').length > 2;
            if (!hasGoodVideoContext) {
              w.context_sentence = res.chunks[0].eng || res.chunks[0].ingles || res.chunks[0].english;
            }
            w.ai_chunks = JSON.stringify(res.chunks);
            await lfDb.saveWord(w);
          }
        } catch (e) {
          console.warn(e);
        }
        count++;
        // Esperar 2 segundos para nao dar rate limit excessivo se o usuario forçou
        await new Promise(r => setTimeout(r, 2000));
      }
      
      bannerText.innerHTML = '✨ Todas as frases foram geradas com sucesso!';
      backfillBtn.style.display = 'none';
      setTimeout(() => renderLibrary(container, app), 2000);
    });
  }
}

// Editor do Cofre (Onda 2.3): corrige tradução/frase/categoria/nível sem
// apagar o card — o histórico FSRS (interval/ease/lapses) fica intocado,
// só os metadados da palavra mudam. Modal anexado ao <body> pra sobreviver
// aos re-renders de renderUI().
const CATEGORY_OPTIONS = [['word', 'Palavra'], ['phrasal', 'Phrasal Verb'], ['slang', 'Gíria'], ['idiom', 'Expressão']];
const LEVEL_OPTIONS = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function openWordEditor(w, app, container) {
  document.getElementById('lf-word-edit-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'lf-word-edit-modal';
  modal.style.cssText = 'display:flex; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.4); z-index:9999; justify-content:center; align-items:center; backdrop-filter: blur(2px);';
  modal.innerHTML = `
    <div style="background:var(--color-surface); border-radius:var(--radius-md); width:90%; max-width:420px; padding:24px; position:relative; box-shadow:0 8px 24px rgba(0,0,0,0.15); max-height:85vh; overflow-y:auto;">
      <button id="lf-edit-close" style="position:absolute; top:12px; right:12px; background:none; border:none; font-size:20px; color:var(--color-text-light); cursor:pointer; padding:4px;">&times;</button>
      <h2 style="font-size:20px; font-weight:800; color:var(--color-text); margin:0 0 16px 0;">✏️ ${w.word}</h2>

      <label style="display:block; font-size:12px; font-weight:700; color:var(--color-text-light); margin-bottom:4px;">Tradução</label>
      <input id="lf-edit-translation" type="text" value="${(w.translation || '').replace(/"/g, '&quot;')}" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:8px; background:var(--color-bg); color:var(--color-text); font-size:14px; margin-bottom:14px;" />

      <label style="display:block; font-size:12px; font-weight:700; color:var(--color-text-light); margin-bottom:4px;">Frase de contexto</label>
      <textarea id="lf-edit-sentence" rows="3" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:8px; background:var(--color-bg); color:var(--color-text); font-size:14px; margin-bottom:14px; resize:vertical; font-family:inherit;">${(w.context_sentence || '').replace(/</g, '&lt;')}</textarea>

      <div style="display:flex; gap:12px; margin-bottom:14px;">
        <div style="flex:1;">
          <label style="display:block; font-size:12px; font-weight:700; color:var(--color-text-light); margin-bottom:4px;">Categoria</label>
          <select id="lf-edit-category" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:8px; background:var(--color-bg); color:var(--color-text); font-size:14px;">
            ${CATEGORY_OPTIONS.map(([v, label]) => `<option value="${v}" ${w.category === v ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1;">
          <label style="display:block; font-size:12px; font-weight:700; color:var(--color-text-light); margin-bottom:4px;">Nível CEFR</label>
          <select id="lf-edit-level" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:8px; background:var(--color-bg); color:var(--color-text); font-size:14px;">
            ${LEVEL_OPTIONS.map(v => `<option value="${v}" ${((w.level || '') === v) ? 'selected' : ''}>${v || '—'}</option>`).join('')}
          </select>
        </div>
      </div>

      <button id="lf-edit-save" class="btn btn-primary" style="width:100%; padding:12px; font-size:15px;">💾 Salvar</button>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  modal.querySelector('#lf-edit-close').addEventListener('click', close);

  modal.querySelector('#lf-edit-save').addEventListener('click', async () => {
    const saveBtn = modal.querySelector('#lf-edit-save');
    const patch = {
      translation: modal.querySelector('#lf-edit-translation').value.trim(),
      context_sentence: modal.querySelector('#lf-edit-sentence').value.trim(),
      category: modal.querySelector('#lf-edit-category').value,
      level: modal.querySelector('#lf-edit-level').value || null,
    };
    if (!patch.translation) {
      app.showToast('A tradução não pode ficar vazia.', 'error');
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = 'Salvando...';
    try {
      await lfDb.updateWord(w.id, patch);
      Object.assign(w, patch);
      close();
      renderUI(container, app);
      app.showToast('Card atualizado ✅', 'info');
    } catch (err) {
      console.error(err);
      app.showToast('Erro ao salvar as alterações.', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Salvar';
    }
  });
}

function renderStatus(reps) {
    if (!reps || reps === 0) return `<span class="badge badge-new">Novo</span>`;
    if (reps < 3) return `<span class="badge badge-learning">Aprendendo</span>`;
    return `<span class="badge badge-mature">Maduro</span>`;
}

function injectStyles() {
    if (document.getElementById('library-styles')) return;
    const style = document.createElement('style');
    style.id = 'library-styles';
    style.textContent = `
        .library-container {
            padding: 40px;
            max-width: 1000px;
            margin: 0 auto;
            padding-bottom: 100px;
        }
        .lib-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
        }
        .lib-title-block h2 {
            font-size: 32px;
            color: var(--color-text);
            margin: 0 0 8px 0;
        }
        .lib-title-block p {
            color: var(--color-text-light);
            font-size: 16px;
            margin: 0;
        }
        .lib-stats {
            background: var(--color-surface);
            border: 2px solid var(--color-border);
            border-radius: var(--radius-md);
            padding: 16px 24px;
            text-align: center;
        }
        .stat-number {
            font-size: 28px;
            font-weight: 900;
            color: var(--color-primary);
        }
        .stat-lbl {
            font-size: 12px;
            color: var(--color-text-light);
            text-transform: uppercase;
            font-weight: bold;
        }
        .cat-tabs {
            display: flex;
            gap: 12px;
            margin-bottom: 24px;
            overflow-x: auto;
            padding-bottom: 8px;
        }
        .cat-tab {
            padding: 12px 24px;
            border-radius: 20px;
            border: 2px solid var(--color-border);
            background: var(--color-surface);
            color: var(--color-text-light);
            font-weight: bold;
            cursor: pointer;
            white-space: nowrap;
            transition: color var(--motion-fast), background-color var(--motion-fast), border-color var(--motion-fast);
        }
        .cat-tab.active {
            background: var(--color-primary);
            color: white;
            border-color: var(--color-primary);
        }
        .az-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 32px;
            background: var(--color-surface);
            padding: 16px;
            border-radius: var(--radius-lg);
            border: 2px solid var(--color-border);
        }
        .az-letter {
            width: 40px;
            height: 40px;
            border-radius: 8px;
            border: 2px solid transparent;
            background: var(--color-bg-alt);
            color: var(--color-text);
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: color var(--motion-fast), background-color var(--motion-fast);
        }
        .az-letter:hover {
            background: var(--color-border);
        }
        .az-letter.active {
            background: var(--color-secondary);
            color: white;
        }
        .words-list {
            display: grid;
            gap: 16px;
        }
        .word-card {
            background: var(--color-surface);
            border: 2px solid var(--color-border);
            border-radius: var(--radius-md);
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: transform var(--motion-fast), box-shadow var(--motion-fast);
        }
        .word-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .word-main {
            font-size: 20px;
            font-weight: 900;
            color: var(--color-text);
            margin-bottom: 4px;
        }
        .word-trans {
            font-size: 15px;
            color: var(--color-text-light);
        }
        .video-context { margin-top: 10px; max-width: 560px; }
        .video-context-label { color: var(--color-text-light); font-size: 12px; font-weight: 800; }
        .video-context-title { display: block; color: var(--color-text); font-size: 13px; margin: 3px 0 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .video-context-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .video-context-actions a, .video-context-embed { color: var(--color-secondary); background: transparent; border: 0; cursor: pointer; font: inherit; font-size: 13px; font-weight: 800; padding: 0; text-decoration: underline; }
        .video-context-frame { margin-top: 12px; aspect-ratio: 16 / 9; background: #000; border-radius: 12px; overflow: hidden; }
        .video-context-frame iframe { width: 100%; height: 100%; border: 0; }
        .word-actions {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .btn-delete {
            background: transparent;
            border: none;
            cursor: pointer;
            font-size: 20px;
            opacity: 0.5;
            transition: opacity 0.2s;
        }
        .btn-delete:hover {
            opacity: 1;
        }
        .badge {
            padding: 6px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
        }
        .badge-new { background: var(--color-bg-alt); color: var(--color-text-light); }
        .badge-learning { background: var(--color-warning); color: white; }
        .badge-mature { background: var(--color-primary); color: white; }
        .view-state, .empty-state {
            text-align: center;
            padding: 60px;
            color: var(--color-text-light);
            font-weight: bold;
            background: var(--color-surface);
            border: 2px dashed var(--color-border);
            border-radius: var(--radius-lg);
        }
        .view-state { width:min(620px, calc(100% - 32px)); margin:32px auto; display:grid; justify-items:center; gap:10px; }
        .view-state-error { border-color:var(--color-danger); }
        .view-state strong, .empty-state strong, .empty-state span { display:block; }
        .view-state strong, .empty-state strong { color:var(--color-text); font-size:17px; }
        .empty-state span { margin:7px auto 14px; max-width:520px; font-weight:600; }
        @media (max-width: 768px) {
            .library-container { padding: 16px; padding-bottom: 100px; }
            .lib-header { flex-wrap: wrap; gap: 16px; }
            .lib-title-block h2 { font-size: 24px; }
            .word-card { flex-wrap: wrap; gap: 10px; }
            .word-actions { gap: 10px; }
            .empty-state { padding: 32px 16px; }
        }
    `;
    document.head.appendChild(style);
}
