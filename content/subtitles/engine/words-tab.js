// content/subtitles/engine/words-tab.js — Aba de palavras do painel: vocabulário do vídeo, marcar como conhecida e explorador de frases.
import { comprehensionSummary, extractVideoVocabulary, learnerKeywords, wordStatus } from '../video-vocabulary.js';
import { STOP_WORDS, TOP5K_RANK_MAP } from '../word-frequency.js';
import { detectExpressions } from '../../../utils/expression-detector.js';
import { WORD_STATUS_LABELS } from '../expression-marks.js';
import { escapeHTML } from '../../../utils/html.js';
import { highlightTerms } from '../transcript-render.js';

export class WordsTabMethods {

  _rebuildWordsList(container) {
    if (!container && typeof document !== 'undefined') container = document.getElementById('lf-words-scroll');
    if (!container) return;

    const cues = this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues;
    const previousScrollTop = typeof container.scrollTop === 'number' ? container.scrollTop : 0;
    this._collapsedBands = this._collapsedBands || new Set();
    this._wordsSubTab = this._wordsSubTab || 'words';
    container.innerHTML = '';

    if (!cues || cues.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'lf-words-empty';
      empty.textContent = 'Nenhuma legenda carregada ainda. Inicie o vídeo para ver as palavras.';
      container.appendChild(empty);
      return;
    }

    const clean = (text) => (this._cleanSubtitleText ? this._cleanSubtitleText(text || '') : (text || ''));

    // 1. Vocabulário por lema (running/ran → run), sem nomes próprios
    const vocabulary = extractVideoVocabulary(
      cues.map((cue) => ({ text: clean(cue.text) })),
      { stopWords: STOP_WORDS, rankMap: TOP5K_RANK_MAP, ignored: this.ignoredWords || new Set() },
    );
    const totalUnique = vocabulary.size;

    // 2–3. Phrasal verbs idiomáticos e gírias: mesma detecção da legenda
    // (utils/expression-detector.js), agregada por forma canônica.
    const phrasalVerbsMap = new Map();
    const slangsMap = new Map();
    cues.forEach((cue) => {
      const seenInCue = new Set();
      for (const found of detectExpressions(clean(cue.text))) {
        const map = found.type === 'phrasal' ? phrasalVerbsMap : found.type === 'slang' ? slangsMap : null;
        if (!map) continue;
        if (!map.has(found.canonical)) {
          map.set(found.canonical, { term: found.canonical, count: 0, cues: [], forms: new Set() });
        }
        const entry = map.get(found.canonical);
        entry.forms.add(found.text.toLowerCase());
        const key = `${found.type}:${found.canonical}`;
        if (seenInCue.has(key)) continue;
        seenInCue.add(key);
        entry.count += 1;
        entry.cues.push(cue);
      }
    });
    const totalPhrasal = phrasalVerbsMap.size;
    const totalSlangs = slangsMap.size;

    // 4. Resumo: só afirma compreensão com base no que o aluno marcou
    const statsDiv = document.createElement('section');
    statsDiv.className = 'lf-words-card';
    statsDiv.setAttribute?.('aria-label', 'Resumo das palavras do vídeo');

    const renderStats = (knownWords, savedWords) => {
      const summary = comprehensionSummary(vocabulary, knownWords, savedWords);
      const { counts } = summary;
      const inDeck = counts.saved + counts.learning + counts.review + counts.mature;
      const score = summary.hasData
        ? `<p class="lf-words-score"><strong>${summary.percent}%</strong> das palavras que aparecem neste vídeo você já marcou como conhecidas ou dominadas.</p>
           <div class="lf-words-bar" aria-hidden="true"><span style="width:${summary.percent}%"></span></div>`
        : '<p class="lf-words-score-empty">Use <strong>Já sei</strong> nas palavras-chave abaixo para medir quanto deste vídeo você entende.</p>';
      statsDiv.innerHTML = `
        ${score}
        <dl class="lf-words-counts">
          <div><dt>Palavras no vídeo</dt><dd>${totalUnique}</dd></div>
          <div><dt>Conhecidas</dt><dd>${counts.known}</dd></div>
          <div><dt>No seu deck</dt><dd>${inDeck}</dd></div>
          <div><dt>Dominadas</dt><dd>${counts.mature}</dd></div>
          <div><dt>Revisando</dt><dd>${counts.review}</dd></div>
          <div><dt>Aprendendo</dt><dd>${counts.learning}</dd></div>
        </dl>
      `;
    };

    renderStats(this.knownWords, this.savedWords);
    container.appendChild(statsDiv);

    const wordsStatus = document.createElement('p');
    wordsStatus.className = 'lf-words-status';
    wordsStatus.setAttribute?.('role', 'status');
    container.appendChild(wordsStatus);

    // 5. Barra de Navegação Interna da aba Words
    const navBar = document.createElement('div');
    navBar.className = 'lf-words-nav';
    navBar.setAttribute?.('aria-label', 'Tipo de item');

    const tabsData = [
      { id: 'words', label: `📚 Palavras (${totalUnique})` },
      { id: 'phrasal', label: `⚡ Phrasal (${totalPhrasal})` },
      { id: 'slang', label: `🔥 Gírias (${totalSlangs})` },
    ];

    tabsData.forEach((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `lf-words-nav-btn lf-words-nav-${t.id}`;
      btn.setAttribute?.('aria-pressed', String(this._wordsSubTab === t.id));
      btn.textContent = t.label;
      btn.onclick = () => {
        this._wordsSubTab = t.id;
        this._rebuildWordsList(container);
      };
      navBar.appendChild(btn);
    });

    container.appendChild(navBar);

    // Estado do deck: lido do banco uma vez por abertura do painel; depois
    // os eventos LF_WORD_SAVED / LF_WORD_KNOWN mantêm a memória atualizada.
    if (!this._wordsDeckLoaded) {
      this._wordsDeckLoaded = true;
      import('../../../utils/db.js').then(async ({ db }) => {
        try {
          await db.initPromise;
          const words = await db.getAllWords();
          const cards = await db.getAllCards();
          const cardStatus = {};
          (cards || []).forEach((c) => {
            cardStatus[c.word_id] = c.status;
          });
          const freshSaved = new Map();
          (words || []).forEach((w) => {
            freshSaved.set(w.word.toLowerCase(), cardStatus[w.id] || 'new');
          });
          this.savedWords = freshSaved;
          renderStats(this.knownWords, freshSaved);
          this._updateSubtitleColors();
        } catch (e) {
          this._wordsDeckLoaded = false;
          console.warn('[LinguaFlow] Stats: erro ao recarregar do DB', e.message);
        }
      });
    }

    const openExplorer = (term, category, matchingCues, forms) =>
      this._showSentenceExplorer(term, category, matchingCues, forms);

    const makeChip = (label, category, onClick, extraClass = '') => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `lf-chip lf-chip-${category}${extraClass ? ` ${extraClass}` : ''}`;
      chip.textContent = label;
      chip.addEventListener?.('click', onClick);
      return chip;
    };

    // 6. Renderização conforme a subaba ativa
    if (this._wordsSubTab === 'phrasal' || this._wordsSubTab === 'slang') {
      const isPhrasal = this._wordsSubTab === 'phrasal';
      const map = isPhrasal ? phrasalVerbsMap : slangsMap;
      const list = Array.from(map.values()).sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
      if (list.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'lf-words-empty';
        empty.textContent = isPhrasal
          ? 'Nenhum phrasal verb identificado nas legendas deste vídeo.'
          : 'Nenhuma gíria identificada nas legendas deste vídeo.';
        container.appendChild(empty);
      } else {
        const grid = document.createElement('div');
        grid.className = 'lf-chip-grid';
        list.forEach((item) => {
          const chip = makeChip(
            item.count > 1 ? `${item.term} ×${item.count}` : item.term,
            this._wordsSubTab,
            () => openExplorer(item.term, this._wordsSubTab, item.cues, [...item.forms]),
          );
          chip.setAttribute?.('aria-label', `${item.term}: ver ${item.count} ${item.count === 1 ? 'frase' : 'frases'}`);
          grid.appendChild(chip);
        });
        container.appendChild(grid);
      }
    } else {
      // --- PALAVRAS-CHAVE: o que estudar antes/depois de assistir ---
      const keywords = learnerKeywords(vocabulary, this.knownWords, this.savedWords, 12);
      const kwSection = document.createElement('section');
      kwSection.className = 'lf-keywords';
      kwSection.innerHTML = `
        <h3 class="lf-keywords-title">Palavras-chave deste vídeo</h3>
        <p class="lf-keywords-hint">${keywords.length
          ? 'As que mais aparecem aqui e você ainda não marcou.'
          : 'Você já marcou todas as palavras que aparecem neste vídeo.'}</p>
      `;
      const kwList = document.createElement('ul');
      kwList.className = 'lf-keywords-list';
      keywords.forEach((entry) => {
        const row = document.createElement('li');
        row.className = 'lf-keyword';
        const matching = entry.cueIndexes.map((i) => cues[i]).filter(Boolean);
        const wordBtn = makeChip(
          entry.count > 1 ? `${entry.lemma} ×${entry.count}` : entry.lemma,
          'word',
          () => openExplorer(entry.lemma, 'word', matching, entry.forms),
        );
        wordBtn.setAttribute?.('aria-label', `${entry.lemma}: ver ${matching.length} ${matching.length === 1 ? 'frase' : 'frases'}`);
        const knownBtn = document.createElement('button');
        knownBtn.type = 'button';
        knownBtn.className = 'lf-keyword-action';
        knownBtn.textContent = 'Já sei';
        knownBtn.setAttribute?.('aria-label', `Já sei "${entry.lemma}"`);
        knownBtn.onclick = () => this._markVideoWordKnown(entry, knownBtn, wordsStatus);
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'lf-keyword-action';
        saveBtn.textContent = 'Ver e salvar';
        saveBtn.setAttribute?.('aria-label', `Ver tradução e salvar "${entry.lemma}"`);
        saveBtn.onclick = () => {
          const sentence = clean(matching[0]?.text || '');
          const surface = entry.forms.find((f) => sentence.toLowerCase().includes(f)) || entry.lemma;
          this.wordPopup?.showForWord(surface, sentence, saveBtn.getBoundingClientRect?.() || null, matching[0]);
        };
        row.appendChild(wordBtn);
        row.appendChild(knownBtn);
        row.appendChild(saveBtn);
        kwList.appendChild(row);
      });
      kwSection.appendChild(kwList);
      container.appendChild(kwSection);

      // --- TODAS AS PALAVRAS por faixa de frequência no idioma ---
      const bands = [];
      for (let s = 1; s <= 5000; s += 100)
        bands.push({ label: `${s} – ${s + 99}`, start: s, words: [] });
      const outOfTop = { label: 'Fora do top-5k', start: null, words: [] };

      vocabulary.forEach((entry) => {
        if (entry.rank) {
          const bi = Math.floor((entry.rank - 1) / 100);
          if (bands[bi]) bands[bi].words.push(entry);
        } else outOfTop.words.push(entry);
      });

      const allBands = [
        ...bands.filter((b) => b.words.length > 0),
        ...(outOfTop.words.length > 0 ? [outOfTop] : []),
      ];

      if (allBands.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'lf-words-empty';
        empty.textContent = 'Nenhuma palavra encontrada nas legendas deste vídeo.';
        container.appendChild(empty);
        return;
      }

      const allTitle = document.createElement('h3');
      allTitle.className = 'lf-keywords-title';
      allTitle.textContent = 'Todas as palavras, por frequência no inglês';
      container.appendChild(allTitle);

      allBands.forEach((band, bandIndex) => {
        band.words.sort((a, b) => (a.rank || 99999) - (b.rank || 99999) || b.count - a.count);
        const section = document.createElement('div');
        section.className = 'lf-band';

        const tier = !band.start ? 'rare' : band.start <= 1000 ? 'top1k' : band.start <= 2000 ? 'top2k' : band.start <= 3000 ? 'top3k' : 'top5k';
        const gridId = `lf-band-grid-${bandIndex}`;
        const bandHeader = document.createElement('button');
        bandHeader.type = 'button';
        bandHeader.className = `lf-band-header lf-band-${tier}`;
        bandHeader.setAttribute?.('aria-controls', gridId);
        bandHeader.innerHTML = `<span class="lf-band-label">${band.label}</span><span class="lf-band-count">${band.words.length} ${band.words.length === 1 ? 'palavra' : 'palavras'} <span class="lf-band-arrow" aria-hidden="true">▼</span></span>`;

        const wordGrid = document.createElement('div');
        wordGrid.className = 'lf-chip-grid';
        wordGrid.id = gridId;

        band.words.forEach((entry) => {
          const status = wordStatus(entry, this.knownWords, this.savedWords);
          const matching = entry.cueIndexes.map((i) => cues[i]).filter(Boolean);
          const chip = makeChip(
            entry.count > 1 ? `${entry.lemma} ×${entry.count}` : entry.lemma,
            'word',
            () => openExplorer(entry.lemma, 'word', matching, entry.forms),
            status ? `lf-chip-status-${status}` : '',
          );
          chip.setAttribute?.('aria-label', `${entry.lemma}${status ? ` (${WORD_STATUS_LABELS[status] || status})` : ''}: ver ${matching.length} ${matching.length === 1 ? 'frase' : 'frases'}`);
          wordGrid.appendChild(chip);
        });

        let collapsed = this._collapsedBands.has(band.label);
        const applyCollapsed = () => {
          wordGrid.style.display = collapsed ? 'none' : 'flex';
          bandHeader.setAttribute?.('aria-expanded', String(!collapsed));
          const arrow = bandHeader.querySelector?.('.lf-band-arrow');
          if (arrow) arrow.textContent = collapsed ? '▶' : '▼';
        };
        applyCollapsed();
        bandHeader.addEventListener?.('click', () => {
          collapsed = !collapsed;
          if (collapsed) this._collapsedBands.add(band.label);
          else this._collapsedBands.delete(band.label);
          applyCollapsed();
        });

        section.appendChild(bandHeader);
        section.appendChild(wordGrid);
        container.appendChild(section);
      });
    }

    if (previousScrollTop > 0 && typeof container.scrollTop === 'number') {
      container.scrollTop = previousScrollTop;
    }
  }

  async _markVideoWordKnown(entry, button, statusEl) {
    button.disabled = true;
    button.textContent = 'Marcando…';
    try {
      const { db } = await import('../../../utils/db.js');
      await db.markAsKnown(entry.lemma, this.sourceLang || 'en');
      [entry.lemma, ...entry.forms].forEach((w) => {
        this.knownWords.add(w);
        this.savedWords?.delete?.(w);
      });
      this._rebuildWordsList();
      this._updateSubtitleColors?.();
      const status = document.querySelector?.('#lf-words-scroll .lf-words-status');
      if (status) status.textContent = `"${entry.lemma}" marcada como conhecida.`;
    } catch (error) {
      console.warn('[LinguaFlow] markAsKnown falhou:', error?.message);
      button.disabled = false;
      button.textContent = 'Tentar de novo';
      if (statusEl) statusEl.textContent = `Não foi possível marcar "${entry.lemma}". Verifique a conexão e se você está na sua conta.`;
    }
  }

  _showSentenceExplorer(term, category, matchingCues, forms = [term]) {
    const explorer = document.getElementById('lf-sentence-explorer');
    const wordsScroll = document.getElementById('lf-words-scroll');
    if (!explorer || !wordsScroll) return;

    wordsScroll.style.display = 'none';
    explorer.style.display = 'flex';
    explorer.innerHTML = '';

    // Eager translation das frases se alguma não estiver traduzida ainda
    if (matchingCues && matchingCues.length) {
      this._translateAllSidebarCues(matchingCues);
    }

    const categoryLabels = { word: 'Palavra', phrasal: 'Phrasal Verb', slang: 'Gíria' };
    const catKey = categoryLabels[category] ? category : 'word';
    const catLabel = categoryLabels[catKey];
    const count = matchingCues ? matchingCues.length : 0;

    // 1. Header do Explorador
    const header = document.createElement('div');
    header.className = 'lf-se-header';

    header.innerHTML = `
      <div class="lf-se-row">
        <button id="lf-se-back-btn" type="button" class="lf-se-btn"><span aria-hidden="true">←</span> Voltar</button>
        <span class="lf-se-badge lf-chip-${catKey}">${catLabel}</span>
      </div>
      <div class="lf-se-row lf-se-title-row">
        <h3 class="lf-se-term">${escapeHTML(term)}</h3>
        <span class="lf-se-count">${count} ${count === 1 ? 'frase no vídeo' : 'frases no vídeo'}</span>
      </div>
      <div class="lf-se-row lf-se-exports">
        <button id="lf-se-export-pdf" type="button" class="lf-se-btn">PDF</button>
        <button id="lf-se-export-csv" type="button" class="lf-se-btn">Excel (CSV)</button>
        <button id="lf-se-export-anki" type="button" class="lf-se-btn lf-se-btn-accent">Anki</button>
      </div>
    `;

    // 2. Lista com scroll de ocorrências
    const list = document.createElement('div');
    list.id = 'lf-se-sentences-list';
    list.className = 'lf-se-list';

    if (!matchingCues || matchingCues.length === 0) {
      list.innerHTML = `<p class="lf-words-empty">Nenhuma frase encontrada para "${escapeHTML(term)}".</p>`;
    } else {
      const highlightForms = [...new Set([term, ...(forms || [])])];

      matchingCues.forEach((cue) => {
        const isLoopingThis = this.isLooping && Math.abs(this.loopStartTime - cue.start) < 0.1;
        const item = document.createElement('div');
        item.className = `lf-sentence-card ${isLoopingThis ? 'is-looping' : ''}`;

        const startTime = cue.start;
        const formattedTime = this._formatTime(startTime);
        const highlighted = highlightTerms(cue.text || '', highlightForms, `class="lf-term-hit lf-chip-${catKey}"`);

        item.innerHTML = `
          <div class="lf-se-row">
            <button type="button" class="lf-se-time-btn" data-time="${startTime}" aria-label="Tocar a partir de ${formattedTime}">${formattedTime}</button>
            <button type="button" class="lf-se-loop-btn ${isLoopingThis ? 'is-active' : ''}" data-cue-start="${cue.start}" aria-label="${isLoopingThis ? 'Desativar loop' : 'Repetir em loop'} a frase em ${formattedTime}">🔁</button>
          </div>
          <p class="lf-se-text">${highlighted}</p>
          <p class="lf-se-trans-line">
            ${cue.translatedText ? escapeHTML(cue.translatedText) : '<span class="lf-se-pending">traduzindo...</span>'}
          </p>
        `;

        const timeBtn = item.querySelector?.('.lf-se-time-btn');
        if (timeBtn) {
          timeBtn.onclick = () => {
            if (this.videoElement) {
              this.videoElement.currentTime = startTime;
              this.videoElement.play().catch(() => {});
            }
          };
        }

        const loopBtn = item.querySelector?.('.lf-se-loop-btn');
        if (loopBtn) {
          loopBtn.onclick = () => {
            this._toggleCueLoopByCue(cue);
          };
        }

        list.appendChild(item);
      });
    }

    explorer.appendChild(header);
    explorer.appendChild(list);

    // Eventos do Header
    const backBtn = header.querySelector?.('#lf-se-back-btn');
    if (backBtn) {
      backBtn.onclick = () => {
        explorer.style.display = 'none';
        wordsScroll.style.display = 'block';
      };
      backBtn.focus?.({ preventScroll: true });
    }

    const pdfBtn = header.querySelector?.('#lf-se-export-pdf');
    if (pdfBtn) {
      pdfBtn.onclick = () => this._exportPDF(matchingCues, `${term} (${catLabel})`);
    }

    const csvBtn = header.querySelector?.('#lf-se-export-csv');
    if (csvBtn) {
      csvBtn.onclick = () => this._exportCSV(matchingCues, `${term}_${category}`);
    }

    const ankiBtn = header.querySelector?.('#lf-se-export-anki');
    if (ankiBtn) {
      ankiBtn.onclick = () => this._exportAnki(matchingCues, `${term}_${category}`);
    }
  }
}
