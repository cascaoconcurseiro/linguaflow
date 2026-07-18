-- Escritas de uso da API são exclusivas das Edge Functions (service_role).
revoke all on table public.api_usage_log from authenticated;

-- O cliente somente envia telemetria mínima; não lê, altera ou apaga logs.
revoke all on table public.client_errors from authenticated;
grant insert on table public.client_errors to authenticated;

-- Metadados de liga são compartilhados apenas entre usuários logados.
revoke all on table public.league_meta from public, anon, authenticated;
grant select on table public.league_meta to authenticated;
drop policy if exists "Anyone can read league meta" on public.league_meta;
create policy "Authenticated users read league meta"
  on public.league_meta for select to authenticated using (true);
