import { db } from '../../../utils/db.js';
import { playNaturalAudio, stopAudio } from '../core/tts.js';
import { generateStoryWeb, aiChat, enrichCard } from '../core/ai.js';
import { measureStoryLevel } from '../core/readability.js';
import { translator } from '../../../utils/translator.js';
import { lemma } from '../../../utils/lemma.js';
import { escapeHTML } from '../../../utils/html.js';
import { bindViewStateAction, renderViewState } from './viewState.js';
import { bindReadingHeader, renderReadingHeader } from './readingHub.js';

const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id && (typeof location !== 'undefined' && location.protocol === 'chrome-extension:');
let storiesDocumentController = null;
let vaultTranslations = new Map();

export const FALSE_FRIENDS = {
  actually: '"actually" = na verdade / de fato (NÃO "atualmente" → use "currently" ou "nowadays")',
  pretend: '"pretend" = fingir / simular (NÃO "pretender" → use "intend" ou "plan to")',
  eventually: '"eventually" = no fim das contas / com o tempo (NÃO "eventualmente" = às vezes → use "occasionally")',
  library: '"library" = biblioteca (NÃO "livraria" → use "bookstore")',
  college: '"college" = faculdade / universidade (NÃO "colégio" = high school)',
  fabric: '"fabric" = tecido / pano (NÃO "fábrica" → use "factory")',
  parents: '"parents" = pais (pai e mãe) (NÃO "parentes" = relatives)',
  push: '"push" = empurrar (NÃO "puxar" = pull)',
  exit: '"exit" = saída (NÃO "êxito" = success)',
  novel: '"novel" = romance (livro) (NÃO "novela" = soap opera)',
  sensible: '"sensible" = sensato / prudente (NÃO "sensível" = sensitive)',
  polite: '"polite" = educado / cortês (NÃO "político" = politician)',
  large: '"large" = grande (NÃO "largo" = wide)',
  assist: '"assist" = ajudar / auxiliar (NÃO "assistir" a um filme → "watch")',
  contest: '"contest" = competição / concurso (NÃO "contestar" = dispute/challenge)',
  editor: '"editor" = revisor / redator (NÃO "editor" de livros = publisher)',
  exquisite: '"exquisite" = refinado / primoroso (NÃO "esquisito" = weird/strange)',
  genial: '"genial" = simpático / cordial (NÃO "genial" = brilliant → "genius")',
  legend: '"legend" = lenda (NÃO "legenda" de vídeo = subtitle/caption)',
  realize: '"realize" = perceber / tomar consciência (NÃO "realizar" uma tarefa = carry out)',
  resume: '"resume" = retomar (NÃO "resumo" = summary)',
  sympathetic: '"sympathetic" = solidário / compreensivo (NÃO "simpático" = nice/friendly)',
};

export function formatStoryAsBook(text) {
  if (!text) return [];
  let normalized = String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .trim();

  // Se o texto veio com quebras simples (\n) sem quebra dupla (\n\n), expande para parágrafos
  if (!/\n\s*\n/.test(normalized) && /\n/.test(normalized)) {
    normalized = normalized.replace(/\n+/g, '\n\n');
  }

  const initialBlocks = normalized.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const formattedBlocks = [];

  for (const block of initialBlocks) {
    // Se o bloco for curto e não contiver turnos múltiplos de aspas, preserva
    if (block.length < 180 && !/(["”]).*?(["“])/.test(block)) {
      formattedBlocks.push(block);
      continue;
    }

    // Segmentação literária em turnos de diálogo e narrativa de livro:
    // 1. Narrativa anterior terminando em pontuação, seguida do início de fala direta
    let s = block.replace(/([.!?])\s+(["“])/g, '$1\n\n$2');

    // 2. Fim de fala/speech tag seguido do início de outra fala direta
    s = s.replace(/([.!?]["”])\s+(["“])/g, '$1\n\n$2');

    // 3. Fala com speech tag seguida de ação de outro personagem / mudança de cena
    s = s.replace(/([.!?]["”]\s*(?:[A-Z][a-z]+|he|she|they)\s+(?:says|said|asks|asked|replies|replied|smiles|whispers|tells|answers|murmurs|calls|shouts|yells|cries)\.?)\s+(?=[A-Z][a-z]+(?:\s+[a-z]+)*\s+[a-z]+|[A-Z][a-z]+\s+(?:looks|walks|thinks|sits|runs|takes|stops|holds|feels|cheers))/g, '$1\n\n');

    // 4. Quebra após fala completa fechada se a próxima frase for narrativa de ação
    s = s.replace(/([.!?]["”])\s+([A-Z][a-z]+\s+(?:looks|walks|thinks|sits|runs|takes|stops|holds|feels|cheers|smiles|shows|likes|is|was|has|had|goes))/g, '$1\n\n$2');

    // 5. Quebra narrativa antes de novo personagem agir
    s = s.replace(/([.!?])\s+(A\s+[a-z]+\s+man|The\s+people|The\s+next\s+day|At\s+home|After\s+class)\b/g, '$1\n\n$2');

    const parts = s.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    formattedBlocks.push(...parts);
  }

  return formattedBlocks.length > 0 ? formattedBlocks : [normalized];
}

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
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();
  if (!clean) return null;

  const cleanLower = clean.toLowerCase().replace(/[^a-zA-Z0-9'-]/g, '');
  const tokenLemma = lemma(cleanLower) || cleanLower;

  // 1. Cache do cofre ou memória imediato (0ms)
  if (vaultTranslations.has(cleanLower)) return vaultTranslations.get(cleanLower);
  if (vaultTranslations.has(tokenLemma)) return vaultTranslations.get(tokenLemma);
  const memoryKey = `en:pt:${cleanLower}`;
  if (translator.memoryCache?.has(memoryKey)) return translator.memoryCache.get(memoryKey);

  // 2. Extensão: se estiver dentro de página da extensão (chrome-extension:)
  if (isExtension) {
    const extTrans = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action: 'translate', text: clean, from: 'en', to: 'pt' }, (res) => {
          if (chrome.runtime.lastError || !res?.translation) {
            resolve(null);
          } else {
            resolve(res.translation);
          }
        });
      } catch {
        resolve(null);
      }
    });
    if (extTrans) {
      vaultTranslations.set(cleanLower, extTrans);
      return extTrans;
    }
  }

  // 3. Tradutor universal (Cache multinível, Dicionário offline, Google, MyMemory)
  try {
    const res = await translator.translate(clean, 'en', 'pt');
    if (res?.translation) {
      vaultTranslations.set(cleanLower, res.translation);
      return res.translation;
    }
  } catch (e) {
    console.warn('[Stories] translator.translate falhou:', e);
  }

  // 4. Fallback direto MyMemory (CORS liberado no ambiente web)
  try {
    const fallback = await translator._fetchMyMemory(clean, 'en', 'pt');
    if (fallback) {
      vaultTranslations.set(cleanLower, fallback);
      return fallback;
    }
  } catch {}

  // 5. Fallback via IA para frases ou quando APIs externas forem bloqueadas
  if (clean.includes(' ') || clean.length > 20) {
    try {
      const aiFallback = await translateSentenceWithAI(clean);
      if (aiFallback) {
        vaultTranslations.set(cleanLower, aiFallback);
        return aiFallback;
      }
    } catch {}
  }

  return null;
}

async function translateSentenceWithAI(sentence) {
  if (!sentence || typeof sentence !== 'string') return '';
  const clean = sentence.trim();
  if (!clean) return '';
  try {
    const system = 'Você é um tradutor especialista de inglês para português brasileiro natural. Traduza a frase a seguir de forma direta e concisa, sem aspas, sem explicações e sem introduções.';
    const res = await aiChat(
      [{ role: 'system', content: system }, { role: 'user', content: clean }],
      { temperature: 0.1, max_tokens: 300 }
    );
    return res ? res.trim().replace(/^["“']|["”']$/g, '') : '';
  } catch (err) {
    console.warn('[Stories] translateSentenceWithAI falhou:', err);
    return '';
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
      <div id="story-reader-container" style="display:none; background: var(--color-surface); border-radius: var(--radius-lg, 16px); padding: clamp(24px, 4vw, 44px) clamp(20px, 4vw, 48px); border: 1px solid var(--color-border); box-shadow: 0 4px 24px rgba(0,0,0,0.06); position:relative; max-width: 780px; margin: 0 auto 32px auto;">
        <div id="story-loading" style="display:none; text-align:center; padding: 40px; color:var(--color-text-light);">
          <div class="lf-spin" style="width: 40px; height: 40px; border: 4px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; margin: 0 auto 16px;"></div>
          <p style="font-size: 16px; font-weight:bold;">Criando sua história…</p>
        </div>
        
        <div id="story-header" style="display:none; margin-bottom:28px; border-bottom:1px solid var(--color-border); padding-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
            <div>
              <h2 id="story-title-display" style="margin-top:0; color:var(--color-text); font-size:26px; font-weight:800; letter-spacing:-0.02em; margin-bottom:10px;"></h2>
              <span id="story-level-badge" style="background:var(--color-primary); color:white; font-size:12px; font-weight:bold; padding:4px 8px; border-radius:12px;">B1</span>
              <span id="story-known-badge" style="background:var(--color-secondary); color:white; font-size:12px; font-weight:bold; padding:4px 8px; border-radius:12px; margin-left:6px; display:none;" title="Estimativa que combina termos marcados por você e itens com memória estável; não mede compreensão."></span>
              <div id="story-reencounter" style="display:none; font-size:13px; color:var(--color-text-light); margin-top:8px; line-height:1.5;"></div>
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
        
        <div id="story-content">
          <!-- Words will be injected here -->
        </div>
      </div>
    </div>
    
    <!-- Word Popup Modal (Idêntico ao Popup dos Vídeos do LinguaFlow) -->
    <div id="lf-story-word-modal" role="dialog" aria-modal="true" aria-labelledby="lf-modal-word" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(8,12,24,0.65); z-index:9999; justify-content:center; align-items:center; backdrop-filter:blur(6px); animation:fadeIn 0.2s ease-out; padding:16px;">
      <div style="background:var(--color-surface); border:1px solid var(--color-border); border-radius:22px; width:100%; max-width:420px; position:relative; box-shadow:0 25px 50px -12px rgba(0,0,0,0.45); animation:slideUp 0.2s ease-out; overflow:hidden; display:flex; flex-direction:column; max-height:90vh;">
        <!-- Header -->
        <div style="padding:16px 18px 12px; display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--color-border);">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:baseline; gap:8px; flex-wrap:wrap;">
              <h2 id="lf-modal-word" style="font-size:26px; font-weight:800; color:var(--color-text); margin:0; letter-spacing:-0.02em;">Word</h2>
              <span id="lf-modal-cefr" style="display:none; font-size:11px; font-weight:800; text-transform:uppercase; padding:2px 8px; border-radius:12px; background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3);"></span>
            </div>
            <div id="lf-modal-pronounce" style="display:none; font-size:12px; color:var(--color-text-light); font-family:monospace; margin-top:4px;"></div>
          </div>
          <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
            <button id="lf-btn-tts-word" type="button" aria-label="Ouvir palavra" style="width:38px; height:38px; border-radius:10px; background:var(--color-bg-alt); border:1px solid var(--color-border); color:var(--color-secondary); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:16px;" title="Ouvir">🔊</button>
            <button id="lf-close-modal" type="button" aria-label="Fechar detalhes da palavra" style="width:38px; height:38px; border-radius:10px; background:none; border:none; font-size:22px; color:var(--color-text-light); cursor:pointer; display:flex; align-items:center; justify-content:center;">&times;</button>
          </div>
        </div>

        <!-- Abas do Popup de Vídeos -->
        <div role="tablist" style="display:flex; border-bottom:1px solid var(--color-border); background:var(--color-bg-alt); padding:0 8px;">
          <button id="lf-tab-trans" role="tab" aria-selected="true" class="lf-story-tab active" data-tab="trans" style="flex:1; padding:10px 4px; font-size:12px; font-weight:800; border:none; background:none; color:var(--color-secondary); border-bottom:2px solid var(--color-secondary); cursor:pointer;">Tradução</button>
          <button id="lf-tab-examples" role="tab" aria-selected="false" class="lf-story-tab" data-tab="examples" style="flex:1; padding:10px 4px; font-size:12px; font-weight:700; border:none; background:none; color:var(--color-text-light); border-bottom:2px solid transparent; cursor:pointer;">Exemplos</button>
          <button id="lf-tab-youglish" role="tab" aria-selected="false" class="lf-story-tab" data-tab="youglish" style="flex:1; padding:10px 4px; font-size:12px; font-weight:700; border:none; background:none; color:var(--color-text-light); border-bottom:2px solid transparent; cursor:pointer;">🎬 YouGlish (Vídeos)</button>
        </div>

        <!-- Conteúdo com Scroll -->
        <div style="padding:16px 18px 20px; overflow-y:auto; flex:1;">
          <!-- Spinner de carregamento -->
          <div id="lf-modal-loading" style="text-align:center; padding:20px; display:none;">
            <div class="lf-spin" style="width:24px; height:24px; border:3px solid var(--color-border); border-top-color:var(--color-primary); border-radius:50%; margin:0 auto 8px;"></div>
            <span style="font-size:12px; color:var(--color-text-light);">Carregando tradução e contexto…</span>
          </div>

          <!-- Painel 1: Tradução -->
          <div id="lf-panel-trans">
            <div id="lf-modal-trans-main" style="font-size:24px; font-weight:800; color:#4ade80; margin-bottom:8px; line-height:1.2;">…</div>
            
            <!-- Falso Cognato -->
            <div id="lf-modal-false-friend" style="display:none; background:rgba(251,146,60,0.1); border:1px solid rgba(251,146,60,0.3); border-radius:10px; padding:9px 12px; margin-bottom:12px;">
              <div style="font-size:10px; color:#fb923c; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; margin-bottom:4px;">⚠️ Falso Cognato — Cuidado!</div>
              <div id="lf-modal-false-friend-text" style="font-size:12px; color:#fcd34d; line-height:1.5;"></div>
            </div>

            <!-- Contexto na Frase -->
            <div id="lf-modal-context-box" style="display:none; background:rgba(139,92,246,0.06); border:1px solid rgba(139,92,246,0.2); border-radius:10px; padding:10px 12px; margin-bottom:14px;">
              <div style="font-size:10px; color:#a78bfa; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; margin-bottom:4px; display:flex; align-items:center; gap:4px;">
                <span>💡</span><span>Contexto nesta frase</span>
              </div>
              <div id="lf-modal-context-text" style="font-size:13px; color:var(--color-text); line-height:1.5;"></div>
            </div>

            <div id="lf-modal-explanation" style="display:none;"></div>
            <div id="lf-modal-sentence-box" style="margin-bottom:16px;"></div>

            <!-- Ações -->
            <div style="display:flex; flex-direction:column; gap:8px;">
              <button id="lf-btn-save-word" class="btn btn-primary lf-btn-bounce" style="width:100%; padding:11px; font-size:14px; font-weight:800; display:flex; justify-content:center; align-items:center; gap:6px;">
                💾 Salvar no Cofre
              </button>
              <button id="lf-btn-known-word" class="btn lf-btn-bounce" style="width:100%; padding:9px; font-size:13px; font-weight:700; background:rgba(74,222,128,0.1); color:#4ade80; border:1px solid rgba(74,222,128,0.25); border-radius:8px; cursor:pointer;">
                ✓ Já sei esta palavra
              </button>
            </div>
          </div>

          <!-- Painel 2: Exemplos / Linguee -->
          <div id="lf-panel-examples" style="display:none; text-align:center;">
            <p style="font-size:13px; color:var(--color-text-light); line-height:1.6; margin-bottom:14px;">
              Veja o uso real dessa palavra em contextos bilíngues:
            </p>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <button id="lf-btn-reverso" class="btn lf-btn-bounce" style="width:100%; padding:10px; font-size:13px; font-weight:700; background:rgba(3,105,161,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); border-radius:8px; cursor:pointer;">
                🔄 Reverso Context — Frases Reais
              </button>
              <button id="lf-btn-linguee" class="btn lf-btn-bounce" style="width:100%; padding:10px; font-size:13px; font-weight:700; background:rgba(74,222,128,0.08); color:#4ade80; border:1px solid rgba(74,222,128,0.25); border-radius:8px; cursor:pointer;">
                🔗 Linguee — EN ↔ PT
              </button>
              <button id="lf-btn-google-trans" class="btn lf-btn-bounce" style="width:100%; padding:10px; font-size:13px; font-weight:700; background:var(--color-bg-alt); color:var(--color-text); border:1px solid var(--color-border); border-radius:8px; cursor:pointer;">
                🌐 Google Tradutor
              </button>
            </div>
          </div>

          <!-- Painel 3: YouGlish (Vídeos Reais) -->
          <div id="lf-panel-youglish" style="display:none; text-align:center;">
            <p style="font-size:13px; color:var(--color-text-light); line-height:1.6; margin-bottom:14px;">
              Ouça como nativos pronunciam em vídeos reais do YouTube:
            </p>
            <button id="lf-btn-yg-all" class="btn lf-btn-bounce" style="width:100%; padding:12px; font-size:14px; font-weight:800; background:linear-gradient(135deg, #b91c1c, #dc2626); color:white; border:none; border-radius:10px; cursor:pointer; margin-bottom:10px; box-shadow:0 4px 12px rgba(220,38,38,0.25);">
              🎬 Assistir no YouGlish (Qualquer sotaque)
            </button>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <button id="lf-btn-yg-us" class="btn lf-btn-bounce" style="padding:10px; background:rgba(239,68,68,0.08); color:#f87171; border:1px solid rgba(239,68,68,0.2); border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">🇺🇸 Americano</button>
              <button id="lf-btn-yg-uk" class="btn lf-btn-bounce" style="padding:10px; background:rgba(239,68,68,0.08); color:#f87171; border:1px solid rgba(239,68,68,0.2); border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">🇬🇧 Britânico</button>
              <button id="lf-btn-yg-aus" class="btn lf-btn-bounce" style="padding:10px; background:rgba(239,68,68,0.08); color:#f87171; border:1px solid rgba(239,68,68,0.2); border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">🇦🇺 Australiano</button>
              <button id="lf-btn-yg-acad" class="btn lf-btn-bounce" style="padding:10px; background:rgba(239,68,68,0.08); color:#f87171; border:1px solid rgba(239,68,68,0.2); border-radius:8px; font-size:12px; font-weight:700; cursor:pointer;">🎓 Acadêmico</button>
            </div>
          </div>
        </div>
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
      #story-content {
        max-width: 680px;
        margin: 0 auto;
        font-size: 19px;
        line-height: 1.85;
        letter-spacing: -0.003em;
        color: var(--color-text);
        font-family: 'Newsreader', 'Merriweather', 'Charter', 'Georgia', serif, system-ui;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
      }
      .story-paragraph {
        margin: 0 0 24px 0;
        text-align: left;
        line-height: 1.85;
        word-break: break-word;
      }
      .story-paragraph:last-child {
        margin-bottom: 0;
      }
      .story-word {
        cursor: pointer;
        transition: color var(--motion-fast), background-color var(--motion-fast);
        border-radius: 4px;
        padding: 0 2px;
        display: inline;
      }
      .story-word:hover {
        background-color: rgba(88,204,2,0.18);
        color: var(--color-primary);
        font-weight: 600;
      }
      .story-word:focus-visible {
        outline: 2px solid var(--color-secondary);
        outline-offset: 2px;
      }
      .story-word.saved {
        border-bottom: 2px solid #ffc800;
        background: rgba(255,200,0,0.12);
      }
      .story-word.known {
        color: var(--color-primary);
      }
      #lf-story-word-tooltip {
        position: fixed;
        display: none;
        z-index: 9500;
        background: var(--color-surface);
        border: 1.5px solid var(--color-border);
        border-radius: 8px;
        padding: 6px 12px;
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text);
        box-shadow: 0 6px 20px rgba(0,0,0,0.12);
        pointer-events: none;
        max-width: 260px;
        line-height: 1.4;
        transition: opacity 0.12s ease;
      }
      .lf-story-tab {
        transition: color var(--motion-fast, 0.15s) ease, border-color var(--motion-fast, 0.15s) ease;
      }
      .lf-story-tab:hover {
        color: var(--color-text) !important;
      }
      .lf-story-tab.active {
        color: var(--color-secondary) !important;
        border-bottom-color: var(--color-secondary) !important;
      }
      .quiz-opt { display:block; width:100%; text-align:left; margin:6px 0; padding:10px 14px; border:2px solid var(--color-border); border-radius:8px; background:var(--color-surface); color:var(--color-text); font-family:var(--font-main); font-size:14px; font-weight:600; cursor:pointer; }
      .quiz-opt:hover, .quiz-opt:focus-visible { border-color: var(--color-secondary); }
      .quiz-opt.correct { border-color: var(--color-primary); background: rgba(88,204,2,0.15); }
      .quiz-opt.wrong { border-color: #f44336; background: rgba(244,67,54,0.1); }
      .history-item { padding: 16px; border: 2px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); cursor: pointer; display:flex; justify-content:space-between; align-items:center; }
      .history-item:hover { border-color: var(--color-primary); }
      .story-act { background:none; border:1px solid var(--color-border); border-radius:8px; padding:6px 9px; cursor:pointer; font-size:15px; line-height:1; }
      /* Celular (18/07): alvo de toque minimo de 44px — 30px era mira de agulha */
      @media (pointer: coarse) { .story-act { min-width:44px; min-height:44px; font-size:18px; } }
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
      @media (max-width: 640px) {
        #story-content { font-size: 17px !important; line-height: 1.75 !important; }
        .story-paragraph { margin-bottom: 18px; }
        #story-title-display { font-size: 22px !important; }
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

  // Modal elements (Estilo Popup de Vídeos)
  const modal = document.getElementById('lf-story-word-modal');
  const btnCloseModal = document.getElementById('lf-close-modal');
  const modalWord = document.getElementById('lf-modal-word');
  const modalCefr = document.getElementById('lf-modal-cefr');
  const modalPronounce = document.getElementById('lf-modal-pronounce');
  const modalLoading = document.getElementById('lf-modal-loading');
  const modalTransMain = document.getElementById('lf-modal-trans-main');
  const modalFalseFriend = document.getElementById('lf-modal-false-friend');
  const modalFalseFriendText = document.getElementById('lf-modal-false-friend-text');
  const modalContextBox = document.getElementById('lf-modal-context-box');
  const modalContextText = document.getElementById('lf-modal-context-text');
  const modalSentenceBox = document.getElementById('lf-modal-sentence-box');
  const modalExplanation = document.getElementById('lf-modal-explanation');
  const btnSaveWord = document.getElementById('lf-btn-save-word');
  const btnKnownWord = document.getElementById('lf-btn-known-word');
  const btnTtsWord = document.getElementById('lf-btn-tts-word');

  // Abas do Modal
  const tabTrans = document.getElementById('lf-tab-trans');
  const tabExamples = document.getElementById('lf-tab-examples');
  const tabYouglish = document.getElementById('lf-tab-youglish');
  const panelTrans = document.getElementById('lf-panel-trans');
  const panelExamples = document.getElementById('lf-panel-examples');
  const panelYouglish = document.getElementById('lf-panel-youglish');

  // Botões de Exemplos e YouGlish
  const btnReverso = document.getElementById('lf-btn-reverso');
  const btnLinguee = document.getElementById('lf-btn-linguee');
  const btnGoogleTrans = document.getElementById('lf-btn-google-trans');
  const btnYgAll = document.getElementById('lf-btn-yg-all');
  const btnYgUs = document.getElementById('lf-btn-yg-us');
  const btnYgUk = document.getElementById('lf-btn-yg-uk');
  const btnYgAus = document.getElementById('lf-btn-yg-aus');
  const btnYgAcad = document.getElementById('lf-btn-yg-acad');

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
  let modalReturnFocus = null;

  function closeWordModal() {
    modalRequestId++;
    modal.style.display = 'none';
    modalReturnFocus?.focus?.({ preventScroll: true });
    modalReturnFocus = null;
  }

  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); closeWordModal(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll('button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

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
  wordTooltip.id = 'lf-story-word-tooltip';
  wordTooltip.setAttribute('role', 'tooltip');
  document.body.appendChild(wordTooltip);
  let tooltipTimer = null;
  let tooltipRequestId = 0;
  let currentTooltipWordEl = null;

  const hideWordTooltip = () => {
    tooltipRequestId++;
    currentTooltipWordEl = null;
    if (tooltipTimer) clearTimeout(tooltipTimer);
    wordTooltip.style.display = 'none';
  };

  const showWordTooltip = (span) => {
    if (!span) return;
    if (span === currentTooltipWordEl && wordTooltip.style.display === 'block') return;
    currentTooltipWordEl = span;

    const token = span?.textContent?.replace(/[^a-zA-Z0-9'-]/g, '').toLowerCase();
    if (!token) return;
    const tokenLemma = lemma(token) || token;
    const localTrans = vaultTranslations.get(token) || vaultTranslations.get(tokenLemma) || translator.memoryCache?.get(`en:pt:${token}`) || translator.memoryCache?.get(`en:pt:${tokenLemma}`);

    const rect = span.getBoundingClientRect();
    wordTooltip.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 270))}px`;
    wordTooltip.style.top = `${Math.max(8, rect.top - 40)}px`;

    if (localTrans) {
      if (tooltipTimer) clearTimeout(tooltipTimer);
      wordTooltip.textContent = localTrans;
      wordTooltip.style.display = 'block';
      return;
    }

    const requestId = ++tooltipRequestId;
    if (tooltipTimer) clearTimeout(tooltipTimer);
    wordTooltip.textContent = '…';
    wordTooltip.style.display = 'block';

    tooltipTimer = setTimeout(async () => {
      let translation = await translateText(token);
      if (!translation && tokenLemma && tokenLemma !== token) {
        translation = await translateText(tokenLemma);
      }
      if (requestId !== tooltipRequestId) return;
      if (translation) {
        vaultTranslations.set(token, translation);
        wordTooltip.textContent = translation;
      } else {
        wordTooltip.textContent = 'Tradução indisponível';
      }
    }, 120);
  };
  storyContent.addEventListener('mouseover', (event) => {
    const word = event.target.closest('.story-word');
    if (word) showWordTooltip(word);
  });
  storyContent.addEventListener('mouseout', (event) => {
    const related = event.relatedTarget;
    if (related && related.closest && related.closest('.story-word') === currentTooltipWordEl) return;
    hideWordTooltip();
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
    const saved = await db.saveStory({ title, content: text, level, genre });
    if (!saved?.ok || !saved.id) throw new Error('O Supabase não confirmou o salvamento da história.');

    await new Promise((resolve) => readStories((stories) => {
      const updatedStories = [{
        id: saved.id,
        title: title,
        text: text,
        level: level || 'N/A',
        date: saved.createdAt || new Date().toISOString()
      }, ...stories.filter((story) => story.id !== saved.id)].slice(0, 50);
      writeStories(updatedStories);
      resolve();
    }));
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
        const base = isExtension ? chrome.runtime.getURL('utils/') : '/utils/';
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
        div.innerHTML = `
          <button type="button" class="story-open" style="background:none;border:0;text-align:left;color:inherit;font:inherit;cursor:pointer;">
            <div style="font-weight:bold; font-size:18px; color:var(--color-text);">
              ${escapeHTML(story.title)} <span class="level-tag">${escapeHTML(story.level)}</span>
            </div>
            <div style="font-size:14px; color:var(--color-text-light);">${d.toLocaleDateString()} ${d.toLocaleTimeString()}</div>
          </button>
          <div style="display:flex; gap:6px; align-items:center;">
            <button type="button" class="story-act" data-act="arch" aria-label="${archivedSet.has(storyKey(story)) ? 'Restaurar história do arquivo' : 'Arquivar história'}" title="${archivedSet.has(storyKey(story)) ? 'Restaurar do arquivo' : 'Arquivar (sai da lista, nada e apagado)'}">${archivedSet.has(storyKey(story)) ? '📤' : '📦'}</button>
            <button type="button" class="story-act" data-act="del" aria-label="Excluir história para sempre" title="Excluir para sempre">🗑</button>
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
        div.querySelector('.story-open').addEventListener('click', () => {
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
      
      const lines = storyText.split(/\r?\n/);
      if (lines.length > 0 && lines[0].length < 60 && !lines[0].endsWith('.')) {
        title = lines[0].replace(/[#*]/g, '').trim();
        contentToRender = lines.slice(1).join('\n').trim();
      }

      storyTitleDisplay.textContent = title;
      storyLevelBadge.textContent = storyLevel;
      measureAndShowLevel(contentToRender, storyLevel); // A4: selo honesto
      storyHeader.style.display = 'block';

      try {
        await saveStoryLocal(title, contentToRender, storyLevel, genre);
      } catch (saveError) {
        console.warn('[Stories] História gerada, mas não sincronizada:', saveError);
        app.showToast('História criada, mas ainda não foi salva. Verifique a conexão e tente gerar novamente.', 'error');
      }
      setCurrentStory(contentToRender);
      renderStoryText(contentToRender, true);

      // Badge do reencontro: mostra quais palavras SUAS entraram de verdade
      const reBox = document.getElementById('story-reencounter');
      if (reBox) {
        const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const found = (response.requestedWords || reencounterWords || [])
          .filter(w => new RegExp(`\\b${esc(w)}`, 'i').test(contentToRender));
        if (found.length) {
      reBox.innerHTML = `🔁 <strong>Reencontro:</strong> esta história usa ${found.length} ${found.length === 1 ? 'termo do seu Cofre' : 'termos do seu Cofre'} — ${found.map(w => `<strong>${escapeHTML(w)}</strong>`).join(', ')}. Tente lembrar o sentido antes de tocar.`;
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
      vaultTranslations.clear();
      (words || []).forEach(w => {
        const key = (w.word || '').toLowerCase();
        if (matureByWordId[w.id]) known.add(key); else learning.add(key);
        if (w.translation) vaultTranslations.set(key, w.translation);
        const l = lemma(key);
        if (l && l !== key) {
          (matureByWordId[w.id] ? known : learning).add(l);
          if (w.translation && !vaultTranslations.has(l)) vaultTranslations.set(l, w.translation);
        }
      });
      (knownWords || []).forEach(k => {
        const key = (k.word || '').toLowerCase();
        known.add(key);
        if (k.translation) vaultTranslations.set(key, k.translation);
        const l = lemma(k.word);
        if (l) {
          known.add(l);
          if (k.translation && !vaultTranslations.has(l)) vaultTranslations.set(l, k.translation);
        }
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

    // Normalização completa: unifica \r\n, \n escapado (\\n) e \n real
    const raw = String(text || '');
    const normalized = raw
      .replace(/\r\n/g, '\n')
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .trim();

    // Divide em parágrafos de livro (com segmentação literária de diálogos e narrativas)
    const paragraphs = formatStoryAsBook(normalized);
    
    storyContent.innerHTML = '';
    
    // Split into sentences for the TTS Chunker and Context finder
    const cleanForSentences = normalized.replace(/\n+/g, ' ');
    currentStorySentences = cleanForSentences.match(/[^.!?]+[.!?]+/g) || [cleanForSentences];
    // Clean sentences slightly for better TTS
    currentStorySentences = currentStorySentences.map(s => s.trim()).filter(s => s.length > 0);

    const pElements = [];
    paragraphs.forEach(p => {
      const pEl = document.createElement('p');
      pEl.className = 'story-paragraph';
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

    // Warm-up assíncrono suave de vocabulário no cache (elimina "tradução indisponível" no hover)
    const uniqueTokens = new Set();
    paragraphs.forEach(p => {
      const tokens = p.split(/[\s.,!?;:"'()\[\]{}*#—–\-“”‘’]+/);
      tokens.forEach(t => {
        const c = t.replace(/[^a-zA-Z0-9'-]/g, '').toLowerCase();
        if (c && c.length > 1 && !vaultTranslations.has(c)) {
          uniqueTokens.add(c);
        }
      });
    });
    setTimeout(() => {
      const list = Array.from(uniqueTokens).slice(0, 50);
      list.forEach(token => {
        translateText(token).catch(() => null);
      });
    }, 60);
  }

  function findSentenceForWord(rawWord, spanEl = null) {
    if (spanEl) {
      const paragraph = spanEl.closest?.('.story-paragraph');
      if (paragraph) {
        const pText = paragraph.textContent || '';
        const sentences = pText.match(/[^.!?]+[.!?]+["'”’]?/g) || [pText];
        for (const s of sentences) {
          if (s.toLowerCase().includes(rawWord.toLowerCase())) return s.trim();
        }
        if (pText.trim()) return pText.trim();
      }
    }
    if (!rawWord) return '';
    for (const sent of currentStorySentences) {
      if (sent.toLowerCase().includes(rawWord.toLowerCase())) return sent.trim();
    }
    return '';
  }

  function activateModalTab(tabKey) {
    const tabs = [
      { key: 'trans', btn: tabTrans, panel: panelTrans },
      { key: 'examples', btn: tabExamples, panel: panelExamples },
      { key: 'youglish', btn: tabYouglish, panel: panelYouglish },
    ];
    tabs.forEach(t => {
      const active = t.key === tabKey;
      if (t.btn) {
        t.btn.classList.toggle('active', active);
        t.btn.setAttribute('aria-selected', String(active));
        t.btn.style.color = active ? 'var(--color-secondary)' : 'var(--color-text-light)';
        t.btn.style.borderBottomColor = active ? 'var(--color-secondary)' : 'transparent';
      }
      if (t.panel) {
        t.panel.style.display = active ? 'block' : 'none';
      }
    });
  }

  tabTrans?.addEventListener('click', () => activateModalTab('trans'));
  tabExamples?.addEventListener('click', () => activateModalTab('examples'));
  tabYouglish?.addEventListener('click', () => activateModalTab('youglish'));

  function handleWordClick(cleanWord, rawWord, spanEl) {
    if (!cleanWord) return;
    
    window.getSelection().removeAllRanges();
    floatingToolbar.style.display = 'none';

    currentSelectedWord = cleanWord;
    currentSelectedSentence = findSentenceForWord(rawWord, spanEl);
    
    modalReturnFocus = spanEl;
    modal.style.display = 'flex';
    modalWord.textContent = rawWord;
    
    // Reset para a aba Tradução ao abrir
    activateModalTab('trans');
    
    modalLoading.style.display = 'block';
    if (modalTransMain) modalTransMain.textContent = '…';
    if (modalContextBox) modalContextBox.style.display = 'none';
    if (modalContextText) modalContextText.textContent = '';
    if (modalSentenceBox) modalSentenceBox.innerHTML = '';
    if (btnSaveWord) btnSaveWord.style.display = 'none';
    if (btnKnownWord) btnKnownWord.style.display = 'none';
    btnCloseModal.focus({ preventScroll: true });

    // Falso Cognato
    const ff = FALSE_FRIENDS[cleanWord.toLowerCase()];
    if (ff && modalFalseFriend && modalFalseFriendText) {
      modalFalseFriendText.textContent = ff;
      modalFalseFriend.style.display = 'block';
    } else if (modalFalseFriend) {
      modalFalseFriend.style.display = 'none';
    }

    // Configuração dos botões do YouGlish (Vídeos reais do YouTube)
    if (btnYgAll) btnYgAll.onclick = () => window.open(`https://youglish.com/pronounce/${encodeURIComponent(cleanWord)}/english`, '_blank');
    if (btnYgUs) btnYgUs.onclick = () => window.open(`https://youglish.com/pronounce/${encodeURIComponent(cleanWord)}/english/us`, '_blank');
    if (btnYgUk) btnYgUk.onclick = () => window.open(`https://youglish.com/pronounce/${encodeURIComponent(cleanWord)}/english/uk`, '_blank');
    if (btnYgAus) btnYgAus.onclick = () => window.open(`https://youglish.com/pronounce/${encodeURIComponent(cleanWord)}/english/aus`, '_blank');
    if (btnYgAcad) btnYgAcad.onclick = () => window.open(`https://youglish.com/pronounce/${encodeURIComponent(cleanWord)}/english/academic`, '_blank');

    // Configuração dos botões de Exemplos / Contexto
    if (btnReverso) btnReverso.onclick = () => window.open(`https://context.reverso.net/traducao/ingles-portugues/${encodeURIComponent(cleanWord)}`, '_blank');
    if (btnLinguee) btnLinguee.onclick = () => window.open(`https://www.linguee.com.br/ingles-portugues/traducao/${encodeURIComponent(cleanWord)}.html`, '_blank');
    if (btnGoogleTrans) btnGoogleTrans.onclick = () => window.open(`https://translate.google.com/?sl=en&tl=pt&text=${encodeURIComponent(cleanWord)}`, '_blank');

    const requestId = ++modalRequestId;
    const tokenLemma = lemma(cleanWord) || cleanWord;
    const cachedTrans = vaultTranslations.get(cleanWord) || vaultTranslations.get(tokenLemma) || translator.memoryCache?.get(`en:pt:${cleanWord}`);

    if (cachedTrans) {
      showModalContent(cachedTrans);
    }

    if (!cachedTrans) {
      translateText(cleanWord).then((baseTranslation) => {
        if (requestId !== modalRequestId || modal.style.display === 'none') return;
        if (baseTranslation && !currentWordTranslation) {
          vaultTranslations.set(cleanWord, baseTranslation);
          showModalContent(baseTranslation);
        }
      });
    }

    let cachedContextualSentence = '';
    let contextualPromise = null;

    if (currentSelectedSentence) {
      contextualPromise = enrichCard(cleanWord, currentSelectedSentence).then((contextual) => {
        if (contextual?.sentence_pt) {
          cachedContextualSentence = contextual.sentence_pt.trim();
          vaultTranslations.set(`sent_${currentSelectedSentence.trim().toLowerCase()}`, cachedContextualSentence);
        }
        if (requestId !== modalRequestId || modal.style.display === 'none') return contextual;
        if (contextual?.word_pt) {
          showModalContent(contextual.word_pt);
        }
        if (contextual?.explanation && modalContextBox && modalContextText) {
          modalContextText.textContent = contextual.explanation;
          modalContextBox.style.display = 'block';
        }
        return contextual;
      }).catch(() => null);
    }

    function showModalContent(wordTrans) {
      modalLoading.style.display = 'none';
      currentWordTranslation = wordTrans || '';
      if (wordTrans) {
        if (modalTransMain) modalTransMain.textContent = wordTrans;
        
        if (currentSelectedSentence && modalSentenceBox) {
          modalSentenceBox.replaceChildren();
          const reveal = document.createElement('button');
          reveal.type = 'button';
          reveal.className = 'btn lf-btn-bounce';
          reveal.textContent = '👁 Ver tradução da frase';
          reveal.style.cssText = 'width:100%; padding:8px 12px; background:var(--color-bg-alt); border:1px solid var(--color-border); border-radius:8px; color:var(--color-secondary); font-weight:700; font-size:12px; cursor:pointer; text-align:center;';
          reveal.addEventListener('click', async () => {
            reveal.disabled = true;
            reveal.textContent = 'Traduzindo frase…';

            let sentenceTranslation = cachedContextualSentence;
            if (!sentenceTranslation && contextualPromise) {
              try {
                const res = await contextualPromise;
                if (res?.sentence_pt) sentenceTranslation = res.sentence_pt.trim();
              } catch {}
            }

            if (!sentenceTranslation) {
              sentenceTranslation = await translateText(currentSelectedSentence);
            }

            if (!sentenceTranslation) {
              sentenceTranslation = await translateSentenceWithAI(currentSelectedSentence);
            }

            if (requestId !== modalRequestId || modal.style.display === 'none') return;
            const context = document.createElement('div');
            context.style.cssText = 'margin-top:6px; padding:10px 12px; background:var(--color-bg-alt); border-radius:8px; font-size:13px; color:var(--color-text); line-height:1.5; border-left:3px solid var(--color-secondary); text-align:left;';
            context.textContent = `“${sentenceTranslation || 'Não foi possível traduzir a frase.'}”`;
            reveal.replaceWith(context);
          });
          modalSentenceBox.appendChild(reveal);
        }

        if (btnSaveWord) btnSaveWord.style.display = 'flex';
        if (btnKnownWord) btnKnownWord.style.display = 'block';
      } else {
        if (modalTransMain) modalTransMain.textContent = "Erro ao traduzir.";
      }
    }
  }

  btnKnownWord?.addEventListener('click', async () => {
    if (!currentSelectedWord) return;
    try {
      const orig = btnKnownWord.textContent;
      btnKnownWord.textContent = 'Gravando…';
      await db.markAsKnown?.(currentSelectedWord, 'en');
      const spans = document.querySelectorAll('.story-word');
      spans.forEach(span => {
        if (span.textContent.toLowerCase().includes(currentSelectedWord)) {
          span.classList.remove('saved');
          span.classList.add('known');
        }
      });
      app.showToast(`"${currentSelectedWord}" marcada como conhecida! ✓`, 'success');
      btnKnownWord.textContent = orig;
      closeWordModal();
    } catch (e) {
      console.warn('[Stories] Falha ao marcar conhecida:', e);
      app.showToast('Erro ao marcar palavra como conhecida', 'error');
    }
  });

  btnCloseModal.addEventListener('click', () => {
    closeWordModal();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeWordModal();
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

      closeWordModal();
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
