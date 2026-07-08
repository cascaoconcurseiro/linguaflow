import { lfDb } from '../core/db.js';

let dueQueue = [];
let currentCard = null;

export async function renderStudy(container, app) {
  // Load due words from DB
  app.showToast('Carregando frases...', 'info');
  dueQueue = await lfDb.getDueWords();
  
  if (dueQueue.length === 0) {
    container.innerHTML = `
      <div class="study-main">
        <h2>Tudo feito por hoje! 🎉</h2>
        <p>Você revisou todas as suas frases pendentes.</p>
        <button class="btn btn-primary" id="back-home-btn" style="margin-top:20px;">Voltar ao Início</button>
      </div>
    `;
    setTimeout(() => {
      document.getElementById('back-home-btn')?.addEventListener('click', () => app.navigate('home'));
    }, 0);
    return;
  }

  // Inject Base Layout
  container.innerHTML = `
    <div class="study-layout">
      <!-- Main Study Area -->
      <div class="study-main">
        
        <div class="media-container">
          <div class="audio-wave-placeholder" id="audio-wave">
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <button class="btn-play-audio" id="play-audio-btn">▶</button>
          </div>
        </div>

        <div class="sentence-container">
          <div class="sentence-text" id="pump-sentence">
            Carregando...
          </div>
          <button id="reveal-btn" class="btn btn-primary reveal-btn">Revelar (Espaço)</button>
        </div>

        <!-- Anki Grading Buttons -->
        <div class="grading-buttons hidden" id="grading-area">
          <div class="grading-row">
            <button class="grade-btn btn-danger" data-grade="1">Errei</button>
            <button class="grade-btn btn-warning" data-grade="2">Difícil</button>
            <button class="grade-btn btn-secondary" data-grade="3">Bom</button>
            <button class="grade-btn btn-primary" data-grade="4">Fácil</button>
          </div>
        </div>
      </div>

      <!-- Right Panel: AI Chunks -->
      <div class="study-sidebar">
        <h3 class="sidebar-title">Grammar Chunks ✨</h3>
        <div class="chunks-list" id="chunks-container">
          <!-- Dynamically populated -->
        </div>
        
        <div id="full-translation-box" class="hidden" style="margin-top: 24px; padding: 16px; background: var(--color-bg-alt); border-radius: var(--radius-sm); border-left: 4px solid var(--color-secondary);">
          <div style="font-size:12px; color:var(--color-text-light); text-transform:uppercase; font-weight:bold;">Tradução</div>
          <div id="full-translation-text" style="font-weight:700; color:var(--color-text); margin-top:4px;"></div>
        </div>
      </div>
    </div>
  `;

  injectStyles();
  
  // Attach Global Listeners
  document.getElementById('play-audio-btn').addEventListener('click', playCurrentAudio);
  document.getElementById('reveal-btn').addEventListener('click', revealCard);
  
  document.querySelectorAll('.grade-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const grade = parseInt(e.currentTarget.dataset.grade);
      handleGrade(grade, app);
    });
  });

  document.addEventListener('keydown', handleKeydown);
  
  // Load first card
  loadNextCard(app);
}

// Cleanup listener on route change
let currentKeydownHandler = null;

function handleKeydown(e) {
  const revealBtn = document.getElementById('reveal-btn');
  const gradingArea = document.getElementById('grading-area');
  
  if (e.code === 'Space') {
    if (!revealBtn.classList.contains('hidden')) {
      revealBtn.click();
    } else if (gradingArea && !gradingArea.classList.contains('hidden')) {
      // If revealed, space replays audio
      playCurrentAudio();
    }
  }

  if (!gradingArea.classList.contains('hidden')) {
    if (e.code === 'Digit1') document.querySelector('[data-grade="1"]').click();
    if (e.code === 'Digit2') document.querySelector('[data-grade="2"]').click();
    if (e.code === 'Digit3') document.querySelector('[data-grade="3"]').click();
    if (e.code === 'Digit4') document.querySelector('[data-grade="4"]').click();
  }
}

function loadNextCard(app) {
  if (dueQueue.length === 0) {
    document.removeEventListener('keydown', handleKeydown);
    app.navigate('home');
    return;
  }

  currentCard = dueQueue[0];
  
  // Reset UI
  document.getElementById('reveal-btn').classList.remove('hidden');
  document.getElementById('grading-area').classList.add('hidden');
  document.getElementById('full-translation-box').classList.add('hidden');
  document.getElementById('chunks-container').innerHTML = '';
  
  const sentenceEl = document.getElementById('pump-sentence');
  
  // Build Cloze Sentence
  // We assume currentCard has: word, context (the sentence), translation
  let context = currentCard.context || currentCard.word;
  let word = currentCard.word;
  
  // Basic cloze replacement (case insensitive)
  const regex = new RegExp(\`(\${word})\`, 'gi');
  let clozeHtml = context;
  
  if (context.toLowerCase().includes(word.toLowerCase())) {
    clozeHtml = context.replace(regex, '<span class="cloze-blur">$1</span>');
  } else {
    // Fallback if word not in context
    clozeHtml = \`<span class="cloze-blur">\${word}</span>\`;
  }
  
  sentenceEl.innerHTML = clozeHtml;

  // Auto-play audio when card loads
  playCurrentAudio();
}

function playCurrentAudio() {
  if (!currentCard) return;
  
  const textToPlay = currentCard.context || currentCard.word;
  
  // Stop any existing audio
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(textToPlay);
  utterance.lang = 'en-US';
  utterance.rate = 0.9; // Slightly slower for learning
  
  // Visual feedback
  const wave = document.getElementById('audio-wave');
  wave.style.opacity = '1';
  
  utterance.onend = () => {
    wave.style.opacity = '0.5';
  };
  
  window.speechSynthesis.speak(utterance);
}

function revealCard() {
  // Unblur word
  const clozeEl = document.querySelector('.cloze-blur');
  if (clozeEl) {
    clozeEl.classList.remove('cloze-blur');
    clozeEl.classList.add('cloze-revealed');
  }

  // Show Translation
  const transBox = document.getElementById('full-translation-box');
  const transText = document.getElementById('full-translation-text');
  if (currentCard.translation) {
    transText.textContent = currentCard.translation;
    transBox.classList.remove('hidden');
  }

  // Render Chunks (Mock parsing for now if they are strings, but usually they are JSON in V1)
  const chunksContainer = document.getElementById('chunks-container');
  if (currentCard.ai_chunks) {
    try {
      let chunks = typeof currentCard.ai_chunks === 'string' 
        ? JSON.parse(currentCard.ai_chunks) 
        : currentCard.ai_chunks;
      
      chunksContainer.innerHTML = chunks.map((c, i) => \`
        <div class="chunk-card" style="animation: slideIn 0.3s ease forwards; animation-delay: \${i * 0.1}s; opacity:0;">
          <div class="chunk-en">\${c.ingles || c.english || ''}</div>
          <div class="chunk-br">\${c.portugues || c.portuguese || ''}</div>
          <div class="chunk-pt">\${c.fonetica || c.phonetics || ''}</div>
        </div>
      \`).join('');
    } catch(e) {
      console.warn("Could not parse chunks", e);
    }
  } else {
    // If no chunks, show the word itself
    chunksContainer.innerHTML = \`
        <div class="chunk-card" style="opacity:1;">
          <div class="chunk-en">\${currentCard.word}</div>
          <div class="chunk-br">\${currentCard.translation || ''}</div>
        </div>
    \`;
  }

  // Toggle buttons
  document.getElementById('reveal-btn').classList.add('hidden');
  document.getElementById('grading-area').classList.remove('hidden');
}

async function handleGrade(grade, app) {
  // Simple FSRS mock update (Will replace with real fsrs.js later)
  const now = new Date();
  let daysToAdd = 0;
  
  if (grade === 1) daysToAdd = 0; // Today
  if (grade === 2) daysToAdd = 1;
  if (grade === 3) daysToAdd = 3;
  if (grade === 4) daysToAdd = 7;
  
  now.setDate(now.getDate() + daysToAdd);
  
  // Update local object
  currentCard.fsrs_state = 2; // Learning/Review
  currentCard.fsrs_due = now.toISOString();
  currentCard.reps = (currentCard.reps || 0) + 1;
  
  // Save to DB
  await lfDb.updateWord(currentCard);
  
  // Remove from queue
  dueQueue.shift();
  
  // Load next
  loadNextCard(app);
}

function injectStyles() {
  if (document.getElementById('study-styles')) return;
  const style = document.createElement('style');
  style.id = 'study-styles';
  style.innerHTML = \`
    .study-layout { display: flex; height: 100%; width: 100%; background-color: var(--color-bg-alt); }
    .study-main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; position: relative; }
    
    .media-container { width: 100%; max-width: 800px; height: 120px; background: var(--color-surface); border-radius: var(--radius-lg); box-shadow: 0 4px 12px rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: center; margin-bottom: 40px; }
    
    .audio-wave-placeholder { display: flex; align-items: center; gap: 8px; opacity: 0.5; transition: opacity 0.3s; }
    .wave-bar { width: 8px; height: 40px; background: var(--color-secondary); border-radius: 4px; animation: wave 1s infinite alternate; }
    .wave-bar:nth-child(2) { animation-delay: 0.2s; height: 60px; }
    .wave-bar:nth-child(3) { animation-delay: 0.4s; height: 30px; }
    .wave-bar:nth-child(4) { animation-delay: 0.6s; height: 50px; }
    .wave-bar:nth-child(5) { animation-delay: 0.8s; height: 40px; }
    @keyframes wave { 0% { transform: scaleY(0.5); } 100% { transform: scaleY(1.2); } }
    
    .btn-play-audio { background: var(--color-secondary); color: white; border: none; border-bottom: 4px solid var(--color-secondary-shadow); width: 50px; height: 50px; border-radius: 25px; font-size: 20px; cursor: pointer; margin-left: 16px; }
    .btn-play-audio:active { transform: translateY(4px); border-bottom-width: 0; }
    
    .sentence-container { text-align: center; max-width: 800px; }
    .sentence-text { font-size: 36px; font-weight: 800; color: var(--color-text); line-height: 1.4; margin-bottom: 40px; }
    
    .cloze-blur { background: var(--color-border); color: transparent; padding: 0 16px; border-radius: var(--radius-sm); user-select: none; transition: all 0.3s; }
    .cloze-revealed { background: rgba(28, 176, 246, 0.2); color: var(--color-secondary); }
    
    .reveal-btn { font-size: 20px; padding: 16px 40px; width:100%; max-width: 300px; margin: 0 auto; display: block;}
    
    .grading-buttons { margin-top: 20px; }
    .grading-row { display: flex; gap: 16px; }
    .grade-btn { font-family: var(--font-main); font-weight: 800; font-size: 16px; padding: 16px 24px; border-radius: var(--radius-md); border: none; cursor: pointer; color: white; display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 100px; }
    .grade-btn:active { transform: translateY(4px); border-bottom-width: 0 !important; }
    
    .btn-danger { background: var(--color-danger); border-bottom: 4px solid var(--color-danger-shadow); }
    .btn-warning { background: var(--color-warning); border-bottom: 4px solid var(--color-warning-shadow); }
    
    .study-sidebar { width: 350px; background: var(--color-surface); border-left: 2px solid var(--color-border); padding: 24px; overflow-y: auto; }
    .sidebar-title { font-size: 20px; margin-bottom: 24px; color: var(--color-primary); }
    .chunks-list { display: flex; flex-direction: column; gap: 12px; }
    
    .chunk-card { background: var(--color-bg-alt); border: 2px solid var(--color-border); border-radius: var(--radius-md); padding: 16px; }
    .chunk-en { font-weight: 800; font-size: 16px; color: var(--color-text); margin-bottom: 4px; }
    .chunk-br { font-size: 14px; color: var(--color-secondary); font-weight: 700; margin-bottom: 4px; }
    .chunk-pt { font-size: 13px; color: var(--color-text-light); font-style: italic; }
    
    @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  \`;
  document.head.appendChild(style);
}
