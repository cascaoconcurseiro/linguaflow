-- Onda P0.1: portão privado e transacional de evidência/XP.
--
-- Expand-only: nenhuma RPC pública ou trigger atual chama esta função. Os
-- escritores legados continuam intactos até o cutover atômico. Parâmetros de
-- recompensa são aceitos aqui somente porque a função é privada e inacessível
-- aos papéis da API; validadores públicos específicos serão os únicos callers.

CREATE OR REPLACE FUNCTION private.commit_qualified_learning_event(
  p_user_id uuid,
  p_event_id uuid,
  p_event_type text,
  p_subject_type text,
  p_subject_id text,
  p_session_id uuid,
  p_semantic_key text,
  p_dedupe_key text,
  p_source text,
  p_client_version text,
  p_evidence jsonb,
  p_evidence_eligible boolean,
  p_eligibility_reason text,
  p_xp_reason text,
  p_base_xp integer,
  p_competitive boolean,
  p_daily_cap integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stats public.user_stats%ROWTYPE;
  v_event public.learning_events%ROWTYPE;
  v_reward_event public.learning_events%ROWTYPE;
  v_ledger public.xp_ledger%ROWTYPE;
  v_today date;
  v_week_start date;
  v_last_week date;
  v_diff_days integer;
  v_cap_used integer := 0;
  v_cap_remaining integer;
  v_award integer := 0;
  v_original_award integer := 0;
  v_reward_duplicate boolean := false;
  v_capped boolean := false;
  v_first_of_day boolean := false;
  v_evidence jsonb;
BEGIN
  IF p_user_id IS NULL OR p_event_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'user_id and event_id are required';
  END IF;
  IF p_event_type = 'legacy_opening_balance' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'opening balance is reserved for cutover';
  END IF;
  IF p_base_xp IS NULL OR p_base_xp < 0 OR p_base_xp > 1000
     OR p_daily_cap IS NOT NULL AND (p_daily_cap < 0 OR p_daily_cap > 100000) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid reward bounds';
  END IF;
  IF p_evidence_eligible IS NULL OR p_competitive IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22004', MESSAGE = 'eligibility and competitive are required';
  END IF;
  IF length(btrim(coalesce(p_semantic_key, ''))) NOT BETWEEN 1 AND 300
     OR length(btrim(coalesce(p_dedupe_key, ''))) NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid internal idempotency key';
  END IF;
  IF p_xp_reason NOT IN (
    'card_review', 'practice_item', 'story_completed', 'story_quiz',
    'video_block', 'daily_quest', 'weekly_quest'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid qualified XP reason';
  END IF;
  IF p_evidence IS NOT NULL AND jsonb_typeof(p_evidence) <> 'object'
     OR coalesce(p_evidence, '{}'::jsonb) ? '_reward' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid or reserved evidence payload';
  END IF;

  -- Ordem de lock única para todo caller futuro: user_stats primeiro. Além de
  -- serializar cap/streak, elimina corridas entre event_id e semantic_key.
  PERFORM public.ensure_user_stats(p_user_id);
  SELECT * INTO STRICT v_stats
    FROM public.user_stats
   WHERE user_id = p_user_id
   FOR UPDATE;

  v_today := (statement_timestamp() AT TIME ZONE coalesce(v_stats.timezone, 'UTC'))::date;
  v_week_start := date_trunc('week', v_today::timestamp)::date;

  SELECT * INTO v_event
    FROM public.learning_events
   WHERE id = p_event_id;

  IF FOUND THEN
    IF v_event.user_id IS DISTINCT FROM p_user_id
       OR v_event.event_type IS DISTINCT FROM p_event_type
       OR v_event.subject_type IS DISTINCT FROM p_subject_type
       OR v_event.subject_id IS DISTINCT FROM p_subject_id
       OR v_event.session_id IS DISTINCT FROM p_session_id
       OR v_event.semantic_key IS DISTINCT FROM p_semantic_key
       OR v_event.source IS DISTINCT FROM p_source
       OR v_event.client_version IS DISTINCT FROM p_client_version
       OR (v_event.evidence - '_reward') IS DISTINCT FROM coalesce(p_evidence, '{}'::jsonb)
       OR v_event.evidence #>> '{_reward,dedupe_key}' IS DISTINCT FROM p_dedupe_key
       OR v_event.evidence #>> '{_reward,reason}' IS DISTINCT FROM p_xp_reason
       OR (v_event.evidence #>> '{_reward,base_xp}')::integer IS DISTINCT FROM p_base_xp
       OR (v_event.evidence #>> '{_reward,competitive}')::boolean IS DISTINCT FROM p_competitive
       OR (v_event.evidence #>> '{_reward,daily_cap}')::integer IS DISTINCT FROM p_daily_cap
       OR v_event.eligible IS DISTINCT FROM p_evidence_eligible
       OR v_event.eligibility_reason IS DISTINCT FROM p_eligibility_reason THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'event_id_conflict';
    END IF;

    SELECT * INTO v_ledger FROM public.xp_ledger WHERE learning_event_id = v_event.id;
    v_original_award := coalesce(v_ledger.amount, 0);
    RETURN jsonb_build_object(
      'ok', true, 'outcome', 'duplicate', 'event_id', v_event.id,
      'idempotent', true, 'evidence_eligible', v_event.eligible,
      'eligibility_reason', v_event.eligibility_reason,
      'xp_awarded', 0, 'original_award', v_original_award,
      'competitive_xp_awarded', 0, 'capped', false,
      'local_date', v_event.local_date,
      'stats', jsonb_build_object('xp_today', v_stats.xp_today, 'xp_week', v_stats.xp_week,
        'xp_total', v_stats.xp_total, 'streak', v_stats.streak,
        'streak_freezes', v_stats.streak_freezes)
    );
  END IF;

  SELECT * INTO v_event
    FROM public.learning_events
   WHERE user_id = p_user_id AND semantic_key = p_semantic_key;

  IF FOUND THEN
    IF v_event.event_type IS DISTINCT FROM p_event_type
       OR v_event.subject_type IS DISTINCT FROM p_subject_type
       OR v_event.subject_id IS DISTINCT FROM p_subject_id
       OR v_event.evidence #>> '{_reward,dedupe_key}' IS DISTINCT FROM p_dedupe_key
       OR v_event.evidence #>> '{_reward,reason}' IS DISTINCT FROM p_xp_reason
       OR (v_event.evidence #>> '{_reward,base_xp}')::integer IS DISTINCT FROM p_base_xp
       OR (v_event.evidence #>> '{_reward,competitive}')::boolean IS DISTINCT FROM p_competitive
       OR (v_event.evidence #>> '{_reward,daily_cap}')::integer IS DISTINCT FROM p_daily_cap THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'semantic_key_conflict';
    END IF;
    SELECT * INTO v_ledger FROM public.xp_ledger WHERE learning_event_id = v_event.id;
    v_original_award := coalesce(v_ledger.amount, 0);
    RETURN jsonb_build_object(
      'ok', true, 'outcome', 'duplicate', 'event_id', v_event.id,
      'idempotent', true, 'duplicate_by', 'semantic_key',
      'evidence_eligible', v_event.eligible,
      'eligibility_reason', v_event.eligibility_reason,
      'xp_awarded', 0, 'original_award', v_original_award,
      'competitive_xp_awarded', 0, 'capped', false,
      'local_date', v_event.local_date,
      'stats', jsonb_build_object('xp_today', v_stats.xp_today, 'xp_week', v_stats.xp_week,
        'xp_total', v_stats.xp_total, 'streak', v_stats.streak,
        'streak_freezes', v_stats.streak_freezes)
    );
  END IF;

  SELECT * INTO v_ledger
    FROM public.xp_ledger
   WHERE user_id = p_user_id AND dedupe_key = p_dedupe_key;
  v_reward_duplicate := FOUND;
  v_original_award := coalesce(v_ledger.amount, 0);
  IF v_reward_duplicate THEN
    SELECT * INTO STRICT v_reward_event
      FROM public.learning_events
     WHERE id = v_ledger.learning_event_id;
    IF v_ledger.entry_type <> 'award'
       OR v_ledger.reason IS DISTINCT FROM p_xp_reason
       OR v_ledger.competitive IS DISTINCT FROM p_competitive
       OR v_ledger.local_date IS DISTINCT FROM v_today
       OR v_reward_event.subject_type IS DISTINCT FROM p_subject_type
       OR v_reward_event.subject_id IS DISTINCT FROM p_subject_id THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'dedupe_key_conflict';
    END IF;
  END IF;

  IF p_evidence_eligible AND NOT v_reward_duplicate THEN
    SELECT coalesce(sum(amount), 0)::integer INTO v_cap_used
      FROM public.xp_ledger
     WHERE user_id = p_user_id
       AND local_date = v_today
       AND reason = p_xp_reason
       AND entry_type = 'award';

    v_cap_remaining := CASE WHEN p_daily_cap IS NULL THEN NULL
      ELSE greatest(p_daily_cap - v_cap_used, 0) END;
    v_award := CASE WHEN p_daily_cap IS NULL THEN p_base_xp
      ELSE least(p_base_xp, v_cap_remaining) END;
    v_capped := v_award < p_base_xp;
  ELSE
    v_cap_remaining := CASE WHEN p_daily_cap IS NULL THEN NULL
      ELSE greatest(p_daily_cap - v_cap_used, 0) END;
  END IF;

  v_evidence := coalesce(p_evidence, '{}'::jsonb) || jsonb_build_object(
    '_reward', jsonb_strip_nulls(jsonb_build_object(
      'base_xp', p_base_xp,
      'reason', p_xp_reason,
      'dedupe_key', p_dedupe_key,
      'awarded_xp', v_award,
      'competitive', p_competitive,
      'duplicate_entitlement', v_reward_duplicate,
      'daily_cap', p_daily_cap,
      'cap_used_before', v_cap_used
    ))
  );

  INSERT INTO public.learning_events (
    id, user_id, event_type, subject_type, subject_id, session_id,
    semantic_key, occurred_at, local_date, source, client_version,
    evidence, eligible, eligibility_reason
  ) VALUES (
    p_event_id, p_user_id, p_event_type, p_subject_type, p_subject_id, p_session_id,
    p_semantic_key, statement_timestamp(), v_today, p_source, p_client_version,
    v_evidence, p_evidence_eligible, p_eligibility_reason
  ) RETURNING * INTO v_event;

  IF v_award > 0 THEN
    INSERT INTO public.xp_ledger (
      user_id, learning_event_id, entry_type, reason, amount, dedupe_key,
      local_date, week_start, competitive
    ) VALUES (
      p_user_id, p_event_id, 'award', p_xp_reason, v_award, p_dedupe_key,
      v_today, v_week_start, p_competitive
    ) RETURNING * INTO v_ledger;

    v_diff_days := v_today - v_stats.last_study_date;
    v_last_week := date_trunc('week', v_stats.last_study_date::timestamp)::date;
    v_first_of_day := v_stats.last_study_date IS DISTINCT FROM v_today
      OR coalesce(v_stats.xp_today, 0) = 0;

    IF v_stats.last_study_date IS DISTINCT FROM v_today THEN
      v_stats.xp_today := v_award;
      v_stats.xp_week := CASE WHEN v_last_week = v_week_start
        THEN coalesce(v_stats.xp_week, 0) + v_award ELSE v_award END;

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
    ELSE
      v_stats.xp_today := coalesce(v_stats.xp_today, 0) + v_award;
      v_stats.xp_week := coalesce(v_stats.xp_week, 0) + v_award;
      IF coalesce(v_stats.streak, 0) = 0 THEN v_stats.streak := 1; END IF;
    END IF;

    v_stats.xp_total := coalesce(v_stats.xp_total, 0) + v_award;
    v_stats.last_study_date := v_today;

    UPDATE public.user_stats SET
      xp_today = v_stats.xp_today,
      xp_week = v_stats.xp_week,
      xp_total = v_stats.xp_total,
      streak = v_stats.streak,
      streak_freezes = v_stats.streak_freezes,
      last_study_date = v_stats.last_study_date,
      updated_at = statement_timestamp()
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'outcome', CASE WHEN p_evidence_eligible THEN 'accepted' ELSE 'ineligible' END,
    'event_id', v_event.id,
    'idempotent', false,
    'evidence_eligible', p_evidence_eligible,
    'eligibility_reason', p_eligibility_reason,
    'xp_awarded', v_award,
    'original_award', v_original_award,
    'competitive_xp_awarded', CASE WHEN p_competitive THEN v_award ELSE 0 END,
    'capped', v_capped,
    'reward_duplicate', v_reward_duplicate,
    'cap', jsonb_strip_nulls(jsonb_build_object(
      'limit', p_daily_cap, 'used', v_cap_used,
      'remaining', CASE WHEN p_daily_cap IS NULL THEN NULL ELSE greatest(v_cap_remaining - v_award, 0) END
    )),
    'local_date', v_today,
    'streak', jsonb_build_object('value', v_stats.streak, 'changed', v_first_of_day,
      'first_of_day', v_first_of_day),
    'stats', jsonb_build_object(
      'xp_today', v_stats.xp_today, 'xp_week', v_stats.xp_week,
      'xp_total', v_stats.xp_total, 'streak', v_stats.streak,
      'streak_freezes', v_stats.streak_freezes
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION private.commit_qualified_learning_event(
  uuid, uuid, text, text, text, uuid, text, text, text, text, jsonb,
  boolean, text, text, integer, boolean, integer
) FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION private.commit_qualified_learning_event(
  uuid, uuid, text, text, text, uuid, text, text, text, text, jsonb,
  boolean, text, text, integer, boolean, integer
) IS 'Portão interno P0.1: evento, ledger e projeção na mesma transação; sem acesso pela Data API.';
