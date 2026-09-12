-- Migration: 20260912120000_database_audit_hardening.sql
-- Auditoria de banco de dados: integridade referencial (CASCADE),
-- colunas de estado de leitura/história, tabelas estruturadas de mídia e conquistas,
-- deduplicação de frases, índices de alta performance e RPCs atômicas.

-- ── 1. Integridade Referencial (ON DELETE CASCADE) ───────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1.1 Chaves estrangeiras apontando para auth.users(id) nas tabelas baseline
  FOR r IN (
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'auth'
      AND ccu.table_name = 'users'
      AND tc.table_name IN (
        'words', 'cards', 'review_log', 'settings', 'sentences',
        'sessions', 'user_stats', 'known_words', 'stories', 'api_usage_log'
      )
  ) LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I;', r.table_name, r.constraint_name);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;', r.table_name, r.constraint_name);
  END LOOP;

  -- 1.2 cards.word_id -> public.words(id) ON DELETE CASCADE
  FOR r IN (
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'cards'
      AND ccu.table_name = 'words'
  ) LOOP
    EXECUTE format('ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS %I;', r.constraint_name);
    EXECUTE format('ALTER TABLE public.cards ADD CONSTRAINT %I FOREIGN KEY (word_id) REFERENCES public.words(id) ON DELETE CASCADE;', r.constraint_name);
  END LOOP;

  -- 1.3 review_log.card_id -> public.cards(id) ON DELETE CASCADE
  FOR r IN (
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'review_log'
      AND ccu.table_name = 'cards'
  ) LOOP
    EXECUTE format('ALTER TABLE public.review_log DROP CONSTRAINT IF EXISTS %I;', r.constraint_name);
    EXECUTE format('ALTER TABLE public.review_log ADD CONSTRAINT %I FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE CASCADE;', r.constraint_name);
  END LOOP;
END $$;

-- ── 2. Colunas Faltantes em Tabelas Existentes ────────────────────────────────
-- 2.1 Histórias: arquivamento nativo e métricas
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS word_count integer,
  ADD COLUMN IF NOT EXISTS measured_level text;

-- 2.2 Web Reader: progresso de leitura e conclusão
ALTER TABLE public.reader_texts
  ADD COLUMN IF NOT EXISTS last_read_position integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reading_percentage numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_completed boolean NOT NULL DEFAULT false;

-- 2.3 Palavras conhecidas: timestamp de quando foi marcada
ALTER TABLE public.known_words
  ADD COLUMN IF NOT EXISTS added_at timestamptz NOT NULL DEFAULT now();

-- ── 3. Deduplicação e Restrição Única em Sentences ────────────────────────────
DELETE FROM public.sentences a
USING public.sentences b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.original = b.original;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sentences'::regclass
      AND conname = 'sentences_user_original_key'
  ) THEN
    ALTER TABLE public.sentences
      ADD CONSTRAINT sentences_user_original_key UNIQUE (user_id, original);
  END IF;
END $$;

-- ── 4. Novas Tabelas Estruturadas ────────────────────────────────────────────
-- 4.1 Histórico de Mídia / Sessões de Vídeo
CREATE TABLE IF NOT EXISTS public.media_watch_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  video_url text NOT NULL,
  video_title text,
  duration_seconds integer NOT NULL DEFAULT 0,
  watched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.media_watch_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'media_watch_sessions'
      AND policyname = 'media_watch_sessions_manage_own'
  ) THEN
    CREATE POLICY "media_watch_sessions_manage_own"
      ON public.media_watch_sessions
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_watch_sessions TO authenticated;
REVOKE ALL ON public.media_watch_sessions FROM public, anon;

-- 4.2 Conquistas Estruturadas (substitui o JSON solto em settings)
CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_achievements'
      AND policyname = 'user_achievements_manage_own'
  ) THEN
    CREATE POLICY "user_achievements_manage_own"
      ON public.user_achievements
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_achievements TO authenticated;
REVOKE ALL ON public.user_achievements FROM public, anon;

-- ── 5. Índices de Alta Performance ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cards_user_status_due
  ON public.cards (user_id, status, due_date)
  WHERE NOT suspended;

CREATE INDEX IF NOT EXISTS idx_cards_user_introduced
  ON public.cards (user_id, introduced_at);

CREATE INDEX IF NOT EXISTS idx_words_user_added
  ON public.words (user_id, added_at DESC);

CREATE INDEX IF NOT EXISTS idx_words_user_category_word
  ON public.words (user_id, category, word);

CREATE INDEX IF NOT EXISTS idx_stories_user_archived_created
  ON public.stories (user_id, archived, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sentences_user_added
  ON public.sentences (user_id, added_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_watch_user_watched
  ON public.media_watch_sessions (user_id, watched_at DESC);

-- ── 6. RPC Atômica: Salvar Palavra e Criar Card (Zero Órfãos) ────────────────
CREATE OR REPLACE FUNCTION public.save_word_with_card(p_word jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_word_row public.words%ROWTYPE;
  v_card_row public.cards%ROWTYPE;
  v_is_new_card boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;

  INSERT INTO public.words (
    user_id, word, lang, translation, context_sentence, phonetic, pronunciation_pt,
    explanation, level, tags, ai_chunks, video_url, video_start_ms, video_end_ms,
    video_title, platform, synonyms, antonyms, definition, category, added_at
  ) VALUES (
    v_user_id,
    p_word->>'word',
    coalesce(p_word->>'lang', 'en'),
    p_word->>'translation',
    p_word->>'context_sentence',
    p_word->>'phonetic',
    p_word->>'pronunciation_pt',
    p_word->>'explanation',
    p_word->>'level',
    case when jsonb_typeof(p_word->'tags') = 'array'
         then array(select jsonb_array_elements_text(p_word->'tags'))
         else null end,
    p_word->'ai_chunks',
    p_word->>'video_url',
    (p_word->>'video_start_ms')::integer,
    (p_word->>'video_end_ms')::integer,
    p_word->>'video_title',
    p_word->>'platform',
    p_word->>'synonyms',
    p_word->>'antonyms',
    p_word->>'definition',
    p_word->>'category',
    coalesce((p_word->>'added_at')::timestamptz, statement_timestamp())
  )
  ON CONFLICT (user_id, word, lang) DO UPDATE
    SET translation = coalesce(excluded.translation, public.words.translation),
        context_sentence = coalesce(excluded.context_sentence, public.words.context_sentence),
        explanation = coalesce(excluded.explanation, public.words.explanation),
        category = coalesce(excluded.category, public.words.category),
        video_start_ms = coalesce(excluded.video_start_ms, public.words.video_start_ms),
        video_end_ms = coalesce(excluded.video_end_ms, public.words.video_end_ms),
        phonetic = coalesce(excluded.phonetic, public.words.phonetic),
        pronunciation_pt = coalesce(excluded.pronunciation_pt, public.words.pronunciation_pt),
        tags = coalesce(excluded.tags, public.words.tags),
        ai_chunks = coalesce(excluded.ai_chunks, public.words.ai_chunks)
  RETURNING * INTO v_word_row;

  SELECT * INTO v_card_row FROM public.cards
   WHERE user_id = v_user_id AND word_id = v_word_row.id;

  IF NOT FOUND THEN
    INSERT INTO public.cards (user_id, word_id, status, interval, ease_factor, due_date, reps)
    VALUES (v_user_id, v_word_row.id, 'new', 0, 2.5, statement_timestamp(), 0)
    RETURNING * INTO v_card_row;
    v_is_new_card := true;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'word', to_jsonb(v_word_row),
    'card', to_jsonb(v_card_row),
    'is_new_card', v_is_new_card
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_word_with_card(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_word_with_card(jsonb) TO authenticated;

-- ── 7. RPC de Agregação Consolidada do Dashboard ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  v_stats public.user_stats%ROWTYPE;
  v_total_words int;
  v_total_sentences int;
  v_due_cards int;
  v_due_learning int;
  v_by_status jsonb;
  v_by_cefr jsonb;
  v_today_secs int;
  v_total_secs bigint;
  v_retention int;
  v_total_reviews_30d int;
  v_good_reviews_30d int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'not_authenticated';
  END IF;

  SELECT * INTO v_stats FROM public.user_stats WHERE user_id = v_user_id;

  SELECT count(*) INTO v_total_words FROM public.words WHERE user_id = v_user_id;
  SELECT count(*) INTO v_total_sentences FROM public.sentences WHERE user_id = v_user_id;

  SELECT
    count(*) FILTER (WHERE due_date <= v_now AND NOT suspended),
    count(*) FILTER (WHERE due_date <= v_now AND NOT suspended AND status = 'learning'),
    jsonb_build_object(
      'new', count(*) FILTER (WHERE status = 'new'),
      'learning', count(*) FILTER (WHERE status = 'learning'),
      'review', count(*) FILTER (WHERE status = 'review'),
      'mature', count(*) FILTER (WHERE status = 'mature')
    )
  INTO v_due_cards, v_due_learning, v_by_status
  FROM public.cards WHERE user_id = v_user_id;

  SELECT jsonb_object_agg(coalesce(level, 'A1'), cnt)
  INTO v_by_cefr
  FROM (
    SELECT w.level, count(*) as cnt
    FROM public.words w
    JOIN public.cards c ON c.word_id = w.id
    WHERE w.user_id = v_user_id AND c.status <> 'new'
    GROUP BY w.level
  ) cefr_counts;

  SELECT
    coalesce(sum(seconds) FILTER (WHERE date = (v_now AT TIME ZONE coalesce(v_stats.timezone, 'UTC'))::date), 0),
    coalesce(sum(seconds), 0)
  INTO v_today_secs, v_total_secs
  FROM public.sessions WHERE user_id = v_user_id;

  SELECT
    count(*),
    count(*) FILTER (WHERE quality >= 3)
  INTO v_total_reviews_30d, v_good_reviews_30d
  FROM public.review_log
  WHERE user_id = v_user_id AND ts >= v_now - interval '30 days';

  v_retention := CASE WHEN v_total_reviews_30d > 0
    THEN round((v_good_reviews_30d::numeric / v_total_reviews_30d::numeric) * 100)
    ELSE 0 END;

  RETURN jsonb_build_object(
    'total_words', v_total_words,
    'total_sentences', v_total_sentences,
    'due_cards', v_due_cards,
    'due_learning', v_due_learning,
    'by_status', v_by_status,
    'by_cefr', coalesce(v_by_cefr, '{}'::jsonb),
    'today_secs', v_today_secs,
    'total_secs', v_total_secs,
    'retention', v_retention,
    'streak', coalesce(v_stats.streak, 0),
    'user_stats', to_jsonb(v_stats)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary() TO authenticated;
