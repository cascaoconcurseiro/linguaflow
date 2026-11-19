-- Frases de contexto do léxico compartilhado deixam de vazar entre alunos (#559).
--
-- Problema: canonical_lexicon guarda, por palavra, até 20 frases de contexto
-- enviadas por qualquer aluno (vídeo, Leitor, histórias). Qualquer usuário
-- logado lia a lista inteira pela tabela, e a RPC de gravação devolvia todas as
-- frases já salvas. Uma frase de um texto pessoal colado no Leitor ficava
-- visível para outros alunos.
--
-- Decisão (privacidade por padrão, LGPD): o cache continua compartilhado,
-- porque a mesma frase de um vídeo popular economiza IA para todos, mas cada
-- aluno só recebe a frase que ele mesmo está estudando, por correspondência
-- exata. Quem não conhece a frase não consegue descobri-la. Dados da palavra
-- (tradução e IPA) continuam compartilhados.
--
-- Implementação: a função de gravação existente vai, sem mudança de lógica,
-- para o schema private (fora da API). As RPCs públicas viram camadas finas que
-- exigem usuário e filtram `contexts` pela frase pedida. A tabela deixa de ser
-- lida diretamente.
--
-- Compatibilidade: versões antigas da extensão liam a tabela por REST. Após esta
-- migration a leitura falha, o cliente antigo devolve null e segue pela IA
-- (perde só a economia de cache) até atualizar para a 3.0.68.
--
-- Rollback:
--   drop function public.get_canonical_lexicon(text, text, text);
--   drop function public.get_or_cache_canonical_lexicon(text, text, jsonb);
--   alter function private.canonical_lexicon_upsert(text, text, jsonb) rename to get_or_cache_canonical_lexicon;
--   alter function private.get_or_cache_canonical_lexicon(text, text, jsonb) set schema public;
--   grant execute on function public.get_or_cache_canonical_lexicon(text, text, jsonb) to authenticated;
--   create policy canonical_lexicon_read on public.canonical_lexicon for select to authenticated using (true);
--   grant select on table public.canonical_lexicon to authenticated;

create schema if not exists private;

-- 1. Move a implementação atual para private (idempotente).
do $move$
begin
  if to_regprocedure('private.canonical_lexicon_upsert(text, text, jsonb)') is null then
    execute 'alter function public.get_or_cache_canonical_lexicon(text, text, jsonb) set schema private';
    execute 'alter function private.get_or_cache_canonical_lexicon(text, text, jsonb) rename to canonical_lexicon_upsert';
  end if;
end
$move$;
revoke all on function private.canonical_lexicon_upsert(text, text, jsonb) from public, anon, authenticated;

-- 2. Filtro: mantém os dados da palavra e só a frase que bate exatamente com a pedida.
create or replace function private.canonical_lexicon_for_sentence(p_row jsonb, p_sentence text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_row is null or jsonb_typeof(p_row) <> 'object' then null
    else (p_row - 'contexts') || jsonb_build_object('contexts', coalesce((
      select jsonb_agg(c)
        from jsonb_array_elements(
               case when jsonb_typeof(p_row->'contexts') = 'array' then p_row->'contexts' else '[]'::jsonb end
             ) c
       where nullif(lower(trim(coalesce(p_sentence, ''))), '') is not null
         and lower(trim(c->>'sentence')) = lower(trim(p_sentence))
    ), '[]'::jsonb))
  end
$$;
revoke all on function private.canonical_lexicon_for_sentence(jsonb, text) from public, anon, authenticated;

-- 3. Leitura: dados da palavra e, no máximo, a frase do próprio aluno.
create or replace function public.get_canonical_lexicon(p_word text, p_lang text, p_sentence text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if char_length(coalesce(p_sentence, '')) > 1000 then
    p_sentence := null;
  end if;
  return private.canonical_lexicon_for_sentence(
    private.canonical_lexicon_upsert(p_word, p_lang, null),
    p_sentence
  );
end;
$$;

-- 4. Gravação: mesma assinatura de antes; devolve só a frase que o aluno enviou.
create or replace function public.get_or_cache_canonical_lexicon(p_word text, p_lang text, p_entry jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  return private.canonical_lexicon_for_sentence(
    private.canonical_lexicon_upsert(p_word, p_lang, p_entry),
    case when jsonb_typeof(p_entry) = 'object' and jsonb_typeof(p_entry->'context') = 'object'
         then p_entry->'context'->>'sentence' end
  );
end;
$$;

revoke all on function public.get_canonical_lexicon(text, text, text) from public, anon;
revoke all on function public.get_or_cache_canonical_lexicon(text, text, jsonb) from public, anon;
grant execute on function public.get_canonical_lexicon(text, text, text) to authenticated;
grant execute on function public.get_or_cache_canonical_lexicon(text, text, jsonb) to authenticated;

-- 5. Tabela sem leitura direta: o acesso passa só pelas RPCs acima.
drop policy if exists canonical_lexicon_read on public.canonical_lexicon;
revoke all on table public.canonical_lexicon from public, anon, authenticated;
