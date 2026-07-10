import { db as lfDb } from '../../../utils/db.js';

export async function renderGame(container, app) {
  container.innerHTML = `
    <div class="game-container">
      <h2>Ligar Colunas</h2>
      <p>Combine o inglês com o português!</p>
      <div id="game-board" class="game-board"></div>
    </div>
  `;

  // Inject CSS
  if (!document.getElementById('game-style')) {
    const style = document.createElement('style');
    style.id = 'game-style';
    style.textContent = `
      .game-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
        background: #1e1e2e;
        color: #cdd6f4;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        max-width: 600px;
        margin: 40px auto;
        font-family: 'Inter', sans-serif;
      }
      .game-container h2 { margin: 0 0 10px 0; color: #89b4fa; }
      .game-board {
        display: flex;
        gap: 40px;
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
        border: 2px solid #45475a;
        background: #313244;
        color: #cdd6f4;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 600;
        transition: all 0.2s;
        text-align: center;
        user-select: none;
      }
      .match-btn:hover { background: #45475a; }
      .match-btn:active { transform: scale(0.95); }
      .match-btn.selected {
        border-color: #89b4fa;
        background: #89b4fa33;
      }
      .match-btn.correct {
        border-color: #a6e3a1;
        background: #a6e3a133;
        pointer-events: none;
      }
      .match-btn.wrong {
        border-color: #f38ba8;
        background: #f38ba833;
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
    `;
    document.head.appendChild(style);
  }

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
        <button class="match-btn" id="btn-back">Voltar</button>
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

  function playSound(isCorrect) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (isCorrect) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    }
  }

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
      playSound(true);

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
      playSound(false);

      setTimeout(() => {
        l.btn.classList.remove('wrong');
        r.btn.classList.remove('wrong');
      }, 500);
    }
  }

  async function finishGame() {
    // XP REAL via Learning Engine (RPC no banco, com cap diário anti-farm).
    // A tela antiga dizia "Você ganhou XP!" e não dava nada — era decorativa.
    container.innerHTML = `
      <div class="game-container">
        <h2 id="game-result">Calculando XP... ⏳</h2>
        <p>Ótimo trabalho revisando essas palavras.</p>
      </div>
    `;
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
