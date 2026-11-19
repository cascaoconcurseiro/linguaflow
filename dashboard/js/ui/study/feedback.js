// dashboard/js/ui/study/feedback.js — Feedback da avaliação: som curto de acerto/erro (Web Audio) e o "+XP" flutuante.

// Contextos de áudio abertos; precisam ser fechados ao sair da revisão.
const feedbackAudioContexts = new Set();

export function closeFeedbackAudio() {
  feedbackAudioContexts.forEach(ctx => { try { ctx.close(); } catch { /* já fechado */ } });
  feedbackAudioContexts.clear();
}

export function playFeedbackSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    feedbackAudioContexts.add(ctx);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'correct') {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.setValueAtTime(200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
    osc.onended = () => {
      feedbackAudioContexts.delete(ctx);
      ctx.close().catch(() => {});
    };
  } catch {}
}

export function showXPAnimation(text, isPositive = true) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `
    position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
    font-size:28px; font-weight:900; color:${isPositive ? 'var(--color-primary)' : 'var(--color-danger)'};
    pointer-events:none; z-index:9999; text-shadow:0 2px 8px rgba(0,0,0,0.2);
    animation: xpFloat 1.2s ease forwards;
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}
