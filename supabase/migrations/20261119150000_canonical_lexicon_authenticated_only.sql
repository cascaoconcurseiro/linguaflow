-- Léxico canônico só para usuários logados (auditoria #559, parte 2).
--
-- Problema: a policy canonical_lexicon_read permitia SELECT ao papel anon, e o
-- grant de SELECT ao anon continuava ativo. Com a chave pública do app, qualquer
-- pessoa na internet lia a tabela inteira, inclusive `contexts`: frases que os
-- usuários enviam ao salvar uma palavra (vídeo, leitor, histórias). Uma frase de
-- um texto pessoal colado no Leitor podia ficar pública.
--
-- O app nunca lê o léxico sem sessão: utils/db.js cancela a requisição REST
-- quando não há token, e a escrita já passa só pela RPC autenticada
-- get_or_cache_canonical_lexicon. Usuários logados continuam lendo o léxico
-- compartilhado como antes.
--
-- Idempotente. Rollback:
--   DROP POLICY IF EXISTS canonical_lexicon_read ON public.canonical_lexicon;
--   CREATE POLICY canonical_lexicon_read ON public.canonical_lexicon FOR SELECT TO anon, authenticated USING (true);
--   GRANT SELECT ON TABLE public.canonical_lexicon TO anon;

revoke all on table public.canonical_lexicon from public, anon;

drop policy if exists canonical_lexicon_read on public.canonical_lexicon;
create policy canonical_lexicon_read on public.canonical_lexicon
  for select to authenticated using (true);
