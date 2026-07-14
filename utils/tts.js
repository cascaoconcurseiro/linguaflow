// utils/tts.js
import { ExclusivePlayback } from './exclusive-playback.js';

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
        this.playback = new ExclusivePlayback(() => this.synth);

        if (this.synth) {
            this.synth.onvoiceschanged = () => {
                this.voices = this.synth.getVoices();
                console.debug('[LinguaFlow TTS] Vozes carregadas:', this.voices.length);
            };
        }
    }

    /**
     * Reproduz texto com a melhor qualidade disponivel
     * @param {string} text
     * @param {string} lang  ex: 'en-US', 'pt-BR'
     * @param {string} audioUrl  URL MP3 opcional (dicionario)
     */
    async play(text, lang = 'en-US', audioUrl = null, rate = 1.0) {
        if (!text || text.trim() === '') return false;
        const token = this.playback.begin();

        // Prioridade 1: Audio MP3 nativo do dicionario (melhor qualidade)
        if (audioUrl) {
            try {
                await this._playAudioUrl(audioUrl, rate, token);
                return true;
            } catch (e) {
                if (!this.playback.isCurrent(token)) return false;
                console.debug('[TTS] Audio MP3 falhou, tentando Google TTS');
            }
        }

        // Prioridade 2: Google Translate TTS (voz neural, natural)
        try {
            await this._playGoogleTTS(text, lang, rate, token);
            return true;
        } catch (e) {
            if (!this.playback.isCurrent(token)) return false;
            console.debug('[TTS] Google TTS falhou, usando Web Speech API');
        }

        // Prioridade 3 removida: Sem fallback para voz robótica (Web Speech API)
        console.warn('[TTS] Google TTS falhou, e o áudio robótico foi desativado.');
        return false;
    }

    async _playGoogleTTS(text, lang, rate = 1.0, token) {
        const langMap = {
            'en-US': 'en', 'en-GB': 'en',
            'pt-BR': 'pt', 'pt-PT': 'pt',
            'es-ES': 'es', 'fr-FR': 'fr',
            'de-DE': 'de', 'it-IT': 'it',
            'ja-JP': 'ja', 'ko-KR': 'ko',
            'zh-CN': 'zh-CN', 'ru-RU': 'ru'
        };
        const googleLang = langMap[lang] || lang.split('-')[0];
        
        // Ordem por qualidade de voz:
        // gtx e dict-chrome-ex retornam voz WaveNet (neural, natural)
        // tw-ob retorna voz sintética mais antiga (robótica) — fica por último
        const urls = [
            `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${googleLang}&client=gtx`,
            `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${googleLang}&client=dict-chrome-ex`
        ];

        // Try each URL until one works
        for (const url of urls) {
            try {
                // Cache inclui o endpoint para evitar guardar URL de voz robótica
                const cacheKey = `${text}|${googleLang}|${url.split('client=')[1]}`;
                let playableUrl = this.audioCache.get(cacheKey);
                if (!playableUrl) {
                    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                        try {
                            const res = await new Promise(resolve => {
                                chrome.runtime.sendMessage({ type: 'FETCH_TTS', url }, resolve);
                            });
                            if (!this.playback.isCurrent(token)) throw new Error('playback_superseded');
                            if (res && res.success) {
                                playableUrl = res.dataUrl;
                            }
                        } catch(e) {
                            if (!this.playback.isCurrent(token)) throw e;
                            console.debug('Chrome messaging failed, falling back...');
                        }
                    }
                    
                    // Se não for extensão ou falhou, usa Proxy para evitar AdBlockers e CORS
                    if (!playableUrl) {
                        // Vamos usar o AllOrigins como proxy
                        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
                        playableUrl = proxyUrl;
                    }
                    
                    this.audioCache.set(cacheKey, playableUrl);
                    if (this.audioCache.size > 200) {
                        this.audioCache.delete(this.audioCache.keys().next().value);
                    }
                }

                if (!this.playback.isCurrent(token)) throw new Error('playback_superseded');
                await this._playAudioUrl(playableUrl, rate, token);

                console.debug('[TTS] Google TTS success');
                return true;
            } catch (e) {
                if (!this.playback.isCurrent(token)) throw e;
                console.debug('[TTS] Google TTS endpoint failed, trying next...');
                continue;
            }
        }
        
        // All endpoints failed
        throw new Error('All Google TTS endpoints failed');
    }

    _playAudioUrl(url, rate, token) {
        return new Promise((resolve, reject) => {
            if (!this.playback.isCurrent(token)) return reject(new Error('playback_superseded'));
            const audio = new Audio(url);
            audio.volume = 1.0;
            audio.playbackRate = Math.max(0.1, Math.min(rate, 4.0));
            let settled = false;
            const settle = (error) => {
                if (settled) return;
                settled = true;
                this.playback.release(token, cancel);
                audio.onended = null;
                audio.onerror = null;
                error ? reject(error) : resolve(true);
            };
            const cancel = () => {
                try { audio.pause(); audio.currentTime = 0; } catch { /* elemento parcial */ }
                settle(new Error('playback_superseded'));
            };
            audio.onended = () => settle(null);
            audio.onerror = () => settle(new Error('audio_failed'));
            if (!this.playback.activate(token, cancel)) return;
            audio.play().catch((error) => settle(error));
        });
    }

    async _playWebSpeech(text, lang, rate = 1.0) {
        return false;
        if (this.voices.length === 0) {
            this.voices = this.synth.getVoices();
            if (this.voices.length === 0) {
                await new Promise(resolve => {
                    const checkVoices = () => {
                        const v = this.synth.getVoices();
                        if (v.length > 0) {
                            this.voices = v;
                            this.synth.onvoiceschanged = null;
                            resolve();
                        }
                    };
                    this.synth.onvoiceschanged = checkVoices;
                    // Timeout de segurança menor (200ms) caso o evento não dispare mas as vozes apareçam
                    setTimeout(checkVoices, 200);
                    // Timeout de desistência (2s) para não travar a UI
                    setTimeout(resolve, 2000);
                });
            }
        }

        return new Promise(resolve => {
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = lang || 'en-US';
            utter.rate = Math.max(0.1, Math.min(rate, 4.0));
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

            console.debug('[TTS] Vozes naturais disponíveis:', naturalVoices.length, '/', this.voices.length);
            if (naturalVoices.length > 0) {
                console.debug('[TTS] Vozes naturais:', naturalVoices.map(v => v.name).join(', '));
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
                    console.debug('[TTS] Usando voz preferida:', voice.name);
                    break;
                }
            }
            
            // Se não encontrou, usa qualquer voz natural do idioma
            if (!voice) {
                voice = naturalVoices.find(v => v.lang.startsWith((lang || 'en').split('-')[0]));
                if (voice) {
                    console.debug('[TTS] Usando voz natural do idioma:', voice.name);
                }
            }
            
            // Último recurso: primeira voz natural disponível
            if (!voice && naturalVoices.length > 0) {
                voice = naturalVoices[0];
                console.debug('[TTS] Usando primeira voz natural disponível:', voice.name);
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
        this.playback.stop();
    }

    clearCache() {
        this.audioCache.clear();
    }

    setPreferredEngine(engine) {
        this.preferredEngine = engine;
    }
}

export const tts = new TTS();
