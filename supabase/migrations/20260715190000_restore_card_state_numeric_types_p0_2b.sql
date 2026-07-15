-- Correção append-only do contrato P0.2b: a redefinição anterior de
-- restore_card_state deixou de validar o tipo JSON de três campos FSRS.
-- JSON null fazia os predicados NOT BETWEEN resultarem em NULL e, portanto,
-- podia gravar estado incompleto em um card restaurado.

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
     OR jsonb_typeof(p_state->'difficulty')<>'number'
     OR jsonb_typeof(p_state->'stability')<>'number'
     OR jsonb_typeof(p_state->'pre_lapse_interval')<>'number'
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

COMMENT ON FUNCTION public.restore_card_state(uuid, jsonb) IS
  'P0.2b: restaura somente card virgem, exige números JSON FSRS, audita a importação e impede XP imediato.';
