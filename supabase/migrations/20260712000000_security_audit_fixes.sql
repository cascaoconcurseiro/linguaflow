-- Nova auditoria (2026-07-12) — achados corrigidos com autorização do dono:
--
-- 1. IDOR real: public.get_user_stats(p_user_id uuid) é SECURITY DEFINER,
--    concedida a "authenticated" e NUNCA checa auth.uid() = p_user_id — ao
--    contrário de ensure_user_stats, que faz essa checagem corretamente.
--    Qualquer usuário logado podia chamar
--    POST /rest/v1/rpc/get_user_stats {"p_user_id": "<uuid de outra pessoa>"}
--    e ler contagem de palavras/cards vencidos/retenção de 30 dias de
--    QUALQUER outro usuário. Função é 100% código morto (zero chamadores no
--    client, confirmado por grep no repo inteiro; devolvia streak/total_secs
--    hardcoded em 0 e by_cefr sempre '{}') — dropar em vez de só restringir,
--    elimina a superfície de ataque por completo.
DROP FUNCTION IF EXISTS public.get_user_stats(uuid);

-- 2. Índice duplicado: idx_cards_due e idx_cards_user_due são IDÊNTICOS
--    (mesma definição: btree (user_id, due_date) WHERE NOT suspended).
--    idx_cards_user_due é o que está versionado em migration
--    (security_hardening_e0); idx_cards_due é resíduo do schema pré-auditoria
--    nunca capturado em migration. Mantém o versionado, derruba o duplicado
--    (custo de escrita em dobro sem nenhum ganho de leitura).
DROP INDEX IF EXISTS public.idx_cards_due;

-- 3. Extensão pg_net registrada no schema public (advisor "Extension in
--    Public") — INVESTIGADO, NÃO CORRIGIDO DE PROPÓSITO: testado em
--    produção e o Postgres recusa com "extension pg_net does not support
--    SET SCHEMA" (0A000) — pg_net não é relocável, isso é uma limitação da
--    própria extensão, não falta de tentativa. Mover exigiria DROP
--    EXTENSION + CREATE EXTENSION num schema novo, o que arrisca derrubar
--    momentaneamente os crons que dependem de net.http_post (push-reminder,
--    email-weekly-reengagement) — risco desproporcional pra um WARN que é
--    cosmético: as funções net.http_post/net.http_get já vivem no schema
--    próprio `net`, nunca em `public`, então não há exposição real de
--    superfície de ataque. Aceito como falso-positivo de baixo risco,
--    comum em projetos Supabase que usam pg_net (documentado no HANDOFF).
