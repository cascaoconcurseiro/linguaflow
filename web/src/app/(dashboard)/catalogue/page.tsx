'use client';

const CATALOGUE: Record<string, any> = {
  A1: {
    label: 'Iniciante',
    desc: 'Inglês lento, vocabulário básico.',
    channels: [
      {
        title: 'English with Lucy',
        url: 'https://www.youtube.com/@EnglishwithLucy',
        desc: 'Gramática britânica clara e pausada.',
      },
      {
        title: 'BBC Learning English',
        url: 'https://www.youtube.com/@bbclearningenglish',
        desc: 'Inglês padrão. Notícias simplificadas.',
      },
      {
        title: 'Easy English',
        url: 'https://www.youtube.com/@easyenglish551',
        desc: 'Conversas reais com legendas.',
      },
    ],
  },
  A2: {
    label: 'Básico',
    desc: 'Inglês cotidiano, ritmo moderado.',
    channels: [
      {
        title: "Rachel's English",
        url: 'https://www.youtube.com/@rachelsenglish',
        desc: 'Pronúncia americana detalhada.',
      },
      {
        title: 'mmmEnglish',
        url: 'https://www.youtube.com/@mmmEnglish_Emma',
        desc: 'Inglês australiano envolvente.',
      },
      {
        title: 'Learn English with TV Series',
        url: 'https://www.youtube.com/@LearnEnglishWithTVSeries',
        desc: 'Aprenda com cenas de séries.',
      },
    ],
  },
  B1: {
    label: 'Intermediário',
    desc: 'Inglês natural, assuntos variados.',
    channels: [
      {
        title: 'Vox',
        url: 'https://www.youtube.com/@Vox',
        desc: 'Jornalismo visual com legendas.',
      },
      {
        title: 'Kurzgesagt',
        url: 'https://www.youtube.com/@kurzgesagt',
        desc: 'Ciência com animações claras.',
      },
      {
        title: 'TED-Ed',
        url: 'https://www.youtube.com/@TEDEd',
        desc: 'Lições animadas sobre qualquer assunto.',
      },
      {
        title: 'Johnny Harris',
        url: 'https://www.youtube.com/@johnnyharris',
        desc: 'Jornalismo narrativo.',
      },
    ],
  },
  B2: {
    label: 'Intermediário Superior',
    desc: 'Inglês fluente, conteúdo nativo.',
    channels: [
      {
        title: 'Veritasium',
        url: 'https://www.youtube.com/@veritasium',
        desc: 'Ciência e engenharia.',
      },
      {
        title: 'Wendover Productions',
        url: 'https://www.youtube.com/@Wendoverproductions',
        desc: 'Logística e geopolítica.',
      },
      {
        title: 'Nerdwriter1',
        url: 'https://www.youtube.com/@Nerdwriter1',
        desc: 'Ensaios em vídeo sobre cultura.',
      },
    ],
  },
  C1: {
    label: 'Avançado',
    desc: 'Inglês rápido, vocabulário sofisticado.',
    channels: [
      {
        title: 'Lex Fridman Podcast',
        url: 'https://www.youtube.com/@lexfridman',
        desc: 'Entrevistas longas com intelectuais.',
      },
      {
        title: 'The Economist',
        url: 'https://www.youtube.com/@TheEconomist',
        desc: 'Análise geopolítica formal.',
      },
    ],
  },
  C2: {
    label: 'Fluente',
    desc: 'Inglês nativo sem concessões.',
    channels: [
      {
        title: 'Last Week Tonight',
        url: 'https://www.youtube.com/@LastWeekTonight',
        desc: 'Sátira política americana.',
      },
    ],
  },
};
const colors: Record<string, string> = {
  A1: '#22c55e',
  A2: '#06b6d4',
  B1: '#facc15',
  B2: '#fb923c',
  C1: '#f472b6',
  C2: '#c084fc',
};

export default function CataloguePage() {
  return (
    <div className="max-w-[900px] animate-fade-up">
      <h2 className="text-lg font-semibold text-[#fafafa] mb-1">🎬 Catálogo YouTube</h2>
      <p className="text-xs text-[#71717a] mb-6">
        Canais curados por nível. Abra qualquer vídeo com a extensão para ativar legendas duplas.
      </p>
      {Object.entries(CATALOGUE).map(([lv, data]) => (
        <div key={lv} className="mb-6 pl-4" style={{ borderLeft: `3px solid ${colors[lv]}` }}>
          <h3 className="text-base font-semibold text-[#fafafa] mb-1">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded mr-2 text-black"
              style={{ background: colors[lv] }}
            >
              {lv}
            </span>
            {data.label}
          </h3>
          <p className="text-xs text-[#71717a] mb-3">{data.desc}</p>
          <div className="space-y-2">
            {data.channels.map((ch: any, i: number) => (
              <a
                key={i}
                href={ch.url}
                target="_blank"
                rel="noopener"
                className="block card p-3 hover:border-[#3f3f46] transition-colors no-underline"
              >
                <div className="text-sm font-semibold text-[#fafafa]">📺 {ch.title}</div>
                <div className="text-xs text-[#a1a1aa]">{ch.desc}</div>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
