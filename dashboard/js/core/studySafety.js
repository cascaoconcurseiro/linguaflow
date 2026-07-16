export function escapeStudyHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderStudyChunkCard(chunk = {}, index = 0) {
  const safeEng = escapeStudyHtml(chunk.eng);
  const safePhon = escapeStudyHtml(chunk.phon);
  const safePt = escapeStudyHtml(chunk.pt);
  const safeIndex = Number.isFinite(index) && index >= 0 ? index : 0;
  return `
    <div class="chunk-card" style="animation: slideIn 0.3s ease forwards; animation-delay: ${safeIndex * 0.1}s; opacity:0;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="flex:1;">
          <div class="chunk-en">${safeEng}</div>
          <div class="chunk-br">${safePhon}</div>
          <div class="chunk-pt">${safePt}</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; flex-shrink:0; margin-left:8px;">
          <button class="chunk-action-btn chunk-audio-btn" data-text="${safeEng}" aria-label="Ouvir: ${safeEng}" title="Ouvir">🔊</button>
          <button class="chunk-action-btn chunk-save-btn" data-text="${safeEng}" aria-label="Salvar áudio de: ${safeEng}" title="Salvar áudio (MP3)">⬇️</button>
        </div>
      </div>
    </div>
  `;
}

export function installYouglishReadyHandler(target, getQueuedWord, fetchWord) {
  target.onYouglishAPIReady = () => {
    const queuedWord = getQueuedWord();
    if (queuedWord) fetchWord(queuedWord);
  };
  return target.onYouglishAPIReady;
}
