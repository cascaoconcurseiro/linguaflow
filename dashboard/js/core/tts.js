// dashboard/js/core/tts.js
// Google Neural TTS via service worker (não requer API key)

let currentAudioObj = null;

/**
 * Reproduz texto com Google TTS via service worker.
 * @param {string} text - Texto a reproduzir
 * @param {object} options - { lang: 'en-US'|'en-GB', rate: 0.7|0.9|1.1 }
 * @param {function} onEndCallback - Chamado ao terminar
 */
export async function playNaturalAudio(text, options = {}, onEndCallback) {
  const lang = options.lang || _getTTSLang();
  const rate = options.rate || _getTTSRate();

  // Stop any existing audio
  if (currentAudioObj) {
    currentAudioObj.pause();
    currentAudioObj.currentTime = 0;
    currentAudioObj = null;
  }

  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=gtx`;


  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'FETCH_TTS', url }, (response) => {
        if (response && response.success) {
          const audio = new Audio(response.dataUrl);
          currentAudioObj = audio;
          audio.playbackRate = rate;
          audio.onended = () => {
            currentAudioObj = null;
            if (onEndCallback) onEndCallback();
            resolve();
          };
          audio.onerror = () => {
            currentAudioObj = null;
            _fallbackTTS(text, lang, rate, onEndCallback);
            resolve();
          };
          audio.play().catch(() => {
            _fallbackTTS(text, lang, rate, onEndCallback);
            resolve();
          });
        } else {
          _fallbackTTS(text, lang, rate, onEndCallback);
          resolve();
        }
      });
    } else {
      // Standalone Web App: Google TTS REST might block CORS, fallback to browser native TTS
      _fallbackTTS(text, lang, rate, onEndCallback);
      resolve();
    }
  });
}

/**
 * Para qualquer áudio em reprodução.
 */
export function stopAudio() {
  if (currentAudioObj) {
    currentAudioObj.pause();
    currentAudioObj.currentTime = 0;
    currentAudioObj = null;
  }
}

/**
 * Lê as preferências de sotaque do storage.
 * Retorna 'en-US' ou 'en-GB'.
 */
function _getTTSLang() {
  try {
    return localStorage.getItem('lf_tts_lang') || 'en-US';
  } catch { return 'en-US'; }
}

/**
 * Lê a velocidade de reprodução do storage.
 * slow=0.7, normal=0.9, native=1.1
 */
function _getTTSRate() {
  try {
    const speed = localStorage.getItem('lf_tts_speed') || 'normal';
    return speed === 'slow' ? 0.7 : speed === 'native' ? 1.1 : 0.9;
  } catch { return 0.9; }
}

/**
 * Fallback para voz nativa do browser (último recurso).
 */
function _fallbackTTS(text, lang, rate, onEndCallback) {
  console.warn('[TTS] Google TTS failed, using Web Speech API fallback.');
  if (!('speechSynthesis' in window)) {
    if (onEndCallback) onEndCallback();
    return;
  }
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => v.lang.startsWith(lang.split('-')[0]) && (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google')));
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }
  
  utterance.onend = () => {
    if (onEndCallback) onEndCallback();
  };
  
  utterance.onerror = () => {
    if (onEndCallback) onEndCallback();
  };
  
  window.speechSynthesis.speak(utterance);
}
