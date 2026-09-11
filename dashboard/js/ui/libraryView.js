import { db as lfDb } from '../../../utils/db.js';
import { generateChunksWeb } from '../core/ai.js';
import { attachVideoContext, renderVideoContext } from '../core/videoContext.js';
import { bindViewStateAction, escapeHtml, renderViewState } from './viewState.js';

let allWords = [];
let filteredWords = [];
let cardByWordId = {};
let currentCategory = 'all'; // all, words, phrasal, slang, idioms
let currentLetter = null; // 'A', 'B', etc. or null for all
let currentStatus = 'all'; // all, due, learning, mature, suspended
let searchQuery = '';
let currentViewMode = 'words'; // 'words' | 'decks'
let selectedWordIds = new Set();
let visibleCount = 50;
let searchDebounceTimer = null;

const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id && (typeof location === 'undefined' || location.protocol === 'chrome-extension:');

export async function renderLibrary(container, app) {
  visibleCount = 50;
  selectedWordIds.clear();
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

  const categoryMeta = {
    'word': { label: 'Vocabulário Geral', icon: '📖' },
    'phrasal': { label: 'Phrasal Verbs', icon: '⚡' },
    'slang': { label: 'Gírias & Expressões', icon: '💬' },
    'idiom': { label: 'Expressões Idiomáticas', icon: '💡' },
  };

  const decksMap = {};
  allWords.forEach(w => {
    const cat = w.category || 'word';
    if (!decksMap[cat]) {
      decksMap[cat] = {
        key: cat,
        label: categoryMeta[cat]?.label || (cat.charAt(0).toUpperCase() + cat.slice(1)),
        icon: categoryMeta[cat]?.icon || '🗂️',
        words: [],
        newCount: 0,
        learnCount: 0,
        reviewCount: 0,
      };
    }
    decksMap[cat].words.push(w);
    const card = cardByWordId[w.id];
    if (card && !card.suspended) {
      if (card.status === 'new') decksMap[cat].newCount++;
      else if (card.status === 'learning') decksMap[cat].learnCount++;
      else if (card.due_date && new Date(card.due_date).getTime() <= Date.now()) decksMap[cat].reviewCount++;
    } else if (!card) {
      decksMap[cat].newCount++;
    }
  });
  const decksList = Object.values(decksMap);

  container.innerHTML = `
    ${bannerHtml}
    <div class="library-container">
      <div class="lib-header">
        <div class="lib-title-block">
          <h2>Seu Cofre</h2>
          <p>Frases salvas, expressões-alvo e seus contextos originais.</p>
        </div>
        <div class="lib-header-right">
          <div class="lib-mode-switch" role="tablist" aria-label="Modo de visualização">
            <button type="button" class="lib-mode-btn ${currentViewMode === 'words' ? 'active' : ''}" id="btn-mode-words" role="tab" aria-selected="${currentViewMode === 'words'}">📋 Frases (${filteredWords.length})</button>
            <button type="button" class="lib-mode-btn ${currentViewMode === 'decks' ? 'active' : ''}" id="btn-mode-decks" role="tab" aria-selected="${currentViewMode === 'decks'}">🗂️ Baralhos (${decksList.length})</button>
          </div>
          <div class="lib-stats">
            <div class="stat-number">${filteredWords.length}</div>
            <div class="stat-lbl">Frases</div>
          </div>
        </div>
      </div>

      ${currentViewMode === 'decks' ? `
        <!-- Decks View Mode -->
        <div class="deck-grid">
          ${decksList.map(deck => `
            <div class="deck-card" data-topic="${deck.key}">
              <div class="deck-card-top">
                <span class="deck-icon">${deck.icon}</span>
                <div class="deck-info">
                  <h3 class="deck-title">${escapeHtml(deck.label)}</h3>
                  <span class="deck-meta">${deck.words.length} ${deck.words.length === 1 ? 'frase' : 'frases'}</span>
                </div>
              </div>
              <div class="deck-counters">
                <span class="deck-badge badge-new" title="Cards novos"><strong class="badge-num">${deck.newCount}</strong> novos</span>
                <span class="deck-badge badge-learning" title="Em aprendizado"><strong class="badge-num">${deck.learnCount}</strong> aprendendo</span>
                <span class="deck-badge badge-due" title="A revisar hoje"><strong class="badge-num">${deck.reviewCount}</strong> a revisar</span>
              </div>
              <div class="deck-actions">
                <button type="button" class="btn btn-primary btn-study-deck" data-topic="${deck.key}">Estudar Baralho</button>
                <button type="button" class="btn btn-outline btn-filter-deck" data-topic="${deck.key}" title="Ver frases deste baralho">Ver Frases</button>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <!-- Words View Mode -->
        <label class="lib-search" for="library-search">
          <span class="sr-only">Buscar no Cofre</span>
          <input id="library-search" type="search" value="${escapeHtml(searchQuery)}" placeholder="Buscar termo, tradução, frase ou vídeo" autocomplete="off">
        </label>

        <!-- Category chips: o filtro mais frequente fica sempre visível. -->
        <div class="cat-tabs" aria-label="Filtrar por tipo">
          <button type="button" class="cat-tab ${currentCategory === 'all' ? 'active' : ''}" aria-pressed="${currentCategory === 'all'}" data-cat="all">Tudo</button>
          <button type="button" class="cat-tab ${currentCategory === 'words' ? 'active' : ''}" aria-pressed="${currentCategory === 'words'}" data-cat="words">Palavras</button>
          <button type="button" class="cat-tab ${currentCategory === 'phrasal' ? 'active' : ''}" aria-pressed="${currentCategory === 'phrasal'}" data-cat="phrasal">Phrasal Verbs</button>
          <button type="button" class="cat-tab ${currentCategory === 'slang' ? 'active' : ''}" aria-pressed="${currentCategory === 'slang'}" data-cat="slang">Gírias</button>
          <button type="button" class="cat-tab ${currentCategory === 'idioms' ? 'active' : ''}" aria-pressed="${currentCategory === 'idioms'}" data-cat="idioms">Expressões</button>
          ${currentCategory !== 'all' ? `<button class="btn btn-secondary" id="btn-review-topic" style="margin-left:auto; padding:8px 16px; font-size:13px;" title="Revisar apenas os itens desta categoria">🧠 Revisar este tópico</button>` : ''}
        </div>

        <details class="lib-filters" ${currentLetter || currentStatus !== 'all' ? 'open' : ''}>
          <summary>Mais filtros <span>${currentLetter || currentStatus !== 'all' ? '· ativos' : ''}</span></summary>
          <div class="status-chips" aria-label="Filtrar por estado">
            ${[['all','Todos'],['due','Para hoje'],['learning','Começando'],['mature','Memória estável'],['suspended','Pausados']].map(([value,label]) => `<button class="status-chip ${currentStatus === value ? 'active' : ''}" type="button" aria-pressed="${currentStatus === value}" data-status="${value}">${label}</button>`).join('')}
          </div>
          <div class="az-grid" aria-label="Filtrar por letra inicial">
            <button type="button" class="az-letter ${currentLetter === null ? 'active' : ''}" aria-pressed="${currentLetter === null}" data-letter="ALL">Todas</button>
            ${alphabet.map(l => `<button type="button" class="az-letter ${currentLetter === l ? 'active' : ''}" aria-pressed="${currentLetter === l}" data-letter="${l}">${l}</button>`).join('')}
          </div>
        </details>

        ${filteredWords.length > 0 ? `
          <div class="batch-select-header">
            <label class="batch-select-label">
              <input type="checkbox" id="chk-select-all" ${selectedWordIds.size > 0 && selectedWordIds.size === filteredWords.length ? 'checked' : ''}> Selecionar tudo
            </label>
            <span class="selected-count-badge ${selectedWordIds.size > 0 ? '' : 'hidden'}" id="selected-count-badge">${selectedWordIds.size} selecionada(s)</span>
          </div>
        ` : ''}

        <!-- Words List -->
        <div class="words-list">
          ${filteredWords.length === 0 ? renderViewState(allWords.length
            ? { kind: 'empty', title: 'Nenhuma frase corresponde aos filtros', message: 'Limpe os filtros para voltar à coleção completa.', actionLabel: 'Limpar filtros', actionId: 'btn-clear-library-filters', actionClass: 'btn btn-secondary', compact: true }
            : { kind: 'empty', title: 'Seu Cofre ainda está vazio', message: 'Salve uma frase em um vídeo, história ou texto para começar.', actionLabel: 'Encontrar uma frase', actionId: 'btn-empty-library-learn', compact: true }) : `
            ${filteredWords.slice(0, visibleCount).map(w => {
              const card = cardByWordId[w.id];
              const suspended = !!(card && card.suspended);
              const safeWord = escapeHtml(w.word);
              const safeTranslation = escapeHtml(w.translation);
              const safeContext = escapeHtml(w.context_sentence);
              return `
              <article class="word-card${suspended ? ' is-paused' : ''}">
                <div class="card-select-wrap">
                  <input type="checkbox" class="word-select-chk" data-word-id="${w.id}" data-card-id="${card?.id || ''}" ${selectedWordIds.has(w.id) ? 'checked' : ''} aria-label="Selecionar ${safeWord}">
                </div>
                <div class="word-info">
                  <div class="word-card-meta">${renderStatus(card)}</div>
                  ${w.context_sentence && w.context_sentence.trim() !== w.word?.trim() ? `<blockquote class="word-context">${safeContext}</blockquote>` : ''}
                  <div class="word-main">${safeWord}</div>
                  <div class="word-trans">${safeTranslation}</div>
                  ${renderVideoContext(w, `library-video-${w.id}`)}
                </div>
                <div class="word-actions">
                  <details class="word-action-menu">
                    <summary aria-label="Abrir ações para ${safeWord}">Ações</summary>
                    <div>
                      <button class="btn-edit-word" data-id="${w.id}">Editar</button>
                      ${card ? `<button class="btn-suspend" data-card-id="${card.id}">${suspended ? 'Retomar revisões' : 'Pausar revisões'}</button>` : ''}
                      ${card ? `<button class="btn-reset-single" data-card-id="${card.id}">Esquecer (Resetar)</button>` : ''}
                      <button class="btn-delete" data-id="${w.id}">Excluir</button>
                    </div>
                  </details>
                </div>
              </article>
            `;}).join('')}
            ${filteredWords.length > visibleCount ? `
              <div style="text-align:center; padding: 24px 0 16px;">
                <button type="button" class="btn btn-outline" id="btn-load-more-words" style="min-height:44px; padding: 8px 24px; font-weight:700;">
                  Carregar mais frases (${filteredWords.length - visibleCount} restantes)
                </button>
              </div>
            ` : ''}
          `}
        </div>

        <!-- Floating Batch Action Toolbar -->
        <div id="batch-bar" class="batch-bar ${selectedWordIds.size > 0 ? '' : 'hidden'}" role="toolbar" aria-label="Ações em lote">
          <div class="batch-bar-left">
            <strong id="batch-selected-count">${selectedWordIds.size}</strong> selecionada(s)
          </div>
          <div class="batch-bar-actions">
            <button type="button" class="btn btn-sm btn-outline" id="batch-btn-pause">⏸️ Pausar</button>
            <button type="button" class="btn btn-sm btn-outline" id="batch-btn-resume">▶️ Retomar</button>
            <button type="button" class="btn btn-sm btn-warning" id="batch-btn-reset">🔄 Esquecer (Reset)</button>
            <button type="button" class="btn btn-sm btn-secondary" id="batch-btn-cat">🏷️ Categoria</button>
            <button type="button" class="btn btn-sm btn-danger" id="batch-btn-del">🗑️ Excluir</button>
            <button type="button" class="btn btn-sm btn-outline" id="batch-btn-clear" title="Limpar seleção">✕</button>
          </div>
        </div>
      `}
    </div>
  `;

  // Listeners
  document.getElementById('btn-load-more-words')?.addEventListener('click', () => {
    visibleCount += 50;
    renderUI(container, app);
  });
  document.querySelectorAll('.cat-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
          currentCategory = e.target.dataset.cat;
          visibleCount = 50;
          renderUI(container, app);
      });
  });
  const searchInput = document.getElementById('library-search');
  searchInput?.addEventListener('input', (event) => {
      const rawVal = event.currentTarget.value;
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        searchQuery = rawVal.trim();
        visibleCount = 50;
        renderUI(container, app);
        requestAnimationFrame(() => {
          const next = document.getElementById('library-search');
          next?.focus({ preventScroll: true });
          next?.setSelectionRange(rawVal.length, rawVal.length);
        });
      }, 150);
  });
  document.querySelectorAll('.status-chip').forEach(btn => btn.addEventListener('click', (event) => {
      currentStatus = event.currentTarget.dataset.status;
      visibleCount = 50;
      renderUI(container, app);
  }));
  document.getElementById('btn-clear-library-filters')?.addEventListener('click', () => {
      currentCategory = 'all';
      currentLetter = null;
      currentStatus = 'all';
      searchQuery = '';
      visibleCount = 50;
      renderUI(container, app);
  });
  bindViewStateAction(container, 'btn-empty-library-learn', () => app.navigate('learn'));

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
          if(confirm('Excluir esta frase do Cofre?')) {
              // IDs são UUIDs — o parseInt antigo quebrava a exclusão
              const id = e.currentTarget.dataset.id;
              try {
                await lfDb.deleteWord(id);
              } catch (err) {
                console.error(err);
                const reviewed = /reviewed_word_cannot_be_deleted/.test(err?.message || '');
                app.showToast(
                  reviewed
                    ? 'Esta frase já tem histórico de revisão. Pause as revisões para preservar esse histórico.'
                    : 'Não foi possível excluir esta frase.',
                  reviewed ? 'info' : 'error'
                );
                return;
              }
              allWords = allWords.filter(w => w.id !== id);
              renderUI(container, app);
              app.showToast('Frase excluída do Cofre.', 'info');
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
            app.showToast(card.suspended ? 'Revisões pausadas.' : 'Revisões retomadas.', 'info');
          } catch (err) {
            console.error(err);
            app.showToast('Não foi possível atualizar esta frase. Tente novamente.', 'error');
          }
      });
  });

  // Esquecer card (Anki Reset to New)
  document.querySelectorAll('.btn-reset-single').forEach(btn => {
      btn.addEventListener('click', async (e) => {
          const cardId = e.currentTarget.dataset.cardId;
          const card = Object.values(cardByWordId).find(c => c.id === cardId);
          if (!card) return;
          if (!confirm('Deseja resetar o progresso deste card para Novo (como no Anki Forget)? O histórico será preservado.')) return;
          try {
            await lfDb.resetCardToNew(card.id);
            card.status = 'new';
            card.interval = 0;
            card.reps = 0;
            card.lapses = 0;
            card.stability = 0.5;
            card.difficulty = 5.0;
            card.last_review = null;
            card.introduced_at = null;
            renderUI(container, app);
            app.showToast('Card resetado para Novo (progresso zerado) 🔄', 'info');
          } catch (err) {
            console.error(err);
            app.showToast('Não foi possível resetar o card. Tente novamente.', 'error');
          }
      });
  });

  // Alternador de visualização: Frases vs Baralhos
  document.getElementById('btn-mode-words')?.addEventListener('click', () => {
    currentViewMode = 'words';
    renderUI(container, app);
  });
  document.getElementById('btn-mode-decks')?.addEventListener('click', () => {
    currentViewMode = 'decks';
    renderUI(container, app);
  });

  // Ações da visão de Baralhos
  document.querySelectorAll('.btn-study-deck').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const topic = e.currentTarget.dataset.topic;
      app.navigate('study', { category: topic, topic });
    });
  });
  document.querySelectorAll('.btn-filter-deck').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const topic = e.currentTarget.dataset.topic;
      const catReverse = { 'word': 'words', 'phrasal': 'phrasal', 'slang': 'slang', 'idiom': 'idioms' };
      currentCategory = catReverse[topic] || 'all';
      currentViewMode = 'words';
      renderUI(container, app);
    });
  });

  // Seleção e ações em lote
  const batchBar = document.getElementById('batch-bar');
  const updateBatchBar = () => {
    if (!batchBar) return;
    const count = selectedWordIds.size;
    batchBar.classList.toggle('hidden', count === 0);
    const countEl = document.getElementById('batch-selected-count');
    if (countEl) countEl.textContent = String(count);
    const countBadge = document.getElementById('selected-count-badge');
    if (countBadge) {
      countBadge.textContent = `${count} selecionada(s)`;
      countBadge.classList.toggle('hidden', count === 0);
    }
    const chkAll = document.getElementById('chk-select-all');
    if (chkAll) chkAll.checked = count > 0 && count === filteredWords.length;
  };

  document.querySelectorAll('.word-select-chk').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const wordId = e.currentTarget.dataset.wordId;
      if (e.currentTarget.checked) selectedWordIds.add(wordId);
      else selectedWordIds.delete(wordId);
      updateBatchBar();
    });
  });

  document.getElementById('chk-select-all')?.addEventListener('change', (e) => {
    if (e.currentTarget.checked) {
      filteredWords.forEach(w => selectedWordIds.add(w.id));
    } else {
      selectedWordIds.clear();
    }
    renderUI(container, app);
  });

  document.getElementById('batch-btn-clear')?.addEventListener('click', () => {
    selectedWordIds.clear();
    renderUI(container, app);
  });

  document.getElementById('batch-btn-pause')?.addEventListener('click', async () => {
    const ids = Array.from(selectedWordIds);
    let count = 0;
    const chunkSize = 5;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      await Promise.allSettled(chunk.map(async (wId) => {
        const card = cardByWordId[wId];
        if (card && !card.suspended) {
          try {
            await lfDb.setCardSuspended(card.id, true);
            card.suspended = true;
            count++;
          } catch {}
        }
      }));
    }
    selectedWordIds.clear();
    renderUI(container, app);
    app.showToast(`${count} card(s) pausados. ⏸️`, 'info');
  });

  document.getElementById('batch-btn-resume')?.addEventListener('click', async () => {
    const ids = Array.from(selectedWordIds);
    let count = 0;
    const chunkSize = 5;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      await Promise.allSettled(chunk.map(async (wId) => {
        const card = cardByWordId[wId];
        if (card && card.suspended) {
          try {
            await lfDb.setCardSuspended(card.id, false);
            card.suspended = false;
            count++;
          } catch {}
        }
      }));
    }
    selectedWordIds.clear();
    renderUI(container, app);
    app.showToast(`${count} card(s) retomados. ▶️`, 'info');
  });

  document.getElementById('batch-btn-reset')?.addEventListener('click', async () => {
    const ids = Array.from(selectedWordIds);
    if (!confirm(`Deseja resetar o progresso de ${ids.length} card(s) para Novo (como no Anki Forget)?`)) return;
    let count = 0;
    const chunkSize = 5;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      await Promise.allSettled(chunk.map(async (wId) => {
        const card = cardByWordId[wId];
        if (card) {
          try {
            await lfDb.resetCardToNew(card.id);
            card.status = 'new';
            card.interval = 0;
            card.reps = 0;
            card.lapses = 0;
            card.stability = 0.5;
            card.difficulty = 5.0;
            card.last_review = null;
            card.introduced_at = null;
            count++;
          } catch {}
        }
      }));
    }
    selectedWordIds.clear();
    renderUI(container, app);
    app.showToast(`${count} card(s) resetados para Novo. 🔄`, 'info');
  });

  document.getElementById('batch-btn-cat')?.addEventListener('click', async () => {
    const newCat = prompt('Digite a categoria de destino (ex: word, phrasal, slang, idiom):');
    if (!newCat || !newCat.trim()) return;
    const catClean = newCat.trim().toLowerCase();
    const ids = Array.from(selectedWordIds);
    const chunkSize = 5;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      await Promise.allSettled(chunk.map(async (wId) => {
        try {
          await lfDb.updateWord(wId, { category: catClean });
          const w = allWords.find(item => item.id === wId);
          if (w) w.category = catClean;
        } catch {}
      }));
    }
    selectedWordIds.clear();
    renderUI(container, app);
    app.showToast(`Categoria de ${ids.length} card(s) alterada para "${catClean}".`, 'info');
  });

  document.getElementById('batch-btn-del')?.addEventListener('click', async () => {
    const ids = Array.from(selectedWordIds);
    if (!confirm(`Tem certeza que deseja excluir ${ids.length} item(ns) do Cofre?`)) return;
    let deletedCount = 0;
    let preservedReviewedCount = 0;
    const chunkSize = 5;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      await Promise.allSettled(chunk.map(async (wId) => {
        try {
          await lfDb.deleteWord(wId);
          allWords = allWords.filter(item => item.id !== wId);
          deletedCount++;
        } catch (err) {
          const reviewed = /reviewed_word_cannot_be_deleted/.test(err?.message || '');
          if (reviewed) preservedReviewedCount++;
        }
      }));
    }
    selectedWordIds.clear();
    renderUI(container, app);
    if (preservedReviewedCount > 0) {
      app.showToast(`${deletedCount} item(ns) excluído(s). ${preservedReviewedCount} item(ns) com histórico de revisão foram preservados.`, 'info');
    } else {
      app.showToast(`${deletedCount} item(ns) excluído(s).`, 'info');
    }
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
        bannerText.innerHTML = `Gerando para: <strong>${escapeHtml(w.word)}</strong> (${count + 1}/${missing.length})... Pode demorar um pouco.`;
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
  const returnFocusTo = document.activeElement;

  const modal = document.createElement('div');
  modal.id = 'lf-word-edit-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'lf-edit-title');
  modal.style.cssText = 'display:flex; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.4); z-index:9999; justify-content:center; align-items:center; backdrop-filter: blur(2px);';
  modal.innerHTML = `
    <div style="background:var(--color-surface); border-radius:var(--radius-md); width:90%; max-width:420px; padding:24px; position:relative; box-shadow:0 8px 24px rgba(0,0,0,0.15); max-height:85vh; overflow-y:auto;">
      <button id="lf-edit-close" type="button" aria-label="Fechar editor" style="position:absolute; top:12px; right:12px; background:none; border:none; font-size:20px; color:var(--color-text-light); cursor:pointer; padding:4px;">&times;</button>
      <h2 id="lf-edit-title" style="font-size:20px; font-weight:800; color:var(--color-text); margin:0 0 16px 0;">✏️ ${escapeHtml(w.word)}</h2>

      <label for="lf-edit-translation" style="display:block; font-size:12px; font-weight:700; color:var(--color-text-light); margin-bottom:4px;">Tradução</label>
      <input id="lf-edit-translation" type="text" value="${escapeHtml(w.translation || '')}" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:8px; background:var(--color-bg); color:var(--color-text); font-size:14px; margin-bottom:14px;" />

      <label for="lf-edit-sentence" style="display:block; font-size:12px; font-weight:700; color:var(--color-text-light); margin-bottom:4px;">Frase de contexto</label>
      <textarea id="lf-edit-sentence" rows="3" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:8px; background:var(--color-bg); color:var(--color-text); font-size:14px; margin-bottom:14px; resize:vertical; font-family:inherit;">${escapeHtml(w.context_sentence || '')}</textarea>

      <div style="display:flex; gap:12px; margin-bottom:14px;">
        <div style="flex:1;">
          <label for="lf-edit-category" style="display:block; font-size:12px; font-weight:700; color:var(--color-text-light); margin-bottom:4px;">Categoria</label>
          <select id="lf-edit-category" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:8px; background:var(--color-bg); color:var(--color-text); font-size:14px;">
            ${CATEGORY_OPTIONS.map(([v, label]) => `<option value="${v}" ${w.category === v ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1;">
          <label for="lf-edit-level" style="display:block; font-size:12px; font-weight:700; color:var(--color-text-light); margin-bottom:4px;">Nível CEFR</label>
          <select id="lf-edit-level" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:8px; background:var(--color-bg); color:var(--color-text); font-size:14px;">
            ${LEVEL_OPTIONS.map(v => `<option value="${v}" ${((w.level || '') === v) ? 'selected' : ''}>${v || '—'}</option>`).join('')}
          </select>
        </div>
      </div>

      <button id="lf-edit-save" class="btn btn-primary" style="width:100%; padding:12px; font-size:15px;">💾 Salvar</button>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => {
    modal.remove();
    returnFocusTo?.focus?.({ preventScroll: true });
  };
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll('button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  modal.querySelector('#lf-edit-close').addEventListener('click', close);
  modal.querySelector('#lf-edit-translation').focus({ preventScroll: true });

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
      app.showToast('Frase atualizada.', 'info');
    } catch (err) {
      console.error(err);
      app.showToast('Erro ao salvar as alterações.', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Salvar';
    }
  });
}

function renderStatus(card) {
    if (!card) return `<span class="badge badge-new">Nova</span>`;
    if (card.suspended) return `<span class="badge badge-paused">Revisões pausadas</span>`;
    if (card.due_date && new Date(card.due_date).getTime() <= Date.now()) return `<span class="badge badge-due">Revisar hoje</span>`;
    if (card.status === 'mature') return `<span class="badge badge-mature">Memória estável</span>`;
    if (card.status === 'review') return `<span class="badge badge-review">Consolidando</span>`;
    return `<span class="badge badge-learning">Começando</span>`;
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
        .lib-header-right { display:flex; align-items:center; gap:12px; }
        .lib-mode-switch { display:flex; background:var(--color-bg-alt); padding:3px; border-radius:10px; border:1px solid var(--color-border); }
        .lib-mode-btn { background:transparent; border:none; padding:8px 14px; border-radius:8px; font-family:var(--font-main); font-weight:800; font-size:13px; color:var(--color-text-light); cursor:pointer; transition:color var(--motion-fast), background-color var(--motion-fast), box-shadow var(--motion-fast); }
        .lib-mode-btn.active { background:var(--color-surface); color:var(--color-text); box-shadow:0 2px 6px rgba(0,0,0,0.06); }

        /* Decks Grid */
        .deck-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); gap:18px; margin-top:20px; }
        .deck-card { background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-lg); padding:20px; display:flex; flex-direction:column; justify-content:space-between; gap:16px; box-shadow:0 4px 12px rgba(0,0,0,0.03); transition:transform 0.15s, border-color 0.15s; }
        .deck-card:hover { transform:translateY(-2px); border-color:var(--color-secondary); }
        .deck-card-top { display:flex; align-items:center; gap:12px; }
        .deck-icon { font-size:30px; width:46px; height:46px; display:grid; place-items:center; background:var(--color-bg-alt); border-radius:12px; }
        .deck-info { min-width:0; flex:1; }
        .deck-title { margin:0 0 2px 0; font-size:18px; font-weight:900; color:var(--color-text); }
        .deck-meta { font-size:13px; color:var(--color-text-light); font-weight:700; }
        .deck-counters { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .deck-badge { font-size:11px; font-weight:800; padding:4px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px; }
        .deck-badge .badge-num { font-size:13px; font-weight:900; }
        .deck-actions { display:flex; gap:8px; }
        .btn-study-deck { flex:1; padding:10px; font-size:14px; font-weight:900; }
        .btn-filter-deck { padding:10px 14px; font-size:13px; }

        /* Batch Selection Header & Bar */
        .batch-select-header { display:flex; align-items:center; justify-content:space-between; padding:8px 4px; margin-bottom:8px; }
        .batch-select-label { font-size:13px; font-weight:800; color:var(--color-text); display:inline-flex; align-items:center; gap:8px; cursor:pointer; }
        .selected-count-badge { font-size:12px; font-weight:800; color:var(--color-primary); background:rgba(88,204,2,0.1); padding:4px 10px; border-radius:12px; }
        .card-select-wrap { display:grid; place-items:center; margin-right:12px; }
        .word-select-chk { width:18px; height:18px; cursor:pointer; accent-color:var(--color-primary); }

        .batch-bar { position:fixed; z-index:100; bottom:24px; left:50%; transform:translateX(-50%); background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-lg); padding:12px 20px; display:flex; align-items:center; justify-content:space-between; gap:20px; box-shadow:0 12px 36px rgba(0,0,0,0.18); width:min(720px, calc(100vw - 32px)); }
        .batch-bar-left { font-size:14px; font-weight:800; color:var(--color-text); white-space:nowrap; }
        .batch-bar-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .btn-sm { padding:6px 12px; font-size:12px; font-weight:800; border-radius:8px; }

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
        .word-card.is-paused { border-style:dashed; }
        .word-info { min-width:0; flex:1; }
        .word-card-meta { margin-bottom:8px; }
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
        .word-context { max-width:620px; margin:12px 0 0; padding:10px 12px; border-left:3px solid var(--color-secondary); background:var(--color-bg-alt); color:var(--color-text); font-size:14px; line-height:1.5; }
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
        .badge-due { background:var(--color-danger); color:white; }
        .badge-review { background: var(--color-secondary); color: white; }
        .badge-mature { background: var(--color-primary); color: white; }
        .badge-paused { background: var(--color-bg-alt); color: var(--color-text-light); border:1px solid var(--color-border); }
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
