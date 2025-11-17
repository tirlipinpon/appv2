-- Correction de la politique RLS INSERT pour child_subject_enrollments
-- Le problème : dans WITH CHECK pour INSERT, on doit référencer les colonnes de la nouvelle ligne correctement

-- Supprimer l'ancienne politique
DROP POLICY IF EXISTS "Parents can insert enrollments for their children" ON child_subject_enrollments;

-- Créer la nouvelle politique avec la syntaxe correcte
-- Dans WITH CHECK pour INSERT, on peut référencer les colonnes via le nom de la table
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

