-- P0.2b contract: executar somente depois que o cliente com RPCs estreitas
-- estiver publicado e validado. RLS filtra linhas; grants definem quais
-- operações chegam à tabela. Ambos são necessários.

-- Falhar fechado se o estado remoto mudou desde o preflight. Isso impede que
-- uma policy administrativa adicionada entre revisão e deploy seja apagada.
DO $$
DECLARE
  v_actual text[];
  v_expected constant text[] := ARRAY[
    'cards|Users see own data|ALL',
    'review_log|Users read own review history|SELECT'
  ];
BEGIN
  SELECT coalesce(array_agg(tablename || '|' || policyname || '|' || cmd
    ORDER BY tablename, policyname, cmd), ARRAY[]::text[])
    INTO v_actual
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('cards', 'review_log');

  IF v_actual IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'p0_2b_policy_preflight_failed',
      DETAIL = 'Revisar policies atuais antes de aplicar o contrato.';
  END IF;
END
$$;

REVOKE ALL ON TABLE public.cards, public.review_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.cards, public.review_log TO authenticated;

-- Excluir words diretamente podia acionar ON DELETE CASCADE e apagar cards e
-- review_log. A exclusão passa a ser uma operação estreita que recusa qualquer
-- palavra com evidência de revisão.
REVOKE DELETE ON TABLE public.words FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_word_safely(p_word_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_word public.words%ROWTYPE;
  v_card public.cards%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;

  SELECT * INTO v_word
    FROM public.words
   WHERE id = p_word_id AND user_id = v_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'word_not_found';
  END IF;

  SELECT * INTO v_card
    FROM public.cards
   WHERE word_id = p_word_id AND user_id = v_user_id
   FOR UPDATE;

  IF FOUND AND EXISTS (
    SELECT 1 FROM public.review_log
     WHERE card_id = v_card.id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000',
      MESSAGE = 'reviewed_word_cannot_be_deleted',
      HINT = 'Suspenda o card para preservar o histórico de aprendizagem.';
  END IF;

  IF v_card.id IS NOT NULL THEN
    DELETE FROM public.cards
     WHERE id = v_card.id AND user_id = v_user_id;
  END IF;
  DELETE FROM public.words
   WHERE id = p_word_id AND user_id = v_user_id;

  RETURN jsonb_build_object('ok', true, 'word_id', p_word_id);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_word_safely(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_word_safely(uuid) TO authenticated;

-- Backup é uma importação auditada, não um PATCH genérico. Só um card ainda
-- virgem pode receber o snapshot. O primeiro vencimento restaurado nunca é
-- antecipado para hoje, impedindo que um arquivo fabricado vire XP imediato.
ALTER TABLE public.learning_events
  DROP CONSTRAINT learning_events_event_type_check,
  ADD CONSTRAINT learning_events_event_type_check CHECK (event_type IN (
    'practice_item_completed', 'story_completed', 'story_quiz_completed',
    'video_block_completed', 'daily_quest_completed', 'weekly_quest_completed',
    'card_reviewed', 'card_review_undone', 'card_state_restored',
    'legacy_opening_balance'
  ));

ALTER TABLE public.learning_events
  DROP CONSTRAINT learning_events_event_subject_shape,
  ADD CONSTRAINT learning_events_event_subject_shape CHECK (
    (event_type = 'practice_item_completed' AND subject_type = 'practice_item')
    OR (event_type = 'story_completed' AND subject_type = 'story')
    OR (event_type = 'story_quiz_completed' AND subject_type = 'story_quiz')
    OR (event_type = 'video_block_completed' AND subject_type = 'video_block')
    OR (event_type IN ('daily_quest_completed', 'weekly_quest_completed') AND subject_type = 'quest')
    OR (event_type IN ('card_reviewed', 'card_review_undone', 'card_state_restored') AND subject_type = 'card')
    OR (event_type = 'legacy_opening_balance' AND subject_type = 'account')
  );

CREATE OR REPLACE FUNCTION public.restore_card_state(p_card_id uuid, p_state jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_stats public.user_stats%ROWTYPE;
  v_card public.cards%ROWTYPE;
  v_due timestamptz;
  v_today date;
  v_earliest_review timestamptz;
  v_event_id uuid := gen_random_uuid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='not_authenticated';
  END IF;
  IF p_card_id IS NULL OR p_state IS NULL OR jsonb_typeof(p_state)<>'object'
     OR p_state->>'id' IS DISTINCT FROM p_card_id::text
     OR NOT (p_state ?& ARRAY['status','interval','ease_factor','step_index','reps','lapses',
       'difficulty','stability','pre_lapse_interval','due_date','suspended','is_leech'])
     OR jsonb_typeof(p_state->'status')<>'string'
     OR jsonb_typeof(p_state->'interval')<>'number'
     OR jsonb_typeof(p_state->'ease_factor')<>'number'
     OR jsonb_typeof(p_state->'step_index')<>'number'
     OR jsonb_typeof(p_state->'reps')<>'number'
     OR jsonb_typeof(p_state->'lapses')<>'number'
     OR jsonb_typeof(p_state->'due_date')<>'string'
     OR jsonb_typeof(p_state->'suspended')<>'boolean'
     OR jsonb_typeof(p_state->'is_leech')<>'boolean' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='invalid_backup_card_state';
  END IF;
  BEGIN
    v_due := (p_state->>'due_date')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='invalid_backup_due_date';
  END;
  IF p_state->>'status' NOT IN ('new','learning','review','mature')
     OR (p_state->>'interval')::double precision NOT BETWEEN 0 AND 365000
     OR (p_state->>'ease_factor')::double precision NOT BETWEEN 1 AND 5
     OR (p_state->>'step_index')::integer NOT BETWEEN 0 AND 1000
     OR (p_state->>'reps')::integer NOT BETWEEN 0 AND 10000000
     OR (p_state->>'lapses')::integer NOT BETWEEN 0 AND 1000000
     OR (p_state->>'difficulty')::double precision NOT BETWEEN 1 AND 10
     OR (p_state->>'stability')::double precision NOT BETWEEN 0 AND 365000
     OR (p_state->>'pre_lapse_interval')::double precision NOT BETWEEN 0 AND 365000 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='backup_card_state_out_of_range';
  END IF;

  PERFORM public.ensure_user_stats(v_user_id);
  SELECT * INTO STRICT v_stats
    FROM public.user_stats WHERE user_id=v_user_id FOR UPDATE;
  v_today := (statement_timestamp() AT TIME ZONE coalesce(v_stats.timezone, 'UTC'))::date;
  v_earliest_review := (((v_today + 1)::timestamp)
    AT TIME ZONE coalesce(v_stats.timezone, 'UTC'));

  SELECT * INTO v_card
    FROM public.cards
   WHERE id=p_card_id AND user_id=v_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='card_not_found';
  END IF;
  IF v_card.status <> 'new' OR coalesce(v_card.reps, 0) <> 0
     OR v_card.last_review IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.review_log WHERE card_id=p_card_id AND user_id=v_user_id)
     OR EXISTS (SELECT 1 FROM public.learning_events
                 WHERE user_id=v_user_id AND event_type='card_state_restored'
                   AND subject_id=p_card_id::text) THEN
    RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='backup_restore_requires_pristine_card';
  END IF;

  UPDATE public.cards SET
    status=p_state->>'status',
    interval=(p_state->>'interval')::double precision,
    ease_factor=(p_state->>'ease_factor')::double precision,
    step_index=(p_state->>'step_index')::integer,
    reps=(p_state->>'reps')::integer,
    lapses=(p_state->>'lapses')::integer,
    difficulty=(p_state->>'difficulty')::double precision,
    stability=(p_state->>'stability')::double precision,
    pre_lapse_interval=(p_state->>'pre_lapse_interval')::double precision,
    due_date=greatest(v_due, v_earliest_review),
    last_review=(p_state->>'last_review')::timestamptz,
    introduced_at=coalesce((p_state->>'introduced_at')::timestamptz, statement_timestamp()),
    suspended=(p_state->>'suspended')::boolean,
    is_leech=(p_state->>'is_leech')::boolean
  WHERE id=p_card_id AND user_id=v_user_id
  RETURNING * INTO v_card;

  INSERT INTO public.learning_events (
    id, user_id, event_type, subject_type, subject_id, semantic_key,
    occurred_at, local_date, source, evidence, eligible, eligibility_reason
  ) VALUES (
    v_event_id, v_user_id, 'card_state_restored', 'card', p_card_id::text,
    'card_backup_restore:v1:' || p_card_id,
    statement_timestamp(), v_today, 'web',
    jsonb_build_object('schema_version', 1, 'card_after', to_jsonb(v_card)),
    false, 'backup_restore'
  );

  RETURN jsonb_build_object(
    'ok', true, 'outcome', 'accepted', 'card', to_jsonb(v_card),
    'restore_event_id', v_event_id, 'competitive', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.restore_card_state(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_card_state(uuid, jsonb) TO authenticated;

-- Remove qualquer policy herdada (inclusive FOR ALL) antes de reconstruir o
-- contrato somente-leitura. O loop também cobre nomes divergentes no remoto.
DO $$
DECLARE policy_row record;
BEGIN
  FOR policy_row IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('cards', 'review_log')
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON public.%I',
      policy_row.policyname,
      policy_row.tablename
    );
  END LOOP;
END
$$;

CREATE POLICY "Users read own cards"
  ON public.cards
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users read own review history"
  ON public.review_log
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

COMMENT ON POLICY "Users read own cards" ON public.cards IS
  'P0.2b: clientes leem cards próprios; toda escrita usa RPCs estreitas.';
COMMENT ON POLICY "Users read own review history" ON public.review_log IS
  'P0.2b: histórico próprio é somente leitura para clientes.';

COMMENT ON FUNCTION public.delete_word_safely(uuid) IS
  'P0.2b: exclui somente palavra sem revisão; histórico qualificado é preservado.';
COMMENT ON FUNCTION public.restore_card_state(uuid, jsonb) IS
  'P0.2b: restaura somente card virgem, audita a importação e impede XP imediato.';
