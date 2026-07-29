create table public.learning_task_attempts (
  id uuid primary key default gen_random_uuid(),
  client_attempt_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_key text not null check (char_length(task_key) between 1 and 120),
  task_type text not null check (task_type in (
    'unseen_listening',
    'reading_comprehension',
    'prepared_speaking',
    'spontaneous_speaking',
    'writing',
    'interaction',
    'mediation'
  )),
  skill text not null check (skill in (
    'listening',
    'reading',
    'speaking_prepared',
    'speaking_spontaneous',
    'writing',
    'interaction',
    'mediation'
  )),
  target_descriptor text not null check (char_length(target_descriptor) between 1 and 500),
  target_level text check (target_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  prompt_version text not null check (char_length(prompt_version) between 1 and 80),
  evaluator_version text not null check (char_length(evaluator_version) between 1 and 80),
  evaluation_authority text not null default 'client'
    check (evaluation_authority in ('client', 'server', 'human')),
  authoritative boolean not null default false,
  stimulus_unseen boolean not null default false,
  assistance_used jsonb not null default '{}'::jsonb
    check (jsonb_typeof(assistance_used) = 'object')
    check (pg_column_size(assistance_used) <= 4096),
  response_time_ms integer check (response_time_ms between 0 and 3600000),
  task_completion smallint check (task_completion between 0 and 3),
  comprehensibility smallint check (comprehensibility between 0 and 3),
  accuracy smallint check (accuracy between 0 and 3),
  fluency smallint check (fluency between 0 and 3),
  lexical_range smallint check (lexical_range between 0 and 3),
  overall_score smallint check (overall_score between 0 and 100),
  evidence jsonb not null default '{}'::jsonb
    check (jsonb_typeof(evidence) = 'object')
    check (pg_column_size(evidence) <= 16384),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  unique (user_id, client_attempt_id)
);

comment on table public.learning_task_attempts is
  'Evidência append-only de tarefas comunicativas. Não altera FSRS, XP, ofensiva, liga ou nivel oficial.';
comment on column public.learning_task_attempts.authoritative is
  'Somente avaliações server-side ou humanas poderão ser autoritativas em uma migration futura.';
comment on column public.learning_task_attempts.evidence is
  'Metadados estruturados e limitados; não armazenar áudio, segredos ou resposta livre integral.';

create index learning_task_attempts_user_occurred_idx
  on public.learning_task_attempts (user_id, occurred_at desc);

create index learning_task_attempts_user_skill_occurred_idx
  on public.learning_task_attempts (user_id, skill, occurred_at desc);

alter table public.learning_task_attempts enable row level security;

create policy learning_task_attempts_select_own
  on public.learning_task_attempts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.learning_task_attempts from public, anon, authenticated;
grant select on table public.learning_task_attempts to authenticated;

create or replace function public.record_learning_task_attempt(
  p_client_attempt_id uuid,
  p_attempt jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_task_key text;
  v_task_type text;
  v_skill text;
  v_target_descriptor text;
  v_target_level text;
  v_prompt_version text;
  v_evaluator_version text;
  v_stimulus_unseen boolean;
  v_assistance_used jsonb;
  v_response_time_ms integer;
  v_task_completion smallint;
  v_comprehensibility smallint;
  v_accuracy smallint;
  v_fluency smallint;
  v_lexical_range smallint;
  v_overall_score smallint;
  v_evidence jsonb;
  v_occurred_at timestamptz;
  v_attempt_id uuid;
  v_matches boolean;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if p_client_attempt_id is null then
    raise exception using errcode = '22023', message = 'client_attempt_id_required';
  end if;
  if p_attempt is null or jsonb_typeof(p_attempt) <> 'object' then
    raise exception using errcode = '22023', message = 'attempt_object_required';
  end if;

  v_task_key := nullif(btrim(p_attempt ->> 'task_key'), '');
  v_task_type := nullif(btrim(p_attempt ->> 'task_type'), '');
  v_skill := nullif(btrim(p_attempt ->> 'skill'), '');
  v_target_descriptor := nullif(btrim(p_attempt ->> 'target_descriptor'), '');
  v_target_level := nullif(btrim(p_attempt ->> 'target_level'), '');
  v_prompt_version := nullif(btrim(p_attempt ->> 'prompt_version'), '');
  v_evaluator_version := nullif(btrim(p_attempt ->> 'evaluator_version'), '');
  v_stimulus_unseen := coalesce((p_attempt ->> 'stimulus_unseen')::boolean, false);
  v_assistance_used := coalesce(p_attempt -> 'assistance_used', '{}'::jsonb);
  v_response_time_ms := nullif(p_attempt ->> 'response_time_ms', '')::integer;
  v_task_completion := nullif(p_attempt ->> 'task_completion', '')::smallint;
  v_comprehensibility := nullif(p_attempt ->> 'comprehensibility', '')::smallint;
  v_accuracy := nullif(p_attempt ->> 'accuracy', '')::smallint;
  v_fluency := nullif(p_attempt ->> 'fluency', '')::smallint;
  v_lexical_range := nullif(p_attempt ->> 'lexical_range', '')::smallint;
  v_overall_score := nullif(p_attempt ->> 'overall_score', '')::smallint;
  v_evidence := coalesce(p_attempt -> 'evidence', '{}'::jsonb);
  v_occurred_at := nullif(p_attempt ->> 'occurred_at', '')::timestamptz;

  if v_task_key is null
    or v_task_type is null
    or v_skill is null
    or v_target_descriptor is null
    or v_prompt_version is null
    or v_evaluator_version is null
    or v_occurred_at is null
  then
    raise exception using errcode = '22023', message = 'required_attempt_field_missing';
  end if;
  if jsonb_typeof(v_assistance_used) <> 'object'
    or pg_column_size(v_assistance_used) > 4096
    or jsonb_typeof(v_evidence) <> 'object'
    or pg_column_size(v_evidence) > 16384
  then
    raise exception using errcode = '22023', message = 'invalid_attempt_metadata';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(v_assistance_used) as assistance_key
    where assistance_key not in (
      'translation',
      'dictionary',
      'replay_count',
      'hint_count',
      'preparation_seconds'
    )
  ) or exists (
    select 1
    from jsonb_object_keys(v_evidence) as evidence_key
    where evidence_key not in (
      'task_family',
      'valid',
      'invalidation_reason',
      'response_length',
      'turn_count',
      'stimulus_id'
    )
  ) then
    raise exception using errcode = '22023', message = 'unsupported_attempt_metadata';
  end if;
  if v_occurred_at < now() - interval '30 days'
    or v_occurred_at > now() + interval '5 minutes'
  then
    raise exception using errcode = '22023', message = 'occurred_at_out_of_range';
  end if;

  insert into public.learning_task_attempts (
    client_attempt_id,
    user_id,
    task_key,
    task_type,
    skill,
    target_descriptor,
    target_level,
    prompt_version,
    evaluator_version,
    evaluation_authority,
    authoritative,
    stimulus_unseen,
    assistance_used,
    response_time_ms,
    task_completion,
    comprehensibility,
    accuracy,
    fluency,
    lexical_range,
    overall_score,
    evidence,
    occurred_at
  )
  values (
    p_client_attempt_id,
    v_user_id,
    v_task_key,
    v_task_type,
    v_skill,
    v_target_descriptor,
    v_target_level,
    v_prompt_version,
    v_evaluator_version,
    'client',
    false,
    v_stimulus_unseen,
    v_assistance_used,
    v_response_time_ms,
    v_task_completion,
    v_comprehensibility,
    v_accuracy,
    v_fluency,
    v_lexical_range,
    v_overall_score,
    v_evidence,
    v_occurred_at
  )
  on conflict (user_id, client_attempt_id) do nothing
  returning id into v_attempt_id;

  if v_attempt_id is null then
    select
      task_key = v_task_key
      and task_type = v_task_type
      and skill = v_skill
      and target_descriptor = v_target_descriptor
      and target_level is not distinct from v_target_level
      and prompt_version = v_prompt_version
      and evaluator_version = v_evaluator_version
      and evaluation_authority = 'client'
      and authoritative = false
      and stimulus_unseen = v_stimulus_unseen
      and assistance_used = v_assistance_used
      and response_time_ms is not distinct from v_response_time_ms
      and task_completion is not distinct from v_task_completion
      and comprehensibility is not distinct from v_comprehensibility
      and accuracy is not distinct from v_accuracy
      and fluency is not distinct from v_fluency
      and lexical_range is not distinct from v_lexical_range
      and overall_score is not distinct from v_overall_score
      and evidence = v_evidence
      and occurred_at = v_occurred_at
    into v_matches
    from public.learning_task_attempts
    where user_id = v_user_id
      and client_attempt_id = p_client_attempt_id;

    if not coalesce(v_matches, false) then
      raise exception using errcode = '23505', message = 'idempotency_conflict';
    end if;

    select id
    into v_attempt_id
    from public.learning_task_attempts
    where user_id = v_user_id
      and client_attempt_id = p_client_attempt_id;
  end if;

  return jsonb_build_object(
    'id', v_attempt_id,
    'client_attempt_id', p_client_attempt_id,
    'authoritative', false,
    'evaluation_authority', 'client'
  );
end;
$$;

revoke all on function public.record_learning_task_attempt(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.record_learning_task_attempt(uuid, jsonb) to authenticated;
