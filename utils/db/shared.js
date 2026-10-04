// utils/db/shared.js — Constantes e funções puras compartilhadas pelo banco (db.js) e pelos seus módulos por assunto.

export const SUPABASE_URL = 'https://qnutoswrufznztoznlql.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_sjE7swuyYQz-80x9lttf4Q_awnZ_YlY';
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const FLUENCY_DRAFT_KEY = 'lf_fluency_check_draft_v1';
// snapshot era um JPEG base64 nunca renderizado. Em produção, só 6 palavras
// somavam 5,4 MB nesse campo e cada select=* o baixava outra vez.
export const WORD_SELECT = 'id,user_id,word,lang,translation,context_sentence,phonetic,explanation,level,tags,ai_chunks,video_url,video_title,platform,added_at,synonyms,antonyms,definition,category,mnemonic,video_start_ms,video_end_ms';

export function createOperationId() {
  return globalThis.crypto?.randomUUID?.()
    || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.floor(Math.random() * 16);
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

export function classifyRequestError(error, status = null, body = null) {
  const parsedStatus = Number(status || error?.status || 0) || null;
  let parsedBody = body;
  if (typeof body === 'string') {
    try { parsedBody = JSON.parse(body); } catch { parsedBody = null; }
  }
  error.status = parsedStatus;
  error.code = parsedBody?.code || error.code || null;
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (parsedStatus === 401) error.kind = 'auth';
  else if (offline) error.kind = 'offline';
  else if (
    [408, 425, 429].includes(parsedStatus)
    || (parsedStatus && parsedStatus >= 500)
    || /timeout|failed to fetch|network|load failed/i.test(error.message)
    || error?.name === 'TypeError'
  ) error.kind = 'retry';
  else error.kind = 'fatal';
  error.retryable = error.kind === 'offline' || error.kind === 'retry';
  return error;
}
