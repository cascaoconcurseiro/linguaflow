create table if not exists public.keep_alive (
  id smallint primary key,
  created_at timestamptz not null default now(),
  constraint keep_alive_single_row check (id = 1)
);

insert into public.keep_alive (id)
values (1)
on conflict (id) do nothing;

alter table public.keep_alive enable row level security;

drop policy if exists "Allow anonymous keep-alive probe" on public.keep_alive;
create policy "Allow anonymous keep-alive probe"
on public.keep_alive
for select
to anon
using (id = 1);

revoke all on table public.keep_alive from public, authenticated;
grant select on table public.keep_alive to anon;
