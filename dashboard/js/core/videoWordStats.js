// Palavras salvas a partir de vídeos (#399). O Cofre já agenda revisão para
// elas; aqui só medimos quantas vieram de vídeo e quantas já fixaram, para o
// aluno ver que o hábito de assistir vira memória.

export function videoWordStats(words, cards) {
  const fromVideo = (words || []).filter((w) => w && (w.video_url || w.video_title));
  const ids = new Set(fromVideo.map((w) => w.id));
  const stable = new Set();
  for (const c of cards || []) {
    if (ids.has(c.word_id) && (c.status === 'mature' || c.status === 'review')) stable.add(c.word_id);
  }
  return { total: fromVideo.length, stable: stable.size };
}
