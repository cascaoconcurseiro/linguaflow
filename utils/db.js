// utils/db.js — Banco único do LinguaFlow
// Todos os módulos usam este arquivo. Sem chrome.storage para dados de aprendizado.

const DB_NAME = 'LinguaFlowFreeDB';
const DB_VERSION = 4; // bump para migração

class Database {
    constructor() {
        this.db = null;
        this.initPromise = this._open();
    }

    async _open() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);

            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                const oldVersion = e.oldVersion;

                if (!db.objectStoreNames.contains('words')) {
                    const s = db.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('word_lang', ['word', 'lang'], { unique: true });
                    s.createIndex('deck_id', 'deck_id', { unique: false });
                    s.createIndex('added_at', 'added_at', { unique: false });
                }
                if (!db.objectStoreNames.contains('cards')) {
                    const s = db.createObjectStore('cards', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('word_id', 'word_id', { unique: true });
                    s.createIndex('due_date', 'due_date', { unique: false });
                    s.createIndex('status', 'status', { unique: false });
                }
                if (!db.objectStoreNames.contains('decks'))
                    db.createObjectStore('decks', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('known_words'))
                    db.createObjectStore('known_words', { keyPath: ['word', 'lang'] });
                if (!db.objectStoreNames.contains('sessions'))
                    db.createObjectStore('sessions', { keyPath: 'date' });
                if (!db.objectStoreNames.contains('settings'))
                    db.createObjectStore('settings', { keyPath: 'key' });
                if (!db.objectStoreNames.contains('sentences'))
                    db.createObjectStore('sentences', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('review_log')) {
                    const s = db.createObjectStore('review_log', { keyPath: 'id', autoIncrement: true });
                    s.createIndex('date', 'date', { unique: false });
                }
            };

            req.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
                // Migra dados do chrome.storage se existirem
                this._migrateFromChromeStorage().catch(() => {});
            };
            req.onerror = () => reject(req.error);
        });
    }

    // ── Migração do chrome.storage.local → IndexedDB ──────────────────────────
    async _migrateFromChromeStorage() {
        if (typeof chrome === 'undefined' || !chrome.storage) return;
        const data = await new Promise(r => chrome.storage.local.get(
            ['lf_words', 'lf_cards', 'lf_sents', 'lf_migrated_v4'], r
        ));
        if (data.lf_migrated_v4) return; // já migrado
        if (!data.lf_words?.length && !data.lf_sents?.length) return;

        console.log('[LinguaFlow DB] Migrando dados do chrome.storage...');
        let count = 0;

        if (data.lf_words?.length) {
            for (const w of data.lf_words) {
                try {
                    await this.saveWord({
                        word: w.word, lang: w.sourceLang || 'en',
                        translation: w.translation || '',
                        phonetic: w.phonetic || '',
                        definition: w.definition || '',
                        context_sentence: w.context || '',
                        video_url: w.videoUrl || '',
                        video_title: w.videoTitle || '',
                        platform: w.platform || 'youtube',
                        deck_id: 1,
                        added_at: w.id || Date.now(),
                    });
                    count++;
                } catch {}
            }
        }

        if (data.lf_sents?.length) {
            for (const s of data.lf_sents) {
                try { await this.saveSentence(s); } catch {}
            }
        }

        await new Promise(r => chrome.storage.local.set({ lf_migrated_v4: true }, r));
        console.log(`[LinguaFlow DB] Migração concluída: ${count} palavras`);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    async _tx(stores, mode, fn) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(stores, mode);
            tx.onerror = () => reject(tx.error);
            resolve(fn(tx));
        });
    }

    // ── CEFR automático por frequência ────────────────────────────────────────
    static guessCEFR(word) {
        const w = (word || '').toLowerCase();
        const TOP_1K = new Set(['the','be','to','of','and','a','in','that','have','it','for','not','on','with','he','as','you','do','at','this','but','his','by','from','they','we','say','her','she','or','an','will','my','one','all','would','there','their','what','so','up','out','if','about','who','get','which','go','me','when','make','can','like','time','no','just','him','know','take','people','into','year','your','good','some','could','them','see','other','than','then','now','look','only','come','its','over','think','also','back','after','use','two','how','our','work','first','well','way','even','new','want','because','any','these','give','day','most','us','great','between','need','large','often','hand','high','place','hold','real','life','few','open','seem','together','next','white','begin','got','walk','example','always','music','both','book','letter','until','mile','river','car','feet','care','second','enough','girl','young','ready','above','ever','red','list','though','feel','talk','bird','soon','body','dog','family','leave','song','door','product','black','short','class','wind','question','happen','ship','area','half','rock','order','fire','south','problem','piece','told','knew','pass','since','top','whole','king','space','heard','best','hour','better','true','during','hundred','five','remember','step','early','west','ground','interest','reach','fast','sing','listen','six','table','travel','less','morning','ten','simple','several','toward','war','lay','against','pattern','slow','center','love','person','money','serve','appear','road','map','rain','rule','pull','cold','notice','voice','unit','power','town','fine','drive','led','cry','dark','machine','note','wait','plan','figure','star','box','field','rest','correct','able','pound','done','beauty','stood','contain','front','teach','week','final','gave','green','quick','develop','ocean','warm','free','minute','strong','special','mind','behind','clear','tail','produce','fact','street','inch','nothing','course','stay','wheel','full','force','blue','object','decide','surface','deep','moon','island','foot','system','busy','test','record','boat','common','gold','possible','plane','dry','wonder','laugh','thousand','ago','ran','check','game','shape','hot','miss','brought','heat','snow','tire','bring','yes','fill','east','paint','language','among','grand','ball','yet','wave','drop','heart','present','heavy','dance','engine','position','arm','wide','sail','material','size','vary','settle','speak','weight','general','ice','matter','circle','pair','divide','felt','perhaps','pick','sudden','count','square','reason','length','represent','art','subject','region','energy','hunt','bed','brother','egg','ride','cell','believe','forest','sit','race','window','store','summer','train','sleep','prove','leg','exercise','wall','catch','mount','wish','sky','board','joy','winter','sat','written','wild','kept','glass','grass','cow','job','edge','sign','visit','past','soft','fun','bright','gas','weather','month','million','bear','finish','happy','hope','flower','strange','gone','jump','baby','eight','village','meet','root','buy','raise','solve','metal','push','seven','shall','held','hair','describe','cook','floor','result','burn','hill','safe','cat','century','type','law','bit','coast','copy','phrase','silent','tall','sand','soil','roll','finger','industry','value','fight','lie','beat','natural','view','sense','ear','else','quite','broke','case','middle','son','lake','moment','scale','loud','spring','child','straight','nation','milk','speed','method','organ','pay','age','section','dress','cloud','surprise','quiet','stone','tiny','climb','cool','design','poor','lot','bottom','key','iron','single','stick','flat','twenty','skin','smile','hole','trade','melody','trip','office','receive','row','mouth','exact','symbol','die','least','trouble','shout','except','wrote','seed','tone','join','clean','break','lady','yard','rise','bad','blow','oil','blood','touch','grew','cent','mix','team','wire','cost','lost','brown','wear','garden','equal','sent','choose','fell','fit','flow','fair','bank','collect','save','control','gentle','woman','captain','practice','separate','difficult','doctor','please','protect','whose','locate','ring','character','insect','caught','period','indicate','radio','spoke','atom','human','history','effect','electric','crop','modern','element','hit','student','corner','party','supply','bone','rail','imagine','provide','agree','capital','chair','danger','fruit','rich','thick','soldier','process','operate','guess','necessary','sharp','wing','create','wash','bat','rather','crowd','corn','compare','poem','string','bell','depend','meat','rub','tube','famous','dollar','stream','fear','sight','thin','planet','hurry','chief','colony','clock','mine','tie','enter','major','fresh','search','send','yellow','gun','allow','print','dead','spot','desert','suit','current','lift','rose','continue','block','chart','hat','sell','success','company','subtract','event','particular','deal','swim','term','opposite','wife','shoe','shoulder','spread','arrange','camp','invent','cotton','born','determine','nine','truck','noise','level','chance','gather','shop','stretch','throw','shine','property','column','select','wrong','gray','repeat','require','broad','prepare','salt','nose','anger','claim','continent','oxygen','sugar','death','pretty','skill','women','season','solution','silver','thank','branch','match','especially','afraid','huge','sister','steel','discuss','forward','similar','guide','experience','score','apple','bought','pitch','coat','mass','card','band','rope','slip','win','dream','evening','condition','feed','tool','total','basic','smell','valley','double','seat','arrive','master','track','parent','shore','division','sheet','substance','connect','post','spend','fat','glad','share','station','dad','bread','charge','proper','bar','offer','segment','duck','instant','market','degree','dear','enemy','reply','drink','occur','support','speech','nature','range','steam','motion','path','liquid','log','teeth','shell','neck']);
        if (TOP_1K.has(w)) return 'A1';
        if (w.length <= 5) return 'A2';
        if (w.length <= 7) return 'B1';
        if (w.length <= 9) return 'B2';
        if (w.length <= 11) return 'C1';
        return 'C2';
    }

    // ── Words ─────────────────────────────────────────────────────────────────
    async saveWord(wordData) {
        await this.initPromise;
        const lang = wordData.lang || wordData.sourceLang || 'en';
        const word = (wordData.word || '').trim();
        if (!word) throw new Error('word is required');

        // Auto CEFR
        if (!wordData.cefr_guess) wordData.cefr_guess = Database.guessCEFR(word);

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['words', 'cards', 'decks'], 'readwrite');
            const wordsStore = tx.objectStore('words');
            const cardsStore = tx.objectStore('cards');
            const decksStore = tx.objectStore('decks');

            // Garante deck default
            const deckId = wordData.deck_id || 1;
            decksStore.get(deckId).onsuccess = (e) => {
                if (!e.target.result)
                    decksStore.put({ id: deckId, name: 'Default Deck', created_at: Date.now() });
            };

            const checkReq = wordsStore.index('word_lang').get([word, lang]);
            checkReq.onsuccess = () => {
                const existing = checkReq.result;
                const toSave = {
                    ...wordData,
                    word, lang,
                    added_at: existing?.added_at || wordData.added_at || Date.now(),
                    cefr_guess: wordData.cefr_guess,
                };
                if (existing) toSave.id = existing.id;

                const wordReq = wordsStore.put(toSave);
                wordReq.onsuccess = (e) => {
                    const wordId = e.target.result;
                    if (!existing) {
                        cardsStore.put({
                            word_id: wordId, interval: 0, ease_factor: 2.5,
                            due_date: Date.now(), reps: 0, lapses: 0, status: 'new'
                        });
                    }
                    
                    // ← FIX: Wait for transaction to complete before resolving
                    tx.oncomplete = () => {
                        resolve({ ok: true, id: wordId, isNew: !existing });
                    };
                };
                wordReq.onerror = () => reject(wordReq.error);
            };
            checkReq.onerror = () => reject(checkReq.error);
            tx.onerror = () => reject(tx.error);
        });
    }

    async getAllWords(deckId = null, lang = null) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const req = this.db.transaction('words', 'readonly').objectStore('words').getAll();
            req.onsuccess = () => {
                let res = req.result || [];
                if (deckId) res = res.filter(w => w.deck_id === deckId);
                if (lang) res = res.filter(w => w.lang === lang);
                resolve(res);
            };
            req.onerror = () => reject(req.error);
        });
    }

    async getWord(word, lang = 'en') {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const req = this.db.transaction('words', 'readonly')
                .objectStore('words').index('word_lang').get([word, lang]);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async deleteWord(id) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['words', 'cards'], 'readwrite');
            tx.objectStore('words').delete(id);
            const idx = tx.objectStore('cards').index('word_id');
            idx.get(id).onsuccess = (e) => {
                if (e.target.result) tx.objectStore('cards').delete(e.target.result.id);
            };
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    // ── Cards / SRS ───────────────────────────────────────────────────────────
    async getCardsDue(limit = 50) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['cards', 'words'], 'readonly');
            const req = tx.objectStore('cards').index('due_date')
                .getAll(IDBKeyRange.upperBound(Date.now()));
            req.onsuccess = () => {
                let cards = (req.result || []).sort((a, b) => {
                    const p = { learning: 0, relearning: 1, new: 2, review: 3 };
                    return (p[a.status] ?? 3) - (p[b.status] ?? 3) || a.due_date - b.due_date;
                }).slice(0, limit);

                if (!cards.length) { resolve([]); return; }
                let done = 0;
                cards.forEach(card => {
                    const r = tx.objectStore('words').get(card.word_id);
                    r.onsuccess = () => { card.wordData = r.result; if (++done === cards.length) resolve(cards); };
                    r.onerror = () => { if (++done === cards.length) resolve(cards); };
                });
            };
            req.onerror = () => reject(req.error);
        });
    }

    async updateCard(card) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const req = this.db.transaction('cards', 'readwrite').objectStore('cards').put(card);
            req.onsuccess = resolve;
            req.onerror = () => reject(req.error);
        });
    }

    async logReview(cardId, quality) {
        await this.initPromise;
        const today = new Date().toISOString().split('T')[0];
        return new Promise((resolve, reject) => {
            const req = this.db.transaction('review_log', 'readwrite')
                .objectStore('review_log').add({ card_id: cardId, quality, date: today, ts: Date.now() });
            req.onsuccess = resolve;
            req.onerror = () => reject(req.error);
        });
    }

    async getReviewLog(days = 30) {
        await this.initPromise;
        const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
        return new Promise((resolve, reject) => {
            const req = this.db.transaction('review_log', 'readonly')
                .objectStore('review_log').index('date')
                .getAll(IDBKeyRange.lowerBound(since));
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    // ── Decks ─────────────────────────────────────────────────────────────────
    async getAllDecks() {
        await this.initPromise;
        return new Promise((resolve) => {
            const req = this.db.transaction('decks', 'readonly').objectStore('decks').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }

    async getDeck(id) {
        await this.initPromise;
        return new Promise((resolve) => {
            const req = this.db.transaction('decks', 'readonly').objectStore('decks').get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    }

    async createDeck(name) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const req = this.db.transaction('decks', 'readwrite')
                .objectStore('decks').add({ name, created_at: Date.now() });
            req.onsuccess = () => resolve({ ok: true, id: req.result });
            req.onerror = () => reject(req.error);
        });
    }

    async updateDeck(id, name) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('decks', 'readwrite');
            const store = tx.objectStore('decks');
            const getReq = store.get(id);
            getReq.onsuccess = () => {
                const deck = getReq.result;
                if (!deck) { reject(new Error('Deck não encontrado')); return; }
                deck.name = name;
                store.put(deck);
            };
            tx.oncomplete = () => resolve({ ok: true });
            tx.onerror = () => reject(tx.error);
        });
    }

    async deleteDeck(id) {
        await this.initPromise;
        if (id === 1) throw new Error('Não é possível deletar o deck padrão');
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['decks', 'words'], 'readwrite');
            // Move todas as palavras para o deck padrão
            const wordsStore = tx.objectStore('words');
            const wordsReq = wordsStore.getAll();
            wordsReq.onsuccess = () => {
                const words = wordsReq.result || [];
                words.forEach(w => {
                    if (w.deck_id === id) {
                        w.deck_id = 1;
                        wordsStore.put(w);
                    }
                });
                // Deleta o deck
                tx.objectStore('decks').delete(id);
            };
            tx.oncomplete = () => resolve({ ok: true });
            tx.onerror = () => reject(tx.error);
        });
    }

    async moveWordToDeck(wordId, deckId) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('words', 'readwrite');
            const store = tx.objectStore('words');
            const req = store.get(wordId);
            req.onsuccess = () => {
                const word = req.result;
                if (!word) { reject(new Error('Palavra não encontrada')); return; }
                word.deck_id = deckId;
                store.put(word);
            };
            tx.oncomplete = () => resolve({ ok: true });
            tx.onerror = () => reject(tx.error);
        });
    }

    async getDeckStats(deckId) {
        await this.initPromise;
        const [words, cards] = await Promise.all([
            this.getAllWords(deckId),
            new Promise(r => {
                const req = this.db.transaction('cards', 'readonly').objectStore('cards').getAll();
                req.onsuccess = () => r(req.result || []);
                req.onerror = () => r([]);
            })
        ]);
        const wordIds = new Set(words.map(w => w.id));
        const deckCards = cards.filter(c => wordIds.has(c.word_id));
        const due = deckCards.filter(c => c.due_date <= Date.now()).length;
        const byStatus = { new: 0, learning: 0, review: 0, mature: 0 };
        deckCards.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });
        return { total: words.length, due, byStatus };
    }
    async markAsKnown(word, lang = 'en') {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const req = this.db.transaction('known_words', 'readwrite')
                .objectStore('known_words').put({ word, lang, marked_at: Date.now() });
            req.onsuccess = resolve;
            req.onerror = () => reject(req.error);
        });
    }

    async isKnown(word, lang = 'en') {
        await this.initPromise;
        return new Promise((resolve) => {
            const req = this.db.transaction('known_words', 'readonly')
                .objectStore('known_words').get([word, lang]);
            req.onsuccess = () => resolve(!!req.result);
            req.onerror = () => resolve(false);
        });
    }

    async getAllKnown() {
        await this.initPromise;
        return new Promise((resolve) => {
            const req = this.db.transaction('known_words', 'readonly')
                .objectStore('known_words').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }

    // ── Sentences ─────────────────────────────────────────────────────────────
    async saveSentence(s) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const data = { ...s, saved_at: s.saved_at || Date.now() };
            delete data.id; // autoIncrement
            const req = this.db.transaction('sentences', 'readwrite')
                .objectStore('sentences').add(data);
            req.onsuccess = () => resolve({ ok: true, id: req.result });
            req.onerror = () => reject(req.error);
        });
    }

    async getAllSentences() {
        await this.initPromise;
        return new Promise((resolve) => {
            const req = this.db.transaction('sentences', 'readonly')
                .objectStore('sentences').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }

    // ── Sessions (imersão) ────────────────────────────────────────────────────
    async logSession(seconds, platform = 'youtube') {
        await this.initPromise;
        const today = new Date().toISOString().split('T')[0];
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('sessions', 'readwrite');
            const store = tx.objectStore('sessions');
            const req = store.get(today);
            req.onsuccess = () => {
                const existing = req.result || { date: today, seconds: 0, by_platform: {} };
                existing.seconds += seconds;
                existing.by_platform[platform] = (existing.by_platform[platform] || 0) + seconds;
                store.put(existing);
                resolve();
            };
            req.onerror = () => reject(req.error);
        });
    }

    async getSessions(days = 30) {
        await this.initPromise;
        const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
        return new Promise((resolve) => {
            const req = this.db.transaction('sessions', 'readonly')
                .objectStore('sessions').getAll(IDBKeyRange.lowerBound(since));
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }

    // ── Settings ──────────────────────────────────────────────────────────────
    async getSetting(key) {
        await this.initPromise;
        return new Promise((resolve) => {
            const req = this.db.transaction('settings', 'readonly').objectStore('settings').get(key);
            req.onsuccess = () => resolve(req.result ? req.result.value : null);
            req.onerror = () => resolve(null);
        });
    }

    async setSetting(key, value) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const req = this.db.transaction('settings', 'readwrite')
                .objectStore('settings').put({ key, value });
            req.onsuccess = resolve;
            req.onerror = () => reject(req.error);
        });
    }

    async getAllSettings() {
        await this.initPromise;
        return new Promise((resolve) => {
            const req = this.db.transaction('settings', 'readonly').objectStore('settings').getAll();
            req.onsuccess = () => {
                const obj = {};
                (req.result || []).forEach(r => { obj[r.key] = r.value; });
                resolve(obj);
            };
            req.onerror = () => resolve({});
        });
    }

    // ── Stats completas ───────────────────────────────────────────────────────
    async getStats() {
        await this.initPromise;
        const [words, cards, known, sessions, log] = await Promise.all([
            this.getAllWords(),
            this.getCardsDue(9999),
            this.getAllKnown(),
            this.getSessions(30),
            this.getReviewLog(30),
        ]);

        const today = new Date().toISOString().split('T')[0];
        const todaySecs = sessions.find(s => s.date === today)?.seconds || 0;
        const todayRevs = log.filter(r => r.date === today).length;
        const totalSecs = sessions.reduce((a, s) => a + (s.seconds || 0), 0);

        // Streak
        let streak = 0;
        const allDates = new Set([
            ...sessions.map(s => s.date),
            ...log.map(r => r.date),
        ]);
        const d = new Date();
        while (streak < 9999) {
            const ds = d.toISOString().split('T')[0];
            if (!allDates.has(ds)) break;
            streak++;
            d.setDate(d.getDate() - 1);
        }

        // Retenção (% de revisões com qualidade >= 3)
        const goodRevs = log.filter(r => r.quality >= 3).length;
        const retention = log.length > 0 ? Math.round((goodRevs / log.length) * 100) : 0;

        // Por status
        const allCards = await new Promise(r => {
            const req = this.db.transaction('cards', 'readonly').objectStore('cards').getAll();
            req.onsuccess = () => r(req.result || []);
            req.onerror = () => r([]);
        });
        const byStatus = { new: 0, learning: 0, review: 0, mature: 0, relearning: 0 };
        allCards.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });

        // Por CEFR
        const byCEFR = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
        words.forEach(w => { byCEFR[w.cefr_guess || 'B1'] = (byCEFR[w.cefr_guess || 'B1'] || 0) + 1; });

        return {
            totalWords: words.length,
            knownWords: known.length,
            dueCards: cards.length,
            todayRevs, todaySecs, totalSecs, streak, retention,
            byStatus, byCEFR,
        };
    }

    // ── Palavra do dia ────────────────────────────────────────────────────────
    async getWordOfDay() {
        const words = await this.getAllWords();
        if (!words.length) return null;
        // Pega palavra mais antiga não revisada recentemente
        const sorted = words.sort((a, b) => (a.added_at || 0) - (b.added_at || 0));
        const today = new Date().toISOString().split('T')[0];
        const key = `word_of_day_${today}`;
        const saved = await this.getSetting(key);
        if (saved) return words.find(w => w.id === saved) || sorted[0];
        const pick = sorted[0];
        await this.setSetting(key, pick.id);
        return pick;
    }

    // ── Backup / Restore ──────────────────────────────────────────────────────
    async exportAll() {
        await this.initPromise;
        const stores = ['words', 'cards', 'decks', 'known_words', 'sessions', 'settings', 'sentences', 'review_log'];
        const data = {};
        for (const name of stores) {
            data[name] = await new Promise(r => {
                const req = this.db.transaction(name, 'readonly').objectStore(name).getAll();
                req.onsuccess = () => r(req.result || []);
                req.onerror = () => r([]);
            });
        }
        return { version: 4, exportedAt: new Date().toISOString(), db: data };
    }

    async importAll(backup) {
        if (!backup?.db || !backup?.version) throw new Error('Backup inválido');
        await this.initPromise;
        const stores = ['words', 'cards', 'decks', 'known_words', 'sessions', 'settings', 'sentences', 'review_log'];
        for (const name of stores) {
            const records = backup.db[name];
            if (!Array.isArray(records)) continue;
            await new Promise((resolve, reject) => {
                const tx = this.db.transaction(name, 'readwrite');
                const store = tx.objectStore(name);
                store.clear();
                records.forEach(r => store.put(r));
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
        }
    }
}

export const db = new Database();
