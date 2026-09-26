// dashboard/js/ui/storiesQuiz.js

/**
 * Normaliza e valida o array de questões retornado pela IA.
 * Aceita entre 3 e 5 perguntas com exatamente 4 opções cada.
 */
export function normalizeQuiz(rawQuestions) {
  if (!Array.isArray(rawQuestions)) return [];
  const seen = new Set();
  const questions = [];
  for (const raw of rawQuestions) {
    const q = typeof raw?.q === 'string' ? raw.q.trim() : '';
    const answer = Number(raw?.answer);
    const options = Array.isArray(raw?.options)
      ? raw.options.map(option => typeof option === 'string' ? option.trim() : '').filter(Boolean)
      : [];
    const key = q.toLocaleLowerCase();
    if (
      !q
      || seen.has(key)
      || options.length !== 4
      || new Set(options.map(option => option.toLocaleLowerCase())).size !== 4
      || !Number.isInteger(answer)
      || answer < 0
      || answer >= options.length
    ) {
      continue;
    }
    seen.add(key);
    questions.push({ q, options, answer });
  }

  const capped = questions.slice(0, 5);
  return capped.length >= 3 ? capped : [];
}

/**
 * Gera as perguntas de compreensão via IA a partir do texto da história.
 */
export async function generateStoryQuiz(storyText, previousQuizQuestions = [], { aiChat, safeParseJson }) {
  const aspects = [
    'fatos e detalhes específicos (quem/o quê/onde/quando)',
    'intenções e sentimentos dos personagens',
    'ordem dos acontecimentos e relações de causa e efeito',
    'inferências apoiadas pelo texto',
    'vocabulário em contexto, sem pedir tradução da frase inteira',
  ];
  const questionCount = 3 + Math.floor(Math.random() * 3);
  const focus = [...aspects, ...aspects].sort(() => Math.random() - 0.5).slice(0, questionCount);
  const avoid = previousQuizQuestions.length
    ? ` Não repita nem parafraseie estas perguntas já usadas: ${JSON.stringify(previousQuizQuestions.slice(-9))}.`
    : '';
  const system = `Você cria perguntas de compreensão de leitura para estudantes de inglês.
Responda APENAS com JSON válido, sem texto extra, neste formato:
{"questions":[{"q":"pergunta em inglês simples","options":["A","B","C","D"],"answer":0}]}
REGRAS: exatamente ${questionCount} perguntas, cobrindo estes focos: ${focus.join('; ')}.
Cada pergunta tem exatamente 4 opções curtas, distintas e plausíveis. "answer" é o índice inteiro (0-3) da correta.
Use somente fatos sustentados pela história. Nível: um pouco mais simples que o texto.${avoid}`;

  const content = await aiChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: `História:\n"""${storyText.slice(0, 2500)}"""\nVariação: ${Date.now() % 100000}` }
    ],
    { temperature: 0.75, max_tokens: 600 }
  );

  const parsed = safeParseJson(content);
  if (!parsed?.questions) throw new Error('Quiz inválido');
  const questions = normalizeQuiz(parsed.questions);
  if (!questions.length) throw new Error('Quiz inválido');
  previousQuizQuestions.push(...questions.map(question => question.q));

  return questions.map(question => {
    const indexes = question.options.map((_, index) => index).sort(() => Math.random() - 0.5);
    return {
      ...question,
      options: indexes.map(index => question.options[index]),
      answer: indexes.indexOf(question.answer)
    };
  });
}

/**
 * Renderiza a interface do quiz de compreensão na tela.
 */
export function renderStoryQuiz({ questions, quizBox, storyContent }) {
  let answered = 0;
  let correct = 0;
  quizBox.style.display = 'block';
  quizBox.replaceChildren();

  storyContent.style.display = 'none';
  const heading = document.createElement('h3');
  heading.textContent = 'Você entendeu a história? (sem espiar o texto!)';
  heading.style.cssText = 'margin:0 0 4px 0; color:var(--color-text); font-size:18px;';
  quizBox.appendChild(heading);

  const revealBtn = document.createElement('button');
  revealBtn.type = 'button';
  revealBtn.textContent = 'Não lembro — reler o texto';
  revealBtn.style.cssText = 'background:none; border:none; color:var(--color-text-light); font-family:var(--font-main); font-size:12px; font-weight:700; text-decoration:underline; cursor:pointer; margin-bottom:14px; padding:0;';
  revealBtn.addEventListener('click', () => {
    const revealed = storyContent.style.display !== 'none';
    storyContent.style.display = revealed ? 'none' : 'block';
    revealBtn.textContent = revealed ? 'Não lembro — reler o texto' : 'Esconder o texto de novo';
  });
  quizBox.appendChild(revealBtn);

  questions.forEach((question, qi) => {
    const block = document.createElement('div');
    block.style.marginBottom = '16px';
    block.dataset.qi = String(qi);
    const prompt = document.createElement('div');
    prompt.style.cssText = 'font-weight:800; color:var(--color-text); margin-bottom:6px;';
    prompt.textContent = `${qi + 1}. ${question.q}`;
    block.appendChild(prompt);

    question.options.forEach((option, oi) => {
      const optionButton = document.createElement('button');
      optionButton.type = 'button';
      optionButton.className = 'quiz-opt';
      optionButton.dataset.qi = String(qi);
      optionButton.dataset.oi = String(oi);
      optionButton.textContent = `${String.fromCharCode(65 + oi)}) ${option}`;
      block.appendChild(optionButton);
    });

    quizBox.appendChild(block);
  });

  const result = document.createElement('div');
  result.id = 'quiz-result';
  result.setAttribute('role', 'status');
  result.setAttribute('aria-live', 'polite');
  result.style.cssText = 'font-weight:900; color:var(--color-primary); font-size:16px; margin-top:8px;';
  quizBox.appendChild(result);
  quizBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  quizBox.querySelectorAll('.quiz-opt').forEach(btn => {
    btn.addEventListener('click', async () => {
      const qi = Number(btn.dataset.qi);
      const oi = Number(btn.dataset.oi);
      const block = quizBox.querySelector(`div[data-qi="${qi}"]`);
      if (!block || block.dataset.done) return;
      block.dataset.done = '1';
      const isRight = oi === Number(questions[qi].answer);
      if (isRight) correct++;

      block.querySelectorAll('.quiz-opt').forEach(b => {
        const bi = Number(b.dataset.oi);
        if (bi === Number(questions[qi].answer)) b.classList.add('correct');
        else if (bi === oi && !isRight) b.classList.add('wrong');
        b.disabled = true;
      });

      answered++;
      if (answered === questions.length) {
        const resultEl = document.getElementById('quiz-result');
        if (resultEl) {
          resultEl.textContent = `Você acertou ${correct} de ${questions.length}! `;
          resultEl.textContent += 'Prática de compreensão — sem alterar XP, ofensiva ou liga.';
        }
      }
    });
  });
}
