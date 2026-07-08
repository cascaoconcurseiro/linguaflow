// newtab.js
import { db as lfDb } from '../utils/db.js';

let currentCard = null;

async function init() {
    updateClock();
    setInterval(updateClock, 1000);

    try {
        const isLogged = await lfDb.checkSession();
        if (!isLogged) {
            document.getElementById('done-area').style.display = 'block';
            document.querySelector('#done-area h3').textContent = 'Você não está logado.';
            document.querySelector('#done-area p').textContent = 'Faça login no Dashboard para sincronizar seus cards.';
            return;
        }

        const due = await lfDb.getCardsDue(50);
        const validDue = due.filter(c => !c.suspended && c.wordData && c.status !== 'new'); // Só revisão rápida
        
        if (validDue.length > 0) {
            currentCard = validDue[Math.floor(Math.random() * validDue.length)]; // Pega um aleatório
            document.getElementById('study-area').style.display = 'block';
            document.getElementById('fc-word').textContent = currentCard.wordData.word;
            document.getElementById('fc-trans').textContent = currentCard.wordData.translation || '';
            document.getElementById('fc-ctx').textContent = currentCard.wordData.context_sentence ? `"${currentCard.wordData.context_sentence}"` : '';
        } else {
            document.getElementById('done-area').style.display = 'block';
        }
    } catch (e) {
        console.error("Erro ao carregar card na nova guia:", e);
    }
}

function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('date').textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

document.getElementById('flashcard').addEventListener('click', (e) => {
    if (e.target.closest('.actions')) return; // ignorar botões
    document.getElementById('flashcard').classList.add('revealed');
});

document.getElementById('btn-bad').addEventListener('click', async () => {
    if (currentCard) await lfDb.logReview(currentCard.id, 1);
    hideCardAndReload();
});

document.getElementById('btn-good').addEventListener('click', async () => {
    if (currentCard) await lfDb.logReview(currentCard.id, 3);
    hideCardAndReload();
});

function hideCardAndReload() {
    document.getElementById('flashcard').classList.remove('revealed');
    document.getElementById('study-area').style.display = 'none';
    init(); // Busca outro
}

init();
