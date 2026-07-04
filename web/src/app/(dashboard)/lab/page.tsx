'use client';

import { getSentences, getWords } from '@/lib/db';
import { useEffect, useState } from 'react';

export default function LabPage() {
  const [mode, setMode] = useState<'menu' | 'quiz' | 'listening'>('menu');
  const [quizWords, setQuizWords] = useState<any[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizOptions, setQuizOptions] = useState<any[]>([]);
  const [quizFeedback, setQuizFeedback] = useState('');
  const [quizDone, setQuizDone] = useState(false);
  const [listeningText, setListeningText] = useState('');
  const [listeningBlurred, setListeningBlurred] = useState(true);
  const [writingInput, setWritingInput] = useState('');
  const [writingFeedback, setWritingFeedback] = useState('');
  const [hint, setHint] = useState('');

  useEffect(() => {
    if (mode === 'quiz') startQuiz();
    if (mode === 'listening') startListening();
  }, [mode]);

  const startQuiz = async () => {
    const words = await getWords(null, 200);
    const valid = words.filter((w) => w.word && w.translation);
    if (valid.length < 4) {
      setQuizDone(true);
      return;
    }
    const selected = valid.sort(() => Math.random() - 0.5).slice(0, 10);
    setQuizWords(selected);
    setQuizIndex(0);
    setQuizScore(0);
    setQuizFeedback('');
    setQuizDone(false);
    renderQuizQuestion(selected, 0);
  };

  const renderQuizQuestion = (words: any[], idx: number) => {
    if (idx >= words.length) {
      setQuizDone(true);
      return;
    }
    const correct = words[idx];
    const others = words
      .filter((_, i) => i !== idx)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const opts = [...others, correct].sort(() => Math.random() - 0.5);
    setQuizOptions(opts);
    setQuizFeedback('');
  };

  const answerQuiz = (selected: any) => {
    const correct = quizWords[quizIndex];
    if (selected.id === correct.id) {
      setQuizScore((s) => s + 1);
      setQuizFeedback('✅ Correto!');
    } else {
      setQuizFeedback(`❌ A resposta era: ${correct.translation}`);
    }
    setTimeout(() => {
      const next = quizIndex + 1;
      setQuizIndex(next);
      if (next >= quizWords.length) setQuizDone(true);
      else renderQuizQuestion(quizWords, next);
    }, 1000);
  };

  const startListening = async () => {
    const sentences = await getSentences(50);
    if (!sentences.length) return;
    const s = sentences[Math.floor(Math.random() * sentences.length)];
    setListeningText(s.original || s.phrase_text || '');
    setListeningBlurred(true);
    setWritingInput('');
    setWritingFeedback('');
    setHint('');
  };

  const checkWriting = () => {
    const clean = (t: string) =>
      t
        .toLowerCase()
        .replace(/[.,!?;:]/g, '')
        .trim();
    if (clean(writingInput) === clean(listeningText)) {
      setWritingFeedback('✨ Perfeito!');
      setListeningBlurred(false);
    } else {
      setWritingFeedback('❌ Tente novamente');
    }
  };

  if (mode === 'quiz') {
    if (quizDone) {
      return (
        <div className="max-w-[600px] mx-auto text-center py-20 animate-fade-up">
          <div className="text-5xl mb-4">
            {quizScore >= 8 ? '🏆' : quizScore >= 5 ? '🎯' : '📚'}
          </div>
          <h2 className="text-xl font-semibold text-[#fafafa] mb-2">Quiz Finalizado</h2>
          <div className="text-[#a1a1aa] mb-6">
            {quizScore} / {quizWords.length} acertos
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setQuizDone(false);
                startQuiz();
              }}
              className="btn btn-accent"
            >
              Tentar Novamente
            </button>
            <button onClick={() => setMode('menu')} className="btn btn-ghost">
              Voltar
            </button>
          </div>
        </div>
      );
    }
    const word = quizWords[quizIndex];
    return (
      <div className="max-w-[600px] mx-auto animate-fade-up">
        <button onClick={() => setMode('menu')} className="btn btn-ghost btn-sm mb-4">
          ← Voltar
        </button>
        <div className="flex justify-between items-center mb-3 text-xs text-[#71717a]">
          <span>Quiz</span>
          <span>
            {quizIndex + 1}/{quizWords.length}
          </span>
        </div>
        <div className="card p-10 text-center mb-4">
          <div className="text-3xl font-bold text-[#fafafa] mb-2">{word?.word}</div>
          {word?.context_sentence && (
            <div className="text-sm text-[#71717a] italic mb-6">"{word.context_sentence}"</div>
          )}
        </div>
        {quizFeedback && (
          <div
            className={`text-center text-sm font-semibold mb-3 p-3 rounded ${quizFeedback.startsWith('✅') ? 'bg-[rgba(34,197,94,0.1)] text-[#22c55e]' : 'bg-[rgba(239,68,68,0.1)] text-[#ef4444]'}`}
          >
            {quizFeedback}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {quizOptions.map((opt, i) => (
            <button
              key={i}
              onClick={() => answerQuiz(opt)}
              disabled={!!quizFeedback}
              className="btn btn-ghost text-left text-sm py-3"
            >
              {opt.translation}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (mode === 'listening') {
    return (
      <div className="max-w-[700px] mx-auto animate-fade-up">
        <button onClick={() => setMode('menu')} className="btn btn-ghost btn-sm mb-4">
          ← Voltar
        </button>
        <div className="card p-10 text-center">
          <div className="text-xs text-[#71717a] uppercase tracking-wider mb-4">Modo Imersão</div>
          <div
            className={`text-xl font-semibold mb-6 min-h-[60px] ${listeningBlurred ? 'blur-md opacity-30 cursor-pointer select-none' : ''}`}
            onClick={() => setListeningBlurred(!listeningBlurred)}
          >
            {listeningText || 'Nenhuma frase disponível'}
          </div>
          <div className="flex justify-center gap-3 mb-6">
            <button
              onClick={() => {
                const u = new SpeechSynthesisUtterance(listeningText);
                u.lang = 'en-US';
                speechSynthesis.speak(u);
              }}
              className="btn btn-ghost btn-sm"
            >
              🔊 Ouvir
            </button>
            <button
              onClick={() => setListeningBlurred(!listeningBlurred)}
              className="btn btn-ghost btn-sm"
            >
              👁️
            </button>
            <button onClick={startListening} className="btn btn-ghost btn-sm">
              ⏭️ Próxima
            </button>
          </div>
          <input
            value={writingInput}
            onChange={(e) => setWritingInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && checkWriting()}
            placeholder="Digite o que ouviu..."
            className="input w-full text-center text-lg mb-2"
          />
          <div className="flex gap-2">
            <button onClick={checkWriting} className="btn btn-primary flex-1">
              Verificar
            </button>
            <button
              onClick={() =>
                setHint(
                  listeningText
                    .split(' ')
                    .map((w) => w[0] + '_'.repeat(w.length - 1))
                    .join(' '),
                )
              }
              className="btn btn-ghost btn-sm"
            >
              Dica
            </button>
          </div>
          {writingFeedback && (
            <div
              className={`mt-3 text-sm font-semibold ${writingFeedback.startsWith('✨') ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}
            >
              {writingFeedback}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[700px] mx-auto animate-fade-up">
      <h2 className="text-lg font-semibold text-[#fafafa] mb-6">🧪 Laboratório</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          onClick={() => setMode('quiz')}
          className="card p-10 text-center cursor-pointer hover:border-[#3f3f46] transition-colors"
        >
          <div className="text-4xl mb-3">🎮</div>
          <h3 className="text-base font-semibold text-[#fafafa] mb-1">Modo Quiz</h3>
          <p className="text-xs text-[#71717a]">Múltipla escolha com seu vocabulário.</p>
        </div>
        <div
          onClick={() => setMode('listening')}
          className="card p-10 text-center cursor-pointer hover:border-[#3f3f46] transition-colors"
        >
          <div className="text-4xl mb-3">🎧</div>
          <h3 className="text-base font-semibold text-[#fafafa] mb-1">Imersão Passiva</h3>
          <p className="text-xs text-[#71717a]">Ouça e digite frases no idioma alvo.</p>
        </div>
      </div>
    </div>
  );
}
