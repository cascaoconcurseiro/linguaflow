-- Fix: Add missing RPC functions for web app
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  total_words INT;
  due_cards INT;
  retention FLOAT;
  result JSONB;
BEGIN
  SELECT COUNT(*) INTO total_words FROM words WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO due_cards FROM cards WHERE user_id = p_user_id AND NOT suspended AND due_date <= now();
  SELECT COALESCE(
    (SELECT COUNT(*) FILTER (WHERE quality >= 3) * 100.0 / NULLIF(COUNT(*), 0)
     FROM review_log WHERE user_id = p_user_id AND date >= CURRENT_DATE - INTERVAL '30 days'),
    0
  ) INTO retention;

  result = jsonb_build_object(
    'total_words', total_words,
    'due_cards', due_cards,
    'retention', ROUND(retention::numeric, 1),
    'streak', 0,
    'total_secs', 0,
    'by_cefr', '{}'::jsonb
  );
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
