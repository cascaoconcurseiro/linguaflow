-- Gate comportamental da autoridade de fluência.
-- Executar somente após todas as migrations, em PostgreSQL descartável.

DO $$
BEGIN
  IF NOT has_table_privilege('authenticated', 'public.fluency_task_issues', 'SELECT')
    OR has_table_privilege('authenticated', 'public.fluency_task_issues', 'INSERT')
    OR has_table_privilege('authenticated', 'public.fluency_task_submissions', 'UPDATE')
    OR has_table_privilege('authenticated', 'private.fluency_task_catalog', 'SELECT')
    OR has_table_privilege('service_role', 'private.fluency_task_responses', 'SELECT')
  THEN
    RAISE EXCEPTION 'ACL das tabelas de fluência divergente';
  END IF;
  IF NOT has_function_privilege(
      'authenticated', 'public.issue_fluency_task(uuid,text,text)', 'EXECUTE'
    )
    OR NOT has_function_privilege(
      'authenticated', 'public.submit_fluency_task(uuid,uuid,jsonb,jsonb,integer)', 'EXECUTE'
    )
    OR has_function_privilege(
      'authenticated', 'public.commit_fluency_assessment(uuid,jsonb,text,text)', 'EXECUTE'
    )
    OR NOT has_function_privilege(
      'service_role', 'public.commit_fluency_assessment(uuid,jsonb,text,text)', 'EXECUTE'
    )
    OR has_function_privilege(
      'anon', 'public.issue_fluency_task(uuid,text,text)', 'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'ACL das RPCs de fluência divergente';
  END IF;
END $$;

INSERT INTO auth.users (id, email) VALUES
  ('a5000000-0000-4000-8000-000000000001', 'authority-one@test.dev'),
  ('a5000000-0000-4000-8000-000000000002', 'authority-two@test.dev');

INSERT INTO private.fluency_task_catalog (
  id, task_key, catalog_version, task_type, skill, target_level,
  target_descriptor, task_family, prompt_version, public_material,
  answer_key, rubric
) VALUES (
  'b5000000-0000-4000-8000-000000000001',
  'writing-a2-private-v1',
  '2026.07.1',
  'writing',
  'writing',
  'A2',
  'Escrever uma mensagem simples para remarcar um compromisso.',
  'message',
  'prompt-v1',
  '{"prompt":"Write a short message to reschedule an appointment."}'::jsonb,
  '{"secret_expected_intent":"reschedule-friday"}'::jsonb,
  '{"critical_dimensions":["task_completion"],"minimum_median":2}'::jsonb
);

SELECT set_config('request.jwt.claim.sub', 'a5000000-0000-4000-8000-000000000001', false);
SET ROLE authenticated;

DO $$
DECLARE
  issued jsonb;
  replayed jsonb;
  submitted jsonb;
  replay_submission jsonb;
BEGIN
  issued := public.issue_fluency_task(
    'c5000000-0000-4000-8000-000000000001', 'writing', 'A2'
  );
  IF issued::text ILIKE '%answer_key%'
    OR issued::text ILIKE '%rubric%'
    OR issued::text ILIKE '%reschedule-friday%'
  THEN
    RAISE EXCEPTION 'gabarito privado vazou na emissão: %', issued;
  END IF;

  replayed := public.issue_fluency_task(
    'c5000000-0000-4000-8000-000000000001', 'writing', 'A2'
  );
  IF replayed ->> 'id' <> issued ->> 'id'
    OR (replayed ->> 'idempotent')::boolean IS DISTINCT FROM true
  THEN
    RAISE EXCEPTION 'emissão idempotente divergiu';
  END IF;

  BEGIN
    PERFORM public.issue_fluency_task(
      'c5000000-0000-4000-8000-000000000001', 'interaction', 'A2'
    );
    RAISE EXCEPTION 'emissão divergente foi aceita';
  EXCEPTION WHEN unique_violation THEN
    IF SQLERRM <> 'issue_idempotency_conflict' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM answer_key FROM private.fluency_task_catalog LIMIT 1;
    RAISE EXCEPTION 'authenticated leu catálogo privado';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  submitted := public.submit_fluency_task(
    (issued ->> 'id')::uuid,
    'd5000000-0000-4000-8000-000000000001',
    '{"text":"Could we move it to Friday?","response_length":7}'::jsonb,
    '{"hint_count":0}'::jsonb,
    42000
  );
  IF submitted ->> 'status' <> 'pending' THEN
    RAISE EXCEPTION 'submissão não entrou pendente: %', submitted;
  END IF;
  PERFORM set_config('test.fluency_submission_id', submitted ->> 'id', false);

  replay_submission := public.submit_fluency_task(
    (issued ->> 'id')::uuid,
    'd5000000-0000-4000-8000-000000000001',
    '{"text":"Could we move it to Friday?","response_length":7}'::jsonb,
    '{"hint_count":0}'::jsonb,
    42000
  );
  IF replay_submission ->> 'id' <> submitted ->> 'id'
    OR (replay_submission ->> 'idempotent')::boolean IS DISTINCT FROM true
  THEN
    RAISE EXCEPTION 'submissão idempotente divergiu';
  END IF;

  BEGIN
    PERFORM public.submit_fluency_task(
      (issued ->> 'id')::uuid,
      'd5000000-0000-4000-8000-000000000001',
      '{"text":"different answer","response_length":2}'::jsonb,
      '{"hint_count":0}'::jsonb,
      42000
    );
    RAISE EXCEPTION 'submissão divergente foi aceita';
  EXCEPTION WHEN unique_violation THEN
    IF SQLERRM <> 'submission_idempotency_conflict' THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE public.fluency_task_submissions SET status = 'evaluated';
    RAISE EXCEPTION 'authenticated alterou submissão diretamente';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;
SET ROLE service_role;

DO $$
DECLARE
  submission_id uuid := current_setting('test.fluency_submission_id')::uuid;
  assessment_input jsonb;
  private_payload jsonb;
  committed jsonb;
  replayed jsonb;
BEGIN
  IF public.consume_api_quota(
    'a5000000-0000-4000-8000-000000000001',
    'fluency-assessment',
    1,
    60
  ) IS DISTINCT FROM true OR public.consume_api_quota(
    'a5000000-0000-4000-8000-000000000001',
    'fluency-assessment',
    1,
    60
  ) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'cota transacional de fluency-assessment divergiu';
  END IF;

  private_payload := public.get_fluency_submission_for_assessment(submission_id);
  IF private_payload #>> '{answer_key,secret_expected_intent}' <> 'reschedule-friday'
    OR private_payload #>> '{response,text}' <> 'Could we move it to Friday?'
  THEN
    RAISE EXCEPTION 'avaliador server-side não recebeu contrato privado';
  END IF;

  assessment_input := jsonb_build_object(
    'task_completion', 3,
    'comprehensibility', 3,
    'accuracy', 2,
    'fluency', 2,
    'lexical_range', 2,
    'overall_score', 80,
    'meets_level', true,
    'feedback', jsonb_build_object('summary', 'Objetivo cumprido.')
  );
  BEGIN
    PERFORM public.commit_fluency_assessment(
      submission_id,
      jsonb_set(assessment_input, '{task_completion}', '1'::jsonb),
      'server',
      'server-rubric-v1'
    );
    RAISE EXCEPTION 'task_completion baixo foi aceito como aprovação';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'invalid_assessment_scores' THEN RAISE; END IF;
  END;
  committed := public.commit_fluency_assessment(
    submission_id, assessment_input, 'server', 'server-rubric-v1'
  );
  IF (committed ->> 'authoritative')::boolean IS DISTINCT FROM true
    OR committed ->> 'evaluation_authority' <> 'server'
  THEN
    RAISE EXCEPTION 'avaliação server-side não ficou autoritativa: %', committed;
  END IF;

  replayed := public.commit_fluency_assessment(
    submission_id, assessment_input, 'server', 'server-rubric-v1'
  );
  IF replayed ->> 'attempt_id' <> committed ->> 'attempt_id'
    OR (replayed ->> 'idempotent')::boolean IS DISTINCT FROM true
  THEN
    RAISE EXCEPTION 'replay da avaliação divergiu';
  END IF;

  BEGIN
    PERFORM public.commit_fluency_assessment(
      submission_id,
      jsonb_set(assessment_input, '{overall_score}', '10'::jsonb),
      'human',
      'human-rubric-v1'
    );
    RAISE EXCEPTION 'avaliação divergente foi aceita';
  EXCEPTION WHEN unique_violation THEN
    IF SQLERRM <> 'assessment_idempotency_conflict' THEN RAISE; END IF;
  END;
END $$;

RESET ROLE;

INSERT INTO private.fluency_task_catalog (
  id, task_key, catalog_version, task_type, skill, target_level,
  target_descriptor, task_family, prompt_version, public_material,
  answer_key, rubric
) VALUES (
  'b5000000-0000-4000-8000-000000000002',
  'writing-a2-request-v1',
  '2026.07.1',
  'writing',
  'writing',
  'A2',
  'Escrever um pedido simples com contexto e resultado desejado.',
  'request',
  'prompt-v1',
  '{"prompt":"Write a short request explaining what you need."}'::jsonb,
  '{"secret_expected_intent":"clear-request"}'::jsonb,
  '{"critical_dimensions":["task_completion"],"minimum_median":2}'::jsonb
);

DO $$
DECLARE
  fixture record;
  issue_id uuid;
  submission_id uuid;
  catalog_id uuid;
  family text;
  submission_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  FOR fixture IN
    SELECT age_days, ordinal
    FROM unnest(ARRAY[28, 21, 14, 7, 2]) WITH ORDINALITY AS ages(age_days, ordinal)
  LOOP
    catalog_id := case
      when fixture.ordinal % 2 = 0
        then 'b5000000-0000-4000-8000-000000000001'::uuid
      else 'b5000000-0000-4000-8000-000000000002'::uuid
    end;
    family := case when fixture.ordinal % 2 = 0 then 'message' else 'request' end;
    issue_id := gen_random_uuid();
    submission_id := gen_random_uuid();

    INSERT INTO public.fluency_task_issues (
      id, client_issue_id, user_id, catalog_task_id, task_key, catalog_version,
      task_type, skill, target_level, target_descriptor, task_family,
      prompt_version, material, issued_at, expires_at
    ) VALUES (
      issue_id,
      gen_random_uuid(),
      'a5000000-0000-4000-8000-000000000001',
      catalog_id,
      'writing-a2-history-' || fixture.ordinal,
      '2026.07.1',
      'writing',
      'writing',
      'A2',
      'Escrever uma mensagem A2 para evidência longitudinal.',
      family,
      'prompt-v1',
      jsonb_build_object('prompt', 'Historical transfer task ' || fixture.ordinal),
      statement_timestamp() - make_interval(days => fixture.age_days),
      statement_timestamp() + interval '1 day'
    );
    INSERT INTO public.fluency_task_submissions (
      id, client_submission_id, user_id, issue_id, assistance_used,
      response_time_ms, submitted_at
    ) VALUES (
      submission_id,
      gen_random_uuid(),
      'a5000000-0000-4000-8000-000000000001',
      issue_id,
      '{"hint_count":0}'::jsonb,
      40000,
      statement_timestamp() - make_interval(days => fixture.age_days)
    );
    INSERT INTO private.fluency_task_responses (
      submission_id, user_id, issue_id, response, created_at
    ) VALUES (
      submission_id,
      'a5000000-0000-4000-8000-000000000001',
      issue_id,
      jsonb_build_object('text', 'Historical response', 'response_length', 2),
      statement_timestamp() - make_interval(days => fixture.age_days)
    );
    submission_ids := array_append(submission_ids, submission_id);
  END LOOP;
  PERFORM set_config(
    'test.fluency_historical_submission_ids',
    array_to_string(submission_ids, ','),
    false
  );
END $$;

SET ROLE service_role;

DO $$
DECLARE
  submission_id uuid;
  ordinal integer := 0;
  passes boolean;
  profile_status text;
  result jsonb;
BEGIN
  FOREACH submission_id IN ARRAY
    string_to_array(current_setting('test.fluency_historical_submission_ids'), ',')::uuid[]
  LOOP
    ordinal := ordinal + 1;
    passes := ordinal <> 3;
    result := public.commit_fluency_assessment(
      submission_id,
      jsonb_build_object(
        'task_completion', case when passes then 3 else 1 end,
        'comprehensibility', 2,
        'accuracy', 2,
        'fluency', 2,
        'lexical_range', 2,
        'overall_score', case when passes then 75 else 45 end,
        'meets_level', passes,
        'feedback', jsonb_build_object('summary', 'Historical assessment')
      ),
      'human',
      'human-rubric-v1'
    );

    IF ordinal = 2 THEN
      profile_status := result ->> 'evidence_status';
      IF profile_status <> 'provavel' THEN
        RAISE EXCEPTION 'perfil não ficou provável: %', profile_status;
      END IF;
    END IF;
  END LOOP;

  profile_status := result ->> 'evidence_status';
  IF profile_status <> 'consistente' THEN
    RAISE EXCEPTION 'perfil não ficou consistente: %', profile_status;
  END IF;
END $$;

RESET ROLE;

DO $$
DECLARE
  profile_attempts integer;
  evidence_attempts integer;
BEGIN
  SELECT authoritative_attempt_count INTO STRICT profile_attempts
    FROM public.fluency_skill_profiles
   WHERE user_id = 'a5000000-0000-4000-8000-000000000001'
     AND skill = 'writing'
     AND target_level = 'A2';
  IF profile_attempts <> 6 THEN
    RAISE EXCEPTION 'avaliação duplicada inflou o perfil: %', profile_attempts;
  END IF;

  SELECT count(*) INTO evidence_attempts
    FROM public.learning_task_attempts
   WHERE user_id = 'a5000000-0000-4000-8000-000000000001'
     AND authoritative
     AND evaluation_authority = 'server';
  IF evidence_attempts <> 1 THEN
    RAISE EXCEPTION 'ledger autoritativo divergente: %', evidence_attempts;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.cards
     WHERE user_id = 'a5000000-0000-4000-8000-000000000001'
  ) OR EXISTS (
    SELECT 1 FROM public.review_log
     WHERE user_id = 'a5000000-0000-4000-8000-000000000001'
  ) OR EXISTS (
    SELECT 1 FROM public.learning_events
     WHERE user_id = 'a5000000-0000-4000-8000-000000000001'
  ) OR EXISTS (
    SELECT 1 FROM public.xp_ledger
     WHERE user_id = 'a5000000-0000-4000-8000-000000000001'
  ) OR EXISTS (
    SELECT 1 FROM public.user_stats
     WHERE user_id = 'a5000000-0000-4000-8000-000000000001'
       AND (xp_today <> 0 OR xp_week <> 0 OR xp_total <> 0)
  ) THEN
    RAISE EXCEPTION 'avaliação de fluência contaminou FSRS ou XP';
  END IF;
END $$;

SELECT 'FLUENCY ASSESSMENT AUTHORITY SQL OK' AS result;
