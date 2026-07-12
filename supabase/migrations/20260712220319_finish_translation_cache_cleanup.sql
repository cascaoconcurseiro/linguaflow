-- A migration original criou translation_cache, mas 238 entradas legadas
-- ainda permaneceram em settings e 168 delas não tinham sido copiadas.
-- Cache é descartável, porém preservamos todos os valores antes da limpeza.
insert into public.translation_cache (user_id, cache_key, value, created_at)
select s.user_id, s.key, s.value, now()
from public.settings s
where s.key like 'trans\_%' escape '\'
on conflict (user_id, cache_key) do update
set value = excluded.value;

delete from public.settings
where key like 'trans\_%' escape '\';
