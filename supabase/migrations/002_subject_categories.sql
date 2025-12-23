-- Migration: Ajout des sous-catégories de matières
-- Date: 2024

-- 1. Créer la table subject_categories
CREATE TABLE IF NOT EXISTS subject_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, name)
);

-- 2. Modifier la table games pour supporter les sous-catégories
-- D'abord, rendre subject_id nullable
ALTER TABLE games 
  ALTER COLUMN subject_id DROP NOT NULL;

-- Ajouter la colonne subject_category_id
ALTER TABLE games 
  ADD COLUMN IF NOT EXISTS subject_category_id UUID REFERENCES subject_categories(id) ON DELETE SET NULL;

-- Ajouter une contrainte pour s'assurer qu'un jeu a soit subject_id soit subject_category_id
ALTER TABLE games
  ADD CONSTRAINT games_subject_or_category_check 
  CHECK (
    (subject_id IS NOT NULL AND subject_category_id IS NULL) OR
    (subject_id IS NULL AND subject_category_id IS NOT NULL)
  );

-- 3. Créer la table child_subject_category_enrollments
CREATE TABLE IF NOT EXISTS child_subject_category_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  subject_category_id UUID NOT NULL REFERENCES subject_categories(id) ON DELETE CASCADE,
  selected BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, subject_category_id)
);

-- 4. Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_subject_categories_subject_id ON subject_categories(subject_id);
CREATE INDEX IF NOT EXISTS idx_games_subject_category_id ON games(subject_category_id);
CREATE INDEX IF NOT EXISTS idx_child_category_enrollments_child_id ON child_subject_category_enrollments(child_id);
CREATE INDEX IF NOT EXISTS idx_child_category_enrollments_category_id ON child_subject_category_enrollments(subject_category_id);

-- 5. Créer un trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subject_categories_updated_at
  BEFORE UPDATE ON subject_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_child_category_enrollments_updated_at
  BEFORE UPDATE ON child_subject_category_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. RLS Policies pour subject_categories
ALTER TABLE subject_categories ENABLE ROW LEVEL SECURITY;

-- Policy: Les professeurs peuvent voir toutes les sous-catégories
CREATE POLICY "Les professeurs peuvent voir toutes les sous-catégories"
  ON subject_categories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND 'prof' = ANY(profiles.roles)
    )
  );

-- Policy: Les professeurs peuvent créer des sous-catégories
CREATE POLICY "Les professeurs peuvent créer des sous-catégories"
  ON subject_categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND 'prof' = ANY(profiles.roles)
    )
  );

-- Policy: Les professeurs peuvent modifier leurs sous-catégories
CREATE POLICY "Les professeurs peuvent modifier les sous-catégories"
  ON subject_categories
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND 'prof' = ANY(profiles.roles)
    )
  );

-- Policy: Les professeurs peuvent supprimer leurs sous-catégories
CREATE POLICY "Les professeurs peuvent supprimer les sous-catégories"
  ON subject_categories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND 'prof' = ANY(profiles.roles)
    )
  );

-- 7. RLS Policies pour child_subject_category_enrollments
ALTER TABLE child_subject_category_enrollments ENABLE ROW LEVEL SECURITY;

-- Policy: Les parents peuvent voir les enrollments de leurs enfants
CREATE POLICY "Les parents peuvent voir les enrollments de leurs enfants"
  ON child_subject_category_enrollments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = child_subject_category_enrollments.child_id
      AND children.parent_id = auth.uid()
    )
  );

-- Policy: Les parents peuvent créer des enrollments pour leurs enfants
CREATE POLICY "Les parents peuvent créer des enrollments pour leurs enfants"
  ON child_subject_category_enrollments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = child_subject_category_enrollments.child_id
      AND children.parent_id = auth.uid()
    )
  );

-- Policy: Les parents peuvent modifier les enrollments de leurs enfants
CREATE POLICY "Les parents peuvent modifier les enrollments de leurs enfants"
  ON child_subject_category_enrollments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = child_subject_category_enrollments.child_id
      AND children.parent_id = auth.uid()
    )
  );

-- Policy: Les parents peuvent supprimer les enrollments de leurs enfants
CREATE POLICY "Les parents peuvent supprimer les enrollments de leurs enfants"
  ON child_subject_category_enrollments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = child_subject_category_enrollments.child_id
      AND children.parent_id = auth.uid()
    )
  );

-- 8. Mettre à jour les policies RLS existantes pour games si nécessaire
-- (Les jeux liés aux sous-catégories doivent être accessibles de la même manière)

