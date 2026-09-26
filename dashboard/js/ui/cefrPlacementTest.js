// dashboard/js/ui/cefrPlacementTest.js
import { db as lfDb } from '../../../utils/db.js';
import {
  buildPlacementTest, scorePlacement, shuffleItem, LEVELS,
  sampleClozeItems, sampleListeningItems,
  clozeStartBand, scoreClozeLadder, clozePassThreshold,
  levelIndex, listeningBands, scoreListening, combinePlacement, writingPromptFor,
} from '../core/placement.js';
import { playNaturalAudio, stopAudio } from '../core/tts.js';
import { gradeWriting } from '../core/ai.js';
import { escapeHtml } from './viewState.js';

const isExtensionCtx = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id && (typeof location === 'undefined' || location.protocol === 'chrome-extension:');

// ── Teste de nivelamento CEFR em 4 FASES (modal) ─────────────────────────────
// Fase 1: vocabulário (reconhecimento + pseudo-palavras anti-chute)
// Fase 2: gramática/leitura em contexto (cloze ADAPTATIVO por banda — Oxford)
// Fase 3: escuta (frase falada → sentido, estilo Duolingo English Test)
// Fase 4: mini-produção escrita corrigida por IA (Onda 3.2)
// Resultado: combinação ponderada + diagnóstico de lacunas por habilidade.
export async function runPlacementTest(app, onDone) {
  let cefrMap, freqMap;
  try {
    const base = isExtensionCtx ? chrome.runtime.getURL('utils/') : '/utils/';
    [cefrMap, freqMap] = await Promise.all([
      fetch(`${base}cefr-wordlist.json`).then(r => r.json()),
      fetch(`${base}frequency-en.json`).then(r => r.json()),
    ]);
  } catch (e) {
    console.error('[Placement] Erro ao carregar wordlists:', e);
    app.showToast('Não consegui carregar o teste. Tente recarregar.', 'error');
    return;
  }

  const returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const overlay = document.createElement('div');
  overlay.id = 'placement-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'pl-dialog-title');
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(2,6,23,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; padding:20px;';
  overlay.innerHTML = '<div id="pl-box" style="background:var(--color-surface); border-radius:var(--radius-lg); border:2px solid var(--color-border); max-width:480px; width:100%; padding:32px; text-align:center;"></div>';
  document.body.appendChild(overlay);
  const box = overlay.querySelector('#pl-box');
  const closeAll = () => {
    stopAudio();
    overlay.remove();
    returnFocusTo?.focus();
  };

  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAll();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...overlay.querySelectorAll('button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  function frame(phaseLabel, progressPct, bodyHtml) {
    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h2 id="pl-dialog-title" tabindex="-1" style="color:var(--color-text); font-size:14px;">Nivelamento — ${phaseLabel}</h2>
        <button id="pl-close" type="button" aria-label="Fechar nivelamento" style="background:none; border:none; font-size:18px; cursor:pointer; color:var(--color-text-light);">✕</button>
      </div>
      <div role="progressbar" aria-label="Progresso do nivelamento" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPct}" style="width:100%; background:var(--color-border); height:8px; border-radius:4px; overflow:hidden; margin-bottom:24px;">
        <div style="width:${progressPct}%; height:100%; background:var(--color-primary); transition:width 0.2s;"></div>
      </div>
      ${bodyHtml}`;
    box.querySelector('#pl-close').addEventListener('click', closeAll);
    box.querySelector('#pl-dialog-title')?.focus();
  }

  // ── FASE 1: vocabulário ────────────────────────────────────────────────────
  const vocabItems = buildPlacementTest(cefrMap, freqMap);
  const vocabAnswers = [];
  let vIdx = 0;

  function showVocab() {
    frame('Fase 1/4: Vocabulário', Math.round((vIdx / vocabItems.length) * 25), `
      <p style="color:var(--color-text-light); font-size:13px; margin-bottom:8px;">Você conhece o significado desta palavra?</p>
      <div style="font-size:34px; font-weight:900; color:var(--color-text); margin-bottom:28px; min-height:44px;">${vocabItems[vIdx].word}</div>
      <div style="display:flex; gap:12px;">
        <button id="pl-no" class="btn" style="flex:1; background:var(--color-danger); color:white; border-bottom:4px solid var(--color-danger-shadow); padding:14px;">Não sei</button>
        <button id="pl-yes" class="btn btn-primary" style="flex:1; padding:14px;">✓ Conheço</button>
      </div>
      <p style="font-size:11px; color:var(--color-text-light); margin-top:16px;">Seja honesto: algumas palavras não existem — marcar "conheço" nelas derruba seu resultado.</p>`);
    const answer = (known) => {
      vocabAnswers.push({ band: vocabItems[vIdx].band, known });
      vIdx++;
      if (vIdx >= vocabItems.length) startCloze(scorePlacement(vocabAnswers));
      else showVocab();
    };
    box.querySelector('#pl-yes').addEventListener('click', () => answer(true));
    box.querySelector('#pl-no').addEventListener('click', () => answer(false));
  }

  // ── FASE 2: cloze adaptativo ───────────────────────────────────────────────
  function startCloze(vocabResult) {
    const ladder = LEVELS.slice(levelIndex(clozeStartBand(vocabResult.level)));
    const results = []; // [{band, correct, total}]
    let bandIdx = 0, itemIdx = 0, bandCorrect = 0;
    let items = sampleClozeItems(ladder[0]).map(i => shuffleItem(i));

    function showCloze() {
      const band = ladder[bandIdx];
      const item = items[itemIdx];
      const done = results.reduce((a, r) => a + r.total, 0) + itemIdx;
      const totalPlanned = results.reduce((a, r) => a + r.total, 0) + items.length; // aproximação (a escada pode subir mais)
      frame('Fase 2/4: Gramática em contexto', 25 + Math.round((done / totalPlanned) * 25), `
        <p style="color:var(--color-text-light); font-size:13px; margin-bottom:8px;">Complete a frase:</p>
        <div style="font-size:22px; font-weight:800; color:var(--color-text); margin-bottom:24px; min-height:56px;">${item.sentence.replace('___', '<span style="color:var(--color-secondary); border-bottom:3px solid var(--color-secondary); padding:0 8px;">___</span>')}</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${item.options.map((o, i) => `<button class="pl-opt btn" data-i="${i}" style="padding:12px; background:var(--color-bg-alt); color:var(--color-text); border:2px solid var(--color-border); font-weight:700;">${o}</button>`).join('')}
        </div>`);
      box.querySelectorAll('.pl-opt').forEach(btn => btn.addEventListener('click', () => {
        if (Number(btn.dataset.i) === item.answer) bandCorrect++;
        itemIdx++;
        if (itemIdx >= items.length) {
          results.push({ band, correct: bandCorrect, total: items.length });
          // ADAPTATIVO: passou (60%+) → sobe uma banda; falhou → para
          if (bandCorrect >= clozePassThreshold(items.length) && bandIdx < ladder.length - 1) {
            bandIdx++; itemIdx = 0; bandCorrect = 0;
            items = sampleClozeItems(ladder[bandIdx]).map(i => shuffleItem(i));
            showCloze();
          } else {
            startListening(vocabResult, scoreClozeLadder(results));
          }
        } else {
          showCloze();
        }
      }));
    }
    showCloze();
  }

  // ── FASE 3: listening ──────────────────────────────────────────────────────
  function startListening(vocabResult, clozeLevel) {
    const bands = listeningBands(clozeLevel);
    const items = bands.flatMap(b => sampleListeningItems(b).map(i => shuffleItem({ ...i, band: b })));
    let lIdx = 0, lCorrect = 0;

    function showListening() {
      const item = items[lIdx];
      frame('Fase 3/4: Escuta', 50 + Math.round((lIdx / items.length) * 25), `
        <p style="color:var(--color-text-light); font-size:13px; margin-bottom:12px;">Ouça e escolha o significado:</p>
        <button id="pl-play" class="btn btn-secondary" style="padding:14px 28px; font-size:16px; margin-bottom:20px;">Ouvir${lIdx === 0 ? ' a frase' : ' de novo'}</button>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${item.options.map((o, i) => `<button class="pl-opt btn" data-i="${i}" style="padding:12px; background:var(--color-bg-alt); color:var(--color-text); border:2px solid var(--color-border); font-weight:700; font-size:14px;">${o}</button>`).join('')}
        </div>`);
      const play = () => playNaturalAudio(item.sentence, { lang: 'en-US' });
      box.querySelector('#pl-play').addEventListener('click', play);
      play();
      box.querySelectorAll('.pl-opt').forEach(btn => btn.addEventListener('click', () => {
        stopAudio();
        if (Number(btn.dataset.i) === item.answer) lCorrect++;
        lIdx++;
        if (lIdx >= items.length) {
          const listeningLevel = scoreListening(clozeLevel, lCorrect, items.length);
          startWriting(vocabResult, clozeLevel, listeningLevel);
        } else {
          showListening();
        }
      }));
    }
    showListening();
  }

  // ── FASE 4: mini-produção escrita corrigida por IA (Onda 3.2) ───────────────
  function startWriting(vocabResult, clozeLevel, listeningLevel) {
    // Nível "de trabalho" pra escolher o prompt: pior entre cloze/listening
    // (não adianta pedir um texto C1 pra quem patinou na gramática).
    const workingLevel = LEVELS[Math.min(levelIndex(clozeLevel), levelIndex(listeningLevel))];
    const prompt = writingPromptFor(workingLevel);
    const MIN_WORDS = 15;

    frame('Fase 4/4: Produção escrita', 75, `
      <label for="pl-writing" style="color:var(--color-text-light); font-size:13px; margin-bottom:8px; display:block;">Escreva em inglês (opcional, mas recomendado — refina seu resultado):</label>
      <p id="pl-writing-prompt" style="font-size:15px; font-weight:700; color:var(--color-text); margin-bottom:14px;">${prompt}</p>
      <textarea id="pl-writing" rows="5" aria-describedby="pl-writing-prompt pl-writing-count" placeholder="Write your answer here…" style="width:100%; padding:12px; border:2px solid var(--color-border); border-radius:var(--radius-sm); font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text); resize:vertical; margin-bottom:8px;"></textarea>
      <p id="pl-writing-count" role="status" aria-live="polite" style="font-size:11px; color:var(--color-text-light); margin-bottom:16px;">0 palavras (mínimo ${MIN_WORDS})</p>
      <button id="pl-writing-submit" class="btn btn-primary" style="width:100%; padding:14px;" disabled>Enviar pra correção</button>
      <button id="pl-writing-skip" style="background:none; border:none; color:var(--color-text-light); font-family:var(--font-main); font-weight:700; font-size:13px; cursor:pointer; margin-top:12px;">Pular esta etapa</button>`);

    const textarea = box.querySelector('#pl-writing');
    const counter = box.querySelector('#pl-writing-count');
    const submitBtn = box.querySelector('#pl-writing-submit');
    const wordCount = (s) => (s.match(/[a-zA-Z''-]+/g) || []).length;
    textarea.addEventListener('input', () => {
      const n = wordCount(textarea.value);
      counter.textContent = `${n} ${n === 1 ? 'palavra' : 'palavras'} (mínimo ${MIN_WORDS})`;
      submitBtn.disabled = n < MIN_WORDS;
    });

    box.querySelector('#pl-writing-skip').addEventListener('click', () => {
      finish(vocabResult, clozeLevel, listeningLevel, null);
    });

    submitBtn.addEventListener('click', async () => {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Corrigindo com IA…';
      try {
        const result = await gradeWriting(textarea.value.trim(), prompt, workingLevel);
        finish(vocabResult, clozeLevel, listeningLevel, result);
      } catch (e) {
        console.warn('[Placement] Correção da escrita falhou, seguindo sem ajuste:', e);
        finish(vocabResult, clozeLevel, listeningLevel, null);
      }
    });
  }

  // ── Resultado combinado + lacunas ──────────────────────────────────────────
  function finish(vocabResult, clozeLevel, listeningLevel, writingResult) {
    const combo = combinePlacement(vocabResult.level, clozeLevel, listeningLevel, vocabResult.honesty, writingResult?.adjust || 0);
    const levelNames = { A1: 'Iniciante', A2: 'Básico', B1: 'Intermediário', B2: 'Fluente Base', C1: 'Avançado', C2: 'Proficiente' };
    const skillRow = (label, lvl) => `
      <div style="display:flex; justify-content:space-between; padding:8px 12px; background:var(--color-bg-alt); border-radius:8px; font-size:14px;">
        <span style="color:var(--color-text-light); font-weight:700;">${label}</span>
        <strong style="color:var(--color-text);">${lvl}</strong>
      </div>`;
    box.innerHTML = `
      <div style="font-size:13px; margin-bottom:12px; color:var(--color-text-light);">Resultado da estimativa</div>
      <h2 style="color:var(--color-primary); font-size:40px; margin-bottom:4px;">${combo.level}</h2>
      <p style="color:var(--color-text); font-weight:800; margin-bottom:16px;">${levelNames[combo.level] || ''}</p>
      <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:16px; text-align:left;">
        ${skillRow('Vocabulário', combo.breakdown.vocab)}
        ${skillRow('Gramática e leitura', combo.breakdown.cloze)}
        ${skillRow('Escuta', combo.breakdown.listening)}
      </div>
      ${writingResult?.feedback ? `<p style="text-align:left; font-size:13px; color:var(--color-text); background:rgba(28,176,246,0.08); border:1px solid var(--color-secondary); border-radius:8px; padding:10px 12px; margin-bottom:12px;">${escapeHtml(writingResult.feedback)}</p>` : ''}
      ${combo.gaps.length ? `<p style="color:#ff9600; font-size:13px; font-weight:700; margin-bottom:12px;">Ponto a reforçar: ${combo.gaps.join(', ')}.</p>` : ''}
      ${combo.retestRequired ? '<p style="color:var(--color-danger); font-size:13px; margin-bottom:16px;">As pseudo-palavras indicam respostas por chute. Por segurança, este resultado não será aplicado: refaça o teste com calma.</p>' : '<p style="color:var(--color-text-light); font-size:13px; margin-bottom:16px;">Nível aplicado em todo o sistema: IA, histórias e legendas.</p>'}
      <button id="pl-apply" class="btn btn-primary" style="width:100%; padding:14px;" ${combo.retestRequired ? 'disabled aria-disabled="true" title="Refaça o teste para aplicar um resultado confiável"' : ''}>Usar este nível</button>
      <button id="pl-redo" style="background:none; border:none; color:var(--color-text-light); font-family:var(--font-main); font-weight:700; font-size:13px; cursor:pointer; margin-top:12px;">Refazer o teste</button>`;

    box.querySelector('#pl-apply').addEventListener('click', async () => {
      if (combo.retestRequired) return;
      try {
        const saved = await Promise.all([
          lfDb.setSetting('lf_cefr_level', combo.level),
          lfDb.setSetting('cefrTargetLevel', combo.level),
        ]);
        if (saved.some(result => !result)) throw new Error('Sincronização não confirmada');
        app.showToast(`Nível ${combo.level} aplicado.`, 'success');
      } catch {
        app.showToast('Erro ao salvar o nível.', 'error');
        return;
      }
      closeAll();
      if (onDone) onDone(combo.level);
    });
    box.querySelector('#pl-redo').addEventListener('click', () => {
      closeAll();
      runPlacementTest(app, onDone);
    });
  }

  showVocab();
}
