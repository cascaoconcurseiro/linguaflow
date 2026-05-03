// Dashboard Monolítico LinguaFlow
// Este arquivo contém TODA a lógica do sistema Anki, Decks, Stats e Extras.
import { db as lfDb } from '../utils/db.js';
import { tts } from '../utils/tts.js';

// Estados Globais
let studyCards = [];
let currentIndex = 0;
let showAnswer = false;
let isBlindMode = false;
let immersionPlayerInterval = null;

// ============================================================================
// UI NAVIGATION & GLOBAL EXPOSURE
// ============================================================================
window.dashboard = {
    currentDeckFilter: null,
    _quizWords: [],
    _quizIndex: 0,
    _quizScore: 0,
    _quizPoints: 0,
    _currentQuizMode: 'choice',
    
    switchTab: (tab) => switchTab(tab),
    loadStudy,
    loadDecks,
    loadStats,
    initQuiz,
    loadListening,
    studyDeck: (id) => { 
        console.log('[LinguaFlow] Iniciando estudo do deck:', id);
        window.dashboard.currentDeckFilter = id; 
        switchTab('study'); 
    },
    deleteDeck: async (id) => { if(confirm('Excluir este deck?')) { await lfDb.deleteDeck(id); loadDecks(); } },
    refreshDashboard: () => { 
        updateHeader(); 
        const active = document.querySelector('.content-section.active'); 
        if(active) {
            const tab = active.id.replace('-section','');
            switchTab(tab);
        }
    },
    
    answerQuiz: (isCorrect, isTimeout = false) => {
        if (quizTimerInterval) clearInterval(quizTimerInterval);
        
        const d = window.dashboard;
        const fill = document.getElementById('quiz-timer-fill');
        const timeLeft = fill ? parseFloat(fill.style.width) : 0;
        
        if (isCorrect) {
            d._quizScore++;
            const points = Math.round(100 + (timeLeft * 2)); // Bônus de velocidade
            d._quizPoints += points;
            document.getElementById('quiz-score').textContent = `⚡ ${d._quizPoints}`;
        }

        const feedback = document.getElementById('quiz-feedback');
        if (feedback) {
            feedback.style.display = 'block';
            feedback.style.background = isCorrect ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
            feedback.style.color = isCorrect ? '#10b981' : '#ef4444';
            
            if (isTimeout) feedback.textContent = '⏰ Tempo Esgotado!';
            else feedback.textContent = isCorrect ? '✨ Correto! +' + Math.round(100 + (timeLeft * 2)) : '❌ Incorreto!';
            
            const nextBtn = document.getElementById('btn-quiz-next');
            if (nextBtn) {
                nextBtn.style.display = 'block';
                nextBtn.onclick = () => { d._quizIndex++; renderQuizCard(); };
            }
        }
        
        // Atualiza SRS se correto
        if (isCorrect) {
            const word = d._quizWords[d._quizIndex];
            if (word) lfDb.logReview(word.id, 4); // Marca como "Fácil" no quiz
        }
    }
};

// Expõe para o contexto global (necessário para os onclick do HTML)
window.switchTab = switchTab;
window.createDeck = () => {
    const name = prompt('Nome do novo deck:');
    if (name?.trim()) lfDb.createDeck(name.trim()).then(() => loadDecks());
};
window.exportPhrases = () => {
    lfDb.getAllSentences().then(sentences => {
        const text = sentences.map(s => `${s.original || s.phrase_text}\n${s.translation || s.phrase_translation}\n---\n`).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `linguaflow-frases.txt`;
        a.click();
    });
};

window.exportFullBackup = async () => {
    try {
        const words = await lfDb.getAllWords();
        const sentences = await lfDb.getAllSentences();
        const decks = await lfDb.getAllDecks();
        const reviews = await lfDb.getReviewLog(1000);
        
        const backup = {
            version: '1.0',
            date: new Date().toISOString(),
            words,
            sentences,
            decks,
            reviews
        };
        
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `linguaflow-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    } catch (e) { alert('Erro ao exportar backup'); }
};

window.exportToAnki = async () => {
    try {
        const words = await lfDb.getAllWords();
        if (words.length === 0) { alert('Nenhuma palavra para exportar'); return; }
        
        let csv = 'Word;Translation;Context;Level;Explanation\n';
        words.forEach(w => {
            const row = [
                w.word,
                w.translation || '',
                (w.context_sentence || '').replace(/;/g, ','),
                w.level || '',
                (w.explanation || '').replace(/[\n\r;]/g, ' ')
            ].join(';');
            csv += row + '\n';
        });
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `linguaflow-anki-export.csv`;
        a.click();
    } catch (e) { alert('Erro ao exportar para Anki'); }
};

window.importFullBackup = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.words || !data.sentences) throw new Error('Formato inválido');
            
            if (confirm(`Deseja importar ${data.words.length} palavras e ${data.sentences.length} frases? Isso pode sobrescrever dados existentes.`)) {
                // Import logic
                for (const w of data.words) await lfDb.saveWord(w);
                for (const s of data.sentences) await lfDb.saveSentence(s);
                for (const d of data.decks) await lfDb.createDeck(d.name); // Simplificado
                
                alert('Backup importado com sucesso! Recarregando...');
                window.location.reload();
            }
        } catch (err) { alert('Erro ao importar backup: ' + err.message); }
    };
    reader.readAsText(file);
};

// Detalhes da Palavra
window.openWordDetails = async (id) => {
    const word = await lfDb.getWordById(id);
    if (!word) return;

    const modal = document.getElementById('modalDetails');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    title.textContent = word.word;
    
    // IPA and Audio
    let ipaHtml = word.ipa ? `<span style="font-family:monospace; color:#64748b; margin-left:10px;">/${word.ipa}/</span>` : '';
    
    body.innerHTML = `
        <div class="detail-row" style="position:relative;">
            ${word.level ? `<span class="cefr-badge">${word.level}</span>` : ''}
            <span class="detail-label">Tradução e Áudio</span>
            <div style="display:flex; align-items:center;">
                <span class="detail-value" style="color:#4ade80;">${word.translation || '—'}</span>
                ${ipaHtml}
                <button class="audio-btn" id="playWordAudio">
                    <span>🔊</span> Ouvir
                </button>
            </div>
        </div>

        <div class="detail-row">
            <span class="detail-label">Shadowing Practice</span>
            <div class="shadowing-mode">
                <button class="audio-btn" id="shadowingPlay" style="width:50px; height:50px; font-size:20px;">🎧</button>
                <div style="flex:1; font-size:13px; color:#94a3b8;">
                    Ouça e repita em voz alta. O foco é imitar a entonação e o ritmo original.
                </div>
            </div>
        </div>

        <div class="detail-row">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span class="detail-label" style="margin-bottom:0;">Explicação da IA</span>
                <button class="audio-btn" id="copyAiWord" style="padding:4px 8px; font-size:11px;">📋 Copiar</button>
            </div>
            <div class="ai-explanation" id="aiExplanation">
                ${word.explanation || 'Analisando contexto...'}
            </div>
        </div>

        ${word.context_sentence ? `
        <div class="detail-row">
            <span class="detail-label">Exemplo de Uso</span>
            <div style="display:flex; align-items:center;">
                <p style="font-size:18px; line-height:1.6; font-style:italic;">"${word.context_sentence}"</p>
                <button class="audio-btn" id="playSentenceAudio" style="margin-left:15px;">
                    <span>🔊</span>
                </button>
            </div>
        </div>
        ` : ''}

        ${word.video_url ? `
        <div class="detail-row">
            <span class="detail-label">Visto em (Timestamp)</span>
            <a href="${word.video_url}" target="_blank" class="video-link-card">
                <div class="video-thumb">📺</div>
                <div class="video-info">
                    <h4>${word.video_title || 'Vídeo Original'}</h4>
                    <p>${word.platform || 'YouTube'} • Clique para ver no momento exato</p>
                </div>
            </a>
        </div>
        ` : ''}
    `;

    modal.style.display = 'flex';

    // Event Listeners
    document.getElementById('playWordAudio')?.addEventListener('click', () => tts.play(word.word, word.source_lang || 'en-US', word.audio_url));
    document.getElementById('playSentenceAudio')?.addEventListener('click', () => tts.play(word.context_sentence, word.source_lang || 'en-US'));
    document.getElementById('shadowingPlay')?.addEventListener('click', () => {
        tts.play(word.context_sentence || word.word, word.source_lang || 'en-US');
        const btn = document.getElementById('shadowingPlay');
        btn.style.boxShadow = '0 0 20px #38bdf8';
        setTimeout(() => btn.style.boxShadow = 'none', 1000);
    });

    // If no explanation, request it
    if (!word.explanation) {
        chrome.runtime.sendMessage({ 
            action: 'ai_explain_word', 
            word: word.word, 
            context: word.context_sentence 
        }, (response) => {
            if (response?.explanation) {
                document.getElementById('aiExplanation').textContent = response.explanation;
                word.explanation = response.explanation;
                lfDb.saveWord(word);
            }
        });
    }

    // Logic for Copy
    document.getElementById('copyAiWord')?.addEventListener('click', () => {
        const text = document.getElementById('aiExplanation').textContent;
        navigator.clipboard.writeText(text);
        const btn = document.getElementById('copyAiWord');
        btn.textContent = '✅ Copiado!';
        setTimeout(() => btn.textContent = '📋 Copiar', 2000);
    });
};

window.closeModal = () => {
    document.getElementById('modalDetails').style.display = 'none';
};

// Configurações de Estudo Estilo Anki
window.openStudySettings = async () => {
    const modal = document.getElementById('modalDetails');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    const newLimit = await lfDb.getSetting('newCardsPerDay') || 20;
    const revLimit = await lfDb.getSetting('reviewsPerDay') || 100;

    title.textContent = 'Opções de Estudo (SRS)';
    body.innerHTML = `
        <div style="padding:10px;">
            <div class="detail-row">
                <span class="detail-label">Novos Cards / Dia</span>
                <input type="number" id="anki-new-limit" value="${newLimit}" class="search-box" style="width:100%; max-width:120px; margin-top:8px;">
                <p style="color:#64748b; font-size:12px; margin-top:8px;">Número máximo de palavras novas que você quer aprender por dia.</p>
            </div>
            <div class="detail-row" style="margin-top:24px;">
                <span class="detail-label">Revisões Máximas / Dia</span>
                <input type="number" id="anki-rev-limit" value="${revLimit}" class="search-box" style="width:100%; max-width:120px; margin-top:8px;">
                <p style="color:#64748b; font-size:12px; margin-top:8px;">Limite diário de revisões para evitar sobrecarga.</p>
            </div>
            <button class="btn btn-primary" id="saveAnkiSettings" style="width:100%; margin-top:32px; padding:12px;">Salvar Configurações</button>
        </div>
    `;
    modal.style.display = 'flex';

    document.getElementById('saveAnkiSettings').onclick = async () => {
        const n = parseInt(document.getElementById('anki-new-limit').value);
        const r = parseInt(document.getElementById('anki-rev-limit').value);
        if (!isNaN(n)) await lfDb.setSetting('newCardsPerDay', n);
        if (!isNaN(r)) await lfDb.setSetting('reviewsPerDay', r);
        window.closeModal();
        loadStudy(); // Recarrega a fila com os novos limites
    };
};

// Detalhes da Frase
window.openSentenceDetails = async (id) => {
    const s = await lfDb.getSentenceById(id);
    if (!s) return;

    const modal = document.getElementById('modalDetails');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    title.textContent = 'Frase Salva';
    
    body.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">Original e Áudio</span>
            <div style="display:flex; align-items:start; gap:10px;">
                <p style="font-size:22px; font-weight:700; flex:1;">${s.original || s.phrase_text}</p>
                <button class="audio-btn" id="playPhraseAudio">
                    <span>🔊</span>
                </button>
            </div>
        </div>

        <div class="detail-row">
            <span class="detail-label">Tradução</span>
            <p style="font-size:18px; color:#4ade80;">${s.translation || s.phrase_translation || '—'}</p>
        </div>

        <div class="detail-row">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span class="detail-label" style="margin-bottom:0;">Análise da IA</span>
                <button class="audio-btn" id="copyAiSent" style="padding:4px 8px; font-size:11px;">📋 Copiar</button>
            </div>
            <div class="ai-explanation" id="aiSentenceExplanation">
                ${s.analysis || 'Analisando estrutura gramatical...'}
            </div>
        </div>

        ${s.video_url || s.url ? `
        <div class="detail-row">
            <span class="detail-label">Vídeo Original (Contexto)</span>
            <a href="${s.video_url || s.url}" target="_blank" class="video-link-card">
                <div class="video-thumb">📺</div>
                <div class="video-info">
                    <h4>${s.video_title || 'Vídeo capturado'}</h4>
                    <p>${s.platform || 'YouTube'} • Ver no momento exato</p>
                </div>
            </a>
        </div>
        ` : ''}
    `;

    modal.style.display = 'flex';

    document.getElementById('playPhraseAudio')?.addEventListener('click', () => tts.play(s.original || s.phrase_text, 'en-US'));

    // If no analysis, request it
    if (!s.analysis) {
        chrome.runtime.sendMessage({ 
            action: 'ai_explain_sentence', 
            sentence: s.original || s.phrase_text 
        }, (response) => {
            if (response?.analysis) {
                document.getElementById('aiSentenceExplanation').textContent = response.analysis;
                s.analysis = response.analysis;
                lfDb.saveSentence(s);
            }
        });
    }

    // Logic for Copy
    document.getElementById('copyAiSent')?.addEventListener('click', () => {
        const text = document.getElementById('aiSentenceExplanation').textContent;
        navigator.clipboard.writeText(text);
        const btn = document.getElementById('copyAiSent');
        btn.textContent = '✅ Copiado!';
        setTimeout(() => btn.textContent = '📋 Copiar', 2000);
    });
};

async function updateHeader() {
    try {
        const stats = await lfDb.getStats();
        if (document.getElementById('headerTotal')) document.getElementById('headerTotal').textContent = stats.totalWords;
        if (document.getElementById('headerDue')) document.getElementById('headerDue').textContent = stats.dueCards;
        if (document.getElementById('headerStreak')) document.getElementById('headerStreak').textContent = stats.streak;
        
        // Nível do Usuário
        const levelData = calculateUserLevel(stats);
        if (document.getElementById('headerLevel')) document.getElementById('headerLevel').textContent = levelData.cefr;

        // Meta Diária (Baseado em revisões hoje)
        const goal = 20; 
        const todayCount = stats.todayCount || 0;
        const percent = Math.min(100, Math.round((todayCount / goal) * 100));
        
        const goalPercentEl = document.getElementById('goalPercent');
        const goalBarEl = document.getElementById('goalBar');
        
        if (goalPercentEl) goalPercentEl.textContent = percent + '%';
        if (goalBarEl) goalBarEl.style.width = percent + '%';
    } catch (e) { console.error('Erro no header:', e); }
}

function calculateUserLevel(stats) {
    // Pesos por nível de palavra (CEFR)
    const weights = { A1: 1, A2: 2, B1: 4, B2: 8, C1: 16, C2: 32 };
    let vocabXP = 0;
    
    // Cada palavra madura conta 100% dos pontos, learning conta 30%
    const matureMultiplier = 1.0;
    const learningMultiplier = 0.3;
    
    if (stats.byCEFR) {
        Object.keys(stats.byCEFR).forEach(lv => {
            const count = stats.byCEFR[lv] || 0;
            vocabXP += count * (weights[lv] || 1) * 10; // Base: 10xp por palavra A1
        });
    }
    
    // Bônus de Imersão: 1 XP por minuto assistido
    const immersionXP = Math.round((stats.totalSecs || 0) / 60);
    
    // Bônus de Retenção: Multiplicador baseado na precisão (0.8x a 1.2x)
    const retentionFactor = 0.8 + ((stats.retention || 0) / 100) * 0.4;
    
    const totalXP = Math.round((vocabXP + immersionXP) * retentionFactor);
    
    const levels = [
        { id: 'A1', name: 'Iniciante (Beginner)', min: 0, max: 500 },
        { id: 'A2', name: 'Básico (Elementary)', min: 501, max: 2000 },
        { id: 'B1', name: 'Intermediário (Intermediate)', min: 2001, max: 6000 },
        { id: 'B2', name: 'Intermediário Superior', min: 6001, max: 15000 },
        { id: 'C1', name: 'Avançado (Advanced)', min: 15001, max: 40000 },
        { id: 'C2', name: 'Fluente (Proficient)', min: 40001, max: 1000000 }
    ];
    
    const current = levels.find(l => totalXP >= l.min && totalXP <= l.max) || levels[0];
    const progress = Math.min(100, Math.round(((totalXP - current.min) / (current.max - current.min)) * 100));
    
    return {
        cefr: current.id,
        name: current.name,
        xp: totalXP,
        nextMin: current.max,
        progress: progress,
        vocabPts: vocabXP,
        immersionPts: immersionXP,
        retention: stats.retention
    };
}

// ============================================================================
// STUDY MODE (SRS)
// ============================================================================
async function loadStudy() {
    const content = document.getElementById('studyContent');
    if (!content) return;

    content.innerHTML = '<div style="text-align:center;padding:40px;">Carregando cards...</div>';
    
    try {
        // Configurações Anki
        const newLimit = await lfDb.getSetting('newCardsPerDay') || 20;
        const revLimit = await lfDb.getSetting('reviewsPerDay') || 100;

        let allDue = await lfDb.getCardsDue(1000);
        
        if (window.dashboard.currentDeckFilter) {
            allDue = allDue.filter(c => c.wordData && c.wordData.deck_id === window.dashboard.currentDeckFilter);
        }

        // Separação e Limite Estilo Anki
        const newCards = allDue.filter(c => c.status === 'new').slice(0, newLimit);
        const reviewCards = allDue.filter(c => c.status !== 'new').slice(0, revLimit);

        studyCards = [...newCards, ...reviewCards].sort((a, b) => {
            const priority = { learning: 0, new: 1, review: 2, mature: 3 };
            return (priority[a.status] || 3) - (priority[b.status] || 3);
        });
        
        currentIndex = 0;
        showAnswer = false;
        
        if (studyCards.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎉</div>
                    <div class="empty-text">Parabéns! Você revisou todos os cards do dia!</div>
                    <p style="color:#64748b; margin-top:10px;">Volte amanhã para mais ou aumente seus limites diários nas configurações.</p>
                    ${window.dashboard.currentDeckFilter ? '<button class="btn btn-primary" onclick="window.dashboard.currentDeckFilter=null; window.dashboard.loadStudy()" style="margin-top:20px;">Ver Outros Decks</button>' : ''}
                </div>
            `;
            const badge = document.getElementById('study-count-badge');
            if (badge) badge.textContent = '0 Restantes';
            return;
        }
        
        showCard();
    } catch (e) {
        content.innerHTML = `<div style="color:red;padding:20px;">Erro ao carregar estudos: ${e.message}</div>`;
    }
}

async function showCard() {
    const content = document.getElementById('studyContent');
    const progress = document.getElementById('studyProgress');
    
    if (currentIndex >= studyCards.length) {
        loadStudy();
        return;
    }
    
    const card = studyCards[currentIndex];
    const word = card.wordData;
    
    if (!word) {
        currentIndex++;
        showCard();
        return;
    }

    if (progress) progress.textContent = `${currentIndex + 1} de ${studyCards.length} Restantes`;
    const badge = document.getElementById('study-count-badge');
    if (badge) badge.textContent = `${studyCards.length - currentIndex} Restantes`;
    
    // Modo Cloze (Método Natural): Se tiver contexto, oculta a palavra nele
    let frontHtml = `<div class="flashcard-word">${word.word}</div>`;
    
    if (isBlindMode) {
        frontHtml = `
            <div class="flashcard-word" style="filter: blur(25px); opacity:0.1;">MISSING</div>
            <div style="font-size:48px; margin-top:20px;">👂</div>
            <div class="flashcard-hint" style="margin-top:20px;">Ouça e tente identificar a palavra/frase</div>
        `;
    } else if (word.context_sentence) {
        const cloze = word.context_sentence.replace(new RegExp(`\\b(${word.word})\\b`, 'gi'), '<span style="color:#38bdf8; border-bottom:2px dashed #38bdf8;">[...]</span>');
        frontHtml = `
            <div class="flashcard-context" style="font-size:24px; color:#e2e8f0; font-style:normal; margin-bottom:30px;">"${cloze}"</div>
            <div class="flashcard-word" style="font-size:18px; opacity:0.3;">${word.word[0]}${'.'.repeat(word.word.length-1)}</div>
        `;
    }

    if (!showAnswer) {
        content.innerHTML = `
            <div class="flashcard-container">
                <div class="flashcard" id="flashcard-front" style="cursor:pointer;">
                    ${word.level ? `<span class="cefr-badge">${word.level}</span>` : ''}
                    <div style="position:absolute; top:20px; right:20px; display:flex; gap:10px;">
                        <button class="audio-btn" id="playStudyAudio" style="background:rgba(255,255,255,0.05);">🔊 Palavra</button>
                        ${word.context_sentence ? `<button class="audio-btn" id="playStudyAudioSent" style="background:rgba(255,255,255,0.05);">🔊 Frase</button>` : ''}
                    </div>
                    ${frontHtml}
                    <div class="flashcard-hint">Tente lembrar a palavra pelo contexto</div>
                </div>
            </div>
        `;
        document.getElementById('flashcard-front').addEventListener('click', (e) => {
            if (e.target.classList.contains('audio-btn')) return;
            revealAnswer();
        });
        document.getElementById('playStudyAudio').addEventListener('click', () => tts.play(word.word, 'en-US'));
        if (word.context_sentence) {
            document.getElementById('playStudyAudioSent').addEventListener('click', () => tts.play(word.context_sentence, 'en-US'));
        }
        
        // Auto-play audio on show
        tts.play(word.word, 'en-US');

    } else {
        const translation = word.translation || '';
        let translationHtml = '';
        if (translation) {
            translationHtml = `<div class="flashcard-translation">${translation}</div>`;
        } else {
            translationHtml = `<div class="flashcard-translation" style="color:#94a3b8;font-size:18px;">
                <button class="btn btn-primary" style="padding:5px 15px;font-size:12px;" id="missingTransBtn">Tradução ausente. Clique para traduzir</button>
               </div>`;
        }

        // Predições de Intervalo (Estilo Anki)
        const [intAgain, intHard, intGood, intEasy] = await Promise.all([
            lfDb.predictNextInterval(card, 1),
            lfDb.predictNextInterval(card, 2),
            lfDb.predictNextInterval(card, 3),
            lfDb.predictNextInterval(card, 4)
        ]);

        content.innerHTML = `
            <div class="flashcard-container">
                <div class="flashcard">
                    <div style="position:absolute; top:20px; right:20px; display:flex; gap:10px;">
                        <button class="audio-btn" id="playStudyWord" title="Ouvir Palavra">🔊 Palavra</button>
                        <button class="audio-btn" id="playStudySent" title="Ouvir Frase">🔊 Frase</button>
                    </div>
                    <div class="flashcard-word">${word.word}</div>
                    ${translationHtml}
                    <div class="flashcard-context">${word.context_sentence || ''}</div>
                </div>
            </div>
            <div class="study-actions">
                <button class="study-btn again" id="btn-again"><span class="study-btn-label">Errei</span><span class="study-btn-time">${formatInterval(intAgain)}</span></button>
                <button class="study-btn hard" id="btn-hard"><span class="study-btn-label">Difícil</span><span class="study-btn-time">${formatInterval(intHard)}</span></button>
                <button class="study-btn good" id="btn-good"><span class="study-btn-label">Bom</span><span class="study-btn-time">${formatInterval(intGood)}</span></button>
                <button class="study-btn easy" id="btn-easy"><span class="study-btn-label">Fácil</span><span class="study-btn-time">${formatInterval(intEasy)}</span></button>
            </div>
        `;
        
        const missingBtn = document.getElementById('missingTransBtn');
        if (missingBtn) missingBtn.addEventListener('click', () => translateWord(word.id, word.word));

        document.getElementById('playStudyWord').addEventListener('click', () => tts.play(word.word, 'en-US'));
        document.getElementById('playStudySent').addEventListener('click', () => tts.play(word.context_sentence, 'en-US'));

        document.getElementById('btn-again').addEventListener('click', () => answerCard(1));
        document.getElementById('btn-hard').addEventListener('click', () => answerCard(2));
        document.getElementById('btn-good').addEventListener('click', () => answerCard(3));
        document.getElementById('btn-easy').addEventListener('click', () => answerCard(4));
    }
}

function formatInterval(interval) {
    if (interval < 0.0007) return '<1m';
    if (interval < 0.04) return `${Math.round(interval * 1440)}m`;
    if (interval < 1) return `${Math.round(interval * 24)}h`;
    if (interval < 1.1) return '1d';
    if (interval < 30) return `${Math.round(interval)}d`;
    if (interval < 365) return `${Math.round(interval / 30)}mo`;
    return `${(interval / 365).toFixed(1)}y`;
}

function revealAnswer() {
    showAnswer = true;
    showCard();
}

async function answerCard(quality) {
    const card = studyCards[currentIndex];
    
    // Agora todo o cálculo pesado e lógica Anki está centralizada no lfDb.logReview
    await lfDb.logReview(card.id, quality);
    
    currentIndex++;
    showAnswer = false;
    updateHeader();
    await showCard();
}

// ============================================================================
// VOCABULARY & PHRASES
// ============================================================================
async function loadCards() {
    const grid = document.getElementById('cardsGrid');
    if (!grid) return;
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Carregando vocabulário...</div>';
    try {
        const words = await lfDb.getAllWords();
        const search = document.getElementById('library-search')?.value.toLowerCase() || '';
        let filtered = words.filter(w => 
            w.word.toLowerCase().includes(search) || (w.translation || '').toLowerCase().includes(search)
        );
        if (filtered.length === 0) {
            grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-text">Nenhum card encontrado</div></div>';
            return;
        }
        grid.innerHTML = filtered.map(word => `
            <div class="word-card" data-id="${word.id}">
                ${word.level ? `<span class="cefr-badge">${word.level}</span>` : ''}
                <div class="word-card-word">${word.word}</div>
                <div class="word-card-translation">${word.translation || '—'}</div>
                <div class="word-card-context">${word.context_sentence || ''}</div>
                <div class="word-card-meta">
                    <span class="status-badge status-${word.status || 'new'}">${(word.status || 'SALVO').toUpperCase()}</span>
                    <span>${new Date(word.added_at).toLocaleDateString('pt-BR')}</span>
                </div>
            </div>
        `).join('');

        // Event listeners para abrir detalhes
        grid.querySelectorAll('.word-card').forEach(card => {
            card.addEventListener('click', () => window.openWordDetails(card.dataset.id));
        });
    } catch (e) {}
}

async function loadPhrases() {
    const list = document.getElementById('phrasesList');
    if (!list) return;
    try {
        const sentences = await lfDb.getAllSentences();
        const search = document.getElementById('library-search')?.value.toLowerCase() || '';
        let filtered = sentences.filter(s => 
            (s.original || s.phrase_text || '').toLowerCase().includes(search) || 
            (s.translation || s.phrase_translation || '').toLowerCase().includes(search)
        );

        if (filtered.length === 0) {
            list.innerHTML = `<div class="empty-state"><div class="empty-text">${search ? 'Nenhuma frase encontrada para esta busca' : 'Nenhuma frase salva ainda'}</div></div>`;
            return;
        }
        list.innerHTML = filtered.map(s => `
            <div class="phrase-item" style="cursor:pointer;" data-id="${s.id}" data-text="${s.original || s.phrase_text}">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div style="flex:1;" class="phrase-click-area">
                        <div class="phrase-original">${s.original || s.phrase_text || ''}</div>
                        <div class="phrase-translation">${s.translation || s.phrase_translation || ''}</div>
                        <div class="phrase-meta">${s.platform || ''} • ${new Date(s.saved_at || s.added_at).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <button class="audio-btn play-phrase-btn" style="background:transparent; font-size:20px;">🔊</button>
                </div>
            </div>
        `).join('');

        list.querySelectorAll('.phrase-item').forEach(item => {
            item.querySelector('.phrase-click-area').addEventListener('click', () => {
                window.openSentenceDetails(item.dataset.id);
            });
            
            item.querySelector('.play-phrase-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                tts.play(item.dataset.text, 'en-US');
            });
        });

        // Lógica de Ouvir Todas (Imersão Passiva)
        document.getElementById('playAllPhrases')?.addEventListener('click', () => {
            if (immersionPlayerInterval) {
                clearInterval(immersionPlayerInterval);
                immersionPlayerInterval = null;
                document.getElementById('playAllPhrases').innerHTML = '<span>▶️</span> Ouvir Todas (Imersão)';
                return;
            }

            let idx = 0;
            const playNext = () => {
                if (idx >= sentences.length) {
                    clearInterval(immersionPlayerInterval);
                    immersionPlayerInterval = null;
                    document.getElementById('playAllPhrases').innerHTML = '<span>▶️</span> Ouvir Todas (Imersão)';
                    return;
                }
                const s = sentences[idx];
                tts.play(s.original || s.phrase_text, 'en-US');
                idx++;
            };

            document.getElementById('playAllPhrases').innerHTML = '<span>⏹️</span> Parar Imersão';
            playNext();
            immersionPlayerInterval = setInterval(playNext, 5000); // Toca a cada 5 segundos
        });

    } catch (e) {}
}

// ============================================================================
// DECKS
// ============================================================================
async function loadDecks() {
    const list = document.getElementById('library-decks-list');
    if (!list) return;
    try {
        const decks = await lfDb.getAllDecks();
        const words = await lfDb.getAllWords();
        if (decks.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-text">Nenhum deck criado ainda</div></div>';
            return;
        }
        list.innerHTML = decks.map(deck => {
            const deckWords = words.filter(w => w.deck_id === deck.id);
            const count = deckWords.length;
            const matureCount = deckWords.filter(w => w.status === 'mature').length;
            const isDefault = deck.id === 1;
            
            let levelLabel = 'Bronze';
            let levelColor = '#cd7f32';
            if (matureCount >= 50) { levelLabel = 'Ouro'; levelColor = '#ffd700'; }
            else if (matureCount >= 20) { levelLabel = 'Prata'; levelColor = '#c0c0c0'; }

            return `
                <div class="phrase-item">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div class="phrase-original">${isDefault ? '📚' : '🎴'} ${deck.name} <span style="font-size:10px; padding:2px 6px; border-radius:10px; background:${levelColor}; color:#000; margin-left:8px; font-weight:800;">${levelLabel}</span></div>
                            <div class="phrase-meta">${count} palavras (${matureCount} masterizadas)</div>
                        </div>
                        <div style="display:flex;gap:10px;">
                            <button class="btn btn-primary study-deck-btn" style="padding:8px 15px;" data-id="${deck.id}">Estudar</button>
                            ${!isDefault ? `<button class="btn delete-deck-btn" style="background:#ef4444;padding:8px;color:white;" data-id="${deck.id}">🗑️</button>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.study-deck-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                window.dashboard.studyDeck(id);
            });
        });

        list.querySelectorAll('.delete-deck-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                window.dashboard.deleteDeck(id);
            });
        });

    } catch (e) {}
}

// ============================================================================
// STATS & HEATMAP
// ============================================================================
async function loadStats() {
    try {
        const stats = await lfDb.getStats();
        const words = await lfDb.getAllWords();
        const reviews = await lfDb.getReviewLog(365);
        
        // --- Cálculo de Streak ---
        const reviewDates = [...new Set(reviews.map(r => r.date))].sort((a, b) => b.localeCompare(a));
        let streak = 0;
        let todayStr = new Date().toISOString().split('T')[0];
        
        if (reviewDates.length > 0) {
            let lastDate = reviewDates[0];
            const diffDays = Math.floor((new Date(todayStr) - new Date(lastDate)) / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 1) { // Se revisou hoje ou ontem
                streak = 1;
                for (let i = 1; i < reviewDates.length; i++) {
                    const d1 = new Date(reviewDates[i-1]);
                    const d2 = new Date(reviewDates[i]);
                    const diff = Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
                    if (diff === 1) streak++;
                    else break;
                }
            }
        }
        
        // Atualiza UI
        if (document.getElementById('statStreakVal')) document.getElementById('statStreakVal').textContent = streak;
        if (document.getElementById('statTotalVal')) document.getElementById('statTotalVal').textContent = stats.totalWords;
        if (document.getElementById('statRetentVal')) document.getElementById('statRetentVal').textContent = stats.retention + '%';
        if (document.getElementById('statHoursVal')) document.getElementById('statHoursVal').textContent = (stats.totalSecs / 3600).toFixed(1);

        // Atualiza UI de Nível
        const lv = calculateUserLevel(stats);
        if (document.getElementById('current-cefr-big')) document.getElementById('current-cefr-big').textContent = lv.cefr;
        if (document.getElementById('level-name')) document.getElementById('level-name').textContent = lv.name;
        if (document.getElementById('xp-display')) document.getElementById('xp-display').textContent = `${lv.xp.toLocaleString()} / ${lv.nextMin.toLocaleString()} XP`;
        if (document.getElementById('xp-bar')) document.getElementById('xp-bar').style.width = lv.progress + '%';
        if (document.getElementById('lvl-vocab-pts')) document.getElementById('lvl-vocab-pts').textContent = lv.vocabPts.toLocaleString();
        if (document.getElementById('lvl-immersion-pts')) document.getElementById('lvl-immersion-pts').textContent = lv.immersionPts.toLocaleString();
        if (document.getElementById('lvl-retention-bonus')) document.getElementById('lvl-retention-bonus').textContent = lv.retention + '%';

        renderCEFR(stats.byCEFR);
        renderStatusDistribution(stats.byStatus);
        renderHeatmap('stats-heatmap');
    } catch (e) { console.error('Erro ao carregar stats:', e); }
}

function renderStatusDistribution(data) {
    const container = document.getElementById('status-distribution');
    if (!container || !data) return;
    
    const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
    const statuses = [
        { key: 'new', label: 'Novas', color: '#94a3b8' },
        { key: 'learning', label: 'Aprendendo', color: '#38bdf8' },
        { key: 'review', label: 'Revisão', color: '#818cf8' },
        { key: 'mature', label: 'Maduras', color: '#10b981' }
    ];
    
    container.innerHTML = statuses.map(s => {
        const val = data[s.key] || 0;
        const pct = Math.round((val / total) * 100);
        return `
            <div style="width:100%;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:12px;">
                    <span style="color:#94a3b8; font-weight:600;">${s.label}</span>
                    <span style="color:white; font-weight:800;">${val} (${pct}%)</span>
                </div>
                <div style="width:100%; height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
                    <div style="width:${pct}%; height:100%; background:${s.color}; border-radius:4px; transition:width 0.8s;"></div>
                </div>
            </div>
        `;
    }).join('');
}

function renderCEFR(data) {
    const container = document.getElementById('cefr-chart');
    if (!container || !data) return;
    
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const max = Math.max(...Object.values(data), 1);
    
    container.innerHTML = levels.map(lv => {
        const val = data[lv] || 0;
        const height = (val / max) * 100;
        return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;">
                <div style="width:100%;background:rgba(56,189,248,0.1);border-radius:4px;height:100%;display:flex;align-items:flex-end;">
                    <div style="width:100%;height:${height}%;background:linear-gradient(to top, #38bdf8, #818cf8);border-radius:4px;transition:height 0.5s;"></div>
                </div>
                <span style="font-size:11px;color:#64748b;font-weight:700;">${lv}</span>
                <span style="font-size:10px;color:#94a3b8;">${val}</span>
            </div>
        `;
    }).join('');
}

async function renderHeatmap(containerId = 'heatmap-container') {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
        const sessions = await lfDb.getSessions(365);
        const counts = {};
        sessions.forEach(s => counts[s.date] = (counts[s.date] || 0) + 1);
        
        container.innerHTML = '';
        const today = new Date();
        const colors = ['#1e293b', '#164e63', '#0e7490', '#0891b2', '#38BDF8'];
        const start = new Date(today);
        start.setDate(today.getDate() - 364);
        start.setDate(start.getDate() - start.getDay());

        let cur = new Date(start);
        let week = null;
        while (cur <= today) {
            if (cur.getDay() === 0) {
                week = document.createElement('div');
                week.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
                container.appendChild(week);
            }
            const key = cur.toISOString().split('T')[0];
            const c = counts[key] || 0;
            const level = c === 0 ? 0 : Math.min(4, c);
            const cell = document.createElement('div');
            cell.style.cssText = `width:12px;height:12px;border-radius:2px;background:${colors[level]};`;
            cell.title = `${key}: ${c} sessões`;
            week.appendChild(cell);
            cur.setDate(cur.getDate() + 1);
        }
    } catch (e) {}
}

// ============================================================================
// LISTENING (NATURAL METHOD)
// ============================================================================
async function loadListening() {
    const content = document.getElementById('listeningContent');
    if (!content) return;

    try {
        const sentences = await lfDb.getAllSentences();
        if (sentences.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎧</div>
                    <div class="empty-text">Salve algumas frases de vídeos para começar a imersão.</div>
                </div>
            `;
            return;
        }

        // Escolhe uma frase aleatória que ainda não foi "dominada" (simplificado)
        const sentence = sentences[Math.floor(Math.random() * sentences.length)];
        const text = sentence.original || sentence.phrase_text;

        content.innerHTML = `
            <div class="listening-container">
                <div class="immersion-card">
                    <div style="font-size:12px; color:#64748b; font-weight:700; text-transform:uppercase; margin-bottom:20px;">
                        Modo Imersão (Método Natural)
                    </div>
                    
                    <div class="immersion-text hidden" id="blurText">
                        ${text}
                    </div>

                    <div class="immersion-controls">
                        <button class="immersion-btn" id="playImmersionAudio" title="Ouvir Frase">
                            <span>🔊</span>
                        </button>
                        <button class="immersion-btn" id="toggleBlur" title="Revelar/Ocultar Texto">
                            <span>👁️</span>
                        </button>
                        <button class="immersion-btn" id="nextListening" title="Próxima Frase">
                            <span>⏭️</span>
                        </button>
                    </div>

                    <div class="writing-test-container">
                        <div style="text-align:left; margin-bottom:10px; font-weight:600; color:#38bdf8;">
                            Teste de Escrita:
                        </div>
                        <input type="text" class="writing-input" id="writingInput" placeholder="Digite o que você ouviu...">
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-primary" id="checkWriting" style="flex:1;">Verificar</button>
                            <button class="btn" id="showHint" style="background:rgba(255,255,255,0.05); color:#94a3b8;">Dica</button>
                        </div>
                        <div id="writingFeedback" style="margin-top:15px; font-weight:700; display:none;"></div>
                    </div>
                </div>
            </div>
        `;

        // Event Listeners
        const blurEl = document.getElementById('blurText');
        const inputEl = document.getElementById('writingInput');
        const feedbackEl = document.getElementById('writingFeedback');

        document.getElementById('playImmersionAudio').addEventListener('click', () => {
            tts.play(text, 'en-US');
            inputEl.focus();
        });

        document.getElementById('toggleBlur').addEventListener('click', () => {
            blurEl.classList.toggle('hidden');
        });

        document.getElementById('nextListening').addEventListener('click', () => loadListening());

        document.getElementById('checkWriting').addEventListener('click', () => {
            const answer = inputEl.value.trim().toLowerCase();
            const correct = text.trim().toLowerCase().replace(/[.,!?;:]/g, '');
            const normalizedAnswer = answer.replace(/[.,!?;:]/g, '');

            feedbackEl.style.display = 'block';
            if (normalizedAnswer === correct) {
                feedbackEl.style.color = '#4ade80';
                feedbackEl.textContent = '✨ Perfeito! Você ouviu corretamente.';
                blurEl.classList.remove('hidden');
            } else {
                feedbackEl.style.color = '#ef4444';
                feedbackEl.textContent = '❌ Quase lá... tente ouvir novamente.';
            }
        });

        document.getElementById('showHint').addEventListener('click', () => {
            const hint = text.split(' ').map(w => w[0] + '_'.repeat(w.length - 1)).join(' ');
            inputEl.placeholder = `Dica: ${hint}`;
        });

        // Atalho Enter
        inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') document.getElementById('checkWriting').click();
        });

    } catch (e) {
        console.error('Erro no listening:', e);
    }
}

// ============================================================================
// QUIZ
// ============================================================================
async function initQuiz() {
    const container = document.getElementById('quiz-container');
    if (!container) return;

    const words = (await lfDb.getAllWords()).filter(w => w.word && w.translation);
    
    if (words.length < 4) {
        container.innerHTML = `
            <div id="quiz-empty" style="text-align:center; padding:60px 20px; background:rgba(15,23,42,0.9); border:2px solid rgba(239,68,68,0.2); border-radius:25px;">
                <div style="font-size:48px; margin-bottom:20px;">📚</div>
                <h3 style="color:white; margin-bottom:10px;">Vocabulário Insuficiente</h3>
                <p style="color:#94a3b8; font-size:14px; margin-bottom:30px;">Você precisa de pelo menos 4 palavras com tradução salva para iniciar um quiz.</p>
                <button class="btn btn-primary" onclick="switchTab('library')">Ir para Biblioteca</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="quiz-card" style="background:rgba(15,23,42,0.9); border:2px solid rgba(56,189,248,0.2); border-radius:25px; padding:40px; position:relative; animation: fadeIn 0.4s ease-out;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px;">
                <div id="quiz-mode-badge" style="background:rgba(56,189,248,0.1); color:#38bdf8; padding:5px 15px; border-radius:20px; font-size:12px; font-weight:700; text-transform:uppercase;">Preparando...</div>
                <div id="quiz-score" style="font-size:18px; font-weight:800; color:#fbbf24;">⚡ 0</div>
            </div>
            
            <div style="width:100%; height:6px; background:rgba(255,255,255,0.05); border-radius:3px; margin-bottom:30px; overflow:hidden;">
                <div id="quiz-fill" style="width:0%; height:100%; background:#38bdf8; transition:width 0.3s;"></div>
            </div>

            <div style="text-align:center; margin-bottom:40px;">
                <div id="quiz-progress" style="font-size:14px; color:#64748b; margin-bottom:10px;">0 / 10</div>
                <div id="quiz-word" style="font-size:48px; font-weight:800; color:white; margin-bottom:10px;">...</div>
                <div id="quiz-context-hint" style="font-size:16px; color:#94a3b8; font-style:italic;"></div>
            </div>

            <div id="quiz-options" style="display:grid; grid-template-columns:1fr 1fr; gap:15px;"></div>

            <div id="quiz-writing-container" style="display:none;">
                <input type="text" id="quiz-writing-input" class="search-box" style="width:100%; text-align:center; font-size:24px; padding:20px;" placeholder="Digite a tradução...">
            </div>

            <div id="quiz-feedback" style="margin-top:30px; padding:20px; border-radius:15px; text-align:center; font-weight:700; display:none;"></div>
            
            <button id="btn-quiz-next" class="btn btn-primary" style="display:none; width:100%; margin-top:20px;">Próxima ➔</button>

            <div id="quiz-timer-container" style="position:absolute; top:0; left:0; width:100%; height:4px; background:rgba(255,255,255,0.05);">
                <div id="quiz-timer-fill" style="width:100%; height:100%; background:#fbbf24;"></div>
            </div>
            
            <div style="text-align:center; margin-top:20px;">
                <button id="quiz-audio-btn" class="immersion-btn" style="display:none; margin: 0 auto;">🔊</button>
            </div>
        </div>
    `;

    window.dashboard._quizWords = words.sort(() => Math.random() - 0.5).slice(0, 10);
    window.dashboard._quizIndex = 0;
    window.dashboard._quizScore = 0;
    window.dashboard._quizPoints = 0;
    renderQuizCard();
}

let quizTimerInterval = null;
function startQuizTimer() {
    if (quizTimerInterval) clearInterval(quizTimerInterval);
    const fill = document.getElementById('quiz-timer-fill');
    if (!fill) return;
    
    let timeLeft = 100;
    fill.style.width = '100%';
    
    quizTimerInterval = setInterval(() => {
        timeLeft -= 1;
        fill.style.width = timeLeft + '%';
        if (timeLeft <= 0) {
            clearInterval(quizTimerInterval);
            window.dashboard.answerQuiz(false, true); // Timeout
        }
    }, 100); // 10 segundos no total
}

async function renderQuizCard() {
    const d = window.dashboard;
    const word = d._quizWords[d._quizIndex];
    if (!word) { showQuizResult(); return; }

    const modes = ['choice', 'audio', 'writing'];
    const mode = modes[Math.floor(Math.random() * modes.length)];
    d._currentQuizMode = mode;

    const words = await lfDb.getAllWords();
    const options = words
        .filter(w => w.id !== word.id && w.translation)
        .sort(() => Math.random() - 0.5).slice(0, 3);
    options.push(word);
    options.sort(() => Math.random() - 0.5);

    document.getElementById('quiz-word').textContent = mode === 'audio' ? '???' : word.word;
    document.getElementById('quiz-progress').textContent = `${d._quizIndex + 1} / ${d._quizWords.length}`;
    document.getElementById('quiz-fill').style.width = `${((d._quizIndex + 1) / d._quizWords.length) * 100}%`;
    document.getElementById('quiz-mode-badge').textContent = mode === 'choice' ? 'Múltipla Escolha' : (mode === 'audio' ? 'Audição' : 'Escrita');
    document.getElementById('quiz-context-hint').textContent = word.context_sentence ? `Contexto: "${word.context_sentence}"` : '';
    
    const optContainer = document.getElementById('quiz-options');
    const writingContainer = document.getElementById('quiz-writing-container');
    const audioBtn = document.getElementById('quiz-audio-btn');

    optContainer.style.display = mode === 'writing' ? 'none' : 'grid';
    writingContainer.style.display = mode === 'writing' ? 'block' : 'none';
    audioBtn.style.display = mode === 'audio' ? 'inline-block' : 'none';

    if (mode === 'choice' || mode === 'audio') {
        optContainer.innerHTML = options.map((opt, i) => `
            <button class="btn quiz-opt" style="background:rgba(255,255,255,0.05);color:white;text-align:left;width:100%;margin-bottom:10px;padding:15px;" data-correct="${opt.id === word.id}">
                <span style="color:#38bdf8;margin-right:10px;font-weight:800;">${i + 1}</span> ${opt.translation}
            </button>
        `).join('');

        optContainer.querySelectorAll('.quiz-opt').forEach(btn => {
            btn.addEventListener('click', () => window.dashboard.answerQuiz(btn.getAttribute('data-correct') === 'true'));
        });
    }

    if (mode === 'writing') {
        const input = document.getElementById('quiz-writing-input');
        input.value = '';
        input.focus();
        const handler = (e) => {
            if (e.key === 'Enter') {
                const isCorrect = input.value.trim().toLowerCase() === word.translation.toLowerCase();
                input.removeEventListener('keypress', handler);
                window.dashboard.answerQuiz(isCorrect);
            }
        };
        input.addEventListener('keypress', handler);
    }

    if (mode === 'audio') {
        tts.play(word.word, 'en-US');
        audioBtn.onclick = () => tts.play(word.word, 'en-US');
    }

    document.getElementById('quiz-feedback').style.display = 'none';
    document.getElementById('btn-quiz-next').style.display = 'none';
    
    startQuizTimer();
}

function showQuizResult() {
    const container = document.getElementById('quiz-container');
    const score = window.dashboard._quizScore;
    const total = window.dashboard._quizWords.length;
    container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;background:rgba(15,23,42,0.9);border:2px solid rgba(56,189,248,0.2);border-radius:25px;">
            <div style="font-size:64px;margin-bottom:20px;">🏆</div>
            <h2 style="color:white;margin-bottom:10px;">Quiz Finalizado!</h2>
            <div style="font-size:24px;font-weight:800;color:#38bdf8;margin-bottom:10px;">Pontos: ${window.dashboard._quizPoints}</div>
            <div style="font-size:16px;color:#94a3b8;margin-bottom:30px;">Acertos: ${score} / ${window.dashboard._quizWords.length}</div>
            <button id="retryQuizBtn" class="btn btn-primary" style="margin-top:30px;">🔄 Tentar Novamente</button>
        </div>
    `;
    document.getElementById('retryQuizBtn').addEventListener('click', () => window.dashboard.initQuiz());
}

// ============================================================================
// UTILS
// ============================================================================
async function translateWord(wordId, wordText) {
    try {
        chrome.runtime.sendMessage({ action: 'translate', text: wordText }, async (response) => {
            if (response?.translation) {
                const words = await lfDb.getAllWords();
                const wordObj = words.find(w => w.id === wordId);
                if (wordObj) {
                    wordObj.translation = response.translation;
                    await lfDb.saveWord(wordObj);
                    updateHeader();
                    showCard();
                }
            }
        });
    } catch (e) {}
}


async function loadHome() {
    try {
        const stats = await lfDb.getStats();
        const words = await lfDb.getAllWords();
        const dueCount = words.filter(w => (w.due_date || 0) <= Date.now()).length;
        
        // Update Home UI
        const studyDesc = document.getElementById('home-study-desc');
        if (dueCount > 0) {
            studyDesc.innerHTML = `Você tem <b style="color:#38bdf8;">${dueCount} revisões</b> pendentes para hoje.`;
        } else {
            studyDesc.textContent = "Tudo em dia por aqui! Que tal salvar novas palavras?";
        }

        // Streak & Goals
        const reviews = await lfDb.getReviewLog(365);
        const reviewDates = [...new Set(reviews.map(r => r.date))].sort((a, b) => b.localeCompare(a));
        let streak = 0;
        let todayStr = new Date().toISOString().split('T')[0];
        
        if (reviewDates.length > 0) {
            let lastDate = reviewDates[0];
            const diffDays = Math.floor((new Date(todayStr) - new Date(lastDate)) / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 1) { // Se revisou hoje ou ontem
                streak = 1;
                for (let i = 1; i < reviewDates.length; i++) {
                    const d1 = new Date(reviewDates[i-1]);
                    const d2 = new Date(reviewDates[i]);
                    const diff = Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
                    if (diff === 1) streak++;
                    else break;
                }
            }
        }
        
        const today = new Date().toISOString().split('T')[0];
        const newToday = words.filter(w => new Date(w.added_at).toISOString().split('T')[0] === today).length;

        if (document.getElementById('home-streak-val')) document.getElementById('home-streak-val').textContent = streak;
        if (document.getElementById('home-goal-val')) document.getElementById('home-goal-val').textContent = `${newToday}/20`;
        
        renderHeatmap('home-heatmap');
        loadHomeDecks();
    } catch (e) { console.error('Erro ao carregar home:', e); }
}

async function loadHomeDecks() {
    const list = document.getElementById('home-decks-list');
    if (!list) return;

    const searchTerm = document.getElementById('home-deck-search')?.value?.toLowerCase() || '';
    const stats = await lfDb.getDeckStats();
    
    const filtered = stats.filter(s => s.name.toLowerCase().includes(searchTerm));

    if (filtered.length === 0) {
        list.innerHTML = `<div style="padding:40px; text-align:center; color:#64748b;">Nenhum deck encontrado ${searchTerm ? 'para esta busca' : ''}.</div>`;
        return;
    }

    list.innerHTML = filtered.map(d => `
        <div class="deck-row" style="display:grid; grid-template-columns: 2fr 100px 100px 100px 120px; gap:15px; padding:15px 20px; align-items:center; border-bottom:1px solid rgba(255,255,255,0.03); hover:background:rgba(255,255,255,0.02); transition:all 0.2s; border-left: 3px solid ${d.id === 1 ? '#38bdf8' : 'transparent'};">
            <div style="display:flex; align-items:center; gap:12px;">
                <span style="font-size:18px;">${d.icon || '🗂️'}</span>
                <div>
                    <div style="color:white; font-weight:600; font-size:14px;">${d.name}</div>
                    ${d.url ? `<a href="${d.url}" target="_blank" style="color:#64748b; font-size:10px; text-decoration:none;">🔗 Ver Origem</a>` : ''}
                </div>
            </div>
            <div style="text-align:center; color:#38bdf8; font-weight:700;">${d.newCount}</div>
            <div style="text-align:center; color:#4ade80; font-weight:700;">${d.dueCount}</div>
            <div style="text-align:center; color:#94a3b8;">${d.totalCount}</div>
            <div style="text-align:right;">
                <button class="btn btn-primary home-study-deck-btn" data-id="${d.id}" style="padding:6px 12px; font-size:11px; border-radius:8px;">Estudar</button>
            </div>
        </div>
    `).join('');

    // Adiciona listeners dinamicamente para evitar bloqueio de CSP (inline scripts)
    list.querySelectorAll('.home-study-deck-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const id = parseInt(btn.getAttribute('data-id'));
            window.dashboard.studyDeck(id);
        });
    });
}

// Logic removida daqui e movida para o topo (global exposure)

async function loadLibrary() {
    await loadLibraryItems(); // Items grid
}

async function loadLibraryItems() {
    const isWords = document.getElementById('lib-tab-words')?.classList.contains('active');
    const container = document.getElementById('cardsGrid');
    const listContainer = document.getElementById('phrasesList');
    
    if (isWords) {
        if (container) container.style.display = 'grid';
        if (listContainer) listContainer.style.display = 'none';
        await loadCards();
    } else {
        if (container) container.style.display = 'none';
        if (listContainer) listContainer.style.display = 'block';
        await loadPhrases();
    }
}

window.startLab = (mode) => {
    document.getElementById('lab-selection').style.display = 'none';
    if (mode === 'quiz') {
        document.getElementById('quiz-area').style.display = 'block';
        initQuiz();
    } else {
        document.getElementById('listening-area').style.display = 'block';
        loadListening();
    }
};

window.backToLab = () => {
    document.getElementById('lab-selection').style.display = 'grid';
    document.getElementById('quiz-area').style.display = 'none';
    document.getElementById('listening-area').style.display = 'none';
};

function switchTab(tab) {
    console.log('[LinguaFlow] Navegando para:', tab);
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    
    const section = document.getElementById(`${tab}-section`);
    const btn = document.querySelector(`.nav-tab[data-tab="${tab}"]`);
    
    if (section) section.classList.add('active');
    if (btn) btn.classList.add('active');
    
    window.location.hash = tab;

    // Carregamento dinâmico
    setTimeout(async () => {
        if (tab === 'home') await loadHome();
        else if (tab === 'study') await loadStudy();
        else if (tab === 'library') await loadLibrary();
        else if (tab === 'lab') await loadLab();
        else if (tab === 'progresso') await loadStats();
        else if (tab === 'config') await loadConfig();
    }, 10);
}

async function loadLab() {
    document.getElementById('lab-selection').style.display = 'grid';
    document.getElementById('quiz-area').style.display = 'none';
    document.getElementById('listening-area').style.display = 'none';
}

// Configurações SRS Avançadas
async function loadConfig() {
    const s = async (k, id, def) => {
        const val = await lfDb.getSetting(k);
        const el = document.getElementById(id);
        if (el) el.value = val !== undefined ? val : def;
    };
    
    // Novos Cards
    await s('newCardsPerDay', 'cfg-new-limit', 20);
    await s('learning_steps', 'cfg-learning-steps', '1 10');
    await s('new_order', 'cfg-new-order', 'newest');
    
    // Revisões
    await s('reviewsPerDay', 'cfg-rev-limit', 100);
    await s('easy_bonus', 'cfg-easy-bonus', 130);
    await s('interval_modifier', 'cfg-int-mod', 100);
    
    // Algoritmo
    await s('initial_ease', 'cfg-ease-factor', 250);
    await s('graduating_interval', 'cfg-grad-int', 1);
    await s('easy_interval', 'cfg-easy-int', 4);
    await s('max_interval', 'cfg-max-int', 36500);
    
    // Falhas
    await s('lapse_modifier', 'cfg-lapse-mod', 0);
    await s('leech_threshold', 'cfg-leech-threshold', 8);
    await s('leech_action', 'cfg-leech-action', 'tag');

    // IA Settings
    await s('grok_api_key', 'cfg-grok-key', '');
}

async function saveAllConfig() {
    const btn = document.getElementById('save-all-config');
    btn.textContent = '⏳ Salvando...';
    btn.disabled = true;

    const g = (id) => document.getElementById(id).value;
    const n = (id) => parseInt(g(id));

    try {
        await Promise.all([
            lfDb.setSetting('newCardsPerDay', n('cfg-new-limit')),
            lfDb.setSetting('learning_steps', g('cfg-learning-steps')),
            lfDb.setSetting('new_order', g('cfg-new-order')),
            
            lfDb.setSetting('reviewsPerDay', n('cfg-rev-limit')),
            lfDb.setSetting('easy_bonus', n('cfg-easy-bonus')),
            lfDb.setSetting('interval_modifier', n('cfg-int-mod')),
            
            lfDb.setSetting('initial_ease', n('cfg-ease-factor')),
            lfDb.setSetting('graduating_interval', n('cfg-grad-int')),
            lfDb.setSetting('easy_interval', n('cfg-easy-int')),
            lfDb.setSetting('max_interval', n('cfg-max-int')),
            
            lfDb.setSetting('lapse_modifier', n('cfg-lapse-mod')),
            lfDb.setSetting('leech_threshold', n('cfg-leech-threshold')),
            lfDb.setSetting('leech_action', g('cfg-leech-action')),

            lfDb.setSetting('grok_api_key', g('cfg-grok-key'))
        ]);

        btn.textContent = '✅ Alterações Salvas!';
        btn.style.background = '#10b981';
        btn.style.boxShadow = '0 10px 30px rgba(16,185,129,0.3)';
    } catch (e) {
        console.error(e);
        btn.textContent = '❌ Erro ao Salvar';
        btn.style.background = '#ef4444';
    }
    
    setTimeout(() => {
        btn.textContent = 'Salvar Todas as Alterações';
        btn.style.background = '';
        btn.style.boxShadow = '';
        btn.disabled = false;
    }, 2000);
}

async function init() {
    console.log('🚀 Iniciando Dashboard Monolito...');
    try {
        await lfDb.initPromise;
        
        // Vincula eventos de navegação (Substituindo onclick bloqueado por CSP)
        document.querySelectorAll('.nav-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                if (tab) switchTab(tab);
            });
        });

        document.getElementById('exportAnkiBtn')?.addEventListener('click', () => window.exportToAnki());
        document.getElementById('exportFullBtn')?.addEventListener('click', () => window.dashboard.refreshDashboard()); // Fallback placeholder
        document.getElementById('start-quiz-btn')?.addEventListener('click', () => window.startLab('quiz'));
        document.getElementById('start-listening-btn')?.addEventListener('click', () => window.startLab('listening'));
        document.getElementById('back-to-lab-quiz')?.addEventListener('click', () => window.backToLab());
        document.getElementById('back-to-lab-list')?.addEventListener('click', () => window.backToLab());
        document.getElementById('backToLabBtn')?.addEventListener('click', () => window.backToLab());

        // Abas da Biblioteca
        const libTabWords = document.getElementById('lib-tab-words');
        const libTabPhrases = document.getElementById('lib-tab-phrases');
        if (libTabWords && libTabPhrases) {
            libTabWords.addEventListener('click', () => {
                libTabWords.classList.add('active');
                libTabPhrases.classList.remove('active');
                loadLibraryItems();
            });
            libTabPhrases.addEventListener('click', () => {
                libTabPhrases.classList.add('active');
                libTabWords.classList.remove('active');
                loadLibraryItems();
            });
        }

        // Busca Global (Topo)
        document.getElementById('globalSearch')?.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const activeSection = document.querySelector('.content-section.active')?.id;
            
            if (activeSection === 'library-section') {
                const libSearch = document.getElementById('library-search');
                if (libSearch) { libSearch.value = query; loadLibraryItems(); }
            } else if (activeSection === 'study-section') {
                // No study mode, search doesn't do much, maybe switch to library?
            } else {
                if (query.length > 1) {
                    switchTab('library');
                    const libSearch = document.getElementById('library-search');
                    if (libSearch) { libSearch.value = query; loadLibraryItems(); }
                }
            }
        });
        
        // Botão "Começar Agora" da Home
        document.getElementById('start-study-btn')?.addEventListener('click', () => switchTab('study'));

        // Botão de ação Modo Cego
        document.getElementById('toggleBlindMode')?.addEventListener('click', () => {
            isBlindMode = !isBlindMode;
            const btn = document.getElementById('toggleBlindMode');
            if (btn) {
                btn.textContent = `🎧 Modo Cego: ${isBlindMode ? 'ON' : 'OFF'}`;
                btn.style.background = isBlindMode ? 'rgba(56,189,248,0.3)' : 'rgba(56,189,248,0.1)';
            }
            if (document.getElementById('study-section')?.classList.contains('active')) showCard();
        });

        const closeModalBtn = document.getElementById('closeModal');
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => window.closeModal());
        
        document.getElementById('study-settings-btn')?.addEventListener('click', () => window.openStudySettings());
        document.getElementById('save-all-config')?.addEventListener('click', saveAllConfig);

        // Listeners da Home Decks
        document.getElementById('home-deck-search')?.addEventListener('input', () => loadHomeDecks());
        document.getElementById('home-create-deck-btn')?.addEventListener('click', async () => {
            const name = prompt('Nome do novo deck:');
            if (name) {
                await lfDb.createDeck(name);
                loadHomeDecks();
            }
        });

        // Configurações de IA (Grok)
        document.getElementById('toggle-key-visibility')?.addEventListener('click', () => {
            const input = document.getElementById('cfg-grok-key');
            if (input) {
                input.type = input.type === 'password' ? 'text' : 'password';
            }
        });

        document.getElementById('how-to-api')?.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = document.getElementById('modalDetails');
            const title = document.getElementById('modalTitle');
            const body = document.getElementById('modalBody');
            
            title.textContent = 'Como obter sua Chave API Groq';
            body.innerHTML = `
                <div style="line-height:1.6; color:#e2e8f0;">
                    <p style="margin-bottom:15px;">O Groq Cloud oferece uma das IAs mais rápidas do mundo gratuitamente (com limites generosos). Siga os passos:</p>
                    <ol style="margin-left:20px; margin-bottom:20px; display:flex; flex-direction:column; gap:10px;">
                        <li>Acesse o <a href="https://console.groq.com/keys" target="_blank" style="color:#38bdf8; font-weight:700;">Groq Console</a>.</li>
                        <li>Faça login (pode usar sua conta do Google).</li>
                        <li>Clique no botão <b>"Create API Key"</b>.</li>
                        <li>Dê um nome para a chave (ex: LinguaFlow) e clique em <b>Submit</b>.</li>
                        <li>Copie a chave gerada (ela começa com <code style="background:rgba(0,0,0,0.3); padding:2px 5px; border-radius:4px;">gsk_...</code>).</li>
                        <li>Cole no campo de configuração aqui no dashboard e clique em <b>Salvar</b> no final da página.</li>
                    </ol>
                    <div style="background:rgba(56,189,248,0.1); border-left:4px solid #38bdf8; padding:15px; border-radius:8px;">
                        <span style="font-weight:800; color:#38bdf8;">Vantagem:</span> Usar sua própria chave garante que você nunca fique sem as explicações da IA, mesmo que o servidor global esteja congestionado.
                    </div>
                </div>
            `;
            modal.style.display = 'flex';
        });

        // Listeners de busca e filtros da biblioteca
        document.getElementById('library-search')?.addEventListener('input', () => loadLibraryItems());

        await updateHeader();
        
        // Se houver hash na URL, navega para lá, senão vai para home
        const hash = window.location.hash.replace('#', '');
        if (['home', 'study', 'library', 'lab', 'progresso'].includes(hash)) {
            switchTab(hash);
        } else {
            switchTab('home');
        }
    } catch (e) { 
        console.error('Erro na inicialização:', e); 
        switchTab('home'); 
    }
}

// Inicialização segura
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'REFRESH_VOCAB' || request.type === 'WORD_SAVED' || request.type === 'REFRESH_DASHBOARD') {
        window.dashboard.refreshDashboard();
    }
    return true;
});
