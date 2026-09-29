-- #368: palavras que o aluno escolheu ignorar (nomes próprios, interjeições,
-- ruído da legenda automática). Tabela separada de known_words para que
-- ignorar nunca conte como "palavra conhecida" em estatísticas e CEFR.
-- Rollback: o cliente trata a tabela ausente como lista vazia; a tabela pode
-- ficar (migrations são append-only) e o botão ser removido.
create table if not exists public.ignored_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  word text not null check (char_length(word) between 1 and 80),
  lang text not null default 'en' check (char_length(lang) between 2 and 10),
  added_at timestamptz not null default now(),
  constraint ignored_words_user_word_lang_key unique (user_id, word, lang)
);

alter table public.ignored_words enable row level security;

-- Menor privilégio: o aluno lê, ignora e deixa de ignorar; não há UPDATE.
revoke all on table public.ignored_words from public, anon, authenticated;
grant select, insert, delete on table public.ignored_words to authenticated;
grant all on table public.ignored_words to service_role;

drop policy if exists "Users manage own ignored words" on public.ignored_words;
create policy "Users manage own ignored words"
  on public.ignored_words for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
