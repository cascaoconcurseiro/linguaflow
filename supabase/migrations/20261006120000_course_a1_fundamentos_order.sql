-- #514: ordem de entrada do A1 Fundamentos. Só track_order; nenhum dado de conteúdo muda.
-- Primeiras Frases -> Números/Horas/Datas (curto, ganho rápido) -> Verbos -> 1000 Palavras (44 caps).
-- Rollback: Primeiras Frases 1, 1000 Palavras 2, Verbos 3, Números 4 (ordem anterior).
UPDATE public.course_catalog SET track_order = 1 WHERE id = 'course-first-sentences-a1' AND track = 'fundamentos';
UPDATE public.course_catalog SET track_order = 2 WHERE id = 'course-numbers-a1' AND track = 'fundamentos';
UPDATE public.course_catalog SET track_order = 3 WHERE id = 'course-essential-verbs-a1' AND track = 'fundamentos';
UPDATE public.course_catalog SET track_order = 4 WHERE id = 'course-1000-words-a1' AND track = 'fundamentos';
