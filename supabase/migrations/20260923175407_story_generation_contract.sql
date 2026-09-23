-- Issue #122: persist the learner's requested story mission separately from
-- the level later measured from the generated text. Existing owner-only RLS
-- policies remain authoritative; this migration only extends the row shape.
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS requested_level text,
  ADD COLUMN IF NOT EXISTS target_minutes smallint,
  ADD COLUMN IF NOT EXISTS learning_goal text,
  ADD COLUMN IF NOT EXISTS difficulty_mode text,
  ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'not_measured',
  ADD COLUMN IF NOT EXISTS prompt_version text NOT NULL DEFAULT 'story-v2';

ALTER TABLE public.stories
  DROP CONSTRAINT IF EXISTS stories_requested_level_check,
  ADD CONSTRAINT stories_requested_level_check
    CHECK (requested_level IS NULL OR requested_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  DROP CONSTRAINT IF EXISTS stories_target_minutes_check,
  ADD CONSTRAINT stories_target_minutes_check
    CHECK (target_minutes IS NULL OR target_minutes IN (3, 5, 10)),
  DROP CONSTRAINT IF EXISTS stories_learning_goal_check,
  ADD CONSTRAINT stories_learning_goal_check
    CHECK (learning_goal IS NULL OR learning_goal IN ('comfortable', 'vocabulary', 'challenge')),
  DROP CONSTRAINT IF EXISTS stories_difficulty_mode_check,
  ADD CONSTRAINT stories_difficulty_mode_check
    CHECK (difficulty_mode IS NULL OR difficulty_mode IN ('easier', 'current', 'challenge')),
  DROP CONSTRAINT IF EXISTS stories_validation_status_check,
  ADD CONSTRAINT stories_validation_status_check
    CHECK (validation_status IN ('not_measured', 'matched', 'mismatch', 'insufficient_data'));

COMMENT ON COLUMN public.stories.requested_level IS
  'CEFR level explicitly requested or resolved from the learner setting at generation time.';
COMMENT ON COLUMN public.stories.measured_level IS
  'Deterministic lexical estimate; not a certification of learner proficiency.';
COMMENT ON COLUMN public.stories.validation_status IS
  'Comparison between requested_level and measured_level under the current internal validator.';
