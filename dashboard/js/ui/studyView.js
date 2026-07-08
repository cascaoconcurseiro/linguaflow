import { db as lfDb } from '../../../utils/db.js';

let dueQueue = [];
let currentCard = null;
let consecutiveCorrect = 0;
let sessionCards = 0;
let sessionStart = Date.now();

export async function renderStudy(container, app) {
  injectStyles();
  // Reset session state on each render
  consecutiveCorrect = 0;
  sessionCards = 0;
  sessionStart = Date.now();

  app.showToast('Carregando frases...', 'info');
  try {
    dueQueue = await lfDb.getCardsDue(50, true);
  } catch (e) {
    console.error('DB Error:', e);
    dueQueue = [];
  }

  if (dueQueue.length === 0) {
    container.innerHTML = `
      <div class="study-layout" style="display: flex; height: 100%; width: 100%; justify-content: center; align-items: center; background-color: #f7f9fa;">
        <div class="study-main" style="text-align:center; padding: 60px; background: white; border-radius: var(--radius-lg); box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 2px solid var(--color-border);">
          <h2 style="color:var(--color-primary); font-size: 32px; margin-bottom:16px;">Tudo feito por hoje! 🎉</h2>
          <p style="color:var(--color-text-light); font-size: 18px;">Você revisou todas as suas frases pendentes.</p>
          <button class="btn btn-primary" id="back-home-btn" style="margin-top:32px; padding: 16px 32px; font-size: 18px;">Voltar ao Início</button>
        </div>
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
          <div id="pump-phonetics" style="font-size: 18px; color: var(--color-secondary); font-style: italic; margin-top: 12px;" class="hidden"></div>
          <div id="pump-translation" style="font-size: 20px; font-weight: 700; color: var(--color-text); margin-top: 12px; padding-top: 12px; border-top: 2px dashed var(--color-border);" class="hidden"></div>

          <button id="reveal-btn" class="btn btn-primary reveal-btn" data-step="1">Ver Contexto (Espaço)</button>
        </div>

        <!-- Anki Grading Buttons -->
        <div class="grading-buttons hidden" id="grading-area">
          <div class="grading-row">
            <button class="grade-btn btn-danger" data-grade="1">Errei<br><span style="font-size:12px;opacity:0.8">&lt; 1 min</span></button>
            <button class="grade-btn btn-warning" data-grade="2">Difícil<br><span style="font-size:12px;opacity:0.8">1 dia</span></button>
            <button class="grade-btn btn-secondary" data-grade="3">Bom<br><span style="font-size:12px;opacity:0.8">3 dias</span></button>
            <button class="grade-btn btn-primary" data-grade="4">Fácil<br><span style="font-size:12px;opacity:0.8">7 dias</span></button>
          </div>
        </div>

        <!-- Shadowing Engine Overlay -->
        <div id="shadowing-overlay" class="hidden" style="margin-top: 24px; padding: 16px; background: rgba(88, 204, 2, 0.1); border: 2px dashed var(--color-primary); border-radius: var(--radius-md); text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; animation: pulse 2s infinite;">
          <div style="font-size: 24px; margin-bottom: 8px;">⏳</div>
          <div style="font-size: 18px; font-weight: 800; color: var(--color-primary);">Sua vez... Fale em voz alta!</div>
          <div style="width: 100%; background: #ddd; height: 6px; border-radius: 3px; margin-top: 12px; overflow: hidden;">
            <div id="shadowing-progress" style="width: 0%; height: 100%; background: var(--color-primary); transition: width 3s linear;"></div>
          </div>
        </div>

      </div>

      <!-- Right Panel: Sidebar -->
      <div class="study-sidebar">
        <!-- B3: isolated-word-box at TOP of sidebar -->
        <div id="isolated-word-box" class="hidden" style="margin-bottom: 28px; padding: 24px; background: white; border: 2px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-align:center;">
          <div style="font-size: 28px; font-weight: 900; color: var(--color-primary); margin-bottom: 8px;" id="iso-word"></div>
          <div style="font-size: 18px; color: var(--color-text); font-weight: 700; margin-bottom: 8px;" id="iso-trans"></div>
          <div style="font-size: 14px; color: var(--color-secondary); font-style: italic; background: rgba(28, 176, 246, 0.1); padding: 4px 12px; border-radius: 16px; display: inline-block;" id="iso-phonetics"></div>
          <div style="margin-top: 16px;">
            <a id="youglish-link" href="#" target="_blank" style="color: var(--color-secondary); font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
              📺 Pesquisar no YouGlish
            </a>
          </div>
        </div>

        <h3 class="sidebar-title">Grammar Chunks ✨</h3>
        <div class="chunks-list" id="chunks-container">
          <!-- Dynamically populated -->
        </div>

        <h3 class="sidebar-title" style="margin-top:32px;">AI Grammar ✨</h3>
        <div id="grammar-container" style="font-size:15px; color:var(--color-text); line-height:1.6; background: white; padding: 20px; border-radius: var(--radius-lg); border: 2px solid var(--color-border); box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <p style="color:var(--color-text-light); font-style:italic; text-align:center;">Revise o card para ver a explicação mágica da IA.</p>
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

  if (window.currentKeydownHandler) {
    document.removeEventListener('keydown', window.currentKeydownHandler);
  }
  window.currentKeydownHandler = handleKeydown;
  document.addEventListener('keydown', window.currentKeydownHandler);

  // Load first card
  loadNextCard(app);
}

function handleKeydown(e) {
  const revealBtn = document.getElementById('reveal-btn');
  const gradingArea = document.getElementById('grading-area');

  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  if (e.code === 'Space') {
    e.preventDefault();
    if (revealBtn && !revealBtn.classList.contains('hidden')) {
      revealBtn.click();
    } else if (gradingArea && !gradingArea.classList.contains('hidden')) {
      playCurrentAudio();
    }
  }

  if (gradingArea && !gradingArea.classList.contains('hidden')) {
    if (e.code === 'Digit1') document.querySelector('[data-grade="1"]')?.click();
    if (e.code === 'Digit2') document.querySelector('[data-grade="2"]')?.click();
    if (e.code === 'Digit3') document.querySelector('[data-grade="3"]')?.click();
    if (e.code === 'Digit4') document.querySelector('[data-grade="4"]')?.click();
  }
}

function loadNextCard(app) {
  const container = document.querySelector('.study-layout')?.parentElement;

  if (dueQueue.length === 0) {
    if (window.currentKeydownHandler) {
      document.removeEventListener('keydown', window.currentKeydownHandler);
    }

    const sessionTime = Math.round((Date.now() - sessionStart) / 60000);
    const rootContainer = document.getElementById('app-view') || document.body;
    rootContainer.innerHTML = `
      <div style="display:flex; height:100%; align-items:center; justify-content:center; background:#f7f9fa;">
        <div style="text-align:center; padding:60px; background:white; border-radius:var(--radius-lg); border:2px solid var(--color-border); box-shadow:0 10px 40px rgba(0,0,0,0.08); max-width:500px;">
          <div style="font-size:64px; margin-bottom:16px;">🎉</div>
          <h2 style="color:var(--color-primary); font-size:32px; margin-bottom:8px;">Sessão Concluída!</h2>
          <p style="color:var(--color-text-light); margin-bottom:32px;">Continue assim e você será fluente!</p>
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:32px;">
            <div style="background:var(--color-bg-alt); border-radius:var(--radius-md); padding:16px;">
              <div style="font-size:28px; font-weight:900; color:var(--color-text);">${sessionCards}</div>
              <div style="font-size:13px; color:var(--color-text-light);">Cartas</div>
            </div>
            <div style="background:rgba(88,204,2,0.1); border-radius:var(--radius-md); padding:16px;">
              <div style="font-size:28px; font-weight:900; color:var(--color-primary);">+${sessionCards * 10} XP</div>
              <div style="font-size:13px; color:var(--color-text-light);">XP Ganho</div>
            </div>
            <div style="background:rgba(28,176,246,0.1); border-radius:var(--radius-md); padding:16px;">
              <div style="font-size:28px; font-weight:900; color:var(--color-secondary);">${sessionTime}min</div>
              <div style="font-size:13px; color:var(--color-text-light);">Tempo</div>
            </div>
          </div>
          <button id="session-done-btn" class="btn btn-primary" style="padding:16px 48px; font-size:18px;">Continuar →</button>
        </div>
      </div>
    `;
    setTimeout(() => {
      document.getElementById('session-done-btn')?.addEventListener('click', () => {
        if (window.currentKeydownHandler) document.removeEventListener('keydown', window.currentKeydownHandler);
        app.navigate('home');
      });
    }, 0);
    return;
  }

  currentCard = dueQueue[0];

  // Reset UI
  const revealBtn = document.getElementById('reveal-btn');
  revealBtn.classList.remove('hidden');
  revealBtn.dataset.step = '1';
  revealBtn.textContent = 'Ver Contexto (Espaço)';
  
  document.getElementById('grading-area').classList.add('hidden');
  document.getElementById('pump-phonetics').classList.add('hidden');
  document.getElementById('pump-translation').classList.add('hidden');
  document.getElementById('isolated-word-box').classList.add('hidden');
  document.getElementById('shadowing-overlay').classList.add('hidden');
  document.getElementById('shadowing-progress').style.width = '0%';
  document.getElementById('shadowing-progress').style.transition = 'none';
  document.getElementById('chunks-container').innerHTML = '';
  document.getElementById('grammar-container').innerHTML = '<p style="color:var(--color-text-light); font-style:italic; text-align:center;">Revise o card para ver a explicação mágica da IA.</p>';

  const sentenceEl = document.getElementById('pump-sentence');

  const wordData = currentCard.wordData || {};
  let word = wordData.word || currentCard.word || 'Erro';

  // Step 0: Cego - Show only the word
  sentenceEl.innerHTML = `<span style="font-size: 40px; font-weight: 900; color: var(--color-primary);">${word}</span>`;
}

function playCurrentAudio() {
  if (!currentCard) return;
  const wordData = currentCard.wordData || {};
  const textToPlay = wordData.context_sentence || wordData.word || currentCard.word;

  const wave = document.getElementById('audio-wave');
  if (wave) wave.style.opacity = '1';

  const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textToPlay)}&tl=en-US&client=tw-ob`;
  chrome.runtime.sendMessage({ type: 'FETCH_TTS', url }, (response) => {
    if (response && response.success) {
      const audio = new Audio(response.dataUrl);
      window.currentAudioObj = audio;
      audio.playbackRate = 0.9;
      audio.onended = () => {
        if (wave) wave.style.opacity = '0.5';

        const revealBtn = document.getElementById('reveal-btn');
        if (revealBtn && !revealBtn.classList.contains('hidden')) {
          const shadowingEl = document.getElementById('shadowing-overlay');
          const progressEl = document.getElementById('shadowing-progress');
          if (shadowingEl) {
            shadowingEl.classList.remove('hidden');
            void progressEl.offsetWidth;
            progressEl.style.transition = 'width 3s linear';
            progressEl.style.width = '100%';
            setTimeout(() => {
              shadowingEl.classList.add('hidden');
              progressEl.style.transition = 'none';
              progressEl.style.width = '0%';
            }, 3000);
          }
        }
      };
      audio.play().catch(e => console.warn('Audio play failed', e));
    } else {
      console.error('TTS Fetch failed', response);
      if (wave) wave.style.opacity = '0.5';

      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(textToPlay);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        utterance.onend = () => {
          const revealBtn = document.getElementById('reveal-btn');
          if (revealBtn && !revealBtn.classList.contains('hidden')) {
            const shadowingEl = document.getElementById('shadowing-overlay');
            const progressEl = document.getElementById('shadowing-progress');
            if (shadowingEl) {
              shadowingEl.classList.remove('hidden');
              void progressEl.offsetWidth;
              progressEl.style.transition = 'width 3s linear';
              progressEl.style.width = '100%';
              setTimeout(() => {
                shadowingEl.classList.add('hidden');
                progressEl.style.transition = 'none';
                progressEl.style.width = '0%';
              }, 3000);
            }
          }
        };
        speechSynthesis.speak(utterance);
      }
    }
  });
}

function renderChunkCard(c, i) {
  // B1: try all field name formats
  const engText = c.eng || c.ingles || c.english || '';
  const ptText = c.pt || c.portugues || c.portuguese || '';
  const phonText = c.phon || c.fonetica || c.phonetics || '';
  const safeEng = engText.replace(/"/g, '&quot;');
  return `
    <div class="chunk-card" style="animation: slideIn 0.3s ease forwards; animation-delay: ${i * 0.1}s; opacity:0;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="flex:1;">
          <div class="chunk-en">${engText}</div>
          <div class="chunk-br">${phonText}</div>
          <div class="chunk-pt">${ptText}</div>
        </div>
        <button class="chunk-audio-btn" data-text="${safeEng}" style="background:var(--color-secondary); color:white; border:none; border-radius:50%; width:36px; height:36px; font-size:16px; cursor:pointer; flex-shrink:0; margin-left:8px; display:flex; align-items:center; justify-content:center;">🔊</button>
      </div>
    </div>
  `;
}

function attachChunkAudioListeners() {
  document.querySelectorAll('.chunk-audio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.text;
      if (text) {
        const lang = localStorage.getItem('lf_tts_lang') || 'en-US';
        const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
        chrome.runtime.sendMessage({ type: 'FETCH_TTS', url }, (res) => {
          if (res && res.success) {
            const audio = new Audio(res.dataUrl);
            audio.play().catch(console.warn);
          }
        });
      }
    });
  });
}

function revealCard() {
  const revealBtn = document.getElementById('reveal-btn');
  const step = revealBtn.dataset.step;
  const wordData = currentCard.wordData || {};
  let word = wordData.word || currentCard.word || 'Erro';
  let context = wordData.context_sentence || currentCard.context || word;
  
  // Extract phonetics & direct translation from chunks
  let directTrans = 'Ver contexto';
  let phonetics = 'Fale como um nativo';
  let chunks = [];
  const ai_chunks = (currentCard.wordData && currentCard.wordData.ai_chunks) || currentCard.ai_chunks;
  if (ai_chunks) {
    try {
      chunks = typeof ai_chunks === 'string' ? JSON.parse(ai_chunks) : ai_chunks;
      if (chunks.length > 0) {
        const exactChunk = chunks.find(c =>
          (c.eng || c.ingles || c.english || '').toLowerCase() === word.toLowerCase()
        );
        if (exactChunk) {
          directTrans = exactChunk.pt || exactChunk.portugues || exactChunk.portuguese || directTrans;
          phonetics = exactChunk.phon || exactChunk.fonetica || exactChunk.phonetics || phonetics;
        } else {
          directTrans = chunks[0].pt || chunks[0].portugues || chunks[0].portuguese || directTrans;
          phonetics = chunks[0].phon || chunks[0].fonetica || chunks[0].phonetics || phonetics;
        }
      }
    } catch (e) { console.warn(e); }
  }

  if (step === '1') {
    // Step 1: Reveal context & phonetics, play audio
    const sentenceEl = document.getElementById('pump-sentence');
    const phonEl = document.getElementById('pump-phonetics');
    
    try {
      const regex = new RegExp(`(${word})`, 'gi');
      let clozeHtml = context;
      if (context.toLowerCase().includes(word.toLowerCase())) {
        clozeHtml = context.replace(regex, '<span class="cloze-blur">$1</span>');
      } else {
        clozeHtml = `<span class="cloze-blur">${word}</span>`;
      }
      sentenceEl.innerHTML = clozeHtml;
    } catch (e) {
      sentenceEl.innerHTML = `<span class="cloze-blur">${word}</span>`;
    }
    
    if (phonetics !== 'Fale como um nativo') {
      phonEl.textContent = `🗣️ ${phonetics}`;
      phonEl.classList.remove('hidden');
    }

    revealBtn.dataset.step = '2';
    revealBtn.textContent = 'Revelar Tradução (Espaço)';
    
    playCurrentAudio();
    return;
  }

  // Step 2: Reveal translation, Anki grading, sidebar logic
  const clozeEl = document.querySelector('.cloze-blur');
  if (clozeEl) {
    clozeEl.classList.remove('cloze-blur');
    clozeEl.classList.add('cloze-revealed');
  }

  // Show Translation in the new element
  const transEl = document.getElementById('pump-translation');
  if (wordData.translation || currentCard.translation) {
    transEl.textContent = wordData.translation || currentCard.translation;
    transEl.classList.remove('hidden');
  }

  // Show Isolated Word Box (now at top of sidebar)
  const isoBox = document.getElementById('isolated-word-box');
  document.getElementById('iso-word').textContent = word;
  document.getElementById('iso-trans').textContent = directTrans;
  document.getElementById('iso-phonetics').textContent = `🗣️ Como falam: ${phonetics}`;
  document.getElementById('youglish-link').href = `https://youglish.com/pronounce/${encodeURIComponent(word)}/english`;
  isoBox.classList.remove('hidden');

  // Render Chunks in Sidebar
  const chunksContainer = document.getElementById('chunks-container');
  if (chunks && chunks.length > 0) {
    chunksContainer.innerHTML = chunks.map((c, i) => renderChunkCard(c, i)).join('');
    attachChunkAudioListeners();
  } else {
    chunksContainer.innerHTML = '<div style="display:flex; justify-content:center; padding:20px;"><div class="loading-spinner"></div></div>';
    chrome.runtime.sendMessage({ action: 'ai_generate_chunks', word: wordData.word || currentCard.word }, async (res) => {
      if (res && res.chunks) {
        if (currentCard.wordData) {
          currentCard.wordData.ai_chunks = JSON.stringify(res.chunks);
          lfDb.saveWord(currentCard.wordData).catch(console.error);
        }
        chunksContainer.innerHTML = res.chunks.map((c, i) => renderChunkCard(c, i)).join('');
        attachChunkAudioListeners();
      } else {
        chunksContainer.innerHTML = `
          <div class="chunk-card" style="opacity:1;">
            <div class="chunk-en">${wordData.word || currentCard.word}</div>
            <div class="chunk-br">${wordData.translation || currentCard.translation || ''}</div>
          </div>
        `;
      }
    });
  }

  // Toggle buttons
  document.getElementById('reveal-btn').classList.add('hidden');
  document.getElementById('grading-area').classList.remove('hidden');

  // Fetch AI Grammar
  const grammarContainer = document.getElementById('grammar-container');
  grammarContainer.innerHTML = '<div style="display:flex; justify-content:center; padding:20px;"><div class="loading-spinner"></div></div><p style="color:var(--color-primary); font-weight:bold; text-align:center;">A IA está analisando a gramática...</p>';

  chrome.runtime.sendMessage(
    {
      action: 'ai_explain_sentence',
      sentence: wordData.context_sentence || currentCard.context || currentCard.word,
      fullContext: null
    },
    (response) => {
      if (response && response.analysis) {
        grammarContainer.innerHTML = `<p>${response.analysis.replace(/\n/g, '<br>')}</p>`;
      } else {
        grammarContainer.innerHTML = '<p style="color:var(--color-danger); text-align:center; font-weight:bold;">Falha ao carregar análise da IA.</p>';
      }
    }
  );
}

function playFeedbackSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
  } catch (e) {}
}

function showXPAnimation(text, isPositive = true) {
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

async function handleGrade(grade, app) {
  const isCorrect = grade >= 2;
  playFeedbackSound(isCorrect ? 'correct' : 'wrong');

  if (isCorrect) {
    const xp = parseInt(localStorage.getItem('lf_xp_today') || '0') + 10;
    localStorage.setItem('lf_xp_today', xp);
    consecutiveCorrect++;
    showXPAnimation('+10 XP');
    if (consecutiveCorrect === 5) app.showToast('🔥 5 em sequência! Continue!', 'info');
    if (consecutiveCorrect === 10) app.showToast('🚀 Você está em chamas! 10 seguidos!', 'info');
  } else {
    consecutiveCorrect = 0;
    showXPAnimation('Próxima vez! 💪', false);
  }

  sessionCards++;
  try {
    await lfDb.logReview(currentCard.id, grade);
  } catch (e) {
    console.error('Failed to log review:', e);
  }
  dueQueue.shift();
  loadNextCard(app);
}

function injectStyles() {
  if (document.getElementById('study-styles')) return;
  const style = document.createElement('style');
  style.id = 'study-styles';
  style.innerHTML = `
    .study-layout { display: flex; height: 100%; width: 100%; background-color: #f7f9fa; }
    .study-main { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 40px; position: relative; overflow-y: auto;}

    .media-container { width: 100%; max-width: 800px; height: 100px; background: white; border: 2px solid var(--color-border); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; margin-bottom: 32px; }

    .audio-wave-placeholder { display: flex; align-items: center; gap: 8px; opacity: 0.5; transition: opacity 0.3s; }
    .wave-bar { width: 8px; height: 30px; background: var(--color-secondary); border-radius: 4px; animation: wave 1s infinite alternate; }
    .wave-bar:nth-child(2) { animation-delay: 0.2s; height: 50px; }
    .wave-bar:nth-child(3) { animation-delay: 0.4s; height: 20px; }
    .wave-bar:nth-child(4) { animation-delay: 0.6s; height: 40px; }
    .wave-bar:nth-child(5) { animation-delay: 0.8s; height: 30px; }
    @keyframes wave { 0% { transform: scaleY(0.5); } 100% { transform: scaleY(1.2); } }

    .btn-play-audio { background: var(--color-secondary); color: white; border: none; border-bottom: 4px solid var(--color-secondary-shadow); width: 44px; height: 44px; border-radius: 22px; font-size: 18px; cursor: pointer; margin-left: 16px; display:flex; align-items:center; justify-content:center;}
    .btn-play-audio:active { transform: translateY(4px); border-bottom-width: 0; }

    .sentence-container { text-align: center; max-width: 800px; width: 100%; margin-bottom: 32px;}
    .sentence-text { font-size: 32px; font-weight: 800; color: var(--color-text); line-height: 1.5; margin-bottom: 32px; }

    .cloze-blur { background: var(--color-border); color: transparent; padding: 0 16px; border-radius: var(--radius-md); user-select: none; transition: all 0.3s; display: inline-block; min-width: 60px;}
    .cloze-revealed { background: rgba(88, 204, 2, 0.15); color: var(--color-primary); }

    .reveal-btn { font-size: 20px; padding: 16px 40px; width:100%; max-width: 320px; margin: 0 auto; display: block; box-shadow: 0 4px 0 var(--color-primary-shadow);}

    .grading-buttons { margin-top: 16px; width: 100%; max-width: 600px;}
    .grading-row { display: flex; gap: 16px; width: 100%;}
    .grade-btn { flex: 1; font-family: var(--font-main); font-weight: 800; font-size: 18px; padding: 16px 8px; border-radius: var(--radius-md); border: none; cursor: pointer; color: white; display: flex; flex-direction: column; align-items: center; gap: 6px; transition: transform 0.1s, box-shadow 0.1s; }
    .grade-btn:active { transform: translateY(4px); box-shadow: 0 0 0 transparent !important; }

    .btn-danger { background: #ff4b4b; box-shadow: 0 4px 0 #cc3c3c; }
    .btn-warning { background: #ff9600; box-shadow: 0 4px 0 #cc7800; }
    .btn-secondary { background: var(--color-secondary); box-shadow: 0 4px 0 var(--color-secondary-shadow); }

    .study-sidebar { width: 380px; background: white; border-left: 2px solid var(--color-border); padding: 32px; overflow-y: auto; }
    .sidebar-title { font-size: 22px; font-weight: 900; margin-bottom: 24px; color: var(--color-text); display:flex; align-items:center; gap:8px;}
    .chunks-list { display: flex; flex-direction: column; gap: 16px; }

    .chunk-card { background: white; border: 2px solid var(--color-border); border-radius: var(--radius-lg); padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); position: relative; overflow: hidden;}
    .chunk-card::before { content:''; position:absolute; left:0; top:0; bottom:0; width:6px; background:var(--color-primary);}
    .chunk-en { font-weight: 900; font-size: 18px; color: var(--color-text); margin-bottom: 6px; }
    .chunk-br { font-size: 15px; color: var(--color-secondary); font-weight: 800; margin-bottom: 8px; }
    .chunk-pt { font-size: 14px; color: var(--color-text-light); font-style: italic; background: #f0f0f0; display: inline-block; padding: 4px 10px; border-radius: 12px;}

    @media (max-width: 768px) {
      .study-layout { flex-direction: column; }
      .study-sidebar { width: 100%; border-left: none; border-top: 2px solid var(--color-border); }
      .grading-row { flex-wrap: wrap; }
      .grade-btn { flex: 1 1 40%; }
    }

    @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

    @keyframes xpFloat {
      0% { opacity:1; transform:translate(-50%,-50%) scale(1); }
      50% { opacity:1; transform:translate(-50%,-80%) scale(1.2); }
      100% { opacity:0; transform:translate(-50%,-120%) scale(0.8); }
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(88, 204, 2, 0.2);
      border-left-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
}
