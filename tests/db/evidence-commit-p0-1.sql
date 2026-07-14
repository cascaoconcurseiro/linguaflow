-- Contratos transacionais do portão privado P0.1.

INSERT INTO auth.users (id) VALUES
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff');

INSERT INTO public.user_stats (
  user_id, xp_today, xp_week, xp_total, streak, last_study_date, timezone
) VALUES
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 0, 0, 0, 0, current_date, 'UTC'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 0, 0, 0, 0, current_date, 'UTC'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 0, 0, 0, 0, current_date, 'UTC'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 0, 0, 0, 0, current_date, 'Pacific/Kiritimati')
ON CONFLICT (user_id) DO UPDATE SET
  xp_today = 0, xp_week = 0, xp_total = 0, streak = 0,
  last_study_date = current_date, timezone = EXCLUDED.timezone;

CREATE OR REPLACE FUNCTION private.test_force_ledger_failure()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $trigger$
BEGIN
  IF NEW.dedupe_key = 'force:rollback' THEN RAISE EXCEPTION 'forced ledger failure'; END IF;
  RETURN NEW;
END $trigger$;

CREATE TRIGGER test_force_ledger_failure
  BEFORE INSERT ON public.xp_ledger FOR EACH ROW
  EXECUTE FUNCTION private.test_force_ledger_failure();

DO $$
DECLARE
  result jsonb;
  failed boolean := false;
  event_count integer;
  ledger_count integer;
  ledger_sum integer;
  stats_total integer;
  event_date date;
  ledger_week date;
  expected_date date;
BEGIN
  IF has_function_privilege('authenticated',
    'private.commit_qualified_learning_event(uuid,uuid,text,text,text,uuid,text,text,text,text,jsonb,boolean,text,text,integer,boolean,integer)',
    'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated recebeu EXECUTE na helper privada';
  END IF;
  IF has_function_privilege('service_role',
    'private.commit_qualified_learning_event(uuid,uuid,text,text,text,uuid,text,text,text,text,jsonb,boolean,text,text,integer,boolean,integer)',
    'EXECUTE') THEN
    RAISE EXCEPTION 'service_role recebeu EXECUTE na helper privada';
  END IF;
  IF has_schema_privilege('authenticated', 'private', 'USAGE')
     OR has_schema_privilege('service_role', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'papel da API recebeu USAGE no schema private';
  END IF;

  result := private.commit_qualified_learning_event(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '31000000-0000-4000-8000-000000000001',
    'practice_item_completed', 'practice_item', 'card-a', NULL,
    'attempt:card-a:1', 'reward:card-a:today', 'system', 'test-v1',
    '{"correct":true}'::jsonb, true, 'first_eligible_attempt',
    'practice_item', 2, true, 4
  );
  IF result->>'outcome' <> 'accepted' OR (result->>'xp_awarded')::int <> 2
     OR (result->>'original_award')::int <> 0 THEN
    RAISE EXCEPTION 'primeiro award incorreto: %', result;
  END IF;

  result := private.commit_qualified_learning_event(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '31000000-0000-4000-8000-000000000001',
    'practice_item_completed', 'practice_item', 'card-a', NULL,
    'attempt:card-a:1', 'reward:card-a:today', 'system', 'test-v1',
    '{"correct":true}'::jsonb, true, 'first_eligible_attempt',
    'practice_item', 2, true, 4
  );
  IF result->>'outcome' <> 'duplicate' OR (result->>'xp_awarded')::int <> 0
     OR (result->>'original_award')::int <> 2 THEN
    RAISE EXCEPTION 'retry não retornou resultado canônico: %', result;
  END IF;

  BEGIN
    PERFORM private.commit_qualified_learning_event(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '31000000-0000-4000-8000-000000000001',
      'practice_item_completed', 'practice_item', 'payload-diferente', NULL,
      'attempt:card-a:1', 'reward:card-a:today', 'system', 'test-v1',
      '{"correct":true}'::jsonb, true, 'first_eligible_attempt',
      'practice_item', 2, true, 4
    );
  EXCEPTION WHEN unique_violation THEN
    failed := SQLERRM = 'event_id_conflict';
  END;
  IF NOT failed THEN RAISE EXCEPTION 'event_id diferente não gerou conflito explícito'; END IF;

  failed := false;
  BEGIN
    PERFORM private.commit_qualified_learning_event(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '31000000-0000-4000-8000-000000000001',
      'practice_item_completed', 'practice_item', 'card-a', NULL,
      'attempt:card-a:1', 'reward:card-a:today', 'system', 'test-v1',
      '{"correct":true}'::jsonb, true, 'first_eligible_attempt',
      'practice_item', 3, true, 4
    );
  EXCEPTION WHEN unique_violation THEN
    failed := SQLERRM = 'event_id_conflict';
  END;
  IF NOT failed THEN RAISE EXCEPTION 'retry contábil divergente não gerou conflito'; END IF;

  failed := false;
  BEGIN
    PERFORM private.commit_qualified_learning_event(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '31000000-0000-4000-8000-000000000099',
      'practice_item_completed', 'practice_item', 'reserved', NULL,
      'attempt:reserved', 'reward:reserved', 'system', 'test-v1',
      '{"_reward":{"forged":true}}'::jsonb, true, 'fixture',
      'practice_item', 2, true, 4
    );
  EXCEPTION WHEN invalid_parameter_value THEN failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'aceitou evidence com namespace reservado'; END IF;

  failed := false;
  BEGIN
    PERFORM private.commit_qualified_learning_event(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '31000000-0000-4000-8000-000000000098',
      'practice_item_completed', 'practice_item', 'invalid-reason', NULL,
      'attempt:invalid-reason', 'reward:invalid-reason', 'system', 'test-v1',
      '{}'::jsonb, false, 'fixture', 'legacy_opening_balance', 0, false, 0
    );
  EXCEPTION WHEN invalid_parameter_value THEN failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'aceitou razão reservada sem ledger'; END IF;

  -- Uma falha depois do INSERT lógico do evento precisa reverter a função toda.
  failed := false;
  BEGIN
    PERFORM private.commit_qualified_learning_event(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '31000000-0000-4000-8000-000000000097',
      'practice_item_completed', 'practice_item', 'rollback', NULL,
      'attempt:rollback', 'force:rollback', 'system', 'test-v1',
      '{}'::jsonb, true, 'fixture', 'practice_item', 1, true, 100
    );
  EXCEPTION WHEN raise_exception THEN failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'fixture de rollback não falhou'; END IF;
  IF EXISTS (SELECT 1 FROM public.learning_events WHERE id = '31000000-0000-4000-8000-000000000097') THEN
    RAISE EXCEPTION 'falha parcial deixou evento órfão';
  END IF;

  result := private.commit_qualified_learning_event(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '31000000-0000-4000-8000-000000000002',
    'practice_item_completed', 'practice_item', 'card-a', NULL,
    'attempt:card-a:1', 'reward:card-a:today', 'system', 'test-v1',
    '{"correct":true}'::jsonb, true, 'first_eligible_attempt',
    'practice_item', 2, true, 4
  );
  IF result->>'outcome' <> 'duplicate' OR result->>'duplicate_by' <> 'semantic_key' THEN
    RAISE EXCEPTION 'semantic retry incorreto: %', result;
  END IF;

  result := private.commit_qualified_learning_event(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '31000000-0000-4000-8000-000000000003',
    'practice_item_completed', 'practice_item', 'card-a', NULL,
    'attempt:card-a:2', 'reward:card-a:today', 'system', 'test-v1',
    '{"correct":true,"attempt":2}'::jsonb, true, 'first_eligible_attempt',
    'practice_item', 2, true, 4
  );
  IF result->>'outcome' <> 'accepted' OR (result->>'xp_awarded')::int <> 0
     OR (result->>'reward_duplicate')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'entitlement duplicado concedeu XP: %', result;
  END IF;

  result := private.commit_qualified_learning_event(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '31000000-0000-4000-8000-000000000004',
    'practice_item_completed', 'practice_item', 'card-b', NULL,
    'attempt:card-b:1', 'reward:card-b:today', 'system', 'test-v1',
    '{"correct":true}'::jsonb, true, 'first_eligible_attempt',
    'practice_item', 5, true, 4
  );
  IF (result->>'xp_awarded')::int <> 2 OR (result->>'capped')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'cap parcial incorreto: %', result;
  END IF;

  result := private.commit_qualified_learning_event(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '31000000-0000-4000-8000-000000000005',
    'practice_item_completed', 'practice_item', 'card-c', NULL,
    'attempt:card-c:1', 'reward:card-c:today', 'system', 'test-v1',
    '{"correct":true}'::jsonb, true, 'first_eligible_attempt',
    'practice_item', 2, true, 4
  );
  IF (result->>'xp_awarded')::int <> 0 OR (result->>'capped')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'cap cheio concedeu XP: %', result;
  END IF;

  result := private.commit_qualified_learning_event(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '31000000-0000-4000-8000-000000000006',
    'practice_item_completed', 'practice_item', 'card-future', NULL,
    'attempt:future:1', 'reward:future:today', 'system', 'test-v1',
    '{"correct":true}'::jsonb, false, 'not_due',
    'practice_item', 0, true, 4
  );
  IF result->>'outcome' <> 'ineligible' OR (result->>'xp_awarded')::int <> 0 THEN
    RAISE EXCEPTION 'evento inelegível incorreto: %', result;
  END IF;

  result := private.commit_qualified_learning_event(
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    '34000000-0000-4000-8000-000000000001',
    'story_completed', 'story', 'story-kiritimati', NULL,
    'story:kiritimati:1', 'story:kiritimati:reward', 'system', 'test-v1',
    '{}'::jsonb, true, 'completed_once', 'story_completed', 1, true, NULL
  );
  expected_date := (statement_timestamp() AT TIME ZONE 'Pacific/Kiritimati')::date;
  SELECT e.local_date, x.week_start INTO event_date, ledger_week
    FROM public.learning_events e
    JOIN public.xp_ledger x ON x.learning_event_id = e.id
   WHERE e.id = '34000000-0000-4000-8000-000000000001';
  IF event_date IS DISTINCT FROM expected_date
     OR ledger_week IS DISTINCT FROM date_trunc('week', expected_date::timestamp)::date THEN
    RAISE EXCEPTION 'timezone/week_start incorretos: date %, week %, expected %',
      event_date, ledger_week, expected_date;
  END IF;

  SELECT count(*), coalesce(sum(amount), 0)::integer
    INTO ledger_count, ledger_sum
    FROM public.xp_ledger
   WHERE user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  SELECT count(*) INTO event_count FROM public.learning_events
   WHERE user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  SELECT xp_total INTO stats_total FROM public.user_stats
   WHERE user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  IF event_count <> 5 OR ledger_count <> 2 OR ledger_sum <> 4 OR stats_total <> ledger_sum THEN
    RAISE EXCEPTION 'reconciliação falhou: events %, ledgers %, sum %, stats %',
      event_count, ledger_count, ledger_sum, stats_total;
  END IF;
END $$;

DROP TRIGGER test_force_ledger_failure ON public.xp_ledger;
DROP FUNCTION private.test_force_ledger_failure();

SELECT 'EVIDENCE COMMIT P0.1 SQL OK' AS result;
