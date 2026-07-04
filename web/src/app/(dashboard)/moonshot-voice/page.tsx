'use client';

import { useState } from 'react';

export default function MoonshotVoicePage() {
  const [status, setStatus] = useState('Clique para iniciar simulação de conversação');

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
        🗣️ Simulador Voice-to-Voice
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
        Simule conversas reais com IA. Fale e receba respostas em inglês com feedback de pronúncia.
      </p>

      <div
        className="card card-padded"
        style={{
          textAlign: 'center',
          minHeight: 300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
        }}
      >
        <div style={{ fontSize: 64 }}>🎙️</div>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>{status}</p>
        <button
          className="btn btn-accent"
          onClick={() => setStatus('🎧 Ouvindo... (modo simulado — API pendente)')}
        >
          Iniciar Conversa
        </button>
        <small style={{ color: 'var(--subtle)', fontSize: 11 }}>
          Em breve: integração com Web Speech API + Grok
        </small>
      </div>
    </div>
  );
}
