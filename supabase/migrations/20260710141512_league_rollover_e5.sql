-- Recuperação Codex: rollover semanal já aplicado em produção.
-- pg_cron pode não existir fora do Supabase (ex.: validação local) — o
-- agendamento degrada graciosamente; o rollover lazy cobre o resto.

do $cron_ext$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron indisponível (%), agendamento fica só no modo lazy', sqlerrm;
end $cron_ext$;

create table if not exists public.league_meta (
  id boolean primary key default true check (id),
  week_start date not null default date_trunc('week', current_date)::date
);
insert into public.league_meta (id) values (true) on conflict (id) do nothing;

alter table public.league_meta enable row level security;
drop policy if exists "Anyone can read league meta" on public.league_meta;
create policy "Anyone can read league meta"
  on public.league_meta for select using (true);

create or replace function public.run_league_rollover()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  promoted integer := 0;
  demoted integer := 0;
  max_league integer := 5;
begin
  with ranked as (
    select user_id, league_index,
      row_number() over (partition by league_index order by xp_week desc, updated_at asc) as rk
    from public.user_stats
  )
  update public.user_stats u set league_index = u.league_index + 1
  from ranked r
  where u.user_id = r.user_id and r.rk <= 5 and u.xp_week > 0 and u.league_index < max_league;
  get diagnostics promoted = row_count;

  update public.user_stats set league_index = league_index - 1
  where xp_week = 0 and league_index > 0;
  get diagnostics demoted = row_count;

  update public.user_stats set xp_week = 0, updated_at = now();
  update public.league_meta set week_start = date_trunc('week', current_date)::date where id;

  return jsonb_build_object('promoted', promoted, 'demoted', demoted,
    'week_start', date_trunc('week', current_date)::date);
end;
$$;

create or replace function public.maybe_league_rollover()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare current_week_start date; result jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not pg_try_advisory_xact_lock(hashtext('league_rollover')) then
    return jsonb_build_object('ran', false, 'reason', 'locked');
  end if;
  select week_start into current_week_start from public.league_meta where id;
  if current_week_start >= date_trunc('week', current_date)::date then
    return jsonb_build_object('ran', false, 'reason', 'same_week');
  end if;
  result := public.run_league_rollover();
  return jsonb_build_object('ran', true) || result;
end;
$$;

revoke all on function public.run_league_rollover() from public;
revoke all on function public.maybe_league_rollover() from public;
grant execute on function public.maybe_league_rollover() to authenticated;

do $cron_job$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'league-weekly-rollover';
    perform cron.schedule('league-weekly-rollover', '5 0 * * 1', 'select public.run_league_rollover()');
  end if;
end $cron_job$;
