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
import { renderViewState } from './viewState.js';
import { bindReadingHeader, renderReadingHeader } from './readingHub.js';

const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
const TEXTS_KEY = 'lf_reader_texts';
const READER_MIGRATION_KEY = 'lf_reader_texts_migrated';
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
let reviewLemmas = new Set(); // Onda 9: gradiente — card em 'review' (já graduou, ainda não é 'mature')
let currentText = null; // { id, title, content, addedAt }
let readerDocumentController = null;

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

function normalizeText(row) {
  return {
    id: String(row.id),
    title: row.title || 'Texto',
    content: row.content || '',
    source: row.source || 'pasted',
    addedAt: row.created_at ? new Date(row.created_at).getTime() : Number(row.addedAt || Date.now()),
  };
}

async function loadSyncedTexts() {
  const local = loadTexts();
  const cloud = await lfDb.getReaderTexts();
  if (!Array.isArray(cloud)) return local;

  // O cache anterior à sincronização é importado uma única vez por usuário.
  // A inserção ignora conflitos para nunca sobrescrever uma edição mais nova.
  const userId = await lfDb.getCurrentUserId();
  const migrationMarker = userId ? `${READER_MIGRATION_KEY}:${userId}` : null;
  const needsMigration = migrationMarker && localStorage.getItem(migrationMarker) !== '1';
  if (needsMigration && local.length) {
    await Promise.all(local.map((text) => lfDb.migrateReaderText({ ...text, source: text.source || 'migration' })));
    const migrated = await lfDb.getReaderTexts();
    if (Array.isArray(migrated)) {
      const texts = migrated.map(normalizeText);
      saveTexts(texts);
      localStorage.setItem(migrationMarker, '1');
      return texts;
    }
  }

  if (needsMigration) localStorage.setItem(migrationMarker, '1');

  const texts = cloud.map(normalizeText);
  saveTexts(texts);
  return texts;
}

function escapeText(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

async function loadStatusSets() {
  knownLemmas = new Set();
  learningLemmas = new Set();
  reviewLemmas = new Set();
  try {
    const [known, words, cards] = await Promise.all([
      lfDb.getAllKnownWords(),
      lfDb.getAllWords(),
      lfDb.getAllCards(),
    ]);
    // Onda 9 (gradiente estilo LingQ, sem coluna nova): em vez de só
    // novo/aprendendo/sei, usa os 4 estágios que o FSRS já rastreia de
    // verdade — new/learning/review/mature. Não é "quantas vezes você viu a
    // palavra" (a métrica crua da LingQ), é "o quão firme sua memória dela
    // está" — mais fiel ao que a repetição espaçada mede.
    const statusByWordId = {};
    (cards || []).forEach(c => { statusByWordId[c.word_id] = c.status; });
    (known || []).forEach(k => knownLemmas.add(lemma(k.word)));
    (words || []).forEach(w => {
      const l = lemma(w.word);
      if (!l) return;
      // Onda 9 (auditoria de bugs): `st` vem `undefined` pra palavras SEM
      // card ainda (ex.: saveWord() salvou a palavra mas a criação do card
      // falhou por rede — são operações separadas). Isso caía no `else` e
      // pintava como "aprendendo" (amarelo) uma palavra nunca estudada.
      const st = statusByWordId[w.id];
      if (st === 'mature') knownLemmas.add(l);
      else if (st === 'review') reviewLemmas.add(l);
      else if (st) learningLemmas.add(l); // card existe (status 'new'/'learning') mas ainda não avançou
      // sem `st`: sem card nenhum ainda — fica 'new' (nenhum set), igual ao comportamento padrão de wordStatus()
    });
    return true;
  } catch (e) {
    console.warn('[Reader] Erro ao carregar status das palavras:', e);
    return false;
  }
}

function wordStatus(word) {
  const l = lemma(word);
  if (!l || l.length <= 1) return 'known'; // "a", "I" etc não contam
  if (knownLemmas.has(l)) return 'known';
  if (reviewLemmas.has(l)) return 'review';
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
  // Voltar à estante e tentar novamente redesenham esta view sem navegar.
  // Abortar o controlador anterior impede listeners globais duplicados.
  readerDocumentController?.abort();
  const documentController = new AbortController();
  readerDocumentController = documentController;
  app.onLeaveView?.(() => {
    if (readerDocumentController === documentController) readerDocumentController = null;
    documentController.abort();
  });
  injectStyles();
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = renderViewState({ kind: 'loading', title: 'Carregando seus textos…', message: 'Preparando sua leitura e o estado da memória.' });
  const statusLoaded = await loadStatusSets();
  container.setAttribute('aria-busy', 'false');

  let texts;
  try {
    texts = await loadSyncedTexts();
  } catch (error) {
    console.warn('[Reader] Sincronização indisponível; usando cópia local.', error);
    texts = loadTexts();
  }
  container.innerHTML = `
    <div style="padding:clamp(16px, 5vw, 40px); max-width:900px; margin:0 auto; padding-bottom:100px;">
      ${renderReadingHeader('reader')}
      ${statusLoaded ? '' : '<div class="reading-partial-notice" role="status">O texto está disponível, mas não foi possível carregar seu progresso; algumas cores podem estar incompletas.<button type="button" id="btn-reader-status-retry">Tentar novamente</button></div>'}
      <details class="reading-help">
        <summary>Como funciona</summary>
        <p style="color:var(--color-text-light); font-size:14px; line-height:1.7; margin:0;">
          <strong>1.</strong> Cole qualquer texto em inglês (letra de música, artigo, roteiro de série).<br>
          <strong>2.</strong> Leia — cada palavra ganha uma cor pelo estágio real na memória: <span class="rw rw-new" style="cursor:default;">azul = nunca viu</span> · <span class="rw rw-learning" style="cursor:default;">amarela = aprendendo</span> · <span class="rw rw-review" style="cursor:default;">verde clara = já graduou, ainda fixando</span> · sem cor = consolidada.<br>
          <strong>3.</strong> Clique num termo para ver a tradução, ouvir, <strong>salvar no Cofre para revisar</strong> ou marcar <strong>"já sei"</strong>. Quanto mais você lê, mais o app conhece seu vocabulário real.
        </p>
        <button id="rd-try-sample" style="margin-top:12px; background:none; border:none; color:var(--color-secondary); font-family:var(--font-main); font-weight:800; font-size:14px; cursor:pointer; text-decoration:underline;">✨ Experimentar com um texto de exemplo</button>
      </details>

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
        <button id="rd-add" class="btn btn-primary" style="margin-top:12px;">Salvar texto</button>
      </div>

      <div id="reader-shelf">
        <h3 style="color:var(--color-text); margin-bottom:12px;">Meus textos (${texts.length})</h3>
        <div id="rd-list">
          ${texts.length === 0 ? renderViewState({ kind: 'empty', title: 'Você ainda não adicionou textos', message: 'Cole, importe ou experimente o texto de exemplo acima.', compact: true }) : texts.map(t => `
            <div class="rd-item" data-id="${t.id}" style="display:flex; justify-content:space-between; align-items:center; background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-md); padding:14px 18px; margin-bottom:10px; cursor:pointer;">
              <div>
                <div style="font-weight:800; color:var(--color-text);">${escapeText(t.title)}</div>
                <div style="font-size:12px; color:var(--color-text-light);">${(t.content.match(/[a-zA-Z][a-zA-Z'-]*/g) || []).length} palavras · ${new Date(t.addedAt).toLocaleDateString('pt-BR')}</div>
              </div>
              <button class="rd-del" data-id="${t.id}" style="background:none; border:none; cursor:pointer; font-size:16px;" title="Excluir texto">🗑️</button>
            </div>`).join('')}
        </div>
      </div>

      <div id="reader-view" class="hidden">
        <button id="rd-back" style="background:none; border:none; color:var(--color-secondary); font-family:var(--font-main); font-weight:800; cursor:pointer; margin-bottom:16px;">← Voltar aos textos</button>
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
          <button id="rdp-save" class="btn btn-primary" style="flex:1; padding:8px; font-size:12px;">Salvar no Cofre</button>
          <button id="rdp-known" class="btn btn-secondary" style="flex:1; padding:8px; font-size:12px;">✓ Já sei</button>
        </div>
      </div>
    </div>
  `;
  bindReadingHeader(container, app);
  container.querySelector('#btn-reader-status-retry')?.addEventListener('click', () => renderReader(container, app));

  const shelf = document.getElementById('reader-shelf');
  const importBox = document.getElementById('reader-import');
  const view = document.getElementById('reader-view');
  const popup = document.getElementById('rd-popup');
  let popupWord = null;
  let pendingImportSource = 'pasted';

  function hidePopup() {
    popup.classList.add('hidden');
  }

  function positionPopup(anchorRect) {
    const viewportMargin = 12;
    const mobileNavClearance = window.innerWidth <= 768 ? 82 : viewportMargin;
    const popupRect = popup.getBoundingClientRect();
    const maxLeft = Math.max(viewportMargin, window.innerWidth - popupRect.width - viewportMargin);
    const left = Math.min(Math.max(viewportMargin, anchorRect.left), maxLeft);
    const below = anchorRect.bottom + 8;
    const maxTop = window.innerHeight - mobileNavClearance - popupRect.height;
    const above = anchorRect.top - popupRect.height - 8;
    const top = below <= maxTop ? below : Math.max(viewportMargin, Math.min(above, maxTop));
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  }

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
        el.classList.remove('rw-new', 'rw-learning', 'rw-review', 'rw-known');
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

  document.getElementById('rd-add').addEventListener('click', async () => {
    const title = document.getElementById('rd-title').value.trim();
    const content = document.getElementById('rd-content').value.trim();
    if (!content) { app.showToast('Cole um texto primeiro.', 'info'); return; }
    const t = { id: crypto.randomUUID(), title: title || `Texto ${texts.length + 1}`, content, source: pendingImportSource, addedAt: Date.now() };
    try {
      await lfDb.saveReaderText(t);
      texts.unshift(t);
      saveTexts(texts);
      pendingImportSource = 'pasted';
      openText(t);
    } catch (error) {
      console.error('[Reader] Falha ao salvar texto:', error);
      app.showToast('Não foi possível sincronizar o texto. Tente novamente.', 'error');
    }
  });

  // Onda 3.1: importar por URL — preenche título/texto pro usuário revisar
  // antes de "Salvar texto" (mesmo fluxo de sempre, sem atalho novo).
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
      pendingImportSource = 'url';
      importStatus.textContent = `✅ Texto importado (${(text.match(/[a-zA-Z][a-zA-Z'-]*/g) || []).length} palavras). Revise abaixo e clique em "Salvar texto".`;
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
      pendingImportSource = 'epub';
      importStatus.textContent = `✅ EPUB importado (${(content.match(/[a-zA-Z][a-zA-Z'-]*/g) || []).length} palavras). Revise abaixo e clique em "Salvar texto".`;
    } catch (err) {
      importStatus.textContent = '';
      app.showToast(err.message || 'Erro ao ler o EPUB.', 'error');
    } finally {
      e.target.value = '';
    }
  });

  document.getElementById('rd-list').addEventListener('click', async (e) => {
    const del = e.target.closest('.rd-del');
    if (del) {
      e.stopPropagation();
      try {
        await lfDb.deleteReaderText(del.dataset.id);
        texts = texts.filter(t => t.id !== del.dataset.id);
        saveTexts(texts);
        renderReader(container, app);
      } catch (error) {
        console.error('[Reader] Falha ao excluir texto:', error);
        app.showToast('Não foi possível excluir o texto sincronizado.', 'error');
      }
      return;
    }
    const item = e.target.closest('.rd-item');
    if (item) {
      const t = texts.find(x => x.id === item.dataset.id);
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

    popup.classList.remove('hidden');
    positionPopup(el.getBoundingClientRect());

    const trans = await translateText(popupWord.toLowerCase());
    if (popupWord === el.dataset.w) {
      document.getElementById('rdp-trans').textContent = trans || 'Sem tradução.';
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (!popup.contains(e.target) && !e.target.closest('.rw')) hidePopup();
  }, { signal: documentController.signal });
  window.addEventListener('resize', hidePopup, { signal: documentController.signal });
  window.addEventListener('orientationchange', hidePopup, { signal: documentController.signal });

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
      app.showToast(`"${w}" foi salva no Cofre para revisão.`, 'success');
    } catch (err) {
      console.error(err);
      app.showToast('Não foi possível salvar no Cofre. Tente novamente.', 'error');
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
      app.showToast('Não foi possível marcar este termo como conhecido.', 'error');
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
    .rw-review { background: rgba(88, 204, 2, 0.16); }
    .rw-known { background: transparent; }
    :root[data-theme="dark"] .rw-new { background: rgba(28, 176, 246, 0.28); }
    :root[data-theme="dark"] .rw-learning { background: rgba(255, 200, 0, 0.22); }
    :root[data-theme="dark"] .rw-review { background: rgba(88, 204, 2, 0.2); }
    @media (max-width: 480px) {
      #rd-view-body { padding: 16px !important; font-size: 17px !important; line-height: 1.8 !important; }
    }
  `;
  document.head.appendChild(style);
}
