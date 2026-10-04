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

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Palavras salvas ficam numa fila local até o banco confirmar. O popup mostra
// o que ainda não sincronizou e o que o servidor recusou (não repete sozinho).
async function renderWordSaveQueue(type = 'GET_WORD_SAVE_QUEUE') {
  let summary = null;
  try { summary = await chrome.runtime.sendMessage({ type }); } catch { /* SW reiniciando */ }
  if (!summary?.ok) return summary;

  const loginPending = document.getElementById('login-pending');
  const total = summary.pending + summary.failed.length;
  loginPending.classList.toggle('hidden', total === 0);
  loginPending.textContent = total
    ? `${plural(total, 'palavra salva vai', 'palavras salvas vão')} sincronizar quando você entrar.`
    : '';

  const box = document.getElementById('sync-box');
  const list = document.getElementById('sync-failed-list');
  const actions = document.getElementById('sync-actions');
  const failed = summary.failed.length;
  box.classList.toggle('hidden', total === 0);
  box.classList.toggle('has-failed', failed > 0);
  actions.classList.toggle('hidden', failed === 0);
  list.replaceChildren(...summary.failed.slice(0, 5).map((item) => {
    const li = document.createElement('li');
    li.textContent = item.word;
    return li;
  }));
  const parts = [];
  if (failed) parts.push(`${plural(failed, 'palavra não pôde ser salva', 'palavras não puderam ser salvas')}.`);
  if (summary.pending) parts.push(`${plural(summary.pending, 'palavra aguardando', 'palavras aguardando')} sincronização.`);
  document.getElementById('sync-text').textContent = parts.join(' ');
  return summary;
}

async function runQueueAction(type, button) {
  const retry = document.getElementById('btn-sync-retry');
  const discard = document.getElementById('btn-sync-discard');
  const label = button.textContent;
  retry.disabled = true;
  discard.disabled = true;
  button.textContent = type === 'RETRY_FAILED_WORD_SAVES' ? 'Tentando…' : 'Descartando…';
  const result = await renderWordSaveQueue(type);
  if (!result?.ok) document.getElementById('sync-text').textContent = 'Não foi possível atualizar a fila. Tente de novo.';
  retry.disabled = false;
  discard.disabled = false;
  button.textContent = label;
}

document.getElementById('btn-sync-retry').addEventListener('click', (event) => {
  runQueueAction('RETRY_FAILED_WORD_SAVES', event.currentTarget);
});
document.getElementById('btn-sync-discard').addEventListener('click', (event) => {
  // Descartar apaga a palavra da fila local de vez: pede confirmação.
  if (!confirm('Descartar as palavras que não puderam ser salvas? Elas não vão para o seu Cofre.')) return;
  runQueueAction('DISCARD_FAILED_WORD_SAVES', event.currentTarget);
});

async function renderLoggedIn() {
  show(areaLogged);
  renderWordSaveQueue();

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
    statsText.classList.remove('hidden');
    statsText.innerHTML = `
      <div style="margin: 8px 0 16px;">
        <span style="display:block; color:var(--color-primary-dark); font-size:12px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; margin-bottom:8px;">Tudo pronto</span>
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
    en: 'Inglês',
    es: 'Espanhol',
    fr: 'Francês',
    de: 'Alemão',
    it: 'Italiano',
    ja: 'Japonês',
    pt: 'Português',
  };

  try {
    const sourceLang = (await lfDb.getSetting?.('sourceLang')) || 'en';
    const langBadge = document.getElementById('study-lang-badge');
    if (langBadge) {
      langBadge.textContent = langFlags[sourceLang.toLowerCase()] || sourceLang.toUpperCase();
    }

    const [reviewLogToday, wordsToday, userStats, dueCount] = await Promise.all([
      lfDb.getReviewLog?.(1).catch(() => null),
      lfDb.getWordsSavedToday?.().catch(() => null),
      lfDb.getUserStats?.().catch(() => null),
      typeof lfDb.getCardsDueCount === 'function'
        ? lfDb.getCardsDueCount(0).catch(() => 0)
        : (lfDb.getCardsDue?.(1000, false).then(cards => cards?.length || 0).catch(() => 0)),
    ]);

    // Resumo do dia: números vivos (revisões e palavras salvas). O antigo "Listening" dependia do contador
    // automático de escuta, removido em #387, e ficava parado para sempre; "—" quando não foi possível ler.
    const reviewsTodayEl = document.getElementById('reviews-today');
    const wordsTodayEl = document.getElementById('words-today');
    if (reviewsTodayEl) reviewsTodayEl.textContent = Array.isArray(reviewLogToday) ? String(reviewLogToday.length) : '—';
    if (wordsTodayEl) wordsTodayEl.textContent = Number.isFinite(wordsToday) ? String(wordsToday) : '—';

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
        dueCardsTextEl.textContent = 'Nenhuma frase para revisar agora.';
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
  renderWordSaveQueue();
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
    const status = document.getElementById('stats-text');
    status.classList.remove('hidden');
    status.textContent = 'Não foi possível abrir o painel. Tente novamente.';
    console.warn('[Popup] Falha ao abrir o site:', error);
  }
}

// Criar conta acontece no site (fluxo completo com confirmação), reutilizando
// a mesma guia do LinguaFlow quando ela já estiver aberta.
document.getElementById('btn-signup-link').addEventListener('click', openDashboard);

// ── Logado ───────────────────────────────────────────────────────────────────
document.getElementById('btn-dash').addEventListener('click', openDashboard);

// Abre as configurações do player na aba ativa (#422). Com o LF desligado o ⚙ some do player.
async function openPlayerSettings() {
  const button = document.getElementById('btn-player-settings');
  const status = document.getElementById('player-settings-status');
  button.disabled = true;
  status.classList.add('hidden');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('no_tab');
    const reply = await chrome.tabs.sendMessage(tab.id, { action: 'LF_TOGGLE_SETTINGS' });
    if (!reply?.ok) throw new Error('no_player');
    window.close();
  } catch {
    status.textContent = 'Abra um vídeo no YouTube, HBO Max, Netflix, Disney+ ou Prime Video e tente de novo.';
    status.classList.remove('hidden');
  } finally {
    button.disabled = false;
  }
}
document.getElementById('btn-player-settings').addEventListener('click', openPlayerSettings);

document.getElementById('btn-logout').addEventListener('click', async () => {
  try { await lfDb.logout(); } catch { /* limpa mesmo assim */ }
  show(areaLogin);
});

init();
