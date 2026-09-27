-- Migration: 20260927120000_canonical_lexicon_update_merge.sql
-- Descrição: Aprimoramento da RPC get_or_cache_canonical_lexicon para merge inteligente
-- Preenche lacunas (IPA/tradução vazios) de contextos existentes sem sobrescrever valores já
-- gravados, evitando perda de cache, consumo desnecessário de tokens e envenenamento do cache.

CREATE OR REPLACE FUNCTION public.get_or_cache_canonical_lexicon(
    p_word text,
    p_lang text DEFAULT 'en',
    p_entry jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_norm_word text;
    v_norm_lang text;
    v_row record;
    v_word_phon text;
    v_word_pt text;
    v_new_ctx jsonb;
    v_merged_contexts jsonb;
BEGIN
    v_norm_word := lower(trim(coalesce(p_word, '')));
    v_norm_lang := lower(trim(coalesce(nullif(p_lang, ''), 'en')));

    IF v_norm_word = '' THEN
        RETURN NULL;
    END IF;

    -- 1. Se p_entry é nulo, busca apenas
    IF p_entry IS NULL THEN
        SELECT * INTO v_row
        FROM public.canonical_lexicon
        WHERE word = v_norm_word AND lang = v_norm_lang;

        IF FOUND THEN
            -- Incrementa usage_count
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

    -- Busca registro existente para merge
    SELECT * INTO v_row
    FROM public.canonical_lexicon
    WHERE word = v_norm_word AND lang = v_norm_lang
    FOR UPDATE;

    IF FOUND THEN
        v_merged_contexts := v_row.contexts;
        IF v_new_ctx IS NOT NULL AND jsonb_typeof(v_new_ctx) = 'object' THEN
            -- Se o contexto já existe, enriquece seus campos (phon/pt); se não existe, adiciona
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
            ELSE
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
            word,
            lang,
            word_phon,
            word_pt,
            contexts,
            source,
            usage_count,
            created_at,
            updated_at
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

        -- Outra sessão inseriu a mesma palavra entre o SELECT e o INSERT:
        -- devolve a linha vencedora em vez de lançar unique_violation.
        SELECT * INTO v_row
        FROM public.canonical_lexicon
        WHERE word = v_norm_word AND lang = v_norm_lang;
        RETURN to_jsonb(v_row);
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_cache_canonical_lexicon(text, text, jsonb) FROM PUBLIC;
-- Escrita no cache compartilhado exige sessão: a chave anon é pública e
-- permitiria a qualquer visitante reescrever IPA/tradução de todos os usuários.
REVOKE EXECUTE ON FUNCTION public.get_or_cache_canonical_lexicon(text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_cache_canonical_lexicon(text, text, jsonb) TO authenticated, service_role;
