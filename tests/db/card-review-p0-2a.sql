-- Gate comportamental real do P0.2a. Executar após todas as migrations.

INSERT INTO auth.users (id) VALUES
  ('a1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000002'),
  ('a1000000-0000-4000-8000-000000000003'),
  ('a1000000-0000-4000-8000-000000000004'),
  ('a1000000-0000-4000-8000-000000000005'),
  ('a1000000-0000-4000-8000-000000000006'),
  ('a1000000-0000-4000-8000-000000000007');

INSERT INTO public.words (id,user_id,word) VALUES
  ('b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','one'),
  ('b1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','two'),
  ('b1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000003','three'),
  ('b1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000004','four'),
  ('b1000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000005','quota'),
  ('b1000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000006','revision'),
  ('b1000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000001','future'),
  ('b1000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-000000000001','suspended');

INSERT INTO public.cards (id,user_id,word_id,status,reps,due_date,suspended) VALUES
  ('c1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','review',0,now()-interval '1 day',false),
  ('c1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','review',0,now()-interval '1 day',false),
  ('c1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000003','review',0,now()-interval '1 day',false),
  ('c1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000004','review',0,now()-interval '1 day',false),
  ('c1000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000005','b1000000-0000-4000-8000-000000000005','new',0,now()-interval '1 day',false),
  ('c1000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000006','b1000000-0000-4000-8000-000000000006','review',0,now()-interval '1 day',false),
  ('c1000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000011','review',0,now()+interval '1 day',false),
  ('c1000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000012','review',0,now()-interval '1 day',true);

DO $$
DECLARE r jsonb; u jsonb; redo jsonb; q integer; uid uuid; cid uuid; op uuid; i integer;
BEGIN
  -- As quatro notas têm o mesmo valor pedagógico/contábil.
  FOR i IN 1..4 LOOP
    uid := ('a1000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
    cid := ('c1000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
    op := ('d1000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
    PERFORM set_config('request.jwt.claim.sub', uid::text, false);
    r := public.record_card_review(cid, i::smallint, jsonb_build_object(
      'id',cid,'status','review','interval',1,'ease_factor',2.5,
      'step_index',0,'reps',1,'lapses',0,'difficulty',5,'stability',1,
      'pre_lapse_interval',0,'due_date',now()+interval '1 day','is_leech',false
    ), op);
    IF r->>'outcome' <> 'accepted' OR (r->>'xp_awarded')::int <> 10 THEN
      RAISE EXCEPTION 'nota % divergiu: %', i, r;
    END IF;
  END LOOP;

  -- Retry idêntico não reaplica nem anima XP.
  PERFORM set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',false);
  r := public.record_card_review('c1000000-0000-4000-8000-000000000001'::uuid,1::smallint,jsonb_build_object(
    'id','c1000000-0000-4000-8000-000000000001','status','review','interval',1,
    'ease_factor',2.5,'step_index',0,'reps',1,'lapses',0,'difficulty',5,
    'stability',1,'pre_lapse_interval',0,'due_date',now()+interval '1 day','is_leech',false
  ),'d1000000-0000-4000-8000-000000000001'::uuid);
  IF r->>'outcome'<>'duplicate' OR (r->>'xp_awarded')::int<>0 THEN RAISE EXCEPTION 'retry: %',r; END IF;

  -- Card futuro e suspenso não sofrem mutação.
  FOREACH cid IN ARRAY ARRAY[
    'c1000000-0000-4000-8000-000000000011'::uuid,
    'c1000000-0000-4000-8000-000000000012'::uuid
  ] LOOP
    op := CASE WHEN cid::text LIKE '%11' THEN 'd1000000-0000-4000-8000-000000000011'::uuid
      ELSE 'd1000000-0000-4000-8000-000000000012'::uuid END;
    r := public.record_card_review(cid,2::smallint,jsonb_build_object(
      'id',cid,'status','review','interval',1,'ease_factor',2.5,'step_index',0,
      'reps',1,'lapses',0,'difficulty',5,'stability',1,'pre_lapse_interval',0,
      'due_date',now()+interval '2 days','is_leech',false),op);
    IF r->>'outcome'<>'ineligible' THEN RAISE EXCEPTION 'inelegível avançou: %',r; END IF;
    SELECT reps INTO q FROM public.cards WHERE id=cid;
    IF q<>0 THEN RAISE EXCEPTION 'inelegível alterou reps'; END IF;
  END LOOP;

  -- Undo usa snapshot do servidor, cria reversal e mantém entitlement.
  SELECT id INTO op FROM public.review_log
   WHERE client_review_id='d1000000-0000-4000-8000-000000000001';
  u := public.revert_card_review(op,'{"reps":999999}'::jsonb);
  IF (u->>'xp_reverted')::int<>10 OR (u#>>'{card,reps}')::int<>0 THEN RAISE EXCEPTION 'undo: %',u; END IF;
  redo := public.record_card_review('c1000000-0000-4000-8000-000000000001'::uuid,1::smallint,jsonb_build_object(
    'id','c1000000-0000-4000-8000-000000000001','status','review','interval',1,
    'ease_factor',2.5,'step_index',0,'reps',1,'lapses',0,'difficulty',5,
    'stability',1,'pre_lapse_interval',0,'due_date',now()+interval '1 day','is_leech',false
  ),'d1000000-0000-4000-8000-000000000021'::uuid);
  IF redo->>'outcome'<>'accepted' OR (redo->>'xp_awarded')::int<>0 THEN RAISE EXCEPTION 'redo farmou: %',redo; END IF;
  SELECT coalesce(sum(amount),0) INTO q FROM public.xp_ledger
   WHERE user_id='a1000000-0000-4000-8000-000000000001';
  IF q<>0 THEN RAISE EXCEPTION 'saldo após undo+redo: %',q; END IF;

  -- A 21ª introdução usa fatos imutáveis, não introduced_at restaurável.
  FOR i IN 1..20 LOOP
    INSERT INTO public.learning_events(id,user_id,event_type,subject_type,subject_id,semantic_key,
      local_date,source,eligible,eligibility_reason)
    VALUES (('e1000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
      'a1000000-0000-4000-8000-000000000005','card_reviewed','card',i::text,
      'quota-fixture:'||i,current_date,'system',true,'due_new');
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000005',false);
  r := public.record_card_review('c1000000-0000-4000-8000-000000000005'::uuid,2::smallint,jsonb_build_object(
    'id','c1000000-0000-4000-8000-000000000005','status','learning','interval',0,
    'ease_factor',2.5,'step_index',1,'reps',1,'lapses',0,'difficulty',5,
    'stability',1,'pre_lapse_interval',0,'due_date',now()+interval '1 minute','is_leech',false
  ),'d1000000-0000-4000-8000-000000000005'::uuid);
  IF r->>'eligibility_reason'<>'new_daily_limit' THEN RAISE EXCEPTION 'quota 21: %',r; END IF;

  -- O 31º card vencido ainda atualiza memória, mas não o placar competitivo.
  PERFORM set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000007',false);
  FOR i IN 1..31 LOOP
    uid := ('b7000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
    cid := ('c7000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
    op := ('d7000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
    INSERT INTO public.words(id,user_id,word) VALUES
      (uid,'a1000000-0000-4000-8000-000000000007','cap-'||i);
    INSERT INTO public.cards(id,user_id,word_id,status,reps,due_date) VALUES
      (cid,'a1000000-0000-4000-8000-000000000007',uid,'review',0,now()-interval '1 day');
    r := public.record_card_review(cid,2::smallint,jsonb_build_object(
      'id',cid,'status','review','interval',1,'ease_factor',2.5,'step_index',0,
      'reps',1,'lapses',0,'difficulty',5,'stability',1,'pre_lapse_interval',0,
      'due_date',now()+interval '1 day','is_leech',false),op);
    IF r->>'outcome'<>'accepted' OR (i<=30 AND (r->>'xp_awarded')::int<>10)
       OR (i=31 AND ((r->>'xp_awarded')::int<>0 OR r->>'reward_reason'<>'competitive_daily_cap')) THEN
      RAISE EXCEPTION 'cap competitivo no card %: %',i,r;
    END IF;
  END LOOP;
  SELECT reps INTO q FROM public.cards WHERE id='c7000000-0000-4000-8000-000000000031';
  IF q<>1 THEN RAISE EXCEPTION '31º card não atualizou memória'; END IF;

  -- Qualquer writer posterior de user_stats invalida o undo sem apagar fatos.
  PERFORM set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000006',false);
  r := public.record_card_review('c1000000-0000-4000-8000-000000000006'::uuid,2::smallint,jsonb_build_object(
    'id','c1000000-0000-4000-8000-000000000006','status','review','interval',1,
    'ease_factor',2.5,'step_index',0,'reps',1,'lapses',0,'difficulty',5,
    'stability',1,'pre_lapse_interval',0,'due_date',now()+interval '1 day','is_leech',false
  ),'d1000000-0000-4000-8000-000000000006'::uuid);
  UPDATE public.user_stats SET username='writer-posterior'
   WHERE user_id='a1000000-0000-4000-8000-000000000006';
  BEGIN
    PERFORM public.revert_card_review((r->>'review_log_id')::uuid,'{}');
    RAISE EXCEPTION 'undo aceitou stats_revision obsoleta';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    IF SQLERRM<>'newer_stats_activity_prevents_undo' THEN RAISE; END IF;
  END;
END $$;

SELECT 'CARD REVIEW P0.2A SQL OK' AS result;
