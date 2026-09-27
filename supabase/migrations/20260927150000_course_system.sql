-- ============================================================================
-- Domínio de Cursos (prática de escuta e digitação), independente do Cofre.
-- Conteúdo (catálogo, lições, frases) é público quando publicado; progresso,
-- sessões, erros e revisões pertencem ao usuário e só mudam por RPC.
-- Tudo gratuito: não há capítulos restritos a membros.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.course_catalog (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  short_description TEXT NOT NULL,
  long_description TEXT,
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1')),
  category TEXT NOT NULL CHECK (category IN (
    'street-slang', 'survival', 'travel', 'dining', 'social', 'business', 'grammar', 'stories', 'writing'
  )),
  order_index INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES public.course_catalog(id) ON DELETE CASCADE,
  chapter_number INT NOT NULL CHECK (chapter_number > 0),
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, chapter_number)
);

-- Áudio é sintetizado sob demanda pela função `tts` a partir de `text`
-- (voz neural, com cache no cliente); não há arquivo por frase.
CREATE TABLE IF NOT EXISTS public.course_units (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  order_index INT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'sentence' CHECK (kind IN ('sentence', 'dialogue', 'slang_idiom', 'paragraph')),
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
  translation_pt TEXT NOT NULL,
  ipa TEXT,
  explanation_note TEXT,
  syntax_groups JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(syntax_groups) = 'array'),
  annotations JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(annotations) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, order_index)
);

CREATE TABLE IF NOT EXISTS public.user_course_enrollment (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES public.course_catalog(id) ON DELETE CASCADE,
  current_lesson_id TEXT REFERENCES public.course_lessons(id) ON DELETE SET NULL,
  completed_lessons TEXT[] NOT NULL DEFAULT '{}',
  percent_completed NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (percent_completed BETWEEN 0 AND 100),
  last_studied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS public.course_practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_session_id UUID NOT NULL,
  lesson_id TEXT NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  active_time_seconds INT NOT NULL CHECK (active_time_seconds >= 0),
  score INT NOT NULL CHECK (score >= 0),
  highest_combo INT NOT NULL CHECK (highest_combo >= 0),
  accuracy_rate NUMERIC(5,2) NOT NULL CHECK (accuracy_rate BETWEEN 0 AND 100),
  hints_used INT NOT NULL CHECK (hints_used >= 0),
  mistakes_count INT NOT NULL CHECK (mistakes_count >= 0),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_session_id)
);

CREATE TABLE IF NOT EXISTS public.course_user_mistakes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES public.course_units(id) ON DELETE CASCADE,
  wrong_text_submitted TEXT NOT NULL,
  mistake_count INT NOT NULL DEFAULT 1,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  last_practiced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, unit_id)
);

CREATE TABLE IF NOT EXISTS public.course_user_vocabulary (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES public.course_units(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, unit_id)
);

CREATE TABLE IF NOT EXISTS public.course_user_notes (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES public.course_units(id) ON DELETE CASCADE,
  note_content TEXT NOT NULL CHECK (length(note_content) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, unit_id)
);

CREATE TABLE IF NOT EXISTS public.course_user_reviews (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES public.course_units(id) ON DELETE CASCADE,
  repetition_number INT NOT NULL DEFAULT 0,
  interval_days INT NOT NULL DEFAULT 1,
  due_date TIMESTAMPTZ NOT NULL,
  last_reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, unit_id)
);

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.course_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_course_enrollment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_user_mistakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_user_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_user_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY course_catalog_select_published ON public.course_catalog
  FOR SELECT USING (is_published);

CREATE POLICY course_lessons_select_published ON public.course_lessons
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.course_catalog c
    WHERE c.id = course_lessons.course_id AND c.is_published
  ));

CREATE POLICY course_units_select_published ON public.course_units
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.course_lessons l
    JOIN public.course_catalog c ON c.id = l.course_id
    WHERE l.id = course_units.lesson_id AND c.is_published
  ));

-- Progresso, sessões, erros e revisões: leitura própria; escrita só pela RPC
-- autoritativa (evita sessões forjadas e progresso arbitrário).
CREATE POLICY user_course_enrollment_select_own ON public.user_course_enrollment
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY user_course_enrollment_delete_own ON public.user_course_enrollment
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY course_practice_sessions_select_own ON public.course_practice_sessions
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY course_user_mistakes_select_own ON public.course_user_mistakes
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY course_user_reviews_select_own ON public.course_user_reviews
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

-- Vocabulário e notas: o próprio aluno cria, edita e apaga.
CREATE POLICY course_user_vocabulary_manage_own ON public.course_user_vocabulary
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY course_user_notes_manage_own ON public.course_user_notes
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- Índices (inclui FKs, para CASCADE e joins)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_course_lessons_course ON public.course_lessons (course_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_course_sessions_user_time ON public.course_practice_sessions (user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_sessions_lesson ON public.course_practice_sessions (lesson_id);
CREATE INDEX IF NOT EXISTS idx_course_reviews_user_due ON public.course_user_reviews (user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_course_reviews_unit ON public.course_user_reviews (unit_id);
CREATE INDEX IF NOT EXISTS idx_course_mistakes_unresolved ON public.course_user_mistakes (user_id, last_practiced_at DESC) WHERE NOT is_resolved;
CREATE INDEX IF NOT EXISTS idx_course_mistakes_unit ON public.course_user_mistakes (unit_id);
CREATE INDEX IF NOT EXISTS idx_course_vocabulary_unit ON public.course_user_vocabulary (unit_id);
CREATE INDEX IF NOT EXISTS idx_course_notes_unit ON public.course_user_notes (unit_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollment_recent ON public.user_course_enrollment (user_id, last_studied_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_enrollment_course ON public.user_course_enrollment (course_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollment_lesson ON public.user_course_enrollment (current_lesson_id);
