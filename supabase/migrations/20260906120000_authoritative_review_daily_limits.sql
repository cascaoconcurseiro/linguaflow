-- Limites diários autoritativos para revisão de cards.
-- A RPC mantém a assinatura vigente e continua aceitando a proposta FSRS do
-- cliente; esta migration restringe somente a admissão diária no servidor.

CREATE INDEX IF NOT EXISTS review_log_user_date_previous_status_idx
  ON public.review_log (user_id, date, previous_status);

CREATE OR REPLACE FUNCTION public.record_card_review(
  p_card_id uuid,
  p_quality smallint,
  p_state jsonb,
  p_client_review_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_stats public.user_stats%ROWTYPE;
  v_card public.cards%ROWTYPE;
  v_after public.cards%ROWTYPE;
  v_existing public.learning_events%ROWTYPE;
  v_log public.review_log%ROWTYPE;
  v_now timestamptz := statement_timestamp();
  v_today date;
  v_new_today integer := 0;
  v_review_today integer := 0;
  v_new_limit integer := 20;
  v_review_limit integer := 200;
  v_leech_threshold integer := 8;
  v_leech_action text := 'tag';
  v_new_limit_text text;
  v_review_limit_text text;
  v_leech_threshold_text text;
  v_leech_action_text text;
  v_eligible boolean := false;
  v_reason text;
  v_reward_reason text;
  v_event_id uuid := p_client_review_id;
  v_log_id uuid := gen_random_uuid();
  v_semantic_key text;
  v_dedupe_key text;
  v_before_json jsonb;
  v_after_json jsonb;
  v_evidence jsonb;
  v_commit jsonb;
  v_xp integer := 0;
  v_revision_after bigint;
  v_requested_reps integer;
  v_requested_status text;
  v_requested_due timestamptz;
  v_diff_days integer;
  v_stats_before jsonb;
  v_stats_current jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;
  IF p_card_id IS NULL OR p_client_review_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22004', MESSAGE = 'card_id_and_operation_id_required';
  END IF;
  IF p_quality NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_quality';
  END IF;
  IF p_state IS NULL OR jsonb_typeof(p_state) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_state';
  END IF;
  IF p_state->>'id' IS DISTINCT FROM p_card_id::text THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'state_card_id_mismatch';
  END IF;

  -- Ordem global de locks do domínio: user_stats -> card -> review_log.
  PERFORM public.ensure_user_stats(v_user_id);
  SELECT * INTO STRICT v_stats
    FROM public.user_stats WHERE user_id = v_user_id FOR UPDATE;
  v_stats_before := jsonb_build_object(
    'xp_today', v_stats.xp_today, 'xp_week', v_stats.xp_week,
    'xp_total', v_stats.xp_total, 'streak', v_stats.streak,
    'streak_freezes', v_stats.streak_freezes,
    'last_study_date', v_stats.last_study_date,
    'daily_counters', v_stats.daily_counters, 'counters_date', v_stats.counters_date
  );
  v_today := (v_now AT TIME ZONE coalesce(v_stats.timezone, 'UTC'))::date;

  SELECT
    max(value) FILTER (WHERE key = 'new_per_day'),
    max(value) FILTER (WHERE key = 'max_reviews_per_day'),
    max(value) FILTER (WHERE key = 'leech_threshold'),
    max(value) FILTER (WHERE key = 'leech_action')
  INTO v_new_limit_text, v_review_limit_text,
       v_leech_threshold_text, v_leech_action_text
  FROM public.settings
  WHERE user_id = v_user_id
    AND key IN ('new_per_day', 'max_reviews_per_day', 'leech_threshold', 'leech_action');

  -- Settings são texto gravado pelo usuário. Valor ausente ou inválido deve
  -- cair no default, nunca abortar a operação de revisão.
  BEGIN
    IF v_new_limit_text IS NOT NULL AND btrim(v_new_limit_text) <> '' THEN
      v_new_limit := greatest(0, least(20, v_new_limit_text::integer));
    END IF;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    v_new_limit := 20;
  END;
  BEGIN
    IF v_review_limit_text IS NOT NULL AND btrim(v_review_limit_text) <> '' THEN
      v_review_limit := greatest(1, least(1000, v_review_limit_text::integer));
    END IF;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    v_review_limit := 200;
  END;
  BEGIN
    IF v_leech_threshold_text IS NOT NULL AND btrim(v_leech_threshold_text) <> '' THEN
      v_leech_threshold := greatest(1, least(100, v_leech_threshold_text::integer));
    END IF;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    v_leech_threshold := 8;
  END;
  IF v_leech_action_text IN ('tag', 'suspend') THEN
    v_leech_action := v_leech_action_text;
  END IF;
  v_semantic_key := 'card_review_attempt:v2:' || p_card_id || ':' || p_client_review_id;
  v_dedupe_key := 'card_review:v2:' || p_card_id || ':' || v_today;

  -- Retry é respondido a partir do fato original, nunca do card já alterado.
  SELECT * INTO v_existing FROM public.learning_events WHERE id = v_event_id;
  IF FOUND THEN
    IF v_existing.user_id IS DISTINCT FROM v_user_id
       OR v_existing.event_type IS DISTINCT FROM 'card_reviewed'
       OR v_existing.subject_id IS DISTINCT FROM p_card_id::text
       OR (v_existing.evidence->>'quality')::smallint IS DISTINCT FROM p_quality THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'operation_id_conflict';
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'outcome', CASE WHEN v_existing.eligible THEN 'duplicate' ELSE 'ineligible' END,
      'accepted', v_existing.eligible, 'eligible', v_existing.eligible,
      'idempotent', true,
      'eligibility_reason', v_existing.eligibility_reason,
      'reward_reason', v_existing.evidence->>'reward_reason',
      'card', v_existing.evidence->'card_after',
      'review_log_id', nullif(v_existing.evidence->>'review_log_id', '')::uuid,
      'xp_awarded', 0,
      'original_award', coalesce((v_existing.evidence #>> '{_reward,awarded_xp}')::integer, 0)
    );
  END IF;

  SELECT * INTO v_card
    FROM public.cards
   WHERE id = p_card_id AND user_id = v_user_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'card_not_found';
  END IF;

  v_before_json := to_jsonb(v_card);
  v_requested_status := p_state->>'status';
  BEGIN
    v_requested_reps := (p_state->>'reps')::integer;
    v_requested_due := (p_state->>'due_date')::timestamptz;
  EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_state_value';
  END;

  -- O estado enviado é uma proposta FSRS compatível, não autoridade de
  -- elegibilidade. Reps funciona como compare-and-swap contra estado obsoleto.
  IF v_card.suspended THEN
    v_reason := 'suspended';
  ELSIF v_requested_reps IS NULL OR v_requested_reps <> v_card.reps + 1 THEN
    v_reason := 'stale_card_state';
  ELSIF NOT (p_state ?& ARRAY[
      'status','interval','ease_factor','step_index','reps','lapses',
      'difficulty','stability','pre_lapse_interval','due_date','is_leech'
    ])
     OR jsonb_typeof(p_state->'status') <> 'string'
     OR jsonb_typeof(p_state->'interval') <> 'number'
     OR jsonb_typeof(p_state->'ease_factor') <> 'number'
     OR jsonb_typeof(p_state->'step_index') <> 'number'
     OR jsonb_typeof(p_state->'reps') <> 'number'
     OR jsonb_typeof(p_state->'lapses') <> 'number'
     OR jsonb_typeof(p_state->'difficulty') <> 'number'
     OR jsonb_typeof(p_state->'stability') <> 'number'
     OR jsonb_typeof(p_state->'pre_lapse_interval') <> 'number'
     OR jsonb_typeof(p_state->'due_date') <> 'string'
     OR jsonb_typeof(p_state->'is_leech') <> 'boolean'
     OR v_requested_status NOT IN ('new', 'learning', 'review', 'mature')
     OR v_requested_due IS NULL
     OR v_requested_due <= v_now
     OR (p_state->>'step_index')::integer NOT BETWEEN 0 AND 1000
     OR (p_state->>'lapses')::integer NOT BETWEEN 0 AND 1000000
     OR (p_state->>'interval')::double precision NOT BETWEEN 0 AND 365000
     OR (p_state->>'ease_factor')::double precision NOT BETWEEN 1 AND 5
     OR (p_state->>'difficulty')::double precision NOT BETWEEN 1 AND 10
     OR (p_state->>'stability')::double precision NOT BETWEEN 0 AND 365000
     OR (p_state->>'pre_lapse_interval')::double precision NOT BETWEEN 0 AND 365000
     OR (p_state->>'interval') IN ('NaN', 'Infinity', '-Infinity')
     OR (p_state->>'ease_factor') IN ('NaN', 'Infinity', '-Infinity')
     OR (p_state->>'difficulty') IN ('NaN', 'Infinity', '-Infinity')
     OR (p_state->>'stability') IN ('NaN', 'Infinity', '-Infinity') THEN
    v_reason := 'invalid_card_state';
  ELSIF v_card.due_date > v_now + interval '30 seconds' THEN
    v_reason := 'not_due';
  ELSIF v_card.status = 'new' THEN
    SELECT count(*)::integer INTO v_new_today
      FROM public.learning_events
     WHERE user_id = v_user_id
       AND event_type = 'card_reviewed'
       AND eligible
       AND eligibility_reason = 'due_new'
       AND local_date = v_today;
    IF v_new_today >= v_new_limit THEN v_reason := 'new_daily_limit';
    ELSE v_eligible := true; v_reason := 'due_new'; END IF;
  ELSIF v_card.status IN ('review', 'mature') THEN
    SELECT count(*)::integer INTO v_review_today
      FROM public.review_log
     WHERE user_id = v_user_id
       AND date = v_today
       AND previous_status IN ('review', 'mature');
    IF v_review_today >= v_review_limit THEN v_reason := 'review_daily_limit';
    ELSE v_eligible := true; v_reason := 'due_review'; END IF;
  ELSIF v_card.status = 'learning' THEN
    v_eligible := true; v_reason := 'due_review';
  ELSE
    v_reason := 'invalid_card_status';
  END IF;

  IF v_eligible THEN
    UPDATE public.cards SET
      status = v_requested_status,
      interval = (p_state->>'interval')::double precision,
      ease_factor = (p_state->>'ease_factor')::double precision,
      step_index = (p_state->>'step_index')::integer,
      reps = v_requested_reps,
      lapses = (p_state->>'lapses')::integer,
      difficulty = (p_state->>'difficulty')::double precision,
      stability = (p_state->>'stability')::double precision,
      pre_lapse_interval = (p_state->>'pre_lapse_interval')::double precision,
      due_date = v_requested_due,
      last_review = v_now,
      introduced_at = CASE WHEN v_card.status = 'new' AND v_card.introduced_at IS NULL
        THEN v_now ELSE v_card.introduced_at END,
      is_leech = v_card.is_leech OR (p_state->>'lapses')::integer >= v_leech_threshold,
      suspended = v_card.suspended OR (
        v_leech_action = 'suspend'
        AND NOT v_card.is_leech
        AND (p_state->>'lapses')::integer >= v_leech_threshold
      )
    WHERE id = p_card_id AND user_id = v_user_id
    RETURNING * INTO v_after;
    v_after_json := to_jsonb(v_after);
    v_reward_reason := 'eligible_card_review';
  ELSE
    v_after := v_card;
    v_after_json := v_before_json;
    v_log_id := NULL;
    v_reward_reason := v_reason;
  END IF;

  v_evidence := jsonb_strip_nulls(jsonb_build_object(
    'schema_version', 2,
    'quality', p_quality,
    'review_log_id', v_log_id,
    'card_before', v_before_json,
    'card_after', v_after_json,
    'reward_reason', v_reward_reason
  ));

  v_commit := private.commit_qualified_learning_event(
    v_user_id, v_event_id, 'card_reviewed', 'card', p_card_id::text, NULL,
    v_semantic_key, v_dedupe_key, 'web', NULL, v_evidence,
    v_eligible, v_reason, 'card_review', 10, true, 300
  );
  v_xp := coalesce((v_commit->>'xp_awarded')::integer, 0);

  -- Streak representa evidência qualificada, não moeda. Se o entitlement do
  -- card/dia já foi consumido (por exemplo review -> undo -> redo) ou o cap
  -- competitivo foi atingido, a tentativa vencida ainda sustenta o hábito.
  IF v_eligible AND v_xp = 0 THEN
    SELECT * INTO STRICT v_stats FROM public.user_stats
     WHERE user_id = v_user_id FOR UPDATE;
    IF v_stats.last_study_date IS DISTINCT FROM v_today THEN
      v_diff_days := v_today - v_stats.last_study_date;
      IF v_diff_days = 1 THEN
        v_stats.streak := coalesce(v_stats.streak, 0) + 1;
      ELSIF v_diff_days = 2 AND coalesce(v_stats.streak_freezes, 0) > 0 THEN
        v_stats.streak := coalesce(v_stats.streak, 0) + 1;
        v_stats.streak_freezes := v_stats.streak_freezes - 1;
      ELSE
        v_stats.streak := 1;
      END IF;
      IF v_diff_days >= 1 AND v_stats.streak > 0 AND v_stats.streak % 7 = 0 THEN
        v_stats.streak_freezes := least(coalesce(v_stats.streak_freezes, 0) + 1, 2);
      END IF;
      UPDATE public.user_stats SET
        streak = v_stats.streak,
        streak_freezes = v_stats.streak_freezes,
        last_study_date = v_today,
        updated_at = v_now
      WHERE user_id = v_user_id;
    END IF;
  END IF;
  SELECT stats_revision INTO STRICT v_revision_after
    FROM public.user_stats WHERE user_id = v_user_id;
  SELECT jsonb_build_object(
    'xp_today', xp_today, 'xp_week', xp_week, 'xp_total', xp_total,
    'streak', streak, 'streak_freezes', streak_freezes,
    'last_study_date', last_study_date
  ) INTO STRICT v_stats_current
    FROM public.user_stats WHERE user_id = v_user_id;

  IF v_eligible THEN
    INSERT INTO public.review_log (
      id, user_id, card_id, quality, date, ts, client_review_id,
      previous_status, xp_awarded, stats_before, learning_event_id,
      card_before, card_after, eligibility_reason, reward_reason, stats_revision_after
    ) VALUES (
      v_log_id, v_user_id, p_card_id, p_quality, v_today, v_now, p_client_review_id,
      v_card.status, v_xp,
      v_stats_before,
      v_event_id, v_before_json, v_after_json, v_reason,
      CASE
        WHEN (v_commit->>'reward_duplicate')::boolean THEN 'already_rewarded_today'
        WHEN (v_commit->>'capped')::boolean THEN 'competitive_daily_cap'
        ELSE 'eligible_card_review'
      END, v_revision_after
    ) RETURNING * INTO v_log;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'outcome', CASE WHEN v_eligible THEN 'accepted' ELSE 'ineligible' END,
    'accepted', v_eligible, 'eligible', v_eligible,
    'idempotent', false,
    'eligibility_reason', v_reason,
    'reward_reason', CASE
      WHEN NOT v_eligible THEN v_reason
      WHEN (v_commit->>'reward_duplicate')::boolean THEN 'already_rewarded_today'
      WHEN (v_commit->>'capped')::boolean THEN 'competitive_daily_cap'
      ELSE 'eligible_card_review'
    END,
    'card', v_after_json,
    'review_log_id', v_log_id,
    'xp_awarded', v_xp,
    'original_award', coalesce((v_commit->>'original_award')::integer, 0),
    'stats', v_stats_current
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_card_review(uuid, smallint, jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_card_review(uuid, smallint, jsonb, uuid)
  TO authenticated;
