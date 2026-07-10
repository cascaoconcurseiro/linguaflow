// dashboard/js/core/tts.js
// Áudio natural (Google TTS) com cache em IndexedDB + download do MP3.
// Extensão: o service worker busca o MP3 (host_permissions ignoram CORS).
// Web (Vercel): Edge Function `tts` (proxy autenticado com CORS correto).

import { db as lfDb } from '../../../utils/db.js';

const TTS_PROXY_URL = 'https://qnutoswrufznztoznlql.supabase.co/functions/v1/tts';
const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;

let currentAudioObj = null;
const memCache = new Map(); // `${lang}|${text}` -> object URL

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('lf-audio-cache', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('audio');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const idb = await idbOpen();
    return await new Promise((resolve) => {
      const req = idb.transaction('audio', 'readonly').objectStore('audio').get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbSet(key, blob) {
  try {
    const idb = await idbOpen();
    await new Promise((resolve) => {
      const tx = idb.transaction('audio', 'readwrite');
      tx.objectStore('audio').put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* cache é opcional */ }
}

// ── Kokoro-82M: voz neural premium LOCAL (opcional) ──────────────────────────
// Roda no navegador (WebGPU/WASM), modelo ~90MB baixado 1x (cache do browser).
// Só no site (extensão MV3 proíbe script remoto) e só se o usuário ativar
// nas Configurações (localStorage lf_kokoro = '1'). Qualquer falha cai na
// cadeia normal (Google TTS) — nunca quebra o áudio.
let _kokoro = null;
let _kokoroLoading = null;

function kokoroEnabled() {
  try { return !isExtension && localStorage.getItem('lf_kokoro') === '1'; }
  catch { return false; }
}

async function getKokoro() {
  if (_kokoro) return _kokoro;
  if (_kokoroLoading) return _kokoroLoading;
  _kokoroLoading = (async () => {
    const mod = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm');
    const device = navigator.gpu ? 'webgpu' : 'wasm';
    _kokoro = await mod.KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: device === 'webgpu' ? 'fp32' : 'q8',
      device,
    });
    console.debug('[TTS] Kokoro pronto via', device);
    return _kokoro;
  })().catch((e) => {
    console.warn('[TTS] Kokoro indisponível, usando Google TTS:', e?.message);
    _kokoroLoading = null;
    throw e;
  });
  return _kokoroLoading;
}

async function kokoroBlob(text, lang) {
  const tts = await getKokoro();
  // af_heart = americana (melhor avaliada); bf_emma = britânica
  const voice = String(lang).startsWith('en-GB') ? 'bf_emma' : 'af_heart';
  const audio = await tts.generate(text, { voice });
  return await audio.toBlob();
}

async function fetchTTSBlob(text, lang) {
  // Voz premium local primeiro (se ativada): grátis, offline e melhor que
  // Google TTS em inglês. Cache IndexedDB por chave diferente (qualidade ≠).
  if (kokoroEnabled() && String(lang).startsWith('en')) {
    try {
      return await kokoroBlob(text, lang);
    } catch { /* cai na cadeia normal abaixo */ }
  }
  if (isExtension) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=gtx`;
    const res = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'FETCH_TTS', url }, (r) => resolve(r));
      } catch {
        resolve(null);
      }
    });
    if (res && res.success && res.dataUrl) {
      const r = await fetch(res.dataUrl);
      return await r.blob();
    }
    return null;
  }

  const token = await lfDb._getToken();
  if (!token) return null;
  const r = await fetch(TTS_PROXY_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, lang }),
  });
  if (!r.ok) return null;
  return await r.blob();
}

/**
 * Retorna o Blob do áudio (cache IndexedDB primeiro, depois rede).
 */
export async function getAudioBlob(text, lang) {
  // Motor na chave: áudio Kokoro e Google são qualidades diferentes
  const key = `${kokoroEnabled() ? 'kk' : 'g'}|${lang}|${text}`;
  const cached = await idbGet(key);
  if (cached) return cached;
  const blob = await fetchTTSBlob(text, lang).catch(() => null);
  if (blob && blob.size > 0) {
    idbSet(key, blob);
    return blob;
  }
  return null;
}

async function getAudioUrl(text, lang) {
  const key = `${lang}|${text}`;
  if (memCache.has(key)) return memCache.get(key);
  const blob = await getAudioBlob(text, lang);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  memCache.set(key, url);
  return url;
}

/**
 * Reproduz texto com voz natural. Cache local: o mesmo áudio nunca é buscado duas vezes.
 * @param {string} text - Texto a reproduzir
 * @param {object} options - { lang: 'en-US'|'en-GB', rate: 0.7|0.9|1.1 }
 * @param {function} onEndCallback - Chamado ao terminar
 */
export async function playNaturalAudio(text, options = {}, onEndCallback) {
  const lang = options.lang || _getTTSLang();
  const rate = options.rate || _getTTSRate();
  stopAudio();

  const src = await getAudioUrl(text, lang).catch(() => null);

  return new Promise((resolve) => {
    const finish = () => {
      currentAudioObj = null;
      if (onEndCallback) onEndCallback();
      resolve();
    };
    const tryDirect = () => {
      // Último recurso online: URL do Google direto no <audio> (sem cache)
      const direct = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=gtx`);
      currentAudioObj = direct;
      direct.playbackRate = rate;
      direct.onended = finish;
      direct.onerror = () => { currentAudioObj = null; _fallbackTTS(text, lang, rate, onEndCallback); resolve(); };
      direct.play().catch(() => { currentAudioObj = null; _fallbackTTS(text, lang, rate, onEndCallback); resolve(); });
    };

    if (!src) return tryDirect();

    const audio = new Audio(src);
    currentAudioObj = audio;
    audio.playbackRate = rate;
    audio.onended = finish;
    audio.onerror = tryDirect;
    audio.play().catch(tryDirect);
  });
}

/**
 * Baixa o MP3 do texto (usa o cache se já foi tocado antes).
 */
export async function downloadAudio(text, options = {}) {
  const lang = options.lang || _getTTSLang();
  const blob = await getAudioBlob(text, lang);
  if (!blob) throw new Error('Não foi possível obter o áudio para salvar.');
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'audio';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `linguaflow-${slug}.mp3`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
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

function _getTTSLang() {
  try {
    return localStorage.getItem('lf_tts_lang') || 'en-US';
  } catch { return 'en-US'; }
}

function _getTTSRate() {
  try {
    const speed = localStorage.getItem('lf_tts_speed') || 'normal';
    return speed === 'slow' ? 0.7 : speed === 'native' ? 1.1 : 0.9;
  } catch { return 0.9; }
}

function _fallbackTTS(text, lang, rate, onEndCallback) {
  console.warn('[TTS] Áudio natural indisponível, usando Web Speech API.');
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

  utterance.onend = () => { if (onEndCallback) onEndCallback(); };
  utterance.onerror = () => { if (onEndCallback) onEndCallback(); };

  window.speechSynthesis.speak(utterance);
}
