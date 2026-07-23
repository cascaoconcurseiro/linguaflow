-- O banco de produção já possui esta restrição, mas o baseline versionado não.
-- Replays limpos perdiam a autoridade usada por create_card_for_word:
-- ON CONFLICT (user_id, word_id).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.cards'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (user_id, word_id)'
  ) then
    alter table public.cards
      add constraint cards_user_id_word_id_key unique (user_id, word_id);
  end if;
end;
$$;
