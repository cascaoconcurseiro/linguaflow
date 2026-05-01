/**
 * LinguaFlow — Grammar Engine v2.0
 *
 * Fontes usadas (todas gratuitas, sem chave):
 *  1. Free Dictionary API  — já em uso, fornece pos, definições, sinônimos
 *  2. Datamuse API         — collocations, palavras relacionadas por contexto
 *  3. Lógica local         — formas verbais, plural, comparativo (regras + irregulares)
 */

// ── Irregulares ───────────────────────────────────────────────────────────────

const IRREGULAR_VERBS = {
    be:['am/is/are','was/were','been'],arise:['arises','arose','arisen'],
    awake:['awakes','awoke','awoken'],bear:['bears','bore','born'],
    beat:['beats','beat','beaten'],become:['becomes','became','become'],
    begin:['begins','began','begun'],bend:['bends','bent','bent'],
    bet:['bets','bet','bet'],bind:['binds','bound','bound'],
    bite:['bites','bit','bitten'],bleed:['bleeds','bled','bled'],
    blow:['blows','blew','blown'],break:['breaks','broke','broken'],
    breed:['breeds','bred','bred'],bring:['brings','brought','brought'],
    build:['builds','built','built'],burn:['burns','burned/burnt','burned/burnt'],
    buy:['buys','bought','bought'],catch:['catches','caught','caught'],
    choose:['chooses','chose','chosen'],come:['comes','came','come'],
    cost:['costs','cost','cost'],cut:['cuts','cut','cut'],
    deal:['deals','dealt','dealt'],dig:['digs','dug','dug'],
    do:['does','did','done'],draw:['draws','drew','drawn'],
    dream:['dreams','dreamed/dreamt','dreamed/dreamt'],drink:['drinks','drank','drunk'],
    drive:['drives','drove','driven'],eat:['eats','ate','eaten'],
    fall:['falls','fell','fallen'],feed:['feeds','fed','fed'],
    feel:['feels','felt','felt'],fight:['fights','fought','fought'],
    find:['finds','found','found'],fly:['flies','flew','flown'],
    forget:['forgets','forgot','forgotten'],forgive:['forgives','forgave','forgiven'],
    freeze:['freezes','froze','frozen'],get:['gets','got','gotten/got'],
    give:['gives','gave','given'],go:['goes','went','gone'],
    grow:['grows','grew','grown'],hang:['hangs','hung','hung'],
    have:['has','had','had'],hear:['hears','heard','heard'],
    hide:['hides','hid','hidden'],hit:['hits','hit','hit'],
    hold:['holds','held','held'],hurt:['hurts','hurt','hurt'],
    keep:['keeps','kept','kept'],know:['knows','knew','known'],
    lay:['lays','laid','laid'],lead:['leads','led','led'],
    leave:['leaves','left','left'],lend:['lends','lent','lent'],
    let:['lets','let','let'],lie:['lies','lay','lain'],
    lose:['loses','lost','lost'],make:['makes','made','made'],
    mean:['means','meant','meant'],meet:['meets','met','met'],
    pay:['pays','paid','paid'],put:['puts','put','put'],
    read:['reads','read','read'],ride:['rides','rode','ridden'],
    ring:['rings','rang','rung'],rise:['rises','rose','risen'],
    run:['runs','ran','run'],say:['says','said','said'],
    see:['sees','saw','seen'],seek:['seeks','sought','sought'],
    sell:['sells','sold','sold'],send:['sends','sent','sent'],
    set:['sets','set','set'],shake:['shakes','shook','shaken'],
    shine:['shines','shone','shone'],shoot:['shoots','shot','shot'],
    show:['shows','showed','shown'],shrink:['shrinks','shrank','shrunk'],
    shut:['shuts','shut','shut'],sing:['sings','sang','sung'],
    sink:['sinks','sank','sunk'],sit:['sits','sat','sat'],
    sleep:['sleeps','slept','slept'],slide:['slides','slid','slid'],
    speak:['speaks','spoke','spoken'],spend:['spends','spent','spent'],
    spin:['spins','spun','spun'],spread:['spreads','spread','spread'],
    stand:['stands','stood','stood'],steal:['steals','stole','stolen'],
    stick:['sticks','stuck','stuck'],sting:['stings','stung','stung'],
    strike:['strikes','struck','struck'],swear:['swears','swore','sworn'],
    sweep:['sweeps','swept','swept'],swim:['swims','swam','swum'],
    swing:['swings','swung','swung'],take:['takes','took','taken'],
    teach:['teaches','taught','taught'],tear:['tears','tore','torn'],
    tell:['tells','told','told'],think:['thinks','thought','thought'],
    throw:['throws','threw','thrown'],understand:['understands','understood','understood'],
    wake:['wakes','woke','woken'],wear:['wears','wore','worn'],
    win:['wins','won','won'],write:['writes','wrote','written'],
};

const IRREGULAR_PLURALS = {
    man:'men',woman:'women',child:'children',tooth:'teeth',foot:'feet',
    mouse:'mice',goose:'geese',ox:'oxen',person:'people',leaf:'leaves',
    knife:'knives',wife:'wives',life:'lives',wolf:'wolves',half:'halves',
    shelf:'shelves',loaf:'loaves',thief:'thieves',calf:'calves',
    analysis:'analyses',basis:'bases',crisis:'crises',thesis:'theses',
    phenomenon:'phenomena',criterion:'criteria',datum:'data',
    medium:'media',curriculum:'curricula',alumnus:'alumni',
    cactus:'cacti',focus:'foci',fungus:'fungi',nucleus:'nuclei',
    syllabus:'syllabi',appendix:'appendices',index:'indices',
    matrix:'matrices',vertex:'vertices',axis:'axes',
};

// ── Geração de formas locais ──────────────────────────────────────────────────

function getVerbForms(word) {
    const w = word.toLowerCase();
    if (IRREGULAR_VERBS[w]) {
        const [s3, past, pp] = IRREGULAR_VERBS[w];
        return {
            base: w,
            thirdPerson: s3,
            pastSimple: past,
            pastParticiple: pp,
            presentParticiple: getGerund(w),
            isIrregular: true
        };
    }
    return {
        base: w,
        thirdPerson: getThirdPerson(w),
        pastSimple: getPast(w),
        pastParticiple: getPast(w),
        presentParticiple: getGerund(w),
        isIrregular: false
    };
}

function getThirdPerson(w) {
    if (/(?:s|sh|ch|x|z)$/.test(w)) return w + 'es';
    if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies';
    return w + 's';
}

function getPast(w) {
    if (/e$/.test(w)) return w + 'd';
    if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ied';
    if (/[^aeiouwhy][aeiou][^aeioudwxy]$/.test(w)) return w + w.slice(-1) + 'ed';
    return w + 'ed';
}

function getGerund(w) {
    if (/ie$/.test(w)) return w.slice(0, -2) + 'ying';
    if (/[^aeiou]e$/.test(w)) return w.slice(0, -1) + 'ing';
    if (/[^aeiouwhy][aeiou][^aeioudwxy]$/.test(w)) return w + w.slice(-1) + 'ing';
    return w + 'ing';
}

function getNounForms(word) {
    const w = word.toLowerCase();
    if (IRREGULAR_PLURALS[w]) return { singular: w, plural: IRREGULAR_PLURALS[w], isIrregular: true };
    let plural;
    if (/(?:s|sh|ch|x|z)$/.test(w)) plural = w + 'es';
    else if (/[^aeiou]y$/.test(w)) plural = w.slice(0, -1) + 'ies';
    else if (/(?:f|fe)$/.test(w)) plural = w.replace(/f(e)?$/, 'ves');
    else if (/o$/.test(w)) plural = w + 'es';
    else plural = w + 's';
    return { singular: w, plural, isIrregular: false };
}

function getAdjectiveForms(word) {
    const w = word.toLowerCase();
    const short = w.length <= 6;
    if (short) {
        let comp, sup;
        if (/e$/.test(w)) { comp = w + 'r'; sup = w + 'st'; }
        else if (/[^aeiou]y$/.test(w)) { comp = w.slice(0,-1)+'ier'; sup = w.slice(0,-1)+'iest'; }
        else if (/[^aeiouwhy][aeiou][^aeioudwxy]$/.test(w)) { comp = w+w.slice(-1)+'er'; sup = w+w.slice(-1)+'est'; }
        else { comp = w+'er'; sup = w+'est'; }
        return { base: w, comparative: comp, superlative: sup, usesMore: false };
    }
    return { base: w, comparative: `more ${w}`, superlative: `most ${w}`, usesMore: true };
}

const POS_LESSONS = {
    verb: {
        teacher: 'Pense neste verbo como a acao da frase. Em ingles, o ponto mais importante e escolher a forma certa para o tempo: presente, passado, particípio ou gerundio.',
        pattern: 'Sujeito + verbo + complemento.',
        examples: word => [`I ${word} every day.`, `She ${getThirdPerson(word)} when she has time.`, `They are ${getGerund(word)} now.`],
        quickCheck: word => `Complete mentalmente: Yesterday, I ___ . A resposta costuma ser a forma de passado de "${word}".`
    },
    noun: {
        teacher: 'Use esta palavra como uma coisa, pessoa, lugar ou ideia. O que muda mais em substantivos e se ele esta no singular, plural ou se precisa de artigo.',
        pattern: 'a/an/the + substantivo ou substantivo plural.',
        examples: word => [`This ${word} is important.`, `I saw a ${word}.`, `These are ${getNounForms(word).plural}.`],
        quickCheck: word => `Pergunte: posso contar um, dois, tres "${word}"? Se sim, pense no plural.`
    },
    adjective: {
        teacher: 'Adjetivos descrevem um substantivo. Em ingles, eles normalmente ficam antes da coisa que descrevem.',
        pattern: 'adjetivo + substantivo.',
        examples: word => [`It is a ${word} idea.`, `This feels ${word}.`, `The room is ${word}.`],
        quickCheck: word => `Teste rapido: coloque "${word}" antes de um substantivo, como "${word} movie".`
    },
    adverb: {
        teacher: 'Adverbios explicam como, quando, onde ou com que intensidade algo acontece. Eles costumam modificar um verbo ou uma frase inteira.',
        pattern: 'verbo + adverbio, ou adverbio + frase.',
        examples: word => [`She answered ${word}.`, `It happened ${word}.`, `He speaks very ${word}.`],
        quickCheck: word => `Pergunte: esta palavra responde "como?" ou "quando?". Se sim, provavelmente funciona como adverbio.`
    },
    preposition: {
        teacher: 'Preposicoes conectam ideias: lugar, tempo, direcao, causa ou relacao. Elas sao pequenas, mas mudam o sentido da frase.',
        pattern: 'preposicao + noun phrase.',
        examples: word => [`I am ${word} the room.`, `We talked ${word} the meeting.`, `She looked ${word} the window.`],
        quickCheck: word => `Veja a palavra que vem depois: preposicoes quase sempre puxam um complemento.`
    }
};

function buildTeacherLesson(word, pos, forms) {
    const lesson = POS_LESSONS[pos] || {
        teacher: 'Observe o papel desta palavra dentro da frase. O significado vem do contexto: veja o que aparece antes e depois dela.',
        pattern: 'palavra + contexto ao redor.',
        examples: w => [`I noticed "${w}" in the sentence.`, `The meaning changes with context.`],
        quickCheck: w => `Leia a frase sem traduzir primeiro e tente descobrir a funcao de "${w}".`
    };

    const examples = lesson.examples(word, forms).slice(0, 3);
    return {
        teacher: lesson.teacher,
        pattern: lesson.pattern,
        examples,
        quickCheck: lesson.quickCheck(word, forms)
    };
}

// ── Datamuse API — collocations e palavras relacionadas ───────────────────────

async function fetchCollocations(word) {
    try {
        // Palavras que frequentemente aparecem ANTES da palavra
        const [before, after, similar] = await Promise.all([
            fetch(`https://api.datamuse.com/words?rel_bgb=${encodeURIComponent(word)}&max=8`).then(r => r.json()),
            fetch(`https://api.datamuse.com/words?rel_bga=${encodeURIComponent(word)}&max=8`).then(r => r.json()),
            fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(word)}&max=6`).then(r => r.json()),
        ]);
        return {
            before: (before || []).map(w => w.word).filter(Boolean),
            after:  (after  || []).map(w => w.word).filter(Boolean),
            similar:(similar|| []).map(w => w.word).filter(Boolean),
        };
    } catch {
        return { before: [], after: [], similar: [] };
    }
}

// ── Wiktionary — etimologia ───────────────────────────────────────────────────

async function fetchEtymology(word) {
    try {
        const res = await fetch(
            `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
            { headers: { 'Accept': 'application/json' } }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const entries = data?.en || [];
        for (const entry of entries) {
            for (const def of (entry.definitions || [])) {
                if (def.definition?.toLowerCase().includes('from ') ||
                    def.definition?.toLowerCase().includes('origin')) {
                    // Limpa HTML
                    return def.definition.replace(/<[^>]+>/g, '').trim().slice(0, 200);
                }
            }
        }
        return null;
    } catch {
        return null;
    }
}

// ── Função principal ──────────────────────────────────────────────────────────

/**
 * Gera análise gramatical completa para uma palavra.
 * @param {string} word
 * @param {string} pos  — part of speech (noun, verb, adjective, adverb, ...)
 * @param {object} dictData — dados já disponíveis do Free Dictionary API
 * @returns {Promise<object>}
 */
export async function analyzeGrammar(word, pos, dictData = {}) {
    const w = word.toLowerCase();
    const posLower = (pos || '').toLowerCase();

    // Busca collocations e etimologia em paralelo
    const [collocations, etymology] = await Promise.all([
        fetchCollocations(w),
        fetchEtymology(w),
    ]);

    const result = {
        word: w,
        pos: posLower,
        forms: null,
        lesson: null,
        collocations,
        etymology,
        tips: [],
        commonMistakes: [],
        usageNotes: [],
    };

    // ── Formas da palavra ──────────────────────────────────────────────────────
    if (posLower === 'verb') {
        result.forms = getVerbForms(w);
        result.tips = [
            `Presente simples, 3a pessoa: ${result.forms.thirdPerson}`,
            `Passado simples: ${result.forms.pastSimple}`,
            `Participio passado: ${result.forms.pastParticiple}`,
            `Gerundio / presente continuo: ${result.forms.presentParticiple}`,
        ];
        if (result.forms.isIrregular) {
            result.usageNotes.push('Verbo irregular: as formas nao seguem a regra de adicionar -ed.');
        }
        result.commonMistakes = getVerbMistakes(w, result.forms);

    } else if (posLower === 'noun') {
        result.forms = getNounForms(w);
        result.tips = [
            `Singular: ${result.forms.singular}`,
            `Plural: ${result.forms.plural}`,
        ];
        if (result.forms.isIrregular) {
            result.usageNotes.push('Plural irregular: nao segue a regra padrao de adicionar -s.');
        }
        result.commonMistakes = getNounMistakes(w, result.forms);

    } else if (posLower === 'adjective') {
        result.forms = getAdjectiveForms(w);
        result.tips = [
            `Base: ${result.forms.base}`,
            `Comparativo: ${result.forms.comparative}`,
            `Superlativo: ${result.forms.superlative}`,
        ];
        result.commonMistakes = getAdjectiveMistakes(w, result.forms);

    } else if (posLower === 'adverb') {
        result.tips = [
            'Advérbios modificam verbos, adjetivos ou outros advérbios.',
            w.endsWith('ly')
                ? `Formado a partir do adjetivo: ${w.slice(0,-2)}`
                : 'Advérbio de forma irregular (não termina em -ly).',
        ];
    }

    result.lesson = buildTeacherLesson(w, posLower, result.forms);

    // ── Dicas de uso baseadas em collocations ──────────────────────────────────
    if (collocations.before.length > 0) {
        result.usageNotes.push(
            `Palavras que frequentemente vêm antes: ${collocations.before.slice(0,5).join(', ')}`
        );
    }
    if (collocations.after.length > 0) {
        result.usageNotes.push(
            `Palavras que frequentemente vêm depois: ${collocations.after.slice(0,5).join(', ')}`
        );
    }

    return result;
}

// ── Erros comuns ──────────────────────────────────────────────────────────────

function getVerbMistakes(w, forms) {
    const mistakes = [];
    if (forms.isIrregular) {
        mistakes.push(`"${w}ed" nao existe. Use "${forms.pastSimple}" no passado.`);
    }
    if (['go','come','run','become'].includes(w)) {
        mistakes.push(`Nao use "have ${w}". Use "have ${forms.pastParticiple}".`);
    }
    return mistakes;
}

function getNounMistakes(w, forms) {
    const mistakes = [];
    if (forms.isIrregular) {
        mistakes.push(`"${w}s" nao e o plural correto. Use "${forms.plural}".`);
    }
    const uncountable = ['information','advice','furniture','luggage','equipment','news','money','water','rice','bread'];
    if (uncountable.includes(w)) {
        mistakes.push(`"${w}" e incontavel. Nao use no plural nem com "a/an".`);
    }
    return mistakes;
}

function getAdjectiveMistakes(w, forms) {
    const mistakes = [];
    if (forms.usesMore) {
        mistakes.push(`Nao use "${w}er". Use "${forms.comparative}".`);
        mistakes.push(`Nao use "${w}est". Use "${forms.superlative}".`);
    }
    return mistakes;
}
