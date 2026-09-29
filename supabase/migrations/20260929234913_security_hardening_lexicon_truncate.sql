-- Endurecimento de segurança (auditoria de 2026-09-29).
--
-- 1. get_or_cache_canonical_lexicon: o cache de léxico é compartilhado entre
--    todos os usuários e qualquer conta logada grava nele pela RPC. A regra
--    "primeira gravação vence" já impedia sobrescrever traduções; faltavam
--    limites — campos sem tamanho máximo e lista de contextos crescendo sem
--    fim deixavam um usuário inchar a linha de uma palavra comum para todos.
--    Agora: escrita fora dos limites é ignorada (a chamada vira leitura) e
--    cada palavra guarda no máximo 20 contextos. Lógica de merge inalterada.
-- 2. TRUNCATE ignora RLS. A API REST não expõe TRUNCATE, mas anon e
--    authenticated não precisam desse privilégio em nenhuma tabela pública.
--
-- Rollback: recriar a função pela migration 20260927120000 e
-- "grant truncate on all tables in schema public to authenticated".

CREATE OR REPLACE FUNCTION public.get_or_cache_canonical_lexicon(p_word text, p_lang text DEFAULT 'en'::text, p_entry jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_norm_word text;
    v_norm_lang text;
    v_row record;
    v_word_phon text;
    v_word_pt text;
    v_new_ctx jsonb;
    v_merged_contexts jsonb;
    c_max_contexts constant int := 20;
BEGIN
    v_norm_word := lower(trim(coalesce(p_word, '')));
    v_norm_lang := lower(trim(coalesce(nullif(p_lang, ''), 'en')));

    IF v_norm_word = '' OR char_length(v_norm_word) > 80 OR char_length(v_norm_lang) > 10 THEN
        RETURN NULL;
    END IF;

    -- Escrita fora dos limites vira leitura (não grava lixo no cache comum).
    IF p_entry IS NOT NULL AND (
        jsonb_typeof(p_entry) <> 'object'
        OR char_length(coalesce(p_entry->>'word_pt', '')) > 300
        OR char_length(coalesce(p_entry->>'word_phon', '')) > 200
        OR char_length(coalesce(p_entry->>'source', '')) > 40
        OR (p_entry ? 'context' AND jsonb_typeof(p_entry->'context') NOT IN ('object', 'null'))
        OR char_length(coalesce(p_entry->'context'->>'sentence', '')) > 1000
        OR char_length(coalesce(p_entry->'context'->>'sentence_pt', '')) > 1000
        OR char_length(coalesce(p_entry->'context'->>'sentence_phon', '')) > 1000
        OR char_length(coalesce(p_entry->'context'->>'word_pt', '')) > 300
        OR char_length(coalesce((p_entry->'context')::text, '')) > 4000
    ) THEN
        p_entry := NULL;
    END IF;

    -- 1. Se p_entry é nulo, busca apenas
    IF p_entry IS NULL THEN
        SELECT * INTO v_row
        FROM public.canonical_lexicon
        WHERE word = v_norm_word AND lang = v_norm_lang;

        IF FOUND THEN
            UPDATE public.canonical_lexicon
            SET usage_count = usage_count + 1,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_row.id;

            RETURN to_jsonb(v_row);
        END IF;

        RETURN NULL;
    END IF;

    -- 2. Se p_entry foi fornecido, faz upsert com merge inteligente de contextos
    v_word_phon := trim(coalesce(p_entry->>'word_phon', ''));
    v_word_pt := trim(coalesce(p_entry->>'word_pt', ''));
    v_new_ctx := p_entry->'context';

    SELECT * INTO v_row
    FROM public.canonical_lexicon
    WHERE word = v_norm_word AND lang = v_norm_lang
    FOR UPDATE;

    IF FOUND THEN
        v_merged_contexts := v_row.contexts;
        IF v_new_ctx IS NOT NULL AND jsonb_typeof(v_new_ctx) = 'object' THEN
            IF EXISTS (
                SELECT 1
                FROM jsonb_array_elements(v_row.contexts) ctx
                WHERE lower(trim(ctx->>'sentence')) = lower(trim(v_new_ctx->>'sentence'))
            ) THEN
                SELECT coalesce(jsonb_agg(
                    CASE WHEN lower(trim(elem->>'sentence')) = lower(trim(v_new_ctx->>'sentence')) THEN
                        elem || jsonb_build_object(
                            'sentence_phon', coalesce(nullif(elem->>'sentence_phon', ''), v_new_ctx->>'sentence_phon', ''),
                            'sentence_pt', coalesce(nullif(elem->>'sentence_pt', ''), v_new_ctx->>'sentence_pt', ''),
                            'word_pt', coalesce(nullif(elem->>'word_pt', ''), v_new_ctx->>'word_pt', '')
                        )
                    ELSE elem END
                ), '[]'::jsonb) INTO v_merged_contexts
                FROM jsonb_array_elements(v_row.contexts) elem;
            ELSIF jsonb_array_length(coalesce(v_row.contexts, '[]'::jsonb)) < c_max_contexts THEN
                v_merged_contexts := v_row.contexts || jsonb_build_array(v_new_ctx);
            END IF;
        END IF;

        UPDATE public.canonical_lexicon
        SET word_phon = coalesce(nullif(v_row.word_phon, ''), nullif(v_word_phon, '')),
            word_pt = coalesce(nullif(v_row.word_pt, ''), nullif(v_word_pt, '')),
            contexts = coalesce(v_merged_contexts, v_row.contexts),
            usage_count = v_row.usage_count + 1,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_row.id
        RETURNING * INTO v_row;

        RETURN to_jsonb(v_row);
    ELSE
        v_merged_contexts := '[]'::jsonb;
        IF v_new_ctx IS NOT NULL AND jsonb_typeof(v_new_ctx) = 'object' THEN
            v_merged_contexts := jsonb_build_array(v_new_ctx);
        END IF;

        INSERT INTO public.canonical_lexicon (
            word, lang, word_phon, word_pt, contexts, source, usage_count, created_at, updated_at
        ) VALUES (
            v_norm_word,
            v_norm_lang,
            nullif(v_word_phon, ''),
            nullif(v_word_pt, ''),
            v_merged_contexts,
            coalesce(nullif(trim(p_entry->>'source'), ''), 'deepseek-chat'),
            1,
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        )
        ON CONFLICT (word, lang) DO NOTHING
        RETURNING * INTO v_row;

        IF FOUND THEN
            RETURN to_jsonb(v_row);
        END IF;

        SELECT * INTO v_row
        FROM public.canonical_lexicon
        WHERE word = v_norm_word AND lang = v_norm_lang;
        RETURN to_jsonb(v_row);
    END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_or_cache_canonical_lexicon(text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_or_cache_canonical_lexicon(text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_cache_canonical_lexicon(text, text, jsonb) TO authenticated, service_role;

-- 2. TRUNCATE nunca é necessário para o cliente.
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon, authenticated;
