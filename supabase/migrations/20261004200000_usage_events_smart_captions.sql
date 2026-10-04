-- #488: eventos das opções da legenda inteligente no funil de uso (sem dados pessoais).
-- Responde: alguém liga essas opções? Expand-only: a lista fechada vira um superconjunto da anterior.
-- Rollback: recriar o CHECK com a lista anterior (só se não houver linhas dos eventos novos).

ALTER TABLE public.usage_events DROP CONSTRAINT IF EXISTS usage_events_event_check;
ALTER TABLE public.usage_events ADD CONSTRAINT usage_events_event_check CHECK (event IN (
  'player_opened', 'lf_enabled', 'lf_disabled', 'first_steps_done',
  'weak_reinforce', 'weak_open_vault', 'weak_pause', 'weak_session_done',
  'smart_pause_on', 'smart_hide_on', 'smart_lookup_on'
));
