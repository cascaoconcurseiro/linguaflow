import { db as lfDb } from '../../../utils/db.js';
import { playNaturalAudio } from '../core/tts.js';

// Onda 2.4: o Jogo virou um menu de mini-jogos — "Ligar Colunas" (existente)
// e "Ouça e Escolha" (novo, treina listening de verdade). Ambos usam o mesmo
// evento de XP do Learning Engine (game_match), então o teto diário é
// compartilhado — trocar de jogo não é brecha pra farmar XP em dobro.
//
// Onda 8 (Diretor de Arte + Prof. didático): auditoria de UX apontou que
// esta tela tinha uma paleta escura própria (tipo terminal), desconectada
// da identidade verde/branco do resto do app — parecia outro produto. Agora
// usa as mesmas variáveis de `globals.css`. Também ganhou o que faltava pra
// "parecer um jogo de verdade" no estilo Duolingo: combo visual (acertos em
// sequência aumentam o XP), celebração ao terminar, e um 3º modo — "Monte a
// Frase" — que reaproveita a mecânica de banco de palavras já usada no
// Estudo (studyView.js:renderBuilder), sem inventar nada novo no banco.
export async function renderGame(container, app) {
  injectGameStyles();
  container.innerHTML = `
    <div class="game-container">
      <h2>🎮 Modo Jogo</h2>
      <p>Escolha um mini-jogo pra praticar seu vocabulário.</p>
      <div style="display:flex; gap:16px; margin-top:20px; flex-wrap:wrap; justify-content:center;">
        <button class="match-btn" id="mode-match" style="width:220px;">🔗 Ligar Colunas</button>
        <button class="match-btn" id="mode-listen" style="width:220px;">🎧 Ouça e Escolha</button>
        <button class="match-btn" id="mode-builder" style="width:220px;">🧩 Monte a Frase</button>
      </div>
    </div>
  `;
  document.getElementById('mode-match').onclick = () => renderMatchGame(container, app);
  document.getElementById('mode-listen').onclick = () => renderListenGame(container, app);
  document.getElementById('mode-builder').onclick = () => renderBuilderGame(container, app);
}

// ── Combo (Onda 8): acertos em sequência aumentam o multiplicador visual.
// Não muda o XP real (o Learning Engine no banco continua sendo a única
// fonte de verdade) — é só a "sensação de jogo" que faltava, um contador
// que sobe/zera na tela conforme o Duolingo faz.
// Onda 9 (auditoria de bugs): "Ouça e Escolha" e "Monte a Frase" recriam o
// container (e portanto o badge) a CADA rodada — se o contador de combo
// vivesse só dentro do closure daqui, ele zerava toda rodada e o badge nunca
// aparecia (precisa de 2+ seguidos). Agora aceita um `state` externo opcional
// que sobrevive à recriação do DOM entre rodadas; `renderMatchGame` (que não
// recria o container por partida) continua funcionando igual sem passar nada.
function makeComboTracker(container, state = { combo: 0, best: 0 }) {
  const badge = document.createElement('div');
  badge.className = 'combo-badge' + (state.combo >= 2 ? '' : ' hidden');
  if (state.combo >= 2) badge.textContent = `🔥 Combo x${state.combo}`;
  container.appendChild(badge);

  function pulse() {
    badge.classList.remove('combo-pulse');
    // reflow força a animação a reiniciar mesmo em acertos consecutivos rápidos
    void badge.offsetWidth;
    badge.classList.add('combo-pulse');
  }

  return {
    hit() {
      state.combo++;
      state.best = Math.max(state.best, state.combo);
      if (state.combo >= 2) {
        badge.classList.remove('hidden');
        badge.textContent = `🔥 Combo x${state.combo}`;
        pulse();
      }
    },
    miss() {
      state.combo = 0;
      badge.classList.add('hidden');
    },
    best: () => state.best,
  };
}

// Tom de acerto/erro (Onda 8): antes era um bip único; agora um arpejo de
// 2 notas subindo no acerto (mais "recompensador", perto do "ding" de apps
// de gamificação) e uma nota curta descendo no erro. Continua só osciladores
// Web Audio — não há asset de áudio real disponível neste ambiente.
function playChime(audioCtx, isCorrect) {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const notes = isCorrect ? [523.25, 659.25, 783.99] : [220, 164.81];
  const noteDur = isCorrect ? 0.09 : 0.16;
  notes.forEach((freq, i) => {
    const start = audioCtx.currentTime + i * (isCorrect ? 0.07 : 0.1);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = isCorrect ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + noteDur);
    osc.start(start);
    osc.stop(start + noteDur + 0.02);
  });
}

// Celebração final (Onda 8): confete leve em CSS puro, sem biblioteca —
// substitui o "fim de jogo" seco por algo que dá vontade de jogar de novo.
function celebrate(container) {
  const colors = ['#58cc02', '#1cb0f6', '#ffc800', '#ff4b4b', '#ce82ff'];
  const burst = document.createElement('div');
  burst.className = 'confetti-burst';
  for (let i = 0; i < 24; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.setProperty('--dx', `${(Math.random() - 0.5) * 320}px`);
    piece.style.setProperty('--dy', `${Math.random() * -260 - 40}px`);
    piece.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    piece.style.setProperty('--delay', `${Math.random() * 0.15}s`);
    piece.style.background = colors[i % colors.length];
    burst.appendChild(piece);
  }
  container.appendChild(burst);
  setTimeout(() => burst.remove(), 1400);
}

async function renderMatchGame(container, app) {
  injectGameStyles();
  container.innerHTML = `
    <div class="game-container">
      <h2>🔗 Ligar Colunas</h2>
      <p>Combine o inglês com o português!</p>
      <div id="game-board" class="game-board"></div>
    </div>
  `;
  const combo = makeComboTracker(document.querySelector('.game-container'));

  let cards = await lfDb.getCardsDue(8, true);
  let words = cards.map(c => c.wordData).filter(Boolean);

  if (words.length < 5) {
    const all = await lfDb.getAllWords();
    const shuffledAll = all.sort(() => 0.5 - Math.random());
    for (let w of shuffledAll) {
      if (!words.find(exist => exist.id === w.id)) {
        words.push(w);
      }
      if (words.length >= 8) break;
    }
  }

  if (words.length === 0) {
    container.innerHTML = `
      <div class="game-container">
        <h2>Nenhuma palavra encontrada!</h2>
        <button class="btn btn-primary" id="btn-back">Voltar</button>
      </div>
    `;
    document.getElementById('btn-back').onclick = () => app.navigate('home');
    return;
  }

  // Limitar a 8
  words = words.slice(0, 8);

  const leftItems = words.map(w => ({ id: w.id, text: w.word, side: 'left' })).sort(() => 0.5 - Math.random());
  const rightItems = words.map(w => ({ id: w.id, text: w.translation || w.word, side: 'right' })).sort(() => 0.5 - Math.random());

  const board = document.getElementById('game-board');
  const leftCol = document.createElement('div'); leftCol.className = 'col';
  const rightCol = document.createElement('div'); rightCol.className = 'col';

  let selectedLeft = null;
  let selectedRight = null;
  let matchesLeft = words.length;

  // AudioContext precisa ser inicializado apenas após iteração do user em alguns navegadores,
  // mas como estamos criando após a ação que montou a tela, geralmente funciona.
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // Onda 9 (auditoria de bugs): sem isto, sair do Jogo pela nav bar no meio
  // de uma partida deixava o AudioContext aberto pra sempre (só era fechado
  // no fim de partida normal).
  app.onLeaveView?.(() => audioCtx.close().catch(() => {}));

  function handleSelection(btn, item) {
    if (btn.classList.contains('hidden') || btn.classList.contains('correct')) return;

    if (item.side === 'left') {
      if (selectedLeft) selectedLeft.btn.classList.remove('selected');
      selectedLeft = { btn, item };
      btn.classList.add('selected');
    } else {
      if (selectedRight) selectedRight.btn.classList.remove('selected');
      selectedRight = { btn, item };
      btn.classList.add('selected');
    }

    if (selectedLeft && selectedRight) {
      checkMatch();
    }
  }

  function checkMatch() {
    const l = selectedLeft;
    const r = selectedRight;
    selectedLeft = null;
    selectedRight = null;

    if (l.item.id === r.item.id) {
      l.btn.classList.remove('selected');
      r.btn.classList.remove('selected');
      l.btn.classList.add('correct');
      r.btn.classList.add('correct');
      playChime(audioCtx, true);
      combo.hit();

      setTimeout(() => {
        l.btn.classList.add('hidden');
        r.btn.classList.add('hidden');
        matchesLeft--;
        if (matchesLeft === 0) {
          finishGame();
        }
      }, 300);
    } else {
      l.btn.classList.remove('selected');
      r.btn.classList.remove('selected');
      l.btn.classList.add('wrong');
      r.btn.classList.add('wrong');
      playChime(audioCtx, false);
      combo.miss();

      setTimeout(() => {
        l.btn.classList.remove('wrong');
        r.btn.classList.remove('wrong');
      }, 500);
    }
  }

  async function finishGame() {
    audioCtx.close().catch(() => {}); // libera o AudioContext ao terminar a partida
    // XP REAL via Learning Engine (RPC no banco, com cap diário anti-farm).
    // A tela antiga dizia "Você ganhou XP!" e não dava nada — era decorativa.
    container.innerHTML = `
      <div class="game-container">
        <h2 id="game-result">Calculando XP... ⏳</h2>
        <p>Ótimo trabalho revisando essas palavras.</p>
      </div>
    `;
    celebrate(document.querySelector('.game-container'));
    let msg = 'Jogo concluído! 🎉';
    try {
      const res = await lfDb.recordEvent('game_match', words.length);
      if (res && res.xp_awarded > 0) {
        msg = `+${res.xp_awarded} XP de verdade! 🎉`;
        if (res.first_of_day) msg += ' (inclui bônus do primeiro estudo do dia)';
      } else if (res && res.capped) {
        msg = 'Jogo concluído! 🎮 (limite diário de XP do jogo já atingido)';
      }
    } catch (e) {
      console.warn('[Game] Falha ao registrar XP:', e);
      msg = 'Jogo concluído! (XP não registrado — sem conexão?)';
    }
    if (combo.best() >= 3) msg += ` · melhor combo: x${combo.best()} 🔥`;
    const el = document.getElementById('game-result');
    if (el) el.textContent = msg;
    setTimeout(() => {
      app.navigate('home');
    }, 2500);
  }

  leftItems.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'match-btn';
    btn.textContent = item.text;
    btn.onclick = () => handleSelection(btn, item);
    leftCol.appendChild(btn);
  });

  rightItems.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'match-btn';
    btn.textContent = item.text;
    btn.onclick = () => handleSelection(btn, item);
    rightCol.appendChild(btn);
  });

  board.appendChild(leftCol);
  board.appendChild(rightCol);
}

// Ouça e Escolha (Onda 2.4): toca o áudio da palavra e o aluno escolhe a
// tradução certa entre 4 opções — treina listening puro, sem depender da
// leitura. Reaproveita o mesmo evento 'game_match' do Learning Engine.
async function renderListenGame(container, app) {
  container.innerHTML = `<div class="game-container"><h2>🎧 Ouça e Escolha</h2><p>Carregando palavras...</p></div>`;

  let cards = await lfDb.getCardsDue(8, true);
  let words = cards.map(c => c.wordData).filter(Boolean);
  if (words.length < 4) {
    const all = await lfDb.getAllWords();
    const shuffledAll = all.sort(() => 0.5 - Math.random());
    for (const w of shuffledAll) {
      if (!words.find(exist => exist.id === w.id)) words.push(w);
      if (words.length >= 8) break;
    }
  }
  words = words.filter(w => w.word && w.translation).slice(0, 8);

  if (words.length < 4) {
    container.innerHTML = `
      <div class="game-container">
        <h2>Poucas palavras salvas ainda</h2>
        <p>Você precisa de pelo menos 4 palavras com tradução pra jogar esse modo.</p>
        <button class="btn btn-primary" id="btn-back">Voltar</button>
      </div>
    `;
    document.getElementById('btn-back').onclick = () => app.navigate('home');
    return;
  }

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // Onda 9 (auditoria de bugs): sem isto, sair do Jogo pela nav bar no meio
  // de uma partida deixava o AudioContext aberto pra sempre (só era fechado
  // no fim de partida normal).
  app.onLeaveView?.(() => audioCtx.close().catch(() => {}));
  const order = words.map((_, i) => i).sort(() => 0.5 - Math.random());
  let step = 0;
  let correctCount = 0;
  let answering = false;
  let combo = null;
  const comboState = { combo: 0, best: 0 }; // sobrevive à recriação do DOM a cada rodada

  function buildOptions(targetIdx) {
    const pool = words.filter((w, i) => i !== targetIdx && w.translation !== words[targetIdx].translation);
    const distractors = pool.sort(() => 0.5 - Math.random()).slice(0, 3);
    const options = [...distractors.map(w => w.translation), words[targetIdx].translation];
    return options.sort(() => 0.5 - Math.random());
  }

  function renderQuestion() {
    answering = false;
    const targetIdx = order[step];
    const target = words[targetIdx];
    const options = buildOptions(targetIdx);

    container.innerHTML = `
      <div class="game-container">
        <h2>🎧 Ouça e Escolha</h2>
        <div class="listen-progress">Palavra ${step + 1} de ${order.length} · Acertos: ${correctCount}</div>
        <button class="listen-play-btn" id="listen-play-btn" title="Ouvir de novo" aria-label="Ouvir a palavra">🔊</button>
        <div class="listen-options" id="listen-options">
          ${options.map(opt => `<button class="match-btn" data-option="${opt.replace(/"/g, '&quot;')}">${opt}</button>`).join('')}
        </div>
      </div>
    `;
    combo = makeComboTracker(document.querySelector('.game-container'), comboState);

    const playBtn = document.getElementById('listen-play-btn');
    const playAudio = () => playNaturalAudio(target.word).catch(() => {});
    playBtn.onclick = playAudio;
    playAudio();

    document.querySelectorAll('#listen-options .match-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (answering) return;
        answering = true;
        const picked = btn.dataset.option;
        const isCorrect = picked === target.translation;
        document.querySelectorAll('#listen-options .match-btn').forEach(b => {
          b.style.pointerEvents = 'none';
          if (b.dataset.option === target.translation) b.classList.add('correct');
          else if (b === btn) b.classList.add('wrong');
        });
        playChime(audioCtx, isCorrect);
        if (isCorrect) { correctCount++; combo.hit(); } else { combo.miss(); }
        setTimeout(() => {
          step++;
          if (step >= order.length) finishListenGame();
          else renderQuestion();
        }, 700);
      });
    });
  }

  async function finishListenGame() {
    audioCtx.close().catch(() => {}); // libera o AudioContext ao terminar a partida
    container.innerHTML = `
      <div class="game-container">
        <h2 id="listen-result">Calculando XP... ⏳</h2>
        <p>${correctCount} de ${order.length} certas de ouvido.</p>
      </div>
    `;
    celebrate(document.querySelector('.game-container'));
    let msg = 'Jogo concluído! 🎉';
    try {
      const res = await lfDb.recordEvent('game_match', correctCount);
      if (res && res.xp_awarded > 0) {
        msg = `+${res.xp_awarded} XP de verdade! 🎉`;
        if (res.first_of_day) msg += ' (inclui bônus do primeiro estudo do dia)';
      } else if (res && res.capped) {
        msg = 'Jogo concluído! 🎮 (limite diário de XP do jogo já atingido)';
      }
    } catch (e) {
      console.warn('[Game] Falha ao registrar XP:', e);
      msg = 'Jogo concluído! (XP não registrado — sem conexão?)';
    }
    const el = document.getElementById('listen-result');
    if (el) el.textContent = msg;
    setTimeout(() => app.navigate('home'), 2500);
  }

  renderQuestion();
}

// Monte a Frase (Onda 8): novo mini-jogo pedido na auditoria de UX — reusa a
// EXATA mecânica de banco de palavras do exercício "builder" do Estudo
// (studyView.js:renderBuilder), só que em modo jogo (várias frases seguidas,
// sem afetar o agendamento FSRS) e com `context_sentence`, que já existe em
// `words` — nenhuma coluna/tabela nova precisou ser criada.
async function renderBuilderGame(container, app) {
  container.innerHTML = `<div class="game-container"><h2>🧩 Monte a Frase</h2><p>Carregando frases...</p></div>`;

  let cards = await lfDb.getCardsDue(12, true);
  let words = cards.map(c => c.wordData).filter(Boolean);
  if (words.length < 5) {
    const all = await lfDb.getAllWords();
    const shuffledAll = all.sort(() => 0.5 - Math.random());
    for (const w of shuffledAll) {
      if (!words.find(exist => exist.id === w.id)) words.push(w);
      if (words.length >= 12) break;
    }
  }
  words = words.filter(w => w.context_sentence && w.context_sentence.trim().split(/\s+/).length >= 3).slice(0, 6);

  if (words.length < 3) {
    container.innerHTML = `
      <div class="game-container">
        <h2>Faltam frases de exemplo</h2>
        <p>Esse modo usa a frase de exemplo salva com a palavra. Continue estudando/salvando palavras com frase e volte aqui.</p>
        <button class="btn btn-primary" id="btn-back">Voltar</button>
      </div>
    `;
    document.getElementById('btn-back').onclick = () => app.navigate('home');
    return;
  }

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // Onda 9 (auditoria de bugs): sem isto, sair do Jogo pela nav bar no meio
  // de uma partida deixava o AudioContext aberto pra sempre (só era fechado
  // no fim de partida normal).
  app.onLeaveView?.(() => audioCtx.close().catch(() => {}));
  let step = 0;
  let correctCount = 0;
  let combo = null;
  const comboState = { combo: 0, best: 0 }; // sobrevive à recriação do DOM a cada rodada

  function renderRound() {
    const word = words[step];
    // Onda 9 (auditoria de bugs): .trim() só tira espaço nas PONTAS da frase
    // inteira — uma frase como "I like cats !" (espaço antes da pontuação)
    // sobrava um token vazio ("") depois do replace+split, virando um chip
    // fantasma sem texto que o jogador precisava encontrar pra liberar o
    // "Verificar". Filtrar tokens vazios resolve na raiz.
    const tokens = word.context_sentence.trim().replace(/[.!?,;:]+$/, '').trim().split(/\s+/).filter(Boolean);
    const shuffled = [...tokens].sort(() => 0.5 - Math.random());
    const answer = [];

    container.innerHTML = `
      <div class="game-container">
        <h2>🧩 Monte a Frase</h2>
        <div class="listen-progress">Frase ${step + 1} de ${words.length} · Acertos: ${correctCount}</div>
        <div style="font-size:13px; color:var(--color-text-light); margin-bottom:10px;">Use "<strong>${word.word}</strong>" na ordem certa</div>
        <div id="ex-answer" class="builder-answer"></div>
        <div id="ex-bank" class="builder-bank">
          ${shuffled.map((t, i) => `<button class="ex-chip" data-i="${i}" data-t="${t.replace(/"/g, '&quot;')}">${t}</button>`).join('')}
        </div>
        <button id="ex-check" class="btn btn-primary" style="padding:12px 32px; font-size:15px; margin-top:12px;" disabled>Verificar</button>
      </div>
    `;
    combo = makeComboTracker(document.querySelector('.game-container'), comboState);

    const answerEl = document.getElementById('ex-answer');
    const checkBtn = document.getElementById('ex-check');
    const bankEl = document.getElementById('ex-bank');

    function redraw() {
      answerEl.innerHTML = answer.map((a, idx) => `<button class="ex-chip ex-chip-used" data-idx="${idx}">${a.t}</button>`).join('');
      checkBtn.disabled = answer.length !== tokens.length;
    }

    bankEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.ex-chip');
      if (!chip || chip.disabled) return;
      answer.push({ t: chip.dataset.t, bankBtn: chip });
      chip.disabled = true;
      chip.style.visibility = 'hidden';
      redraw();
    });

    answerEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.ex-chip-used');
      if (!chip) return;
      const [removed] = answer.splice(Number(chip.dataset.idx), 1);
      removed.bankBtn.disabled = false;
      removed.bankBtn.style.visibility = 'visible';
      redraw();
    });

    checkBtn.addEventListener('click', () => {
      const given = answer.map(a => a.t.toLowerCase()).join(' ');
      const expected = tokens.map(t => t.toLowerCase()).join(' ');
      const isCorrect = given === expected;
      playChime(audioCtx, isCorrect);
      if (isCorrect) { correctCount++; combo.hit(); } else { combo.miss(); }
      answerEl.querySelectorAll('.ex-chip').forEach(c => c.classList.add(isCorrect ? 'correct' : 'wrong'));
      checkBtn.disabled = true;
      checkBtn.textContent = isCorrect ? '✅ Certo!' : `❌ Era: "${word.context_sentence.trim()}"`;
      setTimeout(() => {
        step++;
        if (step >= words.length) finishBuilderGame();
        else renderRound();
      }, isCorrect ? 900 : 2200);
    });
  }

  async function finishBuilderGame() {
    audioCtx.close().catch(() => {});
    container.innerHTML = `
      <div class="game-container">
        <h2 id="builder-result">Calculando XP... ⏳</h2>
        <p>${correctCount} de ${words.length} frases certas.</p>
      </div>
    `;
    celebrate(document.querySelector('.game-container'));
    let msg = 'Jogo concluído! 🎉';
    try {
      const res = await lfDb.recordEvent('game_match', correctCount);
      if (res && res.xp_awarded > 0) {
        msg = `+${res.xp_awarded} XP de verdade! 🎉`;
        if (res.first_of_day) msg += ' (inclui bônus do primeiro estudo do dia)';
      } else if (res && res.capped) {
        msg = 'Jogo concluído! 🎮 (limite diário de XP do jogo já atingido)';
      }
    } catch (e) {
      console.warn('[Game] Falha ao registrar XP:', e);
      msg = 'Jogo concluído! (XP não registrado — sem conexão?)';
    }
    const el = document.getElementById('builder-result');
    if (el) el.textContent = msg;
    setTimeout(() => app.navigate('home'), 2500);
  }

  renderRound();
}

function injectGameStyles() {
  if (document.getElementById('game-style')) return;
  const style = document.createElement('style');
  style.id = 'game-style';
  // Onda 8: paleta reescrita pra usar as MESMAS variáveis de globals.css
  // (--color-primary/secondary/surface/border/text) — antes era um tema
  // escuro isolado que não tinha nada a ver com o resto do app.
  style.textContent = `
    .game-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px;
      background: var(--color-surface);
      color: var(--color-text);
      border: 2px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: 0 10px 40px rgba(0,0,0,0.08);
      max-width: 600px;
      margin: 40px auto;
      font-family: var(--font-main);
      position: relative;
    }
    .game-container h2 { margin: 0 0 10px 0; color: var(--color-text); }
    .game-board {
      display: flex;
      gap: 24px;
      margin-top: 20px;
      width: 100%;
      justify-content: center;
    }
    .col {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 45%;
    }
    .match-btn {
      padding: 15px;
      border: 2px solid var(--color-border);
      border-bottom-width: 4px;
      background: var(--color-bg-alt);
      color: var(--color-text);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 16px;
      font-weight: 700;
      font-family: var(--font-main);
      transition: all 0.15s;
      text-align: center;
      user-select: none;
    }
    .match-btn:hover { border-color: var(--color-secondary); }
    .match-btn:active { transform: translateY(2px); }
    .match-btn.selected {
      border-color: var(--color-secondary);
      background: rgba(28,176,246,0.12);
    }
    .match-btn.correct {
      border-color: var(--color-primary);
      background: rgba(88,204,2,0.15);
      pointer-events: none;
    }
    .match-btn.wrong {
      border-color: var(--color-danger);
      background: rgba(255,75,75,0.12);
      animation: shake 0.4s;
    }
    .match-btn.hidden {
      visibility: hidden;
    }
    @keyframes shake {
      0% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      50% { transform: translateX(5px); }
      75% { transform: translateX(-5px); }
      100% { transform: translateX(0); }
    }
    .listen-play-btn {
      width: 80px; height: 80px; border-radius: 50%; border: none;
      border-bottom: 4px solid var(--color-secondary-shadow);
      background: var(--color-secondary); color: white; font-size: 32px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      margin: 10px auto 24px; transition: transform 0.15s;
    }
    .listen-play-btn:hover { transform: scale(1.06); }
    .listen-play-btn:active { transform: translateY(2px); }
    .listen-options {
      display: flex; flex-direction: column; gap: 12px; width: 100%;
    }
    .listen-progress {
      font-size: 13px; color: var(--color-text-light); margin-bottom: 4px; font-weight: 700;
    }
    .builder-answer {
      min-height: 52px; width: 100%; border-bottom: 2px solid var(--color-border);
      margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 8px;
      justify-content: center; padding: 8px;
    }
    .builder-bank {
      display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; width: 100%;
    }
    .ex-chip {
      background: var(--color-surface); border: 2px solid var(--color-border);
      border-bottom-width: 4px; border-radius: 12px; padding: 10px 16px;
      font-family: var(--font-main); font-weight: 800; font-size: 15px;
      color: var(--color-text); cursor: pointer; transition: transform 0.1s;
    }
    .ex-chip:hover { border-color: var(--color-secondary); }
    .ex-chip:active { transform: translateY(2px); }
    .ex-chip-used { background: rgba(28,176,246,0.12); border-color: var(--color-secondary); }
    .ex-chip.correct { border-color: var(--color-primary); background: rgba(88,204,2,0.15); }
    .ex-chip.wrong { border-color: var(--color-danger); background: rgba(255,75,75,0.12); }

    /* Combo (Onda 8): badge que sobe no canto quando os acertos emendam */
    .combo-badge {
      position: absolute; top: 16px; right: 16px;
      background: var(--color-warning); color: #3c3c3c;
      font-weight: 900; font-size: 14px; padding: 6px 14px;
      border-radius: 999px; box-shadow: 0 4px 0 var(--color-warning-shadow);
      transition: opacity 0.2s;
    }
    .combo-badge.hidden { opacity: 0; pointer-events: none; }
    .combo-pulse { animation: combo-pop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    @keyframes combo-pop {
      0% { transform: scale(1); }
      50% { transform: scale(1.3) rotate(-4deg); }
      100% { transform: scale(1) rotate(0); }
    }

    /* Confete (Onda 8): celebração leve em CSS puro ao terminar uma partida */
    .confetti-burst {
      position: absolute; left: 50%; top: 40%; width: 0; height: 0; pointer-events: none;
    }
    .confetti-piece {
      position: absolute; width: 8px; height: 14px; border-radius: 2px;
      animation: confetti-fly 1.1s cubic-bezier(0.15, 0.7, 0.3, 1) forwards;
      animation-delay: var(--delay, 0s);
      opacity: 0;
    }
    @keyframes confetti-fly {
      0% { transform: translate(0, 0) rotate(0); opacity: 1; }
      100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}
