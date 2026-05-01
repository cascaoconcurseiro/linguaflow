// dashboard-extras.js - Funcionalidades extras do dashboard

// Inicializa Quiz
async function initQuiz() {
    const db = await openDB();
    const words = await new Promise(r => {
        const req = db.transaction('words', 'readonly').objectStore('words').getAll();
        req.onsuccess = () => r((req.result || []).filter(w => w.word && w.translation));
        req.onerror = () => r([]);
    });

    if (words.length < 4) {
        document.getElementById('quiz-empty').style.display = 'block';
        document.getElementById('quiz-container').style.display = 'none';
        return;
    }

    document.getElementById('quiz-empty').style.display = 'none';
    document.getElementById('quiz-container').style.display = 'block';

    window._quizWords = words.sort(() => Math.random() - 0.5).slice(0, 20);
    window._quizIndex = 0;
    window._quizScore = 0;
    renderQuizCard();
    setupQuizListeners();
}

function renderQuizCard() {
    if (window._quizIndex >= window._quizWords.length) {
        showQuizComplete();
        return;
    }

    const word = window._quizWords[window._quizIndex];
    const total = window._quizWords.length;
    const current = window._quizIndex + 1;

    document.getElementById('quiz-progress').textContent = `${current} / ${total}`;
    document.getElementById('quiz-fill').style.width = `${(current / total) * 100}%`;
    document.getElementById('quiz-score').textContent = `✅ ${window._quizScore}`;
    document.getElementById('quiz-word').textContent = word.word;
    document.getElementById('quiz-ipa').textContent = word.ipa ? `/${word.ipa}/` : '';

    // Gera 4 opções (1 correta + 3 erradas)
    const options = [word.translation];
    const otherWords = window._quizWords.filter(w => w.id !== word.id);
    while (options.length < 4 && otherWords.length > 0) {
        const random = otherWords.splice(Math.floor(Math.random() * otherWords.length), 1)[0];
        if (random.translation && !options.includes(random.translation)) {
            options.push(random.translation);
        }
    }
    options.sort(() => Math.random() - 0.5);

    const container = document.getElementById('quiz-options');
    container.innerHTML = '';
    options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.innerHTML = `<span class="quiz-opt-letter">${String.fromCharCode(65 + i)}</span><span>${opt}</span>`;
        btn.addEventListener('click', () => checkQuizAnswer(opt, word.translation, btn));
        container.appendChild(btn);
    });

    document.getElementById('quiz-feedback').style.display = 'none';
    document.getElementById('btn-quiz-next').style.display = 'none';
}

function checkQuizAnswer(selected, correct, btn) {
    const isCorrect = selected === correct;
    const feedback = document.getElementById('quiz-feedback');
    const allOptions = document.querySelectorAll('.quiz-option');

    allOptions.forEach(opt => opt.disabled = true);

    if (isCorrect) {
        btn.style.background = 'rgba(16,185,129,0.2)';
        btn.style.borderColor = 'rgba(16,185,129,0.4)';
        btn.style.color = '#10B981';
        feedback.className = 'quiz-feedback correct';
        feedback.textContent = '✅ Correto!';
        window._quizScore++;
        document.getElementById('quiz-score').textContent = `✅ ${window._quizScore}`;
    } else {
        btn.style.background = 'rgba(239,68,68,0.15)';
        btn.style.borderColor = 'rgba(239,68,68,0.4)';
        btn.style.color = '#EF4444';
        feedback.className = 'quiz-feedback wrong';
        feedback.textContent = `❌ Era: ${correct}`;
        
        // Destaca resposta correta
        allOptions.forEach(opt => {
            if (opt.textContent.includes(correct)) {
                opt.style.background = 'rgba(16,185,129,0.2)';
                opt.style.borderColor = 'rgba(16,185,129,0.4)';
                opt.style.color = '#10B981';
            }
        });
    }

    feedback.style.display = 'block';
    document.getElementById('btn-quiz-next').style.display = 'block';
}

function setupQuizListeners() {
    if (window._quizListenersSet) return;
    window._quizListenersSet = true;

    document.getElementById('btn-quiz-audio')?.addEventListener('click', () => {
        const word = window._quizWords[window._quizIndex];
        if (word && dashboard) {
            dashboard.speakText(word.word, 'en-US', word.audio_url);
        }
    });

    document.getElementById('btn-quiz-next')?.addEventListener('click', () => {
        window._quizIndex++;
        renderQuizCard();
    });
}

function showQuizComplete() {
    const container = document.getElementById('quiz-container');
    const accuracy = Math.round((window._quizScore / window._quizWords.length) * 100);
    
    container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;">
            <div style="font-size:64px;margin-bottom:16px;">🎉</div>
            <h2 style="color:#10B981;margin-bottom:16px;">Quiz Completo!</h2>
            <div class="stats-grid" style="max-width:400px;margin:0 auto 24px;">
                <div class="stat-card">
                    <h3 style="color:#10B981;">${window._quizScore}</h3>
                    <p>✅ Acertos</p>
                </div>
                <div class="stat-card">
                    <h3 style="color:#EF4444;">${window._quizWords.length - window._quizScore}</h3>
                    <p>❌ Erros</p>
                </div>
                <div class="stat-card">
                    <h3 style="color:#38BDF8;">${accuracy}%</h3>
                    <p>🎯 Precisão</p>
                </div>
            </div>
            <button class="btn-primary" onclick="initQuiz()">🔄 Jogar Novamente</button>
        </div>
    `;
}

// Exporta para uso global
window.initQuiz = initQuiz;
