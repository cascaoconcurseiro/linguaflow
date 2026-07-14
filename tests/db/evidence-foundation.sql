-- Testes reais da Fundação de Evidência P0 em Postgres efêmero.
-- Executar depois de 20260714154841_learning_evidence_foundation_p0.sql.

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

INSERT INTO auth.users (id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

INSERT INTO public.learning_events (
  id, user_id, event_type, subject_type, subject_id, semantic_key,
  local_date, source, eligible, eligibility_reason
) VALUES
  ('10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'practice_item_completed', 'practice_item', 'item-a', 'practice:session:item-a',
   DATE '2026-07-14', 'system', true, 'first_eligible_attempt'),
  ('10000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'practice_item_completed', 'practice_item', 'item-b', 'practice:session:item-b',
   DATE '2026-07-14', 'system', true, 'first_eligible_attempt'),
  ('10000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'practice_item_completed', 'practice_item', 'cross-owner-source', 'practice:cross-owner-source',
   DATE '2026-07-14', 'system', true, 'first_eligible_attempt');

INSERT INTO public.xp_ledger (
  id, user_id, learning_event_id, entry_type, reason, amount, dedupe_key,
  local_date, week_start, competitive
) VALUES (
  '20000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '10000000-0000-4000-8000-000000000001', 'award', 'practice_item', 2,
  'practice:session:item-a', DATE '2026-07-14', DATE '2026-07-13', true
);

DO $$
DECLARE
  privileges text[];
  failed boolean;
BEGIN
  SELECT array_agg(privilege_type ORDER BY privilege_type)
    INTO privileges
    FROM information_schema.role_table_grants
   WHERE grantee = 'authenticated'
     AND table_schema = 'public'
     AND table_name = 'learning_events';
  IF privileges IS DISTINCT FROM ARRAY['SELECT']::text[] THEN
    RAISE EXCEPTION 'authenticated grants em learning_events: %', privileges;
  END IF;

  SELECT array_agg(privilege_type ORDER BY privilege_type)
    INTO privileges
    FROM information_schema.role_table_grants
   WHERE grantee = 'service_role'
     AND table_schema = 'public'
     AND table_name = 'xp_ledger';
  IF privileges IS DISTINCT FROM ARRAY['INSERT', 'SELECT']::text[] THEN
    RAISE EXCEPTION 'service_role grants em xp_ledger: %', privileges;
  END IF;

  failed := false;
  BEGIN
    INSERT INTO public.xp_ledger (
      user_id, learning_event_id, entry_type, reason, amount, dedupe_key,
      local_date, week_start, competitive
    ) VALUES (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '10000000-0000-4000-8000-000000000005',
      'award', 'practice_item', 2, 'cross-owner-event',
      DATE '2026-07-14', DATE '2026-07-13', true
    );
  EXCEPTION WHEN foreign_key_violation THEN failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'aceitou evento de outro usuário'; END IF;

  failed := false;
  BEGIN
    INSERT INTO public.learning_events (
      id, user_id, event_type, subject_type, subject_id, semantic_key,
      local_date, source, eligible, eligibility_reason
    ) VALUES (
      '10000000-0000-4000-8000-000000000010', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'story_completed', 'card', 'invalid', 'invalid:event-subject',
      DATE '2026-07-14', 'system', false, 'invalid_fixture'
    );
  EXCEPTION WHEN check_violation THEN failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'aceitou par evento/objeto impossível'; END IF;

  failed := false;
  BEGIN
    INSERT INTO public.learning_events (
      id, user_id, event_type, subject_type, subject_id, semantic_key,
      local_date, source, evidence, eligible, eligibility_reason
    ) VALUES (
      '10000000-0000-4000-8000-000000000011', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'story_completed', 'story', 'oversized', 'oversized:evidence',
      DATE '2026-07-14', 'system', jsonb_build_object('payload', repeat('x', 5000)), false, 'fixture'
    );
  EXCEPTION WHEN check_violation THEN failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'aceitou evidence maior que 4 KiB'; END IF;
END $$;

INSERT INTO public.learning_events (
  id, user_id, event_type, subject_type, subject_id, semantic_key,
  local_date, source, eligible, eligibility_reason
) VALUES (
  '10000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'practice_item_completed', 'practice_item', 'undo-a', 'reversal:event-a',
  DATE '2026-07-14', 'system', false, 'reversal_requested'
);

INSERT INTO public.xp_ledger (
  id, user_id, learning_event_id, entry_type, reason, amount, dedupe_key,
  local_date, week_start, competitive, reverses_entry_id
) VALUES (
  '20000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '10000000-0000-4000-8000-000000000003', 'reversal', 'reversal', -2,
  'reversal:practice:session:item-a', DATE '2026-07-14', DATE '2026-07-13', true,
  '20000000-0000-4000-8000-000000000001'
);

DO $$
DECLARE failed boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.learning_events (
      id, user_id, event_type, subject_type, subject_id, semantic_key,
      local_date, source, eligible, eligibility_reason
    ) VALUES (
      '10000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'practice_item_completed', 'practice_item', 'undo-wrong', 'reversal:wrong-value',
      DATE '2026-07-14', 'system', false, 'reversal_requested'
    );
    INSERT INTO public.xp_ledger (
      user_id, learning_event_id, entry_type, reason, amount, dedupe_key,
      local_date, week_start, competitive, reverses_entry_id
    ) VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000004',
      'reversal', 'reversal', -1, 'reversal:wrong-value',
      DATE '2026-07-14', DATE '2026-07-13', true,
      '20000000-0000-4000-8000-000000000001'
    );
  EXCEPTION WHEN raise_exception THEN failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'aceitou reversão com valor incorreto'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
SET ROLE authenticated;

DO $$
DECLARE
  foreign_rows integer;
  denied boolean := false;
BEGIN
  SELECT count(*) INTO foreign_rows
    FROM public.learning_events
   WHERE user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF foreign_rows <> 0 THEN RAISE EXCEPTION 'RLS expôs eventos de outro usuário'; END IF;

  BEGIN
    INSERT INTO public.learning_events (
      id, user_id, event_type, subject_type, subject_id, semantic_key,
      local_date, source, eligible, eligibility_reason
    ) VALUES (
      gen_random_uuid(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'story_completed', 'story', 'direct', 'direct:insert',
      DATE '2026-07-14', 'web', false, 'direct_insert'
    );
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'authenticated conseguiu INSERT direto'; END IF;
END $$;

RESET ROLE;

-- O caminho administrativo real usa service_role com grants append-only.
-- A reversão precisa funcionar sem UPDATE e ainda negar alterações diretas.
SET ROLE service_role;

INSERT INTO public.learning_events (
  id, user_id, event_type, subject_type, subject_id, semantic_key,
  local_date, source, eligible, eligibility_reason
) VALUES
  ('10000000-0000-4000-8000-000000000020', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'story_quiz_completed', 'story_quiz', 'quiz-service', 'quiz:service:award',
   DATE '2026-07-14', 'system', true, 'first_eligible_attempt'),
  ('10000000-0000-4000-8000-000000000021', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'story_quiz_completed', 'story_quiz', 'quiz-service-undo', 'quiz:service:reversal',
   DATE '2026-07-14', 'system', false, 'reversal_requested');

INSERT INTO public.xp_ledger (
  id, user_id, learning_event_id, entry_type, reason, amount, dedupe_key,
  local_date, week_start, competitive
) VALUES (
  '20000000-0000-4000-8000-000000000020', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '10000000-0000-4000-8000-000000000020', 'award', 'story_quiz', 5,
  'quiz:service:award', DATE '2026-07-14', DATE '2026-07-13', true
);

INSERT INTO public.xp_ledger (
  id, user_id, learning_event_id, entry_type, reason, amount, dedupe_key,
  local_date, week_start, competitive, reverses_entry_id
) VALUES (
  '20000000-0000-4000-8000-000000000021', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '10000000-0000-4000-8000-000000000021', 'reversal', 'reversal', -5,
  'quiz:service:reversal', DATE '2026-07-14', DATE '2026-07-13', true,
  '20000000-0000-4000-8000-000000000020'
);

DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    UPDATE public.xp_ledger SET amount = 999
     WHERE id = '20000000-0000-4000-8000-000000000020';
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'service_role conseguiu UPDATE no ledger'; END IF;
END $$;

RESET ROLE;

DO $$
DECLARE balance integer;
BEGIN
  SELECT coalesce(sum(amount), 0) INTO balance
    FROM public.xp_ledger
   WHERE user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  IF balance <> 0 THEN RAISE EXCEPTION 'award + reversal não reconciliou: %', balance; END IF;
END $$;

SELECT 'EVIDENCE FOUNDATION SQL OK' AS result;
