// utils/caption-grouping.js — Agrupa eventos de legenda em frases do tamanho da tela e casa traduções por tempo, sem alterar palavras nem horários.
import { adjustFragmentCasing, normalizeSubtitleCasing } from './caption-casing.js';

// Display-sized phrases from the captions already supplied to the player.
// This is formatting, not speech recognition; keep every original word and time.
const CJK = /[\u3040-\u30ff\u3400-\u9fff]/;
const COMPLETE = /[.!?…。！？][”’"')\]]*$/u;
const LIMIT_SECONDS = 8;
const LIMIT_CHARACTERS = 150;
// Legenda automática "rolante": duas linhas na tela, como no player do YouTube.
const ROLLING_LIMIT_CHARACTERS = 90;
const PURE_SOUND_OR_MARKER = /^([><]{1,4}|[»«›‹▶►◄◀➔→➤]|\[[^\]]+\]|\([^)]+\)|\*[^*]+\*|[♪♫♬♩\s])+$/;

// #364: no formato rolante (quebras com aAppend) cada linha continua na tela
// até a próxima aparecer; a fala dela termina quando a próxima começa.
const isRolling = (events) => Array.isArray(events) && events.some(event => event?.aAppend);

// Uma cue por linha do player, sem sons/marcadores. Usada para a faixa
// traduzida, que é distribuída pelos trechos originais por tempo.
export function captionLines(events) {
  return timedLines(events).filter(cue => cue.text && !PURE_SOUND_OR_MARKER.test(cue.text));
}

function timedLines(events) {
  const list = Array.isArray(events) ? events : [];
  const lines = list
    .filter(event => Array.isArray(event?.segs) && Number.isFinite(event.tStartMs) && !event.aAppend)
    .map(event => ({
      start:event.tStartMs / 1000,
      end:(event.tStartMs + Math.max(0, Number(event.dDurationMs) || 0)) / 1000,
      text:normalizeSubtitleCasing(
        event.segs.map(seg => typeof seg?.utf8 === 'string' ? seg.utf8 : '').join('').replace(/\s+/g,' ').trim()
      ),
    }))
    .sort((a,b) => a.start-b.start);
  if (isRolling(list)) {
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i + 1].start < lines[i].end) lines[i].end = Math.max(lines[i].start, lines[i + 1].start);
    }
  }
  return lines;
}

export function groupCaptionEvents(events) {
  const limitCharacters = isRolling(events) ? ROLLING_LIMIT_CHARACTERS : LIMIT_CHARACTERS;
  const fragments = captionLines(events);
  const phrases=[];
  for(const fragment of fragments) {
    const previous=phrases.at(-1);
    if (!previous) { phrases.push({...fragment}); continue; }
    const gap=fragment.start-previous.end;
    const isRevision=fragment.start<=previous.end+0.5 && fragment.text.startsWith(previous.text)
      && fragment.text.length>previous.text.length && fragment.text.length<=limitCharacters;
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
      || fragment.end-previous.start>LIMIT_SECONDS || previous.text.length+fragment.text.length+1>limitCharacters) {
      phrases.push({...fragment});
      continue;
    }
    const separator=CJK.test(previous.text) && CJK.test(fragment.text) ? '' : ' ';
    const adjustedText=adjustFragmentCasing(previous.text, fragment.text);
    previous.text+=separator+adjustedText;
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

// Cada item traduzido vai para o trecho original em que ele começa (com folga
// de 0,75 s para faixas com tempos levemente diferentes). Trechos que juntaram
// várias linhas recebem as traduções dessas linhas, na ordem.
const TRANSLATION_TOLERANCE = 0.75;

export function attachTranslationsByTime(original, translated) {
  if(!Array.isArray(original) || !Array.isArray(translated)) return;
  const parts=new Map();
  const items=translated.filter(item=>item?.text && Number.isFinite(item.start)).sort((a,b)=>a.start-b.start);
  for(const item of items) {
    let owner=null;
    for(const cue of original) {
      if(cue.start>item.start+TRANSLATION_TOLERANCE) break;
      owner=cue;
    }
    if(!owner || item.start>=owner.end+TRANSLATION_TOLERANCE) continue;
    if(!parts.has(owner)) parts.set(owner,[]);
    parts.get(owner).push(item.text);
  }
  for(const [cue,texts] of parts) cue.translatedText=texts.join(' ');
}
