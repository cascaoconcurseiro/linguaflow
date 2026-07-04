'use client';

import { createDeck, getDeckStats, getSentences, getStats } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>({
    due_cards: 0,
    total_words: 0,
    retention: 0,
    total_secs: 0,
  });
  const [decks, setDecks] = useState<any[]>([]);
  const [sentences, setSentences] = useState<any[]>([]);
  const [newDeckName, setNewDeckName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getDeckStats(), getSentences(5)]).then(([s, d, sent]) => {
      setStats(s);
      setDecks(d);
      setSentences(sent);
      setLoading(false);
    });
  }, []);

  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) return;
    await createDeck(newDeckName.trim());
    setNewDeckName('');
    const d = await getDeckStats();
    setDecks(d);
  };

  if (loading) return <div className="text-center py-20 text-[#64748b] text-sm">Carregando...</div>;

  return (
    <div className="space-y-6 animate-fade-up max-w-[1200px]">
      {/* Hero */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-gradient-to-br from-[rgba(30,64,175,0.35)] to-[rgba(124,58,237,0.3)] border border-[rgba(129,140,248,0.2)] rounded-3xl p-10 flex flex-col items-center justify-center text-center">
          <div className="text-6xl mb-4">⚡</div>
          <h2 className="text-white text-2xl font-extrabold mb-2">Sessão de Hoje</h2>
          <p className="text-[#94a3b8] text-sm mb-6">
            {stats.due_cards > 0 ? (
              <>
                Você tem <b className="text-[#38bdf8]">{stats.due_cards} revisões</b> pendentes!
              </>
            ) : (
              'Tudo em dia! 🎉'
            )}
          </p>
          <button
            onClick={() => router.push('/study')}
            className="btn btn-accent text-lg px-10 py-4 rounded-2xl shadow-[0_4px_20px_rgba(56,189,248,0.4)]"
          >
            Começar Agora ➔
          </button>
        </div>

        <div className="grid gap-3">
          {[
            { v: stats.due_cards, l: 'Revisões Pendentes', c: 'text-[#38bdf8]', i: '🔄' },
            { v: stats.total_words, l: 'Palavras Salvas', c: 'text-[#4ade80]', i: '📖' },
            { v: `${stats.retention || 0}%`, l: 'Taxa de Retenção', c: 'text-[#fbbf24]', i: '🎯' },
            {
              v: `${((stats.total_secs || 0) / 3600).toFixed(1)}h`,
              l: 'Horas de Estudo',
              c: 'text-[#f472b6]',
              i: '⏱️',
            },
          ].map((stat) => (
            <div
              key={stat.l}
              className="card flex items-center gap-4 p-5 hover:border-[rgba(56,189,248,0.2)] transition-colors"
            >
              <span className="text-2xl">{stat.i}</span>
              <div>
                <div className={`text-xl font-extrabold ${stat.c}`}>{stat.v}</div>
                <div className="text-[11px] text-[#64748b] uppercase tracking-wider font-bold">
                  {stat.l}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Decks */}
      <div className="card card-padded">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#64748b]">
            🗂️ Meus Decks
          </h3>
          <div className="flex gap-2">
            <input
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateDeck()}
              placeholder="Novo deck..."
              className="input text-xs w-[160px]"
            />
            <button onClick={handleCreateDeck} className="btn btn-ghost btn-sm">
              + Novo
            </button>
          </div>
        </div>
        <div className="grid grid-cols-[2fr_80px_80px_80px_100px] gap-3 px-5 py-2 text-[11px] text-[#64748b] uppercase tracking-wider font-bold border-b border-[rgba(255,255,255,0.07)]">
          <span>Deck</span>
          <span className="text-center">Novos</span>
          <span className="text-center">Vencidos</span>
          <span className="text-center">Total</span>
          <span className="text-right">Ação</span>
        </div>
        {decks.map((d) => (
          <div
            key={d.id}
            className="grid grid-cols-[2fr_80px_80px_80px_100px] gap-3 px-5 py-3 items-center border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{d.icon || '📚'}</span>
              <span className="text-white font-semibold text-sm">{d.name}</span>
            </div>
            <span className="text-center text-[#38bdf8] font-extrabold text-sm">{d.newCount}</span>
            <span className="text-center text-[#4ade80] font-extrabold text-sm">{d.dueCount}</span>
            <span className="text-center text-[#94a3b8] text-sm">{d.totalCount}</span>
            <div className="text-right">
              <button
                onClick={() => router.push(`/study?deck=${d.id}`)}
                disabled={d.dueCount === 0 && d.newCount === 0}
                className="btn btn-primary btn-sm"
              >
                Estudar
              </button>
            </div>
          </div>
        ))}
        {!decks.length && (
          <div className="text-center py-8 text-[#64748b] text-sm">Nenhum deck criado.</div>
        )}
      </div>

      {/* Recent phrases */}
      {sentences.length > 0 && (
        <div className="card card-padded">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#64748b] mb-4">
            💬 Frases Recentes
          </h3>
          {sentences.map((s) => (
            <div
              key={s.id}
              className="py-3 border-b border-[rgba(255,255,255,0.03)] cursor-pointer hover:bg-[rgba(255,255,255,0.02)] rounded-lg px-2 transition-colors"
            >
              <div className="text-white font-semibold text-sm mb-1">
                {s.original?.substring(0, 80)}
                {(s.original?.length || 0) > 80 ? '…' : ''}
              </div>
              <div className="text-[#38bdf8] text-xs">{s.translation?.substring(0, 80)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
