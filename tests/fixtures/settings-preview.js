// tests/fixtures/settings-preview.js — Prévia offline das Configurações (#498): troca os métodos do banco por respostas simuladas; nunca usa conta real.
import { db } from '../../utils/db.js';
import { renderSettings } from '../../dashboard/js/ui/settingsView.js';

const store = { lf_cefr_level: 'A2', cefrTargetLevel: 'A2' };
const writes = [];
Object.assign(db, {
  async getSettings(keys) { return Object.fromEntries(keys.map((k) => [k, store[k] ?? null])); },
  async getSetting(key) { return store[key] ?? null; },
  async setSetting(key, value) { store[key] = value; writes.push([key, value]); return true; },
  async isAdmin() { return false; },
  async getAllCards() { return []; },
  async getAllWords() { return []; },
  async getReviewLog() { return []; },
  async getUserStats() { return {}; },
  async getSRSCategoryOverrides() { return {}; },
  async getPushPublicKey() { return null; },
});
window.__preview = { store, writes, errors: [] };
window.addEventListener('error', (e) => window.__preview.errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__preview.errors.push(String(e.reason?.message || e.reason)));
const toasts = [];
window.__preview.toasts = toasts;
const app = { db, renderSignal: new AbortController().signal, navigate() {}, showToast: (msg) => toasts.push(msg) };
await renderSettings(document.getElementById('app-root'), app);
document.documentElement.dataset.ready = 'true';
