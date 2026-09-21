// popup/popup.js — login próprio da extensão (sessão independente do site).
// A sessão vive em chrome.storage.local com refresh token: uma vez logado,
// renova sozinha pra sempre. O Dashboard completo mora no site.
import { db as lfDb } from '../utils/db.js';

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
  if (new URLSearchParams(window.location.search).get('login') === '1') {
    statsText.innerHTML = `
      <div style="margin: 8px 0 16px;">
        <span style="display:inline-block; background:rgba(88, 204, 2, 0.15); color:var(--color-primary-shadow); font-size:24px; width:48px; height:48px; line-height:48px; border-radius:50%; margin-bottom:8px;">✓</span>
        <h2 style="font-size: 18px; color: var(--color-text); margin-bottom: 4px;">Login realizado!</h2>
        <p style="font-size: 14px; color: var(--color-text-light); line-height: 1.5;">Você entrou na extensão. A explicação do professor continuará no vídeo.</p>
      </div>
      <button type="button" id="btn-return-video" class="btn btn-primary" style="margin-bottom: 12px;">Voltar ao vídeo</button>
    `;
    statsText.setAttribute('role', 'status');
    const returnBtn = document.getElementById('btn-return-video');
    if (returnBtn) {
      returnBtn.addEventListener('click', () => {
        window.close();
      });
    }
    return;
  }
  // Configurações de idioma e métricas multimodais
  const langFlags = {
    en: '🇺🇸 Inglês',
    es: '🇪🇸 Espanhol',
    fr: '🇫🇷 Francês',
    de: '🇩🇪 Alemão',
    it: '🇮🇹 Italiano',
    ja: '🇯🇵 Japonês',
    pt: '🇧🇷 Português',
  };

  try {
    const sourceLang = (await lfDb.getSetting?.('sourceLang')) || 'en';
    const langBadge = document.getElementById('study-lang-badge');
    if (langBadge) {
      langBadge.textContent = langFlags[sourceLang.toLowerCase()] || `🌐 ${sourceLang.toUpperCase()}`;
    }

    const [studyStats, userStats, dueCount] = await Promise.all([
      lfDb.getStudyStats?.(sourceLang).catch(() => null),
      lfDb.getUserStats?.().catch(() => null),
      typeof lfDb.getCardsDueCount === 'function'
        ? lfDb.getCardsDueCount(0).catch(() => 0)
        : (lfDb.getCardsDue?.(1000, false).then(cards => cards?.length || 0).catch(() => 0)),
    ]);

    // Listening Hoje e Total
    const listeningTodayEl = document.getElementById('listening-today');
    const listeningTotalEl = document.getElementById('listening-total');
    if (listeningTodayEl && studyStats?.listening) {
      listeningTodayEl.textContent = studyStats.listening.todayFormatted || '0m';
    }
    if (listeningTotalEl && studyStats?.listening) {
      const totalHours = studyStats.listening.totalHours || 0;
      listeningTotalEl.textContent = totalHours >= 1 ? `${totalHours}h` : (studyStats.listening.totalFormatted || '0m');
    }

    // Streak
    const streakCountEl = document.getElementById('streak-count');
    if (streakCountEl) {
      streakCountEl.textContent = userStats?.streak ?? 0;
    }

    // Cards Devidos
    const dueCardsCountEl = document.getElementById('due-cards-count');
    const dueCardsTextEl = document.getElementById('due-cards-text');
    if (dueCardsCountEl) dueCardsCountEl.textContent = dueCount;
    if (dueCardsTextEl) {
      if (dueCount > 0) {
        dueCardsTextEl.innerHTML = `Você tem <strong id="due-cards-count" style="color:var(--color-secondary);">${dueCount}</strong> ${dueCount === 1 ? 'frase para revisar' : 'frases para revisar'}`;
      } else {
        dueCardsTextEl.innerHTML = `Nenhuma frase atrasada! Continue imergindo.`;
      }
    }
  } catch (e) {
    console.warn('[Popup] Erro ao carregar métricas de estudo:', e);
  }
}

async function init() {
  const isTabMode = new URLSearchParams(window.location.search).get('login') === '1' || window.innerWidth > 450;
  if (isTabMode && typeof document !== 'undefined' && document.body) {
    document.body.classList.add('is-tab-mode');
  }

  if (new URLSearchParams(window.location.search).get('login') === '1') {
    show(areaLogin);
    document.getElementById('login-email').focus();
    return;
  }
  try {
    // O popup deve pintar no primeiro frame. A sessão local decide a tela;
    // refresh/validação remota acontece depois sem segurar a interface.
    const session = await lfDb._readSession();
    if (session?.access_token) {
      renderLoggedIn();
      lfDb.checkSession().then((valid) => { if (!valid) show(areaLogin); }).catch(() => {});
      return;
    }
  } catch (e) {
    console.warn('[Popup] Erro ao ler sessão local:', e);
  }
  show(areaLogin);
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

async function openDashboard() {
  try {
    const result = await chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
    if (!result?.ok) throw new Error(result?.error || 'Não foi possível abrir o LinguaFlow.');
    window.close();
  } catch (error) {
    console.warn('[Popup] Falha ao abrir o site:', error);
  }
}

// Criar conta acontece no site (fluxo completo com confirmação), reutilizando
// a mesma guia do LinguaFlow quando ela já estiver aberta.
document.getElementById('btn-signup-link').addEventListener('click', openDashboard);

// ── Logado ───────────────────────────────────────────────────────────────────
document.getElementById('btn-dash').addEventListener('click', openDashboard);

document.getElementById('btn-logout').addEventListener('click', async () => {
  try { await lfDb.logout(); } catch { /* limpa mesmo assim */ }
  show(areaLogin);
});

init();
