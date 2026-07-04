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

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-[#080c18]">
      <div className="animate-spin w-8 h-8 border-2 border-[#38bdf8] border-t-transparent rounded-full" />
    </div>
  );

  const tabs = [
    { id: '/', label: 'Início', icon: '🏠' },
    { id: '/study', label: 'Estudar (SRS)', icon: '🧠' },
    { id: '/library', label: 'Biblioteca', icon: '📚' },
    { id: '/decks', label: 'Decks', icon: '🗂️' },
    { id: '/chunks', label: 'Chunks', icon: '🧩' },
    { id: '/lab', label: 'Laboratório', icon: '🧪' },
    { id: '/catalogue', label: 'Catálogo', icon: '🎬' },
    { id: '/stats', label: 'Progresso', icon: '📈' },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-[260px] bg-[rgba(8,12,24,0.95)] border-r border-[rgba(255,255,255,0.07)] p-6 flex flex-col sticky top-0 h-screen z-50 backdrop-blur-xl max-md:hidden">
        <Link href="/" className="flex items-center gap-3 mb-8 px-2">
          <div className="w-[42px] h-[42px] bg-gradient-to-br from-[#38bdf8] to-[#818cf8] rounded-[10px] flex items-center justify-center text-xl font-black text-white shadow-[0_4px_16px_rgba(56,189,248,0.35)]">
            LF
          </div>
          <div>
            <h1 className="text-lg font-extrabold bg-gradient-to-r from-[#38bdf8] to-[#818cf8] bg-clip-text text-transparent">
              LinguaFlow
            </h1>
            <p className="text-[11px] text-[#64748b] font-medium">Anki Inteligente</p>
          </div>
        </Link>

        <nav className="flex flex-col gap-1 flex-1">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.id}
              className={`sidebar-link ${pathname === tab.id ? 'active' : ''}`}
            >
              <span>{tab.icon}</span> {tab.label}
              {tab.id === '/' && dueCount > 0 && (
                <span className="ml-auto bg-[#38bdf8] text-black text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  {dueCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-[rgba(255,255,255,0.07)] space-y-2">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#38bdf8] to-[#818cf8] flex items-center justify-center text-xs font-bold text-white">
              {user.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[#94a3b8] truncate">{user.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="text-[#64748b] hover:text-[#f87171] text-sm"
              title="Sair"
            >
              ⏻
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[rgba(8,12,24,0.98)] border-t border-[rgba(255,255,255,0.07)] flex justify-around py-2 z-50 backdrop-blur-xl">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.id}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-semibold transition-colors ${pathname === tab.id ? 'text-[#38bdf8]' : 'text-[#64748b]'}`}
          >
            <span className="text-lg">{tab.icon}</span>
            {tab.label.split(' ')[0]}
          </Link>
        ))}
      </nav>

      {/* Main */}
      <main className="flex-1 p-6 pb-20 md:pb-6 overflow-y-auto min-h-screen">
        {/* Header */}
        <header className="flex items-center gap-5 bg-[rgba(17,24,39,0.9)] border border-[rgba(255,255,255,0.07)] rounded-3xl px-6 py-4 mb-6 backdrop-blur-xl">
          <div className="flex gap-5">
            <div className="text-center">
              <span className="text-[22px] font-extrabold bg-gradient-to-r from-[#38bdf8] to-[#818cf8] bg-clip-text text-transparent block">
                {dueCount}
              </span>
              <span className="text-[10px] text-[#64748b] uppercase tracking-wider font-bold">
                Revisões
              </span>
            </div>
            <div className="text-center">
              <span className="text-[22px] font-extrabold bg-gradient-to-r from-[#4ade80] to-[#22c55e] bg-clip-text text-transparent block">
                {totalWords}
              </span>
              <span className="text-[10px] text-[#64748b] uppercase tracking-wider font-bold">
                Palavras
              </span>
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
