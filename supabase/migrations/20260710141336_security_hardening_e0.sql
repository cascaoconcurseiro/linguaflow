-- Recuperação Codex: hardening aplicado em produção em 2026-07-10.

alter table public.cards add column if not exists introduced_at timestamptz;
create index if not exists idx_cards_word_id on public.cards (word_id);
create index if not exists idx_cards_user_due on public.cards (user_id, due_date) where not suspended;

alter table public.api_usage_log enable row level security;
drop policy if exists "Users see own usage" on public.api_usage_log;
create policy "Users see own usage"
  on public.api_usage_log for select to authenticated
  using ((select auth.uid()) = user_id);

-- A RPC legada referenciava colunas removidas (chunks/deck_id).
drop function if exists public.get_due_cards();

-- A sessão do usuário nunca executa funções administrativas diretamente.
revoke all on function public.get_deepseek_key() from public;
