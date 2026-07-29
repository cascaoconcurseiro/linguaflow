-- Gate comportamental da fundação de fluência.
-- Executar somente após todas as migrations, em PostgreSQL descartável.

DO $$
BEGIN
  IF NOT has_table_privilege('authenticated', 'public.learning_task_attempts', 'SELECT')
    OR has_table_privilege('authenticated', 'public.learning_task_attempts', 'INSERT')
    OR has_table_privilege('authenticated', 'public.learning_task_attempts', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.learning_task_attempts', 'DELETE')
    OR has_table_privilege('anon', 'public.learning_task_attempts', 'SELECT')
  THEN
    RAISE EXCEPTION 'ACL de learning_task_attempts divergente';
  END IF;
  IF NOT has_function_privilege(
    'authenticated',
    'public.record_learning_task_attempt(uuid,jsonb)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.record_learning_task_attempt(uuid,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'ACL de record_learning_task_attempt divergente';
  END IF;
END $$;

INSERT INTO auth.users (id, email) VALUES
  ('a4000000-0000-4000-8000-000000000001', 'fluency-one@test.dev'),
  ('a4000000-0000-4000-8000-000000000002', 'fluency-two@test.dev');

SELECT set_config('request.jwt.claim.sub', 'a4000000-0000-4000-8000-000000000001', false);
SET ROLE authenticated;

DO $$
DECLARE
  attempt jsonb := jsonb_build_object(
    'task_key', 'a2-message-v1',
    'task_type', 'writing',
    'skill', 'writing',
    'target_descriptor', 'Escrever uma mensagem simples com objetivo e destinatário definidos.',
    'target_level', 'A2',
    'prompt_version', 'prompt-v1',
    'evaluator_version', 'client-rubric-v1',
    'stimulus_unseen', true,
    'assistance_used', jsonb_build_object('hint_count', 0),
    'response_time_ms', 45000,
    'task_completion', 2,
    'comprehensibility', 2,
    'accuracy', 2,
    'fluency', 2,
    'lexical_range', 2,
    'overall_score', 67,
    'evidence', jsonb_build_object(
      'task_family', 'message',
      'valid', true,
      'response_length', 42,
      'stimulus_id', 'stimulus-a2-001'
    ),
    'occurred_at', now()
  );
  first_result jsonb;
  replay_result jsonb;
BEGIN
  first_result := public.record_learning_task_attempt(
    'b4000000-0000-4000-8000-000000000001',
    attempt
  );
  IF (first_result ->> 'authoritative')::boolean IS DISTINCT FROM false
    OR first_result ->> 'evaluation_authority' <> 'client'
  THEN
    RAISE EXCEPTION 'cliente fabricou autoridade: %', first_result;
  END IF;

  replay_result := public.record_learning_task_attempt(
    'b4000000-0000-4000-8000-000000000001',
    attempt
  );
  IF replay_result ->> 'id' <> first_result ->> 'id' THEN
    RAISE EXCEPTION 'replay idempotente mudou o registro';
  END IF;

  BEGIN
    PERFORM public.record_learning_task_attempt(
      'b4000000-0000-4000-8000-000000000001',
      jsonb_set(attempt, '{task_key}', '"different-payload"')
    );
    RAISE EXCEPTION 'replay divergente foi aceito';
  EXCEPTION WHEN unique_violation THEN
    IF SQLERRM <> 'idempotency_conflict' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO public.learning_task_attempts (
      client_attempt_id,
      user_id,
      task_key,
      task_type,
      skill,
      target_descriptor,
      prompt_version,
      evaluator_version,
      occurred_at
    ) VALUES (
      'b4000000-0000-4000-8000-000000000099',
      'a4000000-0000-4000-8000-000000000001',
      'direct-write',
      'writing',
      'writing',
      'Escrita direta não deve ser aceita.',
      'prompt-v1',
      'client-rubric-v1',
      now()
    );
    RAISE EXCEPTION 'INSERT direto foi aceito';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM public.record_learning_task_attempt(
      'b4000000-0000-4000-8000-000000000002',
      jsonb_set(attempt, '{evidence,raw_response}', '"private text"', true)
    );
    RAISE EXCEPTION 'resposta livre foi aceita em evidence';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'unsupported_attempt_metadata' THEN RAISE; END IF;
  END;

  IF EXISTS (
    SELECT 1
    FROM public.cards
    WHERE user_id = 'a4000000-0000-4000-8000-000000000001'
  ) OR EXISTS (
    SELECT 1
    FROM public.review_log
    WHERE user_id = 'a4000000-0000-4000-8000-000000000001'
  ) OR EXISTS (
    SELECT 1
    FROM public.xp_ledger
    WHERE user_id = 'a4000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'tentativa comunicativa contaminou SRS ou economia';
  END IF;
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'a4000000-0000-4000-8000-000000000002', false);
SET ROLE authenticated;

SELECT public.record_learning_task_attempt(
  'b4000000-0000-4000-8000-000000000003',
  jsonb_build_object(
    'task_key', 'a1-listening-v1',
    'task_type', 'unseen_listening',
    'skill', 'listening',
    'target_descriptor', 'Compreender uma instrução curta e inédita.',
    'target_level', 'A1',
    'prompt_version', 'prompt-v1',
    'evaluator_version', 'client-rubric-v1',
    'stimulus_unseen', true,
    'occurred_at', now()
  )
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'a4000000-0000-4000-8000-000000000001', false);
SET ROLE authenticated;

DO $$
DECLARE
  visible_rows integer;
BEGIN
  SELECT count(*) INTO visible_rows FROM public.learning_task_attempts;
  IF visible_rows <> 1 THEN
    RAISE EXCEPTION 'RLS não isolou tentativas: % linhas visíveis', visible_rows;
  END IF;
END $$;

RESET ROLE;
