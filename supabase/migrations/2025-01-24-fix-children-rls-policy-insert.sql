-- Correction de la politique RLS INSERT pour children
-- Les parents doivent pouvoir créer des enfants avec leur propre parent_id

-- Supprimer les anciennes politiques INSERT si elles existent
DROP POLICY IF EXISTS "Parents can insert children" ON children;
DROP POLICY IF EXISTS "Parents can create children" ON children;
DROP POLICY IF EXISTS "children_insert_parent" ON children;

-- Créer une fonction SECURITY DEFINER pour vérifier que parent_id = auth.uid()
-- (similaire à check_child_parent_relationship mais pour INSERT)
CREATE OR REPLACE FUNCTION check_parent_can_create_child(parent_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT parent_id_param = user_id_param;
$$;

-- Politique pour INSERT : les parents peuvent créer des enfants avec leur propre parent_id
CREATE POLICY "children_insert_parent"
ON children
FOR INSERT
WITH CHECK (
  check_parent_can_create_child(children.parent_id, auth.uid())
);

-- Vérifier aussi les autres politiques (SELECT, UPDATE, DELETE) pour s'assurer qu'elles sont correctes
-- Si elles n'existent pas, les créer

-- Politique pour SELECT : les parents peuvent voir leurs propres enfants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'children' 
    AND policyname = 'children_select_parent'
  ) THEN
    CREATE POLICY "children_select_parent"
    ON children
    FOR SELECT
    USING (
      parent_id = auth.uid()
    );
  END IF;
END $$;

-- Politique pour UPDATE : les parents peuvent modifier leurs propres enfants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'children' 
    AND policyname = 'children_update_parent'
  ) THEN
    CREATE POLICY "children_update_parent"
    ON children
    FOR UPDATE
    USING (
      parent_id = auth.uid()
    )
    WITH CHECK (
      parent_id = auth.uid()
    );
  END IF;
END $$;

-- Politique pour DELETE : les parents peuvent supprimer leurs propres enfants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'children' 
    AND policyname = 'children_delete_parent'
  ) THEN
    CREATE POLICY "children_delete_parent"
    ON children
    FOR DELETE
    USING (
      parent_id = auth.uid()
    );
  END IF;
END $$;

