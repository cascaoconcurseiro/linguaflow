import { db as lfDb } from '../../../utils/db.js';

let allWords = [];
let filteredWords = [];
let currentCategory = 'all'; // all, words, phrasal, slang, idioms
let currentLetter = null; // 'A', 'B', etc. or null for all

export async function renderLibrary(container, app) {
  injectStyles();
  container.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--color-text-light);">Carregando cofre...</div>';
  
  try {
    allWords = await lfDb.getAllWords();
    // Default to 'words' if category doesn't exist to avoid empty states
    allWords = allWords.map(w => ({
      ...w,
      category: w.category || _inferCategory(w.word)
    }));
  } catch (err) {
    console.error("Failed to load library", err);
  }

  renderUI(container, app);
}

function _inferCategory(word) {
    const lower = (word||'').toLowerCase();
    const parts = lower.split(' ');
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
  filteredWords.sort((a, b) => (a.word||'').localeCompare(b.word||''));

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  container.innerHTML = `
    <div class="library-container">
      <div class="lib-header">
        <div class="lib-title-block">
          <h2>O Cofre A-Z</h2>
          <p>Sua coleção de vocabulário inteligente.</p>
        </div>
        <div class="lib-stats">
          <div class="stat-number">${filteredWords.length}</div>
          <div class="stat-lbl">Itens</div>
        </div>
      </div>

      <!-- Category Tabs -->
      <div class="cat-tabs">
        <button class="cat-tab ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">Tudo</button>
        <button class="cat-tab ${currentCategory === 'words' ? 'active' : ''}" data-cat="words">Palavras</button>
        <button class="cat-tab ${currentCategory === 'phrasal' ? 'active' : ''}" data-cat="phrasal">Phrasal Verbs</button>
        <button class="cat-tab ${currentCategory === 'slang' ? 'active' : ''}" data-cat="slang">Gírias</button>
        <button class="cat-tab ${currentCategory === 'idioms' ? 'active' : ''}" data-cat="idioms">Expressões</button>
      </div>

      <!-- A-Z Calendar Grid -->
      <div class="az-grid">
        <button class="az-letter ${currentLetter === null ? 'active' : ''}" data-letter="ALL">ALL</button>
        ${alphabet.map(l => `
          <button class="az-letter ${currentLetter === l ? 'active' : ''}" data-letter="${l}">${l}</button>
        `).join('')}
      </div>

      <!-- Words List -->
      <div class="words-list">
        ${filteredWords.length === 0 ? `
          <div class="empty-state">Nenhum item encontrado nesta categoria/letra.</div>
        ` : `
          ${filteredWords.map(w => `
            <div class="word-card">
              <div class="word-info">
                <div class="word-main">${w.word}</div>
                <div class="word-trans">${w.translation}</div>
              </div>
              <div class="word-actions">
                ${renderStatus(w.reps)}
                <button class="btn-delete" data-id="${w.id}" title="Excluir">🗑️</button>
              </div>
            </div>
          `).join('')}
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

  document.querySelectorAll('.az-letter').forEach(btn => {
      btn.addEventListener('click', (e) => {
          const l = e.target.dataset.letter;
          currentLetter = l === 'ALL' ? null : l;
          renderUI(container, app);
      });
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
          if(confirm('Tem certeza que deseja excluir este item?')) {
              const id = parseInt(e.currentTarget.dataset.id, 10);
              await lfDb.deleteWord(id);
              allWords = allWords.filter(w => w.id !== id);
              renderUI(container, app);
              app.showToast('Item excluído.', 'info');
          }
      });
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
            background: white;
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
            background: white;
            color: var(--color-text-light);
            font-weight: bold;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s;
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
            background: white;
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
            transition: all 0.1s;
        }
        .az-letter:hover {
            background: #e2e8f0;
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
            background: white;
            border: 2px solid var(--color-border);
            border-radius: var(--radius-md);
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: transform 0.2s;
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
        .empty-state {
            text-align: center;
            padding: 60px;
            color: var(--color-text-light);
            font-weight: bold;
            background: white;
            border: 2px dashed var(--color-border);
            border-radius: var(--radius-lg);
        }
    `;
    document.head.appendChild(style);
}
