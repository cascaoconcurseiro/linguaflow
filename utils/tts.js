// utils/tts.js

/**
 * LinguaFlow - Text-to-Speech Engine (v2.0 - Premium Quality)
 *
 * Prioridades de qualidade:
 * 1. Audio MP3 do dicionario (melhor qualidade, nativo)
 * 2. Google Translate TTS (voz neural, natural, gratuita)
 * 3. Web Speech API com vozes premium (fallback)
 */

class TTS {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voices = [];
        this.audioCache = new Map();

        if (this.synth) {
            this.synth.onvoiceschanged = () => {
                this.voices = this.synth.getVoices();
                console.log('[LinguaFlow TTS] Vozes carregadas:', this.voices.length);
            };
        }
    }

    /**
     * Reproduz texto com a melhor qualidade disponivel
     * @param {string} text
     * @param {string} lang  ex: 'en-US', 'pt-BR'
     * @param {string} audioUrl  URL MP3 opcional (dicionario)
     */
    async play(text, lang = 'en-US', audioUrl = null) {
        if (!text || text.trim() === '') return false;

        // Prioridade 1: Audio MP3 nativo do dicionario (melhor qualidade)
        if (audioUrl) {
            try {
                const audio = new Audio(audioUrl);
                audio.volume = 1.0;
                await audio.play();
                return true;
            } catch (e) {
                console.log('[TTS] Audio MP3 falhou, tentando Google TTS');
            }
        }

        // Prioridade 2: Google Translate TTS (voz neural, natural)
        try {
            await this._playGoogleTTS(text, lang);
            return true;
        } catch (e) {
            console.log('[TTS] Google TTS falhou, usando Web Speech API');
        }

        // Prioridade 3: Web Speech API (fallback)
        return this._playWebSpeech(text, lang);
    }

    async _playGoogleTTS(text, lang) {
        const langMap = {
            'en-US': 'en', 'en-GB': 'en',
            'pt-BR': 'pt', 'pt-PT': 'pt',
            'es-ES': 'es', 'fr-FR': 'fr',
            'de-DE': 'de', 'it-IT': 'it',
            'ja-JP': 'ja', 'ko-KR': 'ko',
            'zh-CN': 'zh-CN', 'ru-RU': 'ru'
        };
        const googleLang = langMap[lang] || lang.split('-')[0];
        
        // Use multiple Google TTS endpoints for reliability
        const urls = [
            // Primary: translate.google.com (most reliable)
            `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${googleLang}&client=tw-ob`,
            // Fallback 1: gtx client (alternative endpoint)
            `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${googleLang}&client=gtx`,
            // Fallback 2: dict-chrome-ex client
            `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${googleLang}&client=dict-chrome-ex`
        ];

        // Try each URL until one works
        for (const url of urls) {
            try {
                const audio = new Audio(url);
                const cacheKey = `${lang}:${text}`;
                this.audioCache.set(cacheKey, audio);
                if (this.audioCache.size > 50) {
                    this.audioCache.delete(this.audioCache.keys().next().value);
                }

                await audio.play();
                console.log('[TTS] Google TTS success with:', url.includes('tw-ob') ? 'tw-ob' : url.includes('gtx') ? 'gtx' : 'dict-chrome-ex');
                return true;
            } catch (e) {
                console.log('[TTS] Google TTS endpoint failed, trying next...');
                continue;
            }
        }
        
        // All endpoints failed
        throw new Error('All Google TTS endpoints failed');
    }

    async _playWebSpeech(text, lang) {
        if (!this.synth) return false;

        // Aguarda vozes carregarem
        if (this.voices.length === 0) {
            this.voices = this.synth.getVoices();
            if (this.voices.length === 0) {
                await new Promise(r => {
                    this.synth.onvoiceschanged = r;
                    setTimeout(r, 1000);
                });
                this.voices = this.synth.getVoices();
            }
        }

        return new Promise(resolve => {
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = lang || 'en-US';
            utter.rate = 0.9;
            utter.pitch = 1.0;
            utter.volume = 1.0;

            // FILTRO DE QUALIDADE: Apenas vozes naturais/neurais
            const naturalVoices = this.voices.filter(v => {
                const name = v.name.toLowerCase();
                const isNatural = 
                    name.includes('natural') ||
                    name.includes('neural') ||
                    name.includes('google') ||
                    name.includes('microsoft') && (name.includes('online') || name.includes('aria') || name.includes('guy') || name.includes('jenny')) ||
                    name.includes('samantha') ||
                    name.includes('alex') ||
                    name.includes('karen') ||
                    name.includes('daniel') ||
                    name.includes('fiona') ||
                    name.includes('luciana') ||
                    name.includes('paulina');
                
                // REJEITA vozes robóticas conhecidas
                const isRobotic = 
                    name.includes('eSpeak') ||
                    name.includes('espeak') ||
                    name.includes('festival') ||
                    name.includes('pico') ||
                    name.includes('flite');
                
                return isNatural && !isRobotic;
            });

            console.log('[TTS] Vozes naturais disponíveis:', naturalVoices.length, '/', this.voices.length);
            if (naturalVoices.length > 0) {
                console.log('[TTS] Vozes naturais:', naturalVoices.map(v => v.name).join(', '));
            }

            // Lista de preferência (apenas vozes de alta qualidade)
            const preferred = [
                'Google US English', 'Google UK English Female', 'Google UK English Male',
                'Google português do Brasil',
                'Microsoft Aria Online (Natural) - English (United States)',
                'Microsoft Guy Online (Natural) - English (United States)',
                'Microsoft Jenny Online (Natural) - English (United States)',
                'Microsoft Zira - English (United States)',
                'Microsoft Maria - Portuguese (Brazil)',
                'Samantha', 'Alex', 'Karen', 'Daniel', 'Fiona',
                'Luciana', 'Paulina'
            ];
            
            let voice = null;
            
            // Tenta vozes preferidas primeiro
            for (const name of preferred) {
                voice = naturalVoices.find(v => v.name.includes(name));
                if (voice) {
                    console.log('[TTS] Usando voz preferida:', voice.name);
                    break;
                }
            }
            
            // Se não encontrou, usa qualquer voz natural do idioma
            if (!voice) {
                voice = naturalVoices.find(v => v.lang.startsWith((lang || 'en').split('-')[0]));
                if (voice) {
                    console.log('[TTS] Usando voz natural do idioma:', voice.name);
                }
            }
            
            // Último recurso: primeira voz natural disponível
            if (!voice && naturalVoices.length > 0) {
                voice = naturalVoices[0];
                console.log('[TTS] Usando primeira voz natural disponível:', voice.name);
            }
            
            // Se AINDA não tem voz natural, tenta qualquer voz do idioma (melhor que nada)
            if (!voice) {
                const langVoices = this.voices.filter(v => v.lang.startsWith((lang || 'en').split('-')[0]));
                if (langVoices.length > 0) {
                    voice = langVoices[0];
                    console.warn('[TTS] ⚠️ Nenhuma voz natural encontrada, usando voz padrão:', voice.name);
                } else {
                    console.warn('[TTS] ⚠️ Nenhuma voz encontrada para o idioma, usando Google TTS');
                    resolve(false);
                    return;
                }
            }
            
            utter.voice = voice;

            utter.onend = () => resolve(true);
            utter.onerror = () => resolve(false);

            this.synth.cancel();
            this.synth.speak(utter);
        });
    }

    stop() {
        if (this.synth) this.synth.cancel();
    }

    clearCache() {
        this.audioCache.clear();
    }

    setPreferredEngine(engine) {
        this.preferredEngine = engine;
    }
}

export const tts = new TTS();
