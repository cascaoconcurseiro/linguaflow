'use client';

import { getWords } from '@/lib/db';
import { useEffect, useState } from 'react';

interface Chunk {
  eng: string;
  pt: string;
  phon: string;
  word: string;
  wordId: string;
}

export default function ChunksPage() {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [practicing, setPracticing] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    loadChunks();
  }, []);

  const loadChunks = async () => {
    setLoading(true);
    const words = await getWords(null, 500);
    const all: Chunk[] = [];
    words.forEach((w) => {
      let c = w.chunks;
      if (typeof c === 'string')
        try {
          c = JSON.parse(c);
        } catch {
          c = null;
        }
      if (c && Array.isArray(c))
        c.forEach((ch: any) => all.push({ ...ch, word: w.word, wordId: w.id }));
    });
    setChunks(all);
    setLoading(false);
  };

  const startPractice = () => {
    setPracticing(true);
    setIndex(0);
    setRevealed(false);
    setChunks((prev) => [...prev].sort(() => Math.random() - 0.5));
  };

  if (loading)
    return <div className="text-center py-20 text-[#a1a1aa] text-sm">Carregando chunks...</div>;

  if (practicing && chunks.length > 0) {
    const chunk = chunks[index];
    return (
      <div className="max-w-[600px] mx-auto animate-fade-up">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => setPracticing(false)} className="btn btn-ghost btn-sm">
            ← Voltar
          </button>
          <span className="text-xs text-[#71717a] font-semibold">
            {index + 1} / {chunks.length}
          </span>
        </div>
        <div
          className="card p-10 text-center min-h-[260px] flex flex-col items-center justify-center cursor-pointer"
          onClick={() => setRevealed(true)}
        >
          <div className="text-2xl font-semibold text-[#fafafa] mb-3">{chunk.eng}</div>
          {!revealed ? (
            <button className="btn btn-accent mt-6">Revelar</button>
          ) : (
            <>
              <div className="text-lg text-[#22c55e] font-semibold mb-2">{chunk.pt}</div>
              <div className="text-sm text-[#f59e0b] font-mono bg-[rgba(245,158,11,0.1)] px-3 py-1 rounded">
                {chunk.phon}
              </div>
              <div className="text-xs text-[#71717a] mt-4">Palavra base: {chunk.word}</div>
            </>
          )}
        </div>
        {revealed && (
          <button
            onClick={() => {
              setIndex((i) => (i + 1 >= chunks.length ? 0 : i + 1));
              setRevealed(false);
            }}
            className="btn btn-primary w-full mt-3"
          >
            Próximo →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] animate-fade-up">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-lg font-semibold text-[#fafafa]">🧩 Chunks</h2>
          <p className="text-xs text-[#71717a]">{chunks.length} chunks disponíveis</p>
        </div>
        {chunks.length > 0 && (
          <button onClick={startPractice} className="btn btn-accent">
            ▶ Praticar
          </button>
        )}
      </div>
      {chunks.length === 0 ? (
        <div className="text-center py-16 text-[#71717a]">
          <div className="text-4xl mb-3 opacity-40">🧩</div>
          <div className="text-sm font-semibold">Nenhum chunk ainda</div>
          <div className="text-xs mt-1">
            Gere chunks pelo popup da extensão ao clicar em palavras.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {chunks.map((c, i) => (
            <div key={i} className="card p-4 hover:border-[#3f3f46] transition-colors">
              <div className="text-sm font-semibold text-[#fafafa] mb-1">{c.eng}</div>
              <div className="text-xs text-[#a1a1aa] italic mb-2">{c.pt}</div>
              <div className="text-xs text-[#f59e0b] font-mono bg-[rgba(245,158,11,0.08)] px-2 py-0.5 rounded inline-block">
                {c.phon}
              </div>
              <div className="text-[10px] text-[#71717a] mt-2 uppercase tracking-wider">
                {c.word}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
