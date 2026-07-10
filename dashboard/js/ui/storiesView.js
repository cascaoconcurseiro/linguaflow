import { db } from '../../../utils/db.js';
import { playNaturalAudio, stopAudio } from '../core/tts.js';
import { generateStoryWeb, aiChat } from '../core/ai.js';
import { translator } from '../../../utils/translator.js';
import { lemma } from '../../../utils/lemma.js';

const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;

// Roteadores extensão/web: na extensão o service worker faz o trabalho;
// no site (Vercel) chamamos a Edge Function (história) e o translator
// client-side (Google GTX/MyMemory têm CORS liberado — verificado).
function generateStory(genre, onChunk) {
  if (isExtension) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'ai_generate_story', genre }, resolve);
    });
  }
  return generateStoryWeb(genre, onChunk).catch((e) => ({ error: e.message }));
}

async function translateText(text) {
  if (isExtension) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'translate', text, from: 'en', to: 'pt' }, (res) => {
        resolve(res?.translation || null);
      });
    });
  }
  try {
    const res = await translator.translate(text, 'en', 'pt');
    return res?.translation || null;
  } catch {
    return null;
  }
}

export function renderStories(container, app) {
  container.innerHTML = `
    <div style="padding: 40px; max-width: 900px; margin: 0 auto; padding-bottom:100px; animation: fadeIn 0.4s ease-out; position:relative;">
      <h1 style="font-size: 32px; color: var(--color-text); margin-bottom: 8px;">📚 Histórias Dinâmicas</h1>
      <p style="color:var(--color-text-light); margin-bottom: 24px;">Gere histórias adaptadas ao seu nível, ouça o texto completo ou selecione trechos, estilo LingQ.</p>

      <!-- Tabs -->
      <div style="display:flex; gap:16px; margin-bottom:24px; border-bottom:2px solid var(--color-border); padding-bottom:12px;">
        <button id="tab-new" class="lf-tab active" style="background:none; border:none; font-size:18px; font-weight:bold; color:var(--color-primary); cursor:pointer;">✨ Nova História</button>
        <button id="tab-history" class="lf-tab" style="background:none; border:none; font-size:18px; font-weight:bold; color:var(--color-text-light); cursor:pointer;">📖 Meu Histórico</button>
      </div>

      <!-- Control Panel (New Story) -->
      <div id="panel-new" style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;" class="lf-card-hover">
        <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px;">Escolha o Tema da História</label>
        <div style="display:flex; gap: 16px; flex-wrap:wrap;">
          <select id="story-genre" style="flex:1; padding:12px; border:2px solid var(--color-border); border-radius:var(--radius-sm); font-family:var(--font-main); font-size:16px; min-width: 200px; cursor: pointer; transition: border-color 0.2s;">
            <option value="Dia a Dia">☕ Dia a Dia</option>
            <option value="Viagens">✈️ Viagens</option>
            <option value="Ficção Científica">🚀 Ficção Científica</option>
            <option value="Negócios">💼 Negócios</option>
            <option value="Mistério">🕵️ Mistério</option>
            <option value="Romance">❤️ Romance</option>
            <option value="Aventura">🌋 Aventura</option>
            <option value="História (Fatos reais)">📜 Fatos Históricos</option>
          </select>
          <button id="btn-generate-story" class="btn btn-primary lf-btn-bounce" style="padding: 12px 24px; font-size: 16px; display:flex; align-items:center; gap:8px;">
            <span class="icon">✨</span> Gerar História
          </button>
        </div>
      </div>

      <!-- History Panel -->
      <div id="panel-history" style="display:none; margin-bottom:24px;">
        <div id="history-list" style="display:flex; flex-direction:column; gap:12px;">
          <!-- History items injected here -->
        </div>
      </div>

      <!-- Story Reader Container -->
      <div id="story-reader-container" style="display:none; background: var(--color-surface); border-radius: var(--radius-md); padding: 32px; border: 2px solid var(--color-border); box-shadow: 0 4px 12px rgba(0,0,0,0.05); position:relative;">
        <div id="story-loading" style="display:none; text-align:center; padding: 40px; color:var(--color-text-light);">
          <div class="lf-spin" style="width: 40px; height: 40px; border: 4px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; margin: 0 auto 16px;"></div>
          <p style="font-size: 16px; font-weight:bold;">A IA está escrevendo sua história sob medida...</p>
        </div>
        
        <div id="story-header" style="display:none; margin-bottom:24px; border-bottom:1px solid var(--color-border); padding-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <h2 id="story-title-display" style="margin-top:0; color:var(--color-text); font-size:24px; margin-bottom:8px;"></h2>
              <span id="story-level-badge" style="background:var(--color-primary); color:white; font-size:12px; font-weight:bold; padding:4px 8px; border-radius:12px;">B1</span>
              <span id="story-known-badge" style="background:var(--color-secondary); color:white; font-size:12px; font-weight:bold; padding:4px 8px; border-radius:12px; margin-left:6px; display:none;" title="Percentual de palavras desta história que você já conhece (métrica LingQ)"></span>
            </div>

            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button id="btn-play-story" class="btn btn-primary lf-btn-bounce" style="padding: 8px 16px; font-size: 14px; display:flex; align-items:center; gap:6px;">
                ▶️ Ouvir Tudo
              </button>
              <button id="btn-stop-story" class="btn" style="padding: 8px 16px; font-size: 14px; display:none; align-items:center; gap:6px; background:#f44336; color:white; border:none;">
                ⏹ Parar
              </button>
              <button id="btn-quiz-story" class="btn btn-secondary lf-btn-bounce" style="padding: 8px 16px; font-size: 14px; display:flex; align-items:center; gap:6px;">
                🧠 Testar compreensão
              </button>
              <button id="btn-story-done" class="btn lf-btn-bounce" style="padding: 8px 16px; font-size: 14px; display:flex; align-items:center; gap:6px; background:#ffc800; color:#3c3c3c; border:none; font-weight:800;">
                ✅ Marcar como lida
              </button>
            </div>
          </div>
        </div>

        <!-- Quiz de compreensão (estilo LingQ): perguntas geradas da própria história -->
        <div id="story-quiz-box" style="display:none; margin-bottom:24px; padding:20px; background:var(--color-bg-alt); border:2px dashed var(--color-secondary); border-radius:var(--radius-md);"></div>
        
        <div id="story-content" style="font-size: 20px; line-height: 1.8; color: var(--color-text); font-family: var(--font-main);">
          <!-- Words will be injected here -->
        </div>
      </div>
    </div>
    
    <!-- Word Popup Modal (Simplified LingQ style) -->
    <div id="lf-story-word-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.4); z-index:9999; justify-content:center; align-items:center; backdrop-filter: blur(2px); animation: fadeIn 0.2s ease-out;">
      <div style="background:var(--color-surface); border-radius:var(--radius-md); width:90%; max-width:350px; padding:20px; position:relative; box-shadow: 0 8px 24px rgba(0,0,0,0.15); animation: slideUp 0.2s ease-out;">
        <button id="lf-close-modal" style="position:absolute; top:12px; right:12px; background:none; border:none; font-size:20px; color:var(--color-text-light); cursor:pointer; padding:4px;">&times;</button>
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h2 id="lf-modal-word" style="font-size:24px; font-weight:800; color:var(--color-text); margin:0;">Word</h2>
          <button id="lf-btn-tts-word" style="background:var(--color-bg); border:1px solid var(--color-border); border-radius:50%; width:36px; height:36px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:16px;" title="Ouvir">🔊</button>
        </div>
        
        <div id="lf-modal-loading" style="text-align:center; padding:16px; display:none;">
          <div class="lf-spin" style="width: 20px; height: 20px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; margin: 0 auto 8px;"></div>
        </div>
        
        <div id="lf-modal-explanation" style="font-size:16px; color:var(--color-text); line-height:1.5; margin-bottom:20px; display:none;">
          <!-- AI explanation will go here -->
        </div>

        <button id="lf-btn-save-word" class="btn btn-primary lf-btn-bounce" style="width:100%; padding:12px; font-size:15px; display:none;">
          💾 Salvar
        </button>
      </div>
    </div>

    <!-- Floating Selection Toolbar -->
    <div id="lf-floating-toolbar" style="display:none; position:absolute; z-index:9000; background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-sm); padding:6px; box-shadow:0 4px 12px rgba(0,0,0,0.1); flex-direction:column; gap:4px; animation:fadeIn 0.15s ease-out;">
      <div style="display:flex; gap:6px;">
        <button id="lf-tb-translate" style="background:var(--color-bg); border:1px solid var(--color-border); border-radius:4px; padding:6px 12px; cursor:pointer; font-weight:bold; color:var(--color-text); display:flex; align-items:center; gap:6px; font-size:14px;" class="lf-card-hover">🇧🇷 Traduzir</button>
        <button id="lf-tb-tts" style="background:var(--color-bg); border:1px solid var(--color-border); border-radius:4px; padding:6px 12px; cursor:pointer; font-weight:bold; color:var(--color-text); display:flex; align-items:center; gap:6px; font-size:14px;" class="lf-card-hover">🔊 Ouvir</button>
      </div>
      <div id="lf-tb-translation-result" style="display:none; padding:8px; background:var(--color-bg); border-radius:4px; font-size:14px; color:var(--color-text); max-width:250px; line-height:1.4;"></div>
    </div>
  `;

  if (!document.getElementById('lf-story-styles')) {
    const style = document.createElement('style');
    style.id = 'lf-story-styles';
    style.innerHTML = `
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .story-word { cursor: pointer; transition: all 0.2s; border-radius: 4px; padding: 0 1px; }
      .story-word:hover { background-color: rgba(88,204,2,0.2); color: var(--color-primary); font-weight: 600; }
      .story-word.saved { border-bottom: 2px dashed #ffc800; background: rgba(255,200,0,0.12); } /* aprendendo (LingQ amarelo) */
      .story-word.known { color: var(--color-primary); } /* conhecida (madura ou marcada) */
      .quiz-opt { display:block; width:100%; text-align:left; margin:6px 0; padding:10px 14px; border:2px solid var(--color-border); border-radius:8px; background:var(--color-surface); color:var(--color-text); font-family:var(--font-main); font-size:14px; font-weight:600; cursor:pointer; }
      .quiz-opt:hover { border-color: var(--color-secondary); }
      .quiz-opt.correct { border-color: var(--color-primary); background: rgba(88,204,2,0.15); }
      .quiz-opt.wrong { border-color: #f44336; background: rgba(244,67,54,0.1); }
      .history-item { padding: 16px; border: 2px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); cursor: pointer; display:flex; justify-content:space-between; align-items:center; }
      .history-item:hover { border-color: var(--color-primary); }
      .history-item .level-tag { font-size:11px; font-weight:bold; padding:2px 6px; border-radius:8px; background:var(--color-primary); color:white; margin-left:8px; vertical-align:middle; }
    `;
    document.head.appendChild(style);
  }

  const btnGenerate = document.getElementById('btn-generate-story');
  const storyContainer = document.getElementById('story-reader-container');
  const storyContent = document.getElementById('story-content');
  const storyLoading = document.getElementById('story-loading');
  const storyHeader = document.getElementById('story-header');
  const storyTitleDisplay = document.getElementById('story-title-display');
  const storyLevelBadge = document.getElementById('story-level-badge');
  const genreSelect = document.getElementById('story-genre');

  // Audio Player
  const btnPlayStory = document.getElementById('btn-play-story');
  const btnStopStory = document.getElementById('btn-stop-story');

  // Tabs
  const tabNew = document.getElementById('tab-new');
  const tabHistory = document.getElementById('tab-history');
  const panelNew = document.getElementById('panel-new');
  const panelHistory = document.getElementById('panel-history');
  const historyList = document.getElementById('history-list');

  // Modal elements
  const modal = document.getElementById('lf-story-word-modal');
  const btnCloseModal = document.getElementById('lf-close-modal');
  const modalWord = document.getElementById('lf-modal-word');
  const modalLoading = document.getElementById('lf-modal-loading');
  const modalExplanation = document.getElementById('lf-modal-explanation');
  const btnSaveWord = document.getElementById('lf-btn-save-word');
  const btnTtsWord = document.getElementById('lf-btn-tts-word');

  // Toolbar elements
  const floatingToolbar = document.getElementById('lf-floating-toolbar');
  const tbBtnTranslate = document.getElementById('lf-tb-translate');
  const tbBtnTts = document.getElementById('lf-tb-tts');
  const tbTranslationResult = document.getElementById('lf-tb-translation-result');

  let currentSelectedWord = '';
  let currentSelectedSentence = '';
  let currentWordTranslation = '';   // tradução REAL exibida no modal (fix da auditoria)
  let currentStoryText = '';         // texto da história atual (pro quiz)
  let currentStorySentences = []; // This will also be used by the TTS chunker
  let currentSelectionText = '';
  let storyDoneAwarded = false;      // evita duplo clique em "Marcar como lida"

  // --- Audio Player Logic (TTS Chunker) ---
  let ttsQueue = [];
  let isPlayingTTS = false;
  
  function stopFullStoryTTS() {
    isPlayingTTS = false;
    ttsQueue = [];
    stopAudio();
    btnPlayStory.style.display = 'flex';
    btnStopStory.style.display = 'none';
  }

  function playNextTTSChunk() {
    if (!isPlayingTTS || ttsQueue.length === 0) {
      stopFullStoryTTS();
      return;
    }
    
    const chunk = ttsQueue.shift();
    
    playNaturalAudio(chunk, { lang: 'en-US' }, () => {
      if (isPlayingTTS) playNextTTSChunk();
    });
  }

  function playFullStory() {
    if (currentStorySentences.length === 0) return;
    stopFullStoryTTS();
    isPlayingTTS = true;
    
    btnPlayStory.style.display = 'none';
    btnStopStory.style.display = 'flex';
    
    // We queue the sentences to avoid the 15-second speech synthesis bug in Chromium
    ttsQueue = [...currentStorySentences];
    playNextTTSChunk();
  }

  btnPlayStory.addEventListener('click', playFullStory);
  btnStopStory.addEventListener('click', stopFullStoryTTS);

  // ── Quiz de compreensão (LingQ-style) ─────────────────────────────────────
  // 3 perguntas geradas DA PRÓPRIA história; acertos valem XP real via
  // Learning Engine (story_quiz, cap diário no banco).
  const btnQuizStory = document.getElementById('btn-quiz-story');
  const quizBox = document.getElementById('story-quiz-box');

  async function generateQuiz(storyText) {
    const system = `Você cria perguntas de compreensão de leitura para estudantes de inglês.
Responda APENAS com JSON válido, sem texto extra, neste formato:
{"questions":[{"q":"pergunta em inglês simples","options":["A","B","C","D"],"answer":0}]}
REGRAS: exatamente 3 perguntas SOBRE O CONTEÚDO da história (fatos, intenções, sequência).
As opções devem ser curtas. "answer" é o índice (0-3) da correta. Nível das perguntas: um pouco mais simples que o texto.`;
    const content = await aiChat(
      [{ role: 'system', content: system }, { role: 'user', content: `História:\n"""${storyText.slice(0, 2500)}"""` }],
      { temperature: 0.4, max_tokens: 600 }
    );
    const clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    const qs = (parsed.questions || []).filter(q => q.q && Array.isArray(q.options) && q.options.length >= 2);
    if (!qs.length) throw new Error('Quiz vazio');
    return qs.slice(0, 3);
  }

  function renderQuiz(questions) {
    let answered = 0;
    let correct = 0;
    quizBox.style.display = 'block';
    quizBox.innerHTML = `<h3 style="margin:0 0 12px 0; color:var(--color-text); font-size:18px;">🧠 Você entendeu a história?</h3>` +
      questions.map((q, qi) => `
        <div style="margin-bottom:16px;" data-qi="${qi}">
          <div style="font-weight:800; color:var(--color-text); margin-bottom:6px;">${qi + 1}. ${q.q}</div>
          ${q.options.map((opt, oi) => `<button class="quiz-opt" data-qi="${qi}" data-oi="${oi}">${String.fromCharCode(65 + oi)}) ${opt}</button>`).join('')}
        </div>`).join('') +
      `<div id="quiz-result" style="font-weight:900; color:var(--color-primary); font-size:16px; margin-top:8px;"></div>`;
    quizBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    quizBox.querySelectorAll('.quiz-opt').forEach(btn => {
      btn.addEventListener('click', async () => {
        const qi = Number(btn.dataset.qi), oi = Number(btn.dataset.oi);
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
          resultEl.textContent = `Você acertou ${correct} de ${questions.length}! `;
          if (correct > 0) {
            try {
              const res = await db.recordEvent('story_quiz', correct);
              if (res && res.xp_awarded > 0) resultEl.textContent += `+${res.xp_awarded} XP 🎉`;
              else if (res?.capped) resultEl.textContent += '(limite diário de XP do quiz atingido)';
            } catch (e) { console.warn('[Stories] XP do quiz falhou:', e); }
          }
        }
      });
    });
  }

  btnQuizStory.addEventListener('click', async () => {
    if (!currentStoryText) { app.showToast('Gere ou abra uma história primeiro.', 'info'); return; }
    btnQuizStory.disabled = true;
    btnQuizStory.textContent = '🧠 Gerando perguntas...';
    try {
      const questions = await generateQuiz(currentStoryText);
      renderQuiz(questions);
    } catch (e) {
      console.error('[Stories] Quiz falhou:', e);
      app.showToast('Não consegui gerar o quiz agora. Tente de novo.', 'error');
    } finally {
      btnQuizStory.disabled = false;
      btnQuizStory.textContent = '🧠 Testar compreensão';
    }
  });

  // "Marcar como lida": XP real de leitura (story_read, cap 3/dia no banco)
  const btnStoryDone = document.getElementById('btn-story-done');
  btnStoryDone.addEventListener('click', async () => {
    if (!currentStoryText) { app.showToast('Gere ou abra uma história primeiro.', 'info'); return; }
    if (storyDoneAwarded) { app.showToast('Esta história já foi marcada. 😉', 'info'); return; }
    btnStoryDone.disabled = true;
    try {
      const res = await db.recordEvent('story_read');
      storyDoneAwarded = true;
      if (res && res.xp_awarded > 0) {
        btnStoryDone.textContent = `✅ Lida! +${res.xp_awarded} XP`;
        app.showToast(`📚 +${res.xp_awarded} XP por leitura!`, 'success');
      } else {
        btnStoryDone.textContent = '✅ Lida!';
        app.showToast('História marcada. (Limite diário de XP de leitura atingido.)', 'info');
      }
    } catch (e) {
      console.error('[Stories] XP de leitura falhou:', e);
      app.showToast('Erro ao registrar. Tente de novo.', 'error');
      btnStoryDone.disabled = false;
    }
  });

  function setCurrentStory(text) {
    currentStoryText = text || '';
    storyDoneAwarded = false;
    btnStoryDone.disabled = false;
    btnStoryDone.textContent = '✅ Marcar como lida';
    quizBox.style.display = 'none';
    quizBox.innerHTML = '';
  }
  
  // Cleanup TTS on tab close or navigation
  window.addEventListener('beforeunload', stopFullStoryTTS);

  // Tab Logic
  function switchTab(isNew) {
    if (isNew) {
      tabNew.style.color = 'var(--color-primary)';
      tabHistory.style.color = 'var(--color-text-light)';
      panelNew.style.display = 'block';
      panelHistory.style.display = 'none';
    } else {
      tabNew.style.color = 'var(--color-text-light)';
      tabHistory.style.color = 'var(--color-primary)';
      panelNew.style.display = 'none';
      panelHistory.style.display = 'block';
      storyContainer.style.display = 'none'; 
      stopFullStoryTTS();
      loadHistory();
    }
  }

  tabNew.addEventListener('click', () => switchTab(true));
  tabHistory.addEventListener('click', () => switchTab(false));

  function playTTS(text) {
    if (!text) return;
    playNaturalAudio(text, { lang: 'en-US' });
  }

  btnTtsWord.addEventListener('click', () => playTTS(currentSelectedWord));

  // Story Saving/Loading
  // BUG antigo: usava chrome.storage — no SITE não existe, então o histórico
  // nunca salvava. Agora: localStorage na web, chrome.storage na extensão.
  function readStories(cb) {
    const key = 'lf_saved_stories';
    if (isExtension) {
      chrome.storage.local.get([key], (res) => cb(res[key] || []));
    } else {
      try { cb(JSON.parse(localStorage.getItem(key) || '[]')); }
      catch { cb([]); }
    }
  }

  function writeStories(stories) {
    const key = 'lf_saved_stories';
    if (isExtension) chrome.storage.local.set({ [key]: stories });
    else localStorage.setItem(key, JSON.stringify(stories));
  }

  async function saveStoryLocal(title, text, level, genre) {
    // BANCO primeiro (história = tokens gastos, nunca pode se perder;
    // sincroniza entre dispositivos). Local fica como espelho offline.
    db.saveStory({ title, content: text, level, genre })
      .then((r) => { if (!r?.ok) console.warn('[Stories] Falha ao salvar no banco'); })
      .catch((e) => console.warn('[Stories] Erro ao salvar no banco:', e.message));

    readStories((stories) => {
      stories.unshift({
        id: Date.now().toString(),
        title: title,
        text: text,
        level: level || 'N/A',
        date: new Date().toISOString()
      });
      if (stories.length > 50) stories = stories.slice(0, 50);
      writeStories(stories);
    });
  }

  async function loadHistory() {
    // Fonte da verdade: banco (sincroniza entre dispositivos); local = fallback
    let stories = [];
    try {
      const rows = await db.getStories(50);
      stories = (rows || []).map(r => ({ id: r.id, title: r.title, text: r.content, level: r.level || 'N/A', date: r.created_at }));
    } catch (e) {
      console.warn('[Stories] Banco indisponível, usando histórico local:', e.message);
    }
    if (stories.length === 0) {
      stories = await new Promise((resolve) => readStories(resolve));
    }
    renderHistoryItems(stories);
  }

  function renderHistoryItems(stories) {
    {
      historyList.innerHTML = '';
      if (stories.length === 0) {
        historyList.innerHTML = '<p style="color:var(--color-text-light); text-align:center; padding:20px;">Nenhuma história salva ainda. Gere sua primeira!</p>';
        return;
      }

      stories.forEach(story => {
        const d = new Date(story.date);
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
          <div>
            <div style="font-weight:bold; font-size:18px; color:var(--color-text);">
              ${story.title} <span class="level-tag">${story.level}</span>
            </div>
            <div style="font-size:14px; color:var(--color-text-light);">${d.toLocaleDateString()} ${d.toLocaleTimeString()}</div>
          </div>
          <div style="font-size:24px;">📖</div>
        `;
        div.addEventListener('click', () => {
          stopFullStoryTTS();
          storyTitleDisplay.textContent = story.title;
          storyLevelBadge.textContent = story.level;
          storyHeader.style.display = 'block';
          storyContainer.style.display = 'block';
          storyLoading.style.display = 'none';
          storyContent.style.display = 'block';
          setCurrentStory(story.text);
          renderStoryText(story.text, false);
          storyContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        historyList.appendChild(div);
      });
    }
  }

  // Generation
  btnGenerate.addEventListener('click', async () => {
    const genre = genreSelect.value;
    storyContainer.style.display = 'block';
    storyContent.style.display = 'none';
    storyHeader.style.display = 'none';
    storyLoading.style.display = 'block';
    btnGenerate.disabled = true;
    floatingToolbar.style.display = 'none';
    stopFullStoryTTS();
    
    try {
      // STREAMING (web): o texto da história aparece enquanto é gerado
      const response = await generateStory(genre, (_delta, full) => {
        storyLoading.style.display = 'none';
        storyContent.style.display = 'block';
        storyContent.textContent = full;
      });

      if (!response || !response.story || response.error) {
        throw new Error(response?.error || 'Failed to generate story.');
      }

      const storyText = response.story.trim();
      const storyLevel = response.level || 'B1'; // Default if missing
      
      let title = `${genre} Story`;
      let contentToRender = storyText;
      
      const lines = storyText.split('\n');
      if (lines.length > 0 && lines[0].length < 60 && !lines[0].endsWith('.')) {
        title = lines[0].replace(/[#*]/g, '').trim();
        contentToRender = lines.slice(1).join('\\n').trim();
      }

      storyTitleDisplay.textContent = title;
      storyLevelBadge.textContent = storyLevel;
      storyHeader.style.display = 'block';

      saveStoryLocal(title, contentToRender, storyLevel, genre);
      setCurrentStory(contentToRender);
      renderStoryText(contentToRender, true);
    } catch (err) {
      app.showToast('Erro ao gerar história: ' + err.message, 'error');
      storyContainer.style.display = 'none';
    } finally {
      storyLoading.style.display = 'none';
      storyContent.style.display = 'block';
      btnGenerate.disabled = false;
    }
  });

  // Status por palavra, estilo LingQ: "aprendendo" (salva, card ainda não
  // maduro) vs "conhecida" (card maduro OU marcada como conhecida no Leitor).
  async function getWordStatusSets() {
    try {
      const [words, cards, knownWords] = await Promise.all([
        db.getAllWords(),
        db.getAllCards().catch(() => []),
        db.getAllKnownWords().catch(() => []),
      ]);
      const matureByWordId = {};
      (cards || []).forEach(c => { matureByWordId[c.word_id] = c.status === 'mature'; });
      const learning = new Set();
      const known = new Set();
      (words || []).forEach(w => {
        const key = (w.word || '').toLowerCase();
        if (matureByWordId[w.id]) known.add(key); else learning.add(key);
        const l = lemma(key); if (l && l !== key) (matureByWordId[w.id] ? known : learning).add(l);
      });
      (knownWords || []).forEach(k => {
        known.add((k.word || '').toLowerCase());
        const l = lemma(k.word); if (l) known.add(l);
      });
      return { learning, known };
    } catch(e) {
      return { learning: new Set(), known: new Set() };
    }
  }

  async function renderStoryText(text, animate = false) {
    const { learning: savedWordsSet, known: knownWordsSet } = await getWordStatusSets();
    let knownCount = 0;   // % conhecido da história (o número que engaja no LingQ)
    let totalTokens = 0;
    const paragraphs = text.split('\\n').filter(p => p.trim().length > 0);
    
    storyContent.innerHTML = '';
    
    // Split into sentences for the TTS Chunker and Context finder
    currentStorySentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    // Clean sentences slightly for better TTS
    currentStorySentences = currentStorySentences.map(s => s.trim()).filter(s => s.length > 0);

    const pElements = [];
    paragraphs.forEach(p => {
      const pEl = document.createElement('p');
      pEl.style.marginBottom = '20px';
      const delimRegex = /([\s.,!?;:"'()\[\]{}*#—–\-“”‘’]+)/;
      const tokens = p.split(delimRegex);
      const tokenNodes = [];

      tokens.forEach(token => {
        if (/^[s.,!?;:"'()[]{}*#—–-“”‘’]+$/.test(token) || token.trim() === '') {
          const textNode = document.createTextNode(token);
          if (animate) {
            const wrapper = document.createElement('span');
            wrapper.style.opacity = '0';
            wrapper.appendChild(textNode);
            tokenNodes.push(wrapper);
            pEl.appendChild(wrapper);
          } else {
            pEl.appendChild(textNode);
          }
        } else {
          const span = document.createElement('span');
          span.className = 'story-word';
          span.textContent = token;
          const cleanToken = token.replace(/[^a-zA-Z0-9'-]/g, '').toLowerCase();
          const tokenLemma = lemma(cleanToken) || cleanToken;

          if (knownWordsSet.has(cleanToken) || knownWordsSet.has(tokenLemma)) {
            span.classList.add('known');
            knownCount++;
          } else if (savedWordsSet.has(cleanToken) || savedWordsSet.has(tokenLemma)) {
            span.classList.add('saved');
          }
          if (cleanToken) totalTokens++;
          span.addEventListener('click', (e) => handleWordClick(cleanToken, token, e.target));
          
          if (animate) {
            span.style.opacity = '0';
            tokenNodes.push(span);
          }
          pEl.appendChild(span);
        }
      });
      
      storyContent.appendChild(pEl);
      pElements.push({ pEl, tokenNodes });
    });

    if (animate) {
      let delay = 0;
      const baseDelay = 15;
      pElements.forEach(({ tokenNodes }) => {
        tokenNodes.forEach(node => {
          setTimeout(() => {
            node.style.transition = 'opacity 0.1s ease-in';
            node.style.opacity = '1';
          }, delay);
          delay += baseDelay;
        });
      });
    }

    // Badge "% conhecido" (LingQ): mede o quão compreensível a história é pra VOCÊ
    const knownBadge = document.getElementById('story-known-badge');
    if (knownBadge && totalTokens > 0) {
      const pct = Math.round((knownCount / totalTokens) * 100);
      knownBadge.textContent = `📖 ${pct}% conhecido`;
      knownBadge.style.display = 'inline';
    }
  }

  function findSentenceForWord(rawWord) {
    for (const sent of currentStorySentences) {
      if (sent.includes(rawWord)) return sent.trim();
    }
    return '';
  }

  function handleWordClick(cleanWord, rawWord, spanEl) {
    if (!cleanWord) return;
    
    window.getSelection().removeAllRanges();
    floatingToolbar.style.display = 'none';

    currentSelectedWord = cleanWord;
    currentSelectedSentence = findSentenceForWord(rawWord);
    
    modal.style.display = 'flex';
    modalWord.textContent = rawWord;
    
    modalLoading.style.display = 'block';
    modalExplanation.style.display = 'none';
    modalExplanation.innerHTML = '';
    btnSaveWord.style.display = 'none';

    translateText(cleanWord).then(async (wordTrans) => {
      const sentTrans = currentSelectedSentence ? await translateText(currentSelectedSentence) : null;
      showModalContent(wordTrans, sentTrans);
    });

    function showModalContent(wordTrans, sentTrans) {
      modalLoading.style.display = 'none';
      currentWordTranslation = wordTrans || '';
      if (wordTrans) {
        let html = `<strong>Tradução:</strong> ${wordTrans}<br>`;
        if (sentTrans) {
          html += `<div style="margin-top:8px; font-size:0.9em; color:var(--color-text-light);"><em>Contexto: "${sentTrans}"</em></div>`;
        }
        modalExplanation.innerHTML = html;
        modalExplanation.style.display = 'block';
        btnSaveWord.style.display = 'block';
      } else {
        modalExplanation.textContent = "Erro ao traduzir.";
        modalExplanation.style.display = 'block';
      }
    }
  }

  btnCloseModal.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  btnSaveWord.addEventListener('click', async () => {
    try {
      const btnOriginalText = btnSaveWord.innerHTML;
      btnSaveWord.innerHTML = '<span class="lf-spin"></span> Salvando...';
      
      // FIX (auditoria): salvava com translation placeholder e o campo errado
      // ('context' em vez de 'context_sentence') → o card nascia quebrado,
      // sem tradução e sem frase. Agora vai a tradução REAL do modal.
      const newCard = {
        word: currentSelectedWord,
        translation: currentWordTranslation || null,
        context_sentence: currentSelectedSentence,
        platform: 'story',
      };

      await db.saveWord(newCard);
      app.showToast('Expressão salva no Cofre! âœ…', 'success');
      
      const spans = document.querySelectorAll('.story-word');
      spans.forEach(span => {
        if (span.textContent.toLowerCase().includes(currentSelectedWord)) {
          span.classList.add('saved');
        }
      });

      modal.style.display = 'none';
      btnSaveWord.innerHTML = btnOriginalText;
    } catch (e) {
      app.showToast('Erro ao salvar: ' + e.message, 'error');
      btnSaveWord.innerHTML = '💾 Salvar';
    }
  });

  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      floatingToolbar.style.display = 'none';
      tbTranslationResult.style.display = 'none';
      return;
    }

    const text = selection.toString().trim();
    if (text.length === 0) return;

    let node = selection.anchorNode;
    let isInsideStory = false;
    while (node && node !== document.body) {
      if (node.id === 'story-content') {
        isInsideStory = true;
        break;
      }
      node = node.parentNode;
    }

    if (isInsideStory) {
      currentSelectionText = text;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      const toolbarWidth = 180;
      let top = rect.top + window.scrollY - 50;
      let left = rect.left + window.scrollX + (rect.width / 2) - (toolbarWidth / 2);
      
      if (top < 10) top = rect.bottom + window.scrollY + 10;

      floatingToolbar.style.top = top + 'px';
      floatingToolbar.style.left = left + 'px';
      floatingToolbar.style.display = 'flex';
      tbTranslationResult.style.display = 'none'; 
    } else {
      floatingToolbar.style.display = 'none';
    }
  });

  tbBtnTts.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation(); 
    playTTS(currentSelectionText);
  });

  tbBtnTranslate.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    tbTranslationResult.style.display = 'block';
    tbTranslationResult.innerHTML = '<span class="lf-spin" style="width:14px; height:14px; border-width:2px; display:inline-block;"></span> Traduzindo...';
    
    translateText(currentSelectionText).then((translation) => {
      tbTranslationResult.textContent = translation || 'Erro ao traduzir.';
    });
  });

  document.addEventListener('mousedown', (e) => {
    if (!floatingToolbar.contains(e.target) && !storyContent.contains(e.target)) {
      floatingToolbar.style.display = 'none';
    }
  });
}
