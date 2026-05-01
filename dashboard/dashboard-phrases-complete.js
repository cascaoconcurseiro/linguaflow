// dashboard-phrases-complete.js
// Sistema completo de estudo de frases pelo método natural

class PhraseStudySystem {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.phrases = [];
        this.currentIndex = 0;
        this.mode = 'comprehension'; // comprehension, production, listening
        this.revealed = false;
        this.stats = {
            studied: 0,
            correct: 0,
            wrong: 0
        };
    }

    async init() {
        await this.loadPhrases();
        this.setupEventListeners();
    }

    async loadPhrases() {
        try {
            const db = await this.dashboard.openDB();
            const words = await new Promise((resolve, reject) => {
                const req = db.transaction('words', 'readonly').objectStore('words').getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });

            // Filtra frases (item_type === 'phrase' ou tem phrase_text)
            this.phrases = words.filter(w => 
                w.item_type === 'phrase' || 
                (w.phrase_text && w.phrase_text.length > 10) ||
                (w.context_sentence && w.context_sentence.length > 20)
            );

            // Embaralha
            this.phrases = this.phrases.sort(() => Math.random() - 0.5);

            if (this.phrases.length === 0) {
                this.showEmpty();
            } else {
                this.renderPhrase();
            }
        } catch (e) {
            console.error('[PhraseStudySystem] Erro ao carregar frases:', e);
            this.showEmpty();
        }
    }

    setupEventListeners() {
        // Botões de modo
        document.getElementById('btn-phrase-comprehension')?.addEventListener('click', () => this.setMode('comprehension'));
        document.getElementById('btn-phrase-production')?.addEventListener('click', () => this.setMode('production'));
        document.getElementById('btn-phrase-listening')?.addEventListener('click', () => this.setMode('listening'));

        // Botões de ação
        document.getElementById('btn-phrase-audio')?.addEventListener('click', () => this.playAudio());
        document.getElementById('btn-phrase-reveal')?.addEventListener('click', () => this.reveal());
        document.getElementById('btn-phrase-next')?.addEventListener('click', () => this.nextPhrase());
        document.getElementById('btn-phrase-know')?.addEventListener('click', () => this.markKnown());
        document.getElementById('btn-phrase-study')?.addEventListener('click', () => this.markStudy());

        // Input de produção
        document.getElementById('phrase-production-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.checkProduction();
            }
        });

        // Botão verificar produção
        document.getElementById('btn-phrase-check')?.addEventListener('click', () => this.checkProduction());
    }

    setMode(mode) {
        this.mode = mode;
        this.revealed = false;
        this.renderPhrase();

        // Atualiza botões de modo
        ['comprehension', 'production', 'listening'].forEach(m => {
            const btn = document.getElementById(`btn-phrase-${m}`);
            if (btn) {
                btn.classList.toggle('active', m === mode);
            }
        });
    }

    renderPhrase() {
        if (this.currentIndex >= this.phrases.length) {
            this.showComplete();
            return;
        }

        const phrase = this.phrases[this.currentIndex];
        const text = phrase.phrase_text || phrase.context_sentence || phrase.word;
        const translation = phrase.phrase_translation || phrase.translation || '';

        // Atualiza progresso
        document.getElementById('phrase-progress').textContent = `${this.currentIndex + 1} / ${this.phrases.length}`;
        document.getElementById('phrase-fill').style.width = `${((this.currentIndex + 1) / this.phrases.length) * 100}%`;

        // Atualiza stats
        document.getElementById('phrase-stats').innerHTML = `
            <span style="color:#10B981;">✅ ${this.stats.correct}</span>
            <span style="color:#EF4444;">❌ ${this.stats.wrong}</span>
            <span style="color:#38BDF8;">📚 ${this.stats.studied}</span>
        `;

        // Renderiza baseado no modo
        if (this.mode === 'comprehension') {
            this.renderComprehension(text, translation, phrase);
        } else if (this.mode === 'production') {
            this.renderProduction(text, translation, phrase);
        } else if (this.mode === 'listening') {
            this.renderListening(text, translation, phrase);
        }
    }

    renderComprehension(text, translation, phrase) {
        const container = document.getElementById('phrase-container');
        container.innerHTML = `
            <div class="phrase-mode-label">🎯 Modo Compreensão</div>
            <div class="phrase-text">${this.escapeHTML(text)}</div>
            <div class="phrase-meta">
                <span>${phrase.platform || 'origem'}</span>
                ${phrase.video_title ? `<span>📺 ${this.escapeHTML(phrase.video_title.substring(0, 40))}...</span>` : ''}
            </div>
            <div class="phrase-translation" style="display:${this.revealed ? 'block' : 'none'};">
                ${this.escapeHTML(translation)}
            </div>
            <div class="phrase-hint" style="display:${this.revealed ? 'none' : 'block'};color:#64748B;font-size:13px;margin-top:16px;">
                💡 Tente entender a frase antes de revelar a tradução
            </div>
        `;

        // Atualiza botões
        document.getElementById('btn-phrase-reveal').style.display = this.revealed ? 'none' : 'block';
        document.getElementById('btn-phrase-know').style.display = this.revealed ? 'block' : 'none';
        document.getElementById('btn-phrase-study').style.display = this.revealed ? 'block' : 'none';
    }

    renderProduction(text, translation, phrase) {
        const container = document.getElementById('phrase-container');
        container.innerHTML = `
            <div class="phrase-mode-label">✍️ Modo Produção</div>
            <div class="phrase-translation" style="font-size:20px;color:#10B981;margin-bottom:24px;">
                ${this.escapeHTML(translation)}
            </div>
            <div class="phrase-hint" style="color:#64748B;font-size:13px;margin-bottom:12px;">
                💡 Tente escrever a frase em inglês:
            </div>
            <textarea id="phrase-production-input" class="phrase-input" placeholder="Digite sua tradução..." rows="3"></textarea>
            <button id="btn-phrase-check" class="btn-primary" style="margin-top:12px;">Verificar</button>
            <div id="phrase-production-result" style="display:none;margin-top:16px;"></div>
            <div class="phrase-text" style="display:${this.revealed ? 'block' : 'none'};margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);">
                <div style="font-size:12px;color:#64748B;margin-bottom:8px;">Original:</div>
                ${this.escapeHTML(text)}
            </div>
        `;
    }

    renderListening(text, translation, phrase) {
        const container = document.getElementById('phrase-container');
        container.innerHTML = `
            <div class="phrase-mode-label">🎧 Modo Listening</div>
            <div style="text-align:center;padding:40px 20px;">
                <button class="btn-play-big" onclick="phraseSystem.playAudio()">▶ Ouvir Frase</button>
                <p style="color:#64748B;font-size:13px;margin-top:16px;">Ouça e tente entender antes de revelar</p>
            </div>
            <div class="phrase-translation" style="display:${this.revealed ? 'block' : 'none'};margin-top:24px;">
                <div style="font-size:12px;color:#64748B;margin-bottom:8px;">Tradução:</div>
                ${this.escapeHTML(translation)}
            </div>
            <div class="phrase-text" style="display:${this.revealed ? 'block' : 'none'};margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);">
                <div style="font-size:12px;color:#64748B;margin-bottom:8px;">Original:</div>
                ${this.escapeHTML(text)}
            </div>
        `;

        // Auto-play ao carregar
        setTimeout(() => this.playAudio(), 500);
    }

    reveal() {
        this.revealed = true;
        this.renderPhrase();
    }

    async playAudio() {
        const phrase = this.phrases[this.currentIndex];
        const text = phrase.phrase_text || phrase.context_sentence || phrase.word;
        
        // Usa TTS do dashboard
        await this.dashboard.speakText(text, 'en-US', phrase.audio_url);
    }

    checkProduction() {
        const input = document.getElementById('phrase-production-input');
        const userText = input.value.trim().toLowerCase();
        const phrase = this.phrases[this.currentIndex];
        const correctText = (phrase.phrase_text || phrase.context_sentence || phrase.word).toLowerCase();

        // Calcula similaridade (simples: % de palavras corretas)
        const userWords = userText.split(/\s+/);
        const correctWords = correctText.split(/\s+/);
        const matches = userWords.filter(w => correctWords.includes(w)).length;
        const similarity = Math.round((matches / correctWords.length) * 100);

        const resultDiv = document.getElementById('phrase-production-result');
        resultDiv.style.display = 'block';

        if (similarity >= 80) {
            resultDiv.innerHTML = `
                <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:12px;color:#10B981;">
                    ✅ Excelente! ${similarity}% de acerto
                </div>
            `;
            this.stats.correct++;
        } else if (similarity >= 50) {
            resultDiv.innerHTML = `
                <div style="background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:10px;padding:12px;color:#FBBF24;">
                    ⚠️ Quase lá! ${similarity}% de acerto
                </div>
            `;
            this.stats.studied++;
        } else {
            resultDiv.innerHTML = `
                <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px;color:#EF4444;">
                    ❌ Tente novamente. ${similarity}% de acerto
                </div>
            `;
            this.stats.wrong++;
        }

        this.revealed = true;
        this.renderPhrase();
    }

    nextPhrase() {
        this.currentIndex++;
        this.revealed = false;
        this.renderPhrase();
    }

    async markKnown() {
        const phrase = this.phrases[this.currentIndex];
        this.stats.correct++;
        
        // Marca como conhecida no banco
        try {
            const db = await this.dashboard.openDB();
            const tx = db.transaction(['words', 'cards'], 'readwrite');
            
            // Atualiza card para mature
            const cardReq = tx.objectStore('cards').index('word_id').get(phrase.id);
            cardReq.onsuccess = () => {
                if (cardReq.result) {
                    const card = cardReq.result;
                    card.status = 'mature';
                    card.due_date = Date.now() + (365 * 24 * 60 * 60 * 1000); // 1 ano
                    tx.objectStore('cards').put(card);
                }
            };
        } catch (e) {
            console.error('[PhraseStudySystem] Erro ao marcar como conhecida:', e);
        }

        this.nextPhrase();
    }

    markStudy() {
        this.stats.studied++;
        this.nextPhrase();
    }

    showEmpty() {
        const container = document.getElementById('phrase-container');
        container.innerHTML = `
            <div style="text-align:center;padding:60px 20px;">
                <div style="font-size:64px;margin-bottom:16px;">⚡</div>
                <h2 style="color:#94A3B8;margin-bottom:8px;">Nenhuma frase salva</h2>
                <p style="color:#64748B;">Salve frases completas durante vídeos para estudar aqui</p>
            </div>
        `;
    }

    showComplete() {
        const container = document.getElementById('phrase-container');
        const accuracy = this.stats.correct + this.stats.wrong > 0 
            ? Math.round((this.stats.correct / (this.stats.correct + this.stats.wrong)) * 100)
            : 0;

        container.innerHTML = `
            <div style="text-align:center;padding:60px 20px;">
                <div style="font-size:64px;margin-bottom:16px;">🎉</div>
                <h2 style="color:#10B981;margin-bottom:16px;">Sessão Completa!</h2>
                <div class="stats-grid" style="max-width:400px;margin:0 auto 24px;">
                    <div class="stat-card">
                        <h3 style="color:#10B981;">${this.stats.correct}</h3>
                        <p>✅ Acertos</p>
                    </div>
                    <div class="stat-card">
                        <h3 style="color:#EF4444;">${this.stats.wrong}</h3>
                        <p>❌ Erros</p>
                    </div>
                    <div class="stat-card">
                        <h3 style="color:#38BDF8;">${accuracy}%</h3>
                        <p>🎯 Precisão</p>
                    </div>
                </div>
                <button class="btn-primary" onclick="phraseSystem.restart()">🔄 Recomeçar</button>
            </div>
        `;
    }

    restart() {
        this.currentIndex = 0;
        this.revealed = false;
        this.stats = { studied: 0, correct: 0, wrong: 0 };
        this.phrases = this.phrases.sort(() => Math.random() - 0.5);
        this.renderPhrase();
    }

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// CSS adicional para frases
const phraseStyles = `
<style>
.phrase-mode-label {
    font-size: 12px;
    color: #38BDF8;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 16px;
}

.phrase-text {
    font-size: 22px;
    line-height: 1.6;
    color: #F8FAFC;
    font-weight: 600;
    margin-bottom: 16px;
}

.phrase-translation {
    font-size: 18px;
    line-height: 1.6;
    color: #10B981;
    font-weight: 600;
    padding: 16px;
    background: rgba(16,185,129,0.08);
    border: 1px solid rgba(16,185,129,0.2);
    border-radius: 10px;
}

.phrase-meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: #64748B;
    margin-bottom: 16px;
}

.phrase-input {
    width: 100%;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 12px;
    color: #F8FAFC;
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
}

.phrase-input:focus {
    outline: none;
    border-color: rgba(56,189,248,0.4);
    background: rgba(255,255,255,0.08);
}

.btn-play-big {
    background: linear-gradient(135deg, #EF4444, #DC2626);
    color: white;
    border: none;
    border-radius: 50%;
    width: 80px;
    height: 80px;
    font-size: 32px;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 8px 24px rgba(239,68,68,0.4);
}

.btn-play-big:hover {
    transform: scale(1.1);
    box-shadow: 0 12px 32px rgba(239,68,68,0.6);
}
</style>
`;

// Exporta
window.PhraseStudySystem = PhraseStudySystem;
