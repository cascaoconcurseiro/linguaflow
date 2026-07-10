-- Codex 2026-07-10: telemetria mínima, sem conteúdo do usuário nem stack trace.
create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null check (char_length(source) <= 80),
  error_name text not null check (char_length(error_name) <= 120),
  route text check (char_length(route) <= 80),
  app_version text check (char_length(app_version) <= 80),
  created_at timestamptz not null default now()
);
create index if not exists idx_client_errors_created on public.client_errors (created_at desc);
create index if not exists idx_client_errors_user_created on public.client_errors (user_id, created_at desc);
alter table public.client_errors enable row level security;
create policy "Users insert own telemetry"
  on public.client_errors for insert to authenticated
  with check ((select auth.uid()) = user_id);
