-- A Edge Function push-reminder usa service_role para chamar estas RPCs
-- internas. O revoke de PUBLIC/anon/authenticated deve permanecer, mas o
-- papel de servidor precisa de EXECUTE explícito para o fluxo não falhar.

REVOKE EXECUTE ON FUNCTION public.get_push_secrets() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_push_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_push_secrets() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_push_candidates() TO service_role;
