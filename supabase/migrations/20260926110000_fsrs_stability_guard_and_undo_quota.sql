-- Proteção de estabilidade contra divisão por zero e exclusão de revisões desfeitas na cota diária.

ALTER FUNCTION public.record_card_review(uuid, smallint, jsonb, uuid)
  RENAME TO record_card_review_before_stability_guard;

REVOKE ALL ON FUNCTION public.record_card_review_before_stability_guard(uuid, smallint, jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

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
  v_timezone text;
  v_category text;
  v_new_today integer := 0;
  v_review_today integer := 0;
  v_new_limit integer := 20;
  v_review_limit integer := 200;
  v_leech_threshold integer := 8;
  v_leech_action text := 'tag';
  v_grad_int double precision := 1;
  v_easy_int double precision := 4;
  v_max_int double precision := 36500;
  v_int_mod double precision := 1;
  v_retention double precision := 0.9;
  v_learning_steps double precision[] := ARRAY[1, 10]::double precision[];
  v_relearning_steps double precision[] := ARRAY[10]::double precision[];
  v_setting text;
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
  v_diff_days integer;
  v_stats_before jsonb;
  v_stats_current jsonb;
  v_status text;
  v_interval double precision;
  v_step integer;
  v_reps integer;
  v_lapses integer;
  v_difficulty double precision;
  v_stability double precision;
  v_pre_lapse double precision;
  v_elapsed double precision;
  v_retrievability double precision;
  v_previous_difficulty double precision;
  v_active_steps double precision[];
  v_is_relearning boolean;
  v_due timestamptz;
  v_fsrs_w double precision[] := ARRAY[
    0.4872,1.4003,3.7145,13.8206,5.1618,1.2298,0.8975,0.031,
    1.6474,0.1367,1.0461,2.1072,0.0793,0.3246,1.587,0.2272,2.8755
  ]::double precision[];
  v_factor double precision := power(0.9, -2) - 1;
  v_decay double precision := -0.5;
  v_was_undone boolean := false;
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

  PERFORM public.ensure_user_stats(v_user_id);
  SELECT * INTO STRICT v_stats FROM public.user_stats WHERE user_id = v_user_id FOR UPDATE;
  v_timezone := coalesce(v_stats.timezone, 'UTC');
  v_today := (v_now AT TIME ZONE v_timezone)::date;
  v_stats_before := jsonb_build_object(
    'xp_today', v_stats.xp_today, 'xp_week', v_stats.xp_week,
    'xp_total', v_stats.xp_total, 'streak', v_stats.streak,
    'streak_freezes', v_stats.streak_freezes,
    'last_study_date', v_stats.last_study_date,
    'daily_counters', v_stats.daily_counters, 'counters_date', v_stats.counters_date
  );
  v_semantic_key := 'card_review_attempt:v3:' || p_card_id || ':' || p_client_review_id;
  v_dedupe_key := 'card_review:v2:' || p_card_id || ':' || v_today;

  SELECT * INTO v_existing FROM public.learning_events WHERE id = v_event_id;
  IF FOUND THEN
    IF v_existing.user_id IS DISTINCT FROM v_user_id
       OR v_existing.event_type IS DISTINCT FROM 'card_reviewed'
       OR v_existing.subject_id IS DISTINCT FROM p_card_id::text
       OR (v_existing.evidence->>'quality')::smallint IS DISTINCT FROM p_quality THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'operation_id_conflict';
    END IF;
    SELECT EXISTS (
      SELECT 1
        FROM public.card_review_undos undo
       WHERE undo.user_id = v_user_id
         AND undo.review_log_id = nullif(v_existing.evidence->>'review_log_id', '')::uuid
    ) INTO v_was_undone;
    IF v_was_undone THEN
      SELECT c.* INTO STRICT v_card
        FROM public.cards c
       WHERE c.id = p_card_id AND c.user_id = v_user_id;
      RETURN jsonb_build_object(
        'ok', true, 'outcome', 'undone',
        'accepted', false, 'eligible', false, 'idempotent', true,
        'eligibility_reason', 'review_was_undone',
        'reward_reason', 'review_was_undone',
        'card', to_jsonb(v_card),
        'card_before', v_existing.evidence->'card_before',
        'review_log_id', nullif(v_existing.evidence->>'review_log_id', '')::uuid,
        'xp_awarded', 0, 'original_award', 0
      );
    END IF;
    RETURN jsonb_build_object(
      'ok', true, 'outcome', CASE WHEN v_existing.eligible THEN 'duplicate' ELSE 'ineligible' END,
      'accepted', v_existing.eligible, 'eligible', v_existing.eligible, 'idempotent', true,
      'eligibility_reason', v_existing.eligibility_reason,
      'reward_reason', v_existing.evidence->>'reward_reason',
      'card', v_existing.evidence->'card_after',
      'card_before', v_existing.evidence->'card_before',
      'review_log_id', nullif(v_existing.evidence->>'review_log_id', '')::uuid,
      'xp_awarded', 0,
      'original_award', coalesce((v_existing.evidence #>> '{_reward,awarded_xp}')::integer, 0)
    );
  END IF;

  SELECT c.* INTO v_card
    FROM public.cards c JOIN public.words w ON w.id = c.word_id AND w.user_id = c.user_id
   WHERE c.id = p_card_id AND c.user_id = v_user_id FOR UPDATE OF c;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'card_not_found';
  END IF;

  SELECT category INTO v_category
    FROM public.words
   WHERE id = v_card.word_id AND user_id = v_user_id;
  v_before_json := to_jsonb(v_card);

  SELECT value INTO v_setting FROM public.settings WHERE user_id=v_user_id AND key='new_per_day';
  BEGIN
    IF lower(btrim(coalesce(v_setting,''))) IN ('nan','inf','+inf','-inf','infinity','+infinity','-infinity') THEN v_setting := NULL; END IF;
    v_new_limit := greatest(0, least(20, coalesce(nullif(btrim(v_setting), '')::integer, 20)));
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN v_new_limit := 20; END;
  SELECT value INTO v_setting FROM public.settings WHERE user_id=v_user_id AND key='max_reviews_per_day';
  BEGIN
    IF lower(btrim(coalesce(v_setting,''))) IN ('nan','inf','+inf','-inf','infinity','+infinity','-infinity') THEN v_setting := NULL; END IF;
    v_review_limit := greatest(1, least(1000, coalesce(nullif(btrim(v_setting), '')::integer, 200)));
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN v_review_limit := 200; END;
  SELECT value INTO v_setting FROM public.settings WHERE user_id=v_user_id AND key='leech_threshold';
  BEGIN
    IF lower(btrim(coalesce(v_setting,''))) IN ('nan','inf','+inf','-inf','infinity','+infinity','-infinity') THEN v_setting := NULL; END IF;
    v_leech_threshold := greatest(1, least(100, coalesce(nullif(btrim(v_setting), '')::integer, 8)));
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN v_leech_threshold := 8; END;
  SELECT value INTO v_setting FROM public.settings WHERE user_id=v_user_id AND key='leech_action';
  IF v_setting IN ('tag','suspend') THEN v_leech_action := v_setting; END IF;

  SELECT value INTO v_setting FROM public.settings WHERE user_id=v_user_id AND key='easy_interval';
  BEGIN
    IF lower(btrim(coalesce(v_setting,''))) IN ('nan','inf','+inf','-inf','infinity','+infinity','-infinity') THEN v_setting := NULL; END IF;
    v_easy_int := greatest(0.0001, coalesce(nullif(btrim(v_setting), '')::double precision, 4));
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN v_easy_int := 4; END;
  SELECT value INTO v_setting FROM public.settings WHERE user_id=v_user_id AND key='max_interval';
  BEGIN
    IF lower(btrim(coalesce(v_setting,''))) IN ('nan','inf','+inf','-inf','infinity','+infinity','-infinity') THEN v_setting := NULL; END IF;
    v_max_int := greatest(1, least(365000, coalesce(nullif(btrim(v_setting), '')::double precision, 36500)));
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN v_max_int := 36500; END;
  SELECT value INTO v_setting FROM public.settings WHERE user_id=v_user_id AND key='interval_modifier';
  BEGIN
    IF lower(btrim(coalesce(v_setting,''))) IN ('nan','inf','+inf','-inf','infinity','+infinity','-infinity') THEN v_setting := NULL; END IF;
    v_int_mod := greatest(0.01, least(10, coalesce(nullif(btrim(v_setting), '')::double precision / 100, 1)));
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN v_int_mod := 1; END;

  SELECT coalesce(cat.value, global.value) INTO v_setting
    FROM (SELECT 1) seed
    LEFT JOIN public.settings global ON global.user_id=v_user_id AND global.key='graduating_interval'
    LEFT JOIN public.settings cat ON cat.user_id=v_user_id AND cat.key='graduating_interval:' || v_category;
  BEGIN
    IF lower(btrim(coalesce(v_setting,''))) IN ('nan','inf','+inf','-inf','infinity','+infinity','-infinity') THEN v_setting := NULL; END IF;
    v_grad_int := greatest(0.0001, coalesce(nullif(btrim(v_setting), '')::double precision, 1));
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN v_grad_int := 1; END;
  SELECT coalesce(cat.value, global.value) INTO v_setting
    FROM (SELECT 1) seed
    LEFT JOIN public.settings global ON global.user_id=v_user_id AND global.key='lf_srs_retention'
    LEFT JOIN public.settings cat ON cat.user_id=v_user_id AND cat.key='lf_srs_retention:' || v_category;
  BEGIN
    IF lower(btrim(coalesce(v_setting,''))) IN ('nan','inf','+inf','-inf','infinity','+infinity','-infinity') THEN v_setting := NULL; END IF;
    v_retention := greatest(0.7, least(0.97, coalesce(nullif(btrim(v_setting), '')::double precision, 0.9)));
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN v_retention := 0.9; END;
  SELECT coalesce(cat.value, global.value) INTO v_setting
    FROM (SELECT 1) seed
    LEFT JOIN public.settings global ON global.user_id=v_user_id AND global.key='learning_steps'
    LEFT JOIN public.settings cat ON cat.user_id=v_user_id AND cat.key='learning_steps:' || v_category;
  BEGIN
    IF coalesce(v_setting,'') ~* '(^|[[:space:],])(nan|[+-]?inf(inity)?)([[:space:],]|$)' THEN
      v_setting := NULL;
    END IF;
    SELECT array_agg(x::double precision ORDER BY ord) INTO v_learning_steps
      FROM unnest(regexp_split_to_array(regexp_replace(coalesce(nullif(btrim(v_setting),''),'1 10'),'m','','gi'),'[[:space:],]+')) WITH ORDINALITY AS u(x,ord)
     WHERE x::double precision > 0;
    IF cardinality(v_learning_steps)=0 OR v_learning_steps IS NULL THEN v_learning_steps:=ARRAY[1,10]::double precision[]; END IF;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN v_learning_steps:=ARRAY[1,10]::double precision[]; END;
  SELECT value INTO v_setting FROM public.settings WHERE user_id=v_user_id AND key='relearning_steps';
  BEGIN
    IF coalesce(v_setting,'') ~* '(^|[[:space:],])(nan|[+-]?inf(inity)?)([[:space:],]|$)' THEN
      v_setting := NULL;
    END IF;
    SELECT array_agg(x::double precision ORDER BY ord) INTO v_relearning_steps
      FROM unnest(regexp_split_to_array(regexp_replace(coalesce(nullif(btrim(v_setting),''),'10'),'m','','gi'),'[[:space:],]+')) WITH ORDINALITY AS u(x,ord)
     WHERE x::double precision > 0;
    IF cardinality(v_relearning_steps)=0 OR v_relearning_steps IS NULL THEN v_relearning_steps:=ARRAY[10]::double precision[]; END IF;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN v_relearning_steps:=ARRAY[10]::double precision[]; END;

  IF v_card.suspended THEN v_reason := 'suspended';
  ELSIF v_card.due_date > v_now + interval '30 seconds' THEN v_reason := 'not_due';
  ELSIF v_card.status = 'new' THEN
    SELECT count(*)::integer INTO v_new_today
      FROM public.learning_events le
     WHERE le.user_id = v_user_id
       AND le.event_type = 'card_reviewed'
       AND le.eligible
       AND le.eligibility_reason = 'due_new'
       AND le.local_date = v_today
       AND NOT EXISTS (
         SELECT 1 FROM public.card_review_undos undo
          WHERE undo.user_id = v_user_id
            AND undo.review_log_id = nullif(le.evidence->>'review_log_id', '')::uuid
       );
    IF v_new_today >= v_new_limit THEN v_reason:='new_daily_limit'; ELSE v_eligible:=true; v_reason:='due_new'; END IF;
  ELSIF v_card.status IN ('review','mature') THEN
    SELECT count(*)::integer INTO v_review_today
      FROM public.review_log rl
     WHERE rl.user_id = v_user_id
       AND rl.date = v_today
       AND rl.previous_status IN ('review','mature')
       AND NOT EXISTS (
         SELECT 1 FROM public.card_review_undos undo
          WHERE undo.user_id = v_user_id
            AND undo.review_log_id = rl.id
       );
    IF v_review_today >= v_review_limit THEN v_reason:='review_daily_limit'; ELSE v_eligible:=true; v_reason:='due_review'; END IF;
  ELSIF v_card.status='learning' THEN v_eligible:=true; v_reason:='due_review';
  ELSE v_reason:='invalid_card_status'; END IF;

  IF v_eligible THEN
    v_status:=v_card.status; v_step:=coalesce(v_card.step_index,0); v_reps:=coalesce(v_card.reps,0)+1;
    v_lapses:=coalesce(v_card.lapses,0); v_pre_lapse:=coalesce(v_card.pre_lapse_interval,0);
    v_stability:=v_card.stability; v_difficulty:=v_card.difficulty;
    v_elapsed:=CASE WHEN v_card.last_review IS NULL THEN 0 ELSE greatest(0, extract(epoch FROM (v_now-v_card.last_review))/86400) END;
    v_is_relearning:=v_card.status='learning' AND v_pre_lapse>0;

    IF v_card.status IN ('new','learning') THEN
      v_active_steps:=CASE WHEN v_is_relearning THEN v_relearning_steps ELSE v_learning_steps END;
      IF v_difficulty IS NULL THEN v_difficulty:=greatest(1,least(10,v_fsrs_w[5]-(p_quality-3)*v_fsrs_w[6])); END IF;
      IF v_stability IS NULL OR v_stability <= 0 THEN v_stability:=greatest(0.1,v_fsrs_w[p_quality]); END IF;
      IF p_quality=1 THEN v_status:='learning'; v_step:=0; v_interval:=v_active_steps[1]/1440;
      ELSIF p_quality=2 THEN
        v_status:='learning'; v_step:=CASE WHEN v_card.status='new' THEN 0 ELSE least(v_step,cardinality(v_active_steps)-1) END;
        IF cardinality(v_active_steps)=1 THEN v_interval:=v_active_steps[1]*1.5/1440;
        ELSIF v_step=0 THEN v_interval:=(v_active_steps[1]+v_active_steps[2])/2/1440;
        ELSE v_interval:=v_active_steps[v_step+1]/1440; END IF;
      ELSIF p_quality=4 THEN
        IF NOT v_is_relearning THEN v_stability:=v_fsrs_w[4]; v_difficulty:=greatest(1,least(10,v_fsrs_w[5]-v_fsrs_w[6])); END IF;
        v_status:='review'; v_step:=0;
        v_interval:=least(v_max_int,greatest(v_easy_int,(v_stability/v_factor)*(power(v_retention,1/v_decay)-1)*v_int_mod));
      ELSE
        v_step:=CASE WHEN v_card.status='new' THEN 1 ELSE v_step+1 END;
        IF v_step>=cardinality(v_active_steps) THEN v_status:='review'; v_step:=0; v_interval:=least(v_max_int,greatest(v_grad_int,(v_stability/v_factor)*(power(v_retention,1/v_decay)-1)*v_int_mod));
        ELSE v_status:='learning'; v_interval:=v_active_steps[v_step+1]/1440; END IF;
      END IF;
    ELSE
      v_stability:=greatest(0.1, coalesce(nullif(v_card.stability, 0), greatest(coalesce(v_card.interval, 1), 0.1)));
      v_difficulty:=greatest(1, least(10, coalesce(v_card.difficulty, v_fsrs_w[5])));
      v_retrievability:=power(1+v_factor*greatest(v_elapsed,0.01)/v_stability,v_decay);
      v_previous_difficulty:=v_difficulty;
      v_difficulty:=greatest(1,least(10,v_fsrs_w[8]*(v_fsrs_w[5]-v_fsrs_w[6])+(1-v_fsrs_w[8])*(v_previous_difficulty-v_fsrs_w[7]*(p_quality-3))));
      IF p_quality=1 THEN
        v_stability:=greatest(0.1,v_fsrs_w[12]*power(v_previous_difficulty,-v_fsrs_w[13])*(power(v_stability+1,v_fsrs_w[14])-1)*exp(v_fsrs_w[15]*(1-v_retrievability)));
        v_pre_lapse:=greatest(0,coalesce(v_card.interval,0)); v_lapses:=v_lapses+1;
        v_status:='learning'; v_step:=0; v_interval:=v_relearning_steps[1]/1440;
      ELSE
        v_stability:=greatest(0.1,v_stability*(1+exp(v_fsrs_w[9])*(11-v_previous_difficulty)*power(v_stability,-v_fsrs_w[10])*(exp(v_fsrs_w[11]*(1-v_retrievability))-1)*CASE WHEN p_quality=2 THEN v_fsrs_w[16] ELSE 1 END*CASE WHEN p_quality=4 THEN v_fsrs_w[17] ELSE 1 END));
        v_interval:=least(v_max_int,greatest(1,(v_stability/v_factor)*(power(v_retention,1/v_decay)-1)*v_int_mod));
        v_status:=CASE WHEN v_interval>=21 THEN 'mature' ELSE 'review' END;
      END IF;
    END IF;
    IF v_interval>=1 THEN
      v_due:=(((v_now AT TIME ZONE v_timezone)::date + round(v_interval)::integer)::timestamp AT TIME ZONE v_timezone);
    ELSE v_due:=v_now + (round(v_interval*86400000)::bigint * interval '1 millisecond'); END IF;

    UPDATE public.cards SET status=v_status, interval=v_interval, ease_factor=coalesce(v_card.ease_factor,2.5),
      step_index=v_step, reps=v_reps, lapses=v_lapses, difficulty=v_difficulty, stability=v_stability,
      pre_lapse_interval=v_pre_lapse, due_date=v_due, last_review=v_now,
      introduced_at=CASE WHEN v_card.status='new' AND v_card.introduced_at IS NULL THEN v_now ELSE v_card.introduced_at END,
      is_leech=v_card.is_leech OR v_lapses>=v_leech_threshold,
      suspended=v_card.suspended OR (v_leech_action='suspend' AND v_lapses>=v_leech_threshold)
     WHERE id=p_card_id AND user_id=v_user_id RETURNING * INTO v_after;
    v_after_json:=to_jsonb(v_after); v_reward_reason:='eligible_card_review';
  ELSE
    v_after:=v_card; v_after_json:=v_before_json; v_log_id:=NULL; v_reward_reason:=v_reason;
  END IF;

  v_evidence:=jsonb_strip_nulls(jsonb_build_object('schema_version',3,'quality',p_quality,
    'review_log_id',v_log_id,'card_before',v_before_json,'card_after',v_after_json,'reward_reason',v_reward_reason));
  v_commit:=private.commit_qualified_learning_event(v_user_id,v_event_id,'card_reviewed','card',p_card_id::text,NULL,
    v_semantic_key,v_dedupe_key,'web',NULL,v_evidence,v_eligible,v_reason,'card_review',10,true,300);
  v_xp:=coalesce((v_commit->>'xp_awarded')::integer,0);

  IF v_eligible AND v_xp=0 THEN
    SELECT * INTO STRICT v_stats FROM public.user_stats WHERE user_id=v_user_id FOR UPDATE;
    IF v_stats.last_study_date IS DISTINCT FROM v_today THEN
      v_diff_days:=v_today-v_stats.last_study_date;
      IF v_diff_days=1 THEN v_stats.streak:=coalesce(v_stats.streak,0)+1;
      ELSIF v_diff_days=2 AND coalesce(v_stats.streak_freezes,0)>0 THEN v_stats.streak:=coalesce(v_stats.streak,0)+1; v_stats.streak_freezes:=v_stats.streak_freezes-1;
      ELSE v_stats.streak:=1; END IF;
      IF v_diff_days>=1 AND v_stats.streak>0 AND v_stats.streak%7=0 THEN v_stats.streak_freezes:=least(coalesce(v_stats.streak_freezes,0)+1,2); END IF;
      UPDATE public.user_stats SET streak=v_stats.streak,streak_freezes=v_stats.streak_freezes,last_study_date=v_today,updated_at=v_now WHERE user_id=v_user_id;
    END IF;
  END IF;
  SELECT stats_revision INTO STRICT v_revision_after FROM public.user_stats WHERE user_id=v_user_id;
  SELECT jsonb_build_object('xp_today',xp_today,'xp_week',xp_week,'xp_total',xp_total,'streak',streak,
    'streak_freezes',streak_freezes,'last_study_date',last_study_date) INTO STRICT v_stats_current
    FROM public.user_stats WHERE user_id=v_user_id;
  IF v_eligible THEN
    INSERT INTO public.review_log(id,user_id,card_id,quality,date,ts,client_review_id,previous_status,xp_awarded,
      stats_before,learning_event_id,card_before,card_after,eligibility_reason,reward_reason,stats_revision_after)
    VALUES(v_log_id,v_user_id,p_card_id,p_quality,v_today,v_now,p_client_review_id,v_card.status,v_xp,v_stats_before,
      v_event_id,v_before_json,v_after_json,v_reason,CASE WHEN (v_commit->>'reward_duplicate')::boolean THEN 'already_rewarded_today'
      WHEN (v_commit->>'capped')::boolean THEN 'competitive_daily_cap' ELSE 'eligible_card_review' END,v_revision_after)
    RETURNING * INTO v_log;
  END IF;
  RETURN jsonb_build_object('ok',true,'outcome',CASE WHEN v_eligible THEN 'accepted' ELSE 'ineligible' END,
    'accepted',v_eligible,'eligible',v_eligible,'idempotent',false,'eligibility_reason',v_reason,
    'reward_reason',CASE WHEN NOT v_eligible THEN v_reason WHEN (v_commit->>'reward_duplicate')::boolean THEN 'already_rewarded_today'
      WHEN (v_commit->>'capped')::boolean THEN 'competitive_daily_cap' ELSE 'eligible_card_review' END,
    'card',v_after_json,'card_before',v_before_json,'review_log_id',v_log_id,'xp_awarded',v_xp,
    'original_award',coalesce((v_commit->>'original_award')::integer,0),'stats',v_stats_current);
END;
$$;

REVOKE ALL ON FUNCTION public.record_card_review(uuid, smallint, jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_card_review(uuid, smallint, jsonb, uuid) TO authenticated;
