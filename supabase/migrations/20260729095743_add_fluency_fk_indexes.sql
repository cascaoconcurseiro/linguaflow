create index if not exists fluency_task_responses_issue_id_idx
  on private.fluency_task_responses (issue_id);

create index if not exists fluency_task_submissions_attempt_id_idx
  on public.fluency_task_submissions (attempt_id);
