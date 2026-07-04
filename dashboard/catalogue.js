/**
 * LinguaFlow Catalogue — Conteúdo YouTube por nível CEFR
 * Lista curada de canais e vídeos para cada nível de proficiência.
 */

export const CATALOGUE = {
  A1: {
    label: 'Iniciante (A1)',
    description: 'Inglês lento, vocabulário básico, legendas sempre disponíveis.',
    channels: [
      {
        title: 'English with Lucy',
        url: 'https://www.youtube.com/@EnglishwithLucy',
        desc: 'Gramática e vocabulário britânico. Fala clara e pausada.',
      },
      {
        title: 'Learn English with Jessica',
        url: 'https://www.youtube.com/@LearnEnglishwithJessica',
        desc: 'Diálogos do cotidiano em inglês lento.',
      },
      {
        title: 'Easy English',
        url: 'https://www.youtube.com/@easyenglish551',
        desc: 'Conversas reais com legendas grandes.',
      },
      {
        title: 'BBC Learning English',
        url: 'https://www.youtube.com/@bbclearningenglish',
        desc: 'Inglês britânico padrão. Notícias simplificadas.',
      },
      {
        title: 'Speak English With Vanessa',
        url: 'https://www.youtube.com/@SpeakEnglishWithVanessa',
        desc: 'Dicas para conversação. Ritmo natural.',
      },
    ],
    videos: [
      {
        title: 'Easy English Conversation: 11 Common Questions',
        url: 'https://www.youtube.com/watch?v=9V_3H4qR5mQ',
        desc: 'Perguntas e respostas básicas do dia a dia.',
      },
      {
        title: 'My Day | Improve your English',
        url: 'https://www.youtube.com/watch?v=8uJY7MQyH5I',
        desc: 'Rotina diária narrada em inglês simples.',
      },
    ],
  },
  A2: {
    label: 'Básico (A2)',
    description: 'Inglês cotidiano, frases mais longas, ritmo moderado.',
    channels: [
      {
        title: "Rachel's English",
        url: 'https://www.youtube.com/@rachelsenglish',
        desc: 'Pronúncia americana. Análise detalhada de sons.',
      },
      {
        title: 'mmmEnglish',
        url: 'https://www.youtube.com/@mmmEnglish_Emma',
        desc: 'Inglês australiano. Aulas temáticas envolventes.',
      },
      {
        title: 'English with Greg',
        url: 'https://www.youtube.com/@EnglishWithGreg',
        desc: 'Gramática britânica explicada de forma visual.',
      },
      {
        title: 'Learn English with TV Series',
        url: 'https://www.youtube.com/@LearnEnglishWithTVSeries',
        desc: 'Aprenda com cenas de séries famosas.',
      },
    ],
    videos: [
      {
        title: 'The 5 Most Common Small Talk Questions',
        url: 'https://www.youtube.com/watch?v=khmD0o1PkOE',
        desc: 'Conversa casual em inglês com exemplos reais.',
      },
    ],
  },
  B1: {
    label: 'Intermediário (B1)',
    description: 'Inglês natural, ritmo normal, assuntos variados.',
    channels: [
      {
        title: 'Vox',
        url: 'https://www.youtube.com/@Vox',
        desc: 'Jornalismo visual. Legendas em inglês disponíveis.',
      },
      {
        title: 'Kurzgesagt – In a Nutshell',
        url: 'https://www.youtube.com/@kurzgesagt',
        desc: 'Ciência explicada com animações. Narração clara.',
      },
      {
        title: 'TED-Ed',
        url: 'https://www.youtube.com/@TEDEd',
        desc: 'Lições animadas sobre qualquer assunto.',
      },
      {
        title: 'Johnny Harris',
        url: 'https://www.youtube.com/@johnnyharris',
        desc: 'Jornalismo narrativo. Inglês americano natural.',
      },
      {
        title: 'Thomas Frank',
        url: 'https://www.youtube.com/@Thomasfrank',
        desc: 'Produtividade e aprendizado. Inglês americano.',
      },
    ],
    videos: [
      {
        title: 'Why you have an accent in a foreign language',
        url: 'https://www.youtube.com/watch?v=4fYoBjKAW9o',
        desc: 'Explicação científica sobre sotaques.',
      },
    ],
  },
  B2: {
    label: 'Intermediário Superior (B2)',
    description: 'Inglês fluente, debates, conteúdo nativo sem simplificações.',
    channels: [
      {
        title: 'Veritasium',
        url: 'https://www.youtube.com/@veritasium',
        desc: 'Ciência e engenharia. Inglês australiano/americano.',
      },
      {
        title: 'Wendover Productions',
        url: 'https://www.youtube.com/@Wendoverproductions',
        desc: 'Logística e geopolítica explicadas.',
      },
      {
        title: 'NPR Music Tiny Desk',
        url: 'https://www.youtube.com/@nprmusic',
        desc: 'Entrevistas e música ao vivo. Inglês real.',
      },
      {
        title: 'Nerdwriter1',
        url: 'https://www.youtube.com/@Nerdwriter1',
        desc: 'Ensaios em vídeo sobre arte e cultura.',
      },
    ],
    videos: [
      {
        title: 'The Longest Solar Eclipse Ever',
        url: 'https://www.youtube.com/watch?v=3HOhLi2jYPI',
        desc: 'Ciência narrada em ritmo natural.',
      },
    ],
  },
  C1: {
    label: 'Avançado (C1)',
    description: 'Inglês rápido, vocabulário sofisticado, conteúdo acadêmico.',
    channels: [
      {
        title: 'Lex Fridman Podcast',
        url: 'https://www.youtube.com/@lexfridman',
        desc: 'Entrevistas longas com cientistas e filósofos.',
      },
      {
        title: 'The Economist',
        url: 'https://www.youtube.com/@TheEconomist',
        desc: 'Análise geopolítica. Inglês britânico formal.',
      },
      {
        title: 'ContraPoints',
        url: 'https://www.youtube.com/@ContraPoints',
        desc: 'Ensaios filosóficos com humor ácido.',
      },
      {
        title: 'Philosophy Tube',
        url: 'https://www.youtube.com/@PhilosophyTube',
        desc: 'Filosofia contemporânea. Inglês britânico teatral.',
      },
    ],
    videos: [],
  },
  C2: {
    label: 'Fluente (C2)',
    description: 'Inglês nativo sem concessões. Comédia, sátira, poesia.',
    channels: [
      {
        title: 'Last Week Tonight (John Oliver)',
        url: 'https://www.youtube.com/@LastWeekTonight',
        desc: 'Sátira política americana. Ritmo acelerado.',
      },
      {
        title: 'Kurzgesagt (sem legendas)',
        url: 'https://www.youtube.com/@kurzgesagt',
        desc: 'Mesmo canal, mas tente assistir sem legendas.',
      },
      {
        title: 'Any Shakespeare Performance',
        url: 'https://www.youtube.com/results?search_query=shakespeare+full+play',
        desc: 'Teatro clássico. Inglês elizabetano.',
      },
    ],
    videos: [],
  },
};
