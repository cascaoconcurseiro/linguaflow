'use client';

import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const router = useRouter();
  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setError('✅ Conta criada! Verifique seu email e faça login.');
        setMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#080c18]">
      <div className="bg-mesh" />
      <div className="card card-padded w-full max-w-[400px] animate-fade-up">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#38bdf8] to-[#818cf8] rounded-2xl flex items-center justify-center text-3xl font-black text-white mx-auto mb-4 shadow-[0_4px_20px_rgba(56,189,248,0.35)]">
            LF
          </div>
          <h1 className="text-2xl font-extrabold text-white">LinguaFlow</h1>
          <p className="text-[#64748b] text-sm mt-1">Anki Inteligente na Nuvem</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input w-full"
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input w-full"
            required
            minLength={6}
          />
          {error && (
            <div
              className={`text-sm font-semibold p-3 rounded-lg ${error.startsWith('✅') ? 'bg-[rgba(74,222,128,0.1)] text-[#4ade80]' : 'bg-[rgba(248,113,113,0.1)] text-[#f87171]'}`}
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-accent w-full text-base py-3.5"
          >
            {loading ? '⏳' : mode === 'login' ? 'Entrar' : 'Criar Conta'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
            className="text-[#64748b] text-xs font-semibold hover:text-[#38bdf8] transition-colors"
          >
            {mode === 'login' ? 'Não tem conta? Criar' : 'Já tem conta? Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
