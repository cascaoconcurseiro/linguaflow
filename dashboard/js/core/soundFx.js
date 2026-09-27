// dashboard/js/core/soundFx.js
// Sons do player de cursos gerados na hora com Web Audio (sem arquivos): um
// clique curto de tecla e tons curtos de feedback. Implementação própria.

const KEY_VARIANTS = [
  { bodyHz: 150, seed: 0x9e3779b9 },
  { bodyHz: 164, seed: 0x85ebca6b },
  { bodyHz: 178, seed: 0xc2b2ae35 },
];

// Tons de feedback (Hz), tocados em sequência curta.
const FEEDBACK_TONES = {
  error: [220, 185],                 // descida curta: "não foi"
  word: [784, 1047],                 // G5 → C6: confirmação
  milestone: [587, 740, 880],        // D5 F#5 A5: sequência de acertos
  complete: [587, 740, 880, 1175],   // arpejo de D maior: lição concluída
};

// Ruído determinístico (xorshift32) para os três timbres serem sempre iguais.
function noiseGenerator(seed) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return (x / 0xffffffff) * 2 - 1;
  };
}

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.keyBuffers = null;
    this.keyIndex = 0;
    this.enabled = true;
    this.volume = 0.4;
  }

  // O AudioContext só pode nascer/retomar num gesto do usuário (clique/tecla).
  init() {
    if (!this.ctx) {
      const AudioCtx = globalThis.AudioContext || globalThis.window?.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx({ latencyHint: 'interactive' });
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // Três variações de clique: transiente de ruído (passa-altas simples) com
  // decaimento rápido + um "corpo" grave amortecido. 40 ms cada.
  _buildKeyBuffers() {
    if (!this.ctx) return;
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * 0.04);

    this.keyBuffers = KEY_VARIANTS.map(({ bodyHz, seed }) => {
      const buf = this.ctx.createBuffer(1, len, sr);
      const data = buf.getChannelData(0);
      const noise = noiseGenerator(seed);
      let prev = 0;
      let peak = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const n = noise();
        const bright = n - prev; // realça agudos: soa como o contato plástico
        prev = n;
        const transient = bright * Math.exp(-t / 0.002);
        const body = Math.sin(2 * Math.PI * bodyHz * t) * 0.5 * Math.exp(-t / 0.015);
        const attack = Math.min(1, t / 0.0005);
        data[i] = (transient + body) * attack;
        peak = Math.max(peak, Math.abs(data[i]));
      }
      const scale = peak > 0 ? 0.8 / peak : 1;
      for (let i = 0; i < len; i++) data[i] *= scale;
      return buf;
    });
  }

  playKey() {
    if (!this.enabled || this.volume <= 0) return;
    this.init();
    if (!this.ctx) return;
    if (!this.keyBuffers) this._buildKeyBuffers();
    if (!this.keyBuffers?.length) return;

    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    src.buffer = this.keyBuffers[this.keyIndex++ % this.keyBuffers.length];
    gain.gain.setValueAtTime(this.volume * 0.6, this.ctx.currentTime);
    src.connect(gain);
    gain.connect(this.ctx.destination);
    src.onended = () => {
      try { src.disconnect(); gain.disconnect(); } catch { /* já desconectado */ }
    };
    src.start();
  }

  playChord(type) {
    if (!this.enabled || this.volume <= 0) return;
    this.init();
    if (!this.ctx) return;

    const tones = FEEDBACK_TONES[type];
    if (!tones) return;
    const step = type === 'error' ? 0.09 : 0.07;

    tones.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = this.ctx.currentTime + idx * step;
      osc.type = type === 'error' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(this.volume * 0.35, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.onended = () => {
        try { osc.disconnect(); gain.disconnect(); } catch { /* já desconectado */ }
      };
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }
}

export const soundEngine = new SoundEngine();
