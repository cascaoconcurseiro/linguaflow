'use client';

import { getCardsDue, logReview } from '@/lib/db';
import { calculateNextState, formatInterval, getDefaultSettings, type CardState } from '@/lib/srs';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface StudyCard {
  id: string;
  wordData: {
    word: string;
    translation: string;
    context_sentence?: string;
    phonetic?: string;
    pronunciation_pt?: string;
    level?: string;
    chunks?: any[];
    tags?: string[];
    explanation?: string;
  };
  status: string;
  interval: number;
  ease_factor: number;
  step_index: number;
  reps: number;
  lapses: number;
  pre_lapse_interval: number;
  difficulty?: number;
  stability?: number;
}

export default function StudyPage() {
  const searchParams = useSearchParams();
  const deckId = searchParams.get('deck');

  const [cards, setCards] = useState<StudyCard[]>([]);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0); // 0=word, 1=context, 2=answer
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionDone, setSessionDone] = useState(0);
  const [predictions, setPredictions] = useState<number[]>([]);
  const [blindMode, setBlindMode] = useState(false);

  const settings = getDefaultSettings();

  useEffect(() => {
    loadCards();
  }, [deckId]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (step < 2 && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        advanceStep();
      }
      if (step === 2) {
        if (e.key === '1') answerCard(1);
        if (e.key === '2') answerCard(2);
        if (e.key === '3') answerCard(3);
        if (e.key === '4') answerCard(4);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [step, index, cards]);

  const loadCards = async () => {
    setLoading(true);
    setError('');
    try {
      const due = await getCardsDue(50, deckId);
      setCards(due);
      setIndex(0);
      setStep(0);
      setSessionDone(0);
      setSessionCorrect(0);
      if (due.length === 0) setLoading(false);
      else setLoading(false);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const advanceStep = () => {
    if (step < 1) {
      setStep(1);
      return;
    }
    // Reveal answer + predict intervals
    const card = cards[index];
    const preds = [1, 2, 3, 4].map((q) => {
      const next = calculateNextState(card as CardState, q, settings);
      return next.interval;
    });
    setPredictions(preds);
    setStep(2);
  };

  const answerCard = async (quality: number) => {
    const card = cards[index];
    try {
      await logReview(card.id, quality);
    } catch (e) {
      console.error(e);
    }

    setSessionDone((d) => d + 1);
    if (quality >= 3) setSessionCorrect((c) => c + 1);

    if (index + 1 >= cards.length) {
      // Reload
      setTimeout(() => loadCards(), 300);
      return;
    }
    setIndex((i) => i + 1);
    setStep(0);
    setPredictions([]);
  };

  const card = cards[index];

  if (loading)
    return <div className="text-center py-20 text-[#64748b] text-sm">Carregando sessão...</div>;
  if (error) return <div className="text-center py-20 text-[#f87171] text-sm">Erro: {error}</div>;

  if (!card) {
    return (
      <div className="max-w-[700px] mx-auto text-center py-20 animate-fade-up">
        <div className="text-7xl mb-5">🎉</div>
        <h2 className="text-white text-3xl font-extrabold mb-3">Sessão Completa!</h2>
        <p className="text-[#64748b] text-base mb-6">Todos os cards do dia foram revisados.</p>
        {sessionDone > 0 && (
          <div className="text-[#94a3b8] text-sm mb-6">
            {sessionCorrect}/{sessionDone} corretos (
            {Math.round((sessionCorrect / sessionDone) * 100)}%)
          </div>
        )}
        <button onClick={loadCards} className="btn btn-accent">
          🔄 Verificar Novos Cards
        </button>
      </div>
    );
  }

  const word = card.wordData;
  const sentence = word.context_sentence || (word.chunks && word.chunks[0]?.eng);

  return (
    <div className="max-w-[760px] mx-auto animate-fade-up">
      {/* Toolbar */}
      <div className="study-toolbar">
        <span className={`card-type-badge badge-${card.status}`}>
          {{ new: '🆕 Novo', learning: '📚 Aprendendo', review: '🔄 Revisão', mature: '⭐ Maduro' }[
            card.status
          ] || card.status}
        </span>
        <div className="session-progress-wrap">
          <div
            className="session-progress-fill"
            style={{ width: `${cards.length > 0 ? (index / cards.length) * 100 : 0}%` }}
          />
        </div>
        <span className="session-stats">
          {index + 1}/{cards.length}
        </span>
        <button
          onClick={() => setBlindMode((b) => !b)}
          className={`btn btn-ghost btn-sm text-xs ${blindMode ? 'bg-[rgba(245,158,11,0.12)] text-[#f59e0b]' : ''}`}
        >
          🎧 Cego: {blindMode ? 'ON' : 'OFF'}
        </button>
        {sessionDone > 0 && (
          <span
            className="text-xs font-bold"
            style={{ color: sessionCorrect / sessionDone >= 0.8 ? '#4ade80' : '#fbbf24' }}
          >
            {Math.round((sessionCorrect / sessionDone) * 100)}% ✓
          </span>
        )}
      </div>

      {/* Flashcard */}
      <div
        className={`flashcard${step === 2 ? ' revealed' : ''}`}
        onClick={() => step < 2 && advanceStep()}
      >
        {step === 0 && (
          <>
            <div className="word">{word.word}</div>
            <div className="audio-hint">Pressione Espaço ou clique para revelar</div>
          </>
        )}

        {step === 1 && (
          <>
            {sentence && (
              <div className="context">
                &ldquo;
                {sentence.replace(
                  new RegExp(
                    `(?<![\\wÀ-ÖØ-öø-ÿ])(${word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![\\wÀ-ÖØ-öø-ÿ])`,
                    'gi',
                  ),
                  '[...]',
                )}
                &rdquo;
              </div>
            )}
            <div className="audio-hint">Pressione Espaço para revelar a resposta</div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="word">{word.word}</div>
            {word.pronunciation_pt && (
              <div className="answer" style={{ fontSize: 16 }}>
                🇧🇷 {word.pronunciation_pt}
              </div>
            )}
            {word.translation && <div className="answer">{word.translation}</div>}
            {sentence && <div className="context">&ldquo;{sentence}&rdquo;</div>}
            {word.explanation && (
              <div className="extra">
                {word.explanation?.substring(0, 200)}
                {(word.explanation?.length || 0) > 200 ? '…' : ''}
              </div>
            )}
          </>
        )}
      </div>

      {/* Answer buttons */}
      {step === 2 && (
        <>
          <div className="answer-buttons">
            <button className="answer-btn again" onClick={() => answerCard(1)}>
              <span>❌ Errei</span>
              <span className="btn-interval">{formatInterval(predictions[0] || 0)}</span>
            </button>
            <button className="answer-btn hard" onClick={() => answerCard(2)}>
              <span>😓 Difícil</span>
              <span className="btn-interval">{formatInterval(predictions[1] || 0)}</span>
            </button>
            <button className="answer-btn good" onClick={() => answerCard(3)}>
              <span>✅ Bom</span>
              <span className="btn-interval">{formatInterval(predictions[2] || 0)}</span>
            </button>
            <button className="answer-btn easy" onClick={() => answerCard(4)}>
              <span>⭐ Fácil</span>
              <span className="btn-interval">{formatInterval(predictions[3] || 0)}</span>
            </button>
          </div>
          <div className="flex justify-center gap-5 mt-3 text-[11px] text-[#64748b] font-semibold">
            <span>
              <kbd className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.07)] rounded px-1.5 py-0.5 text-[10px] font-mono">
                1
              </kbd>{' '}
              Errei
            </span>
            <span>
              <kbd className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.07)] rounded px-1.5 py-0.5 text-[10px] font-mono">
                2
              </kbd>{' '}
              Difícil
            </span>
            <span>
              <kbd className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.07)] rounded px-1.5 py-0.5 text-[10px] font-mono">
                3
              </kbd>{' '}
              Bom
            </span>
            <span>
              <kbd className="bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.07)] rounded px-1.5 py-0.5 text-[10px] font-mono">
                4
              </kbd>{' '}
              Fácil
            </span>
          </div>
        </>
      )}
    </div>
  );
}
