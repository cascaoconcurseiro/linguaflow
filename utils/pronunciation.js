// utils/pronunciation.js

export const pronunciationLab = {
    recognition: null,
    isRecording: false,
    requestGeneration: 0,
    activeResolve: null,

    _cancelRecognition() {
        const pendingResolve = this.activeResolve;
        this.activeResolve = null;
        if (pendingResolve) pendingResolve(null);

        const recognition = this.recognition;
        this.recognition = null;
        if (recognition) {
            recognition.onstart = null;
            recognition.onerror = null;
            recognition.onend = null;
            recognition.onresult = null;
            try {
                if (typeof recognition.abort === 'function') recognition.abort();
                else recognition.stop();
            } catch { /* reconhecimento ainda iniciando ou já encerrado */ }
        }
        this.isRecording = false;
    },
    
    init() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn("Speech Recognition not supported in this browser.");
            return false;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        return true;
    },

    async listen(lang, onFeedback) {
        const requestGeneration = ++this.requestGeneration;
        this._cancelRecognition();
        try {
            // Força a requisição de permissão do microfone. 
            // Em extensões, o SpeechRecognition pode dar 'network error' se não pedir permissão explícita antes.
            // BUG 18/07: o stream de permissao era descartado SEM parar as
            // tracks — o microfone ficava ligado para sempre (indicador
            // vermelho na aba). A captura real e do SpeechRecognition.
            const permStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            permStream.getTracks().forEach((t) => t.stop());
            if (requestGeneration !== this.requestGeneration) return null;
        } catch (err) {
            if (requestGeneration !== this.requestGeneration) return null;
            onFeedback({ error: "Permissão de microfone negada ou dispositivo não encontrado." });
            return;
        }

        if (!this.init()) {
            if (requestGeneration === this.requestGeneration) {
                onFeedback({ error: "Reconhecimento de voz não suportado neste navegador." });
            }
            return;
        }

        const recognition = this.recognition;
        recognition.lang = lang || 'en-US';

        return new Promise((resolve) => {
            let settled = false;
            const isCurrent = () =>
                requestGeneration === this.requestGeneration && this.recognition === recognition;
            const settle = (value) => {
                if (settled) return;
                settled = true;
                if (this.activeResolve === settle) this.activeResolve = null;
                resolve(value);
            };
            this.activeResolve = settle;

            recognition.onstart = () => {
                if (!isCurrent()) return settle(null);
                this.isRecording = true;
                onFeedback({ status: 'recording' });
            };

            recognition.onerror = (event) => {
                if (!isCurrent()) return settle(null);
                this.isRecording = false;
                onFeedback({ error: `Erro no microfone: ${event.error}` });
                settle(null);
            };

            recognition.onend = () => {
                if (!isCurrent()) return settle(null);
                this.isRecording = false;
                onFeedback({ status: 'stopped' });
                settle(null);
            };

            recognition.onresult = (event) => {
                if (!isCurrent()) return settle(null);
                const transcript = event.results[0][0].transcript;
                onFeedback({ status: 'result', transcript });
                settle(transcript);
            };

            if (!isCurrent()) return settle(null);
            try { recognition.start(); }
            catch { settle(null); }
        });
    },

    async assess(expectedText, onFeedback) {
        const requestGeneration = ++this.requestGeneration;
        this._cancelRecognition();
        try {
            // BUG 18/07: o stream de permissao era descartado SEM parar as
            // tracks — o microfone ficava ligado para sempre (indicador
            // vermelho na aba). A captura real e do SpeechRecognition.
            const permStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            permStream.getTracks().forEach((t) => t.stop());
            if (requestGeneration !== this.requestGeneration) return null;
        } catch (err) {
            if (requestGeneration !== this.requestGeneration) return null;
            onFeedback({ error: "Permissão de microfone negada." });
            return;
        }

        if (!this.init()) {
            if (requestGeneration === this.requestGeneration) {
                onFeedback({ error: "Reconhecimento de voz não suportado neste navegador." });
            }
            return;
        }

        const recognition = this.recognition;
        // assess() antes herdava sempre o en-US de init(), ignorando o idioma
        // escolhido no app. Isso fazia uma fala correta parecer errada em
        // qualquer outro idioma.
        recognition.lang = localStorage.getItem('lf_tts_lang') || 'en-US';

        return new Promise((resolve) => {
            let settled = false;
            const isCurrent = () =>
                requestGeneration === this.requestGeneration && this.recognition === recognition;
            const settle = (value) => {
                if (settled) return;
                settled = true;
                if (this.activeResolve === settle) this.activeResolve = null;
                resolve(value);
            };
            this.activeResolve = settle;

            recognition.onstart = () => {
                if (!isCurrent()) return settle(null);
                this.isRecording = true;
                onFeedback({ status: 'recording' });
            };

            recognition.onerror = (event) => {
                if (!isCurrent()) return settle(null);
                this.isRecording = false;
                onFeedback({ error: `Erro no microfone: ${event.error}` });
                settle(null);
            };

            recognition.onend = () => {
                if (!isCurrent()) return settle(null);
                this.isRecording = false;
                onFeedback({ status: 'stopped' });
                settle(null);
            };

            recognition.onresult = (event) => {
                if (!isCurrent()) return settle(null);
                const transcript = event.results[0][0].transcript;
                // Resultado chegou: encerra JA — sem isso o reconhecimento
                // segurava o mic ate o endpointing decidir sozinho
                // ("ja falei e ele continua ouvindo").
                try { recognition.stop(); } catch { /* ja parado */ }
                const result = this.calculateDiff(expectedText, transcript);
                onFeedback({ status: 'result', transcript, ...result });
                settle(result);
            };

            try {
                if (!isCurrent()) return settle(null);
                recognition.start();
            } catch(e) {
                try { recognition.abort?.(); } catch { /* estado parcial */ }
                setTimeout(() => {
                    if (!isCurrent()) return settle(null);
                    try { recognition.start(); } catch { settle(null); }
                }, 200);
            }
        });
    },

    stop() {
        this.requestGeneration += 1;
        this._cancelRecognition();
    },

    calculateDiff(expected, actual) {
        const cleanExpected = expected.replace(/[.,!?;&]/g, '').toLowerCase().trim();
        const cleanActual = actual.replace(/[.,!?;&]/g, '').toLowerCase().trim();
        
        const expWords = cleanExpected.split(/\s+/);
        const actWords = cleanActual.split(/\s+/);

        const escapeHtml = (value) => String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        const htmlParts = [];
        let matches = 0;

        for (let i = 0; i < expWords.length; i++) {
            const eW = expWords[i];
            if (actWords.includes(eW)) {
                matches++;
                // Fallbacks: o dashboard usa --color-primary/--color-danger;
                // --green/--red não existem lá (§4g.2)
                htmlParts.push(`<span style="color:var(--green, var(--color-primary, #16a34a))">${escapeHtml(eW)}</span>`);
            } else {
                htmlParts.push(`<span style="color:var(--red, var(--color-danger, #dc2626)); text-decoration:line-through">${escapeHtml(eW)}</span>`);
            }
        }

        const score = Math.round((matches / expWords.length) * 100);
        return {
            score,
            htmlFeedback: htmlParts.join(' ')
        };
    }
};
