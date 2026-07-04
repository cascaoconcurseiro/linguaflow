'use client';

import { getStats } from '@/lib/db';
import { useEffect, useState } from 'react';

export default function StatsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats().then((s) => {
      setStats(s);
      setLoading(false);
    });
  }, []);

  if (loading)
    return (
      <div className="text-center py-20 text-[#64748b] text-sm">Carregando estatísticas...</div>
    );
  if (!stats)
    return <div className="text-center py-20 text-[#f87171] text-sm">Erro ao carregar.</div>;

  const hours = ((stats.total_secs || 0) / 3600).toFixed(1);
  const cefr = stats.by_cefr || {};
  const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const statuses = [
    { k: 'new_count', l: 'Novas', c: '#94a3b8' },
    { k: 'learning_count', l: 'Aprendendo', c: '#fbbf24' },
    { k: 'review_count', l: 'Revisão', c: '#38bdf8' },
    { k: 'mature_count', l: 'Maduras', c: '#4ade80' },
  ];
  const totalCards = statuses.reduce((a, s) => a + (stats[s.k] || 0), 0) || 1;

  return (
    <div className="max-w-[900px] animate-fade-up space-y-6">
      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { v: stats.total_words, l: 'Vocabulário', c: 'from-[#38bdf8] to-[#818cf8]' },
          { v: `${stats.retention || 0}%`, l: 'Retenção (30d)', c: 'from-[#4ade80] to-[#22c55e]' },
          { v: `${hours}h`, l: 'Horas de Estudo', c: 'from-[#fbbf24] to-[#f59e0b]' },
          { v: stats.due_cards, l: 'Revisões Pendentes', c: 'from-[#f472b6] to-[#db2777]' },
        ].map((s) => (
          <div key={s.l} className="card p-6 text-center hover:-translate-y-1 transition-transform">
            <div
              className={`text-3xl font-black bg-gradient-to-r ${s.c} bg-clip-text text-transparent`}
            >
              {s.v}
            </div>
            <div className="text-[11px] text-[#64748b] uppercase tracking-wider font-bold mt-2">
              {s.l}
            </div>
          </div>
        ))}
      </div>

      {/* CEFR distribution */}
      <div className="card card-padded">
        <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#64748b] mb-4">
          Distribuição CEFR
        </h3>
        <div className="flex items-end gap-2 h-[160px]">
          {cefrLevels.map((lv) => {
            const count = cefr[lv] || 0;
            const maxVal = Math.max(...Object.values(cefr).map(Number), 1);
            const h = Math.max(4, (count / maxVal) * 100);
            const colors: Record<string, string> = {
              A1: '#4ade80',
              A2: '#22d3ee',
              B1: '#facc15',
              B2: '#fb923c',
              C1: '#f472b6',
              C2: '#c084fc',
            };
            return (
              <div key={lv} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-[#64748b]">{count}</span>
                <div
                  className="w-full rounded-md transition-all duration-700"
                  style={{ height: `${h}%`, background: colors[lv], minHeight: '4px' }}
                />
                <span className="text-[11px] text-[#64748b] font-bold">{lv}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status distribution */}
      <div className="card card-padded">
        <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#64748b] mb-4">
          Status dos Cards
        </h3>
        <div className="space-y-3">
          {statuses.map((s) => {
            const val = stats[s.k] || 0;
            const pct = Math.round((val / totalCards) * 100);
            return (
              <div key={s.k}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#94a3b8] font-semibold">{s.l}</span>
                  <span className="text-white font-extrabold">
                    {val} ({pct}%)
                  </span>
                </div>
                <div className="progress-bar h-2 rounded-full">
                  <div
                    className="progress-fill rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: s.c }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
