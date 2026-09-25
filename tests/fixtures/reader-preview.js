import { db } from '../../utils/db.js';
import { renderReader } from '../../dashboard/js/ui/readerView.js';

// Mock do banco para a prévia local do Reader
let savedTexts = [];

db.getAllKnownWords = async () => [];
db.getAllWords = async () => [];
db.getAllCards = async () => [];
db.getReaderTexts = async () => structuredClone(savedTexts);
db.saveReaderText = async (text) => {
  savedTexts = savedTexts.filter(t => t.id !== text.id);
  savedTexts.unshift(structuredClone(text));
  return text;
};
db.updateReaderProgress = async (id, { lastReadPosition, readingPercentage, isCompleted }) => {
  const t = savedTexts.find(x => x.id === id);
  if (t) {
    t.last_read_position = lastReadPosition;
    t.reading_percentage = readingPercentage;
    t.is_completed = isCompleted;
  }
  return { ok: true };
};
db.getCurrentUserId = async () => 'test-e2e-user';

const root = document.getElementById('app-root');
const app = {
  db,
  onLeaveView() {},
  navigate() {},
  showToast(msg) {
    const t = document.getElementById('toast-container');
    if (t) t.textContent = msg;
  },
};

await renderReader(root, app);
