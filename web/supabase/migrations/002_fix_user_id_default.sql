-- Fix: Add DEFAULT auth.uid() to all user_id columns
-- This allows the REST API to auto-fill user_id from the JWT token
ALTER TABLE words ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE cards ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE review_log ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE sentences ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE sessions ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE settings ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE decks ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE known_words ALTER COLUMN user_id SET DEFAULT auth.uid();
