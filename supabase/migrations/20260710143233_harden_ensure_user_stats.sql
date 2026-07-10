-- Recuperação Codex: impede que um usuário autenticado crie/altere stats de outro.

create or replace function public.ensure_user_stats(_user_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and _user_id is distinct from auth.uid() then
    raise exception 'cannot manage stats for another user';
  end if;
  insert into public.user_stats (user_id, xp_today, xp_week, xp_total, streak, league_index, last_study_date)
  values (_user_id, 0, 0, 0, 0, 0, current_date)
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.ensure_user_stats(uuid) from public;
grant execute on function public.ensure_user_stats(uuid) to authenticated;
