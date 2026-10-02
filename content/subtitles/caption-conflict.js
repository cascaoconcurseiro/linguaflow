// content/subtitles/caption-conflict.js — Detecta outra extensão de legendas
// (Language Reactor) no mesmo vídeo (#400): duas camadas de legenda se sobrepõem
// e o usuário não sabe qual desativar.

export const CAPTION_CONFLICT_NOTICE = 'Language Reactor também está ativo neste vídeo. Desative um dos dois para evitar legendas sobrepostas.';

export function hasLanguageReactor(doc) {
  try {
    return Boolean(doc?.querySelector?.('#lln-root, [id^="lln-"], [class*="lln-"]'));
  } catch {
    return false;
  }
}
