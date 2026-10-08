// Ordem única de estudo das aulas de um curso: a da trilha (nível, depois curriculum_order), nunca o número
// de capítulo antigo. Cursos mistos (ex.: 1000 palavras, A1 a B1) ficam na sequência certa em toda a interface.
const LEVEL_RANK = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
const rank = (lesson, fallback) => LEVEL_RANK[lesson.level || fallback] ?? 99;

export function compareTrailOrder(a, b, courseLevel = '') {
  const levelDiff = rank(a, courseLevel) - rank(b, courseLevel);
  if (levelDiff) return levelDiff;
  const hasA = a.curriculum_order != null;
  const hasB = b.curriculum_order != null;
  if (hasA && hasB && a.curriculum_order !== b.curriculum_order) return a.curriculum_order - b.curriculum_order;
  if (hasA !== hasB) return hasA ? -1 : 1;
  return (a.chapter_number ?? 0) - (b.chapter_number ?? 0);
}

// Devolve as aulas na ordem da trilha com `chapter_number` renumerado (posição de estudo) e o número
// original preservado em `source_chapter_number`.
export function sortLessonsByTrail(lessons, courseLevel = '') {
  return [...(lessons || [])]
    .sort((a, b) => compareTrailOrder(a, b, courseLevel))
    .map((lesson, index) => ({ ...lesson, source_chapter_number: lesson.chapter_number, chapter_number: index + 1 }));
}
