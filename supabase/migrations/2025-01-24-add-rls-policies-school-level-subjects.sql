-- Ajouter les politiques RLS pour school_level_subjects
-- Les professeurs doivent pouvoir créer, lire, modifier et supprimer les liens école/niveau ↔ matière

-- Fonction helper pour vérifier si l'utilisateur est un professeur
CREATE OR REPLACE FUNCTION is_teacher(user_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM teachers t
    INNER JOIN profiles p ON p.id = t.profile_id
    WHERE p.id = user_id_param
  );
$$;

-- Politique pour SELECT : Les professeurs peuvent voir tous les liens
CREATE POLICY "Teachers can view school_level_subjects"
ON school_level_subjects
FOR SELECT
USING (
  is_teacher(auth.uid())
);

-- Politique pour INSERT : Les professeurs peuvent créer des liens
CREATE POLICY "Teachers can insert school_level_subjects"
ON school_level_subjects
FOR INSERT
WITH CHECK (
  is_teacher(auth.uid())
);

-- Politique pour UPDATE : Les professeurs peuvent modifier les liens
CREATE POLICY "Teachers can update school_level_subjects"
ON school_level_subjects
FOR UPDATE
USING (
  is_teacher(auth.uid())
)
WITH CHECK (
  is_teacher(auth.uid())
);

-- Politique pour DELETE : Les professeurs peuvent supprimer les liens
CREATE POLICY "Teachers can delete school_level_subjects"
ON school_level_subjects
FOR DELETE
USING (
  is_teacher(auth.uid())
);

