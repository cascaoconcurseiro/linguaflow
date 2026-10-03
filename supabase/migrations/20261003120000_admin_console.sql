-- Migration: 20261003120000_admin_console.sql
-- Issue #408 — Console administrativo completo.
-- Aditiva: cria papéis, auditoria append-only, backups restauráveis (7 dias), reset granular
-- por escopo, suspensão, exportação, métricas operacionais e aviso global.
-- Remove apenas as duas RPCs destrutivas antigas (reset_user_deck / reset_all_decks), substituídas
-- pelas versões com escopo, dry-run, backup e auditoria.
-- Rollback: reverter o PR; as tabelas novas podem permanecer sem efeito.

-- ── 1. Papéis ─────────────────────────────────────────────────────────────────
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin';

ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_role_check CHECK (role IN ('admin', 'support'));

-- ── 2. Auditoria append-only ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  target_user_id uuid,
  target_email text,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx ON public.admin_audit_log (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx ON public.admin_audit_log (action, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_log FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_audit_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log é append-only.' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS admin_audit_log_no_change ON public.admin_audit_log;
CREATE TRIGGER admin_audit_log_no_change
  BEFORE UPDATE OR DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.admin_audit_log_immutable();

-- ── 3. Backups restauráveis ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  actor_id uuid,
  target_user_id uuid NOT NULL,
  target_email text,
  scopes text[] NOT NULL,
  snapshot jsonb NOT NULL,
  row_counts jsonb NOT NULL,
  restored_at timestamptz,
  restored_by uuid
);

CREATE INDEX IF NOT EXISTS admin_backups_target_idx ON public.admin_backups (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_backups_expires_idx ON public.admin_backups (expires_at);

ALTER TABLE public.admin_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_backups FROM PUBLIC, anon, authenticated;

-- ── 4. Flags do sistema (aviso global) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_flags (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.admin_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_flags FROM PUBLIC, anon, authenticated;

-- ── 5. Helpers internos (não expostos ao PostgREST) ───────────────────────────
CREATE OR REPLACE FUNCTION public.admin_assert_role(p_session_token uuid, p_write boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  PERFORM public.admin_assert_session(p_session_token);

  SELECT role INTO v_role FROM public.admin_users WHERE user_id = auth.uid();
  IF p_write AND v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acesso negado: o perfil de suporte é somente leitura.'
      USING ERRCODE = '42501';
  END IF;
  RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assert_recent_session(p_session_token uuid, p_minutes int DEFAULT 5)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE user_id = auth.uid()
      AND token = p_session_token
      AND created_at > now() - make_interval(mins => p_minutes)
  ) THEN
    RAISE EXCEPTION 'Esta ação exige PIN revalidado nos últimos % minutos.', p_minutes
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_write_audit(
  p_action text,
  p_target uuid,
  p_params jsonb DEFAULT '{}'::jsonb,
  p_result jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (actor_id, actor_email, action, target_user_id, target_email, params, result)
  VALUES (
    auth.uid(),
    (SELECT email::text FROM auth.users WHERE id = auth.uid()),
    p_action,
    p_target,
    (SELECT email::text FROM auth.users WHERE id = p_target),
    COALESCE(p_params, '{}'::jsonb),
    COALESCE(p_result, '{}'::jsonb)
  );
END;
$$;

-- Escopos → tabelas em ordem de exclusão (filhos antes dos pais; sem duplicatas).
-- 'progress' inclui o histórico de revisões porque review_log/card_review_undos
-- referenciam learning_events (FK NO ACTION).
CREATE OR REPLACE FUNCTION public.admin_scope_tables(p_scopes text[])
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order constant text[] := ARRAY['cards', 'courses', 'fluency', 'progress', 'content', 'telemetry', 'settings'];
  v_requested text[];
  v_scope text;
  v_tbl text;
  v_list text[];
  v_result text[] := '{}';
BEGIN
  IF p_scopes IS NULL OR cardinality(p_scopes) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um escopo.';
  END IF;

  IF 'all' = ANY (p_scopes) THEN
    v_requested := v_order;
  ELSE
    v_requested := p_scopes;
  END IF;

  FOREACH v_scope IN ARRAY v_requested LOOP
    IF NOT (v_scope = ANY (v_order)) THEN
      RAISE EXCEPTION 'Escopo inválido: %', v_scope;
    END IF;
  END LOOP;

  FOREACH v_scope IN ARRAY v_order LOOP
    CONTINUE WHEN NOT (v_scope = ANY (v_requested));

    v_list := CASE v_scope
      WHEN 'cards' THEN ARRAY['card_review_undos', 'review_log', 'card_learning_signals', 'card_adaptive_profiles',
                              'cards', 'words', 'known_words', 'ignored_words', 'sentences']
      WHEN 'courses' THEN ARRAY['course_session_results', 'course_practice_sessions', 'course_user_mistakes',
                                'course_user_notes', 'course_user_reviews', 'course_user_vocabulary',
                                'user_course_enrollment']
      WHEN 'fluency' THEN ARRAY['fluency_task_submissions', 'fluency_task_issues', 'learning_task_attempts',
                                'fluency_skill_profiles']
      WHEN 'progress' THEN ARRAY['card_review_undos', 'review_log', 'xp_ledger', 'learning_events',
                                 'user_achievements', 'study_time_heartbeats', 'listening_intervals',
                                 'media_watch_sessions', 'sessions', 'user_stats']
      WHEN 'content' THEN ARRAY['stories', 'reader_texts', 'translation_cache']
      WHEN 'telemetry' THEN ARRAY['api_usage_log', 'client_errors']
      WHEN 'settings' THEN ARRAY['settings', 'push_subscriptions']
    END;

    FOREACH v_tbl IN ARRAY v_list LOOP
      IF NOT (v_tbl = ANY (v_result)) THEN
        v_result := v_result || v_tbl;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_count_user_rows(p_user uuid, p_tables text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tbl text;
  v_n bigint;
  v_out jsonb := '{}'::jsonb;
BEGIN
  FOREACH v_tbl IN ARRAY p_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id = $1', v_tbl) INTO v_n USING p_user;
    v_out := v_out || jsonb_build_object(v_tbl, v_n);
  END LOOP;
  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_snapshot_user(p_user uuid, p_tables text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tbl text;
  v_rows jsonb;
  v_out jsonb := '{}'::jsonb;
BEGIN
  FOREACH v_tbl IN ARRAY p_tables LOOP
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) FROM public.%I x WHERE x.user_id = $1', v_tbl)
      INTO v_rows USING p_user;
    v_out := v_out || jsonb_build_object(v_tbl, v_rows);
  END LOOP;
  RETURN v_out;
END;
$$;

-- Zera apenas os campos de progresso de user_stats, preservando perfil (username, avatar, e-mail, fuso).
CREATE OR REPLACE FUNCTION public.admin_zero_user_stats(p_user uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n int;
BEGIN
  UPDATE public.user_stats
     SET xp_today = 0, xp_week = 0, xp_total = 0, league_index = 0, streak = 0,
         streak_freezes = 1, daily_counters = '{}'::jsonb, weekly_claim_week = NULL,
         last_study_date = CURRENT_DATE
   WHERE (p_user IS NULL OR user_id = p_user);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_purge_expired_backups()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n int;
BEGIN
  DELETE FROM public.admin_backups WHERE expires_at < now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assert_role(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_assert_recent_session(uuid, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_write_audit(text, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_scope_tables(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_count_user_rows(uuid, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_snapshot_user(uuid, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_zero_user_stats(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_purge_expired_backups() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_audit_log_immutable() FROM PUBLIC, anon, authenticated;

-- ── 6. Substitui as RPCs destrutivas antigas ──────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_reset_user_deck(uuid, uuid);
DROP FUNCTION IF EXISTS public.admin_reset_all_decks(uuid);

-- ── 7. Reset granular de um usuário (dry-run, backup, auditoria) ──────────────
CREATE OR REPLACE FUNCTION public.admin_reset_user_data(
  p_session_token uuid,
  p_target_user_id uuid,
  p_scopes text[],
  p_dry_run boolean DEFAULT true,
  p_make_backup boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tables text[];
  v_tbl text;
  v_counts jsonb;
  v_total bigint := 0;
  v_deleted jsonb := '{}'::jsonb;
  v_n bigint;
  v_backup_id uuid;
  v_email text;
BEGIN
  PERFORM public.admin_assert_role(p_session_token, NOT p_dry_run);

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'ID de usuário obrigatório.';
  END IF;

  SELECT email::text INTO v_email FROM auth.users WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  v_tables := public.admin_scope_tables(p_scopes);
  v_counts := public.admin_count_user_rows(p_target_user_id, v_tables);
  SELECT COALESCE(sum(value::bigint), 0) INTO v_total FROM jsonb_each_text(v_counts);

  IF p_dry_run THEN
    RETURN jsonb_build_object('ok', true, 'dry_run', true, 'user_id', p_target_user_id,
                              'email', v_email, 'scopes', to_jsonb(p_scopes),
                              'counts', v_counts, 'total', v_total);
  END IF;

  IF p_make_backup THEN
    IF v_total > 250000 THEN
      RAISE EXCEPTION 'Volume grande demais para backup em linha (% linhas). Exporte os dados antes de resetar.', v_total;
    END IF;
    PERFORM public.admin_purge_expired_backups();
    INSERT INTO public.admin_backups (actor_id, target_user_id, target_email, scopes, snapshot, row_counts)
    VALUES (auth.uid(), p_target_user_id, v_email, v_tables,
            public.admin_snapshot_user(p_target_user_id, v_tables), v_counts)
    RETURNING id INTO v_backup_id;
  END IF;

  FOREACH v_tbl IN ARRAY v_tables LOOP
    IF v_tbl = 'user_stats' THEN
      v_n := public.admin_zero_user_stats(p_target_user_id);
    ELSE
      EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', v_tbl) USING p_target_user_id;
      GET DIAGNOSTICS v_n = ROW_COUNT;
    END IF;
    v_deleted := v_deleted || jsonb_build_object(v_tbl, v_n);
  END LOOP;

  PERFORM public.admin_write_audit(
    'reset_user_data', p_target_user_id,
    jsonb_build_object('scopes', to_jsonb(p_scopes), 'backup', p_make_backup),
    jsonb_build_object('backup_id', v_backup_id, 'deleted', v_deleted, 'total', v_total)
  );

  RETURN jsonb_build_object('ok', true, 'dry_run', false, 'user_id', p_target_user_id,
                            'email', v_email, 'backup_id', v_backup_id,
                            'deleted', v_deleted, 'total', v_total);
END;
$$;

-- ── 8. Reset global por escopo (sem backup; PIN recente + frase no servidor) ──
CREATE OR REPLACE FUNCTION public.admin_reset_all_users_data(
  p_session_token uuid,
  p_scopes text[],
  p_dry_run boolean DEFAULT true,
  p_confirm_phrase text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tables text[];
  v_tbl text;
  v_n bigint;
  v_counts jsonb := '{}'::jsonb;
  v_deleted jsonb := '{}'::jsonb;
  v_total bigint := 0;
BEGIN
  PERFORM public.admin_assert_role(p_session_token, NOT p_dry_run);
  v_tables := public.admin_scope_tables(p_scopes);

  FOREACH v_tbl IN ARRAY v_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_tbl) INTO v_n;
    v_counts := v_counts || jsonb_build_object(v_tbl, v_n);
    v_total := v_total + v_n;
  END LOOP;

  IF p_dry_run THEN
    RETURN jsonb_build_object('ok', true, 'dry_run', true, 'scopes', to_jsonb(p_scopes),
                              'counts', v_counts, 'total', v_total,
                              'users', (SELECT count(*) FROM auth.users));
  END IF;

  PERFORM public.admin_assert_recent_session(p_session_token, 5);
  IF p_confirm_phrase IS DISTINCT FROM 'RESETAR TODOS' THEN
    RAISE EXCEPTION 'Frase de confirmação incorreta.' USING ERRCODE = '42501';
  END IF;

  FOREACH v_tbl IN ARRAY v_tables LOOP
    IF v_tbl = 'user_stats' THEN
      v_n := public.admin_zero_user_stats(NULL);
    ELSE
      EXECUTE format('DELETE FROM public.%I WHERE true', v_tbl);
      GET DIAGNOSTICS v_n = ROW_COUNT;
    END IF;
    v_deleted := v_deleted || jsonb_build_object(v_tbl, v_n);
  END LOOP;

  PERFORM public.admin_write_audit(
    'reset_all_users_data', NULL,
    jsonb_build_object('scopes', to_jsonb(p_scopes)),
    jsonb_build_object('deleted', v_deleted, 'total', v_total)
  );

  RETURN jsonb_build_object('ok', true, 'dry_run', false, 'deleted', v_deleted, 'total', v_total);
END;
$$;

-- ── 9. Backups: listar, restaurar, apagar ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_backups(p_session_token uuid, p_user uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  PERFORM public.admin_assert_role(p_session_token, false);

  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(b) ORDER BY b.created_at DESC)
    FROM (
      SELECT id, created_at, expires_at, target_user_id,
             COALESCE(target_email, (SELECT email::text FROM auth.users u WHERE u.id = k.target_user_id)) AS target_email,
             scopes, row_counts, restored_at,
             (expires_at < now()) AS expired
      FROM public.admin_backups k
      WHERE (p_user IS NULL OR target_user_id = p_user)
      ORDER BY created_at DESC
      LIMIT 100
    ) b
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restore_backup(p_session_token uuid, p_backup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_b public.admin_backups%ROWTYPE;
  v_tbl text;
  v_n bigint;
  v_restored jsonb := '{}'::jsonb;
  v_skipped jsonb := '{}'::jsonb;
  v_i int;
BEGIN
  PERFORM public.admin_assert_role(p_session_token, true);

  SELECT * INTO v_b FROM public.admin_backups WHERE id = p_backup_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Backup não encontrado.';
  END IF;
  IF v_b.restored_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este backup já foi restaurado.';
  END IF;
  IF v_b.expires_at < now() THEN
    RAISE EXCEPTION 'Este backup expirou.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_b.target_user_id) THEN
    RAISE EXCEPTION 'A conta de origem deste backup não existe mais.';
  END IF;

  -- Ordem inversa da exclusão: pais antes dos filhos.
  FOR v_i IN REVERSE cardinality(v_b.scopes)..1 LOOP
    v_tbl := v_b.scopes[v_i];

    IF v_tbl = 'user_stats' THEN
      UPDATE public.user_stats s
         SET xp_today = r.xp_today, xp_week = r.xp_week, xp_total = r.xp_total,
             league_index = r.league_index, streak = r.streak, streak_freezes = r.streak_freezes,
             daily_counters = r.daily_counters, weekly_claim_week = r.weekly_claim_week,
             last_study_date = r.last_study_date
        FROM jsonb_populate_recordset(NULL::public.user_stats, v_b.snapshot -> 'user_stats') r
       WHERE s.user_id = r.user_id;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_restored := v_restored || jsonb_build_object(v_tbl, v_n);
      CONTINUE;
    END IF;

    BEGIN
      EXECUTE format(
        'INSERT INTO public.%1$I SELECT * FROM jsonb_populate_recordset(NULL::public.%1$I, $1) ON CONFLICT DO NOTHING',
        v_tbl
      ) USING COALESCE(v_b.snapshot -> v_tbl, '[]'::jsonb);
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_restored := v_restored || jsonb_build_object(v_tbl, v_n);
    EXCEPTION WHEN foreign_key_violation THEN
      v_skipped := v_skipped || jsonb_build_object(v_tbl, jsonb_array_length(COALESCE(v_b.snapshot -> v_tbl, '[]'::jsonb)));
    END;
  END LOOP;

  UPDATE public.admin_backups SET restored_at = now(), restored_by = auth.uid() WHERE id = p_backup_id;

  PERFORM public.admin_write_audit(
    'restore_backup', v_b.target_user_id,
    jsonb_build_object('backup_id', p_backup_id, 'scopes', to_jsonb(v_b.scopes)),
    jsonb_build_object('restored', v_restored, 'skipped_fk', v_skipped)
  );

  RETURN jsonb_build_object('ok', true, 'user_id', v_b.target_user_id,
                            'restored', v_restored, 'skipped_fk', v_skipped);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_backup(p_session_token uuid, p_backup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_target uuid;
BEGIN
  PERFORM public.admin_assert_role(p_session_token, true);

  DELETE FROM public.admin_backups WHERE id = p_backup_id RETURNING target_user_id INTO v_target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Backup não encontrado.';
  END IF;

  PERFORM public.admin_write_audit('delete_backup', v_target, jsonb_build_object('backup_id', p_backup_id), '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── 10. Suspensão, sessões e exclusão de conta ────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_user_suspended(
  p_session_token uuid,
  p_target_user_id uuid,
  p_suspended boolean,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  PERFORM public.admin_assert_role(p_session_token, true);

  IF p_target_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;
  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Operação cancelada: o administrador não pode suspender a própria conta.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'Operação cancelada: contas de administradores não podem ser suspensas por esta via.';
  END IF;

  UPDATE auth.users
     SET banned_until = CASE WHEN p_suspended THEN 'infinity'::timestamptz ELSE NULL END
   WHERE id = p_target_user_id;

  IF p_suspended THEN
    DELETE FROM auth.sessions WHERE user_id = p_target_user_id;
  END IF;

  PERFORM public.admin_write_audit(
    CASE WHEN p_suspended THEN 'suspend_user' ELSE 'unsuspend_user' END,
    p_target_user_id,
    jsonb_build_object('reason', left(COALESCE(p_reason, ''), 500)),
    '{}'::jsonb
  );

  RETURN jsonb_build_object('ok', true, 'suspended', p_suspended);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_user_sessions(p_session_token uuid, p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_n int;
BEGIN
  PERFORM public.admin_assert_role(p_session_token, true);

  IF p_target_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  DELETE FROM auth.sessions WHERE user_id = p_target_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  PERFORM public.admin_write_audit('revoke_sessions', p_target_user_id, '{}'::jsonb, jsonb_build_object('sessions', v_n));
  RETURN jsonb_build_object('ok', true, 'sessions_revoked', v_n);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_session_token uuid, p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_target_email text;
  v_counts jsonb;
BEGIN
  PERFORM public.admin_assert_role(p_session_token, true);

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'ID de usuário obrigatório.';
  END IF;
  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Operação cancelada: o administrador não pode excluir a própria conta.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'Operação cancelada: contas de administradores não podem ser excluídas por esta via.';
  END IF;

  SELECT email::text INTO v_target_email FROM auth.users WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  v_counts := public.admin_count_user_rows(p_target_user_id, public.admin_scope_tables(ARRAY['all']));

  -- Auditoria antes da exclusão para registrar o e-mail do alvo.
  PERFORM public.admin_write_audit('delete_user', p_target_user_id, '{}'::jsonb,
                                   jsonb_build_object('rows_deleted', v_counts));

  DELETE FROM auth.users WHERE id = p_target_user_id;

  RETURN jsonb_build_object('ok', true, 'user_id', p_target_user_id, 'deleted_email', v_target_email);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_client_errors(p_session_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_count int;
BEGIN
  PERFORM public.admin_assert_role(p_session_token, true);

  WITH del_e AS (DELETE FROM public.client_errors WHERE true RETURNING id)
  SELECT count(*)::int INTO v_count FROM del_e;

  PERFORM public.admin_write_audit('clear_client_errors', NULL, '{}'::jsonb, jsonb_build_object('errors_cleared', v_count));
  RETURN jsonb_build_object('ok', true, 'errors_cleared', v_count);
END;
$$;

-- ── 11. Leitura: usuários, detalhe, exportação ────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_users_page(
  p_session_token uuid,
  p_search text DEFAULT NULL,
  p_filter text DEFAULT 'all',
  p_limit int DEFAULT 25,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_pattern text;
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
  v_total int;
  v_rows jsonb;
BEGIN
  PERFORM public.admin_assert_role(p_session_token, false);

  IF p_filter NOT IN ('all', 'suspended', 'admins', 'inactive_30d', 'new_7d') THEN
    RAISE EXCEPTION 'Filtro inválido.';
  END IF;

  v_pattern := CASE WHEN p_search IS NULL OR btrim(p_search) = '' THEN NULL
                    ELSE '%' || regexp_replace(btrim(p_search), '([\\%_])', '\\\1', 'g') || '%' END;

  WITH filtered AS (
    SELECT u.id
    FROM auth.users u
    LEFT JOIN public.user_stats s ON s.user_id = u.id
    LEFT JOIN public.admin_users a ON a.user_id = u.id
    WHERE (v_pattern IS NULL
           OR u.email ILIKE v_pattern ESCAPE E'\\'
           OR s.username ILIKE v_pattern ESCAPE E'\\')
      AND CASE p_filter
            WHEN 'suspended' THEN u.banned_until IS NOT NULL AND u.banned_until > now()
            WHEN 'admins' THEN a.user_id IS NOT NULL
            WHEN 'inactive_30d' THEN COALESCE(s.last_study_date, u.created_at::date) < CURRENT_DATE - 30
            WHEN 'new_7d' THEN u.created_at >= now() - interval '7 days'
            ELSE true
          END
  )
  SELECT
    (SELECT count(*) FROM filtered),
    COALESCE((
      SELECT jsonb_agg(page.r ORDER BY page.created_at DESC)
      FROM (
        SELECT u.created_at, jsonb_build_object(
          'id', u.id,
          'email', u.email::text,
          'username', COALESCE(s.username, split_part(u.email::text, '@', 1)),
          'created_at', u.created_at,
          'last_sign_in_at', u.last_sign_in_at,
          'xp_total', COALESCE(s.xp_total, 0),
          'streak', COALESCE(s.streak, 0),
          'last_study_date', s.last_study_date,
          'role', a.role,
          'suspended', (u.banned_until IS NOT NULL AND u.banned_until > now()),
          'total_words', (SELECT count(*) FROM public.words w WHERE w.user_id = u.id),
          'total_cards', (SELECT count(*) FROM public.cards c WHERE c.user_id = u.id),
          'total_reviews', (SELECT count(*) FROM public.review_log rl WHERE rl.user_id = u.id)
        ) AS r
        FROM auth.users u
        LEFT JOIN public.user_stats s ON s.user_id = u.id
        LEFT JOIN public.admin_users a ON a.user_id = u.id
        WHERE u.id IN (SELECT id FROM filtered)
        ORDER BY u.created_at DESC
        LIMIT v_limit OFFSET v_offset
      ) page
    ), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'limit', v_limit, 'offset', v_offset, 'rows', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_user_detail(p_session_token uuid, p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_u auth.users%ROWTYPE;
  v_stats public.user_stats%ROWTYPE;
  v_role text;
BEGIN
  PERFORM public.admin_assert_role(p_session_token, false);

  SELECT * INTO v_u FROM auth.users WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;
  SELECT * INTO v_stats FROM public.user_stats WHERE user_id = p_target_user_id;
  SELECT role INTO v_role FROM public.admin_users WHERE user_id = p_target_user_id;

  RETURN jsonb_build_object(
    'id', v_u.id,
    'email', v_u.email::text,
    'created_at', v_u.created_at,
    'last_sign_in_at', v_u.last_sign_in_at,
    'email_confirmed', v_u.email_confirmed_at IS NOT NULL,
    'suspended', (v_u.banned_until IS NOT NULL AND v_u.banned_until > now()),
    'role', v_role,
    'profile', jsonb_build_object(
      'username', v_stats.username,
      'xp_total', COALESCE(v_stats.xp_total, 0),
      'xp_week', COALESCE(v_stats.xp_week, 0),
      'streak', COALESCE(v_stats.streak, 0),
      'league_index', COALESCE(v_stats.league_index, 0),
      'last_study_date', v_stats.last_study_date,
      'timezone', v_stats.timezone,
      'email_opt_in', COALESCE(v_stats.email_opt_in, false)
    ),
    'counts', public.admin_count_user_rows(p_target_user_id, public.admin_scope_tables(ARRAY['all'])),
    'study_seconds', (SELECT COALESCE(sum(seconds), 0) FROM public.sessions WHERE user_id = p_target_user_id),
    'api_calls_30d', (SELECT count(*) FROM public.api_usage_log
                      WHERE user_id = p_target_user_id AND created_at >= now() - interval '30 days'),
    'errors_7d', (SELECT count(*) FROM public.client_errors
                  WHERE user_id = p_target_user_id AND created_at >= now() - interval '7 days'),
    'backups', (SELECT count(*) FROM public.admin_backups
                WHERE target_user_id = p_target_user_id AND restored_at IS NULL AND expires_at > now()),
    'recent_audit', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('action', a.action, 'actor_email', a.actor_email,
                                          'created_at', a.created_at) ORDER BY a.created_at DESC)
      FROM (SELECT * FROM public.admin_audit_log WHERE target_user_id = p_target_user_id
            ORDER BY created_at DESC LIMIT 10) a
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_export_user_data(p_session_token uuid, p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_u auth.users%ROWTYPE;
  v_tables text[];
  v_snapshot jsonb;
BEGIN
  PERFORM public.admin_assert_role(p_session_token, true);

  SELECT * INTO v_u FROM auth.users WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  v_tables := ARRAY(SELECT t FROM unnest(public.admin_scope_tables(ARRAY['all'])) t WHERE t <> 'push_subscriptions');
  v_snapshot := public.admin_snapshot_user(p_target_user_id, v_tables);

  PERFORM public.admin_write_audit('export_user', p_target_user_id, '{}'::jsonb,
                                   public.admin_count_user_rows(p_target_user_id, v_tables));

  RETURN jsonb_build_object(
    'exported_at', now(),
    'account', jsonb_build_object('id', v_u.id, 'email', v_u.email::text,
                                  'created_at', v_u.created_at, 'last_sign_in_at', v_u.last_sign_in_at),
    'data', v_snapshot
  );
END;
$$;

-- ── 12. Visão geral, erros, uso de API ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_overview(p_session_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  PERFORM public.admin_assert_role(p_session_token, false);

  RETURN jsonb_build_object(
    'totals', jsonb_build_object(
      'users', (SELECT count(*) FROM auth.users),
      'suspended', (SELECT count(*) FROM auth.users WHERE banned_until IS NOT NULL AND banned_until > now()),
      'admins', (SELECT count(*) FROM public.admin_users),
      'words', (SELECT count(*) FROM public.words),
      'cards', (SELECT count(*) FROM public.cards),
      'reviews', (SELECT count(*) FROM public.review_log),
      'stories', (SELECT count(*) FROM public.stories)
    ),
    'growth', jsonb_build_object(
      'new_7d', (SELECT count(*) FROM auth.users WHERE created_at >= now() - interval '7 days'),
      'new_30d', (SELECT count(*) FROM auth.users WHERE created_at >= now() - interval '30 days'),
      'active_1d', (SELECT count(*) FROM public.user_stats WHERE last_study_date >= CURRENT_DATE - 1),
      'active_7d', (SELECT count(*) FROM public.user_stats WHERE last_study_date >= CURRENT_DATE - 7),
      'active_30d', (SELECT count(*) FROM public.user_stats WHERE last_study_date >= CURRENT_DATE - 30)
    ),
    'signups_14d', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', d.day::date, 'count', COALESCE(c.n, 0)) ORDER BY d.day)
      FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, interval '1 day') AS d(day)
      LEFT JOIN (SELECT created_at::date AS day, count(*) AS n FROM auth.users
                 WHERE created_at >= CURRENT_DATE - 13 GROUP BY 1) c ON c.day = d.day::date
    ), '[]'::jsonb),
    'errors_24h', (SELECT count(*) FROM public.client_errors WHERE created_at >= now() - interval '24 hours'),
    'api_calls_24h', (SELECT count(*) FROM public.api_usage_log WHERE created_at >= now() - interval '24 hours'),
    'api_by_endpoint_24h', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('endpoint', e.endpoint, 'count', e.n) ORDER BY e.n DESC)
      FROM (SELECT endpoint, count(*) AS n FROM public.api_usage_log
            WHERE created_at >= now() - interval '24 hours' GROUP BY 1 ORDER BY 2 DESC LIMIT 8) e
    ), '[]'::jsonb),
    'backups_active', (SELECT count(*) FROM public.admin_backups WHERE restored_at IS NULL AND expires_at > now()),
    'backups_expiring_48h', (SELECT count(*) FROM public.admin_backups
                             WHERE restored_at IS NULL AND expires_at > now() AND expires_at < now() + interval '48 hours'),
    'admin_actions_24h', (SELECT count(*) FROM public.admin_audit_log WHERE created_at >= now() - interval '24 hours')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_errors(p_session_token uuid, p_limit int DEFAULT 50, p_user uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  PERFORM public.admin_assert_role(p_session_token, false);

  RETURN jsonb_build_object(
    'groups', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('source', g.source, 'error_name', g.error_name,
                                          'count', g.n, 'last_seen', g.last_seen) ORDER BY g.n DESC)
      FROM (SELECT source, error_name, count(*) AS n, max(created_at) AS last_seen
            FROM public.client_errors
            WHERE created_at >= now() - interval '7 days' AND (p_user IS NULL OR user_id = p_user)
            GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 15) g
    ), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', r.id, 'user_id', r.user_id,
               'email', (SELECT email::text FROM auth.users u WHERE u.id = r.user_id),
               'source', r.source, 'error_name', r.error_name, 'route', r.route,
               'app_version', r.app_version, 'created_at', r.created_at) ORDER BY r.created_at DESC)
      FROM (SELECT * FROM public.client_errors WHERE (p_user IS NULL OR user_id = p_user)
            ORDER BY created_at DESC LIMIT v_limit) r
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_api_usage(p_session_token uuid, p_days int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_days int := LEAST(GREATEST(COALESCE(p_days, 7), 1), 90);
BEGIN
  PERFORM public.admin_assert_role(p_session_token, false);

  RETURN jsonb_build_object(
    'days', v_days,
    'total', (SELECT count(*) FROM public.api_usage_log WHERE created_at >= now() - make_interval(days => v_days)),
    'by_day', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', d.day::date, 'count', COALESCE(c.n, 0)) ORDER BY d.day)
      FROM generate_series(CURRENT_DATE - (v_days - 1), CURRENT_DATE, interval '1 day') AS d(day)
      LEFT JOIN (SELECT created_at::date AS day, count(*) AS n FROM public.api_usage_log
                 WHERE created_at >= CURRENT_DATE - (v_days - 1) GROUP BY 1) c ON c.day = d.day::date
    ), '[]'::jsonb),
    'by_endpoint', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('endpoint', e.endpoint, 'count', e.n) ORDER BY e.n DESC)
      FROM (SELECT endpoint, count(*) AS n FROM public.api_usage_log
            WHERE created_at >= now() - make_interval(days => v_days) GROUP BY 1 ORDER BY 2 DESC LIMIT 10) e
    ), '[]'::jsonb),
    'top_users', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('user_id', t.user_id,
                                          'email', (SELECT email::text FROM auth.users u WHERE u.id = t.user_id),
                                          'count', t.n) ORDER BY t.n DESC)
      FROM (SELECT user_id, count(*) AS n FROM public.api_usage_log
            WHERE created_at >= now() - make_interval(days => v_days) GROUP BY 1 ORDER BY 2 DESC LIMIT 10) t
    ), '[]'::jsonb)
  );
END;
$$;

-- ── 13. Auditoria (leitura) ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_audit(
  p_session_token uuid,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_action text DEFAULT NULL,
  p_target uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  PERFORM public.admin_assert_role(p_session_token, false);

  RETURN jsonb_build_object(
    'total', (SELECT count(*) FROM public.admin_audit_log
              WHERE (p_action IS NULL OR action = p_action) AND (p_target IS NULL OR target_user_id = p_target)),
    'rows', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC, a.id DESC)
      FROM (SELECT id, actor_email, action, target_user_id, target_email, params, result, created_at
            FROM public.admin_audit_log
            WHERE (p_action IS NULL OR action = p_action) AND (p_target IS NULL OR target_user_id = p_target)
            ORDER BY created_at DESC, id DESC LIMIT v_limit OFFSET v_offset) a
    ), '[]'::jsonb)
  );
END;
$$;

-- ── 14. Administradores e papéis ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_admins(p_session_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  PERFORM public.admin_assert_role(p_session_token, false);

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('user_id', a.user_id, 'email', u.email::text,
                                        'role', a.role, 'created_at', a.created_at) ORDER BY a.created_at)
    FROM public.admin_users a
    LEFT JOIN auth.users u ON u.id = a.user_id
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_admin_role(p_session_token uuid, p_target_user_id uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_previous text;
BEGIN
  PERFORM public.admin_assert_role(p_session_token, true);

  IF p_role NOT IN ('admin', 'support', 'none') THEN
    RAISE EXCEPTION 'Papel inválido.';
  END IF;
  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Operação cancelada: você não pode alterar o próprio papel.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  SELECT role INTO v_previous FROM public.admin_users WHERE user_id = p_target_user_id;

  IF p_role = 'none' THEN
    DELETE FROM public.admin_users WHERE user_id = p_target_user_id;
    DELETE FROM public.admin_sessions WHERE user_id = p_target_user_id;
  ELSE
    INSERT INTO public.admin_users (user_id, role) VALUES (p_target_user_id, p_role)
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  END IF;

  PERFORM public.admin_write_audit('set_admin_role', p_target_user_id,
                                   jsonb_build_object('from', v_previous, 'to', p_role), '{}'::jsonb);
  RETURN jsonb_build_object('ok', true, 'role', p_role);
END;
$$;

-- ── 15. Aviso global ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_system_notice()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT value FROM public.admin_flags WHERE key = 'system_notice' AND (value ->> 'active')::boolean IS TRUE),
    jsonb_build_object('active', false)
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_get_system_notice(p_session_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  PERFORM public.admin_assert_role(p_session_token, false);
  RETURN COALESCE((SELECT value FROM public.admin_flags WHERE key = 'system_notice'),
                  jsonb_build_object('active', false, 'message', '', 'level', 'info'));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_system_notice(
  p_session_token uuid,
  p_message text,
  p_level text DEFAULT 'info',
  p_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_value jsonb;
BEGIN
  PERFORM public.admin_assert_role(p_session_token, true);

  IF p_level NOT IN ('info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'Nível inválido.';
  END IF;
  IF p_active AND (p_message IS NULL OR btrim(p_message) = '') THEN
    RAISE EXCEPTION 'Informe a mensagem do aviso.';
  END IF;

  v_value := jsonb_build_object('active', p_active, 'message', left(COALESCE(btrim(p_message), ''), 280), 'level', p_level);

  INSERT INTO public.admin_flags (key, value, updated_at, updated_by)
  VALUES ('system_notice', v_value, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = auth.uid();

  PERFORM public.admin_write_audit('set_system_notice', NULL, v_value, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true, 'notice', v_value);
END;
$$;

-- ── 16. Grants ────────────────────────────────────────────────────────────────
DO $grants$
DECLARE
  v_sig text;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'admin_reset_user_data(uuid, uuid, text[], boolean, boolean)',
    'admin_reset_all_users_data(uuid, text[], boolean, text)',
    'admin_list_backups(uuid, uuid)',
    'admin_restore_backup(uuid, uuid)',
    'admin_delete_backup(uuid, uuid)',
    'admin_set_user_suspended(uuid, uuid, boolean, text)',
    'admin_revoke_user_sessions(uuid, uuid)',
    'admin_delete_user(uuid, uuid)',
    'admin_clear_client_errors(uuid)',
    'admin_users_page(uuid, text, text, int, int)',
    'admin_get_user_detail(uuid, uuid)',
    'admin_export_user_data(uuid, uuid)',
    'admin_get_overview(uuid)',
    'admin_list_errors(uuid, int, uuid)',
    'admin_api_usage(uuid, int)',
    'admin_list_audit(uuid, int, int, text, uuid)',
    'admin_list_admins(uuid)',
    'admin_set_admin_role(uuid, uuid, text)',
    'admin_get_system_notice(uuid)',
    'admin_set_system_notice(uuid, text, text, boolean)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', v_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', v_sig);
  END LOOP;
END
$grants$;

REVOKE ALL ON FUNCTION public.get_system_notice() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_system_notice() TO authenticated;

-- ── 17. Endurecimento pós-aplicação (advisors do Supabase) ────────────────────
-- Índice da FK de admin_sessions; helpers de asserção deixam de ser chamáveis pelo cliente
-- (as RPCs SECURITY DEFINER os executam como dono); RPCs antigas substituídas são removidas.
CREATE INDEX IF NOT EXISTS admin_sessions_user_id_idx ON public.admin_sessions (user_id);
REVOKE ALL ON FUNCTION public.admin_assert_authority() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_assert_session(uuid) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.admin_list_users(uuid);
DROP FUNCTION IF EXISTS public.admin_get_system_metrics(uuid);
