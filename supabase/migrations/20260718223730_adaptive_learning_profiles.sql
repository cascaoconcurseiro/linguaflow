create table public.card_learning_signals (
  id uuid primary key default gen_random_uuid(),
  client_event_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  correct boolean not null,
  abandoned boolean not null default false,
  response_ms integer not null default 0 check (response_ms between 0 and 3600000),
  help_count smallint not null default 0 check (help_count between 0 and 20),
  audio_plays smallint not null default 0 check (audio_plays between 0 and 20),
  mode text not null default 'classic' check (mode in ('classic','builder','dictation','reverse')),
  issue text not null check (issue in ('none','avoidance','listening','recall','dependency','fluency')),
  unaided boolean not null default false,
  occurred_at timestamptz not null default now(),
  unique (user_id, client_event_id)
);

create table public.card_adaptive_profiles (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  recovery_stage smallint not null default 0 check (recovery_stage between 0 and 3),
  dominant_issue text not null default 'none' check (dominant_issue in ('none','avoidance','listening','recall','dependency','fluency')),
  unaided_success_streak smallint not null default 0 check (unaided_success_streak between 0 and 100),
  signal_count integer not null default 0 check (signal_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create index card_learning_signals_user_card_time_idx
  on public.card_learning_signals (user_id, card_id, occurred_at desc);

alter table public.card_learning_signals enable row level security;
alter table public.card_adaptive_profiles enable row level security;

create policy card_learning_signals_select_own on public.card_learning_signals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy card_learning_signals_insert_own on public.card_learning_signals
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cards c where c.id = card_id and c.user_id = (select auth.uid()))
  );
create policy card_adaptive_profiles_select_own on public.card_adaptive_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy card_adaptive_profiles_insert_own on public.card_adaptive_profiles
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cards c where c.id = card_id and c.user_id = (select auth.uid()))
  );
create policy card_adaptive_profiles_update_own on public.card_adaptive_profiles
  for update to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cards c where c.id = card_id and c.user_id = (select auth.uid()))
  );

create or replace function public.record_card_learning_signal(
  p_card_id uuid, p_client_event_id uuid, p_signal jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_correct boolean := coalesce((p_signal->>'correct')::boolean, false);
  v_abandoned boolean := coalesce((p_signal->>'abandoned')::boolean, false);
  v_response integer := least(3600000, greatest(0, coalesce((p_signal->>'responseMs')::integer, 0)));
  v_help smallint := least(20, greatest(0, coalesce((p_signal->>'helpCount')::smallint, 0)));
  v_audio smallint := least(20, greatest(0, coalesce((p_signal->>'audioPlays')::smallint, 0)));
  v_mode text := coalesce(p_signal->>'mode', 'classic');
  v_issue text;
  v_unaided boolean;
  v_profile public.card_adaptive_profiles%rowtype;
  v_stage smallint;
  v_streak smallint;
begin
  if v_user is null or not exists (select 1 from public.cards c where c.id = p_card_id and c.user_id = v_user) then
    raise exception 'card_not_owned' using errcode = '42501';
  end if;
  if v_mode not in ('classic','builder','dictation','reverse') then v_mode := 'classic'; end if;
  v_unaided := v_correct and not v_abandoned and v_help = 0 and v_audio <= 1 and v_response <= 18000;
  v_issue := case when v_abandoned then 'avoidance' when not v_correct and v_mode = 'dictation' then 'listening'
    when not v_correct then 'recall' when v_help > 0 then 'dependency' when v_response > 18000 then 'fluency' else 'none' end;

  insert into public.card_learning_signals
    (client_event_id,user_id,card_id,correct,abandoned,response_ms,help_count,audio_plays,mode,issue,unaided)
  values (p_client_event_id,v_user,p_card_id,v_correct,v_abandoned,v_response,v_help,v_audio,v_mode,v_issue,v_unaided)
  on conflict (user_id,client_event_id) do nothing;
  if not found then
    select * into v_profile from public.card_adaptive_profiles where user_id=v_user and card_id=p_card_id;
    return to_jsonb(v_profile);
  end if;

  select * into v_profile from public.card_adaptive_profiles where user_id=v_user and card_id=p_card_id for update;
  v_stage := coalesce(v_profile.recovery_stage, 0);
  v_streak := case when v_unaided then coalesce(v_profile.unaided_success_streak,0)+1 else 0 end;
  if v_abandoned or not v_correct or v_help > 0 or v_response > 18000 then
    v_stage := least(3, greatest(1, v_stage + case when v_abandoned or not v_correct then 1 else 0 end));
  elsif v_streak >= 2 then v_stage := greatest(0, v_stage - 1); end if;

  insert into public.card_adaptive_profiles (user_id,card_id,recovery_stage,dominant_issue,unaided_success_streak,signal_count)
  values (v_user,p_card_id,v_stage,case when v_stage=0 then 'none' else coalesce(nullif(v_issue,'none'),v_profile.dominant_issue,'recall') end,
    case when v_stage=0 then 0 else v_streak end,1)
  on conflict (user_id,card_id) do update set recovery_stage=excluded.recovery_stage,
    dominant_issue=coalesce(excluded.dominant_issue,public.card_adaptive_profiles.dominant_issue),
    unaided_success_streak=excluded.unaided_success_streak,
    signal_count=public.card_adaptive_profiles.signal_count+1,updated_at=now()
  returning * into v_profile;
  return to_jsonb(v_profile);
end $$;

revoke all on public.card_learning_signals, public.card_adaptive_profiles from anon, public;
grant select, insert on public.card_learning_signals to authenticated;
grant select, insert, update on public.card_adaptive_profiles to authenticated;
revoke all on function public.record_card_learning_signal(uuid,uuid,jsonb) from public, anon;
grant execute on function public.record_card_learning_signal(uuid,uuid,jsonb) to authenticated;
