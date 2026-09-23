-- #118 behavioral SQL: run only in the ephemeral migration test database.
begin;
grant usage on schema auth to authenticated;
insert into auth.users(id,email) values ('11800000-0000-4000-8000-000000000001','audit118a@example.invalid'),('11800000-0000-4000-8000-000000000002','audit118b@example.invalid');
select set_config('request.jwt.claim.sub','11800000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare result jsonb; issue jsonb; start_at timestamptz:=statement_timestamp()-interval '20 seconds'; finish_at timestamptz:=statement_timestamp()-interval '10 seconds';
begin
  -- Legacy 3-argument and explicit 4-argument calls resolve independently.
  perform public.log_study_time(1,current_date,'review');
  perform public.log_study_time(1,current_date,'review','en');
  result:=public.record_listening_interval('11800000-0000-4000-8000-000000000010',auth.uid(),10,start_at,finish_at,'en',current_date,'user_confirmed');
  if (result->>'credited_seconds')::int <> 10 then raise exception 'wrong initial credit'; end if;
  result:=public.record_listening_interval('11800000-0000-4000-8000-000000000010',auth.uid(),10,start_at,finish_at,'en',current_date,'user_confirmed');
  if (result->>'idempotent')::boolean is not true then raise exception 'retry not idempotent'; end if;
  result:=public.record_listening_interval('11800000-0000-4000-8000-000000000011',auth.uid(),10,start_at,finish_at,'en',current_date,'user_confirmed');
  if (result->>'credited_seconds')::int <> 0 then raise exception 'overlap double counted'; end if;
  begin
    perform public.record_listening_interval('11800000-0000-4000-8000-000000000010',auth.uid(),9,start_at,finish_at,'en',current_date,'user_confirmed');
    raise exception 'changed payload accepted';
  exception when unique_violation then null; end;
  begin
    perform public.record_listening_interval('11800000-0000-4000-8000-000000000012','11800000-0000-4000-8000-000000000002',10,start_at,finish_at,'en',current_date,'user_confirmed');
    raise exception 'other account accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.record_listening_interval('11800000-0000-4000-8000-000000000013',auth.uid(),60,start_at,finish_at,'en',current_date,'user_confirmed');
    raise exception 'inflated duration accepted';
  exception when invalid_parameter_value then null; end;
  issue:=public.issue_fluency_task('11800000-0000-4000-8000-000000000020','listening','A1');
  if length(public.get_fluency_listening_text((issue->>'id')::uuid)) < 10 then raise exception 'missing stimulus'; end if;
  perform set_config('lf.test_issue',issue->>'id',true);
end $$;
reset role;
do $$ begin
  if (select seconds from public.sessions where user_id='11800000-0000-4000-8000-000000000001' and date=current_date and source='video' and language='en') <> 10 then raise exception 'aggregate duplicated'; end if;
end $$;
select set_config('request.jwt.claim.sub','11800000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
  begin
    perform public.get_fluency_listening_text(current_setting('lf.test_issue')::uuid);
    raise exception 'cross-user stimulus leaked';
  exception when no_data_found then null; end;
  if has_table_privilege('authenticated','public.listening_intervals','SELECT') then raise exception 'ledger exposed'; end if;
  if has_function_privilege('anon','public.record_listening_interval(uuid,uuid,integer,timestamptz,timestamptz,text,date,text)','EXECUTE') then raise exception 'anon can write'; end if;
end $$;
rollback;
