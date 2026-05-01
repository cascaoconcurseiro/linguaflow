// dashboard/dashboard-extras.js
// Heatmap, Streak, Quiz — carregado após dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof dashboard === 'undefined') return;
        _installExtras(dashboard);
    }, 150);
});

function _installExtras(d) {

    // ── STREAK ────────────────────────────────────────────────────────────────
    d.updateStreak = async function () {
        try {
            const db = await openDB();
            const todayKey = new Date().toISOString().split('T')[0];

            const sessions = await new Promise(r => {
                const req = db.transaction('sessions', 'readonly').objectStore('sessions').getAll();
                req.onsuccess = () => r(req.result || []);
                req.onerror = () => r([]);
            });

            const hasToday = sessions.some(s => s.date === todayKey);
            if (!hasToday) {
                try {
                    const tx2 = db.transaction('sessions', 'readwrite');
                    tx2.objectStore('sessions').put({ date: todayKey, count: 1 });
                } catch {}
            }

            const dates = new Set(sessions.map(s => s.date));
            dates.add(todayKey);

            let streak = 0;
            const today = new Date();
            for (let i = 0; i < 365; i++) {
                const d2 = new Date(today);
                d2.setDate(today.getDate() - i);
                if (dates.has(d2.toISOString().split('T')[0])) streak++;
                else if (i > 0) break;
            }

            const el = document.getElementById('streak-count');
            if (el) el.textContent = streak;
            const statEl = document.getElementById('stat-streak');
            if (statEl) statEl.textContent = streak;
        } catch {}
    };

    // ── HEATMAP ───────────────────────────────────────────────────────────────
    d.renderHeatmap = async function () {
        const container = document.getElementById('heatmap-container');
        if (!container) return;

        try {
            const db = await openDB();
            const [sessions, words] = await Promise.all([
                new Promise(r => {
                    const req = db.transaction('sessions', 'readonly').objectStore('sessions').getAll();
                    req.onsuccess = () => r(req.result || []);
                    req.onerror = () => r([]);
                }),
                new Promise(r => {
                    const req = db.transaction('words', 'readonly').objectStore('words').getAll();
                    req.onsuccess = () => r(req.result || []);
                    req.onerror = () => r([]);
                })
            ]);

            const counts = {};
            sessions.forEach(s => { counts[s.date] = (counts[s.date] || 0) + (s.count || 1); });
            words.forEach(w => {
                if (w.added_at) {
                    const key = new Date(w.added_at).toISOString().split('T')[0];
                    counts[key] = (counts[key] || 0) + 1;
                }
            });

            container.innerHTML = '';
            const today = new Date();
            const start = new Date(today);
            start.setDate(today.getDate() - 364);
            start.setDate(start.getDate() - start.getDay()); // align to Sunday

            const maxCount = Math.max(1, ...Object.values(counts));
            const colors = ['#1e293b', '#164e63', '#0e7490', '#0891b2', '#38BDF8'];
            const cur = new Date(start);
            let weekDiv = null;

            while (cur <= today) {
                if (cur.getDay() === 0) {
                    weekDiv = document.createElement('div');
                    weekDiv.className = 'heatmap-week';
                    container.appendChild(weekDiv);
                }
                const key = cur.toISOString().split('T')[0];
                const count = counts[key] || 0;
                const intensity = count === 0 ? 0 : Math.min(4, Math.ceil((count / maxCount) * 4));
                const cell = document.createElement('div');
                cell.className = 'heatmap-cell';
                cell.style.background = colors[intensity];
                cell.title = `${key}: ${count} atividade${count !== 1 ? 's' : ''}`;
                if (weekDiv) weekDiv.appendChild(cell);
                cur.setDate(cur.getDate() + 1);
            }

            this.updateStreak();
        } catch (e) {
            console.warn('[LinguaFlow] Heatmap erro:', e);
        }
    };

    // ── QUIZ — MÚLTIPLA ESCOLHA ───────────────────────────────────────────────
    d.initQuiz = async function () {
        const container = document.getElementById('quiz-container');
        const emptyEl = document.getElementById('quiz-empty');
        if (!container) return;

        const db = await openDB();
        const words = await new Promise(r => {
            const req = db.transaction('words', 'readonly').objectStore('words').getAll();
            req.onsuccess = () => r((req.result || []).filter(w => w.word && w.translation));
            req.onerror = () => r([]);
        });

        if (words.length < 4) {
            if (emptyEl) emptyEl.style.display = 'block';
            container.style.display = 'none';
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';
        container.style.display = 'block';

        this._quizWords = words.sort(() => Math.random() - 0.5).slice(0, 20);
        this._quizIndex = 0;
        this._quizScore = 0;
        this._quizAnswered = false;
        this._quizListenersSet = false;
        this._renderQuizCard();
        this._setupQuizListeners();
    };

    d._renderQuizCard = function () {
        const words = this._quizWords;
        if (!words || this._quizIndex >= words.length) {
            this._showQuizResult();
            return;
        }

        const correct = words[this._quizIndex];
        this._quizCorrect = correct;
        this._quizAnswered = false;

        const others = words.filter((_, i) => i !== this._quizIndex)
            .sort(() => Math.random() - 0.5).slice(0, 3);
        const options = [...others, correct].sort(() => Math.random() - 0.5);

        const total = words.length;
        const current = this._quizIndex + 1;

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('quiz-progress', `${current} / ${total}`);
        set('quiz-score', `✅ ${this._quizScore}`);
        const fill = document.getElementById('quiz-fill');
        if (fill) fill.style.width = `${(current / total) * 100}%`;

        const wordEl = document.getElementById('quiz-word');
        if (wordEl) wordEl.textContent = correct.word;

        const ipa = document.getElementById('quiz-ipa');
        if (ipa) ipa.textContent = correct.ipa ? `/${correct.ipa}/` : '';

        const optContainer = document.getElementById('quiz-options');
        if (optContainer) {
            optContainer.innerHTML = options.map((opt, i) => `
                <button class="quiz-option" data-word="${opt.word}" data-correct="${opt.word === correct.word}">
                    <span class="quiz-opt-letter">${['A', 'B', 'C', 'D'][i]}</span>
                    <span>${opt.translation}</span>
                </button>`).join('');
            optContainer.querySelectorAll('.quiz-option').forEach(btn =>
                btn.addEventListener('click', () => this._answerQuiz(btn)));
        }

        const feedback = document.getElementById('quiz-feedback');
        if (feedback) feedback.style.display = 'none';

        const nextBtn = document.getElementById('btn-quiz-next');
        if (nextBtn) nextBtn.style.display = 'none';

        const audioBtn = document.getElementById('btn-quiz-audio');
        if (audioBtn) audioBtn.onclick = () => this.speakText(correct.word, 'en-US', correct.audio_url);
    };

    d._answerQuiz = function (btn) {
        if (this._quizAnswered) return;
        this._quizAnswered = true;

        const isCorrect = btn.dataset.correct === 'true';
        if (isCorrect) this._quizScore++;

        document.querySelectorAll('.quiz-option').forEach(b => {
            b.disabled = true;
            if (b.dataset.correct === 'true') {
                b.style.cssText += ';background:rgba(16,185,129,0.25);border-color:#10B981;color:#10B981;';
            } else if (b === btn) {
                b.style.cssText += ';background:rgba(239,68,68,0.2);border-color:#EF4444;color:#EF4444;';
            }
        });

        const feedback = document.getElementById('quiz-feedback');
        if (feedback) {
            feedback.style.display = 'block';
            feedback.className = `quiz-feedback ${isCorrect ? 'correct' : 'wrong'}`;
            feedback.textContent = isCorrect
                ? `✅ Correto! "${this._quizCorrect.word}" = ${this._quizCorrect.translation}`
                : `❌ Era: "${this._quizCorrect.word}" = ${this._quizCorrect.translation}`;
        }

        this.speakText(this._quizCorrect.word, 'en-US', this._quizCorrect.audio_url);

        const nextBtn = document.getElementById('btn-quiz-next');
        if (nextBtn) nextBtn.style.display = 'block';
    };

    d._showQuizResult = function () {
        const container = document.getElementById('quiz-container');
        if (!container) return;
        const total = this._quizWords.length;
        const pct = Math.round((this._quizScore / total) * 100);
        container.innerHTML = `
            <div style="text-align:center;padding:60px 20px;">
                <div style="font-size:64px;margin-bottom:16px;">${pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '📚'}</div>
                <h2 style="color:#38BDF8;margin:0 0 8px;">${this._quizScore} / ${total} corretas</h2>
                <p style="color:#64748B;margin:0 0 24px;">${pct}% de acerto</p>
                <button onclick="dashboard.initQuiz()" class="btn-primary" style="max-width:200px;">🔄 Jogar Novamente</button>
            </div>`;
    };

    d._setupQuizListeners = function () {
        if (this._quizListenersSet) return;
        this._quizListenersSet = true;
        document.getElementById('btn-quiz-next')?.addEventListener('click', () => {
            this._quizIndex++;
            if (this._quizIndex >= this._quizWords.length) this._showQuizResult();
            else this._renderQuizCard();
        });
    };

    // ── Estende loadStats para atualizar streak ───────────────────────────────
    const _origLoadStats = d.loadStats.bind(d);
    d.loadStats = async function () {
        const result = await _origLoadStats();
        this.updateStreak();
        return result;
    };

    // Renderiza heatmap e streak se já estiver na aba stats
    if (d.currentTab === 'stats') {
        d.renderHeatmap();
    }

    console.log('[LinguaFlow] Extras instalados: Heatmap, Streak, Quiz');
}
