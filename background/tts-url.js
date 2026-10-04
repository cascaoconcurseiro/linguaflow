// background/tts-url.js — URLs que o service worker aceita buscar para TTS (#470)

// Os chamadores legítimos só pedem o áudio do Google Tradutor. Qualquer outra
// URL recebida na mensagem FETCH_TTS seria um fetch arbitrário com as permissões
// de host da extensão, devolvido ao chamador em base64.
export function isAllowedTtsUrl(value) {
  try {
    const url = new URL(String(value));
    return (
      url.protocol === 'https:' &&
      url.hostname === 'translate.google.com' &&
      url.port === '' &&
      url.username === '' &&
      url.password === '' &&
      url.pathname === '/translate_tts'
    );
  } catch {
    return false;
  }
}
