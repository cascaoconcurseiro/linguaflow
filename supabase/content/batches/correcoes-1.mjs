// Lote correcoes-1: correções de conteúdo já publicado (Issue #435).
// Migrations publicadas são imutáveis; este lote reaproveita os ids das unidades (o ON CONFLICT … DO UPDATE
// atualiza o texto). O id da unidade vem da POSIÇÃO na lição, por isso as unidades anteriores são repetidas
// exatamente como foram publicadas em palavras-2 (o upsert delas não muda nada).
//
// Achado da amostra de revisão humana: a nota de "ninety" dizia "Mantém o 'e' de 'nine'", o oposto do correto
// (nine perde o 'e' em ninety).

const w = (text, pt, example, note = null) => ({ kind: 'word', text, pt, example, note });

export const COURSES = [
  {
    id: 'course-1000-words-a1',
    slug: '1000-essential-words',
    title: '1000 Palavras Essenciais',
    level: 'A1',
    category: 'grammar',
    track: 'fundamentos',
    trackOrder: 2,
    order: 11,
    short: 'As palavras mais usadas do inglês, por tema, com significado e frase de exemplo.',
    long: 'Vocabulário essencial organizado por temas do dia a dia. Você ouve, escreve a palavra e vê como ela aparece numa frase real.',
    lessons: [
      {
        id: 'lesson-1000-words-a1-05',
        chapter: 5,
        title: 'Números de 21 em diante',
        description: 'Dezenas, centenas, milhares e ordinais.',
        units: [
          w('twenty-one', 'vinte e um', ["She's twenty-one years old.", 'Ela tem vinte e um anos.'], 'De 21 a 99 as dezenas levam hífen: twenty-one, forty-five.'),
          w('thirty', 'trinta', ['The trip takes thirty minutes.', 'A viagem leva trinta minutos.'], 'Força no começo: THIR-ty. Em "thirteen" (13) a força vai no fim.'),
          w('forty', 'quarenta', ['I have forty emails.', 'Tenho quarenta e-mails.'], 'Sem "u": forty, embora seja "four".'),
          w('fifty', 'cinquenta', ['It costs fifty dollars.', 'Custa cinquenta dólares.']),
          w('sixty', 'sessenta', ['There are sixty minutes in an hour.', 'Uma hora tem sessenta minutos.']),
          w('seventy', 'setenta', ['My grandfather is seventy.', 'Meu avô tem setenta anos.']),
          w('eighty', 'oitenta', ['The bus holds eighty people.', 'O ônibus leva oitenta pessoas.'], 'Só um "t": eighty.'),
          w('ninety', 'noventa', ['I got ninety percent.', 'Tirei noventa por cento.'], 'Cuidado na grafia: "nine" perde o "e" em "ninety" (90). Não escreva "nineety".'),
        ],
      },
    ],
  },
];
