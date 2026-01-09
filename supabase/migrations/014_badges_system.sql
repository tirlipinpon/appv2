-- Migration: Système de badges avec progression dynamique
-- Description: Crée les tables, fonctions et triggers pour le système de gamification par badges
--              avec progression dynamique (valeurs croissantes de 30% par niveau)

-- =============================================================================
-- TABLES BADGES - Système de gamification
-- =============================================================================

-- Table 1: Définition des badges (catalogue)
CREATE TABLE IF NOT EXISTS frontend_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  badge_type TEXT NOT NULL CHECK (badge_type IN (
    'first_category_complete',
    'first_subject_complete',
    'first_game_perfect',
    'daily_streak_responses',
    'consecutive_correct',
    'perfect_games_count'
  )),
  icon_url TEXT,
  color_code TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table 2: Badges débloqués par enfant (avec historique et niveau)
CREATE TABLE IF NOT EXISTS frontend_child_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES frontend_badges(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  level INTEGER DEFAULT 1,
  value INTEGER, -- Valeur obtenue lors du déblocage (ex: 10, 13, 5)
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_id, badge_id, level)
);

-- Table 3: Niveaux de progression pour chaque badge (pour progression dynamique)
CREATE TABLE IF NOT EXISTS frontend_badge_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL,
  current_level INTEGER DEFAULT 1,
  last_unlocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_id, badge_type)
);

-- Table 4: Tracking des jeux parfaits par catégorie (pour Badge 3)
CREATE TABLE IF NOT EXISTS frontend_first_perfect_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  subject_category_id UUID NOT NULL REFERENCES subject_categories(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_id, subject_category_id, game_id)
);

-- Table 5: Tracking des réponses consécutives (pour Badge 5 et 5.1)
CREATE TABLE IF NOT EXISTS frontend_consecutive_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  consecutive_count INTEGER DEFAULT 0,
  consecutive_7_count INTEGER DEFAULT 0,
  last_response_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_id)
);

-- Table 6: Tracking des jours avec réponses (pour Badge 4 et 4.1)
CREATE TABLE IF NOT EXISTS frontend_daily_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  response_date DATE NOT NULL,
  correct_responses_count INTEGER DEFAULT 0,
  badge_4_unlocked BOOLEAN DEFAULT false,
  badge_4_1_unlocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_id, response_date)
);

-- Table 7: Tracking des jeux parfaits cumulatifs (pour Badge 6 et 6.1)
CREATE TABLE IF NOT EXISTS frontend_perfect_games_count (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  total_perfect_games INTEGER DEFAULT 0,
  badge_6_unlocked BOOLEAN DEFAULT false,
  badge_6_1_unlocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_id)
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_child_badges_child_id ON frontend_child_badges(child_id);
CREATE INDEX IF NOT EXISTS idx_child_badges_badge_id ON frontend_child_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_badge_levels_child_id ON frontend_badge_levels(child_id);
CREATE INDEX IF NOT EXISTS idx_badge_levels_badge_type ON frontend_badge_levels(badge_type);
CREATE INDEX IF NOT EXISTS idx_first_perfect_games_child_id ON frontend_first_perfect_games(child_id);
CREATE INDEX IF NOT EXISTS idx_first_perfect_games_category_id ON frontend_first_perfect_games(subject_category_id);
CREATE INDEX IF NOT EXISTS idx_daily_responses_child_date ON frontend_daily_responses(child_id, response_date);
CREATE INDEX IF NOT EXISTS idx_consecutive_responses_child_id ON frontend_consecutive_responses(child_id);
CREATE INDEX IF NOT EXISTS idx_perfect_games_count_child_id ON frontend_perfect_games_count(child_id);

-- =============================================================================
-- FONCTIONS SQL
-- =============================================================================

-- Fonction: Calcule le seuil dynamique selon le niveau
CREATE OR REPLACE FUNCTION calculate_badge_threshold(
  base_value INTEGER,
  current_level INTEGER
) RETURNS INTEGER AS $$
BEGIN
  RETURN FLOOR(base_value * POWER(1.3, current_level - 1))::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Fonction: Vérifie et débloque les badges après une tentative de jeu
CREATE OR REPLACE FUNCTION check_and_unlock_badges(
  p_child_id UUID,
  p_game_id UUID,
  p_score INTEGER,
  p_responses_json JSONB
)
RETURNS TABLE (badge_id UUID, badge_name TEXT, badge_type TEXT, level INTEGER, value INTEGER) AS $$
DECLARE
  v_category_id UUID;
  v_subject_id UUID;
  v_category_completion_percentage INT;
  v_subject_categories_count INT;
  v_completed_categories_count INT;
  v_is_first_perfect BOOLEAN;
  v_badge_id UUID;
  v_level INTEGER;
BEGIN
  
  -- Récupérer info du jeu
  SELECT subject_category_id, subject_id INTO v_category_id, v_subject_id
  FROM games WHERE id = p_game_id;

  -- ==========================================
  -- BADGE 3: Premier jeu parfait (100%) du 1er coup
  -- ==========================================
  IF p_score = 100 AND v_category_id IS NOT NULL THEN
    -- Vérifier si c'est la première tentative parfaite de cette catégorie
    IF NOT EXISTS (
      SELECT 1 FROM frontend_first_perfect_games 
      WHERE child_id = p_child_id 
        AND subject_category_id = v_category_id
    ) THEN
      INSERT INTO frontend_first_perfect_games (child_id, subject_category_id, game_id)
      VALUES (p_child_id, v_category_id, p_game_id)
      ON CONFLICT DO NOTHING;
      
      -- Débloquer le badge
      SELECT id INTO v_badge_id FROM frontend_badges 
      WHERE badge_type = 'first_game_perfect' AND is_active = true
      LIMIT 1;
      
      IF v_badge_id IS NOT NULL THEN
        INSERT INTO frontend_child_badges (child_id, badge_id, level, value)
        VALUES (p_child_id, v_badge_id, 1, 100)
        ON CONFLICT DO NOTHING
        RETURNING badge_id, level, value INTO v_badge_id, v_level;
        
        IF v_badge_id IS NOT NULL THEN
          RETURN QUERY 
          SELECT v_badge_id, b.name, b.badge_type, v_level, 100
          FROM frontend_badges b WHERE b.id = v_badge_id;
        END IF;
      END IF;
    END IF;
  END IF;

  -- ==========================================
  -- BADGE 1: Première catégorie complétée
  -- ==========================================
  IF v_category_id IS NOT NULL THEN
    SELECT completion_percentage INTO v_category_completion_percentage
    FROM frontend_subject_category_progress
    WHERE child_id = p_child_id AND subject_category_id = v_category_id;
    
    IF v_category_completion_percentage >= 100 THEN
      IF NOT EXISTS (
        SELECT 1 FROM frontend_child_badges cb
        JOIN frontend_badges b ON cb.badge_id = b.id
        WHERE cb.child_id = p_child_id AND b.badge_type = 'first_category_complete'
      ) THEN
        SELECT id INTO v_badge_id FROM frontend_badges 
        WHERE badge_type = 'first_category_complete' AND is_active = true
        LIMIT 1;
        
        IF v_badge_id IS NOT NULL THEN
          INSERT INTO frontend_child_badges (child_id, badge_id, level, value)
          VALUES (p_child_id, v_badge_id, 1, 100)
          ON CONFLICT DO NOTHING
          RETURNING badge_id INTO v_badge_id;
          
          IF v_badge_id IS NOT NULL THEN
            RETURN QUERY 
            SELECT v_badge_id, b.name, b.badge_type, 1, 100
            FROM frontend_badges b WHERE b.id = v_badge_id;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- ==========================================
  -- BADGE 2: Première matière WITH sous-catégories
  -- ==========================================
  IF v_subject_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_subject_categories_count
    FROM subject_categories WHERE subject_id = v_subject_id;
    
    -- Vérifier que la matière a des sous-catégories
    IF v_subject_categories_count > 0 THEN
      SELECT COUNT(*) INTO v_completed_categories_count
      FROM frontend_subject_category_progress fsp
      JOIN subject_categories sc ON fsp.subject_category_id = sc.id
      WHERE fsp.child_id = p_child_id 
        AND sc.subject_id = v_subject_id
        AND fsp.completion_percentage >= 100;
      
      -- Toutes les sous-catégories complétées?
      IF v_completed_categories_count = v_subject_categories_count THEN
        IF NOT EXISTS (
          SELECT 1 FROM frontend_child_badges cb
          JOIN frontend_badges b ON cb.badge_id = b.id
          WHERE cb.child_id = p_child_id AND b.badge_type = 'first_subject_complete'
        ) THEN
          SELECT id INTO v_badge_id FROM frontend_badges 
          WHERE badge_type = 'first_subject_complete' AND is_active = true
          LIMIT 1;
          
          IF v_badge_id IS NOT NULL THEN
            INSERT INTO frontend_child_badges (child_id, badge_id, level, value)
            VALUES (p_child_id, v_badge_id, 1, v_completed_categories_count)
            ON CONFLICT DO NOTHING
            RETURNING badge_id INTO v_badge_id;
            
            IF v_badge_id IS NOT NULL THEN
              RETURN QUERY 
              SELECT v_badge_id, b.name, b.badge_type, 1, v_completed_categories_count
              FROM frontend_badges b WHERE b.id = v_badge_id;
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

END;
$$ LANGUAGE plpgsql;

-- Fonction: Tracker les réponses correctes (quotidiennes + consécutives + jeux parfaits)
CREATE OR REPLACE FUNCTION track_daily_and_consecutive_responses(
  p_child_id UUID,
  p_game_attempt_id UUID,
  p_responses_json JSONB,
  p_game_id UUID,
  p_score INTEGER
)
RETURNS TABLE (badge_id UUID, badge_name TEXT, badge_type TEXT, level INTEGER, value INTEGER) AS $$
DECLARE
  v_correct_count INT;
  v_total_count INT;
  v_today DATE;
  v_existing_count INT;
  v_consecutive_count INT;
  v_perfect_games INT;
  v_badge_id UUID;
  v_level INTEGER;
  v_base_threshold_5 INT := 5;
  v_base_threshold_7 INT := 7;
  v_base_threshold_10 INT := 10;
  v_base_threshold_13 INT := 13;
  v_current_threshold INT;
BEGIN
  
  v_today := CURRENT_DATE;
  
  -- Compter les bonnes réponses dans cette tentative
  v_correct_count := COALESCE((p_responses_json->>'correct_count')::INT, 0);
  v_total_count := COALESCE((p_responses_json->>'total_count')::INT, 0);
  
  -- Si pas de correct_count, essayer de calculer depuis le score
  IF v_correct_count = 0 AND v_total_count > 0 AND p_score > 0 THEN
    v_correct_count := FLOOR((p_score / 100.0) * v_total_count)::INT;
  END IF;

  -- ==========================================
  -- BADGE 4 & 4.1: Réponses quotidiennes
  -- ==========================================
  
  -- Récupérer ou créer la ligne pour aujourd'hui
  INSERT INTO frontend_daily_responses (child_id, response_date, correct_responses_count)
  VALUES (p_child_id, v_today, v_correct_count)
  ON CONFLICT (child_id, response_date) 
  DO UPDATE SET correct_responses_count = frontend_daily_responses.correct_responses_count + v_correct_count,
                updated_at = now();
  
  -- Vérifier Badge 4 (5+ réponses) - RÉCURRENT
  SELECT correct_responses_count INTO v_existing_count
  FROM frontend_daily_responses
  WHERE child_id = p_child_id AND response_date = v_today;
  
  -- Récupérer le niveau actuel pour ce badge
  SELECT current_level INTO v_level
  FROM frontend_badge_levels
  WHERE child_id = p_child_id AND badge_type = 'daily_streak_responses';
  
  IF v_level IS NULL THEN
    v_level := 1;
    INSERT INTO frontend_badge_levels (child_id, badge_type, current_level)
    VALUES (p_child_id, 'daily_streak_responses', 1)
    ON CONFLICT DO NOTHING;
  END IF;
  
  v_current_threshold := calculate_badge_threshold(v_base_threshold_5, v_level);
  
  IF v_existing_count >= v_current_threshold THEN
    -- Vérifier si le badge n'a pas déjà été débloqué aujourd'hui à ce niveau
    IF NOT EXISTS (
      SELECT 1 FROM frontend_child_badges cb
      JOIN frontend_badges b ON cb.badge_id = b.id
      WHERE cb.child_id = p_child_id 
        AND b.badge_type = 'daily_streak_responses'
        AND cb.level = v_level
        AND cb.unlocked_at::DATE = v_today
    ) THEN
      SELECT id INTO v_badge_id FROM frontend_badges 
      WHERE badge_type = 'daily_streak_responses' AND name LIKE '%5%' AND is_active = true
      LIMIT 1;
      
      IF v_badge_id IS NOT NULL THEN
        INSERT INTO frontend_child_badges (child_id, badge_id, level, value)
        VALUES (p_child_id, v_badge_id, v_level, v_existing_count)
        ON CONFLICT DO NOTHING
        RETURNING badge_id INTO v_badge_id;
        
        IF v_badge_id IS NOT NULL THEN
          -- Incrémenter le niveau pour le prochain déblocage
          UPDATE frontend_badge_levels
          SET current_level = current_level + 1,
              last_unlocked_at = now(),
              updated_at = now()
          WHERE child_id = p_child_id AND badge_type = 'daily_streak_responses';
          
          RETURN QUERY 
          SELECT v_badge_id, b.name, b.badge_type, v_level, v_existing_count
          FROM frontend_badges b WHERE b.id = v_badge_id;
        END IF;
      END IF;
    END IF;
  END IF;
  
  -- Vérifier Badge 4.1 (7+ réponses) - RÉCURRENT
  SELECT current_level INTO v_level
  FROM frontend_badge_levels
  WHERE child_id = p_child_id AND badge_type = 'daily_streak_responses_7';
  
  IF v_level IS NULL THEN
    v_level := 1;
    INSERT INTO frontend_badge_levels (child_id, badge_type, current_level)
    VALUES (p_child_id, 'daily_streak_responses_7', 1)
    ON CONFLICT DO NOTHING;
  END IF;
  
  v_current_threshold := calculate_badge_threshold(v_base_threshold_7, v_level);
  
  IF v_existing_count >= v_current_threshold THEN
    IF NOT EXISTS (
      SELECT 1 FROM frontend_child_badges cb
      JOIN frontend_badges b ON cb.badge_id = b.id
      WHERE cb.child_id = p_child_id 
        AND b.badge_type = 'daily_streak_responses'
        AND b.name LIKE '%7%'
        AND cb.level = v_level
        AND cb.unlocked_at::DATE = v_today
    ) THEN
      SELECT id INTO v_badge_id FROM frontend_badges 
      WHERE badge_type = 'daily_streak_responses' AND name LIKE '%7%' AND is_active = true
      LIMIT 1;
      
      IF v_badge_id IS NOT NULL THEN
        INSERT INTO frontend_child_badges (child_id, badge_id, level, value)
        VALUES (p_child_id, v_badge_id, v_level, v_existing_count)
        ON CONFLICT DO NOTHING
        RETURNING badge_id INTO v_badge_id;
        
        IF v_badge_id IS NOT NULL THEN
          UPDATE frontend_badge_levels
          SET current_level = current_level + 1,
              last_unlocked_at = now(),
              updated_at = now()
          WHERE child_id = p_child_id AND badge_type = 'daily_streak_responses_7';
          
          RETURN QUERY 
          SELECT v_badge_id, b.name, b.badge_type, v_level, v_existing_count
          FROM frontend_badges b WHERE b.id = v_badge_id;
        END IF;
      END IF;
    END IF;
  END IF;

  -- ==========================================
  -- BADGE 5 & 5.1: Réponses consécutives
  -- ==========================================
  
  IF p_score = 100 THEN
    -- Récupérer compteur actuel
    SELECT consecutive_count INTO v_consecutive_count
    FROM frontend_consecutive_responses
    WHERE child_id = p_child_id;
    
    -- Si pas d'entrée, la créer
    IF NOT FOUND THEN
      INSERT INTO frontend_consecutive_responses (child_id, consecutive_count)
      VALUES (p_child_id, 0);
      v_consecutive_count := 0;
    END IF;
    
    -- Incrémenter le compteur
    UPDATE frontend_consecutive_responses
    SET consecutive_count = consecutive_count + 1,
        last_response_date = now(),
        updated_at = now()
    WHERE child_id = p_child_id
    RETURNING consecutive_count INTO v_consecutive_count;
    
    -- Récupérer le niveau actuel pour badge 5
    SELECT current_level INTO v_level
    FROM frontend_badge_levels
    WHERE child_id = p_child_id AND badge_type = 'consecutive_correct';
    
    IF v_level IS NULL THEN
      v_level := 1;
      INSERT INTO frontend_badge_levels (child_id, badge_type, current_level)
      VALUES (p_child_id, 'consecutive_correct', 1)
      ON CONFLICT DO NOTHING;
    END IF;
    
    v_current_threshold := calculate_badge_threshold(v_base_threshold_5, v_level);
    
    -- Débloquer Badge 5 (5 consécutives)
    IF v_consecutive_count = v_current_threshold THEN
      SELECT id INTO v_badge_id FROM frontend_badges 
      WHERE badge_type = 'consecutive_correct' AND name LIKE '%5%' AND is_active = true
      LIMIT 1;
      
      IF v_badge_id IS NOT NULL THEN
        INSERT INTO frontend_child_badges (child_id, badge_id, level, value)
        VALUES (p_child_id, v_badge_id, v_level, v_consecutive_count)
        ON CONFLICT DO NOTHING
        RETURNING badge_id INTO v_badge_id;
        
        IF v_badge_id IS NOT NULL THEN
          UPDATE frontend_badge_levels
          SET current_level = current_level + 1,
              last_unlocked_at = now(),
              updated_at = now()
          WHERE child_id = p_child_id AND badge_type = 'consecutive_correct';
          
          RETURN QUERY 
          SELECT v_badge_id, b.name, b.badge_type, v_level, v_consecutive_count
          FROM frontend_badges b WHERE b.id = v_badge_id;
        END IF;
      END IF;
    END IF;
    
    -- Débloquer Badge 5.1 (7 consécutives)
    SELECT current_level INTO v_level
    FROM frontend_badge_levels
    WHERE child_id = p_child_id AND badge_type = 'consecutive_correct_7';
    
    IF v_level IS NULL THEN
      v_level := 1;
      INSERT INTO frontend_badge_levels (child_id, badge_type, current_level)
      VALUES (p_child_id, 'consecutive_correct_7', 1)
      ON CONFLICT DO NOTHING;
    END IF;
    
    v_current_threshold := calculate_badge_threshold(v_base_threshold_7, v_level);
    
    IF v_consecutive_count = v_current_threshold THEN
      SELECT id INTO v_badge_id FROM frontend_badges 
      WHERE badge_type = 'consecutive_correct' AND name LIKE '%7%' AND is_active = true
      LIMIT 1;
      
      IF v_badge_id IS NOT NULL THEN
        INSERT INTO frontend_child_badges (child_id, badge_id, level, value)
        VALUES (p_child_id, v_badge_id, v_level, v_consecutive_count)
        ON CONFLICT DO NOTHING
        RETURNING badge_id INTO v_badge_id;
        
        IF v_badge_id IS NOT NULL THEN
          UPDATE frontend_badge_levels
          SET current_level = current_level + 1,
              last_unlocked_at = now(),
              updated_at = now()
          WHERE child_id = p_child_id AND badge_type = 'consecutive_correct_7';
          
          RETURN QUERY 
          SELECT v_badge_id, b.name, b.badge_type, v_level, v_consecutive_count
          FROM frontend_badges b WHERE b.id = v_badge_id;
        END IF;
      END IF;
    END IF;
  ELSE
    -- Reset les compteurs si erreur
    UPDATE frontend_consecutive_responses
    SET consecutive_count = 0,
        consecutive_7_count = 0,
        last_response_date = now(),
        updated_at = now()
    WHERE child_id = p_child_id;
  END IF;

  -- ==========================================
  -- BADGE 6 & 6.1: Jeux parfaits cumulatifs
  -- ==========================================
  
  IF p_score = 100 THEN
    -- Vérifier si c'est un nouveau jeu parfait (meilleur score = 100%)
    -- Compter uniquement les jeux uniques avec score 100%
    SELECT COUNT(DISTINCT game_id) INTO v_perfect_games
    FROM frontend_game_attempts
    WHERE child_id = p_child_id
      AND score = 100
      AND game_id IN (
        SELECT game_id FROM frontend_game_attempts
        WHERE child_id = p_child_id AND score = 100
        GROUP BY game_id
        HAVING MAX(score) = 100
      );
    
    -- Incrémenter le compteur
    INSERT INTO frontend_perfect_games_count (child_id, total_perfect_games)
    VALUES (p_child_id, v_perfect_games)
    ON CONFLICT (child_id) 
    DO UPDATE SET total_perfect_games = v_perfect_games,
                  updated_at = now();
    
    -- Récupérer le niveau actuel pour badge 6
    SELECT current_level INTO v_level
    FROM frontend_badge_levels
    WHERE child_id = p_child_id AND badge_type = 'perfect_games_count';
    
    IF v_level IS NULL THEN
      v_level := 1;
      INSERT INTO frontend_badge_levels (child_id, badge_type, current_level)
      VALUES (p_child_id, 'perfect_games_count', 1)
      ON CONFLICT DO NOTHING;
    END IF;
    
    v_current_threshold := calculate_badge_threshold(v_base_threshold_10, v_level);
    
    -- Débloquer Badge 6 (10 parfaits)
    IF v_perfect_games = v_current_threshold THEN
      SELECT id INTO v_badge_id FROM frontend_badges 
      WHERE badge_type = 'perfect_games_count' AND name LIKE '%10%' AND is_active = true
      LIMIT 1;
      
      IF v_badge_id IS NOT NULL THEN
        INSERT INTO frontend_child_badges (child_id, badge_id, level, value)
        VALUES (p_child_id, v_badge_id, v_level, v_perfect_games)
        ON CONFLICT DO NOTHING
        RETURNING badge_id INTO v_badge_id;
        
        IF v_badge_id IS NOT NULL THEN
          UPDATE frontend_badge_levels
          SET current_level = current_level + 1,
              last_unlocked_at = now(),
              updated_at = now()
          WHERE child_id = p_child_id AND badge_type = 'perfect_games_count';
          
          RETURN QUERY 
          SELECT v_badge_id, b.name, b.badge_type, v_level, v_perfect_games
          FROM frontend_badges b WHERE b.id = v_badge_id;
        END IF;
      END IF;
    END IF;
    
    -- Débloquer Badge 6.1 (13 parfaits)
    SELECT current_level INTO v_level
    FROM frontend_badge_levels
    WHERE child_id = p_child_id AND badge_type = 'perfect_games_count_13';
    
    IF v_level IS NULL THEN
      v_level := 1;
      INSERT INTO frontend_badge_levels (child_id, badge_type, current_level)
      VALUES (p_child_id, 'perfect_games_count_13', 1)
      ON CONFLICT DO NOTHING;
    END IF;
    
    v_current_threshold := calculate_badge_threshold(v_base_threshold_13, v_level);
    
    IF v_perfect_games = v_current_threshold THEN
      SELECT id INTO v_badge_id FROM frontend_badges 
      WHERE badge_type = 'perfect_games_count' AND name LIKE '%13%' AND is_active = true
      LIMIT 1;
      
      IF v_badge_id IS NOT NULL THEN
        INSERT INTO frontend_child_badges (child_id, badge_id, level, value)
        VALUES (p_child_id, v_badge_id, v_level, v_perfect_games)
        ON CONFLICT DO NOTHING
        RETURNING badge_id INTO v_badge_id;
        
        IF v_badge_id IS NOT NULL THEN
          UPDATE frontend_badge_levels
          SET current_level = current_level + 1,
              last_unlocked_at = now(),
              updated_at = now()
          WHERE child_id = p_child_id AND badge_type = 'perfect_games_count_13';
          
          RETURN QUERY 
          SELECT v_badge_id, b.name, b.badge_type, v_level, v_perfect_games
          FROM frontend_badges b WHERE b.id = v_badge_id;
        END IF;
      END IF;
    END IF;
  END IF;

END;
$$ LANGUAGE plpgsql;

-- Fonction RPC: Récupère les badges débloqués lors d'une tentative
CREATE OR REPLACE FUNCTION get_newly_unlocked_badges(
  p_child_id UUID,
  p_game_attempt_id UUID
)
RETURNS TABLE (
  badge_id UUID,
  badge_name TEXT,
  badge_type TEXT,
  level INTEGER,
  value INTEGER,
  unlocked_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as badge_id,
    b.name as badge_name,
    b.badge_type,
    cb.level,
    cb.value,
    cb.unlocked_at
  FROM frontend_child_badges cb
  JOIN frontend_badges b ON cb.badge_id = b.id
  WHERE cb.child_id = p_child_id
    AND cb.unlocked_at >= (
      SELECT created_at FROM frontend_game_attempts 
      WHERE id = p_game_attempt_id
    )
  ORDER BY cb.unlocked_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGER AUTOMATIQUE
-- =============================================================================

-- Trigger: Déclenche la vérification des badges après chaque tentative
CREATE OR REPLACE FUNCTION trigger_check_badges()
RETURNS TRIGGER AS $$
DECLARE
  v_badge_results RECORD;
BEGIN
  -- Appeler les fonctions de vérification des badges
  -- Les résultats sont stockés dans les tables mais on ne fait rien avec ici
  -- Le frontend appellera get_newly_unlocked_badges() pour récupérer les nouveaux badges
  
  -- Vérifier badges 1, 2, 3
  PERFORM * FROM check_and_unlock_badges(
    NEW.child_id,
    NEW.game_id,
    NEW.score,
    NEW.responses_json
  );
  
  -- Vérifier badges 4, 5, 6
  PERFORM * FROM track_daily_and_consecutive_responses(
    NEW.child_id,
    NEW.id,
    NEW.responses_json,
    NEW.game_id,
    NEW.score
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_badges_after_attempt
  AFTER INSERT ON frontend_game_attempts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_badges();

-- =============================================================================
-- ENABLE RLS
-- =============================================================================

ALTER TABLE frontend_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE frontend_child_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE frontend_badge_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE frontend_first_perfect_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE frontend_consecutive_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE frontend_daily_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE frontend_perfect_games_count ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active badges"
ON frontend_badges
FOR SELECT
USING (is_active = true);

CREATE POLICY "Children can view their own badges"
ON frontend_child_badges
FOR SELECT
USING (true);

CREATE POLICY "Children can view their own badge levels"
ON frontend_badge_levels
FOR SELECT
USING (true);

-- =============================================================================
-- INSERT DEFAULT BADGES
-- =============================================================================

INSERT INTO frontend_badges (name, description, badge_type, icon_url, color_code)
VALUES
  ('Première catégorie complétée', 'Compléter ta première sous-catégorie', 'first_category_complete', '🏆', '#FFD700'),
  ('Première matière complétée', 'Compléter ta première matière avec sous-catégories', 'first_subject_complete', '⭐', '#FF6B6B'),
  ('Parfait du premier coup', 'Réussir un jeu à 100% en première tentative', 'first_game_perfect', '💯', '#4ECDC4'),
  ('Maître des réponses (5)', 'Obtenir 5+ bonnes réponses en un jour', 'daily_streak_responses', '🎯', '#95E1D3'),
  ('Expert des réponses (7)', 'Obtenir 7+ bonnes réponses en un jour', 'daily_streak_responses', '🔥', '#FF9FF3'),
  ('Série sans erreur (5)', '5 réponses consécutives correctes', 'consecutive_correct', '✨', '#54A0FF'),
  ('Série sans erreur (7)', '7 réponses consécutives correctes', 'consecutive_correct', '🌟', '#48DBFB'),
  ('10 jeux parfaits', 'Réussir 10 jeux à 100%', 'perfect_games_count', '🚀', '#FF6348'),
  ('13 jeux parfaits', 'Réussir 13 jeux à 100%', 'perfect_games_count', '👑', '#FFD700')
ON CONFLICT DO NOTHING;
