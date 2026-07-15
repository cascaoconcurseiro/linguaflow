-- Advisor pós-P0.2a: índices compostos cobrem a mesma ordem das FKs de
-- ownership. O índice duplicado foi criado apenas para suportar ON CONFLICT;
-- o constraint legado já fornece exatamente a mesma unicidade.

DROP INDEX IF EXISTS public.cards_user_word_key;

CREATE INDEX IF NOT EXISTS card_review_undos_user_event_idx
  ON public.card_review_undos (user_id, learning_event_id);

CREATE INDEX IF NOT EXISTS xp_ledger_user_event_idx
  ON public.xp_ledger (user_id, learning_event_id);

CREATE INDEX IF NOT EXISTS xp_ledger_user_reversal_idx
  ON public.xp_ledger (user_id, reverses_entry_id)
  WHERE reverses_entry_id IS NOT NULL;
