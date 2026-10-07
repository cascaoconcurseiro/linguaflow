-- Gerado por scripts/generate-course-curriculum.mjs; fonte supabase/content/curriculum.mjs (#528).
-- Auditoria editorial em docs/product/CURRICULO_CEFR.md. IDs, conteúdo e histórico do aluno preservados.
-- Rollback: supabase/rollback/course_curriculum_528.sql. Sem novas permissões nem alterações de RLS.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$ BEGIN
  IF (SELECT count(*) FROM public.course_lessons) <> 372
    OR (SELECT count(*) FROM public.course_units) <> 4088
    OR (SELECT md5(string_agg(concat_ws(chr(31), id,kind,text,translation_pt,coalesce(explanation_note,''),coalesce(example_en,''),coalesce(example_pt,'')),chr(30) ORDER BY id COLLATE "C")) FROM public.course_units) <> 'd0002890d367706d6d43090022638f99'
  THEN RAISE EXCEPTION 'Conteúdo divergente da auditoria #528; não publicar sem reconciliar'; END IF;
END $$;

ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS level TEXT CHECK(level IN ('A1','A2','B1','B2','C1','C2')),
  ADD COLUMN IF NOT EXISTS curriculum_order INT CHECK(curriculum_order > 0),
  ADD COLUMN IF NOT EXISTS is_core BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prerequisite_lesson_ids TEXT[] NOT NULL DEFAULT '{}';

WITH reviewed(id,course_id,level,curriculum_order,is_core,requirements) AS (VALUES
  ('lesson-first-sentences-a1-01', 'course-first-sentences-a1', 'A1', 10, true, ARRAY[]::text[]),
  ('lesson-first-sentences-a1-02', 'course-first-sentences-a1', 'A1', 20, true, ARRAY[]::text[]),
  ('lesson-first-sentences-a1-03', 'course-first-sentences-a1', 'A1', 30, true, ARRAY[]::text[]),
  ('lesson-first-sentences-a1-04', 'course-first-sentences-a1', 'A1', 40, true, ARRAY[]::text[]),
  ('lesson-first-sentences-a1-05', 'course-first-sentences-a1', 'A1', 50, true, ARRAY[]::text[]),
  ('lesson-first-sentences-a1-06', 'course-first-sentences-a1', 'A1', 60, true, ARRAY[]::text[]),
  ('lesson-first-sentences-a1-07', 'course-first-sentences-a1', 'A1', 70, true, ARRAY[]::text[]),
  ('lesson-first-sentences-a1-08', 'course-first-sentences-a1', 'A1', 80, true, ARRAY[]::text[]),
  ('lesson-first-sentences-a1-09', 'course-first-sentences-a1', 'A1', 90, true, ARRAY[]::text[]),
  ('lesson-first-sentences-a1-10', 'course-first-sentences-a1', 'A1', 100, true, ARRAY[]::text[]),
  ('lesson-prepositions-b1-02', 'course-prepositions-b1', 'A1', 110, true, ARRAY[]::text[]),
  ('lesson-numbers-a1-02', 'course-numbers-a1', 'A1', 120, true, ARRAY[]::text[]),
  ('lesson-numbers-a1-03', 'course-numbers-a1', 'A1', 130, true, ARRAY[]::text[]),
  ('lesson-numbers-a1-04', 'course-numbers-a1', 'A1', 140, true, ARRAY[]::text[]),
  ('lesson-1000-words-a1-01', 'course-1000-words-a1', 'A1', 150, true, ARRAY[]::text[]),
  ('lesson-1000-words-a1-03', 'course-1000-words-a1', 'A1', 160, true, ARRAY[]::text[]),
  ('lesson-1000-words-a1-04', 'course-1000-words-a1', 'A1', 170, true, ARRAY[]::text[]),
  ('lesson-1000-words-a1-05', 'course-1000-words-a1', 'A1', 180, true, ARRAY[]::text[]),
  ('lesson-1000-words-a1-06', 'course-1000-words-a1', 'A1', 190, true, ARRAY[]::text[]),
  ('lesson-1000-words-a1-07', 'course-1000-words-a1', 'A1', 200, true, ARRAY[]::text[]),
  ('lesson-1000-words-a1-09', 'course-1000-words-a1', 'A1', 210, true, ARRAY[]::text[]),
  ('lesson-1000-words-a1-10', 'course-1000-words-a1', 'A1', 220, true, ARRAY[]::text[]),
  ('lesson-1000-words-a1-11', 'course-1000-words-a1', 'A1', 230, true, ARRAY[]::text[]),
  ('lesson-1000-words-a1-14', 'course-1000-words-a1', 'A1', 240, true, ARRAY[]::text[]),
  ('lesson-1000-words-a1-15', 'course-1000-words-a1', 'A1', 250, true, ARRAY[]::text[]),
  ('lesson-1000-words-a1-18', 'course-1000-words-a1', 'A1', 260, true, ARRAY[]::text[]),
  ('lesson-1000-words-a1-26', 'course-1000-words-a1', 'A1', 270, true, ARRAY[]::text[]),
  ('lesson-1000-words-a1-38', 'course-1000-words-a1', 'A1', 280, true, ARRAY[]::text[]),
  ('lesson-tenses-b1-01', 'course-tenses-b1', 'A2', 290, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-first-sentences-a1-11', 'course-first-sentences-a1', 'A2', 300, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-first-sentences-a1-12', 'course-first-sentences-a1', 'A2', 310, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-tenses-b1-02', 'course-tenses-b1', 'A2', 320, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-prepositions-b1-01', 'course-prepositions-b1', 'A2', 330, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-prepositions-b1-03', 'course-prepositions-b1', 'A2', 340, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-tenses-b1-05', 'course-tenses-b1', 'A2', 350, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-numbers-a1-01', 'course-numbers-a1', 'A2', 360, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-numbers-a1-05', 'course-numbers-a1', 'A2', 370, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-numbers-a1-06', 'course-numbers-a1', 'A2', 380, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-numbers-a1-07', 'course-numbers-a1', 'A2', 390, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-numbers-a1-08', 'course-numbers-a1', 'A2', 400, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-modals-b1-01', 'course-modals-b1', 'A2', 410, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-modals-b1-02', 'course-modals-b1', 'A2', 420, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-modals-b1-07', 'course-modals-b1', 'A2', 430, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-02', 'course-1000-words-a1', 'A2', 440, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-08', 'course-1000-words-a1', 'A2', 450, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-12', 'course-1000-words-a1', 'A2', 460, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-13', 'course-1000-words-a1', 'A2', 470, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-16', 'course-1000-words-a1', 'A2', 480, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-17', 'course-1000-words-a1', 'A2', 490, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-19', 'course-1000-words-a1', 'A2', 500, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-20', 'course-1000-words-a1', 'A2', 510, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-21', 'course-1000-words-a1', 'A2', 520, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-22', 'course-1000-words-a1', 'A2', 530, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-23', 'course-1000-words-a1', 'A2', 540, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-24', 'course-1000-words-a1', 'A2', 550, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-27', 'course-1000-words-a1', 'A2', 560, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-28', 'course-1000-words-a1', 'A2', 570, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-29', 'course-1000-words-a1', 'A2', 580, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-30', 'course-1000-words-a1', 'A2', 590, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-31', 'course-1000-words-a1', 'A2', 600, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-32', 'course-1000-words-a1', 'A2', 610, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-33', 'course-1000-words-a1', 'A2', 620, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-34', 'course-1000-words-a1', 'A2', 630, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-35', 'course-1000-words-a1', 'A2', 640, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-36', 'course-1000-words-a1', 'A2', 650, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-39', 'course-1000-words-a1', 'A2', 660, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-40', 'course-1000-words-a1', 'A2', 670, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-41', 'course-1000-words-a1', 'A2', 680, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-43', 'course-1000-words-a1', 'A2', 690, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-1000-words-a1-44', 'course-1000-words-a1', 'A2', 700, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-survival-a2-01', 'course-survival-a2', 'A2', 710, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-survival-a2-02', 'course-survival-a2', 'A2', 720, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-survival-a2-03', 'course-survival-a2', 'A2', 730, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-survival-a2-04', 'course-survival-a2', 'A2', 740, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-survival-a2-06', 'course-survival-a2', 'A2', 750, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-survival-a2-07', 'course-survival-a2', 'A2', 760, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-survival-a2-08', 'course-survival-a2', 'A2', 770, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-survival-a2-09', 'course-survival-a2', 'A2', 780, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-survival-a2-10', 'course-survival-a2', 'A2', 790, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-routine-a2-01', 'course-routine-a2', 'A2', 800, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-routine-a2-02', 'course-routine-a2', 'A2', 810, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-routine-a2-03', 'course-routine-a2', 'A2', 820, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-routine-a2-05', 'course-routine-a2', 'A2', 830, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-routine-a2-06', 'course-routine-a2', 'A2', 840, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-shopping-a2-01', 'course-shopping-a2', 'A2', 850, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-shopping-a2-02', 'course-shopping-a2', 'A2', 860, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-shopping-a2-03', 'course-shopping-a2', 'A2', 870, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-health-a2-01', 'course-health-a2', 'A2', 880, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-health-a2-03', 'course-health-a2', 'A2', 890, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-health-a2-04', 'course-health-a2', 'A2', 900, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-social-a2-02', 'course-social-a2', 'A2', 910, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-social-a2-04', 'course-social-a2', 'A2', 920, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-01', 'course-travel-a2', 'A2', 930, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-02', 'course-travel-a2', 'A2', 940, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-03', 'course-travel-a2', 'A2', 950, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-04', 'course-travel-a2', 'A2', 960, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-05', 'course-travel-a2', 'A2', 970, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-07', 'course-travel-a2', 'A2', 980, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-08', 'course-travel-a2', 'A2', 990, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-10', 'course-travel-a2', 'A2', 1000, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-11', 'course-travel-a2', 'A2', 1010, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-12', 'course-travel-a2', 'A2', 1020, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-13', 'course-travel-a2', 'A2', 1030, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-14', 'course-travel-a2', 'A2', 1040, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-15', 'course-travel-a2', 'A2', 1050, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-16', 'course-travel-a2', 'A2', 1060, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-17', 'course-travel-a2', 'A2', 1070, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-18', 'course-travel-a2', 'A2', 1080, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-19', 'course-travel-a2', 'A2', 1090, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-21', 'course-travel-a2', 'A2', 1100, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-22', 'course-travel-a2', 'A2', 1110, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-23', 'course-travel-a2', 'A2', 1120, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-25', 'course-travel-a2', 'A2', 1130, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-travel-a2-26', 'course-travel-a2', 'A2', 1140, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-collocations-b2-02', 'course-collocations-b2', 'A2', 1150, true, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-connected-b2-05', 'course-connected-speech-b2', 'A2', 1160, false, ARRAY['lesson-first-sentences-a1-10']::text[]),
  ('lesson-tenses-b1-03', 'course-tenses-b1', 'B1', 1170, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-tenses-b1-04', 'course-tenses-b1', 'B1', 1180, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-tenses-b1-06', 'course-tenses-b1', 'B1', 1190, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-tenses-b1-07', 'course-tenses-b1', 'B1', 1200, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-tenses-b1-08', 'course-tenses-b1', 'B1', 1210, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-prepositions-b1-04', 'course-prepositions-b1', 'B1', 1220, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-prepositions-b1-06', 'course-prepositions-b1', 'B1', 1230, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-tenses-b1-10', 'course-tenses-b1', 'B1', 1240, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-tenses-b1-12', 'course-tenses-b1', 'B1', 1250, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-tenses-b1-13', 'course-tenses-b1', 'B1', 1260, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-tenses-b1-14', 'course-tenses-b1', 'B1', 1270, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-modals-b1-06', 'course-modals-b1', 'B1', 1280, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-essential-verbs-a1-01', 'course-essential-verbs-a1', 'B1', 1290, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-02', 'course-essential-verbs-a1', 'B1', 1300, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-03', 'course-essential-verbs-a1', 'B1', 1310, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-04', 'course-essential-verbs-a1', 'B1', 1320, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-05', 'course-essential-verbs-a1', 'B1', 1330, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-06', 'course-essential-verbs-a1', 'B1', 1340, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-07', 'course-essential-verbs-a1', 'B1', 1350, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-08', 'course-essential-verbs-a1', 'B1', 1360, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-09', 'course-essential-verbs-a1', 'B1', 1370, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-10', 'course-essential-verbs-a1', 'B1', 1380, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-11', 'course-essential-verbs-a1', 'B1', 1390, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-12', 'course-essential-verbs-a1', 'B1', 1400, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-13', 'course-essential-verbs-a1', 'B1', 1410, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-14', 'course-essential-verbs-a1', 'B1', 1420, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-15', 'course-essential-verbs-a1', 'B1', 1430, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-16', 'course-essential-verbs-a1', 'B1', 1440, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-17', 'course-essential-verbs-a1', 'B1', 1450, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-18', 'course-essential-verbs-a1', 'B1', 1460, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-19', 'course-essential-verbs-a1', 'B1', 1470, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-20', 'course-essential-verbs-a1', 'B1', 1480, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-21', 'course-essential-verbs-a1', 'B1', 1490, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-22', 'course-essential-verbs-a1', 'B1', 1500, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-23', 'course-essential-verbs-a1', 'B1', 1510, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-24', 'course-essential-verbs-a1', 'B1', 1520, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-1000-words-a1-25', 'course-1000-words-a1', 'B1', 1530, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-essential-verbs-a1-25', 'course-essential-verbs-a1', 'B1', 1540, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-26', 'course-essential-verbs-a1', 'B1', 1550, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-27', 'course-essential-verbs-a1', 'B1', 1560, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-28', 'course-essential-verbs-a1', 'B1', 1570, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-29', 'course-essential-verbs-a1', 'B1', 1580, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-30', 'course-essential-verbs-a1', 'B1', 1590, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-31', 'course-essential-verbs-a1', 'B1', 1600, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-32', 'course-essential-verbs-a1', 'B1', 1610, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-33', 'course-essential-verbs-a1', 'B1', 1620, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-34', 'course-essential-verbs-a1', 'B1', 1630, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-35', 'course-essential-verbs-a1', 'B1', 1640, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-36', 'course-essential-verbs-a1', 'B1', 1650, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-1000-words-a1-37', 'course-1000-words-a1', 'B1', 1660, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-essential-verbs-a1-37', 'course-essential-verbs-a1', 'B1', 1670, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-38', 'course-essential-verbs-a1', 'B1', 1680, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-39', 'course-essential-verbs-a1', 'B1', 1690, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-40', 'course-essential-verbs-a1', 'B1', 1700, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-41', 'course-essential-verbs-a1', 'B1', 1710, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-1000-words-a1-42', 'course-1000-words-a1', 'B1', 1720, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-essential-verbs-a1-42', 'course-essential-verbs-a1', 'B1', 1730, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-43', 'course-essential-verbs-a1', 'B1', 1740, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-44', 'course-essential-verbs-a1', 'B1', 1750, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-45', 'course-essential-verbs-a1', 'B1', 1760, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-46', 'course-essential-verbs-a1', 'B1', 1770, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-47', 'course-essential-verbs-a1', 'B1', 1780, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-48', 'course-essential-verbs-a1', 'B1', 1790, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-49', 'course-essential-verbs-a1', 'B1', 1800, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-50', 'course-essential-verbs-a1', 'B1', 1810, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-51', 'course-essential-verbs-a1', 'B1', 1820, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-52', 'course-essential-verbs-a1', 'B1', 1830, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-53', 'course-essential-verbs-a1', 'B1', 1840, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-54', 'course-essential-verbs-a1', 'B1', 1850, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-55', 'course-essential-verbs-a1', 'B1', 1860, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-56', 'course-essential-verbs-a1', 'B1', 1870, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-57', 'course-essential-verbs-a1', 'B1', 1880, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-58', 'course-essential-verbs-a1', 'B1', 1890, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-59', 'course-essential-verbs-a1', 'B1', 1900, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-essential-verbs-a1-60', 'course-essential-verbs-a1', 'B1', 1910, true, ARRAY['lesson-tenses-b1-02','lesson-tenses-b1-03']::text[]),
  ('lesson-survival-a2-05', 'course-survival-a2', 'B1', 1920, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-routine-a2-04', 'course-routine-a2', 'B1', 1930, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-shopping-a2-04', 'course-shopping-a2', 'B1', 1940, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-shopping-a2-05', 'course-shopping-a2', 'B1', 1950, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-shopping-a2-06', 'course-shopping-a2', 'B1', 1960, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-health-a2-02', 'course-health-a2', 'B1', 1970, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-health-a2-05', 'course-health-a2', 'B1', 1980, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-health-a2-06', 'course-health-a2', 'B1', 1990, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-social-a2-01', 'course-social-a2', 'B1', 2000, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-social-a2-03', 'course-social-a2', 'B1', 2010, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-social-a2-05', 'course-social-a2', 'B1', 2020, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-travel-a2-06', 'course-travel-a2', 'B1', 2030, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-travel-a2-09', 'course-travel-a2', 'B1', 2040, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-travel-a2-20', 'course-travel-a2', 'B1', 2050, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-travel-a2-24', 'course-travel-a2', 'B1', 2060, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-travel-a2-27', 'course-travel-a2', 'B1', 2070, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-phrasal-b1-02', 'course-phrasal-b1', 'B1', 2080, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-phrasal-b1-04', 'course-phrasal-b1', 'B1', 2090, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-phrasal-b1-06', 'course-phrasal-b1', 'B1', 2100, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-phrasal-b1-08', 'course-phrasal-b1', 'B1', 2110, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-phrasal-b1-12', 'course-phrasal-b1', 'B1', 2120, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-phrasal-b1-14', 'course-phrasal-b1', 'B1', 2130, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-phrasal-b1-15', 'course-phrasal-b1', 'B1', 2140, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-phrasal-b1-18', 'course-phrasal-b1', 'B1', 2150, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-phrasal-b1-19', 'course-phrasal-b1', 'B1', 2160, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-collocations-b2-01', 'course-collocations-b2', 'B1', 2170, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-stories-b1-01', 'course-stories-b1', 'B1', 2180, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-stories-b1-02', 'course-stories-b1', 'B1', 2190, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-stories-b1-03', 'course-stories-b1', 'B1', 2200, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-stories-b1-04', 'course-stories-b1', 'B1', 2210, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-stories-b1-05', 'course-stories-b1', 'B1', 2220, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-stories-b1-06', 'course-stories-b1', 'B1', 2230, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-stories-b1-07', 'course-stories-b1', 'B1', 2240, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-stories-b1-08', 'course-stories-b1', 'B1', 2250, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-stories-b1-09', 'course-stories-b1', 'B1', 2260, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-stories-b1-10', 'course-stories-b1', 'B1', 2270, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-work-b1-03', 'course-work-b1', 'B1', 2280, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-work-b1-04', 'course-work-b1', 'B1', 2290, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-work-b1-07', 'course-work-b1', 'B1', 2300, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-work-b1-09', 'course-work-b1', 'B1', 2310, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-work-b1-10', 'course-work-b1', 'B1', 2320, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-work-b1-12', 'course-work-b1', 'B1', 2330, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-work-b1-13', 'course-work-b1', 'B1', 2340, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-interview-b1-01', 'course-interview-b1', 'B1', 2350, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-interview-b1-02', 'course-interview-b1', 'B1', 2360, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-interview-b1-03', 'course-interview-b1', 'B1', 2370, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-interview-b1-04', 'course-interview-b1', 'B1', 2380, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-interview-b1-05', 'course-interview-b1', 'B1', 2390, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-interview-b1-08', 'course-interview-b1', 'B1', 2400, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-street-a1-02', 'course-street-a1', 'B1', 2410, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-street-a1-03', 'course-street-a1', 'B1', 2420, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-street-a1-04', 'course-street-a1', 'B1', 2430, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-street-a1-05', 'course-street-a1', 'B1', 2440, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-street-a1-06', 'course-street-a1', 'B1', 2450, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-street-a1-07', 'course-street-a1', 'B1', 2460, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-street-a1-08', 'course-street-a1', 'B1', 2470, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-street-a1-11', 'course-street-a1', 'B1', 2480, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-idioms-b2-04', 'course-idioms-b2', 'B1', 2490, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-idioms-b2-06', 'course-idioms-b2', 'B1', 2500, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-paragraphs-b2-01', 'course-paragraphs-b2', 'B1', 2510, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-paragraphs-b2-02', 'course-paragraphs-b2', 'B1', 2520, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-paragraphs-b2-03', 'course-paragraphs-b2', 'B1', 2530, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-paragraphs-b2-04', 'course-paragraphs-b2', 'B1', 2540, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-paragraphs-b2-08', 'course-paragraphs-b2', 'B1', 2550, true, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-connected-b2-02', 'course-connected-speech-b2', 'B1', 2560, false, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-connected-b2-03', 'course-connected-speech-b2', 'B1', 2570, false, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-connected-b2-04', 'course-connected-speech-b2', 'B1', 2580, false, ARRAY['lesson-tenses-b1-02']::text[]),
  ('lesson-tenses-b1-09', 'course-tenses-b1', 'B2', 2590, true, ARRAY['lesson-tenses-b1-03','lesson-tenses-b1-06']::text[]),
  ('lesson-tenses-b1-11', 'course-tenses-b1', 'B2', 2600, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-tenses-b1-15', 'course-tenses-b1', 'B2', 2610, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-tenses-b1-16', 'course-tenses-b1', 'B2', 2620, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-modals-b1-03', 'course-modals-b1', 'B2', 2630, true, ARRAY['lesson-tenses-b1-03','lesson-tenses-b1-06']::text[]),
  ('lesson-modals-b1-04', 'course-modals-b1', 'B2', 2640, true, ARRAY['lesson-tenses-b1-03','lesson-tenses-b1-06']::text[]),
  ('lesson-modals-b1-05', 'course-modals-b1', 'B2', 2650, true, ARRAY['lesson-tenses-b1-03','lesson-tenses-b1-06']::text[]),
  ('lesson-modals-b1-08', 'course-modals-b1', 'B2', 2660, true, ARRAY['lesson-tenses-b1-03','lesson-tenses-b1-06']::text[]),
  ('lesson-prepositions-b1-05', 'course-prepositions-b1', 'B2', 2670, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-grammar-b2-01', 'course-grammar-b2', 'B2', 2680, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-grammar-b2-02', 'course-grammar-b2', 'B2', 2690, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-grammar-b2-03', 'course-grammar-b2', 'B2', 2700, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-grammar-b2-04', 'course-grammar-b2', 'B2', 2710, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-grammar-b2-05', 'course-grammar-b2', 'B2', 2720, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-themes-b2-01', 'course-themes-b2', 'B2', 2730, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-themes-b2-02', 'course-themes-b2', 'B2', 2740, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-themes-b2-03', 'course-themes-b2', 'B2', 2750, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-themes-b2-04', 'course-themes-b2', 'B2', 2760, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-themes-b2-05', 'course-themes-b2', 'B2', 2770, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-themes-b2-06', 'course-themes-b2', 'B2', 2780, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-social-a2-06', 'course-social-a2', 'B2', 2790, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-register-c1-01', 'course-register-c1', 'B2', 2800, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-phrasal-b1-01', 'course-phrasal-b1', 'B2', 2810, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-phrasal-b2-01', 'course-phrasal-adv-b2', 'B2', 2820, true, ARRAY['lesson-tenses-b1-03','lesson-phrasal-b1-02']::text[]),
  ('lesson-phrasal-b2-02', 'course-phrasal-adv-b2', 'B2', 2830, true, ARRAY['lesson-tenses-b1-03','lesson-phrasal-b1-02']::text[]),
  ('lesson-phrasal-b1-03', 'course-phrasal-b1', 'B2', 2840, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-phrasal-b2-03', 'course-phrasal-adv-b2', 'B2', 2850, true, ARRAY['lesson-tenses-b1-03','lesson-phrasal-b1-02']::text[]),
  ('lesson-phrasal-b2-04', 'course-phrasal-adv-b2', 'B2', 2860, true, ARRAY['lesson-tenses-b1-03','lesson-phrasal-b1-02']::text[]),
  ('lesson-phrasal-b1-05', 'course-phrasal-b1', 'B2', 2870, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-phrasal-b2-05', 'course-phrasal-adv-b2', 'B2', 2880, true, ARRAY['lesson-tenses-b1-03','lesson-phrasal-b1-02']::text[]),
  ('lesson-phrasal-b2-06', 'course-phrasal-adv-b2', 'B2', 2890, true, ARRAY['lesson-tenses-b1-03','lesson-phrasal-b1-02']::text[]),
  ('lesson-phrasal-b1-07', 'course-phrasal-b1', 'B2', 2900, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-phrasal-b2-07', 'course-phrasal-adv-b2', 'B2', 2910, true, ARRAY['lesson-tenses-b1-03','lesson-phrasal-b1-02']::text[]),
  ('lesson-phrasal-b2-08', 'course-phrasal-adv-b2', 'B2', 2920, true, ARRAY['lesson-tenses-b1-03','lesson-phrasal-b1-02']::text[]),
  ('lesson-phrasal-b1-09', 'course-phrasal-b1', 'B2', 2930, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-phrasal-b2-09', 'course-phrasal-adv-b2', 'B2', 2940, true, ARRAY['lesson-tenses-b1-03','lesson-phrasal-b1-02']::text[]),
  ('lesson-phrasal-b1-10', 'course-phrasal-b1', 'B2', 2950, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-phrasal-b2-10', 'course-phrasal-adv-b2', 'B2', 2960, true, ARRAY['lesson-tenses-b1-03','lesson-phrasal-b1-02']::text[]),
  ('lesson-phrasal-b1-11', 'course-phrasal-b1', 'B2', 2970, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-phrasal-b1-13', 'course-phrasal-b1', 'B2', 2980, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-phrasal-b1-16', 'course-phrasal-b1', 'B2', 2990, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-phrasal-b1-17', 'course-phrasal-b1', 'B2', 3000, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-phrasal-b1-20', 'course-phrasal-b1', 'B2', 3010, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-collocations-b2-03', 'course-collocations-b2', 'B2', 3020, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-collocations-b2-04', 'course-collocations-b2', 'B2', 3030, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-collocations-b2-05', 'course-collocations-b2', 'B2', 3040, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-collocations-b2-06', 'course-collocations-b2', 'B2', 3050, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-collocations-b2-07', 'course-collocations-b2', 'B2', 3060, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-collocations-b2-08', 'course-collocations-b2', 'B2', 3070, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-negotiation-b2-01', 'course-negotiation-b2', 'B2', 3080, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-work-b1-01', 'course-work-b1', 'B2', 3090, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-negotiation-b2-02', 'course-negotiation-b2', 'B2', 3100, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-work-b1-02', 'course-work-b1', 'B2', 3110, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-negotiation-b2-03', 'course-negotiation-b2', 'B2', 3120, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-negotiation-b2-04', 'course-negotiation-b2', 'B2', 3130, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-negotiation-b2-05', 'course-negotiation-b2', 'B2', 3140, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-work-b1-05', 'course-work-b1', 'B2', 3150, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-negotiation-b2-06', 'course-negotiation-b2', 'B2', 3160, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-work-b1-06', 'course-work-b1', 'B2', 3170, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-negotiation-b2-07', 'course-negotiation-b2', 'B2', 3180, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-negotiation-b2-08', 'course-negotiation-b2', 'B2', 3190, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-work-b1-08', 'course-work-b1', 'B2', 3200, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-work-b1-11', 'course-work-b1', 'B2', 3210, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-work-b1-14', 'course-work-b1', 'B2', 3220, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-work-b1-15', 'course-work-b1', 'B2', 3230, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-work-b1-16', 'course-work-b1', 'B2', 3240, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-interview-b1-06', 'course-interview-b1', 'B2', 3250, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-interview-b1-07', 'course-interview-b1', 'B2', 3260, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-street-a1-01', 'course-street-a1', 'B2', 3270, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-street-a1-09', 'course-street-a1', 'B2', 3280, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-street-a1-10', 'course-street-a1', 'B2', 3290, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-street-a1-12', 'course-street-a1', 'B2', 3300, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-idioms-b2-01', 'course-idioms-b2', 'B2', 3310, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-idioms-b2-02', 'course-idioms-b2', 'B2', 3320, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-idioms-b2-03', 'course-idioms-b2', 'B2', 3330, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-idioms-b2-05', 'course-idioms-b2', 'B2', 3340, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-idioms-b2-07', 'course-idioms-b2', 'B2', 3350, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-idioms-b2-08', 'course-idioms-b2', 'B2', 3360, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-idioms-b2-09', 'course-idioms-b2', 'B2', 3370, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-idioms-b2-10', 'course-idioms-b2', 'B2', 3380, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-debate-b2-01', 'course-debate-b2', 'B2', 3390, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-debate-b2-02', 'course-debate-b2', 'B2', 3400, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-debate-b2-03', 'course-debate-b2', 'B2', 3410, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-debate-b2-04', 'course-debate-b2', 'B2', 3420, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-debate-b2-05', 'course-debate-b2', 'B2', 3430, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-debate-b2-06', 'course-debate-b2', 'B2', 3440, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-paragraphs-b2-05', 'course-paragraphs-b2', 'B2', 3450, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-paragraphs-b2-06', 'course-paragraphs-b2', 'B2', 3460, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-paragraphs-b2-07', 'course-paragraphs-b2', 'B2', 3470, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-paragraphs-b2-09', 'course-paragraphs-b2', 'B2', 3480, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-paragraphs-b2-10', 'course-paragraphs-b2', 'B2', 3490, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-subtext-b2-01', 'course-subtext-b2', 'B2', 3500, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-subtext-b2-03', 'course-subtext-b2', 'B2', 3510, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-subtext-b2-04', 'course-subtext-b2', 'B2', 3520, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-subtext-b2-06', 'course-subtext-b2', 'B2', 3530, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-subtext-b2-07', 'course-subtext-b2', 'B2', 3540, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-subtext-b2-08', 'course-subtext-b2', 'B2', 3550, true, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-spoken-reductions-a2-01', 'course-spoken-reductions-a2', 'B2', 3560, false, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-connected-b2-01', 'course-connected-speech-b2', 'B2', 3570, false, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-connected-b2-06', 'course-connected-speech-b2', 'B2', 3580, false, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-connected-b2-07', 'course-connected-speech-b2', 'B2', 3590, false, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-connected-b2-08', 'course-connected-speech-b2', 'B2', 3600, false, ARRAY['lesson-tenses-b1-03']::text[]),
  ('lesson-grammar-b2-06', 'course-grammar-b2', 'C1', 3610, true, ARRAY['lesson-tenses-b1-09']::text[]),
  ('lesson-grammar-b2-07', 'course-grammar-b2', 'C1', 3620, true, ARRAY['lesson-tenses-b1-09']::text[]),
  ('lesson-grammar-b2-08', 'course-grammar-b2', 'C1', 3630, true, ARRAY['lesson-tenses-b1-09']::text[]),
  ('lesson-register-c1-02', 'course-register-c1', 'C1', 3640, true, ARRAY['lesson-tenses-b1-09']::text[]),
  ('lesson-register-c1-03', 'course-register-c1', 'C1', 3650, true, ARRAY['lesson-tenses-b1-09']::text[]),
  ('lesson-register-c1-04', 'course-register-c1', 'C1', 3660, true, ARRAY['lesson-tenses-b1-09']::text[]),
  ('lesson-register-c1-05', 'course-register-c1', 'C1', 3670, true, ARRAY['lesson-tenses-b1-09']::text[]),
  ('lesson-register-c1-06', 'course-register-c1', 'C1', 3680, true, ARRAY['lesson-tenses-b1-09']::text[]),
  ('lesson-register-c1-07', 'course-register-c1', 'C1', 3690, true, ARRAY['lesson-tenses-b1-09']::text[]),
  ('lesson-register-c1-08', 'course-register-c1', 'C1', 3700, true, ARRAY['lesson-tenses-b1-09']::text[]),
  ('lesson-subtext-b2-02', 'course-subtext-b2', 'C1', 3710, true, ARRAY['lesson-tenses-b1-09']::text[]),
  ('lesson-subtext-b2-05', 'course-subtext-b2', 'C1', 3720, true, ARRAY['lesson-tenses-b1-09']::text[])
)
UPDATE public.course_lessons l SET level=r.level, curriculum_order=r.curriculum_order,
  is_core=r.is_core, prerequisite_lesson_ids=r.requirements
FROM reviewed r WHERE l.id=r.id AND l.course_id=r.course_id;

WITH reviewed(id,level,title,short_description,long_description) AS (VALUES
  ('course-street-a1', 'B2', 'Inglês das Ruas & Gírias Reais', 'Gírias, reduções da fala e expressões que nativos usam de verdade, com o registro e o sentido real de cada uma.', 'Frases curtas do cotidiano com gírias frequentes ("what''s up", "my bad", "I''m down"), reduções ("gonna", "wanna", "gotta"), mensagens, dinheiro, cansaço, expressões idiomáticas e como discordar. Cada nota explica o registro (informal ou gíria) e o sentido literal × o real. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-travel-a2', 'B1', 'Viagem sem Aperto', 'Do aeroporto à praia: avião, imigração, hotel e Airbnb, transporte, compras, restaurante, passeios, farmácia e emergências.', 'A viagem inteira em situações reais, com o que você diz e o que ouve do outro lado: aeroporto e imigração, táxi, trem e carro alugado, hotel e Airbnb, compras, restaurante, café e bar, passeios e praia, farmácia, direções e emergências. Termina com um capítulo de revisão. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-work-b1', 'B2', 'Inglês no Trabalho', 'Reuniões, e-mails, apresentações, feedback, prazos, clientes, entrevista e liderança: o inglês de escritório e trabalho remoto.', 'Expressões usadas de verdade no trabalho: conduzir reuniões, escrever e-mails, apresentar resultados, dar feedback, negociar prazos, falar com clientes, fazer entrevista, networking, lidar com conflitos e liderar. Cada nota indica o registro (formal, neutro ou informal). Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-first-sentences-a1', 'A2', 'Primeiras Frases', 'Do zero às primeiras frases: apresentar-se, perguntar, negar, pedir, falar da rotina, do que gosta e do passado.', 'Monte frases completas desde a primeira aula: verbo "to be", perguntas e negativas, "there is", possessivos, presente simples, "can", imperativo, "like + -ing" e o passado com "was/were". Cada frase vem com a explicação da estrutura. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-1000-words-a1', 'B1', 'Vocabulário Essencial por Temas', '880 itens de vocabulário, em temas do concreto ao abstrato; níveis definidos por capítulo.', 'Vocabulário por temas: pessoas, casa, alimentação, serviços, personalidade e conectores. O catálogo contém 880 itens em 44 capítulos; a extensão do vocabulário não certifica um nível. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-essential-verbs-a1', 'B1', 'Verbos Essenciais', 'Os 100 verbos mais usados em frases separadas por tempo: presente, passado, futuro e present perfect.', 'Cada verbo aparece em quatro frases reais, uma por tempo verbal, com a explicação gramatical de cada forma. No fim de cada módulo, você revisa as três formas (base, passado e particípio). São 100 verbos em 10 módulos. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-routine-a2', 'B1', 'Rotina e Vida em Casa', 'Acordar, arrumar a casa, cozinhar, hábitos, fim de semana e planos: o inglês da sua rotina.', 'Frases do dia a dia em casa com a gramática do nível A2 aplicada: presente simples para hábitos, presente contínuo para o que está acontecendo, passado para contar o fim de semana e "going to" para planos. Cada frase explica a estrutura usada. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-shopping-a2', 'B1', 'Compras sem Mistério', 'Mercado, roupas, pagamento, trocas, compras online e reclamações: tudo que você diz e ouve ao comprar.', 'Situações de compra do começo ao fim: achar o produto no mercado, experimentar roupa, pagar, trocar ou devolver, acompanhar uma entrega e reclamar com educação. Cada frase explica a estrutura ou a expressão usada. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-health-a2', 'B1', 'Saúde e Bem-estar', 'Marcar consulta, explicar sintomas, entender a receita, ir ao dentista, cuidar do corpo e lidar com o hospital.', 'O inglês que você precisa quando o assunto é saúde: marcar horário, descrever o que sente, entender o que o médico diz, dentista, academia e seguro saúde. Cada frase explica a estrutura ou a expressão usada. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-social-a2', 'B2', 'Vida Social', 'Conhecer gente, convidar, puxar conversa, elogiar, dar opinião e pedir desculpas com naturalidade.', 'As conversas que fazem amizade: apresentar-se e lembrar nomes, convidar e recusar sem ser grosso, conversa fiada, elogios, opiniões e como resolver mal-entendidos. Cada frase explica o registro e a estrutura. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-phrasal-b1', 'B2', 'Phrasal Verbs Essenciais', 'Os phrasal verbs que nativos mais usam, por verbo-base, em frases reais com o sentido de cada um.', 'Phrasal verbs organizados pelo verbo-base (get, take, put, come, go, look, turn, give, make, break, bring, run, set, call, pick). Cada frase explica o sentido real × o literal, o registro e se o phrasal é separável (o objeto pode ir no meio: "turn it off"). Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-tenses-b1', 'B2', 'Tempos Verbais em Uso', 'Os tempos verbais que mais confundem brasileiros, em pares, com a comparação com o português.', 'Presente simples × contínuo, passado simples × contínuo, present perfect × passado, present perfect contínuo, futuro (will, going to, presente contínuo) e past perfect. Cada frase explica por que aquele tempo foi usado e como fica em português. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-prepositions-b1', 'B2', 'Preposições e Conectores', 'In, on, at, preposições que acompanham verbos e adjetivos, e os conectores que ligam ideias.', 'As preposições que mais confundem brasileiros (in/on/at de tempo e lugar, verbo + preposição, adjetivo + preposição) e os conectores de contraste, causa, consequência e sequência. Cada frase explica a regra e o erro típico. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-idioms-b2', 'B2', 'Expressões Idiomáticas e Fluência', 'Idioms que nativos usam de verdade e os recursos que deixam sua fala natural: marcadores, opiniões suaves e histórias.', 'Expressões idiomáticas de trabalho, sentimentos, dinheiro e tempo, e as ferramentas de fluência que separam o B1 do B2: marcadores de conversa ("actually", "I mean"), como suavizar opiniões e como contar uma história. Cada nota traz o registro e o sentido literal × o real. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-numbers-a1', 'A2', 'Números, Horas e Datas', 'Idade, preços, telefone, horas, datas, agenda e medidas: os números em frases do dia a dia.', 'Números em uso real: dizer a idade, perguntar preços, passar telefone e soletrar e-mail, dizer as horas, datas e aniversários, marcar compromissos e falar de medidas. Cada frase explica como o número é lido em inglês. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-survival-a2', 'B1', 'Sobrevivência', 'Quando o inglês falha: pedir para repetir, soletrar, pedir ajuda, resolver banco, correio, documentos e contas.', 'As frases que salvam quando você não entende ou precisa resolver algo prático: pedir para repetir e soletrar, pedir ajuda, falar ao telefone, banco, correios, documentos, objetos perdidos, moradia e contas. Cada frase explica o uso. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-modals-b1', 'B2', 'Verbos Modais', 'Can, could, should, must, might, would, have to e may: habilidade, permissão, conselho, obrigação e possibilidade.', 'Um capítulo por modal, com os sentidos que ele tem na fala real: habilidade, permissão, pedido, conselho, obrigação, proibição, possibilidade e hipótese. Modais não levam "to" nem "s" na terceira pessoa; cada frase mostra isso e compara com o português. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-interview-b1', 'B2', 'Entrevista de Emprego', 'Responder as perguntas clássicas de entrevista em inglês: apresentação, experiência, pontos fortes, situações, salário e perguntas finais.', 'Oito capítulos que seguem a ordem real de uma entrevista: abertura e small talk, falar de si, experiência, pontos fortes e fracos, perguntas de situação (método STAR), motivação, salário e disponibilidade, e perguntas para o entrevistador com o follow-up. As notas explicam o tom e os erros comuns de brasileiros. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-stories-b1', 'B1', 'Histórias em Trechos', 'Dez contos curtos, trecho por trecho: você ouve, escreve e acompanha a história até o fim.', 'Cada capítulo é um conto original dividido em oito trechos. Você pratica compreensão de uma narrativa contínua, tempos do passado, conectores e diálogo. A nota de cada trecho explica a estrutura ou a expressão usada. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-paragraphs-b2', 'B2', 'Parágrafos', 'Textos completos parágrafo por parágrafo: você ouve e escreve um texto inteiro com começo, meio e fim.', 'Dez tipos de texto do dia a dia (apresentação, rotina, cidade, viagem, opinião, e-mail formal, resenha, processo, comparação e planos), cada um em quatro parágrafos. A nota explica a função do parágrafo e os conectores que dão fluidez ao texto. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-spoken-reductions-a2', 'B2', 'Inglês Falado: Reduções', 'Piloto: as reduções que as séries usam o tempo todo e quase ninguém ensina (c''mon, gotcha, shoulda, outta).', 'Curso piloto sobre a fala real: formas encurtadas como "c''mon", "gotcha", "shoulda", "outta" e "tryna". Cada frase mostra a forma completa, o registro (informal ou gíria) e a armadilha. Você ouve, digita palavra por palavra e vê tradução, IPA e explicação. É um piloto de um capítulo: a continuação depende do áudio e do seu uso. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-grammar-b2', 'C1', 'Gramática Intermediária e Avançada', 'Wish, condicionais mistos, causativo, relativas, gerúndio × infinitivo, ênfase, inversão e futuro perfeito.', 'Os pontos de gramática que separam o inglês intermediário do avançado, sempre em frases curtas e naturais. Cada nota mostra a regra naquela frase e compara com o português, sem repetir o que o curso de Tempos Verbais do B1 já ensinou. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-collocations-b2', 'B2', 'Colocações Naturais', 'Make ou do? Heavy rain ou strong rain? As combinações de palavras que o nativo espera ouvir.', 'Colocações são pares de palavras que andam juntos: em inglês se faz uma decisão (make), se toma um banho (take) e a chuva é pesada (heavy). Traduzir do português palavra por palavra soa estranho. Cada frase traz a combinação natural e o erro mais comum de quem pensa em português. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-negotiation-b2', 'B2', 'Reuniões e Negociação', 'Conduzir reuniões, discordar com diplomacia, negociar preço e fechar acordos em inglês.', 'O inglês de quem decide e negocia: abrir e conduzir reuniões, opinar sem ser ríspido, propor, contrapropor, ceder e fechar um acordo. Cada nota explica o tom da frase (neutro, diplomático, firme) e o que evitar para não soar agressivo. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-debate-b2', 'B2', 'Argumentar e Debater', 'Defender uma ideia, rebater com educação e persuadir: o inglês de quem debate.', 'Como sustentar uma opinião, citar evidências, discordar sem ofender, ceder um ponto para ganhar outro e fechar com impacto. Cada frase vem com a função no debate e o tom que ela passa. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-phrasal-adv-b2', 'B2', 'Phrasal Verbs Avançados', 'Figure out, put up with, turn down: os phrasal verbs que aparecem em séries, reuniões e conversas reais.', 'Dez grupos de phrasal verbs para quem já domina os básicos. Cada frase mostra o sentido na situação e avisa se o verbo é separável ou não, que é o ponto em que mais se erra. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-subtext-b2', 'C1', 'Entrelinhas: Ironia e Subentendidos', 'O que o falante realmente quer dizer: ironia, sarcasmo, pedidos indiretos e recusas educadas.', 'Em inglês, muita coisa importante não está nas palavras: "not bad" pode ser um grande elogio, "interesting" pode ser uma crítica e "it is a bit cold in here" pode ser um pedido para fechar a janela. Cada frase traz o sentido literal e o sentido real. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-register-c1', 'C1', 'Registro e Precisão', 'Formal ou informal? Cauteloso ou direto? Escolher a palavra e o tom certos em textos e reuniões.', 'No C1 o desafio deixa de ser a gramática e passa a ser a escolha: o registro certo para cada situação, a cautela de quem escreve com rigor, a precisão de quem analisa. Cada frase mostra a versão neutra e a versão mais refinada. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-themes-b2', 'B2', 'Vocabulário por Temas', 'Palavras de temas abstratos que aparecem em notícias, debates e provas: meio ambiente, tecnologia, economia, saúde, mídia e relações.', 'Seis temas com 20 palavras cada. Você ouve a palavra, escreve e vê o significado com uma frase de exemplo. São as palavras que separam um vocabulário de dia a dia de um vocabulário de quem acompanha notícias e discute ideias. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.'),
  ('course-connected-speech-b2', 'B2', 'Fala Conectada', 'Shoulda, gonna, whaddya, kinda e a ligação entre palavras: o inglês falado como ele soa, não como se escreve.', 'Na fala rápida as palavras se juntam e se encurtam: "should have" vira "shoulda", "what do you" vira "whaddya", "pick it up" soa como uma palavra só. Cada frase mostra a forma reduzida, a forma completa e quando usar. O áudio é sintetizado a partir do texto escrito; escute com atenção e compare com a fala real de séries e vídeos. Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.')
)
UPDATE public.course_catalog c SET level=r.level,title=r.title,short_description=r.short_description,
  long_description=r.long_description,updated_at=now() FROM reviewed r WHERE c.id=r.id;

DO $$ BEGIN
  IF (SELECT count(*) FROM public.course_lessons WHERE curriculum_order IS NOT NULL) <> 372
  THEN RAISE EXCEPTION 'Cobertura curricular incompleta'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.rpc_course_catalog()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(course ORDER BY (course->>'order_index')::INT), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'title', c.title, 'short_description', c.short_description,
      'long_description', c.long_description, 'level', c.level, 'category', c.category,
      'level_min', (SELECT min(coalesce(cl.level,c.level)) FROM public.course_lessons cl WHERE cl.course_id=c.id AND EXISTS(SELECT 1 FROM public.course_units cu WHERE cu.lesson_id=cl.id)),
      'level_max', (SELECT max(coalesce(cl.level,c.level)) FROM public.course_lessons cl WHERE cl.course_id=c.id AND EXISTS(SELECT 1 FROM public.course_units cu WHERE cu.lesson_id=cl.id)),
      'curriculum_order', (SELECT min(cl.curriculum_order) FROM public.course_lessons cl WHERE cl.course_id=c.id),
      'track', c.track, 'track_order', c.track_order, 'is_core', c.is_core,
      'order_index', c.order_index, 'created_at', c.created_at,
      'unit_kind', (SELECT mode() WITHIN GROUP (ORDER BY u.kind) FROM public.course_units u
        JOIN public.course_lessons l ON l.id = u.lesson_id WHERE l.course_id = c.id),
      'learners_count', (SELECT count(*) FROM public.user_course_enrollment e WHERE e.course_id = c.id AND e.in_my_courses),
      'my', (
        SELECT jsonb_build_object('in_my_courses', e.in_my_courses, 'percent_completed', e.percent_completed,
          'completed_lessons', e.completed_lessons, 'current_lesson_id', e.current_lesson_id, 'last_studied_at', e.last_studied_at)
        FROM public.user_course_enrollment e WHERE e.course_id = c.id AND e.user_id = auth.uid()
      ),
      'lessons', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', l.id, 'chapter_number', l.chapter_number, 'title', l.title, 'description', l.description,
          'level', coalesce(l.level,c.level), 'curriculum_order', l.curriculum_order,
          'is_core', c.is_core AND l.is_core AND l.curriculum_order IS NOT NULL,
          'prerequisite_titles', (SELECT coalesce(jsonb_agg(pl.title ORDER BY pl.curriculum_order),'[]'::jsonb) FROM public.course_lessons pl WHERE pl.id=ANY(l.prerequisite_lesson_ids)),
          'unit_count', (SELECT count(*) FROM public.course_units u WHERE u.lesson_id = l.id),
          'my_best_answered', (SELECT max(s.answered_questions) FROM public.course_practice_sessions s
            WHERE s.lesson_id = l.id AND s.user_id = auth.uid())
        ) ORDER BY coalesce(l.level,c.level), l.curriculum_order NULLS LAST, l.chapter_number), '[]'::jsonb)
        FROM public.course_lessons l
        WHERE l.course_id = c.id AND EXISTS (SELECT 1 FROM public.course_units u WHERE u.lesson_id = l.id)
      )
    ) AS course
    FROM public.course_catalog c
    WHERE c.is_published
  ) t
  WHERE jsonb_array_length(course->'lessons') > 0;
$$;

CREATE OR REPLACE FUNCTION public.rpc_course_path()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH me AS (SELECT (select auth.uid()) AS uid),
  levels(level, pos) AS (VALUES ('A1', 1), ('A2', 2), ('B1', 3), ('B2', 4), ('C1', 5)),
  placement AS (
    SELECT l.pos
    FROM public.settings s, me, levels l
    WHERE s.user_id = me.uid AND s.key = 'lf_cefr_level'
      AND upper(trim(both '"' FROM trim(s.value))) = l.level
    LIMIT 1
  ),
  core AS (
    SELECT c.id AS course_id, l.level, l.curriculum_order, l.prerequisite_lesson_ids, l.id AS lesson_id, l.chapter_number
    FROM public.course_catalog c
    JOIN public.course_lessons l ON l.course_id = c.id
    WHERE c.is_published AND c.is_core AND l.is_core AND l.curriculum_order IS NOT NULL AND EXISTS (SELECT 1 FROM public.course_units u WHERE u.lesson_id = l.id)
  ),
  done AS (
    SELECT DISTINCT unnest(e.completed_lessons) AS lesson_id
    FROM public.user_course_enrollment e, me WHERE e.user_id = me.uid
  ),
  per_level AS (
    SELECT lv.level, lv.pos,
      count(c.lesson_id) AS total,
      count(c.lesson_id) FILTER (WHERE c.lesson_id IN (SELECT lesson_id FROM done)) AS completed
    FROM levels lv LEFT JOIN core c ON c.level = lv.level
    GROUP BY lv.level, lv.pos
  ),
  status AS (
    SELECT p.*,
      CASE WHEN p.total = 0 THEN 0 ELSE round(p.completed::NUMERIC * 100 / p.total, 1) END AS percent,
      (p.total > 0 AND p.completed = p.total) AS is_completed,
      (p.pos < coalesce((SELECT pos FROM placement), 1)) AS skipped_by_placement
    FROM per_level p
  ),
  current_level AS (
    SELECT level, pos FROM status
    WHERE NOT is_completed AND NOT skipped_by_placement AND total > 0
    ORDER BY pos LIMIT 1
  ),
  next_lesson AS (
    SELECT c.course_id, c.lesson_id, c.level
    FROM core c
    WHERE c.lesson_id NOT IN (SELECT lesson_id FROM done)
      AND c.level = (SELECT level FROM current_level)
      AND NOT EXISTS (
        SELECT 1 FROM unnest(c.prerequisite_lesson_ids) AS requirement(id)
        LEFT JOIN public.course_lessons pl ON pl.id=requirement.id
        WHERE pl.id IS NULL OR (pl.id NOT IN (SELECT lesson_id FROM done)
          AND pl.level NOT IN (SELECT level FROM status WHERE skipped_by_placement))
      )
    ORDER BY (SELECT pos FROM levels WHERE level = c.level),
      c.curriculum_order, c.lesson_id
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'placement_level', (SELECT l.level FROM placement p JOIN levels l ON l.pos = p.pos),
     'current_level', coalesce((SELECT level FROM next_lesson), (SELECT level FROM current_level)),
    'blocked', NOT EXISTS(SELECT 1 FROM next_lesson) AND EXISTS(SELECT 1 FROM core c WHERE c.lesson_id NOT IN(SELECT lesson_id FROM done) AND c.level IN(SELECT level FROM status WHERE NOT skipped_by_placement)),
    'levels', (SELECT jsonb_agg(jsonb_build_object('level', level, 'total', total, 'completed', completed,
      'percent', percent, 'is_completed', is_completed, 'skipped', skipped_by_placement) ORDER BY pos) FROM status),
    'next', (SELECT jsonb_build_object('course_id', course_id, 'lesson_id', lesson_id, 'level', level) FROM next_lesson)
  );
$$;
