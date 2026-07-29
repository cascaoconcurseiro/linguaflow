export const FLUENCY_LEVELS = Object.freeze(['A1', 'A2', 'B1', 'B2']);

export const FLUENCY_SKILLS = Object.freeze([
  'listening',
  'speaking_spontaneous',
  'writing',
  'interaction',
]);

const DESCRIPTORS = Object.freeze({
  A1: {
    listening: {
      canDo: 'Reconhece palavras e instruções muito frequentes quando a fala é lenta, curta e apoiada pelo contexto.',
      taskFamily: 'instruction',
    },
    speaking_spontaneous: {
      canDo: 'Produz frases curtas sobre si e necessidades imediatas, mesmo com pausas e reformulações frequentes.',
      taskFamily: 'self-introduction',
    },
    writing: {
      canDo: 'Escreve mensagens muito curtas com informações pessoais e necessidades concretas do cotidiano.',
      taskFamily: 'short-message',
    },
    interaction: {
      canDo: 'Participa de uma troca curta quando a outra pessoa fala devagar, repete e oferece apoio.',
      taskFamily: 'basic-exchange',
    },
  },
  A2: {
    listening: {
      canDo: 'Compreende o ponto principal de mensagens curtas e claras sobre rotinas, compras, deslocamentos e trabalho.',
      taskFamily: 'short-message',
    },
    speaking_spontaneous: {
      canDo: 'Descreve experiências, hábitos e planos simples em uma sequência curta e compreensível de frases.',
      taskFamily: 'personal-description',
    },
    writing: {
      canDo: 'Escreve mensagens simples conectando informações sobre experiências, necessidades e planos próximos.',
      taskFamily: 'message',
    },
    interaction: {
      canDo: 'Resolve trocas previsíveis, faz perguntas simples e responde a pedidos diretos em situações familiares.',
      taskFamily: 'request',
    },
  },
  B1: {
    listening: {
      canDo: 'Compreende as ideias principais de fala clara sobre temas familiares, inclusive relatos e explicações breves.',
      taskFamily: 'narrative',
    },
    speaking_spontaneous: {
      canDo: 'Relata experiências e explica opiniões ou planos sem preparação, mantendo uma sequência geralmente clara.',
      taskFamily: 'narrative',
    },
    writing: {
      canDo: 'Produz texto conectado sobre temas familiares, descrevendo experiências e justificando escolhas simples.',
      taskFamily: 'connected-text',
    },
    interaction: {
      canDo: 'Sustenta uma conversa sobre temas familiares, reage ao interlocutor e esclarece pontos quando necessário.',
      taskFamily: 'conversation',
    },
  },
  B2: {
    listening: {
      canDo: 'Acompanha argumentos e explicações relativamente complexos em fala padrão sobre temas concretos ou abstratos.',
      taskFamily: 'argument',
    },
    speaking_spontaneous: {
      canDo: 'Expõe e sustenta uma posição com clareza, desenvolvendo razões e reagindo a perspectivas alternativas.',
      taskFamily: 'opinion',
    },
    writing: {
      canDo: 'Escreve texto claro e detalhado, articula argumentos e ajusta o registro ao objetivo e ao destinatário.',
      taskFamily: 'argumentative-text',
    },
    interaction: {
      canDo: 'Interage com espontaneidade suficiente para negociar significado, turnos e desacordos sem apoio constante.',
      taskFamily: 'negotiation',
    },
  },
});

export function getFluencyDescriptor(level, skill) {
  if (!FLUENCY_LEVELS.includes(level)) {
    throw new RangeError(`Nível de fluência inválido: ${level}`);
  }
  if (!FLUENCY_SKILLS.includes(skill)) {
    throw new RangeError(`Habilidade de fluência inválida: ${skill}`);
  }

  return Object.freeze({ level, skill, ...DESCRIPTORS[level][skill] });
}

export function decideFluencyAttempt({
  targetLevel,
  valid = true,
  assistanceExceeded = false,
  dimensions,
  criticalDimensions = ['task_completion'],
}) {
  if (!FLUENCY_LEVELS.includes(targetLevel)) {
    throw new RangeError(`Nível de fluência inválido: ${targetLevel}`);
  }
  if (!dimensions || typeof dimensions !== 'object' || Array.isArray(dimensions)) {
    throw new TypeError('As dimensões da rubrica são obrigatórias.');
  }

  const entries = Object.entries(dimensions);
  if (entries.length === 0) {
    throw new TypeError('Ao menos uma dimensão da rubrica é obrigatória.');
  }
  for (const [, score] of entries) {
    if (!Number.isInteger(score) || score < 0 || score > 3) {
      throw new RangeError('Cada dimensão deve receber uma nota inteira de 0 a 3.');
    }
  }
  const missingCritical = criticalDimensions.filter(
    (name) => !Object.prototype.hasOwnProperty.call(dimensions, name),
  );
  if (missingCritical.length > 0) {
    throw new TypeError(`Dimensão crítica ausente: ${missingCritical.join(', ')}.`);
  }

  const scores = entries.map(([, score]) => score).sort((a, b) => a - b);
  const middle = Math.floor(scores.length / 2);
  const median = scores.length % 2
    ? scores[middle]
    : (scores[middle - 1] + scores[middle]) / 2;
  const reasons = [];

  if (!valid) reasons.push('Tentativa inválida para evidência de fluência.');
  if (assistanceExceeded) reasons.push('Ajuda excedeu o limite permitido para esta tarefa.');

  const failedCritical = criticalDimensions.filter((name) => dimensions[name] === 0);
  if (failedCritical.length > 0) {
    reasons.push(`Dimensão crítica zerada: ${failedCritical.join(', ')}.`);
  }
  if ((dimensions.task_completion ?? 0) < 2) {
    reasons.push('A tarefa comunicativa não foi concluída no nível mínimo.');
  }
  if (median < 2) {
    reasons.push('A mediana das dimensões ficou abaixo de 2.');
  }

  const meetsLevel = reasons.length === 0;
  return Object.freeze({
    meetsLevel,
    observedLevel: meetsLevel ? targetLevel : null,
    median,
    reasons: Object.freeze(reasons),
  });
}

export function evidenceStrength(attempts) {
  const validAttempts = (Array.isArray(attempts) ? attempts : [])
    .filter((attempt) => attempt?.valid && Number.isFinite(Date.parse(attempt.occurredAt)))
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));

  if (validAttempts.length === 0) {
    return Object.freeze({ status: 'sem_evidencia', validAttempts: 0 });
  }

  const distinctDays = new Set(
    validAttempts.map((attempt) => new Date(attempt.occurredAt).toISOString().slice(0, 10)),
  ).size;
  const taskFamilies = new Set(
    validAttempts.map((attempt) => attempt.taskFamily).filter(Boolean),
  ).size;
  const firstAt = Date.parse(validAttempts[0].occurredAt);
  const lastAt = Date.parse(validAttempts.at(-1).occurredAt);
  const spanDays = (lastAt - firstAt) / 86_400_000;
  const lastFive = validAttempts.slice(-5);
  const recentPasses = lastFive.filter((attempt) => attempt.meetsLevel).length;
  const latestPasses = validAttempts.at(-1).meetsLevel === true;
  const totalPasses = validAttempts.filter((attempt) => attempt.meetsLevel).length;

  let status = 'amostra_inicial';
  if (
    validAttempts.length >= 6
    && spanDays >= 21
    && lastFive.length === 5
    && recentPasses >= 4
    && latestPasses
    && taskFamilies >= 2
  ) {
    status = 'consistente';
  } else if (
    validAttempts.length >= 3
    && distinctDays >= 2
    && taskFamilies >= 2
    && totalPasses >= 2
    && latestPasses
  ) {
    status = 'provavel';
  }

  return Object.freeze({
    status,
    validAttempts: validAttempts.length,
    distinctDays,
    taskFamilies,
  });
}

export function isFluencyCheckDue(lastAttemptAt, now = new Date()) {
  if (!lastAttemptAt) return true;

  const previous = Date.parse(lastAttemptAt);
  const current = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return true;
  if (previous > current + 5 * 60_000) return true;

  return current - previous >= 7 * 86_400_000;
}
