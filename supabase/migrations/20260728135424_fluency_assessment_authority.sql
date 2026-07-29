-- Catálogo privado e autoridade de avaliação para tarefas comunicativas.
-- Este corte é expand-only: não altera FSRS, XP, ofensiva, liga ou user_stats.

create table private.fluency_task_catalog (
  id uuid primary key default gen_random_uuid(),
  task_key text not null check (char_length(btrim(task_key)) between 1 and 120),
  catalog_version text not null check (char_length(btrim(catalog_version)) between 1 and 80),
  task_type text not null check (task_type in (
    'unseen_listening', 'reading_comprehension', 'prepared_speaking',
    'spontaneous_speaking', 'writing', 'interaction', 'mediation'
  )),
  skill text not null check (skill in (
    'listening', 'reading', 'speaking_prepared', 'speaking_spontaneous',
    'writing', 'interaction', 'mediation'
  )),
  target_level text not null check (target_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  target_descriptor text not null check (char_length(btrim(target_descriptor)) between 1 and 500),
  task_family text not null check (char_length(btrim(task_family)) between 1 and 80),
  prompt_version text not null check (char_length(btrim(prompt_version)) between 1 and 80),
  public_material jsonb not null check (jsonb_typeof(public_material) = 'object')
    check (pg_column_size(public_material) <= 16384),
  answer_key jsonb not null check (jsonb_typeof(answer_key) = 'object')
    check (pg_column_size(answer_key) <= 16384),
  rubric jsonb not null check (jsonb_typeof(rubric) = 'object')
    check (pg_column_size(rubric) <= 16384),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (task_key, catalog_version)
);

create table public.fluency_task_issues (
  id uuid primary key default gen_random_uuid(),
  client_issue_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  catalog_task_id uuid not null references private.fluency_task_catalog(id),
  task_key text not null,
  catalog_version text not null,
  task_type text not null,
  skill text not null,
  target_level text not null,
  target_descriptor text not null,
  task_family text not null,
  prompt_version text not null,
  material jsonb not null check (jsonb_typeof(material) = 'object')
    check (pg_column_size(material) <= 16384),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (user_id, client_issue_id),
  check (expires_at > issued_at)
);

create table public.fluency_task_submissions (
  id uuid primary key default gen_random_uuid(),
  client_submission_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  issue_id uuid not null references public.fluency_task_issues(id) on delete cascade,
  assistance_used jsonb not null default '{}'::jsonb
    check (jsonb_typeof(assistance_used) = 'object')
    check (pg_column_size(assistance_used) <= 4096),
  response_time_ms integer check (response_time_ms between 0 and 3600000),
  status text not null default 'pending' check (status in ('pending', 'evaluated')),
  evaluation_authority text check (evaluation_authority in ('server', 'human')),
  evaluator_version text check (
    evaluator_version is null or char_length(btrim(evaluator_version)) between 1 and 80
  ),
  task_completion smallint check (task_completion between 0 and 3),
  comprehensibility smallint check (comprehensibility between 0 and 3),
  accuracy smallint check (accuracy between 0 and 3),
  fluency smallint check (fluency between 0 and 3),
  lexical_range smallint check (lexical_range between 0 and 3),
  overall_score smallint check (overall_score between 0 and 100),
  meets_level boolean,
  feedback jsonb not null default '{}'::jsonb check (jsonb_typeof(feedback) = 'object')
    check (pg_column_size(feedback) <= 8192),
  attempt_id uuid references public.learning_task_attempts(id),
  submitted_at timestamptz not null default now(),
  evaluated_at timestamptz,
  unique (user_id, client_submission_id),
  unique (issue_id),
  check (
    (status = 'pending'
      and evaluation_authority is null
      and evaluator_version is null
      and overall_score is null
      and meets_level is null
      and attempt_id is null
      and evaluated_at is null)
    or
    (status = 'evaluated'
      and evaluation_authority is not null
      and evaluator_version is not null
      and task_completion is not null
      and overall_score is not null
      and meets_level is not null
      and attempt_id is not null
      and evaluated_at is not null)
  )
);

create table private.fluency_task_responses (
  submission_id uuid primary key references public.fluency_task_submissions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  issue_id uuid not null references public.fluency_task_issues(id) on delete cascade,
  response jsonb not null check (jsonb_typeof(response) = 'object')
    check (pg_column_size(response) <= 65536),
  created_at timestamptz not null default now(),
  unique (user_id, submission_id)
);

create table public.fluency_skill_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  skill text not null check (skill in (
    'listening', 'reading', 'speaking_prepared', 'speaking_spontaneous',
    'writing', 'interaction', 'mediation'
  )),
  target_level text not null check (target_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  observed_level text check (observed_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  evidence_status text not null default 'amostra_inicial'
    check (evidence_status in ('amostra_inicial', 'provavel', 'consistente')),
  authoritative_attempt_count integer not null default 0 check (authoritative_attempt_count >= 0),
  passed_attempt_count integer not null default 0 check (passed_attempt_count >= 0),
  distinct_day_count integer not null default 0 check (distinct_day_count >= 0),
  task_family_count integer not null default 0 check (task_family_count >= 0),
  evidence_span_days integer not null default 0 check (evidence_span_days >= 0),
  last_score smallint check (last_score between 0 and 100),
  last_assessed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill, target_level),
  check (passed_attempt_count <= authoritative_attempt_count),
  check (observed_level is null or observed_level = target_level)
);

create index fluency_task_issues_user_issued_idx
  on public.fluency_task_issues (user_id, issued_at desc);
create index fluency_task_issues_catalog_task_id_idx
  on public.fluency_task_issues (catalog_task_id);
create index fluency_task_submissions_user_submitted_idx
  on public.fluency_task_submissions (user_id, submitted_at desc);
create index fluency_task_submissions_pending_idx
  on public.fluency_task_submissions (submitted_at)
  where status = 'pending';
create index fluency_task_responses_user_issue_idx
  on private.fluency_task_responses (user_id, issue_id);

alter table private.fluency_task_catalog enable row level security;
alter table private.fluency_task_responses enable row level security;
alter table public.fluency_task_issues enable row level security;
alter table public.fluency_task_submissions enable row level security;
alter table public.fluency_skill_profiles enable row level security;

create policy fluency_task_issues_select_own
  on public.fluency_task_issues for select to authenticated
  using ((select auth.uid()) = user_id);
create policy fluency_task_submissions_select_own
  on public.fluency_task_submissions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy fluency_skill_profiles_select_own
  on public.fluency_skill_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table private.fluency_task_catalog
  from public, anon, authenticated, service_role;
revoke all on table private.fluency_task_responses
  from public, anon, authenticated, service_role;
revoke all on table public.fluency_task_issues
  from public, anon, authenticated, service_role;
revoke all on table public.fluency_task_submissions
  from public, anon, authenticated, service_role;
revoke all on table public.fluency_skill_profiles
  from public, anon, authenticated, service_role;
grant select on table public.fluency_task_issues to authenticated;
grant select on table public.fluency_task_submissions to authenticated;
grant select on table public.fluency_skill_profiles to authenticated;

create or replace function public.issue_fluency_task(
  p_client_issue_id uuid,
  p_skill text,
  p_target_level text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_catalog private.fluency_task_catalog%rowtype;
  v_issue public.fluency_task_issues%rowtype;
  v_inserted boolean := false;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if p_client_issue_id is null
    or p_skill not in (
      'listening', 'reading', 'speaking_prepared', 'speaking_spontaneous',
      'writing', 'interaction', 'mediation'
    )
    or p_target_level not in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
  then
    raise exception using errcode = '22023', message = 'invalid_issue_request';
  end if;

  select *
    into v_issue
    from public.fluency_task_issues
   where user_id = v_user_id and client_issue_id = p_client_issue_id;
  if found then
    if v_issue.skill is distinct from p_skill
      or v_issue.target_level is distinct from p_target_level
    then
      raise exception using errcode = '23505', message = 'issue_idempotency_conflict';
    end if;
  else
    select catalog.*
      into v_catalog
      from private.fluency_task_catalog catalog
     where catalog.active
       and catalog.skill = p_skill
       and catalog.target_level = p_target_level
       and not exists (
         select 1
           from public.fluency_task_issues previous
          where previous.user_id = v_user_id
            and previous.catalog_task_id = catalog.id
            and previous.issued_at >= statement_timestamp() - interval '30 days'
       )
     order by catalog.created_at, catalog.id
     limit 1;

    if not found then
      raise exception using errcode = 'P0002', message = 'fluency_task_not_available';
    end if;

    insert into public.fluency_task_issues (
      client_issue_id, user_id, catalog_task_id, task_key, catalog_version,
      task_type, skill, target_level, target_descriptor, task_family,
      prompt_version, material, expires_at
    ) values (
      p_client_issue_id, v_user_id, v_catalog.id, v_catalog.task_key,
      v_catalog.catalog_version, v_catalog.task_type, v_catalog.skill,
      v_catalog.target_level, v_catalog.target_descriptor, v_catalog.task_family,
      v_catalog.prompt_version, v_catalog.public_material,
      statement_timestamp() + interval '24 hours'
    )
    on conflict (user_id, client_issue_id) do nothing
    returning * into v_issue;
    v_inserted := found;

    if not v_inserted then
      select *
        into strict v_issue
        from public.fluency_task_issues
       where user_id = v_user_id and client_issue_id = p_client_issue_id;
      if v_issue.skill is distinct from p_skill
        or v_issue.target_level is distinct from p_target_level
      then
        raise exception using errcode = '23505', message = 'issue_idempotency_conflict';
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_issue.id,
    'client_issue_id', v_issue.client_issue_id,
    'task_key', v_issue.task_key,
    'catalog_version', v_issue.catalog_version,
    'task_type', v_issue.task_type,
    'skill', v_issue.skill,
    'target_level', v_issue.target_level,
    'target_descriptor', v_issue.target_descriptor,
    'task_family', v_issue.task_family,
    'prompt_version', v_issue.prompt_version,
    'material', v_issue.material,
    'issued_at', v_issue.issued_at,
    'expires_at', v_issue.expires_at,
    'idempotent', not v_inserted
  );
end;
$$;

create or replace function public.submit_fluency_task(
  p_issue_id uuid,
  p_client_submission_id uuid,
  p_response jsonb,
  p_assistance_used jsonb default '{}'::jsonb,
  p_response_time_ms integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_issue public.fluency_task_issues%rowtype;
  v_submission public.fluency_task_submissions%rowtype;
  v_response private.fluency_task_responses%rowtype;
  v_inserted boolean := false;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if p_issue_id is null or p_client_submission_id is null
    or p_response is null or jsonb_typeof(p_response) <> 'object'
    or pg_column_size(p_response) > 65536
    or p_assistance_used is null or jsonb_typeof(p_assistance_used) <> 'object'
    or pg_column_size(p_assistance_used) > 4096
    or (p_response_time_ms is not null and p_response_time_ms not between 0 and 3600000)
  then
    raise exception using errcode = '22023', message = 'invalid_submission';
  end if;

  select *
    into v_issue
    from public.fluency_task_issues
   where id = p_issue_id and user_id = v_user_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'fluency_issue_not_found';
  end if;
  if v_issue.expires_at < statement_timestamp() then
    raise exception using errcode = '55000', message = 'fluency_issue_expired';
  end if;

  insert into public.fluency_task_submissions (
    client_submission_id, user_id, issue_id, assistance_used, response_time_ms
  ) values (
    p_client_submission_id, v_user_id, p_issue_id, p_assistance_used, p_response_time_ms
  )
  on conflict (user_id, client_submission_id) do nothing
  returning * into v_submission;
  v_inserted := found;

  if v_inserted then
    insert into private.fluency_task_responses (
      submission_id, user_id, issue_id, response
    ) values (
      v_submission.id, v_user_id, p_issue_id, p_response
    );
  else
    select *
      into strict v_submission
      from public.fluency_task_submissions
     where user_id = v_user_id and client_submission_id = p_client_submission_id;
    select *
      into strict v_response
      from private.fluency_task_responses
     where submission_id = v_submission.id and user_id = v_user_id;

    if v_submission.issue_id is distinct from p_issue_id
      or v_submission.assistance_used is distinct from p_assistance_used
      or v_submission.response_time_ms is distinct from p_response_time_ms
      or v_response.response is distinct from p_response
    then
      raise exception using errcode = '23505', message = 'submission_idempotency_conflict';
    end if;
  end if;

  return jsonb_build_object(
    'id', v_submission.id,
    'issue_id', v_submission.issue_id,
    'status', v_submission.status,
    'idempotent', not v_inserted
  );
end;
$$;

create or replace function public.get_fluency_submission_for_assessment(
  p_submission_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
begin
  select jsonb_build_object(
    'submission_id', submission.id,
    'user_id', submission.user_id,
    'status', submission.status,
    'task_key', issue.task_key,
    'task_type', issue.task_type,
    'skill', issue.skill,
    'target_level', issue.target_level,
    'target_descriptor', issue.target_descriptor,
    'task_family', issue.task_family,
    'prompt_version', issue.prompt_version,
    'material', issue.material,
    'answer_key', catalog.answer_key,
    'rubric', catalog.rubric,
    'response', response.response,
    'assistance_used', submission.assistance_used,
    'response_time_ms', submission.response_time_ms,
    'submitted_at', submission.submitted_at
  )
    into v_payload
    from public.fluency_task_submissions submission
    join public.fluency_task_issues issue on issue.id = submission.issue_id
    join private.fluency_task_catalog catalog on catalog.id = issue.catalog_task_id
    join private.fluency_task_responses response on response.submission_id = submission.id
   where submission.id = p_submission_id;

  if v_payload is null then
    raise exception using errcode = 'P0002', message = 'fluency_submission_not_found';
  end if;
  return v_payload;
end;
$$;

create or replace function public.commit_fluency_assessment(
  p_submission_id uuid,
  p_evaluation jsonb,
  p_authority text,
  p_evaluator_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.fluency_task_submissions%rowtype;
  v_issue public.fluency_task_issues%rowtype;
  v_response private.fluency_task_responses%rowtype;
  v_task_completion smallint;
  v_comprehensibility smallint;
  v_accuracy smallint;
  v_fluency smallint;
  v_lexical_range smallint;
  v_overall_score smallint;
  v_meets_level boolean;
  v_feedback jsonb;
  v_attempt_id uuid;
  v_count integer;
  v_passes integer;
  v_distinct_days integer;
  v_task_families integer;
  v_span_days integer;
  v_latest_pass boolean;
  v_recent_passes integer;
  v_status text;
  v_existing_matches boolean;
begin
  if p_submission_id is null
    or p_evaluation is null or jsonb_typeof(p_evaluation) <> 'object'
    or p_authority not in ('server', 'human')
    or p_evaluator_version is null
    or char_length(btrim(p_evaluator_version)) not between 1 and 80
  then
    raise exception using errcode = '22023', message = 'invalid_assessment';
  end if;

  v_task_completion := nullif(p_evaluation ->> 'task_completion', '')::smallint;
  v_comprehensibility := nullif(p_evaluation ->> 'comprehensibility', '')::smallint;
  v_accuracy := nullif(p_evaluation ->> 'accuracy', '')::smallint;
  v_fluency := nullif(p_evaluation ->> 'fluency', '')::smallint;
  v_lexical_range := nullif(p_evaluation ->> 'lexical_range', '')::smallint;
  v_overall_score := nullif(p_evaluation ->> 'overall_score', '')::smallint;
  v_meets_level := nullif(p_evaluation ->> 'meets_level', '')::boolean;
  v_feedback := coalesce(p_evaluation -> 'feedback', '{}'::jsonb);
  if v_task_completion is null or v_task_completion not between 0 and 3
    or (v_comprehensibility is not null and v_comprehensibility not between 0 and 3)
    or (v_accuracy is not null and v_accuracy not between 0 and 3)
    or (v_fluency is not null and v_fluency not between 0 and 3)
    or (v_lexical_range is not null and v_lexical_range not between 0 and 3)
    or v_overall_score is null or v_overall_score not between 0 and 100
    or v_meets_level is null
    or (v_meets_level and v_task_completion < 2)
    or jsonb_typeof(v_feedback) <> 'object' or pg_column_size(v_feedback) > 8192
  then
    raise exception using errcode = '22023', message = 'invalid_assessment_scores';
  end if;

  select *
    into v_submission
    from public.fluency_task_submissions
   where id = p_submission_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'fluency_submission_not_found';
  end if;

  if v_submission.status = 'evaluated' then
    v_existing_matches :=
      v_submission.evaluation_authority is not distinct from p_authority
      and v_submission.evaluator_version is not distinct from btrim(p_evaluator_version)
      and v_submission.task_completion is not distinct from v_task_completion
      and v_submission.comprehensibility is not distinct from v_comprehensibility
      and v_submission.accuracy is not distinct from v_accuracy
      and v_submission.fluency is not distinct from v_fluency
      and v_submission.lexical_range is not distinct from v_lexical_range
      and v_submission.overall_score is not distinct from v_overall_score
      and v_submission.meets_level is not distinct from v_meets_level
      and v_submission.feedback is not distinct from v_feedback;
    if not v_existing_matches then
      raise exception using errcode = '23505', message = 'assessment_idempotency_conflict';
    end if;
    return jsonb_build_object(
      'submission_id', v_submission.id,
      'attempt_id', v_submission.attempt_id,
      'authoritative', true,
      'evaluation_authority', v_submission.evaluation_authority,
      'idempotent', true
    );
  end if;

  select * into strict v_issue
    from public.fluency_task_issues where id = v_submission.issue_id;
  select * into strict v_response
    from private.fluency_task_responses where submission_id = v_submission.id;

  perform pg_advisory_xact_lock(
    hashtextextended(v_submission.user_id::text || ':' || v_issue.skill || ':' || v_issue.target_level, 0)
  );

  insert into public.learning_task_attempts (
    client_attempt_id, user_id, task_key, task_type, skill, target_descriptor,
    target_level, prompt_version, evaluator_version, evaluation_authority,
    authoritative, stimulus_unseen, assistance_used, response_time_ms,
    task_completion, comprehensibility, accuracy, fluency, lexical_range,
    overall_score, evidence, occurred_at
  ) values (
    v_submission.id, v_submission.user_id, v_issue.task_key, v_issue.task_type,
    v_issue.skill, v_issue.target_descriptor, v_issue.target_level,
    v_issue.prompt_version, btrim(p_evaluator_version), p_authority, true, true,
    v_submission.assistance_used, v_submission.response_time_ms,
    v_task_completion, v_comprehensibility, v_accuracy, v_fluency,
    v_lexical_range, v_overall_score,
    jsonb_strip_nulls(jsonb_build_object(
      'task_family', v_issue.task_family,
      'valid', true,
      'response_length', nullif(v_response.response ->> 'response_length', '')::integer,
      'turn_count', nullif(v_response.response ->> 'turn_count', '')::integer,
      'stimulus_id', v_issue.catalog_task_id::text
    )),
    v_submission.submitted_at
  )
  returning id into v_attempt_id;

  update public.fluency_task_submissions
     set status = 'evaluated',
         evaluation_authority = p_authority,
         evaluator_version = btrim(p_evaluator_version),
         task_completion = v_task_completion,
         comprehensibility = v_comprehensibility,
         accuracy = v_accuracy,
         fluency = v_fluency,
         lexical_range = v_lexical_range,
         overall_score = v_overall_score,
         meets_level = v_meets_level,
         feedback = v_feedback,
         attempt_id = v_attempt_id,
         evaluated_at = statement_timestamp()
   where id = v_submission.id;

  with ordered_evidence as (
    select
      evaluated.meets_level,
      evaluated.submitted_at,
      issued.task_family,
      row_number() over (
        order by evaluated.submitted_at desc, evaluated.id desc
      ) as recency
    from public.fluency_task_submissions evaluated
    join public.fluency_task_issues issued on issued.id = evaluated.issue_id
    where evaluated.user_id = v_submission.user_id
      and issued.skill = v_issue.skill
      and issued.target_level = v_issue.target_level
      and evaluated.status = 'evaluated'
      and evaluated.attempt_id is not null
  )
  select
    count(*)::integer,
    count(*) filter (where meets_level)::integer,
    count(distinct submitted_at::date)::integer,
    count(distinct task_family)::integer,
    floor(extract(epoch from (max(submitted_at) - min(submitted_at))) / 86400)::integer,
    (array_agg(meets_level order by submitted_at desc))[1],
    count(*) filter (where recency <= 5 and meets_level)::integer
  into
    v_count, v_passes, v_distinct_days, v_task_families, v_span_days,
    v_latest_pass, v_recent_passes
  from ordered_evidence;

  v_status := case
    when v_count >= 6
      and v_span_days >= 21
      and v_recent_passes >= 4
      and v_latest_pass
      and v_task_families >= 2
      then 'consistente'
    when v_count >= 3
      and v_distinct_days >= 2
      and v_task_families >= 2
      and v_passes >= 2
      and v_latest_pass
      then 'provavel'
    else 'amostra_inicial'
  end;
  insert into public.fluency_skill_profiles (
    user_id, skill, target_level, observed_level, evidence_status,
    authoritative_attempt_count, passed_attempt_count, distinct_day_count,
    task_family_count, evidence_span_days, last_score, last_assessed_at
  ) values (
    v_submission.user_id,
    v_issue.skill,
    v_issue.target_level,
    case when v_status in ('provavel', 'consistente') then v_issue.target_level else null end,
    v_status,
    v_count,
    v_passes,
    v_distinct_days,
    v_task_families,
    v_span_days,
    v_overall_score,
    statement_timestamp()
  )
  on conflict (user_id, skill, target_level) do update set
    observed_level = excluded.observed_level,
    evidence_status = excluded.evidence_status,
    authoritative_attempt_count = excluded.authoritative_attempt_count,
    passed_attempt_count = excluded.passed_attempt_count,
    distinct_day_count = excluded.distinct_day_count,
    task_family_count = excluded.task_family_count,
    evidence_span_days = excluded.evidence_span_days,
    last_score = excluded.last_score,
    last_assessed_at = excluded.last_assessed_at,
    updated_at = statement_timestamp();

  return jsonb_build_object(
    'submission_id', v_submission.id,
    'attempt_id', v_attempt_id,
    'authoritative', true,
    'evaluation_authority', p_authority,
    'evidence_status', v_status,
    'idempotent', false
  );
end;
$$;

-- Mantém o mesmo portão transacional de cota usado pelas demais Edge
-- Functions e expande somente a allowlist para a avaliação de fluência.
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
  if p_endpoint is null
    or p_endpoint not in ('deepseek-chat', 'tts', 'url-import', 'fluency-assessment')
  then
    raise exception 'invalid endpoint' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 600
    or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 3600
  then
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

  if v_count = 0
    and pg_try_advisory_xact_lock(hashtextextended('api_usage_log_retention', 0))
  then
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

revoke all on function public.issue_fluency_task(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.issue_fluency_task(uuid, text, text)
  to authenticated;
revoke all on function public.submit_fluency_task(uuid, uuid, jsonb, jsonb, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_fluency_task(uuid, uuid, jsonb, jsonb, integer)
  to authenticated;
revoke all on function public.get_fluency_submission_for_assessment(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_fluency_submission_for_assessment(uuid)
  to service_role;
revoke all on function public.commit_fluency_assessment(uuid, jsonb, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.commit_fluency_assessment(uuid, jsonb, text, text)
  to service_role;
revoke all on function public.consume_api_quota(uuid, text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.consume_api_quota(uuid, text, integer, integer)
  to service_role;

comment on table private.fluency_task_catalog is
  'Materiais, gabaritos e rubricas privados; nunca expostos diretamente ao cliente.';
comment on table private.fluency_task_responses is
  'Respostas livres privadas, acessíveis somente por RPCs server-side estreitas.';
comment on table public.fluency_skill_profiles is
  'Perfil por habilidade derivado apenas de avaliações autoritativas server-side ou humanas.';
