import assert from 'node:assert/strict';

const pendingMessages = [];
const synth = {
  cancelCount: 0,
  spoken: [],
  cancel() { this.cancelCount += 1; },
  speak(utterance) { this.spoken.push(utterance); },
  getVoices() { return []; },
};

globalThis.window = { speechSynthesis: synth };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.chrome = {
  runtime: {
    id: 'test-extension',
    sendMessage(request, callback) { pendingMessages.push({ request, callback }); },
  },
};
globalThis.SpeechSynthesisUtterance = class {
  constructor(text) { this.text = text; }
};

class FakeAudio {
  static instances = [];
  static failPlay = false;

  constructor(src) {
    this.src = src;
    this.paused = false;
    this.currentTime = 0;
    FakeAudio.instances.push(this);
  }

  play() {
    if (!FakeAudio.failPlay) return Promise.resolve();
    queueMicrotask(() => this.onerror?.(new Error('audio_failed')));
    return Promise.reject(new Error('play_rejected'));
  }

  pause() { this.paused = true; }
}
globalThis.Audio = FakeAudio;

// IndexedDB mínimo: cache miss determinístico para exercitar o caminho que
// aguarda o service worker antes de criar o elemento de áudio.
globalThis.indexedDB = {
  open() {
    const request = {};
    request.result = {
      transaction() {
        return { objectStore: () => ({ get: () => {
          const getRequest = { result: null };
          queueMicrotask(() => getRequest.onsuccess?.());
          return getRequest;
        } }) };
      },
    };
    queueMicrotask(() => request.onsuccess?.());
    return request;
  },
};

async function flushUntil(predicate, label) {
  for (let i = 0; i < 20 && !predicate(); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.ok(predicate(), label);
}

const { tts } = await import('../utils/tts.js');

// A resposta antiga chega depois da nova: somente a nova cria/toca Audio.
const first = tts.play('first');
const second = tts.play('second');
assert.equal(pendingMessages.length, 2, 'duas buscas TTS ficaram pendentes');
pendingMessages[1].callback({ success: true, dataUrl: 'data:second' });
await flushUntil(() => FakeAudio.instances.length === 1, 'pedido atual criou o player');
pendingMessages[0].callback({ success: true, dataUrl: 'data:first' });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(FakeAudio.instances.length, 1, 'resposta obsoleta não criou outro player');
FakeAudio.instances[0].onended?.();
assert.equal(await second, true);
assert.equal(await first, false);

// Um novo áudio nativo cancela e resolve o anterior, sem promessa pendurada.
const third = tts.play('third', 'en-US', 'native:third');
await flushUntil(() => FakeAudio.instances.length === 2, 'áudio nativo iniciou');
const thirdAudio = FakeAudio.instances.at(-1);
const fourth = tts.play('fourth', 'en-US', 'native:fourth');
await flushUntil(() => FakeAudio.instances.length === 3, 'novo áudio nativo iniciou');
assert.equal(thirdAudio.paused, true, 'áudio anterior foi pausado');
assert.equal(await third, false, 'promessa cancelada foi encerrada');
FakeAudio.instances.at(-1).onended?.();
assert.equal(await fourth, true);

// Dashboard: rejeição de play + evento error no mesmo elemento só podem
// iniciar um único fallback SpeechSynthesis.
pendingMessages.length = 0;
FakeAudio.failPlay = true;
const dashboardTts = await import('../dashboard/js/core/tts.js');
const dashboardPlay = dashboardTts.playNaturalAudio('fallback once');
await flushUntil(() => pendingMessages.length === 1, 'dashboard solicitou áudio ao worker');
pendingMessages[0].callback({ success: false });
await flushUntil(() => synth.spoken.length === 1, 'fallback de voz iniciou');
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(synth.spoken.length, 1, 'onerror e rejeição não duplicaram o fallback');
synth.spoken[0].onend?.();
assert.equal(await dashboardPlay, true);

// stopAudio também cancela a Web Speech API e encerra a promise corrente.
pendingMessages.length = 0;
const speechPlay = dashboardTts.playNaturalAudio('cancel speech');
await flushUntil(() => pendingMessages.length === 1, 'segunda voz solicitada');
pendingMessages[0].callback({ success: false });
await flushUntil(() => synth.spoken.length === 2, 'segunda voz iniciou');
const cancelsBefore = synth.cancelCount;
dashboardTts.stopAudio();
assert.ok(synth.cancelCount > cancelsBefore, 'stopAudio cancelou speechSynthesis');
assert.equal(await speechPlay, false, 'promise da fala cancelada foi encerrada');

console.log('8 testes de concorrência de áudio passaram — tudo verde ✅');
