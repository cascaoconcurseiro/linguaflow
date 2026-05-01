// dashboard/word-detail.js
// Página de detalhes completa de uma palavra

const DB_NAME = 'LinguaFlowFreeDB';
const DB_VERSION = 3;

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function safeUrl(value) {
    try {
        const url = new URL(value, location.href);
        return ['http:', 'https:', 'chrome-extension:'].includes(url.protocol) ? url.href : '#';
    } catch {
        return '#';
    }
}

const GRAMMAR_INFO = {
    noun:        { title: 'Substantivo', desc: 'Nomeia pessoas, lugares, coisas ou ideias.', tips: ['Pode ser singular ou plural (dog → dogs)', 'Contável (book) ou incontável (water)', 'Precedido por artigos: a, an, the'] },
    verb:        { title: 'Verbo', desc: 'Expressa ação, estado ou ocorrência.', tips: ['Regular: add -ed no passado (walk → walked)', 'Irregular: forma própria (go → went)', 'Auxiliares: be, do, have, will, can, should'] },
    adjective:   { title: 'Adjetivo', desc: 'Descreve ou modifica um substantivo.', tips: ['Vem antes do substantivo em inglês (big house)', 'Comparativo: bigger / more beautiful', 'Superlativo: biggest / most beautiful'] },
    adverb:      { title: 'Advérbio', desc: 'Modifica verbos, adjetivos ou outros advérbios.', tips: ['Muitos terminam em -ly (quickly, slowly)', 'Indicam modo, tempo, lugar, frequência', 'Respondem: como? quando? onde? quanto?'] },
    pronoun:     { title: 'Pronome', desc: 'Substitui ou acompanha um substantivo.', tips: ['Pessoais: I, you, he, she, it, we, they', 'Possessivos: my, your, his, her, its, our, their', 'Reflexivos: myself, yourself, himself...'] },
    preposition: { title: 'Preposição', desc: 'Indica relação entre palavras na frase.', tips: ['Lugar: in, on, at, under, over, between', 'Tempo: at, on, in, before, after, during', 'Direção: to, from, into, out of, towards'] },
    conjunction: { title: 'Conjunção', desc: 'Liga palavras, frases ou orações.', tips: ['Coordenativas: and, but, or, nor, so, yet', 'Subordinativas: because, although, if, when', 'Correlativas: either...or, neither...nor'] },
    interjection:{ title: 'Interjeição', desc: 'Expressa emoção ou reação espontânea.', tips: ['Positivas: wow, great, yay, hooray', 'Negativas: ugh, oops, darn, shoot', 'Neutras: well, oh, hmm, hey'] },
};

async function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => reject(req.error);
        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('words')) {
                const s = db.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
                s.createIndex('word_lang', ['word', 'lang'], { unique: true });
                s.createIndex('deck_id', 'deck_id', { unique: false });
            }
            if (!db.objectStoreNames.contains('cards')) {
                const s = db.createObjectStore('cards', { keyPath: 'id', autoIncrement: true });
                s.createIndex('word_id', 'word_id', { unique: true });
                s.createIndex('due_date', 'due_date', { unique: false });
                s.createIndex('status', 'status', { unique: false });
            }
            if (!db.objectStoreNames.contains('decks')) db.createObjectStore('decks', { keyPath: 'id', autoIncrement: true });
            if (!db.objectStoreNames.contains('known_words')) db.createObjectStore('known_words', { keyPath: ['word', 'lang'] });
            if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'date' });
            if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
        };
    });
}

async function getWord(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('words', 'readonly');
        const req = tx.objectStore('words').get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function fetchDictionary(word, lang = 'en') {
    try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/${lang}/${encodeURIComponent(word)}`);
        if (!res.ok) return null;
        return await res.json();
    } catch { return null; }
}

async function fetchLingueeExamples(word) {
    const lingueeExamples = [];
    const reversoExamples = [];

    // ── Linguee via background (com cache) ──────────────────────────────────────────────────
    try {
        const response = await chrome.runtime.sendMessage({ type: 'FETCH_LINGUEE', word });
        if (response?.success && response.html) {
            const doc = new DOMParser().parseFromString(response.html, 'text/html');
            doc.querySelectorAll('.example').forEach(div => {
                const en = div.querySelector('.tag_s')?.textContent?.trim();
                const pt = div.querySelector('.tag_t')?.textContent?.trim();
                if (en && pt) lingueeExamples.push({ en, pt, verified: true });
            });
            doc.querySelectorAll('.inexact, .unverified').forEach(div => {
                const en = div.querySelector('.tag_s, .source_text')?.textContent?.trim();
                const pt = div.querySelector('.tag_t, .target_text')?.textContent?.trim();
                if (en && pt && en.length > 5 && !lingueeExamples.some(e => e.en === en))
                    lingueeExamples.push({ en, pt, verified: false });
            });
        }
    } catch {}

    // ── Reverso Context via background (com cache) ────────────────────────────────────────────
    try {
        const response = await chrome.runtime.sendMessage({ type: 'FETCH_REVERSO', word, srcLang: 'en', dstLang: 'pt' });
        if (response?.success && response.list) {
            response.list.forEach(item => {
                if (!lingueeExamples.some(e => e.en.toLowerCase() === item.en?.toLowerCase()))
                    reversoExamples.push({ en: item.en, pt: item.pt, verified: false });
            });
        }
    } catch {}

    return { linguee: lingueeExamples, reverso: reversoExamples };
}

function highlightWord(text, word) {
    if (!text || !word) return text || '';
    try {
        const safeText = escapeHTML(text);
        const escaped = escapeHTML(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp('(' + escaped + ')', 'gi');
        return safeText.replace(re, '<strong>$1</strong>');
    } catch {
        return escapeHTML(text);
    }
}

function platformIcon(platform) {
    const icons = { youtube: '▶️ YouTube', netflix: '🎬 Netflix', prime: '📦 Prime Video', disney: '🏰 Disney+', max: '🎭 Max', manual: '✍️ Manual' };
    return escapeHTML(icons[platform] || '🌐 ' + (platform || 'Web'));
}

async function playAudio(url, word, lang = 'en-US') {
    if (url) {
        try { await new Audio(url).play(); return; } catch {}
    }
    // TTS premium (Google TTS → Edge TTS → Web Speech com vozes premium)
    import('../utils/tts.js').then(({ tts }) => {
        tts.play(word, lang || 'en-US');
    }).catch(() => {
        // Fallback final
        const utter = new SpeechSynthesisUtterance(word);
        utter.lang = lang || 'en-US';
        utter.rate = 0.85;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
    });
}

async function render(wordData) {
    const page = document.getElementById('word-page');
    const dictData = await fetchDictionary(wordData.word, wordData.lang || 'en');
    const entry = dictData?.[0];

    // Coleta definições, sinônimos, antônimos do dicionário
    const definitions = [];
    const synonyms = new Set();
    const antonyms = new Set();
    let audioUrl = wordData.audio_url || '';
    let ipa = wordData.ipa || '';

    if (entry) {
        if (!ipa && entry.phonetics) {
            ipa = entry.phonetics.find(p => p.text)?.text || '';
        }
        if (!audioUrl && entry.phonetics) {
            audioUrl = entry.phonetics.find(p => p.audio)?.audio || '';
        }
        entry.meanings?.forEach(m => {
            m.definitions?.slice(0, 3).forEach(d => {
                definitions.push({ pos: m.partOfSpeech, def: d.definition, example: d.example });
            });
            m.synonyms?.forEach(s => synonyms.add(s));
            m.antonyms?.forEach(a => antonyms.add(a));
        });
    }

    const pos = wordData.part_of_speech || entry?.meanings?.[0]?.partOfSpeech || '';

    // Carrega exemplos e gramática em paralelo
    const examplesPromise = fetchLingueeExamples(wordData.word);
    const grammarPromise = import('../utils/grammar.js')
        .then(({ analyzeGrammar }) => analyzeGrammar(wordData.word, pos, { definitions }))
        .catch(() => null);

    // Monta o HTML principal (sem exemplos ainda)
    const videoUrl = wordData.video_url
        ? `${wordData.video_url}${wordData.video_url.includes('?') ? '&' : '?'}t=${Math.floor(wordData.timestamp || 0)}`
        : null;
    const encodedWord = encodeURIComponent(wordData.word || '');
    const safeVideoUrl = videoUrl ? safeUrl(videoUrl) : null;

    page.innerHTML = `
        <button class="wp-back" id="btn-back">← Voltar ao Vocabulário</button>

        <!-- Hero -->
        <div class="wp-hero">
            <div class="wp-hero-left">
                <h1 class="wp-word">${escapeHTML(wordData.word)}</h1>
                ${ipa ? `<span class="wp-ipa">${escapeHTML(ipa)}</span>` : ''}
                <div class="wp-translation">${escapeHTML(wordData.translation || '—')}</div>
                <div class="wp-badges">
                    ${pos ? `<span class="wp-badge wp-badge-pos">${escapeHTML(pos)}</span>` : ''}
                    ${wordData.cefr_guess ? `<span class="wp-badge wp-badge-cefr">${escapeHTML(wordData.cefr_guess)}</span>` : ''}
                    ${wordData.frequency_rank ? `<span class="wp-badge wp-badge-freq">${escapeHTML(wordData.frequency_rank)}</span>` : ''}
                    ${wordData.status ? `<span class="wp-badge wp-badge-status">${escapeHTML(wordData.status)}</span>` : ''}
                </div>
                <div class="wp-audio-row">
                    ${audioUrl ? `<button class="wp-btn-audio" id="btn-native-audio">🔊 Áudio Nativo</button>` : ''}
                    <button class="wp-btn-audio-tts" id="btn-tts-word">🗣 TTS — Palavra</button>
                    <button class="wp-btn-audio-tts" id="btn-tts-sentence">🗣 TTS — Frase</button>
                </div>
            </div>
        </div>

        <!-- Origem -->
        ${wordData.context_sentence || wordData.video_url ? `
        <div class="wp-origin">
            <div class="wp-origin-info">
                <div class="wp-origin-label">Contexto original</div>
                <div class="wp-context-text">${highlightWord(wordData.context_sentence, wordData.word)}</div>
                <div class="wp-platform-badge">${platformIcon(wordData.platform)}
                    ${wordData.timestamp ? ` · ${Math.floor(wordData.timestamp / 60)}:${String(Math.floor(wordData.timestamp % 60)).padStart(2,'0')}` : ''}
                    ${wordData.added_at ? ` · Salvo em ${new Date(wordData.added_at).toLocaleDateString('pt-BR')}` : ''}
                </div>
            </div>
            ${safeVideoUrl ? `<a href="${safeVideoUrl}" target="_blank" rel="noopener" class="wp-btn-video">▶ Ir para o momento no vídeo</a>` : ''}
        </div>` : ''}

        <!-- Definições -->
        ${definitions.length > 0 ? `
        <div class="wp-section">
            <div class="wp-section-title">📖 Definições</div>
            ${definitions.map(d => `
                <div class="wp-def-item">
                    <div class="wp-def-pos">${escapeHTML(d.pos)}</div>
                    <div class="wp-def-text">${escapeHTML(d.def)}</div>
                    ${d.example ? `<div class="wp-def-example">"${escapeHTML(d.example)}"</div>` : ''}
                </div>
            `).join('')}
        </div>` : ''}

        <!-- Sinônimos / Antônimos -->
        ${synonyms.size > 0 || antonyms.size > 0 ? `
        <div class="wp-section">
            <div class="wp-section-title">🔗 Sinônimos & Antônimos</div>
            ${synonyms.size > 0 ? `
                <div style="margin-bottom:14px;">
                    <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;font-weight:600;">Sinônimos</div>
                    <div class="wp-word-chips">${[...synonyms].slice(0,12).map(s => `<button type="button" class="wp-chip" data-open-word="${escapeHTML(s)}">${escapeHTML(s)}</button>`).join('')}</div>
                </div>` : ''}
            ${antonyms.size > 0 ? `
                <div>
                    <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;font-weight:600;">Antônimos</div>
                    <div class="wp-word-chips">${[...antonyms].slice(0,12).map(a => `<button type="button" class="wp-chip" data-open-word="${escapeHTML(a)}" style="border-color:rgba(239,68,68,0.2);color:#EF4444;">${escapeHTML(a)}</button>`).join('')}</div>
                </div>` : ''}
        </div>` : ''}

        <!-- Gramática (placeholder enquanto carrega) -->
        <div class="wp-section" id="section-grammar">
            <div class="wp-section-title">📐 Gramática & Formas</div>
            <div class="wp-loading"><div class="wp-loading-spinner"></div><div>Analisando gramática...</div></div>
        </div>

        <!-- Exemplos Linguee (placeholder enquanto carrega) -->
        <div class="wp-section" id="section-examples">
            <div class="wp-section-title">💬 Exemplos Reais (Linguee)</div>
            <div class="wp-loading"><div class="wp-loading-spinner"></div><div>Buscando exemplos...</div></div>
        </div>

        <!-- Pronúncia externa -->
        <div class="wp-section">
            <div class="wp-section-title">🎙 Pronúncia em Contexto (YouGlish)</div>
            <p style="font-size:13px;color:#64748B;margin:0 0 14px;">O YouGlish bloqueia incorporação dentro de extensões. Abra a busca em uma nova aba para ouvir nativos usando esta palavra em vídeos reais.</p>
            <div class="wp-actions" style="margin-top:0;">
                <a href="https://youglish.com/pronounce/${encodedWord}/english/us" target="_blank" rel="noopener" class="btn-action btn-green" style="text-decoration:none;">Abrir YouGlish ↗</a>
                <a href="https://forvo.com/search/${encodedWord}/en/" target="_blank" rel="noopener" class="btn-action" style="text-decoration:none;">Abrir Forvo ↗</a>
            </div>
        </div>

        <!-- Ações -->
        <div class="wp-actions">
            <a href="https://www.linguee.com.br/ingles-portugues/search?source=auto&query=${encodedWord}" target="_blank" rel="noopener" class="btn-action btn-blue" style="text-decoration:none;">🔗 Ver no Linguee</a>
            <a href="https://www.merriam-webster.com/dictionary/${encodedWord}" target="_blank" rel="noopener" class="btn-action" style="text-decoration:none;">📚 Merriam-Webster</a>
            <a href="https://context.reverso.net/traducao/ingles-portugues/${encodedWord}" target="_blank" rel="noopener" class="btn-action" style="text-decoration:none;">🔄 Reverso Context</a>
            <button class="btn-action btn-red" id="btn-delete-word">🗑️ Deletar Palavra</button>
        </div>
    `;

    // Listeners de áudio
    document.getElementById('btn-back')?.addEventListener('click', () => history.back());
    if (audioUrl) {
        document.getElementById('btn-native-audio')?.addEventListener('click', () => playAudio(audioUrl, wordData.word));
    }
    document.getElementById('btn-tts-word')?.addEventListener('click', () => playAudio(null, wordData.word));
    document.getElementById('btn-tts-sentence')?.addEventListener('click', () => {
        if (wordData.context_sentence) playAudio(null, wordData.context_sentence);
    });
    document.getElementById('btn-delete-word')?.addEventListener('click', () => deleteWord(wordData.id));
    page.querySelectorAll('[data-open-word]').forEach(el => {
        el.addEventListener('click', () => openWord(el.dataset.openWord));
    });

    // Carrega gramática e exemplos em paralelo (não bloqueia o render)
    grammarPromise.then(analysis => {
        const secGrammar = document.getElementById('section-grammar');
        if (!secGrammar) return;
        if (analysis) {
            secGrammar.innerHTML = `
                <div class="wp-section-title">📐 Gramática & Formas</div>
                ${renderGrammarDetailHTML(analysis, wordData.word)}
            `;
        } else {
            secGrammar.innerHTML = `
                <div class="wp-section-title">📐 Gramática</div>
                <p style="font-size:13px;color:#64748B;">Informação gramatical não disponível para esta palavra.</p>
            `;
        }
    });

    // Carrega exemplos das duas fontes
    const { linguee, reverso } = await examplesPromise;
    const secEx = document.getElementById('section-examples');

    const totalLinguee = linguee.length;
    const totalReverso = reverso.length;

    if (totalLinguee === 0 && totalReverso === 0) {
        secEx.querySelector('.wp-loading').innerHTML = `
            <p style="color:#64748B;">Nenhum exemplo encontrado.
                <a href="https://www.linguee.com.br/ingles-portugues/search?source=auto&query=${encodeURIComponent(wordData.word)}" target="_blank" style="color:#38BDF8;">Linguee ↗</a> ·
                <a href="https://context.reverso.net/traducao/ingles-portugues/${encodeURIComponent(wordData.word)}" target="_blank" style="color:#A78BFA;">Reverso ↗</a>
            </p>`;
    } else {
        secEx.innerHTML = `
            <div class="wp-section-title">&#x1F4AC; Exemplos Reais — ${totalLinguee + totalReverso} encontrados</div>

            <!-- Linguee -->
            <div style="margin-bottom:20px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                    <span style="font-size:11px;font-weight:700;color:#38BDF8;text-transform:uppercase;letter-spacing:1px;">🔵 Linguee — ${totalLinguee} exemplos</span>
                    <a href="https://www.linguee.com.br/ingles-portugues/search?source=auto&query=${encodeURIComponent(wordData.word)}" target="_blank" style="font-size:12px;color:#64748B;text-decoration:none;">ver todos ↗</a>
                </div>
                ${totalLinguee === 0
                    ? '<p style="color:#475569;font-size:13px;font-style:italic;">Nenhum resultado (pode estar bloqueado temporariamente)</p>'
                    : linguee.slice(0, 20).map(ex => `
                        <div class="wp-example-item">
                            <div class="wp-example-en">${highlightWord(ex.en, wordData.word)}</div>
                            <div class="wp-example-pt">${escapeHTML(ex.pt)}</div>
                            ${ex.verified ? '<div class="wp-example-src">✓ verificado</div>' : ''}
                        </div>`).join('')
                }
            </div>

            <!-- Reverso Context -->
            <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                    <span style="font-size:11px;font-weight:700;color:#A78BFA;text-transform:uppercase;letter-spacing:1px;">🟣 Reverso Context — ${totalReverso} exemplos</span>
                    <a href="https://context.reverso.net/traducao/ingles-portugues/${encodeURIComponent(wordData.word)}" target="_blank" style="font-size:12px;color:#64748B;text-decoration:none;">ver todos ↗</a>
                </div>
                ${totalReverso === 0
                    ? '<p style="color:#475569;font-size:13px;font-style:italic;">Nenhum resultado</p>'
                    : reverso.slice(0, 20).map(ex => `
                        <div class="wp-example-item">
                            <div class="wp-example-en">${highlightWord(ex.en, wordData.word)}</div>
                            <div class="wp-example-pt">${escapeHTML(ex.pt)}</div>
                        </div>`).join('')
                }
            </div>
        `;
    }
}


function renderGrammarDetailHTML(analysis, word) {
    const { pos, forms, collocations, etymology, tips, commonMistakes, usageNotes, lesson } = analysis;
    const posLabels = {
        verb:'Verbo', noun:'Substantivo', adjective:'Adjetivo', adverb:'Advérbio',
        pronoun:'Pronome', preposition:'Preposição', conjunction:'Conjunção',
        interjection:'Interjeição'
    };
    const posLabel = posLabels[pos] || pos || '';
    let html = '';

    html += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        ${posLabel ? `<span class="wp-badge wp-badge-pos">${escapeHTML(posLabel)}</span>` : ''}
        ${forms?.isIrregular ? '<span class="wp-badge" style="background:rgba(245,158,11,0.15);color:#F59E0B;border-color:rgba(245,158,11,0.3);">IRREGULAR</span>' : ''}
    </div>`;

    if (lesson) {
        html += `<div style="background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.16);border-radius:12px;padding:16px;margin-bottom:18px;">
            <div style="font-size:11px;color:#38BDF8;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:8px;">Como um professor explicaria</div>
            <p style="font-size:14px;color:#E2E8F0;line-height:1.7;margin:0 0 12px;">${escapeHTML(lesson.teacher)}</p>
            <div style="font-size:13px;color:#94A3B8;line-height:1.6;"><strong style="color:#CBD5E1;">Padrao:</strong> ${escapeHTML(lesson.pattern)}</div>
        </div>`;

        if (lesson.examples?.length > 0) {
            html += `<div style="margin-bottom:18px;">
                <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:10px;">Exemplos de uso</div>
                ${lesson.examples.map(ex => `<div class="wp-grammar-card" style="margin-bottom:8px;"><p style="font-size:14px;color:#E2E8F0;line-height:1.5;">${highlightWord(ex, word)}</p></div>`).join('')}
            </div>`;
        }
    }

    if (tips?.length > 0) {
        html += `<div style="margin-bottom:18px;">
            <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:10px;">Formas que voce precisa reconhecer</div>
            <div class="wp-grammar-grid">`;
        tips.forEach(t => {
            html += `<div class="wp-grammar-card">
                <p style="font-size:13px;color:#CBD5E1;line-height:1.5;">${escapeHTML(t)}</p>
            </div>`;
        });
        html += `</div></div>`;
    }

    // Collocations
    if (collocations?.before?.length > 0 || collocations?.after?.length > 0) {
        html += `<div style="margin-bottom:20px;">
            <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:10px;">🔗 Collocations — uso real em corpus</div>`;
        if (collocations.before?.length > 0) {
            html += `<div style="margin-bottom:8px;">
                <span style="font-size:12px;color:#64748B;margin-right:8px;">Antes de "${escapeHTML(word)}":</span>
                ${collocations.before.slice(0,6).map(w => `<span class="wp-chip">${escapeHTML(w)}</span>`).join('')}
            </div>`;
        }
        if (collocations.after?.length > 0) {
            html += `<div>
                <span style="font-size:12px;color:#64748B;margin-right:8px;">Depois de "${escapeHTML(word)}":</span>
                ${collocations.after.slice(0,6).map(w => `<span class="wp-chip">${escapeHTML(w)}</span>`).join('')}
            </div>`;
        }
        html += `</div>`;
    }

    // Erros comuns
    if (commonMistakes?.length > 0) {
        html += `<div style="background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);border-radius:10px;padding:14px;margin-bottom:16px;">
            <div style="font-size:11px;color:#EF4444;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:8px;">⚠️ Erros comuns</div>
            ${commonMistakes.map(m => `<div class="wp-grammar-tip" style="color:#FCA5A5;">${escapeHTML(m)}</div>`).join('')}
        </div>`;
    }

    // Notas de uso
    if (usageNotes?.length > 0) {
        html += `<div style="margin-bottom:16px;">
            <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:8px;">💡 Notas de uso</div>
            ${usageNotes.map(n => `<div class="wp-grammar-tip">${escapeHTML(n)}</div>`).join('')}
        </div>`;
    }

    if (lesson?.quickCheck) {
        html += `<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.18);border-radius:10px;padding:14px;margin-bottom:16px;">
            <div style="font-size:11px;color:#10B981;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;margin-bottom:8px;">Mini exercicio</div>
            <p style="font-size:13px;color:#CBD5E1;line-height:1.6;margin:0;">${escapeHTML(lesson.quickCheck)}</p>
        </div>`;
    }

    // Etimologia
    if (etymology) {
        html += `<div style="background:rgba(167,139,250,0.05);border:1px solid rgba(167,139,250,0.15);border-radius:10px;padding:14px;">
            <div style="font-size:11px;color:#A78BFA;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:8px;">📜 Etimologia (Wiktionary)</div>
            <p style="font-size:13px;color:#CBD5E1;line-height:1.6;margin:0;">${escapeHTML(etymology)}</p>
        </div>`;
    }

    return html || '<p style="color:#64748B;font-size:13px;">Análise gramatical não disponível.</p>';
}

async function deleteWord(id) {
    if (!confirm('Deletar esta palavra?')) return;
    const db = await openDB();
    const tx = db.transaction(['words', 'cards'], 'readwrite');
    tx.objectStore('words').delete(id);
    // Tenta deletar card associado
    const cardIdx = tx.objectStore('cards').index('word_id');
    const req = cardIdx.get(id);
    req.onsuccess = () => { if (req.result) tx.objectStore('cards').delete(req.result.id); };
    tx.oncomplete = () => history.back();
}

function openWord(word) {
    // Abre a mesma página para outra palavra (busca pelo nome)
    window.location.href = `word-detail.html?word=${encodeURIComponent(word)}`;
}

// Init
document.querySelectorAll('[data-href]').forEach(btn => {
    btn.addEventListener('click', () => {
        window.location.href = btn.dataset.href;
    });
});

(async () => {
    const params = new URLSearchParams(location.search);
    const id = parseInt(params.get('id'));
    const wordName = params.get('word');

    if (id) {
        const wordData = await getWord(id);
        if (wordData) { await render(wordData); return; }
    }

    if (wordName) {
        // Busca pelo nome (para sinônimos/antônimos)
        const db = await openDB();
        const tx = db.transaction('words', 'readonly');
        const idx = tx.objectStore('words').index('word_lang');
        const req = idx.get([wordName.toLowerCase(), 'en']);
        req.onsuccess = async () => {
            if (req.result) { await render(req.result); }
            else {
                // Palavra não está no banco, mostra só o que temos da API
                await render({ word: wordName, lang: 'en', translation: '', context_sentence: '' });
            }
        };
        return;
    }

    document.getElementById('word-page').innerHTML = '<div class="wp-loading">Palavra não encontrada.</div>';
})();

