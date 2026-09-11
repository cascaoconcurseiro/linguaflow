-- Paridade Anki: função para Esquecer / Resetar card para Novo
-- Permite ao usuário autenticado reiniciar o agendamento de seu card mantendo
-- integridade referencial e o histórico em review_log para auditoria/estatísticas.

CREATE OR REPLACE FUNCTION public.reset_card_to_new(p_card_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_card public.cards%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;

  PERFORM public.ensure_user_stats(v_user_id);
  PERFORM 1 FROM public.user_stats WHERE user_id = v_user_id FOR UPDATE;

  SELECT * INTO v_card
    FROM public.cards
   WHERE id = p_card_id AND user_id = v_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'card_not_found';
  END IF;

  UPDATE public.cards SET
    status = 'new',
    "interval" = 0,
    ease_factor = 2.5,
    step_index = 0,
    reps = 0,
    lapses = 0,
    difficulty = 5.0,
    stability = 0.5,
    pre_lapse_interval = 0,
    due_date = statement_timestamp(),
    last_review = NULL,
    introduced_at = NULL,
    suspended = false,
    is_leech = false
  WHERE id = p_card_id AND user_id = v_user_id
  RETURNING * INTO v_card;

  RETURN to_jsonb(v_card);
END;
$$;

REVOKE ALL ON FUNCTION public.reset_card_to_new(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_card_to_new(uuid) TO authenticated;

COMMENT ON FUNCTION public.reset_card_to_new(uuid) IS
  'Reseta o card para o estado inicial new (paridade Anki Forget), sem apagar o histórico de revisões.';
