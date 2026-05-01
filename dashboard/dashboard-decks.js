// dashboard-decks.js - Gerenciamento de Decks (igual ao Anki)

// Importa db
import { db } from '../utils/db.js';

// ============================================================
// RENDERIZAÇÃO DE DECKS
// ============================================================

async function loadDecks() {
    const container = document.getElementById('decks-list');
    if (!container) return;

    try {
        const decks = await db.getAllDecks();
        
        if (decks.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:60px 40px;color:#94A3B8;grid-column:1/-1;">
                    <div style="font-size:64px;">🎴</div>
                    <h2>Nenhum deck criado ainda</h2>
                    <p>Clique em "+ Novo Deck" para começar a organizar seu vocabulário</p>
                </div>
            `;
            return;
        }

        // Carrega estatísticas de cada deck
        const decksWithStats = await Promise.all(
            decks.map(async (deck) => {
                const stats = await db.getDeckStats(deck.id);
                return { ...deck, stats };
            })
        );

        // Renderiza cards dos decks
        container.innerHTML = decksWithStats.map(deck => renderDeckCard(deck)).join('');

        // Adiciona event listeners
        decksWithStats.forEach(deck => {
            document.getElementById(`btn-study-${deck.id}`)?.addEventListener('click', () => studyDeck(deck.id));
            document.getElementById(`btn-edit-${deck.id}`)?.addEventListener('click', () => editDeck(deck.id, deck.name));
            document.getElementById(`btn-delete-${deck.id}`)?.addEventListener('click', () => deleteDeck(deck.id, deck.name));
            document.getElementById(`btn-stats-${deck.id}`)?.addEventListener('click', () => showDeckStats(deck.id, deck.name));
        });

    } catch (e) {
        console.error('[LinguaFlow Decks] Erro ao carregar decks:', e);
        container.innerHTML = `
            <div style="text-align:center;padding:40px;color:#EF4444;grid-column:1/-1;">
                Erro ao carregar decks. Tente recarregar a página.
            </div>
        `;
    }
}

function renderDeckCard(deck) {
    const stats = deck.stats || { total: 0, due: 0, byStatus: {} };
    const isDefault = deck.id === 1;
    
    return `
        <div class="deck-card" style="background:linear-gradient(135deg, rgba(56,189,248,0.08), rgba(167,139,250,0.08));border:1px solid rgba(56,189,248,0.2);border-radius:12px;padding:20px;">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px;">
                <div>
                    <h3 style="margin:0;font-size:18px;color:#F8FAFC;display:flex;align-items:center;gap:8px;">
                        ${isDefault ? '📚' : '🎴'} ${deck.name}
                        ${isDefault ? '<span style="font-size:11px;background:rgba(56,189,248,0.2);color:#38BDF8;padding:2px 8px;border-radius:4px;font-weight:600;">PADRÃO</span>' : ''}
                    </h3>
                    <p style="margin:4px 0 0;font-size:12px;color:#94A3B8;">
                        Criado em ${new Date(deck.created_at).toLocaleDateString('pt-BR')}
                    </p>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px;">
                <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:12px;text-align:center;">
                    <div style="font-size:24px;font-weight:700;color:#10B981;">${stats.total}</div>
                    <div style="font-size:11px;color:#94A3B8;text-transform:uppercase;font-weight:600;">Total</div>
                </div>
                <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:12px;text-align:center;">
                    <div style="font-size:24px;font-weight:700;color:#F59E0B;">${stats.due}</div>
                    <div style="font-size:11px;color:#94A3B8;text-transform:uppercase;font-weight:600;">Devidas</div>
                </div>
            </div>

            <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">
                <span style="font-size:11px;background:rgba(56,189,248,0.15);color:#38BDF8;padding:4px 8px;border-radius:4px;font-weight:600;">
                    ${stats.byStatus.new || 0} novas
                </span>
                <span style="font-size:11px;background:rgba(245,158,11,0.15);color:#F59E0B;padding:4px 8px;border-radius:4px;font-weight:600;">
                    ${stats.byStatus.learning || 0} aprendendo
                </span>
                <span style="font-size:11px;background:rgba(16,185,129,0.15);color:#10B981;padding:4px 8px;border-radius:4px;font-weight:600;">
                    ${stats.byStatus.review || 0} revisão
                </span>
                <span style="font-size:11px;background:rgba(167,139,250,0.15);color:#A78BFA;padding:4px 8px;border-radius:4px;font-weight:600;">
                    ${stats.byStatus.mature || 0} maduras
                </span>
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button id="btn-study-${deck.id}" class="btn-action btn-blue" style="flex:1;min-width:100px;">
                    📖 Estudar
                </button>
                <button id="btn-stats-${deck.id}" class="btn-action" style="padding:8px 12px;">
                    📊
                </button>
                ${!isDefault ? `
                    <button id="btn-edit-${deck.id}" class="btn-action" style="padding:8px 12px;">
                        ✏️
                    </button>
                    <button id="btn-delete-${deck.id}" class="btn-action btn-red" style="padding:8px 12px;">
                        🗑️
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

// ============================================================
// AÇÕES DE DECK
// ============================================================

async function createDeck() {
    const name = prompt('Nome do novo deck:');
    if (!name || !name.trim()) return;

    try {
        await db.createDeck(name.trim());
        await loadDecks();
        alert(`Deck "${name}" criado com sucesso!`);
    } catch (e) {
        console.error('[LinguaFlow Decks] Erro ao criar deck:', e);
        alert('Erro ao criar deck. Tente novamente.');
    }
}

async function editDeck(deckId, currentName) {
    const newName = prompt('Novo nome do deck:', currentName);
    if (!newName || !newName.trim() || newName === currentName) return;

    try {
        await db.updateDeck(deckId, newName.trim());
        await loadDecks();
        alert(`Deck renomeado para "${newName}"!`);
    } catch (e) {
        console.error('[LinguaFlow Decks] Erro ao editar deck:', e);
        alert('Erro ao editar deck. Tente novamente.');
    }
}

async function deleteDeck(deckId, deckName) {
    if (!confirm(`Tem certeza que deseja deletar o deck "${deckName}"?\n\nTodas as palavras serão movidas para o deck padrão.`)) return;

    try {
        await db.deleteDeck(deckId);
        await loadDecks();
        alert(`Deck "${deckName}" deletado. Palavras movidas para o deck padrão.`);
    } catch (e) {
        console.error('[LinguaFlow Decks] Erro ao deletar deck:', e);
        alert('Erro ao deletar deck. Tente novamente.');
    }
}

async function studyDeck(deckId) {
    // Muda para aba de revisão e filtra por deck
    window.dashboard.currentDeckFilter = deckId;
    window.dashboard.switchTab('review');
    window.dashboard.loadReview();
}

async function showDeckStats(deckId, deckName) {
    try {
        const stats = await db.getDeckStats(deckId);
        const words = await db.getAllWords(deckId);
        
        const message = `
📊 Estatísticas: ${deckName}

📦 Total: ${stats.total} palavras
⏰ Devidas: ${stats.due} cards

Por Status:
  🆕 Novas: ${stats.byStatus.new || 0}
  📚 Aprendendo: ${stats.byStatus.learning || 0}
  🔄 Revisão: ${stats.byStatus.review || 0}
  ⭐ Maduras: ${stats.byStatus.mature || 0}

Palavras mais recentes:
${words.slice(0, 5).map(w => `  • ${w.word}`).join('\n')}
        `.trim();
        
        alert(message);
    } catch (e) {
        console.error('[LinguaFlow Decks] Erro ao carregar stats:', e);
        alert('Erro ao carregar estatísticas.');
    }
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

export function initDecks() {
    // Carrega decks ao abrir a aba
    loadDecks();

    // Event listener para criar deck
    const btnCreate = document.getElementById('btn-create-deck');
    if (btnCreate) {
        btnCreate.addEventListener('click', createDeck);
    }
}

// Exporta funções para uso global
window.lfDecks = {
    loadDecks,
    createDeck,
    editDeck,
    deleteDeck,
    studyDeck,
    showDeckStats
};
