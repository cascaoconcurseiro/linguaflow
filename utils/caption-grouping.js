// Display-sized phrases from the captions already supplied to the player.
// This is formatting, not speech recognition; keep every original word and time.
const CJK = /[\u3040-\u30ff\u3400-\u9fff]/;
const COMPLETE = /[.!?…。！？][”’"')\]]*$/u;
const LIMIT_SECONDS = 8;
const LIMIT_CHARACTERS = 150;
const PURE_SOUND_OR_MARKER = /^([><]{1,4}|[»«›‹▶►◄◀➔→➤]|\[[^\]]+\]|\([^)]+\)|\*[^*]+\*|[♪♫♬♩\s])+$/;

export function groupCaptionEvents(events) {
  const fragments = (Array.isArray(events) ? events : [])
    .filter(event => Array.isArray(event?.segs) && Number.isFinite(event.tStartMs))
    .map(event => ({
      start:event.tStartMs / 1000,
      end:(event.tStartMs + Math.max(0, Number(event.dDurationMs) || 0)) / 1000,
      text:event.segs.map(seg => typeof seg?.utf8 === 'string' ? seg.utf8 : '').join('').replace(/\s+/g,' ').trim(),
    }))
    .filter(cue => cue.text && !PURE_SOUND_OR_MARKER.test(cue.text))
    .sort((a,b) => a.start-b.start);
  const phrases=[];
  for(const fragment of fragments) {
    const previous=phrases.at(-1);
    if (!previous) { phrases.push({...fragment}); continue; }
    const gap=fragment.start-previous.end;
    const isRevision=fragment.start<=previous.end+0.5 && fragment.text.startsWith(previous.text)
      && fragment.text.length>previous.text.length && fragment.text.length<=LIMIT_CHARACTERS;
    if(isRevision) {
      previous.text=fragment.text;
      previous.end=Math.max(previous.end,fragment.end);
      continue;
    }
    if(fragment.text===previous.text && gap<0.5) {
      previous.end=Math.max(previous.end,fragment.end);
      continue;
    }
    const distinctSpeaker=/^([-–—]|\>{1,4}|[»«›‹])\s*/.test(fragment.text);
    if(gap>1.1 || gap< -0.6 || COMPLETE.test(previous.text) || distinctSpeaker
      || fragment.end-previous.start>LIMIT_SECONDS || previous.text.length+fragment.text.length+1>LIMIT_CHARACTERS) {
      phrases.push({...fragment});
      continue;
    }
    const separator=CJK.test(previous.text) && CJK.test(fragment.text) ? '' : ' ';
    previous.text+=separator+fragment.text;
    previous.end=Math.max(previous.end,fragment.end);
  }
  // Evita que legendas persistam na tela durante silêncio ou música.
  // Limita a duração máxima ao tempo de fala/leitura confortável (máx LIMIT_SECONDS = 8s).
  for(let i=0;i<phrases.length;i++) {
    const text = phrases[i].text || '';
    const words = text.split(/\s+/).filter(Boolean).length;
    const maxDur = Math.min(LIMIT_SECONDS, Math.max(3.5, 2.0 + Math.max(words * 0.45, text.length * 0.08)));
    const maxEnd = phrases[i].start + maxDur;
    if (phrases[i].end > maxEnd) {
      phrases[i].end = maxEnd;
    }
    if (i < phrases.length - 1) {
      phrases[i].end = Math.min(phrases[i].end, phrases[i+1].start);
    }
  }
  return phrases;
}

export function selectCaptionTrack(tracks, language) {
  if(!Array.isArray(tracks) || !language) return null;
  const base=String(language).toLowerCase().split('-')[0];
  const matches=tracks.filter(track=>track?.baseUrl && String(track.languageCode||'').toLowerCase().split('-')[0]===base);
  return matches.find(track=>track.kind!=='asr') || matches[0] || null;
}

export function attachTranslationsByTime(original, translated) {
  if(!Array.isArray(original) || !Array.isArray(translated)) return;
  for(const cue of original) {
    const match=translated.filter(item=>item?.text && Number.isFinite(item.start) && Math.abs(item.start-cue.start)<=0.75)
      .sort((a,b)=>Math.abs(a.start-cue.start)-Math.abs(b.start-cue.start))[0];
    if(match)cue.translatedText=match.text;
  }
}
