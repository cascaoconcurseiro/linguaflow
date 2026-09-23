import { escapeHtml, renderViewState } from './viewState.js';
import { playNaturalAudio, stopAudio } from '../core/tts.js';

const FLUENCY_STEPS = Object.freeze([
  {
    id: 'listening',
    skill: 'listening',
    title: 'Compreensão de escuta',
    instruction: 'Ouça a mensagem sem legenda e escolha a ideia principal.',
    taskType: 'unseen_listening',
    taskFamily: 'short-message',
    descriptor: 'Compreender a ideia principal de uma mensagem curta e inédita.',
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

const SKILL_LABELS = Object.freeze({
  listening: 'Compreensão de escuta',
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
    writing: '',
    interaction: { first: '', clarification: '' },
  };
}

function normalizeAnswers(value) {
  const empty = emptyAnswers();
  return {
    listening: { ...empty.listening, ...(value?.listening || {}) },
    writing: typeof value?.writing === 'string' ? value.writing : '',
    interaction: { ...empty.interaction, ...(value?.interaction || {}) },
  };
}

export function createFluencyDataAdapter(db) {
  if (db?.fluencyCheckAdapter) return db.fluencyCheckAdapter;

  let ownerId = null;
  return {
    async load() {
      ownerId = await db.getCurrentUserId();
      if (!ownerId) throw new Error('Entre na conta para iniciar o check.');
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
        await db.saveFluencyCheckDraft(draft, ownerId);
      }
    },
    async clearDraft() {
      if (typeof db?.clearFluencyCheckDraft === 'function') {
        await db.clearFluencyCheckDraft();
      }
    },
    async issue(skill, level, clientId) {
      if (await db.getCurrentUserId() !== ownerId) throw new Error('A conta mudou. Reabra o check.');
      return db.issueFluencyTask(skill, level, clientId);
    },
    async audio(issueId) { return db.getFluencyListeningText(issueId); },
    async submit(records) {
      if (await db.getCurrentUserId() !== ownerId) throw new Error('A conta mudou. Reabra o check.');
      return db.submitFluencyCheck(records);
    },
  };
}

function isStepComplete(stepId, answers) {
  if (stepId === 'listening') return !!answers.listening.choice;
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

function renderIntroduction(hasDraft, targetLevel = 'A2') {
  return `
    <main class="fluency-check-page" data-fluency-screen="introduction" aria-labelledby="fluency-check-title">
      <header class="fluency-check-header">
        <p class="product-kicker">AMOSTRA DE COMUNICAÇÃO</p>
        <h1 id="fluency-check-title" tabindex="-1">Check de comunicação</h1>
        <p>Três tarefas curtas observam o que você compreende e produz fora da revisão de cartões.</p>
      </header>
      <section class="fluency-intro-card" aria-labelledby="fluency-intro-title">
        <h2 id="fluency-intro-title">${hasDraft ? 'Continue de onde parou' : 'Antes de começar'}</h2>
        <ul>
          <li>Cerca de 8 minutos, com uma tarefa por tela.</li>
          <li>O check não usa microfone nem gravações.</li>
          <li>Esta amostra não altera FSRS, XP, ofensiva ou liga.</li>
          <li>Uma tentativa isolada não atribui um nível global de fluência.</li>
        </ul>
        <label for="fluency-target-level">Dificuldade das tarefas (não é um diagnóstico de nível)</label>
        <select id="fluency-target-level" ${hasDraft ? 'disabled' : ''}>${['A1','A2','B1','B2'].map(level => `<option ${level === targetLevel ? 'selected' : ''}>${level}</option>`).join('')}</select>
        <p class="fluency-help">Suas respostas serão armazenadas de forma privada e enviadas ao serviço de IA para avaliação. Evite incluir dados pessoais.</p>
        <p role="status" id="fluency-prepare-status"></p>
        <div class="fluency-task-actions">
          <button class="btn btn-outline" type="button" data-fluency-exit>Voltar ao Progresso</button>
          <button class="btn btn-primary" type="button" data-fluency-start>${hasDraft ? 'Continuar check' : 'Começar check'}</button>
        </div>
      </section>
    </main>`;
}

function renderListening(answers, issue) {
  return `
    <fieldset class="fluency-fieldset">
      <legend>Qual é a informação mais importante da mensagem?</legend>
      <button class="btn btn-secondary fluency-audio-button" type="button" data-fluency-listen aria-label="Ouvir mensagem em inglês">
        Ouvir mensagem
      </button>
      <p class="fluency-help">Você pode ouvir até duas vezes. Cada reprodução fica registrada como ajuda.</p>
      <p class="fluency-audio-status" role="status" aria-live="polite"></p>
      <div class="fluency-options">
        ${(issue.material.options || []).map((label, index) => [String(index), label]).map(([value, label]) => `
          <label>
            <input type="radio" name="fluency-listening" value="${value}" ${answers.listening.choice === value ? 'checked' : ''}>
            <span>${escapeHtml(label)}</span>
          </label>`).join('')}
      </div>
    </fieldset>`;
}

function renderWriting(answers, issue) {
  return `
    <fieldset class="fluency-fieldset">
      <legend>${escapeHtml(issue.material.instruction)}</legend>
      <label for="fluency-writing">Sua mensagem em inglês</label>
      <textarea id="fluency-writing" name="fluency-writing" rows="7" minlength="20" aria-describedby="fluency-writing-help">${escapeHtml(answers.writing)}</textarea>
      <p id="fluency-writing-help" class="fluency-help">Mínimo de 20 caracteres. Sua resposta será armazenada de forma privada para avaliação.</p>
    </fieldset>`;
}

function renderInteraction(answers, issue) {
  return `
    <fieldset class="fluency-fieldset">
      <legend>${escapeHtml(issue.material.instruction)}</legend>
      <div class="fluency-dialogue-prompt"><strong>Objetivo:</strong> ${escapeHtml(issue.material.objective || issue.target_descriptor)}</div>
      <label for="fluency-interaction-first">Sua primeira resposta em inglês</label>
      <textarea id="fluency-interaction-first" rows="4" minlength="10">${escapeHtml(answers.interaction.first)}</textarea>
      <div class="fluency-dialogue-prompt"><strong>Atendente:</strong> Please clarify your request and confirm the details.</div>
      <label for="fluency-interaction-clarification">Esclareça os detalhes em inglês</label>
      <textarea id="fluency-interaction-clarification" rows="4" minlength="10">${escapeHtml(answers.interaction.clarification)}</textarea>
      <p class="fluency-help">Esta é uma interação guiada por texto. Ela não substitui evidência de conversa oral.</p>
    </fieldset>`;
}

function renderTask(stepIndex, answers, issues, errorMessage = '') {
  const step = FLUENCY_STEPS[stepIndex];
  const body = step.id === 'listening' ? renderListening(answers, issues.listening)
    : step.id === 'writing' ? renderWriting(answers, issues.writing)
      : renderInteraction(answers, issues.interaction);
  return `
    <main class="fluency-check-page" data-fluency-screen="task" aria-labelledby="fluency-task-title">
      ${renderProgress(stepIndex)}
      <article class="fluency-task-card">
        <header>
          <p class="product-kicker">${escapeHtml(SKILL_LABELS[step.skill])}</p>
          <h1 id="fluency-task-title" tabindex="-1">${escapeHtml(step.title)}</h1>
          <p>${escapeHtml(issues[step.id].material.instruction)}</p>
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
        <p>As respostas serão enviadas ao servidor e ao serviço de IA para avaliação. Elas ficam privadas à sua conta; este check não avalia fala oral.</p>
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
        <h1 id="fluency-result-title" tabindex="-1">Amostras avaliadas por habilidade</h1>
        <p>As tarefas foram registradas e avaliadas no servidor. Esta amostra não certifica um nível global.</p>
      </header>
      <section class="fluency-result-grid" aria-label="Evidência por habilidade">
        ${FLUENCY_STEPS.map((step) => {
          const available = isStepComplete(step.id, answers);
          return `
            <article class="fluency-skill-result">
              <h2>${escapeHtml(step.title)}</h2>
              <p>${available ? 'Amostra avaliada. Uma única tarefa não confirma competência geral.' : `${escapeHtml(step.title)}: ainda sem evidência.`}</p>
            </article>`;
        }).join('')}
      </section>
      <p class="fluency-evidence-note">Uma faixa só poderá aparecer como provável ou consistente após tarefas diferentes, em dias diferentes, avaliadas por autoridade apropriada.</p>
      <div class="fluency-task-actions">
        <button class="btn btn-primary" type="button" data-fluency-finish>Voltar ao Progresso</button>
      </div>
    </main>`;
}

export function buildAttemptRecords(answers, attemptIds, startedAt, issues) {
  return FLUENCY_STEPS.map(step => {
    const issue = issues[step.id];
    if (!issue?.id) throw new Error('Tarefa do servidor indisponível.');
    const response = step.id === 'listening'
      ? { choice:Number(answers.listening.choice), selected_option:issue.material.options[Number(answers.listening.choice)] }
      : step.id === 'writing' ? { text:answers.writing.trim() }
        : { turns:[answers.interaction.first.trim(), answers.interaction.clarification.trim()], mode:'guided_text' };
    return {
      issueId:issue.id, clientSubmissionId:attemptIds[step.id], response,
      assistanceUsed:{replay_count:step.id === 'listening' ? answers.listening.replayCount : 0, guided_text:step.id === 'interaction'},
      responseTimeMs:Math.min(3_600_000, Math.max(0,Date.now()-startedAt)),
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
  let submitting = false;
  let issues = {};
  let issueIds = Object.fromEntries(FLUENCY_STEPS.map(step => [step.id,createClientAttemptId()]));
  let targetLevel = 'A2';
  let frozenRecords = null;

  const stopMedia = () => {
    stopAudio();
  };

  app.onLeaveView?.(() => {
    active = false;
    stopMedia();
    container.removeAttribute('aria-busy');
  });

  const saveDraft = () => {
    adapter.saveDraft({
      version: 2,
      issues, issueIds, targetLevel, frozenRecords,
      stepIndex,
      answers,
      attemptIds,
      startedAt,
      completed: false,
    }).catch(() => { app.showToast?.('Não foi possível salvar a continuidade do check. Mantenha esta tela aberta.', 'error'); });
  };

  const drawIntroduction = (hasDraft = false) => {
    if (!active) return;
    container.innerHTML = renderIntroduction(hasDraft, targetLevel);
    focusScreen(container);
    container.querySelector('[data-fluency-exit]')?.addEventListener('click', () => app.navigate?.('progress'));
    container.querySelector('[data-fluency-start]')?.addEventListener('click', async event => {
      const button = event.currentTarget; button.disabled = true;
      targetLevel = container.querySelector('#fluency-target-level').value;
      const status = container.querySelector('#fluency-prepare-status');
      status.textContent = 'Buscando tarefas do servidor…';
      try {
        // Persist IDs before issuing: retries must not consume another unseen task.
        await adapter.saveDraft({version:2,issues,issueIds,targetLevel,answers,attemptIds,startedAt,stepIndex,frozenRecords});
        for (const step of FLUENCY_STEPS) {
          if (!issues[step.id]) {
            issues[step.id] = await adapter.issue(step.skill,targetLevel,issueIds[step.id]);
            await adapter.saveDraft({version:2,issues,issueIds,targetLevel,answers,attemptIds,startedAt,stepIndex,frozenRecords});
          }
        }
        if (!active) return;
        if (Object.values(issues).some(issue=>Date.parse(issue.expires_at) <= Date.now())) {
          status.textContent = 'Este check expirou. Suas respostas continuam salvas. Volte ao Progresso para iniciar outro check.';
          const restart = document.createElement('button'); restart.className='btn btn-outline'; restart.textContent='Descartar este check e começar outro';
          restart.onclick=async()=>{await adapter.clearDraft(); if(active) await renderFluencyCheck(container,app);};status.append(restart);return;
        }
        if (frozenRecords) drawReview(); else drawTask();
      } catch (error) {
        if (!active) return;
        status.textContent = /fluency_task_not_available/.test(error.message) ? 'Não há outra tarefa inédita disponível nesta dificuldade. Tente novamente em outro momento.' : 'Não foi possível preparar as tarefas. Tente novamente.';
        button.disabled = false;
      }
    });
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

  const startListening = async (button) => {
    if (answers.listening.replayCount >= 2 || button.disabled) return;
    answers.listening.replayCount += 1;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Reproduzindo…';

    let completed = false;
    try {
      const stimulus = await adapter.audio(issues.listening.id);
      if (!active) return;
      completed = await playNaturalAudio(stimulus, { lang: 'en-US', rate: 1 });
    } catch {
      completed = false;
    }
    if (!active) return;

    button.removeAttribute('aria-busy');
    if (!completed) {
      answers.listening.replayCount -= 1;
      saveDraft();
      button.disabled = false;
      button.textContent = 'Tentar ouvir novamente';
      container.querySelector('.fluency-audio-status').textContent = 'O áudio não foi reproduzido. Nenhuma tentativa foi consumida. Tente novamente.';
      return;
    }

    button.textContent = answers.listening.replayCount >= 2 ? 'Limite de reproduções atingido' : 'Ouvir mais uma vez';
    button.disabled = answers.listening.replayCount >= 2;
    saveDraft();
  };

  const drawTask = (errorMessage = '') => {
    if (!active) return;
    stopMedia();
    container.innerHTML = renderTask(stepIndex, answers, issues, errorMessage);
    focusScreen(container);

    container.querySelector('[data-fluency-listen]')?.addEventListener('click', (event) => startListening(event.currentTarget));
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
      if (FLUENCY_STEPS[stepIndex].id === 'listening' && answers.listening.replayCount === 0) { drawTask('Ouça a mensagem antes de responder.'); return; }
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
    if (frozenRecords) container.querySelector('[data-fluency-review-back]').disabled = true;
    focusScreen(container);
    container.querySelector('[data-fluency-review-back]')?.addEventListener('click', () => {
      if (frozenRecords) return;
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
        frozenRecords ||= buildAttemptRecords(answers, attemptIds, startedAt, issues);
        await adapter.saveDraft({version:2,issues,issueIds,targetLevel,answers,attemptIds,startedAt,stepIndex,frozenRecords});
        container.querySelector('[data-fluency-review-back]').disabled = true;
        await adapter.submit(frozenRecords);
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
    if (loaded?.draft?.version === 2) {
      issues = loaded.draft.issues || {}; issueIds = {...issueIds,...loaded.draft.issueIds};
      targetLevel = loaded.draft.targetLevel || 'A2'; frozenRecords = loaded.draft.frozenRecords || null;
      stepIndex = Math.min(FLUENCY_STEPS.length - 1, Math.max(0, Number(loaded.draft.stepIndex) || 0));
      answers = normalizeAnswers(loaded.draft.answers);
      attemptIds = { ...attemptIds, ...loaded.draft.attemptIds };
      startedAt = Number(loaded.draft.startedAt) || startedAt;
    }
    container.setAttribute('aria-busy', 'false');
    drawIntroduction(loaded?.draft?.version === 2);
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
