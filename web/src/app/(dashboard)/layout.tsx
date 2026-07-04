'use client';

import { getStats } from '@/lib/db';
import { createClient } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [totalWords, setTotalWords] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/auth');
        return;
      }
      setUser(data.user);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    getStats().then((s) => {
      setDueCount(s.due_cards || 0);
      setTotalWords(s.total_words || 0);
    });
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  if (!user)
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: '2px solid var(--accent)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
          }}
        />
      </div>
    );

  const tabs = [
    { id: '/', label: 'Início', icon: '🏠' },
    { id: '/study', label: 'Praticar (SRS)', icon: '🧠' },
    { id: '/library', label: 'Biblioteca', icon: '📚' },
    { id: '/chunks', label: 'Chunks', icon: '🧩' },
    { id: '/lab', label: 'Laboratório', icon: '🧪' },
  ];

  const betaTabs = [
    { id: '/moonshot-voice', label: 'Simulador Voice-to-Voice', icon: '🗣️' },
    { id: '/moonshot-feed', label: 'Feed de Leitura (N+1)', icon: '📰' },
  ];

  const bottomTabs = [
    { id: '/catalogue', label: 'Catálogo YouTube', icon: '🎬' },
    { id: '/stats', label: 'Progresso', icon: '📈' },
    { id: '/config', label: 'Configurações', icon: '⚙️' },
  ];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">LF</div>
          <div className="logo-text">
            <h1>LinguaFlow</h1>
            <p>Anki Inteligente</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.id}
              className={`nav-tab ${pathname === tab.id ? 'active' : ''}`}
            >
              <span>{tab.icon}</span> {tab.label}
              {tab.id === '/' && dueCount > 0 && <span className="nav-badge blue">{dueCount}</span>}
            </Link>
          ))}

          <div className="sidebar-section-title">MOONSHOT (BETA)</div>
          {betaTabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.id}
              className={`nav-tab ${pathname === tab.id ? 'active' : ''}`}
            >
              <span>{tab.icon}</span> {tab.label}
            </Link>
          ))}

          {bottomTabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.id}
              className={`nav-tab ${pathname === tab.id ? 'active' : ''}`}
            >
              <span>{tab.icon}</span> {tab.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-section-title">☁️ NUVEM</div>
          <div style={{ fontSize: 11, padding: '4px 10px', color: 'var(--muted)' }}>
            {user.email ? '✅ Conectado' : 'Desconectado'}
          </div>
          <div className="sidebar-section-title">DADOS</div>
          <button className="sidebar-btn" onClick={() => router.push('/library?tab=export')}>
            📤 Exportar
          </button>
          <button className="sidebar-btn" onClick={() => router.push('/library?tab=import')}>
            📥 Importar
          </button>
          <button className="sidebar-btn" onClick={handleLogout}>
            ⏻ Sair
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="header">
          <div className="header-stats">
            <div className="hstat">
              <span className="hstat-val blue">{dueCount}</span>
              <span className="hstat-label">Revisões</span>
            </div>
            <div className="hstat">
              <span className="hstat-val pink">0</span>
              <span className="hstat-label">Ofensiva</span>
            </div>
            <div className="hstat">
              <span className="hstat-val">{totalWords}</span>
              <span className="hstat-label">Palavras</span>
            </div>
            <div className="hstat">
              <span className="hstat-val yellow">A1</span>
              <span className="hstat-label">Nível</span>
            </div>
          </div>
          <div className="header-goal">
            <div className="header-goal-label">
              <span>Meta de Hoje</span>
              <span>0%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '0%' }} />
            </div>
          </div>
          <input type="text" className="header-search" placeholder="🔍 Busca global..." />
        </header>
        {children}
      </main>
      <button
        id="themeToggle"
        onClick={() => {
          const el = document.documentElement;
          const t = el.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
          el.setAttribute('data-theme', t);
          localStorage.setItem('lf-theme', t);
        }}
        title="Alternar tema"
      >
        🌓
      </button>
    </div>
  );
}
