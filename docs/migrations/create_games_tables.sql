-- Migration: Création des tables pour la gestion des jeux
-- Date: 2024

-- Table: game_types
-- Types de jeux disponibles (ex: quiz, memory, puzzle, etc.)
CREATE TABLE IF NOT EXISTS game_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: games
-- Instances de jeux associées aux matières
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  game_type_id UUID NOT NULL REFERENCES game_types(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  difficulty TEXT,
  duration INTEGER, -- Durée en minutes
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour améliorer les performances des requêtes par matière
CREATE INDEX IF NOT EXISTS idx_games_subject_id ON games(subject_id);
CREATE INDEX IF NOT EXISTS idx_games_game_type_id ON games(game_type_id);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_game_types_updated_at
  BEFORE UPDATE ON game_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE game_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Policies pour game_types (lecture publique, écriture pour les professeurs)
CREATE POLICY "game_types_select_policy" ON game_types
  FOR SELECT
  USING (true);

CREATE POLICY "game_types_insert_policy" ON game_types
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teachers
      WHERE teachers.profile_id = auth.uid()
    )
  );

CREATE POLICY "game_types_update_policy" ON game_types
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM teachers
      WHERE teachers.profile_id = auth.uid()
    )
  );

CREATE POLICY "game_types_delete_policy" ON game_types
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM teachers
      WHERE teachers.profile_id = auth.uid()
    )
  );

-- Policies pour games (les professeurs peuvent gérer les jeux de leurs matières)
CREATE POLICY "games_select_policy" ON games
  FOR SELECT
  USING (
    -- Les professeurs peuvent voir les jeux de leurs matières
    EXISTS (
      SELECT 1 FROM teachers
      WHERE teachers.profile_id = auth.uid()
    )
  );

CREATE POLICY "games_insert_policy" ON games
  FOR INSERT
  WITH CHECK (
    -- Les professeurs peuvent créer des jeux pour leurs matières
    EXISTS (
      SELECT 1 FROM teachers
      WHERE teachers.profile_id = auth.uid()
    )
  );

CREATE POLICY "games_update_policy" ON games
  FOR UPDATE
  USING (
    -- Les professeurs peuvent modifier les jeux de leurs matières
    EXISTS (
      SELECT 1 FROM teachers
      WHERE teachers.profile_id = auth.uid()
    )
  );

CREATE POLICY "games_delete_policy" ON games
  FOR DELETE
  USING (
    -- Les professeurs peuvent supprimer les jeux de leurs matières
    EXISTS (
      SELECT 1 FROM teachers
      WHERE teachers.profile_id = auth.uid()
    )
  );

-- Insérer quelques types de jeux par défaut
INSERT INTO game_types (name, description) VALUES
  ('quiz', 'Jeu de questions-réponses'),
  ('memory', 'Jeu de mémoire'),
  ('puzzle', 'Jeu de puzzle'),
  ('matching', 'Jeu d''association'),
  ('word-search', 'Mots croisés / recherche de mots')
ON CONFLICT (name) DO NOTHING;

