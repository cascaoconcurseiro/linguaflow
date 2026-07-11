// dashboard/js/ui/readerView.js — Modo Leitor estilo LingQ.
// Cole qualquer texto em inglês e leia com palavras coloridas por status:
// azul = nova, amarelo = aprendendo (tem card), sem cor = conhecida.
// Clique numa palavra: tradução + salvar card + marcar como conhecida.
// Fonte de verdade: words/cards (aprendendo) e known_words (conhecidas),
// agrupadas por família via utils/lemma.js (run/running/ran = 1).
import { db as lfDb } from '../../../utils/db.js';
import { playNaturalAudio } from '../core/tts.js';
import { translator } from '../../../utils/translator.js';
import { lemma } from '../../../utils/lemma.js';
import { parseEpub } from '../core/epub.js';

const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
const TEXTS_KEY = 'lf_reader_texts';
const URL_IMPORT_EDGE_URL = 'https://qnutoswrufznztoznlql.supabase.co/functions/v1/url-import';

// Onda 3.1: importar por URL passa pela Edge Function (o browser não
// consegue fetch cross-origin de qualquer site — CORS). O servidor busca
// por fora e devolve só o texto extraído, nunca o HTML bruto de terceiros.
async function importFromUrl(url) {
  const token = await lfDb._getToken();
  if (!token) throw new Error('Faça login para importar por URL.');
  const res = await fetch(URL_IMPORT_EDGE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    let msg = 'Não foi possível importar essa URL.';
    try { const err = await res.json(); if (err?.error) msg = err.error; } catch { /* mantém msg genérica */ }
    throw new Error(msg);
  }
  return res.json(); // { title, text }
}

let knownLemmas = new Set();
let learningLemmas = new Set();
let currentText = null; // { id, title, content, addedAt }

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
  } catch { return null; }
}

function loadTexts() {
  try { return JSON.parse(localStorage.getItem(TEXTS_KEY) || '[]'); }
  catch { return []; }
}

function saveTexts(texts) {
  localStorage.setItem(TEXTS_KEY, JSON.stringify(texts));
}

async function loadStatusSets() {
  knownLemmas = new Set();
  learningLemmas = new Set();
  try {
    const [known, words, cards] = await Promise.all([
      lfDb.getAllKnownWords(),
      lfDb.getAllWords(),
      lfDb.getAllCards(),
    ]);
    const matureByWordId = {};
    (cards || []).forEach(c => { matureByWordId[c.word_id] = c.status === 'mature'; });
    (known || []).forEach(k => knownLemmas.add(lemma(k.word)));
    (words || []).forEach(w => {
      const l = lemma(w.word);
      if (!l) return;
      if (matureByWordId[w.id]) knownLemmas.add(l);
      else learningLemmas.add(l);
    });
  } catch (e) {
    console.warn('[Reader] Erro ao carregar status das palavras:', e);
  }
}

function wordStatus(word) {
  const l = lemma(word);
  if (!l || l.length <= 1) return 'known'; // "a", "I" etc não contam
  if (knownLemmas.has(l)) return 'known';
  if (learningLemmas.has(l)) return 'learning';
  return 'new';
}

// Tokeniza preservando espaços/pontuação; palavras viram spans clicáveis
function renderTokens(content) {
  const parts = content.split(/([a-zA-Z][a-zA-Z'-]*)/g);
  return parts.map((p, i) => {
    if (i % 2 === 1) { // grupos ímpares são as palavras capturadas
      const st = wordStatus(p);
      return `<span class="rw rw-${st}" data-w="${p}">${p}</span>`;
    }
    return p.replace(/\n/g, '<br>');
  }).join('');
}

// Frase ao redor de uma palavra (para o context_sentence do card)
function sentenceAround(content, word) {
  const sentences = content.split(/(?<=[.!?])\s+/);
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return sentences.find(s => re.test(s))?.trim().slice(0, 300) || '';
}

function textStats(content) {
  const words = content.match(/[a-zA-Z][a-zA-Z'-]*/g) || [];
  const fams = new Set(words.map(lemma).filter(l => l && l.length > 1));
  let known = 0;
  fams.forEach(l => { if (knownLemmas.has(l)) known++; });
  return { total: fams.size, known, pct: fams.size ? Math.round((known / fams.size) * 100) : 0 };
}

export async function renderReader(container, app) {
  injectStyles();
  container.innerHTML = '<div style="padding:40px; text-align:center; color:var(--color-text-light);">Carregando leitor…</div>';
  await loadStatusSets();

  const texts = loadTexts();
  container.innerHTML = `
    <div style="padding:clamp(16px, 5vw, 40px); max-width:900px; margin:0 auto; padding-bottom:100px;">
      <h1 style="font-size:32px; color:var(--color-text); margin-bottom:8px;">📖 Leitor</h1>
      <div style="background:rgba(28,176,246,0.08); border:2px solid var(--color-secondary); border-radius:var(--radius-md); padding:16px 20px; margin-bottom:24px;">
        <p style="color:var(--color-text); font-weight:700; margin-bottom:8px;">Como funciona (3 passos):</p>
        <p style="color:var(--color-text-light); font-size:14px; line-height:1.7; margin:0;">
          <strong>1.</strong> Cole qualquer texto em inglês (letra de música, artigo, roteiro de série).<br>
          <strong>2.</strong> Leia — cada palavra ganha uma cor: <span class="rw rw-new" style="cursor:default;">azul = você nunca viu</span> · <span class="rw rw-learning" style="cursor:default;">amarela = está aprendendo</span> · sem cor = já conhece.<br>
          <strong>3.</strong> Clique numa palavra pra ver a tradução, ouvir, <strong>salvar como flashcard</strong> ou marcar <strong>"já sei"</strong>. Quanto mais você lê, mais o app conhece seu vocabulário real.
        </p>
        <button id="rd-try-sample" style="margin-top:12px; background:none; border:none; color:var(--color-secondary); font-family:var(--font-main); font-weight:800; font-size:14px; cursor:pointer; text-decoration:underline;">✨ Experimentar com um texto de exemplo</button>
      </div>

      <div id="reader-import" style="background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-md); padding:24px; margin-bottom:24px;">
        <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px;">Importar novo texto</label>

        <div style="display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap;">
          <input id="rd-url" type="url" placeholder="Colar uma URL (artigo, notícia…)" style="flex:1; min-width:220px; padding:10px 12px; border:2px solid var(--color-border); border-radius:var(--radius-sm); font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text);">
          <button id="rd-url-fetch" class="btn btn-secondary" style="padding:10px 16px; white-space:nowrap;">🔗 Buscar da URL</button>
          <label class="btn btn-secondary" style="padding:10px 16px; white-space:nowrap; cursor:pointer; margin:0; display:inline-flex; align-items:center;">
            📖 Importar EPUB
            <input id="rd-epub" type="file" accept=".epub" style="display:none;">
          </label>
        </div>
        <div id="rd-import-status" style="font-size:13px; color:var(--color-text-light); margin-bottom:10px; min-height:0;"></div>

        <input id="rd-title" type="text" placeholder="Título (ex: Artigo sobre viagem)" style="width:100%; padding:12px; border:2px solid var(--color-border); border-radius:var(--radius-sm); font-family:var(--font-main); margin-bottom:12px; background:var(--color-bg-alt); color:var(--color-text);">
        <textarea id="rd-content" rows="5" placeholder="Cole aqui o texto em inglês (letra de música, artigo, roteiro, legenda…) — ou use os botões acima pra importar de uma URL/EPUB" style="width:100%; padding:12px; border:2px solid var(--color-border); border-radius:var(--radius-sm); font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text); resize:vertical;"></textarea>
        <button id="rd-add" class="btn btn-primary" style="margin-top:12px;">Adicionar à biblioteca</button>
      </div>

      <div id="reader-shelf">
        <h3 style="color:var(--color-text); margin-bottom:12px;">Minha biblioteca (${texts.length})</h3>
        <div id="rd-list">
          ${texts.length === 0 ? '<p style="color:var(--color-text-light);">Nenhum texto ainda. Cole o primeiro acima! 👆</p>' : texts.map(t => `
            <div class="rd-item" data-id="${t.id}" style="display:flex; justify-content:space-between; align-items:center; background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-md); padding:14px 18px; margin-bottom:10px; cursor:pointer;">
              <div>
                <div style="font-weight:800; color:var(--color-text);">${t.title}</div>
                <div style="font-size:12px; color:var(--color-text-light);">${(t.content.match(/[a-zA-Z][a-zA-Z'-]*/g) || []).length} palavras · ${new Date(t.addedAt).toLocaleDateString('pt-BR')}</div>
              </div>
              <button class="rd-del" data-id="${t.id}" style="background:none; border:none; cursor:pointer; font-size:16px;" title="Excluir texto">🗑️</button>
            </div>`).join('')}
        </div>
      </div>

      <div id="reader-view" class="hidden">
        <button id="rd-back" style="background:none; border:none; color:var(--color-secondary); font-family:var(--font-main); font-weight:800; cursor:pointer; margin-bottom:16px;">← Voltar à biblioteca</button>
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:16px;">
          <h2 id="rd-view-title" style="color:var(--color-text);"></h2>
          <div id="rd-view-stats" style="font-size:13px; font-weight:700; color:var(--color-text-light);"></div>
        </div>
        <div id="rd-view-body" style="background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-md); padding:28px; font-size:20px; line-height:2.0; color:var(--color-text);"></div>
      </div>

      <div id="rd-popup" class="hidden" style="position:fixed; z-index:9999; background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-md); box-shadow:0 10px 30px rgba(0,0,0,0.25); padding:16px; width:260px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong id="rdp-word" style="color:var(--color-text); font-size:18px;"></strong>
          <button id="rdp-audio" style="background:none; border:none; cursor:pointer; font-size:18px;" title="Ouvir">🔊</button>
        </div>
        <div id="rdp-trans" style="color:var(--color-text-light); font-size:14px; margin-bottom:12px; min-height:18px;">…</div>
        <div style="display:flex; gap:8px;">
          <button id="rdp-save" class="btn btn-primary" style="flex:1; padding:8px; font-size:12px;">💾 Salvar</button>
          <button id="rdp-known" class="btn btn-secondary" style="flex:1; padding:8px; font-size:12px;">✓ Já sei</button>
        </div>
      </div>
    </div>
  `;

  const shelf = document.getElementById('reader-shelf');
  const importBox = document.getElementById('reader-import');
  const view = document.getElementById('reader-view');
  const popup = document.getElementById('rd-popup');
  let popupWord = null;

  function openText(t) {
    currentText = t;
    shelf.classList.add('hidden');
    importBox.classList.add('hidden');
    view.classList.remove('hidden');
    document.getElementById('rd-view-title').textContent = t.title;
    document.getElementById('rd-view-body').innerHTML = renderTokens(t.content);
    refreshStats();
  }

  function refreshStats() {
    if (!currentText) return;
    const s = textStats(currentText.content);
    document.getElementById('rd-view-stats').textContent = `Você conhece ${s.known}/${s.total} famílias de palavras (${s.pct}%)`;
  }

  function recolor(word) {
    const l = lemma(word);
    document.querySelectorAll('.rw').forEach(el => {
      if (lemma(el.dataset.w) === l) {
        el.classList.remove('rw-new', 'rw-learning', 'rw-known');
        el.classList.add(`rw-${wordStatus(el.dataset.w)}`);
      }
    });
    refreshStats();
  }

  document.getElementById('rd-try-sample')?.addEventListener('click', () => {
    openText({
      id: 'sample',
      title: 'Texto de exemplo — Morning Routine',
      content: `Every morning, I wake up early and make a cup of coffee. I usually check my phone while I eat breakfast, even though I know it is a bad habit. After that, I take a quick shower and get dressed for work.\n\nOn my way to the office, I listen to podcasts about science and technology. It helps me learn something new every single day. When I arrive, I say hello to my coworkers and start planning my tasks.\n\nThe most difficult part of my day is the afternoon meeting. Everyone talks fast, and sometimes I struggle to follow the conversation. But I never give up — little by little, I am getting better.`,
      addedAt: Date.now(),
    });
  });

  document.getElementById('rd-add').addEventListener('click', () => {
    const title = document.getElementById('rd-title').value.trim();
    const content = document.getElementById('rd-content').value.trim();
    if (!content) { app.showToast('Cole um texto primeiro.', 'info'); return; }
    const texts = loadTexts();
    const t = { id: Date.now().toString(36), title: title || `Texto ${texts.length + 1}`, content, addedAt: Date.now() };
    texts.unshift(t);
    saveTexts(texts);
    openText(t);
  });

  // Onda 3.1: importar por URL — preenche título/texto pro usuário revisar
  // antes de "Adicionar à biblioteca" (mesmo fluxo de sempre, sem atalho novo).
  const importStatus = document.getElementById('rd-import-status');
  document.getElementById('rd-url-fetch').addEventListener('click', async () => {
    const urlInput = document.getElementById('rd-url');
    const url = urlInput.value.trim();
    if (!url) { app.showToast('Cole uma URL primeiro.', 'info'); return; }
    const btn = document.getElementById('rd-url-fetch');
    btn.disabled = true;
    importStatus.textContent = '⏳ Buscando e extraindo o texto…';
    try {
      const { title, text } = await importFromUrl(url);
      document.getElementById('rd-title').value = title || '';
      document.getElementById('rd-content').value = text || '';
      importStatus.textContent = `✅ Texto importado (${(text.match(/[a-zA-Z][a-zA-Z'-]*/g) || []).length} palavras). Revise abaixo e clique em "Adicionar à biblioteca".`;
      urlInput.value = '';
    } catch (err) {
      importStatus.textContent = '';
      app.showToast(err.message || 'Erro ao importar a URL.', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Onda 3.1: importar EPUB — descompacta e extrai o texto no navegador,
  // sem subir o arquivo pra lugar nenhum (só o texto plano vai pro localStorage).
  document.getElementById('rd-epub').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importStatus.textContent = '⏳ Lendo o EPUB…';
    try {
      const buffer = await file.arrayBuffer();
      const { title, content } = await parseEpub(buffer);
      document.getElementById('rd-title').value = title || file.name.replace(/\.epub$/i, '');
      document.getElementById('rd-content').value = content || '';
      importStatus.textContent = `✅ EPUB importado (${(content.match(/[a-zA-Z][a-zA-Z'-]*/g) || []).length} palavras). Revise abaixo e clique em "Adicionar à biblioteca".`;
    } catch (err) {
      importStatus.textContent = '';
      app.showToast(err.message || 'Erro ao ler o EPUB.', 'error');
    } finally {
      e.target.value = '';
    }
  });

  document.getElementById('rd-list').addEventListener('click', (e) => {
    const del = e.target.closest('.rd-del');
    if (del) {
      e.stopPropagation();
      const texts = loadTexts().filter(t => t.id !== del.dataset.id);
      saveTexts(texts);
      renderReader(container, app);
      return;
    }
    const item = e.target.closest('.rd-item');
    if (item) {
      const t = loadTexts().find(x => x.id === item.dataset.id);
      if (t) openText(t);
    }
  });

  document.getElementById('rd-back').addEventListener('click', () => renderReader(container, app));

  // Clique numa palavra: popup com tradução + ações
  document.getElementById('rd-view-body').addEventListener('click', async (e) => {
    const el = e.target.closest('.rw');
    if (!el) return;
    popupWord = el.dataset.w;
    document.getElementById('rdp-word').textContent = popupWord;
    document.getElementById('rdp-trans').textContent = '…';

    const rect = el.getBoundingClientRect();
    popup.style.left = `${Math.min(rect.left, window.innerWidth - 280)}px`;
    popup.style.top = `${rect.bottom + 8}px`;
    popup.classList.remove('hidden');

    const trans = await translateText(popupWord.toLowerCase());
    if (popupWord === el.dataset.w) {
      document.getElementById('rdp-trans').textContent = trans || 'Sem tradução.';
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (!popup.contains(e.target) && !e.target.closest('.rw')) popup.classList.add('hidden');
  });

  document.getElementById('rdp-audio').addEventListener('click', () => {
    if (popupWord) playNaturalAudio(popupWord, { lang: localStorage.getItem('lf_tts_lang') || 'en-US' });
  });

  document.getElementById('rdp-save').addEventListener('click', async () => {
    if (!popupWord) return;
    const w = popupWord.toLowerCase();
    const trans = document.getElementById('rdp-trans').textContent;
    try {
      await lfDb.saveWord({
        word: w,
        lang: 'en',
        translation: trans && trans !== '…' && trans !== 'Sem tradução.' ? trans : '',
        context_sentence: currentText ? sentenceAround(currentText.content, popupWord) : '',
        platform: 'reader',
      });
      learningLemmas.add(lemma(w));
      knownLemmas.delete(lemma(w));
      recolor(w);
      app.showToast(`"${w}" salva nos flashcards! 💾`, 'success');
    } catch (err) {
      console.error(err);
      app.showToast('Erro ao salvar. Está logado?', 'error');
    }
    popup.classList.add('hidden');
  });

  document.getElementById('rdp-known').addEventListener('click', async () => {
    if (!popupWord) return;
    const w = popupWord.toLowerCase();
    try {
      await lfDb.markAsKnown(w, 'en');
      knownLemmas.add(lemma(w));
      learningLemmas.delete(lemma(w));
      recolor(w);
      app.showToast(`"${w}" marcada como conhecida ✓`, 'success');
    } catch (err) {
      console.error(err);
      app.showToast('Erro ao marcar. Está logado?', 'error');
    }
    popup.classList.add('hidden');
  });
}

function injectStyles() {
  if (document.getElementById('reader-styles')) return;
  const style = document.createElement('style');
  style.id = 'reader-styles';
  style.innerHTML = `
    .rw { cursor: pointer; border-radius: 4px; padding: 0 2px; transition: background 0.15s; }
    .rw:hover { outline: 2px solid var(--color-secondary); }
    .rw-new { background: rgba(28, 176, 246, 0.18); }
    .rw-learning { background: rgba(255, 200, 0, 0.25); }
    .rw-known { background: transparent; }
    :root[data-theme="dark"] .rw-new { background: rgba(28, 176, 246, 0.28); }
    :root[data-theme="dark"] .rw-learning { background: rgba(255, 200, 0, 0.22); }
    @media (max-width: 480px) {
      #rd-view-body { padding: 16px !important; font-size: 17px !important; line-height: 1.8 !important; }
    }
  `;
  document.head.appendChild(style);
}
