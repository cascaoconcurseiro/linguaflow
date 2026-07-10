-- Codex 2026-07-10: explicitamente remove execução anônima das RPCs de revisão.
revoke execute on function public.record_card_review(uuid, smallint, jsonb, uuid) from anon;
revoke execute on function public.revert_card_review(uuid, jsonb) from anon;
