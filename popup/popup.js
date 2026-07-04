// popup/popup.js — Supabase Auth + Stats
import { db } from '../utils/db.js';

const SUPABASE_URL = 'https://qnutoswrufznztoznlql.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXRvc3dydWZ6bnp0b3pubHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNzIyODEsImV4cCI6MjA5ODc0ODI4MX0.MdtBZwBnqNDpZ5nTytZDzNFKxHxd1rLmi6wT2MfV-0s';

let session = null;

async function init() {
  const stored = await chrome.storage.local.get('lf_supabase_session');
  if (stored.lf_supabase_session) {
    try {
      const data = JSON.parse(stored.lf_supabase_session);
      const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
        headers: { Authorization: 'Bearer ' + data.session.access_token, apikey: SUPABASE_KEY }
      });
      if (res.ok) { session = data.session; showStats(); return; }
    } catch (e) {}
  }
  showLogin();
}

function showLogin() {
  document.getElementById('login-state').style.display = 'block';
  document.getElementById('stats-state').style.display = 'none';
  ['btn-dash','btn-settings','btn-logout'].forEach(id => { const el = document.getElementById(id); if(el) el.style.display = 'none'; });
}

function showStats() {
  document.getElementById('login-state').style.display = 'none';
  document.getElementById('stats-state').style.display = 'block';
  ['btn-dash','btn-settings','btn-logout'].forEach(id => { const el = document.getElementById(id); if(el) el.style.display = ''; });
  loadStats();
}

async function doLogin() {
  const email = document.getElementById('popup-email').value;
  const pass = document.getElementById('popup-pass').value;
  const errEl = document.getElementById('popup-error');
  if (!email || !pass) { errEl.textContent = 'Preencha email e senha'; errEl.style.display = 'block'; return; }
  try {
    const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ email, password: pass })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error_description || 'Erro'); }
    session = await res.json();
    await chrome.storage.local.set({ lf_supabase_session: JSON.stringify(session) });
    showStats();
  } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
}

async function doRegister() {
  const email = document.getElementById('popup-email').value;
  const pass = document.getElementById('popup-pass').value;
  const errEl = document.getElementById('popup-error');
  if (!email || !pass || pass.length < 6) { errEl.textContent = 'Senha mínimo 6 caracteres'; errEl.style.display = 'block'; return; }
  try {
    const res = await fetch(SUPABASE_URL + '/auth/v1/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ email, password: pass })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.msg || 'Erro'); }
    errEl.textContent = 'Conta criada! Clique em Entrar.';
    errEl.style.display = 'block';
  } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
}

async function doLogout() {
  if (session?.access_token) {
    await fetch(SUPABASE_URL + '/auth/v1/logout', {
      method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token, apikey: SUPABASE_KEY }
    }).catch(() => {});
  }
  session = null;
  await chrome.storage.local.remove('lf_supabase_session');
  location.reload();
}

async function loadStats() {
  try {
    const stats = await db.getStats();
    document.getElementById('stat-due').textContent = stats.dueCards || 0;
    document.getElementById('stat-learned').textContent = stats.byStatus?.mature || 0;
    const weights = { A1: 1, A2: 1.5, B1: 2, B2: 3, C1: 4, C2: 5 };
    let vocabXP = 0;
    if (stats.byCEFR) Object.keys(stats.byCEFR).forEach(lv => { vocabXP += (stats.byCEFR[lv] || 0) * (weights[lv] || 1) * 10; });
    const immersionXP = Math.round((stats.totalSecs || 0) / 60);
    const totalXP = Math.round((vocabXP + immersionXP) * (0.8 + ((stats.retention || 0) / 100) * 0.4));
    const levels = [
      { id: 'A1', name: 'Iniciante', min: 0, max: 5000 }, { id: 'A2', name: 'Básico', min: 5001, max: 15000 },
      { id: 'B1', name: 'Intermediário', min: 15001, max: 40000 }, { id: 'B2', name: 'Intermediário Superior', min: 40001, max: 90000 },
      { id: 'C1', name: 'Avançado', min: 90001, max: 150000 }, { id: 'C2', name: 'Fluente', min: 150001, max: 10000000 }
    ];
    const current = levels.find(l => totalXP >= l.min && totalXP <= l.max) || levels[0];
    const idx = levels.indexOf(current);
    const next = levels[idx + 1];
    const progress = Math.min(100, Math.round(((totalXP - current.min) / Math.max(1, current.max - current.min)) * 100));
    document.getElementById('stat-lvl-name').textContent = current.name + ' (' + current.id + ')';
    document.getElementById('stat-cefr').textContent = current.id;
    document.getElementById('stat-progress').style.width = progress + '%';
    document.getElementById('stat-xp-text').textContent = next ? totalXP.toLocaleString() + ' / ' + current.max.toLocaleString() + ' XP' : totalXP.toLocaleString() + ' XP';
  } catch (e) {}
}

document.getElementById('popup-login-btn').addEventListener('click', doLogin);
document.getElementById('popup-register-btn').addEventListener('click', doRegister);
document.getElementById('popup-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('btn-logout').addEventListener('click', doLogout);
document.getElementById('btn-dash').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') }));
document.getElementById('btn-settings').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'LF_TOGGLE_SETTINGS' }).catch(() => {});
    window.close();
  });
});

init();
