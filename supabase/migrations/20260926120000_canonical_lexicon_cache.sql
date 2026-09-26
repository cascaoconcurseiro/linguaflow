-- Migration: 20260926120000_canonical_lexicon_cache.sql
-- Descrição: Cache Léxico Canônico (FinOps & Latência)
-- Permite reaproveitamento global de transcrições IPA, traduções e frases enriquecidas,
-- reduzindo em até 90% chamadas repetitivas de enriquecimento a LLMs.

CREATE TABLE IF NOT EXISTS public.canonical_lexicon (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    word text NOT NULL,
    lang text NOT NULL DEFAULT 'en',
    word_phon text,
    word_pt text,
    contexts jsonb NOT NULL DEFAULT '[]'::jsonb,
    source text NOT NULL DEFAULT 'deepseek-chat',
    confidence numeric NOT NULL DEFAULT 1.0,
    usage_count integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_canonical_lexicon_word_lang UNIQUE (word, lang)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_canonical_lexicon_lookup 
ON public.canonical_lexicon (lower(trim(word)), lang);

CREATE INDEX IF NOT EXISTS idx_canonical_lexicon_usage 
ON public.canonical_lexicon (usage_count DESC);

ALTER TABLE public.canonical_lexicon ENABLE ROW LEVEL SECURITY;

-- Leitura liberada para usuários autenticados e anon
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'canonical_lexicon' 
        AND policyname = 'canonical_lexicon_read'
    ) THEN
        CREATE POLICY canonical_lexicon_read ON public.canonical_lexicon
        FOR SELECT TO authenticated, anon
        USING (true);
    END IF;
END $$;

-- RPC segura para consultar ou armazenar no cache
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
        WHERE lower(trim(word)) = v_norm_word AND lang = v_norm_lang;

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

    -- 2. Se p_entry foi fornecido, faz upsert com merge de contextos
    v_word_phon := trim(coalesce(p_entry->>'word_phon', ''));
    v_word_pt := trim(coalesce(p_entry->>'word_pt', ''));
    v_new_ctx := p_entry->'context';

    -- Busca registro existente para merge
    SELECT * INTO v_row
    FROM public.canonical_lexicon
    WHERE lower(trim(word)) = v_norm_word AND lang = v_norm_lang
    FOR UPDATE;

    IF FOUND THEN
        v_merged_contexts := v_row.contexts;
        IF v_new_ctx IS NOT NULL AND jsonb_typeof(v_new_ctx) = 'object' THEN
            -- Se o contexto já não existe (por sentence)
            IF NOT EXISTS (
                SELECT 1
                FROM jsonb_array_elements(v_row.contexts) ctx
                WHERE lower(trim(ctx->>'sentence')) = lower(trim(v_new_ctx->>'sentence'))
            ) THEN
                v_merged_contexts := v_row.contexts || jsonb_build_array(v_new_ctx);
            END IF;
        END IF;

        UPDATE public.canonical_lexicon
        SET word_phon = coalesce(nullif(v_word_phon, ''), v_row.word_phon),
            word_pt = coalesce(nullif(v_word_pt, ''), v_row.word_pt),
            contexts = v_merged_contexts,
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
        RETURNING * INTO v_row;

        RETURN to_jsonb(v_row);
    END IF;
END;
$$;

-- Permissões e segurança
REVOKE ALL ON FUNCTION public.get_or_cache_canonical_lexicon(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_cache_canonical_lexicon(text, text, jsonb) TO authenticated, service_role, anon;
