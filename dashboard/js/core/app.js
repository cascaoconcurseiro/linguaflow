import { renderHome } from '../ui/homeView.js';
import { renderLibrary } from '../ui/libraryView.js';
import { renderStudy } from '../ui/studyView.js';
import { renderSettings } from '../ui/settingsView.js';
import { renderLeagues } from '../ui/leaguesView.js';
import { renderGame } from '../ui/gameView.js';
import { renderLogin } from '../ui/loginView.js';
import { db } from '../../utils/db.js';

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
    
    this.init();
  }

  async init() {
    // Setup Navigation Listeners
    this.navBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const route = e.target.dataset.route;
        this.navigate(route);
      });
    });

    // Check auth
    let isAuthenticated = false;
    try {
      isAuthenticated = await db.checkSession();
    } catch (err) {
      console.warn('[App] Erro ao verificar sessão, assumindo deslogado:', err);
    }

    if (!isAuthenticated) {
      this.navigate('login');
    } else {
      // Update global stats
      this.updateGlobalStats().catch(e => console.warn('[App] Erro ao atualizar stats:', e));
      // Load initial route
      this.navigate('home');
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

  navigate(route) {
    this.currentRoute = route;
    
    // Update active state on buttons
    this.navBtns.forEach(btn => {
      if(btn.dataset.route === route) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Clear root
    this.root.innerHTML = '';

    // Render corresponding view
    switch(route) {
      case 'login':
        renderLogin(this.root, this);
        break;
      case 'home':
        renderHome(this.root, this);
        break;
      case 'library':
        renderLibrary(this.root, this);
        break;
      case 'study':
        renderStudy(this.root, this);
        break;
      case 'settings':
        renderSettings(this.root, this);
        break;
      case 'leagues':
        renderLeagues(this.root, this);
        break;
      case 'game':
        renderGame(this.root, this);
        break;
      default:
        renderHome(this.root, this);
    }
  }

  async logout() {
    await db.logout();
    this.navigate('login');
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
