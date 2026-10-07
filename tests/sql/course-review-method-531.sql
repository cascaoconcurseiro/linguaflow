-- #531: agenda server-side, práticas antecipadas, dia do aluno, isolamento e rollback.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id) VALUES ('d5310000-0000-4000-8000-000000000001'), ('d5310000-0000-4000-8000-000000000002');
INSERT INTO public.user_stats(user_id, timezone) VALUES ('d5310000-0000-4000-8000-000000000001','America/Sao_Paulo'), ('d5310000-0000-4000-8000-000000000002','UTC') ON CONFLICT(user_id) DO UPDATE SET timezone=excluded.timezone;
INSERT INTO public.course_catalog(id,slug,title,short_description,category,level,is_published) VALUES ('c531','c531','Teste','Teste','grammar','A1',true);
INSERT INTO public.course_lessons(id,course_id,chapter_number,title) VALUES ('l531','c531',1,'Teste');
INSERT INTO public.course_units(id,lesson_id,order_index,text,translation_pt) SELECT 'u531-'||g,'l531',g,'Test','Teste' FROM generate_series(1,6) g;
SELECT set_config('request.jwt.claim.sub','d5310000-0000-4000-8000-000000000001',true);
CREATE FUNCTION pg_temp.practice(unit text, mode text DEFAULT 'medium', attempts int DEFAULT 1, session_id uuid DEFAULT gen_random_uuid()) RETURNS jsonb LANGUAGE sql AS $$
SELECT public.rpc_course_commit_practice(session_id,'review',NULL,mode,now()-interval '1 minute',20,100,1,
jsonb_build_array(jsonb_build_object('unit_id',unit,'attempts',attempts,'hint_count',0,'revealed',false,'wrong_text',case when attempts>1 then 'wrong' end)),true);
$$;

DO $$
DECLARE r record; before_due timestamptz; sid uuid:=gen_random_uuid(); response jsonb;
BEGIN
  -- Frase nova avança e outro envio, até em outra sessão, não promove ou adia.
  PERFORM pg_temp.practice('u531-1','easy',1,sid);
  SELECT * INTO r FROM public.course_user_reviews WHERE user_id=auth.uid() AND unit_id='u531-1';
  IF r.repetition_number<>1 OR r.interval_days<>1 THEN RAISE EXCEPTION 'frase nova não avançou'; END IF;
  before_due:=r.due_date;
  PERFORM pg_temp.practice('u531-1');
  response:=pg_temp.practice('u531-1','easy',1,sid);
  IF NOT (response->>'replayed')::boolean THEN RAISE EXCEPTION 'retry não foi idempotente'; END IF;
  SELECT * INTO r FROM public.course_user_reviews WHERE user_id=auth.uid() AND unit_id='u531-1';
  IF r.repetition_number<>1 OR r.due_date<>before_due THEN RAISE EXCEPTION 'repetição no dia alterou agenda'; END IF;

  -- Teto Fácil, escada normal e marcador local do aluno.
  INSERT INTO public.course_user_reviews(user_id,unit_id,repetition_number,interval_days,due_date,last_reviewed_at)
  SELECT auth.uid(),'u531-'||g,4,15,now()-interval '1 hour',now()-interval '2 days' FROM generate_series(2,4) g;
  PERFORM pg_temp.practice('u531-2','easy');
  SELECT * INTO r FROM public.course_user_reviews WHERE user_id=auth.uid() AND unit_id='u531-2';
  IF r.repetition_number<>5 OR r.interval_days<>30 THEN RAISE EXCEPTION 'Fácil deve avançar com teto 30'; END IF;
  PERFORM pg_temp.practice('u531-3','hard');
  SELECT * INTO r FROM public.course_user_reviews WHERE user_id=auth.uid() AND unit_id='u531-3';
  IF r.repetition_number<>5 OR r.interval_days<>33 THEN RAISE EXCEPTION 'Difícil deve preservar escada'; END IF;

  -- Mesmo no dia seguinte, treino antecipado não promove nem empurra vencimento.
  UPDATE public.course_user_reviews SET last_schedule_change_at=now()-interval '2 days',last_reviewed_at=now()-interval '2 days' WHERE unit_id='u531-3' AND user_id=auth.uid();
  before_due:=r.due_date;
  PERFORM pg_temp.practice('u531-3');
  SELECT * INTO r FROM public.course_user_reviews WHERE user_id=auth.uid() AND unit_id='u531-3';
  IF r.repetition_number<>5 OR r.due_date<>before_due THEN RAISE EXCEPTION 'treino antecipado alterou agenda'; END IF;

  -- Erro baixa pela metade; acerto e outros erros no mesmo dia não desfazem ou multiplicam isso.
  PERFORM pg_temp.practice('u531-4','medium',2);
  PERFORM pg_temp.practice('u531-4');
  PERFORM pg_temp.practice('u531-4','medium',2);
  SELECT * INTO r FROM public.course_user_reviews WHERE user_id=auth.uid() AND unit_id='u531-4';
  IF r.repetition_number<>2 OR r.interval_days<>1 THEN RAISE EXCEPTION 'erro seguido de reforço mudou estágio mais de uma vez'; END IF;

  -- Fuso: UTC+14 já vê amanhã; marcador de uma hora atrás continua sendo hoje local.
  UPDATE public.user_stats SET timezone='Pacific/Kiritimati' WHERE user_id=auth.uid();
  INSERT INTO public.course_user_reviews(user_id,unit_id,repetition_number,interval_days,due_date,last_reviewed_at,last_schedule_change_at)
  VALUES(auth.uid(),'u531-5',2,3,now()-interval '1 minute',date_trunc('day',now() AT TIME ZONE 'Pacific/Kiritimati') AT TIME ZONE 'Pacific/Kiritimati',date_trunc('day',now() AT TIME ZONE 'Pacific/Kiritimati') AT TIME ZONE 'Pacific/Kiritimati');
  PERFORM pg_temp.practice('u531-5');
  SELECT * INTO r FROM public.course_user_reviews WHERE user_id=auth.uid() AND unit_id='u531-5';
  IF r.repetition_number<>2 THEN RAISE EXCEPTION 'dia local não respeitado'; END IF;
  UPDATE public.course_user_reviews SET last_schedule_change_at=last_schedule_change_at-interval '1 day' WHERE user_id=auth.uid() AND unit_id='u531-5';
  PERFORM pg_temp.practice('u531-5');
  SELECT * INTO r FROM public.course_user_reviews WHERE user_id=auth.uid() AND unit_id='u531-5';
  IF r.repetition_number<>3 OR r.interval_days<>7 THEN RAISE EXCEPTION 'novo dia não avançou'; END IF;

  -- A mesma unidade em outra conta começa no primeiro estágio.
  PERFORM set_config('request.jwt.claim.sub','d5310000-0000-4000-8000-000000000002',true);
  PERFORM pg_temp.practice('u531-2');
  SELECT * INTO r FROM public.course_user_reviews WHERE user_id=auth.uid() AND unit_id='u531-2';
  IF r.repetition_number<>1 THEN RAISE EXCEPTION 'estado vazou entre contas'; END IF;
  IF has_function_privilege('anon','public.rpc_course_commit_practice(uuid,text,text,text,timestamptz,integer,integer,integer,jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'anon executa RPC'; END IF;
END $$;
ROLLBACK;
\echo course-review-method-531: OK
