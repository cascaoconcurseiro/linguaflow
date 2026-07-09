// popup/popup.js — login próprio da extensão (sessão independente do site).
// A sessão vive em chrome.storage.local com refresh token: uma vez logado,
// renova sozinha pra sempre. O Dashboard completo mora no site.
import { db as lfDb } from '../utils/db.js';

const SITE_URL = 'https://linguaflow-web-tau.vercel.app/';

const areaLoading = document.getElementById('area-loading');
const areaLogin = document.getElementById('area-login');
const areaLogged = document.getElementById('area-logged');

function show(area) {
  [areaLoading, areaLogin, areaLogged].forEach((el) => el.classList.add('hidden'));
  area.classList.remove('hidden');
}

async function renderLoggedIn() {
  show(areaLogged);

  // E-mail do usuário logado (lido da sessão salva)
  try {
    const session = await new Promise((resolve) => {
      chrome.storage.local.get('lf_supabase_session', (res) => {
        try { resolve(JSON.parse(res.lf_supabase_session)?.session || null); }
        catch { resolve(null); }
      });
    });
    document.getElementById('user-email').textContent = session?.user?.email || 'Conectado';
  } catch {
    document.getElementById('user-email').textContent = 'Conectado';
  }

  // Cards devidos
  const statsText = document.getElementById('stats-text');
  try {
    const due = await lfDb.getCardsDue(1000, false);
    if (due && due.length > 0) {
      statsText.innerHTML = `Você tem <strong style="color:var(--color-secondary);">${due.length}</strong> ${due.length === 1 ? 'frase pendente' : 'frases pendentes'}.<br>Abra o Dashboard para estudar!`;
    } else {
      statsText.innerHTML = 'Você não tem cartas atrasadas!<br>Continue assistindo vídeos e salvando frases.';
    }
  } catch (e) {
    console.warn('[Popup] Erro ao ler cards devidos:', e);
    statsText.textContent = 'Pronto para evoluir?';
  }
}

async function init() {
  let isLogged = false;
  try {
    isLogged = await lfDb.checkSession();
  } catch (e) {
    console.warn('[Popup] Erro ao checar sessão:', e);
  }
  if (isLogged) renderLoggedIn();
  else show(areaLogin);
}

// ── Login ────────────────────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');

  errorEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Entrando…';

  try {
    const res = await lfDb.login(email, password);
    if (res && res.ok) {
      renderLoggedIn();
    } else {
      errorEl.textContent = res?.error || 'E-mail ou senha incorretos.';
    }
  } catch (err) {
    errorEl.textContent = err?.message || 'Erro ao conectar. Tente de novo.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});

// Criar conta acontece no site (fluxo completo com confirmação)
document.getElementById('btn-signup-link').addEventListener('click', () => {
  chrome.tabs.create({ url: SITE_URL });
});

// ── Logado ───────────────────────────────────────────────────────────────────
document.getElementById('btn-dash').addEventListener('click', () => {
  chrome.tabs.create({ url: SITE_URL });
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  try { await lfDb.logout(); } catch { /* limpa mesmo assim */ }
  show(areaLogin);
});

init();
