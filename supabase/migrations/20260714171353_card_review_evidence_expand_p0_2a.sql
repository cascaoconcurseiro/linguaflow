-- P0.2a — revisão de card autoritativa, evidência qualificada e undo auditável.
--
-- Este é um cutover compatível da RPC record_card_review: a assinatura usada
-- pelos clientes permanece igual, mas elegibilidade, relógio, snapshots e XP
-- passam a ser decididos na mesma transação pelo Postgres. O fechamento dos
-- grants diretos das tabelas fica deliberadamente para P0.2b.

ALTER TABLE public.review_log
  ADD COLUMN IF NOT EXISTS learning_event_id uuid REFERENCES public.learning_events(id),
  ADD COLUMN IF NOT EXISTS card_before jsonb,
  ADD COLUMN IF NOT EXISTS card_after jsonb,
  ADD COLUMN IF NOT EXISTS eligibility_reason text,
  ADD COLUMN IF NOT EXISTS reward_reason text,
  ADD COLUMN IF NOT EXISTS stats_revision_after bigint;

ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS stats_revision bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION private.bump_user_stats_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.stats_revision := OLD.stats_revision + 1;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.bump_user_stats_revision() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS user_stats_bump_revision ON public.user_stats;
CREATE TRIGGER user_stats_bump_revision
  BEFORE UPDATE ON public.user_stats
  FOR EACH ROW EXECUTE FUNCTION private.bump_user_stats_revision();

CREATE UNIQUE INDEX IF NOT EXISTS review_log_learning_event_key
  ON public.review_log (learning_event_id)
  WHERE learning_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS review_log_user_id_id_key
  ON public.review_log (user_id, id);

-- Um card representa uma palavra de um usuário. O índice também torna a RPC
-- de criação idempotente sem depender de SELECT seguido de INSERT.
CREATE UNIQUE INDEX IF NOT EXISTS cards_user_word_key
  ON public.cards (user_id, word_id);

-- O undo é append-only: review_log, learning_events e xp_ledger nunca são
-- apagados. Uma linha nesta tabela afirma que uma revisão foi revertida.
CREATE TABLE public.card_review_undos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_log_id uuid NOT NULL,
  learning_event_id uuid NOT NULL,
  card_after_undo jsonb NOT NULL CHECK (jsonb_typeof(card_after_undo) = 'object'),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT card_review_undos_user_review_key UNIQUE (user_id, review_log_id),
  CONSTRAINT card_review_undos_learning_event_key UNIQUE (learning_event_id),
  CONSTRAINT card_review_undos_review_owner_fkey
    FOREIGN KEY (user_id, review_log_id) REFERENCES public.review_log(user_id, id),
  CONSTRAINT card_review_undos_event_owner_fkey
    FOREIGN KEY (user_id, learning_event_id) REFERENCES public.learning_events(user_id, id)
);

CREATE INDEX card_review_undos_user_created_idx
  ON public.card_review_undos (user_id, created_at DESC);

ALTER TABLE public.card_review_undos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own card review undos"
  ON public.card_review_undos FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
REVOKE ALL ON TABLE public.card_review_undos FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.card_review_undos TO authenticated;

-- A fundação P0 nasceu antes do evento explícito de undo. Expandimos somente
-- a enumeração e preservamos os demais pares evento/objeto.
ALTER TABLE public.learning_events
  DROP CONSTRAINT learning_events_event_type_check,
  ADD CONSTRAINT learning_events_event_type_check CHECK (event_type IN (
    'practice_item_completed', 'story_completed', 'story_quiz_completed',
    'video_block_completed', 'daily_quest_completed', 'weekly_quest_completed',
    'card_reviewed', 'card_review_undone', 'legacy_opening_balance'
  ));

ALTER TABLE public.learning_events
  DROP CONSTRAINT learning_events_event_subject_shape,
  ADD CONSTRAINT learning_events_event_subject_shape CHECK (
    (event_type = 'practice_item_completed' AND subject_type = 'practice_item')
    OR (event_type = 'story_completed' AND subject_type = 'story')
    OR (event_type = 'story_quiz_completed' AND subject_type = 'story_quiz')
    OR (event_type = 'video_block_completed' AND subject_type = 'video_block')
    OR (event_type IN ('daily_quest_completed', 'weekly_quest_completed') AND subject_type = 'quest')
    OR (event_type IN ('card_reviewed', 'card_review_undone') AND subject_type = 'card')
    OR (event_type = 'legacy_opening_balance' AND subject_type = 'account')
  );

-- O trigger legado premiava qualidade >= 2 e aplicava bônus. A partir deste
-- cutover a RPC chama o portão P0.1; manter o trigger geraria dupla escrita.
DROP TRIGGER IF EXISTS trigger_calculate_xp ON public.review_log;

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
    IF v_new_today >= 20 THEN v_reason := 'new_daily_limit';
    ELSE v_eligible := true; v_reason := 'due_new'; END IF;
  ELSIF v_card.status NOT IN ('learning', 'review', 'mature') THEN
    v_reason := 'invalid_card_status';
  ELSE
    v_eligible := true; v_reason := 'due_review';
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
      suspended = v_card.suspended,
      is_leech = coalesce((p_state->>'is_leech')::boolean, v_card.is_leech)
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

CREATE OR REPLACE FUNCTION public.revert_card_review(
  p_review_log_id uuid,
  p_previous_card jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_stats public.user_stats%ROWTYPE;
  v_log public.review_log%ROWTYPE;
  v_card public.cards%ROWTYPE;
  v_undo public.card_review_undos%ROWTYPE;
  v_award public.xp_ledger%ROWTYPE;
  v_event public.learning_events%ROWTYPE;
  v_event_id uuid := gen_random_uuid();
  v_now timestamptz := statement_timestamp();
  v_today date;
  v_week_start date;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;
  IF p_review_log_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22004', MESSAGE = 'review_log_id_required';
  END IF;

  -- Leitura sem lock só descobre a chave do card; toda mutação segue a ordem
  -- user_stats -> card -> review_log usada pela revisão.
  SELECT * INTO v_log FROM public.review_log
   WHERE id = p_review_log_id AND user_id = v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'review_not_found'; END IF;

  PERFORM public.ensure_user_stats(v_user_id);
  SELECT * INTO STRICT v_stats FROM public.user_stats
   WHERE user_id = v_user_id FOR UPDATE;
  SELECT * INTO v_card FROM public.cards
   WHERE id = v_log.card_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'card_not_found'; END IF;
  SELECT * INTO STRICT v_log FROM public.review_log
   WHERE id = p_review_log_id AND user_id = v_user_id FOR UPDATE;

  SELECT * INTO v_undo FROM public.card_review_undos
   WHERE user_id = v_user_id AND review_log_id = p_review_log_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true, 'outcome', 'duplicate', 'idempotent', true,
      'card', v_undo.card_after_undo, 'xp_reverted', 0
    );
  END IF;

  IF v_log.card_before IS NULL OR v_log.learning_event_id IS NULL
     OR v_log.stats_before IS NULL OR v_log.stats_revision_after IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'legacy_review_not_reversible';
  END IF;
  IF v_stats.stats_revision IS DISTINCT FROM v_log.stats_revision_after THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'newer_stats_activity_prevents_undo';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.review_log later
     WHERE later.user_id = v_user_id AND later.ts > v_log.ts
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'only_latest_review_can_be_undone';
  END IF;

  SELECT * INTO STRICT v_event FROM public.learning_events WHERE id = v_log.learning_event_id;
  IF EXISTS (
    SELECT 1 FROM public.learning_events later
     WHERE later.user_id = v_user_id
       AND later.received_at > v_event.received_at
       AND later.id <> v_log.learning_event_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'newer_accounting_activity_prevents_undo';
  END IF;

  UPDATE public.cards SET
    status = v_log.card_before->>'status',
    interval = (v_log.card_before->>'interval')::double precision,
    ease_factor = (v_log.card_before->>'ease_factor')::double precision,
    step_index = (v_log.card_before->>'step_index')::integer,
    reps = (v_log.card_before->>'reps')::integer,
    lapses = (v_log.card_before->>'lapses')::integer,
    difficulty = (v_log.card_before->>'difficulty')::double precision,
    stability = (v_log.card_before->>'stability')::double precision,
    pre_lapse_interval = (v_log.card_before->>'pre_lapse_interval')::double precision,
    due_date = (v_log.card_before->>'due_date')::timestamptz,
    last_review = (v_log.card_before->>'last_review')::timestamptz,
    introduced_at = (v_log.card_before->>'introduced_at')::timestamptz,
    suspended = (v_log.card_before->>'suspended')::boolean,
    is_leech = (v_log.card_before->>'is_leech')::boolean
  WHERE id = v_log.card_id AND user_id = v_user_id
  RETURNING * INTO v_card;

  v_today := (v_now AT TIME ZONE coalesce(v_stats.timezone, 'UTC'))::date;
  v_week_start := date_trunc('week', v_today::timestamp)::date;
  INSERT INTO public.learning_events (
    id, user_id, event_type, subject_type, subject_id, semantic_key,
    occurred_at, local_date, source, evidence, eligible, eligibility_reason
  ) VALUES (
    v_event_id, v_user_id, 'card_review_undone', 'card', v_log.card_id::text,
    'card_review_undo:v2:' || p_review_log_id,
    v_now, v_today, 'web',
    jsonb_build_object('schema_version', 2, 'review_log_id', p_review_log_id,
      'review_event_id', v_log.learning_event_id),
    false, 'user_undo'
  );

  SELECT * INTO v_award FROM public.xp_ledger
   WHERE learning_event_id = v_log.learning_event_id AND entry_type = 'award';
  IF FOUND THEN
    INSERT INTO public.xp_ledger (
      user_id, learning_event_id, entry_type, reason, amount, dedupe_key,
      local_date, week_start, competitive, reverses_entry_id
    ) VALUES (
      v_user_id, v_event_id, 'reversal', 'reversal', -v_award.amount,
      'card_review_reversal:v2:' || v_award.id,
      v_award.local_date, v_award.week_start, v_award.competitive, v_award.id
    );
  END IF;

  -- Só chegamos aqui sem atividade posterior; portanto é seguro restaurar a
  -- projeção server-side anterior. O ledger, entretanto, continua append-only.
  UPDATE public.user_stats SET
    xp_today = (v_log.stats_before->>'xp_today')::integer,
    xp_week = (v_log.stats_before->>'xp_week')::integer,
    xp_total = (v_log.stats_before->>'xp_total')::integer,
    streak = (v_log.stats_before->>'streak')::integer,
    streak_freezes = (v_log.stats_before->>'streak_freezes')::integer,
    last_study_date = (v_log.stats_before->>'last_study_date')::date,
    daily_counters = coalesce(v_log.stats_before->'daily_counters', '{}'::jsonb),
    counters_date = (v_log.stats_before->>'counters_date')::date,
    updated_at = v_now
  WHERE user_id = v_user_id;

  INSERT INTO public.card_review_undos (
    user_id, review_log_id, learning_event_id, card_after_undo
  ) VALUES (
    v_user_id, p_review_log_id, v_event_id, to_jsonb(v_card)
  ) RETURNING * INTO v_undo;

  RETURN jsonb_build_object(
    'ok', true, 'outcome', 'accepted', 'idempotent', false,
    'card', to_jsonb(v_card), 'xp_reverted', coalesce(v_award.amount, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.revert_card_review(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revert_card_review(uuid, jsonb) TO authenticated;

-- RPCs estreitas para o futuro fechamento P0.2b. Todas seguem a mesma ordem
-- de lock; nenhuma aceita um PATCH arbitrário do card.
CREATE OR REPLACE FUNCTION public.create_card_for_word(p_word_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user_id uuid := auth.uid(); v_card public.cards%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='not_authenticated'; END IF;
  PERFORM public.ensure_user_stats(v_user_id);
  PERFORM 1 FROM public.user_stats WHERE user_id=v_user_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.words WHERE id=p_word_id AND user_id=v_user_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='word_not_found';
  END IF;
  INSERT INTO public.cards (user_id, word_id, status, interval, ease_factor, due_date, reps)
  VALUES (v_user_id, p_word_id, 'new', 0, 2.5, statement_timestamp(), 0)
  ON CONFLICT (user_id, word_id) DO NOTHING;
  SELECT * INTO STRICT v_card FROM public.cards
   WHERE user_id=v_user_id AND word_id=p_word_id FOR UPDATE;
  RETURN to_jsonb(v_card);
END; $$;

CREATE OR REPLACE FUNCTION public.bury_card(p_card_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user_id uuid:=auth.uid(); v_stats public.user_stats%ROWTYPE; v_card public.cards%ROWTYPE; v_tomorrow timestamptz;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='not_authenticated'; END IF;
  PERFORM public.ensure_user_stats(v_user_id);
  SELECT * INTO STRICT v_stats FROM public.user_stats WHERE user_id=v_user_id FOR UPDATE;
  SELECT * INTO v_card FROM public.cards WHERE id=p_card_id AND user_id=v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='card_not_found'; END IF;
  v_tomorrow := ((((statement_timestamp() AT TIME ZONE coalesce(v_stats.timezone,'UTC'))::date + 1)::timestamp) AT TIME ZONE coalesce(v_stats.timezone,'UTC'));
  UPDATE public.cards SET due_date=v_tomorrow WHERE id=p_card_id RETURNING * INTO v_card;
  RETURN to_jsonb(v_card);
END; $$;

CREATE OR REPLACE FUNCTION public.suspend_card(p_card_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user_id uuid:=auth.uid(); v_card public.cards%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='not_authenticated'; END IF;
  PERFORM public.ensure_user_stats(v_user_id); PERFORM 1 FROM public.user_stats WHERE user_id=v_user_id FOR UPDATE;
  UPDATE public.cards SET suspended=true WHERE id=p_card_id AND user_id=v_user_id RETURNING * INTO v_card;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='card_not_found'; END IF;
  RETURN to_jsonb(v_card);
END; $$;

CREATE OR REPLACE FUNCTION public.restore_card(p_card_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user_id uuid:=auth.uid(); v_card public.cards%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='not_authenticated'; END IF;
  PERFORM public.ensure_user_stats(v_user_id); PERFORM 1 FROM public.user_stats WHERE user_id=v_user_id FOR UPDATE;
  UPDATE public.cards SET suspended=false,
    due_date=CASE WHEN due_date > statement_timestamp()+interval '180 days'
      THEN statement_timestamp() ELSE due_date END
  WHERE id=p_card_id AND user_id=v_user_id RETURNING * INTO v_card;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='card_not_found'; END IF;
  RETURN to_jsonb(v_card);
END; $$;

-- Restauração explícita de backup. Diferente de UPDATE direto, exige snapshot
-- completo, ownership e tipos/ranges; não cria revisão, evidência nem XP.
CREATE OR REPLACE FUNCTION public.restore_card_state(p_card_id uuid, p_state jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user_id uuid:=auth.uid(); v_card public.cards%ROWTYPE; v_due timestamptz;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='not_authenticated'; END IF;
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
  BEGIN v_due := (p_state->>'due_date')::timestamptz;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='invalid_backup_due_date'; END;
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
  PERFORM public.ensure_user_stats(v_user_id); PERFORM 1 FROM public.user_stats WHERE user_id=v_user_id FOR UPDATE;
  SELECT * INTO v_card FROM public.cards WHERE id=p_card_id AND user_id=v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='card_not_found'; END IF;
  UPDATE public.cards SET
    status=p_state->>'status', interval=(p_state->>'interval')::double precision,
    ease_factor=(p_state->>'ease_factor')::double precision,
    step_index=(p_state->>'step_index')::integer, reps=(p_state->>'reps')::integer,
    lapses=(p_state->>'lapses')::integer, difficulty=(p_state->>'difficulty')::double precision,
    stability=(p_state->>'stability')::double precision,
    pre_lapse_interval=(p_state->>'pre_lapse_interval')::double precision,
    due_date=v_due, last_review=(p_state->>'last_review')::timestamptz,
    introduced_at=(p_state->>'introduced_at')::timestamptz,
    suspended=(p_state->>'suspended')::boolean, is_leech=(p_state->>'is_leech')::boolean
  WHERE id=p_card_id AND user_id=v_user_id RETURNING * INTO v_card;
  RETURN to_jsonb(v_card);
END; $$;

REVOKE ALL ON FUNCTION public.create_card_for_word(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.bury_card(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.suspend_card(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.restore_card(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.restore_card_state(uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_card_for_word(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bury_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_card_state(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.record_card_review(uuid, smallint, jsonb, uuid) IS
  'P0.2a: revisão autoritativa, idempotente, com evidência/XP e snapshots server-side.';
COMMENT ON TABLE public.card_review_undos IS
  'Registro append-only de undo; uma revisão aceita no máximo uma reversão.';
