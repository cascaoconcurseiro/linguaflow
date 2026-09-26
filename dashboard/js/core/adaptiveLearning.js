const SLOW_RESPONSE_MS = 18000;

export function deriveAdaptivePlan(card, profile = null) {
  const weak = (card?.lapses || 0) >= 3 || !!card?.is_leech;
  const stage = Math.max(0, Math.min(3, Number(profile?.recovery_stage || (weak ? 1 : 0))));
  const issue = profile?.dominant_issue || (weak ? 'recall' : 'none');
  return { stage, issue, mode: ['normal', 'word_focus', 'simple_context', 'varied_context'][stage], recovering: stage > 0 };
}

export function normalizeLearningSignal(signal = {}) {
  const responseMs = Math.max(0, Math.min(3600000, Number(signal.responseMs) || 0));
  const audioPlays = Math.max(0, Math.min(20, Number(signal.audioPlays) || 0));
  const helpCount = Math.max(0, Math.min(20, Number(signal.helpCount) || 0));
  const abandoned = !!signal.abandoned;
  const correct = signal.correct === true;
  const unaided = correct && !abandoned && helpCount === 0 && audioPlays <= 1 && responseMs <= SLOW_RESPONSE_MS;
  let issue = 'none';
  if (abandoned) issue = 'avoidance';
  else if (!correct) issue = signal.mode === 'dictation' ? 'listening' : 'recall';
  else if (helpCount > 0) issue = 'dependency';
  else if (responseMs > SLOW_RESPONSE_MS) issue = 'fluency';
  return { responseMs, audioPlays, helpCount, abandoned, correct, unaided, issue, mode: signal.mode || 'classic' };
}

export function nextAdaptiveProfile(profile = {}, rawSignal = {}) {
  const signal = normalizeLearningSignal(rawSignal);
  const previousStage = Math.max(0, Math.min(3, Number(profile.recovery_stage) || 0));
  const priorUnaided = Math.max(0, Number(profile.unaided_success_streak) || 0);
  const unaidedStreak = signal.unaided ? priorUnaided + 1 : 0;
  const difficult = signal.abandoned || !signal.correct || signal.helpCount > 0 || signal.responseMs > SLOW_RESPONSE_MS;
  let stage = previousStage;
  if (difficult) stage = Math.min(3, Math.max(1, previousStage + (signal.abandoned || !signal.correct ? 1 : 0)));
  else if (unaidedStreak >= 2) stage = Math.max(0, previousStage - 1);
  return { recovery_stage: stage, unaided_success_streak: stage === 0 ? 0 : unaidedStreak, dominant_issue: difficult ? signal.issue : (stage ? profile.dominant_issue || 'recall' : 'none'), signal };
}

export function detectSessionFatigue(signals = [], baselineMs = 0) {
  if (!Array.isArray(signals) || signals.length < 6) {
    return { fatigued: false, reason: 'insufficient_data', confidence: 0 };
  }

  const windowSize = Math.min(4, Math.floor(signals.length / 2));
  const recent = signals.slice(-windowSize);
  const earlier = signals.slice(0, -windowSize);

  const effectiveBaseline = baselineMs > 0
    ? baselineMs
    : (earlier.reduce((acc, s) => acc + (Number(s.responseMs) || 0), 0) / (earlier.length || 1));

  const avgRecentMs = recent.reduce((acc, s) => acc + (Number(s.responseMs) || 0), 0) / recent.length;
  const recentErrors = recent.filter((s) => !s.correct || !!s.abandoned).length;
  const recentErrorRate = recentErrors / recent.length;

  const latencyRatio = effectiveBaseline > 0 ? (avgRecentMs / effectiveBaseline) : 1;

  if (latencyRatio >= 1.5 && recentErrorRate >= 0.5) {
    const confidence = Math.min(0.99, Math.max(0.71, 0.4 + (latencyRatio * 0.2) + (recentErrorRate * 0.25)));
    return {
      fatigued: true,
      reason: 'latency_and_errors',
      confidence: Number(confidence.toFixed(2)),
      latencyRatio: Number(latencyRatio.toFixed(2)),
      recentErrorRate,
    };
  }

  return { fatigued: false, reason: 'stable', confidence: 0 };
}

export { SLOW_RESPONSE_MS };

