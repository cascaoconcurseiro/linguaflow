// dashboard/js/ui/settingsView.js
import { db as lfDb } from '../../../utils/db.js';
import {
  buildPlacementTest, scorePlacement, shuffleItem, LEVELS,
  sampleClozeItems, sampleListeningItems,
  CLOZE_BANK, LISTENING_BANK, clozeStartBand, scoreClozeLadder, clozePassThreshold,
  levelIndex, listeningBands, scoreListening, combinePlacement, writingPromptFor,
} from '../core/placement.js';
import { playNaturalAudio, stopAudio, preloadKokoro } from '../core/tts.js';
import { gradeWriting } from '../core/ai.js';
import { bindViewStateAction, renderViewState } from './viewState.js';

const isExtensionCtx = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;

// ── Teste de nivelamento CEFR em 3 FASES (modal) ─────────────────────────────
// Fase 1: vocabulário (reconhecimento + pseudo-palavras anti-chute)
// Fase 2: gramática/leitura em contexto (cloze ADAPTATIVO por banda — Oxford)
// Fase 3: escuta (frase falada → sentido, estilo Duolingo English Test)
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

  const overlay = document.createElement('div');
  overlay.id = 'placement-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(2,6,23,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; padding:20px;';
  overlay.innerHTML = '<div id="pl-box" style="background:var(--color-surface); border-radius:var(--radius-lg); border:2px solid var(--color-border); max-width:480px; width:100%; padding:32px; text-align:center;"></div>';
  document.body.appendChild(overlay);
  const box = overlay.querySelector('#pl-box');
  const closeAll = () => { stopAudio(); overlay.remove(); };

  function frame(phaseLabel, progressPct, bodyHtml) {
    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <strong style="color:var(--color-text); font-size:14px;">🎯 Nivelamento — ${phaseLabel}</strong>
        <button id="pl-close" style="background:none; border:none; font-size:18px; cursor:pointer; color:var(--color-text-light);">✕</button>
      </div>
      <div style="width:100%; background:var(--color-border); height:8px; border-radius:4px; overflow:hidden; margin-bottom:24px;">
        <div style="width:${progressPct}%; height:100%; background:var(--color-primary); transition:width 0.2s;"></div>
      </div>
      ${bodyHtml}`;
    box.querySelector('#pl-close').addEventListener('click', closeAll);
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
        <button id="pl-play" class="btn btn-secondary" style="padding:14px 28px; font-size:16px; margin-bottom:20px;">🔊 Ouvir${lIdx === 0 ? ' a frase' : ' de novo'}</button>
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
      <p style="color:var(--color-text-light); font-size:13px; margin-bottom:8px;">Escreva em inglês (opcional, mas recomendado — refina seu resultado):</p>
      <p style="font-size:15px; font-weight:700; color:var(--color-text); margin-bottom:14px;">${prompt}</p>
      <textarea id="pl-writing" rows="5" placeholder="Write your answer here…" style="width:100%; padding:12px; border:2px solid var(--color-border); border-radius:var(--radius-sm); font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text); resize:vertical; margin-bottom:8px;"></textarea>
      <p id="pl-writing-count" style="font-size:11px; color:var(--color-text-light); margin-bottom:16px;">0 palavras (mínimo ${MIN_WORDS})</p>
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
      <div style="font-size:56px; margin-bottom:12px;">${vocabResult.honesty < 60 ? '🤨' : '🎓'}</div>
      <h2 style="color:var(--color-primary); font-size:40px; margin-bottom:4px;">${combo.level}</h2>
      <p style="color:var(--color-text); font-weight:800; margin-bottom:16px;">${levelNames[combo.level] || ''}</p>
      <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:16px; text-align:left;">
        ${skillRow('📖 Vocabulário', combo.breakdown.vocab)}
        ${skillRow('✍️ Gramática/Leitura', combo.breakdown.cloze)}
        ${skillRow('🎧 Escuta', combo.breakdown.listening)}
      </div>
      ${writingResult?.feedback ? `<p style="text-align:left; font-size:13px; color:var(--color-text); background:rgba(28,176,246,0.08); border:1px solid var(--color-secondary); border-radius:8px; padding:10px 12px; margin-bottom:12px;">📝 ${writingResult.feedback}</p>` : ''}
      ${combo.gaps.length ? `<p style="color:#ff9600; font-size:13px; font-weight:700; margin-bottom:12px;">💡 Ponto a reforçar: ${combo.gaps.join(', ')}.</p>` : ''}
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
        app.showToast(`Nível ${combo.level} aplicado! 🎓`, 'success');
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

export async function renderSettings(container, app) {
  // B1 do backlog (W6.4): BYOK removido — a IA passa SEMPRE pela Edge
  // Function com rate-limit por usuario; a chave do projeto vive so em
  // Supabase Secrets. Limpa a chave pessoal orfa de instalacoes antigas.
  try { await chrome.storage.local.remove('aiApiKey'); } catch (e) { /* web */ }
  // TODAS as chaves aqui são as MESMAS que o motor lê em getSRSSettings().
  // (Bug da auditoria: a tela salvava lf_srs_* e o motor lia outras chaves —
  // o usuário mexia, via "Salvo ✅" e nada mudava.)
  const settingKeys = ['lf_cefr_level', 'lf_tts_lang', 'lf_tts_speed',
    'graduating_interval', 'max_interval', 'interval_modifier', 'leech_threshold',
    'leech_action', 'lf_srs_retention', 'learning_steps', 'relearning_steps', 'new_per_day',
    'max_reviews_per_day', 'lf_vault_cap', 'lf_reverse_cards', 'lf_varied_exercises',
    'lf_audio_auto_front', 'lf_audio_auto_back'];
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = renderViewState({ kind: 'loading', title: 'Carregando suas configurações…', message: 'Lendo suas preferências sem alterar nenhum valor.' });
  let settings;
  try {
    settings = await lfDb.getSettings(settingKeys);
  } catch (error) {
    console.error('[Settings] Não foi possível carregar preferências:', error);
    container.setAttribute('aria-busy', 'false');
    container.innerHTML = renderViewState({ kind: 'error', title: 'Não foi possível carregar suas configurações', message: 'Nenhum valor padrão será salvo por cima das suas preferências. Verifique a conexão e tente novamente.', actionLabel: 'Tentar novamente', actionId: 'btn-settings-retry' });
    bindViewStateAction(container, 'btn-settings-retry', () => renderSettings(container, app));
    return;
  }
  container.setAttribute('aria-busy', 'false');
  const [savedCefr, savedTtsLang, savedTtsSpeed, srsGradInt, srsMaxInt, srsIntMod,
    srsLeech, srsLeechAction, srsRetentionRaw, srsSteps, srsRelearningSteps, srsNewPerDay, srsMaxRev,
    srsReverseRaw, srsVariedRaw, audioFrontRaw, audioBackRaw] = settingKeys.map(key => settings[key] ?? null);

  const cefr = savedCefr || '';
  const ttsLang = savedTtsLang || 'en-US';
  const ttsSpeed = savedTtsSpeed || 'normal';
  const gradInt = srsGradInt || '1';
  const maxInt = srsMaxInt || '36500';
  const intMod = srsIntMod || '100';
  const leechThresh = srsLeech || '8';
  const leechAction = srsLeechAction || 'tag';
  const srsRetention = Math.round((Number(srsRetentionRaw) || 0.9) * 100);
  const learningSteps = srsSteps || '1 10';
  const relearningSteps = srsRelearningSteps || '10';
  const newPerDay = String(Math.min(20, Math.max(0, Number(srsNewPerDay ?? 5) || 5)));
  const maxRevPerDay = srsMaxRev || '200';
  const vaultCap = settings.lf_vault_cap === undefined || settings.lf_vault_cap === null || settings.lf_vault_cap === '' ? 300 : settings.lf_vault_cap;
  const srsReverse = srsReverseRaw === true || srsReverseRaw === 'true';
  const srsVaried = srsVariedRaw === null || srsVariedRaw === true || srsVariedRaw === 'true';
  const audioFront = audioFrontRaw === null || audioFrontRaw === true || audioFrontRaw === 'true';
  const audioBack = audioBackRaw === null || audioBackRaw === true || audioBackRaw === 'true';

  container.innerHTML = `
    <div class="settings-page" style="padding: clamp(16px, 5vw, 40px); max-width: 800px; margin: 0 auto; padding-bottom:100px;">
      <h1 class="settings-page-title">Configurações</h1>
      <p class="settings-page-lede">Ajuste o essencial agora. Controles técnicos do motor ficam em Avançado.</p>

      <!-- CEFR Level Selector -->
      <div style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 8px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">Seu nível aproximado</h2>
        <p style="color:var(--color-text-light); margin-bottom:16px; font-size:14px;">Usamos esta estimativa para ajustar textos e explicações. Você pode mudar depois.</p>
        <div id="cefr-selector" style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="cefr-btn lf-btn-bounce" data-level="A1">A1<br><span>Iniciante</span></button>
          <button class="cefr-btn lf-btn-bounce" data-level="A2">A2<br><span>Básico</span></button>
          <button class="cefr-btn lf-btn-bounce" data-level="B1">B1<br><span>Intermediário</span></button>
          <button class="cefr-btn lf-btn-bounce" data-level="B2">B2<br><span>Intermediário alto</span></button>
          <button class="cefr-btn lf-btn-bounce" data-level="C1">C1<br><span>Avançado</span></button>
          <button class="cefr-btn lf-btn-bounce" data-level="C2">C2<br><span>Proficiente</span></button>
        </div>
        <button id="btn-placement" class="btn btn-secondary" style="margin-top:16px; width:100%;">🎯 Estimar meu nível (~4 min)</button>
        <p style="font-size:12px; color:var(--color-text-light); margin-top:8px;">Uma estimativa inicial com vocabulário, gramática em contexto e escuta — não substitui uma avaliação CEFR completa.</p>
      </div>

      <!-- Daily Limits (agora REAIS: controlam a fila de estudo) -->
      <div style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">Limites Diários</h2>
        <div style="display:flex; gap: 24px; margin-bottom: 8px;">
          <div style="flex:1;">
          <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px;">Novas expressões por dia</label>
            <input type="number" id="srs-new-per-day" value="${newPerDay}" min="0" max="20" style="width:100%; padding:12px; border:2px solid var(--color-border); border-radius:6px; background:var(--color-bg-alt); color:var(--color-text);">
          </div>
          <div style="flex:1;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px;">Revisões máximas/dia</label>
            <input type="number" id="srs-max-rev" value="${maxRevPerDay}" min="10" max="1000" style="width:100%; padding:12px; border:2px solid var(--color-border); border-radius:6px; background:var(--color-bg-alt); color:var(--color-text);">
          </div>
          <div style="flex:1;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px;" title="Teto do acervo: cofre cheio, palavra nova espera vaga. 0 desliga.">Teto do cofre (expressões ativas)</label>
            <input type="number" id="srs-vault-cap" value="${vaultCap}" min="0" max="2000" style="width:100%; padding:12px; border:2px solid var(--color-border); border-radius:6px; background:var(--color-bg-alt); color:var(--color-text);">
          </div>
        </div>
        <p style="font-size:12px; color:var(--color-text-light);">Cada expressão nova gera revisões futuras. Comece com 5; por segurança, o sistema introduz no máximo 20 por dia.</p>
      </div>

      <!-- Advanced FSRS Section -->
      <div style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">Motor de Memória (FSRS v4)</h2>
        <p style="color: var(--color-text-light); margin-bottom: 16px; line-height:1.5;">
          Otimizador de repetição espaçada. Substitui os multiplicadores fixos do Anki por um modelo de probabilidade de retenção de memória.
        </p>
        
        <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px;">Retenção Desejada (Recomendado: 90%): <span id="retention-val" style="color:var(--color-primary);">${srsRetention}%</span></label>
        <input type="range" id="retention-slider" min="80" max="97" value="${srsRetention}" style="width:100%; margin-bottom: 8px;">
        <p style="font-size:12px; color:var(--color-text-light); margin-bottom:16px;">90% é um bom ponto inicial. Valores maiores geram mais revisões; menores aceitam mais esquecimento.</p>
        
        <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px;">Repetições iniciais (minutos)</label>
        <input type="text" id="srs-learning-steps" value="${learningSteps}" placeholder="1 10" style="width:100%; padding:12px; border:2px solid var(--color-border); border-radius:6px; margin-bottom:16px; background:var(--color-bg-alt); color:var(--color-text);">
        <p style="font-size:12px; color:var(--color-text-light);">Exemplo: "1 10" faz uma expressão nova voltar em 1 e 10 minutos antes do agendamento normal.</p>

        <label style="font-weight:bold; color:var(--color-text); display:block; margin:16px 0 8px;">Repetição após esquecer (minutos)</label>
        <input type="text" id="srs-relearning-steps" value="${relearningSteps}" placeholder="10" style="width:100%; padding:12px; border:2px solid var(--color-border); border-radius:6px; margin-bottom:8px; background:var(--color-bg-alt); color:var(--color-text);">
        <p style="font-size:12px; color:var(--color-text-light);">Recomendado: "10". Um card antigo esquecido volta após 10 minutos e depois retorna ao agendamento FSRS.</p>
      </div>

      <!-- Advanced SRS -->
      <div style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">SRS Avançado (Nível Anki)</h2>
        <div style="display:flex; gap:16px; flex-wrap:wrap;">
          <div style="flex:1; min-width:180px;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Intervalo mínimo após graduação (dias)</label>
            <input type="number" id="srs-grad-interval" value="${gradInt}" min="1" max="30" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:6px; font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text);">
          </div>
          <div style="flex:1; min-width:180px;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Intervalo máximo (dias)</label>
            <input type="number" id="srs-max-interval" value="${maxInt}" min="30" max="36500" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:6px; font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text);">
          </div>
          <div style="flex:1; min-width:180px;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Modificador de intervalo (%)</label>
            <input type="number" id="srs-int-mod" value="${intMod}" min="50" max="200" step="5" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:6px; font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text);">
          </div>
          <div style="flex:1; min-width:180px;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Sinalizar item após N esquecimentos</label>
            <input type="number" id="srs-leech-thresh" value="${leechThresh}" min="1" max="50" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:6px; font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text);">
          </div>
          <div style="flex:1; min-width:180px;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Quando um item precisar de atenção</label>
            <select id="srs-leech-action" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:6px; font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text);">
              <option value="tag" ${leechAction === 'tag' ? 'selected' : ''}>Sinalizar e continuar</option>
              <option value="suspend" ${leechAction === 'suspend' ? 'selected' : ''}>Pausar revisões desse item</option>
            </select>
          </div>
        </div>
        <p style="font-size:12px; color:var(--color-text-light); margin-top:8px;">Todos estes valores alimentam o motor FSRS de verdade — mesmo nome de chave que o agendador usa. Modificador 100% = neutro; 80% = revisa mais cedo.</p>
        <label style="display:flex; align-items:center; gap:10px; margin-top:20px; font-weight:bold; color:var(--color-text); cursor:pointer;">
          <input type="checkbox" id="srs-reverse-cards" ${srsReverse ? 'checked' : ''} style="width:18px; height:18px;">
          Cartões reversos (🇧🇷→🇺🇸): às vezes mostrar a tradução e pedir o inglês
        </label>
        <p style="font-size:12px; color:var(--color-text-light); margin-top:6px; margin-left:28px;">Só para cards já graduados — dobra o valor de cada palavra, como as notas de 2 cartões do Anki.</p>
        <label style="display:flex; align-items:center; gap:10px; margin-top:14px; font-weight:bold; color:var(--color-text); cursor:pointer;">
          <input type="checkbox" id="srs-varied-exercises" ${srsVaried ? 'checked' : ''} style="width:18px; height:18px;">
          Exercícios variados (🧩 montar frase e 🎧 ditado) no estudo
        </label>
        <p style="font-size:12px; color:var(--color-text-light); margin-top:6px; margin-left:28px;">Estilo Duolingo, só para cards já graduados: acertou vale "Bom", errou vale "Errei" — o agendamento FSRS continua mandando.</p>
      </div>

      <!-- Onda 9: Perfis de SRS por categoria (paridade Anki — presets por baralho) -->
      <div style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 6px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">Perfis de SRS por Categoria</h2>
        <p style="font-size:12px; color:var(--color-text-light); margin-bottom:16px;">Idioms e gírias costumam pedir mais repetição que vocabulário básico — sobrescreva a retenção/steps/graduação só pra uma categoria. Vazio = usa o valor global acima.</p>
        <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:flex-end;">
          <div style="flex:1; min-width:160px;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Categoria</label>
            <select id="srscat-select" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:6px; font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text);">
              <option value="word">Vocabulário</option>
              <option value="phrasal">Phrasal verbs</option>
              <option value="idiom">Expressões (idioms)</option>
              <option value="slang">Gírias</option>
            </select>
          </div>
          <div style="flex:1; min-width:140px;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Retenção (%)</label>
            <input type="number" id="srscat-retention" min="80" max="97" placeholder="global" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:6px; font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text);">
          </div>
          <div style="flex:1; min-width:140px;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Learning steps</label>
            <input type="text" id="srscat-steps" placeholder="global" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:6px; font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text);">
          </div>
          <div style="flex:1; min-width:140px;">
            <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Graduação (dias)</label>
            <input type="number" id="srscat-grad" min="1" max="30" placeholder="global" style="width:100%; padding:10px; border:2px solid var(--color-border); border-radius:6px; font-family:var(--font-main); background:var(--color-bg-alt); color:var(--color-text);">
          </div>
        </div>
        <div style="display:flex; gap:10px; margin-top:14px;">
          <button id="srscat-save" class="btn btn-primary" style="padding:10px 20px; font-size:13px;">Salvar perfil desta categoria</button>
          <button id="srscat-clear" class="btn btn-outline" style="padding:10px 20px; font-size:13px;">Limpar (voltar ao global)</button>
        </div>
        <p id="srscat-status" style="font-size:12px; color:var(--color-text-light); margin-top:8px; min-height:16px;"></p>
      </div>

      <!-- Audio Options -->
      <div style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">Opções de Áudio (TTS Google Neural)</h2>
        <div style="display:flex; flex-direction:column; gap: 16px;">
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="audio-auto-front" ${audioFront ? 'checked' : ''} style="width:18px; height:18px;"> Reproduzir áudio automaticamente na Frente
          </label>
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="audio-auto-back" ${audioBack ? 'checked' : ''} style="width:18px; height:18px;"> Reproduzir áudio automaticamente no Verso
          </label>
          <label style="display:flex; align-items:flex-start; gap:8px; padding-top:8px; border-top:1px dashed var(--color-border);">
            <input type="checkbox" id="audio-kokoro" style="width:18px; height:18px; margin-top:2px;">
            <span>
              <strong>🎙️ Voz neural premium (Kokoro) — grátis e offline</strong><br>
              <span style="font-size:12px; color:var(--color-text-light);">Qualidade acima do Google TTS. Baixa ~90 MB na primeira vez e depois funciona até sem internet. Só no site (não na extensão). Requer navegador moderno.</span>
            </span>
          </label>
          <div id="kokoro-progress-box" class="hidden" style="margin-left:26px;">
            <div style="width:100%; background:var(--color-border); height:8px; border-radius:4px; overflow:hidden;">
              <div id="kokoro-progress-bar" style="width:0%; height:100%; background:var(--color-primary); transition:width 0.2s;"></div>
            </div>
            <p id="kokoro-progress-text" style="font-size:12px; color:var(--color-text-light); margin-top:6px;">Baixando modelo… 0%</p>
          </div>
          <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:8px;">
            <div style="flex:1; min-width:200px;">
              <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Sotaque</label>
              <div id="tts-lang-selector" style="display:flex; gap:8px;">
                <button class="tts-opt-btn" data-lang="en-US" style="flex:1; padding:10px; border-radius:var(--radius-sm); border:2px solid var(--color-primary); background:rgba(88,204,2,0.1); font-family:var(--font-main); font-weight:800; cursor:pointer; color:var(--color-text);">🇺🇸 Americano</button>
                <button class="tts-opt-btn" data-lang="en-GB" style="flex:1; padding:10px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:var(--color-surface); font-family:var(--font-main); font-weight:700; cursor:pointer; color:var(--color-text-light);">🇬🇧 Britânico</button>
              </div>
            </div>
            <div style="flex:1; min-width:200px;">
              <label style="font-weight:bold; color:var(--color-text); display:block; margin-bottom:8px; font-size:14px;">Velocidade</label>
              <div id="tts-speed-selector" style="display:flex; gap:8px;">
                <button class="tts-speed-btn" data-speed="slow" style="flex:1; padding:10px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:var(--color-surface); font-family:var(--font-main); font-weight:700; cursor:pointer; color:var(--color-text-light); font-size:13px;">🐢 Lento</button>
                <button class="tts-speed-btn" data-speed="normal" style="flex:1; padding:10px; border-radius:var(--radius-sm); border:2px solid var(--color-primary); background:rgba(88,204,2,0.1); font-family:var(--font-main); font-weight:800; cursor:pointer; font-size:13px; color:var(--color-text);">👌 Normal</button>
                <button class="tts-speed-btn" data-speed="native" style="flex:1; padding:10px; border-radius:var(--radius-sm); border:2px solid var(--color-border); background:var(--color-surface); font-family:var(--font-main); font-weight:700; cursor:pointer; color:var(--color-text-light); font-size:13px;">🚀 Nativo</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- B1: secao BYOK removida — IA e automatica via Edge Function -->

      <!-- Lembretes (Web Push REAL — opt-in explícito) -->
      <div id="push-section" style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px; display:none;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 8px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">🔔 Lembretes diários</h2>
        <p style="color:var(--color-text-light); margin-bottom:16px; font-size:14px;">Uma notificação por dia (no máximo) quando houver revisões pendentes ou sua ofensiva estiver em risco — mesmo com o site fechado. Você pode desativar quando quiser.</p>
        <label style="display:flex; align-items:center; gap:10px; font-weight:bold; color:var(--color-text); cursor:pointer;">
          <input type="checkbox" id="push-toggle" style="width:18px; height:18px;">
          Ativar lembretes de revisão neste dispositivo
        </label>
        <p id="push-status" style="font-size:12px; color:var(--color-text-light); margin-top:8px;"></p>
      </div>

      <!-- Reengajamento por e-mail (Onda 3.4 — opt-in explícito) -->
      <div id="email-section" style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 8px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">📧 Resumo por e-mail</h2>
        <p style="color:var(--color-text-light); margin-bottom:16px; font-size:14px;">No máximo 1 e-mail por semana: resumo do que você estudou ou um aviso se sua ofensiva estiver prestes a esfriar. Sem spam, cancele quando quiser.</p>
        <label style="display:flex; align-items:center; gap:10px; font-weight:bold; color:var(--color-text); cursor:pointer;">
          <input type="checkbox" id="email-toggle" style="width:18px; height:18px;">
          Ativar resumo semanal por e-mail
        </label>
        <p id="email-status" style="font-size:12px; color:var(--color-text-light); margin-top:8px;"></p>
      </div>

      <!-- Export Section -->
      <div style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-text); margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">Dados e Portabilidade</h2>
        <p style="color: var(--color-text-light); margin-bottom: 16px; line-height:1.5;">
          Você é dono dos seus dados. Baixe seu progresso para formato Anki ou CSV.
        </p>
        
        <div style="display: flex; gap: 16px; flex-wrap: wrap;">
          <button id="btn-export-csv" class="btn btn-outline" style="flex:1; min-width:160px;">
            📄 Exportar CSV
          </button>
          <button id="btn-export-anki" class="btn btn-secondary" style="flex:1; min-width:160px;">
            📦 Exportar pro Anki (.txt)
          </button>
        </div>
        <p style="font-size:12px; color:var(--color-text-light); margin-top:8px;">No Anki: Arquivo → Importar → selecione o .txt. Os campos (frente com frase, verso com tradução/fonética) e as etiquetas já vão prontos.</p>
        <div style="display:flex; gap:16px; flex-wrap:wrap; margin-top:16px; padding-top:16px; border-top:1px dashed var(--color-border);">
          <button id="btn-backup-json" class="btn btn-outline" style="flex:1; min-width:160px;">
            💾 Backup completo (.json)
          </button>
          <button id="btn-restore-json" class="btn btn-outline" style="flex:1; min-width:160px;">
            ♻️ Restaurar backup
          </button>
          <input type="file" id="restore-file-input" accept=".json,application/json" style="display:none;">
        </div>
        <p id="export-msg" style="color: var(--color-primary); margin-top: 12px; font-weight:bold; display:none;">Exportação concluída!</p>
      </div>

      <!-- Account Section -->
      <div style="background: var(--color-surface); border-radius: var(--radius-md); padding: 24px; border: 2px solid var(--color-border); margin-bottom: 24px;">
        <h2 style="font-size: 20px; color: var(--color-danger); margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom:8px;">Conta</h2>
        <p style="color: var(--color-text-light); margin-bottom: 16px; line-height:1.5;">
          Gerencie sua sessão no aplicativo.
        </p>
        
        <button id="btn-logout" class="btn" style="background-color: var(--color-danger); border-bottom: 4px solid var(--color-danger-shadow); width: 100%;">
          🚪 Sair da Conta
        </button>
      </div>
      
      <div style="text-align:right;">
      <button id="btn-save" class="btn btn-primary" style="padding: 16px 32px; font-size: 16px;">Salvar configurações</button>
      </div>
    </div>
  `;

  // A interface antiga apresentava onze painéis de igual peso. Os mesmos
  // controles e IDs permanecem, mas agora formam cinco decisões reconhecíveis.
  // Isso preserva o poder do Anki sem exigir que todo aluno pense como operador.
  const settingsPage = container.querySelector('.settings-page');
  const cards = [...settingsPage.children].filter(node => node.querySelector?.('h2'));
  const cardByTitle = new Map(cards.map(card => [card.querySelector('h2').textContent.trim(), card]));
  const group = (title, description, titles, { open = false, advanced = false } = {}) => {
    const details = document.createElement('details');
    details.className = `settings-group${advanced ? ' settings-group-advanced' : ''}`;
    details.open = open;
    details.innerHTML = `<summary><span><strong>${title}</strong><small>${description}</small></span><span class="settings-chevron" aria-hidden="true">⌄</span></summary><div class="settings-group-body"></div>`;
    const body = details.querySelector('.settings-group-body');
    titles.forEach(name => {
      const card = cardByTitle.get(name);
      if (card) body.appendChild(card);
    });
    return details;
  };
  const saveBar = container.querySelector('#btn-save')?.parentElement;
  const groups = [
      group('Seu aprendizado', 'Nível e carga diária', ['Seu nível aproximado', 'Limites Diários'], { open: true }),
    group('Memória', 'Retenção e passos de aprendizagem', ['Motor de Memória (FSRS v4)']),
    group('Som e lembretes', 'Áudio, notificações e resumo', ['Opções de Áudio (TTS Google Neural)', '🔔 Lembretes diários', '📧 Resumo por e-mail']),
    group('Dados e conta', 'Exportação, backup e sessão', ['Dados e Portabilidade', 'Conta']),
    group('Avançado', 'SRS detalhado, perfis e integrações', ['SRS Avançado (Nível Anki)', 'Perfis de SRS por Categoria'], { advanced: true }),
  ];
  settingsPage.querySelectorAll(':scope > div').forEach(node => {
    if (node !== saveBar && !groups.some(section => section.contains(node))) node.remove();
  });
  groups.forEach(section => settingsPage.insertBefore(section, saveBar));
  saveBar?.classList.add('settings-save-bar');

  document.getElementById('retention-slider').addEventListener('input', function(e) {
    document.getElementById('retention-val').innerText = e.target.value + '%';
  });

  // CEFR selector
  const cefrBtns = document.querySelectorAll('.cefr-btn');
  cefrBtns.forEach(btn => {
    if (btn.dataset.level === savedCefr) {
      btn.style.background = 'var(--color-primary)';
      btn.style.color = 'white';
      btn.style.borderColor = 'var(--color-primary)';
    }
    btn.addEventListener('click', async () => {
      cefrBtns.forEach(b => { b.style.background='var(--color-surface)'; b.style.color='var(--color-text)'; b.style.borderColor='var(--color-border)'; });
      btn.style.background = 'var(--color-primary)';
      btn.style.color = 'white';
      btn.style.borderColor = 'var(--color-primary)';
      try {
        // Dashboard e extensão só confirmam sucesso depois que os dois
        // espelhos persistem; assim a legenda nunca fica em outro nível.
        const saved = await Promise.all([
          lfDb.setSetting('lf_cefr_level', btn.dataset.level),
          lfDb.setSetting('cefrTargetLevel', btn.dataset.level),
        ]);
        if (saved.some(result => !result)) throw new Error('Sincronização não confirmada');
        app.showToast(`Nível ${btn.dataset.level} selecionado! A IA foi atualizada.`, 'success');
      } catch (error) {
        console.warn('[Settings] Não foi possível sincronizar o CEFR:', error);
        app.showToast('Não foi possível salvar o nível em todo o sistema. Tente novamente.', 'error');
        renderSettings(container, app);
      }
    });
  });

  // TTS Language selector
  document.querySelectorAll('.tts-opt-btn').forEach(btn => {
    if (btn.dataset.lang === savedTtsLang) {
      btn.style.borderColor = 'var(--color-primary)';
      btn.style.background = 'rgba(88,204,2,0.1)';
      btn.style.color = 'var(--color-text)';
      btn.style.fontWeight = '800';
    }
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.tts-opt-btn').forEach(b => {
        b.style.borderColor = 'var(--color-border)';
        b.style.background = 'var(--color-surface)';
        b.style.color = 'var(--color-text-light)';
        b.style.fontWeight = '700';
      });
      btn.style.borderColor = 'var(--color-primary)';
      btn.style.background = 'rgba(88,204,2,0.1)';
      btn.style.color = 'var(--color-text)';
      btn.style.fontWeight = '800';
      await lfDb.setSetting('lf_tts_lang', btn.dataset.lang);
    });
  });

  // TTS Speed selector
  document.querySelectorAll('.tts-speed-btn').forEach(btn => {
    if (btn.dataset.speed === savedTtsSpeed) {
      btn.style.borderColor = 'var(--color-primary)';
      btn.style.background = 'rgba(88,204,2,0.1)';
      btn.style.color = 'var(--color-text)';
      btn.style.fontWeight = '800';
    }
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.tts-speed-btn').forEach(b => {
        b.style.borderColor = 'var(--color-border)';
        b.style.background = 'var(--color-surface)';
        b.style.color = 'var(--color-text-light)';
        b.style.fontWeight = '700';
      });
      btn.style.borderColor = 'var(--color-primary)';
      btn.style.background = 'rgba(88,204,2,0.1)';
      btn.style.color = 'var(--color-text)';
      btn.style.fontWeight = '800';
      await lfDb.setSetting('lf_tts_speed', btn.dataset.speed);
    });
  });

  const retentionSlider = document.getElementById('retention-slider');
  if (retentionSlider) {
    retentionSlider.addEventListener('input', (e) => {
      const el = document.getElementById('retention-val');
      if (el) el.textContent = `${e.target.value}%`;
    });
  }

  // Onda 9: Perfis de SRS por categoria — carrega o override ao trocar a
  // categoria selecionada; salvar/limpar grava/apaga só as 3 chaves
  // sufixadas (":categoria") daquela categoria, sem tocar no global.
  const srscatSelect = document.getElementById('srscat-select');
  const srscatRetention = document.getElementById('srscat-retention');
  const srscatSteps = document.getElementById('srscat-steps');
  const srscatGrad = document.getElementById('srscat-grad');
  const srscatStatus = document.getElementById('srscat-status');

  async function loadCategoryOverrides() {
    const cat = srscatSelect?.value;
    if (!cat) return;
    if (srscatStatus) srscatStatus.textContent = 'Carregando…';
    try {
      const ov = await lfDb.getSRSCategoryOverrides(cat);
      if (srscatRetention) srscatRetention.value = ov.lf_srs_retention ? Math.round(Number(ov.lf_srs_retention) * 100) : '';
      if (srscatSteps) srscatSteps.value = ov.learning_steps || '';
      if (srscatGrad) srscatGrad.value = ov.graduating_interval || '';
      if (srscatStatus) srscatStatus.textContent = (ov.lf_srs_retention || ov.learning_steps || ov.graduating_interval)
        ? '✅ Esta categoria tem perfil próprio.' : 'Sem perfil próprio — usando o global.';
    } catch (e) {
      console.warn('[Settings] Erro ao carregar perfil por categoria:', e);
      if (srscatStatus) srscatStatus.textContent = 'Erro ao carregar. Tente de novo.';
    }
  }
  srscatSelect?.addEventListener('change', loadCategoryOverrides);
  loadCategoryOverrides();

  document.getElementById('srscat-save')?.addEventListener('click', async () => {
    const cat = srscatSelect?.value;
    if (!cat) return;
    const btn = document.getElementById('srscat-save');
    btn.disabled = true;
    try {
      const retVal = srscatRetention?.value ? (Number(srscatRetention.value) / 100).toFixed(2) : null;
      const stepsVal = srscatSteps?.value?.trim() || null;
      const gradVal = srscatGrad?.value || null;
      await Promise.all([
        lfDb.setSRSCategoryOverride(cat, 'lf_srs_retention', retVal),
        lfDb.setSRSCategoryOverride(cat, 'learning_steps', stepsVal),
        lfDb.setSRSCategoryOverride(cat, 'graduating_interval', gradVal),
      ]);
      if (srscatStatus) srscatStatus.textContent = '✅ Perfil salvo pra esta categoria.';
    } catch (e) {
      console.warn('[Settings] Erro ao salvar perfil por categoria:', e);
      if (srscatStatus) srscatStatus.textContent = 'Erro ao salvar. Tente de novo.';
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('srscat-clear')?.addEventListener('click', async () => {
    const cat = srscatSelect?.value;
    if (!cat) return;
    try {
      await Promise.all([
        lfDb.setSRSCategoryOverride(cat, 'lf_srs_retention', null),
        lfDb.setSRSCategoryOverride(cat, 'learning_steps', null),
        lfDb.setSRSCategoryOverride(cat, 'graduating_interval', null),
      ]);
      if (srscatRetention) srscatRetention.value = '';
      if (srscatSteps) srscatSteps.value = '';
      if (srscatGrad) srscatGrad.value = '';
      if (srscatStatus) srscatStatus.textContent = 'Perfil removido — voltou a usar o global.';
    } catch (e) {
      console.warn('[Settings] Erro ao limpar perfil por categoria:', e);
      if (srscatStatus) srscatStatus.textContent = 'Erro ao limpar. Tente de novo.';
    }
  });

  document.getElementById('btn-save').addEventListener('click', async () => {
    const btnSave = document.getElementById('btn-save');
    const originalText = btnSave.innerHTML;
    btnSave.innerHTML = '<span class="lf-spin"></span> Salvando...';
    
    // CHAVES = as mesmas que getSRSSettings() lê. Se mudar aqui, MUDA o motor.
    const val = (id) => document.getElementById(id)?.value;
    const writes = [];

    if (val('srs-grad-interval')) writes.push(lfDb.setSetting('graduating_interval', val('srs-grad-interval')));
    if (val('srs-max-interval')) writes.push(lfDb.setSetting('max_interval', val('srs-max-interval')));
    if (val('srs-int-mod')) writes.push(lfDb.setSetting('interval_modifier', val('srs-int-mod')));
    if (val('srs-leech-thresh')) writes.push(lfDb.setSetting('leech_threshold', val('srs-leech-thresh')));
    if (val('srs-leech-action')) writes.push(lfDb.setSetting('leech_action', val('srs-leech-action')));
    if (val('retention-slider')) writes.push(lfDb.setSetting('lf_srs_retention', (Number(val('retention-slider')) / 100).toFixed(2)));

    // Learning steps: aceita "1 10", "1m 10m", "1,10" — normaliza pra "1 10"
    const stepsRaw = val('srs-learning-steps');
    if (stepsRaw) {
      const steps = stepsRaw.replace(/m/gi, '').split(/[\s,]+/).map(Number).filter(n => n > 0);
      if (steps.length > 0) writes.push(lfDb.setSetting('learning_steps', steps.join(' ')));
    }
    const relearningRaw = val('srs-relearning-steps');
    if (relearningRaw) {
      const steps = relearningRaw.replace(/m/gi, '').split(/[\s,]+/).map(Number).filter(n => n > 0);
      if (steps.length > 0) writes.push(lfDb.setSetting('relearning_steps', steps.join(' ')));
    }

    if (val('srs-new-per-day') !== undefined) writes.push(lfDb.setSetting('new_per_day', val('srs-new-per-day')));
    if (val('srs-max-rev')) writes.push(lfDb.setSetting('max_reviews_per_day', val('srs-max-rev')));
    if (val('srs-vault-cap') !== null && val('srs-vault-cap') !== '') writes.push(lfDb.setSetting('lf_vault_cap', val('srs-vault-cap')));

    const reverseChk = document.getElementById('srs-reverse-cards');
    if (reverseChk) writes.push(lfDb.setSetting('lf_reverse_cards', reverseChk.checked ? 'true' : ''));
    const variedChk = document.getElementById('srs-varied-exercises');
    if (variedChk) writes.push(lfDb.setSetting('lf_varied_exercises', variedChk.checked ? 'true' : 'false'));
    const audioFrontChk = document.getElementById('audio-auto-front');
    if (audioFrontChk) writes.push(lfDb.setSetting('lf_audio_auto_front', audioFrontChk.checked ? 'true' : 'false'));
    const audioBackChk = document.getElementById('audio-auto-back');
    if (audioBackChk) writes.push(lfDb.setSetting('lf_audio_auto_back', audioBackChk.checked ? 'true' : 'false'));

    try {
      await Promise.all(writes);
      app.showToast('Configurações salvas. As próximas revisões já usarão os novos valores.', 'success');
    } catch (e) {
      console.error('[Settings] Falha ao salvar:', e);
      app.showToast('Erro ao salvar as configurações. Verifique a conexão.', 'error');
    }
    setTimeout(() => btnSave.innerHTML = originalText, 500);
  });

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  }

  function flashExportMsg(text = 'Exportação concluída!') {
    const el = document.getElementById('export-msg');
    el.textContent = text;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  document.getElementById('btn-export-csv').addEventListener('click', async () => {
    try {
      const words = await lfDb.getAllWords();
      const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
      let csv = 'Word,Translation,Context\n';
      words.forEach(w => {
        csv += `${esc(w.word)},${esc(w.translation)},${esc(w.context_sentence)}\n`;
      });
      downloadFile(csv, 'linguaflow_export.csv', 'text/csv;charset=utf-8');
      flashExportMsg();
    } catch(e) {
      console.error(e);
      app.showToast('Erro ao exportar CSV.', 'error');
    }
  });

  // Export no formato de importação nativo do Anki (TSV com cabeçalhos):
  // frente = palavra + frase; verso = tradução + fonética + definição; etiquetas.
  document.getElementById('btn-export-anki').addEventListener('click', async () => {
    try {
      const words = await lfDb.getAllWords();
      if (!words.length) { app.showToast('Nenhuma palavra para exportar.', 'info'); return; }
      const clean = (s) => String(s ?? '').replace(/\t/g, ' ').replace(/\n/g, '<br>');
      const lines = [
        '#separator:tab',
        '#html:true',
        '#tags column:3',
      ];
      const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      words.forEach(w => {
        const sentence = w.context_sentence && w.context_sentence !== w.word
          ? `<br><i>${clean(w.context_sentence).replace(new RegExp(`\\b${escRe(w.word)}\\b`, 'i'), `<b>${w.word}</b>`)}</i>`
          : '';
        const front = `<b>${clean(w.word)}</b>${sentence}`;
        const backParts = [clean(w.translation)];
        if (w.pronunciation_pt) backParts.push(`<i>[${clean(w.pronunciation_pt)}]</i>`);
        if (w.definition) backParts.push(clean(w.definition));
        const back = backParts.filter(Boolean).join('<br>');
        const tags = ['linguaflow', w.category, w.level].filter(Boolean).join(' ');
        lines.push(`${front}\t${back}\t${tags}`);
      });
      downloadFile(lines.join('\n'), 'linguaflow_anki.txt', 'text/plain;charset=utf-8');

      // B7 do backlog (W8.1): o TSV leva as palavras mas deixava a MEMÓRIA
      // pra trás — sem stability/difficulty/due, anos de agendamento evaporam
      // na migração. Segundo arquivo com o estado completo do FSRS.
      try {
        const cards = await lfDb.getAllCards();
        const wordById = {};
        words.forEach(w => { wordById[w.id] = w; });
        const schedRows = ['word\tstatus\tstability\tdifficulty\tdue_date\tinterval\treps\tlapses\tintroduced_at'];
        (cards || []).forEach(c => {
          const w = wordById[c.word_id];
          if (!w) return;
          schedRows.push([clean(w.word), c.status || '', c.stability ?? '', c.difficulty ?? '',
            c.due_date || '', c.interval ?? '', c.reps ?? 0, c.lapses ?? 0, c.introduced_at || ''].join('\t'));
        });
        downloadFile(schedRows.join('\n'), 'linguaflow_agendamento.tsv', 'text/tab-separated-values;charset=utf-8');
      } catch (schedErr) {
        console.warn('[Export] Agendamento não exportado:', schedErr);
      }

      flashExportMsg(`${words.length} notas exportadas pro Anki (com arquivo de agendamento FSRS)!`);
    } catch(e) {
      console.error(e);
      app.showToast('Erro ao exportar pro Anki.', 'error');
    }
  });

  // Backup completo: tudo que é preciso pra reconstruir o progresso.
  document.getElementById('btn-backup-json').addEventListener('click', async () => {
    try {
      const [words, cards, reviewLog, stats] = await Promise.all([
        lfDb.getAllWords(),
        lfDb.getAllCards(),
        lfDb.getReviewLog(3650),
        lfDb.getUserStats(),
      ]);
      const backup = {
        app: 'linguaflow',
        version: 1,
        exportedAt: new Date().toISOString(),
        words, cards, review_log: reviewLog, user_stats: stats,
      };
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(JSON.stringify(backup, null, 2), `linguaflow_backup_${stamp}.json`, 'application/json');
      flashExportMsg(`Backup salvo: ${words.length} palavras, ${cards.length} cards.`);
    } catch(e) {
      console.error(e);
      app.showToast('Erro ao gerar o backup.', 'error');
    }
  });

  // Restauração: re-salva cada palavra (upsert por user_id+word+lang) e
  // reaplica o estado de agendamento FSRS no card correspondente.
  // review_log não é restaurado (os ids de card mudam entre contas) — o
  // histórico segue preservado dentro do arquivo de backup.
  document.getElementById('btn-restore-json').addEventListener('click', () => {
    document.getElementById('restore-file-input').click();
  });

  document.getElementById('restore-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    let backup;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      app.showToast('Arquivo inválido: não é um JSON.', 'error');
      return;
    }
    if (backup.app !== 'linguaflow' || !Array.isArray(backup.words)) {
      app.showToast('Arquivo inválido: não é um backup do LinguaFlow.', 'error');
      return;
    }
    if (!confirm(`Restaurar ${backup.words.length} palavras do backup de ${(backup.exportedAt || '').slice(0, 10)}? Palavras existentes serão atualizadas.`)) return;

    const btn = document.getElementById('btn-restore-json');
    btn.disabled = true;
    let okCount = 0;
    let failCount = 0;
    let cardOkCount = 0;
    let cardFailCount = 0;

    try {
      // 1. Palavras (upsert preserva added_at do backup)
      for (const w of backup.words) {
        try {
          await lfDb.saveWord(w);
          okCount++;
        } catch (err) {
          console.warn('[Restore] Falha na palavra', w.word, err);
          failCount++;
        }
        btn.textContent = `♻️ Restaurando… ${okCount + failCount}/${backup.words.length}`;
      }

      // 2. Estado FSRS dos cards: casa card antigo -> palavra -> card novo
      if (Array.isArray(backup.cards) && backup.cards.length) {
        const freshWords = await lfDb.getAllWords();
        const wordIdByKey = {};
        freshWords.forEach(w => { wordIdByKey[`${w.word}|${w.lang}`] = w.id; });
        const oldWordById = {};
        backup.words.forEach(w => { oldWordById[w.id] = w; });

        for (const oldCard of backup.cards) {
          const oldWord = oldWordById[oldCard.word_id];
          if (!oldWord) continue;
          const newWordId = wordIdByKey[`${oldWord.word}|${oldWord.lang}`];
          if (!newWordId) continue;
          try {
            const newCard = await lfDb.getCardByWordId(newWordId);
            if (!newCard) continue;
            await lfDb.restoreCardState(newCard.id, {
              ...newCard,
              status: oldCard.status,
              interval: oldCard.interval,
              ease_factor: oldCard.ease_factor,
              step_index: oldCard.step_index,
              reps: oldCard.reps,
              lapses: oldCard.lapses,
              stability: oldCard.stability,
              difficulty: oldCard.difficulty,
              pre_lapse_interval: oldCard.pre_lapse_interval,
              due_date: oldCard.due_date,
              last_review: oldCard.last_review,
              suspended: oldCard.suspended,
              is_leech: oldCard.is_leech,
            });
            cardOkCount++;
          } catch (err) {
            console.warn('[Restore] Falha no card de', oldWord.word, err);
            cardFailCount++;
          }
        }
      }

      const partial = failCount > 0 || cardFailCount > 0;
      const cardSummary = Array.isArray(backup.cards)
        ? `; ${cardOkCount} estados de card${cardFailCount ? ` (${cardFailCount} falharam)` : ''}`
        : '';
      app.showToast(
        `Backup restaurado: ${okCount} palavras${failCount ? ` (${failCount} falharam)` : ''}${cardSummary}.${partial ? ' Revise as falhas.' : ' ✅'}`,
        partial ? 'info' : 'success'
      );
    } finally {
      btn.disabled = false;
      btn.textContent = '♻️ Restaurar backup';
    }
  });

  // Voz premium Kokoro (localStorage: o tts.js lê síncrono)
  const kokoroChk = document.getElementById('audio-kokoro');
  if (kokoroChk) {
    try { kokoroChk.checked = localStorage.getItem('lf_kokoro') === '1'; } catch { /* sem storage */ }

    // Onda 4: barra de progresso real do download (~90MB), em vez de só um
    // toast dizendo "pode demorar". O tts.js emite lf_kokoro_progress.
    const progressBox = document.getElementById('kokoro-progress-box');
    const progressBar = document.getElementById('kokoro-progress-bar');
    const progressText = document.getElementById('kokoro-progress-text');
    const onKokoroProgress = (e) => {
      const { status, progress, error } = e.detail || {};
      if (!progressBox) return;
      if (status === 'done') {
        progressText.textContent = 'Modelo pronto! 🎉';
        progressBar.style.width = '100%';
        setTimeout(() => progressBox.classList.add('hidden'), 2500);
      } else if (status === 'error') {
        progressText.textContent = `⚠️ ${error || 'Falha ao baixar — usando Google TTS por enquanto.'}`;
        setTimeout(() => progressBox.classList.add('hidden'), 4000);
      } else {
        progressBox.classList.remove('hidden');
        progressBar.style.width = `${progress || 0}%`;
        progressText.textContent = `Baixando modelo… ${progress || 0}%`;
      }
    };
    window.addEventListener('lf_kokoro_progress', onKokoroProgress, { signal: app.renderSignal });

    kokoroChk.addEventListener('change', () => {
      try {
        if (kokoroChk.checked) {
          localStorage.setItem('lf_kokoro', '1');
          app.showToast('Voz premium ativando… acompanhe o progresso do download abaixo. 🎙️', 'info');
          progressBox?.classList.remove('hidden');
          preloadKokoro();
        } else {
          localStorage.removeItem('lf_kokoro');
          progressBox?.classList.add('hidden');
          app.showToast('Voz premium desativada. Voltando ao Google TTS.', 'info');
        }
      } catch { app.showToast('Não consegui salvar a preferência.', 'error'); }
    });
  }

  // ── Web Push: assinatura REAL no push service do navegador ────────────────
  // Só no site (extensão MV3 tem o próprio sistema de notificações) e só se o
  // navegador suportar. O toggle cria/destrói a assinatura de verdade.
  (async () => {
    const supported = !isExtensionCtx && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const section = document.getElementById('push-section');
    if (!supported || !section) return;
    section.style.display = 'block';
    const toggle = document.getElementById('push-toggle');
    const status = document.getElementById('push-status');

    const b64ToU8 = (b64) => {
      const pad = '='.repeat((4 - (b64.length % 4)) % 4);
      const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
      return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
    };

    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      toggle.checked = !!existing;
      status.textContent = existing ? '✅ Lembretes ativos neste dispositivo.' : '';
    } catch { /* sw ainda não pronto */ }

    toggle.addEventListener('change', async () => {
      toggle.disabled = true;
      try {
        const reg = await navigator.serviceWorker.ready;
        if (toggle.checked) {
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') throw new Error('Permissão de notificação negada.');
          const publicKey = await lfDb.getPushPublicKey();
          if (!publicKey) throw new Error('Chave de push indisponível no servidor.');
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: b64ToU8(publicKey),
          });
          const saved = await lfDb.savePushSubscription(sub.toJSON());
          if (!saved?.ok) { await sub.unsubscribe(); throw new Error('Falha ao registrar no servidor.'); }
          status.textContent = '✅ Lembretes ativos neste dispositivo.';
          app.showToast('🔔 Lembretes ativados! No máximo 1 por dia.', 'success');
        } else {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await lfDb.deletePushSubscription(sub.endpoint).catch(() => {});
            await sub.unsubscribe();
          }
          status.textContent = 'Lembretes desativados.';
          app.showToast('Lembretes desativados.', 'info');
        }
      } catch (e) {
        console.warn('[Push] Falha no opt-in:', e);
        toggle.checked = false;
        status.textContent = `⚠️ ${e.message || 'Não foi possível ativar.'}`;
        app.showToast('Não consegui ativar os lembretes: ' + (e.message || ''), 'error');
      } finally {
        toggle.disabled = false;
      }
    });
  })();

  // ── Reengajamento por e-mail (Onda 3.4): opt-in simples, um RPC por troca ──
  (async () => {
    const emailToggle = document.getElementById('email-toggle');
    const emailStatus = document.getElementById('email-status');
    if (!emailToggle) return;
    try {
      const stats = await lfDb.getUserStats();
      emailToggle.checked = !!stats?.email_opt_in;
      emailStatus.textContent = stats?.email_opt_in ? '✅ Resumo semanal ativo.' : '';
    } catch { /* falha ao carregar preferência atual: deixa desmarcado */ }

    emailToggle.addEventListener('change', async () => {
      emailToggle.disabled = true;
      const desired = emailToggle.checked;
      try {
        const res = await lfDb.setEmailOptIn(desired);
        if (!res?.ok) throw new Error('Falha ao salvar a preferência.');
        emailStatus.textContent = desired ? '✅ Resumo semanal ativo.' : 'Resumo por e-mail desativado.';
        app.showToast(desired ? '📧 Resumo semanal ativado!' : 'Resumo por e-mail desativado.', desired ? 'success' : 'info');
      } catch (e) {
        emailToggle.checked = !desired;
        emailStatus.textContent = '⚠️ Não consegui salvar a preferência.';
        app.showToast('Não consegui salvar a preferência de e-mail.', 'error');
      } finally {
        emailToggle.disabled = false;
      }
    });
  })();

  document.getElementById('btn-placement')?.addEventListener('click', () => {
    runPlacementTest(app, (level) => {
      // Reflete o nível novo nos botões da tela sem recarregar
      document.querySelectorAll('.cefr-btn').forEach(b => {
        const active = b.dataset.level === level;
        b.style.background = active ? 'var(--color-primary)' : 'var(--color-surface)';
        b.style.color = active ? 'white' : 'var(--color-text)';
        b.style.borderColor = active ? 'var(--color-primary)' : 'var(--color-border)';
      });
    });
  });

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Tem certeza que deseja sair?')) {
        app.logout();
      }
    });
  }
}
