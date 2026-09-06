-- Limites de fila devem ser decididos dentro da RPC, sob o lock do usuário.

INSERT INTO auth.users (id) VALUES
  ('a9000000-0000-4000-8000-000000000001'),
  ('a9000000-0000-4000-8000-000000000002'),
  ('a9000000-0000-4000-8000-000000000003'),
  ('a9000000-0000-4000-8000-000000000004');

INSERT INTO public.words (id,user_id,word) VALUES
  ('b9000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000001','zero-new'),
  ('b9000000-0000-4000-8000-000000000002','a9000000-0000-4000-8000-000000000002','review-cap'),
  ('b9000000-0000-4000-8000-000000000003','a9000000-0000-4000-8000-000000000003','invalid-setting'),
  ('b9000000-0000-4000-8000-000000000004','a9000000-0000-4000-8000-000000000004','configured-new');

INSERT INTO public.cards (id,user_id,word_id,status,reps,due_date) VALUES
  ('c9000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000001','b9000000-0000-4000-8000-000000000001','new',0,now()-interval '1 minute'),
  ('c9000000-0000-4000-8000-000000000002','a9000000-0000-4000-8000-000000000002','b9000000-0000-4000-8000-000000000002','review',0,now()-interval '1 minute'),
  ('c9000000-0000-4000-8000-000000000003','a9000000-0000-4000-8000-000000000003','b9000000-0000-4000-8000-000000000003','new',0,now()-interval '1 minute'),
  ('c9000000-0000-4000-8000-000000000004','a9000000-0000-4000-8000-000000000004','b9000000-0000-4000-8000-000000000004','new',0,now()-interval '1 minute');

INSERT INTO public.settings (user_id,key,value) VALUES
  ('a9000000-0000-4000-8000-000000000001','new_per_day','0'),
  ('a9000000-0000-4000-8000-000000000002','max_reviews_per_day','1'),
  ('a9000000-0000-4000-8000-000000000003','new_per_day','not-a-number'),
  ('a9000000-0000-4000-8000-000000000004','new_per_day','20'),
  ('a9000000-0000-4000-8000-000000000004','leech_threshold','1'),
  ('a9000000-0000-4000-8000-000000000004','leech_action','suspend');

INSERT INTO public.review_log (user_id,card_id,quality,date,previous_status)
VALUES ('a9000000-0000-4000-8000-000000000002',NULL,3,current_date,'review');

DO $$
DECLARE
  r jsonb;
  uid uuid;
  cid uuid;
  i integer;
BEGIN
  -- O zero configurado é significativo e não pode cair no default 20.
  PERFORM set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000001',false);
  r := public.record_card_review(
    'c9000000-0000-4000-8000-000000000001',3::smallint,
    jsonb_build_object('id','c9000000-0000-4000-8000-000000000001','status','learning',
      'interval',0.01,'ease_factor',2.5,'step_index',1,'reps',1,'lapses',0,
      'difficulty',5,'stability',1,'pre_lapse_interval',0,
      'due_date',now()+interval '10 minutes','is_leech',false),
    'd9000000-0000-4000-8000-000000000001');
  IF r->>'eligibility_reason'<>'new_daily_limit' THEN RAISE EXCEPTION 'new zero: %',r; END IF;

  -- Uma revisão anterior no dia consome o limite configurado.
  PERFORM set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000002',false);
  r := public.record_card_review(
    'c9000000-0000-4000-8000-000000000002',3::smallint,
    jsonb_build_object('id','c9000000-0000-4000-8000-000000000002','status','review',
      'interval',2,'ease_factor',2.5,'step_index',0,'reps',1,'lapses',0,
      'difficulty',5,'stability',2,'pre_lapse_interval',0,
      'due_date',now()+interval '2 days','is_leech',false),
    'd9000000-0000-4000-8000-000000000002');
  IF r->>'eligibility_reason'<>'review_daily_limit' THEN RAISE EXCEPTION 'review cap: %',r; END IF;
  IF (SELECT reps FROM public.cards WHERE id='c9000000-0000-4000-8000-000000000002')<>0 THEN
    RAISE EXCEPTION 'review limitada alterou card';
  END IF;

  -- Fatos imutáveis simulam vinte introduções consumidas hoje.
  FOREACH uid IN ARRAY ARRAY[
    'a9000000-0000-4000-8000-000000000003'::uuid
  ] LOOP
    FOR i IN 1..20 LOOP
      INSERT INTO public.learning_events(
        id,user_id,event_type,subject_type,subject_id,semantic_key,
        local_date,source,eligible,eligibility_reason)
      VALUES (gen_random_uuid(),uid,'card_reviewed','card',i::text,
        'daily-limit-fixture:'||uid||':'||i,current_date,'system',true,'due_new');
    END LOOP;
  END LOOP;

  -- Dezenove introduções deixam exatamente uma vaga no limite configurado.
  FOR i IN 1..19 LOOP
    INSERT INTO public.learning_events(
      id,user_id,event_type,subject_type,subject_id,semantic_key,
      local_date,source,eligible,eligibility_reason)
    VALUES (gen_random_uuid(),'a9000000-0000-4000-8000-000000000004',
      'card_reviewed','card',i::text,
      'daily-limit-fixture:a9000000-0000-4000-8000-000000000004:'||i,
      current_date,'system',true,'due_new');
  END LOOP;

  -- Texto inválido cai no default seguro de vinte.
  PERFORM set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000003',false);
  cid := 'c9000000-0000-4000-8000-000000000003';
  r := public.record_card_review(cid,3::smallint,jsonb_build_object(
    'id',cid,'status','learning','interval',0.01,'ease_factor',2.5,'step_index',1,
    'reps',1,'lapses',0,'difficulty',5,'stability',1,'pre_lapse_interval',0,
    'due_date',now()+interval '10 minutes','is_leech',false),
    'd9000000-0000-4000-8000-000000000003');
  IF r->>'eligibility_reason'<>'new_daily_limit' THEN RAISE EXCEPTION 'invalid fallback: %',r; END IF;

  -- O limite configurado admite o vigésimo card.
  PERFORM set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000004',false);
  cid := 'c9000000-0000-4000-8000-000000000004';
  r := public.record_card_review(cid,3::smallint,jsonb_build_object(
    'id',cid,'status','learning','interval',0.01,'ease_factor',2.5,'step_index',1,
    'reps',1,'lapses',1,'difficulty',5,'stability',1,'pre_lapse_interval',0,
    'due_date',now()+interval '10 minutes','is_leech',false),
    'd9000000-0000-4000-8000-000000000004');
  IF r->>'outcome'<>'accepted' THEN RAISE EXCEPTION 'configured 20: %',r; END IF;
  IF coalesce((r#>>'{card,is_leech}')::boolean,false) IS NOT TRUE
     OR coalesce((r#>>'{card,suspended}')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'leech suspend não foi derivado no servidor: %',r;
  END IF;
END $$;

SELECT 'CARD REVIEW DAILY LIMITS SQL OK' AS result;
