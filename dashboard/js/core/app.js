import { renderHome } from '../ui/homeView.js';
import { renderLibrary } from '../ui/libraryView.js';
import { renderStudy } from '../ui/studyView.js';
import { renderSettings } from '../ui/settingsView.js';
import { renderLeagues } from '../ui/leaguesView.js';
import { renderStories } from '../ui/storiesView.js';
import { renderReader } from '../ui/readerView.js';
import { renderGame } from '../ui/gameView.js';
import { renderLogin } from '../ui/loginView.js';
import { renderStats } from '../ui/statsView.js';
import { db } from '../../../utils/db.js';

// Register Service Worker for PWA (if not running as a Chrome Extension)
if ('serviceWorker' in navigator && (!window.chrome || !window.chrome.runtime || !window.chrome.runtime.id)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('[SW] Registrado com sucesso:', reg.scope))
      .catch(err => console.error('[SW] Falha no registro:', err));
  });
}

class App {
  constructor() {
    this.root = document.getElementById('app-root');
    this.navBtns = document.querySelectorAll('.nav-btn');
    this.currentRoute = 'home';
    this.viewContainers = {}; // Armazena as telas já carregadas (DOM Caching)
    this.db = db; // Expomos o db unificado (Supabase) para todas as views
    this._reportedErrors = new Set();
    
    this.themeToggleBtn = document.getElementById('theme-toggle-btn');
    
    this.init();
  }

  reportUnexpectedError(source, error) {
    const name = error?.name || 'Error';
    const key = `${source}:${name}:${this.currentRoute}`;
    if (this._reportedErrors.has(key)) return;
    this._reportedErrors.add(key);
    this.db.reportClientError(source, name, this.currentRoute);
  }

  async init() {
    window.addEventListener('error', event => this.reportUnexpectedError('window.error', event.error));
    window.addEventListener('unhandledrejection', event => this.reportUnexpectedError('window.rejection', event.reason));
    // Falha de LEITURA não pode virar "lista vazia" silenciosa (auditoria):
    // avisa o usuário uma vez a cada 30s, sem spam.
    window.addEventListener('lf_read_error', () => {
      const now = Date.now();
      if (this._lastReadErrorToast && now - this._lastReadErrorToast < 30000) return;
      this._lastReadErrorToast = now;
      this.showToast?.('⚠️ Falha de conexão ao carregar dados — a tela pode estar incompleta.', 'error');
    });
    // Setup Navigation Listeners
    this.navBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const route = e.target.dataset.route;
        if(route) this.navigate(route);
      });
    });

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }

    // --- Theme Logic ---
    const savedTheme = localStorage.getItem('lf_theme') || 'light';
    this.setTheme(savedTheme);

    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        this.setTheme(currentTheme === 'light' ? 'dark' : 'light');
      });
    }

    // Check auth
    let isAuthenticated = false;
    try {
      isAuthenticated = await db.checkSession();
    } catch (err) {
      console.warn('[App] Erro ao verificar sessão, assumindo deslogado:', err);
    }

    // Auto-logout no caso do token expirar (401)
    window.addEventListener('lf_auth_expired', () => {
      this.navigate('login');
    });

    if (!isAuthenticated) {
      this.navigate('login');
    } else {
      // Update global stats
      this.updateGlobalStats().catch(e => console.warn('[App] Erro ao atualizar stats:', e));
      // Garante perfil de usuário no Supabase (XP/gamificação)
      db.ensureUserStats().catch(() => {});
      // Load initial route
      this.navigate('home');
      // Escuta mensagens do service worker (palavra salva no player)
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((msg) => {
          if (msg.type === 'AUTH_EXPIRED') {
            this.navigate('login');
          } else if (msg.type === 'REFRESH_DASHBOARD' || msg.type === 'WORD_SAVED') {
            this.updateGlobalStats().catch(() => {});
            // Se a view ativa for home ou library, força re-render
            if (this.currentRoute === 'home' || this.currentRoute === 'library') {
              const container = this.viewContainers[this.currentRoute];
              if (container) this.renderRouteView(this.currentRoute, container);
            }
          }
        });
      }
    }
  }

  async updateGlobalStats() {
    const stats = await db.getUserStats();
    if (stats) {
       const streakEl = document.getElementById('streak-val');
       if (streakEl) streakEl.textContent = stats.streak;
    }
    
    // Also update due count
    const dueCards = await db.getCardsDue(50, false);
    const dueEl = document.getElementById('due-val');
    if (dueEl) dueEl.textContent = dueCards.length;
  }

  navigate(route, params = {}) {
    // Onda 9 (auditoria de bugs): views que abrem recursos (ex.: AudioContext
    // do Jogo) só liberavam no "fim de partida" normal — trocar de aba pela
    // nav bar no meio de uma partida deixava o recurso vazando pra sempre.
    // Views podem registrar limpeza via app.onLeaveView(fn); rodamos ANTES
    // de trocar de rota, e ela só dispara uma vez.
    if (this._viewCleanup) {
      try { this._viewCleanup(); } catch (e) { console.warn('[App] Erro na limpeza da view anterior:', e); }
      this._viewCleanup = null;
    }
    this.currentRoute = route;
    this.routeParams = params || {};

    // Update active state on buttons
    this.navBtns.forEach(btn => {
      if(btn.dataset.route === route) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Ocultar todas as telas (views) carregadas
    for (let key in this.viewContainers) {
      this.viewContainers[key].style.display = 'none';
    }

    // Verifica se a tela (view) já existe no cache
    let isFirstLoad = false;
    let targetContainer = this.viewContainers[route];

    if (!targetContainer) {
      // Primeira vez abrindo esta tela: cria um container vazio e mostra o loading
      isFirstLoad = true;
      targetContainer = document.createElement('div');
      targetContainer.style.width = '100%';
      targetContainer.style.height = '100%';
      targetContainer.style.display = 'block';
      
      targetContainer.innerHTML = `
        <div style="display:flex;height:100%;width:100%;justify-content:center;align-items:center;flex-direction:column;color:var(--color-text-light);">
          <div style="width:40px;height:40px;border:4px solid var(--color-border);border-top-color:var(--color-primary);border-radius:50%;animation:lf-spin 1s linear infinite;"></div>
          <style>@keyframes lf-spin { to { transform: rotate(360deg); } }</style>
        </div>
      `;
      
      this.root.appendChild(targetContainer);
      this.viewContainers[route] = targetContainer;
    } else {
      // Tela já existe no cache: mostra instantaneamente com os dados antigos
      targetContainer.style.display = 'block';
    }

    // Chama o render para desenhar (se for a primeira vez) ou atualizar "por baixo dos panos"
    this.renderRouteView(route, targetContainer, this.routeParams);
  }

  // Views com recursos que precisam ser liberados ao sair (ex.: AudioContext
  // do Jogo) registram uma função aqui; navigate() a chama automaticamente
  // antes de trocar de rota. Só uma pendente por vez (a view atual).
  onLeaveView(fn) {
    this._viewCleanup = typeof fn === 'function' ? fn : null;
  }

  renderRouteView(route, container, params = {}) {
    switch(route) {
      case 'login':
        renderLogin(container, this);
        break;
      case 'home':
        renderHome(container, this);
        break;
      case 'library':
        renderLibrary(container, this);
        break;
      case 'study':
        renderStudy(container, this, params);
        break;
      case 'settings':
        renderSettings(container, this);
        break;
      case 'leagues':
        renderLeagues(container, this);
        break;
      case 'game':
        renderGame(container, this);
        break;
      case 'stories':
        renderStories(container, this);
        break;
      case 'reader':
        renderReader(container, this);
        break;
      case 'stats':
        renderStats(container, this);
        break;
      default:
        renderHome(container, this);
    }
  }

  async logout() {
    await db.logout();
    this.navigate('login');
  }

  setTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (this.themeToggleBtn) this.themeToggleBtn.textContent = '☀️';
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (this.themeToggleBtn) this.themeToggleBtn.textContent = '🌙';
    }
    localStorage.setItem('lf_theme', theme);
  }

  // Global Toast function
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // basic styling for now
    toast.style.backgroundColor = type === 'error' ? '#ff4b4b' : '#333';
    toast.style.color = '#fff';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.fontWeight = '700';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Bootstrap app (module scripts are deferred, DOM is ready)
window.app = new App();
