// utils/db/words.js — Palavras, frases, histórias, textos do leitor, palavras conhecidas/ignoradas, tags e léxico canônico.
import { WORD_SELECT } from './shared.js';

export class WordsMethods {
  // ── PALAVRAS E CARDS ──────────────────────────────────────────────────────
  async saveWord(wordData) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('saveWord', [wordData]);
    const lang = wordData.lang || 'en';
    const word = (wordData.word || '').trim();
    if (!word) throw new Error('Word é obrigatório');

    const payload = {
      word,
      lang,
      translation: wordData.translation,
      context_sentence: wordData.context_sentence,
      added_at: new Date(wordData.added_at || Date.now()).toISOString(),
      phonetic: wordData.phonetic || null,
      tags: Array.isArray(wordData.tags)
        ? wordData.tags
        : (wordData.tags ? wordData.tags.split(',').map(t => t.trim()) : null)
    };

    // Aceita tanto 'chunks' (word-popup) quanto 'ai_chunks' (backfill/re-save)
    if (wordData.ai_chunks !== undefined) payload.ai_chunks = wordData.ai_chunks;
    else if (wordData.chunks !== undefined) payload.ai_chunks = wordData.chunks;
    if (wordData.category !== undefined) payload.category = wordData.category;
    if (wordData.video_url !== undefined) payload.video_url = wordData.video_url;
    if (wordData.video_start_ms !== undefined) payload.video_start_ms = wordData.video_start_ms;
    if (wordData.video_end_ms !== undefined) payload.video_end_ms = wordData.video_end_ms;
    if (wordData.video_title !== undefined) payload.video_title = wordData.video_title;
    if (wordData.synonyms !== undefined) payload.synonyms = wordData.synonyms;
    if (wordData.antonyms !== undefined) payload.antonyms = wordData.antonyms;
    if (wordData.definition !== undefined) payload.definition = wordData.definition;
    if (wordData.explanation !== undefined) payload.explanation = wordData.explanation;
    if (wordData.platform !== undefined) payload.platform = wordData.platform;
    if (wordData.level !== undefined) payload.level = wordData.level;
    if (wordData.snapshot !== undefined) payload.snapshot = wordData.snapshot;
    
    let savedWord = null;
    let isNewCard = false;

    // Via atômica prioritária: save_word_with_card cria palavra e card juntos na mesma transação
    try {
      const atomicResult = await this._fetch('rpc/save_word_with_card', {
        method: 'POST',
        body: { p_word: payload }
      });
      if (atomicResult?.ok && atomicResult.word) {
        savedWord = atomicResult.word;
        isNewCard = Boolean(atomicResult.is_new_card);
      }
    } catch (e) {
      // Fallback para rollout resiliente caso RPC falhe
      if (e?.status !== 404 && e?.code !== 'PGRST202') throw e;
    }

    if (!savedWord) {
      const res = await this._fetch('words?on_conflict=user_id,word,lang', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: payload
      });

      if (!res || !res.length) return { ok: false };
      savedWord = res[0];

      const existingCard = await this.getCardByWordId(savedWord.id);
      if (!existingCard) {
        await this._fetch('rpc/create_card_for_word', {
          method: 'POST',
          body: { p_word_id: savedWord.id }
        });
        isNewCard = true;
      } else {
        isNewCard = false;
      }
    }

    // A7 do backlog: TETO DO COFRE. Limite de novos/dia controla a
    // velocidade da dívida; o teto controla o TAMANHO. Cofre cheio: salvar
    // continua funcionando, mas a palavra nova entra SUSPENSA (tag
    // lf:espera) e não gera revisão até o aluno abrir vaga aposentando uma
    // dominada — salvar vira escolha, não reflexo. lf_vault_cap=0 desliga.
    let waitingForSlot = false;
    if (isNewCard) {
      try {
        const capRaw = await this.getSetting('lf_vault_cap');
        const cap = capRaw === null || capRaw === undefined || capRaw === ''
          ? 300 : Math.max(0, Number(capRaw) || 0);
        if (cap > 0) {
          const cards = await this.getAllCards();
          const active = (cards || []).filter(c => !c.suspended).length;
          if (active > cap) { // o card recém-criado já conta no total
            const created = await this.getCardByWordId(savedWord.id);
            if (created && !created.suspended) {
              await this.setCardSuspended(created.id, true);
              const tags = Array.isArray(savedWord.tags) ? savedWord.tags : [];
              if (!tags.includes('lf:espera')) {
                await this.addTagsToWord(savedWord.id, [...tags, 'lf:espera']).catch(() => {});
              }
              waitingForSlot = true;
            }
          }
        }
      } catch { /* o teto nunca pode bloquear o save */ }
    }

    return { ok: true, id: savedWord.id, isNew: isNewCard, waitingForSlot };
  }

  async getWord(word, lang = 'en') {
    if (this.isProxyMode) return this._proxy('getWord', [word, lang]);
    const res = await this._fetch(`words?select=${WORD_SELECT}&word=eq.${encodeURIComponent(word)}&lang=eq.${encodeURIComponent(lang)}&limit=1`);
    return res && res.length > 0 ? res[0] : null;
  }

  async getWordById(id) {
    if (this.isProxyMode) return this._proxy('getWordById', [id]);
    const res = await this._fetch(`words?select=${WORD_SELECT}&id=eq.${id}&limit=1`);
    return res && res.length > 0 ? res[0] : null;
  }

  async deleteWord(id) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('deleteWord', [id]);
    try {
      await this._fetch('rpc/delete_word_safely', {
        method: 'POST',
        body: { p_word_id: id },
      });
      return true;
    } catch (error) {
      // Janela de rollout: o cliente novo pode chegar antes da migration.
      // Só a ausência explícita da RPC permite o fallback legado; erros de
      // ownership, histórico ou permissão nunca viram DELETE direto.
      if (error?.status !== 404 && error?.code !== 'PGRST202') throw error;
      await this._fetch(`words?id=eq.${id}`, { method: 'DELETE' });
      return true;
    }
  }

  // Editor do Cofre (Onda 2.3): corrige tradução/frase/categoria/nível SEM
  // apagar o card — PATCH por id (não é upsert por word/lang) pra nunca
  // arriscar duplicar a palavra nem perder o histórico FSRS do card.
  async updateWord(id, patch) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('updateWord', [id, patch]);
    // video_start/end_ms: ajuste fino do trecho no Estudo (17/07) — o aluno
    // corrige a janela do loop e a correção persiste no card para sempre.
    const allowed = ['word', 'translation', 'context_sentence', 'category', 'level', 'phonetic', 'mnemonic', 'tags', 'video_start_ms', 'video_end_ms', 'ai_chunks'];
    const body = {};
    allowed.forEach(k => { if (patch && patch[k] !== undefined) body[k] = patch[k]; });
    if (Object.keys(body).length === 0) return { ok: true };
    await this._fetch(`words?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body,
    });
    return { ok: true };
  }

  async getAllWords(limit = 0) {
    // Stale-while-revalidate (Onda 4): cache "fresco" (<30s) serve na hora
    // sem rede nenhuma, igual antes. A diferença é o que acontece quando o
    // cache VENCEU: antes disso bloqueava a tela esperando a rede de novo —
    // era o gargalo real ao trocar de aba depois de 30s parado. Agora serve
    // o dado antigo IMEDIATAMENTE e revalida em segundo plano (deduplicado
    // por _wordsRefreshing, pra não disparar N requests em paralelo se a
    // view chamar getAllWords() várias vezes enquanto ainda está stale).
    if (limit === 0 && this._wordsCache) {
      if (Date.now() - this._wordsCache.ts >= 30000 && !this._wordsRefreshing) {
        this._wordsRefreshing = this._fetchWords(0).finally(() => { this._wordsRefreshing = null; });
        this._wordsRefreshing.catch(() => {});
      }
      return this._wordsCache.data;
    }
    return this._fetchWords(limit);
  }

  async _fetchWords(limit) {
    // Auditoria 2026-07-12: uma escrita (updateWord/deleteWord/logReview…)
    // chama _invalidateReadCache() enquanto um refresh SWR desta MESMA
    // lista já estava em voo. Sem o check de geração abaixo, esse fetch
    // antigo resolvia DEPOIS da invalidação e reescrevia o cache com dado
    // pré-escrita, marcado como "fresco" por mais 30s — a edição "sumia"
    // até o cache vencer nauralmente. _cacheGeneration captura o snapshot
    // no início do fetch; só grava se nada invalidou nesse meio-tempo.
    const gen = this._cacheGeneration;
    let data;
    if (this.isProxyMode) data = await this._proxy('getAllWords', [limit]);
    else {
      let query = `words?select=${WORD_SELECT}&order=added_at.desc`;
      if (limit > 0) query += `&limit=${limit}`;
      data = await this._fetch(query);
    }
    if (limit === 0 && gen === this._cacheGeneration) this._wordsCache = { data: data || [], ts: Date.now() };
    return data || [];
  }

  _invalidateReadCache(target = 'all') {
    this._cacheGeneration = (this._cacheGeneration || 0) + 1;
    if (target === 'all' || target === 'cards') this._cardsCache = null;
    if (target === 'all' || target === 'words') this._wordsCache = null;
    if (target === 'all' || target === 'sentences') this._sentencesCache = null;
    if (target === 'all' || target === 'known_words') this._knownWordsCache = null;
    if (target === 'all' || target === 'stories') {
      this._storiesCache = null;
      this._readerStoriesRepo?.invalidateCache?.();
    }
  }

  // Onda 4: aceita paginação real (limit/offset viram LIMIT/OFFSET no
  // Postgres) — sem eles, mantém o comportamento antigo (lista completa via
  // cache SWR de getAllWords/getAllCards), usado por getWordsByLetter.
  // Também corrige um bug latente: a versão anterior ignorava o `category`
  // por completo (retornava tudo, sem filtrar) — nunca foi notado porque
  // não tinha nenhum chamador na UI ainda.
  async getWordsByCategory(category, { limit, offset } = {}) {
    if (this.isProxyMode) return this._proxy('getWordsByCategory', [category, { limit, offset }]);

    if (typeof limit === 'number') {
      let query = `words?select=${WORD_SELECT}&order=word.asc&limit=${limit}&offset=${offset || 0}`;
      if (category && category !== 'all') query += `&category=eq.${encodeURIComponent(category)}`;
      const words = await this._fetch(query) || [];
      if (words.length === 0) return [];
      const ids = words.map(w => w.id);
      const cards = await this._fetch(`cards?word_id=in.(${ids.join(',')})&select=word_id,status,reps`) || [];
      const cardMap = {};
      cards.forEach(c => cardMap[c.word_id] = c);
      return words.map(w => ({
        ...w,
        reps: cardMap[w.id]?.reps || 0,
        status: cardMap[w.id]?.status || 'new'
      }));
    }

    const words = await this.getAllWords();
    const cards = await this.getAllCards();
    const cardMap = {};
    cards.forEach(c => cardMap[c.word_id] = c);
    const filtered = category && category !== 'all' ? words.filter(w => w.category === category) : words;

    return filtered.map(w => ({
      ...w,
      reps: cardMap[w.id]?.reps || 0,
      status: cardMap[w.id]?.status || 'new'
    })).sort((a, b) => (a.word || '').localeCompare(b.word || ''));
  }

  async getWordsByLetter(letter, category) {
    if (this.isProxyMode) return this._proxy('getWordsByLetter', [letter, category]);
    const allWords = await this.getWordsByCategory(category || 'all');
    if (!letter) return allWords;
    return allWords.filter(w => (w.word || '').toUpperCase().startsWith(letter.toUpperCase()));
  }

  // ── HISTÓRIAS (delegadas ao ReaderStoriesRepository) ─────────────────────
  async saveStory(story) {
    return this._readerStoriesRepo.saveStory(story);
  }

  async getStories(limit = 50) {
    return this._readerStoriesRepo.getStories(limit);
  }

  async _fetchStories(limit = 50) {
    return this._readerStoriesRepo._fetchStories(limit);
  }

  async deleteStory(id) {
    return this._readerStoriesRepo.deleteStory(id);
  }

  async saveSentence(data) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('saveSentence', [data]);
    const original = String(data?.original || '').trim();
    if (!original) throw new Error('Frase original é obrigatória');
    const payload = {
      original,
      translation: data?.translation || null,
      analysis: data?.analysis || null,
      platform: data?.platform || null,
      video_url: data?.video_url || null,
      video_title: data?.video_title || null,
    };
    const res = await this._fetch('sentences', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: payload
    });
    return { ok: !!res, id: res?.[0]?.id };
  }

  async getAllSentences() {
    // Onda 7 (perf): mesma estratégia SWR de getAllWords/getAllCards — antes
    // esta lista era buscada inteira, sem cache, em TODA carga do Início (via
    // getStats()), crescendo a cada frase salva. Achado da auditoria de
    // performance do painel.
    if (this._sentencesCache) {
      if (Date.now() - this._sentencesCache.ts >= 30000 && !this._sentencesRefreshing) {
        this._sentencesRefreshing = this._fetchSentences().finally(() => { this._sentencesRefreshing = null; });
        this._sentencesRefreshing.catch(() => {});
      }
      return this._sentencesCache.data;
    }
    return this._fetchSentences();
  }

  async _fetchSentences() {
    const gen = this._cacheGeneration;
    let data;
    if (this.isProxyMode) data = await this._proxy('getAllSentences', []);
    else data = await this._fetch('sentences?select=*');
    if (gen === this._cacheGeneration) this._sentencesCache = { data: data || [], ts: Date.now() };
    return data || [];
  }

  async getSentenceById(id) {
    if (this.isProxyMode) return this._proxy('getSentenceById', [id]);
    const res = await this._fetch(`sentences?id=eq.${id}&limit=1`);
    return res && res.length > 0 ? res[0] : null;
  }

  async deleteSentence(id) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('deleteSentence', [id]);
    await this._fetch(`sentences?id=eq.${id}`, { method: 'DELETE' });
    return true;
  }

  async markAsKnown(word, lang) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('markAsKnown', [word, lang]);
    const res = await this._fetch('known_words?on_conflict=user_id,word,lang', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: { word: word.toLowerCase(), lang }
    });
    return !!res;
  }

  // #368: "Ignorar" (nomes, interjeições, ruído da legenda). Tabela própria:
  // ignorar nunca conta como conhecida. Sem UPDATE: duplicata é descartada.
  async ignoreWord(word, lang) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('ignoreWord', [word, lang]);
    await this._fetch('ignored_words?on_conflict=user_id,word,lang', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
      body: { word: String(word).toLowerCase(), lang },
    });
    return true;
  }

  async unignoreWord(word, lang) {
    this._invalidateReadCache();
    if (this.isProxyMode) return this._proxy('unignoreWord', [word, lang]);
    await this._fetch(`ignored_words?word=eq.${encodeURIComponent(String(word).toLowerCase())}&lang=eq.${encodeURIComponent(lang)}`, { method: 'DELETE' });
    return true;
  }

  async getAllIgnoredWords() {
    if (this.isProxyMode) return this._proxy('getAllIgnoredWords', []);
    try {
      return (await this._fetch('ignored_words?select=word,lang')) || [];
    } catch {
      return []; // tabela ausente (rollback) = nada ignorado
    }
  }

  async isKnown(word, lang) {
    if (this.isProxyMode) return this._proxy('isKnown', [word, lang]);
    const res = await this._fetch(`known_words?word=eq.${encodeURIComponent(word.toLowerCase())}&lang=eq.${encodeURIComponent(lang)}&limit=1`);
    return res && res.length > 0;
  }

  async getAllKnownWords() {
    // Onda 7 (perf): mesma estratégia SWR de getAllWords/getAllCards — chamada
    // em toda carga do Início/Leitor/Histórias sem cache nenhum antes disso.
    if (this._knownWordsCache) {
      if (Date.now() - this._knownWordsCache.ts >= 30000 && !this._knownWordsRefreshing) {
        this._knownWordsRefreshing = this._fetchKnownWords().finally(() => { this._knownWordsRefreshing = null; });
        this._knownWordsRefreshing.catch(() => {});
      }
      return this._knownWordsCache.data;
    }
    return this._fetchKnownWords();
  }

  async _fetchKnownWords() {
    const gen = this._cacheGeneration;
    let data;
    if (this.isProxyMode) data = await this._proxy('getAllKnownWords', []);
    else data = await this._fetch('known_words?select=*');
    if (gen === this._cacheGeneration) this._knownWordsCache = { data: data || [], ts: Date.now() };
    return data || [];
  }

  // ── WEB READER (delegadas ao ReaderStoriesRepository) ─────────────────────
  async getReaderTexts() {
    return this._readerStoriesRepo.getReaderTexts();
  }

  async saveReaderText(text) {
    return this._readerStoriesRepo.saveReaderText(text);
  }

  async migrateReaderText(text) {
    return this._readerStoriesRepo.migrateReaderText(text);
  }

  async deleteReaderText(id) {
    return this._readerStoriesRepo.deleteReaderText(id);
  }

  async addTagsToWord(wordId, tags) {
    if (this.isProxyMode) return this._proxy('addTagsToWord', [wordId, tags]);
    const tagsArray = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : null);
    const res = await this._fetch(`words?id=eq.${wordId}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: { tags: tagsArray }
    });
    return !!res;
  }

  async getAllTags() {
    if (this.isProxyMode) return this._proxy('getAllTags', []);
    const words = await this.getAllWords();
    const tagSet = new Set();
    words.forEach((w) => {
      if (w.tags && Array.isArray(w.tags)) {
        w.tags.forEach(t => tagSet.add(t));
      } else if (typeof w.tags === 'string') {
        w.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => tagSet.add(t));
      }
    });
    return [...tagSet].sort();
  }

  // Progresso de leitura do Web Reader
  async updateReaderProgress(textId, { lastReadPosition = 0, readingPercentage = 0, isCompleted = false } = {}) {
    return this._readerStoriesRepo.updateReaderProgress(textId, { lastReadPosition, readingPercentage, isCompleted });
  }

  // Arquivamento nativo de histórias
  async updateStoryArchive(storyId, archived = true) {
    return this._readerStoriesRepo.updateStoryArchive(storyId, archived);
  }

  // ── CACHE LÉXICO CANÔNICO (FinOps & Latência) ─────────────────────────────
  async getCanonicalLexicon(word, lang = 'en') {
    const normWord = String(word || '').trim().toLowerCase();
    const normLang = String(lang || 'en').trim().toLowerCase();
    if (!normWord) return null;

    const cacheKey = `${normLang}:${normWord}`;
    const storageKey = `lf_lex:${cacheKey}`;

    // Nível 1: Memória RAM
    if (this._canonicalLexiconMemory?.has(cacheKey)) {
      return this._canonicalLexiconMemory.get(cacheKey);
    }

    // Nível 2: Armazenamento Local Persistente (chrome.storage.local / localStorage)
    try {
      const localVal = await this._draftStorage('get', storageKey);
      if (localVal && (localVal.word || localVal.word_phon || (Array.isArray(localVal.contexts) && localVal.contexts.length > 0))) {
        if (!this._canonicalLexiconMemory) this._canonicalLexiconMemory = new Map();
        this._canonicalLexiconMemory.set(cacheKey, localVal);
        return localVal;
      }
    } catch {}

    if (this._canonicalLexiconDisabled) return null;
    if (this.isProxyMode) return this._proxy('getCanonicalLexicon', [word, lang]);

    // Nível 3: Supabase Remoto
    try {
      const res = await this._fetch(
        `canonical_lexicon?word=eq.${encodeURIComponent(normWord)}&lang=eq.${encodeURIComponent(normLang)}&select=*`,
        { silent: true }
      );
      if (Array.isArray(res) && res.length > 0) {
        const entry = res[0];
        if (!this._canonicalLexiconMemory) this._canonicalLexiconMemory = new Map();
        if (this._canonicalLexiconMemory.size > 500) {
          const firstKey = this._canonicalLexiconMemory.keys().next().value;
          this._canonicalLexiconMemory.delete(firstKey);
        }
        this._canonicalLexiconMemory.set(cacheKey, entry);
        this._draftStorage('set', storageKey, entry).catch(() => {});
        return entry;
      }
      return null;
    } catch (e) {
      if (e?.status === 404 || e?.code === 'PGRST205') {
        this._canonicalLexiconDisabled = true;
      }
      return null;
    }
  }

  async saveCanonicalLexicon(entry) {
    if (!entry || !entry.word) return null;
    const normWord = String(entry.word).trim().toLowerCase();
    const normLang = String(entry.lang || 'en').trim().toLowerCase();
    if (!normWord) return null;

    const cacheKey = `${normLang}:${normWord}`;
    const storageKey = `lf_lex:${cacheKey}`;

    // Atualiza imediatamente Nível 1 (RAM) e Nível 2 (Storage Local)
    const existing = this._canonicalLexiconMemory?.get(cacheKey) || null;
    const existingContexts = Array.isArray(existing?.contexts) ? [...existing.contexts] : [];
    let updatedContexts = existingContexts;

    if (entry.context && entry.context.sentence) {
      const sentLower = String(entry.context.sentence).trim().toLowerCase();
      const idx = updatedContexts.findIndex(c => String(c?.sentence || '').trim().toLowerCase() === sentLower);
      if (idx >= 0) {
        updatedContexts[idx] = {
          ...updatedContexts[idx],
          ...entry.context,
          sentence_phon: entry.context.sentence_phon || updatedContexts[idx].sentence_phon || '',
          sentence_pt: entry.context.sentence_pt || updatedContexts[idx].sentence_pt || '',
          word_pt: entry.context.word_pt || updatedContexts[idx].word_pt || '',
        };
      } else {
        updatedContexts.push(entry.context);
      }
    }

    const localEntry = {
      word: normWord,
      lang: normLang,
      word_phon: entry.word_phon || existing?.word_phon || null,
      word_pt: entry.word_pt || existing?.word_pt || null,
      contexts: updatedContexts,
      source: entry.source || 'deepseek-chat',
      updated_at: new Date().toISOString(),
    };

    if (!this._canonicalLexiconMemory) this._canonicalLexiconMemory = new Map();
    this._canonicalLexiconMemory.set(cacheKey, localEntry);
    this._draftStorage('set', storageKey, localEntry).catch(() => {});

    if (this._canonicalLexiconDisabled) return localEntry;
    if (this.isProxyMode) return this._proxy('saveCanonicalLexicon', [entry]);

    // Nível 3: Supabase Remoto via RPC
    try {
      const saved = await this._fetch('rpc/get_or_cache_canonical_lexicon', {
        method: 'POST',
        silent: true,
        body: {
          p_word: normWord,
          p_lang: normLang,
          p_entry: {
            word_phon: entry.word_phon || null,
            word_pt: entry.word_pt || null,
            context: entry.context || null,
            source: entry.source || 'deepseek-chat',
          },
        },
      });

      if (saved) {
        if (!this._canonicalLexiconMemory) this._canonicalLexiconMemory = new Map();
        this._canonicalLexiconMemory.set(cacheKey, saved);
        this._draftStorage('set', storageKey, saved).catch(() => {});
        return saved;
      }
      return localEntry;
    } catch (e) {
      if (e?.status === 404 || e?.code === 'PGRST202') {
        this._canonicalLexiconDisabled = true;
      }
      return localEntry;
    }
  }
}
