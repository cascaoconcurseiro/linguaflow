-- Recuperado e adicionado por Codex em 2026-07-10.
--
-- Uma revisão não pode atualizar o agendamento e falhar antes de gravar seu
-- histórico. Esta RPC mantém a atualização do card, o review_log e o trigger
-- de XP na mesma transação Postgres. client_review_id torna retries seguros.

alter table public.review_log
  add column if not exists client_review_id uuid;

create unique index if not exists review_log_user_client_review_id_key
  on public.review_log (user_id, client_review_id)
  where client_review_id is not null;

create or replace function public.record_card_review(
  p_card_id uuid,
  p_quality smallint,
  p_state jsonb,
  p_client_review_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_card public.cards%rowtype;
  v_log public.review_log%rowtype;
  v_xp_before integer := 0;
  v_xp_after integer := 0;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  if p_quality not between 1 and 4 then
    raise exception 'quality must be between 1 and 4';
  end if;
  if p_client_review_id is null then
    raise exception 'client_review_id is required';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'state must be a JSON object';
  end if;

  -- Retry seguro: não cria nem agenda uma segunda revisão.
  select * into v_log
  from public.review_log
  where user_id = v_user_id and client_review_id = p_client_review_id;
  if found then
    select * into v_card from public.cards where id = p_card_id and user_id = v_user_id;
    if not found then raise exception 'card not found'; end if;
    return jsonb_build_object('card', to_jsonb(v_card), 'review_log_id', v_log.id,
      'xp_awarded', 0, 'idempotent', true);
  end if;

  perform public.ensure_user_stats(v_user_id);
  select coalesce(xp_total, 0) into v_xp_before
  from public.user_stats where user_id = v_user_id for update;

  -- O lock impede avaliações concorrentes do mesmo card. Os campos aceitos
  -- são explicitamente listados para não transformar o JSON em PATCH livre.
  update public.cards
  set status = coalesce(p_state->>'status', status),
      interval = coalesce((p_state->>'interval')::double precision, interval),
      ease_factor = coalesce((p_state->>'ease_factor')::double precision, ease_factor),
      step_index = coalesce((p_state->>'step_index')::integer, step_index),
      reps = coalesce((p_state->>'reps')::integer, reps),
      lapses = coalesce((p_state->>'lapses')::integer, lapses),
      difficulty = coalesce((p_state->>'difficulty')::double precision, difficulty),
      stability = coalesce((p_state->>'stability')::double precision, stability),
      pre_lapse_interval = coalesce((p_state->>'pre_lapse_interval')::double precision, pre_lapse_interval),
      due_date = coalesce((p_state->>'due_date')::timestamptz, due_date),
      last_review = coalesce((p_state->>'last_review')::timestamptz, last_review),
      introduced_at = coalesce((p_state->>'introduced_at')::timestamptz, introduced_at),
      suspended = coalesce((p_state->>'suspended')::boolean, suspended),
      is_leech = coalesce((p_state->>'is_leech')::boolean, is_leech)
  where id = p_card_id and user_id = v_user_id
  returning * into v_card;
  if not found then raise exception 'card not found'; end if;

  insert into public.review_log (user_id, card_id, quality, date, ts, client_review_id)
  values (v_user_id, p_card_id, p_quality, current_date, now(), p_client_review_id)
  returning * into v_log;

  select coalesce(xp_total, 0) into v_xp_after
  from public.user_stats where user_id = v_user_id;
  return jsonb_build_object('card', to_jsonb(v_card), 'review_log_id', v_log.id,
    'xp_awarded', greatest(v_xp_after - v_xp_before, 0), 'idempotent', false);
end;
$$;

revoke all on function public.record_card_review(uuid, smallint, jsonb, uuid) from public;
grant execute on function public.record_card_review(uuid, smallint, jsonb, uuid) to authenticated;
