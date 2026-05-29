// utils/pronunciation.js

export const pronunciationLab = {
    recognition: null,
    isRecording: false,
    
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
        try {
            // Força a requisição de permissão do microfone. 
            // Em extensões, o SpeechRecognition pode dar 'network error' se não pedir permissão explícita antes.
            await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            onFeedback({ error: "Permissão de microfone negada ou dispositivo não encontrado." });
            return;
        }

        if (!this.recognition) {
            if (!this.init()) {
                onFeedback({ error: "Reconhecimento de voz não suportado neste navegador." });
                return;
            }
        }
        
        this.recognition.lang = lang || 'en-US';

        return new Promise((resolve) => {
            this.recognition.onstart = () => {
                this.isRecording = true;
                onFeedback({ status: 'recording' });
            };

            this.recognition.onerror = (event) => {
                this.isRecording = false;
                onFeedback({ error: `Erro no microfone: ${event.error}` });
                resolve(null);
            };

            this.recognition.onend = () => {
                this.isRecording = false;
                onFeedback({ status: 'stopped' });
            };

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                onFeedback({ status: 'result', transcript });
                resolve(transcript);
            };

            this.recognition.start();
        });
    },

    async assess(expectedText, onFeedback) {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            onFeedback({ error: "Permissão de microfone negada." });
            return;
        }

        if (!this.recognition) {
            if (!this.init()) {
                onFeedback({ error: "Reconhecimento de voz não suportado neste navegador." });
                return;
            }
        }

        return new Promise((resolve) => {
            this.recognition.onstart = () => {
                this.isRecording = true;
                onFeedback({ status: 'recording' });
            };

            this.recognition.onerror = (event) => {
                this.isRecording = false;
                onFeedback({ error: `Erro no microfone: ${event.error}` });
                resolve(null);
            };

            this.recognition.onend = () => {
                this.isRecording = false;
                onFeedback({ status: 'stopped' });
            };

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                const result = this.calculateDiff(expectedText, transcript);
                onFeedback({ status: 'result', transcript, ...result });
                resolve(result);
            };

            try {
                this.recognition.start();
            } catch(e) {
                this.recognition.stop();
                setTimeout(() => this.recognition.start(), 200);
            }
        });
    },

    stop() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
            this.isRecording = false;
        }
    },

    calculateDiff(expected, actual) {
        const cleanExpected = expected.replace(/[.,!?;&]/g, '').toLowerCase().trim();
        const cleanActual = actual.replace(/[.,!?;&]/g, '').toLowerCase().trim();
        
        const expWords = cleanExpected.split(/\s+/);
        const actWords = cleanActual.split(/\s+/);

        const htmlParts = [];
        let matches = 0;

        for (let i = 0; i < expWords.length; i++) {
            const eW = expWords[i];
            if (actWords.includes(eW)) {
                matches++;
                htmlParts.push(`<span style="color:var(--green)">${eW}</span>`);
            } else {
                htmlParts.push(`<span style="color:var(--red); text-decoration:line-through">${eW}</span>`);
            }
        }

        const score = Math.round((matches / expWords.length) * 100);
        return {
            score,
            htmlFeedback: htmlParts.join(' ')
        };
    }
};
