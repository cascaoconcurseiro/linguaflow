-- Migration: 20261003140000_security_center_and_reports.sql
-- Issue #412 — Central de segurança e relatos de usuários.
-- Aditiva: tabela user_reports (relatos de bug/abuso/segurança/sugestão), RPC de envio com limite,
-- RPCs admin de triagem e um relatório de segurança calculado ao vivo.
-- Rollback: reverter o PR; tabela e funções novas podem permanecer sem efeito.

-- ── 1. Relatos de usuários ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('bug', 'sugestao', 'abuso', 'seguranca')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 2000),
  route text CHECK (route IS NULL OR char_length(route) <= 60),
  app_version text CHECK (app_version IS NULL OR char_length(app_version) <= 30),
  user_agent text CHECK (user_agent IS NULL OR char_length(user_agent) <= 300),
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'em_analise', 'resolvido', 'descartado')),
  admin_note text CHECK (admin_note IS NULL OR char_length(admin_note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS user_reports_status_idx ON public.user_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS user_reports_user_idx ON public.user_reports (user_id, created_at DESC);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_reports TO authenticated;

DROP POLICY IF EXISTS "Users read own reports" ON public.user_reports;
CREATE POLICY "Users read own reports" ON public.user_reports
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ── 2. Envio de relato (validação + limite de 5/dia + deduplicação) ───────────
CREATE OR REPLACE FUNCTION public.submit_user_report(
  p_kind text,
  p_message text,
  p_route text DEFAULT NULL,
  p_app_version text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_message text := btrim(COALESCE(p_message, ''));
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Entre na sua conta para enviar um relato.' USING ERRCODE = '28000';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('bug', 'sugestao', 'abuso', 'seguranca') THEN
    RAISE EXCEPTION 'Tipo de relato inválido.';
  END IF;
  IF char_length(v_message) < 10 THEN
    RAISE EXCEPTION 'Descreva o problema com pelo menos 10 caracteres.';
  END IF;
  IF char_length(v_message) > 2000 THEN
    RAISE EXCEPTION 'O relato pode ter no máximo 2000 caracteres.';
  END IF;

  SELECT id INTO v_id FROM public.user_reports
   WHERE user_id = v_uid AND message = v_message AND created_at > now() - interval '10 minutes'
   LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'id', v_id, 'duplicate', true);
  END IF;

  IF (SELECT count(*) FROM public.user_reports
       WHERE user_id = v_uid AND created_at > now() - interval '24 hours') >= 5 THEN
    RAISE EXCEPTION 'Limite de 5 relatos por dia atingido. Tente novamente amanhã.' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.user_reports (user_id, kind, message, route, app_version, user_agent)
  VALUES (v_uid, p_kind, v_message, left(p_route, 60), left(p_app_version, 30), left(p_user_agent, 300))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_user_report(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_user_report(text, text, text, text, text) TO authenticated;

-- ── 3. Triagem pelo painel ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_reports(
  p_session_token uuid,
  p_status text DEFAULT NULL,
  p_kind text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  PERFORM public.admin_assert_role(p_session_token, false);

  IF p_status IS NOT NULL AND p_status NOT IN ('novo', 'em_analise', 'resolvido', 'descartado') THEN
    RAISE EXCEPTION 'Status inválido.';
  END IF;
  IF p_kind IS NOT NULL AND p_kind NOT IN ('bug', 'sugestao', 'abuso', 'seguranca') THEN
    RAISE EXCEPTION 'Tipo inválido.';
  END IF;

  RETURN jsonb_build_object(
    'counts', jsonb_build_object(
      'novo', (SELECT count(*) FROM public.user_reports WHERE status = 'novo'),
      'em_analise', (SELECT count(*) FROM public.user_reports WHERE status = 'em_analise'),
      'resolvido', (SELECT count(*) FROM public.user_reports WHERE status = 'resolvido'),
      'descartado', (SELECT count(*) FROM public.user_reports WHERE status = 'descartado')
    ),
    'total', (SELECT count(*) FROM public.user_reports
              WHERE (p_status IS NULL OR status = p_status) AND (p_kind IS NULL OR kind = p_kind)),
    'rows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', r.id, 'user_id', r.user_id,
               'email', (SELECT email::text FROM auth.users u WHERE u.id = r.user_id),
               'kind', r.kind, 'message', r.message, 'route', r.route, 'app_version', r.app_version,
               'user_agent', r.user_agent, 'status', r.status, 'admin_note', r.admin_note,
               'created_at', r.created_at, 'updated_at', r.updated_at) ORDER BY r.created_at DESC)
      FROM (SELECT * FROM public.user_reports
            WHERE (p_status IS NULL OR status = p_status) AND (p_kind IS NULL OR kind = p_kind)
            ORDER BY created_at DESC LIMIT v_limit OFFSET v_offset) r
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_report(
  p_session_token uuid,
  p_report_id uuid,
  p_status text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_target uuid;
  v_previous text;
BEGIN
  PERFORM public.admin_assert_role(p_session_token, true);

  IF p_status NOT IN ('novo', 'em_analise', 'resolvido', 'descartado') THEN
    RAISE EXCEPTION 'Status inválido.';
  END IF;
  IF p_note IS NOT NULL AND char_length(p_note) > 1000 THEN
    RAISE EXCEPTION 'A nota pode ter no máximo 1000 caracteres.';
  END IF;

  SELECT user_id, status INTO v_target, v_previous FROM public.user_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Relato não encontrado.';
  END IF;

  UPDATE public.user_reports
     SET status = p_status,
         admin_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
         updated_at = now(),
         resolved_at = CASE WHEN p_status IN ('resolvido', 'descartado') THEN now() ELSE NULL END
   WHERE id = p_report_id;

  PERFORM public.admin_write_audit('update_report', v_target,
                                   jsonb_build_object('report_id', p_report_id, 'from', v_previous, 'to', p_status),
                                   '{}'::jsonb);
  RETURN jsonb_build_object('ok', true, 'status', p_status);
END;
$$;

-- ── 4. Relatório de segurança ao vivo ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_security_overview(p_session_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_checks jsonb := '[]'::jsonb;
  v_n bigint;
  v_names text;
  v_pin_len int;
  v_failed int;
  v_locked timestamptz;
BEGIN
  PERFORM public.admin_assert_role(p_session_token, false);

  -- 1. RLS ligado em todas as tabelas públicas
  SELECT count(*), string_agg(c.relname, ', ' ORDER BY c.relname) INTO v_n, v_names
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
  v_checks := v_checks || jsonb_build_object('id', 'rls', 'title', 'RLS ativo em todas as tabelas',
    'level', CASE WHEN v_n = 0 THEN 'ok' ELSE 'fail' END,
    'detail', CASE WHEN v_n = 0 THEN 'Todas as tabelas públicas têm Row Level Security.' ELSE 'Sem RLS: ' || v_names END);

  -- 2. Funções SECURITY DEFINER executáveis por visitantes anônimos
  SELECT count(*), string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_n, v_names
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE');
  v_checks := v_checks || jsonb_build_object('id', 'anon_definer', 'title', 'Funções privilegiadas abertas a visitantes',
    'level', CASE WHEN v_n = 0 THEN 'ok' ELSE 'warn' END,
    'detail', CASE WHEN v_n = 0 THEN 'Nenhuma função SECURITY DEFINER pode ser chamada sem login.' ELSE v_n || ' função(ões): ' || left(v_names, 300) END);

  -- 3. PIN administrativo
  SELECT length(value) INTO v_pin_len FROM public.admin_config WHERE key = 'pin_hash';
  v_checks := v_checks || jsonb_build_object('id', 'pin', 'title', 'PIN administrativo configurado',
    'level', CASE WHEN v_pin_len = 64 THEN 'ok' ELSE 'fail' END,
    'detail', CASE WHEN v_pin_len = 64 THEN 'Hash SHA-256 presente; bloqueio de 15 min após 5 erros.' ELSE 'PIN ausente ou em formato inesperado.' END);

  -- 4. Tamanho da equipe
  SELECT count(*) INTO v_n FROM public.admin_users;
  v_checks := v_checks || jsonb_build_object('id', 'staff', 'title', 'Equipe administrativa enxuta',
    'level', CASE WHEN v_n <= 2 THEN 'ok' ELSE 'warn' END,
    'detail', v_n || ' conta(s) com acesso administrativo.');

  -- 5. Bloqueios e tentativas do PIN
  SELECT COALESCE(max(failed_attempts), 0), max(locked_until) INTO v_failed, v_locked FROM public.admin_pin_attempts;
  v_checks := v_checks || jsonb_build_object('id', 'pin_attempts', 'title', 'Tentativas de PIN',
    'level', CASE WHEN v_locked IS NOT NULL AND v_locked > now() THEN 'fail' WHEN v_failed > 0 THEN 'warn' ELSE 'ok' END,
    'detail', CASE WHEN v_locked IS NOT NULL AND v_locked > now() THEN 'Painel bloqueado até ' || to_char(v_locked AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI')
                   WHEN v_failed > 0 THEN v_failed || ' tentativa(s) errada(s) desde o último acerto.'
                   ELSE 'Nenhuma tentativa errada pendente.' END);

  -- 6. Contas com e-mail não confirmado
  SELECT count(*) INTO v_n FROM auth.users WHERE email_confirmed_at IS NULL;
  v_checks := v_checks || jsonb_build_object('id', 'unconfirmed', 'title', 'Contas com e-mail não confirmado',
    'level', CASE WHEN v_n = 0 THEN 'ok' ELSE 'warn' END,
    'detail', v_n || ' conta(s) sem confirmação de e-mail.');

  -- 7. Pico de erros do cliente na última hora
  SELECT count(*) INTO v_n FROM public.client_errors WHERE created_at > now() - interval '1 hour';
  v_checks := v_checks || jsonb_build_object('id', 'error_spike', 'title', 'Erros do cliente na última hora',
    'level', CASE WHEN v_n > 50 THEN 'fail' WHEN v_n > 10 THEN 'warn' ELSE 'ok' END,
    'detail', v_n || ' erro(s) registrado(s).');

  -- 8. IPs com várias contas
  SELECT count(*) INTO v_n FROM (
    SELECT ip FROM auth.sessions WHERE ip IS NOT NULL AND created_at > now() - interval '30 days'
     GROUP BY ip HAVING count(DISTINCT user_id) >= 3) x;
  v_checks := v_checks || jsonb_build_object('id', 'ip_clusters', 'title', 'IPs usados por várias contas',
    'level', CASE WHEN v_n = 0 THEN 'ok' ELSE 'warn' END,
    'detail', CASE WHEN v_n = 0 THEN 'Nenhum IP com 3 ou mais contas em 30 dias.' ELSE v_n || ' IP(s) com 3 ou mais contas em 30 dias (veja a lista abaixo).' END);

  -- 9. Consumo anômalo de IA/serviços
  SELECT count(*) INTO v_n FROM (
    SELECT user_id FROM public.api_usage_log WHERE created_at > now() - interval '24 hours'
     GROUP BY user_id HAVING count(*) > 500) x;
  v_checks := v_checks || jsonb_build_object('id', 'api_heavy', 'title', 'Consumo anômalo de serviços (24 h)',
    'level', CASE WHEN v_n = 0 THEN 'ok' ELSE 'warn' END,
    'detail', CASE WHEN v_n = 0 THEN 'Nenhuma conta passou de 500 chamadas em 24 h.' ELSE v_n || ' conta(s) acima de 500 chamadas em 24 h.' END);

  -- 10. Relatos pendentes de triagem
  SELECT count(*) INTO v_n FROM public.user_reports WHERE status = 'novo';
  v_checks := v_checks || jsonb_build_object('id', 'reports', 'title', 'Relatos de usuários sem triagem',
    'level', CASE WHEN v_n = 0 THEN 'ok' ELSE 'warn' END,
    'detail', v_n || ' relato(s) novo(s).');

  RETURN jsonb_build_object(
    'generated_at', now(),
    'checks', v_checks,
    'sessions', jsonb_build_object(
      'active', (SELECT count(*) FROM auth.sessions WHERE not_after IS NULL OR not_after > now()),
      'new_24h', (SELECT count(*) FROM auth.sessions WHERE created_at > now() - interval '24 hours'),
      'ips_30d', (SELECT count(DISTINCT ip) FROM auth.sessions WHERE ip IS NOT NULL AND created_at > now() - interval '30 days')
    ),
    'ip_clusters', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('ip', c.ip, 'accounts', c.accounts, 'sessions', c.sessions, 'last_seen', c.last_seen)
                       ORDER BY c.accounts DESC, c.last_seen DESC)
      FROM (SELECT host(ip) AS ip, count(DISTINCT user_id) AS accounts, count(*) AS sessions, max(created_at) AS last_seen
              FROM auth.sessions WHERE ip IS NOT NULL AND created_at > now() - interval '30 days'
             GROUP BY ip HAVING count(DISTINCT user_id) >= 3 ORDER BY 2 DESC LIMIT 10) c
    ), '[]'::jsonb),
    'recent_sessions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('email', s.email, 'ip', s.ip, 'user_agent', s.user_agent, 'created_at', s.created_at)
                       ORDER BY s.created_at DESC)
      FROM (SELECT (SELECT email::text FROM auth.users u WHERE u.id = x.user_id) AS email, host(x.ip) AS ip,
                   left(x.user_agent, 120) AS user_agent, x.created_at
              FROM auth.sessions x ORDER BY x.created_at DESC LIMIT 15) s
    ), '[]'::jsonb),
    'heavy_users', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('email', h.email, 'calls', h.n) ORDER BY h.n DESC)
      FROM (SELECT (SELECT email::text FROM auth.users u WHERE u.id = l.user_id) AS email, count(*) AS n
              FROM public.api_usage_log l WHERE l.created_at > now() - interval '24 hours'
             GROUP BY l.user_id ORDER BY 2 DESC LIMIT 5) h
    ), '[]'::jsonb),
    'admin_actions_7d', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('action', a.action, 'count', a.n) ORDER BY a.n DESC)
      FROM (SELECT action, count(*) AS n FROM public.admin_audit_log
             WHERE created_at > now() - interval '7 days' GROUP BY action) a
    ), '[]'::jsonb)
  );
END;
$$;

DO $grants$
DECLARE
  v_sig text;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'admin_list_reports(uuid, text, text, int, int)',
    'admin_update_report(uuid, uuid, text, text)',
    'admin_security_overview(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', v_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', v_sig);
  END LOOP;
END
$grants$;
