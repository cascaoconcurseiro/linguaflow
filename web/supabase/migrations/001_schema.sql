-- LinguaFlow Web — Supabase Schema
-- Migration 001: Core tables for SRS flashcard system

-- gen_random_uuid() is built-in on Postgres 13+

-- ============================================================================
-- DECKS
-- ============================================================================
CREATE TABLE decks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Padrão',
  icon        TEXT DEFAULT '📚',
  url         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_decks_user ON decks(user_id);

-- ============================================================================
-- WORDS (notes)
-- ============================================================================
CREATE TABLE words (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_id           UUID REFERENCES decks(id) ON DELETE SET NULL,
  word              TEXT NOT NULL,
  lang              TEXT NOT NULL DEFAULT 'en',
  translation       TEXT,
  context_sentence  TEXT,
  phonetic          TEXT,
  pronunciation_pt  TEXT,
  explanation       TEXT,
  level             TEXT,        -- CEFR: A1, A2, B1, B2, C1, C2
  tags              TEXT[],
  chunks            JSONB,
  video_url         TEXT,
  video_title       TEXT,
  platform          TEXT,
  added_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, word, lang)
);

CREATE INDEX idx_words_user ON words(user_id);
CREATE INDEX idx_words_deck ON words(deck_id);
CREATE INDEX idx_words_added ON words(added_at DESC);
CREATE INDEX idx_words_level ON words(level);

-- ============================================================================
-- CARDS (SRS state)
-- ============================================================================
CREATE TABLE cards (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id             UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'new',  -- new, learning, review, mature
  interval            DOUBLE PRECISION NOT NULL DEFAULT 0,
  ease_factor         DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  step_index          INTEGER NOT NULL DEFAULT 0,
  reps                INTEGER NOT NULL DEFAULT 0,
  lapses              INTEGER NOT NULL DEFAULT 0,
  difficulty          DOUBLE PRECISION,
  stability           DOUBLE PRECISION,
  pre_lapse_interval  DOUBLE PRECISION DEFAULT 0,
  due_date            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_review         TIMESTAMPTZ,
  suspended           BOOLEAN NOT NULL DEFAULT false,
  is_leech            BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, word_id)
);

CREATE INDEX idx_cards_user ON cards(user_id);
CREATE INDEX idx_cards_due ON cards(user_id, due_date) WHERE NOT suspended;
CREATE INDEX idx_cards_status ON cards(user_id, status);

-- ============================================================================
-- REVIEW LOG
-- ============================================================================
CREATE TABLE review_log (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id   UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  quality   SMALLINT NOT NULL CHECK (quality BETWEEN 1 AND 4),
  date      DATE NOT NULL DEFAULT CURRENT_DATE,
  ts        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_log_user ON review_log(user_id);
CREATE INDEX idx_review_log_date ON review_log(user_id, date);
CREATE INDEX idx_review_log_card ON review_log(card_id);

-- ============================================================================
-- SENTENCES (saved phrases)
-- ============================================================================
CREATE TABLE sentences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original      TEXT NOT NULL,
  translation   TEXT,
  analysis      TEXT,
  platform      TEXT,
  video_url     TEXT,
  video_title   TEXT,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sentences_user ON sentences(user_id);

-- ============================================================================
-- SESSIONS (immersion tracking)
-- ============================================================================
CREATE TABLE sessions (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date      DATE NOT NULL DEFAULT CURRENT_DATE,
  seconds   INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);

CREATE INDEX idx_sessions_user ON sessions(user_id);

-- ============================================================================
-- SETTINGS (key-value per user)
-- ============================================================================
CREATE TABLE settings (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key       TEXT NOT NULL,
  value     TEXT,
  UNIQUE(user_id, key)
);

CREATE INDEX idx_settings_user ON settings(user_id);

-- ============================================================================
-- KNOWN WORDS (quick mark-as-known)
-- ============================================================================
CREATE TABLE known_words (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word    TEXT NOT NULL,
  lang    TEXT NOT NULL DEFAULT 'en',
  UNIQUE(user_id, word, lang)
);

CREATE INDEX idx_known_words_user ON known_words(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE words ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE known_words ENABLE ROW LEVEL SECURITY;

-- Policy: user can only see their own data
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['decks','words','cards','review_log','sentences','sessions','settings','known_words']
  LOOP
    EXECUTE format('
      CREATE POLICY "Users see own data" ON %I
        FOR ALL USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    ', tbl);
  END LOOP;
END $$;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get due cards for a user (with word data)
CREATE OR REPLACE FUNCTION get_due_cards(p_user_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  card_id UUID, word_id UUID, status TEXT, "interval" DOUBLE PRECISION,
  ease_factor DOUBLE PRECISION, step_index INTEGER, reps INTEGER,
  lapses INTEGER, difficulty DOUBLE PRECISION, stability DOUBLE PRECISION,
  pre_lapse_interval DOUBLE PRECISION, due_date TIMESTAMPTZ,
  last_review TIMESTAMPTZ, suspended BOOLEAN, is_leech BOOLEAN,
  word_word TEXT, word_translation TEXT, word_context TEXT,
  word_phonetic TEXT, word_pronunciation_pt TEXT, word_level TEXT,
  word_tags TEXT[], word_chunks JSONB, word_deck_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id, c.word_id, c.status, c.interval, c.ease_factor,
    c.step_index, c.reps, c.lapses, c.difficulty, c.stability,
    c.pre_lapse_interval, c.due_date, c.last_review,
    c.suspended, c.is_leech,
    w.word, w.translation, w.context_sentence,
    w.phonetic, w.pronunciation_pt, w.level,
    w.tags, w.chunks, w.deck_id
  FROM cards c
  JOIN words w ON w.id = c.word_id
  WHERE c.user_id = p_user_id
    AND c.due_date <= now()
    AND NOT c.suspended
  ORDER BY
    CASE c.status
      WHEN 'learning' THEN 0
      WHEN 'new' THEN 1
      WHEN 'review' THEN 2
      WHEN 'mature' THEN 3
    END
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user stats
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  total_words    INTEGER;
  due_count      INTEGER;
  mature_count   INTEGER;
  learning_count INTEGER;
  review_count   INTEGER;
  new_count      INTEGER;
  total_secs     INTEGER;
  streak_days    INTEGER;
  retention      DOUBLE PRECISION;
  by_cefr        JSONB;
BEGIN
  SELECT COUNT(*) INTO total_words FROM words WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO due_count FROM cards WHERE user_id = p_user_id AND due_date <= now() AND NOT suspended;
  SELECT COUNT(*) INTO mature_count FROM cards WHERE user_id = p_user_id AND status = 'mature';
  SELECT COUNT(*) INTO learning_count FROM cards WHERE user_id = p_user_id AND status = 'learning';
  SELECT COUNT(*) INTO review_count FROM cards WHERE user_id = p_user_id AND status = 'review';
  SELECT COUNT(*) INTO new_count FROM cards WHERE user_id = p_user_id AND status = 'new';
  SELECT COALESCE(SUM(seconds), 0) INTO total_secs FROM sessions WHERE user_id = p_user_id;

  -- Retention (last 30 days)
  SELECT CASE WHEN COUNT(*) > 0
    THEN ROUND(100.0 * COUNT(*) FILTER (WHERE quality >= 3) / COUNT(*))
    ELSE 0 END
  INTO retention
  FROM review_log
  WHERE user_id = p_user_id AND ts > now() - INTERVAL '30 days';

  -- CEFR distribution
  SELECT jsonb_object_agg(COALESCE(level, 'unknown'), cnt)
  INTO by_cefr
  FROM (SELECT level, COUNT(*) as cnt FROM words WHERE user_id = p_user_id GROUP BY level) sub;

  RETURN jsonb_build_object(
    'total_words', total_words,
    'due_cards', due_count,
    'mature_count', mature_count,
    'learning_count', learning_count,
    'review_count', review_count,
    'new_count', new_count,
    'total_secs', total_secs,
    'retention', retention,
    'by_cefr', COALESCE(by_cefr, '{}'::JSONB)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create default deck for new users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO decks (user_id, name, icon) VALUES (NEW.id, 'Padrão', '📚');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
