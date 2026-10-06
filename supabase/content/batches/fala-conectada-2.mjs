// Revisão editorial da continuação #523: preserva IDs, capítulos e migration do lote 1.
import { COURSES as BASE, LEXICON as ORIGINAL_LEXICON } from './fala-conectada-1.mjs';

export const LEXICON = {
  ...ORIGINAL_LEXICON,
  dontcha: ['verb', '/ˈdoʊntʃə/', 'você não (don\'t you)'],
  locked: ['verb', '/lɑːkt/', 'trancou, tranquei'],
  down: ['particle', '/daʊn/', 'partícula: broke down = quebrou; sit down = sentar'],
  left: ['verb', '/lɛft/', 'saiu, saído'],
  report: ['noun', '/rɪˈpɔːrt/', 'relatório'],
  wait: ['verb', '/weɪt/', 'esperar'],
  check: ['verb', '/tʃɛk/', 'verificar; check out = dar uma olhada'],
  cold: ['adjective', '/koʊld/', 'frio'],
  turn: ['verb', '/tɜːrn/', 'girar; turn off = desligar'],
  look: ['verb', '/lʊk/', 'olhar'],
  warm: ['adjective', '/wɔːrm/', 'quente'],
  help: ['verb', '/hɛlp/', 'ajudar'],
  second: ['noun', '/ˈsɛkənd/', 'segundo (unidade de tempo)'],
  so: ['adverb', '/soʊ/', 'tão; então (conjunção); told you so = eu te avisei'],
  time: ['noun', '/taɪm/', 'tempo'],
  much: ['adverb', '/mʌtʃ/', 'muito'],
  leave: ['verb', '/liːv/', 'sair'],
  before: ['conjunction', '/bɪˈfɔːr/', 'antes de'],
  "i'd": ['auxiliary verb', '/aɪd/', 'eu tinha (I had, em I\'d known)'],
};

const corrections = {
  'Whoever did this shoulda known better.': {
    pt: 'Quem fez isso devia ter tido mais juízo.',
    note: '"Shoulda known better" = should have known better: devia ter percebido que aquilo era uma má ideia.',
  },
  'Do you wanna grab lunch?': { pt: 'Quer almoçar?' },
  "Dontcha think it's too late?": {
    note: '"Dontcha" = don\'t you; forma completa: "Do you not think it is too late?". Pode pedir confirmação ou expressar preocupação.',
  },
  'Pick it up and put it on the table.': {
    note: 'Em "pick it up", o /k/ final de "pick" se liga ao /ɪ/ de "it", e o /t/ de "it" se liga ao /ʌ/ de "up". No inglês americano, esse /t/ pode soar como [ɾ].',
  },
  'Turn it off before you leave.': {
    note: 'Em "turn it off", o /n/ de "turn" se liga ao /ɪ/ de "it", e o /t/ de "it" à vogal inicial de "off".',
  },
  'Can I have an apple?': {
    note: 'Em "have an apple", o /v/ de "have" se liga à vogal de "an", e o /n/ de "an" ao /æ/ de "apple".',
  },
  "Check it out, it's really good.": {
    note: 'Em "check it out", o /k/ de "check" se liga ao /ɪ/ de "it", e o /t/ de "it" ao /aʊ/ de "out".',
  },
  'Not at all.': {
    note: 'Os sons /t/ de "not" e "at" se ligam às vogais seguintes em "not at all". No inglês americano, podem soar como [ɾ].',
  },
  'What a nice idea.': {
    note: 'Em "what a", o /t/ final se liga à vogal fraca /ə/ do artigo. No inglês americano, esse /t/ pode soar como [ɾ].',
  },
  'Look at it carefully.': {
    note: 'Em "look at it", o /k/ de "look" se liga à vogal de "at", e o /t/ de "at" ao /ɪ/ de "it".',
  },
  'Wake up early tomorrow.': {
    note: 'Em "wake up", o /k/ final de "wake" se liga ao /ʌ/ de "up", sem uma pausa entre as palavras.',
  },
  'Put on a warm jacket.': {
    note: 'Em "put on a", o /t/ de "put" se liga à vogal de "on", e o /n/ de "on" ao /ə/ do artigo.',
  },
  'Can ya help me with this?': {
    note: '"Ya" é a forma fraca /jə/ de "you". Sem ênfase, "can" pode soar como /kən/: "can ya" /kən jə/.',
  },
  "It's kinda funny how you shoulda known.": {
    pt: 'É meio engraçado pensar que você devia ter sabido.',
    note: 'Kinda = kind of; shoulda known = should have known, sobre algo que a pessoa devia ter sabido antes.',
  },
};

export const COURSES = BASE.map((course) => ({
  ...course,
  lessons: course.lessons.map((lesson) => ({
    ...lesson,
    units: lesson.units.map((unit) => ({ ...unit, ...corrections[unit.text] })),
  })),
}));
