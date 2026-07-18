-- Produção: tabelas pessoais nunca precisam ser acessíveis ao papel anônimo.
-- O cliente autenticado mantém seus grants atuais; RLS continua sendo a
-- barreira por linha. Remover também PUBLIC evita privilégios herdados.
revoke all on table public.api_usage_log from public, anon;
revoke all on table public.card_review_undos from public, anon;
revoke all on table public.cards from public, anon;
revoke all on table public.client_errors from public, anon;
revoke all on table public.known_words from public, anon;
revoke all on table public.learning_events from public, anon;
revoke all on table public.push_subscriptions from public, anon;
revoke all on table public.reader_texts from public, anon;
revoke all on table public.review_log from public, anon;
revoke all on table public.sentences from public, anon;
revoke all on table public.sessions from public, anon;
revoke all on table public.settings from public, anon;
revoke all on table public.stories from public, anon;
revoke all on table public.translation_cache from public, anon;
revoke all on table public.user_stats from public, anon;
revoke all on table public.words from public, anon;
revoke all on table public.xp_ledger from public, anon;

-- Exceção deliberada: leitura de uma única linha técnica, sem dado pessoal.
revoke all on table public.keep_alive from public, authenticated;
grant select on table public.keep_alive to anon;

-- Mantém a RPC pública necessária, mas elimina resolução de objetos por um
-- schema mutável. O corpo já qualifica tabelas e valida auth.uid().
alter function public.ensure_user_stats(uuid) set search_path = '';
