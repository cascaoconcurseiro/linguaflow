-- Contexto de vídeo é metadado do card. Não cria uma tabela nova nem muda RLS:
-- a policy de words já protege a linha por user_id. Cards antigos continuam
-- válidos com o timestamp da URL; não inventamos um fim de trecho no backfill.
alter table public.words
  add column if not exists video_start_ms integer,
  add column if not exists video_end_ms integer;

alter table public.words
  drop constraint if exists words_video_start_ms_nonnegative,
  drop constraint if exists words_video_end_ms_nonnegative,
  drop constraint if exists words_video_clip_bounds;

alter table public.words
  add constraint words_video_start_ms_nonnegative
    check (video_start_ms is null or video_start_ms >= 0),
  add constraint words_video_end_ms_nonnegative
    check (video_end_ms is null or video_end_ms >= 0),
  add constraint words_video_clip_bounds
    check (video_end_ms is null or video_start_ms is null or video_end_ms > video_start_ms);
