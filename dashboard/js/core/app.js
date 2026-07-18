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
import { renderLearn } from '../ui/learnView.js';
import { renderProgress } from '../ui/progressView.js';
import { bindViewStateAction, renderViewState } from '../ui/viewState.js';
import { db } from '../../../utils/db.js';

const CLIENT_BUILD = '3.0.21';

// Uma versão antiga do PWA podia misturar HTML/app novo com db.js antigo.
// Antes de inicializar qualquer tela, elimina esse estado e recarrega uma vez.
if (db.reviewWriteMode !== 'rpc-atomic-v1' && 'caches' in window) {
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name.startsWith('linguaflow-')).map((name) => caches.delete(name)));
  window.location.replace(`${window.location.pathname}?lf_build=${CLIENT_BUILD}${window.location.hash}`);
  await new Promise(() => {});
}

// Register Service Worker for PWA (if not running as a Chrome Extension)
if ('serviceWorker' in navigator && (!window.chrome || !window.chrome.runtime || !window.chrome.runtime.id)) {
  let refreshingForWorker = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshingForWorker || !navigator.serviceWorker.controller) return;
    refreshingForWorker = true;
    window.location.reload();
  });
  // Pedido do dono (18/07): todos na MESMA versão. Quando um service worker
  // novo termina de instalar, um banner oferece "Atualizar" — o clique manda
  // SKIP_WAITING pro worker e o controllerchange acima recarrega a página.
  const promptUpdate = (worker) => {
    if (!worker || document.getElementById('lf-update-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'lf-update-banner';
    banner.setAttribute('role', 'status');
    banner.style.cssText = 'position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:100000;display:flex;gap:12px;align-items:center;padding:12px 16px;border-radius:14px;background:var(--color-surface,#fff);border:2px solid var(--color-primary,#58cc02);box-shadow:0 8px 30px rgba(0,0,0,.25);font:700 14px var(--font-main,sans-serif);color:var(--color-text,#333);max-width:92vw;';
    banner.innerHTML = `
      <span>✨ Nova versão do LinguaFlow disponível</span>
      <button type="button" id="lf-update-now" style="min-height:44px;padding:8px 18px;border:0;border-radius:10px;background:var(--color-primary,#58cc02);color:#fff;font:800 14px inherit;cursor:pointer;">Atualizar</button>
      <button type="button" id="lf-update-later" aria-label="Depois" style="min-width:44px;min-height:44px;border:0;background:none;color:var(--color-text-light,#777);font-size:18px;cursor:pointer;">✕</button>`;
    document.body.appendChild(banner);
    document.getElementById('lf-update-now').addEventListener('click', () => {
      document.getElementById('lf-update-now').textContent = 'Atualizando…';
      worker.postMessage('SKIP_WAITING');
    });
    document.getElementById('lf-update-later').addEventListener('click', () => banner.remove());
  };

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`sw.js?v=${CLIENT_BUILD}`, { updateViaCache: 'none' })
      .then(reg => {
        reg.update().catch(() => {});
        console.log('[SW] Registrado com sucesso:', reg.scope);
        // Worker novo já esperando (aba ficou aberta durante um deploy)
        if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const incoming = reg.installing;
          incoming?.addEventListener('statechange', () => {
            if (incoming.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(incoming);
          });
        });
        // Checagem periódica: pega o deploy mesmo com a aba aberta há horas
        setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      })
      .catch(err => console.error('[SW] Falha no registro:', err));
  });
}

class App {
  constructor() {
    this.root = document.getElementById('app-root');
    this.navBtns = document.querySelectorAll('.nav-btn');
    this.mobileNavBtns = document.querySelectorAll('.mobile-nav-btn[data-route], .mobile-more-menu [data-route]');
    this.profileMenuToggle = document.getElementById('profile-menu-toggle');
    this.profileMenu = document.getElementById('profile-menu');
    this.currentRoute = 'home';
    this.viewContainers = {}; // Armazena as telas já carregadas (DOM Caching)
    // Cada navegação e cada tentativa de render recebem uma época monotônica.
    // Views atuais não precisam conhecer o contrato: elas recebem proxies que
    // deixam de aceitar commits/efeitos assim que outra renderização assume.
    this.navigationEpoch = 0;
    this.renderEpoch = 0;
    this.activeRender = null;
    this.authResolved = false;
    this.isAuthenticated = false;
    this.db = db; // Expomos o db unificado (Supabase) para todas as views
    this._reportedErrors = new Set();
    
    this.themeToggleBtn = document.getElementById('theme-toggle-btn');
    this.focusHeader = document.getElementById('study-focus-header');
    this.focusMenu = document.getElementById('study-focus-menu');
    this.focusMenuToggle = document.getElementById('study-focus-menu-toggle');
    
    document.body.classList.add('lf-auth-pending');
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
        const route = e.currentTarget.dataset.route;
        if(route) this.navigate(route);
      });
    });
    this.mobileNavBtns.forEach(btn => btn.addEventListener('click', (event) => {
      const route = event.currentTarget.dataset.route;
      if (route) this.navigate(route);
    }));
    this.profileMenuToggle?.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = this.profileMenu?.hidden !== false;
      this.setProfileMenuOpen(open);
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.profile-menu-wrap')) this.setProfileMenuOpen(false);
    });
    this.profileMenu?.addEventListener('click', event => {
      const route = event.target.closest('[data-route]')?.dataset.route;
      if (route) {
        this.setProfileMenuOpen(false);
        this.navigate(route);
      }
    });
    this.profileMenu?.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        this.setProfileMenuOpen(false, true);
      }
    });
    this.setupFocusShell();
    // BFCache/restauração de aba pode preservar classes do <body>. Antes de
    // qualquer await de autenticação, normalize o shell para a rota inicial.
    this.syncShellForRoute(this.currentRoute);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }

    // --- Theme Logic ---
    const savedTheme = localStorage.getItem('lf_theme') || 'light';
    this.setTheme(savedTheme);

    // Botões diretos da topbar (queixa 17/07: tema/config escondidos no "◉")
    document.getElementById('topbar-theme-btn')?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      this.setTheme(current === 'light' ? 'dark' : 'light');
    });
    document.getElementById('topbar-settings-btn')?.addEventListener('click', () => this.navigate('settings'));
    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        this.setTheme(currentTheme === 'light' ? 'dark' : 'light');
        this.setProfileMenuOpen(false);
      });
    }

    // Check auth
    let isAuthenticated = false;
    try {
      isAuthenticated = await db.checkSession();
    } catch (err) {
      console.warn('[App] Erro ao verificar sessão, assumindo deslogado:', err);
    }
    this.authResolved = true;
    this.isAuthenticated = isAuthenticated;

    // Auto-logout no caso do token expirar (401)
    window.addEventListener('lf_auth_expired', () => {
      this.setAuthenticated(false);
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
            this.setAuthenticated(false);
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

    // Só revele o shell depois que navigate() instalou a primeira tela.
    // A classe também nasce no HTML, evitando o flash anterior ao carregamento
    // deste módulo em conexões ou computadores mais lentos.
    requestAnimationFrame(() => {
      document.body.classList.remove('lf-auth-pending');
    });
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
    this.updateFocusStatus(dueCards.length);
  }

  setupFocusShell() {
    document.getElementById('study-focus-exit')?.addEventListener('click', () => {
      this.navigate('home');
    });
    this.focusMenuToggle?.addEventListener('click', (event) => {
      event.stopPropagation();
      const willOpen = this.focusMenu?.hidden !== false;
      this.setFocusMenuOpen(willOpen);
    });
    this.focusMenu?.addEventListener('click', (event) => {
      const route = event.target.closest('[data-focus-route]')?.dataset.focusRoute;
      if (!route) return;
      this.setFocusMenuOpen(false);
      this.navigate(route);
    });
    document.addEventListener('click', (event) => {
      if (!this.focusMenu?.hidden && !event.target.closest('.study-focus-menu-wrap')) {
        this.setFocusMenuOpen(false);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.focusMenu?.hidden) {
        this.setFocusMenuOpen(false, true);
      }
    });
  }

  setFocusMenuOpen(open, restoreFocus = false) {
    if (!this.focusMenu || !this.focusMenuToggle) return;
    this.focusMenu.hidden = !open;
    this.focusMenuToggle.setAttribute('aria-expanded', String(open));
    if (open) this.focusMenu.querySelector('[role="menuitem"]')?.focus();
    else if (restoreFocus) this.focusMenuToggle.focus();
  }

  setProfileMenuOpen(open, restoreFocus = false) {
    if (!this.profileMenu || !this.profileMenuToggle) return;
    this.profileMenu.hidden = !open;
    this.profileMenuToggle.setAttribute('aria-expanded', String(open));
    if (open) this.profileMenu.querySelector('[role="menuitem"]')?.focus();
    else if (restoreFocus) this.profileMenuToggle.focus();
  }

  updateFocusStatus(progress = null) {
    const status = document.getElementById('study-focus-status');
    const track = document.getElementById('study-focus-track');
    if (!status || !track) return;

    if (progress && typeof progress === 'object') {
      this._focusProgressBound = true;
      const total = Math.max(0, Number(progress.total) || 0);
      const remaining = Math.max(0, Number(progress.remaining) || 0);
      const completed = Math.max(0, Number.isFinite(Number(progress.completed))
        ? Number(progress.completed)
        : total - remaining);
      const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
      status.textContent = total > 0
        ? `${Math.min(completed, total)} de ${total} concluídos`
        : 'Um card por vez';
      track.style.setProperty('--study-progress', `${percent}%`);
      track.setAttribute('aria-valuenow', String(percent));
      track.setAttribute('aria-valuetext', total > 0
        ? `${Math.min(completed, total)} de ${total} cards concluídos; ${remaining} restantes`
        : 'Sessão iniciada');
      return;
    }

    // Uma atualização global de pendências não deve sobrescrever o progresso
    // fino que a view de estudo já passou a publicar card a card.
    if (this.currentRoute === 'study' && this._focusProgressBound) return;
    const count = Number.isFinite(Number(progress)) ? Number(progress) : 0;
    status.textContent = count > 0
      ? `${count} ${count === 1 ? 'revisão pendente' : 'revisões pendentes'}`
      : 'Um card por vez';
    track.style.setProperty('--study-progress', '0%');
    track.setAttribute('aria-valuenow', '0');
    track.setAttribute('aria-valuetext', count > 0 ? `${count} revisões pendentes` : 'Sessão iniciada');
  }

  syncShellForRoute(route) {
    const focus = route === 'study';
    document.body.classList.toggle('lf-auth-route', route === 'login');
    document.body.classList.toggle('lf-focus-mode', focus);
    if (this.focusHeader) this.focusHeader.hidden = !focus;
    if (!focus) this.setFocusMenuOpen(false);
    this.setProfileMenuOpen(false);
    if (focus) {
      this._focusProgressBound = false;
      const due = Number(document.getElementById('due-val')?.textContent);
      this.updateFocusStatus(Number.isFinite(due) ? due : null);
    } else {
      this._focusProgressBound = false;
    }
    // Cada experiência começa no topo do seu próprio scroll. Isso também
    // impede que a posição longa da sessão contamine Home/Config ao sair.
    if (this.root) this.root.scrollTop = 0;
  }

  navigate(route, params = {}) {
    // Toda rota de produto exige uma sessão confirmada. Esta guarda central
    // evita que atalhos, navegação móvel ou eventos tardios abram views
    // autenticadas depois de logout/expiração.
    if (this.authResolved && !this.isAuthenticated && route !== 'login') {
      route = 'login';
      params = {};
    }
    // Onda 9 (auditoria de bugs): views que abrem recursos (ex.: AudioContext
    // do Jogo) só liberavam no "fim de partida" normal — trocar de aba pela
    // nav bar no meio de uma partida deixava o recurso vazando pra sempre.
    // Views podem registrar limpeza via app.onLeaveView(fn); rodamos ANTES
    // de trocar de rota, e ela só dispara uma vez.
    if (this._viewCleanup) {
      try { this._viewCleanup(); } catch (e) { console.warn('[App] Erro na limpeza da view anterior:', e); }
      this._viewCleanup = null;
    }
    this.navigationEpoch += 1;
    this.currentRoute = route;
    this.routeParams = params || {};
    this.syncShellForRoute(route);

    // Update active state on buttons
    const learnRoutes = new Set(['learn', 'stories', 'reader', 'game']);
    const progressRoutes = new Set(['progress', 'stats', 'leagues']);
    this.navBtns.forEach(btn => {
      const active = btn.dataset.route === route
        || (btn.dataset.navGroup === 'learn' && learnRoutes.has(route))
        || (btn.dataset.navGroup === 'progress' && progressRoutes.has(route));
      btn.classList.toggle('active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    this.mobileNavBtns.forEach(btn => {
      const active = btn.dataset.route === route
        || (btn.dataset.navGroup === 'learn' && learnRoutes.has(route))
        || (btn.dataset.navGroup === 'progress' && progressRoutes.has(route));
      btn.classList.toggle('active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
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
    const renderers = {
      login: renderLogin,
      home: renderHome,
      library: renderLibrary,
      study: renderStudy,
      settings: renderSettings,
      leagues: renderLeagues,
      game: renderGame,
      stories: renderStories,
      reader: renderReader,
      stats: renderStats,
      learn: renderLearn,
      progress: renderProgress,
    };
    const renderer = renderers[route] || renderHome;
    this.activeRender?.controller.abort('render-superseded');
    const controller = new AbortController();
    const context = Object.freeze({
      navigationEpoch: this.navigationEpoch,
      renderEpoch: ++this.renderEpoch,
      route,
      container,
      controller,
      signal: controller.signal,
    });
    this.activeRender = context;

    const guardedContainer = this.createGuardedContainer(container, context);
    const guardedApp = this.createGuardedApp(context);
    try {
      const result = route === 'study'
        ? renderer(guardedContainer, guardedApp, params)
        : renderer(guardedContainer, guardedApp);
      // Várias views são async, mas historicamente renderRouteView não as
      // aguardava. Mantemos isso e absorvemos rejeições obsoletas; uma falha da
      // view atual continua visível no console e na telemetria do cliente.
      Promise.resolve(result).catch((error) => {
        if (!this.isRenderCurrent(context)) return;
        console.error(`[App] Falha ao renderizar ${route}:`, error);
        this.reportUnexpectedError(`render.${route}`, error);
        this.renderRouteFailure(context);
      });
    } catch (error) {
      if (!this.isRenderCurrent(context)) return;
      console.error(`[App] Falha ao renderizar ${route}:`, error);
      this.reportUnexpectedError(`render.${route}`, error);
      this.renderRouteFailure(context);
    }
  }

  renderRouteFailure(context) {
    if (!this.isRenderCurrent(context)) return;
    context.container.removeAttribute('aria-busy');
    context.container.innerHTML = renderViewState({
      kind: 'error',
      title: 'Não foi possível abrir esta tela',
      message: 'Seus dados continuam seguros. Verifique a conexão e tente novamente.',
      actionLabel: 'Tentar novamente',
      actionId: 'btn-route-retry',
    });
    bindViewStateAction(context.container, 'btn-route-retry', () => {
      if (this.isRenderCurrent(context)) {
        this.renderRouteView(context.route, context.container, this.routeParams || {});
      }
    });
  }

  isRenderCurrent(context) {
    return !!context
      && this.activeRender === context
      && this.navigationEpoch === context.navigationEpoch
      && this.currentRoute === context.route
      && this.viewContainers[context.route] === context.container;
  }

  createGuardedContainer(container, context) {
    const app = this;
    const rejectStaleCommit = () => {
      throw new DOMException('Renderização substituída por uma mais recente.', 'AbortError');
    };
    const mutationMethods = new Set([
      'append', 'appendChild', 'prepend', 'replaceChildren', 'replaceWith',
      'insertAdjacentElement', 'insertAdjacentHTML', 'insertAdjacentText',
      'setAttribute', 'removeAttribute', 'toggleAttribute',
    ]);

    return new Proxy(container, {
      get(target, property) {
        const value = Reflect.get(target, property, target);
        if (typeof value !== 'function') return value;
        if (mutationMethods.has(property)) {
          return (...args) => {
            if (!app.isRenderCurrent(context)) return rejectStaleCommit();
            return Reflect.apply(value, target, args);
          };
        }
        return value.bind(target);
      },
      set(target, property, value) {
        if (!app.isRenderCurrent(context)) return rejectStaleCommit();
        return Reflect.set(target, property, value, target);
      },
    });
  }

  createGuardedApp(context) {
    const app = this;
    const effectMethods = new Set(['navigate', 'logout', 'showToast', 'onLeaveView', 'updateFocusStatus', 'setAuthenticated']);
    return new Proxy(this, {
      get(target, property) {
        // Contrato opt-in para views novas: permite cancelar fetches/trabalho
        // pesado e conferir validade sem alterar as assinaturas existentes.
        if (property === 'renderSignal') return context.signal;
        if (property === 'isCurrentRender') return () => app.isRenderCurrent(context);
        const value = Reflect.get(target, property, target);
        if (typeof value !== 'function') return value;
        if (effectMethods.has(property)) {
          return (...args) => app.isRenderCurrent(context)
            ? Reflect.apply(value, target, args)
            : undefined;
        }
        return value.bind(target);
      },
    });
  }

  async logout() {
    try {
      await db.logout();
    } finally {
      this.setAuthenticated(false);
      this.navigate('login');
    }
  }

  setAuthenticated(value) {
    this.authResolved = true;
    this.isAuthenticated = value === true;
    document.body.classList.remove('lf-auth-pending');
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
    if (!container) return;
    container.setAttribute('aria-label', 'Notificações');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    toast.setAttribute('aria-atomic', 'true');
    
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
