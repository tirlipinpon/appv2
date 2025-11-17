-- Migration pour corriger les politiques RLS de child_subject_enrollments
-- et créer automatiquement les enrollments par défaut

-- Activer RLS sur la table si ce n'est pas déjà fait
ALTER TABLE child_subject_enrollments ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Parents can insert enrollments for their children" ON child_subject_enrollments;
DROP POLICY IF EXISTS "Parents can update enrollments for their children" ON child_subject_enrollments;
DROP POLICY IF EXISTS "Parents can select enrollments for their children" ON child_subject_enrollments;
DROP POLICY IF EXISTS "Parents can delete enrollments for their children" ON child_subject_enrollments;

-- Politique pour SELECT : les parents peuvent voir les enrollments de leurs enfants
CREATE POLICY "Parents can select enrollments for their children"
ON child_subject_enrollments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM children
    WHERE children.id = child_subject_enrollments.child_id
    AND children.parent_id = auth.uid()
  )
);

-- Politique pour INSERT : les parents peuvent créer des enrollments pour leurs enfants
CREATE POLICY "Parents can insert enrollments for their children"
ON child_subject_enrollments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM children
    WHERE children.id = child_subject_enrollments.child_id
    AND children.parent_id = auth.uid()
  )
);

-- Politique pour UPDATE : les parents peuvent modifier les enrollments de leurs enfants
CREATE POLICY "Parents can update enrollments for their children"
ON child_subject_enrollments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM children
    WHERE children.id = child_subject_enrollments.child_id
    AND children.parent_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM children
    WHERE children.id = child_subject_enrollments.child_id
    AND children.parent_id = auth.uid()
  )
);

-- Politique pour DELETE : les parents peuvent supprimer les enrollments de leurs enfants
CREATE POLICY "Parents can delete enrollments for their children"
ON child_subject_enrollments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM children
    WHERE children.id = child_subject_enrollments.child_id
    AND children.parent_id = auth.uid()
  )
);

-- Fonction pour créer automatiquement les enrollments par défaut
CREATE OR REPLACE FUNCTION create_default_enrollments_for_child()
RETURNS TRIGGER AS $$
BEGIN
  -- Quand un enfant est créé ou mis à jour avec une école et un niveau
  IF NEW.school_id IS NOT NULL AND NEW.school_level IS NOT NULL THEN
    -- Insérer les enrollments pour les matières assignées par les profs
    INSERT INTO child_subject_enrollments (child_id, school_id, school_year_id, subject_id, selected)
    SELECT 
      NEW.id,
      NEW.school_id,
      NULL, -- school_year_id peut être null ou récupéré si disponible
      ta.subject_id,
      true -- activé par défaut
    FROM teacher_assignments ta
    WHERE ta.school_id = NEW.school_id
      AND ta.school_level = NEW.school_level
      AND ta.deleted_at IS NULL
    ON CONFLICT DO NOTHING; -- Éviter les doublons si une contrainte unique existe
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour créer automatiquement les enrollments
DROP TRIGGER IF EXISTS trigger_create_default_enrollments ON children;
CREATE TRIGGER trigger_create_default_enrollments
AFTER INSERT OR UPDATE OF school_id, school_level ON children
FOR EACH ROW
WHEN (NEW.school_id IS NOT NULL AND NEW.school_level IS NOT NULL)
EXECUTE FUNCTION create_default_enrollments_for_child();

-- Fonction pour créer les enrollments par défaut pour les enfants existants
-- (à exécuter manuellement si nécessaire pour les enfants déjà créés)
CREATE OR REPLACE FUNCTION create_default_enrollments_for_existing_children()
RETURNS void AS $$
BEGIN
  INSERT INTO child_subject_enrollments (child_id, school_id, school_year_id, subject_id, selected)
  SELECT DISTINCT
    c.id,
    c.school_id,
    NULL,
    ta.subject_id,
    true
  FROM children c
  INNER JOIN teacher_assignments ta 
    ON ta.school_id = c.school_id
    AND ta.school_level = c.school_level
  WHERE c.school_id IS NOT NULL
    AND c.school_level IS NOT NULL
    AND ta.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM child_subject_enrollments cse
      WHERE cse.child_id = c.id
      AND cse.subject_id = ta.subject_id
    )
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

