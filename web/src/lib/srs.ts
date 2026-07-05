/**
 * SM-2 Algorithm — Anki-compatible SRS (server-side TypeScript)
 * Same algorithm as the Chrome extension.
 */

export interface CardState {
  status: string;
  interval: number;
  ease_factor: number;
  step_index: number;
  reps: number;
  lapses: number;
  pre_lapse_interval: number;
  difficulty?: number;
  stability?: number;
  due_date?: number;
  last_review?: number;
}

export interface SRSettings {
  learningSteps: number[]; // minutes
  gradInt: number; // days
  easyInt: number; // days
  easyBonus: number; // multiplier
  intMod: number; // multiplier
  maxInt: number; // days
  lapseMod: number; // 0.0–1.0
}

const DEFAULT_SETTINGS: SRSettings = {
  learningSteps: [1, 10],
  gradInt: 1,
  easyInt: 4,
  easyBonus: 1.3,
  intMod: 1.0,
  maxInt: 36500,
  lapseMod: 0.0,
};

export function getDefaultSettings(): SRSettings {
  return { ...DEFAULT_SETTINGS };
}

/** Lê settings do Supabase (se logado), fallback para defaults */
export async function getUserSettings(supabase: any): Promise<SRSettings> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ...DEFAULT_SETTINGS };
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('user_id', user.id)
      .eq('key', 'srs')
      .single();
    if (data?.value) {
      const s = data.value;
      return {
        learningSteps: (s.learningSteps || '1 10')
          .split(' ')
          .map(Number)
          .filter((n: number) => n > 0),
        gradInt: Number(s.gradInt) || DEFAULT_SETTINGS.gradInt,
        easyInt: Number(s.easyInt) || DEFAULT_SETTINGS.easyInt,
        easyBonus: Number(s.easyBonus) || DEFAULT_SETTINGS.easyBonus,
        intMod: Number(s.intMod) || DEFAULT_SETTINGS.intMod,
        maxInt: Number(s.maxInt) || DEFAULT_SETTINGS.maxInt,
        lapseMod: Number(s.lapseMod) || DEFAULT_SETTINGS.lapseMod,
      };
    }
  } catch (_) {}
  return { ...DEFAULT_SETTINGS };
}

export function calculateNextState(
  card: CardState,
  quality: number,
  settings: SRSettings,
): CardState {
  const now = Date.now();
  const prevStatus = card.status || 'new';
  const prevInterval = card.interval || 0;
  const { learningSteps, gradInt, easyInt, easyBonus, intMod, maxInt, lapseMod } = settings;

  let nextStatus: string;
  let nextInterval: number;
  let nextStepIndex = card.step_index || 0;
  let nextEase = card.ease_factor || 2.5;
  let nextLapses = card.lapses || 0;
  let nextReps = (card.reps || 0) + 1;
  let preLapseInterval = card.pre_lapse_interval || 0;

  if (prevStatus === 'new') {
    if (quality === 1) {
      nextStatus = 'learning';
      nextStepIndex = 0;
      nextInterval = learningSteps[0] / 1440;
    } else if (quality === 2) {
      nextStatus = 'learning';
      nextStepIndex = 0;
      nextInterval = (learningSteps[0] * 1.5) / 1440;
    } else if (quality === 3) {
      if (learningSteps.length <= 1) {
        nextStatus = 'review';
        nextStepIndex = 0;
        nextInterval = gradInt;
      } else {
        nextStatus = 'learning';
        nextStepIndex = 1;
        nextInterval = learningSteps[1] / 1440;
      }
    } else {
      nextStatus = 'review';
      nextStepIndex = 0;
      nextInterval = easyInt;
    }
  } else if (prevStatus === 'learning') {
    if (quality === 1) {
      nextStatus = 'learning';
      nextStepIndex = 0;
      nextInterval = learningSteps[0] / 1440;
    } else if (quality === 2) {
      nextStatus = 'learning';
      const currentMin = learningSteps[nextStepIndex] || 1;
      nextInterval = (currentMin * 1.5) / 1440;
    } else if (quality === 3) {
      nextStepIndex++;
      if (nextStepIndex >= learningSteps.length) {
        nextStatus = 'review';
        nextStepIndex = 0;
        nextInterval =
          preLapseInterval > 0 ? Math.max(gradInt, preLapseInterval * lapseMod) : gradInt;
        preLapseInterval = 0;
      } else {
        nextStatus = 'learning';
        nextInterval = learningSteps[nextStepIndex] / 1440;
      }
    } else {
      nextStatus = 'review';
      nextStepIndex = 0;
      nextInterval = easyInt;
      preLapseInterval = 0;
    }
  } else {
    // review or mature
    if (quality === 1) {
      nextLapses++;
      nextStatus = 'learning';
      nextStepIndex = 0;
      nextInterval = learningSteps[0] / 1440;
      nextEase = Math.max(1.3, nextEase - 0.2);
      preLapseInterval = prevInterval;
    } else {
      if (quality === 2) {
        nextInterval = Math.max(prevInterval * 1.2 * intMod, prevInterval + 1);
        nextEase = Math.max(1.3, nextEase - 0.15);
      } else if (quality === 3) {
        nextInterval = Math.max(prevInterval * nextEase * intMod, prevInterval + 1);
      } else {
        nextInterval = Math.max(prevInterval * nextEase * easyBonus * intMod, prevInterval + 1);
        nextEase += 0.15;
      }
      nextInterval = Math.min(nextInterval, maxInt);
      nextStatus = nextInterval >= 21 ? 'mature' : 'review';
    }
  }

  // Fuzz
  if (nextInterval >= 1) {
    nextInterval = nextInterval * (0.95 + Math.random() * 0.1);
  }

  // Due date
  let dueDate: Date;
  if (nextInterval >= 1) {
    dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + Math.round(nextInterval));
    dueDate.setHours(0, 0, 0, 0);
  } else {
    dueDate = new Date(now + Math.round(nextInterval * 24 * 60 * 60 * 1000));
  }

  return {
    ...card,
    interval: nextInterval,
    status: nextStatus,
    step_index: nextStepIndex,
    ease_factor: nextEase,
    pre_lapse_interval: preLapseInterval,
    reps: nextReps,
    lapses: nextLapses,
    due_date: dueDate.getTime(),
    last_review: now,
  };
}

export function formatInterval(interval: number): string {
  if (interval < 0.0007) return '<1m';
  if (interval < 0.04) return `${Math.round(interval * 1440)}m`;
  if (interval < 1) return `${Math.round(interval * 24)}h`;
  if (interval < 1.1) return '1d';
  if (interval < 30) return `${Math.round(interval)}d`;
  if (interval < 365) return `${Math.round(interval / 30)}mo`;
  return `${(interval / 365).toFixed(1)}y`;
}
