import { db } from '../../../utils/db.js';

export function renderLogin(container, app) {
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; max-width: 400px; margin: 0 auto; width: 100%;">
      
      <div style="text-align: center; margin-bottom: 32px;">
        <img src="../../icon_full.png" alt="LinguaFlow Logo" style="width: 80px; height: 80px; margin: 0 auto 16px auto; display: block; object-fit: contain;" onerror="this.src='../icon_full.png'" />
        <h1 style="color: var(--color-primary); font-size: 28px; margin-bottom: 8px;">LinguaFlow</h1>
        <p style="color: var(--color-text-light); font-size: 16px;">Aprenda idiomas no seu ritmo</p>
      </div>

      <div style="background: var(--color-surface); width: 100%; border: 2px solid var(--color-border); border-radius: var(--radius-md); padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <h2 id="auth-title" style="margin-bottom: 24px; text-align: center; font-size: 20px;">Entrar</h2>
        
        <form id="auth-form" style="display: flex; flex-direction: column; gap: 16px;">
          <div>
            <label style="display: block; font-weight: 700; margin-bottom: 8px; font-size: 14px; color: var(--color-text);">E-mail</label>
            <input type="email" id="auth-email" required placeholder="seu@email.com" style="width: 100%; padding: 12px; border: 2px solid var(--color-border); border-radius: var(--radius-sm); font-size: 16px; font-family: var(--font-main); outline: none;" />
          </div>
          
          <div>
            <label style="display: block; font-weight: 700; margin-bottom: 8px; font-size: 14px; color: var(--color-text);">Senha</label>
            <input type="password" id="auth-password" required placeholder="******" style="width: 100%; padding: 12px; border: 2px solid var(--color-border); border-radius: var(--radius-sm); font-size: 16px; font-family: var(--font-main); outline: none;" />
          </div>
          
          <button type="submit" id="auth-submit-btn" class="btn btn-primary" style="margin-top: 8px; width: 100%;">Entrar</button>
        </form>

        <div style="margin-top: 24px; text-align: center; font-size: 14px; font-weight: 700; color: var(--color-text-light);">
          <span id="auth-toggle-text">Ainda não tem conta?</span>
          <button id="auth-toggle-btn" style="background: none; border: none; color: var(--color-secondary); font-weight: 800; cursor: pointer; font-size: 14px; margin-left: 4px; font-family: var(--font-main);">Criar uma</button>
        </div>
      </div>
    </div>
  `;

  // UI Elements
  const form = document.getElementById('auth-form');
  const emailInput = document.getElementById('auth-email');
  const passInput = document.getElementById('auth-password');
  const submitBtn = document.getElementById('auth-submit-btn');
  const title = document.getElementById('auth-title');
  const toggleText = document.getElementById('auth-toggle-text');
  const toggleBtn = document.getElementById('auth-toggle-btn');
  const topbar = document.querySelector('.topbar');

  // Hide topbar while on login screen
  if (topbar) {
    topbar.style.display = 'none';
  }

  let isLogin = true;

  // Cleanup function to restore topbar if user navigates away (e.g. after successful login)
  const cleanup = () => {
    if (topbar) {
      topbar.style.display = 'flex';
    }
  };

  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isLogin = !isLogin;
    if (isLogin) {
      title.textContent = 'Entrar';
      submitBtn.textContent = 'Entrar';
      toggleText.textContent = 'Ainda não tem conta?';
      toggleBtn.textContent = 'Criar uma';
    } else {
      title.textContent = 'Criar Conta';
      submitBtn.textContent = 'Cadastrar';
      toggleText.textContent = 'Já tem uma conta?';
      toggleBtn.textContent = 'Entrar';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passInput.value.trim();
    
    if (!email || !password) {
      app.showToast('Preencha todos os campos', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    submitBtn.textContent = 'Aguarde...';

    try {
      if (isLogin) {
        const res = await db.login(email, password);
        if (res.ok) {
          app.showToast('Login realizado com sucesso!', 'success');
          cleanup();
          app.navigate('home');
        } else {
          app.showToast(res.error || 'Erro ao fazer login', 'error');
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.textContent = 'Entrar';
        }
      } else {
        const res = await db.signUp(email, password);
        if (res.ok) {
          app.showToast('Conta criada com sucesso!', 'success');
          cleanup();
          // If auto login is enabled in Supabase, we might already have a session.
          // Let's just navigate to home. App will redirect back if no session.
          app.navigate('home');
        } else {
          app.showToast(res.error || 'Erro ao criar conta', 'error');
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.textContent = 'Cadastrar';
        }
      }
    } catch (err) {
      console.error(err);
      app.showToast('Erro inesperado de conexão', 'error');
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.textContent = isLogin ? 'Entrar' : 'Cadastrar';
    }
  });
}
