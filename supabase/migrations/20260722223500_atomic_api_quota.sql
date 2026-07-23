-- Atomic API quota: Edge Functions are the only callers. Serializing by
-- user/endpoint closes the count-then-insert race.
create index if not exists api_usage_log_user_endpoint_created_idx
  on public.api_usage_log (user_id, endpoint, created_at desc);
create index if not exists api_usage_log_created_at_idx
  on public.api_usage_log (created_at);

create or replace function public.consume_api_quota(
  p_user_id uuid,
  p_endpoint text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_user_id is null then
    raise exception 'user required' using errcode = '22023';
  end if;
  if p_endpoint is null or p_endpoint not in ('deepseek-chat', 'tts', 'url-import') then
    raise exception 'invalid endpoint' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 600
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 3600 then
    raise exception 'invalid quota' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_endpoint, 0)
  );

  select count(*) into v_count
  from public.api_usage_log
  where user_id = p_user_id
    and endpoint = p_endpoint
    and created_at >= clock_timestamp() - make_interval(secs => p_window_seconds);

  -- Sem cron pago: o primeiro pedido após uma janela ociosa tenta assumir uma
  -- trava global e remove no máximo um lote antigo. O índice temporal evita
  -- varredura completa; o lote limitado evita picos de I/O.
  if v_count = 0 and pg_try_advisory_xact_lock(hashtextextended('api_usage_log_retention', 0)) then
    delete from public.api_usage_log
    where id in (
      select id
      from public.api_usage_log
      where created_at < clock_timestamp() - interval '7 days'
      order by created_at
      limit 500
    );
  end if;

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.api_usage_log (user_id, endpoint)
  values (p_user_id, p_endpoint);
  return true;
end;
$$;

revoke all on function public.consume_api_quota(uuid, text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.consume_api_quota(uuid, text, integer, integer)
  to service_role;
