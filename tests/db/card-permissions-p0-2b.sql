-- Gate comportamental do contrato P0.2b. Executar após todas as migrations
-- em banco descartável (scripts/replay-migrations-local.ps1 -Execute).

DO $$
BEGIN
  IF NOT has_table_privilege('authenticated', 'public.cards', 'SELECT')
     OR has_table_privilege('authenticated', 'public.cards', 'INSERT')
     OR has_table_privilege('authenticated', 'public.cards', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.cards', 'DELETE')
     OR has_table_privilege('authenticated', 'public.review_log', 'INSERT')
     OR has_table_privilege('anon', 'public.cards', 'SELECT')
     OR has_table_privilege('anon', 'public.review_log', 'SELECT') THEN
    RAISE EXCEPTION 'privilégios de tabela P0.2b divergentes';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.create_card_for_word(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.bury_card(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.suspend_card(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.restore_card(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.restore_card_state(uuid,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.delete_word_safely(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.restore_card_state(uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ACL das RPCs P0.2b divergente';
  END IF;
END $$;

INSERT INTO auth.users (id) VALUES
  ('a2000000-0000-4000-8000-000000000001'),
  ('a2000000-0000-4000-8000-000000000002');

INSERT INTO public.words (id,user_id,word) VALUES
  ('b2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','rpc-create'),
  ('b2000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','rpc-review'),
  ('b2000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000001','rpc-restore'),
  ('b2000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000001','rpc-delete'),
  ('b2000000-0000-4000-8000-000000000005','a2000000-0000-4000-8000-000000000002','other-user');

INSERT INTO public.cards (id,user_id,word_id,status,reps,due_date) VALUES
  ('c2000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000002','review',0,now()-interval '1 day'),
  ('c2000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000003','new',0,now()),
  ('c2000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000004','new',0,now()),
  ('c2000000-0000-4000-8000-000000000005','a2000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000005','new',0,now());

SELECT set_config('request.jwt.claim.sub','a2000000-0000-4000-8000-000000000001',false);
SET ROLE authenticated;

DO $$
DECLARE
  r jsonb;
  cid uuid;
  cross_rows integer;
  pristine_rows integer;
  restore_state jsonb;
  numeric_field text;
  invalid_value jsonb;
BEGIN
  SELECT count(*) INTO cross_rows FROM public.cards
   WHERE user_id='a2000000-0000-4000-8000-000000000002';
  IF cross_rows <> 0 THEN RAISE EXCEPTION 'RLS expôs card de outro usuário'; END IF;

  BEGIN
    UPDATE public.cards SET reps=999 WHERE id='c2000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'UPDATE direto foi aceito';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  r := public.create_card_for_word('b2000000-0000-4000-8000-000000000001');
  cid := (r->>'id')::uuid;
  IF cid IS NULL THEN RAISE EXCEPTION 'create_card_for_word não retornou card'; END IF;
  IF (public.create_card_for_word('b2000000-0000-4000-8000-000000000001')->>'id')::uuid <> cid THEN
    RAISE EXCEPTION 'create_card_for_word não é idempotente';
  END IF;

  r := public.bury_card(cid);
  IF (r->>'due_date')::timestamptz <= now() THEN RAISE EXCEPTION 'bury não adiou'; END IF;
  r := public.suspend_card(cid);
  IF NOT (r->>'suspended')::boolean THEN RAISE EXCEPTION 'suspend falhou'; END IF;
  r := public.restore_card(cid);
  IF (r->>'suspended')::boolean THEN RAISE EXCEPTION 'restore falhou'; END IF;

  restore_state := jsonb_build_object(
    'id','c2000000-0000-4000-8000-000000000003','status','mature','interval',30,
    'ease_factor',2.5,'step_index',0,'reps',8,'lapses',1,'difficulty',5,
    'stability',20,'pre_lapse_interval',10,'due_date',now()-interval '30 days',
    'last_review',now()-interval '60 days','introduced_at',now()-interval '90 days',
    'suspended',false,'is_leech',false);

  FOREACH numeric_field IN ARRAY ARRAY['difficulty','stability','pre_lapse_interval'] LOOP
    FOREACH invalid_value IN ARRAY ARRAY['null'::jsonb, '"5"'::jsonb] LOOP
      BEGIN
        PERFORM public.restore_card_state(
          'c2000000-0000-4000-8000-000000000003',
          jsonb_set(restore_state, ARRAY[numeric_field], invalid_value)
        );
        RAISE EXCEPTION 'backup aceitou tipo inválido em %: %', numeric_field, invalid_value;
      EXCEPTION WHEN invalid_parameter_value THEN
        IF SQLERRM <> 'invalid_backup_card_state' THEN RAISE; END IF;
      END;
    END LOOP;
  END LOOP;

  SELECT count(*) INTO pristine_rows
    FROM public.cards
   WHERE id='c2000000-0000-4000-8000-000000000003'
     AND status='new' AND reps=0 AND last_review IS NULL
     AND difficulty IS NULL AND stability IS NULL
     AND pre_lapse_interval=0;
  IF pristine_rows <> 1 OR EXISTS (
    SELECT 1 FROM public.learning_events
     WHERE event_type='card_state_restored'
       AND subject_id='c2000000-0000-4000-8000-000000000003'
  ) THEN
    RAISE EXCEPTION 'backup inválido deixou mutação ou evento residual';
  END IF;

  r := public.restore_card_state(
    'c2000000-0000-4000-8000-000000000003', restore_state);
  IF (r#>>'{card,due_date}')::timestamptz < current_date + interval '1 day' THEN
    RAISE EXCEPTION 'backup fabricou revisão imediata: %', r;
  END IF;
  BEGIN
    PERFORM public.restore_card_state('c2000000-0000-4000-8000-000000000003', r->'card');
    RAISE EXCEPTION 'backup sobrescreveu card não virgem';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    IF SQLERRM <> 'backup_restore_requires_pristine_card' THEN RAISE; END IF;
  END;

  r := public.record_card_review('c2000000-0000-4000-8000-000000000002',2::smallint,jsonb_build_object(
    'id','c2000000-0000-4000-8000-000000000002','status','review','interval',1,
    'ease_factor',2.5,'step_index',0,'reps',1,'lapses',0,'difficulty',5,
    'stability',1,'pre_lapse_interval',0,'due_date',now()+interval '1 day','is_leech',false),
    'd2000000-0000-4000-8000-000000000002');
  IF r->>'outcome' <> 'accepted' THEN RAISE EXCEPTION 'review falhou: %', r; END IF;
  BEGIN
    PERFORM public.delete_word_safely('b2000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'exclusão apagou histórico';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    IF SQLERRM <> 'reviewed_word_cannot_be_deleted' THEN RAISE; END IF;
  END;

  PERFORM public.delete_word_safely('b2000000-0000-4000-8000-000000000004');
  IF EXISTS (SELECT 1 FROM public.words WHERE id='b2000000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'palavra sem histórico não foi excluída';
  END IF;

  BEGIN
    PERFORM public.bury_card('c2000000-0000-4000-8000-000000000005');
    RAISE EXCEPTION 'RPC alterou card de outro usuário';
  EXCEPTION WHEN no_data_found THEN
    IF SQLERRM <> 'card_not_found' THEN RAISE; END IF;
  END;
END $$;

RESET ROLE;
SELECT 'CARD PERMISSIONS P0.2B SQL OK' AS result;
