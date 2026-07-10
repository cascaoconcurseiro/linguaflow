-- BASELINE do schema pré-auditoria (2026-07-10).
-- Existe para tornar a pasta de migrations REPRODUZÍVEL do zero: as migrations
-- seguintes fazem ALTER/DROP em objetos que nasceram antes do versionamento.
--
-- 100% guardado (IF NOT EXISTS / checagens em catálogo): aplicar em produção é
-- um no-op — ele NUNCA sobrescreve funções/policies que as migrations
-- posteriores já evoluíram. Num banco vazio, recria o estado de partida exato.
-- Requisito fora do Supabase: schema auth com auth.uid() (tests/db/auth_shim.sql).

-- ── Tabelas ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  word text NOT NULL,
  lang text NOT NULL DEFAULT 'en',
  translation text,
  context_sentence text,
  phonetic text,
  pronunciation_pt text,
  explanation text,
  level text,
  tags text[],
  ai_chunks jsonb,
  video_url text,
  video_title text,
  platform text,
  added_at timestamptz NOT NULL DEFAULT now(),
  synonyms text,
  antonyms text,
  definition text,
  snapshot text,
  category text
);
CREATE UNIQUE INDEX IF NOT EXISTS words_user_word_lang_key ON public.words (user_id, word, lang);
CREATE INDEX IF NOT EXISTS idx_words_level ON public.words (level);

CREATE TABLE IF NOT EXISTS public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  word_id uuid NOT NULL REFERENCES public.words(id),
  status text NOT NULL DEFAULT 'new',
  "interval" double precision NOT NULL DEFAULT 0,
  ease_factor double precision NOT NULL DEFAULT 2.5,
  step_index integer NOT NULL DEFAULT 0,
  reps integer NOT NULL DEFAULT 0,
  lapses integer NOT NULL DEFAULT 0,
  difficulty double precision,
  stability double precision,
  pre_lapse_interval double precision DEFAULT 0,
  due_date timestamptz NOT NULL DEFAULT now(),
  last_review timestamptz,
  suspended boolean NOT NULL DEFAULT false,
  is_leech boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_cards_user ON public.cards (user_id);

CREATE TABLE IF NOT EXISTS public.review_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  card_id uuid REFERENCES public.cards(id),
  quality smallint CHECK (quality >= 1 AND quality <= 4),
  date date NOT NULL DEFAULT CURRENT_DATE,
  ts timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_log_user ON public.review_log (user_id);

CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  key text NOT NULL,
  value text
);
CREATE UNIQUE INDEX IF NOT EXISTS settings_user_key_key ON public.settings (user_id, key);

CREATE TABLE IF NOT EXISTS public.sentences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  original text NOT NULL,
  translation text,
  analysis text,
  platform text,
  video_url text,
  video_title text,
  added_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  seconds integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  username text,
  avatar_url text,
  xp_today integer DEFAULT 0,
  xp_week integer DEFAULT 0,
  xp_total integer DEFAULT 0,
  league_index integer DEFAULT 0,
  streak integer DEFAULT 0,
  last_study_date date DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  streak_freezes integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.known_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  word text NOT NULL,
  lang text NOT NULL DEFAULT 'en'
);
CREATE UNIQUE INDEX IF NOT EXISTS known_words_user_word_lang_key ON public.known_words (user_id, word, lang);

CREATE TABLE IF NOT EXISTS public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  title text NOT NULL,
  content text NOT NULL,
  level text,
  genre text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.api_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  endpoint text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_time ON public.api_usage_log (user_id, created_at);

-- ── RLS + policies originais (guardadas: só criam se a tabela estiver sem) ──
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.known_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['words','cards','review_log','settings','sentences','sessions','known_words'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t) THEN
      EXECUTE format(
        'CREATE POLICY "Users see own data" ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='stories') THEN
    CREATE POLICY "Users see own stories" ON public.stories
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_stats') THEN
    CREATE POLICY "Anyone can read user_stats" ON public.user_stats FOR SELECT USING (true);
    CREATE POLICY "Users can insert own stats" ON public.user_stats
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── Funções originais (só criadas se AUSENTES — nunca sobrescrevem evolução) ─
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='ensure_user_stats') THEN
    CREATE FUNCTION public.ensure_user_stats(_user_id uuid DEFAULT auth.uid())
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
    AS $fn$
    BEGIN
      INSERT INTO public.user_stats (user_id, xp_today, xp_week, xp_total, streak, league_index, last_study_date)
      VALUES (_user_id, 0, 0, 0, 0, 0, CURRENT_DATE)
      ON CONFLICT (user_id) DO NOTHING;
    END; $fn$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='calculate_xp_on_activity') THEN
    -- Versão ORIGINAL do trigger (pré-Learning-Engine); learning_engine_e4 substitui.
    CREATE FUNCTION public.calculate_xp_on_activity()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
    AS $fn$
    DECLARE
      _user_id uuid; _last_date date; _diff_days int; _streak int;
      _xp_today int; _xp_week int; _xp_total int; _freezes int;
    BEGIN
      _user_id := NEW.user_id;
      IF NEW.quality < 2 THEN RETURN NEW; END IF;
      PERFORM public.ensure_user_stats(_user_id);
      SELECT last_study_date, streak, xp_today, xp_week, xp_total, streak_freezes
        INTO _last_date, _streak, _xp_today, _xp_week, _xp_total, _freezes
        FROM public.user_stats WHERE user_id = _user_id;
      _diff_days := (CURRENT_DATE - _last_date);
      IF _diff_days = 0 THEN
        IF _streak = 0 THEN _streak := 1; END IF;
        _xp_today := _xp_today + 10; _xp_week := _xp_week + 10;
      ELSIF _diff_days = 1 THEN
        _streak := _streak + 1; _xp_today := 10;
        IF EXTRACT(ISODOW FROM CURRENT_DATE) = 1 THEN _xp_week := 10; ELSE _xp_week := _xp_week + 10; END IF;
      ELSIF _diff_days = 2 AND _freezes > 0 THEN
        _freezes := _freezes - 1; _streak := _streak + 1; _xp_today := 10;
        IF date_trunc('week', CURRENT_DATE) > date_trunc('week', _last_date) THEN _xp_week := 10; ELSE _xp_week := _xp_week + 10; END IF;
      ELSE
        _streak := 1; _xp_today := 10;
        IF date_trunc('week', CURRENT_DATE) > date_trunc('week', _last_date) THEN _xp_week := 10; ELSE _xp_week := _xp_week + 10; END IF;
      END IF;
      IF _streak > 0 AND _streak % 7 = 0 THEN _freezes := LEAST(_freezes + 1, 2); END IF;
      _xp_total := _xp_total + 10;
      UPDATE public.user_stats SET xp_today=_xp_today, xp_week=_xp_week, xp_total=_xp_total,
        streak=_streak, streak_freezes=_freezes, last_study_date=CURRENT_DATE, updated_at=NOW()
      WHERE user_id = _user_id;
      RETURN NEW;
    END; $fn$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='handle_new_user') THEN
    CREATE FUNCTION public.handle_new_user()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
    AS $fn$
    BEGIN
      INSERT INTO public.user_stats (user_id, username)
      VALUES (new.id, split_part(new.email, '@', 1));
      RETURN new;
    END; $fn$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='get_user_stats') THEN
    CREATE FUNCTION public.get_user_stats(p_user_id uuid)
    RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
    AS $fn$
    DECLARE
      total_words INT; due_cards INT; retention FLOAT; result JSONB;
    BEGIN
      SELECT COUNT(*) INTO total_words FROM words WHERE user_id = p_user_id;
      SELECT COUNT(*) INTO due_cards FROM cards WHERE user_id = p_user_id AND NOT suspended AND due_date <= now();
      SELECT COALESCE(
        (SELECT COUNT(*) FILTER (WHERE quality >= 3) * 100.0 / NULLIF(COUNT(*), 0)
         FROM review_log WHERE user_id = p_user_id AND date >= CURRENT_DATE - INTERVAL '30 days'), 0)
        INTO retention;
      result = jsonb_build_object('total_words', total_words, 'due_cards', due_cards,
        'retention', ROUND(retention::numeric, 1), 'streak', 0, 'total_secs', 0, 'by_cefr', '{}'::jsonb);
      RETURN result;
    END; $fn$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='get_deepseek_key') THEN
    -- Stub do baseline: em produção o corpo real lê o Vault (só service_role).
    CREATE FUNCTION public.get_deepseek_key()
    RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
    AS $fn$ SELECT NULL::text $fn$;
  END IF;
END $$;

-- ── Triggers originais ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trigger_calculate_xp') THEN
    CREATE TRIGGER trigger_calculate_xp AFTER INSERT ON public.review_log
      FOR EACH ROW EXECUTE FUNCTION public.calculate_xp_on_activity();
  END IF;
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='on_auth_user_created') THEN
      CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'sem permissão para trigger em auth.users (ok em ambientes gerenciados)';
  END;
END $$;
