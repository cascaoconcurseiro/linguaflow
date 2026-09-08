-- Gate comportamental para o endurecimento posterior da RPC FSRS autoritativa.

INSERT INTO auth.users (id) VALUES ('a8100000-0000-4000-8000-000000000001');
INSERT INTO public.user_stats (user_id) VALUES ('a8100000-0000-4000-8000-000000000001')
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.words (id,user_id,word,category) VALUES
  ('b8100000-0000-4000-8000-000000000001','a8100000-0000-4000-8000-000000000001','max-easy','general'),
  ('b8100000-0000-4000-8000-000000000002','a8100000-0000-4000-8000-000000000001','max-good','general'),
  ('b8100000-0000-4000-8000-000000000003','a8100000-0000-4000-8000-000000000001','old-leech','general'),
  ('b8100000-0000-4000-8000-000000000004','a8100000-0000-4000-8000-000000000001','undo-retry','general');
INSERT INTO public.cards (id,user_id,word_id,status,reps,lapses,is_leech,due_date) VALUES
  ('c8100000-0000-4000-8000-000000000001','a8100000-0000-4000-8000-000000000001','b8100000-0000-4000-8000-000000000001','new',0,0,false,now()-interval '1 day'),
  ('c8100000-0000-4000-8000-000000000002','a8100000-0000-4000-8000-000000000001','b8100000-0000-4000-8000-000000000002','new',0,0,false,now()-interval '1 day'),
  ('c8100000-0000-4000-8000-000000000003','a8100000-0000-4000-8000-000000000001','b8100000-0000-4000-8000-000000000003','review',2,8,true,now()-interval '1 day'),
  ('c8100000-0000-4000-8000-000000000004','a8100000-0000-4000-8000-000000000001','b8100000-0000-4000-8000-000000000004','review',0,0,false,now()-interval '1 day');
INSERT INTO public.settings(user_id,key,value) VALUES
  ('a8100000-0000-4000-8000-000000000001','max_interval','1'),
  ('a8100000-0000-4000-8000-000000000001','easy_interval','30'),
  ('a8100000-0000-4000-8000-000000000001','graduating_interval','30'),
  ('a8100000-0000-4000-8000-000000000001','learning_steps','1'),
  ('a8100000-0000-4000-8000-000000000001','leech_action','suspend'),
  ('a8100000-0000-4000-8000-000000000001','leech_threshold','8');

DO $$
DECLARE r jsonb; u jsonb; log_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','a8100000-0000-4000-8000-000000000001',false);
  r:=public.record_card_review('c8100000-0000-4000-8000-000000000001'::uuid,4::smallint,NULL::jsonb,'d8100000-0000-4000-8000-000000000001'::uuid);
  IF (r#>>'{card,interval}')::double precision > 1 THEN RAISE EXCEPTION 'Fácil ignorou max_interval: %',r; END IF;
  r:=public.record_card_review('c8100000-0000-4000-8000-000000000002'::uuid,3::smallint,NULL::jsonb,'d8100000-0000-4000-8000-000000000002'::uuid);
  IF (r#>>'{card,interval}')::double precision > 1 THEN RAISE EXCEPTION 'Bom ignorou max_interval: %',r; END IF;
  r:=public.record_card_review('c8100000-0000-4000-8000-000000000003'::uuid,3::smallint,NULL::jsonb,'d8100000-0000-4000-8000-000000000003'::uuid);
  IF (r#>>'{card,suspended}')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'leech antigo não suspenso: %',r; END IF;

  UPDATE public.settings SET value='NaN' WHERE user_id='a8100000-0000-4000-8000-000000000001' AND key IN ('easy_interval','learning_steps');
  r:=public.record_card_review('c8100000-0000-4000-8000-000000000004'::uuid,3::smallint,NULL::jsonb,'d8100000-0000-4000-8000-000000000004'::uuid);
  log_id:=(r->>'review_log_id')::uuid;
  u:=public.revert_card_review(log_id,NULL);
  r:=public.record_card_review('c8100000-0000-4000-8000-000000000004'::uuid,3::smallint,NULL::jsonb,'d8100000-0000-4000-8000-000000000004'::uuid);
  IF r->>'outcome'<>'undone' OR (r->>'accepted')::boolean OR (r#>>'{card,reps}')::integer<>0 THEN
    RAISE EXCEPTION 'retry pós-undo incoerente: %',r;
  END IF;
END $$;

SELECT 'CARD REVIEW FSRS HARDENING SQL OK' AS result;
