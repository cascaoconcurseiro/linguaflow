-- Rollback #551: remove só a coluna derivada; textos, anotações e progresso não são tocados.
ALTER TABLE public.course_units DROP COLUMN IF EXISTS example_annotations;
