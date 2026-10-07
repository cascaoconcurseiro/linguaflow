-- #533: somente conteúdo/organização; revisão #531 e progresso permanecem intactos.
-- Fonte versionada: supabase/content/curriculum-pedagogy.mjs. Rollback: course_pedagogy_533.sql.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.course_lessons WHERE id NOT LIKE 'lesson-pedagogy-%')<>372
    OR (SELECT count(*) FROM public.course_units WHERE id NOT LIKE 'unit-pedagogy-%')<>4088
    OR (SELECT md5(string_agg(concat_ws(chr(31),id,kind,text,translation_pt,coalesce(explanation_note,''),coalesce(example_en,''),coalesce(example_pt,'')),chr(30) ORDER BY id COLLATE "C")) FROM public.course_units WHERE id NOT LIKE 'unit-pedagogy-%')<>'d0002890d367706d6d43090022638f99'
    OR (SELECT count(*) FROM public.course_lessons WHERE id LIKE 'lesson-pedagogy-%')<>42
    OR (SELECT count(*) FROM public.course_units WHERE id LIKE 'unit-pedagogy-%')<>336
  THEN RAISE EXCEPTION 'Conteúdo divergente #533; reconciliar antes de publicar'; END IF;
END $$;
ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS lesson_role TEXT NOT NULL DEFAULT 'extra' CHECK(lesson_role IN('base','extra','optional')),
  ADD COLUMN IF NOT EXISTS module_title TEXT,
  ADD COLUMN IF NOT EXISTS module_order INT CHECK(module_order>0);
WITH reviewed(id,course_id,level,curriculum_order,is_core,requirements,lesson_role,module_title,module_order) AS (VALUES
  ('lesson-first-sentences-a1-01','course-first-sentences-a1','A1',10,true,ARRAY[]::text[],'base','Apresentação e comunicação básica',1),
  ('lesson-pedagogy-a1-clarify','course-pedagogy-a1','A1',20,true,ARRAY['lesson-first-sentences-a1-01']::text[],'base','Apresentação e comunicação básica',1),
  ('lesson-first-sentences-a1-02','course-first-sentences-a1','A1',30,true,ARRAY['lesson-pedagogy-a1-clarify']::text[],'base','Apresentação e comunicação básica',1),
  ('lesson-first-sentences-a1-03','course-first-sentences-a1','A1',40,true,ARRAY['lesson-first-sentences-a1-02']::text[],'base','Apresentação e comunicação básica',1),
  ('lesson-pedagogy-a1-articles','course-pedagogy-a1','A1',50,true,ARRAY['lesson-first-sentences-a1-03']::text[],'base','Objetos, artigos e plural',2),
  ('lesson-pedagogy-a1-plurals','course-pedagogy-a1','A1',60,true,ARRAY['lesson-pedagogy-a1-articles']::text[],'base','Objetos, artigos e plural',2),
  ('lesson-pedagogy-a1-demonstratives','course-pedagogy-a1','A1',70,true,ARRAY['lesson-pedagogy-a1-plurals']::text[],'base','Objetos, artigos e plural',2),
  ('lesson-first-sentences-a1-04','course-first-sentences-a1','A1',80,true,ARRAY['lesson-pedagogy-a1-demonstratives']::text[],'base','Objetos, artigos e plural',2),
  ('lesson-1000-words-a1-04','course-1000-words-a1','A1',90,true,ARRAY['lesson-first-sentences-a1-04']::text[],'base','Objetos, artigos e plural',2),
  ('lesson-1000-words-a1-26','course-1000-words-a1','A1',100,true,ARRAY['lesson-1000-words-a1-04']::text[],'base','Objetos, artigos e plural',2),
  ('lesson-pedagogy-a1-have','course-pedagogy-a1','A1',110,true,ARRAY['lesson-1000-words-a1-26']::text[],'base','Pessoas, descrição e posse',3),
  ('lesson-pedagogy-a1-object-pronouns','course-pedagogy-a1','A1',120,true,ARRAY['lesson-pedagogy-a1-have']::text[],'base','Pessoas, descrição e posse',3),
  ('lesson-pedagogy-a1-possessive-s','course-pedagogy-a1','A1',130,true,ARRAY['lesson-pedagogy-a1-object-pronouns']::text[],'base','Pessoas, descrição e posse',3),
  ('lesson-pedagogy-a1-descriptions','course-pedagogy-a1','A1',140,true,ARRAY['lesson-pedagogy-a1-possessive-s']::text[],'base','Pessoas, descrição e posse',3),
  ('lesson-first-sentences-a1-05','course-first-sentences-a1','A1',150,true,ARRAY['lesson-pedagogy-a1-descriptions']::text[],'base','Pessoas, descrição e posse',3),
  ('lesson-1000-words-a1-01','course-1000-words-a1','A1',160,true,ARRAY['lesson-first-sentences-a1-05']::text[],'base','Pessoas, descrição e posse',3),
  ('lesson-1000-words-a1-09','course-1000-words-a1','A1',170,true,ARRAY['lesson-1000-words-a1-01']::text[],'base','Pessoas, descrição e posse',3),
  ('lesson-1000-words-a1-18','course-1000-words-a1','A1',180,false,ARRAY['lesson-1000-words-a1-09']::text[],'extra','Pessoas, descrição e posse',3),
  ('lesson-1000-words-a1-38','course-1000-words-a1','A1',190,true,ARRAY['lesson-1000-words-a1-09']::text[],'base','Pessoas, descrição e posse',3),
  ('lesson-pedagogy-a1-frequency','course-pedagogy-a1','A1',200,true,ARRAY['lesson-1000-words-a1-38']::text[],'base','Rotina e perguntas',4),
  ('lesson-first-sentences-a1-06','course-first-sentences-a1','A1',210,true,ARRAY['lesson-pedagogy-a1-frequency']::text[],'base','Rotina e perguntas',4),
  ('lesson-first-sentences-a1-07','course-first-sentences-a1','A1',220,true,ARRAY['lesson-first-sentences-a1-06']::text[],'base','Rotina e perguntas',4),
  ('lesson-prepositions-b1-02','course-prepositions-b1','A1',230,true,ARRAY['lesson-first-sentences-a1-07']::text[],'base','Lugares, horários e números',5),
  ('lesson-numbers-a1-02','course-numbers-a1','A1',240,true,ARRAY['lesson-prepositions-b1-02']::text[],'base','Lugares, horários e números',5),
  ('lesson-numbers-a1-03','course-numbers-a1','A1',250,true,ARRAY['lesson-numbers-a1-02']::text[],'base','Lugares, horários e números',5),
  ('lesson-numbers-a1-04','course-numbers-a1','A1',260,true,ARRAY['lesson-numbers-a1-03']::text[],'base','Lugares, horários e números',5),
  ('lesson-1000-words-a1-03','course-1000-words-a1','A1',270,true,ARRAY['lesson-numbers-a1-04']::text[],'base','Lugares, horários e números',5),
  ('lesson-1000-words-a1-05','course-1000-words-a1','A1',280,true,ARRAY['lesson-1000-words-a1-03']::text[],'base','Lugares, horários e números',5),
  ('lesson-1000-words-a1-06','course-1000-words-a1','A1',290,true,ARRAY['lesson-1000-words-a1-05']::text[],'base','Lugares, horários e números',5),
  ('lesson-1000-words-a1-07','course-1000-words-a1','A1',300,true,ARRAY['lesson-1000-words-a1-06']::text[],'base','Lugares, horários e números',5),
  ('lesson-1000-words-a1-10','course-1000-words-a1','A1',310,true,ARRAY['lesson-1000-words-a1-07']::text[],'base','Lugares, horários e números',5),
  ('lesson-1000-words-a1-14','course-1000-words-a1','A1',320,true,ARRAY['lesson-1000-words-a1-10']::text[],'base','Lugares, horários e números',5),
  ('lesson-1000-words-a1-15','course-1000-words-a1','A1',330,true,ARRAY['lesson-1000-words-a1-14']::text[],'base','Lugares, horários e números',5),
  ('lesson-pedagogy-a1-some-any','course-pedagogy-a1','A1',340,true,ARRAY['lesson-1000-words-a1-15']::text[],'base','Gostos, pedidos e quantidades',6),
  ('lesson-pedagogy-a1-basic-connectors','course-pedagogy-a1','A1',350,true,ARRAY['lesson-pedagogy-a1-some-any']::text[],'base','Gostos, pedidos e quantidades',6),
  ('lesson-first-sentences-a1-10','course-first-sentences-a1','A1',360,true,ARRAY['lesson-pedagogy-a1-basic-connectors']::text[],'base','Gostos, pedidos e quantidades',6),
  ('lesson-1000-words-a1-11','course-1000-words-a1','A1',370,true,ARRAY['lesson-first-sentences-a1-10']::text[],'base','Gostos, pedidos e quantidades',6),
  ('lesson-first-sentences-a1-08','course-first-sentences-a1','A1',380,true,ARRAY['lesson-1000-words-a1-11']::text[],'base','Habilidades e instruções',7),
  ('lesson-first-sentences-a1-09','course-first-sentences-a1','A1',390,true,ARRAY['lesson-first-sentences-a1-08']::text[],'base','Habilidades e instruções',7),
  ('lesson-pedagogy-a1-now','course-pedagogy-a1','A1',400,true,ARRAY['lesson-first-sentences-a1-09']::text[],'base','Ações acontecendo agora e revisão',8),
  ('lesson-tenses-b1-01','course-tenses-b1','A2',410,true,ARRAY[]::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-02','course-1000-words-a1','A2',420,true,ARRAY['lesson-tenses-b1-01']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-08','course-1000-words-a1','A2',430,true,ARRAY['lesson-1000-words-a1-02']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-12','course-1000-words-a1','A2',440,true,ARRAY['lesson-1000-words-a1-08']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-13','course-1000-words-a1','A2',450,true,ARRAY['lesson-1000-words-a1-12']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-16','course-1000-words-a1','A2',460,true,ARRAY['lesson-1000-words-a1-13']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-17','course-1000-words-a1','A2',470,true,ARRAY['lesson-1000-words-a1-16']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-19','course-1000-words-a1','A2',480,true,ARRAY['lesson-1000-words-a1-17']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-20','course-1000-words-a1','A2',490,true,ARRAY['lesson-1000-words-a1-19']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-21','course-1000-words-a1','A2',500,true,ARRAY['lesson-1000-words-a1-20']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-22','course-1000-words-a1','A2',510,true,ARRAY['lesson-1000-words-a1-21']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-23','course-1000-words-a1','A2',520,true,ARRAY['lesson-1000-words-a1-22']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-24','course-1000-words-a1','A2',530,true,ARRAY['lesson-1000-words-a1-23']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-27','course-1000-words-a1','A2',540,false,ARRAY['lesson-1000-words-a1-24']::text[],'extra','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-28','course-1000-words-a1','A2',550,false,ARRAY['lesson-1000-words-a1-24']::text[],'extra','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-29','course-1000-words-a1','A2',560,false,ARRAY['lesson-1000-words-a1-24']::text[],'extra','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-30','course-1000-words-a1','A2',570,true,ARRAY['lesson-1000-words-a1-24']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-31','course-1000-words-a1','A2',580,true,ARRAY['lesson-1000-words-a1-30']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-32','course-1000-words-a1','A2',590,true,ARRAY['lesson-1000-words-a1-31']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-33','course-1000-words-a1','A2',600,false,ARRAY['lesson-1000-words-a1-32']::text[],'extra','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-34','course-1000-words-a1','A2',610,true,ARRAY['lesson-1000-words-a1-32']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-35','course-1000-words-a1','A2',620,true,ARRAY['lesson-1000-words-a1-34']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-36','course-1000-words-a1','A2',630,true,ARRAY['lesson-1000-words-a1-35']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-39','course-1000-words-a1','A2',640,true,ARRAY['lesson-1000-words-a1-36']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-40','course-1000-words-a1','A2',650,true,ARRAY['lesson-1000-words-a1-39']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-41','course-1000-words-a1','A2',660,true,ARRAY['lesson-1000-words-a1-40']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-43','course-1000-words-a1','A2',670,true,ARRAY['lesson-1000-words-a1-41']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-1000-words-a1-44','course-1000-words-a1','A2',680,true,ARRAY['lesson-1000-words-a1-43']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-routine-a2-01','course-routine-a2','A2',690,true,ARRAY['lesson-1000-words-a1-44']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-routine-a2-02','course-routine-a2','A2',700,true,ARRAY['lesson-routine-a2-01']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-routine-a2-03','course-routine-a2','A2',710,true,ARRAY['lesson-routine-a2-02']::text[],'base','Presente em contraste e descrições',1),
  ('lesson-pedagogy-a2-past-simple','course-pedagogy-a2','A2',720,true,ARRAY['lesson-routine-a2-03']::text[],'base','Passado e experiências simples',2),
  ('lesson-first-sentences-a1-11','course-first-sentences-a1','A2',730,true,ARRAY['lesson-pedagogy-a2-past-simple']::text[],'base','Passado e experiências simples',2),
  ('lesson-first-sentences-a1-12','course-first-sentences-a1','A2',740,true,ARRAY['lesson-first-sentences-a1-11']::text[],'base','Passado e experiências simples',2),
  ('lesson-tenses-b1-02','course-tenses-b1','A2',750,true,ARRAY['lesson-first-sentences-a1-12']::text[],'base','Passado e experiências simples',2),
  ('lesson-pedagogy-a2-comparatives','course-pedagogy-a2','A2',760,true,ARRAY['lesson-tenses-b1-02']::text[],'base','Comparação e quantidade',3),
  ('lesson-pedagogy-a2-superlatives','course-pedagogy-a2','A2',770,true,ARRAY['lesson-pedagogy-a2-comparatives']::text[],'base','Comparação e quantidade',3),
  ('lesson-pedagogy-a2-countability','course-pedagogy-a2','A2',780,true,ARRAY['lesson-pedagogy-a2-superlatives']::text[],'base','Comparação e quantidade',3),
  ('lesson-pedagogy-a2-too-enough','course-pedagogy-a2','A2',790,true,ARRAY['lesson-pedagogy-a2-countability']::text[],'base','Comparação e quantidade',3),
  ('lesson-prepositions-b1-01','course-prepositions-b1','A2',800,true,ARRAY['lesson-pedagogy-a2-too-enough']::text[],'base','Planos e futuro',4),
  ('lesson-tenses-b1-05','course-tenses-b1','A2',810,true,ARRAY['lesson-prepositions-b1-01']::text[],'base','Planos e futuro',4),
  ('lesson-numbers-a1-01','course-numbers-a1','A2',820,true,ARRAY['lesson-tenses-b1-05']::text[],'base','Planos e futuro',4),
  ('lesson-numbers-a1-05','course-numbers-a1','A2',830,true,ARRAY['lesson-numbers-a1-01']::text[],'base','Planos e futuro',4),
  ('lesson-numbers-a1-06','course-numbers-a1','A2',840,true,ARRAY['lesson-numbers-a1-05']::text[],'base','Planos e futuro',4),
  ('lesson-numbers-a1-07','course-numbers-a1','A2',850,false,ARRAY['lesson-numbers-a1-06']::text[],'extra','Planos e futuro',4),
  ('lesson-numbers-a1-08','course-numbers-a1','A2',860,true,ARRAY['lesson-numbers-a1-06']::text[],'base','Planos e futuro',4),
  ('lesson-routine-a2-05','course-routine-a2','A2',870,true,ARRAY['lesson-numbers-a1-08']::text[],'base','Planos e futuro',4),
  ('lesson-routine-a2-06','course-routine-a2','A2',880,true,ARRAY['lesson-routine-a2-05']::text[],'base','Planos e futuro',4),
  ('lesson-pedagogy-a2-advice-rules','course-pedagogy-a2','A2',890,true,ARRAY['lesson-routine-a2-06']::text[],'base','Conselho, obrigação e regras',5),
  ('lesson-modals-b1-01','course-modals-b1','A2',900,true,ARRAY['lesson-pedagogy-a2-advice-rules']::text[],'base','Conselho, obrigação e regras',5),
  ('lesson-modals-b1-02','course-modals-b1','A2',910,true,ARRAY['lesson-modals-b1-01']::text[],'base','Conselho, obrigação e regras',5),
  ('lesson-modals-b1-07','course-modals-b1','A2',920,true,ARRAY['lesson-modals-b1-02']::text[],'base','Conselho, obrigação e regras',5),
  ('lesson-pedagogy-a2-simple-conditionals','course-pedagogy-a2','A2',930,true,ARRAY['lesson-modals-b1-07']::text[],'base','Condições simples e finalidade',6),
  ('lesson-pedagogy-a2-verb-patterns','course-pedagogy-a2','A2',940,true,ARRAY['lesson-pedagogy-a2-simple-conditionals']::text[],'base','Condições simples e finalidade',6),
  ('lesson-pedagogy-a2-purpose-sequence','course-pedagogy-a2','A2',950,true,ARRAY['lesson-pedagogy-a2-verb-patterns']::text[],'base','Condições simples e finalidade',6),
  ('lesson-prepositions-b1-03','course-prepositions-b1','A2',960,true,ARRAY['lesson-pedagogy-a2-purpose-sequence']::text[],'base','Condições simples e finalidade',6),
  ('lesson-collocations-b2-02','course-collocations-b2','A2',970,true,ARRAY['lesson-prepositions-b1-03']::text[],'base','Condições simples e finalidade',6),
  ('lesson-survival-a2-01','course-survival-a2','A2',980,true,ARRAY['lesson-collocations-b2-02']::text[],'base','Serviços e resolução de problemas',7),
  ('lesson-survival-a2-02','course-survival-a2','A2',990,true,ARRAY['lesson-survival-a2-01']::text[],'base','Serviços e resolução de problemas',7),
  ('lesson-survival-a2-03','course-survival-a2','A2',1000,true,ARRAY['lesson-survival-a2-02']::text[],'base','Serviços e resolução de problemas',7),
  ('lesson-survival-a2-04','course-survival-a2','A2',1010,false,ARRAY['lesson-survival-a2-03']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-survival-a2-06','course-survival-a2','A2',1020,false,ARRAY['lesson-survival-a2-03']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-survival-a2-07','course-survival-a2','A2',1030,false,ARRAY['lesson-survival-a2-03']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-survival-a2-08','course-survival-a2','A2',1040,true,ARRAY['lesson-survival-a2-03']::text[],'base','Serviços e resolução de problemas',7),
  ('lesson-survival-a2-09','course-survival-a2','A2',1050,false,ARRAY['lesson-survival-a2-08']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-survival-a2-10','course-survival-a2','A2',1060,true,ARRAY['lesson-survival-a2-08']::text[],'base','Serviços e resolução de problemas',7),
  ('lesson-shopping-a2-01','course-shopping-a2','A2',1070,true,ARRAY['lesson-survival-a2-10']::text[],'base','Serviços e resolução de problemas',7),
  ('lesson-shopping-a2-02','course-shopping-a2','A2',1080,true,ARRAY['lesson-shopping-a2-01']::text[],'base','Serviços e resolução de problemas',7),
  ('lesson-shopping-a2-03','course-shopping-a2','A2',1090,true,ARRAY['lesson-shopping-a2-02']::text[],'base','Serviços e resolução de problemas',7),
  ('lesson-health-a2-01','course-health-a2','A2',1100,true,ARRAY['lesson-shopping-a2-03']::text[],'base','Serviços e resolução de problemas',7),
  ('lesson-health-a2-03','course-health-a2','A2',1110,false,ARRAY['lesson-health-a2-01']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-health-a2-04','course-health-a2','A2',1120,false,ARRAY['lesson-health-a2-01']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-social-a2-02','course-social-a2','A2',1130,true,ARRAY['lesson-health-a2-01']::text[],'base','Serviços e resolução de problemas',7),
  ('lesson-social-a2-04','course-social-a2','A2',1140,true,ARRAY['lesson-social-a2-02']::text[],'base','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-01','course-travel-a2','A2',1150,false,ARRAY['lesson-social-a2-04']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-02','course-travel-a2','A2',1160,true,ARRAY['lesson-social-a2-04']::text[],'base','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-03','course-travel-a2','A2',1170,true,ARRAY['lesson-travel-a2-02']::text[],'base','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-04','course-travel-a2','A2',1180,false,ARRAY['lesson-travel-a2-03']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-05','course-travel-a2','A2',1190,true,ARRAY['lesson-travel-a2-03']::text[],'base','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-07','course-travel-a2','A2',1200,false,ARRAY['lesson-travel-a2-05']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-08','course-travel-a2','A2',1210,false,ARRAY['lesson-travel-a2-05']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-10','course-travel-a2','A2',1220,true,ARRAY['lesson-travel-a2-05']::text[],'base','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-11','course-travel-a2','A2',1230,true,ARRAY['lesson-travel-a2-10']::text[],'base','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-12','course-travel-a2','A2',1240,false,ARRAY['lesson-travel-a2-11']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-13','course-travel-a2','A2',1250,false,ARRAY['lesson-travel-a2-11']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-14','course-travel-a2','A2',1260,false,ARRAY['lesson-travel-a2-11']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-15','course-travel-a2','A2',1270,false,ARRAY['lesson-travel-a2-11']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-16','course-travel-a2','A2',1280,false,ARRAY['lesson-travel-a2-11']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-17','course-travel-a2','A2',1290,false,ARRAY['lesson-travel-a2-11']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-18','course-travel-a2','A2',1300,false,ARRAY['lesson-travel-a2-11']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-19','course-travel-a2','A2',1310,false,ARRAY['lesson-travel-a2-11']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-21','course-travel-a2','A2',1320,false,ARRAY['lesson-travel-a2-11']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-22','course-travel-a2','A2',1330,false,ARRAY['lesson-travel-a2-11']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-23','course-travel-a2','A2',1340,false,ARRAY['lesson-travel-a2-11']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-25','course-travel-a2','A2',1350,false,ARRAY['lesson-travel-a2-11']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-travel-a2-26','course-travel-a2','A2',1360,false,ARRAY['lesson-travel-a2-11']::text[],'optional','Serviços e resolução de problemas',7),
  ('lesson-pedagogy-a2-recent-experiences','course-pedagogy-a2','A2',1370,true,ARRAY['lesson-travel-a2-11']::text[],'base','Experiências recentes e revisão',8),
  ('lesson-connected-b2-05','course-connected-speech-b2','A2',1380,true,ARRAY['lesson-pedagogy-a2-recent-experiences']::text[],'base','Experiências recentes e revisão',8),
  ('lesson-tenses-b1-03','course-tenses-b1','B1',1390,true,ARRAY[]::text[],'base','Experiência e duração',1),
  ('lesson-pedagogy-b1-duration','course-pedagogy-b1','B1',1400,true,ARRAY['lesson-tenses-b1-03']::text[],'base','Experiência e duração',1),
  ('lesson-tenses-b1-04','course-tenses-b1','B1',1410,true,ARRAY['lesson-pedagogy-b1-duration']::text[],'base','Experiência e duração',1),
  ('lesson-pedagogy-b1-used-to','course-pedagogy-b1','B1',1420,true,ARRAY['lesson-tenses-b1-04']::text[],'base','Narrativas e hábitos passados',2),
  ('lesson-tenses-b1-06','course-tenses-b1','B1',1430,true,ARRAY['lesson-pedagogy-b1-used-to']::text[],'base','Narrativas e hábitos passados',2),
  ('lesson-routine-a2-04','course-routine-a2','B1',1440,true,ARRAY['lesson-tenses-b1-06']::text[],'base','Narrativas e hábitos passados',2),
  ('lesson-pedagogy-b1-probability','course-pedagogy-b1','B1',1450,true,ARRAY['lesson-routine-a2-04']::text[],'base','Possibilidades e hipóteses',3),
  ('lesson-tenses-b1-07','course-tenses-b1','B1',1460,true,ARRAY['lesson-pedagogy-b1-probability']::text[],'base','Possibilidades e hipóteses',3),
  ('lesson-tenses-b1-08','course-tenses-b1','B1',1470,true,ARRAY['lesson-tenses-b1-07']::text[],'base','Possibilidades e hipóteses',3),
  ('lesson-tenses-b1-14','course-tenses-b1','B1',1480,true,ARRAY['lesson-tenses-b1-08']::text[],'base','Possibilidades e hipóteses',3),
  ('lesson-modals-b1-06','course-modals-b1','B1',1490,true,ARRAY['lesson-tenses-b1-14']::text[],'base','Possibilidades e hipóteses',3),
  ('lesson-pedagogy-b1-simple-relatives','course-pedagogy-b1','B1',1500,true,ARRAY['lesson-modals-b1-06']::text[],'base','Descrever e especificar',4),
  ('lesson-pedagogy-b1-polite-questions','course-pedagogy-b1','B1',1510,true,ARRAY['lesson-pedagogy-b1-simple-relatives']::text[],'base','Descrever e especificar',4),
  ('lesson-prepositions-b1-04','course-prepositions-b1','B1',1520,true,ARRAY['lesson-pedagogy-b1-polite-questions']::text[],'base','Descrever e especificar',4),
  ('lesson-tenses-b1-10','course-tenses-b1','B1',1530,true,ARRAY['lesson-prepositions-b1-04']::text[],'base','Relatar informação',5),
  ('lesson-tenses-b1-12','course-tenses-b1','B1',1540,true,ARRAY['lesson-tenses-b1-10']::text[],'base','Relatar informação',5),
  ('lesson-tenses-b1-13','course-tenses-b1','B1',1550,true,ARRAY['lesson-tenses-b1-12']::text[],'base','Relatar informação',5),
  ('lesson-pedagogy-b1-reasons-contrast','course-pedagogy-b1','B1',1560,true,ARRAY['lesson-tenses-b1-13']::text[],'base','Explicar razões e contrastes',6),
  ('lesson-prepositions-b1-06','course-prepositions-b1','B1',1570,true,ARRAY['lesson-pedagogy-b1-reasons-contrast']::text[],'base','Explicar razões e contrastes',6),
  ('lesson-pedagogy-b1-phrasal-context','course-pedagogy-b1','B1',1580,true,ARRAY['lesson-prepositions-b1-06']::text[],'base','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-01','course-essential-verbs-a1','B1',1590,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-02','course-essential-verbs-a1','B1',1600,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-03','course-essential-verbs-a1','B1',1610,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-04','course-essential-verbs-a1','B1',1620,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-05','course-essential-verbs-a1','B1',1630,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-06','course-essential-verbs-a1','B1',1640,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-07','course-essential-verbs-a1','B1',1650,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-08','course-essential-verbs-a1','B1',1660,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-09','course-essential-verbs-a1','B1',1670,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-10','course-essential-verbs-a1','B1',1680,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-11','course-essential-verbs-a1','B1',1690,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-12','course-essential-verbs-a1','B1',1700,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-13','course-essential-verbs-a1','B1',1710,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-14','course-essential-verbs-a1','B1',1720,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-15','course-essential-verbs-a1','B1',1730,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-16','course-essential-verbs-a1','B1',1740,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-17','course-essential-verbs-a1','B1',1750,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-18','course-essential-verbs-a1','B1',1760,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-19','course-essential-verbs-a1','B1',1770,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-20','course-essential-verbs-a1','B1',1780,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-21','course-essential-verbs-a1','B1',1790,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-22','course-essential-verbs-a1','B1',1800,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-23','course-essential-verbs-a1','B1',1810,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-24','course-essential-verbs-a1','B1',1820,false,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-1000-words-a1-25','course-1000-words-a1','B1',1830,true,ARRAY['lesson-pedagogy-b1-phrasal-context']::text[],'base','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-25','course-essential-verbs-a1','B1',1840,false,ARRAY['lesson-1000-words-a1-25']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-26','course-essential-verbs-a1','B1',1850,false,ARRAY['lesson-1000-words-a1-25']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-27','course-essential-verbs-a1','B1',1860,false,ARRAY['lesson-1000-words-a1-25']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-28','course-essential-verbs-a1','B1',1870,false,ARRAY['lesson-1000-words-a1-25']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-29','course-essential-verbs-a1','B1',1880,false,ARRAY['lesson-1000-words-a1-25']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-30','course-essential-verbs-a1','B1',1890,false,ARRAY['lesson-1000-words-a1-25']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-31','course-essential-verbs-a1','B1',1900,false,ARRAY['lesson-1000-words-a1-25']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-32','course-essential-verbs-a1','B1',1910,false,ARRAY['lesson-1000-words-a1-25']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-33','course-essential-verbs-a1','B1',1920,false,ARRAY['lesson-1000-words-a1-25']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-34','course-essential-verbs-a1','B1',1930,false,ARRAY['lesson-1000-words-a1-25']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-35','course-essential-verbs-a1','B1',1940,false,ARRAY['lesson-1000-words-a1-25']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-36','course-essential-verbs-a1','B1',1950,false,ARRAY['lesson-1000-words-a1-25']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-1000-words-a1-37','course-1000-words-a1','B1',1960,false,ARRAY['lesson-1000-words-a1-25']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-37','course-essential-verbs-a1','B1',1970,false,ARRAY['lesson-1000-words-a1-25']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-38','course-essential-verbs-a1','B1',1980,false,ARRAY['lesson-1000-words-a1-25']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-39','course-essential-verbs-a1','B1',1990,false,ARRAY['lesson-1000-words-a1-25']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-40','course-essential-verbs-a1','B1',2000,false,ARRAY['lesson-1000-words-a1-25']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-41','course-essential-verbs-a1','B1',2010,false,ARRAY['lesson-1000-words-a1-25']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-1000-words-a1-42','course-1000-words-a1','B1',2020,true,ARRAY['lesson-1000-words-a1-25']::text[],'base','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-42','course-essential-verbs-a1','B1',2030,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-43','course-essential-verbs-a1','B1',2040,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-44','course-essential-verbs-a1','B1',2050,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-45','course-essential-verbs-a1','B1',2060,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-46','course-essential-verbs-a1','B1',2070,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-47','course-essential-verbs-a1','B1',2080,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-48','course-essential-verbs-a1','B1',2090,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-49','course-essential-verbs-a1','B1',2100,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-50','course-essential-verbs-a1','B1',2110,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-51','course-essential-verbs-a1','B1',2120,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-52','course-essential-verbs-a1','B1',2130,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-53','course-essential-verbs-a1','B1',2140,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-54','course-essential-verbs-a1','B1',2150,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-55','course-essential-verbs-a1','B1',2160,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-56','course-essential-verbs-a1','B1',2170,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-57','course-essential-verbs-a1','B1',2180,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-58','course-essential-verbs-a1','B1',2190,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-59','course-essential-verbs-a1','B1',2200,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-essential-verbs-a1-60','course-essential-verbs-a1','B1',2210,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-phrasal-b1-02','course-phrasal-b1','B1',2220,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-phrasal-b1-04','course-phrasal-b1','B1',2230,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-phrasal-b1-06','course-phrasal-b1','B1',2240,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-phrasal-b1-08','course-phrasal-b1','B1',2250,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-phrasal-b1-12','course-phrasal-b1','B1',2260,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-phrasal-b1-14','course-phrasal-b1','B1',2270,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-phrasal-b1-15','course-phrasal-b1','B1',2280,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-phrasal-b1-18','course-phrasal-b1','B1',2290,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-phrasal-b1-19','course-phrasal-b1','B1',2300,false,ARRAY['lesson-1000-words-a1-42']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-collocations-b2-01','course-collocations-b2','B1',2310,true,ARRAY['lesson-1000-words-a1-42']::text[],'base','Phrasal verbs e colocações frequentes',7),
  ('lesson-connected-b2-02','course-connected-speech-b2','B1',2320,true,ARRAY['lesson-collocations-b2-01']::text[],'base','Phrasal verbs e colocações frequentes',7),
  ('lesson-connected-b2-03','course-connected-speech-b2','B1',2330,true,ARRAY['lesson-connected-b2-02']::text[],'base','Phrasal verbs e colocações frequentes',7),
  ('lesson-connected-b2-04','course-connected-speech-b2','B1',2340,false,ARRAY['lesson-connected-b2-03']::text[],'extra','Phrasal verbs e colocações frequentes',7),
  ('lesson-survival-a2-05','course-survival-a2','B1',2350,false,ARRAY['lesson-connected-b2-03']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-shopping-a2-04','course-shopping-a2','B1',2360,true,ARRAY['lesson-connected-b2-03']::text[],'base','Opinião, problemas e conversas',8),
  ('lesson-shopping-a2-05','course-shopping-a2','B1',2370,false,ARRAY['lesson-shopping-a2-04']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-shopping-a2-06','course-shopping-a2','B1',2380,true,ARRAY['lesson-shopping-a2-04']::text[],'base','Opinião, problemas e conversas',8),
  ('lesson-health-a2-02','course-health-a2','B1',2390,true,ARRAY['lesson-shopping-a2-06']::text[],'base','Opinião, problemas e conversas',8),
  ('lesson-health-a2-05','course-health-a2','B1',2400,true,ARRAY['lesson-health-a2-02']::text[],'base','Opinião, problemas e conversas',8),
  ('lesson-health-a2-06','course-health-a2','B1',2410,false,ARRAY['lesson-health-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-social-a2-01','course-social-a2','B1',2420,true,ARRAY['lesson-health-a2-05']::text[],'base','Opinião, problemas e conversas',8),
  ('lesson-social-a2-03','course-social-a2','B1',2430,true,ARRAY['lesson-social-a2-01']::text[],'base','Opinião, problemas e conversas',8),
  ('lesson-social-a2-05','course-social-a2','B1',2440,true,ARRAY['lesson-social-a2-03']::text[],'base','Opinião, problemas e conversas',8),
  ('lesson-travel-a2-06','course-travel-a2','B1',2450,false,ARRAY['lesson-social-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-travel-a2-09','course-travel-a2','B1',2460,false,ARRAY['lesson-social-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-travel-a2-20','course-travel-a2','B1',2470,false,ARRAY['lesson-social-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-travel-a2-24','course-travel-a2','B1',2480,false,ARRAY['lesson-social-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-travel-a2-27','course-travel-a2','B1',2490,false,ARRAY['lesson-social-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-work-b1-03','course-work-b1','B1',2500,false,ARRAY['lesson-social-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-work-b1-04','course-work-b1','B1',2510,false,ARRAY['lesson-social-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-work-b1-07','course-work-b1','B1',2520,false,ARRAY['lesson-social-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-work-b1-09','course-work-b1','B1',2530,false,ARRAY['lesson-social-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-work-b1-10','course-work-b1','B1',2540,false,ARRAY['lesson-social-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-work-b1-12','course-work-b1','B1',2550,false,ARRAY['lesson-social-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-work-b1-13','course-work-b1','B1',2560,false,ARRAY['lesson-social-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-interview-b1-01','course-interview-b1','B1',2570,false,ARRAY['lesson-social-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-interview-b1-02','course-interview-b1','B1',2580,false,ARRAY['lesson-social-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-interview-b1-03','course-interview-b1','B1',2590,false,ARRAY['lesson-social-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-interview-b1-04','course-interview-b1','B1',2600,false,ARRAY['lesson-social-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-interview-b1-05','course-interview-b1','B1',2610,false,ARRAY['lesson-social-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-interview-b1-08','course-interview-b1','B1',2620,false,ARRAY['lesson-social-a2-05']::text[],'optional','Opinião, problemas e conversas',8),
  ('lesson-street-a1-02','course-street-a1','B1',2630,false,ARRAY['lesson-social-a2-05']::text[],'extra','Opinião, problemas e conversas',8),
  ('lesson-street-a1-03','course-street-a1','B1',2640,true,ARRAY['lesson-social-a2-05']::text[],'base','Opinião, problemas e conversas',8),
  ('lesson-street-a1-04','course-street-a1','B1',2650,true,ARRAY['lesson-street-a1-03']::text[],'base','Opinião, problemas e conversas',8),
  ('lesson-street-a1-05','course-street-a1','B1',2660,false,ARRAY['lesson-street-a1-04']::text[],'extra','Opinião, problemas e conversas',8),
  ('lesson-street-a1-06','course-street-a1','B1',2670,false,ARRAY['lesson-street-a1-04']::text[],'extra','Opinião, problemas e conversas',8),
  ('lesson-street-a1-07','course-street-a1','B1',2680,false,ARRAY['lesson-street-a1-04']::text[],'extra','Opinião, problemas e conversas',8),
  ('lesson-street-a1-08','course-street-a1','B1',2690,false,ARRAY['lesson-street-a1-04']::text[],'extra','Opinião, problemas e conversas',8),
  ('lesson-street-a1-11','course-street-a1','B1',2700,false,ARRAY['lesson-street-a1-04']::text[],'extra','Opinião, problemas e conversas',8),
  ('lesson-idioms-b2-04','course-idioms-b2','B1',2710,true,ARRAY['lesson-street-a1-04']::text[],'base','Opinião, problemas e conversas',8),
  ('lesson-idioms-b2-06','course-idioms-b2','B1',2720,true,ARRAY['lesson-idioms-b2-04']::text[],'base','Opinião, problemas e conversas',8),
  ('lesson-stories-b1-01','course-stories-b1','B1',2730,true,ARRAY['lesson-idioms-b2-06']::text[],'base','Histórias e parágrafos',9),
  ('lesson-stories-b1-02','course-stories-b1','B1',2740,true,ARRAY['lesson-stories-b1-01']::text[],'base','Histórias e parágrafos',9),
  ('lesson-stories-b1-03','course-stories-b1','B1',2750,false,ARRAY['lesson-stories-b1-02']::text[],'extra','Histórias e parágrafos',9),
  ('lesson-stories-b1-04','course-stories-b1','B1',2760,true,ARRAY['lesson-stories-b1-02']::text[],'base','Histórias e parágrafos',9),
  ('lesson-stories-b1-05','course-stories-b1','B1',2770,false,ARRAY['lesson-stories-b1-04']::text[],'extra','Histórias e parágrafos',9),
  ('lesson-stories-b1-06','course-stories-b1','B1',2780,false,ARRAY['lesson-stories-b1-04']::text[],'extra','Histórias e parágrafos',9),
  ('lesson-stories-b1-07','course-stories-b1','B1',2790,false,ARRAY['lesson-stories-b1-04']::text[],'extra','Histórias e parágrafos',9),
  ('lesson-stories-b1-08','course-stories-b1','B1',2800,false,ARRAY['lesson-stories-b1-04']::text[],'extra','Histórias e parágrafos',9),
  ('lesson-stories-b1-09','course-stories-b1','B1',2810,true,ARRAY['lesson-stories-b1-04']::text[],'base','Histórias e parágrafos',9),
  ('lesson-stories-b1-10','course-stories-b1','B1',2820,false,ARRAY['lesson-stories-b1-09']::text[],'extra','Histórias e parágrafos',9),
  ('lesson-paragraphs-b2-01','course-paragraphs-b2','B1',2830,true,ARRAY['lesson-stories-b1-09']::text[],'base','Histórias e parágrafos',9),
  ('lesson-paragraphs-b2-02','course-paragraphs-b2','B1',2840,false,ARRAY['lesson-paragraphs-b2-01']::text[],'extra','Histórias e parágrafos',9),
  ('lesson-paragraphs-b2-03','course-paragraphs-b2','B1',2850,false,ARRAY['lesson-paragraphs-b2-01']::text[],'extra','Histórias e parágrafos',9),
  ('lesson-paragraphs-b2-04','course-paragraphs-b2','B1',2860,true,ARRAY['lesson-paragraphs-b2-01']::text[],'base','Histórias e parágrafos',9),
  ('lesson-paragraphs-b2-08','course-paragraphs-b2','B1',2870,true,ARRAY['lesson-paragraphs-b2-04']::text[],'base','Histórias e parágrafos',9),
  ('lesson-pedagogy-b1-integrated','course-pedagogy-b1','B1',2880,true,ARRAY['lesson-paragraphs-b2-08']::text[],'base','Revisão integradora',10),
  ('lesson-pedagogy-b2-future-perfect','course-pedagogy-b2','B2',2890,true,ARRAY[]::text[],'base','Narrativas e especulação',1),
  ('lesson-pedagogy-b2-accustomed','course-pedagogy-b2','B2',2900,true,ARRAY['lesson-pedagogy-b2-future-perfect']::text[],'base','Narrativas e especulação',1),
  ('lesson-tenses-b1-15','course-tenses-b1','B2',2910,true,ARRAY['lesson-pedagogy-b2-accustomed']::text[],'base','Narrativas e especulação',1),
  ('lesson-modals-b1-03','course-modals-b1','B2',2920,true,ARRAY['lesson-tenses-b1-15']::text[],'base','Narrativas e especulação',1),
  ('lesson-modals-b1-04','course-modals-b1','B2',2930,true,ARRAY['lesson-modals-b1-03']::text[],'base','Narrativas e especulação',1),
  ('lesson-modals-b1-05','course-modals-b1','B2',2940,true,ARRAY['lesson-modals-b1-04']::text[],'base','Narrativas e especulação',1),
  ('lesson-modals-b1-08','course-modals-b1','B2',2950,true,ARRAY['lesson-modals-b1-05']::text[],'base','Narrativas e especulação',1),
  ('lesson-pedagogy-b2-unless','course-pedagogy-b2','B2',2960,true,ARRAY['lesson-modals-b1-08']::text[],'base','Condicionais e arrependimento',2),
  ('lesson-tenses-b1-09','course-tenses-b1','B2',2970,true,ARRAY['lesson-pedagogy-b2-unless']::text[],'base','Condicionais e arrependimento',2),
  ('lesson-grammar-b2-01','course-grammar-b2','B2',2980,true,ARRAY['lesson-tenses-b1-09']::text[],'base','Condicionais e arrependimento',2),
  ('lesson-grammar-b2-02','course-grammar-b2','B2',2990,true,ARRAY['lesson-grammar-b2-01']::text[],'base','Condicionais e arrependimento',2),
  ('lesson-tenses-b1-11','course-tenses-b1','B2',3000,true,ARRAY['lesson-grammar-b2-02']::text[],'base','Passivas e causativo',3),
  ('lesson-grammar-b2-03','course-grammar-b2','B2',3010,true,ARRAY['lesson-tenses-b1-11']::text[],'base','Passivas e causativo',3),
  ('lesson-grammar-b2-04','course-grammar-b2','B2',3020,true,ARRAY['lesson-grammar-b2-03']::text[],'base','Relativas e complementos verbais',4),
  ('lesson-grammar-b2-05','course-grammar-b2','B2',3030,true,ARRAY['lesson-grammar-b2-04']::text[],'base','Relativas e complementos verbais',4),
  ('lesson-pedagogy-b2-intensity','course-pedagogy-b2','B2',3040,true,ARRAY['lesson-grammar-b2-05']::text[],'base','Precisão e organização do discurso',5),
  ('lesson-pedagogy-b2-reference-articles','course-pedagogy-b2','B2',3050,true,ARRAY['lesson-pedagogy-b2-intensity']::text[],'base','Precisão e organização do discurso',5),
  ('lesson-prepositions-b1-05','course-prepositions-b1','B2',3060,true,ARRAY['lesson-pedagogy-b2-reference-articles']::text[],'base','Precisão e organização do discurso',5),
  ('lesson-pedagogy-b2-argument-structure','course-pedagogy-b2','B2',3070,true,ARRAY['lesson-prepositions-b1-05']::text[],'base','Argumentação',6),
  ('lesson-debate-b2-01','course-debate-b2','B2',3080,true,ARRAY['lesson-pedagogy-b2-argument-structure']::text[],'base','Argumentação',6),
  ('lesson-debate-b2-02','course-debate-b2','B2',3090,true,ARRAY['lesson-debate-b2-01']::text[],'base','Argumentação',6),
  ('lesson-debate-b2-03','course-debate-b2','B2',3100,true,ARRAY['lesson-debate-b2-02']::text[],'base','Argumentação',6),
  ('lesson-debate-b2-04','course-debate-b2','B2',3110,true,ARRAY['lesson-debate-b2-03']::text[],'base','Argumentação',6),
  ('lesson-debate-b2-05','course-debate-b2','B2',3120,true,ARRAY['lesson-debate-b2-04']::text[],'base','Argumentação',6),
  ('lesson-debate-b2-06','course-debate-b2','B2',3130,true,ARRAY['lesson-debate-b2-05']::text[],'base','Argumentação',6),
  ('lesson-paragraphs-b2-05','course-paragraphs-b2','B2',3140,true,ARRAY['lesson-debate-b2-06']::text[],'base','Argumentação',6),
  ('lesson-paragraphs-b2-06','course-paragraphs-b2','B2',3150,false,ARRAY['lesson-paragraphs-b2-05']::text[],'optional','Argumentação',6),
  ('lesson-paragraphs-b2-07','course-paragraphs-b2','B2',3160,false,ARRAY['lesson-paragraphs-b2-05']::text[],'extra','Argumentação',6),
  ('lesson-paragraphs-b2-09','course-paragraphs-b2','B2',3170,true,ARRAY['lesson-paragraphs-b2-05']::text[],'base','Argumentação',6),
  ('lesson-paragraphs-b2-10','course-paragraphs-b2','B2',3180,false,ARRAY['lesson-paragraphs-b2-09']::text[],'extra','Argumentação',6),
  ('lesson-social-a2-06','course-social-a2','B2',3190,true,ARRAY['lesson-paragraphs-b2-09']::text[],'base','Registro e linguagem indireta',7),
  ('lesson-register-c1-01','course-register-c1','B2',3200,true,ARRAY['lesson-social-a2-06']::text[],'base','Registro e linguagem indireta',7),
  ('lesson-negotiation-b2-01','course-negotiation-b2','B2',3210,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-work-b1-01','course-work-b1','B2',3220,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-negotiation-b2-02','course-negotiation-b2','B2',3230,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-work-b1-02','course-work-b1','B2',3240,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-negotiation-b2-03','course-negotiation-b2','B2',3250,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-negotiation-b2-04','course-negotiation-b2','B2',3260,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-negotiation-b2-05','course-negotiation-b2','B2',3270,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-work-b1-05','course-work-b1','B2',3280,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-negotiation-b2-06','course-negotiation-b2','B2',3290,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-work-b1-06','course-work-b1','B2',3300,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-negotiation-b2-07','course-negotiation-b2','B2',3310,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-negotiation-b2-08','course-negotiation-b2','B2',3320,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-work-b1-08','course-work-b1','B2',3330,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-work-b1-11','course-work-b1','B2',3340,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-work-b1-14','course-work-b1','B2',3350,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-work-b1-15','course-work-b1','B2',3360,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-work-b1-16','course-work-b1','B2',3370,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-interview-b1-06','course-interview-b1','B2',3380,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-interview-b1-07','course-interview-b1','B2',3390,false,ARRAY['lesson-register-c1-01']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-street-a1-01','course-street-a1','B2',3400,false,ARRAY['lesson-register-c1-01']::text[],'extra','Registro e linguagem indireta',7),
  ('lesson-street-a1-09','course-street-a1','B2',3410,false,ARRAY['lesson-register-c1-01']::text[],'extra','Registro e linguagem indireta',7),
  ('lesson-street-a1-10','course-street-a1','B2',3420,false,ARRAY['lesson-register-c1-01']::text[],'extra','Registro e linguagem indireta',7),
  ('lesson-street-a1-12','course-street-a1','B2',3430,false,ARRAY['lesson-register-c1-01']::text[],'extra','Registro e linguagem indireta',7),
  ('lesson-idioms-b2-01','course-idioms-b2','B2',3440,false,ARRAY['lesson-register-c1-01']::text[],'extra','Registro e linguagem indireta',7),
  ('lesson-idioms-b2-02','course-idioms-b2','B2',3450,false,ARRAY['lesson-register-c1-01']::text[],'extra','Registro e linguagem indireta',7),
  ('lesson-idioms-b2-03','course-idioms-b2','B2',3460,false,ARRAY['lesson-register-c1-01']::text[],'extra','Registro e linguagem indireta',7),
  ('lesson-idioms-b2-05','course-idioms-b2','B2',3470,true,ARRAY['lesson-register-c1-01']::text[],'base','Registro e linguagem indireta',7),
  ('lesson-idioms-b2-07','course-idioms-b2','B2',3480,false,ARRAY['lesson-idioms-b2-05']::text[],'extra','Registro e linguagem indireta',7),
  ('lesson-idioms-b2-08','course-idioms-b2','B2',3490,false,ARRAY['lesson-idioms-b2-05']::text[],'extra','Registro e linguagem indireta',7),
  ('lesson-idioms-b2-09','course-idioms-b2','B2',3500,false,ARRAY['lesson-idioms-b2-05']::text[],'extra','Registro e linguagem indireta',7),
  ('lesson-idioms-b2-10','course-idioms-b2','B2',3510,false,ARRAY['lesson-idioms-b2-05']::text[],'extra','Registro e linguagem indireta',7),
  ('lesson-subtext-b2-01','course-subtext-b2','B2',3520,false,ARRAY['lesson-idioms-b2-05']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-subtext-b2-03','course-subtext-b2','B2',3530,true,ARRAY['lesson-idioms-b2-05']::text[],'base','Registro e linguagem indireta',7),
  ('lesson-subtext-b2-04','course-subtext-b2','B2',3540,true,ARRAY['lesson-subtext-b2-03']::text[],'base','Registro e linguagem indireta',7),
  ('lesson-subtext-b2-06','course-subtext-b2','B2',3550,false,ARRAY['lesson-subtext-b2-04']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-subtext-b2-07','course-subtext-b2','B2',3560,false,ARRAY['lesson-subtext-b2-04']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-subtext-b2-08','course-subtext-b2','B2',3570,false,ARRAY['lesson-subtext-b2-04']::text[],'optional','Registro e linguagem indireta',7),
  ('lesson-themes-b2-01','course-themes-b2','B2',3580,true,ARRAY['lesson-subtext-b2-04']::text[],'base','Vocabulário temático e colocações',8),
  ('lesson-themes-b2-02','course-themes-b2','B2',3590,true,ARRAY['lesson-themes-b2-01']::text[],'base','Vocabulário temático e colocações',8),
  ('lesson-themes-b2-03','course-themes-b2','B2',3600,true,ARRAY['lesson-themes-b2-02']::text[],'base','Vocabulário temático e colocações',8),
  ('lesson-themes-b2-04','course-themes-b2','B2',3610,true,ARRAY['lesson-themes-b2-03']::text[],'base','Vocabulário temático e colocações',8),
  ('lesson-themes-b2-05','course-themes-b2','B2',3620,true,ARRAY['lesson-themes-b2-04']::text[],'base','Vocabulário temático e colocações',8),
  ('lesson-themes-b2-06','course-themes-b2','B2',3630,true,ARRAY['lesson-themes-b2-05']::text[],'base','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b1-01','course-phrasal-b1','B2',3640,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b2-01','course-phrasal-adv-b2','B2',3650,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b2-02','course-phrasal-adv-b2','B2',3660,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b1-03','course-phrasal-b1','B2',3670,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b2-03','course-phrasal-adv-b2','B2',3680,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b2-04','course-phrasal-adv-b2','B2',3690,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b1-05','course-phrasal-b1','B2',3700,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b2-05','course-phrasal-adv-b2','B2',3710,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b2-06','course-phrasal-adv-b2','B2',3720,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b1-07','course-phrasal-b1','B2',3730,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b2-07','course-phrasal-adv-b2','B2',3740,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b2-08','course-phrasal-adv-b2','B2',3750,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b1-09','course-phrasal-b1','B2',3760,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b2-09','course-phrasal-adv-b2','B2',3770,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b1-10','course-phrasal-b1','B2',3780,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b2-10','course-phrasal-adv-b2','B2',3790,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b1-11','course-phrasal-b1','B2',3800,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b1-13','course-phrasal-b1','B2',3810,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b1-16','course-phrasal-b1','B2',3820,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b1-17','course-phrasal-b1','B2',3830,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-phrasal-b1-20','course-phrasal-b1','B2',3840,false,ARRAY['lesson-themes-b2-06']::text[],'extra','Vocabulário temático e colocações',8),
  ('lesson-collocations-b2-03','course-collocations-b2','B2',3850,true,ARRAY['lesson-themes-b2-06']::text[],'base','Vocabulário temático e colocações',8),
  ('lesson-collocations-b2-04','course-collocations-b2','B2',3860,false,ARRAY['lesson-collocations-b2-03']::text[],'optional','Vocabulário temático e colocações',8),
  ('lesson-collocations-b2-05','course-collocations-b2','B2',3870,true,ARRAY['lesson-collocations-b2-03']::text[],'base','Vocabulário temático e colocações',8),
  ('lesson-collocations-b2-06','course-collocations-b2','B2',3880,true,ARRAY['lesson-collocations-b2-05']::text[],'base','Vocabulário temático e colocações',8),
  ('lesson-collocations-b2-07','course-collocations-b2','B2',3890,true,ARRAY['lesson-collocations-b2-06']::text[],'base','Vocabulário temático e colocações',8),
  ('lesson-collocations-b2-08','course-collocations-b2','B2',3900,true,ARRAY['lesson-collocations-b2-07']::text[],'base','Vocabulário temático e colocações',8),
  ('lesson-spoken-reductions-a2-01','course-spoken-reductions-a2','B2',3910,false,ARRAY['lesson-collocations-b2-08']::text[],'extra','Fala conectada',9),
  ('lesson-connected-b2-01','course-connected-speech-b2','B2',3920,true,ARRAY['lesson-collocations-b2-08']::text[],'base','Fala conectada',9),
  ('lesson-connected-b2-06','course-connected-speech-b2','B2',3930,false,ARRAY['lesson-connected-b2-01']::text[],'extra','Fala conectada',9),
  ('lesson-connected-b2-07','course-connected-speech-b2','B2',3940,false,ARRAY['lesson-connected-b2-01']::text[],'extra','Fala conectada',9),
  ('lesson-connected-b2-08','course-connected-speech-b2','B2',3950,false,ARRAY['lesson-connected-b2-01']::text[],'extra','Fala conectada',9),
  ('lesson-tenses-b1-16','course-tenses-b1','B2',3960,true,ARRAY['lesson-connected-b2-01']::text[],'base','Revisão integradora',10),
  ('lesson-grammar-b2-06','course-grammar-b2','C1',3970,true,ARRAY[]::text[],'base','Ênfase e inversão',1),
  ('lesson-grammar-b2-07','course-grammar-b2','C1',3980,true,ARRAY['lesson-grammar-b2-06']::text[],'base','Ênfase e inversão',1),
  ('lesson-pedagogy-c1-reporting-passives','course-pedagogy-c1','C1',3990,true,ARRAY['lesson-grammar-b2-07']::text[],'base','Cautela e precisão',2),
  ('lesson-register-c1-02','course-register-c1','C1',4000,false,ARRAY['lesson-pedagogy-c1-reporting-passives']::text[],'optional','Cautela e precisão',2),
  ('lesson-register-c1-07','course-register-c1','C1',4010,true,ARRAY['lesson-pedagogy-c1-reporting-passives']::text[],'base','Cautela e precisão',2),
  ('lesson-pedagogy-c1-ellipsis','course-pedagogy-c1','C1',4020,true,ARRAY['lesson-register-c1-07']::text[],'base','Coesão e estruturas compactas',3),
  ('lesson-pedagogy-c1-participle-clauses','course-pedagogy-c1','C1',4030,true,ARRAY['lesson-pedagogy-c1-ellipsis']::text[],'base','Coesão e estruturas compactas',3),
  ('lesson-register-c1-03','course-register-c1','C1',4040,true,ARRAY['lesson-pedagogy-c1-participle-clauses']::text[],'base','Coesão e estruturas compactas',3),
  ('lesson-pedagogy-c1-cohesion','course-pedagogy-c1','C1',4050,true,ARRAY['lesson-register-c1-03']::text[],'base','Argumentos complexos',4),
  ('lesson-register-c1-04','course-register-c1','C1',4060,true,ARRAY['lesson-pedagogy-c1-cohesion']::text[],'base','Argumentos complexos',4),
  ('lesson-register-c1-06','course-register-c1','C1',4070,true,ARRAY['lesson-register-c1-04']::text[],'base','Argumentos complexos',4),
  ('lesson-pedagogy-c1-context-register','course-pedagogy-c1','C1',4080,true,ARRAY['lesson-register-c1-06']::text[],'base','Registro e interpretação',5),
  ('lesson-subtext-b2-02','course-subtext-b2','C1',4090,false,ARRAY['lesson-pedagogy-c1-context-register']::text[],'optional','Registro e interpretação',5),
  ('lesson-subtext-b2-05','course-subtext-b2','C1',4100,false,ARRAY['lesson-pedagogy-c1-context-register']::text[],'optional','Registro e interpretação',5),
  ('lesson-pedagogy-c1-synthesis','course-pedagogy-c1','C1',4110,true,ARRAY['lesson-pedagogy-c1-context-register']::text[],'base','Síntese e paráfrase',6),
  ('lesson-grammar-b2-08','course-grammar-b2','C1',4120,true,ARRAY['lesson-pedagogy-c1-synthesis']::text[],'base','Repertório amplo em contexto',7),
  ('lesson-register-c1-05','course-register-c1','C1',4130,true,ARRAY['lesson-grammar-b2-08']::text[],'base','Repertório amplo em contexto',7),
  ('lesson-register-c1-08','course-register-c1','C1',4140,false,ARRAY['lesson-register-c1-05']::text[],'optional','Revisão integradora',8)
)
UPDATE public.course_lessons l SET level=r.level,curriculum_order=r.curriculum_order,is_core=r.is_core,
  prerequisite_lesson_ids=r.requirements,lesson_role=r.lesson_role,module_title=r.module_title,module_order=r.module_order
FROM reviewed r WHERE l.id=r.id AND l.course_id=r.course_id;
UPDATE public.course_catalog c SET is_core=EXISTS(
  SELECT 1 FROM public.course_lessons l WHERE l.course_id=c.id AND l.is_core AND l.lesson_role='base'
),updated_at=now() WHERE EXISTS(SELECT 1 FROM public.course_lessons l WHERE l.course_id=c.id AND l.module_title IS NOT NULL);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.course_lessons WHERE module_title IS NOT NULL)<>414
    OR EXISTS(SELECT 1 FROM public.course_lessons l CROSS JOIN LATERAL unnest(l.prerequisite_lesson_ids) r(id)
      LEFT JOIN public.course_lessons p ON p.id=r.id WHERE p.id IS NULL OR NOT p.is_core OR p.curriculum_order>=l.curriculum_order)
  THEN RAISE EXCEPTION 'Cobertura/dependências inválidas #533'; END IF;
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
      'lesson_roles', (SELECT coalesce(jsonb_agg(DISTINCT cl.lesson_role),'[]'::jsonb) FROM public.course_lessons cl WHERE cl.course_id=c.id),
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
          'lesson_role', l.lesson_role, 'module_title', l.module_title, 'module_order', l.module_order,
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
    SELECT c.id AS course_id, l.level, l.curriculum_order, l.prerequisite_lesson_ids, l.id AS lesson_id, l.chapter_number, l.module_title, l.module_order
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
    SELECT c.course_id, c.lesson_id, c.level, c.module_title
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
     'modules', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'level', m.level,'title',m.module_title,'order',m.module_order,'total',m.total,'completed',m.completed
    ) ORDER BY m.level,m.module_order),'[]'::jsonb) FROM (
      SELECT c.level,c.module_title,c.module_order,count(*) AS total,
        count(*) FILTER(WHERE c.lesson_id IN(SELECT lesson_id FROM done)) AS completed
      FROM core c GROUP BY c.level,c.module_title,c.module_order
    ) m),
    'levels', (SELECT jsonb_agg(jsonb_build_object('level', level, 'total', total, 'completed', completed,
      'percent', percent, 'is_completed', is_completed, 'skipped', skipped_by_placement) ORDER BY pos) FROM status),
    'next', (SELECT jsonb_build_object('course_id', course_id, 'lesson_id', lesson_id, 'level', level, 'module_title', module_title) FROM next_lesson)
  );
$$;

-- Grants existentes permanecem explícitos; funções de leitura não aceitam user_id do cliente.
REVOKE ALL ON FUNCTION public.rpc_course_catalog(),public.rpc_course_path() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_course_catalog(),public.rpc_course_path() TO authenticated;
NOTIFY pgrst,'reload schema';
