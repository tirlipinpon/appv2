-- Nettoyer les politiques RLS en double et corriger les problèmes

-- Supprimer toutes les anciennes politiques (doublons)
DROP POLICY IF EXISTS "Parents can delete enrollments for their children" ON child_subject_enrollments;
DROP POLICY IF EXISTS "Parents can insert enrollments for their children" ON child_subject_enrollments;
DROP POLICY IF EXISTS "Parents can select enrollments for their children" ON child_subject_enrollments;
DROP POLICY IF EXISTS "Parents can update enrollments for their children" ON child_subject_enrollments;
DROP POLICY IF EXISTS "cse_delete_parent" ON child_subject_enrollments;
DROP POLICY IF EXISTS "cse_insert_parent" ON child_subject_enrollments;
DROP POLICY IF EXISTS "cse_select_parent" ON child_subject_enrollments;
DROP POLICY IF EXISTS "cse_update_parent" ON child_subject_enrollments;

-- Recréer les politiques avec des noms cohérents et la syntaxe correcte
-- IMPORTANT: Utiliser SECURITY DEFINER pour contourner les politiques RLS sur children si nécessaire
-- ou s'assurer que la sous-requête peut accéder à children

-- Politique pour SELECT : les parents peuvent voir les enrollments de leurs enfants
-- Utiliser une fonction SECURITY DEFINER pour contourner les RLS sur children si nécessaire
CREATE OR REPLACE FUNCTION check_child_parent_relationship(child_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM children c
    WHERE c.id = child_id_param
    AND c.parent_id = user_id_param
  );
$$;

CREATE POLICY "cse_select_parent"
ON child_subject_enrollments
FOR SELECT
USING (
  check_child_parent_relationship(child_subject_enrollments.child_id, auth.uid())
);

-- Politique pour INSERT : les parents peuvent créer des enrollments pour leurs enfants
CREATE POLICY "cse_insert_parent"
ON child_subject_enrollments
FOR INSERT
WITH CHECK (
  check_child_parent_relationship(child_subject_enrollments.child_id, auth.uid())
);

-- Politique pour UPDATE : les parents peuvent modifier les enrollments de leurs enfants
CREATE POLICY "cse_update_parent"
ON child_subject_enrollments
FOR UPDATE
USING (
  check_child_parent_relationship(child_subject_enrollments.child_id, auth.uid())
)
WITH CHECK (
  check_child_parent_relationship(child_subject_enrollments.child_id, auth.uid())
);

-- Politique pour DELETE : les parents peuvent supprimer les enrollments de leurs enfants
CREATE POLICY "cse_delete_parent"
ON child_subject_enrollments
FOR DELETE
USING (
  check_child_parent_relationship(child_subject_enrollments.child_id, auth.uid())
);

