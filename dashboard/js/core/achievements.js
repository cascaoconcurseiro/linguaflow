// Onda 8 (Gerente + Eng. SRS): sistema de conquistas — celebra marcos que já
// existem nos dados (streak, palavras salvas, palavras maduras, histórias),
// sem tabela nova nem coluna nova. "Vistos" (pra não repetir a celebração)
// fica em `settings` (chave lf_achievements_seen, JSON de ids) — o k/v
// genérico que já existe, não precisou de migration.
//
// A auditoria de UX apontou que o app tem os NÚMEROS (estatísticas) mas não
// tem o RITUAL de comemorar marcos — número é informação, badge é
// celebração. Isso é puro no propósito: computeAchievements() é uma função
// pura sobre dados já calculados em outro lugar, testável sem rede.

export const ACHIEVEMENTS = [
  { id: 'streak_7', icon: '🔥', label: 'Ofensiva de 7 dias', check: (d) => d.streak >= 7 },
  { id: 'streak_30', icon: '🔥', label: 'Ofensiva de 30 dias', check: (d) => d.streak >= 30 },
  { id: 'streak_100', icon: '🔥', label: 'Ofensiva de 100 dias', check: (d) => d.streak >= 100 },
  { id: 'words_50', icon: '📚', label: '50 palavras salvas', check: (d) => d.wordsCount >= 50 },
  { id: 'words_100', icon: '📚', label: '100 palavras salvas', check: (d) => d.wordsCount >= 100 },
  { id: 'words_500', icon: '📚', label: '500 palavras salvas', check: (d) => d.wordsCount >= 500 },
  { id: 'mature_25', icon: '⭐', label: '25 palavras maduras', check: (d) => d.matureCount >= 25 },
  { id: 'mature_100', icon: '⭐', label: '100 palavras maduras', check: (d) => d.matureCount >= 100 },
  { id: 'mature_300', icon: '👑', label: '300 palavras maduras', check: (d) => d.matureCount >= 300 },
  { id: 'stories_1', icon: '📖', label: 'Primeira história', check: (d) => d.storiesCount >= 1 },
  { id: 'stories_10', icon: '📖', label: '10 histórias', check: (d) => d.storiesCount >= 10 },
  { id: 'stories_30', icon: '📖', label: '30 histórias', check: (d) => d.storiesCount >= 30 },
];

// data: { streak, wordsCount, matureCount, storiesCount }
export function computeAchievements(data) {
  const safe = data || {};
  return ACHIEVEMENTS.map(a => ({
    id: a.id,
    icon: a.icon,
    label: a.label,
    unlocked: !!a.check(safe),
  }));
}

// current: saída de computeAchievements(); seenIds: array de ids já celebrados
export function newlyUnlocked(current, seenIds) {
  const seen = new Set(seenIds || []);
  return (current || []).filter(a => a.unlocked && !seen.has(a.id));
}
