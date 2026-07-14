import assert from 'node:assert/strict';

let nextTimer = 1;
const timers = new Map();
const elements = new Map();

class FakeElement {
  constructor(tag) {
    this.tag = tag;
    this.style = {};
    this.children = [];
    this.parentElement = null;
    this.id = '';
  }
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    if (child.id) elements.set(child.id, child);
    return child;
  }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
    this.parentElement = null;
  }
}

let fakePlayer;
class FakePlayer {
  static failNext = false;
  constructor(_placeholder, config) {
    this.config = config;
    this.current = 0;
    this.state = 5;
    this.cueCalls = [];
    this.seekCalls = [];
    this.playCalls = 0;
    this.pauseCalls = 0;
    this.loadCalls = 0;
    fakePlayer = this;
    const shouldFail = FakePlayer.failNext;
    FakePlayer.failNext = false;
    queueMicrotask(() => shouldFail ? config.events.onError() : config.events.onReady());
  }
  cueVideoById(options) {
    this.cueCalls.push(options);
    this.current = options.startSeconds;
    this.state = 5;
  }
  loadVideoById() { this.loadCalls += 1; }
  seekTo(time) { this.seekCalls.push(time); this.current = time; }
  playVideo() {
    this.playCalls += 1;
    this.state = 1;
    this.config.events.onStateChange({ data: 1 });
  }
  pauseVideo() {
    this.pauseCalls += 1;
    this.state = 2;
    this.config.events.onStateChange({ data: 2 });
  }
  getCurrentTime() { return this.current; }
  getPlayerState() { return this.state; }
}

globalThis.document = {
  head: new FakeElement('head'),
  createElement: (tag) => new FakeElement(tag),
  getElementById: (id) => elements.get(id) || null,
};
globalThis.window = {
  location: { origin: 'https://example.test' },
  YT: { Player: FakePlayer, PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 } },
  setInterval(callback) {
    const id = nextTimer++;
    timers.set(id, callback);
    return id;
  },
  clearInterval(id) { timers.delete(id); },
  setTimeout,
  clearTimeout,
};

const playerModule = await import('../dashboard/js/core/ytPlayer.js');
const target = new FakeElement('section');

FakePlayer.failNext = true;
assert.equal(await playerModule.loadVideo(target, 'broken-video', { start: 1, end: 2 }), false, 'erro inicial é reportado');
assert.equal(await playerModule.loadVideo(target, 'video-a', { start: 3.25, end: 5.5 }), true);
assert.deepEqual(fakePlayer.cueCalls[0], { videoId: 'video-a', startSeconds: 3.25, endSeconds: 5.5 }, 'cue preserva limites exatos');
assert.equal(fakePlayer.playCalls, 0, 'load não faz autoplay');

assert.equal(playerModule.replayClip(), true);
assert.equal(fakePlayer.seekCalls.at(-1), 3.25, 'replay busca o início exato');
assert.equal(fakePlayer.playCalls, 1);
assert.equal(timers.size, 1, 'há somente um monitor de fim');

const firstTimerCallback = [...timers.values()][0];
fakePlayer.current = 5.46;
firstTimerCallback();
assert.equal(fakePlayer.seekCalls.at(-1), 3.25, 'loop volta ao começo da frase');
assert.equal(fakePlayer.playCalls, 2, 'loop retoma o mesmo player');
assert.equal(fakePlayer.loadCalls, 0, 'loop não recarrega iframe/vídeo');
assert.equal(timers.size, 1, 'troca de ciclo não acumula timers');

// ENDED atrasado do ciclo anterior, agora no início, não reinicia novamente.
const seeksAfterBoundary = fakePlayer.seekCalls.length;
fakePlayer.config.events.onStateChange({ data: 0 });
assert.equal(fakePlayer.seekCalls.length, seeksAfterBoundary, 'ENDED antigo foi deduplicado');

// Um callback antigo já enfileirado não cancela o timer do novo card.
assert.equal(await playerModule.loadVideo(target, 'video-b', { start: 10, end: 12 }), true);
playerModule.replayClip();
assert.equal(timers.size, 1);
firstTimerCallback();
assert.equal(timers.size, 1, 'callback obsoleto preserva monitor atual');
assert.equal(fakePlayer.seekCalls.at(-1), 10, 'callback obsoleto não altera posição');

playerModule.setClipLoop(false);
fakePlayer.current = 11.96;
const currentTimer = [...timers.values()][0];
currentTimer();
assert.equal(fakePlayer.seekCalls.at(-1), 10, 'sem loop, clip fica preparado no início');
assert.ok(fakePlayer.pauseCalls > 0, 'sem loop, player pausa no limite');
assert.equal(playerModule.isClipPlaying(), false);
assert.equal(timers.size, 0, 'pausa remove o monitor');

playerModule.hidePlayer();
assert.equal(target.children[0].style.display, 'none', 'hide oculta o player reutilizável');

console.log('12 testes da máquina de estados do player passaram — tudo verde ✅');
