'use client';

import { useState } from 'react';

export default function MoonshotFeedPage() {
  const [articles] = useState([
    { title: 'The Rise of AI in Everyday Life', level: 'B1', words: 342, source: 'The Guardian' },
    {
      title: 'Why Sleep Matters More Than You Think',
      level: 'A2',
      words: 215,
      source: 'BBC Future',
    },
    { title: 'Climate Change: What We Know in 2026', level: 'B2', words: 487, source: 'Nature' },
    { title: 'How to Build Better Habits', level: 'A2', words: 178, source: 'Medium' },
  ]);

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>📰 Feed de Leitura (N+1)</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
        Artigos no seu nível ideal de inglês. O algoritmo N+1 seleciona textos com ~90% de palavras
        conhecidas.
      </p>

      <div className="cards-grid">
        {articles.map((a, i) => (
          <div key={i} className="word-card">
            <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>
              {a.source} · Nível {a.level}
            </div>
            <div className="wc-word">{a.title}</div>
            <div className="wc-meta">
              {a.words} palavras · leitura estimada: {Math.ceil(a.words / 200)} min
            </div>
          </div>
        ))}
      </div>

      <div className="empty-state">
        <h3>🔜 Em breve</h3>
        <p>Feed personalizado com curadoria de IA baseada no seu vocabulário conhecido.</p>
      </div>
    </div>
  );
}
