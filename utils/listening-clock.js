// Wall-clock exposure, not media duration or proficiency. No subtitle inference.
export class ListeningClock {
  constructor() { this.previous = null; this.pending = null; this.state = 'Idioma não confirmado'; }
  sample(s) {
    const prior = this.previous;
    this.previous = s;
    const reason = !s.language ? 'Idioma não confirmado'
      : !s.active ? 'Extensão pausada'
      : !s.visible ? 'Pausado: aba em segundo plano'
      : s.ad ? 'Pausado: anúncio'
      : s.paused || s.ended || s.seeking ? 'Pausado'
      : s.muted || s.volume === 0 ? 'Pausado: áudio sem som'
      : s.readyState < 3 ? 'Pausado: carregando vídeo' : null;
    this.state = reason || `Contando ${s.language.toUpperCase()} · ${s.evidence === 'audio_track' ? 'áudio detectado' : 'idioma confirmado'}`;
    if (reason || !prior || prior.key !== s.key || prior.language !== s.language || prior.rate !== s.rate) return 0;
    // Both endpoints must be eligible; large gaps and discontinuities are not listening.
    if (prior.paused || prior.ended || prior.seeking || prior.muted || prior.volume === 0 || prior.readyState < 3 || !prior.visible || !prior.active || prior.ad) return 0;
    const wall = (s.now - prior.now) / 1000;
    const media = s.time - prior.time;
    if (wall <= 0 || wall > 15 || media <= 0 || media > wall * s.rate + 0.4) {
      this.state = 'Pausado: aguardando reprodução contínua';
      return 0;
    }
    if (this.pending && (s.now - Date.parse(this.pending.startedAt) > 110000 || this.pending.seconds >= 45)) {
      // Flush whole seconds before extending a server-bounded interval. A stale
      // subsecond remainder cannot bridge a long pause into an invalid window.
      if (this.pending.seconds >= 1) return 0;
      this.pending = null;
    }
    const seconds = Math.min(wall, media / Math.max(0.1, s.rate));
    if (this.pending && (this.pending.key !== s.key || this.pending.language !== s.language)) return 0;
    this.pending ||= { key:s.key, language:s.language, startedAt:new Date(prior.now).toISOString(), seconds:0, evidence:s.evidence || 'user_confirmed' };
    this.pending.seconds += seconds;
    this.pending.endedAt = new Date(s.now).toISOString();
    return seconds;
  }
  take() {
    const value = this.pending;
    if (!value || Math.floor(value.seconds) < 1) return null;
    const seconds = Math.floor(value.seconds);
    const remainder = value.seconds - seconds;
    const end = Math.max(Date.parse(value.startedAt) + seconds * 1000, Date.parse(value.endedAt) - Math.floor(remainder * 1000));
    this.pending = remainder > 0.001
      ? { ...value, seconds:remainder, startedAt:new Date(end).toISOString() } : null;
    return { ...value, seconds, endedAt:new Date(end).toISOString() };
  }
}
