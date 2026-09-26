// content/subtitles/bridge-security.js — Validação e segurança de mensagens da ponte de legendas
// Extraído de content/subtitle-engine.js

export const SUBTITLE_BRIDGE_TYPES = new Set([
  'LF_HBO_SUB',
  'LF_SUBTITLE_HOOK',
  'LF_PLAYER_STATE',
  'LF_AUDIO_LANGUAGE',
  'LF_YT_SUB_TOGGLE',
]);
export const MAX_SUBTITLE_PAYLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_SUBTITLE_URL_LENGTH = 4096;

/**
 * Valida a autenticidade, origem e conformidade de payload de mensagens postMessage
 * entre o script injetado na página (YouTube/HBO Max/Netflix) e o content script do LinguaFlow.
 */
export function isTrustedSubtitleBridgeMessage(event, bridgeState, currentUrl) {
  const data = event?.data;
  if (event?.source !== window || event?.origin !== window.location.origin) return false;
  if (!bridgeState?.nonce || bridgeState.url !== currentUrl) return false;
  if (!data || typeof data !== 'object' || !SUBTITLE_BRIDGE_TYPES.has(data.type)) return false;
  if (data.nonce !== bridgeState.nonce || data.pageUrl !== currentUrl) return false;

  let currentHostname;
  try {
    currentHostname = new URL(currentUrl).hostname;
  } catch {
    return false;
  }
  const isYouTube = currentHostname === 'youtube.com' || currentHostname.endsWith('.youtube.com');
  const isMax = ['max.com', 'hbomax.com', 'hbo.com'].some(
    (domain) => currentHostname === domain || currentHostname.endsWith(`.${domain}`),
  );

  if (data.type === 'LF_AUDIO_LANGUAGE') {
    return isYouTube && (
      (data.language === null && data.evidence === null)
      || (typeof data.language === 'string' && /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(data.language)
        && ['audio_track', 'caption_asr'].includes(data.evidence))
    );
  }
  if (data.type === 'LF_PLAYER_STATE') {
    return isYouTube && Number.isInteger(data.state) && data.state >= -1 && data.state <= 5;
  }
  if (data.type === 'LF_YT_SUB_TOGGLE') return isYouTube && typeof data.active === 'boolean';

  if (typeof data.url !== 'string' || data.url.length === 0 || data.url.length > MAX_SUBTITLE_URL_LENGTH) {
    return false;
  }
  try {
    const subtitleUrl = new URL(data.url, currentUrl);
    const protocol = subtitleUrl.protocol;
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    const subtitleLocator = `${subtitleUrl.pathname}${subtitleUrl.search}`.toLowerCase();
    if (data.type === 'LF_SUBTITLE_HOOK' && (!isYouTube || !subtitleLocator.includes('timedtext'))) {
      return false;
    }
    if (
      data.type === 'LF_HBO_SUB'
      && (!isMax || !/(\.vtt|\.webvtt|subtitle|caption)/.test(subtitleLocator))
    ) return false;
  } catch {
    return false;
  }

  const payload = data.type === 'LF_HBO_SUB' ? data.response : data.data;
  if (typeof payload === 'string') {
    return payload.length <= MAX_SUBTITLE_PAYLOAD_BYTES
      && new TextEncoder().encode(payload).byteLength <= MAX_SUBTITLE_PAYLOAD_BYTES;
  }
  return payload instanceof ArrayBuffer && payload.byteLength <= MAX_SUBTITLE_PAYLOAD_BYTES;
}
