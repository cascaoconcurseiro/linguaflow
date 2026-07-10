import { db } from '../../../utils/db.js';
import { playNaturalAudio, stopAudio } from '../core/tts.js';
import { generateStoryWeb } from '../core/ai.js';
import { translator } from '../../../utils/translator.js';

const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;

// Roteadores extensão/web: na extensão o service worker faz o trabalho;
// no site (Vercel) chamamos a Edge Function (história) e o translator
// client-side (Google GTX/MyMemory têm CORS liberado — verificado).
function generateStory(genre) {
  if (isExtension) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'ai_generate_story', genre }, resolve);
    });
  }
  return generateStoryWeb(genre).catch((e) => ({ error: e.message }));
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
            <option value="Viagens">âœˆï¸ Viagens</option>
            <option value="Ficção Científica">🚀 Ficção Científica</option>
            <option value="Negócios">💼 Negócios</option>
            <option value="Mistério">ðŸ•µï¸ Mistério</option>
            <option value="Romance">â¤ï¸ Romance</option>
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
            </div>
            
            <div style="display:flex; gap:8px;">
              <button id="btn-play-story" class="btn btn-primary lf-btn-bounce" style="padding: 8px 16px; font-size: 14px; display:flex; align-items:center; gap:6px;">
                â–¶ï¸ Ouvir Tudo
              </button>
              <button id="btn-stop-story" class="btn" style="padding: 8px 16px; font-size: 14px; display:none; align-items:center; gap:6px; background:#f44336; color:white; border:none;">
                â¹ Parar
              </button>
            </div>
          </div>
        </div>
        
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
        <button id="lf-tb-translate" style="background:var(--color-bg); border:1px solid var(--color-border); border-radius:4px; padding:6px 12px; cursor:pointer; font-weight:bold; color:var(--color-text); display:flex; align-items:center; gap:6px; font-size:14px;" class="lf-card-hover">ðŸ‡§ðŸ‡· Traduzir</button>
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
      .story-word.saved { border-bottom: 2px dashed var(--color-primary); color: var(--color-primary); }
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
  let currentStorySentences = []; // This will also be used by the TTS chunker
  let currentSelectionText = '';

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

  async function saveStoryLocal(title, text, level) {
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

  function loadHistory() {
    readStories((stories) => {
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
          renderStoryText(story.text, false);
          storyContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        historyList.appendChild(div);
      });
    });
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
      const response = await generateStory(genre);

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

      saveStoryLocal(title, contentToRender, storyLevel);
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

  async function getSavedWordsSet() {
    try {
      const words = await db.getAllWords();
      return new Set(words.map(w => w.word.toLowerCase()));
    } catch(e) {
      return new Set();
    }
  }

  async function renderStoryText(text, animate = false) {
    const savedWordsSet = await getSavedWordsSet();
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
      
      const delimRegex = /([\s.,!?;:"'()\[\]{}*#â€”â€“\-â€œâ€â€˜â€™]+)/;
      const tokens = p.split(delimRegex);
      const tokenNodes = [];

      tokens.forEach(token => {
        if (/^[\s.,!?;:"'()\[\]{}*#â€”â€“\-â€œâ€â€˜â€™]+$/.test(token) || token.trim() === '') {
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
          
          if (savedWordsSet.has(cleanToken)) {
            span.classList.add('saved');
          }
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
      
      const newCard = {
        word: currentSelectedWord,
        translation: '[Salvo via História]', 
        context: currentSelectedSentence,
        source_url: 'linguaflow://story',
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
