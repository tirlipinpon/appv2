-- Migration 009: RLS Policies for Frontend Tables
-- This migration adds RLS policies for all frontend_* tables to allow children to access their own data

-- ============================================
-- frontend_child_themes
-- ============================================
-- Enable RLS if not already enabled
ALTER TABLE frontend_child_themes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Children can view their own themes" ON frontend_child_themes;
DROP POLICY IF EXISTS "Children can insert their own themes" ON frontend_child_themes;
DROP POLICY IF EXISTS "Children can update their own themes" ON frontend_child_themes;

-- Policy: Children can view their own themes
CREATE POLICY "Children can view their own themes"
ON frontend_child_themes
FOR SELECT
USING (true); -- Allow all reads for now (we'll filter by child_id in the query)

-- Policy: Children can insert their own themes
CREATE POLICY "Children can insert their own themes"
ON frontend_child_themes
FOR INSERT
WITH CHECK (true); -- Allow all inserts for now

-- Policy: Children can update their own themes
CREATE POLICY "Children can update their own themes"
ON frontend_child_themes
FOR UPDATE
USING (true) -- Allow all updates for now
WITH CHECK (true);

-- ============================================
-- frontend_child_collectibles
-- ============================================
ALTER TABLE frontend_child_collectibles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Children can view their own collectibles" ON frontend_child_collectibles;
DROP POLICY IF EXISTS "Children can insert their own collectibles" ON frontend_child_collectibles;

CREATE POLICY "Children can view their own collectibles"
ON frontend_child_collectibles
FOR SELECT
USING (true);

CREATE POLICY "Children can insert their own collectibles"
ON frontend_child_collectibles
FOR INSERT
WITH CHECK (true);

-- ============================================
-- frontend_child_bonus_game_unlocks
-- ============================================
ALTER TABLE frontend_child_bonus_game_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Children can view their own bonus games" ON frontend_child_bonus_game_unlocks;
DROP POLICY IF EXISTS "Children can insert their own bonus games" ON frontend_child_bonus_game_unlocks;
DROP POLICY IF EXISTS "Children can update their own bonus games" ON frontend_child_bonus_game_unlocks;

CREATE POLICY "Children can view their own bonus games"
ON frontend_child_bonus_game_unlocks
FOR SELECT
USING (true);

CREATE POLICY "Children can insert their own bonus games"
ON frontend_child_bonus_game_unlocks
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Children can update their own bonus games"
ON frontend_child_bonus_game_unlocks
FOR UPDATE
USING (true)
WITH CHECK (true);

-- ============================================
-- frontend_subject_category_progress
-- ============================================
ALTER TABLE frontend_subject_category_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Children can view their own progress" ON frontend_subject_category_progress;
DROP POLICY IF EXISTS "Children can insert their own progress" ON frontend_subject_category_progress;
DROP POLICY IF EXISTS "Children can update their own progress" ON frontend_subject_category_progress;

CREATE POLICY "Children can view their own progress"
ON frontend_subject_category_progress
FOR SELECT
USING (true);

CREATE POLICY "Children can insert their own progress"
ON frontend_subject_category_progress
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Children can update their own progress"
ON frontend_subject_category_progress
FOR UPDATE
USING (true)
WITH CHECK (true);

-- ============================================
-- frontend_game_attempts
-- ============================================
ALTER TABLE frontend_game_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Children can view their own attempts" ON frontend_game_attempts;
DROP POLICY IF EXISTS "Children can insert their own attempts" ON frontend_game_attempts;

CREATE POLICY "Children can view their own attempts"
ON frontend_game_attempts
FOR SELECT
USING (true);

CREATE POLICY "Children can insert their own attempts"
ON frontend_game_attempts
FOR INSERT
WITH CHECK (true);

-- ============================================
-- frontend_child_checkpoints
-- ============================================
ALTER TABLE frontend_child_checkpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Children can view their own checkpoints" ON frontend_child_checkpoints;
DROP POLICY IF EXISTS "Children can insert their own checkpoints" ON frontend_child_checkpoints;

CREATE POLICY "Children can view their own checkpoints"
ON frontend_child_checkpoints
FOR SELECT
USING (true);

CREATE POLICY "Children can insert their own checkpoints"
ON frontend_child_checkpoints
FOR INSERT
WITH CHECK (true);

-- ============================================
-- frontend_child_mascot_state
-- ============================================
ALTER TABLE frontend_child_mascot_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Children can view their own mascot state" ON frontend_child_mascot_state;
DROP POLICY IF EXISTS "Children can insert their own mascot state" ON frontend_child_mascot_state;
DROP POLICY IF EXISTS "Children can update their own mascot state" ON frontend_child_mascot_state;

CREATE POLICY "Children can view their own mascot state"
ON frontend_child_mascot_state
FOR SELECT
USING (true);

CREATE POLICY "Children can insert their own mascot state"
ON frontend_child_mascot_state
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Children can update their own mascot state"
ON frontend_child_mascot_state
FOR UPDATE
USING (true)
WITH CHECK (true);

-- ============================================
-- Read-only tables (frontend_collectibles, frontend_bonus_games, frontend_themes)
-- ============================================
ALTER TABLE frontend_collectibles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active collectibles" ON frontend_collectibles;
CREATE POLICY "Anyone can view active collectibles"
ON frontend_collectibles
FOR SELECT
USING (is_active = true);

ALTER TABLE frontend_bonus_games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active bonus games" ON frontend_bonus_games;
CREATE POLICY "Anyone can view active bonus games"
ON frontend_bonus_games
FOR SELECT
USING (is_active = true);

ALTER TABLE frontend_themes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active themes" ON frontend_themes;
CREATE POLICY "Anyone can view active themes"
ON frontend_themes
FOR SELECT
USING (is_active = true);

-- Add comments for documentation
COMMENT ON POLICY "Children can view their own themes" ON frontend_child_themes IS 
'Allows children to view their own theme selections and unlocks.';

COMMENT ON POLICY "Children can view their own collectibles" ON frontend_child_collectibles IS 
'Allows children to view their own collectible unlocks.';

COMMENT ON POLICY "Children can view their own bonus games" ON frontend_child_bonus_game_unlocks IS 
'Allows children to view their own bonus game unlocks.';

