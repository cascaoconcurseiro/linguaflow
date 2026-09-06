-- O snapshot autoritativo de uma revisão vive em learning_events/review_log.
-- Mantemos as assinaturas públicas para clientes já publicados, mas nenhum
-- estado de card fornecido pelo navegador participa do undo.

ALTER FUNCTION public.record_card_review(uuid, smallint, jsonb, uuid)
  RENAME TO record_card_review_before_snapshot_response;

REVOKE ALL ON FUNCTION public.record_card_review_before_snapshot_response(uuid, smallint, jsonb, uuid)
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
  v_result jsonb;
  v_card_before jsonb;
BEGIN
  -- A implementação anterior continua responsável pela transação, locks,
  -- limites diários, idempotência e contabilização.
  v_result := public.record_card_review_before_snapshot_response(
    p_card_id, p_quality, p_state, p_client_review_id
  );

  -- Tanto a primeira resposta quanto um retry idempotente recuperam o mesmo
  -- snapshot imutável gravado junto ao evento original.
  SELECT event.evidence->'card_before'
    INTO v_card_before
    FROM public.learning_events event
   WHERE event.id = p_client_review_id
     AND event.user_id = v_user_id
     AND event.event_type = 'card_reviewed'
     AND event.subject_id = p_card_id::text;

  RETURN v_result || jsonb_build_object('card_before', v_card_before);
END;
$$;

REVOKE ALL ON FUNCTION public.record_card_review(uuid, smallint, jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_card_review(uuid, smallint, jsonb, uuid)
  TO authenticated;

ALTER FUNCTION public.revert_card_review(uuid, jsonb)
  RENAME TO revert_card_review_from_stored_snapshot;

REVOKE ALL ON FUNCTION public.revert_card_review_from_stored_snapshot(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.revert_card_review(
  p_review_log_id uuid,
  p_previous_card jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- p_previous_card permanece apenas por compatibilidade de assinatura.
  -- A implementação autoritativa restaura exclusivamente review_log.card_before
  -- e ignora integralmente o segundo argumento.
  RETURN public.revert_card_review_from_stored_snapshot(p_review_log_id, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.revert_card_review(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revert_card_review(uuid, jsonb)
  TO authenticated;

