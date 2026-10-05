// Lote reducoes-1: Inglês Falado: Reduções (A2), capítulo piloto. Reduções que o
// capítulo 6 do curso "Inglês das Ruas" ainda não cobre (c'mon, gotcha, shoulda,
// coulda, outta, whaddya, tryna, ain't, lotta e "you gonna…?"). Cada nota diz a
// forma completa, o registro e a armadilha. O áudio é sintetizado a partir do
// texto escrito: o piloto existe para o dono escutar antes de o curso crescer.
// Conteúdo original.

export const LEXICON = {
  "c'mon": ['verb', '/kəˈmɑːn/', 'vamos, anda (come on)'],
  gotcha: ['verb', '/ˈɡɑːtʃə/', 'entendi, pode deixar (got you)'],
  shoulda: ['verb', '/ˈʃʊdə/', 'devia ter (should have)'],
  coulda: ['verb', '/ˈkʊdə/', 'podia ter (could have)'],
  outta: ['preposition', '/ˈaʊtə/', 'sem, fora de (out of)'],
  whaddya: ['pronoun', '/ˈwʌdjə/', 'o que você (what do you)'],
  tryna: ['verb', '/ˈtraɪnə/', 'tentando (trying to)'],
  "ain't": ['verb', '/eɪnt/', 'não é, não está (isn’t, aren’t)'],
  lotta: ['noun', '/ˈlɑːtə/', 'um monte de (a lot of)'],
  // O léxico geral tem uma entrada por palavra, sem olhar o contexto. Aqui valem só para este lote
  // (os lotes já publicados não mudam): "call" é verbo, "right" é "certo", "wait" é verbo e "got" é "tenho".
  call: ['verb', '/kɔːl/', 'ligar, chamar'],
  right: ['adjective', '/raɪt/', 'certo, correto'],
  wait: ['verb', '/weɪt/', 'esperar'],
  got: ['verb', '/ɡɑːt/', 'tenho (I got = I have)'],
};

const s = (text, pt, note, groups) => ({ kind: 'sentence', text, pt, note, groups });

export const COURSES = [
  {
    id: 'course-spoken-reductions-a2',
    slug: 'spoken-reductions-a2',
    title: 'Inglês Falado: Reduções',
    level: 'A2',
    category: 'street-slang',
    track: 'fluencia',
    trackOrder: 4,
    order: 19,
    isCore: false,
    short: 'Piloto: as reduções que as séries usam o tempo todo e quase ninguém ensina (c\'mon, gotcha, shoulda, outta).',
    long: 'Curso piloto sobre a fala real: formas encurtadas como "c\'mon", "gotcha", "shoulda", "outta" e "tryna". Cada frase mostra a forma completa, o registro (informal ou gíria) e a armadilha. Você ouve, digita palavra por palavra e vê tradução, IPA e explicação. É um piloto de um capítulo: a continuação depende do áudio e do seu uso.',
    lessons: [
      {
        id: 'lesson-spoken-reductions-a2-01',
        chapter: 1,
        title: 'Reduções além do gonna',
        description: 'Gotcha, c\'mon, shoulda, outta e outras formas que você ouve em séries.',
        units: [
          s("C'mon, we're gonna miss the bus.", 'Anda, a gente vai perder o ônibus.',
            'Informal. "C\'mon" = "come on": anda, vamos (com pressa ou incentivo). Aparece muito antes de uma ordem.',
            [["C'mon,", 'discourse_marker'], ["we're", 'subject'], ['gonna miss', 'predicate_verb'], ['the bus.', 'direct_object']]),
          s("Gotcha, I'll call you later.", 'Entendi, ligo para você mais tarde.',
            'Informal. "Gotcha" = "got you": entendi, pode deixar. Não confunda com "gotcha" como "pegadinha".',
            [['Gotcha,', 'discourse_marker'], ["I'll", 'subject'], ['call you', 'predicate_verb'], ['later.', 'adverbial']]),
          s('I shoulda called you.', 'Eu devia ter ligado para você.',
            'Informal. "Shoulda" = "should have" (devia ter). Na escrita use "should have"; nunca "should of".',
            [['I', 'subject'], ['shoulda called', 'predicate_verb'], ['you.', 'direct_object']]),
          s('You coulda told me!', 'Você podia ter me contado!',
            'Informal. "Coulda" = "could have" (podia ter). Costuma soar como reclamação, não como pedido.',
            [['You', 'subject'], ['coulda told', 'predicate_verb'], ['me!', 'direct_object']]),
          s("We're outta milk.", 'Acabou o leite.',
            'Informal. "Outta" = "out of". "Outta milk" = sem leite. Também em "Get outta here!" (Sai daqui! / Não acredito!).',
            [["We're", 'subject'], ['outta', 'predicate_verb'], ['milk.', 'direct_object']]),
          s('Whaddya want for dinner?', 'O que você quer para o jantar?',
            'Informal. "Whaddya" = "what do you". Na fala o "do" some e o som junta "what" com "you".',
            [['Whaddya', 'subject'], ['want', 'predicate_verb'], ['for dinner?', 'adverbial']]),
          s("I'm tryna sleep.", 'Estou tentando dormir.',
            'Gíria. "Tryna" = "trying to". Comum na fala jovem e em mensagens; evite em texto formal.',
            [["I'm", 'subject'], ['tryna sleep.', 'predicate_verb']]),
          s("That ain't right.", 'Isso não está certo.',
            'Informal. "Ain\'t" substitui "isn\'t", "aren\'t" ou "am not". Muito usado na fala; evite na escrita formal.',
            [['That', 'subject'], ["ain't", 'predicate_verb'], ['right.', 'predicate_adj']]),
          s('I got a lotta work today.', 'Tenho um monte de trabalho hoje.',
            'Informal. "Lotta" = "lot of". "A lotta work" = muito trabalho. Na escrita, "a lot of".',
            [['I', 'subject'], ['got', 'predicate_verb'], ['a lotta work', 'direct_object'], ['today.', 'adverbial']]),
          s('Wait, you gonna eat that?', 'Espera, você vai comer isso?',
            'Informal. Na fala o "are" some: "You gonna…?" = "Are you going to…?". Só funciona em pergunta direta e informal.',
            [['Wait,', 'discourse_marker'], ['you', 'subject'], ['gonna eat', 'predicate_verb'], ['that?', 'direct_object']]),
        ],
      },
    ],
  },
];
