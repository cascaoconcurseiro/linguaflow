// Coordena recursos de áudio assíncronos. Uma geração antiga nunca pode
// recuperar o controle depois que uma reprodução mais nova começou.
export class ExclusivePlayback {
  constructor(getSpeechSynthesis = () => globalThis.window?.speechSynthesis || globalThis.speechSynthesis) {
    this._getSpeechSynthesis = getSpeechSynthesis;
    this._generation = 0;
    this._activeCancel = null;
  }

  begin() {
    const token = ++this._generation;
    this._cancelActive();
    this._cancelSpeech();
    return token;
  }

  isCurrent(token) {
    return token === this._generation;
  }

  // Registra como cancelar o recurso atual. Se a chamada ficou obsoleta
  // durante um await, ela é cancelada imediatamente e nunca chega a tocar.
  activate(token, cancel) {
    if (!this.isCurrent(token)) {
      cancel?.();
      return false;
    }
    this._cancelActive();
    this._activeCancel = typeof cancel === 'function' ? cancel : null;
    return true;
  }

  release(token, cancel) {
    if (this.isCurrent(token) && this._activeCancel === cancel) {
      this._activeCancel = null;
    }
  }

  stop() {
    ++this._generation;
    this._cancelActive();
    this._cancelSpeech();
  }

  _cancelActive() {
    const cancel = this._activeCancel;
    this._activeCancel = null;
    try { cancel?.(); } catch { /* cancelamento é best-effort */ }
  }

  _cancelSpeech() {
    try { this._getSpeechSynthesis?.()?.cancel?.(); } catch { /* API opcional */ }
  }
}
