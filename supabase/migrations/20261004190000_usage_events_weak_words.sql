-- #450: eventos de reforço de palavras fracas no funil de uso (sem dados pessoais).
-- Expand-only: a lista fechada vira um superconjunto da anterior; nenhum dado muda.
-- Rollback: recriar o CHECK com a lista anterior (só se não houver linhas dos eventos novos).

ALTER TABLE public.usage_events DROP CONSTRAINT IF EXISTS usage_events_event_check;
ALTER TABLE public.usage_events ADD CONSTRAINT usage_events_event_check CHECK (event IN (
  'player_opened', 'lf_enabled', 'lf_disabled', 'first_steps_done',
  'weak_reinforce', 'weak_open_vault', 'weak_pause', 'weak_session_done'
));
