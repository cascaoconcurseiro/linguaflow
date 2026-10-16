// content/subtitles/engine/max-sync.js — Sincronia das legendas da Max/HBO por arquivo VTT.
//
// Cada arquivo VTT da Max tem um deslocamento próprio que só o player conhece
// (ver hbo-segment-offset.js). Aqui observamos a legenda nativa (escondida por CSS,
// mas ainda no DOM) e calibramos o arquivo quando duas falas únicas concordam.
// Só roda com platform === 'max'; o YouTube não passa por aqui.
import { estimateSegmentOffset, segmentKey, shiftCues } from '../hbo-segment-offset.js';

const NATIVE_CAPTION_SELECTOR =
  '[data-testid="caption_renderer_overlay"], [class*="SubtitleText"], [class*="subtitle-text"], .track-text-container';
const SAMPLE_INTERVAL_MS = 100;
// Salto maior que isso entre duas leituras é seek: a fala nativa já vinha em andamento
// e o instante em que a vemos não é o início dela.
const MAX_CONTINUOUS_STEP_SECONDS = 0.6;
const MAX_SAMPLES = 60;

export class MaxSyncMethods {
  _maxResetCalibration() {
    this._maxSegments = new Map(); // arquivo → { offset: number|null }
    this._maxSamples = [];
    this._maxLastNativeText = null;
    this._maxLastNativeTime = Number.NaN;
  }

  /** Marca as falas do arquivo e aplica o deslocamento, se ele já foi calibrado. */
  _maxTagSegment(cues, url) {
    if (!this._maxSegments) this._maxResetCalibration();
    const key = segmentKey(url);
    let segment = this._maxSegments.get(key);
    if (!segment) {
      segment = { offset: null };
      this._maxSegments.set(key, segment);
    }
    for (const cue of cues) {
      cue._seg = key;
      cue._rawStart = cue.start;
      cue._rawEnd = cue.end;
    }
    if (segment.offset !== null) shiftCues(cues, segment.offset);
    return cues;
  }

  _maxStartCalibration() {
    if (!this._maxSegments) this._maxResetCalibration();
    this._setManagedInterval(() => this._maxSampleNativeCaption(), SAMPLE_INTERVAL_MS);
  }

  _maxSampleNativeCaption() {
    const video = this.videoElement || document.querySelector('video');
    if (!video || video.paused || video.seeking) {
      this._maxLastNativeText = null;
      return;
    }
    const time = video.currentTime;
    const jumped = Math.abs(time - this._maxLastNativeTime) > MAX_CONTINUOUS_STEP_SECONDS;
    this._maxLastNativeTime = time;

    const node = document.querySelector(NATIVE_CAPTION_SELECTOR);
    const text = (node?.innerText || '').trim();
    const previous = this._maxLastNativeText;
    this._maxLastNativeText = jumped ? null : text;
    // Só vale a troca vista durante reprodução contínua: começo real de uma fala.
    if (jumped || previous === null || !text || text === previous) return;

    this._maxSamples.push({ time, text });
    if (this._maxSamples.length > MAX_SAMPLES) this._maxSamples.shift();
    this._maxCalibrate();
  }

  _maxCalibrate() {
    const all = this.xhrCues || [];
    let changed = false;
    for (const [key, segment] of this._maxSegments) {
      if (segment.offset !== null) continue;
      const segCues = all.filter((cue) => cue._seg === key);
      const offset = estimateSegmentOffset(this._maxSamples, segCues);
      if (offset === null) continue;
      segment.offset = offset;
      shiftCues(segCues, offset);
      changed = true;
    }
    if (!changed) return;
    this.xhrCues.sort((a, b) => a.start - b.start);
    this.cues = this.xhrCues;
    // O laço de sincronia só troca de fala quando o objeto muda; força a releitura.
    this._currentCue = null;
    this.lastText = '';
    this._debouncedRebuildPanels();
    console.debug('[LinguaFlow] Max: deslocamento de legenda calibrado por arquivo');
  }
}
