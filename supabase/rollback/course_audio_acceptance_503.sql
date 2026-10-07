-- Reverte somente a inclusão aprovada do áudio #503/#505; mantém aulas, níveis e progresso.
-- Executar em transação antes da reversão curricular #528, caso ambas sejam necessárias.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
UPDATE public.course_catalog SET is_core=false
WHERE id IN ('course-spoken-reductions-a2','course-connected-speech-b2');
UPDATE public.course_lessons SET is_core=false
WHERE id IN (
  'lesson-spoken-reductions-a2-01',
  'lesson-connected-b2-01','lesson-connected-b2-02','lesson-connected-b2-03','lesson-connected-b2-04',
  'lesson-connected-b2-05','lesson-connected-b2-06','lesson-connected-b2-07','lesson-connected-b2-08'
);
