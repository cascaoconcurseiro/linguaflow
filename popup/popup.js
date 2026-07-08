// popup/popup.js - LinguaFlow V2 Offline Only
import { db as lfDb } from '../utils/db.js';

const btnDash = document.getElementById('btn-dash');
const statsText = document.getElementById('stats-text');

// Open Dashboard
btnDash.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
});

// Try to load due stats dynamically from the offline IndexedDB
try {
  const dueWords = await lfDb.getCardsDue(1000, false);
  if (dueWords.length > 0) {
    statsText.innerHTML = `Você tem <strong style="color:var(--color-secondary);">${dueWords.length}</strong> frases pendentes.<br>Abra o Dashboard para estudar!`;
  } else {
    statsText.innerHTML = `Você não tem cartas atrasadas!<br>Continue assistindo vídeos e adicione mais frases.`;
  }
} catch (err) {
  console.error("Popup couldn't read DB", err);
  // Silent fail, just keep the default HTML text
}
