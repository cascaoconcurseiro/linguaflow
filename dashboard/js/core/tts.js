// dashboard/js/core/tts.js
// Áudio natural (Google TTS) com cache em IndexedDB + download do MP3.
// Extensão: o service worker busca o MP3 (host_permissions ignoram CORS).
// Web (Vercel): Edge Function `tts` (proxy autenticado com CORS correto).

import { db as lfDb } from '../../../utils/db.js';
import { ExclusivePlayback } from '../../../utils/exclusive-playback.js';

const TTS_PROXY_URL = 'https://qnutoswrufznztoznlql.supabase.co/functions/v1/tts';
const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;

let currentAudioObj = null;
const playback = new ExclusivePlayback(() => window.speechSynthesis);
const memCache = new Map(); // `${lang}|${text}` -> object URL
const pendingAudio = new Map(); // evita duas buscas iguais enquanto o prefetch está em voo

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

// Progresso do download (~90MB, 1x só — cache do browser depois). Onda 4:
// antes era "pode demorar um pouco" sem feedback nenhum; agora emite um
// evento global que a tela de Configurações escuta pra desenhar uma barra
// real. Cada arquivo do modelo reporta seu próprio progresso (0-100), então
// agregamos por bytes carregados/total quando disponível.
function reportKokoroProgress(detail) {
  try { window.dispatchEvent(new CustomEvent('lf_kokoro_progress', { detail })); } catch { /* sem window (worker?) */ }
}

async function getKokoro() {
  if (_kokoro) return _kokoro;
  if (_kokoroLoading) return _kokoroLoading;
  const filesTotal = {};
  const filesLoaded = {};
  _kokoroLoading = (async () => {
    const mod = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm');
    const device = navigator.gpu ? 'webgpu' : 'wasm';
    reportKokoroProgress({ status: 'start', progress: 0 });
    _kokoro = await mod.KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: device === 'webgpu' ? 'fp32' : 'q8',
      device,
      progress_callback: (data) => {
        if (!data || typeof data !== 'object') return;
        if (data.status === 'progress' && data.file) {
          filesTotal[data.file] = data.total || filesTotal[data.file] || 0;
          filesLoaded[data.file] = data.loaded || 0;
          const total = Object.values(filesTotal).reduce((a, b) => a + b, 0);
          const loaded = Object.values(filesLoaded).reduce((a, b) => a + b, 0);
          const progress = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : (data.progress || 0);
          reportKokoroProgress({ status: 'progress', progress, loaded, total, file: data.file });
        }
      },
    });
    console.debug('[TTS] Kokoro pronto via', device);
    reportKokoroProgress({ status: 'done', progress: 100 });
    return _kokoro;
  })().catch((e) => {
    console.warn('[TTS] Kokoro indisponível, usando Google TTS:', e?.message);
    reportKokoroProgress({ status: 'error', error: e?.message || 'Falha ao carregar o modelo.' });
    _kokoroLoading = null;
    throw e;
  });
  return _kokoroLoading;
}

// Onda 4: dispara o download/carregamento do modelo assim que o usuário
// ativa o toggle, em vez de esperar o primeiro áudio — a tela de
// Configurações usa isso pra mostrar uma barra de progresso real na hora.
export function preloadKokoro() {
  return getKokoro().catch(() => null);
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
  const key = `${kokoroEnabled() ? 'kk' : 'g'}|${lang}|${text}`;
  if (memCache.has(key)) return memCache.get(key);
  if (pendingAudio.has(key)) return pendingAudio.get(key);
  const promise = (async () => {
    const blob = await getAudioBlob(text, lang);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    memCache.set(key, url);
    return url;
  })().finally(() => pendingAudio.delete(key));
  pendingAudio.set(key, promise);
  return promise;
}

export function preloadNaturalAudio(text, options = {}) {
  const clean = String(text || '').trim();
  if (!clean) return Promise.resolve(false);
  return getAudioUrl(clean, options.lang || _getTTSLang()).then(Boolean).catch(() => false);
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
  const token = playback.begin();

  const src = await getAudioUrl(text, lang).catch(() => null);
  if (!playback.isCurrent(token)) return false;

  return new Promise((resolve) => {
    let settled = false;
    let fallbackStarted = false;
    let speechFallbackStarted = false;
    let cancelActive = null;

    const finish = (completed = true) => {
      if (settled) return;
      settled = true;
      if (cancelActive) playback.release(token, cancelActive);
      currentAudioObj = null;
      if (completed && playback.isCurrent(token) && onEndCallback) onEndCallback();
      resolve(completed);
    };

    const activateAudio = (audio) => {
      cancelActive = () => {
        audio.onended = null;
        audio.onerror = null;
        try { audio.pause(); audio.currentTime = 0; } catch { /* elemento parcial */ }
        finish(false);
      };
      if (!playback.activate(token, cancelActive)) return false;
      currentAudioObj = audio;
      return true;
    };

    const tryDirect = () => {
      if (fallbackStarted || settled || !playback.isCurrent(token)) return;
      fallbackStarted = true;
      // Troca de mecanismo não é cancelamento da reprodução inteira: solte o
      // elemento que falhou antes de registrar o próximo fallback.
      if (cancelActive) playback.release(token, cancelActive);
      if (currentAudioObj) {
        currentAudioObj.onended = null;
        currentAudioObj.onerror = null;
        try { currentAudioObj.pause(); } catch { /* elemento parcial */ }
        currentAudioObj = null;
      }
      // Último recurso online: URL do Google direto no <audio> (sem cache)
      const direct = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=gtx`);
      direct.playbackRate = rate;
      direct.onended = finish;
      const useSpeech = () => {
        if (speechFallbackStarted || settled || !playback.isCurrent(token)) return;
        speechFallbackStarted = true;
        direct.onended = null;
        direct.onerror = null;
        if (cancelActive) playback.release(token, cancelActive);
        try { direct.pause(); } catch { /* elemento parcial */ }
        currentAudioObj = null;
        _fallbackTTS(text, lang, rate, token, playback, finish);
      };
      direct.onerror = useSpeech;
      if (!activateAudio(direct)) return;
      direct.play().catch(useSpeech);
    };

    if (!src) return tryDirect();

    const audio = new Audio(src);
    audio.playbackRate = rate;
    audio.onended = finish;
    audio.onerror = tryDirect;
    if (!activateAudio(audio)) return;
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
  playback.stop();
  currentAudioObj = null;
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

function _fallbackTTS(text, lang, rate, token, controller, finish) {
  console.warn('[TTS] Áudio natural indisponível, usando Web Speech API.');
  if (!('speechSynthesis' in window) || !controller.isCurrent(token)) return finish(false);

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;

  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => v.lang.startsWith(lang.split('-')[0]) && (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google')));
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  let speechSettled = false;
  const endSpeech = (completed) => {
    if (speechSettled) return;
    speechSettled = true;
    finish(completed);
  };
  const cancelSpeech = () => {
    utterance.onend = null;
    utterance.onerror = null;
    try { window.speechSynthesis.cancel(); } catch { /* API opcional */ }
    endSpeech(false);
  };
  if (!controller.activate(token, cancelSpeech)) return;
  utterance.onend = () => {
    controller.release(token, cancelSpeech);
    endSpeech(controller.isCurrent(token));
  };
  utterance.onerror = () => {
    controller.release(token, cancelSpeech);
    endSpeech(false);
  };

  window.speechSynthesis.speak(utterance);
}
