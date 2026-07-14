-- Fundação de Evidência P0 (expand-only)
--
-- Este corte cria fontes auditáveis de evidência e XP sem alterar os fluxos
-- legados. Nenhuma RPC atual passa a escrever aqui e user_stats continua sendo
-- a projeção usada pela aplicação. O cutover acontece somente em migrations
-- posteriores, depois de clientes v2 e testes concorrentes.

CREATE TABLE public.learning_events (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'practice_item_completed',
    'story_completed',
    'story_quiz_completed',
    'video_block_completed',
    'daily_quest_completed',
    'weekly_quest_completed',
    'card_reviewed',
    'legacy_opening_balance'
  )),
  subject_type text NOT NULL CHECK (subject_type IN (
    'practice_item', 'story', 'story_quiz', 'video_block', 'quest', 'card', 'account'
  )),
  subject_id text NOT NULL CHECK (
    length(btrim(subject_id)) BETWEEN 1 AND 200
  ),
  session_id uuid,
  semantic_key text NOT NULL CHECK (
    length(btrim(semantic_key)) BETWEEN 1 AND 300
  ),
  occurred_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  local_date date,
  source text NOT NULL CHECK (source IN ('web', 'extension', 'system', 'migration')),
  client_version text CHECK (
    client_version IS NULL OR length(client_version) BETWEEN 1 AND 64
  ),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object'),
  eligible boolean NOT NULL,
  eligibility_reason text NOT NULL CHECK (
    length(btrim(eligibility_reason)) BETWEEN 1 AND 100
  ),
  CONSTRAINT learning_events_temporal_shape CHECK (
    (event_type = 'legacy_opening_balance'
      AND local_date IS NULL
      AND source = 'migration'
      AND eligible = false)
    OR (event_type <> 'legacy_opening_balance' AND local_date IS NOT NULL)
  ),
  CONSTRAINT learning_events_event_subject_shape CHECK (
    (event_type = 'practice_item_completed' AND subject_type = 'practice_item')
    OR (event_type = 'story_completed' AND subject_type = 'story')
    OR (event_type = 'story_quiz_completed' AND subject_type = 'story_quiz')
    OR (event_type = 'video_block_completed' AND subject_type = 'video_block')
    OR (event_type IN ('daily_quest_completed', 'weekly_quest_completed') AND subject_type = 'quest')
    OR (event_type = 'card_reviewed' AND subject_type = 'card')
    OR (event_type = 'legacy_opening_balance' AND subject_type = 'account')
  ),
  CONSTRAINT learning_events_evidence_size CHECK (pg_column_size(evidence) <= 4096),
  CONSTRAINT learning_events_user_semantic_key_key UNIQUE (user_id, semantic_key),
  CONSTRAINT learning_events_user_id_id_key UNIQUE (user_id, id)
);

CREATE INDEX learning_events_user_received_idx
  ON public.learning_events (user_id, received_at DESC);

CREATE INDEX learning_events_user_type_local_date_idx
  ON public.learning_events (user_id, event_type, local_date);

CREATE TABLE public.xp_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learning_event_id uuid NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('award', 'reversal', 'opening_balance')),
  reason text NOT NULL CHECK (reason IN (
    'card_review',
    'practice_item',
    'story_completed',
    'story_quiz',
    'video_block',
    'daily_quest',
    'weekly_quest',
    'legacy_opening_balance',
    'reversal'
  )),
  amount integer NOT NULL CHECK (
    (entry_type IN ('award', 'opening_balance') AND amount > 0)
    OR (entry_type = 'reversal' AND amount < 0)
  ),
  dedupe_key text NOT NULL CHECK (
    length(btrim(dedupe_key)) BETWEEN 1 AND 300
  ),
  local_date date,
  week_start date,
  competitive boolean NOT NULL DEFAULT true,
  reverses_entry_id uuid REFERENCES public.xp_ledger(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xp_ledger_user_dedupe_key_key UNIQUE (user_id, dedupe_key),
  CONSTRAINT xp_ledger_learning_event_key UNIQUE (learning_event_id),
  CONSTRAINT xp_ledger_user_id_id_key UNIQUE (user_id, id),
  CONSTRAINT xp_ledger_event_owner_fkey
    FOREIGN KEY (user_id, learning_event_id)
    REFERENCES public.learning_events(user_id, id)
    ON DELETE CASCADE,
  CONSTRAINT xp_ledger_reversal_owner_fkey
    FOREIGN KEY (user_id, reverses_entry_id)
    REFERENCES public.xp_ledger(user_id, id),
  CONSTRAINT xp_ledger_reversal_shape CHECK (
    (entry_type = 'reversal' AND reverses_entry_id IS NOT NULL AND reason = 'reversal')
    OR (entry_type <> 'reversal' AND reverses_entry_id IS NULL AND reason <> 'reversal')
  ),
  CONSTRAINT xp_ledger_entry_shape CHECK (
    (entry_type = 'opening_balance'
      AND reason = 'legacy_opening_balance'
      AND competitive = false
      AND local_date IS NULL
      AND week_start IS NULL)
    OR (entry_type = 'award'
      AND reason NOT IN ('legacy_opening_balance', 'reversal')
      AND local_date IS NOT NULL
      AND week_start IS NOT NULL)
    OR (entry_type = 'reversal'
      AND reason = 'reversal'
      AND local_date IS NOT NULL
      AND week_start IS NOT NULL)
  ),
  CONSTRAINT xp_ledger_not_self_reversal CHECK (reverses_entry_id IS NULL OR reverses_entry_id <> id)
);

CREATE UNIQUE INDEX xp_ledger_single_reversal_idx
  ON public.xp_ledger (reverses_entry_id)
  WHERE reverses_entry_id IS NOT NULL;

CREATE INDEX xp_ledger_user_created_idx
  ON public.xp_ledger (user_id, created_at DESC);

CREATE INDEX xp_ledger_user_competitive_week_idx
  ON public.xp_ledger (user_id, week_start)
  WHERE competitive;

ALTER TABLE public.learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_ledger ENABLE ROW LEVEL SECURITY;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.validate_xp_ledger_reversal()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  original public.xp_ledger%ROWTYPE;
BEGIN
  IF NEW.entry_type <> 'reversal' THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO original
    FROM public.xp_ledger
   WHERE user_id = NEW.user_id
     AND id = NEW.reverses_entry_id;

  IF NOT FOUND OR original.entry_type <> 'award' THEN
    RAISE EXCEPTION 'reversal target must be an award owned by the same user';
  END IF;

  IF NEW.amount <> -original.amount
     OR NEW.competitive IS DISTINCT FROM original.competitive
     OR NEW.local_date IS DISTINCT FROM original.local_date
     OR NEW.week_start IS DISTINCT FROM original.week_start THEN
    RAISE EXCEPTION 'reversal must exactly negate the original award';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_xp_ledger_reversal() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER xp_ledger_validate_reversal
  BEFORE INSERT ON public.xp_ledger
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_xp_ledger_reversal();

CREATE POLICY "Users can read their own learning events"
  ON public.learning_events
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can read their own XP ledger"
  ON public.xp_ledger
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Grants e RLS são camadas independentes. O cliente recebe somente SELECT;
-- escrita futura ocorrerá por RPCs específicas, nunca diretamente nas tabelas.
REVOKE ALL ON TABLE public.learning_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.xp_ledger FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.learning_events FROM service_role;
REVOKE ALL ON TABLE public.xp_ledger FROM service_role;
GRANT SELECT ON TABLE public.learning_events TO authenticated;
GRANT SELECT ON TABLE public.xp_ledger TO authenticated;
GRANT SELECT, INSERT ON TABLE public.learning_events TO service_role;
GRANT SELECT, INSERT ON TABLE public.xp_ledger TO service_role;

-- O saldo inicial será capturado atomicamente apenas na migration de cutover,
-- junto da desativação/roteamento dos escritores legados. Capturá-lo agora
-- deixaria o ledger defasado enquanto o XP antigo continua mudando.

COMMENT ON TABLE public.learning_events IS
  'Evidências de aprendizagem aceitas pelo servidor; append-only e sem conteúdo estudado sensível.';

COMMENT ON TABLE public.xp_ledger IS
  'Ledger contábil append-only de XP qualificado, saldos iniciais e reversões.';
