import { db } from '../../../utils/db.js';
import { playNaturalAudio, stopAudio } from '../core/tts.js';
import { generateStoryWeb, aiChat } from '../core/ai.js';
import { measureStoryLevel } from '../core/readability.js';
import { translator } from '../../../utils/translator.js';
import { lemma } from '../../../utils/lemma.js';
import { bindViewStateAction, renderViewState } from './viewState.js';
import { bindReadingHeader, renderReadingHeader } from './readingHub.js';

const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
let storiesDocumentController = null;

// Roteadores extensão/web: na extensão o service worker faz o trabalho;
// no site (Vercel) chamamos a Edge Function (história) e o translator
// client-side (Google GTX/MyMemory têm CORS liberado — verificado).
function generateStory(genre, onChunk, userWords = []) {
  if (isExtension) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'ai_generate_story', genre }, resolve);
    });
  }
  return generateStoryWeb(genre, onChunk, userWords).catch((e) => ({ error: e.message }));
}

// Palavras pro REENCONTRO na história (Marco 3): fracas primeiro (3+ lapsos/
// leech), depois as em aprendizado mais recentes — até 8.
async function getReencounterWords() {
  try {
    const [cards, words] = await Promise.all([db.getAllCards(), db.getAllWords()]);
    const wordById = {};
    words.forEach(w => { wordById[w.id] = w; });
    const nameOf = (c) => wordById[c.word_id]?.word;
    const weak = cards
      .filter(c => !c.suspended && ((c.lapses || 0) >= 3 || c.is_leech))
      .sort((a, b) => (b.lapses || 0) - (a.lapses || 0))
      .map(nameOf).filter(Boolean);
    const inProgress = cards
      .filter(c => !c.suspended && (c.status === 'learning' || c.status === 'review'))
      .sort((a, b) => new Date(b.last_review || 0) - new Date(a.last_review || 0))
      .map(nameOf).filter(Boolean);
    return [...new Set([...weak, ...inProgress])].slice(0, 8);
  } catch { return []; }
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
  storiesDocumentController?.abort();
  const documentController = new AbortController();
  storiesDocumentController = documentController;
  app.onLeaveView?.(() => {
    if (storiesDocumentController === documentController) storiesDocumentController = null;
    documentController.abort();
    stopAudio();
  });
  container.innerHTML = `
    <div class="story-page">
      ${renderReadingHeader('stories')}

      <!-- Tabs -->
      <div class="story-mode-tabs" role="tablist" aria-label="Escolher modo de histórias">
        <button id="tab-new" role="tab" aria-selected="true" aria-controls="panel-new" class="lf-tab active">Criar</button>
        <button id="tab-history" role="tab" aria-selected="false" aria-controls="panel-history" class="lf-tab">Ler</button>
      </div>

      <!-- Control Panel (New Story) -->
      <div id="panel-new" role="tabpanel" aria-labelledby="tab-new" class="story-create-panel lf-card-hover">
        <h2 style="font-size:20px; color:var(--color-text); margin:0 0 6px;">Criar uma história</h2>
        <p style="color:var(--color-text-light); margin:0 0 16px; font-size:14px;">O texto usa seu nível e prioriza reencontros úteis.</p>
        <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px;" for="story-genre">Tema</label>
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
            <span class="icon" aria-hidden="true">✨</span> Criar história
          </button>
        </div>
      </div>

      <!-- History Panel -->
      <div id="panel-history" role="tabpanel" aria-labelledby="tab-history" hidden style="margin-bottom:24px;">
        <div class="story-library-heading"><h2>Prontas para ler</h2><p>Continue uma história salva ou reencontre expressões em outro contexto.</p></div>
        <div id="history-list" style="display:flex; flex-direction:column; gap:12px;">
          <!-- History items injected here -->
        </div>
      </div>

      <!-- Story Reader Container -->
      <div id="story-reader-container" style="display:none; background: var(--color-surface); border-radius: var(--radius-md); padding: clamp(16px, 4vw, 32px); border: 2px solid var(--color-border); box-shadow: 0 4px 12px rgba(0,0,0,0.05); position:relative;">
        <div id="story-loading" style="display:none; text-align:center; padding: 40px; color:var(--color-text-light);">
          <div class="lf-spin" style="width: 40px; height: 40px; border: 4px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; margin: 0 auto 16px;"></div>
          <p style="font-size: 16px; font-weight:bold;">Criando sua história…</p>
        </div>
        
        <div id="story-header" style="display:none; margin-bottom:24px; border-bottom:1px solid var(--color-border); padding-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
            <div>
              <h2 id="story-title-display" style="margin-top:0; color:var(--color-text); font-size:24px; margin-bottom:8px;"></h2>
              <span id="story-level-badge" style="background:var(--color-primary); color:white; font-size:12px; font-weight:bold; padding:4px 8px; border-radius:12px;">B1</span>
              <span id="story-known-badge" style="background:var(--color-secondary); color:white; font-size:12px; font-weight:bold; padding:4px 8px; border-radius:12px; margin-left:6px; display:none;" title="Estimativa que combina termos marcados por você e itens com memória estável; não mede compreensão."></span>
              <div id="story-reencounter" style="display:none; font-size:12px; color:var(--color-text-light); margin-top:6px;"></div>
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
  bindReadingHeader(container, app);

  if (!document.getElementById('lf-story-styles')) {
    const style = document.createElement('style');
    style.id = 'lf-story-styles';
    style.innerHTML = `
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .story-word { cursor: pointer; transition: color var(--motion-fast), background-color var(--motion-fast); border-radius: 4px; padding: 0 1px; }
      .story-word:hover { background-color: rgba(88,204,2,0.2); color: var(--color-primary); font-weight: 600; }
      .story-word:focus-visible { outline: 3px solid var(--color-secondary); outline-offset: 2px; }
      .story-word.saved { border-bottom: 2px dashed #ffc800; background: rgba(255,200,0,0.12); } /* aprendendo (LingQ amarelo) */
      .story-word.known { color: var(--color-primary); } /* conhecida (madura ou marcada) */
      .quiz-opt { display:block; width:100%; text-align:left; margin:6px 0; padding:10px 14px; border:2px solid var(--color-border); border-radius:8px; background:var(--color-surface); color:var(--color-text); font-family:var(--font-main); font-size:14px; font-weight:600; cursor:pointer; }
      .quiz-opt:hover, .quiz-opt:focus-visible { border-color: var(--color-secondary); }
      .quiz-opt.correct { border-color: var(--color-primary); background: rgba(88,204,2,0.15); }
      .quiz-opt.wrong { border-color: #f44336; background: rgba(244,67,54,0.1); }
      .history-item { padding: 16px; border: 2px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); cursor: pointer; display:flex; justify-content:space-between; align-items:center; }
      .history-item:hover { border-color: var(--color-primary); }
      .story-act { background:none; border:1px solid var(--color-border); border-radius:8px; padding:6px 9px; cursor:pointer; font-size:15px; line-height:1; }
      .story-act:hover, .story-act:focus-visible { border-color: var(--color-secondary); }
      .story-archive-toggle { display:block; width:100%; margin:4px 0 10px; padding:8px; border:1px dashed var(--color-border); border-radius:10px; background:transparent; color:var(--color-text-light); font:700 13px var(--font-main); cursor:pointer; }
      .history-item.archived { opacity:.55; }
      .history-item .level-tag { font-size:11px; font-weight:bold; padding:2px 6px; border-radius:8px; background:var(--color-primary); color:white; margin-left:8px; vertical-align:middle; }
      .story-mode-tabs { display:grid; grid-template-columns:1fr 1fr; gap:6px; padding:5px; margin-bottom:24px; border:1px solid var(--color-border); border-radius:14px; background:var(--color-bg-alt); }
      .story-mode-tabs .lf-tab { min-height:46px; border:0; border-radius:10px; background:transparent; color:var(--color-text-light); font:800 15px var(--font-main); cursor:pointer; }
      .story-mode-tabs .lf-tab.active { color:var(--color-text); background:var(--color-surface); box-shadow:var(--shadow-sm); }
      .story-library-heading { margin-bottom:16px; }
      .story-library-heading h2 { margin:0 0 4px; color:var(--color-text); font-size:20px; }
      .story-library-heading p { margin:0; color:var(--color-text-light); font-size:14px; }
      @media (max-width: 480px) {
        #story-content { font-size: 17px !important; line-height: 1.7 !important; }
        #story-title-display { font-size: 20px !important; }
      }
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
  let storyMarkedThisView = false;
  let previousQuizQuestions = [];
  let modalRequestId = 0;

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
  // Perguntas geradas da própria história oferecem feedback local. Como o
  // gabarito é gerado por IA no cliente, o resultado não alimenta o placar.
  const btnQuizStory = document.getElementById('btn-quiz-story');
  const quizBox = document.getElementById('story-quiz-box');

  function normalizeQuiz(rawQuestions) {
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
      if (!q || seen.has(key) || options.length !== 4 || new Set(options.map(option => option.toLocaleLowerCase())).size !== 4 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) continue;
      seen.add(key);
      questions.push({ q, options, answer });
    }
    // Antes travava em EXATAMENTE 3 (descartava o quiz inteiro se a IA
    // devolvesse 1 a mais/menos por variação natural). Passou a aceitar 3-5,
    // mas o mesmo bug se escondeu de novo: `length <= 5` ainda descartava o
    // quiz INTEIRO se a IA mandasse 6+ perguntas válidas, em vez de simplesmente
    // cortar pras 5 primeiras (Onda 9, auditoria de bugs). Corta ANTES de checar.
    const capped = questions.slice(0, 5);
    return capped.length >= 3 ? capped : [];
  }

  async function generateQuiz(storyText) {
    const aspects = [
      'fatos e detalhes específicos (quem/o quê/onde/quando)',
      'intenções e sentimentos dos personagens',
      'ordem dos acontecimentos e relações de causa e efeito',
      'inferências apoiadas pelo texto',
      'vocabulário em contexto, sem pedir tradução da frase inteira',
    ];
    // Onda 8: era sempre exatamente 3 perguntas — agora varia (3 a 5), pra
    // não ficar previsível e testar mais aspectos da história.
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
      [{ role: 'system', content: system }, { role: 'user', content: `História:\n"""${storyText.slice(0, 2500)}"""\nVariação: ${Date.now() % 100000}` }],
      { temperature: 0.75, max_tokens: 600 }
    );
    const clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    const questions = normalizeQuiz(parsed.questions);
    if (!questions.length) throw new Error('Quiz inválido');
    previousQuizQuestions.push(...questions.map(question => question.q));
    return questions.map(question => {
      const indexes = question.options.map((_, index) => index).sort(() => Math.random() - 0.5);
      return { ...question, options: indexes.map(index => question.options[index]), answer: indexes.indexOf(question.answer) };
    });
  }

  function renderQuiz(questions) {
    let answered = 0;
    let correct = 0;
    quizBox.style.display = 'block';
    quizBox.replaceChildren();
    // Onda 8: o texto ficava visível embaixo do quiz o tempo todo — dava pra
    // rolar e colar a resposta em vez de responder de memória. Agora esconde
    // por padrão; reler é uma escolha consciente (botão), não um vazamento.
    storyContent.style.display = 'none';
    const heading = document.createElement('h3');
    heading.textContent = '🧠 Você entendeu a história? (sem espiar o texto!)';
    heading.style.cssText = 'margin:0 0 4px 0; color:var(--color-text); font-size:18px;';
    quizBox.appendChild(heading);
    const revealBtn = document.createElement('button');
    revealBtn.type = 'button';
    revealBtn.textContent = '👀 Não lembro — reler o texto';
    revealBtn.style.cssText = 'background:none; border:none; color:var(--color-text-light); font-family:var(--font-main); font-size:12px; font-weight:700; text-decoration:underline; cursor:pointer; margin-bottom:14px; padding:0;';
    revealBtn.addEventListener('click', () => {
      const revealed = storyContent.style.display !== 'none';
      storyContent.style.display = revealed ? 'none' : 'block';
      revealBtn.textContent = revealed ? '👀 Não lembro — reler o texto' : '🙈 Esconder o texto de novo';
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
          resultEl.textContent += 'Prática de compreensão — sem alterar XP, ofensiva ou liga.';
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

  // Marcar como lida é feedback local enquanto não existe uma evidência de
  // leitura identificável e idempotente no servidor.
  const btnStoryDone = document.getElementById('btn-story-done');
  btnStoryDone.addEventListener('click', async () => {
    if (!currentStoryText) { app.showToast('Gere ou abra uma história primeiro.', 'info'); return; }
    if (storyMarkedThisView) { app.showToast('Esta história já foi marcada nesta leitura.', 'info'); return; }
    btnStoryDone.disabled = true;
    storyMarkedThisView = true;
    btnStoryDone.textContent = '✅ Lida nesta sessão';
    app.showToast('Leitura concluída. Esta marca não altera XP, ofensiva ou liga.', 'success');
  });

  function setCurrentStory(text) {
    currentStoryText = text || '';
    storyMarkedThisView = false;
    previousQuizQuestions = [];
    btnStoryDone.disabled = false;
    btnStoryDone.textContent = '✅ Marcar como lida';
    quizBox.style.display = 'none';
    quizBox.innerHTML = '';
  }
  
  // Cleanup TTS on tab close or navigation
  window.addEventListener('beforeunload', stopFullStoryTTS);

  // Tab Logic
  function switchTab(isNew) {
    tabNew.classList.toggle('active', isNew);
    tabHistory.classList.toggle('active', !isNew);
    tabNew.setAttribute('aria-selected', String(isNew));
    tabHistory.setAttribute('aria-selected', String(!isNew));
    if (isNew) {
      panelNew.style.display = 'block';
      panelHistory.hidden = true;
    } else {
      panelNew.style.display = 'none';
      panelHistory.hidden = false;
      storyContainer.style.display = 'none'; 
      stopFullStoryTTS();
      loadHistory();
    }
  }

  tabNew.addEventListener('click', () => switchTab(true));
  tabHistory.addEventListener('click', () => switchTab(false));

  // Áudio blindado (bug relatado: "o áudio de lá não funciona"): para o que
  // estiver tocando, e se o TTS principal falhar cai pro sintetizador nativo
  // do navegador — NUNCA falha em silêncio.
  function speakFallback(text) {
    try {
      window.speechSynthesis?.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      window.speechSynthesis?.speak(u);
    } catch { app.showToast?.('Áudio indisponível neste navegador.', 'error'); }
  }

  function playTTS(text) {
    if (!text) return;
    // O módulo de TTS tenta áudio natural e cai para Web Speech quando a rede falha.
    playNaturalAudio(text, { lang: 'en-US' }).catch(() => {
      app.showToast?.('Áudio indisponível neste navegador.', 'error');
    });
  }

  btnTtsWord.addEventListener('click', () => playTTS(currentSelectedWord));

  // Tooltip é uma ajuda opcional: mostra apenas a tradução da palavra, nunca
  // a frase. Também responde ao foco para funcionar com teclado.
  const wordTooltip = document.createElement('div');
  wordTooltip.setAttribute('role', 'tooltip');
  wordTooltip.style.cssText = 'position:fixed; display:none; z-index:9500; background:var(--color-surface); border:2px solid var(--color-secondary); border-radius:8px; padding:6px 10px; font-size:13px; font-weight:700; color:var(--color-text); box-shadow:0 4px 12px rgba(0,0,0,0.15); pointer-events:none; max-width:240px;';
  document.body.appendChild(wordTooltip);
  let tooltipTimer = null;
  let tooltipRequestId = 0;
  const hideWordTooltip = () => {
    tooltipRequestId++;
    if (tooltipTimer) clearTimeout(tooltipTimer);
    wordTooltip.style.display = 'none';
  };
  const showWordTooltip = (span) => {
    const token = span?.textContent?.replace(/[^a-zA-Z0-9'-]/g, '').toLowerCase();
    if (!token) return;
    const requestId = ++tooltipRequestId;
    if (tooltipTimer) clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(async () => {
      const rect = span.getBoundingClientRect();
      wordTooltip.textContent = '…';
      wordTooltip.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 250))}px`;
      wordTooltip.style.top = `${Math.max(8, rect.top - 38)}px`;
      wordTooltip.style.display = 'block';
      const translation = await translateText(token);
      if (requestId !== tooltipRequestId) return;
      wordTooltip.textContent = translation || 'Tradução indisponível';
    }, 300);
  };
  storyContent.addEventListener('mouseover', (event) => {
    const word = event.target.closest('.story-word');
    if (word) showWordTooltip(word);
  });
  storyContent.addEventListener('mouseout', (event) => {
    if (event.target.closest('.story-word')) hideWordTooltip();
  });
  storyContent.addEventListener('focusin', (event) => {
    const word = event.target.closest('.story-word');
    if (word) showWordTooltip(word);
  });
  storyContent.addEventListener('focusout', hideWordTooltip);

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

  // Arquivar sem migration: ids num k/v de settings (mesmo padrao de
  // lf_achievements_seen). Excluir usa db.deleteStory, que ja existia sem UI.
  let showArchivedStories = false;
  const storyKey = (story) => String(story.id || `${story.title}|${story.date}`);

  async function readArchivedSet() {
    try {
      const raw = await db.getSetting('lf_archived_stories');
      return new Set(JSON.parse(raw || '[]'));
    } catch { return new Set(); }
  }

  async function toggleArchiveStory(story) {
    const key = storyKey(story);
    const current = await readArchivedSet();
    if (current.has(key)) current.delete(key); else current.add(key);
    await db.setSetting('lf_archived_stories', JSON.stringify([...current])).catch(() => {});
    loadHistory();
  }

  async function removeStory(story) {
    if (!confirm(`Excluir "${story.title}" para sempre? Isso nao pode ser desfeito.`)) return;
    try {
      if (story.id) await db.deleteStory(story.id);
    } catch (e) {
      app.showToast('Nao foi possivel excluir agora. Tente de novo.', 'error');
      return;
    }
    // remove tambem da copia local (fallback offline)
    readStories((list) => writeStories((list || []).filter(
      (item) => !(item.title === story.title && item.date === story.date))));
    app.showToast('Historia excluida.', 'success');
    loadHistory();
  }

  // A4 do backlog: o selo mostrava o nivel PEDIDO, nunca verificado. Mede o
  // nivel real com a cefr-wordlist e, se divergir, mostra os dois.
  let cefrMapCache = null;
  async function measureAndShowLevel(text, requested) {
    try {
      if (!cefrMapCache) {
        const isExt = typeof chrome !== 'undefined' && !!chrome.runtime?.id;
        const base = isExt ? chrome.runtime.getURL('utils/') : '/utils/';
        cefrMapCache = await fetch(`${base}cefr-wordlist.json`).then((r) => r.json());
      }
      const measured = measureStoryLevel(text, cefrMapCache);
      if (!measured.level) return;
      if (measured.level !== requested) {
        storyLevelBadge.textContent = `pedido ${requested} · medido ${measured.level}`;
        storyLevelBadge.title = `${Math.round(measured.coverage * 100)}% do vocabulario reconhecido esta coberto ate ${measured.level}`;
      } else {
        storyLevelBadge.textContent = requested;
        storyLevelBadge.title = 'Nivel confirmado pela medicao de vocabulario';
      }
    } catch { /* sem medicao, o selo fica com o pedido */ }
  }

  async function loadHistory() {
    // Fonte da verdade: banco (sincroniza entre dispositivos); local = fallback
    historyList.setAttribute('aria-busy', 'true');
    historyList.innerHTML = renderViewState({ kind: 'loading', title: 'Carregando suas histórias…', message: 'Sincronizando o que você já criou.', compact: true });
    let stories = [];
    let remoteFailed = false;
    try {
      const rows = await db.getStories(50);
      stories = (rows || []).map(r => ({ id: r.id, title: r.title, text: r.content, level: r.level || 'N/A', date: r.created_at }));
    } catch (e) {
      remoteFailed = true;
      console.warn('[Stories] Banco indisponível, usando histórico local:', e.message);
    }
    if (stories.length === 0) {
      stories = await new Promise((resolve) => readStories(resolve));
    }
    const archivedSet = await readArchivedSet();
    renderHistoryItems(stories, { remoteFailed, archivedSet });
    historyList.setAttribute('aria-busy', 'false');
  }

  function renderHistoryItems(stories, { remoteFailed = false, archivedSet = new Set() } = {}) {
    {
      historyList.innerHTML = '';
      if (remoteFailed && stories.length === 0) {
        historyList.innerHTML = renderViewState({ kind: 'error', title: 'Não foi possível carregar suas histórias', message: 'Verifique a conexão e tente novamente. Nenhuma coleção vazia será assumida enquanto a leitura falhar.', actionLabel: 'Tentar novamente', actionId: 'btn-stories-retry', compact: true });
        bindViewStateAction(historyList, 'btn-stories-retry', loadHistory);
        return;
      }
      if (stories.length === 0) {
        historyList.innerHTML = '<div class="story-empty"><strong>Nenhuma história pronta ainda.</strong><span>Abra Criar e escolha um tema para começar.</span><button type="button" class="btn btn-primary" id="btn-empty-create">Criar primeira história</button></div>';
        historyList.querySelector('#btn-empty-create')?.addEventListener('click', () => switchTab(true));
        return;
      }

      if (remoteFailed) {
        const notice = document.createElement('div');
        notice.className = 'story-sync-notice';
        notice.setAttribute('role', 'status');
        notice.textContent = 'Mostrando histórias deste dispositivo. A sincronização está indisponível no momento.';
        historyList.appendChild(notice);
      }

      const archivedStories = stories.filter((st) => archivedSet.has(storyKey(st)));
      const visibleStories = showArchivedStories
        ? stories
        : stories.filter((st) => !archivedSet.has(storyKey(st)));

      if (archivedStories.length > 0) {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'story-archive-toggle';
        toggle.textContent = showArchivedStories
          ? `Ocultar arquivadas (${archivedStories.length})`
          : `Mostrar arquivadas (${archivedStories.length})`;
        toggle.addEventListener('click', () => {
          showArchivedStories = !showArchivedStories;
          renderHistoryItems(stories, { remoteFailed, archivedSet });
        });
        historyList.appendChild(toggle);
      }

      visibleStories.forEach(story => {
        const d = new Date(story.date);
        const div = document.createElement('div');
        div.className = 'history-item';
        div.tabIndex = 0;
        div.setAttribute('role', 'button');
        div.innerHTML = `
          <div>
            <div style="font-weight:bold; font-size:18px; color:var(--color-text);">
              ${story.title} <span class="level-tag">${story.level}</span>
            </div>
            <div style="font-size:14px; color:var(--color-text-light);">${d.toLocaleDateString()} ${d.toLocaleTimeString()}</div>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <button type="button" class="story-act" data-act="arch" title="${archivedSet.has(storyKey(story)) ? 'Restaurar do arquivo' : 'Arquivar (sai da lista, nada e apagado)'}">${archivedSet.has(storyKey(story)) ? '📤' : '📦'}</button>
            <button type="button" class="story-act" data-act="del" title="Excluir para sempre">🗑</button>
          </div>
        `;
        if (archivedSet.has(storyKey(story))) div.classList.add('archived');
        div.querySelector('[data-act="arch"]').addEventListener('click', (event) => {
          event.stopPropagation();
          toggleArchiveStory(story);
        });
        div.querySelector('[data-act="del"]').addEventListener('click', (event) => {
          event.stopPropagation();
          removeStory(story);
        });
        div.addEventListener('click', () => {
          stopFullStoryTTS();
          storyTitleDisplay.textContent = story.title;
          storyLevelBadge.textContent = story.level;
          measureAndShowLevel(story.text, story.level); // A4
          storyHeader.style.display = 'block';
          storyContainer.style.display = 'block';
          storyLoading.style.display = 'none';
          storyContent.style.display = 'block';
          setCurrentStory(story.text);
          renderStoryText(story.text, false);
          const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          storyContainer.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        });
        div.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            div.click();
          }
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
    btnGenerate.setAttribute('aria-busy', 'true');
    storyContainer.setAttribute('aria-busy', 'true');
    floatingToolbar.style.display = 'none';
    stopFullStoryTTS();
    
    try {
      // Marco 3: a história é gerada COM as palavras do aluno dentro
      const reencounterWords = await getReencounterWords();
      // STREAMING (web): o texto da história aparece enquanto é gerado
      const response = await generateStory(genre, (_delta, full) => {
        storyLoading.style.display = 'none';
        storyContent.style.display = 'block';
        storyContent.textContent = full;
      }, reencounterWords);

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
      measureAndShowLevel(contentToRender, storyLevel); // A4: selo honesto
      storyHeader.style.display = 'block';

      saveStoryLocal(title, contentToRender, storyLevel, genre);
      setCurrentStory(contentToRender);
      renderStoryText(contentToRender, true);

      // Badge do reencontro: mostra quais palavras SUAS entraram de verdade
      const reBox = document.getElementById('story-reencounter');
      if (reBox) {
        const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const found = (response.requestedWords || reencounterWords || [])
          .filter(w => new RegExp(`\\b${esc(w)}`, 'i').test(contentToRender));
        if (found.length) {
      reBox.innerHTML = `🔁 <strong>Reencontro:</strong> esta história usa ${found.length} ${found.length === 1 ? 'termo do seu Cofre' : 'termos do seu Cofre'} — ${found.map(w => `<strong>${w}</strong>`).join(', ')}. Tente lembrar o sentido antes de tocar.`;
          reBox.style.display = 'block';
        } else {
          reBox.style.display = 'none';
        }
      }
    } catch (err) {
      app.showToast('Erro ao gerar história: ' + err.message, 'error');
      storyContainer.style.display = 'none';
    } finally {
      storyLoading.style.display = 'none';
      storyContent.style.display = 'block';
      btnGenerate.disabled = false;
      btnGenerate.setAttribute('aria-busy', 'false');
      storyContainer.setAttribute('aria-busy', 'false');
    }
  });

  // Status por palavra, estilo LingQ: "aprendendo" (salva, card ainda não
  // maduro) vs "conhecida" (card maduro OU marcada como conhecida no Leitor).
  async function getWordStatusSets() {
    try {
      const [words, cards, knownWords] = await Promise.all([
        db.getAllWords(),
        db.getAllCards(),
        db.getAllKnownWords(),
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
      return { learning, known, available: true };
    } catch(e) {
      console.warn('[Stories] Familiaridade indisponível:', e);
      return { learning: new Set(), known: new Set(), available: false };
    }
  }

  async function renderStoryText(text, animate = false) {
    const { learning: savedWordsSet, known: knownWordsSet, available: statusAvailable } = await getWordStatusSets();
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
        if (/^[\s.,!?;:"'()\[\]{}*#—–\-“”‘’]+$/.test(token) || token.trim() === '') {
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
          span.tabIndex = 0;
          span.setAttribute('role', 'button');
          span.setAttribute('aria-label', `Ver tradução de ${token}`);
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
          span.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleWordClick(cleanToken, token, span);
            }
          });
          
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
    if (knownBadge && !statusAvailable) {
      knownBadge.textContent = '📖 Familiaridade indisponível';
      knownBadge.title = 'Não foi possível consultar o estado do seu Cofre. O texto continua disponível para leitura.';
      knownBadge.style.display = 'inline';
    } else if (knownBadge && totalTokens > 0) {
      const pct = Math.round((knownCount / totalTokens) * 100);
      knownBadge.textContent = `📖 Familiaridade estimada: ${pct}%`;
      knownBadge.removeAttribute('title');
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

    const requestId = ++modalRequestId;
    translateText(cleanWord).then((wordTrans) => {
      if (requestId !== modalRequestId || modal.style.display === 'none') return;
      showModalContent(wordTrans);
    });

    function showModalContent(wordTrans) {
      modalLoading.style.display = 'none';
      currentWordTranslation = wordTrans || '';
      if (wordTrans) {
        modalExplanation.replaceChildren();
        const label = document.createElement('strong');
        label.textContent = 'Tradução: ';
        modalExplanation.append(label, document.createTextNode(wordTrans));
        if (currentSelectedSentence) {
          const reveal = document.createElement('button');
          reveal.type = 'button';
          reveal.textContent = '👁 Ver tradução da frase';
          reveal.style.cssText = 'display:block; margin-top:10px; background:none; border:none; color:var(--color-secondary); font-weight:700; font-size:13px; cursor:pointer; padding:0;';
          reveal.addEventListener('click', async () => {
            reveal.disabled = true;
            reveal.textContent = 'Traduzindo…';
            const sentenceTranslation = await translateText(currentSelectedSentence);
            if (requestId !== modalRequestId || modal.style.display === 'none') return;
            const context = document.createElement('div');
            context.style.cssText = 'margin-top:6px; font-size:0.9em; color:var(--color-text-light);';
            context.textContent = `Contexto: “${sentenceTranslation || 'Erro ao traduzir.'}”`;
            reveal.replaceWith(context);
          });
          modalExplanation.appendChild(reveal);
        }
        modalExplanation.style.display = 'block';
        btnSaveWord.style.display = 'block';
        // Fase 5 (§4l.5): handler órfão de #lf-reveal-context removido — era a
        // versão antiga do revelar-tradução, substituída por fluxo sem esse id.
      } else {
        modalExplanation.textContent = "Erro ao traduzir.";
        modalExplanation.style.display = 'block';
      }
    }
  }

  btnCloseModal.addEventListener('click', () => {
    modalRequestId++;
    modal.style.display = 'none';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modalRequestId++;
      modal.style.display = 'none';
    }
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
      app.showToast('Expressão salva no Cofre! ✅', 'success');
      
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
  }, { signal: documentController.signal });

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
  }, { signal: documentController.signal });
}
