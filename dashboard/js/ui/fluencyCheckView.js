import { escapeHtml, renderViewState } from './viewState.js';

const FLUENCY_STEPS = Object.freeze([
  {
    id: 'listening',
    skill: 'listening',
    title: 'Escuta inédita',
    instruction: 'Ouça a mensagem sem legenda e escolha a ideia principal.',
    taskType: 'unseen_listening',
    taskFamily: 'short-message',
    descriptor: 'Compreender a ideia principal de uma mensagem curta e inédita.',
  },
  {
    id: 'speaking',
    skill: 'speaking_spontaneous',
    title: 'Fala espontânea',
    instruction: 'Responda sem roteiro. Pausas e sotaque fazem parte da sua fala.',
    taskType: 'spontaneous_speaking',
    taskFamily: 'personal-description',
    descriptor: 'Responder espontaneamente a uma situação familiar.',
  },
  {
    id: 'writing',
    skill: 'writing',
    title: 'Escrita funcional',
    instruction: 'Escreva uma mensagem curta para cumprir o objetivo proposto.',
    taskType: 'writing',
    taskFamily: 'message',
    descriptor: 'Escrever uma mensagem funcional para uma situação cotidiana.',
  },
  {
    id: 'interaction',
    skill: 'interaction',
    title: 'Interação',
    instruction: 'Responda ao interlocutor e depois esclareça o mal-entendido.',
    taskType: 'interaction',
    taskFamily: 'request',
    descriptor: 'Sustentar uma troca curta e esclarecer uma informação.',
  },
]);

const LISTENING_STIMULUS = 'The meeting starts at half past three, but please arrive ten minutes early.';
const LISTENING_OPTIONS = Object.freeze([
  ['ten', 'A reunião começa às dez.'],
  ['early', 'É preciso chegar dez minutos antes da reunião.'],
  ['cancelled', 'A reunião foi cancelada.'],
]);

const SKILL_LABELS = Object.freeze({
  listening: 'Escuta inédita',
  speaking_spontaneous: 'Fala espontânea',
  writing: 'Escrita funcional',
  interaction: 'Interação',
});

function createClientAttemptId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function emptyAnswers() {
  return {
    listening: { choice: '', replayCount: 0 },
    speaking: { recorded: false, unavailable: false, durationMs: 0, blobSize: 0 },
    writing: '',
    interaction: { first: '', clarification: '' },
  };
}

function normalizeAnswers(value) {
  const empty = emptyAnswers();
  return {
    listening: { ...empty.listening, ...(value?.listening || {}) },
    speaking: { ...empty.speaking, ...(value?.speaking || {}) },
    writing: typeof value?.writing === 'string' ? value.writing : '',
    interaction: { ...empty.interaction, ...(value?.interaction || {}) },
  };
}

export function createFluencyDataAdapter(db) {
  if (db?.fluencyCheckAdapter) return db.fluencyCheckAdapter;

  return {
    async load() {
      const [latest, draft] = await Promise.all([
        typeof db?.getLatestLearningTaskAttempt === 'function'
          ? db.getLatestLearningTaskAttempt()
          : null,
        typeof db?.getFluencyCheckDraft === 'function'
          ? db.getFluencyCheckDraft()
          : null,
      ]);
      return { latest, draft };
    },
    async saveDraft(draft) {
      if (typeof db?.saveFluencyCheckDraft === 'function') {
        await db.saveFluencyCheckDraft(draft);
      }
    },
    async clearDraft() {
      if (typeof db?.clearFluencyCheckDraft === 'function') {
        await db.clearFluencyCheckDraft();
      }
    },
    async submit(records) {
      if (typeof db?.submitFluencyCheck === 'function') {
        return db.submitFluencyCheck(records);
      }
      if (typeof db?.recordLearningTaskAttempt !== 'function') {
        throw new Error('O registro do check ainda não está disponível.');
      }
      return Promise.all(records.map(({ clientAttemptId, attempt }) =>
        db.recordLearningTaskAttempt(attempt, clientAttemptId)));
    },
  };
}

function isStepComplete(stepId, answers) {
  if (stepId === 'listening') return !!answers.listening.choice;
  if (stepId === 'speaking') return answers.speaking.recorded || answers.speaking.unavailable;
  if (stepId === 'writing') return answers.writing.trim().length >= 20;
  if (stepId === 'interaction') {
    return answers.interaction.first.trim().length >= 10
      && answers.interaction.clarification.trim().length >= 10;
  }
  return false;
}

function renderProgress(stepIndex) {
  const current = Math.min(FLUENCY_STEPS.length, Math.max(1, stepIndex + 1));
  const percent = Math.round((current / FLUENCY_STEPS.length) * 100);
  return `
    <div class="fluency-progress">
      <div class="fluency-progress-copy">
        <strong>Etapa ${current} de ${FLUENCY_STEPS.length}</strong>
        <span>Uma tarefa por vez</span>
      </div>
      <div class="fluency-progress-track" role="progressbar" aria-label="Progresso do check" aria-valuemin="1" aria-valuemax="${FLUENCY_STEPS.length}" aria-valuenow="${current}" aria-valuetext="Etapa ${current} de ${FLUENCY_STEPS.length}">
        <span style="width:${percent}%"></span>
      </div>
      <ol class="fluency-step-list" aria-label="Etapas do check">
        ${FLUENCY_STEPS.map((step, index) => `
          <li ${index === stepIndex ? 'aria-current="step"' : ''}>
            <span aria-hidden="true">${index + 1}</span>
            <span>${escapeHtml(step.title)}</span>
          </li>`).join('')}
      </ol>
    </div>`;
}

function renderIntroduction(hasDraft) {
  return `
    <main class="fluency-check-page" data-fluency-screen="introduction" aria-labelledby="fluency-check-title">
      <header class="fluency-check-header">
        <p class="product-kicker">EVIDÊNCIA DE USO REAL</p>
        <h1 id="fluency-check-title" tabindex="-1">Check de comunicação</h1>
        <p>Quatro tarefas curtas observam o que você compreende e produz fora da revisão de cartões.</p>
      </header>
      <section class="fluency-intro-card" aria-labelledby="fluency-intro-title">
        <h2 id="fluency-intro-title">${hasDraft ? 'Continue de onde parou' : 'Antes de começar'}</h2>
        <ul>
          <li>Cerca de 8 minutos, com uma tarefa por tela.</li>
          <li>O microfone só será solicitado quando você iniciar a etapa de fala.</li>
          <li>Esta amostra não altera FSRS, XP, ofensiva ou liga.</li>
          <li>Uma tentativa isolada não atribui um nível global de fluência.</li>
        </ul>
        <div class="fluency-task-actions">
          <button class="btn btn-outline" type="button" data-fluency-exit>Voltar ao Progresso</button>
          <button class="btn btn-primary" type="button" data-fluency-start>${hasDraft ? 'Continuar check' : 'Começar check'}</button>
        </div>
      </section>
    </main>`;
}

function renderListening(answers) {
  return `
    <fieldset class="fluency-fieldset">
      <legend>Qual é a informação mais importante da mensagem?</legend>
      <button class="btn btn-secondary fluency-audio-button" type="button" data-fluency-listen aria-label="Ouvir mensagem em inglês">
        Ouvir mensagem
      </button>
      <p class="fluency-help">Você pode ouvir até duas vezes. Cada reprodução fica registrada como ajuda.</p>
      <div class="fluency-options">
        ${LISTENING_OPTIONS.map(([value, label]) => `
          <label>
            <input type="radio" name="fluency-listening" value="${value}" ${answers.listening.choice === value ? 'checked' : ''}>
            <span>${escapeHtml(label)}</span>
          </label>`).join('')}
      </div>
    </fieldset>`;
}

function renderSpeaking(answers) {
  const stateText = answers.speaking.recorded
    ? 'Resposta gravada. Você pode seguir ou gravar novamente.'
    : answers.speaking.unavailable
      ? 'Fala espontânea: ainda sem evidência. As demais etapas continuam disponíveis.'
      : 'O microfone está desligado.';
  return `
    <fieldset class="fluency-fieldset">
      <legend>Conte sobre um plano que você tem para o próximo fim de semana e explique por quê.</legend>
      <p>Fale por até 60 segundos. Não há texto esperado para repetir.</p>
      <div class="fluency-recording-controls">
        <button class="btn btn-secondary" type="button" data-fluency-record>${answers.speaking.recorded ? 'Gravar novamente' : 'Começar gravação'}</button>
        <button class="btn btn-outline" type="button" data-fluency-stop hidden>Parar gravação</button>
      </div>
      <p class="fluency-recording-status" role="status" aria-live="polite">${stateText}</p>
      ${answers.speaking.unavailable ? '' : '<button class="fluency-text-action" type="button" data-fluency-skip-mic>Continuar sem evidência de fala</button>'}
    </fieldset>`;
}

function renderWriting(answers) {
  return `
    <fieldset class="fluency-fieldset">
      <legend>Você vai chegar atrasado a um encontro. Avise a pessoa, explique brevemente e proponha um novo horário.</legend>
      <label for="fluency-writing">Sua mensagem em inglês</label>
      <textarea id="fluency-writing" name="fluency-writing" rows="7" minlength="20" aria-describedby="fluency-writing-help">${escapeHtml(answers.writing)}</textarea>
      <p id="fluency-writing-help" class="fluency-help">Mínimo de 20 caracteres. A resposta livre não é armazenada no registro de evidência.</p>
    </fieldset>`;
}

function renderInteraction(answers) {
  return `
    <fieldset class="fluency-fieldset">
      <legend>Uma reserva foi registrada para o dia errado. Resolva a troca em dois turnos.</legend>
      <div class="fluency-dialogue-prompt"><strong>Atendente:</strong> I have your reservation for Thursday. Is that correct?</div>
      <label for="fluency-interaction-first">Sua primeira resposta em inglês</label>
      <textarea id="fluency-interaction-first" rows="4" minlength="10">${escapeHtml(answers.interaction.first)}</textarea>
      <div class="fluency-dialogue-prompt"><strong>Atendente:</strong> Sorry, did you mean Tuesday morning or Tuesday evening?</div>
      <label for="fluency-interaction-clarification">Esclareça o horário em inglês</label>
      <textarea id="fluency-interaction-clarification" rows="4" minlength="10">${escapeHtml(answers.interaction.clarification)}</textarea>
      <p class="fluency-help">Esta é uma interação guiada por texto. Ela não substitui evidência de conversa oral.</p>
    </fieldset>`;
}

function renderTask(stepIndex, answers, errorMessage = '') {
  const step = FLUENCY_STEPS[stepIndex];
  const body = step.id === 'listening' ? renderListening(answers)
    : step.id === 'speaking' ? renderSpeaking(answers)
      : step.id === 'writing' ? renderWriting(answers)
        : renderInteraction(answers);
  return `
    <main class="fluency-check-page" data-fluency-screen="task" aria-labelledby="fluency-task-title">
      ${renderProgress(stepIndex)}
      <article class="fluency-task-card">
        <header>
          <p class="product-kicker">${escapeHtml(SKILL_LABELS[step.skill])}</p>
          <h1 id="fluency-task-title" tabindex="-1">${escapeHtml(step.title)}</h1>
          <p>${escapeHtml(step.instruction)}</p>
        </header>
        ${body}
        <p class="fluency-validation" role="alert" tabindex="-1" ${errorMessage ? '' : 'hidden'}>${escapeHtml(errorMessage)}</p>
        <div class="fluency-task-actions">
          <button class="btn btn-outline" type="button" data-fluency-back>${stepIndex === 0 ? 'Pausar' : 'Voltar'}</button>
          <button class="btn btn-primary" type="button" data-fluency-next>${stepIndex === FLUENCY_STEPS.length - 1 ? 'Revisar respostas' : 'Próxima etapa'}</button>
        </div>
      </article>
    </main>`;
}

function renderReview(answers) {
  return `
    <main class="fluency-check-page" data-fluency-screen="review" aria-labelledby="fluency-review-title">
      <header class="fluency-check-header">
        <p class="product-kicker">REVISÃO</p>
        <h1 id="fluency-review-title" tabindex="-1">Confira antes de registrar</h1>
        <p>As respostas livres não são enviadas no registro de evidência; apenas presença, extensão e uso de ajuda.</p>
      </header>
      <ol class="fluency-review-list">
        ${FLUENCY_STEPS.map((step) => `
          <li>
            <strong>${escapeHtml(step.title)}</strong>
            <span>${isStepComplete(step.id, answers) ? 'Pronta para registrar' : 'Sem evidência'}</span>
          </li>`).join('')}
      </ol>
      <p class="fluency-submit-status" role="status" aria-live="polite"></p>
      <div class="fluency-task-actions">
        <button class="btn btn-outline" type="button" data-fluency-review-back>Voltar e editar</button>
        <button class="btn btn-primary" type="button" data-fluency-submit>Registrar amostra</button>
      </div>
    </main>`;
}

function renderResult(answers) {
  return `
    <main class="fluency-check-page" data-fluency-screen="result" aria-labelledby="fluency-result-title">
      <header class="fluency-check-header">
        <p class="product-kicker">AMOSTRA REGISTRADA</p>
        <h1 id="fluency-result-title" tabindex="-1">Seu resultado permanece por habilidade</h1>
        <p>Este check registra participação e prepara avaliação posterior. Ele não certifica um nível global.</p>
      </header>
      <section class="fluency-result-grid" aria-label="Evidência por habilidade">
        ${FLUENCY_STEPS.map((step) => {
          const available = isStepComplete(step.id, answers)
            && !(step.id === 'speaking' && answers.speaking.unavailable);
          return `
            <article class="fluency-skill-result">
              <h2>${escapeHtml(step.title)}</h2>
              <p>${available ? 'Amostra inicial registrada; avaliação de competência ainda pendente.' : `${escapeHtml(step.title)}: ainda sem evidência.`}</p>
            </article>`;
        }).join('')}
      </section>
      <p class="fluency-evidence-note">Uma faixa só poderá aparecer como provável ou consistente após tarefas diferentes, em dias diferentes, avaliadas por autoridade apropriada.</p>
      <div class="fluency-task-actions">
        <button class="btn btn-primary" type="button" data-fluency-finish>Voltar ao Progresso</button>
      </div>
    </main>`;
}

function responseLength(stepId, answers) {
  if (stepId === 'listening') return answers.listening.choice ? 1 : 0;
  if (stepId === 'speaking') return answers.speaking.recorded ? answers.speaking.blobSize : 0;
  if (stepId === 'writing') return answers.writing.trim().length;
  return answers.interaction.first.trim().length + answers.interaction.clarification.trim().length;
}

function buildAttemptRecords(answers, attemptIds, startedAt) {
  const occurredAt = new Date().toISOString();
  return FLUENCY_STEPS.map((step) => {
    const completed = isStepComplete(step.id, answers)
      && !(step.id === 'speaking' && answers.speaking.unavailable);
    const evidence = {
      task_family: step.taskFamily,
      valid: false,
      invalidation_reason: completed ? 'client_only_unevaluated' : 'no_response',
      response_length: responseLength(step.id, answers),
      turn_count: step.id === 'interaction' ? 2 : 1,
      stimulus_id: `weekly-check-v1-${step.id}`,
    };
    return {
      clientAttemptId: attemptIds[step.id],
      attempt: {
        task_key: `weekly-check-v1-${step.id}`,
        task_type: step.taskType,
        skill: step.skill,
        target_descriptor: step.descriptor,
        target_level: null,
        prompt_version: 'client-static-v1',
        evaluator_version: 'client-completion-v1',
        evaluation_authority: 'client',
        authoritative: false,
        stimulus_unseen: step.id === 'listening',
        assistance_used: {
          replay_count: step.id === 'listening' ? answers.listening.replayCount : 0,
          preparation_seconds: 0,
        },
        response_time_ms: Math.min(3_600_000, Math.max(0, Date.now() - startedAt)),
        task_completion: completed ? 1 : 0,
        comprehensibility: null,
        accuracy: null,
        fluency: null,
        lexical_range: null,
        overall_score: null,
        evidence,
        occurred_at: occurredAt,
      },
    };
  });
}

function focusScreen(container) {
  requestAnimationFrame(() => {
    container.querySelector('h1[tabindex="-1"]')?.focus();
  });
}

export async function renderFluencyCheck(container, app) {
  const adapter = createFluencyDataAdapter(app?.db);
  let active = true;
  let stepIndex = 0;
  let answers = emptyAnswers();
  let attemptIds = Object.fromEntries(FLUENCY_STEPS.map((step) => [step.id, createClientAttemptId()]));
  let startedAt = Date.now();
  let stream = null;
  let recorder = null;
  let recordingStartedAt = 0;
  let recordedChunks = [];
  let recordingRequestPending = false;
  let submitting = false;

  const stopMedia = () => {
    if (recorder?.state === 'recording') recorder.stop();
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = null;
    globalThis.speechSynthesis?.cancel();
  };

  app.onLeaveView?.(() => {
    active = false;
    stopMedia();
    container.removeAttribute('aria-busy');
  });

  const saveDraft = () => {
    adapter.saveDraft({
      version: 1,
      stepIndex,
      answers,
      attemptIds,
      startedAt,
      completed: false,
    }).catch(() => {});
  };

  const drawIntroduction = (hasDraft = false) => {
    if (!active) return;
    container.innerHTML = renderIntroduction(hasDraft);
    focusScreen(container);
    container.querySelector('[data-fluency-exit]')?.addEventListener('click', () => app.navigate?.('progress'));
    container.querySelector('[data-fluency-start]')?.addEventListener('click', () => drawTask());
  };

  const updateAnswersFromDom = () => {
    const step = FLUENCY_STEPS[stepIndex];
    if (step.id === 'listening') {
      answers.listening.choice = container.querySelector('input[name="fluency-listening"]:checked')?.value || '';
    } else if (step.id === 'writing') {
      answers.writing = container.querySelector('#fluency-writing')?.value || '';
    } else if (step.id === 'interaction') {
      answers.interaction.first = container.querySelector('#fluency-interaction-first')?.value || '';
      answers.interaction.clarification = container.querySelector('#fluency-interaction-clarification')?.value || '';
    }
  };

  const startListening = (button) => {
    if (!globalThis.speechSynthesis || typeof SpeechSynthesisUtterance !== 'function') {
      button.disabled = true;
      button.textContent = 'Áudio indisponível neste navegador';
      return;
    }
    if (answers.listening.replayCount >= 2) return;
    answers.listening.replayCount += 1;
    const utterance = new SpeechSynthesisUtterance(LISTENING_STIMULUS);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    button.setAttribute('aria-busy', 'true');
    utterance.addEventListener('end', () => {
      if (!active) return;
      button.removeAttribute('aria-busy');
      button.textContent = answers.listening.replayCount >= 2 ? 'Limite de reproduções atingido' : 'Ouvir mais uma vez';
      button.disabled = answers.listening.replayCount >= 2;
      saveDraft();
    }, { once: true });
    utterance.addEventListener('error', () => {
      if (!active) return;
      button.removeAttribute('aria-busy');
      button.textContent = 'Tentar ouvir novamente';
    }, { once: true });
    globalThis.speechSynthesis.cancel();
    globalThis.speechSynthesis.speak(utterance);
  };

  const startRecording = async () => {
    if (recordingRequestPending) return;
    recordingRequestPending = true;
    const status = container.querySelector('.fluency-recording-status');
    const startButton = container.querySelector('[data-fluency-record]');
    startButton.disabled = true;
    startButton.setAttribute('aria-busy', 'true');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!active) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      recordedChunks = [];
      recorder = new MediaRecorder(stream);
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data?.size) recordedChunks.push(event.data);
      });
      recorder.addEventListener('stop', () => {
        const blob = new Blob(recordedChunks, { type: recorder?.mimeType || 'audio/webm' });
        answers.speaking = {
          recorded: blob.size > 0,
          unavailable: false,
          durationMs: Math.max(0, Date.now() - recordingStartedAt),
          blobSize: blob.size,
        };
        if (stream) stream.getTracks().forEach((track) => track.stop());
        stream = null;
        if (active) {
          saveDraft();
          drawTask();
        }
      }, { once: true });
      recordingStartedAt = Date.now();
      recorder.start();
      startButton.hidden = true;
      container.querySelector('[data-fluency-stop]').hidden = false;
      status.textContent = 'Gravação em andamento. Ative “Parar gravação” quando terminar.';
    } catch {
      startButton.disabled = false;
      startButton.removeAttribute('aria-busy');
      status.textContent = 'Não foi possível acessar o microfone. Você pode tentar novamente ou continuar sem evidência de fala.';
      container.querySelector('[data-fluency-skip-mic]')?.focus();
    } finally {
      recordingRequestPending = false;
    }
  };

  const drawTask = (errorMessage = '') => {
    if (!active) return;
    stopMedia();
    container.innerHTML = renderTask(stepIndex, answers, errorMessage);
    focusScreen(container);

    container.querySelector('[data-fluency-listen]')?.addEventListener('click', (event) => startListening(event.currentTarget));
    container.querySelector('[data-fluency-record]')?.addEventListener('click', startRecording);
    container.querySelector('[data-fluency-stop]')?.addEventListener('click', () => {
      if (recorder?.state === 'recording') recorder.stop();
    });
    container.querySelector('[data-fluency-skip-mic]')?.addEventListener('click', () => {
      answers.speaking.unavailable = true;
      saveDraft();
      drawTask();
    });
    container.querySelector('[data-fluency-back]')?.addEventListener('click', () => {
      updateAnswersFromDom();
      saveDraft();
      if (stepIndex === 0) {
        drawIntroduction(true);
        return;
      }
      stepIndex -= 1;
      drawTask();
    });
    container.querySelector('[data-fluency-next]')?.addEventListener('click', () => {
      updateAnswersFromDom();
      if (!isStepComplete(FLUENCY_STEPS[stepIndex].id, answers)) {
        drawTask('Conclua esta etapa ou use a opção disponível para continuar sem evidência.');
        container.querySelector('.fluency-validation')?.focus();
        return;
      }
      saveDraft();
      if (stepIndex === FLUENCY_STEPS.length - 1) {
        drawReview();
        return;
      }
      stepIndex += 1;
      drawTask();
    });
  };

  const drawReview = () => {
    if (!active) return;
    stopMedia();
    container.innerHTML = renderReview(answers);
    focusScreen(container);
    container.querySelector('[data-fluency-review-back]')?.addEventListener('click', () => {
      stepIndex = FLUENCY_STEPS.length - 1;
      drawTask();
    });
    container.querySelector('[data-fluency-submit]')?.addEventListener('click', async (event) => {
      if (submitting) return;
      submitting = true;
      const button = event.currentTarget;
      const status = container.querySelector('.fluency-submit-status');
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'Registrando…';
      status.textContent = 'Registrando sua amostra sem alterar revisão ou placar.';
      try {
        await adapter.submit(buildAttemptRecords(answers, attemptIds, startedAt));
        await adapter.clearDraft();
        if (!active) return;
        drawResult();
      } catch {
        if (!active) return;
        submitting = false;
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = 'Tentar registrar novamente';
        status.textContent = 'Não foi possível registrar. Suas respostas continuam nesta tela.';
      }
    });
  };

  const drawResult = () => {
    if (!active) return;
    container.innerHTML = renderResult(answers);
    focusScreen(container);
    container.querySelector('[data-fluency-finish]')?.addEventListener('click', () => app.navigate?.('progress'));
  };

  container.setAttribute('aria-busy', 'true');
  container.innerHTML = renderViewState({
    kind: 'loading',
    title: 'Preparando o check de comunicação…',
    message: 'Recuperando seu ponto de continuidade e tarefas.',
  });

  try {
    const loaded = await adapter.load();
    if (!active) return;
    if (loaded?.draft?.version === 1) {
      stepIndex = Math.min(FLUENCY_STEPS.length - 1, Math.max(0, Number(loaded.draft.stepIndex) || 0));
      answers = normalizeAnswers(loaded.draft.answers);
      attemptIds = { ...attemptIds, ...loaded.draft.attemptIds };
      startedAt = Number(loaded.draft.startedAt) || startedAt;
    }
    container.setAttribute('aria-busy', 'false');
    drawIntroduction(!!loaded?.draft);
  } catch {
    if (!active) return;
    container.setAttribute('aria-busy', 'false');
    container.innerHTML = renderViewState({
      kind: 'error',
      title: 'Não foi possível preparar seu check',
      message: 'Nenhuma resposta foi perdida. Verifique a conexão e tente novamente.',
      actionLabel: 'Tentar novamente',
      actionId: 'btn-fluency-retry',
    });
    container.querySelector('#btn-fluency-retry')?.addEventListener('click', () => renderFluencyCheck(container, app));
  }
}
