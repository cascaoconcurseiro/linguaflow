'use client';

import { createDeck, deleteDeck, getDeckStats } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DecksPage() {
  const router = useRouter();
  const [decks, setDecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    getDeckStats().then((d) => {
      setDecks(d);
      setLoading(false);
    });
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createDeck(newName.trim());
    setNewName('');
    const d = await getDeckStats();
    setDecks(d);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este deck? As palavras serão movidas para o Padrão.')) return;
    await deleteDeck(id);
    const d = await getDeckStats();
    setDecks(d);
  };

  return (
    <div className="max-w-[800px] animate-fade-up">
      <div className="flex gap-2 mb-5">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="Nome do novo deck..."
          className="input flex-1"
        />
        <button onClick={handleCreate} className="btn btn-accent">
          + Criar Deck
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[#64748b] text-sm">Carregando...</div>
      ) : (
        <div className="space-y-3">
          {decks.map((d) => {
            const lvColor =
              d.totalCount >= 100
                ? '#ffd700'
                : d.totalCount >= 50
                  ? '#c0c0c0'
                  : d.totalCount >= 20
                    ? '#cd7f32'
                    : '#64748b';
            const lvLabel =
              d.totalCount >= 100
                ? 'Ouro'
                : d.totalCount >= 50
                  ? 'Prata'
                  : d.totalCount >= 20
                    ? 'Bronze'
                    : '';
            return (
              <div
                key={d.id}
                className="card p-5 flex items-center justify-between hover:border-[rgba(56,189,248,0.2)] transition-all"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{d.icon || '📚'}</span>
                  <div>
                    <div className="text-white font-bold text-base">
                      {d.name}
                      {lvLabel && (
                        <span
                          className="ml-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full text-black"
                          style={{ background: lvColor }}
                        >
                          {lvLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#64748b]">{d.totalCount} palavras</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/study?deck=${d.id}`)}
                    className="btn btn-primary btn-sm"
                  >
                    Estudar
                  </button>
                  {d.name !== 'Padrão' && (
                    <button onClick={() => handleDelete(d.id)} className="btn btn-danger btn-sm">
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {!decks.length && (
            <div className="text-center py-16 text-[#64748b]">Nenhum deck criado.</div>
          )}
        </div>
      )}
    </div>
  );
}
